const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3002';

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

export const logout = () => request('/auth/logout', { method: 'POST' });

export const listSites = () => request('/sites');

export const getOverview = (siteId, period) => request(`/sites/${siteId}/overview?period=${period}`);

export const getRejections = (siteId) => request(`/sites/${siteId}/rejections`);

export const createSite = (name, domain) =>
    request('/sites', { method: 'POST', body: JSON.stringify({ name, domain }) });

export const removeSite = (siteId) => request(`/sites/${siteId}`, { method: 'DELETE' });

export const reactivateSite = (siteId) => request(`/sites/${siteId}/reactivate`, { method: 'POST' });

export const renameSite = (siteId, name) =>
    request(`/sites/${siteId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
