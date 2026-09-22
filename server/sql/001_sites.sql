-- Coddara Analytics Lite — tabela de sites (os inquilinos).
--
-- Um "site" é um cliente rastreado. O token é o que vai na tag <script> do site
-- dele e, por isso, é PÚBLICO: qualquer visitante lê no código-fonte da página.
-- Ele identifica de quem é o dado; não autoriza nada.
-- Quem autoriza é o login do dashboard, que virá em outra tabela.

CREATE TABLE IF NOT EXISTS sites (
    id         bigserial   PRIMARY KEY,

    -- Nome legível, só para o dashboard. Ex: 'Clínica Sorriso'
    name       text        NOT NULL,

    -- Host registrado, sem protocolo e sem barra. Ex: 'clinicasorriso.com.br'
    -- É contra ele que o header Origin do evento será conferido.
    -- Sem UNIQUE de propósito: o mesmo domínio pode precisar de um segundo
    -- token um dia (staging, migração de site) sem virar um problema.
    domain     text        NOT NULL,

    -- O identificador público. UNIQUE porque é a chave de busca do ingest,
    -- e o índice que ele cria é o mais usado do sistema inteiro.
    token      text        NOT NULL UNIQUE,

    -- Desligar em vez de apagar: cliente que sai para de enviar dado, mas o
    -- histórico dele continua existindo para consulta e para faturamento.
    active     boolean     NOT NULL DEFAULT true,

    -- timestamptz e não timestamp: sem fuso gravado, o horário vira mentira
    -- assim que o servidor mudar de região ou o horário de verão entrar.
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Nenhum índice além do que o UNIQUE já criou. O dominio nunca é buscado
-- sozinho: o ingest acha o site pelo token e só então compara o domínio.
-- Índice que ninguém usa é custo de escrita de graça.
