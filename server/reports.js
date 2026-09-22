import { query } from './db.js';

// Períodos aceitos. Lista fechada porque o valor entra na consulta como
// intervalo — nunca interpolar o que veio da URL direto no SQL.
// Mesmo fuso que o parse.js usa para o visitor_hash. Se os dois divergirem,
// o dia do gráfico e o dia da identidade passam a ser dias diferentes.
const TZ = process.env.SITE_TIMEZONE || 'America/Sao_Paulo';

const PERIODS = {
    // 'hoje' é um dia: a janela vai da meia-noite local até agora, e a
    // comparação é ontem até esta mesma hora.
    hoje: { dias: 1, granularidade: 'hora' },
    '7d': { dias: 7, granularidade: 'dia' },
    '30d': { dias: 30, granularidade: 'dia' },
    '90d': { dias: 90, granularidade: 'dia' },
};

export const isPeriod = (value) => Object.hasOwn(PERIODS, value);

// Cinquenta e não oito: a tela mostra oito, mas o filtro e a ordenação
// trabalham sobre o que chegou. Com oito linhas, procurar '/contato' num site
// de trinta páginas não acharia nada e pareceria defeito.
//
// Cinquenta cabe folgado no JSON e cobre praticamente todo site de cliente.
// Passar disso pede busca no servidor, que é outra conversa.
const TETO = 50;

// Uma linha por dimensão, em vez de uma consulta por card. O banco varre a
// tabela uma vez e devolve tudo agrupado.
const breakdown = (column, label) => `
    WITH j AS (${JANELA})
    SELECT coalesce(e.${column}, '${label}') AS name, count(*)::int AS value
      FROM j
      JOIN events e ON e.site_id = $1 AND e.occurred_at >= j.inicio AND e.occurred_at <= j.fim
     -- Só pageview: vital e nav são telemetria técnica, não visita. Contá-los
     -- inflaria toda tabela e os números não fechariam com os cards.
     WHERE e.type = 'pageview'
     GROUP BY 1
     ORDER BY value DESC
     LIMIT ${TETO}`;

// Janela do período, usada por tudo. Ancorada na meia-noite local — a mesma
// âncora do gráfico, para a soma da série bater exatamente com o card.
//
// A janela anterior é a atual deslocada N dias para trás: mesma duração e
// mesmo dia da semana. Comparar contra N dias completos seria injusto, porque
// o período atual só tem o dia de hoje até agora.
const JANELA = `
    SELECT (date_trunc('day', now() AT TIME ZONE $2) - (($3 - 1) || ' days')::interval) AT TIME ZONE $2 AS inicio,
           now()                      AS fim,
           ($3 || ' days')::interval  AS passo`;

