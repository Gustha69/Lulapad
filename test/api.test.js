// Testes de integração: precisam de um Postgres (TEST_DATABASE_URL).
// Ex.: TEST_DATABASE_URL=postgres://lp:lp@localhost/lp_test npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SESSION_SECRET = 'segredo-de-teste-bem-longo-123456';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.WELCOME_CREDITS = '10';

const Stripe = require('stripe');
const db = require('../api/_lib/db');
const handlers = {
  '/api/me': require('../api/me'),
  '/api/use-item': require('../api/use-item'),
  '/api/recover': require('../api/recover'),
  '/api/packs': require('../api/packs'),
  '/api/webhook': require('../api/webhook'),
};

let server, base;
test.before(async () => {
  server = http.createServer((req, res) => {
    const h = handlers[req.url.split('?')[0]];
    if (!h) { res.statusCode = 404; return res.end(); }
    h(req, res);
  });
  await new Promise((r) => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => { server.close(); await db.query('SELECT 1'); process.exit(0); });

function client() {
  let cookie = '';
  return async (path, body, headers = {}) => {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };
}

const stripe = new Stripe('sk_test_dummy');
async function postWebhook(payload, secret = 'whsec_test') {
  const body = JSON.stringify(payload);
  const sig = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  const r = await fetch(base + '/api/webhook', { method: 'POST', headers: { 'stripe-signature': sig, 'Content-Type': 'application/json' }, body });
  return r.status;
}
const evt = (type, session) => ({ id: 'evt_' + Math.random(), object: 'event', type, data: { object: session } });
const paidSession = (userId, over = {}) => ({
  id: 'cs_test_' + Math.random().toString(36).slice(2), object: 'checkout.session',
  payment_status: 'paid', currency: 'brl', amount_total: 799,
  metadata: { userId, packId: 'p50' }, ...over,
});

test('conta convidada nasce com créditos de boas-vindas e mantém sessão', async () => {
  const c = client();
  const a = await c('/api/me');
  assert.equal(a.status, 200);
  assert.equal(a.data.credits, 10);
  assert.match(a.data.recoveryCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  const b = await c('/api/me');
  assert.equal(b.data.recoveryCode, a.data.recoveryCode);
});

test('cookie adulterado não herda a conta', async () => {
  const c = client(); const a = await c('/api/me');
  const bad = await fetch(base + '/api/me', { headers: { cookie: 'lp_session=00000000-0000-0000-0000-000000000000.xxxx' } });
  const d = await bad.json();
  assert.notEqual(d.recoveryCode, a.data.recoveryCode);
});

test('use-item desconta, recusa saldo insuficiente e item inválido', async () => {
  const c = client(); await c('/api/me');
  assert.equal((await c('/api/use-item', { itemId: 'fish' })).data.credits, 5);
  assert.equal((await c('/api/use-item', { itemId: 'fish' })).data.credits, 0);
  const no = await c('/api/use-item', { itemId: 'fish' });
  assert.equal(no.status, 402); assert.equal(no.data.credits, 0);
  assert.equal((await c('/api/use-item', { itemId: 'hack' })).status, 400);
  assert.equal((await c('/api/use-item', { itemId: '__proto__' })).status, 400);
});

test('cliques simultâneos nunca deixam o saldo negativo', async () => {
  const c = client(); await c('/api/me'); // 10 créditos, fish = 5
  const rs = await Promise.all(Array.from({ length: 8 }, () => c('/api/use-item', { itemId: 'fish' })));
  assert.equal(rs.filter((r) => r.status === 200).length, 2);
  assert.equal((await c('/api/me')).data.credits, 0);
});

test('webhook: assinatura inválida é rejeitada e não credita', async () => {
  const c = client(); const me = await c('/api/me');
  const u = (await db.query('SELECT id FROM users WHERE recovery_code=$1', [me.data.recoveryCode])).rows[0];
  assert.equal(await postWebhook(evt('checkout.session.completed', paidSession(u.id)), 'whsec_errado'), 400);
  assert.equal((await c('/api/me')).data.credits, 10);
});

test('webhook: credita só se pago, e uma única vez (idempotente)', async () => {
  const c = client(); const me = await c('/api/me');
  const u = (await db.query('SELECT id FROM users WHERE recovery_code=$1', [me.data.recoveryCode])).rows[0];

  // não pago (ex.: Pix aguardando) -> nada
  assert.equal(await postWebhook(evt('checkout.session.completed', paidSession(u.id, { payment_status: 'unpaid' }))), 200);
  assert.equal((await c('/api/me')).data.credits, 10);

  // pago -> +50; reenvio e evento assíncrono da mesma sessão -> sem duplicar
  const s = paidSession(u.id);
  assert.equal(await postWebhook(evt('checkout.session.completed', s)), 200);
  assert.equal(await postWebhook(evt('checkout.session.completed', s)), 200);
  assert.equal(await postWebhook(evt('checkout.session.async_payment_succeeded', s)), 200);
  assert.equal((await c('/api/me')).data.credits, 60);

  // valor adulterado em relação ao catálogo -> ignorado
  await postWebhook(evt('checkout.session.completed', paidSession(u.id, { amount_total: 1 })));
  assert.equal((await c('/api/me')).data.credits, 60);
});

test('webhook concorrente da mesma sessão credita uma vez', async () => {
  const c = client(); const me = await c('/api/me');
  const u = (await db.query('SELECT id FROM users WHERE recovery_code=$1', [me.data.recoveryCode])).rows[0];
  const s = paidSession(u.id);
  await Promise.all(Array.from({ length: 5 }, () => postWebhook(evt('checkout.session.completed', s))));
  assert.equal((await c('/api/me')).data.credits, 60);
});

test('recuperação por código restaura a conta em outro aparelho', async () => {
  const a = client(); const me = await a('/api/me');
  const b = client();
  assert.equal((await b('/api/recover', { code: 'AAAA-AAAA-AAAA' })).status, 404);
  const r = await b('/api/recover', { code: me.data.recoveryCode.toLowerCase().replace(/-/g, ' ') });
  assert.equal(r.status, 200);
  assert.equal((await b('/api/me')).data.recoveryCode, me.data.recoveryCode);
});

test('packs expõe preços do servidor', async () => {
  const r = await client()('/api/packs');
  assert.deepEqual(r.data.packs.map((p) => [p.credits, p.price]), [[10, 'R$ 2,00'], [50, 'R$ 7,99'], [100, 'R$ 49,99']]);
});

test('POST sem JSON é recusado', async () => {
  const r = await fetch(base + '/api/use-item', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"itemId":"fish"}' });
  assert.equal(r.status, 400);
});
