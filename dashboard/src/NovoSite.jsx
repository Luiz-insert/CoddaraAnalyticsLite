import { useState } from 'react';
import { Box, Button, Paper, Stack, Typography, Alert } from '@mui/material';
import BrandMark from './BrandMark.jsx';
import { createSite } from './api.js';

function Campo({ id, rotulo, ajuda, ...resto }) {
    return (
        <Box>
            <label className="rotulo" htmlFor={id}>{rotulo}</label>
            <input id={id} className="campo" required {...resto} />
            {ajuda && <p className="ajuda">{ajuda}</p>}
        </Box>
    );
}

// Duas perguntas e nada mais: o token o servidor gera, e é ele que a pessoa vai
// colar no site. Pedir qualquer coisa além disso seria adiar a única etapa que
// importa, que é a tag entrar no ar.
export default function NovoSite({ primeiro = false, onCreated, onCancel }) {
    const [name, setName] = useState('');
    const [domain, setDomain] = useState('');
    const [error, setError] = useState(null);
    const [sending, setSending] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setSending(true);
        try {
            const site = await createSite(name, domain);
            await onCreated(site);
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    }

    const formulario = (
        <Paper component="form" onSubmit={handleSubmit} sx={{ p: '30px 28px', maxWidth: 460 }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>{primeiro ? 'Seu primeiro site' : 'Novo site'}</Typography>
            {/* sx e não 'mb' solto: nesta versão do MUI as props de
                espaçamento fora do sx são ignoradas em silêncio. */}
            <Typography variant="body1" color="text.disabled" sx={{ fontSize: 14, mb: 5 }}>
                Depois de criar, a gente mostra a linha para colar no site.
            </Typography>

            <Stack spacing={2.5}>
                {error && <Alert severity="error" variant="outlined">{error}</Alert>}

                <Campo
                    id="site-name"
                    rotulo="Nome"
                    placeholder="Clínica Sorriso"
                    ajuda="Só para você se achar no painel."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />

                <Campo
                    id="site-domain"
                    rotulo="Endereço"
                    placeholder="clinicasorriso.com.br"
                    ajuda="Só o domínio. Pode colar o endereço inteiro que a gente recorta."
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                />

                <Stack direction="row" spacing={1.5}>
                    <Button type="submit" variant="contained" disabled={sending}>
                        {sending ? 'Criando...' : 'Criar site'}
                    </Button>
                    {onCancel && (
                        <Button type="button" variant="outlined" onClick={onCancel} disabled={sending}>
                            Cancelar
                        </Button>
                    )}
                </Stack>
            </Stack>
        </Paper>
    );

    // Sem site nenhum não existe painel para envolver o formulário — ele vira a
    // tela inteira, como o login.
    if (!primeiro) return formulario;

    return (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
            <Stack spacing={3.5} sx={{ width: '100%', maxWidth: 460 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box className="brand-mark"><BrandMark /></Box>
                    <Box>
                        <Typography variant="h3" lineHeight={1.2}>Coddara</Typography>
                        <Typography variant="overline" color="text.disabled" letterSpacing={1.5}>
                            Analytics
                        </Typography>
                    </Box>
                </Stack>
                {formulario}
            </Stack>
        </Box>
    );
}
