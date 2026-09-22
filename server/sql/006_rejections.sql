-- Rejeições por origem divergente.
--
-- O erro mais comum de instalação é o domínio registrado sem 'www' e o site
-- servindo com — ou o contrário. Hoje isso morre num console.warn do servidor:
-- quem instalou vê silêncio e não tem como descobrir sozinho.
--
-- Guardamos AGREGADO, não uma linha por rejeição: o interessante é "de qual
-- origem, quantas vezes, quando foi a última". Uma linha por evento cresceria
-- sem limite para resolver a mesma pergunta.

CREATE TABLE IF NOT EXISTS site_rejections (
    site_id bigint      NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

    -- A origem que o navegador enviou e que não bateu com sites.domain.
    origin  text        NOT NULL,

    events  int         NOT NULL DEFAULT 0,
    last_at timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (site_id, origin)
);

-- Só registramos quando o TOKEN é válido: com token desconhecido não há site a
-- quem atribuir a rejeição. Isso também limita o crescimento — é preciso ter um
-- token real para criar linha aqui.
--
-- O teto é o número de origens distintas por site, normalmente duas ou três.
-- Alguém de posse do token (que é público) conseguiria inflar isso forjando
-- origens; se um dia incomodar, a saída é limpar linhas antigas por período.
