import { useMemo, useState } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import Serie from './Serie.jsx';
import Explica from './Explica.jsx';
const PERIODS = [
    ['hoje', 'Hoje'],
    ['7d', '7 dias'],
    ['30d', '30 dias'],
    ['90d', '90 dias'],
];

// Três métricas, não quatro. Tempo médio e conversões estão no desenho mas
// dependem do beacon mandar mais que pageview — e card com número inventado é
// pior que card ausente.
const RANGE = { hoje: 'Hoje, por hora', '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', '90d': 'Últimos 90 dias' };
// Ontem até esta hora, não o dia inteiro: comparar 11h de hoje com 24h de ontem
// mostraria queda toda manhã.
const ANTERIOR = { hoje: 'ontem até esta hora', '7d': '7 dias anteriores', '30d': '30 dias anteriores', '90d': '90 dias anteriores' };

// Sem base de comparação não existe porcentagem — e escrever "+100%" quando o
// período anterior foi zero é inventar significado onde não há.
function variacao(atual, anterior) {
    if (!anterior) return null;
    const pct = Math.round(((atual - anterior) / anterior) * 100);
    return { pct, sinal: pct > 0 ? '+' : '', direcao: pct > 0 ? 'sobe' : pct < 0 ? 'desce' : 'igual' };
}

// rótulo, campo no payload, tipo, verbete da explicação
const METRICS = [
    ['Pageviews', 'pageviews', null, 'pageviews'],
    ['Visitantes', 'visitors', null, 'visitantes'],
    ['Sessões', 'sessions', null, 'sessoes'],
    // Rejeição é taxa, não contagem: cresce de 38% para 44% em 6 PONTOS, não em
    // 16%. Dizer '+16%' aqui seria uma conta certa sobre a grandeza errada.
    ['Rejeição', 'bounce', 'taxa', 'rejeicao'],
];

// Nome do país a partir do código ISO, no idioma de quem está olhando. O banco
// guarda 'BR' e o navegador sabe virar 'Brasil' — tabela de tradução nossa só
// envelheceria.
const PAISES = new Intl.DisplayNames(['pt-BR'], { type: 'region' });

function nomeDoPais(codigo) {
    if (!codigo || codigo.length !== 2) return codigo;
    try {
        return PAISES.of(codigo) ?? codigo;
    } catch {
        return codigo;
    }
}

function Metrica({ label, verbete, atual, anterior, taxa, periodo, principal }) {
    const v = taxa ? pontos(atual, anterior) : variacao(atual, anterior);

    return (
        <div className="metric">
            <div className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                {label}
                <Explica termo={verbete} />
            </div>

            {/* Só o primeiro leva a cor: ela é o destaque do número que a tela
                existe para mostrar, e gastar em três seria não destacar nenhum. */}
            <div className={`metric-value${principal ? ' metric-lead' : ''}`}>
                {atual === null || atual === undefined
                    ? '—'
                    : `${atual.toLocaleString('pt-BR')}${taxa ? '%' : ''}`}
            </div>

            <div className="metric-delta">
                {v ? (
                    <>
                        {/* Seta além do sinal: direção não pode depender só de
                            ler o "+" ou o "−". */}
                        <span className={`delta delta-${v.direcao}`}>
                            {v.seta ?? (v.direcao === 'sobe' ? '↑' : v.direcao === 'desce' ? '↓' : '→')}
                            {' '}{v.sinal}{v.pct}{taxa ? '' : '%'}
                        </span>
                        <span>
                            {anterior.toLocaleString('pt-BR')}{taxa ? '%' : ''} {periodo === 'hoje' ? '' : 'nos '}{ANTERIOR[periodo]}
                        </span>
                    </>
                ) : (
                    <span>Sem dados no período anterior</span>
                )}
            </div>

        </div>
    );
}

// Variação de uma taxa se mede em pontos percentuais. E aqui subir é ruim:
// mais gente entrando e saindo sem ver uma segunda página.
function pontos(atual, anterior) {
    if (atual === null || anterior === null || anterior === undefined) return null;
    const dif = atual - anterior;
    return {
        pct: `${Math.abs(dif)} p.p.`,
        sinal: '',
        direcao: dif > 0 ? 'desce' : dif < 0 ? 'sobe' : 'igual',
        seta: dif > 0 ? '↑' : dif < 0 ? '↓' : '→',
    };
}

