import { useEffect, useRef, useState } from 'react';
import { Bars3Icon, ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import BrandMark from './BrandMark.jsx';
import { useColorMode } from './colorMode.js';

const SECTIONS = [
    { label: 'Relatórios', items: [['overview', 'Visão geral'], ['perf', 'Desempenho']] },
    { label: 'Configuração', items: [['sites', 'Sites'], ['install', 'Instalação'], ['api', 'API']] },
    { label: 'Ajuda', items: [['ajuda', 'Como funciona']] },
];

// Layout das telas autenticadas. A navegação é estado em memória, não rota de
// URL. Com três telas isso basta; router passa a valer quando o endereço
// precisar ser compartilhável ou sobreviver ao refresh.
export default function Shell({ site, sites = [], view, title, aside, children, onLogout, onNavigate, onSelectSite, onNewSite }) {
    const { mode, alternar } = useColorMode();
    const [menu, setMenu] = useState(false);

    // Navegar fecha a gaveta: no celular ela cobre a tela, e deixar aberta
    // esconderia justamente o que a pessoa acabou de pedir.
    const navegar = (destino) => {
        setMenu(false);
        onNavigate(destino);
    };

    return (
        <div className="shell">
            {menu && <div className="backdrop" onClick={() => setMenu(false)} />}

            <nav className={`sidebar${menu ? ' sidebar-open' : ''}`}>
                <div className="sidebar-head">
                    <span className="brand-mark"><BrandMark /></span>
                    <span className="brand-name">Coddara Analytics</span>
                </div>

                <hr className="sidebar-hr" />

                <SeletorDeSite
                    site={site}
                    sites={sites}
                    onSelect={(id) => { setMenu(false); onSelectSite(id); }}
                    onNew={() => { setMenu(false); onNewSite(); }}
                />

                <div className="sidebar-nav">
                    {SECTIONS.map((section) => (
                        <div key={section.label}>
                            <div className="nav-label">{section.label}</div>
                            {section.items.map(([key, rotulo]) => (
                                <button
                                    key={key}
                                    type="button"
                                    className={`nav-item${key === view ? ' nav-item-on' : ''}`}
                                    onClick={() => navegar(key)}
                                >
                                    {rotulo}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Empilhados, não lado a lado: a barra tem 188px úteis, e um
                    'Tema escuro' ao lado de 'Sair' já ocupava quase tudo. */}
                <div className="sidebar-foot">
                    <button type="button" className="link-btn" onClick={alternar}>
                        {mode === 'dark' ? 'Tema claro' : 'Tema escuro'}
                    </button>
                    <button type="button" className="link-btn" onClick={onLogout}>Sair</button>
                </div>
            </nav>

            <div className="main">
                {/* O domínio vem acima do título, em versalete: é o rótulo do
                    que está sendo lido, não um detalhe ao lado. */}
                <header className="topbar">
                    <button
                        type="button"
                        className="menu-btn"
                        onClick={() => setMenu(true)}
                        aria-label="Abrir menu"
                    >
                        <Bars3Icon width={18} height={18} aria-hidden="true" />
                    </button>

                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="mono-muted" style={{ marginBottom: 8 }}>{site.domain}</div>
                        <h1 style={{ fontSize: 34, fontWeight: 300, letterSpacing: '-0.8px', lineHeight: 1 }}>{title}</h1>
                    </div>
                    {aside && <div className="topbar-aside">{aside}</div>}
                </header>

                <div className="content">{children}</div>
            </div>
        </div>
    );
}

// Logo abaixo da marca, antes da navegação: é o escopo de tudo que vem depois.
// O menu marca o que foge do esperado — site sem verificar ou desligado.
// Verificado não ganha selo: é o estado normal, e marcar o normal deixa a lista
// ruidosa sem dizer nada.
//
// Marcação própria, e não o Menu do MUI: ele monta um Paper com regras de cor
// próprias, que só acompanham o tema por meio do theme.js. Aqui as cores saem
// direto das variáveis do CSS, as mesmas do resto da barra.
function SeletorDeSite({ site, sites, onSelect, onNew }) {
    const [aberto, setAberto] = useState(false);
    const caixa = useRef(null);
    const botao = useRef(null);

    useEffect(() => {
        if (!aberto) return undefined;

        // mousedown e não click: fechar no click faria o menu sumir antes do
        // botão de baixo receber o próprio clique.
        const fora = (evento) => {
            if (!caixa.current?.contains(evento.target)) setAberto(false);
        };
        const tecla = (evento) => {
            if (evento.key !== 'Escape') return;
            setAberto(false);
            // O foco volta para o botão: sem isso ele fica no nada e a próxima
            // tecla não tem onde agir.
            botao.current?.focus();
        };

        document.addEventListener('mousedown', fora);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('mousedown', fora);
            document.removeEventListener('keydown', tecla);
        };
    }, [aberto]);

    const escolher = (id) => {
        setAberto(false);
        onSelect(id);
    };

    return (
        <div className="seletor" ref={caixa}>
            <button
                type="button"
                ref={botao}
                className="site-chip"
                onClick={() => setAberto((a) => !a)}
                aria-haspopup="menu"
                aria-expanded={aberto}
            >
                {/* Só o nome: o domínio do site escolhido já abre a página, em
                    versalete acima do título. */}
                <span className="site-chip-nome uma-linha" title={`${site.name} — ${site.domain}`}>
                    {site.name}
                </span>
                <ChevronDownIcon
                    width={14}
                    height={14}
                    aria-hidden="true"
                    style={{ flexShrink: 0, transform: aberto ? 'rotate(180deg)' : 'none' }}
                />
            </button>

            {aberto && (
                <div className="site-menu" role="menu">
                    {sites.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            role="menuitem"
                            className={`site-opcao${String(s.id) === String(site.id) ? ' site-opcao-on' : ''}`}
                            onClick={() => escolher(s.id)}
                            title={`${s.name} — ${s.domain}`}
                        >
                            {/* A etiqueta vai embaixo, não ao lado: ao lado ela
                                roubava a largura do nome e sobrava 'Odo…'. */}
                            <span className="uma-linha">{s.name}</span>
                            {(!s.active || !s.verified_at) && (
                                <span className="site-tag">{s.active ? 'não verificado' : 'inativo'}</span>
                            )}
                        </button>
                    ))}

                    <button
                        type="button"
                        role="menuitem"
                        className="site-opcao site-opcao-acao"
                        onClick={() => { setAberto(false); onNew(); }}
                    >
                        <PlusIcon width={15} height={15} aria-hidden="true" />
                        Novo site
                    </button>
                </div>
            )}
        </div>
    );
}
