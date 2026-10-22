import Explica from './Explica.jsx';

// Fases são durações que se somam; marcos são acumulados desde o início da
// navegação. Misturar os dois numa lista só contaria o mesmo tempo duas vezes —
// 'dom' já inclui servidor, download e tudo que veio antes.
const FASES = {
    redirect: 'Redirecionamento',
    dns: 'DNS',
    tcp: 'Conexão',
    tls: 'TLS',
    server: 'Servidor respondendo',
    download: 'Download do HTML',
};

const MARCOS = {
    dom: 'DOM pronto',
    load: 'Página carregada',
};

const ms = (v) => (v >= 1000 ? `${(v / 1000).toFixed(2).replace('.', ',')} s` : `${v} ms`);

export default function Cascata({ cascade }) {
    if (!cascade || cascade.samples === 0) {
        return (
            <section className="bloco">
                <div className="table-head">
                    <span className="card-title">Onde o tempo vai</span>
                </div>
                <p className="prose" style={{ paddingTop: 16 }}>
                    Nenhuma navegação medida ainda.
                </p>
            </section>
        );
    }

    const fases = cascade.fases.filter((f) => f.fase in FASES && f.ms > 0);
    const marcos = cascade.fases.filter((f) => f.fase in MARCOS);

    const total = fases.reduce((s, f) => s + f.ms, 0);
    // A fase mais lenta é o gargalo — e nesta página a cor não disputa com
    // nada, então pode apontá-lo. É a única coisa que o cliente leva daqui.
    const maior = Math.max(...fases.map((f) => f.ms), 1);

    return (
        <section className="bloco">
            <div className="table-head">
                <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    Onde o tempo vai
                    <Explica termo="cascata" />
                </span>
                <span className="card-title">p75 · {cascade.samples} navegações</span>
            </div>

            {/* A barra única vive na MESMA grade das linhas de baixo, e ocupa
                a mesma coluna que as trilhas delas. É isso que faz o trecho 4
                lá de cima cair exatamente sobre a barra da linha 4 — as duas
                réguas passam a ser a mesma régua.

                Uma linha só: cascata é sequência, e barras separadas perderiam
                a ordem. Os trechos se distinguem pelo vão de 2px entre eles —
                seis tons de cinza seriam ilegíveis e desnecessários, já que o
                número identifica cada um. */}
            <div className="cascata-grade cascata-topo">
                <span />
                <span />
                <div
                    className="cascata"
                    role="img"
                    aria-label={`Tempo até o HTML chegar: ${ms(total)}. ${fases.map((f, i) => `${i + 1}, ${FASES[f.fase]}, ${ms(f.ms)}`).join('. ')}.`}
                >
                    {fases.map((f, i) => (
                        <span
                            key={f.fase}
                            className={`cascata-trecho${f.ms === maior ? ' cascata-gargalo' : ''}`}
                            // flex-basis 0, e não só flex-grow: o grow reparte o
                            // espaço LIVRE, e o trecho que carrega um dígito
                            // começava com a largura do dígito. Era isso que
                            // deslocava os trechos em relação às linhas de baixo.
                            style={{ flex: `${f.ms} 1 0%` }}
                        >
                            {/* O número some nos trechos estreitos demais para
                                caber um dígito — na linha de baixo ele fica. */}
                            {f.ms / total >= 0.05 && <span className="cascata-num-barra">{i + 1}</span>}
                        </span>
                    ))}
                </div>
                <span />
            </div>

            {/* A mesma sequência, agora aberta: cada linha começa onde a
                anterior terminou. A barra única mostra a proporção; esta lista
                mostra QUANDO cada etapa acontece — é o que deixa ver que o
                servidor só começou a responder depois de 180 ms de conexão. */}
            <div className="cascata-linhas">
                {fases.map((f, i) => {
                    const inicio = fases.slice(0, i).reduce((soma, a) => soma + a.ms, 0);
                    return (
                        <div key={f.fase} className="cascata-grade cascata-linha">
                            <span className={`cascata-marca${f.ms === maior ? ' cascata-gargalo' : ''}`}>
                                {i + 1}
                            </span>
                            <span className="cascata-rotulo">{FASES[f.fase]}</span>
                            <span className="cascata-trilho">
                                <span
                                    className={`cascata-barra${f.ms === maior ? ' cascata-gargalo' : ''}`}
                                    style={{
                                        marginLeft: `${(inicio / total) * 100}%`,
                                        width: `${(f.ms / total) * 100}%`,
                                    }}
                                />
                            </span>
                            <span className="cascata-num">{ms(f.ms)}</span>
                        </div>
                    );
                })}
            </div>

            {/* Na mesma grade: o total alinha com os tempos das etapas, que é
                a coluna com que ele se compara. */}
            <div className="cascata-grade cascata-total">
                <span style={{ gridColumn: '1 / 3' }}>Até o HTML chegar</span>
                <span />
                <span className="cascata-num">{ms(total)}</span>
            </div>

            {marcos.length > 0 && (
                <div style={{ marginTop: 28 }}>
                    <div className="table-head">
                        <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                            Marcos
                            <Explica termo="marcos" />
                        </span>
                        <span className="card-title">desde o início</span>
                    </div>
                    {marcos.map((m) => (
                        <div key={m.fase} className="table-row">
                            <span className="table-name">{MARCOS[m.fase]}</span>
                            <span className="table-value">{ms(m.ms)}</span>
                        </div>
                    ))}
                </div>
            )}

        </section>
    );
}
