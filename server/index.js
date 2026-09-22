//Import
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { findSiteByToken, insertEvents, createUser, findUserByEmail, listSitesForUser, findSiteForUser, createSiteForUser, userHasDomain, setSiteActive, renameSite, markVerifiedBySnippet, recordRejection, listRejections } from './db.js';
import { overview, isPeriod } from './reports.js';
import { localizar } from './geo.js';
import { hashPassword, checkPassword, normalizeEmail, signToken, validateCredentials, requireAuth, SESSION_COOKIE, sessionCookie, limitarTentativas, limparTentativas } from './auth.js';
import { toRows, normalizeDomain, isBot } from './parse.js';

//Server config
const app = express();
const PORT = process.env.PORT || 3002;

// Atrás de proxy ou CDN, req.ip vira o IP do proxy e a geolocalização inteira
// quebra. Mas confiar no X-Forwarded-For sem critério deixa qualquer um forjar
// o próprio IP — por isso é opt-in, e o valor diz quantos saltos confiar.
// Em produção: TRUST_PROXY=1 se houver um proxy à frente.
const TRUST_PROXY = process.env.TRUST_PROXY;
if (TRUST_PROXY) {
    app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);
}

//Middleware
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

// Dois CORS, porque são dois públicos:
//   público  — o beacon vem do site de qualquer cliente, não dá para listar
//   dashboard — só a nossa origem, e com credenciais, porque o navegador recusa
//               Allow-Origin '*' em requisição que carrega cookie
const publicCors = cors();
const dashboardCors = cors({
    origin: process.env.DASHBOARD_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
});

// O Origin chega como 'https://site.com.br'; o banco guarda só o host.
// www conta como o mesmo site.
function originMatches(origin, domain) {
    let host;
    try {
        host = new URL(origin).hostname;
    } catch {
        return false;
    }
    return host === domain || host === `www.${domain}`;
}

//Routes
// O beacon é minificado e servido da memória. Sem isso os comentários iriam
// junto para o navegador de cada visitante de cada cliente — e eles são quase
// metade do arquivo. Minificar na entrega mantém o fonte comentado sem cobrar
// isso de quem visita.
const BEACON = fileURLToPath(new URL('../tracker/beacon.js', import.meta.url));
let beaconJs = null;

app.get('/t.js', publicCors, async (req, res) => {
    try {
        // Em desenvolvimento relê a cada pedido, para o F5 refletir a edição.
        // Em produção o arquivo não muda sem redeploy, então vale guardar.
        if (!beaconJs || process.env.NODE_ENV !== 'production') {
            // build e não transform: o beacon importa a web-vitals, e agrupar
            // evita um segundo pedido de rede no site de cada cliente.
            const { outputFiles } = await build({
                entryPoints: [BEACON],
                bundle: true,
                minify: true,
                format: 'iife',
                target: 'es2020',
                write: false,
                // O beacon mora em tracker/, e o esbuild resolveria a partir
                // de lá — onde não há node_modules. As dependências dele são
                // do servidor, que é quem o entrega.
                nodePaths: [fileURLToPath(new URL('./node_modules', import.meta.url))],
            });
            beaconJs = outputFiles[0].text;
        }
    } catch (err) {
        console.error('[beacon] falha ao preparar:', err.message);
        return res.status(500).end();
    }

    res.type('application/javascript');
    // 5 minutos: curto o bastante para uma correção chegar rápido a todos os
    // sites, longo o bastante para não buscar o script a cada navegação.
    res.set('Cache-Control', 'public, max-age=300');
    res.send(beaconJs);
});

