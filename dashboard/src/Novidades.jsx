import { useEffect } from 'react';
import { NOVIDADES, marcarVistas } from './novidades.js';

const ROTULO = { novo: 'Novo', melhoria: 'Melhoria', correcao: 'Correção' };

// A data vem como 'AAAA-MM-DD' e é lida como dia do calendário, não como
// instante: new Date('2026-10-22') seria meia-noite em UTC, que no Brasil
// ainda é o dia 21.
function dataPorExtenso(iso) {
    const [ano, mes, dia] = iso.split('-').map(Number);
    return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
}

export default function Novidades() {
    // Abrir a página é ter visto: o ponto do menu some a partir daqui.
    useEffect(() => { marcarVistas(); }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {NOVIDADES.map((n) => (
                <article key={`${n.data}-${n.titulo}`} className="bloco novidade">
                    {/* Quando e o quê numa coluna própria: lendo de cima a baixo, a
                        data é o que se varre primeiro, e o texto fica com a largura
                        que sobra em vez de se espremer num cartão estreito. */}
                    <div className="novidade-quando">
                        <span className="card-title">{dataPorExtenso(n.data)}</span>
                        <span className="novidade-tipo">{ROTULO[n.tipo]}</span>
                    </div>
                    <div>
                        <h3 className="novidade-titulo">{n.titulo}</h3>
                        <ul className="novidade-itens prose">
                            {n.itens.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                    </div>
                </article>
            ))}
        </div>
    );
}
