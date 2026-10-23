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

async function enviar({ to, subject, text, html }) {
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
        body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
    });

    if (!resposta.ok) {
        // O corpo do Resend diz o motivo (domínio não verificado, chave
        // inválida, limite); sem ele o log só diria "falhou".
        const corpo = await resposta.text().catch(() => '');
        throw new Error(`Resend respondeu ${resposta.status}: ${corpo.slice(0, 300)}`);
    }
}

// ─── Identidade ──────────────────────────────────────────────────────────────
//
// A mesma direção suíça do painel (theme.js): grade, fio fino, peso leve no
// título, canto reto, sem sombra. Só a paleta clara: cliente de e-mail que
// força o escuro inverte as cores sozinho, e como não há imagem, nada some.
const COR = {
    bg: '#ffffff',
    ink: '#111111',
    muted: '#5c5c5c',
    faint: '#8c8c8c',
    line: '#ededed',
};

// Public Sans só carrega onde o cliente aceita fonte web (Apple Mail, iOS);
// no resto cai na fonte do sistema, que fica perto o bastante.
const SANS = "'Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const esc = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Texto e HTML saem do mesmo conteúdo, para nunca dizerem coisas diferentes.
// Os dois juntos: cliente que só mostra texto existe, e e-mail só com HTML
// pesa mais no filtro de spam.
//
//   titulo      a frase grande, em peso leve
//   paragrafos  o que a pessoa precisa saber antes do botão
//   acao        { rotulo, link } — o botão, com o endereço por extenso embaixo
//   notas       letra miúda depois do fio: validade, "se não foi você"
function montar({ titulo, paragrafos, acao, notas = [] }) {
    const text = [
        ...paragrafos,
        ...(acao ? [acao.link] : []),
        ...notas,
        '— Coddara Analytics',
    ].join('\n\n');

    // Tabela, estilo em linha e nada de SVG: é o que o Gmail e o Outlook
    // respeitam. A marca é só o nome, em texto — imagem viria bloqueada por
    // padrão e sumiria no modo escuro.
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${COR.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(paragrafos[0])}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COR.bg};">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;font-family:${SANS};color:${COR.ink};">

<tr><td style="padding-bottom:16px;border-bottom:1px solid ${COR.ink};">
  <div style="font-size:15px;font-weight:600;letter-spacing:-0.2px;line-height:1.2;color:${COR.ink};">Coddara</div>
  <div style="font-size:11px;font-weight:600;letter-spacing:1.5px;line-height:1.6;text-transform:uppercase;color:${COR.faint};">Analytics</div>
</td></tr>

<tr><td style="padding:40px 0 20px;font-size:30px;font-weight:300;letter-spacing:-0.8px;line-height:1.15;color:${COR.ink};">${esc(titulo)}</td></tr>

${paragrafos.map((p) => `<tr><td style="padding:0 0 16px;font-size:15px;line-height:1.6;color:${COR.ink};">${esc(p)}</td></tr>`).join('\n')}

${acao ? `<tr><td style="padding:12px 0 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="${COR.ink}" style="background:${COR.ink};">
      <a href="${esc(acao.link)}" style="display:inline-block;padding:0 22px;line-height:44px;font-family:${SANS};font-size:14px;font-weight:500;color:#ffffff;text-decoration:none;">${esc(acao.rotulo)}</a>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:0 0 32px;font-size:13px;line-height:1.6;color:${COR.muted};">
  Se o botão não abrir, copie este endereço no navegador:<br>
  <a href="${esc(acao.link)}" style="color:${COR.muted};word-break:break-all;">${esc(acao.link)}</a>
</td></tr>` : ''}