// O parser de texto vive só aqui: o beacon manda text/plain por causa do
// sendBeacon, e o resto da API fala JSON como qualquer outra.
app.post('/e', publicCors, express.text({ type: '*/*', limit: '8kb' }), async (req, res) => {
    // Lido antes de responder de propósito: o res.end() libera o socket, e
    // depois do await lá embaixo req.ip já vem undefined.
    const fromServer = {
        receivedAt: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('user-agent'),
        origin: req.get('origin'),
        // Derivada aqui e carregada adiante já resolvida: o parse nunca vê o IP,
        // e a suíte de testes dele não precisa carregar o banco geográfico.
        geo: localizar(req.ip),
    };

    // Responde antes de processar: o navegador do visitante não espera pelo
    // nosso trabalho, e 204 sempre — nem erro nosso pode afetar o site alheio.
    res.status(204).end();

    let payload;
    try {
        payload = JSON.parse(req.body);
    } catch {
        console.warn('[ingest] corpo inválido, descartado');
        return;
    }

    if (!Array.isArray(payload.events) || payload.events.length === 0) {
        console.warn('[ingest] envelope sem eventos, descartado');
        return;
    }

    // Antes de consultar o banco: robô não merece uma ida ao Postgres, e o
    // descarte é no ingest e não na consulta — filtrar na leitura obrigaria a
    // lembrar do filtro em toda consulta nova, e esquecer uma seria silencioso.
    if (isBot(fromServer.userAgent)) {
        console.warn('[ingest] robô descartado:', fromServer.userAgent ?? '(sem user agent)');
        return;
    }

    let site;
    try {
        site = await findSiteByToken(payload.token);
    } catch (err) {
        console.error('[ingest] banco indisponível:', err.message);
        return;
    }

    if (!site) {
        console.warn('[ingest] token desconhecido, descartado');
        return;
    }
    if (!site.active) {
        console.warn(`[ingest] site ${site.id} inativo, descartado`);
        return;
    }

    // O token é público: quem lê o HTML do cliente consegue copiá-lo. Conferir
    // o Origin é o que impede usarem o token dele em outro domínio.
    if (!originMatches(fromServer.origin, site.domain)) {
        console.warn(`[ingest] origem ${fromServer.origin} não confere com ${site.domain}, descartado`);

        // Registrado para a tela de instalação poder explicar o silêncio a quem
        // colou a tag. É o erro de instalação mais comum e o mais difícil de
        // diagnosticar sozinho — a maioria das ferramentas só mostra nada.
        await recordRejection({
            siteId: site.id,
            origin: fromServer.origin ?? '(sem origem)',
            events: payload.events.length,
        }).catch(() => {});
        return;
    }

    const rows = toRows({ payload, fromServer, site });
    if (rows.length === 0) {
        console.warn('[ingest] envelope sem linha aproveitável, descartado');
        return;
    }

    try {
        const saved = await insertEvents(rows);
        console.log(`[ingest] site ${site.id}: ${saved} evento(s) gravado(s)`);

        // Só na primeira vez: a consulta em memória já diz se falta verificar,
        // então não há UPDATE em todo evento do resto da vida do site.
        if (!site.verified_at) {
            await markVerifiedBySnippet(site.id);
            console.log(`[ingest] site ${site.id} verificado pelo snippet`);
        }
    } catch (err) {
        console.error('[ingest] falha ao gravar:', err.message);
    }
});

app.use(dashboardCors);

app.post('/auth/register', async (req, res) => {
    const problem = validateCredentials(req.body ?? {});
    if (problem) return res.status(400).json({ error: problem });

    const email = normalizeEmail(req.body.email);

    try {
        const user = await createUser({ email, passwordHash: await hashPassword(req.body.password) });
        res.cookie(SESSION_COOKIE, signToken(user), sessionCookie);
        res.status(201).json({ user: { id: user.id, email: user.email } });
    } catch (err) {
        // 23505 = violação de índice único, ou seja, e-mail já cadastrado.
        if (err.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado.' });
        console.error('[auth] falha no cadastro:', err.message);
        res.status(500).json({ error: 'Não foi possível criar a conta.' });
    }
});

app.post('/auth/login', limitarTentativas, async (req, res) => {
    const { email, password } = req.body ?? {};
    const user = await findUserByEmail(normalizeEmail(email));

    // Compara mesmo sem usuário, contra um hash descartável: sem isso, o tempo
    // de resposta denuncia quais e-mails existem no banco.
    const hash = user?.password_hash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await checkPassword(String(password ?? ''), hash);

    // Mensagem única de propósito: dizer "senha errada" confirma o cadastro.
    if (!user || !ok) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });

    limparTentativas(req);
    res.cookie(SESSION_COOKIE, signToken(user), sessionCookie);
    res.json({ user: { id: user.id, email: user.email } });
});

