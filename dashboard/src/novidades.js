// Novidades do produto, da mais recente para a mais antiga.
//
// Vive no código, e não no banco, de propósito: a novidade entra no mesmo
// commit da mudança que ela anuncia e vai ao ar com o mesmo deploy. Assim não
// existe anúncio de algo que ainda não está no ar, nem mudança no ar sem
// anúncio por esquecimento de ir a outra tela publicar.
//
// Para publicar: uma entrada nova no TOPO da lista. A data é a do deploy.
// tipo: 'novo' | 'melhoria' | 'correcao'
export const NOVIDADES = [
    {
        data: '2026-10-22',
        tipo: 'melhoria',
        titulo: 'Visual mais organizado e o filtro "Hoje" corrigido',
        itens: [
            'Cada tabela, gráfico e bloco de desempenho agora tem um quadro próprio, com borda fina.',
            'Em "Hoje", um site que ainda não teve visita desde a meia-noite mostra "sem dados", em vez de voltar para a tela de instalação.',
        ],
    },
    {
        data: '2026-10-22',
        tipo: 'novo',
        titulo: 'Contas com e-mail confirmado, recuperação de senha e privacidade',
        itens: [
            'Criar conta agora pede só o e-mail: chega um link para você definir a senha.',
            '"Esqueci a senha" na tela de entrada envia um link para criar uma senha nova.',
            'Nova tela Conta: troque a senha, saia de todos os aparelhos ou exclua a conta e os dados.',
            'Política de privacidade publicada, com link nas telas de entrada e no menu.',
            'As visitas passam a ser apagadas automaticamente depois de 2 anos.',
            'O painel não carrega mais nada de terceiros: até a fonte vem do nosso servidor.',
        ],
    },
    {
        data: '2026-10-19',
        tipo: 'novo',
        titulo: 'De onde vêm os visitantes: país e cidade',
        itens: [
            'Novas tabelas de país e de cidade na Visualização.',
            'A localização é calculada no nosso servidor e o endereço IP não é guardado.',
        ],
    },
    {
        data: '2026-09-23',
        tipo: 'novo',
        titulo: 'Lançamento do Coddara Analytics',
        itens: [
            'Visitantes, sessões, pageviews e rejeição, sempre comparados com o período anterior.',
            'Páginas mais vistas, origem das visitas e campanhas UTM.',
            'Dispositivo, navegador e sistema de quem visita.',
            'Desempenho do site com Core Web Vitals e a cascata de carregamento.',
            'Vários sites na mesma conta, sem cookie e sem banner de consentimento no seu site.',
        ],
    },
];

// "Visto até" fica no navegador: é conveniência de leitura, não dado da conta.
// Guarda a data da novidade mais recente que a pessoa já viu.
const CHAVE = 'coddara_novidades_vistas';
const MAIS_RECENTE = NOVIDADES[0]?.data ?? '';

export function temNovidade() {
    try {
        return (localStorage.getItem(CHAVE) ?? '') < MAIS_RECENTE;
    } catch {
        // Aba anônima ou armazenamento bloqueado: sem ponto, que é o mal menor.
        return false;
    }
}

export function marcarVistas() {
    try {
        localStorage.setItem(CHAVE, MAIS_RECENTE);
    } catch {
        // Sem armazenamento, o ponto volta na próxima visita. Nada quebra.
    }
}
