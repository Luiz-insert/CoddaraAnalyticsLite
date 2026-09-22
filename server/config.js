// Segredos com padrão de desenvolvimento, mas nunca em produção.
//
// O padrão existe para o projeto rodar recém-clonado, sem configurar nada. O
// perigo é ele sobreviver até o deploy: com o JWT_SECRET conhecido, qualquer
// um forja um token de sessão e entra na conta de qualquer cliente.
//
// Por isso, em produção, a falta do valor derruba o servidor na subida. Falhar
// ruidosamente na hora é melhor que rodar meses com segurança de mentira.
export function segredo(nome, padraoDev) {
    const valor = process.env[nome];
    if (valor) return valor;

    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            `${nome} não está definido. Em produção não existe valor padrão — ` +
            'gere um com `openssl rand -base64 32` e ponha no ambiente.',
        );
    }

    return padraoDev;
}
