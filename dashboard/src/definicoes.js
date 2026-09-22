// O que cada número significa, de onde ele sai e o que ele NÃO diz.
//
// Fonte única: daqui saem tanto o botão de ajuda ao lado de cada card quanto a
// página "Como funciona". Explicação escrita duas vezes vira duas explicações
// diferentes em três meses — e a errada é sempre a que o cliente leu.
//
// O campo 'cuidado' é o que mais importa. Nossos números divergem do Google
// Analytics de propósito: visitante sem cookie, sessão de 30 minutos, robô
// descartado, rejeição por página única. O cliente vai comparar e ver número
// diferente; sem esse campo ele conclui que o nosso está errado.
export const DEFINICOES = {
    pageviews: {
        titulo: 'Pageviews',
        oque: 'Quantas vezes uma página foi carregada, somando todas as páginas do site.',
        como: 'Conta uma vez a cada carregamento, e também quando o endereço muda sem recarregar, como acontece em site feito em React ou Vue.',
        cuidado: 'Uma pessoa que abre a mesma página cinco vezes conta cinco pageviews. Para contar pessoas, veja Visitantes.',
    },

    visitantes: {
        titulo: 'Visitantes',
        oque: 'Quantas pessoas diferentes acessaram o site no período.',
        como: 'Sem cookie: cada visita recebe um código calculado a partir do endereço de rede, do navegador e do dia. O endereço de rede é usado para o cálculo e descartado em seguida — nunca é gravado.',
        cuidado: 'O código muda à meia-noite. A mesma pessoa voltando amanhã conta como um segundo visitante, e no celular e no computador conta como dois. É o preço de não usar cookie, e o que dispensa o aviso de cookies no site.',
    },

    sessoes: {
        titulo: 'Sessões',
        oque: 'Quantas visitas aconteceram — uma visita é a pessoa entrando, vendo o que vê e indo embora.',
        como: 'Pageviews do mesmo visitante com menos de 30 minutos entre um e outro formam a mesma sessão. Passou de 30 minutos parado, a próxima página abre uma sessão nova.',
        cuidado: 'Sessão é calculada na hora da consulta, não gravada. Se um dia a janela de 30 minutos mudar, o histórico inteiro é recalculado com a regra nova.',
    },

    rejeicao: {
        titulo: 'Taxa de rejeição',
        oque: 'De cada cem visitas, quantas viram uma página só e foram embora.',
        como: 'É a fração das sessões com exatamente um pageview.',
        cuidado: 'Não mede desinteresse. Quem chegou pelo Google, leu o preço, salvou o telefone e saiu satisfeito conta como rejeição. Numa página única de vendas, rejeição alta é o normal — o que importa ali é a rolagem, não a segunda página.',
    },

    periodo: {
        titulo: 'Período e comparação',
        oque: 'A janela de tempo de tudo que está nesta tela, e contra o que ela é comparada.',
        como: 'A janela começa à meia-noite do primeiro dia e termina agora. A comparação é a mesma janela deslocada para trás: em "Hoje" é ontem até esta mesma hora; em "7 dias", os 7 dias anteriores.',
        cuidado: 'Comparar contra o dia inteiro de ontem mostraria queda toda manhã, porque hoje ainda não acabou. Por isso a comparação para na mesma hora.',
    },

    serie: {
        titulo: 'Pageviews por dia',
        oque: 'A mesma contagem de pageviews distribuída no tempo.',
        como: 'Cada ponto é um dia no fuso de São Paulo. No período "Hoje" cada ponto vira uma hora. O último ponto vai só até agora, nunca até o fim do dia.',
        cuidado: 'Dia sem visita aparece como zero, e não sumindo do gráfico — semana parada com dois dias vazios viraria uma subida contínua se os dias fossem omitidos.',
    },

    paginas: {
        titulo: 'Páginas',
        oque: 'Quais endereços do site foram vistos.',
        como: 'Só o caminho, sem o domínio e sem o que vem depois da interrogação. A barra final é ignorada, então /promo e /promo/ são a mesma página.',
        cuidado: 'Parâmetros de campanha não criam páginas separadas: eles aparecem na tabela UTM.',
    },

    origem: {
        titulo: 'Origem',
        oque: 'De qual site a pessoa veio quando clicou no link.',
        como: 'O navegador informa o endereço anterior e guardamos só o domínio, sem o www. Link de uma página do site para outra não conta como origem.',
        cuidado: '"Direto" não quer dizer que a pessoa digitou o endereço. É tudo que chega sem essa informação: favorito, aplicativo de mensagem, PDF, e-mail.',
    },

    utm: {
        titulo: 'UTM',
        oque: 'As marcações de campanha que você colocou no link do anúncio.',
        como: 'Lidos da própria URL, exatamente como estão escritos lá e no painel do anúncio.',
        cuidado: 'Só aparece acesso que trouxe marcação. Se a tabela está vazia, os links da campanha estão sem UTM — e não há como separar o tráfego pago do orgânico depois.',
    },

    local: {
        titulo: 'País e cidade',
        oque: 'De onde as visitas partiram.',
        como: 'O endereço de rede é convertido em localidade no momento em que o evento chega, por uma base que roda no nosso servidor, e é descartado em seguida.',
        cuidado: 'A precisão é da operadora, não da pessoa: celular costuma aparecer na cidade da antena ou na sede da operadora. Quem usa VPN aparece onde a VPN está.',
    },

    dispositivo: {
        titulo: 'Dispositivo, navegador e sistema',
        oque: 'Em que a pessoa estava quando acessou.',
        como: 'Lido do cabeçalho que o navegador envia em toda requisição.',
        cuidado: 'Os navegadores vêm reduzindo essa informação de propósito, por privacidade. Versão exata e modelo de aparelho são cada vez menos confiáveis; a divisão entre celular e computador continua sólida.',
    },

    vitals: {
        titulo: 'Core Web Vitals',
        oque: 'As três medidas que o Google usa para decidir se a experiência do site é boa — e que entram no ranqueamento da busca.',
        como: 'Medidas no navegador de quem visitou, e não num teste de laboratório. Mostramos o p75: o valor que 75% das visitas alcançaram ou superaram, que é o mesmo critério do Google.',
        cuidado: 'Média esconderia a cauda, e é justamente a cauda que faz o cliente dizer que "às vezes o site trava". Os números só ficam definitivos quando a pessoa sai da página.',
    },

    cascata: {
        titulo: 'Onde o tempo vai',
        oque: 'Quanto tempo cada etapa levou até o HTML chegar ao navegador.',
        como: 'p75 de cada fase, só de quem chegou pela primeira vez — recarga e botão voltar pegam cache quente.',
        cuidado: 'Mede a entrega do HTML, não a página pronta. O que vem depois — imagem, fonte, script — aparece nos marcos e nos Core Web Vitals.',
    },

    marcos: {
        titulo: 'Marcos',
        oque: 'DOM pronto e Página carregada, contados desde o instante em que a navegação começou.',
        como: 'São acumulados, não somados: "Página carregada" já inclui tudo que veio antes dele.',
        cuidado: 'Não confunda com as etapas acima, que são durações e se somam. E nenhum dos dois é a percepção de quem visita — isso são os Core Web Vitals, que medem quando o conteúdo aparece, não quando o navegador terminou o trabalho.',
    },

    token: {
        titulo: 'Token do site',
        oque: 'O identificador que vai na tag do seu site e diz de quem é cada evento.',
        como: 'Ele é público: quem abrir o código-fonte da sua página consegue lê-lo, e isso não é um problema.',
        cuidado: 'O token identifica, não autoriza. Copiado para outro domínio, os eventos são recusados na chegada, porque conferimos o endereço de onde vieram. E ele não dá acesso nenhum ao painel — quem entra aqui é o seu login.',
    },

    robos: {
        titulo: 'Robôs',
        oque: 'Buscadores, monitores e prévias de link não entram em nenhum número desta tela.',
        como: 'São reconhecidos pelo que o programa se identifica ao enviar o evento e descartados na chegada, antes de gravar.',
        cuidado: 'Sem esse filtro o Googlebot entraria como visita de computador e puxaria a rejeição para cima, porque robô vê uma página e sai. É a diferença entre medir gente e medir tráfego.',
    },

    verificacao: {
        titulo: 'Verificação do site',
        oque: 'A confirmação de que o domínio cadastrado é mesmo seu.',
        como: 'Acontece sozinha quando o primeiro evento chega de um endereço que confere com o domínio — o que só é possível se alguém com acesso de escrita colocou a tag lá.',
        cuidado: 'Não é o que protege seus dados, que já vêm separados por token. É o que prova a posse do domínio, e o domínio não muda depois de criado: ele é a chave contra a qual cada evento é conferido.',
    },
};

// A ordem da página "Como funciona". Segue a ordem em que a pessoa encontra os
// números no painel, não a ordem alfabética.
export const GRUPOS = [
    { titulo: 'Os quatro números do topo', chaves: ['pageviews', 'visitantes', 'sessoes', 'rejeicao', 'periodo'] },
    { titulo: 'De onde vem quem entra', chaves: ['serie', 'paginas', 'origem', 'utm', 'local', 'dispositivo'] },
    { titulo: 'Desempenho', chaves: ['vitals', 'cascata', 'marcos'] },
    { titulo: 'Como medimos', chaves: ['robos', 'token', 'verificacao'] },
];
