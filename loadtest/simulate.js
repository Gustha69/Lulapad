// Simula N jogadores simultâneos (padrão 10.000). Cada um abre o jogo (/api/me) e, a cada ~5 s, consulta o
// placar e envia um lote de toques; ~5% também usam itens pagos (gravam no Postgres).
// Roda no PIOR CASO: sem o cache da CDN (em produção a CDN absorve a maior parte das consultas do placar).
// Uso: DATABASE_URL=... node loadtest/simulate.js [jogadores] [segundos]
const { fork } = require('child_process');
const http = require('http');
const path = require('path');
const N = Number(process.argv[2]) || 10000, SECONDS = Number(process.argv[3]) || 30;
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'segredo-de-teste-bem-longo-123456';
const auth = require('../api/_lib/auth'); const db = require('../api/_lib/db');

const agent = new http.Agent({ keepAlive: true, maxSockets: Number(process.env.SOCKETS) || 1500 });
function req(port, method, p, body, cookie, ip) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint(); const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port, path: p, method, agent, headers: { ...(ip ? { 'x-forwarded-for': ip } : {}), ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...(cookie ? { cookie } : {}) } }, (res) => {
      let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve({ status: res.statusCode, ms: Number(process.hrtime.bigint() - t0) / 1e6, body: b, sc: res.headers['set-cookie'] }));
    });
    r.on('error', (e) => { global.__e = global.__e || e.code + ' ' + e.message; resolve({ status: 0, ms: Number(process.hrtime.bigint() - t0) / 1e6 }); });
    r.setTimeout(30000, () => r.destroy());
    if (data) r.write(data); r.end();
  });
}
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const child = fork(path.join(__dirname, 'server.js'), [String(process.env.WORKERS || 2)], { env: process.env, silent: true });
  const port = await new Promise((ok) => child.stdout.on('data', (d) => { const m = /PORT (\d+)/.exec(String(d)); if (m) ok(Number(m[1])); }));
  const payers = Math.round(N * 0.05), cookies = [];
  for (let i = 0; i < payers; i++) { const u = await auth.createGuest(); cookies.push('lp_session=' + auth.sessionValue(u.id)); }
  console.log(`servidor local na porta ${port}; ${N} jogadores, ${payers} com conta para comprar itens; ${SECONDS}s`);

  const lat = { me: [], score: [], tap: [], item: [] }, st = { ok: 0, err: 0, limited402: 0 };
  let sentLove = 0, sentHate = 0, itemLove = 0;
  const record = (k, r) => { lat[k].push(r.ms); if (r.status === 200) st.ok++; else if (r.status === 402) st.limited402++; else st.err++; };
  const end = Date.now() + SECONDS * 1000, t0 = Date.now();

  async function player(i) {
    await sleep(Math.random() * 3000);                    // chegam em ~3 s
    const ip = `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;       // cada jogador, um IP
    const first = await req(port, 'GET', '/api/me', null, null, ip);
    record('me', first);
    let jar = first.sc ? first.sc[0].split(';')[0] : '';                    // guarda o cookie anônimo
    const buyer = i < payers ? cookies[i] : null;
    while (Date.now() < end) {
      record('score', await req(port, 'GET', '/api/score', null, null, ip));
      const love = Math.floor(Math.random() * 12), hate = Math.floor(Math.random() * 4);
      const r = await req(port, 'POST', '/api/tap', { love, hate }, buyer || jar, ip);
      record('tap', r); if (r.status === 200) { sentLove += love; sentHate += hate; }
      if (buyer && Math.random() < 0.3) { const it = await req(port, 'POST', '/api/use-item', { itemId: 'star' }, buyer, ip); record('item', it); if (it.status === 200) itemLove += 5; }
      await sleep(4000 + Math.random() * 2000);
    }
  }
  await Promise.all(Array.from({ length: N }, (_, i) => player(i)));
  const secs = (Date.now() - t0) / 1000;
  const sc = await req(port, 'GET', '/api/score'); const totals = JSON.parse(sc.body);
  const total = Object.values(lat).reduce((a, l) => a + l.length, 0);
  console.log('primeiro erro:', global.__e); console.log(`\nrequisições: ${total} em ${secs.toFixed(0)}s (${(total / secs).toFixed(0)} req/s)  | 200: ${st.ok}  | 402 (sem saldo): ${st.limited402}  | ERROS: ${st.err}`);
  for (const [k, l] of Object.entries(lat)) if (l.length) console.log(`  ${k.padEnd(5)} n=${String(l.length).padStart(6)}  p50=${pct(l, .5).toFixed(0)}ms  p95=${pct(l, .95).toFixed(0)}ms  p99=${pct(l, .99).toFixed(0)}ms  máx=${Math.max(...l).toFixed(0)}ms`);
  console.log(`placar no servidor: love=${totals.love} hate=${totals.hate}`);
  console.log(`enviado pelos jogadores: love=${sentLove}+${itemLove} (itens) hate=${sentHate}  -> esperado love=${sentLove + itemLove}`);
  const ok = st.err === 0 && sentLove + sentHate + itemLove > 0 && totals.hate === sentHate && totals.love === sentLove + itemLove;
  console.log(ok ? 'RESULTADO: SEM ERROS e a soma do placar confere (nenhum ponto perdido ou duplicado)' : 'RESULTADO: FALHOU (erros ou soma diferente)');
  try { process.kill(child.pid, 'SIGTERM'); } catch (e) {} await db.query('SELECT 1'); process.exit(0);
})();