export async function overview({ siteId, period }) {
    const { dias, granularidade } = PERIODS[period];
    const p = [siteId, TZ, dias];

    const [totals, pages, referrers, devices, browsers, sistemas, paises, locais, utm, vitais, fases, series] = await Promise.all([
        totaisComparados({ siteId, dias }),
        query(breakdown('path', '(vazio)'), p),
        // Referrer nulo é acesso direto — digitou o endereço, veio de favorito
        // ou de app. É uma origem legítima, não um dado faltando.
        query(breakdown('referrer_host', 'Direto'), p),
        query(breakdown('device_type', '(desconhecido)'), p),
        query(breakdown('browser', '(desconhecido)'), p),
        query(breakdown('os', '(desconhecido)'), p),
        // Código ISO, não nome: 'BR' ocupa duas letras no banco e vira 'Brasil'
        // na tela, no idioma de quem está olhando, sem tabela de tradução nossa.
        query(breakdown('country', '(desconhecido)'), p),
        // Cidade com estado junto: existe Boa Vista em RR e em PB, e a lista
        // ficaria ambígua com o nome sozinho.
        query(
            `WITH j AS (${JANELA})
             -- Sem o país no coalesce: ele agora tem tabela própria, e deixá-lo
             -- aqui fazia 'US' aparecer como se fosse uma cidade.
             SELECT coalesce(e.city || ' · ' || e.region, e.city, e.region, '(desconhecido)') AS name,
                    count(*)::int AS value
               FROM j
               JOIN events e ON e.site_id = $1 AND e.occurred_at >= j.inicio AND e.occurred_at <= j.fim
              WHERE e.type = 'pageview'
              GROUP BY 1 ORDER BY value DESC LIMIT ${TETO}`,
            p,
        ),
        campanhas(p),
        // p75 e não média: é o percentil que o Google usa para Core Web
        // Vitals. Média esconde a cauda — e é justamente a cauda que faz o
        // cliente reclamar que "às vezes o site trava".
        query(
            `WITH j AS (${JANELA})
             SELECT e.props->>'name' AS name,
                    percentile_cont(0.75) WITHIN GROUP (ORDER BY (e.props->>'value')::numeric) AS p75,
                    count(*)::int AS samples,
                    -- As faixas vêm do rating que a própria biblioteca do Google
                    -- calcula por medição. Classificar aqui por limite escrito à
                    -- mão criaria uma segunda régua para divergir da primeira.
                    count(*) FILTER (WHERE e.props->>'rating' = 'good')::int              AS good,
                    count(*) FILTER (WHERE e.props->>'rating' = 'needs-improvement')::int AS meh,
                    count(*) FILTER (WHERE e.props->>'rating' = 'poor')::int              AS poor
               FROM j
               JOIN events e ON e.site_id = $1 AND e.occurred_at >= j.inicio AND e.occurred_at <= j.fim
              WHERE e.type = 'vital' AND e.props ? 'value'
              GROUP BY 1`,
            p,
        ),
        cascata(p),
        serie({ p, granularidade }),
    ]);

    const sessoes = await sessoesComparadas({ siteId, dias });

    return {
        period,
        totals: { ...totals.atual, sessions: sessoes.atual.sessoes, bounce: sessoes.atual.bounce },
        previous: { ...totals.anterior, sessions: sessoes.anterior.sessoes, bounce: sessoes.anterior.bounce },
        pages: pages.rows,
        referrers: referrers.rows,
        devices: devices.rows,
        browsers: browsers.rows,
        systems: sistemas.rows,
        countries: paises.rows,
        locations: locais.rows,
        utm: utm.rows,
        // p75 vem como string do Postgres (numeric não cabe em float sem
        // perda), então converte aqui em vez de espalhar Number() na tela.
        vitals: vitais.rows.map((v) => ({ ...v, p75: Number(v.p75) })),
        cascade: fases,
        granularity: granularidade,
        series,
    };
}

// Os três parâmetros numa tabela só, na forma em que aparecem na URL:
// 'utm_source=meta'. Separá-los em três tabelas obrigava a comparar três
// rankings para responder uma pergunta só — de onde veio a campanha.
//
// Sem tradução de propósito: utm_source, utm_medium e utm_campaign são os nomes
// que estão na URL que a pessoa montou e no painel do anúncio. Traduzir criaria
// um vocabulário que só existe aqui.
//
// Linha sem UTM fica de fora em vez de virar '(vazio)': quase todo acesso é sem
// campanha, e um '(vazio)' com 95% do volume no topo esconderia justamente as
// campanhas que a tabela existe para mostrar.
const UTM = ['utm_source', 'utm_medium', 'utm_campaign'];

function campanhas(p) {
    const partes = UTM.map(
        (coluna) => `SELECT '${coluna}=' || e.${coluna} AS name, count(*)::int AS value
                       FROM j
                       JOIN events e ON e.site_id = $1 AND e.occurred_at >= j.inicio AND e.occurred_at <= j.fim
                      WHERE e.type = 'pageview' AND e.${coluna} IS NOT NULL
                      GROUP BY 1`,
    ).join('\n            UNION ALL\n            ');

    return query(
        `WITH j AS (${JANELA})
         ${partes}
         ORDER BY value DESC
         LIMIT ${TETO}`,
        p,
    );
}

