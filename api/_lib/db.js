const { Pool } = require('pg');

let pool;
let ready;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
    // Bancos na nuvem (Supabase, Neon, Railway...) exigem SSL. Se a URL pedir sslmode,
    // usamos SSL sem checar a cadeia de certificados (evita erro "self-signed certificate").
    let url = process.env.DATABASE_URL, ssl;
    if (/[?&]sslmode=/.test(url)) {
      url = url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
      ssl = { rejectUnauthorized: false };
    }
    pool = new Pool({ connectionString: url, ssl, max: 1, idleTimeoutMillis: 10000 });
  }
  return pool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_code text UNIQUE NOT NULL,
  credits       integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ledger (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id),
  delta      integer NOT NULL,
  reason     text NOT NULL,
  ref        text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payments (
  stripe_session_id text PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES users(id),
  credits           integer NOT NULL,
  amount_total      integer NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
`;

// Cria as tabelas na primeira chamada de cada instância (idempotente).
function init() {
  if (!ready) ready = getPool().query(SCHEMA).catch((e) => { ready = null; throw e; });
  return ready;
}

async function query(text, params) {
  await init();
  return getPool().query(text, params);
}

async function tx(fn) {
  await init();
  const c = await getPool().connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    c.release();
  }
}

module.exports = { query, tx };
