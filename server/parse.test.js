import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseUrl, referrerHost, parseUserAgent, visitorHash, toRows, normalizeDomain, isBot } from './parse.js';

describe('parseUrl', () => {
    it('normaliza a barra final para agrupar a mesma página', () => {
        assert.equal(parseUrl('https://x.com/promo/').path, '/promo');
        assert.equal(parseUrl('https://x.com/promo').path, '/promo');
        assert.equal(parseUrl('https://x.com/').path, '/');
        assert.equal(parseUrl('https://x.com').path, '/');
    });

    it('extrai os UTM da query string', () => {
        const r = parseUrl('https://x.com/a?utm_source=meta&utm_medium=cpc&utm_campaign=set');
        assert.equal(r.utm_source, 'meta');
        assert.equal(r.utm_medium, 'cpc');
        assert.equal(r.utm_campaign, 'set');
    });

    it('devolve null nos UTM ausentes, e não string vazia', () => {
        assert.equal(parseUrl('https://x.com/a').utm_source, null);
    });

    it('devolve null para URL inválida em vez de explodir', () => {
        assert.equal(parseUrl('nao-e-url'), null);
        assert.equal(parseUrl(''), null);
    });
});

describe('referrerHost', () => {
    const own = 'clinicasorriso.com.br';

    it('remove o www para não partir a mesma origem em duas', () => {
        assert.equal(referrerHost('https://www.google.com/search?q=x', own), 'google.com');
        assert.equal(referrerHost('https://google.com/', own), 'google.com');
    });

    it('preserva outros subdomínios, que são sites distintos', () => {
        assert.equal(referrerHost('https://m.facebook.com/', own), 'm.facebook.com');
    });

    it('descarta navegação interna: não é origem de tráfego', () => {
        assert.equal(referrerHost('https://clinicasorriso.com.br/home', own), null);
        assert.equal(referrerHost('https://www.clinicasorriso.com.br/a', own), null);
    });

    it('lida com ausência e lixo', () => {
        assert.equal(referrerHost(null, own), null);
        assert.equal(referrerHost('', own), null);
        assert.equal(referrerHost('nao-e-url', own), null);
    });
});

describe('parseUserAgent', () => {
    const UA = {
        chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
        safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
        safariIpad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
        firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0',
    };

    it('classifica o tipo de dispositivo', () => {
        assert.equal(parseUserAgent(UA.chromeWin).device_type, 'desktop');
        assert.equal(parseUserAgent(UA.safariIphone).device_type, 'mobile');
        assert.equal(parseUserAgent(UA.chromeAndroid).device_type, 'mobile');
        assert.equal(parseUserAgent(UA.safariIpad).device_type, 'tablet');
    });

    it('remove o prefixo Mobile: é o mesmo navegador', () => {
        assert.equal(parseUserAgent(UA.chromeWin).browser, 'Chrome');
        assert.equal(parseUserAgent(UA.chromeAndroid).browser, 'Chrome');
        assert.equal(parseUserAgent(UA.safariIphone).browser, 'Safari');
    });

    it('identifica o sistema operacional', () => {
        assert.equal(parseUserAgent(UA.chromeWin).os, 'Windows');
        assert.equal(parseUserAgent(UA.chromeAndroid).os, 'Android');
        assert.equal(parseUserAgent(UA.firefoxLinux).os, 'Linux');
    });

    it('sem user agent, devolve tudo nulo em vez de inventar', () => {
        assert.deepEqual(parseUserAgent(null), { device_type: null, browser: null, os: null });
        assert.deepEqual(parseUserAgent(''), { device_type: null, browser: null, os: null });
    });
});

describe('visitorHash', () => {
    const base = {
        ip: '187.1.2.3',
        userAgent: 'UA',
        siteId: '1',
        at: new Date('2026-09-16T14:00:00Z'),
    };

    it('é estável para a mesma pessoa no mesmo dia', () => {
        assert.equal(visitorHash(base), visitorHash(base));
    });

    it('difere entre sites: impede cruzar audiência entre clientes', () => {
        assert.notEqual(visitorHash(base), visitorHash({ ...base, siteId: '2' }));
    });

    it('difere entre dias: ninguém é rastreável além de 24h', () => {
        const amanha = new Date('2026-09-17T14:00:00Z');
        assert.notEqual(visitorHash(base), visitorHash({ ...base, at: amanha }));
    });

    it('vira à meia-noite de São Paulo, não de UTC', () => {
        // 23h59 e 00h01 no horário de Brasília (UTC-3)
        const antes = new Date('2026-09-17T02:59:00Z');
        const depois = new Date('2026-09-17T03:01:00Z');
        assert.notEqual(visitorHash({ ...base, at: antes }), visitorHash({ ...base, at: depois }));

        // Duas horas da mesma madrugada continuam sendo o mesmo visitante
        const mesmaNoite = new Date('2026-09-17T03:30:00Z');
        assert.equal(visitorHash({ ...base, at: depois }), visitorHash({ ...base, at: mesmaNoite }));
    });
});

