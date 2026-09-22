# Catálogo de dados coletáveis

O que é possível capturar, de onde vem e o que vale a pena.

A coluna **Usar** reflete a regra do projeto: *um sinal só entra se responder uma
pergunta que já está na lista de métricas*. Facilidade de coleta não é motivo.

- ✅ já usamos ou entra em breve
- 🕐 faz sentido, mas em fase posterior
- ❌ não entra — ver a seção de fingerprint no fim

---

## 1. Vem do navegador (viaja no payload)

### Página e documento

| API | O que dá | Cuidado | Usar |
|---|---|---|---|
| `location.pathname` | Caminho da página | — | ✅ |
| `location.search` | Query string → UTM | — | ✅ |
| `location.href` | URL completa | Não guardar inteira: agrupa mal | ✅ |
| `document.title` | Título da página | Muda em SPA sem recarregar | ✅ |
| `document.referrer` | De onde veio | Vazio em acesso direto; política do site de origem pode cortar para só o domínio | ✅ |
| `document.visibilityState` | Aba em primeiro plano | Base do "tempo visível" | ✅ |
| `location.hash` | Âncora | Ruído na maioria dos casos | 🕐 |

### Tela e janela

| API | O que dá | Cuidado | Usar |
|---|---|---|---|
| `innerWidth` / `innerHeight` | Viewport real — o que a pessoa vê | É este que importa para responsivo, não o monitor | ✅ |
| `screen.width` / `height` | Resolução do monitor | Não reflete o tamanho da janela | ✅ |
| `screen.availWidth` / `availHeight` | Descontando barras do SO | Pouco valor extra | ❌ |
| `devicePixelRatio` | Densidade (tela retina) | Sinal de fingerprint | ❌ |
| `screen.orientation.type` | Retrato ou paisagem | Derivável do viewport | 🕐 |
| `screen.colorDepth` | Profundidade de cor | Sinal de fingerprint clássico, sem uso aqui | ❌ |

### Preferências do usuário (`matchMedia`)

| API | O que dá | Cuidado | Usar |
|---|---|---|---|
| `(prefers-color-scheme: dark)` | Usa tema escuro | Útil para decidir se vale fazer tema escuro no site do cliente | 🕐 |
| `(prefers-reduced-motion)` | Pediu menos animação | Interessante para acessibilidade | 🕐 |
| `(prefers-contrast)` | Pediu mais contraste | Nicho | ❌ |

### Ambiente

| API | O que dá | Cuidado | Usar |
|---|---|---|---|
| `navigator.language` | Idioma preferido | — | ✅ |
| `Intl.DateTimeFormat().resolvedOptions().timeZone` | Fuso horário | Diz a região sem tocar em IP — mais barato e mais privado que geolocalização | ✅ |
| `navigator.maxTouchPoints` | Tem toque | Mais confiável que user agent para saber se é celular | ✅ |
| `navigator.webdriver` | Navegador automatizado | **Filtro de bot.** Não pega todos, mas é grátis | ✅ |
| `navigator.userAgent` | Navegador e SO | Já chega como header; não precisa duplicar no payload | ❌ |
| `navigator.userAgentData` | Client Hints estruturados | Só Chromium. Substituto moderno da UA | 🕐 |
| `navigator.connection` | Tipo de conexão, velocidade | Só Chromium. Explica LCP ruim em 3G | 🕐 |
| `navigator.globalPrivacyControl` | Sinal de "não me rastreie" | Respeitar isso é argumento de venda | 🕐 |
| `navigator.hardwareConcurrency` | Núcleos de CPU | Fingerprint, sem pergunta associada | ❌ |
| `navigator.deviceMemory` | RAM aproximada | Idem | ❌ |
| `navigator.cookieEnabled` | Aceita cookie | Só faz sentido no modo com consentimento | 🕐 |
| `navigator.storage.estimate()` | Cota de armazenamento | Fingerprint | ❌ |

### Performance