// Quantas linhas cabem na caixa antes de ela começar a rolar. O servidor manda
// até cinquenta, e todas ficam ali dentro: rolar é mais barato que clicar em
// 'ver mais', e a altura da tabela para de depender de quantos dados o site tem.
const VISIVEIS = 8;

function Cabecalho({ rotulo, ativo, desc, aoClicar, direita = false }) {
    return (
        <button
            type="button"
            className={`table-ord${ativo ? ' table-ord-on' : ''}`}
            onClick={aoClicar}
            style={direita ? { justifyContent: 'flex-end' } : undefined}
        >
            {rotulo}
            {/* A seta só no critério ativo: uma em cada cabeçalho viraria
                decoração e pararia de indicar qualquer coisa. */}
            {ativo && (desc
                ? <ChevronDownIcon width={12} height={12} aria-hidden="true" />
                : <ChevronUpIcon width={12} height={12} aria-hidden="true" />)}
        </button>
    );
}

function Table({ title, unit, rows, rotulo = (x) => x, verbete }) {
    const [busca, setBusca] = useState('');
    const [ordem, setOrdem] = useState({ campo: 'value', desc: true });

    // Filtra e ordena pelo RÓTULO, não pelo dado cru: a tabela de país guarda
    // 'BR' e mostra 'Brasil'. Quem procura 'bra' está olhando para 'Brasil'.
    const tratadas = useMemo(() => {
        const alvo = busca.trim().toLocaleLowerCase('pt-BR');

        const lista = rows
            .map((r) => ({ ...r, label: String(rotulo(r.name) ?? r.name) }))
            .filter((r) => alvo === '' || r.label.toLocaleLowerCase('pt-BR').includes(alvo));

        // localeCompare e não comparação de string crua: sem ele 'Á' vem depois
        // de 'Z' e a ordem alfabética fica errada justamente em português.
        lista.sort((a, b) => (ordem.campo === 'value'
            ? a.value - b.value
            : a.label.localeCompare(b.label, 'pt-BR')));

        return ordem.desc ? lista.reverse() : lista;
    }, [rows, busca, ordem, rotulo]);

    const ordenarPor = (campo) => setOrdem((o) => (
        // Clicar no critério já ativo inverte; mudar de critério começa
        // decrescente, que é como se lê um ranking.
        o.campo === campo ? { campo, desc: !o.desc } : { campo, desc: true }
    ));

    return (
        <section className="bloco" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="table-head">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <Cabecalho
                        rotulo={title}
                        ativo={ordem.campo === 'name'}
                        desc={ordem.desc}
                        aoClicar={() => ordenarPor('name')}
                    />
                    <Explica termo={verbete} />
                </span>
                <Cabecalho
                    rotulo={unit}
                    ativo={ordem.campo === 'value'}
                    desc={ordem.desc}
                    aoClicar={() => ordenarPor('value')}
                    direita
                />
            </div>

            {/* O campo existe em TODA tabela, mesmo onde não há o que filtrar:
                invisível ali, mas ocupando o mesmo espaço. Sem isso as tabelas
                lado a lado começavam em alturas diferentes e as linhas de uma
                não batiam com as da vizinha. Invisível e inerte, não some: sem
                o disabled e o tabindex, o Tab pararia num campo que ninguém vê. */}
            <input
                type="text"
                className={`table-busca${rows.length > VISIVEIS ? '' : ' table-busca-oculta'}`}
                placeholder="Filtrar"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label={`Filtrar ${title}`}
                disabled={rows.length <= VISIVEIS}
                tabIndex={rows.length > VISIVEIS ? 0 : -1}
                aria-hidden={rows.length <= VISIVEIS}
            />

            {tratadas.length === 0
                ? (
                    <p className="prose" style={{ paddingTop: 12 }}>
                        {busca.trim() === '' ? 'Sem dados no período.' : `Nada com «${busca.trim()}».`}
                    </p>
                )
                : (
                    // Todas as linhas, numa caixa com teto. Quem tem poucas não
                    // mostra barra nenhuma; quem tem cinquenta rola por dentro,
                    // e o resto da página continua onde estava.
                    <div className="table-corpo">
                        {tratadas.map((row) => (
                            <div key={row.name} className="table-row">
                                <span className="table-name">{row.label}</span>
                                <span className="table-value">{row.value.toLocaleString('pt-BR')}</span>
                            </div>
                        ))}
                    </div>
                )}

        </section>
    );
}

