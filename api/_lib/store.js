// Placar global e limite de uso (rate limit).
// Produção: Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) — aguenta milhares de somas por segundo.
// Sem essas variáveis: usa o Postgres (serve para desenvolvimento e poucos jogadores, NÃO para multidão).
const db = require('./db');

const redisOn = () => !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

async function redis(commands) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(2500),
  });
  if (!r.ok) throw new Error('redis http ' + r.status);
  const out = await r.json();
  return out.map((x) => { if (x && x.error) throw new Error('redis: ' + x.error); return x.result; });
}

// Soma pontos no placar global.
async function add(love, hate) {
  love = Math.max(0, Math.floor(love || 0)); hate = Math.max(0, Math.floor(hate || 0));
  if (!love && !hate) return;
  if (redisOn()) {
    const cmds = [];
    if (love) cmds.push(['INCRBY', 'score:love', love]);
    if (hate) cmds.push(['INCRBY', 'score:hate', hate]);
    await redis(cmds);
    return;
  }
  for (const [side, n] of [['love', love], ['hate', hate]]) {
    if (n) await db.query('INSERT INTO score (side, total) VALUES ($1, $2) ON CONFLICT (side) DO UPDATE SET total = score.total + $2', [side, n]);
  }
}

async function get() {
  if (redisOn()) {
    const [[l, h]] = await redis([['MGET', 'score:love', 'score:hate']]);
    return { love: Number(l) || 0, hate: Number(h) || 0 };
  }
  const r = await db.query('SELECT side, total FROM score');
  const o = { love: 0, hate: 0 };
  r.rows.forEach((x) => { o[x.side] = Number(x.total); });
  return o;
}

// Limite de uso: soma n ao contador da chave dentro da janela; true se ainda está dentro do limite.
const mem = new Map();
async function consume(key, n, limit, windowSec) {
  if (redisOn()) {
    try {
      const [count] = await redis([['INCRBY', 'rl:' + key, n], ['EXPIRE', 'rl:' + key, windowSec, 'NX']]);
      return Number(count) <= limit;
    } catch (e) { return true; } // se o Redis falhar, não derruba o jogo
  }
  const now = Date.now();
  let e = mem.get(key);
  if (!e || e.reset < now) { e = { count: 0, reset: now + windowSec * 1000 }; mem.set(key, e); }
  e.count += n;
  if (mem.size > 50000) for (const [k, v] of mem) if (v.reset < now) mem.delete(k);
  return e.count <= limit;
}

// Envio de toques em UMA chamada atômica: confere os limites (jogador e rede) e só então soma no placar.
const TAP_LUA = `
local u = redis.call('INCRBY', KEYS[1], ARGV[1]); if u == tonumber(ARGV[1]) then redis.call('EXPIRE', KEYS[1], 60) end
local i = redis.call('INCRBY', KEYS[2], ARGV[1]); if i == tonumber(ARGV[1]) then redis.call('EXPIRE', KEYS[2], 60) end
if u > tonumber(ARGV[2]) or i > tonumber(ARGV[3]) then return 0 end
if tonumber(ARGV[4]) > 0 then redis.call('INCRBY', 'score:love', ARGV[4]) end
if tonumber(ARGV[5]) > 0 then redis.call('INCRBY', 'score:hate', ARGV[5]) end
return 1`;
async function tap(userKey, ipKey, love, hate, limitUser, limitIp) {
  const n = love + hate;
  if (redisOn()) {
    try {
      const [ok] = await redis([['EVAL', TAP_LUA, 2, 'rl:' + userKey, 'rl:' + ipKey, n, limitUser, limitIp, love, hate]]);
      return Number(ok) === 1;
    } catch (e) { console.error('tap:', e.message); return false; }
  }
  const okU = await consume(userKey, n, limitUser, 60), okI = await consume(ipKey, n, limitIp, 60);
  if (!okU || !okI) return false;
  await add(love, hate);
  return true;
}

module.exports = { add, get, consume, tap, redisOn };