| API | O que dá | Cuidado | Usar |
|---|---|---|---|
| `PerformanceNavigationTiming` | TTFB, DNS, TCP, TLS, DOM pronto, load | Um objeto entrega quase toda a cascata de carregamento | ✅ |
| `.type` da mesma API | `navigate`, `reload`, `back_forward` | Distingue visita nova de F5 | ✅ |
| `PerformanceObserver` → `paint` | FCP | Dispara cedo, uma vez | ✅ |
| `PerformanceObserver` → `largest-contentful-paint` | LCP | Muda até a página ser escondida | ✅ |
| `PerformanceObserver` → `layout-shift` | CLS | É janela de 5s, não soma — usar a biblioteca `web-vitals` | ✅ |
| `PerformanceObserver` → `event` | INP | O mais difícil de calcular na mão — usar a biblioteca | ✅ |
| `PerformanceResourceTiming` | Cada recurso, com tamanho e tempo | Permite dizer "o banner de 3MB está segurando seu LCP". Muitos itens por página: precisa filtrar | 🕐 |
| `PerformanceObserver` → `longtask` | Travadas da thread principal | Explica INP ruim | 🕐 |

### Interação (exige listener)

| Evento | O que dá | Cuidado | Usar |
|---|---|---|---|
| `click` | Coordenadas, elemento, texto | Base do heatmap. Coordenada como proporção, não pixel | ✅ |
| Clique em `tel:` / `wa.me` / `mailto:` | **Conversão** | É a métrica que o cliente paga para ver | ✅ |
| `submit` de formulário | **Conversão** | Nunca capturar o conteúdo dos campos | ✅ |
| `scroll` | Profundidade da rolagem | Amostrar, não registrar cada pixel | ✅ |
| `pagehide` / `visibilitychange` | Saída e tempo visível | É aqui que LCP, CLS e INP ficam definitivos | ✅ |
| `pushState` / `popstate` | Troca de rota em SPA | Sem isso, SPA registra uma visita só | ✅ |
| `error` / `unhandledrejection` | Erro de JavaScript no site do cliente | Diferencial real: você avisa antes de o cliente perceber | 🕐 |
| Rage click / dead click | Frustração do visitante | Derivado de padrão de clique, não é evento próprio | 🕐 |
| `copy` | Copiou conteúdo | Sinal de intenção (copiar telefone) | 🕐 |

---

## 2. O servidor deriva (não vem no payload)

| Fonte | O que dá | Cuidado | Usar |
|---|---|---|---|
| IP da conexão | Cidade e estado | **Dado pessoal.** Converter e descartar, nunca gravar | ✅ |
| Header `User-Agent` | Navegador, SO, dispositivo | Reduzido de propósito pelos navegadores modernos | ✅ |
| Header `User-Agent` | **Se é robô** | Descartado no ingest, não na consulta: filtrar na leitura obriga a lembrar do filtro em toda consulta nova | ✅ |
| Header `Origin` | Domínio de origem | Já é o que valida o token | ✅ |
| Header `Accept-Language` | Idiomas aceitos | Redundante com `navigator.language` | ❌ |
| Headers `Sec-CH-UA-*` | Client Hints | Precisa ser solicitado por header de resposta | 🕐 |
| Horário de chegada | Momento real | **O único relógio confiável do sistema** | ✅ |

---

## 3. Calculado por nós

| O que | De onde sai |
|---|---|
| `visitor_hash` | sha256(segredo + dia + IP + user agent + site_id) |
| Sessão | Pageviews do mesmo visitante com menos de 30 min de intervalo |
| Tempo na página | Soma do tempo visível, enviada no `pagehide` |
| Taxa de rejeição | Fração das sessões que viram **uma página só**. Não usa "sem interação": interação exigiria gravar clique e rolagem de todo visitante |
| Canal de origem | Classificação do `referrer_host` (busca, social, direto, referência) |
| Novo vs recorrente | Sem consentimento: `visitor_hash` no mesmo dia. Com consentimento: id persistente |

---

## 4. O que não dá para pegar

Vale saber para não perder tempo procurando:

- **O IP pelo JavaScript.** Só o servidor enxerga a conexão
- **Identidade entre dias sem consentimento.** Com consentimento é possível — ver seção 5
- **Qualquer coisa de outra aba, outro site ou do histórico**
- **User agent preciso.** Os navegadores reduziram deliberadamente o que ele revela
- **Referrer completo** quando o site de origem define política restritiva
- **Visitante com JavaScript desligado.** Ele simplesmente não existe para nós