export function PeriodPicker({ period, onChange }) {
    return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {PERIODS.map(([value, label]) => (
                <button
                    key={value}
                    type="button"
                    className={`period${value === period ? ' period-on' : ''}`}
                    onClick={() => onChange(value)}
                >
                    {label}
                </button>
            ))}
            {/* Ao lado dos botões porque a dúvida é sobre o que 'nos 7 dias
                anteriores' está comparando, e ela nasce aqui. */}
            <span style={{ marginLeft: 4 }}><Explica termo="periodo" /></span>
        </div>
    );
}

// Uma linha, na primeira visita, dispensável. Não é tour guiado: tour aparece
// no único momento em que ainda não há dado na tela, é fechado no automático
// para sair do caminho e nunca volta — justamente quando a dúvida aparece.
const CHAVE_AVISO = 'coddara_aviso_metodo';

function Aviso({ onAjuda }) {
    const [visivel, setVisivel] = useState(() => {
        try {
            return localStorage.getItem(CHAVE_AVISO) !== 'lido';
        } catch {
            // Aba anônima ou dados de site bloqueados: mostra, que é o padrão.
            return true;
        }
    });

    if (!visivel) return null;

    const fechar = () => {
        setVisivel(false);
        try {
            localStorage.setItem(CHAVE_AVISO, 'lido');
        } catch {
            // Sem onde guardar, ele volta na próxima visita. Melhor que quebrar.
        }
    };

    return (
        <div className="aviso">
            <span>
                Estes números não usam cookie e não contam robôs — por isso podem não bater
                com os do Google Analytics.{' '}
                <button type="button" className="aviso-link" onClick={onAjuda}>
                    Entenda como funciona
                </button>
            </span>
            <button type="button" className="aviso-fechar" onClick={fechar} aria-label="Fechar aviso">
                ×
            </button>
        </div>
    );
}

export default function Overview({ data, onAjuda }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            <Aviso onAjuda={onAjuda} />

            <div className="metrics">
                {METRICS.map(([label, key, tipo, verbete], i) => (
                    <Metrica
                        key={key}
                        label={label}
                        verbete={verbete}
                        atual={data.totals[key]}
                        anterior={data.previous?.[key]}
                        taxa={tipo === 'taxa'}
                        periodo={data.period}
                        principal={i === 0}
                    />
                ))}
            </div>

            <section className="bloco">
                <div className="table-head">
                    <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        Pageviews por dia
                        <Explica termo="serie" />
                    </span>
                    <span className="card-title">{RANGE[data.period]}</span>
                </div>
                <div style={{ paddingTop: 22 }}>
                    <Serie pontos={data.series} granularidade={data.granularity} />
                </div>
            </section>

            <div className="grid-2">
                <Table title="Páginas" unit="Views" rows={data.pages} verbete="paginas" />
                <Table title="Origem" unit="Views" rows={data.referrers} verbete="origem" />
            </div>

            <div className="grid-3">
                {/* UTM ao lado de país e cidade, e não perto de dispositivo:
                    as três respondem de onde a pessoa veio. */}
                {data.utm?.length > 0 && <Table title="UTM" unit="Views" rows={data.utm} verbete="utm" />}
                <Table title="País" unit="Views" rows={data.countries ?? []} rotulo={nomeDoPais} verbete="local" />
                <Table title="Cidade" unit="Views" rows={data.locations ?? []} verbete="local" />
            </div>

            <div className="grid-3">
                <Table title="Dispositivo" unit="Views" rows={data.devices} verbete="dispositivo" />
                <Table title="Navegador" unit="Views" rows={data.browsers} verbete="dispositivo" />
                <Table title="Sistema" unit="Views" rows={data.systems ?? []} verbete="dispositivo" />
            </div>

        </div>
    );
}
