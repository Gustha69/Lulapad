const { userIdFromRequest, getUser, ensureAnon } = require('./_lib/auth');
const { send, route } = require('./_lib/http');

// Devolve o saldo. Visitante novo NÃO cria conta aqui (sem escrita no banco): a conta
// nasce na primeira compra ou no primeiro uso de item, com os créditos de boas-vindas.
module.exports = route('GET', async (req, res) => {
  const id = userIdFromRequest(req);
  const u = id ? await getUser(id).catch(() => null) : null;
  if (u) return send(res, 200, { credits: u.credits, recoveryCode: u.recovery_code });
  ensureAnon(req, res);
  const welcome = Math.max(0, parseInt(process.env.WELCOME_CREDITS ?? '10', 10) || 0);
  send(res, 200, { credits: welcome, recoveryCode: null, guest: true });
});
