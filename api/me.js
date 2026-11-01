const { requireUser } = require('./_lib/auth');
const { send, route } = require('./_lib/http');

// Devolve o saldo (cria conta convidada na primeira visita).
module.exports = route('GET', async (req, res) => {
  const u = await requireUser(req, res);
  send(res, 200, { credits: u.credits, recoveryCode: u.recovery_code });
});
