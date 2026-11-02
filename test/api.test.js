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
const auth = require('../api/_lib/auth');
const handlers = {
  '/api/me': require('../api/me'),
  '/api/use-item': require('../api/use-item'),
  '/api/recover': require('../api/recover'),
  '/api/packs': require('../api/packs'),
  '/api/webhook': require('../api/webhook'),
  '/api/score': require('../api/score'),
  '/api/tap': require('../api/tap'),
};

// Redis falso (mesmo protocolo REST do Upstash: /pipeline) para testar o caminho de produção.
const kv = new Map(); let redisDown = false;
const fakeRedis = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
    if (redisDown) { res.statusCode = 500; return res.end('{}'); }
    if (req.headers.authorization !== 'Bearer tok') { res.statusCode = 401; return res.end('{}'); }
    const out = JSON.parse(b).map(([cmd, ...a]) => {
      if (cmd === 'INCRBY') { const v = (kv.get(a[0]) || 0) + Number(a[1]); kv.set(a[0], v); return { result: v }; }
      if (cmd === 'MGET') return { result: a.map((k) => (kv.has(k) ? String(kv.get(k)) : null)) };
      if (cmd === 'EXPIRE') return { result: 1 };
      if (cmd === 'EVAL') { // emula o script de toques
        const [, , k1, k2, n, lu, li, lo, ha] = a;
        const u = (kv.get(k1) || 0) + Number(n); kv.set(k1, u);
        const i = (kv.get(k2) || 0) + Number(n); kv.set(k2, i);
        if (u > Number(lu) || i > Number(li)) return { result: 0 };
        if (Number(lo)) kv.set('score:love', (kv.get('score:love') || 0) + Number(lo));
        if (Number(ha)) kv.set('score:hate', (kv.get('score:hate') || 0) + Number(ha));
        return { result: 1 };
      }
      return { error: 'unknown ' + cmd };
    });
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(out));
  });
});

