const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002';

// O que existe hoje, agrupado por quem consome. A separação importa: as rotas
// de leitura dependem de cookie de sessão, o que as torna inúteis fora do
// navegador — documentá-las como "API pública" seria prometer o que não entrega.
const GRUPOS = [
    {
        titulo: 'Coleta',
        nota: 'Público. Não exige autenticação: o token identifica o site e o header Origin é conferido contra o domínio registrado.',
        rotas: [
            ['GET', '/t.js', 'Entrega o beacon, minificado.'],
            ['POST', '/e', 'Recebe um envelope de eventos. Responde 204 sempre, inclusive em erro.'],
        ],
    },
    {
        titulo: 'Sessão',
        nota: 'Define o cookie httpOnly usado pelo painel. O login aceita seis tentativas por e-mail a cada dez minutos; acima disso responde 429 com Retry-After.',
        rotas: [
            ['POST', '/auth/register', 'Cria conta.'],
            ['POST', '/auth/login', 'Autentica e define o cookie.'],
            ['POST', '/auth/logout', 'Limpa o cookie.'],
            ['GET', '/me', 'Quem está autenticado.'],
        ],
    },
    {
        titulo: 'Leitura',
        nota: 'Exige o cookie de sessão. Só devolve sites aos quais a conta tem acesso — um id de outro cliente responde 404, não 403.',
        rotas: [
            ['GET', '/sites', 'Sites visíveis para a conta.'],
            ['GET', '/sites/:id', 'Um site, com domínio e estado de verificação.'],
            ['GET', '/sites/:id/overview', 'Totais e listas do período. Aceita period=hoje, 7d, 30d ou 90d.'],
            ['GET', '/sites/:id/rejections', 'Eventos recusados por origem divergente.'],
        ],
    },
    {
        titulo: 'Gestão de sites',
        nota: 'Exige o cookie de sessão e, para escrever, o papel de dono. Remover é desligar: o site para de receber eventos e o histórico continua consultável.',
        rotas: [
            ['POST', '/sites', 'Cria um site e gera o token. Corpo: { name, domain }.'],
            ['PATCH', '/sites/:id', 'Renomeia. Só o nome — o domínio é imutável, porque é contra ele que cada evento é conferido.'],
            ['DELETE', '/sites/:id', 'Desliga o site. Eventos passam a ser descartados na coleta.'],
            ['POST', '/sites/:id/reactivate', 'Religa o site, com o mesmo token de antes.'],
        ],
    },
];

const ENVELOPE = `{
  "v": 1,
  "token": "o token do site",
  "url": "https://clinica.com.br/promo",
  "referrer": "https://google.com/",
  "title": "Promoção de clareamento",
  "screen": "1920x1080",
  "viewport": "1280x720",
  "language": "pt-BR",
  "events": [
    { "t": "pageview", "ts": 120 }
  ]
}`;

export default function Api() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <section className="card card-draft" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="card-title">Ainda não há acesso programático</span>
                <p className="prose" style={{ color: 'var(--ink)' }}>
                    As rotas de leitura autenticam por <strong>cookie de sessão</strong>, que só
                    funciona dentro do navegador. Consumir de um servidor exige chave de API — um
                    mecanismo separado, que ainda não existe.
                </p>
                <p className="prose">
                    O que está documentado abaixo é o que roda hoje, para você saber com o que
                    contar. O formato do envelope já é estável e não vai mudar sem versão nova.
                </p>
            </section>

            <section className="card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="card-head">
                    <span className="card-title">Endereço base</span>
                </div>
                <code className="snippet">{API}</code>
            </section>

            {GRUPOS.map((grupo) => (
                <section key={grupo.titulo} className="card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="card-head">
                        <span className="card-title">{grupo.titulo}</span>
                    </div>

                    <p className="prose">{grupo.nota}</p>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {grupo.rotas.map(([metodo, caminho, descricao]) => (
                            <div key={caminho} className="route">
                                <span className={`verb verb-${metodo.toLowerCase()}`}>{metodo}</span>
                                <code className="route-path">{caminho}</code>
                                <span className="route-desc">{descricao}</span>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            <section className="card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="card-head">
                    <span className="card-title">Formato do evento</span>
                </div>
                <p className="prose">
                    O corpo do <code>POST /e</code> vai como <code>text/plain</code>, não
                    como <code>application/json</code>: esse tipo dispara um preflight CORS que
                    o <code>sendBeacon</code> não sabe fazer.
                </p>
                <pre className="snippet snippet-block">{ENVELOPE}</pre>
                <p className="prose">
                    O contexto da página fica içado e cada item de <code>events</code> carrega só o
                    que é dele. <code>ts</code> é em milissegundos desde o carregamento, não relógio
                    do visitante — o servidor reconstrói o horário real a partir da chegada.
                </p>
            </section>

        </div>
    );
}
