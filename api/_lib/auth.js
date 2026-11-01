const crypto = require('crypto');
const db = require('./db');

const COOKIE = 'lp_session';
const MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET ausente ou curto demais');
  return s;
}
const sign = (v) => crypto.createHmac('sha256', secret()).update(v).digest('base64url');

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setSession(res, userId) {
  const v = userId + '.' + sign(userId);
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`);
}

function userIdFromRequest(req) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  if (i < 0) return null;
  const id = raw.slice(0, i), mac = raw.slice(i + 1);
  const expected = sign(id);
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return id;
}

// Código tipo "K7M2-9QXP-4WRD" (alfabeto sem 0/O/1/I), ~60 bits.
function newRecoveryCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  let s = '';
  for (let i = 0; i < 12; i++) s += A[bytes[i] % A.length];
  return s.match(/.{4}/g).join('-');
}
const normalizeCode = (c) => {
  const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length === 12 ? s.match(/.{4}/g).join('-') : '';
};

async function createGuest() {
  const welcome = Math.max(0, parseInt(process.env.WELCOME_CREDITS ?? '10', 10) || 0);
  return db.tx(async (c) => {
    const r = await c.query(
      'INSERT INTO users (recovery_code, credits) VALUES ($1, $2) RETURNING id, credits, recovery_code',
      [newRecoveryCode(), welcome]
    );
    const u = r.rows[0];
    if (welcome) await c.query("INSERT INTO ledger (user_id, delta, reason) VALUES ($1, $2, 'welcome')", [u.id, welcome]);
    return u;
  });
}

async function getUser(id) {
  const r = await db.query('SELECT id, credits, recovery_code FROM users WHERE id = $1', [id]);
  return r.rows[0] || null;
}

// Retorna o usuário da sessão; cria uma conta convidada se não houver cookie válido.
async function requireUser(req, res) {
  const id = userIdFromRequest(req);
  let u = id ? await getUser(id).catch(() => null) : null;
  if (!u) { u = await createGuest(); setSession(res, u.id); }
  return u;
}

module.exports = { requireUser, getUser, setSession, normalizeCode, userIdFromRequest };