// Três armadilhas resolvidas de uma vez, todas verificadas contra o banco:
//
// 1. O generate_series à esquerda do LEFT JOIN garante um ponto por intervalo
//    mesmo sem visita. Sem ele, período parado some do resultado e a linha
//    mente — uma semana com dois dias vazios viraria uma subida contínua.
//
// 2. AT TIME ZONE em vez de date_trunc direto: o fuso da sessão do Postgres é
//    UTC, então uma visita às 22h de São Paulo cairia no dia seguinte.
//
// 3. Teto em now(): sem ele o último balde conta o tempo que ainda não passou,
//    e a soma da série diverge do card.
//
// A granularidade muda com o período: 'hoje' pede hora, o resto pede dia.
// Vinte e quatro pontos num dia mostram o pico do almoço; um ponto só não
// mostraria nada.
async function serie({ p, granularidade }) {
    const unidade = granularidade === 'hora' ? 'hour' : 'day';

    const { rows } = await query(
        `WITH j AS (${JANELA}),
         grade AS (
             SELECT generate_series(
                 date_trunc('${unidade}', j.inicio AT TIME ZONE $2),
                 date_trunc('${unidade}', j.fim AT TIME ZONE $2),
                 interval '1 ${unidade}'
             ) AS balde
               FROM j
         )
         SELECT to_char(g.balde, '${unidade === 'hour' ? 'YYYY-MM-DD"T"HH24:MI' : 'YYYY-MM-DD'}') AS day,
                count(e.id)::int AS pageviews
           FROM grade g
           CROSS JOIN j
           LEFT JOIN events e
             ON e.site_id = $1
            AND e.type = 'pageview'
            AND date_trunc('${unidade}', e.occurred_at AT TIME ZONE $2) = g.balde
            AND e.occurred_at <= j.fim
          GROUP BY g.balde
          ORDER BY g.balde`,
        p,
    );
    return rows;
}

// Os dois períodos numa varredura só. FILTER separa as faixas sem precisar de
// duas idas ao banco, e as linhas que caem no vão entre elas não entram em
// nenhuma das contas.
async function totaisComparados({ siteId, dias }) {
    const { rows } = await query(
        `WITH j AS (${JANELA})
         SELECT count(*) FILTER (WHERE e.type = 'pageview' AND e.occurred_at >= j.inicio)::int AS pageviews,
                count(DISTINCT e.visitor_hash) FILTER (WHERE e.occurred_at >= j.inicio)::int   AS visitors,
                count(*) FILTER (WHERE e.type = 'pageview' AND e.occurred_at < j.fim - j.passo)::int AS pageviews_ant,
                count(DISTINCT e.visitor_hash) FILTER (WHERE e.occurred_at < j.fim - j.passo)::int   AS visitors_ant
           FROM j
           LEFT JOIN events e
             ON e.site_id = $1
            AND e.occurred_at >= j.inicio - j.passo
            AND e.occurred_at <= j.fim`,
        [siteId, TZ, dias],
    );
    const r = rows[0];
    return {
        atual: { pageviews: r.pageviews, visitors: r.visitors },
        anterior: { pageviews: r.pageviews_ant, visitors: r.visitors_ant },
    };
}

