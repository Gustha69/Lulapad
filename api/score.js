const store = require('./_lib/store');
const { route } = require('./_lib/http');

// Placar global. A resposta fica em cache na CDN por poucos segundos: milhares de
// jogadores consultando geram só algumas leituras por segundo no Redis.
module.exports = route('GET', async (req, res) => {
  const s = await store.get();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=2, s-maxage=3, stale-while-revalidate=10');
  res.end(JSON.stringify({ ...s, ts: Date.now() }));
});
