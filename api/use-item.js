const db = require('./_lib/db');
const { requireUser } = require('./_lib/auth');
const { ITEMS } = require('./_lib/catalog');
const { send, readJson, route } = require('./_lib/http');

// Desconta o custo do item numa única operação atômica: nunca fica negativo,
// mesmo com dois cliques simultâneos.
module.exports = route('POST', async (req, res) => {
  const body = await readJson(req);
  const itemId = body && body.itemId;
  if (typeof itemId !== 'string' || !Object.prototype.hasOwnProperty.call(ITEMS, itemId)) {
    return send(res, 400, { error: 'item inválido' });
  }
  const cost = ITEMS[itemId];
  const u = await requireUser(req, res);

  const out = await db.tx(async (c) => {
    const r = await c.query(
      'UPDATE users SET credits = credits - $1 WHERE id = $2 AND credits >= $1 RETURNING credits',
      [cost, u.id]
    );
    if (!r.rowCount) return null;
    await c.query("INSERT INTO ledger (user_id, delta, reason, ref) VALUES ($1, $2, 'item', $3)", [u.id, -cost, itemId]);
    return r.rows[0].credits;
  });

  if (out === null) {
    const cur = await db.query('SELECT credits FROM users WHERE id = $1', [u.id]);
    return send(res, 402, { error: 'créditos insuficientes', credits: cur.rows[0].credits });
  }
  send(res, 200, { credits: out });
});
