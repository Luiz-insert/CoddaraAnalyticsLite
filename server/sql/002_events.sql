-- Coddara Analytics Lite — eventos brutos.
--
-- Uma linha por evento. O envelope do beacon chega com o contexto da página
-- içado e uma lista de eventos; o servidor repete o contexto em cada linha.
--
-- Esta é a tabela que cresce. O dashboard vai ler quase tudo de um agregado
-- diário (003), e daqui só sai heatmap e investigação pontual.

CREATE TABLE IF NOT EXISTS events (
    id           bigserial   PRIMARY KEY,

    -- RESTRICT por omissão: apagar um site com histórico tem que doer.
    -- Cliente que sai vira active = false, não DELETE.
    site_id      bigint      NOT NULL REFERENCES sites(id),

    -- Identidade sem cookie: sha256(segredo + dia + ip + user agent + site_id).
    -- Troca sozinha à meia-noite, então ninguém é rastreável entre dias — por
    -- construção, não por política. O site_id no hash impede cruzar a mesma
    -- pessoa entre dois clientes seus.
    -- O IP entra aqui e NÃO é gravado em lugar nenhum.
    visitor_hash text        NOT NULL,

    -- 'pageview', 'vital', 'click'... É o 't' de cada item do envelope.
    type         text        NOT NULL,

    -- Só o caminho. A URL inteira agrupa mal e repete o domínio, que já
    -- está em sites.domain.
    path         text        NOT NULL,

    -- Só o host de origem ('google.com'), nunca a URL completa: além de
    -- agrupar melhor, referrer completo pode carregar dado sensível na
    -- query string de quem linkou.
    referrer_host text,

    -- A pergunta mais cara do cliente é "qual anúncio trouxe gente".
    -- Em coluna vira GROUP BY direto; dentro de jsonb seria consulta torta.
    utm_source   text,
    utm_medium   text,
    utm_campaign text,

    -- Números e não '1920x1080': permite WHERE viewport_w < 768 sem parsing
    -- na consulta. O beacon manda string, o servidor separa na entrada.
    screen_w     int,
    screen_h     int,
    viewport_w   int,
    viewport_h   int,

    language     text,

    -- O que varia conforme o tipo: {name, value} para vital,
    -- {x, y} para clique. Aqui o jsonb paga: esquema livre onde ele é livre
    -- de verdade, colunas onde a consulta precisa de estrutura.
    props        jsonb,

    -- Quando aconteceu no navegador, reconstruído a partir da chegada menos o
    -- offset 'ts' do evento. Relógio de visitante não é confiável.
    -- É esta coluna que todo relatório usa.
    occurred_at  timestamptz NOT NULL,

    -- Quando a linha entrou. Serve para medir atraso de ingest e depurar;
    -- não entra em relatório.
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Praticamente toda consulta é "deste site, neste intervalo". DESC porque o
-- interesse é sempre no mais recente.
CREATE INDEX IF NOT EXISTS events_site_time_idx ON events (site_id, occurred_at DESC);

-- Sessões vão precisar de (site_id, visitor_hash, occurred_at), mas índice
-- em tabela de escrita quente custa caro. Entra quando a consulta existir.
