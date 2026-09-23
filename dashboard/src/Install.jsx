import { useState } from 'react';
import BrandMark from './BrandMark.jsx';
import Explica from './Explica.jsx';

// Absoluta, e não relativa: este endereço é copiado para dentro do HTML do
// site do cliente, que roda em outro domínio. Sai da origem da própria página,
// então acompanha o domínio onde o painel estiver publicado.
const API = import.meta.env.VITE_API_URL?.replace(/\/api$/, '')
    ?? (import.meta.env.DEV ? 'http://localhost:3002' : globalThis.location.origin);

export default function Install({ site, rejections = [] }) {
    const [copied, setCopied] = useState(false);

    // Renderizado com o token dentro, não com um marcador para substituir:
    // "copie e troque SEU_TOKEN aqui" é onde a instalação falha.
    const snippet = `<script defer src="${API}/t.js" data-token="${site.token}"></script>`;

    async function copy() {
        try {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Sem permissão de área de transferência o texto continua
            // selecionável na tela — não vale quebrar nada por isso.
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="card-head">
                    <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        1 · Cole antes do &lt;/head&gt;
                        <Explica termo="token" />
                    </span>
                    <button type="button" className="btn-ghost" onClick={copy}>
                        {copied ? 'Copiado' : 'Copiar'}
                    </button>
                </div>

                <code className="snippet">{snippet}</code>

                <p className="prose">
                    Uma linha, em todas as páginas. O script é servido pelo nosso domínio e
                    se atualiza sozinho — você não precisa mexer no site de novo.
                </p>
            </section>

            {rejections.length > 0 && <Diagnostico site={site} rejections={rejections} />}

            <section className="card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    2 · Abra o site
                    <Explica termo="verificacao" />
                </span>

                {site.verified_at ? (
                    <>
                        <p className="prose" style={{ color: 'var(--ink)' }}>
                            Instalado e recebendo. O primeiro evento chegou de um endereço que
                            confere com <code>{site.domain}</code> — é isso que verifica o site.
                        </p>
                        <div className="waiting">
                            <span className="mono-muted">
                                Verificado em {new Date(site.verified_at).toLocaleDateString('pt-BR')}
                            </span>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="prose" style={{ color: 'var(--ink)' }}>
                            Esta tela troca sozinha assim que o primeiro acesso chegar. Pode deixar aberta.
                        </p>
                        <div className="waiting">
                            <span className="spin"><BrandMark size={14} /></span>
                            <span className="mono-muted">Aguardando primeiro evento</span>
                        </div>
                    </>
                )}
            </section>

        </div>
    );
}

// A maioria das ferramentas mostra silêncio quando a origem não bate, e quem
// instalou não tem como descobrir por quê. Como o ingest já registra o motivo
// da recusa, dá para transformar o erro mais comum em autoatendimento.
function Diagnostico({ site, rejections }) {
    const pior = rejections[0];
    const total = rejections.reduce((soma, r) => soma + r.events, 0);
    const semOrigem = pior.origin === '(sem origem)';

    return (
        <section className="card card-alert" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="card-title">Diagnóstico</span>

            {semOrigem ? (
                <p className="prose" style={{ color: 'var(--ink)' }}>
                    Chegaram <strong>{total}</strong> eventos sem identificação de origem. Isso não
                    acontece com navegador — costuma ser script rodando fora de uma página.
                </p>
            ) : (
                <p className="prose" style={{ color: 'var(--ink)' }}>
                    Recebemos <strong>{total}</strong> eventos de <code>{pior.origin}</code>, mas o
                    domínio registrado aqui é <code>{site.domain}</code>.
                </p>
            )}

            <p className="prose">
                Eles foram recusados — é assim que o token de um cliente não coleta dado de outro
                site. Se o endereço acima é o seu, corrija o domínio do site nas configurações.
            </p>
        </section>
    );
}