describe('toRows', () => {
    const site = { id: '1', domain: 'clinicasorriso.com.br' };
    const fromServer = {
        receivedAt: '2026-09-16T14:00:10.000Z',
        ip: '187.1.2.3',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
    };
    const payload = {
        v: 1,
        url: 'https://clinicasorriso.com.br/promo/?utm_source=meta',
        referrer: 'https://www.google.com/',
        screen: '1920x1080',
        viewport: '1280x720',
        language: 'pt-BR',
        events: [
            { t: 'pageview', ts: 100 },
            { t: 'vital', name: 'LCP', value: 812, ts: 900 },
            { t: 'click', x: 0.43, ts: 10100 },
        ],
    };

    it('gera uma linha por evento', () => {
        assert.equal(toRows({ payload, fromServer, site }).length, 3);
    });

    it('reconstrói o horário de cada evento a partir da chegada', () => {
        const [pageview, vital, click] = toRows({ payload, fromServer, site });
        // O último evento do lote ancora a chegada; os outros recuam pelo ts.
        assert.equal(click.occurred_at.toISOString(), '2026-09-16T14:00:10.000Z');
        assert.equal(vital.occurred_at.toISOString(), '2026-09-16T14:00:00.800Z');
        assert.equal(pageview.occurred_at.toISOString(), '2026-09-16T14:00:00.000Z');
    });

    it('repete o contexto da página em todas as linhas', () => {
        for (const row of toRows({ payload, fromServer, site })) {
            assert.equal(row.path, '/promo');
            assert.equal(row.referrer_host, 'google.com');
            assert.equal(row.utm_source, 'meta');
            assert.equal(row.viewport_w, 1280);
            assert.equal(row.browser, 'Chrome');
        }
    });

    it('move o que sobra do evento para props, e usa null quando não sobra nada', () => {
        const [pageview, vital] = toRows({ payload, fromServer, site });
        assert.equal(pageview.props, null);
        assert.deepEqual(vital.props, { name: 'LCP', value: 812 });
    });

    it('limita ts forjado a 24h para não gravar evento no futuro remoto', () => {
        const forjado = {
            ...payload,
            events: [{ t: 'a', ts: 0 }, { t: 'b', ts: -99999999999 }],
        };
        const [, b] = toRows({ payload: forjado, fromServer, site });
        assert.equal(b.occurred_at.toISOString(), '2026-09-15T14:00:10.000Z');
    });

    it('descarta envelope com URL inválida', () => {
        assert.equal(toRows({ payload: { ...payload, url: 'lixo' }, fromServer, site }).length, 0);
    });

    it('ignora evento sem tipo', () => {
        const sujo = { ...payload, events: [{ ts: 1 }, { t: '', ts: 2 }, { t: 'ok', ts: 3 }] };
        const rows = toRows({ payload: sujo, fromServer, site });
        assert.equal(rows.length, 1);
        assert.equal(rows[0].type, 'ok');
    });
});

describe('normalizeDomain', () => {
    it('aceita o host puro', () => {
        assert.equal(normalizeDomain('clinica.com.br'), 'clinica.com.br');
    });

    it('descarta esquema, caminho e porta', () => {
        assert.equal(normalizeDomain('https://clinica.com.br/contato?x=1'), 'clinica.com.br');
        assert.equal(normalizeDomain('http://clinica.com.br:8080'), 'clinica.com.br');
    });

    it('descarta o www, que o originMatches já trata como o mesmo site', () => {
        assert.equal(normalizeDomain('www.clinica.com.br'), 'clinica.com.br');
        assert.equal(normalizeDomain('https://WWW.Clinica.COM.BR/'), 'clinica.com.br');
    });

    it('aceita localhost, que é o caso de desenvolvimento', () => {
        assert.equal(normalizeDomain('localhost:5173'), 'localhost');
    });

    it('converte acento em punycode, que é como o Origin chega', () => {
        assert.equal(normalizeDomain('cliníca.com.br'), 'xn--clinca-6va.com.br');
    });

    it('recusa o que não é domínio', () => {
        assert.equal(normalizeDomain(''), null);
        assert.equal(normalizeDomain('   '), null);
        assert.equal(normalizeDomain(undefined), null);
        assert.equal(normalizeDomain('clinica'), null);
        assert.equal(normalizeDomain('a b.com'), null);
    });
});

describe('isBot', () => {
    const GENTE = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
    ];

    const ROBO = [
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0.0.0 Safari/537.36',
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'WhatsApp/2.23.20.0 A',
        'curl/8.4.0',
        'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    ];

    it('deixa passar navegador de gente', () => {
        for (const ua of GENTE) assert.equal(isBot(ua), false, ua);
    });

    it('barra robô, prévia de link e ferramenta de linha de comando', () => {
        for (const ua of ROBO) assert.equal(isBot(ua), true, ua);
    });

    it('trata a ausência de user agent como robô', () => {
        assert.equal(isBot(undefined), true);
        assert.equal(isBot(''), true);
    });
});