// Guarda de acesso ao site. 404 e não 403 de propósito: 403 confirmaria que o
// site existe, e "existe mas não é seu" já é informação que não devemos dar.
async function requireSiteAccess(req, res, next) {
    const site = await findSiteForUser({
        siteId: req.params.siteId,
        userId: req.user.id,
        isStaff: req.user.isStaff,
    });
    if (!site) return res.status(404).json({ error: 'Site não encontrado.' });

    req.site = site;
    next();
}

// Ler é para quem tem acesso; mexer na configuração do site é só para o dono.
// Separado de propósito: 'member' vai existir para o gestor de tráfego e para o
// sócio, e nenhum dos dois deveria conseguir desligar o rastreamento.
function requireOwner(req, res, next) {
    if (req.user.isStaff || req.site.role === 'owner') return next();
    res.status(403).json({ error: 'Só o dono do site pode fazer isso.' });
}

app.post('/auth/logout', (req, res) => {
    // Precisa das MESMAS opções do set, senão o navegador entende como outro
    // cookie e o antigo continua valendo.
    res.clearCookie(SESSION_COOKIE, sessionCookie);
    res.status(204).end();
});

app.get('/me', requireAuth, (req, res) => {
    res.json({ id: req.user.id, isStaff: req.user.isStaff });
});

app.get('/sites', requireAuth, async (req, res) => {
    res.json(await listSitesForUser({ userId: req.user.id, isStaff: req.user.isStaff }));
});

app.get('/sites/:siteId', requireAuth, requireSiteAccess, (req, res) => {
    res.json(req.site);
});

// Cadastro de site. O token nasce aqui e é a única coisa que o cliente
// precisa levar para o HTML dele — nada de copiar identificador de lugar nenhum.
const nomeInvalido = (name) =>
    name.length === 0 || name.length > 80
        ? 'O nome precisa ter entre 1 e 80 caracteres.'
        : null;

app.post('/sites', requireAuth, async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const domain = normalizeDomain(req.body?.domain);

    const problema = nomeInvalido(name);
    if (problema) return res.status(400).json({ error: problema });
    if (!domain) {
        return res.status(400).json({ error: 'Endereço inválido. Use o domínio do site, como clinica.com.br.' });
    }

    try {
        if (await userHasDomain({ userId: req.user.id, domain })) {
            return res.status(409).json({ error: `Você já tem um site em ${domain}.` });
        }
        res.status(201).json(await createSiteForUser({ name, domain, userId: req.user.id }));
    } catch (err) {
        console.error('[sites] falha ao criar:', err.message);
        res.status(500).json({ error: 'Não foi possível criar o site.' });
    }
});

// Só o nome. O domínio é imutável de propósito: ele é a chave contra a qual o
// Origin de cada evento é conferido, e trocá-lo cortaria a coleta do site em
// silêncio e invalidaria a verificação já feita. Domínio novo é site novo.
app.patch('/sites/:siteId', requireAuth, requireSiteAccess, requireOwner, async (req, res) => {
    const name = String(req.body?.name ?? '').trim();

    const problema = nomeInvalido(name);
    if (problema) return res.status(400).json({ error: problema });

    await renameSite({ siteId: req.site.id, name });
    res.json({ ...req.site, name });
});

// Remover para de receber evento e some do painel; o histórico fica.
app.delete('/sites/:siteId', requireAuth, requireSiteAccess, requireOwner, async (req, res) => {
    await setSiteActive({ siteId: req.site.id, active: false });
    res.status(204).end();
});

app.post('/sites/:siteId/reactivate', requireAuth, requireSiteAccess, requireOwner, async (req, res) => {
    await setSiteActive({ siteId: req.site.id, active: true });
    res.status(204).end();
});

app.get('/sites/:siteId/rejections', requireAuth, requireSiteAccess, async (req, res) => {
    res.json(await listRejections(req.site.id));
});

app.get('/sites/:siteId/overview', requireAuth, requireSiteAccess, async (req, res) => {
    const period = req.query.period ?? '7d';
    if (!isPeriod(period)) return res.status(400).json({ error: 'Período inválido.' });

    try {
        res.json(await overview({ siteId: req.site.id, period }));
    } catch (err) {
        console.error('[relatorio] falhou:', err.message);
        res.status(500).json({ error: 'Não foi possível montar o relatório.' });
    }
});

//Start server
app.listen(PORT, () => {
    console.log(`Ingest ouvindo em http://localhost:${PORT}`);
});
