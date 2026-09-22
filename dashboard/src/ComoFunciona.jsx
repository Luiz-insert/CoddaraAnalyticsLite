import { useEffect, useState } from 'react';
import { DEFINICOES, GRUPOS } from './definicoes.js';
import { Texto } from './Explica.jsx';

// Tudo junto, para quem prefere ler de uma vez em vez de abrir card por card.
// Mesma fonte do botão de ajuda — não há uma segunda versão destes textos.
export default function ComoFunciona({ alvo }) {
    // Guarda qual verbete JÁ apagou, em vez de qual está aceso. A diferença
    // importa: assim o destaque é derivado durante o render e o efeito só
    // agenda o apagar — nada de estado sendo atribuído no meio de um efeito.
    const [apagado, setApagado] = useState(null);
    const destacado = alvo && apagado !== alvo ? alvo : null;

    useEffect(() => {
        if (!alvo) return undefined;

        // Rolar é sincronizar com algo fora do React; isto sim é trabalho de
        // efeito. 'center' e não 'start': o verbete fica sob a barra do topo.
        document.getElementById(`verbete-${alvo}`)?.scrollIntoView({
            block: 'center',
            behavior: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });

        // A marca sai sozinha: passado o susto de chegar no meio da página, ela
        // vira sujeira em cima do texto que a pessoa está lendo.
        const relogio = setTimeout(() => setApagado(alvo), 2500);
        return () => clearTimeout(relogio);
    }, [alvo]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <section className="card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="card-title">Antes dos números</span>
                <p className="prose" style={{ color: 'var(--ink)' }}>
                    Este painel não usa cookie e não segue ninguém de um site para outro. Ele
                    conta o que acontece dentro do seu site, e só. Por isso alguns números aqui
                    não batem com os do Google Analytics — a diferença é de método, e cada uma
                    está explicada abaixo.
                </p>
                <p className="prose">
                    Se um número parecer estranho, a explicação dele também está a um clique de
                    distância na própria tela: o <strong>?</strong> ao lado de cada título abre o
                    mesmo texto ali mesmo.
                </p>
            </section>

            {GRUPOS.map((grupo) => (
                <section key={grupo.titulo} className="card" style={{ padding: '22px 24px' }}>
                    <div className="table-head">
                        <span className="card-title">{grupo.titulo}</span>
                    </div>

                    {grupo.chaves.map((chave) => (
                        <div
                            key={chave}
                            id={`verbete-${chave}`}
                            className={`verbete${chave === destacado ? ' verbete-alvo' : ''}`}
                        >
                            <h3 className="verbete-titulo">{DEFINICOES[chave].titulo}</h3>
                            <Texto termo={chave} />
                        </div>
                    ))}
                </section>
            ))}

        </div>
    );
}
