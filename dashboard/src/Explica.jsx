import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DEFINICOES } from './definicoes.js';
import { useIrParaAjuda } from './navegacao.js';

// Balão sobre o conteúdo, e não bloco empurrando o card: assim abrir a
// explicação não muda a altura de nada na página.
//
// Abre por clique, não por passar o mouse. Balão que depende de hover não existe
// em celular, e este texto tem três frases — não é rótulo de ícone, é leitura.
export default function Explica({ termo }) {
    const [aberto, setAberto] = useState(false);
    const [paraEsquerda, setParaEsquerda] = useState(false);
    const ancora = useRef(null);
    const balao = useRef(null);
    const irParaAjuda = useIrParaAjuda();
    const d = DEFINICOES[termo];

    // Antes de pintar, não depois: medir no useEffect faria o balão aparecer
    // fora da tela por um quadro e pular para o lugar certo.
    useLayoutEffect(() => {
        if (!aberto || !balao.current) return;
        const caixa = balao.current.getBoundingClientRect();
        // 16px de respiro na borda, o mesmo que o resto da página usa.
        setParaEsquerda(caixa.right > globalThis.innerWidth - 16);
    }, [aberto]);

    useEffect(() => {
        if (!aberto) return undefined;

        const fora = (evento) => {
            if (!ancora.current?.contains(evento.target)) setAberto(false);
        };
        const tecla = (evento) => {
            if (evento.key === 'Escape') setAberto(false);
        };

        // mousedown fecha antes do clique chegar ao alvo, então clicar no '?' de
        // outro card fecha este e abre aquele — nunca dois balões ao mesmo tempo.
        document.addEventListener('mousedown', fora);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('mousedown', fora);
            document.removeEventListener('keydown', tecla);
        };
    }, [aberto]);

    if (!d) return null;

    return (
        <span className="explica-ancora" ref={ancora}>
            <button
                type="button"
                className={`explica-btn${aberto ? ' explica-btn-on' : ''}`}
                onClick={() => setAberto((a) => !a)}
                aria-expanded={aberto}
                aria-label={`O que é ${d.titulo}`}
            >
                ?
            </button>

            {aberto && (
                <span
                    className={`explica-balao${paraEsquerda ? ' explica-balao-esq' : ''}`}
                    ref={balao}
                    role="tooltip"
                >
                    <span className="explica-titulo">{d.titulo}</span>
                    <Texto termo={termo} />

                    {/* Para quem quer o assunto inteiro e não só este verbete —
                        e para quem chegou aqui pela terceira vez e prefere ler
                        tudo de uma vez. */}
                    {irParaAjuda && (
                        <button
                            type="button"
                            className="explica-link"
                            onClick={() => { setAberto(false); irParaAjuda(termo); }}
                        >
                            Ver em Como funciona →
                        </button>
                    )}
                </span>
            )}
        </span>
    );
}

// O mesmo texto que a página "Como funciona" usa — não existe uma segunda
// versão destes verbetes.
export function Texto({ termo }) {
    const d = DEFINICOES[termo];
    if (!d) return null;

    return (
        <span className="explica">
            <span>{d.oque}</span>
            <span className="explica-como">{d.como}</span>
            {/* O 'cuidado' em destaque porque é o que evita a conclusão errada:
                é onde o nosso número diverge do que a pessoa esperava. */}
            <span className="explica-cuidado">{d.cuidado}</span>
        </span>
    );
}
