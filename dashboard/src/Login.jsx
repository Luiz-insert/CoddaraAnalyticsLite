import { useState } from 'react';
import { Box, Button, Paper, Stack, Typography, Alert } from '@mui/material';
import BrandMark from './BrandMark.jsx';
import { login, register, forgotPassword } from './api.js';

// Campo próprio em vez do TextField: o rótulo flutuante da biblioteca briga
// com a versalete do nosso tema e atravessa a borda, e o campo dela traz um
// punhado de regras de cor que só acompanham o tema por meio do theme.js.
export function Campo({ id, rotulo, ...resto }) {
    return (
        <Box>
            <label className="rotulo" htmlFor={id}>{rotulo}</label>
            <input id={id} className="campo" required {...resto} />
        </Box>
    );
}

// Uma tela, três modos. Separar em rotas exigiria roteador, e a diferença entre
// eles é um campo e um verbo — não uma tela nova.
//
// Criar conta e esqueci a senha pedem só o e-mail: a senha é definida no link
// que chega por e-mail, e é isso que prova que o endereço é de quem digitou.
const TEXTOS = {
    entrar: {
        titulo: 'Entrar',
        subtitulo: 'Acesse os dados do seu site.',
        botao: 'Entrar',
        enviando: 'Entrando...',
    },
    criar: {
        titulo: 'Criar conta',
        subtitulo: 'Enviamos um link para você definir a senha.',
        botao: 'Enviar link',
        enviando: 'Enviando...',
    },
    esqueci: {
        titulo: 'Esqueci a senha',
        subtitulo: 'Enviamos um link para você definir uma senha nova.',
        botao: 'Enviar link',
        enviando: 'Enviando...',
    },
};

// Moldura das telas de fora do painel. O link da política vai no rodapé de
// todas: é antes de criar a conta que a pessoa precisa poder lê-la.
export function Moldura({ children, largura = 396, rodape = true }) {
    return (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
            <Stack spacing={3.5} sx={{ width: '100%', maxWidth: largura }}>

                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
                    <Box className="brand-mark"><BrandMark /></Box>
                    <Box>
                        <Typography variant="h3" lineHeight={1.2}>Coddara</Typography>
                        <Typography variant="overline" color="text.disabled" letterSpacing={1.5}>
                            Analytics
                        </Typography>
                    </Box>
                </Stack>

                {children}

                {rodape && (
                    <a className="link-btn" href="/privacidade" style={{ alignSelf: 'center', fontSize: 12 }}>
                        Política de privacidade
                    </a>
                )}
            </Stack>
        </Box>
    );
}

export default function Login({ onDone }) {
    const [modo, setModo] = useState('entrar');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [sending, setSending] = useState(false);
    // Para qual e-mail o link foi pedido. Preenchido, a tela vira o recado de
    // "confira sua caixa de entrada".
    const [enviadoPara, setEnviadoPara] = useState(null);

    const entrando = modo === 'entrar';
    const t = TEXTOS[modo];

    async function handleSubmit(event) {
        event.preventDefault();
        setError(null);
        setSending(true);
        try {
            if (entrando) {
                await login(email, password);
                await onDone();
            } else {
                await (modo === 'criar' ? register(email) : forgotPassword(email));
                setEnviadoPara(email);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    }

    function irPara(destino) {
        setModo(destino);
        setError(null);
        setPassword('');
        setEnviadoPara(null);
    }

    if (enviadoPara) {
        return (
            <Moldura>
                <Paper sx={{ p: '30px 28px' }}>
                    <Typography variant="h2" sx={{ mb: 0.5 }}>Confira seu e-mail</Typography>
                    {/* A mesma frase com ou sem conta: a tela não pode dizer quais
                        e-mails estão cadastrados. Quem já tem conta recebe, no
                        e-mail, o link para redefinir a senha. */}
                    <Typography variant="body1" color="text.disabled" sx={{ fontSize: 14, mb: 3 }}>
                        Se for possível usar <strong>{enviadoPara}</strong>, um link chega em instantes.
                        Ele vale por pouco tempo e só uma vez. Confira também a caixa de spam.
                    </Typography>
                    <button type="button" className="link-btn" onClick={() => irPara('entrar')}>
                        Voltar para entrar
                    </button>
                </Paper>
            </Moldura>
        );
    }

    return (
        <Moldura>
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

                    {entrando && (
                        <Campo
                            id="password"
                            rotulo="Senha"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    )}

                    <Button type="submit" variant="contained" disabled={sending} fullWidth>
                        {sending ? t.enviando : t.botao}
                    </Button>

                    <Stack spacing={1} alignItems="center">
                        {entrando ? (
                            <>
                                <button type="button" className="link-btn" onClick={() => irPara('esqueci')}>
                                    Esqueci a senha
                                </button>
                                <button type="button" className="link-btn" onClick={() => irPara('criar')}>
                                    Ainda não tem conta? Criar uma
                                </button>
                            </>
                        ) : (
                            <button type="button" className="link-btn" onClick={() => irPara('entrar')}>
                                Voltar para entrar
                            </button>
                        )}
                    </Stack>
                </Stack>
            </Paper>
        </Moldura>
    );
}
