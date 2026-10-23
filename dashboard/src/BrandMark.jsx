// A marca da Coddara Analytics: um período de senoide — a série temporal, o
// desenho que o painel existe para responder. Usa currentColor para servir
// tanto no fundo claro quanto no escuro.
//
// O pathLength="1" é para a animação do .sinal: com o comprimento normalizado,
// o traço se desenha de ponta a ponta sem medir a curva.
export default function BrandMark({ size = 20 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path
                d="M3 16 C5.17 11.8 7.16 8 9.5 8 C11.84 8 13.83 11.8 16 16 C18.17 20.2 20.16 24 22.5 24 C24.84 24 26.83 20.2 29 16"
                pathLength="1"
                stroke="currentColor" strokeWidth="3" strokeLinecap="round"
            />
        </svg>
    );
}
