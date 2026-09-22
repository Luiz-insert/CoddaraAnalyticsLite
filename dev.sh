#!/usr/bin/env bash
#
# Sobe o ambiente de desenvolvimento inteiro.
# Pode rodar quantas vezes quiser: nada aqui duplica nem apaga dado.
#
#   ./dev.sh          sobe tudo
#   Ctrl+C            derruba o servidor e o site (o Postgres continua de pé)

set -euo pipefail
cd "$(dirname "$0")"

# PGOPTIONS silencia os NOTICE de "já existe" das migrações idempotentes.
# Erro de verdade continua aparecendo — o que se perde é só o ruído esperado,
# que de tanto repetir ensina a ignorar a saída do script.
db() {
    docker compose exec -T -e PGOPTIONS='--client-min-messages=warning' \
        db psql -U coddara -d coddara_analytics "$@"
}

# O grupo do Unix é lido quando o processo nasce, nunca relido. Um terminal
# aberto antes do `usermod -aG docker` continua sem acesso ao socket para
# sempre — e o erro cru do Docker não diz nada disso.
if ! docker info >/dev/null 2>&1; then
    echo "ERRO: sem acesso ao Docker."
    echo
    if getent group docker | grep -q "\b$USER\b"; then
        echo "  Você ESTÁ no grupo docker, mas este processo não sabe disso:"
        echo "  grupo é copiado do pai no nascimento e nunca relido."
        echo
        echo "  Logout NÃO basta: o 'systemd --user' sobrevive à sessão e é ele"
        echo "  quem lança os apps gráficos, com a lista antiga."
        echo
        echo "  Saída: reiniciar a máquina."
    else
        echo "  Você não está no grupo docker. Rode:"
        echo
        echo "    sudo systemctl enable --now docker"
        echo "    sudo usermod -aG docker \$USER"
        echo
        echo "  E depois deslogue e logue."
    fi
    echo
    exit 1
fi

echo "1/4  Postgres"
docker compose up -d --wait

echo "2/4  Migrações"
for f in server/sql/*.sql; do
    echo "     $(basename "$f")"
    db -q < "$f"
done

echo "3/4  Site de teste"
# Só insere se ainda não houver site para localhost — por isso dá para repetir.
db -q <<'SQL'
INSERT INTO sites (name, domain, token)
SELECT 'Site de teste (local)', 'localhost', 'dev_local_token'
WHERE NOT EXISTS (SELECT 1 FROM sites WHERE domain = 'localhost');
SQL

TOKEN=$(db -tAc "SELECT token FROM sites WHERE domain = 'localhost' LIMIT 1")

# O beacon lê o token da tag; manter os dois em sincronia evita o erro mais
# chato de depurar aqui, que é o evento sumir com 'token desconhecido'.
sed -i "s/data-token=\"[^\"]*\"/data-token=\"$TOKEN\"/" exemplo/index.html

# Conta de desenvolvimento. O hash é de 'senhaforte123', gerado com bcrypt
# custo 12 — fixo aqui de propósito, para o seed não depender do Node.
DEV_EMAIL="luiz@clinica.com.br"
DEV_HASH='$2b$12$03OFtEZ5VqwnIMqmAhG2m.uMnLGEcpNTd7m9ExfElW3V8ytXgIJg.'

db -q <<SQL
INSERT INTO users (email, password_hash)
SELECT '$DEV_EMAIL', '$DEV_HASH'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = '$DEV_EMAIL');

INSERT INTO user_sites (user_id, site_id)
SELECT u.id, s.id FROM users u, sites s
WHERE lower(u.email) = '$DEV_EMAIL' AND s.domain = 'localhost'
ON CONFLICT DO NOTHING;
SQL

echo "4/4  Servidor, dashboard e site de exemplo"
echo
echo "     ingest     http://localhost:3002"
echo "     dashboard  http://localhost:5173   <- o painel"
echo "     site teste http://localhost:8080   <- simula o site do cliente"
echo "     token      $TOKEN"
echo "     login      $DEV_EMAIL / senhaforte123"
echo
echo "     Ctrl+C para derrubar."
echo

( cd server && npm run dev ) &
SERVER_PID=$!

( cd dashboard && npm run dev ) &
DASH_PID=$!

( cd exemplo && python3 -m http.server 8080 ) &
SITE_PID=$!

trap 'echo; echo "Derrubando..."; kill $SERVER_PID $DASH_PID $SITE_PID 2>/dev/null || true' EXIT INT TERM
wait
