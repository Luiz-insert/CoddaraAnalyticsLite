import { useCallback, useEffect, useRef, useState } from 'react';
import Login from './Login.jsx';
import Shell from './Shell.jsx';
import Install from './Install.jsx';
import NovoSite from './NovoSite.jsx';
import Sites from './Sites.jsx';
import Overview, { PeriodPicker } from './Overview.jsx';
import Api from './Api.jsx';
import Desempenho from './Desempenho.jsx';
import ComoFunciona from './ComoFunciona.jsx';
import { listSites, logout, getOverview, getRejections } from './api.js';
import { NavegacaoContext } from './navegacao.js';

export default function App() {
    // null = não sabemos se há sessão; [] = tem sessão e nenhum site ainda.
    // Os dois estados levam a telas diferentes, e distingui-los é o que impede
    // o painel de mandar para o login quem só ainda não cadastrou nada.
    const [sites, setSites] = useState(null);
    // A escolha explícita. Separada do site carregado porque é ela que dispara
    // a recarga — o site em si é o resultado dela.
    const [siteId, setSiteId] = useState(null);
    // Qual site a última carga escolheu, quando ninguém escolheu nada. Em ref e
    // não em estado para não entrar nas dependências do load e provocar uma
    // segunda ida ao servidor a cada montagem.
    const carregado = useRef(null);
    const [site, setSite] = useState(null);
    const [data, setData] = useState(null);
    const [rejections, setRejections] = useState([]);
    const [checking, setChecking] = useState(true);
    const [period, setPeriod] = useState('7d');
    // null = deixa o padrão decidir; clicar na barra lateral fixa a escolha.
    const [view, setView] = useState(null);
    // O cadastro não é mais uma tela: é a última linha da lista de sites. Isto
    // aqui é só o recado de 'abra aquela linha' para quem pediu pelo seletor.
    const [novo, setNovo] = useState(false);
    // Qual verbete abrir na página de ajuda, quando se chega nela por um balão.
    const [alvoAjuda, setAlvoAjuda] = useState(null);
    const timer = useRef(null);

    // Carrega sessão e dados numa tacada. Se /sites negar, não há sessão.
    const load = useCallback(async () => {
        const lista = await listSites();

        // A escolha manda; sem escolha, vale o que já estava carregado; e só
        // então o primeiro da lista. Sem o passo do meio, renomear o site atual
        // podia trocar de site sozinho: a lista vem ordenada por nome, e o
        // primeiro lugar muda junto com o nome.
        const alvo = siteId ?? carregado.current;
        const escolhido = lista.find((s) => String(s.id) === String(alvo)) ?? lista[0] ?? null;

        if (!escolhido) {
            setSites(lista);
            setSite(null);
            setData(null);
            return;
        }

        const [resumo, recusados] = await Promise.all([
            getOverview(escolhido.id, period),
            // Rejeição não pode derrubar a tela: se falhar, o painel abre sem
            // o diagnóstico, que é acessório.
            getRejections(escolhido.id).catch(() => []),
        ]);

        // Todos juntos, DEPOIS das consultas. Com setSite antes do await, o
        // await quebrava o agrupamento do React e havia um render com site
        // definido e data ainda nulo — o Overview estourava ao ler data.totals.
        // No carregamento isso não aparecia porque o `checking` segura o render;
        // depois do login não há essa proteção.
        carregado.current = escolhido.id;
        setSites(lista);
        setSite(escolhido);
        setData(resumo);
        setRejections(recusados);
    }, [period, siteId]);

    useEffect(() => {
        // oxlint-disable-next-line react/set-state-in-effect
        load().catch(() => {}).finally(() => setChecking(false));
    }, [load]);

    // A tela de instalação promete trocar sozinha quando o primeiro evento
    // chegar. Isto é o que cumpre a promessa.
    const vazio = data?.totals.pageviews === 0;
    useEffect(() => {
        if (!vazio) return undefined;
        timer.current = setInterval(() => { load().catch(() => {}); }, 5000);
        return () => clearInterval(timer.current);
    }, [vazio, load]);

    async function handleLogout() {
        await logout().catch(() => {});
        carregado.current = null;
        setSites(null);
        setSite(null);
        setData(null);
    }

    // Trocar de site volta a navegação ao padrão: site recém-criado abre na
    // instalação, site com dado abre na visão geral. Manter a tela anterior
    // mostraria 'Desempenho' vazio de um site que ainda nem tem a tag.
    function trocarSite(id) {
        setSiteId(id);
        setView(null);
    }

    function siteCriado(criado) {
        setNovo(false);
        setSiteId(criado.id);
        // Sem tela fixada: o site nasce vazio, então cai na instalação, que é o
        // que falta fazer.
        setView(null);
    }

    if (checking) return null;
    if (!sites) return <Login onDone={load} />;

    // Tem sessão, não tem site: o cadastro é a tela inteira. Não há painel para
    // envolvê-lo, e nada mais para fazer aqui antes disso.
    if (sites.length === 0) return <NovoSite primeiro onCreated={siteCriado} />;

    // !data além de !site: os dois andam juntos, e depender de um só foi
    // exatamente o que deixou passar o render intermediário.
    if (!site || !data) return null;

    // Sem dado, a instalação é o que interessa. Com dado, o painel — mas a
    // instalação continua alcançável pela barra lateral: depois de instalado
    // ainda se volta lá para copiar o snippet de outra página ou ver o token.
    const atual = view ?? (vazio ? 'install' : 'overview');

    const irParaAjuda = (termo) => {
        setAlvoAjuda(termo);
        setView('ajuda');
    };

    const comum = {
        site,
        sites,
        view: atual,
        onLogout: handleLogout,
        // Clicar na barra lateral limpa o alvo: quem entrou pelo menu quer a
        // página inteira, não um verbete destacado do meio dela.
        onNavigate: (destino) => { setAlvoAjuda(null); setView(destino); },
        onSelectSite: trocarSite,
        onNewSite: () => { setNovo(true); setView('sites'); },
    };

    // Uma tela por vez, todas envolvidas pelo mesmo provedor — é ele que deixa
    // o balão da explicação, lá no fundo da árvore, pedir a página de ajuda.
    const telas = {
        perf: () => (
            <Shell {...comum} title="Desempenho" aside={<PeriodPicker period={period} onChange={setPeriod} />}>
                <Desempenho data={data} />
            </Shell>
        ),
        ajuda: () => (
            <Shell {...comum} title="Como funciona">
                <ComoFunciona alvo={alvoAjuda} />
            </Shell>
        ),
        api: () => (
            <Shell {...comum} title="API">
                <Api />
            </Shell>
        ),
        sites: () => (
            <Shell {...comum} title="Sites">
                <Sites
                    sites={sites}
                    site={site}
                    onSelect={trocarSite}
                    onChanged={load}
                    onCriado={siteCriado}
                    novo={novo}
                    onNovo={setNovo}
                />
            </Shell>
        ),
        install: () => (
            <Shell {...comum} title="Instalação">
                <Install site={site} rejections={rejections} />
            </Shell>
        ),
        overview: () => (
            <Shell {...comum} title="Visão geral" aside={<PeriodPicker period={period} onChange={setPeriod} />}>
                <Overview data={data} onAjuda={() => irParaAjuda(null)} />
            </Shell>
        ),
    };

    return (
        <NavegacaoContext.Provider value={irParaAjuda}>
            {(telas[atual] ?? telas.overview)()}
        </NavegacaoContext.Provider>
    );
}
