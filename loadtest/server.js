// Servidor local para teste de carga: as mesmas funções da API, em VÁRIOS processos (como as instâncias
// da Vercel) + Redis falso (protocolo Upstash). Uso: DATABASE_URL=... node loadtest/server.js [processos]
const cluster = require('cluster');
const http = require('http');
const WORKERS = Number(process.argv[2]) || 2;
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'segredo-de-teste-bem-longo-123456';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'; process.env.WELCOME_CREDITS = '10';
const REDIS_PORT = Number(process.env.FAKE_REDIS_PORT) || 47999;

if (cluster.isPrimary) {
  const kv = new Map();
  http.createServer((req, res) => {
    let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
      const out = JSON.parse(b).map(([cmd, ...a]) => {
        if (cmd === 'INCRBY') { const v = (kv.get(a[0]) || 0) + Number(a[1]); kv.set(a[0], v); return { result: v }; }
        if (cmd === 'MGET') return { result: a.map((k) => (kv.has(k) ? String(kv.get(k)) : null)) };
        if (cmd === 'EVAL') {
          const [, , k1, k2, n, lu, li, lo, ha] = a;
          const u = (kv.get(k1) || 0) + Number(n); kv.set(k1, u); const i = (kv.get(k2) || 0) + Number(n); kv.set(k2, i);
          if (u > Number(lu) || i > Number(li)) return { result: 0 };
          if (Number(lo)) kv.set('score:love', (kv.get('score:love') || 0) + Number(lo));
          if (Number(ha)) kv.set('score:hate', (kv.get('score:hate') || 0) + Number(ha));
          return { result: 1 };
        }
        return { result: 1 };
      });
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(out));
    });
  }).listen(REDIS_PORT, () => {
    for (let i = 0; i < WORKERS; i++) cluster.fork();
    let up = 0;
    cluster.on('listening', () => { if (++up === WORKERS) console.log('PORT ' + (process.env.LOAD_PORT || 48000)); });
  });
} else {
  process.env.UPSTASH_REDIS_REST_URL = 'http://127.0.0.1:' + REDIS_PORT; process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
  const h = { '/api/me': require('../api/me'), '/api/score': require('../api/score'), '/api/tap': require('../api/tap'), '/api/use-item': require('../api/use-item') };
  const srv = http.createServer((q, r) => { const f = h[q.url.split('?')[0]]; if (!f) { r.statusCode = 404; return r.end(); } f(q, r); });
  srv.keepAliveTimeout = 65000; srv.headersTimeout = 66000;
  srv.listen(Number(process.env.LOAD_PORT) || 48000, '0.0.0.0', 4096);
}
