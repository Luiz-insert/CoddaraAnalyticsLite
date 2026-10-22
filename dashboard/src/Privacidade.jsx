import { Moldura } from './Login.jsx';

// Política de privacidade. Descreve o que o código FAZ — cada afirmação aqui
// tem um lugar no servidor ou no beacon que a sustenta. Mudou a coleta, a
// retenção ou um fornecedor? Esta página muda no mesmo commit.
//
// O que não sai do código — quem é a empresa, como falar com ela, onde o
// provedor guarda os dados — fica neste bloco, num lugar só.
const FATOS = {
    atualizada: '22 de outubro de 2026',
    // Pessoa física: sem CNPJ, e o CPF não vai numa página pública.
    controlador: 'Luiz Gusttavo Teixeira Braga',
    contato: 'lgusttavo29@gmail.com',
    regiaoHospedagem: 'Estados Unidos',
    retencaoLogs: 'até 30 dias',
    // null enquanto não houver backup configurado no banco; com backup, o prazo
    // dele entra aqui e a linha aparece na seção de retenção.
    retencaoBackups: null,
};

function Secao({ titulo, children }) {
    return (
        <section className="verbete politica">
            <h3 className="verbete-titulo">{titulo}</h3>
            {children}
        </section>
    );
}

export function TextoPolitica() {
    return (
        <div className="card" style={{ padding: '22px 24px' }}>
            <span className="card-title">Atualizada em {FATOS.atualizada}</span>

            <Secao titulo="A quem esta política se aplica">
                <p className="prose">
                    O Coddara Analytics é uma ferramenta de estatísticas de visita para sites. Ela
                    trata dados de dois grupos de pessoas, em papéis diferentes:
                </p>
                <ul className="prose">
                    <li>
                        <strong>Quem tem conta no painel.</strong> Para esses dados, o controlador é{' '}
                        {FATOS.controlador}, responsável pelo Coddara Analytics.
                    </li>
                    <li>
                        <strong>Quem visita um site que instalou o Coddara Analytics.</strong> Aqui o
                        controlador é o dono daquele site, que decide usar a ferramenta. O Coddara
                        Analytics atua como operador: trata os dados em nome dele e só para gerar as
                        estatísticas que ele vê no painel.
                    </li>
                </ul>
            </Secao>

            <Secao titulo="Visitantes dos sites: o que é coletado">
                <p className="prose">
                    Quando uma página com a tag do Coddara Analytics é aberta, o navegador envia ao
                    nosso servidor os dados abaixo. É isto que fica gravado:
                </p>
                <ul className="prose">
                    <li>a página visitada (só o caminho, como <code>/contato</code>);</li>
                    <li>os parâmetros de campanha <code>utm_source</code>, <code>utm_medium</code> e <code>utm_campaign</code>, quando existem;</li>
                    <li>o domínio do site de onde a pessoa veio, sem o endereço completo;</li>
                    <li>tamanho da tela e da janela do navegador, e o idioma do navegador;</li>
                    <li>tipo de dispositivo, navegador e sistema operacional, deduzidos do user agent;</li>
                    <li>país, estado e cidade aproximados, deduzidos do endereço IP;</li>
                    <li>medidas de desempenho da página (Core Web Vitals e tempos de carregamento);</li>
                    <li>data e hora da visita;</li>
                    <li>um identificador diário do visitante, descrito abaixo.</li>
                </ul>
                <p className="prose">
                    O navegador também envia o endereço completo e o título da página. O servidor
                    guarda só o caminho e os parâmetros de campanha e descarta o resto, o que
                    inclui qualquer outro parâmetro do endereço.
                </p>
            </Secao>

            <Secao titulo="Visitantes dos sites: o que não é coletado">
                <ul className="prose">
                    <li>Nenhum cookie e nenhum dado guardado no navegador do visitante.</li>
                    <li>
                        O endereço IP não é gravado. Ele é usado no momento em que a visita chega,
                        para calcular a localização aproximada numa base de dados mantida no
                        próprio servidor, sem consulta a serviço externo, e para o identificador
                        diário. Depois disso, é descartado.
                    </li>
                    <li>O user agent completo não é gravado, só o tipo de dispositivo, o navegador e o sistema deduzidos dele.</li>
                    <li>Nada do que a pessoa digita: nem formulários, nem cliques, nem texto da página.</li>
                    <li>Nenhum cruzamento entre sites diferentes nem entre dias diferentes.</li>
                </ul>
                <p className="prose">
                    <strong>Identificador diário.</strong> Para contar visitantes únicos sem cookie,
                    o servidor calcula um código a partir do IP, do user agent, do site, da data e
                    de um valor secreto, e grava só o resultado, que não pode ser revertido. O
                    código muda à meia-noite (horário de Brasília) e é diferente em cada site.
                    Por isso, a mesma pessoa vira outro código no dia seguinte ou em outro site, e
                    o código sozinho não permite saber quem ela é.
                </p>
                <p className="prose">
                    Acessos de robôs e ferramentas automáticas são descartados antes de serem
                    gravados. O user agent deles pode aparecer nos registros técnicos do servidor.
                </p>
            </Secao>

            <Secao titulo="Visitantes dos sites: finalidade e direitos">
                <p className="prose">
                    Os dados servem só para mostrar ao dono do site estatísticas agregadas: quantas
                    visitas, de onde vêm, que páginas são vistas e como o site se comporta. Não são
                    usados para publicidade, não são vendidos e não formam perfil de ninguém. A
                    base legal é definida pelo dono do site, como controlador.
                </p>
                <p className="prose">
                    Como não guardamos IP nem nenhum identificador que dure mais de um dia, não
                    conseguimos localizar os registros de uma pessoa específica. Pedidos sobre
                    esses dados devem ir ao dono do site visitado, que pode, a qualquer momento,
                    excluir o site e todos os dados coletados nele.
                </p>
            </Secao>

            <Secao titulo="Contas do painel: o que é coletado e por quê">
                <ul className="prose">
                    <li><strong>E-mail</strong>, para entrar e para receber os e-mails da conta;</li>
                    <li><strong>senha</strong>, guardada só como hash bcrypt, que não permite recuperar a senha original;</li>
                    <li><strong>sites cadastrados</strong>: nome, domínio, token da tag e quem tem acesso a cada um;</li>
                    <li>
                        <strong>links enviados por e-mail</strong> (criar conta e redefinir senha):
                        o e-mail, a validade e um hash do link, nunca o link em si;
                    </li>
                    <li>
                        <strong>origens recusadas</strong>: os domínios que tentaram enviar visitas com
                        o token de um site sem ser o domínio cadastrado, para ajudar a diagnosticar
                        a instalação.
                    </li>
                </ul>
                <p className="prose">
                    O endereço IP de quem entra, se cadastra ou pede um link é usado só na memória
                    do servidor, para limitar tentativas e impedir abuso. Ele não é gravado no
                    banco e sai da memória cerca de uma hora depois do último pedido.
                </p>
                <p className="prose">
                    Bases legais: execução do contrato para prestar o serviço e enviar os e-mails da
                    conta (art. 7º, V, da LGPD), e legítimo interesse para a segurança e a prevenção
                    de abuso (art. 7º, IX). Só enviamos e-mails sobre a conta: criação, redefinição
                    e troca de senha, e confirmação de exclusão. Não enviamos e-mail de marketing.
                </p>
            </Secao>

            <Secao titulo="Cookies e armazenamento no navegador">
                <p className="prose">
                    <strong>Nos sites que usam o Coddara Analytics:</strong> nenhum.
                </p>
                <p className="prose"><strong>No painel:</strong></p>
                <ul className="prose">
                    <li>
                        o cookie <code>coddara_session</code>, que mantém a sessão aberta por até 7
                        dias. É essencial e não pode ser lido por scripts da página;
                    </li>
                    <li>
                        no armazenamento local do navegador, a escolha de tema claro ou escuro e se
                        um aviso do painel já foi lido.
                    </li>
                </ul>
                <p className="prose">
                    O painel não carrega nada de terceiros: fontes, scripts e estilos vêm do
                    próprio servidor.
                </p>
            </Secao>

            <Secao titulo="Com quem os dados são compartilhados">
                <p className="prose">
                    Não vendemos dados nem os compartilhamos para publicidade. Usamos estes
                    fornecedores para operar o serviço:
                </p>
                <ul className="prose">
                    <li>
                        <strong>Railway</strong>, que hospeda o servidor e o banco de dados.
                        Região: {FATOS.regiaoHospedagem}.
                    </li>
                    <li>
                        <strong>Resend</strong>, que envia os e-mails da conta. Recebe o endereço
                        do destinatário e o conteúdo da mensagem.
                    </li>
                </ul>
                <p className="prose">
                    Esses fornecedores podem tratar dados fora do Brasil. Essa transferência
                    internacional se apoia nas garantias contratuais oferecidas por eles (art. 33
                    da LGPD). Dados também podem ser fornecidos a autoridades quando a lei exigir.
                </p>
            </Secao>

            <Secao titulo="Por quanto tempo os dados são guardados">
                <ul className="prose">
                    <li><strong>Conta:</strong> até você excluí-la.</li>
                    <li>
                        <strong>Visitas de um site:</strong> 2 anos, e são apagadas automaticamente
                        depois disso. Saem antes se a conta dona do site for excluída. Desligar o
                        site para a coleta, mas não apaga o histórico.
                    </li>
                    <li>
                        <strong>Links enviados por e-mail:</strong> valem 24 horas (criar conta) ou 30
                        minutos (redefinir senha) e são apagados até 7 dias depois de vencerem,
                        inclusive os de cadastros que nunca foram concluídos.
                    </li>
                    <li><strong>Registros técnicos do servidor:</strong> {FATOS.retencaoLogs}.</li>
                    {FATOS.retencaoBackups && (
                        <li>
                            <strong>Cópias de segurança do banco:</strong> {FATOS.retencaoBackups}. Dados
                            excluídos deixam de existir nas cópias quando elas expiram.
                        </li>
                    )}
                </ul>
            </Secao>

            <Secao titulo="Seus direitos">
                <p className="prose">Quem tem conta pode, sem precisar falar com ninguém:</p>
                <ul className="prose">
                    <li>
                        <strong>excluir a conta e os dados</strong>, na tela Conta do painel. A
                        exclusão é definitiva: apaga o cadastro, os sites de que você é o único dono
                        e todas as visitas coletadas neles. Um e-mail confirma a exclusão;
                    </li>
                    <li><strong>trocar a senha</strong> e <strong>encerrar as sessões</strong> em todos os aparelhos.</li>
                </ul>
                <p className="prose">
                    Para os demais direitos do art. 18 da LGPD (confirmar o tratamento, acessar os
                    dados, corrigi-los, inclusive trocar o e-mail, receber uma cópia ou saber com
                    quem foram compartilhados), escreva para{' '}
                    <a href={`mailto:${FATOS.contato}`}>{FATOS.contato}</a>. Respondemos em até
                    15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados
                    (ANPD).
                </p>
            </Secao>

            <Secao titulo="Segurança">
                <p className="prose">
                    Toda a comunicação usa HTTPS. Senhas e links de e-mail são guardados só como
                    hash. O cookie de sessão não é acessível a scripts. Os links de e-mail valem uma
                    vez só, e pedir um novo invalida o anterior. Entrada, cadastro e pedidos de link
                    têm limite de tentativas. Trocar ou redefinir a senha encerra as sessões nos
                    outros aparelhos. Se houver um incidente de segurança com risco aos titulares,
                    comunicaremos a ANPD e as pessoas afetadas, como exige o art. 48 da LGPD.
                </p>
            </Secao>

            <Secao titulo="Menores de idade">
                <p className="prose">
                    O painel é destinado a quem administra sites e não deve ser usado por menores
                    de 18 anos.
                </p>
            </Secao>

            <Secao titulo="Mudanças nesta política">
                <p className="prose">
                    A data no topo indica a última atualização. Mudanças que afetem a forma como os
                    dados são tratados serão avisadas por e-mail a quem tem conta.
                </p>
            </Secao>

            <Secao titulo="Contato">
                <p className="prose">
                    Responsável pelo tratamento e encarregado de dados: {FATOS.controlador},{' '}
                    <a href={`mailto:${FATOS.contato}`}>{FATOS.contato}</a>.
                </p>
            </Secao>
        </div>
    );
}

// A versão pública, aberta em /privacidade sem precisar de conta: quem visita um
// site rastreado ou ainda vai se cadastrar também precisa conseguir ler.
export default function Privacidade() {
    return (
        <Moldura largura={760} rodape={false}>
            <div>
                <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>Política de privacidade</h1>
                <a className="link-btn" href="/">Voltar ao painel</a>
            </div>
            <TextoPolitica />
        </Moldura>
    );
}
