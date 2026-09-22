import { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { criarTema } from './theme.js';
import { CHAVE, ColorModeContext, lerPreferencia } from './colorMode.js';

export default function ColorMode({ children }) {
    const [mode, setMode] = useState(lerPreferencia);

    // O data-theme no <html> é o que faz o CSS próprio acompanhar. Sem isso, o
    // MUI trocaria de tema e as telas que ainda usam classe ficariam claras.
    useEffect(() => {
        document.documentElement.dataset.theme = mode;
        try {
            localStorage.setItem(CHAVE, mode);
        } catch {
            // A escolha vale só nesta sessão. Melhor que quebrar.
        }
    }, [mode]);

    const valor = useMemo(
        () => ({ mode, alternar: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')) }),
        [mode],
    );

    const tema = useMemo(() => criarTema(mode), [mode]);

    return (
        <ColorModeContext.Provider value={valor}>
            <ThemeProvider theme={tema}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
}
