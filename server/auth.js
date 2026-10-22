import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { segredo } from './config.js';
import { findUserById } from './db.js';
import jwt from 'jsonwebtoken';

const SECRET = segredo('JWT_SECRET', 'dev_jwt_secret_so_para_desenvolvimento');
const EXPIRES = process.env.JWT_EXPIRES || '7d';

// Custo do bcrypt. Alto de propósito: o atraso de ~250ms é irrelevante num
// login e caro num ataque de força bruta sobre o banco vazado.
const ROUNDS = 12;

export const SESSION_COOKIE = 'coddara_session';

// httpOnly: nem o nosso próprio JavaScript lê — é o que tira o token do alcance
// de um XSS. sameSite lax barra o cookie em POST vindo de outro site, que é o
// CSRF clássico; funciona porque dashboard e API ficam sob o mesmo domínio.
// secure só em produção: em localhost não há HTTPS e o cookie seria descartado.
export const sessionCookie = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
};

export const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);
export const checkPassword = (plain, hash) => bcrypt.compare(plain, hash);

// O e-mail é chave de login: normalizar na entrada evita que a pessoa se
// cadastre com maiúscula e não consiga entrar depois. O índice único em
// lower(email) cobre o caso de isto aqui falhar.
export const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

// ver é a versão da sessão do usuário no momento da emissão. Quando ela sobe no
// banco — senha trocada, "sair de todos" —, este token deixa de valer.
export const signToken = (user) =>
    jwt.sign({ sub: String(user.id), ver: user.session_version }, SECRET, { expiresIn: EXPIRES });

export function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET);
    } catch {
        // Expirado, adulterado ou lixo dão no mesmo para quem chamou.
        return null;
    }
}

// Validação mínima, do lado do servidor. O formulário também valida, mas
// validação de formulário é conveniência — ninguém é obrigado a usar o
// formulário para chamar a API.
export function validateEmail(email) {
    const clean = normalizeEmail(email);
    if (clean.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return 'E-mail inválido.';
    return null;
}

export function validatePassword(password) {
    if (typeof password !== 'string' || password.length < 8) {
        return 'A senha precisa de pelo menos 8 caracteres.';
    }
    // O bcrypt ignora o que passa de 72 bytes — recusar é melhor que truncar
    // em silêncio e a pessoa achar que a senha inteira está valendo.
    if (Buffer.byteLength(password) > 72) return 'A senha é longa demais.';

    return null;
}

// Token dos links de e-mail. 32 bytes aleatórios: ninguém chuta. O banco guarda
// só o SHA-256 — sem sal e sem bcrypt de propósito, porque o token já tem
// entropia de sobra e precisa ser achado por igualdade, num índice.
export const hashAuthToken = (token) => createHash('sha256').update(String(token)).digest('hex');

export function newAuthToken() {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: hashAuthToken(token) };
}

// Porta de entrada de tudo que é autenticado. Valida o token e confere a
// versão da sessão contra o banco; o que a pessoa pode ver é decisão de quem
// vem depois.
//
// A ida ao banco é o preço da revogação: sem ela, trocar a senha não expulsava
// ninguém. É uma busca por chave primária, numa rota de painel — barata.
// is_staff também vem daqui, e não do token, para tirar o acesso valer na hora.
export async function requireAuth(req, res, next) {
    // Só cookie. Aceitar Bearer também abriria um segundo caminho de sessão
    // que escapa das proteções do cookie — acesso programático, quando existir,
    // vai ser chave de API, que é outro mecanismo.
    const token = req.cookies?.[SESSION_COOKIE];
    const claims = token ? verifyToken(token) : null;
    if (!claims) return res.status(401).json({ error: 'Não autenticado.' });

    const user = await findUserById(claims.sub);
    if (!user || user.session_version !== claims.ver) {
        return res.status(401).json({ error: 'Sessão encerrada. Entre de novo.' });
    }

    req.user = { id: String(user.id), email: user.email, isStaff: user.is_staff === true };
    next();
}

