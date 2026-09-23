// Aplica as migrações pendentes e sai. Roda a cada deploy, antes do servidor.
//
//   node migrate.js
//
// Guarda o que já rodou numa tabela. Os arquivos de hoje são todos idempotentes
// (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS), mas os próximos não
// serão — um ALTER que renomeia coluna roda uma vez e quebra na segunda. O
// controle existe para quando isso acontecer, não para os arquivos atuais.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { query } from './db.js';

const PASTA = fileURLToPath(new URL('./sql', import.meta.url));

// O banco e a aplicação sobem em paralelo no provedor, e quem chega primeiro
// não espera. Sem esta espera, o primeiro deploy falha por alguns segundos de
// diferença e fica reiniciando em laço.
//
// Só para erro de CONEXÃO: senha errada ou banco inexistente falham na hora,
// porque insistir não resolveria e só atrasaria o diagnóstico.
const CONEXAO = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT']);
const TENTATIVAS = 6;

async function esperarBanco() {
    for (let i = 1; i <= TENTATIVAS; i += 1) {
        try {
            await query('SELECT 1');
            return;
        } catch (err) {
            if (!CONEXAO.has(err.code) || i === TENTATIVAS) {
                console.error(`\nNão foi possível falar com o banco: ${err.message}`);
                console.error('Confira a variável DATABASE_URL do serviço.\n');
                process.exit(1);
            }
            const espera = i * 2;
            console.log(`  banco ainda não responde (${err.code}), tentando de novo em ${espera}s...`);
            await new Promise((ok) => { setTimeout(ok, espera * 1000); });
        }
    }
}

await esperarBanco();

await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text        PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
    )
`);

const { rows } = await query('SELECT name FROM schema_migrations');
const aplicadas = new Set(rows.map((r) => r.name));

// Ordem alfabética, que é por isso que os arquivos começam com número.
const arquivos = (await readdir(PASTA)).filter((f) => f.endsWith('.sql')).sort();

let novas = 0;
for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) continue;

    const sql = await readFile(`${PASTA}/${arquivo}`, 'utf8');

    // Cada arquivo numa transação: falha no meio não deixa metade aplicada, e
    // o registro só entra se o conteúdo passou.
    try {
        await query('BEGIN');
        await query(sql);
        await query('INSERT INTO schema_migrations (name) VALUES ($1)', [arquivo]);
        await query('COMMIT');
        console.log(`  aplicada: ${arquivo}`);
        novas += 1;
    } catch (err) {
        await query('ROLLBACK').catch(() => {});
        console.error(`  FALHOU: ${arquivo}\n  ${err.message}`);
        // Sai com erro: o deploy precisa parar aqui, e não subir um servidor
        // que fala com um banco na forma errada.
        process.exit(1);
    }
}

console.log(novas === 0
    ? `Banco já estava em dia (${arquivos.length} migrações).`
    : `${novas} migração(ões) aplicada(s), ${arquivos.length} no total.`);

process.exit(0);
