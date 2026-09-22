# Como rodar

O projeto vive em `~/Projetos/Coddara/CoddaraAnalyticsLite`.

## Atalho

```bash
cd ~/Projetos/Coddara/CoddaraAnalyticsLite
./dev.sh
```

Sobe tudo na ordem certa e imprime os endereços. `Ctrl+C` derruba o servidor e o
site; o Postgres continua de pé (é container, não custa nada deixar rodando).

Pode rodar quantas vezes quiser — migração e seed são idempotentes.

---

## Pré-requisitos (uma vez só)

**1. Docker rodando e acessível sem `sudo`:**

```bash
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Depois do `usermod`, **reinicie a máquina**. Grupo de Unix é copiado do processo
pai no nascimento e nunca mais relido — e logout não resolve, porque o
`systemd --user` sobrevive ao fim da sessão e é ele quem lança os aplicativos
gráficos, repassando a lista antiga para o VS Code e para o terminal.

Conferir:

```bash
id -nG | grep -o docker     # tem que imprimir "docker"
```

**2. Dependências do servidor:**

```bash
cd ~/Projetos/Coddara/CoddaraAnalyticsLite/server
npm install
```

---

## A ordem importa

```
1. Postgres      o servidor não sobe sem banco para consultar
2. Migrações     as tabelas precisam existir antes do primeiro evento
3. Site de teste sem uma linha em `sites`, todo evento é descartado
4. Ingest        serve o /t.js que o site de exemplo vai buscar
5. Site exemplo  só faz sentido com o ingest no ar
```

O `dev.sh` faz os cinco nessa ordem.

---

## Rodando na mão

Se preferir cada peça num terminal, para ver os logs separados:

**Terminal 1 — banco (uma vez):**

```bash
cd ~/Projetos/Coddara/CoddaraAnalyticsLite
docker compose up -d --wait
for f in server/sql/*.sql; do
  docker compose exec -T db psql -U coddara -d coddara_analytics -q < "$f"
done
```

**Terminal 2 — ingest:**

```bash
cd ~/Projetos/Coddara/CoddaraAnalyticsLite/server
npm run dev
```

**Terminal 3 — site de teste:**

```bash
cd ~/Projetos/Coddara/CoddaraAnalyticsLite/exemplo
python3 -m http.server 8080
```

Depois abra `http://localhost:8080`.

Tem que ser por `localhost:8080` mesmo. Abrir o arquivo direto (`file://`) manda
`Origin: null` e o evento é descartado na validação de origem.

---

## Banco

```bash
cd ~/Projetos/Coddara/CoddaraAnalyticsLite

# console interativo
docker compose exec db psql -U coddara -d coddara_analytics

# consulta avulsa
docker compose exec -T db psql -U coddara -d coddara_analytics -c 'SELECT * FROM sites;'
```

Dentro do `psql`: `\dt` lista tabelas, `\d events` descreve uma, `\q` sai.

Pelo VS Code, a extensão **SQLTools** conecta com:

```
Host      localhost
Porta     5432
Database  coddara_analytics
Usuário   coddara
Senha     coddara_dev
```

---

## Parar e limpar

```bash
cd ~/Projetos/Coddara/CoddaraAnalyticsLite

docker compose down        # para o banco, MANTÉM os dados
docker compose down -v     # para e APAGA os dados (volume some junto)
```

Depois de um `down -v`, o próximo `./dev.sh` recria tudo do zero — inclusive um
token novo, já que a tabela volta vazia.

---

## Dashboard

React + Vite em `dashboard/`, na porta **5173**. O `dev.sh` sobe junto.

Separado num terminal:

```bash
cd ~/Projetos/Coddara/CoddaraAnalyticsLite/dashboard
npm run dev
```

Fala com o ingest em `http://localhost:3002`. Para apontar para outro endereço,
`VITE_API_URL` no ambiente.

---

## Quando algo não funciona

| Sintoma | Causa provável |
|---|---|
| `permission denied` no socket do Docker | Não relogou depois do `usermod` |
| `token desconhecido, descartado` | O `data-token` do HTML não bate com a tabela `sites`. O `dev.sh` sincroniza sozinho |
| `origem ... não confere` | Abriu como `file://`, ou o domínio da tabela não é `localhost` |
| Porta 3002 ocupada | Já tem um `npm run dev` rodando em outro terminal |
| Evento não aparece e nem erro | O beacon falha em silêncio de propósito. Conferir a aba Network: deve haver um `POST /e` com status 204 |