// Limite de tentativas, em memória.
//
// Janela deslizante por chave: quem passa do teto dentro da janela espera.
// Em memória é o suficiente para um processo. Com várias instâncias, cada uma
// contaria separado e o teto efetivo multiplicaria — aí a contagem precisa
// sair para um lugar compartilhado.
function criarLimite({ teto, janelaMs }) {
    const registro = new Map();

    // Faxina por relógio: sem ela o Map cresce para sempre com chaves de quem
    // passou uma vez e nunca voltou — e as chaves levam IP, que a política de
    // privacidade promete tirar da memória quando a janela acaba (até uma hora,
    // mais um minuto de folga). unref para o timer não segurar o processo vivo.
    setInterval(() => {
        const agora = Date.now();
        for (const [k, v] of registro) {
            if (v.every((t) => agora - t >= janelaMs)) registro.delete(k);
        }
    }, 60 * 1000).unref();

    return {
        // Conta a tentativa e diz quanto falta esperar, em segundos; 0 = liberado.
        registrar(chave) {
            const agora = Date.now();
            const recentes = (registro.get(chave) ?? []).filter((t) => agora - t < janelaMs);

            if (recentes.length >= teto) {
                return Math.ceil((janelaMs - (agora - recentes[0])) / 1000);
            }

            recentes.push(agora);
            registro.set(chave, recentes);
            return 0;
        },
        limpar(chave) {
            registro.delete(chave);
        },
    };
}

function responderLimite(res, esperaSeg) {
    res.set('Retry-After', String(esperaSeg));
    res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
}

// Login: seis erros em dez minutos por IP + e-mail. Sem isso, uma senha de oito
// caracteres cai em força bruta contra o endpoint, e o bcrypt só torna isso
// lento — não impossível.
const LOGIN = criarLimite({ teto: 6, janelaMs: 10 * 60 * 1000 });
const chaveLogin = (req) => `${req.ip}|${normalizeEmail(req.body?.email)}`;

export function limitarTentativas(req, res, next) {
    const espera = LOGIN.registrar(chaveLogin(req));
    if (espera) return responderLimite(res, espera);
    next();
}

// Login bem-sucedido zera a contagem: quem acertou não é atacante.
export const limparTentativas = (req) => LOGIN.limpar(chaveLogin(req));

// Pedidos que disparam e-mail: cadastro e "esqueci a senha". Dois limites,
// porque são dois abusos diferentes:
//
//   por IP     — alguém usando o formulário para mandar e-mail em massa pela
//                nossa conta do Resend, o que queima a reputação do domínio.
//                Responde 429: o IP não revela nada sobre conta nenhuma.
//   por e-mail — alguém enchendo a caixa de entrada de uma pessoa específica.
//                Aqui o pedido é aceito e o envio é pulado em silêncio, porque
//                um 429 diferente por e-mail diria quais endereços têm conta.
const EMAIL_POR_IP = criarLimite({ teto: 10, janelaMs: 60 * 60 * 1000 });
const EMAIL_POR_DESTINO = criarLimite({ teto: 3, janelaMs: 60 * 60 * 1000 });

export function limitarEnvioPorIp(req, res, next) {
    const espera = EMAIL_POR_IP.registrar(req.ip);
    if (espera) return responderLimite(res, espera);
    next();
}

export const podeEnviarPara = (email) => EMAIL_POR_DESTINO.registrar(normalizeEmail(email)) === 0;

// Trocar a senha estando logado pede a atual — limite próprio, para a tela de
// conta não virar um oráculo de força bruta para quem achou uma sessão aberta.
const TROCA = criarLimite({ teto: 6, janelaMs: 10 * 60 * 1000 });

export function limitarTroca(req, res, next) {
    const espera = TROCA.registrar(req.user.id);
    if (espera) return responderLimite(res, espera);
    next();
}
