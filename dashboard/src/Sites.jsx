import { useState } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography } from '@mui/material';
import { CheckBadgeIcon, ClockIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Texto } from './Explica.jsx';
import { createSite, renameSite, removeSite, reactivateSite } from './api.js';

const data = (iso) => new Date(iso).toLocaleDateString('pt-BR');

// Verificação em uma linha, do jeito que a pessoa pergunta: "esse está no ar?".
// Sem verificar não é erro — é o estado de todo site recém-criado, e o que falta
// não é uma correção, é o primeiro acesso acontecer.
function Verificacao({ site }) {
    if (site.verified_at) {
        return (
            <span className="site-estado">
                <CheckBadgeIcon width={15} height={15} aria-hidden="true" />
                Verificado em {data(site.verified_at)}
                {site.verified_by === 'snippet' ? ' pelo snippet' : ' por DNS'}
            </span>
        );
    }
    return (
        <span className="site-estado site-estado-fraco">
            <ClockIcon width={15} height={15} aria-hidden="true" />
            Aguardando o primeiro acesso
        </span>
    );
}

function Linha({ site, atual, onSelect, onChanged }) {
    const [editando, setEditando] = useState(false);
    const [nome, setNome] = useState(site.name);
    const [perguntando, setPerguntando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState(null);

    async function aplicar(acao) {
        setEnviando(true);
        setErro(null);
        try {
            await acao();
            setEditando(false);
            setPerguntando(false);
            await onChanged();
        } catch (err) {
            setErro(err.message);
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="site-row">
            <div style={{ minWidth: 0 }}>
                {editando ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                            className="campo"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            autoFocus
                            style={{ maxWidth: 280, flex: 1 }}
                            // Enter salva: o campo tem um valor só, e obrigar o
                            // clique no botão seria cerimônia.
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') aplicar(() => renameSite(site.id, nome.trim()));
                                if (e.key === 'Escape') { setNome(site.name); setEditando(false); }
                            }}
                        />
                        <Button
                            variant="contained"
                            disabled={enviando}
                            onClick={() => aplicar(() => renameSite(site.id, nome.trim()))}
                        >
                            Salvar
                        </Button>
                        <Button
                            variant="outlined"
                            disabled={enviando}
                            onClick={() => { setNome(site.name); setEditando(false); setErro(null); }}
                        >
                            Cancelar
                        </Button>
                    </div>
                ) : (
                    <div className="site-row-nome">
                        {site.name}
                        {atual && <span className="site-tag">atual</span>}
                        {!site.active && <span className="site-tag">inativo</span>}
                    </div>
                )}

                <div className="mono-muted" style={{ marginTop: 6 }}>{site.domain}</div>
                <div style={{ marginTop: 8 }}><Verificacao site={site} /></div>
                {erro && <div className="prose" style={{ color: 'var(--erro)', marginTop: 8 }}>{erro}</div>}
            </div>

            <div className="site-row-acoes">
                {!atual && site.active && (
                    <button type="button" className="link-btn" onClick={() => onSelect(site.id)}>
                        Ver dados
                    </button>
                )}
                {!editando && (
                    <button type="button" className="link-btn" onClick={() => setEditando(true)}>
                        Renomear
                    </button>
                )}
                {site.active ? (
                    <button type="button" className="link-btn" onClick={() => setPerguntando(true)}>
                        Remover
                    </button>
                ) : (
                    <button
                        type="button"
                        className="link-btn"
                        disabled={enviando}
                        onClick={() => aplicar(() => reactivateSite(site.id))}
                    >
                        Reativar
                    </button>
                )}
            </div>

            {/* Uma confirmação, não duas: o que está em jogo é reversível, e
                pedir para digitar o domínio aqui seria cerimônia sem risco. */}
            <Dialog open={perguntando} onClose={() => setPerguntando(false)}>
                <DialogTitle sx={{ fontSize: 22, fontWeight: 300, pt: 3 }}>
                    Remover {site.name}?
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" color="text.secondary">
                        O rastreamento de <code>{site.domain}</code> para na hora. Os dados já
                        coletados ficam guardados e o site volta a contar se você reativar —
                        com o mesmo token, sem mexer na tag que está no ar.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button variant="outlined" onClick={() => setPerguntando(false)} disabled={enviando}>
                        Cancelar
                    </Button>
                    <Button variant="contained" disabled={enviando} onClick={() => aplicar(() => removeSite(site.id))}>
                        {enviando ? 'Removendo...' : 'Remover'}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

// O cadastro mora no fim da própria lista, e não numa tela à parte: criar um
// site é o que se faz DEPOIS de olhar os que já existem — e a lista é onde se
// percebe que falta um.
function LinhaNova({ aberto, onAbrir, onCriado }) {
    const [name, setName] = useState('');
    const [domain, setDomain] = useState('');
    const [erro, setErro] = useState(null);
    const [enviando, setEnviando] = useState(false);

    async function criar(evento) {
        evento.preventDefault();
        setErro(null);
        setEnviando(true);
        try {
            await onCriado(await createSite(name, domain));
        } catch (err) {
            setErro(err.message);
        } finally {
            setEnviando(false);
        }
    }

    if (!aberto) {
        return (
            <button type="button" className="site-novo" onClick={() => onAbrir(true)}>
                <PlusIcon width={15} height={15} aria-hidden="true" />
                Novo site
            </button>
        );
    }

    return (
        <form className="site-row site-row-nova" onSubmit={criar}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
                <div style={{ flex: '1 1 170px' }}>
                    <label className="rotulo" htmlFor="novo-nome">Nome</label>
                    <input
                        id="novo-nome"
                        className="campo"
                        required
                        autoFocus
                        placeholder="Clínica Sorriso"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div style={{ flex: '1 1 230px' }}>
                    <label className="rotulo" htmlFor="novo-dominio">Endereço</label>
                    <input
                        id="novo-dominio"
                        className={`campo${erro ? ' campo-erro' : ''}`}
                        required
                        placeholder="clinicasorriso.com.br"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                    />
                    {/* O servidor recorta protocolo, www, porta e caminho —
                        colar o endereço inteiro da barra do navegador funciona. */}
                    <p className={`ajuda${erro ? ' ajuda-erro' : ''}`}>
                        {erro ?? 'Só o domínio. Pode colar o endereço inteiro.'}
                    </p>
                </div>
            </div>

            {/* Alinhado com os campos, não com os rótulos acima deles. */}
            <div className="site-row-acoes" style={{ marginTop: 24 }}>
                <Button type="submit" variant="contained" disabled={enviando}>
                    {enviando ? 'Criando...' : 'Criar'}
                </Button>
                {/* Botão e não link: ao lado de 'Criar' e na mesma linha da
                    edição logo acima, que também usa dois botões. */}
                <Button
                    type="button"
                    variant="outlined"
                    disabled={enviando}
                    onClick={() => { onAbrir(false); setErro(null); }}
                >
                    Cancelar
                </Button>
            </div>
        </form>
    );
}

export default function Sites({ sites, site, onSelect, onChanged, onCriado, novo, onNovo }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <section className="card" style={{ padding: '22px 24px' }}>
                <div className="table-head">
                    <span className="card-title">Seus sites</span>
                    <span className="card-title">{sites.length}</span>
                </div>

                {sites.map((s) => (
                    <Linha
                        key={s.id}
                        site={s}
                        atual={String(s.id) === String(site.id)}
                        onSelect={onSelect}
                        onChanged={onChanged}
                    />
                ))}

                <LinhaNova aberto={novo} onAbrir={onNovo} onCriado={onCriado} />
            </section>

            {/* O texto vem do mesmo lugar que a página 'Como funciona' usa.
                Escrito aqui de novo, seriam duas explicações para divergirem. */}
            <section className="card" style={{ padding: '22px 24px' }}>
                <span className="card-title">Sobre a verificação</span>
                <Texto termo="verificacao" />
            </section>

        </div>
    );
}
