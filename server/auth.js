import bcrypt from 'bcryptjs';
import { segredo } from './config.js';
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

export const signToken = (user) =>
    jwt.sign({ sub: String(user.id), staff: user.is_staff === true }, SECRET, { expiresIn: EXPIRES });

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
export function validateCredentials({ email, password }) {
    const clean = normalizeEmail(email);

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return 'E-mail inválido.';
    if (typeof password !== 'string' || password.length < 8) {
        return 'A senha precisa de pelo menos 8 caracteres.';
    }
    // O bcrypt ignora o que passa de 72 bytes — recusar é melhor que truncar
    // em silêncio e a pessoa achar que a senha inteira está valendo.
    if (Buffer.byteLength(password) > 72) return 'A senha é longa demais.';

    return null;
}

// Porta de entrada de tudo que é autenticado. Só valida o token e diz quem é;
// o que a pessoa pode ver é decisão de quem vem depois.
export function requireAuth(req, res, next) {
    // Só cookie. Aceitar Bearer também abriria um segundo caminho de sessão
    // que escapa das proteções do cookie — acesso programático, quando existir,
    // vai ser chave de API, que é outro mecanismo.
    const token = req.cookies?.[SESSION_COOKIE];
    const claims = token ? verifyToken(token) : null;

    if (!claims) return res.status(401).json({ error: 'Não autenticado.' });

    req.user = { id: claims.sub, isStaff: claims.staff === true };
    next();
}

// Limite de tentativas de login, em memória.
//
// Janela deslizante por chave (IP + e-mail): quem erra seis vezes em dez
// minutos espera. Sem isso, uma senha de oito caracteres cai em força bruta
// contra o endpoint, e o bcrypt só torna isso lento — não impossível.
//
// Em memória é o suficiente para um processo. Com várias instâncias, cada uma
// contaria separado e o teto efetivo multiplicaria — aí a contagem precisa
// sair para um lugar compartilhado.
const TENTATIVAS = new Map();
const TETO = 6;
const JANELA_MS = 10 * 60 * 1000;

export function limitarTentativas(req, res, next) {
    const chave = `${req.ip}|${normalizeEmail(req.body?.email)}`;
    const agora = Date.now();

    const recentes = (TENTATIVAS.get(chave) ?? []).filter((t) => agora - t < JANELA_MS);

    if (recentes.length >= TETO) {
        const esperaSeg = Math.ceil((JANELA_MS - (agora - recentes[0])) / 1000);
        res.set('Retry-After', String(esperaSeg));
        return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
    }

    recentes.push(agora);
    TENTATIVAS.set(chave, recentes);

    // Limpeza oportunista: sem isso o Map cresce para sempre com chaves de
    // quem entrou uma vez e nunca mais voltou.
    if (TENTATIVAS.size > 5000) {
        for (const [k, v] of TENTATIVAS) {
            if (v.every((t) => agora - t >= JANELA_MS)) TENTATIVAS.delete(k);
        }
    }

    next();
}

// Login bem-sucedido zera a contagem: quem acertou não é atacante.
export function limparTentativas(req) {
    TENTATIVAS.delete(`${req.ip}|${normalizeEmail(req.body?.email)}`);
}
