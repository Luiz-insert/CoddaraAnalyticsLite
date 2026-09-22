import Vitals from './Vitals.jsx';
import Cascata from './Cascata.jsx';

export default function Desempenho({ data }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 52 }}>
            {/* Vitals primeiro: é o veredito. A cascata vem depois porque ela
                explica o veredito — ler na ordem inversa não faz sentido. */}
            <Vitals vitals={data.vitals ?? []} />
            <Cascata cascade={data.cascade} />
        </div>
    );
}
