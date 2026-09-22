import { useState } from 'react';
import { Box, Button, Paper, Stack, Typography, Alert } from '@mui/material';
import BrandMark from './BrandMark.jsx';
import { login } from './api.js';

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

export default function Login({ onDone }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [sending, setSending] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setSending(true);
        try {
            await login(email, password);
            await onDone();
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
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
                    <Typography variant="h2" sx={{ mb: 0.5 }}>Entrar</Typography>
                    {/* sx e não 'mb' solto: nesta versão do MUI as props de espaçamento
                        fora do sx são ignoradas em silêncio, e o subtítulo ficava
                        colado no primeiro rótulo. */}
                    <Typography variant="body1" color="text.disabled" sx={{ fontSize: 14, mb: 5 }}>
                        Acesse os dados do seu site.
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
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        <Button type="submit" variant="contained" disabled={sending} fullWidth>
                            {sending ? 'Entrando...' : 'Entrar'}
                        </Button>
                    </Stack>
                </Paper>

            </Stack>
        </Box>
    );
}