// Sessão é derivada, não gravada: pageviews do mesmo visitante com menos de 30
// minutos de intervalo são a mesma visita. Não guardamos session_id de
// propósito — assim dá para mudar a janela depois e recalcular o histórico.
//
// Só 'pageview': vital e nav são telemetria da mesma visita, e contá-los aqui
// faria um vital atrasado abrir uma sessão fantasma meia hora depois de a
// pessoa ter fechado a aba.
//
// O PARTITION inclui a faixa: sem isso, uma visita que cruzasse a fronteira
// entre os dois períodos seria contada como uma só, e o período anterior
// perderia uma sessão para o atual.
//
// Rejeição sai daqui de graça: é a sessão que viu uma página só. Precisa da
// soma corrida das aberturas para dar um número a cada sessão — sem isso dá
// para contar quantas começaram, mas não quantas páginas cada uma teve.
async function sessoesComparadas({ siteId, dias }) {
    const { rows } = await query(
        `WITH j AS (${JANELA}),
         marcados AS (
             SELECT e.visitor_hash,
                    (e.occurred_at >= j.inicio) AS atual,
                    e.occurred_at,
                    (lag(e.occurred_at) OVER w IS NULL
                     OR e.occurred_at - lag(e.occurred_at) OVER w > interval '30 minutes') AS abre
               FROM j
               JOIN events e
                 ON e.site_id = $1
                AND e.type = 'pageview'
                AND (e.occurred_at >= j.inicio
                     OR (e.occurred_at >= j.inicio - j.passo AND e.occurred_at < j.fim - j.passo))
                AND e.occurred_at <= j.fim
             WINDOW w AS (PARTITION BY e.visitor_hash, (e.occurred_at >= j.inicio) ORDER BY e.occurred_at)
         ),
         numeradas AS (
             SELECT visitor_hash, atual,
                    sum(CASE WHEN abre THEN 1 ELSE 0 END)
                        OVER (PARTITION BY visitor_hash, atual ORDER BY occurred_at) AS sessao
               FROM marcados
         ),
         por_sessao AS (
             SELECT atual, visitor_hash, sessao, count(*)::int AS paginas
               FROM numeradas
              GROUP BY 1, 2, 3
         )
         SELECT atual,
                count(*)::int                              AS sessoes,
                count(*) FILTER (WHERE paginas = 1)::int   AS rejeicoes
           FROM por_sessao
          GROUP BY atual`,
        [siteId, TZ, dias],
    );

    const faixa = (qual) => rows.find((r) => r.atual === qual) ?? { sessoes: 0, rejeicoes: 0 };
    const a = faixa(true);
    const b = faixa(false);

    // A taxa vem pronta do servidor: dividir na tela daria chance de a conta
    // ser feita com um denominador diferente em cada lugar que a mostrasse.
    const taxa = (s) => (s.sessoes === 0 ? null : Math.round((s.rejeicoes / s.sessoes) * 100));

    return {
        atual: { sessoes: a.sessoes, bounce: taxa(a) },
        anterior: { sessoes: b.sessoes, bounce: taxa(b) },
    };
}

const FASES = ['redirect', 'dns', 'tcp', 'tls', 'server', 'download', 'dom', 'load'];

// p75 de cada fase, para casar com o critério dos Core Web Vitals.
//
// Só 'navigate': recarga e volta no histórico pegam cache quente e puxariam
// todos os números para baixo, escondendo exatamente o problema que a cascata
// existe para mostrar — a primeira visita de alguém que nunca entrou no site.
async function cascata(p) {
    const colunas = FASES.map(
        (f) => `percentile_cont(0.75) WITHIN GROUP (
                    ORDER BY (e.props->>'${f}')::numeric
                ) FILTER (WHERE e.props->>'${f}' IS NOT NULL) AS ${f}`,
    ).join(',\n               ');

    const { rows } = await query(
        `WITH j AS (${JANELA})
         SELECT ${colunas},
                count(*)::int AS samples
           FROM j
           JOIN events e ON e.site_id = $1 AND e.occurred_at >= j.inicio AND e.occurred_at <= j.fim
          WHERE e.type = 'nav' AND e.props->>'kind' = 'navigate'`,
        p,
    );

    const r = rows[0];
    if (!r || r.samples === 0) return { samples: 0, fases: [] };

    return {
        samples: r.samples,
        // numeric vem como string do Postgres; converte aqui e descarta fase
        // que não foi medida, em vez de mandar nulo para a tela decidir.
        fases: FASES
            .filter((f) => r[f] !== null)
            .map((f) => ({ fase: f, ms: Math.round(Number(r[f])) })),
    };
}
