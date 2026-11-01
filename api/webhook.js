const Stripe = require('stripe');
const db = require('./_lib/db');
const { PACKS } = require('./_lib/catalog');

// O Stripe assina o corpo bruto: o parser de JSON precisa ficar desligado.
module.exports.config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

// Soma os créditos UMA vez por sessão de pagamento (chave primária em payments).
async function creditSession(session) {
  if (session.payment_status !== 'paid') return 'ignorado: ainda não pago';
  const pack = PACKS.find((p) => p.id === (session.metadata && session.metadata.packId));
  const userId = session.metadata && session.metadata.userId;
  if (!pack || !userId) return 'ignorado: metadata inválida';
  // Confere valor e moeda contra o catálogo do servidor.
  if (session.currency !== 'brl' || session.amount_total !== pack.amount) return 'ignorado: valor diferente do catálogo';

  return db.tx(async (c) => {
    const ins = await c.query(
      'INSERT INTO payments (stripe_session_id, user_id, credits, amount_total) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [session.id, userId, pack.credits, session.amount_total]
    );
    if (!ins.rowCount) return 'já processado';
    const up = await c.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [pack.credits, userId]);
    if (!up.rowCount) throw new Error('usuário do pagamento não existe: ' + userId); // desfaz tudo; o Stripe tenta de novo
    await c.query("INSERT INTO ledger (user_id, delta, reason, ref) VALUES ($1, $2, 'purchase', $3)", [userId, pack.credits, session.id]);
    return 'creditado';
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  let event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(await rawBody(req), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    res.statusCode = 400;
    return res.end('assinatura inválida');
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const result = await creditSession(event.data.object);
      console.log(event.type, event.data.object.id, result);
    }
    res.statusCode = 200;
    res.end('ok');
  } catch (e) {
    console.error('falha ao creditar', e);
    res.statusCode = 500; // o Stripe reenvia
    res.end('erro');
  }
};
