const store = require('./_lib/store');
const { identify } = require('./_lib/auth');
const { send, readJson, route } = require('./_lib/http');

const MAX_PER_REQUEST = 60;     // pontos por lado em cada envio
const MAX_PER_MINUTE_USER = 240; // por jogador
const MAX_PER_MINUTE_IP = 3000;  // por rede (wifi compartilhado)

// Pontos dos toques grátis, enviados em lote pelo navegador.
module.exports = route('POST', async (req, res) => {
  const body = (await readJson(req)) || {};
  const clamp = (v) => Math.max(0, Math.min(MAX_PER_REQUEST, Math.floor(Number(v) || 0)));
  const love = clamp(body.love), hate = clamp(body.hate);
  if (!love && !hate) return send(res, 200, { ok: true });

  const who = identify(req) || 'anon';
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const accepted = await store.tap('tap:u:' + who, 'tap:ip:' + ip, love, hate, MAX_PER_MINUTE_USER, MAX_PER_MINUTE_IP);
  send(res, 200, accepted ? { ok: true, ts: Date.now() } : { ok: true, dropped: true });
});
