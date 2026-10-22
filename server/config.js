// Segredos com padrão de desenvolvimento, mas nunca em produção.
//
// O padrão existe para o projeto rodar recém-clonado, sem configurar nada. O
// perigo é ele sobreviver até o deploy: com o JWT_SECRET conhecido, qualquer
// um forja um token de sessão e entra na conta de qualquer cliente.
//
// Por isso, em produção, a falta do valor derruba o servidor na subida. Falhar
// ruidosamente na hora é melhor que rodar meses com segurança de mentira.
const DICAS = {
    DATABASE_URL: 'No Railway, aponte para o serviço do banco: ${{Postgres.DATABASE_URL}}',
    RESEND_API_KEY: 'Crie uma chave em resend.com/api-keys, com permissão só de envio.',
    EMAIL_FROM: 'Remetente num domínio verificado no Resend, como: Coddara Analytics <nao-responda@coddara.com>',
    APP_URL: 'Endereço público do painel, base dos links dos e-mails, como: https://analytics.coddara.com',
};

export function segredo(nome, padraoDev) {
    const valor = process.env[nome];
    if (valor) return valor;

    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            `${nome} não está definido, e em produção não existe valor padrão.\n` +
            `  ${DICAS[nome] ?? 'Gere um com `openssl rand -base64 32` e ponha no ambiente.'}`,
        );
    }

    return padraoDev;
}
