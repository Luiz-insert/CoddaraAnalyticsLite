import { createContext, useContext } from 'react';

export const CHAVE = 'coddara_tema';

export const ColorModeContext = createContext({ mode: 'light', alternar: () => {} });

export const useColorMode = () => useContext(ColorModeContext);

export function lerPreferencia() {
    try {
        const salvo = localStorage.getItem(CHAVE);
        if (salvo === 'light' || salvo === 'dark') return salvo;
    } catch {
        // Aba anônima ou site data bloqueado: cai na preferência do sistema.
    }
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
