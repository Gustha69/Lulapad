function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Aceita só POST com JSON (junto com SameSite=Lax, barra requisições forjadas de outros sites).
async function readJson(req) {
  if (!/application\/json/i.test(req.headers['content-type'] || '')) return null;
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return null; }
}

function baseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

// Envolve um handler com método permitido e tratamento de erro.
function route(method, fn) {
  return async (req, res) => {
    try {
      if (req.method !== method) { res.setHeader('Allow', method); return send(res, 405, { error: 'método não permitido' }); }
      await fn(req, res);
    } catch (e) {
      console.error(e);
      send(res, 500, { error: 'erro interno' });
    }
  };
}

module.exports = { send, readJson, baseUrl, route };
