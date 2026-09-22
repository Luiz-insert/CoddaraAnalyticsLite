-- Contas e acesso aos sites.
--
-- Diferente do token do beacon, que é público e só IDENTIFICA, aqui é o lado
-- que AUTORIZA: quem entra no dashboard e quais sites enxerga.

CREATE TABLE IF NOT EXISTS users (
    id            bigserial   PRIMARY KEY,

    email         text        NOT NULL,

    -- O hash, nunca a senha. bcrypt, com o custo decidido na aplicação.
    password_hash text        NOT NULL,

    -- Operador da Coddara. Enxerga todos os sites sem precisar de uma linha em
    -- user_sites para cada cliente — que seria dezenas de linhas por engano só
    -- esperando acontecer.
    is_staff      boolean     NOT NULL DEFAULT false,

    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Índice em lower(email) em vez de UNIQUE na coluna: ninguém deveria conseguir
-- criar Joao@x.com tendo joao@x.com. A aplicação normaliza na entrada; isto
-- aqui é a rede de segurança para quando ela esquecer.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));


-- Tabela de ligação em vez de sites.owner_id: acesso não é exclusivo. O dono
-- vai querer dar acesso ao sócio ou ao gestor de tráfego, e com a ligação isso
-- já funciona sem migração nenhuma.
CREATE TABLE IF NOT EXISTS user_sites (
    user_id    bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id    bigint      NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

    -- 'owner' pode convidar e mexer nas configurações; 'member' só lê.
    -- CHECK porque texto livre aqui vira 'Owner', 'OWNER' e 'dono' em três meses.
    role       text        NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'member')),

    created_at timestamptz NOT NULL DEFAULT now(),

    -- A chave composta já impede acesso duplicado e serve à consulta que mais
    -- importa: "quais sites este usuário vê".
    PRIMARY KEY (user_id, site_id)
);

-- CASCADE nas duas pontas de propósito: apagar um usuário deve remover o acesso
-- dele, não travar a exclusão. O histórico de eventos não corre risco — ele
-- aponta para sites, e sites continuam protegidos por RESTRICT.
--
-- Sem índice em site_id sozinho. A pergunta "quem acessa este site" só aparece
-- na tela de convidados, que é rara; entra quando a tela existir.
--
-- Sem tabela de sessão: o login devolve JWT, que é stateless e não precisa de
-- ida ao banco a cada requisição. O preço é não conseguir revogar um token
-- antes de expirar — aceitável com validade curta, e resolvido com uma lista
-- de revogação se um dia fizer falta.