${notas.length ? `<tr><td style="padding-top:20px;border-top:1px solid ${COR.line};">
${notas.map((n) => `  <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${COR.muted};">${esc(n)}</p>`).join('\n')}
</td></tr>` : ''}

<tr><td style="padding-top:32px;font-size:11px;font-weight:600;letter-spacing:0.9px;line-height:1.6;text-transform:uppercase;color:${COR.faint};">
  Coddara Analytics · e-mail automático, não responda
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    return { text, html };
}

// Os modelos. Curtos e sem imagem: e-mail de conta é lido no celular, e o que
// importa nele é o link e quanto tempo ele vale.

export const emailCadastro = ({ to, link }) => enviar({
    to,
    subject: 'Crie sua conta no Coddara Analytics',
    ...montar({
        titulo: 'Crie sua conta',
        paragrafos: ['Para criar sua conta, defina uma senha neste link.'],
        acao: { rotulo: 'Definir senha', link },
        notas: [
            'O link vale por 24 horas e pode ser usado uma vez.',
            'Se não foi você quem pediu, ignore este e-mail — nenhuma conta é criada sem o link.',
        ],
    }),
});

// Quem tenta se cadastrar com um e-mail que já tem conta recebe isto, e não
// um erro na tela. A tela responde igual nos dois casos; só o dono da caixa de
// entrada fica sabendo que a conta existe.
export const emailContaExistente = ({ to, link }) => enviar({
    to,
    subject: 'Você já tem conta no Coddara Analytics',
    ...montar({
        titulo: 'Você já tem conta',
        paragrafos: [
            'Alguém pediu para criar uma conta com este e-mail, mas ele já tem uma.',
            'Se foi você e não lembra a senha, defina uma nova neste link.',
        ],
        acao: { rotulo: 'Definir nova senha', link },
        notas: [
            'O link vale por 30 minutos e pode ser usado uma vez.',
            'Se não foi você, ignore este e-mail — sua senha continua a mesma.',
        ],
    }),
});

export const emailRedefinir = ({ to, link }) => enviar({
    to,
    subject: 'Redefina sua senha do Coddara Analytics',
    ...montar({
        titulo: 'Redefina sua senha',
        paragrafos: ['Para definir uma senha nova, use este link.'],
        acao: { rotulo: 'Definir nova senha', link },
        notas: [
            'O link vale por 30 minutos e pode ser usado uma vez. Ao usar, as sessões abertas em outros aparelhos são encerradas.',
            'Se não foi você quem pediu, ignore este e-mail — sua senha continua a mesma.',
        ],
    }),
});

// Aviso depois do fato. Se a troca não foi da pessoa, é por este e-mail que
// ela descobre — e o caminho de volta é o mesmo de quem esqueceu a senha.
export const emailSenhaAlterada = ({ to }) => enviar({
    to,
    subject: 'Sua senha do Coddara Analytics foi alterada',
    ...montar({
        titulo: 'Sua senha foi alterada',
        paragrafos: [
            'A senha da sua conta acabou de ser alterada, e as sessões em outros aparelhos foram encerradas.',
            'Se não foi você, redefina a senha agora: abra o painel e use "Esqueci a senha".',
        ],
        acao: { rotulo: 'Abrir o painel', link: APP_URL },
    }),
});

// Confirmação da exclusão. O endereço já não existe no banco quando isto sai —
// é o último uso dele, e é o que dá ao titular a prova de que o pedido foi
// atendido.
export const emailContaExcluida = ({ to, sites }) => enviar({
    to,
    subject: 'Sua conta do Coddara Analytics foi excluída',
    ...montar({
        titulo: 'Sua conta foi excluída',
        paragrafos: [
            'Sua conta foi excluída, como você pediu.',
            `Apagamos o cadastro${sites > 0 ? `, ${sites === 1 ? 'o site' : `os ${sites} sites`} de que você era dono e todos os dados coletados ${sites === 1 ? 'nele' : 'neles'}` : ''}. Não há como desfazer.`,
        ],
        notas: ['Se você tinha a tag de rastreamento instalada em algum site, ela deixou de funcionar e pode ser removida do código.'],
    }),
});
