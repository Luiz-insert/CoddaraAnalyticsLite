import { useEffect, useState } from 'react';
import { Button, Paper, Stack, Typography, Alert } from '@mui/material';
import { Campo } from './Login.jsx';
import { changePassword, deleteAccount, getMe, logoutAll } from './api.js';

// A conta de quem está logado: trocar a senha e derrubar as outras sessões.
// Exclusão em dois passos: o botão só abre a confirmação, e a confirmação pede
// a senha. Um clique perdido não pode apagar meses de dados sem volta.
function ExcluirConta({ onDeleted }) {
    const [aberto, setAberto] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [sending, setSending] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setSending(true);
        try {
            await deleteAccount(password);
            await onDeleted();
        } catch (err) {
            setError(err.message);
            setSending(false);
        }
    }

    return (
        <Paper component="form" onSubmit={handleSubmit} sx={{ p: '30px 28px' }}>
            <Typography variant="h2" sx={{ mb: 0.5 }}>Excluir conta</Typography>
            <Typography variant="body1" color="text.disabled" sx={{ fontSize: 14, mb: 3 }}>
                Apaga sua conta, os sites de que você é o único dono e todos os dados coletados
                neles. Sites com outro dono continuam com ele. Não há como desfazer.
            </Typography>

            {aberto ? (
                <Stack spacing={2.5}>
                    {error && <Alert severity="error" variant="outlined">{error}</Alert>}
                    <Campo
                        id="excluir-senha"
                        rotulo="Sua senha, para confirmar"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Stack direction="row" spacing={1.5}>
                        <Button type="submit" variant="contained" color="error" disabled={sending}>
                            {sending ? 'Excluindo...' : 'Excluir definitivamente'}
                        </Button>
                        <Button variant="text" onClick={() => { setAberto(false); setPassword(''); setError(null); }}>
                            Cancelar
                        </Button>
                    </Stack>
                </Stack>
            ) : (
                <Button variant="outlined" color="error" onClick={() => setAberto(true)}>
                    Excluir conta e dados
                </Button>
            )}
        </Paper>
    );
}

export default function Conta({ onLoggedOut }) {
    const [email, setEmail] = useState('');
    const [current, setCurrent] = useState('');
    const [password, setPassword] = useState('');
    const [confirma, setConfirma] = useState('');
    const [error, setError] = useState(null);
    const [ok, setOk] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        getMe().then((me) => setEmail(me.email)).catch(() => {});
    }, []);

    async function handleSubmit(event) {
        event.preventDefault();
        setOk(false);

        if (password !== confirma) {
            setError('As senhas não são iguais.');
            return;
        }

        setError(null);
        setSending(true);
        try {
            await changePassword(current, password);
            setCurrent('');
            setPassword('');
            setConfirma('');
            setOk(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    }

    async function sairDeTodos() {
        await logoutAll().catch(() => {});
        await onLoggedOut();
    }

    return (
        <Stack spacing={3} sx={{ maxWidth: 460 }}>
            <Paper component="form" onSubmit={handleSubmit} sx={{ p: '30px 28px' }}>
                <Typography variant="h2" sx={{ mb: 0.5 }}>Trocar senha</Typography>
                <Typography variant="body1" color="text.disabled" sx={{ fontSize: 14, mb: 4 }}>
                    {email ? <>Conta <strong>{email}</strong>. </> : null}
                    As sessões em outros aparelhos são encerradas.
                </Typography>

                <Stack spacing={2.5}>
                    {error && <Alert severity="error" variant="outlined">{error}</Alert>}
                    {ok && <Alert severity="success" variant="outlined">Senha alterada.</Alert>}

                    <input type="email" autoComplete="username" value={email} readOnly hidden />

                    <Campo
                        id="current"
                        rotulo="Senha atual"
                        type="password"
                        autoComplete="current-password"
                        value={current}
                        onChange={(e) => setCurrent(e.target.value)}
                    />
                    <Campo
                        id="password"
                        rotulo="Nova senha"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Campo
                        id="confirma"
                        rotulo="Repita a nova senha"
                        type="password"
                        autoComplete="new-password"
                        value={confirma}
                        onChange={(e) => setConfirma(e.target.value)}
                    />

                    <Button type="submit" variant="contained" disabled={sending} sx={{ alignSelf: 'flex-start' }}>
                        {sending ? 'Salvando...' : 'Salvar senha'}
                    </Button>
                </Stack>
            </Paper>

            <Paper sx={{ p: '30px 28px' }}>
                <Typography variant="h2" sx={{ mb: 0.5 }}>Sessões</Typography>
                <Typography variant="body1" color="text.disabled" sx={{ fontSize: 14, mb: 3 }}>
                    Encerra a sessão em todos os aparelhos, inclusive este. Use se entrou num
                    computador que não é seu.
                </Typography>
                <Button variant="outlined" onClick={sairDeTodos}>Sair de todos os aparelhos</Button>
            </Paper>

            <ExcluirConta onDeleted={onLoggedOut} />
        </Stack>
    );
}
