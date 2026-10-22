import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { segredo } from './config.js';

const pool = new pg.Pool({
    // Mesma regra do JWT_SECRET: em produção, sem valor definido o processo
    // recusa subir. O padrão de desenvolvimento apontando para localhost já
    // custou um deploy — o container tentou falar com o Postgres dele mesmo e
    // devolveu quarenta linhas de ECONNREFUSED em vez de dizer o que faltava.
    connectionString: segredo('DATABASE_URL', 'postgres://coddara:coddara_dev@localhost:5432/coddara_analytics'),

    // Provedor gerenciado (Railway, Neon, Supabase) recusa conexão sem TLS pela
    // rede pública. O certificado deles é próprio, não emitido por autoridade
    // que o Node conheça, daí o rejectUnauthorized: false — criptografa, mas
    // não verifica a identidade do servidor.
    //
    // Pela rede interna do provedor (postgres.railway.internal) não é
    // necessário: o tráfego não sai da rede privada. Por isso é opt-in.
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

// Sem este ouvinte o processo MORRE quando a conexão ociosa cai — o 'pg' emite
// 'error' no pool, e evento de erro sem ouvinte derruba o Node inteiro. Basta o
// banco reiniciar, a rede piscar ou o Postgres ser atualizado para o ingest
// parar de receber evento de todos os clientes de uma vez.
//
// Registrando o ouvinte, o pool descarta a conexão quebrada e abre outra no
// próximo uso, que é exatamente o comportamento desejado.
pool.on('error', (err) => {
    console.error('[db] conexão ociosa caiu, será refeita:', err.message);
});

export const query = (text, params) => pool.query(text, params);

// Consulta mais quente do sistema: roda a cada evento recebido.
// Um cache em memória vai ser necessário, mas só quando o volume pedir.
export async function findSiteByToken(token) {
    if (typeof token !== 'string' || token.length === 0) return null;

    const { rows } = await query(
        'SELECT id, domain, active, verified_at FROM sites WHERE token = $1',
        [token],
    );
    return rows[0] || null;
}

const EVENT_COLUMNS = [
    'site_id', 'visitor_hash', 'type', 'path', 'referrer_host',
    'utm_source', 'utm_medium', 'utm_campaign',
    'screen_w', 'screen_h', 'viewport_w', 'viewport_h',
    'language', 'device_type', 'browser', 'os',
    'country', 'region', 'city',
    'props', 'occurred_at',
];

// Um INSERT só para o lote inteiro. Uma ida ao banco por evento seria o
// gargalo do ingest, que é o caminho mais quente do sistema.
export async function insertEvents(rows) {
    if (rows.length === 0) return 0;

    const values = [];
    const tuples = rows.map((row, i) => {
        const base = i * EVENT_COLUMNS.length;
        EVENT_COLUMNS.forEach((col) => values.push(row[col]));
        return `(${EVENT_COLUMNS.map((_, j) => `$${base + j + 1}`).join(', ')})`;
    });

    const { rowCount } = await query(
        `INSERT INTO events (${EVENT_COLUMNS.join(', ')}) VALUES ${tuples.join(', ')}`,
        values,
    );
    return rowCount;
}

// Retenção das visitas: dois anos. A política de privacidade promete este
// prazo; mudar aqui é mudar lá.
//
// Em lotes, para não segurar um lock longo na tabela mais quente do sistema
// enquanto o ingest tenta gravar. Devolve quantas linhas saíram.
export const RETENCAO_EVENTOS = '2 years';

export async function purgeOldEvents() {
    let total = 0;
    for (;;) {
        const { rowCount } = await query(
            `DELETE FROM events
              WHERE id IN (SELECT id FROM events
                            WHERE occurred_at < now() - $1::interval
                            LIMIT 5000)`,
            [RETENCAO_EVENTOS],
        );
        total += rowCount;
        if (rowCount < 5000) return total;
    }
}

const USER_FIELDS = 'id, email, is_staff, session_version';

export async function findUserById(id) {
    if (!/^\d+$/.test(String(id))) return null;
    const { rows } = await query(`SELECT ${USER_FIELDS} FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
}

export async function findUserByEmail(email) {
    // lower() dos dois lados para casar com o índice único e com qualquer
    // linha que tenha entrado antes da normalização existir.
    const { rows } = await query(
        `SELECT ${USER_FIELDS}, password_hash FROM users WHERE lower(email) = lower($1)`,
        [email],
    );
    return rows[0] || null;
}

// Emite um link e invalida os anteriores do mesmo e-mail e propósito: quem
// pede "esqueci a senha" três vezes tem só o último e-mail funcionando, e um
// link antigo esquecido numa caixa de entrada deixa de ser uma porta aberta.
export async function issueAuthToken({ purpose, email, tokenHash, minutes }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `UPDATE auth_tokens SET used_at = now()
              WHERE lower(email) = lower($1) AND purpose = $2 AND used_at IS NULL`,
            [email, purpose],
        );
        await client.query(
            `INSERT INTO auth_tokens (purpose, email, token_hash, expires_at)
                  VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
            [purpose, email, tokenHash, minutes],
        );
        // Faxina de carona: link vencido há uma semana não serve para nada e
        // guarda um e-mail — inclusive de quem pediu cadastro e nunca concluiu,
        // que não tem conta para excluir. A política de privacidade promete
        // este prazo; mudar aqui é mudar lá.
        await client.query("DELETE FROM auth_tokens WHERE expires_at < now() - interval '7 days'");
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// Só lê: a tela de definir senha pergunta antes para saber o que mostrar
// ("criar conta para x" ou "nova senha para x") e para avisar do link vencido
// antes de a pessoa digitar a senha duas vezes à toa.
export async function peekAuthToken(tokenHash) {
    const { rows } = await query(
        `SELECT purpose, email FROM auth_tokens
          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
        [tokenHash],
    );
    return rows[0] || null;
}

// Usa o link e aplica a senha, tudo ou nada. Consumir o token no mesmo UPDATE
// que confere a validade é o que impede dois cliques simultâneos de usarem o
// mesmo link duas vezes: só um deles encontra used_at ainda nulo.
//
// Devolve o usuário, ou null se o link não vale mais.
export async function redeemAuthToken({ tokenHash, passwordHash }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: [token] } = await client.query(
            `UPDATE auth_tokens SET used_at = now()
              WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
          RETURNING purpose, email`,
            [tokenHash],
        );
        if (!token) {
            await client.query('ROLLBACK');
            return null;
        }

        // Os dois propósitos terminam no mesmo lugar: uma conta com esta senha.
        // O ON CONFLICT cobre o cadastro de um e-mail que ganhou conta entre o
        // pedido e o clique — o link provou a posse do e-mail do mesmo jeito,
        // então definir a senha é o resultado certo, não um erro.
        //
        // session_version sobe nos dois casos de conta existente: redefinir a
        // senha precisa expulsar quem estiver usando a antiga.
        const { rows: [user] } = await client.query(
            `INSERT INTO users (email, password_hash) VALUES ($1, $2)
             ON CONFLICT ((lower(email)))
             DO UPDATE SET password_hash = EXCLUDED.password_hash,
                           session_version = users.session_version + 1
             RETURNING ${USER_FIELDS}`,
            [token.email, passwordHash],
        );

        // O outro tipo de link do mesmo e-mail também morre: definida a senha,
        // um link de cadastro ou de redefinição ainda pendente não tem mais
        // propósito e só serviria a quem o interceptasse.
        await client.query(
            `UPDATE auth_tokens SET used_at = now()
              WHERE lower(email) = lower($1) AND used_at IS NULL`,
            [token.email],
        );

        await client.query('COMMIT');
        return user;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function changePassword({ userId, passwordHash }) {
    const { rows } = await query(
        `UPDATE users SET password_hash = $2, session_version = session_version + 1
          WHERE id = $1 RETURNING ${USER_FIELDS}`,
        [userId, passwordHash],
    );
    return rows[0] || null;
}

export async function endAllSessions(userId) {
    await query('UPDATE users SET session_version = session_version + 1 WHERE id = $1', [userId]);
}

// Exclusão da conta a pedido do titular (LGPD, art. 18, VI). Apaga de verdade,
// sem "desligar": aqui o pedido é justamente não guardar mais nada.
//
// Vão junto os sites de que a conta é a ÚNICA dona, com todos os eventos. Site
// que tem outro dono fica com ele — a conta só perde o acesso. Apagar o site de
// um sócio porque o outro saiu seria destruir dado que não é só de quem pediu.
//
// Tudo numa transação: falha no meio não deixa conta sem site nem site órfão.
export async function deleteAccount(userId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: [user] } = await client.query(
            'SELECT email FROM users WHERE id = $1 FOR UPDATE',
            [userId],
        );
        if (!user) {
            await client.query('ROLLBACK');
            return null;
        }

        const { rows: proprios } = await client.query(
            `SELECT us.site_id AS id
               FROM user_sites us
              WHERE us.user_id = $1 AND us.role = 'owner'
                AND NOT EXISTS (
                    SELECT 1 FROM user_sites outro
                     WHERE outro.site_id = us.site_id
                       AND outro.user_id <> $1
                       AND outro.role = 'owner')`,
            [userId],
        );
        const ids = proprios.map((s) => s.id);

        // Eventos antes do site: a chave de events não tem CASCADE de propósito,
        // para nenhum DELETE de site levar o histórico por acidente. Aqui é
        // intenção, então é explícito. user_sites e site_rejections caem pelo
        // CASCADE deles.
        await client.query('DELETE FROM events WHERE site_id = ANY($1::bigint[])', [ids]);
        await client.query('DELETE FROM sites WHERE id = ANY($1::bigint[])', [ids]);

        // Links de e-mail guardam o endereço; ficariam como rastro da conta.
        await client.query('DELETE FROM auth_tokens WHERE lower(email) = lower($1)', [user.email]);

        // O acesso aos sites de outros donos cai pelo CASCADE de user_sites.
        await client.query('DELETE FROM users WHERE id = $1', [userId]);

        await client.query('COMMIT');
        return { email: user.email, sites: ids.length };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

const SITE_FIELDS = 's.id, s.name, s.domain, s.token, s.active, s.verified_at, s.verified_by';

export async function listSitesForUser({ userId, isStaff }) {
    if (isStaff) {
        const { rows } = await query(`SELECT ${SITE_FIELDS} FROM sites s ORDER BY s.name`);
        return rows;
    }
    const { rows } = await query(
        `SELECT ${SITE_FIELDS}, us.role
           FROM sites s
           JOIN user_sites us ON us.site_id = s.id
          WHERE us.user_id = $1
          ORDER BY s.name`,
        [userId],
    );
    return rows;
}

// Devolve o site apenas se esta pessoa pode vê-lo. É esta função que garante o
// isolamento entre inquilinos na leitura — o filtro está no SQL, não no código
// que chama, justamente para não depender de ninguém lembrar de aplicá-lo.
export async function findSiteForUser({ siteId, userId, isStaff }) {
    if (!/^\d+$/.test(String(siteId))) return null;

    if (isStaff) {
        const { rows } = await query(`SELECT ${SITE_FIELDS} FROM sites s WHERE s.id = $1`, [siteId]);
        return rows[0] || null;
    }
    const { rows } = await query(
        `SELECT ${SITE_FIELDS}, us.role
           FROM sites s
           JOIN user_sites us ON us.site_id = s.id
          WHERE s.id = $1 AND us.user_id = $2`,
        [siteId, userId],
    );
    return rows[0] || null;
}

// Verificação por snippet: o evento só chega se alguém com acesso de escrita ao
// site colocou a tag lá, e se a origem bate com o domínio registrado. Isso é
// prova de controle — e sai de graça, no momento em que a pessoa está olhando
// a tela de instalação esperando exatamente esse sinal.
//
// O "verified_at IS NULL" faz a escrita ser idempotente e imune a corrida: dois
// eventos simultâneos não sobrescrevem o horário do primeiro.
export async function markVerifiedBySnippet(siteId) {
    await query(
        `UPDATE sites SET verified_at = now(), verified_by = 'snippet'
          WHERE id = $1 AND verified_at IS NULL`,
        [siteId],
    );
}

// Agrega em vez de acumular linha por evento: a pergunta que a tela faz é
// "de qual origem, quantas vezes, quando foi a última".
export async function recordRejection({ siteId, origin, events }) {
    if (!origin || origin.length > 200) return;

    await query(
        `INSERT INTO site_rejections (site_id, origin, events, last_at)
              VALUES ($1, $2, $3, now())
         ON CONFLICT (site_id, origin)
         DO UPDATE SET events = site_rejections.events + EXCLUDED.events,
                       last_at = now()`,
        [siteId, origin, events],
    );
}

export async function listRejections(siteId) {
    const { rows } = await query(
        `SELECT origin, events, last_at
           FROM site_rejections
          WHERE site_id = $1 AND last_at >= now() - interval '7 days'
          ORDER BY last_at DESC
          LIMIT 5`,
        [siteId],
    );
    return rows;
}

// 16 bytes em hexa. Não precisa ser adivinhável-resistente como uma senha — o
// token é público, vai no HTML do cliente —, mas precisa ser impossível de
// chutar: quem acertar um token válido consegue injetar evento falso no site
// de outra pessoa (dentro do domínio dela, que o Origin ainda confere).
const novoToken = () => randomBytes(16).toString('hex');

// Duas escritas que precisam valer as duas ou nenhuma: um site sem a linha de
// acesso ficaria órfão, invisível para quem acabou de criá-lo e impossível de
// apagar pela interface.
export async function createSiteForUser({ name, domain, userId }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            'INSERT INTO sites (name, domain, token) VALUES ($1, $2, $3) RETURNING id, name, domain, token, active, verified_at, verified_by',
            [name, domain, novoToken()],
        );
        const site = rows[0];

        await client.query(
            "INSERT INTO user_sites (user_id, site_id, role) VALUES ($1, $2, 'owner')",
            [userId, site.id],
        );

        await client.query('COMMIT');
        return { ...site, role: 'owner' };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        // Sem isto a conexão nunca volta para o pool e o servidor trava depois
        // de algumas dezenas de cadastros.
        client.release();
    }
}

// Já tem um site ativo neste domínio? Dois tokens para o mesmo domínio são
// legítimos (migração, ambiente de teste) e por isso o banco permite — mas
// repetido no mesmo dia, pela mesma pessoa, é quase sempre engano, e o dado
// ficaria partido entre dois sites sem ninguém perceber.
export async function userHasDomain({ userId, domain }) {
    const { rows } = await query(
        `SELECT 1
           FROM sites s
           JOIN user_sites us ON us.site_id = s.id
          WHERE us.user_id = $1 AND s.domain = $2 AND s.active
          LIMIT 1`,
        [userId, domain],
    );
    return rows.length > 0;
}

// Remover é desligar, nunca apagar: o histórico continua consultável e o site
// volta com um clique. DELETE de verdade levaria junto todos os eventos pelo
// CASCADE — e não há desfazer para isso.
export async function setSiteActive({ siteId, active }) {
    await query('UPDATE sites SET active = $2 WHERE id = $1', [siteId, active]);
}

export async function renameSite({ siteId, name }) {
    await query('UPDATE sites SET name = $2 WHERE id = $1', [siteId, name]);
}
