import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// A fonte vem do próprio servidor, empacotada pelo Vite, e não do Google Fonts:
// pedir ao Google entregaria o IP de cada pessoa que abre o painel a um
// terceiro, por nada além de um arquivo de fonte.
import '@fontsource/public-sans/300.css';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import './index.css';
import ColorMode from './ColorMode.jsx';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ColorMode>
            <App />
        </ColorMode>
    </StrictMode>,
);
