const Stripe = require('stripe');
const { requireUser } = require('./_lib/auth');
const { PACKS } = require('./_lib/catalog');
const { send, readJson, baseUrl, route } = require('./_lib/http');

// Cria a sessão do Stripe Checkout. Preço e créditos vêm do servidor, nunca do navegador.
module.exports = route('POST', async (req, res) => {
  const body = await readJson(req);
  const pack = PACKS.find((p) => p.id === (body && body.packId));
  if (!pack) return send(res, 400, { error: 'pacote inválido' });

  const u = await requireUser(req, res);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const url = baseUrl(req);

  let session;
  try {
    session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // Sem payment_method_types: o Stripe mostra os meios ativados no painel
    // (Settings > Payment methods). Ativando o Pix lá, ele aparece sozinho.
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'brl',
        unit_amount: pack.amount,
        product_data: { name: `${pack.credits} créditos - Danilão: Love vs Hate` },
      },
    }],
    client_reference_id: u.id,
    metadata: { userId: u.id, packId: pack.id },
    success_url: `${url}/?pagamento=ok`,
    cancel_url: `${url}/?pagamento=cancelado`,
    });
  } catch (e) {
    console.error('stripe checkout falhou:', e.message);
    return send(res, 502, { error: 'pagamento indisponível', detail: e.message });
  }

  send(res, 200, { url: session.url });
});