let server, base;
test.before(async () => {
  await new Promise((r) => fakeRedis.listen(0, r));
  process.env.UPSTASH_REDIS_REST_URL = 'http://127.0.0.1:' + fakeRedis.address().port;
  process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
  server = http.createServer((req, res) => {
    const h = handlers[req.url.split('?')[0]];
    if (!h) { res.statusCode = 404; return res.end(); }
    h(req, res);
  });
  await new Promise((r) => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => { server.close(); fakeRedis.close(); await db.query('SELECT 1'); process.exit(0); });

function client(initialCookie = '') {
  let cookie = initialCookie;
  return async (path, body, headers = {}) => {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return { status: r.status, data: await r.json().catch(() => ({})), headers: r.headers };
  };
}
// Conta já existente (como depois do 1º uso): devolve cliente logado + usuário.
async function account() {
  const u = await auth.createGuest();
  return { c: client('lp_session=' + auth.sessionValue(u.id)), u };
}
const score = () => kv;
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

test('visitante novo NÃO grava no banco; conta nasce no primeiro uso, com boas-vindas', async () => {
  const before = Number((await db.query('SELECT count(*) FROM users')).rows[0].count);
  const c = client();
  const a = await c('/api/me');
  assert.equal(a.status, 200); assert.equal(a.data.credits, 10); assert.equal(a.data.recoveryCode, null); assert.equal(a.data.guest, true);
  await c('/api/me'); await c('/api/score');
  assert.equal(Number((await db.query('SELECT count(*) FROM users')).rows[0].count), before, 'visitar não cria conta');
  const u = await c('/api/use-item', { itemId: 'star' });
  assert.equal(u.status, 200); assert.equal(u.data.credits, 5);
  assert.match(u.data.recoveryCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(Number((await db.query('SELECT count(*) FROM users')).rows[0].count), before + 1);
  const me = await c('/api/me'); assert.equal(me.data.credits, 5); assert.equal(me.data.recoveryCode, u.data.recoveryCode);
});

test('cookie adulterado não herda a conta', async () => {
  const { c, u } = await account(); const a = await c('/api/me');
  assert.equal(a.data.recoveryCode, u.recovery_code);
  const bad = await fetch(base + '/api/me', { headers: { cookie: 'lp_session=' + u.id + '.xxxx' } });
  assert.notEqual((await bad.json()).recoveryCode, u.recovery_code);
});

test('use-item desconta, recusa saldo insuficiente e item inválido', async () => {
  const { c } = await account();
  assert.equal((await c('/api/use-item', { itemId: 'star' })).data.credits, 5);
  assert.equal((await c('/api/use-item', { itemId: 'star' })).data.credits, 0);
  const no = await c('/api/use-item', { itemId: 'star' });
  assert.equal(no.status, 402); assert.equal(no.data.credits, 0);
  assert.equal((await c('/api/use-item', { itemId: 'hack' })).status, 400);
  assert.equal((await c('/api/use-item', { itemId: '__proto__' })).status, 400);
});

test('cliques simultâneos nunca deixam o saldo negativo', async () => {
  const { c } = await account(); // 10 créditos, star = 5
  const rs = await Promise.all(Array.from({ length: 8 }, () => c('/api/use-item', { itemId: 'star' })));
  assert.equal(rs.filter((r) => r.status === 200).length, 2);
  assert.equal((await c('/api/me')).data.credits, 0);
});

test('webhook: assinatura inválida é rejeitada e não credita', async () => {
  const { c, u } = await account();
  assert.equal(await postWebhook(evt('checkout.session.completed', paidSession(u.id)), 'whsec_errado'), 400);
  assert.equal((await c('/api/me')).data.credits, 10);
});

test('webhook: credita só se pago, e uma única vez (idempotente)', async () => {
  const { c, u } = await account();
  assert.equal(await postWebhook(evt('checkout.session.completed', paidSession(u.id, { payment_status: 'unpaid' }))), 200);
  assert.equal((await c('/api/me')).data.credits, 10);
  const s = paidSession(u.id);
  assert.equal(await postWebhook(evt('checkout.session.completed', s)), 200);
  assert.equal(await postWebhook(evt('checkout.session.completed', s)), 200);
  assert.equal(await postWebhook(evt('checkout.session.async_payment_succeeded', s)), 200);
  assert.equal((await c('/api/me')).data.credits, 60);
  await postWebhook(evt('checkout.session.completed', paidSession(u.id, { amount_total: 1 })));
  assert.equal((await c('/api/me')).data.credits, 60);
});

test('webhook concorrente da mesma sessão credita uma vez', async () => {
  const { c, u } = await account();
  const s = paidSession(u.id);
  await Promise.all(Array.from({ length: 5 }, () => postWebhook(evt('checkout.session.completed', s))));
  assert.equal((await c('/api/me')).data.credits, 60);
});

test('recuperação por código restaura a conta em outro aparelho', async () => {
  const { u } = await account();
  const b = client();
  assert.equal((await b('/api/recover', { code: 'AAAA-AAAA-AAAA' })).status, 404);
  assert.equal((await b('/api/recover', { code: 'curto' })).status, 400);
  const r = await b('/api/recover', { code: u.recovery_code.toLowerCase().replace(/-/g, ' ') });
  assert.equal(r.status, 200);
  assert.equal((await b('/api/me')).data.recoveryCode, u.recovery_code);
});

test('packs expõe preços do servidor', async () => {
  const r = await client()('/api/packs');
  assert.deepEqual(r.data.packs.map((p) => [p.credits, p.price]), [[10, 'R$ 2,00'], [50, 'R$ 7,99'], [100, 'R$ 49,99']]);
});

test('POST sem JSON é recusado', async () => {
  const r = await fetch(base + '/api/use-item', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"itemId":"star"}' });
  assert.equal(r.status, 400);
});

// ---------- placar global ----------
test('placar global: itens somam o custo do lado certo; resposta com cache de CDN', async () => {
  kv.clear();
  const { c } = await account();
  const s0 = await c('/api/score');
  assert.deepEqual([s0.data.love, s0.data.hate], [0, 0]);
  assert.match(s0.headers.get('cache-control'), /s-maxage=3/);
  assert.ok(s0.data.ts > 0, 'resposta traz o relógio do servidor');
  await c('/api/use-item', { itemId: 'star' }); // love +5
  await c('/api/use-item', { itemId: 'star' }); // love +5
  const { c: c2 } = await account();
  await c2('/api/use-item', { itemId: 'piggy' }); // hate +5
  await c2('/api/use-item', { itemId: 'piggy' }); // hate +5
  const s1 = await c('/api/score');
  assert.deepEqual([s1.data.love, s1.data.hate], [10, 10]);
});

test('placar global: item recusado (sem saldo) não soma', async () => {
  kv.clear();
  const { c } = await account();
  await c('/api/use-item', { itemId: 'picanha' }); // 20 > 10 créditos
  assert.deepEqual([(await c('/api/score')).data.love, (await c('/api/score')).data.hate], [0, 0]);
});

test('toques grátis: lote soma, limite por envio e por minuto, entrada inválida ignorada', async () => {
  kv.clear();
  const c = client(); await c('/api/me'); // visitante anônimo (cookie lp_anon)
  assert.equal((await c('/api/tap', { love: 10, hate: 4 })).status, 200);
  assert.equal(kv.get('score:love'), 10); assert.equal(kv.get('score:hate'), 4);
  await c('/api/tap', { love: 99999, hate: -5 });            // limita a 60 por lado, ignora negativo
  assert.equal(kv.get('score:love'), 70); assert.equal(kv.get('score:hate'), 4);
  await c('/api/tap', { love: 'abc', hate: null });          // ignorado
  assert.equal(kv.get('score:love'), 70);
  for (let i = 0; i < 6; i++) await c('/api/tap', { love: 60, hate: 0 }); // passa de 240/min
  assert.ok(kv.get('score:love') <= 70 + 240, 'limite por minuto respeitado: ' + kv.get('score:love'));
});

test('Redis fora do ar: compra continua funcionando e o placar não derruba a API', async () => {
  const { c } = await account(); redisDown = true;
  try {
    const r = await c('/api/use-item', { itemId: 'star' });
    assert.equal(r.status, 200); assert.equal(r.data.credits, 5);
    assert.equal((await c('/api/score')).status, 500); // o placar falha, o resto segue
  } finally { redisDown = false; }
});

test('sem Redis configurado: usa o Postgres (modo desenvolvimento)', async () => {
  const keep = { u: process.env.UPSTASH_REDIS_REST_URL, t: process.env.UPSTASH_REDIS_REST_TOKEN };
  delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    await db.query("DELETE FROM score");
    const { c } = await account();
    await c('/api/use-item', { itemId: 'beer' }); // love +10
    await c('/api/tap', { love: 0, hate: 7 });
    const s = await c('/api/score');
    assert.deepEqual([s.data.love, s.data.hate], [10, 7]);
  } finally { process.env.UPSTASH_REDIS_REST_URL = keep.u; process.env.UPSTASH_REDIS_REST_TOKEN = keep.t; }
});
