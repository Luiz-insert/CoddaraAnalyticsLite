import { useState } from 'react';
import { Box, Button, Paper, Stack, Typography, Alert } from '@mui/material';
import BrandMark from './BrandMark.jsx';
import { login, register } from './api.js';

// Campo próprio em vez do TextField: o rótulo flutuante da biblioteca briga
// com a versalete do nosso tema e atravessa a borda, e o campo dela traz um
// punhado de regras de cor que só acompanham o tema por meio do theme.js.
function Campo({ id, rotulo, ...resto }) {
    return (
        <Box>
            <label className="rotulo" htmlFor={id}>{rotulo}</label>
            <input id={id} className="campo" required {...resto} />
        </Box>
    );
}

// Uma tela, dois modos. Separar em duas rotas exigiria roteador, e a diferença
// entre entrar e criar conta é um campo e um verbo — não uma tela nova.
const TEXTOS = {
    entrar: {
        titulo: 'Entrar',
        subtitulo: 'Acesse os dados do seu site.',
        botao: 'Entrar',
        enviando: 'Entrando...',
        troca: 'Ainda não tem conta? Criar uma',
    },
    criar: {
        titulo: 'Criar conta',
        subtitulo: 'Leva um minuto. Depois é só colar uma linha no seu site.',
        botao: 'Criar conta',
        enviando: 'Criando...',
        troca: 'Já tem conta? Entrar',
    },
};

export default function Login({ onDone }) {
    const [modo, setModo] = useState('entrar');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirma, setConfirma] = useState('');
    const [error, setError] = useState(null);
    const [sending, setSending] = useState(false);

    const criando = modo === 'criar';
    const t = TEXTOS[modo];

    async function handleSubmit(event) {
        event.preventDefault();

        // Conferido antes de enviar: não existe recuperação de senha no produto,
        // então um erro de digitação aqui tranca a conta para sempre.
        if (criando && password !== confirma) {
            setError('As senhas não são iguais.');
            return;
        }

        setError(null);
        setSending(true);
        try {
            await (criando ? register(email, password) : login(email, password));
            await onDone();
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    }

    function trocarModo() {
        setModo(criando ? 'entrar' : 'criar');
        setError(null);
        setConfirma('');
    }

    return (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
            <Stack spacing={3.5} sx={{ width: '100%', maxWidth: 396 }}>

                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box className="brand-mark"><BrandMark /></Box>
                    <Box>
                        <Typography variant="h3" lineHeight={1.2}>Coddara</Typography>
                        <Typography variant="overline" color="text.disabled" letterSpacing={1.5}>
                            Analytics
                        </Typography>
                    </Box>
                </Stack>

                <Paper component="form" onSubmit={handleSubmit} sx={{ p: '30px 28px' }}>
                    <Typography variant="h2" sx={{ mb: 0.5 }}>{t.titulo}</Typography>
                    {/* sx e não 'mb' solto: nesta versão do MUI as props de espaçamento
                        fora do sx são ignoradas em silêncio, e o subtítulo ficava
                        colado no primeiro rótulo. */}
                    <Typography variant="body1" color="text.disabled" sx={{ fontSize: 14, mb: 5 }}>
                        {t.subtitulo}
                    </Typography>

                    <Stack spacing={2.5}>
                        {error && <Alert severity="error" variant="outlined">{error}</Alert>}

                        <Campo
                            id="email"
                            rotulo="E-mail"
                            type="email"
                            autoComplete="email"
                            placeholder="voce@clinica.com.br"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <Campo
                            id="password"
                            rotulo="Senha"
                            type="password"
                            // Muda o que o gerenciador de senhas faz: em 'criar'
                            // ele oferece gerar uma; em 'entrar', preencher a
                            // que já existe.
                            autoComplete={criando ? 'new-password' : 'current-password'}
                            minLength={criando ? 8 : undefined}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        {criando && (
                            <Campo
                                id="confirma"
                                rotulo="Repita a senha"
                                type="password"
                                autoComplete="new-password"
                                value={confirma}
                                onChange={(e) => setConfirma(e.target.value)}
                            />
                        )}

                        <Button type="submit" variant="contained" disabled={sending} fullWidth>
                            {sending ? t.enviando : t.botao}
                        </Button>

                        <button type="button" className="link-btn" onClick={trocarModo} style={{ alignSelf: 'center' }}>
                            {t.troca}
                        </button>
                    </Stack>
                </Paper>

            </Stack>
        </Box>
    );
}
