// Semeia eventos falsos para enxergar o painel com volume.
//
//   node seed-demo.js           semeia 14 dias no site 1
//   node seed-demo.js 3 30      semeia 30 dias no site 3
//
// Só para desenvolvimento. As linhas ficam marcadas com um props.demo = true,
// então dá para apagar só o que veio daqui:
//
//   DELETE FROM events WHERE props->>'demo' = 'true';

import { randomBytes } from 'node:crypto';
import { query } from './db.js';
import { insertEvents } from './db.js';

const siteId = process.argv[2] ?? '1';
const dias = Number(process.argv[3] ?? 14);

const PAGINAS = ['/', '/promocao-clareamento', '/implantes', '/sobre', '/contato'];
const ORIGENS = [null, null, 'google.com', 'instagram.com', 'guiaodonto.com.br'];
const UAS = [
    ['mobile', 'Chrome', 'Android'],
    ['mobile', 'Safari', 'iOS'],
    ['desktop', 'Chrome', 'Windows'],
    ['desktop', 'Safari', 'macOS'],
];

const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];

const linhas = [];

for (let d = dias - 1; d >= 0; d -= 1) {
    // Fim de semana com menos movimento, e uma tendência leve de alta: o
    // gráfico só mostra que está certo quando tem forma, não ruído uniforme.
    const dia = new Date();
    dia.setDate(dia.getDate() - d);
    const fds = dia.getDay() === 0 || dia.getDay() === 6;

    const base = fds ? 18 : 45;
    const tendencia = Math.round(((dias - d) / dias) * 25);
    const visitantes = base + tendencia + Math.floor(Math.random() * 15);

    for (let v = 0; v < visitantes; v += 1) {
        const [device, browser, os] = sorteia(UAS);
        // Um hash por VISITANTE, não por pageview: quem entra costuma ver mais
        // de uma página, e sem isso visitantes e pageviews dariam o mesmo
        // número — o que deixaria os dois cards sem sentido.
        const visitor = randomBytes(16).toString('hex');

        // Horário comercial, com dispersão.
        const entrada = new Date(dia);
        entrada.setHours(9 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60), 0, 0);

        // Uma visita são 1 a 4 páginas, poucos minutos entre elas — dentro da
        // janela de 30 min, então continua sendo uma sessão só.
        const paginas = 1 + Math.floor(Math.random() * 4);

        for (let pv = 0; pv < paginas; pv += 1) {
        const quando = new Date(entrada.getTime() + pv * (60 + Math.floor(Math.random() * 300)) * 1000);

        linhas.push({
            site_id: siteId,
            visitor_hash: visitor,
            type: 'pageview',
            path: sorteia(PAGINAS),
            referrer_host: sorteia(ORIGENS),
            utm_source: Math.random() < 0.1 ? 'meta' : null,
            utm_medium: null,
            utm_campaign: Math.random() < 0.1 ? 'setembro' : null,
            screen_w: device === 'mobile' ? 390 : 1920,
            screen_h: device === 'mobile' ? 844 : 1080,
            viewport_w: device === 'mobile' ? 390 : 1512,
            viewport_h: device === 'mobile' ? 720 : 860,
            language: 'pt-BR',
            device_type: device,
            browser,
            os,
            props: { demo: true },
            occurred_at: quando,
        });
        }
    }
}

// Em lotes: um INSERT com 900 linhas estoura o limite de parâmetros do Postgres.
const LOTE = 200;
for (let i = 0; i < linhas.length; i += LOTE) {
    await insertEvents(linhas.slice(i, i + LOTE));
}

const { rows } = await query(
    "SELECT count(*)::int AS total FROM events WHERE site_id = $1 AND props->>'demo' = 'true'",
    [siteId],
);

console.log(`${linhas.length} eventos semeados em ${dias} dias no site ${siteId}.`);
console.log(`Total de demo neste site: ${rows[0].total}`);
console.log("Para apagar: DELETE FROM events WHERE props->>'demo' = 'true';");

process.exit(0);
