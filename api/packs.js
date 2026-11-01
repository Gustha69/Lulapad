const { PACKS, brl } = require('./_lib/catalog');
const { send, route } = require('./_lib/http');

module.exports = route('GET', async (req, res) => {
  send(res, 200, { packs: PACKS.map((p) => ({ id: p.id, credits: p.credits, price: brl(p.amount), tag: p.tag })) });
});
