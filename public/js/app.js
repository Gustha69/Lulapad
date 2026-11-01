(function () {
  var $ = function (s) { return document.querySelector(s); };
  var cat = $('#cat'), bubble = $('#bubble'), stage = $('#stage');
  var KEY = 'bicho-terno-v2';

  var ANIMALS = {
    cat: { en: 'cat', pt: 'gato', name: 'Bigodes', noise: 'Miau', pitch: 2, rate: 1.15 },
    dog: { en: 'dog', pt: 'cachorro', name: 'Totó', noise: 'Au au', pitch: 1.35, rate: 1.1 },
    pig: { en: 'pig', pt: 'porco', name: 'Toicinho', noise: 'Oinc', pitch: .8, rate: 1.05 }
  };
  /* pacotes vêm do servidor (GET /api/packs): preço e créditos são definidos lá */
  var PACKS = [];

  var ICON = {
    fish: '<svg viewBox="0 0 54 30"><path d="M4 15 C14 2 34 2 42 15 C34 28 14 28 4 15Z" fill="#7fb7d6"/><path d="M40 15 L52 5 L52 25Z" fill="#5b97bb"/><circle cx="14" cy="12" r="2.200" fill="#1a1a24"/></svg>',
    furball: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#b8b2a6"/><path d="M7 18 Q20 5 33 18 M7 24 Q20 37 33 22 M12 11 Q23 22 31 29" stroke="#8c867a" stroke-width="2" fill="none"/></svg>',
    sardine: '<svg viewBox="0 0 44 40"><rect x="4" y="12" width="36" height="22" rx="4" fill="#c9ced6"/><ellipse cx="22" cy="14" rx="18" ry="6" fill="#e8ebf0"/><path d="M10 14 Q22 8 34 14 Q22 20 10 14Z" fill="#6c8fb3"/><path d="M34 14 L40 10 L40 18Z" fill="#6c8fb3"/><rect x="4" y="25" width="36" height="6" fill="#e4572e"/></svg>',
    rotten: '<svg viewBox="0 0 54 40"><path d="M4 24 C14 11 34 11 42 24 C34 37 14 37 4 24Z" fill="#8aa05a"/><path d="M40 24 L52 14 L52 34Z" fill="#6e8447"/><path d="M10 20 l5 5 m0-5 l-5 5" stroke="#2a2a1e" stroke-width="2"/><path d="M18 9 q-4-3 0-6 M28 9 q-4-3 0-6 M38 9 q-4-3 0-6" stroke="#7fa13a" stroke-width="2" fill="none"/></svg>',
    poison: '<svg viewBox="0 0 40 48"><rect x="14" y="2" width="12" height="8" rx="2" fill="#6b4a2f"/><path d="M14 10 H26 V16 C34 20 36 26 36 34 C36 42 30 46 20 46 C10 46 4 42 4 34 C4 26 6 20 14 16Z" fill="#6fcf4a"/><circle cx="20" cy="30" r="7" fill="#f3efe6"/><circle cx="17" cy="29" r="1.800" fill="#1a1a24"/><circle cx="23" cy="29" r="1.800" fill="#1a1a24"/><path d="M17 35 h6" stroke="#1a1a24" stroke-width="1.500"/></svg>',
    glove: '<svg viewBox="0 0 44 44"><path d="M10 14 C10 6 20 4 28 6 C38 8 40 18 36 26 L34 36 H16 L14 28 C10 24 10 18 10 14Z" fill="#d9362b"/><rect x="14" y="34" width="22" height="8" rx="2" fill="#f3efe6"/><path d="M14 18 C20 22 26 22 32 18" stroke="#a82219" stroke-width="2" fill="none"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.6-8-11.2C4 6.600 6.400 5 8.600 5c1.500 0 2.800.8 3.400 2 .6-1.200 1.900-2 3.400-2C17.600 5 20 6.600 20 9.800 20 15.400 12 21 12 21z" fill="#ef4f6b"/></svg>'
  };
  /* side: good = azul (bem), bad = vermelho (mal). Os pontos no cabo de guerra são iguais ao custo.
     ATENÇÃO: o custo que vale é o do servidor (api/_lib/catalog.js). Aqui é só para exibir. */
  var ITEMS = [
    { id: 'fish', name: 'Peixe', cost: 5, side: 'good' },
    { id: 'furball', name: 'Bolinha de pelos', cost: 10, side: 'good' },
    { id: 'sardine', name: 'Lata de sardinha', cost: 20, side: 'good' },
    { id: 'rotten', name: 'Peixe podre', cost: 5, side: 'bad' },
    { id: 'glove', name: 'Luva de boxe', cost: 15, side: 'bad' },
    { id: 'poison', name: 'Veneno', cost: 30, side: 'bad' }
  ];
  var WIN_AT = 100;

  /* credits NÃO é salvo localmente: o saldo real mora no servidor */
  var s = { hunger: 70, happy: 70, energy: 80, sleeping: false, credits: 0, animal: 'cat', good: 0, bad: 0 };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved.hunger === 'number') {
      s.hunger = saved.hunger; s.happy = saved.happy; s.energy = saved.energy;
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
  function head() { return cat.querySelector('.h-' + s.animal); }
  function mouthEl() { return head().querySelector('.mouth'); }
  function setMouth(k) { var m = mouthEl(); m.setAttribute('d', MOUTH[k][0]); m.setAttribute('fill', MOUTH[k][1]); }
  function clamp(n) { return Math.max(0, Math.min(100, n)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function A() { return ANIMALS[s.animal]; }
  function ico(key, w) { return '<div style="width:' + w + 'px">' + ICON[key] + '</div>'; }

  /* som do bichinho (sintetizado) */
  var ac;
  function cry(k) {
    if (muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(), dur;
      k = k || 1; f.type = 'lowpass'; f.frequency.value = 1500;
      if (s.animal === 'cat') {
        o.type = 'sawtooth'; dur = .55;
        o.frequency.setValueAtTime(420 * k, t); o.frequency.linearRampToValueAtTime(840 * k, t + .18); o.frequency.linearRampToValueAtTime(380 * k, t + dur - .05);
      } else if (s.animal === 'dog') {
        o.type = 'square'; dur = .22;
        o.frequency.setValueAtTime(320 * k, t); o.frequency.exponentialRampToValueAtTime(130 * k, t + dur - .04);
      } else {
        o.type = 'sawtooth'; dur = .4;
        o.frequency.setValueAtTime(190 * k, t); o.frequency.linearRampToValueAtTime(110 * k, t + .15); o.frequency.linearRampToValueAtTime(170 * k, t + .25); o.frequency.linearRampToValueAtTime(100 * k, t + dur - .05);
      }
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
    try {
      localStorage.setItem(KEY, JSON.stringify({ hunger: s.hunger, happy: s.happy, energy: s.energy, good: s.good, bad: s.bad, animal: s.animal }));
    } catch (e) {}
  }

  /* cabo de guerra: azul à esquerda, vermelho à direita; a bandeira fica na fronteira entre os dois */
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
    w.textContent = good ? 'O amor venceu!' : 'O ódio venceu!';
    w.className = 'win ' + (good ? 'good' : 'bad');
    w.hidden = false;
    setTimeout(function () { w.hidden = true; }, 2400);
    cry(good ? 1.2 : .6);
  }
  function score(side, pts) {
    s[side] += pts;
    var net = s.good - s.bad;
    if (Math.abs(net) >= WIN_AT) { showWin(net > 0); s.good = 0; s.bad = 0; }
    render();
  }
  function render() {
    [['hunger', s.hunger], ['happy', s.happy], ['energy', s.energy]].forEach(function (p) {
      var i = $('#b-' + p[0] + ' i'), v = Math.round(p[1]);
      i.style.width = v + '%';
      i.className = v < 25 ? 'low' : (v < 50 ? 'mid' : '');
      $('#v-' + p[0]).textContent = v;
    });
    $('#credits').textContent = s.credits;
    var low = Math.min(s.hunger, s.happy, s.energy) < 25;
    cat.classList.toggle('sleep', s.sleeping);
    cat.classList.toggle('sad', low && !s.sleeping);
    stage.classList.toggle('night', s.sleeping);
    renderTug();
    $('#sleep').textContent = s.sleeping ? 'Acordar' : 'Dormir';
    if (!busy) setMouth(s.sleeping ? 'small' : (low ? 'frown' : 'smile'));
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
  function wake() { if (s.sleeping) { s.sleeping = false; say('Hmpf... eu estava dormindo!'); render(); return true; } return false; }

  /* toques gratuitos */
  function headTap(e) {
    if (s.sleeping) { wake(); return; }
    var p = rel(e);
    s.happy = clamp(s.happy + 6); score('good', 1);
    hearts(p[0], p[1], 3); flash('happy', 1300);
    say(pick(['Que delícia de carinho!', 'Mais um pouquinho, por favor.', 'Estou feliz!']));
    if (Math.random() < .5) cry(1.1);
    render();
  }
  function poke() {
    if (wake()) return;
    flash('surprise', 700);
    busy = true; setMouth('open');
    setTimeout(function () { busy = false; render(); }, 600);
    say(pick(['Hihi, faz cócegas!', 'Ei, a barriga não!', A().noise + '!']));
    cry(1.25); s.happy = clamp(s.happy + 2); score('good', 1);
  }
  function tailGrab() {
    if (s.sleeping) return;
    var t = cat.querySelector('.t-' + s.animal);
    t.classList.add('wag');
    setTimeout(function () { t.classList.remove('wag'); }, 1200);
    say('Ei! Essa é a minha cauda!'); cry(.9);
    s.happy = clamp(s.happy - 3); score('bad', 1);
  }

  /* efeitos de itens */
  function dropToMouth(key, w, cb) {
    var m = mouthEl().getBoundingClientRect(), r = stage.getBoundingClientRect();
    var d = fxAt(ico(key, w), m.left - r.left + m.width / 2 - w / 2, m.top - r.top - 24, 'drop');
    setTimeout(function () { d.remove(); cb(); }, 720);
  }
  function chew(times, done) {
    busy = true; var n = 0;
    var iv = setInterval(function () {
      setMouth(n % 2 ? 'chew' : 'small'); n++;
      if (n > times) { clearInterval(iv); busy = false; if (done) done(); render(); }
    }, 150);
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
    fish: function () {
      dropToMouth('fish', 50, function () {
        chew(7); say('Nham nham nham!'); cry(.8);
        s.hunger = clamp(s.hunger + 25); s.happy = clamp(s.happy + 4); render();
      });
    },
    furball: function () {
      var r = stage.getBoundingClientRect();
      var d = fxAt(ico('furball', 34), r.width * .12, r.height * .66, 'ball');
      setTimeout(function () { d.remove(); }, 1750);
      flash('happy', 2200); say('Hihi! Eu amo brincar!'); cry(1.2);
      s.happy = clamp(s.happy + 14); s.energy = clamp(s.energy - 6); render();
    },
    sardine: function () {
      dropToMouth('sardine', 56, function () {
        chew(9); say('Sardinha! Que luxo!'); cry(.8);
        hearts(stage.clientWidth / 2, stage.clientHeight * .35, 4);
        s.hunger = clamp(s.hunger + 40); s.happy = clamp(s.happy + 12); render();
      });
    },
    rotten: function () {
      dropToMouth('rotten', 54, function () {
        chew(3, function () { setMouth('frown'); });
        makeSick(4500, false); say('Eca! Que gosto horrível!'); cry(.7);
        s.hunger = clamp(s.hunger + 5); s.happy = clamp(s.happy - 10); s.energy = clamp(s.energy - 6); render();
      });
    },
    glove: function () {
      var r = stage.getBoundingClientRect(), h = head().getBoundingClientRect();
      var d = fxAt('<div style="transform:rotate(-90deg)">' + ico('glove', 64) + '</div>', h.left - r.left + h.width * .72, h.top - r.top + h.height * .3, 'punch');
      setTimeout(function () { flash('hit', 500); flash('surprise', 700); makeDizzy(2600); cry(.6); say('Aaai! Meu focinho!'); }, 320);
      setTimeout(function () { d.remove(); }, 800);
      s.happy = clamp(s.happy - 14); render();
    },
    poison: function () {
      dropToMouth('poison', 44, function () {
        chew(2, function () { setMouth('frown'); });
        makeSick(6500, true); say('Ai... minha barriguinha...'); cry(.6);
        s.hunger = clamp(s.hunger - 5); s.happy = clamp(s.happy - 18); s.energy = clamp(s.energy - 15); render();
      });
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
      if (s.sleeping) { s.sleeping = false; }
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
    [['good', 'Love the ' + A().en], ['bad', 'Hate the ' + A().en]].forEach(function (g) {
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
    }).catch(function () {
      btn.disabled = false; toast('Não foi possível abrir o pagamento. Tente de novo.');
    });
  }
  function recover() {
    var code = window.prompt('Digite seu código de recuperação:');
    if (!code) return;
    api('/api/recover', { code: code }).then(function (d) {
      applyMe(d); closeShop(); toast('Conta recuperada! Saldo: ' + d.credits + ' créditos.');
    }).catch(function () { toast('Código não encontrado.'); });
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

  /* fala */
  function talk(text) {
    wake();
    busy = true; cat.classList.add('talking');
    var iv = setInterval(function () { setMouth(Math.random() > .4 ? 'open' : 'small'); }, 130);
    var finished = false;
    var done = function () { if (finished) return; finished = true; clearInterval(iv); cat.classList.remove('talking'); busy = false; render(); };
    say(text, Math.max(2600, text.length * 90));
    var synth = window.speechSynthesis;
    if (synth && window.SpeechSynthesisUtterance) {
      try {
        synth.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR'; u.pitch = A().pitch; u.rate = A().rate;
        u.onend = done; u.onerror = done;
        synth.speak(u);
        setTimeout(done, 12000);
        s.happy = clamp(s.happy + 4); render();
        return;
      } catch (e) {}
    }
    cry(1); setTimeout(done, 1200);
  }

  /* telas */
  function show(id) {
    ['animal', 'game'].forEach(function (n) { $('#screen-' + n).hidden = (n !== id); });
    window.scrollTo(0, 0);
  }
  function previewOf(a, vb) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', vb || '50 22 200 180');
    svg.appendChild(cat.querySelector('.h-' + a).cloneNode(true));
    return svg;
  }
  function buildAnimalCards() {
    var box = $('#animalCards'); box.innerHTML = '';
    Object.keys(ANIMALS).forEach(function (a) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'card';
      b.setAttribute('aria-label', 'Escolher ' + ANIMALS[a].pt);
      b.appendChild(previewOf(a));
      var n = document.createElement('span'); n.textContent = ANIMALS[a].name; b.appendChild(n);
      var k = document.createElement('small'); k.textContent = ANIMALS[a].pt; b.appendChild(k);
      b.addEventListener('click', function () { chooseAnimal(a); });
      box.appendChild(b);
    });
  }
  function chooseAnimal(a) {
    s.animal = a; cat.setAttribute('data-animal', a);
    $('#petName').firstChild.nodeValue = ANIMALS[a].name;
    $('#petKind').textContent = ANIMALS[a].pt + ' de terno';
    s.sleeping = false;
    cat.classList.remove('sick', 'dizzy', 'sleep');
    renderItems(); render(); show('game');
    setTimeout(function () { say(A().noise + '! O que você vai fazer comigo?', 3200); }, 400);
  }

  $('#back').addEventListener('click', function () { show('animal'); });
  $('#creditsBtn').addEventListener('click', openShop);
  $('#shopClose').addEventListener('click', closeShop);
  $('#recoverBtn').addEventListener('click', recover);
  $('#shop').addEventListener('click', function (e) { if (e.target === this) closeShop(); });
  $('#sleep').addEventListener('click', function () {
    s.sleeping = !s.sleeping; say(s.sleeping ? 'Boa noite... zzz' : 'Bom dia!'); render();
  });
  $('#mute').addEventListener('click', function () {
    muted = !muted; this.textContent = muted ? 'Mudo' : 'Som'; this.setAttribute('aria-pressed', String(muted));
  });
  $('#talkForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var inp = $('#talkInput'), t = inp.value.trim();
    if (!t) { say('Digite alguma coisa para eu repetir!'); return; }
    inp.value = ''; talk(t);
  });
  cat.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (t.closest('.tail')) { tailGrab(); return; }
    if (t.closest('.head-g')) { headTap(e); return; }
    if (t.closest('#body-hit')) { poke(); }
  });

  /* olhos seguem o dedo */
  document.addEventListener('pointermove', function (e) {
    if (s.sleeping || $('#screen-game').hidden) return;
    var h = head().getBoundingClientRect();
    var dx = e.clientX - (h.left + h.width / 2), dy = e.clientY - (h.top + h.height / 2);
    var len = Math.hypot(dx, dy) || 1, k = Math.min(1, len / 160) * 4;
    head().querySelectorAll('.pupil').forEach(function (p) { p.setAttribute('transform', 'translate(' + (dx / len * k).toFixed(1) + ' ' + (dy / len * k).toFixed(1) + ')'); });
  });

  /* o tempo passa */
  setInterval(function () {
    if ($('#screen-game').hidden) return;
    if (s.sleeping) { s.energy = clamp(s.energy + 4); s.hunger = clamp(s.hunger - .4); }
    else { s.hunger = clamp(s.hunger - 1.2); s.happy = clamp(s.happy - .8); s.energy = clamp(s.energy - .6); }
    if (!s.sleeping && !busy && !bubble.classList.contains('show')) {
      if (s.hunger < 25) { say(A().noise + '... estou com fome.'); cry(1); }
      else if (s.energy < 20) { say('Estou com sono...'); }
      else if (s.happy < 25) { say('Preciso de carinho.'); }
    }
    render();
  }, 3000);

  buildAnimalCards();
  render();
  loadPacks();
  loadMe().then(handleReturn);
})();
