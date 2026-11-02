const db = require('./_lib/db');
const { userIdFromRequest, getUser, createGuest, setSession } = require('./_lib/auth');
const { ITEMS, SIDES } = require('./_lib/catalog');
const store = require('./_lib/store');
const { send, readJson, route } = require('./_lib/http');

// Uma única instrução SQL atômica: desconta o custo SÓ se houver saldo e registra no histórico.
// Nunca fica negativo, mesmo com cliques simultâneos, e usa 1 ida ao banco (importante sob carga).
const SPEND = `
  WITH upd AS (UPDATE users SET credits = credits - $1::int WHERE id = $2 AND credits >= $1::int RETURNING id, credits),
       led AS (INSERT INTO ledger (user_id, delta, reason, ref) SELECT id, -$1::int, 'item', $3 FROM upd)
  SELECT credits FROM upd`;
async function spend(userId, cost, itemId) {
  const r = await db.query(SPEND, [cost, userId, itemId]);
  return r.rowCount ? r.rows[0].credits : null;
}

module.exports = route('POST', async (req, res) => {
  const body = await readJson(req);
  const itemId = body && body.itemId;
  if (typeof itemId !== 'string' || !Object.prototype.hasOwnProperty.call(ITEMS, itemId)) {
    return send(res, 400, { error: 'item inválido' });
  }
  const cost = ITEMS[itemId];

  let credits = null, created = null;
  const id = userIdFromRequest(req);
  if (id) credits = await spend(id, cost, itemId);                 // caminho comum: 1 ida ao banco
  if (credits === null) {
    const existing = id ? await getUser(id).catch(() => null) : null;
    if (existing) return send(res, 402, { error: 'créditos insuficientes', credits: existing.credits });
    created = await createGuest();                                 // 1º uso: a conta nasce agora, com boas-vindas
    setSession(res, created.id);
    credits = await spend(created.id, cost, itemId);
    if (credits === null) return send(res, 402, { error: 'créditos insuficientes', credits: created.credits });
  }

  // soma no placar global (se o Redis atrasar, não trava a compra)
  const side = SIDES[itemId];
  await Promise.race([
    store.add(side === 'love' ? cost : 0, side === 'hate' ? cost : 0),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch((e) => console.error('placar:', e.message));
  send(res, 200, { credits, ts: Date.now(), recoveryCode: created ? created.recovery_code : undefined });
});
