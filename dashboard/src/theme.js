import { createTheme } from '@mui/material/styles';

// Direção suíça: grade, muito espaço vazio, hierarquia por peso e fio fino.
// Este arquivo é o único lugar onde os valores existem — mudar aqui muda o
// painel inteiro, nos dois temas.
// Duas paletas, mesma estrutura. O escuro não é o claro invertido byte a byte:
// preto puro no fundo vibra, e o vermelho do claro fica abafado — por isso o
// fundo é levemente frio e o acento sobe de luminosidade.
const PALETAS = {
    light: {
        bg: '#ffffff',
        card: '#ffffff',
        ink: '#111111',
        muted: '#5c5c5c',
        faint: '#8c8c8c',
        inverse: '#ffffff',
        line: '#ededed',
        // Fio do campo de formulário. Separado do 'line' de propósito: aquele
        // separa linha de tabela, onde um sussurro basta porque o conteúdo já
        // guia o olho. Este delimita um alvo clicável, e precisa passar dos
        // 3:1 de contraste sozinho — a 1,2:1 o campo simplesmente sumia.
        campo: '#8c8c8c',
        inkHover: '#000000',
        accent: '#e4451f',
        erro: '#c02b1d',
    },
    dark: {
        bg: '#0e0e10',
        card: '#0e0e10',
        ink: '#ededed',
        muted: '#a0a0a4',
        faint: '#6e6e74',
        inverse: '#0e0e10',
        line: '#262629',
        campo: '#6e6e74',
        inkHover: '#ffffff',
        accent: '#f2643d',
        erro: '#e06054',
    },
};

const SANS = "'Public Sans', system-ui, -apple-system, sans-serif";

export function criarTema(mode) {
    const cores = PALETAS[mode];

    return createTheme({
        palette: {
            mode,
            background: { default: cores.bg, paper: cores.card },
            text: { primary: cores.ink, secondary: cores.muted, disabled: cores.faint },
            primary: { main: cores.ink, contrastText: cores.inverse },
            divider: cores.line,
            error: { main: cores.erro },
        },

        // Canto reto: arredondar seria a primeira coisa a diluir a grade.
        shape: { borderRadius: 0 },

        // Suíço não tem sombra. A separação vem de fio e de espaço em branco.
        shadows: Array(25).fill('none'),

        typography: {
            fontFamily: SANS,
            // Números e títulos em peso leve e tracking negativo: é o que dá o ar
            // de grade tipográfica em vez de painel genérico.
            h1: { fontWeight: 300, fontSize: 40, letterSpacing: '-1px', lineHeight: 1.1 },
            h2: { fontWeight: 300, fontSize: 34, letterSpacing: '-0.8px', lineHeight: 1.1 },
            h3: { fontWeight: 500, fontSize: 15, letterSpacing: '-0.2px' },
            body1: { fontSize: 14, lineHeight: 1.6 },
            body2: { fontSize: 13, lineHeight: 1.6, color: cores.muted },
            overline: {
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.9,
                lineHeight: 1.6,
                textTransform: 'uppercase',
                color: cores.faint,
            },
            caption: { fontSize: 13, fontVariantNumeric: 'tabular-nums', color: cores.muted },
        },

        components: {
            MuiButtonBase: { defaultProps: { disableRipple: true } },

            MuiPaper: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: {
                        backgroundColor: cores.card,
                        border: `1px solid ${cores.line}`,
                        borderRadius: 0,
                        boxShadow: 'none',
                    },
                },
            },

            MuiButton: {
                defaultProps: { disableElevation: true },
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 500,
                        fontSize: 14,
                        borderRadius: 0,
                        // A mesma altura do .campo, declarada e não deduzida.
                        minHeight: 42,
                        padding: '0 18px',
                        boxShadow: 'none',
                        '&:hover': { boxShadow: 'none' },
                    },
                    contained: {
                        backgroundColor: cores.ink,
                        '&:hover': { backgroundColor: cores.inkHover },
                    },
                    outlined: {
                        borderColor: cores.line,
                        color: cores.muted,
                        '&:hover': { borderColor: cores.ink, color: cores.ink, background: 'none' },
                    },
                },
            },

            // Sem MuiOutlinedInput nem MuiInputLabel: os campos deixaram de ser
            // do MUI e são marcação própria, vestida pelo index.css.

            MuiTableCell: {
                styleOverrides: {
                    root: { borderBottom: `1px solid ${cores.line}`, fontSize: 14, padding: '13px 0' },
                    head: {
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: 0.9,
                        textTransform: 'uppercase',
                        color: cores.faint,
                        borderBottom: `1px solid ${cores.ink}`,
                        paddingBottom: 12,
                    },
                },
            },
        },
    });
}
