import { createHash } from 'node:crypto';
import { segredo } from './config.js';
import { UAParser } from 'ua-parser-js';

const SALT = segredo('VISITOR_SALT', 'dev_salt_so_para_desenvolvimento');
const TZ = process.env.SITE_TIMEZONE || 'America/Sao_Paulo';

// Teto do offset de um evento dentro do lote: 24h. Sem isso, um ts forjado
// grava evento no passado remoto ou no futuro.
const MAX_OFFSET_MS = 24 * 60 * 60 * 1000;

// Identidade sem consentimento. Troca sozinha à meia-noite porque o dia entra
// no hash — em São Paulo, não em UTC, senão viraria às 21h e partiria a noite
// de quem está navegando. O site_id impede cruzar a mesma pessoa entre clientes.
// O IP entra aqui e não é gravado em lugar nenhum.
export function visitorHash({ ip, userAgent, siteId, at = new Date() }) {
    const day = at.toLocaleDateString('en-CA', { timeZone: TZ });
    return createHash('sha256')
        .update(`${SALT}|${day}|${ip || ''}|${userAgent || ''}|${siteId}`)
        .digest('hex')
        .slice(0, 32);
}

// '/promo/' e '/promo' são a mesma página e precisam agrupar juntas.
function normalizePath(pathname) {
    if (!pathname) return '/';
    return pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : '/';
}

export function parseUrl(href) {
    let url;
    try {
        url = new URL(href);
    } catch {
        return null;
    }
    const q = url.searchParams;
    return {
        path: normalizePath(url.pathname),
        // get() devolve null quando ausente, que é o que o banco quer.
        utm_source: q.get('utm_source'),
        utm_medium: q.get('utm_medium'),
        utm_campaign: q.get('utm_campaign'),
    };
}

// Navegação interna não é origem de tráfego: contaria o cliente como fonte
// dele mesmo e inflaria o número de visitantes "vindos de fora".
export function referrerHost(referrer, ownDomain) {
    if (!referrer) return null;
    let host;
    try {
        host = new URL(referrer).hostname;
    } catch {
        return null;
    }
    if (!host) return null;

    // Sem o www, senão 'google.com' e 'www.google.com' viram duas origens
    // distintas no relatório e o cliente vê a mesma fonte partida em duas.
    host = host.replace(/^www\./, '');

    if (host === ownDomain.replace(/^www\./, '')) return null;
    return host;
}

function parseSize(value) {
    const m = /^(\d{1,5})x(\d{1,5})$/.exec(value || '');
    return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: null, h: null };
}

// O user agent chega no header, não no payload — o visitante não tem como
// forjar pelo JavaScript. A biblioteca cuida do zoológico de formatos; escrever
// regex de UA na mão é poço sem fundo.
//
// device.type vem undefined para desktop (a biblioteca só marca o que foge do
// padrão), daí o fallback explícito.
export function parseUserAgent(userAgent) {
    if (!userAgent) return { device_type: null, browser: null, os: null };

    const { browser, os, device } = UAParser(userAgent);

    // 'Mobile Chrome' e 'Chrome' são o mesmo navegador e precisam agrupar
    // juntos. Que é celular já está em device_type — uma informação, uma coluna.
    const name = browser.name ? browser.name.replace(/^Mobile /, '') : null;

    return {
        device_type: device.type || 'desktop',
        browser: name,
        os: os.name || null,
    };
}

