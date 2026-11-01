# Publicar e testar pagamentos

Resultado final: um link como `https://lulapad.vercel.app`, que abre direto no navegador (celular ou PC).

## 1. Banco de dados (Supabase ou Neon, plano grátis)
**Supabase (recomendado):** crie conta em https://supabase.com e um projeto (anote a senha do banco).
Clique em **Connect**, escolha **Transaction pooler**, copie a URL, troque `[YOUR-PASSWORD]` pela senha
e acrescente `?sslmode=require` no final. Essa URL é a `DATABASE_URL`.

**Neon (alternativa):**
1. Crie conta em https://neon.tech e um projeto (região São Paulo, se houver).
2. Copie a **Connection string** (`postgres://...?sslmode=require`). É o `DATABASE_URL`.
As tabelas são criadas sozinhas na primeira requisição.

## 2. Stripe (modo teste primeiro)
1. Crie conta em https://dashboard.stripe.com/register (não há mensalidade; só paga taxa por venda).
2. Deixe o interruptor **Modo de teste** ligado. Em *Developers > API keys* copie a **Secret key** (`sk_test_...`).
3. *Settings > Payment methods*: confirme **Cartões** e **Pix** ativos. O Pix exige conta com país Brasil
   e pode pedir verificação da empresa/CPF antes de liberar.

## 3. Publicar na Vercel (plano Hobby é grátis)
1. https://vercel.com > **Add New > Project** > importe o repositório `Gustha69/Lulapad` (branch com este código).
2. Framework Preset: **Other**. Não precisa de build. A pasta `public/` vira o site e `api/` vira o backend.
3. Em **Environment Variables** cadastre: `DATABASE_URL`, `STRIPE_SECRET_KEY` (`sk_test_...`),
   `SESSION_SECRET` (gere com `openssl rand -hex 32`), `APP_URL` (a URL final, ex. `https://lulapad.vercel.app`),
   `WELCOME_CREDITS` (opcional). Faça **Deploy**.
4. Se a URL final for diferente da prevista, corrija `APP_URL` e faça **Redeploy**.

## 4. Webhook (é ele que libera os créditos)
1. Stripe > *Developers > Webhooks > Add endpoint* (em modo teste).
2. URL: `https://SEU-SITE.vercel.app/api/webhook`
3. Eventos: `checkout.session.completed` e `checkout.session.async_payment_succeeded`.
4. Copie o **Signing secret** (`whsec_...`) para a variável `STRIPE_WEBHOOK_SECRET` na Vercel e faça **Redeploy**.

## 5. Testar sem cobrar de verdade (modo teste)
1. Abra o site, toque no contador de créditos e escolha um pacote.
2. No Stripe Checkout use o cartão **4242 4242 4242 4242**, validade futura qualquer, CVC qualquer, nome qualquer.
   - Recusado: `4000 0000 0000 0002`
   - Exige autenticação 3D Secure: `4000 0027 6000 3184`
3. Ao voltar ao jogo o saldo sobe em poucos segundos. Confira em Stripe > Webhooks que a entrega deu **200**.
4. **Pix em teste**: escolha Pix no Checkout; a página de teste do Stripe tem botão para simular o pagamento
   (ou falha). O crédito só entra após o pagamento simulado ser confirmado.
5. Confira: usar item desconta; saldo insuficiente abre a loja; recarregar a página mantém o saldo;
   abrir em outro navegador com o código de recuperação traz o mesmo saldo.
6. Para testar localmente: `npx vercel dev` + `stripe listen --forward-to localhost:3000/api/webhook`.

## 6. Ir para valer (cobrar de verdade)
1. Conclua a ativação da conta Stripe (dados, conta bancária para receber).
2. Desligue o **Modo de teste** e copie a nova `sk_test` -> **`sk_live_...`**.
3. Crie o webhook de novo **em modo real** (mesma URL e eventos) e copie o novo `whsec_...`.
4. Troque `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` na Vercel e faça **Redeploy**.
5. Faça uma compra real do pacote de R$ 2,00 com seu cartão e confira o saldo; depois pode reembolsar no painel.
6. Checklist legal: política de privacidade, termos de venda e canal de contato; créditos são produto digital
   (direito de arrependimento de 7 dias do CDC pode se aplicar). Consulte um contador sobre emissão de nota.

## Custos
- Vercel Hobby e Neon Free: R$ 0 para começar (Hobby é para uso não comercial pelos termos da Vercel;
  cobrando de verdade, o plano Pro da Vercel é o adequado).
- Stripe: sem mensalidade; taxa por transação (cartão com percentual + valor fixo, Pix com percentual menor).
  Confira os valores atuais em https://stripe.com/br/pricing. O valor fixo pesa muito no pacote de R$ 2,00.
