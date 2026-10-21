# Coddara Analytics Lite

Analytics web auto-hospedado e multi-site. Uma tag `<script>` no site coleta as
visitas; um painel mostra de onde vêm, o que veem e como o site se comporta
no navegador de quem visita. Tudo roda num processo Node e num Postgres, sem
serviço de terceiros e sem cookie.

## Como funciona

```
site do cliente                    servidor                         painel
───────────────                    ────────                         ──────
<script src=".../t.js"     ──►  POST /e   valida, anonimiza,  ──►  GET /api/...
        data-token="...">                 grava em `events`         lê e agrega
```

1. **Tag.** Cada site cadastrado recebe um token. A tag com esse token vai no
   `<head>` do site:

   ```html
   <script defer src="https://SEU-HOST/t.js" data-token="TOKEN_DO_SITE"></script>
   ```

2. **Beacon.** O `t.js` envia um `pageview` assim que a página fica visível e,
   em lotes, as métricas de desempenho. Em SPA, as trocas de rota via
   `history` também contam como pageview. O envio usa `sendBeacon` e falha em
   silêncio: o site nunca é afetado se o analytics estiver fora do ar.

3. **Ingest.** O servidor responde `204` imediatamente e só depois processa.
   Um evento é descartado quando:
   - o token não existe ou o site está desligado;
   - o cabeçalho `Origin` não corresponde ao domínio cadastrado (o `www.` é
     tratado como o mesmo site);
   - o user agent é de robô, ferramenta de linha de comando ou pré-visualização
     de link.

   Origens recusadas ficam registradas e aparecem na tela de instalação, para
   diagnosticar tag colada no domínio errado.

4. **Verificação.** O primeiro evento aceito marca o site como verificado.
   Não há verificação por DNS: só quem consegue publicar a tag no domínio
   consegue gerar esse evento.

## O que o painel mostra

Todos os números do resumo vêm comparados com o período anterior de mesma
duração. Períodos: hoje (por hora), 7, 30 e 90 dias (por dia).

| Área | Conteúdo |
|---|---|
| Resumo | Pageviews, visitantes, sessões e taxa de rejeição; série temporal de pageviews |
| Origem | Site de origem (ou acesso direto) e campanhas UTM |
| Conteúdo | Páginas mais vistas |
| Local | País e cidade/estado |
| Tecnologia | Tipo de dispositivo, navegador e sistema operacional |
| Desempenho | Core Web Vitals (LCP, INP, CLS, FCP, TTFB) no percentil 75, com a distribuição bom / precisa melhorar / ruim; cascata de carregamento (DNS, TCP, TLS, servidor, download, DOM, load) |
| Instalação | Tag pronta para copiar, estado da verificação e origens recusadas |

**Definições:**

- **Visitante:** hash de IP + user agent + site + data, com sal secreto. A
  identidade muda à meia-noite (fuso de `SITE_TIMEZONE`), então "visitantes"
  significa visitantes únicos por dia.
- **Sessão:** sequência de pageviews do mesmo visitante com menos de 30 minutos
  entre uma e outra. É calculada na leitura, não gravada.
- **Rejeição:** sessão com um único pageview.

## Privacidade

- Sem cookie e sem armazenamento no navegador do visitante.
- O IP é usado só para gerar o hash diário e consultar a localização numa base
  local (`geoip-lite`). Não é gravado nem enviado a terceiros.
- Da URL, grava-se o caminho e os parâmetros `utm_*`. O restante da query
  string e o fragmento são descartados.

## Contas e sites

- Login por e-mail e senha (bcrypt), sessão em cookie `httpOnly` assinado com
  JWT. O login tem limite de tentativas por IP e e-mail.
- Uma conta pode ter vários sites e alternar entre eles pelo painel. Cada site
  tem papéis por conta: `owner` (configura) e `member` (só lê). Contas com
  `is_staff` veem todos os sites.
- Remover um site **desliga** a coleta, sem apagar o histórico. O site pode ser
  religado com o mesmo token.
- O domínio de um site é imutável; domínio novo é site novo.

## Stack

| Camada | Tecnologia |
|---|---|
| Servidor | Node, Express 5, `pg` com SQL escrito à mão |
| Banco | Postgres |
| Beacon | JavaScript sem framework + `web-vitals`, empacotado com esbuild (~4 kB gzip) |
| Painel | React 19, Vite, MUI |

## Estrutura

```
tracker/     fonte do beacon (t.js)
server/      ingest, API do painel, migrações (sql/) e relatórios
dashboard/   painel React
exemplo/     página estática para testar a coleta localmente
docs/        guia de desenvolvimento e catálogo de dados
design/      referências visuais do painel
```

## Rodando localmente

Requer Docker, Node e Python 3.

```bash
./dev.sh
```

Sobe o Postgres, aplica as migrações, cria um site e uma conta de teste e
inicia o servidor (`:3002`), o painel (`:5173`) e a página de exemplo
(`:8080`). Detalhes e solução de problemas em
[docs/como-rodar.md](docs/como-rodar.md).

Testes do servidor:

```bash
cd server && npm test
```

## Produção

O `Dockerfile` gera uma imagem única com servidor, beacon e painel compilados.
Na subida, aplica as migrações pendentes e só então inicia o servidor. Painel
e API ficam na mesma origem, com a API sob `/api`.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Conexão com o Postgres |
| `JWT_SECRET` | sim | Assina a sessão do painel |
| `VISITOR_SALT` | sim | Sal do hash de visitante. Trocá-lo faz todos os visitantes parecerem novos |
| `TRUST_PROXY` | atrás de proxy | Número de proxies confiáveis, para obter o IP real do visitante |
| `DATABASE_SSL` | não | `true` quando o banco exige TLS |
| `DASHBOARD_ORIGIN` | não | Origem do painel, para CORS, se estiver em outro domínio |
| `SITE_TIMEZONE` | não | Fuso do dia nos gráficos e na identidade do visitante. Padrão `America/Sao_Paulo` |

Sem as três obrigatórias, o servidor não sobe em produção. Modelo completo em
[.env.example](.env.example).

`GET /health` responde `200` com o banco acessível e `503` sem ele.