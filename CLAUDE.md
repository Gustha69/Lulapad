# Danilão: Love vs Hate

Jogo web de brincadeira, publicado como **link** (não é app). Um personagem de desenho, o **Danilão**
(homem de terno azul e chapéu de palha; arte em `public/img/danilao.webp`, feita pelo dono do projeto, com 5 dedos em cada mão),
reage aos **itens** que o jogador usa, gastando **créditos**. Créditos são comprados com dinheiro real via **Stripe Checkout** (cartão e Pix).

## Mecânica
- Foco do jogo: a disputa **Love vs Hate**. Não existem mais fome, humor, energia, sono nem fala.
  Tocar na cabeça/barriga (+1 love) e no chapéu (+1 hate) é grátis.
- Itens **Love (azul)**: Estrela vermelha 5, Cerveja 10, Picanha 20.
- Itens **Hate (vermelho)**, todos em tom de comédia: Cofrinho 5, Queda da bolsa 15, Dedinho 30 (truque de mágica).
- **Cabo de guerra** é o placar: **1 crédito gasto = 1 ponto** para o lado do item; toques grátis somam 1.
  Ao chegar a diferença de 100 aparece "O Love venceu!" / "O Hate venceu!" e zera.
- **Humor visual:** com net = love - hate, a partir de 15, 40 e 70 pontos de diferença o Danilão fica mais feliz
  (bochechas, sorriso, olhos fechados de alegria) ou mais machucado (roxos, band-aid, olhos roxos, curativo no nariz).
  São camadas SVG em `public/index.html` (classes `lg1..lg3`, `hg1..hg3`) ligadas por `applyMood()` em `app.js`.
- Sons: áudios em `public/sounds/dan/` (voz do próprio dono do projeto): estrela, cerveja, picanha, moedinha
  (cofrinho), bolsa e dedinho. `SOUNDS` em `public/js/app.js` aponta um arquivo por reação (veja
  `public/sounds/LEIA-ME.txt`); sem arquivo, usa o som sintetizado.

## Estrutura
```
public/              front-end estático (servido na raiz do site)
  index.html
  css/style.css
  js/app.js          toda a lógica do jogo, em JS puro (sem build)
  img/danilao.webp   arte do personagem (proporção 2:3); as reações são camadas SVG por cima
api/                 backend: funções serverless Node (Vercel), uma rota por arquivo
  me.js              GET  /api/me        saldo; cria conta convidada na 1ª visita
  packs.js           GET  /api/packs     pacotes e preços (vêm do servidor)
  checkout.js        POST /api/checkout  cria sessão do Stripe Checkout
  webhook.js         POST /api/webhook   Stripe confirma pagamento -> soma créditos
  use-item.js        POST /api/use-item  desconta créditos ao usar um item
  recover.js         POST /api/recover   entra numa conta pelo código de recuperação
  _lib/              catalog.js (preços/custos), db.js (Postgres), auth.js (sessão), http.js
test/api.test.js     testes de integração (precisam de Postgres)
DEPLOY.md            como publicar e testar pagamentos
```

## Regras que não podem quebrar
1. **O servidor é a fonte da verdade** de saldo, preços e custos (`api/_lib/catalog.js`). O front só exibe.
   `ITEMS` em `public/js/app.js` espelha os custos para exibição: se mudar um, mude o outro.
2. **Créditos só entram pelo webhook**, após assinatura válida + `payment_status=paid` + valor/moeda
   iguais ao catálogo. Idempotente pela chave primária `payments.stripe_session_id`.
3. **Desconto é atômico**: `UPDATE ... SET credits = credits - $1 WHERE credits >= $1`. Nunca ler-e-depois-gravar.
4. Todo movimento de crédito grava uma linha em `ledger` (auditoria).
5. Nunca commitar `.env` nem chaves. Usar `sk_test_` até validar tudo.
6. O personagem é um **desenho/personagem fictício**. Não usar fotos nem retratos de pessoas reais,
   nem trocar a arte por rosto de alguém sem autorização documentada. Itens do lado Hate ficam em tom de comédia.

## Login
Mínimo possível: ao abrir o site vira uma **conta convidada** (cookie HttpOnly assinado, 1 ano).
Cada conta tem um **código de recuperação** (`XXXX-XXXX-XXXX`) exibido na loja, para usar os
créditos em outro aparelho (`/api/recover`). Quem limpar o cookie sem guardar o código perde o acesso.
Conta nova ganha `WELCOME_CREDITS` (padrão 10).

## Banco (Postgres, ex. Neon)
Tabelas `users`, `ledger`, `payments`, criadas automaticamente na primeira chamada (`api/_lib/db.js`).

## Comandos
- `npm install`
- `npm test` com `TEST_DATABASE_URL=postgres://...` (use um banco descartável; os testes criam usuários)
- `npx vercel dev` roda site + API localmente (precisa de `.env`, veja `.env.example`)
- Webhook local: `stripe listen --forward-to localhost:3000/api/webhook` (a CLI mostra o `whsec_...`)

## Variáveis de ambiente
`DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SESSION_SECRET`, `APP_URL`, `WELCOME_CREDITS`.
