const db = require('./_lib/db');
const { setSession, normalizeCode } = require('./_lib/auth');
const { send, readJson, route } = require('./_lib/http');

// Entra numa conta existente pelo código de recuperação.
module.exports = route('POST', async (req, res) => {
  const body = await readJson(req);
  const code = normalizeCode(body && body.code);
  if (!code) return send(res, 400, { error: 'código inválido' });
  const r = await db.query('SELECT id, credits, recovery_code FROM users WHERE recovery_code = $1', [code]);
  if (!r.rows[0]) return send(res, 404, { error: 'código não encontrado' });
  setSession(res, r.rows[0].id);
  send(res, 200, { credits: r.rows[0].credits, recoveryCode: r.rows[0].recovery_code });
});
