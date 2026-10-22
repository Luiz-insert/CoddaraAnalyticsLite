// Em produção o painel e a API são a mesma origem, então basta o caminho:
// nada de CORS e nada de endereço gravado na compilação. Em desenvolvimento o
// Vite serve na 5173 e o servidor na 3002, daí o endereço completo.
//
// O Vite grava este valor no BUILD, não em tempo de execução: compilar sem o
// caminho certo gera um painel que tenta falar com o localhost de quem abriu.
const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3002/api' : '/api');

// credentials: 'include' em tudo — é o que leva o cookie de sessão. Esquecer
// disso numa chamada faz ela voltar 401 sem motivo aparente, então fica num
// lugar só em vez de repetido em cada tela.
async function request(path, options = {}) {
    const response = await fetch(`${BASE}${path}`, {
        credentials: 'include',
        headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
        ...options,
    });

    if (response.status === 204) return null;

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? 'Erro inesperado.');
    return data;
}

export const login = (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

// Cadastro e recuperação só pedem o e-mail: a resposta é sempre a mesma, e o
// que acontece depois chega por e-mail. A senha é definida no link.
export const register = (email) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email }) });

export const forgotPassword = (email) =>
    request('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) });

// O que o link do e-mail faz (criar conta ou trocar senha) e para qual e-mail.
export const peekToken = (token) => request(`/auth/token?token=${encodeURIComponent(token)}`);

// Usa o link: a resposta já traz o cookie de sessão.
export const redeemToken = (token, password) =>
    request('/auth/token', { method: 'POST', body: JSON.stringify({ token, password }) });

export const changePassword = (current, password) =>
    request('/auth/password', { method: 'POST', body: JSON.stringify({ current, password }) });

export const getMe = () => request('/me');

export const logout = () => request('/auth/logout', { method: 'POST' });

export const logoutAll = () => request('/auth/logout-all', { method: 'POST' });

// Apaga a conta e os sites de que ela é a única dona, com todos os eventos.
export const deleteAccount = (password) =>
    request('/me', { method: 'DELETE', body: JSON.stringify({ password }) });

export const listSites = () => request('/sites');

export const getOverview = (siteId, period) => request(`/sites/${siteId}/overview?period=${period}`);

export const getRejections = (siteId) => request(`/sites/${siteId}/rejections`);

export const createSite = (name, domain) =>
    request('/sites', { method: 'POST', body: JSON.stringify({ name, domain }) });

export const removeSite = (siteId) => request(`/sites/${siteId}`, { method: 'DELETE' });

export const reactivateSite = (siteId) => request(`/sites/${siteId}/reactivate`, { method: 'POST' });

export const renameSite = (siteId, name) =>
    request(`/sites/${siteId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
