import Explica from './Explica.jsx';

// Limites oficiais do Google. Estão aqui, e não no servidor, porque são
// classificação de apresentação — e porque o cliente vai comparar o nosso rótulo
// com o do PageSpeed, que usa exatamente estes números.
const LIMITES = {
    LCP: { bom: 2500, ruim: 4000, unidade: 'ms', nome: 'Maior conteúdo' },
    INP: { bom: 200, ruim: 500, unidade: 'ms', nome: 'Resposta ao clique' },
    CLS: { bom: 0.1, ruim: 0.25, unidade: '', nome: 'Estabilidade visual' },
    FCP: { bom: 1800, ruim: 3000, unidade: 'ms', nome: 'Primeiro conteúdo' },
    TTFB: { bom: 800, ruim: 1800, unidade: 'ms', nome: 'Resposta do servidor' },
};

// Ordem fixa: os três primeiros são os Core Web Vitals que o Google usa em
// ranqueamento. FCP e TTFB explicam os outros, mas não valem por si.
const ORDEM = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

function classificar(nome, valor) {
    const l = LIMITES[nome];
    if (!l) return null;
    if (valor <= l.bom) return 'Bom';
    if (valor <= l.ruim) return 'Precisa melhorar';
    return 'Ruim';
}

function formatar(nome, valor) {
    const l = LIMITES[nome];
    if (!l) return String(valor);
    // Acima de um segundo, ms vira número grande e ilegível.
    if (l.unidade === 'ms') {
        return valor >= 1000 ? `${(valor / 1000).toFixed(2).replace('.', ',')} s` : `${Math.round(valor)} ms`;
    }
    return valor.toFixed(3).replace('.', ',');
}

// Régua com as duas fronteiras do Google e o p75 marcado. Sem nota inventada:
// as zonas são os limites oficiais e a marca é o valor medido.
//
// A borda direita é o dobro do limite de "ruim" — extensão visual, não escala
// de nota. Valor além dela encosta no fim, e o número exato está ao lado, então
// nada se perde no corte.
function Regua({ valor, limites }) {
    const fim = limites.ruim * 2;
    const pct = (v) => `${Math.min(Math.max(v / fim, 0), 1) * 100}%`;

    return (
        <span className="regua" aria-hidden="true">
            <span className="regua-zona regua-bom" style={{ width: pct(limites.bom) }} />
            <span className="regua-zona regua-meh" style={{ width: pct(limites.ruim - limites.bom) }} />
            <span className="regua-zona regua-ruim" style={{ width: pct(fim - limites.ruim) }} />
            <span className="regua-marca" style={{ left: pct(valor) }} />
        </span>
    );
}

export default function Vitals({ vitals }) {
    const porNome = new Map(vitals.map((v) => [v.name, v]));
    const linhas = ORDEM.filter((nome) => porNome.has(nome));

    return (
        <section className="bloco">
            <div className="table-head">
                <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    Core Web Vitals
                    <Explica termo="vitals" />
                </span>
                <span className="card-title">p75</span>
            </div>

            {linhas.length === 0 ? (
                <p className="prose" style={{ paddingTop: 16 }}>
                    Nenhuma medição ainda. Elas chegam quando um visitante sai da página —
                    é nesse momento que LCP, INP e CLS ficam definitivos.
                </p>
            ) : (
                linhas.map((nome) => {
                    const v = porNome.get(nome);
                    const estado = classificar(nome, v.p75);

                    return (
                        <div key={nome} className="vital-row">
                            <span className="vital-sigla">{nome}</span>
                            <span className="vital-nome">{LIMITES[nome].nome}</span>
                            <span className="vital-valor">{formatar(nome, v.p75)}</span>
                            <Regua valor={v.p75} limites={LIMITES[nome]} />
                            <span className={`vital-estado${estado === 'Bom' ? ' vital-bom' : ''}`}>
                                {estado}
                            </span>
                        </div>
                    );
                })
            )}

            {linhas.length > 0 && (
                <p className="prose" style={{ marginTop: 16 }}>
                    A régua marca onde o valor cai entre as duas fronteiras do Google — quanto
                    mais à esquerda, mais folga.
                </p>
            )}
        </section>
    );
}
