(function () {
  var $ = function (s) { return document.querySelector(s); };
  var cat = $('#cat'), bubble = $('#bubble'), stage = $('#stage');
  var KEY = 'bicho-terno-v2';

  var CHAR = { id: 'dan', name: 'Danilão', noise: 'Ôpa' };
  /* pacotes vêm do servidor (GET /api/packs): preço e créditos são definidos lá */
  var PACKS = [];

  var ICON = {
    star: '<svg viewBox="0 0 44 44"><path d="M22 3 L27.500 16 L41.500 17 L30.800 26.200 L34.200 40 L22 32.600 L9.800 40 L13.200 26.200 L2.500 17 L16.500 16Z" fill="#d62828" stroke="#a31515" stroke-width="2" stroke-linejoin="round"/></svg>',
    beer: '<svg viewBox="0 0 44 48"><path d="M12 8 Q22 3 32 8 L33 40 Q22 45 11 40Z" fill="#e8b923"/><path d="M12 8 Q22 3 32 8 L32.500 14 Q22 18 11.500 14Z" fill="#fff8e1"/><path d="M12 8 Q22 12 32 8" stroke="#c9a017" stroke-width="2" fill="none"/><rect x="14" y="22" width="16" height="10" rx="2" fill="#d62828"/><path d="M15 12 Q16 5 20 6 Q22 2 26 6 Q30 5 29 12Z" fill="#fff"/></svg>',
    picanha: '<svg viewBox="0 0 54 44"><path d="M5 26 Q6 8 28 6 Q50 8 50 26 Q48 40 28 40 Q8 40 5 26Z" fill="#b3261e"/><path d="M5 26 Q6 8 28 6 Q50 8 50 18 Q40 12 28 13 Q14 13 5 26Z" fill="#fff0d6"/><path d="M14 30 Q24 24 34 30 M18 35 Q28 30 40 34" stroke="#7a1812" stroke-width="2" fill="none"/><circle cx="40" cy="26" r="2.500" fill="#7a1812"/></svg>',
    piggy: '<svg viewBox="0 0 64 52"><ellipse cx="32" cy="28" rx="24" ry="18" fill="#f4a5b5"/><path d="M20 12 L24 4 L30 12Z" fill="#ee8fa5"/><rect x="14" y="40" width="7" height="10" rx="3" fill="#ee8fa5"/><rect x="43" y="40" width="7" height="10" rx="3" fill="#ee8fa5"/><ellipse cx="53" cy="29" rx="7" ry="6" fill="#ee8fa5"/><circle cx="51" cy="29" r="1.500" fill="#b04a63"/><circle cx="55" cy="29" r="1.500" fill="#b04a63"/><circle cx="44" cy="22" r="2.500" fill="#2b2118"/><rect x="24" y="10" width="14" height="3.500" rx="1.700" fill="#b04a63"/><path d="M8 26 Q2 22 5 17" stroke="#ee8fa5" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
    coin: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#f6c445" stroke="#c99a17" stroke-width="3"/><circle cx="20" cy="20" r="11" fill="none" stroke="#e0a91c" stroke-width="2"/><rect x="18" y="12" width="4" height="16" rx="2" fill="#c99a17"/></svg>',
    finger: '<svg viewBox="0 0 30 64"><rect x="5" y="4" width="20" height="58" rx="10" fill="#f2b98a" stroke="#d99a68" stroke-width="2"/><path d="M9 10 Q15 4 21 10 L21 20 Q15 24 9 20Z" fill="#fde0c8"/><path d="M8 38 H22 M8 48 H22" stroke="#d99a68" stroke-width="1.500"/></svg>',
    sparkle: '<svg viewBox="0 0 40 40"><path d="M20 0 L24 16 L40 20 L24 24 L20 40 L16 24 L0 20 L16 16Z" fill="#fff6a8"/></svg>',
    stock: '<svg viewBox="0 0 52 48"><rect x="2" y="2" width="48" height="44" rx="6" fill="#2a2a33"/><path d="M8 12 L18 20 L26 14 L44 34" stroke="#ef5d5d" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 22 L44 36 L30 36" stroke="#ef5d5d" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.6-8-11.2C4 6.600 6.400 5 8.600 5c1.500 0 2.800.8 3.400 2 .6-1.200 1.900-2 3.400-2C17.600 5 20 6.600 20 9.800 20 15.400 12 21 12 21z" fill="#ef4f6b"/></svg>'
  };
  /* side: good = azul (bem), bad = vermelho (mal). Os pontos no cabo de guerra são iguais ao custo.
     ATENÇÃO: o custo que vale é o do servidor (api/_lib/catalog.js). Aqui é só para exibir. */
  var ITEMS = [
    { id: 'star', name: 'Estrela', cost: 5, side: 'good' },
    { id: 'beer', name: 'Cerveja', cost: 10, side: 'good' },
    { id: 'picanha', name: 'Picanha', cost: 20, side: 'good' },
    { id: 'piggy', name: 'Cofrinho', cost: 5, side: 'bad' },
    { id: 'stock', name: 'Queda da bolsa', cost: 15, side: 'bad' },
    { id: 'finger', name: 'Dedinho', cost: 30, side: 'bad' }
  ];
  var WIN_AT = 100;

  /* credits NÃO é salvo localmente: o saldo real mora no servidor */
  var s = { credits: 0, good: 0, bad: 0 };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      if (typeof saved.good === 'number') s.good = saved.good;
      if (typeof saved.bad === 'number') s.bad = saved.bad;
    }
  } catch (e) {}
  var busy = false, muted = false, bubbleTimer = null, toastTimer = null, sickTimer = null, dizzyTimer = null;
  var spending = false, recoveryCode = '';

  /* ---------- API ---------- */
  function api(path, body) {
    var opt = { credentials: 'same-origin', headers: {} };
    if (body) { opt.method = 'POST'; opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || 'erro'); e.status = r.status; e.data = d; throw e; }
        return d;
      });
    });
  }
  function applyMe(d) {
    if (typeof d.credits === 'number') s.credits = d.credits;
    if (d.recoveryCode) recoveryCode = d.recoveryCode;
    renderShopNote();
    render();
  }
  function loadMe() { return api('/api/me').then(applyMe).catch(function () { toast('Sem conexão com o servidor.'); }); }

  var MOUTH = {
    smile: ['M134 158 Q142 167 150 158 Q158 167 166 158', 'none'],
    frown: ['M136 166 Q150 154 164 166', 'none'],
    open: ['M136 156 Q150 194 164 156 Z', '#6b2a35'],
    small: ['M142 157 Q150 172 158 157 Z', '#6b2a35'],
    chew: ['M138 158 Q150 176 162 158 Z', '#6b2a35']
  };
  function head() { return $('#face'); }
  function mouthEl() { return $('#mouthPt'); }
  function setMouth() { /* a boca faz parte da ilustração */ }
  function clamp(n) { return Math.max(0, Math.min(100, n)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function A() { return CHAR; }
  function ico(key, w) { return '<div style="width:' + w + 'px">' + ICON[key] + '</div>'; }

  /* ---------- SONS ----------
     Para cada personagem e reação você pode apontar um arquivo de áudio em SOUNDS.
     Reações: tap (carinho na cabeça), poke (cutucar a barriga), hat (mexer no chapéu),
     star, beer, picanha (itens Love), piggy, stock, finger (itens Hate),
     winLove, winHate (vitórias). O que não tiver arquivo usa o som sintetizado.
     Exemplo:  dan: { piggy: 'sounds/dan/moedinha.mp3', winLove: 'sounds/dan/ganhou.mp3' }
     'all' vale para todos os personagens. Veja public/sounds/LEIA-ME.txt */
  var SOUNDS = {
    all: {},
    dan: {
      star: 'sounds/dan/estrela.mp3',
      beer: 'sounds/dan/cerveja.mp3',
      picanha: 'sounds/dan/picanha.mp3',
      piggy: 'sounds/dan/moedinha.mp3',
      stock: 'sounds/dan/bolsa.mp3',
      finger: 'sounds/dan/dedinho.mp3'
    }
  };
  var SYNTH_PITCH = { tap: 1.1, poke: 1.25, hat: .9, star: 1.2, beer: .9, picanha: 1.0, piggy: 1.5, stock: .7, finger: 1.3, winLove: 1.2, winHate: .6 };
  var audioCache = {}, currentAudio = null, audioUnlocked = false;
  function audioFor(url) {
    if (!audioCache[url]) { var a = new Audio(url); a.preload = 'auto'; audioCache[url] = a; }
    return audioCache[url];
  }
  function allSoundUrls() {
    var out = [];
    Object.keys(SOUNDS).forEach(function (g) { Object.keys(SOUNDS[g]).forEach(function (k) { out.push(SOUNDS[g][k]); }); });
    return out;
  }
  /* celulares só liberam áudio depois de um toque: no primeiro toque "destravamos" todos os arquivos */
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    allSoundUrls().forEach(function (u) {
      var a = audioFor(u);
      a.muted = true;
      var pr = a.play();
      if (pr && pr.then) pr.then(function () { a.pause(); a.currentTime = 0; a.muted = false; }).catch(function () { a.muted = false; });
      else a.muted = false;
    });
  }
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  function playReaction(name) {
    if (muted) return;
    var url = (SOUNDS[CHAR.id] && SOUNDS[CHAR.id][name]) || (SOUNDS.all && SOUNDS.all[name]);
    if (url) {
      try {
        if (currentAudio) { currentAudio.pause(); }
        var a = audioFor(url);
        a.currentTime = 0; a.muted = false; currentAudio = a;
        var pr = a.play();
        if (pr && pr.catch) pr.catch(function () { cry(SYNTH_PITCH[name] || 1); });
        return;
      } catch (e) {}
    }
    cry(SYNTH_PITCH[name] || 1);
  }

  /* som sintetizado (reserva) */
  var ac;
  function cry(k) {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(), dur;
      k = k || 1; f.type = 'lowpass'; f.frequency.value = 1500;
      o.type = 'sawtooth'; dur = .4;
      o.frequency.setValueAtTime(190 * k, t); o.frequency.linearRampToValueAtTime(260 * k, t + .15); o.frequency.linearRampToValueAtTime(150 * k, t + dur - .05);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .04); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(f); f.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + .05);
    } catch (e) {}
  }

  function say(text, ms) {
    bubble.textContent = text; bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.classList.remove('show'); }, ms || 2600);
  }
  function toast(text) {
    var t = $('#toast'); t.textContent = text; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ good: s.good, bad: s.bad })); } catch (e) {}
  }

  /* cabo de guerra: azul à esquerda, vermelho à direita; a bandeira fica na fronteira entre os dois */
  /* humor: net = love - hate. Quanto mais love, mais feliz; quanto mais hate, mais machucado */
  function moodLevel(n) { n = Math.abs(n); return n >= 70 ? 3 : (n >= 40 ? 2 : (n >= 15 ? 1 : 0)); }
  function applyMood() {
    var net = s.good - s.bad, lv = moodLevel(net);
    ['l1', 'l2', 'l3', 'h1', 'h2', 'h3'].forEach(function (k) { cat.classList.remove(k); });
    for (var i = 1; i <= lv; i++) cat.classList.add((net > 0 ? 'l' : 'h') + i);
  }
  function renderTug() {
    var net = Math.max(-WIN_AT, Math.min(WIN_AT, s.good - s.bad));
    var pos = 50 + net / 2;
    $('#knot').style.left = pos + '%';
    $('.fb').style.width = pos + '%';
    $('.fr').style.width = (100 - pos) + '%';
    $('#tugB').textContent = s.good;
    $('#tugR').textContent = s.bad;
  }
  function showWin(good) {
    var w = $('#win');
    w.textContent = good ? 'O Love venceu!' : 'O Hate venceu!';
    w.className = 'win ' + (good ? 'good' : 'bad');
    w.hidden = false;
    setTimeout(function () { w.hidden = true; }, 2400);
    playReaction(good ? 'winLove' : 'winHate');
  }
  function score(side, pts) {
    s[side] += pts;
    var net = s.good - s.bad;
    if (Math.abs(net) >= WIN_AT) { showWin(net > 0); s.good = 0; s.bad = 0; }
    render();
  }
  function render() {
    $('#credits').textContent = s.credits;
    renderTug();
    applyMood();
    if (!busy) setMouth('smile');
    save();
  }

  function fxAt(html, x, y, cls) {
    var d = document.createElement('div');
    d.className = 'fx ' + cls; d.innerHTML = html;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    stage.appendChild(d);
    return d;
  }
  function rel(e) { var r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function hearts(x, y, n) {
    for (var k = 0; k < n; k++) {
      (function (k) { setTimeout(function () {
        var d = fxAt(ico('heart', 26), x - 13 + (Math.random() * 50 - 25), y - 13, 'heart');
        setTimeout(function () { d.remove(); }, 1150);
      }, k * 120); })(k);
    }
  }
  function flash(cls, ms) { cat.classList.add(cls); setTimeout(function () { cat.classList.remove(cls); }, ms); }

  /* toques gratuitos */
  function headTap(e) {
    var p = rel(e);
    score('good', 1);
    hearts(p[0], p[1], 3); flash('happy', 1300);
    say(pick(['Que carinho bom!', 'Hehe, assim eu gosto!', 'Estou feliz!']));
    playReaction('tap');
  }
  function poke() {
    flash('surprise', 700);
    busy = true; setMouth('open');
    setTimeout(function () { busy = false; render(); }, 600);
    say(pick(['Hihi, faz cócegas!', 'Ei, a barriga não!', A().noise + '!']));
    playReaction('poke'); score('good', 1);
  }
  function hatTap() {
    flash('hatpop', 700);
    say(pick(['Ei, meu chapéu!', 'Devolve o chapéu!', 'Respeita o chapéu!']));
    playReaction('hat'); score('bad', 1);
  }

  /* escala do palco: 1 unidade = 1px da arte original (1024 de largura) */
  function setU() { stage.style.setProperty('--u', (stage.clientWidth / 1024) + 'px'); }
  window.addEventListener('resize', setU);
  setU();
  /* um objeto sai da mão do Danilão, vai até a boca e volta (animações em CSS: drink, eat, chili) */
  function handToMouth(key, w, cls, ms) {
    var m = mouthEl().getBoundingClientRect(), r = stage.getBoundingClientRect();
    var inner = cls === 'eat' ? '<div class="bite">' + ico(key, w) + '</div>' : ico(key, w);
    var d = fxAt(inner, m.left - r.left + m.width / 2 - w / 2, m.top - r.top + m.height / 2 - w / 2, cls);
    d.style.width = w + 'px';
    setTimeout(function () { d.remove(); }, ms);
    return d;
  }
  function sipping(on) { cat.classList.toggle('talking', on); }

  /* efeito posicionado em coordenadas da arte original (1024x1536), centrado em (cx, cy) */
  function icoFill(key) { return '<div style="width:100%">' + ICON[key] + '</div>'; }
  function fxArt(html, cx, cy, w, cls) {
    var d = fxAt(html, 0, 0, cls);
    d.style.left = 'calc(var(--u) * ' + (cx - w / 2) + ')';
    d.style.top = 'calc(var(--u) * ' + (cy - w / 2) + ')';
    d.style.width = 'calc(var(--u) * ' + w + ')';
    return d;
  }
  function later(fn, ms) { setTimeout(fn, ms); }

  /* efeitos de itens */
  function dropToMouth(key, w, cb) {
    var m = mouthEl().getBoundingClientRect(), r = stage.getBoundingClientRect();
    var d = fxAt(ico(key, w), m.left - r.left + m.width / 2 - w / 2, m.top - r.top - 24, 'drop');
    setTimeout(function () { d.remove(); cb(); }, 720);
  }
  function chew(times, done) {
    busy = true; cat.classList.add('talking');
    setTimeout(function () { cat.classList.remove('talking'); busy = false; if (done) done(); render(); }, (times + 1) * 150);
  }
  function makeSick(ms, dizzy) {
    cat.classList.add('sick'); clearTimeout(sickTimer);
    sickTimer = setTimeout(function () { cat.classList.remove('sick'); }, ms);
    if (dizzy) makeDizzy(ms);
  }
  function makeDizzy(ms) {
    cat.classList.add('dizzy'); clearTimeout(dizzyTimer);
    dizzyTimer = setTimeout(function () { cat.classList.remove('dizzy'); }, ms);
  }

  var ACTIONS = {
    star: function () {
      var w = 150, x = stage.clientWidth / 2 - w / 2, y = stage.clientHeight * .16;
      var d = fxAt(ico('star', w), x, y, 'starpop');
      setTimeout(function () { d.remove(); }, 1700);
      flash('happy', 2400); say('Essa estrela é a melhor!'); playReaction('star');
      setTimeout(function () { hearts(stage.clientWidth / 2, stage.clientHeight * .4, 6); }, 700);
      render();
    },
    beer: function () {
      handToMouth('beer', 54, 'drink', 3000);
      say('Hora da gelada...'); playReaction('beer');
      setTimeout(function () { sipping(true); }, 1150);
      setTimeout(function () { sipping(false); say('Ahh, geladinha!'); flash('happy', 1800); hearts(stage.clientWidth / 2, stage.clientHeight * .4, 3); }, 2350);
      render();
    },
    picanha: function () {
      handToMouth('picanha', 74, 'eat', 3800);
      say('Olha essa picanha!'); playReaction('picanha');
      setTimeout(function () { sipping(true); }, 1300);
      setTimeout(function () { sipping(false); say('Picanha! Hoje tem churrasco!'); flash('happy', 2400); hearts(stage.clientWidth / 2, stage.clientHeight * .4, 6); }, 3200);
      render();
    },
    piggy: function () {
      var pig = fxArt(icoFill('piggy'), 515, 1380, 270, 'pigpop');
      var coin = fxArt(icoFill('coin'), 790, 1300, 130, 'coinfly');
      say('Plim! Uma moedinha!'); playReaction('piggy');
      later(function () { flash('surprise', 500); }, 300);
      later(function () { pig.remove(); coin.remove(); flash('happy', 1800); say('Guardadinho no cofrinho!'); hearts(stage.clientWidth / 2, stage.clientHeight * .4, 3); }, 3400);
      render();
    },
    stock: function () {
      var d = fxAt(ico('stock', 70), stage.clientWidth * .5 - 35, 0, 'fall');
      setTimeout(function () { d.remove(); }, 2300);
      setTimeout(function () { flash('surprise', 900); flash('hit', 500); makeDizzy(2200); }, 1300);
      say('Ih... a bolsa despencou!'); playReaction('stock'); render();
    },
    finger: function () {
      var spark = fxArt(icoFill('sparkle'), 790, 1280, 140, 'sparkle');
      var finger = fxArt(icoFill('finger'), 790, 1290, 105, 'fingermagic');
      say('Mágica! Olha só o dedinho...'); playReaction('finger');
      later(function () { flash('surprise', 900); }, 500);
      later(function () { say('Cadê o dedinho? Tchan! Tá aqui!'); }, 2400);
      later(function () { spark.remove(); var sp2 = fxArt(icoFill('sparkle'), 790, 1280, 140, 'sparkle'); later(function () { sp2.remove(); }, 900); }, 3300);
      later(function () { finger.remove(); flash('happy', 1800); hearts(stage.clientWidth / 2, stage.clientHeight * .4, 3); }, 3700);
      render();
    }
  };

  function nudgeCredits() { var c = $('#creditsBtn'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
  function noCredits() { nudgeCredits(); toast('Créditos insuficientes. Compre mais para continuar.'); openShop(); }

  /* o servidor desconta o crédito; o efeito só acontece se ele confirmar */
  function useItem(it) {
    if (spending) return;
    if (s.credits < it.cost) { noCredits(); return; }
    spending = true;
    api('/api/use-item', { itemId: it.id }).then(function (d) {
      s.credits = d.credits;
      score(it.side, it.cost);
      ACTIONS[it.id]();
    }).catch(function (err) {
      if (err.status === 402) {
        if (err.data && typeof err.data.credits === 'number') s.credits = err.data.credits;
        render(); noCredits();
      } else {
        toast('Não consegui falar com o servidor. Tente de novo.');
      }
    }).then(function () { spending = false; });
  }

  function renderItems() {
    var box = $('#items'); box.innerHTML = '';
    [['good', 'Love'], ['bad', 'Hate']].forEach(function (g) {
      var lab = document.createElement('div'); lab.className = 'rowlabel ' + g[0]; lab.textContent = g[1]; box.appendChild(lab);
      var row = document.createElement('div'); row.className = 'items';
      ITEMS.filter(function (it) { return it.side === g[0]; }).forEach(function (it) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'item ' + g[0];
        b.innerHTML = '<span class="ico">' + ICON[it.id] + '</span><span>' + it.name + '</span><span class="cost"><i></i>' + it.cost + '</span>';
        b.setAttribute('aria-label', it.name + ', ' + it.cost + ' créditos');
        b.addEventListener('click', function () { useItem(it); });
        row.appendChild(b);
      });
      box.appendChild(row);
    });
  }

  /* loja de créditos (pagamento real via Stripe Checkout) */
  function renderPacks() {
    var box = $('#packs'); box.innerHTML = '';
    PACKS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pack';
      b.innerHTML = '<span class="coin"></span><span class="amt">' + p.credits + ' créditos' + (p.tag ? '<small>' + p.tag + '</small>' : '') + '</span><span class="price">' + p.price + '</span>';
      b.addEventListener('click', function () { buy(p, b); });
      box.appendChild(b);
    });
  }
  function renderShopNote() {
    var n = 'Pagamento seguro pelo Stripe, com cartão ou Pix.';
    if (recoveryCode) n += ' Seu código de recuperação: ' + recoveryCode + ' (guarde para usar seus créditos em outro aparelho).';
    $('#shopNote').textContent = n;
  }
  function loadPacks() {
    return api('/api/packs').then(function (d) { PACKS = d.packs || []; renderPacks(); }).catch(function () {});
  }
  function buy(p, btn) {
    btn.disabled = true; toast('Abrindo o pagamento...');
    api('/api/checkout', { packId: p.id }).then(function (d) {
      window.location.href = d.url;
    }).catch(function (err) {
      btn.disabled = false;
      toast('Pagamento indisponível: ' + ((err.data && err.data.detail) || 'tente de novo') );
    });
  }
  function recover() {
    var code = window.prompt('Digite seu código de recuperação:');
    if (!code) return;
    api('/api/recover', { code: code }).then(function (d) {
      applyMe(d); closeShop(); toast('Conta recuperada! Saldo: ' + d.credits + ' créditos.');
    }).catch(function (err) {
      if (err.status === 404) toast('Código não encontrado.');
      else if (err.status === 400) toast('Código inválido: são 12 letras e números (XXXX-XXXX-XXXX).');
      else toast('Erro no servidor (' + (err.status || 'sem conexão') + '). Tente de novo.');
    });
  }
  function openShop() { $('#shop').hidden = false; }
  function closeShop() { $('#shop').hidden = true; }

  /* ao voltar do Stripe, o webhook pode demorar alguns segundos: consulta o saldo algumas vezes */
  function handleReturn() {
    var q = new URLSearchParams(window.location.search), before = s.credits, tries = 0;
    if (q.get('pagamento') === 'cancelado') toast('Pagamento cancelado. Nada foi cobrado.');
    if (q.get('pagamento') === 'ok') {
      toast('Pagamento recebido! Confirmando seus créditos...');
      var iv = setInterval(function () {
        tries++;
        api('/api/me').then(function (d) {
          applyMe(d);
          if (d.credits > before) { clearInterval(iv); toast('Créditos adicionados!'); }
        }).catch(function () {});
        if (tries >= 10) { clearInterval(iv); }
      }, 2000);
    }
    if (q.get('pagamento')) {
      try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
    }
  }

  $('#creditsBtn').addEventListener('click', openShop);
  $('#shopClose').addEventListener('click', closeShop);
  $('#recoverBtn').addEventListener('click', recover);
  $('#shop').addEventListener('click', function (e) { if (e.target === this) closeShop(); });
  $('#mute').addEventListener('click', function () {
    muted = !muted; this.textContent = muted ? 'Mudo' : 'Som'; this.setAttribute('aria-pressed', String(muted));
  });
  cat.addEventListener('pointerdown', function (e) {
    var z = e.target.closest('.zone');
    if (!z) return;
    if (z.dataset.zone === 'hat') hatTap();
    else if (z.dataset.zone === 'head') headTap(e);
    else poke();
  });

  renderItems();
  render();
  setTimeout(function () { say(A().noise + '! Love ou Hate? Você decide!', 3200); }, 500);
  loadPacks();
  loadMe().then(handleReturn);
})();
