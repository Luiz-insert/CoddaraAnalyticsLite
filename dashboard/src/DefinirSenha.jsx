import { useEffect, useState } from 'react';
import { Button, Paper, Stack, Typography, Alert } from '@mui/material';
import { Campo, Moldura } from './Login.jsx';
import { peekToken, redeemToken } from './api.js';

// Aonde o link do e-mail leva. A mesma tela para criar conta e redefinir senha:
// nos dois casos o link provou o e-mail, e o que falta é a senha.
const TEXTOS = {
    signup: {
        titulo: 'Criar conta',
        subtitulo: 'Defina a senha para',
        botao: 'Criar conta',
    },
    reset: {
        titulo: 'Nova senha',
        subtitulo: 'Defina a nova senha para',
        botao: 'Salvar senha',
    },
};

export default function DefinirSenha({ token, onDone, onCancel }) {
    // undefined = ainda consultando; null = link inválido.
    const [info, setInfo] = useState(undefined);
    const [password, setPassword] = useState('');
    const [confirma, setConfirma] = useState('');
    const [error, setError] = useState(null);
    const [sending, setSending] = useState(false);

    // Pergunta antes o que o link faz: avisar do link vencido depois de a pessoa
    // digitar a senha duas vezes seria desperdiçar o esforço dela.
    useEffect(() => {
        let vivo = true;
        peekToken(token)
            .then((dados) => { if (vivo) setInfo(dados); })
            .catch(() => { if (vivo) setInfo(null); });
        return () => { vivo = false; };
    }, [token]);

    async function handleSubmit(event) {
        event.preventDefault();

        // Conferido antes de enviar: um erro de digitação aqui só se descobre na
        // próxima entrada, e aí o caminho de volta é pedir outro e-mail.
        if (password !== confirma) {
            setError('As senhas não são iguais.');
            return;
        }

        setError(null);
        setSending(true);
        try {
            await redeemToken(token, password);
            await onDone();
        } catch (err) {
            setError(err.message);
            setSending(false);
        }
    }

    if (info === undefined) return null;

    if (info === null) {
        return (
            <Moldura>
                <Paper sx={{ p: '30px 28px' }}>
                    <Typography variant="h2" sx={{ mb: 0.5 }}>Link inválido</Typography>
                    <Typography variant="body1" color="text.disabled" sx={{ fontSize: 14, mb: 3 }}>
                        Este link expirou ou já foi usado. Cada link vale uma vez, e pedir um novo
                        invalida os anteriores.
                    </Typography>
                    <button type="button" className="link-btn" onClick={onCancel}>
                        Pedir outro link
                    </button>
                </Paper>
            </Moldura>
        );
    }

    const t = TEXTOS[info.purpose];

    return (
        <Moldura>
            <Paper component="form" onSubmit={handleSubmit} sx={{ p: '30px 28px' }}>
                <Typography variant="h2" sx={{ mb: 0.5 }}>{t.titulo}</Typography>
                <Typography variant="body1" color="text.disabled" sx={{ fontSize: 14, mb: 5 }}>
                    {t.subtitulo} <strong>{info.email}</strong>.
                </Typography>

                <Stack spacing={2.5}>
                    {error && <Alert severity="error" variant="outlined">{error}</Alert>}

                    {/* O e-mail escondido é para o gerenciador de senhas: sem ele,
                        a senha nova é salva sem usuário e não aparece no login. */}
                    <input type="email" autoComplete="username" value={info.email} readOnly hidden />

                    <Campo
                        id="password"
                        rotulo="Senha"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <Campo
                        id="confirma"
                        rotulo="Repita a senha"
                        type="password"
                        autoComplete="new-password"
                        value={confirma}
                        onChange={(e) => setConfirma(e.target.value)}
                    />

                    <Button type="submit" variant="contained" disabled={sending} fullWidth>
                        {sending ? 'Salvando...' : t.botao}
                    </Button>
                </Stack>
            </Paper>
        </Moldura>
    );
}