---

## 5. Com e sem consentimento

O foco do produto é coletar o dado. Cookie está na mesa. Mas parte dos
visitantes vai recusar, e o produto precisa continuar entregando valor nesse
caso — degradando, não quebrando.

### Duas exigências diferentes, que costumam ser confundidas

**1. Guardar algo no dispositivo** — cookie, `localStorage`, `sessionStorage`,
IndexedDB. Exige consentimento. Repare que não é sobre cookie: é sobre
**escrever no aparelho da pessoa**, qualquer que seja o mecanismo.

**2. Tratar dado pessoal** — exige base legal, que pode ser interesse legítimo
quando o dado é agregado e não identifica ninguém.

É por isso que analytics agregado costuma rodar sem banner, e identidade
persistente não.

### O que funciona em cada modo

| Dado / métrica | Sem consentimento | Com consentimento |
|---|---|---|
| Pageview, caminho, título | ✅ | ✅ |
| Referrer, UTM, canal de origem | ✅ | ✅ |
| Dispositivo, navegador, SO, viewport | ✅ | ✅ |
| Idioma, fuso horário, cidade | ✅ | ✅ |
| Core Web Vitals | ✅ | ✅ |
| Scroll, cliques, heatmap | ✅ | ✅ |
| **Conversão** (WhatsApp, formulário) | ✅ | ✅ |
| Tempo na página | ✅ | ✅ |
| Sessão dentro da mesma visita | ✅ | ✅ |
| Visitante único no dia | aproximado | exato |
| Novo vs recorrente **entre dias** | ❌ | ✅ |
| Jornada ao longo de várias sessões | ❌ | ✅ |
| Atribuição de campanha além da sessão | ❌ | ✅ |
| Funil de múltiplas visitas | ❌ | ✅ |

O importante dessa tabela é o tamanho da coluna do meio: **quase tudo que o
dono de uma landing page pergunta funciona sem consentimento.** Recusa custa
pouco. O que se perde é continuidade entre dias — relevante para e-commerce e
ciclo de venda longo, quase irrelevante para "quantas pessoas me chamaram no
WhatsApp essa semana".

### O que não fazer quando recusam

Trocar o cookie por fingerprint para continuar rastreando a mesma pessoa é
exatamente o que reguladores tratam como burla de consentimento — e é pior que
usar cookie, porque o visitante recusou e foi rastreado assim mesmo.

O modo degradado precisa ser degradado de verdade.

### Consequência para a arquitetura

O consentimento é coletado pelo **site do cliente**, não por nós. Então o beacon
precisa de uma porta de entrada para esse sinal — algo como
`window.coddara.consent('granted')`, chamado pelo banner do site.

E há uma conclusão boa nisso: o `visitor_hash` diário que já desenhamos **é o
modo sem consentimento**. O que construímos até aqui é o padrão correto; o modo
com consentimento é uma camada por cima, não uma reescrita.

Enquanto não existir banner em nenhum site que você entrega, todo mundo roda no
modo padrão — e ele já responde a maior parte das perguntas.

---

## 6. A regra do fingerprint

Vários itens marcados ❌ são inofensivos sozinhos: densidade de tela, núcleos de
CPU, RAM, profundidade de cor, fuso, idioma, resolução.

**Combinados, identificam uma pessoa com precisão alta — sem cookie nenhum.**

Isso vale mesmo usando cookie — e principalmente aí. Um tracker que coleta dez
desses sinais é um fingerprinter, e sob LGPD e GDPR fingerprint é tratado como
identificação, com o agravante de que o visitante não consegue recusar. Usar
fingerprint junto com cookie é redundante; usar no lugar do cookie recusado é
burla (ver seção 5).

Seria perder o argumento comercial e ganhar risco jurídico ao mesmo tempo.

Por isso a regra: **um sinal só entra se responder uma pergunta que já está na
lista de métricas.** `deviceMemory` é trivial de coletar e não responde nenhuma
das doze — então não entra.
