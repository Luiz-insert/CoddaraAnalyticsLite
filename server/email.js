import { segredo } from './config.js';

// Envio de e-mail pelo Resend. Um fetch e nada mais: a API é um POST com JSON,
// e o SDK traria dependência para fazer exatamente isso.
//
// Em desenvolvimento, sem chave, o e-mail não sai: vai inteiro para o terminal,
// link incluso. É o que deixa testar o cadastro sem conta no Resend e sem
// mandar e-mail de verdade para endereço inventado.
const API_KEY = segredo('RESEND_API_KEY', null);
const FROM = segredo('EMAIL_FROM', 'Coddara Analytics <nao-responda@localhost>');

// Base dos links. Em produção é obrigatória: um link apontando para o
// localhost chegaria na caixa de entrada do cliente e não abriria nada.
export const APP_URL = segredo('APP_URL', 'http://localhost:5173').replace(/\/+$/, '');

async function enviar({ to, subject, text }) {
    if (!API_KEY) {
        console.log(`\n[email] (desenvolvimento, não enviado)\n  para: ${to}\n  assunto: ${subject}\n\n${text}\n`);
        return;
    }

    const resposta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM, to: [to], subject, text, html: paraHtml(text) }),
    });

    if (!resposta.ok) {
        // O corpo do Resend diz o motivo (domínio não verificado, chave
        // inválida, limite); sem ele o log só diria "falhou".
        const corpo = await resposta.text().catch(() => '');
        throw new Error(`Resend respondeu ${resposta.status}: ${corpo.slice(0, 300)}`);
    }
}

// HTML mínimo derivado do texto. Os dois juntos: cliente de e-mail que só
// mostra texto existe, e e-mail só com HTML pesa mais no filtro de spam.
function paraHtml(text) {
    const escapado = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const corpo = escapado
        .split('\n\n')
        .map((paragrafo) => {
            const linkado = paragrafo.replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>');
            return `<p>${linkado.replace(/\n/g, '<br>')}</p>`;
        })
        .join('');

    return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px">${corpo}</div>`;
}

const ASSINATURA = '— Coddara Analytics';

// Os modelos. Texto curto e sem imagem: e-mail de conta é lido no celular,
// e o que importa nele é o link e quanto tempo ele vale.

export const emailCadastro = ({ to, link }) => enviar({
    to,
    subject: 'Crie sua conta no Coddara Analytics',
    text: `Para criar sua conta, defina uma senha neste link:\n\n${link}\n\nO link vale por 24 horas e pode ser usado uma vez.\n\nSe não foi você quem pediu, ignore este e-mail — nenhuma conta é criada sem o link.\n\n${ASSINATURA}`,
});

// Quem tenta se cadastrar com um e-mail que já tem conta recebe isto, e não
// um erro na tela. A tela responde igual nos dois casos; só o dono da caixa de
// entrada fica sabendo que a conta existe.
export const emailContaExistente = ({ to, link }) => enviar({
    to,
    subject: 'Você já tem conta no Coddara Analytics',
    text: `Alguém pediu para criar uma conta com este e-mail, mas ele já tem uma.\n\nSe foi você e não lembra a senha, defina uma nova aqui:\n\n${link}\n\nO link vale por 30 minutos e pode ser usado uma vez.\n\nSe não foi você, ignore este e-mail — sua senha continua a mesma.\n\n${ASSINATURA}`,
});

export const emailRedefinir = ({ to, link }) => enviar({
    to,
    subject: 'Redefina sua senha do Coddara Analytics',
    text: `Para definir uma senha nova, use este link:\n\n${link}\n\nO link vale por 30 minutos e pode ser usado uma vez. Ao usar, as sessões abertas em outros aparelhos são encerradas.\n\nSe não foi você quem pediu, ignore este e-mail — sua senha continua a mesma.\n\n${ASSINATURA}`,
});

// Aviso depois do fato. Se a troca não foi da pessoa, é por este e-mail que
// ela descobre — e o caminho de volta é o mesmo de quem esqueceu a senha.
export const emailSenhaAlterada = ({ to }) => enviar({
    to,
    subject: 'Sua senha do Coddara Analytics foi alterada',
    text: `A senha da sua conta acabou de ser alterada, e as sessões em outros aparelhos foram encerradas.\n\nSe não foi você, redefina a senha agora em:\n\n${APP_URL}\n\nusando "Esqueci a senha".\n\n${ASSINATURA}`,
});

// Confirmação da exclusão. O endereço já não existe no banco quando isto sai —
// é o último uso dele, e é o que dá ao titular a prova de que o pedido foi
// atendido.
export const emailContaExcluida = ({ to, sites }) => enviar({
    to,
    subject: 'Sua conta do Coddara Analytics foi excluída',
    text: `Sua conta foi excluída, como você pediu.\n\nApagamos o cadastro${sites > 0 ? `, ${sites === 1 ? 'o site' : `os ${sites} sites`} de que você era dono e todos os dados coletados ${sites === 1 ? 'nele' : 'neles'}` : ''}. Não há como desfazer.\n\nSe você tinha a tag de rastreamento instalada em algum site, ela deixou de funcionar e pode ser removida do código.\n\n${ASSINATURA}`,
});