// Transforma um envelope em linhas prontas para INSERT.
// Devolve [] quando o envelope não tem nada aproveitável — o chamador decide
// se loga ou ignora.
export function toRows({ payload, fromServer, site }) {
    const page = parseUrl(payload.url);
    if (!page) return [];

    const screen = parseSize(payload.screen);
    const viewport = parseSize(payload.viewport);
    const receivedAt = new Date(fromServer.receivedAt);

    const ua = parseUserAgent(fromServer.userAgent);

    const hash = visitorHash({
        ip: fromServer.ip,
        userAgent: fromServer.userAgent,
        siteId: site.id,
        at: receivedAt,
    });

    // O ts é relativo ao carregamento da página. O último evento do lote é o
    // mais próximo da descarga, então serve de âncora para os demais.
    const lastTs = Math.max(...payload.events.map((e) => Number(e.ts) || 0));

    return payload.events
        .filter((e) => typeof e.t === 'string' && e.t.length > 0)
        .map((e) => {
            const offset = Math.min(Math.max(lastTs - (Number(e.ts) || 0), 0), MAX_OFFSET_MS);
            const { t, ts, ...rest } = e;

            return {
                site_id: site.id,
                visitor_hash: hash,
                type: t,
                path: page.path,
                referrer_host: referrerHost(payload.referrer, site.domain),
                utm_source: page.utm_source,
                utm_medium: page.utm_medium,
                utm_campaign: page.utm_campaign,
                screen_w: screen.w,
                screen_h: screen.h,
                viewport_w: viewport.w,
                viewport_h: viewport.h,
                language: payload.language || null,
                device_type: ua.device_type,
                browser: ua.browser,
                os: ua.os,
                country: fromServer.geo?.country ?? null,
                region: fromServer.geo?.region ?? null,
                city: fromServer.geo?.city ?? null,
                props: Object.keys(rest).length > 0 ? rest : null,
                occurred_at: new Date(receivedAt.getTime() - offset),
            };
        });
}

// Normaliza o que a pessoa digitou no cadastro para a forma que o Origin do
// evento vai ter: só o host, minúsculo, sem protocolo, sem porta, sem caminho.
//
// Aceitar 'https://www.clinica.com.br/contato' e guardar isso inteiro seria o
// erro mais caro do cadastro: o ingest compara o host do Origin com esta
// coluna, e um domínio mal guardado recusa todo evento do site em silêncio.
//
// O 'www.' cai porque o originMatches já trata os dois como o mesmo site —
// guardá-lo aqui inverteria a regra e recusaria o domínio sem www.
export function normalizeDomain(input) {
    const bruto = String(input ?? '').trim().toLowerCase();
    if (!bruto) return null;

    let host;
    try {
        // A URL faz o trabalho sujo de separar esquema, porta e caminho. Sem
        // esquema ela não parseia, então põe um provisório.
        host = new URL(bruto.includes('://') ? bruto : `http://${bruto}`).hostname;
    } catch {
        return null;
    }

    // Ponto final é forma absoluta válida em DNS ('x.com.'), mas nenhum
    // navegador manda isso no Origin.
    host = host.replace(/\.$/, '').replace(/^www\./, '');

    if (host.length === 0 || host.length > 253) return null;
    if (!/^[a-z0-9.-]+$/.test(host)) return null;
    // Um rótulo só não é domínio — exceto localhost, que é o caso de
    // desenvolvimento e o primeiro que a gente mesmo usa.
    if (!host.includes('.') && host !== 'localhost') return null;

    return host;
}

// Robôs. A lista é de fragmentos que só aparecem em cliente automatizado —
// nenhum navegador de verdade carrega 'bot', 'crawler' ou 'headless' no
// user agent.
//
// Por que isso importa mais do que parece: robô vê uma página e vai embora.
// Sem o filtro ele infla pageviews, entra como desktop na tabela de
// dispositivo e, pior, puxa a taxa de rejeição para cima — a métrica que o
// cliente usa para julgar o próprio site ficaria medindo o Google, não gente.
//
// A maioria dos robôs nem executa JavaScript e nunca chega aqui. Este filtro é
// para os que executam: prévia de link em rede social, monitor de uptime,
// Lighthouse e navegador headless.
const ROBOS = /bot|crawl|spider|slurp|scrape|headless|lighthouse|pagespeed|preview|monitor|uptime|pingdom|curl|wget|python-requests|go-http|axios|node-fetch|facebookexternalhit|whatsapp|telegram|discord|semrush|ahrefs|yandex|baidu|duckduck/i;

export function isBot(userAgent) {
    // Sem user agent nenhum também não é gente: todo navegador manda o header,
    // e o sendBeacon não permite removê-lo.
    if (!userAgent) return true;
    return ROBOS.test(userAgent);
}
