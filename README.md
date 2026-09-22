# Coddara Analytics Lite

Analytics web próprio, sem PostHog e sem serviço de terceiros.

Substitui o `CoddaraAnalytics` (que é um BFF em cima do PostHog Cloud) por uma
stack own-stack, onde o custo marginal de mais um cliente é ~zero — o que torna
viável incluir o Analytics de graça em todo projeto entregue pela Coddara.

## Stack

| Camada    | Escolha                     | Motivo                                              |
| --------- | --------------------------- | --------------------------------------------------- |
| Ingest/API| Node + Express              | Já em uso na casa; ingest isolado para trocar depois |
| Banco     | Postgres (`pg`, SQL na mão) | Atende a escala real por anos; sem serviço extra     |
| Tracker   | JS puro, sem framework       | Vai no site do cliente: alvo < 2KB gzipped          |
| Dashboard | React 19 + Vite + Tailwind  | Mesma stack dos outros projetos Coddara             |
| Auth      | JWT                         | Mesmo padrão do CoddaraAnalytics                    |

Deliberadamente fora: ClickHouse, Kafka, Redis, ORM, monorepo tooling.
Cada um resolve um problema de escala ou de time que ainda não existe aqui.

## Estrutura pretendida

```
tracker/     beacon que vai no site do cliente (+ toolbar carregada sob demanda)
server/      ingest, API de leitura e agregação diária
dashboard/   painel React consumido pelo cliente final
```

## Dashboard — princípio

Direção suíça: grade, muito espaço vazio, hierarquia por peso e fio fino. Uma
cor só, usada uma vez — no número principal e na linha do gráfico que o detalha.

A leitura é feita de tabela. A exceção é a **série temporal de pageviews**: ela
responde "está crescendo ou caindo?", que nenhuma tabela responde. Desenhada à
mão em SVG (~1 kB) em vez de biblioteca de gráficos, porque é uma série só e o
estilo pede fio fino sem efeito.

Todo número de resumo vem com **comparação contra o período anterior** — a
janela atual deslocada N dias para trás, mesma duração e mesmo dia da semana.
É o que transforma "1.284 pageviews" em informação.

Exceção de cor: Core Web Vitals precisam de classificação contra os limites do
Google para significarem algo. Vem em texto (`LCP 2.4s — Bom`), não em semáforo.

## Modelo de dados — princípio

Evento bruto numa tabela + agregado diário por tenant/página/canal.
O dashboard lê quase tudo do agregado; o bruto só serve para heatmap e
investigação pontual. É isso que mantém o Postgres viável em escala.

## O que o produto responde

Dois públicos, duas visões:

**Dono do negócio**
1. **Alcance** — visitantes únicos, sessões, série temporal, novos vs recorrentes
2. **Origem** — canal, site/termo de origem, campanha (UTM), cidade/estado
3. **Comportamento** — páginas vistas, entrada/saída, tempo, scroll, cliques (heatmap)
4. **Resultado** — conversões: clique no WhatsApp, envio de formulário, clique em telefone

**Desenvolvedor (Coddara)**
5. **Contexto técnico** — dispositivo/navegador/SO/resolução, LCP, CLS, INP, TTFB

O grupo 4 é o que diferencia de "mais um Google Analytics": é a métrica que o
dono paga para ver. Entra no modelo de dados desde o início, não depois.

## Multi-tenant

Cada tenant gera o próprio token, que o desenvolvedor cola no código do site
para ser rastreado. Sem provisionamento manual e sem redeploy por cliente —
que é exatamente o que trava o CoddaraAnalytics hoje.

Isso já roda pelo painel: **Novo site** cadastra nome e domínio, gera o token e
cai direto na tela de instalação. O acesso nasce junto, na `user_sites`, com
papel de dono — não existe site sem dono, e a mesma conta troca entre os sites
pelo seletor no rodapé da barra lateral.

Remover é **desligar**, nunca apagar: a coleta passa a descartar os eventos
daquele token e o histórico continua consultável, com um botão para religar
sem trocar o token. Apagar de verdade levaria junto todos os eventos pelo
CASCADE, e para isso não há desfazer.

## Decisões em aberto

Precisam ser fechadas antes do schema:

- [ ] **Cookie ou sem cookie?** Sem cookie evita banner de consentimento e
      simplifica LGPD, mas "visitante recorrente" vira estimativa de 24h.
      _Recomendação: sem cookie._
- [ ] **Janela de sessão.** Define duração, rejeição e entrada/saída.
      _Recomendação: 30 min de inatividade._
- [ ] **Retenção do dado bruto.** Disco e passivo de LGPD.
      _Recomendação: bruto 90 dias, agregado diário permanente._
- [ ] **TypeScript ou JS puro?** _Recomendação: JS, por coerência com a casa._
