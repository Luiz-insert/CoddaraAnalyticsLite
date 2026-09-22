// A marca da Coddara: círculo pontilhado. Usa currentColor para servir tanto no
// fundo claro quanto na barra escura.
export default function BrandMark({ size = 20 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <circle
                cx="16" cy="16" r="13"
                stroke="currentColor" strokeWidth="3"
                strokeDasharray="0.1 5" strokeLinecap="round"
            />
        </svg>
    );
}
