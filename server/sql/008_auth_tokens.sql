-- Links de uso único enviados por e-mail: criar conta e redefinir senha.
--
-- Um mecanismo só para os dois, porque são a mesma coisa: provar que a pessoa
-- lê aquela caixa de entrada e, de posse dessa prova, deixá-la definir a senha.

CREATE TABLE IF NOT EXISTS auth_tokens (
    id          bigserial   PRIMARY KEY,

    -- 'signup' — o e-mail ainda não tem conta; usar o link cria a conta.
    -- 'reset'  — a conta existe; usar o link troca a senha.
    purpose     text        NOT NULL CHECK (purpose IN ('signup', 'reset')),

    -- O e-mail, e não o user_id: no cadastro a conta ainda não existe. Ela só
    -- nasce quando o link é usado, e por isso nunca há conta sem e-mail provado.
    email       text        NOT NULL,

    -- O hash, nunca o token. Quem lê o banco — backup vazado, consulta
    -- esquecida num log — não consegue usar link nenhum.
    token_hash  text        NOT NULL UNIQUE,

    expires_at  timestamptz NOT NULL,

    -- Preenchido ao usar OU ao pedir outro link: só o mais recente vale.
    used_at     timestamptz,

    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Serve a invalidação dos links anteriores do mesmo e-mail a cada pedido novo.
CREATE INDEX IF NOT EXISTS auth_tokens_email_idx ON auth_tokens (lower(email), purpose) WHERE used_at IS NULL;


-- Versão da sessão. Entra no JWT e é conferida a cada requisição: trocar a
-- senha, ou pedir "sair de todos os dispositivos", incrementa o número e todo
-- cookie emitido antes deixa de valer na hora.
--
-- Isto substitui a decisão anterior de JWT puramente stateless. Sem revogar,
-- redefinir a senha não expulsava quem tivesse roubado a sessão — e é
-- exatamente para isso que se redefine uma senha.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
