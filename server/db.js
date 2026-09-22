import pg from 'pg';
import { randomBytes } from 'node:crypto';

const pool = new pg.Pool({
    connectionString:
        process.env.DATABASE_URL ||
        'postgres://coddara:coddara_dev@localhost:5432/coddara_analytics',
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

export async function createUser({ email, passwordHash }) {
    const { rows } = await query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, is_staff',
        [email, passwordHash],
    );
    return rows[0];
}

export async function findUserByEmail(email) {
    // lower() dos dois lados para casar com o índice único e com qualquer
    // linha que tenha entrado antes da normalização existir.
    const { rows } = await query(
        'SELECT id, email, password_hash, is_staff FROM users WHERE lower(email) = lower($1)',
        [email],
    );
    return rows[0] || null;
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
