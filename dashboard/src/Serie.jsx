import { useState } from 'react';

// Coordenadas do desenho. Em unidades do viewBox, não de tela: o SVG escala
// junto com a largura disponível e a geometria continua valendo.
const L = 60;    // margem esquerda, onde começa a linha
const R = 1020;  // margem direita
const TOPO = 30;
const BASE = 180;

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Lido da string, sem passar por Date: new Date de uma data sem hora assume
// UTC e, no Brasil, devolve o dia anterior. O servidor já mandou no fuso certo.
//   dia:  '2026-09-16'        → { curto: '16', longo: '16 SET' }
//   hora: '2026-09-16T14:00'  → { curto: '14h', longo: '14H' }
function lerPonto(iso) {
    const [data, hora] = iso.split('T');
    const [, m, d] = data.split('-');

    if (hora) {
        const h = hora.slice(0, 2);
        return { curto: `${Number(h)}h`, longo: `${Number(h)}H` };
    }
    return { curto: String(Number(d)), longo: `${Number(d)} ${MES[Number(m) - 1].toUpperCase()}` };
}

// Escala "bonita": o topo vira 100, 250, 500... em vez de 83. Assim o rótulo do
// topo nomeia um número redondo, que é o que se consegue ler de relance.
function topoDaEscala(max) {
    if (max <= 5) return 5;
    const magnitude = 10 ** Math.floor(Math.log10(max));
    for (const passo of [1, 2, 2.5, 5, 10]) {
        const candidato = passo * magnitude;
        if (candidato >= max) return candidato;
    }
    return 10 * magnitude;
}

export default function Serie({ pontos, granularidade = 'dia' }) {
    const [ativo, setAtivo] = useState(null);

    if (!pontos?.length) return null;

    const valores = pontos.map((p) => p.pageviews);
    const teto = topoDaEscala(Math.max(...valores, 1));
    const passo = pontos.length > 1 ? (R - L) / (pontos.length - 1) : 0;

    const coord = (i, v) => [L + i * passo, BASE - (v / teto) * (BASE - TOPO)];
    const xy = pontos.map((p, i) => coord(i, p.pageviews));

    const linha = xy.map(([x, y]) => `${x},${y}`).join(' L');
    const area = `M${linha} L${R},${BASE} L${L},${BASE} Z`;

    const ultimo = pontos.length - 1;
    const [ux, uy] = xy[ultimo];

    // Só alguns rótulos no eixo: um por ponto vira mancha em 30 ou 90 dias.
    const cada = Math.ceil(pontos.length / 7);

    return (
        <svg
            viewBox="0 0 1072 232"
            style={{ width: '100%', height: 'auto', display: 'block' }}
            role="img"
            aria-label={`Pageviews por dia. Último dia: ${pontos[ultimo].pageviews}.`}
            onMouseLeave={() => setAtivo(null)}
        >
            <line x1={L} y1={BASE} x2={R} y2={BASE} stroke="var(--line)" strokeWidth="1" />

            {/* Topo da escala, rotulado: todo rótulo nomeia um valor que o
                gráfico alcança. Grade completa seria ruído com uma série só. */}
            <line x1={L} y1={TOPO} x2={R} y2={TOPO} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 4" />
            <text x={L} y={TOPO - 8} fontSize="11" fontWeight="600" letterSpacing="0.9" fill="var(--faint)">
                {teto.toLocaleString('pt-BR')}
            </text>

            <path d={area} fill="var(--accent)" fillOpacity="0.07" />
            <path d={`M${linha}`} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

            {/* Alvo de mouse por ponto, largo o bastante para ser fácil de pegar.
                Invisível: quem desenha o estado é o traço abaixo. */}
            {xy.map(([x], i) => (
                <rect
                    key={pontos[i].day}
                    x={x - passo / 2}
                    y={TOPO - 20}
                    width={passo || 40}
                    height={BASE - TOPO + 40}
                    fill="transparent"
                    onMouseEnter={() => setAtivo(i)}
                />
            ))}

            {/* Em repouso, só o último ponto, rotulado. Sem ele o gráfico
                ficaria sem nenhum número além do topo da escala — e o valor de
                hoje é justamente o que se quer saber sem ter que apontar. */}
            <circle cx={ux} cy={uy} r="5" fill="var(--accent)" />
            <circle cx={ux} cy={uy} r="5" fill="none" stroke="var(--bg)" strokeWidth="2" />
            {ativo === null && (
                <text x={ux} y={uy - 14} fontSize="13" fontWeight="500" textAnchor="end" fill="var(--ink)">
                    {pontos[ultimo].pageviews.toLocaleString('pt-BR')}
                </text>
            )}

            {/* Detalhe só enquanto o mouse está no gráfico. Fixo no fim, ele
                parecia estado travado em vez de repouso. */}
            {ativo !== null && (() => {
                const [ax, ay] = xy[ativo];
                const rotulo = lerPonto(pontos[ativo].day).longo;
                return (
                    <g>
                        <line x1={ax} y1={TOPO} x2={ax} y2={BASE} stroke="var(--faint)" strokeWidth="1" strokeDasharray="3 3" />
                        <circle cx={ax} cy={ay} r="5" fill="var(--accent)" />
                        <circle cx={ax} cy={ay} r="5" fill="none" stroke="var(--bg)" strokeWidth="2" />

                        {/* A caixa vira para a esquerda perto da borda direita,
                            senão sai do desenho justamente no ponto mais olhado. */}
                        <g transform={`translate(${Math.min(ax + 14, R - 182)}, 8)`}>
                            <rect width="196" height="42" fill="var(--bg)" stroke="var(--ink)" strokeWidth="1" />
                            <text x="12" y="18" fontSize="11" fontWeight="600" letterSpacing="0.9" fill="var(--faint)">
                                {rotulo}
                            </text>
                            <text x="184" y="18" fontSize="13" textAnchor="end" fill="var(--ink)">
                                {pontos[ativo].pageviews.toLocaleString('pt-BR')}
                            </text>
                            <text x="12" y="34" fontSize="12" fill="var(--muted)">pageviews</text>
                        </g>
                    </g>
                );
            })()}

            {pontos.map((p, i) => {
                if (i % cada !== 0 && i !== ultimo) return null;
                return (
                    <text key={p.day} x={xy[i][0]} y={BASE + 24} fontSize="12" textAnchor="middle" fill="var(--muted)">
                        {lerPonto(p.day).curto}
                    </text>
                );
            })}

            <text x={R} y={BASE + 46} fontSize="11" fontWeight="600" letterSpacing="0.9" textAnchor="end" fill="var(--faint)">
                {granularidade === 'hora' ? 'HORA LOCAL' : lerPonto(pontos[ultimo].day).longo.split(' ')[1]}
            </text>
        </svg>
    );
}
