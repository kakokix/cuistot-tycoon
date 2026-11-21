// ===================== GAME SCENE (restaurant view: hub + shift) =====================
var Scene = (function () {
  var root, L = {}, E = {}, ST = [], CU = {}, CH = {};
  var sh = null, mode = 'hub';
  var shownCoins = 0;
  var YUM = ['Délicieux !', 'Miam !', 'Parfait !', 'Trop bon !', 'Un régal !', 'Merci chef !', 'Super !'];
  var GRR = ['Trop long !', 'Je m\'en vais !', 'Inadmissible !', 'Plus jamais !', 'Quelle attente !'];
  var HELLO = ['Bonjour !', 'Salut chef !', 'J’ai faim !', 'Bonjour, s’il vous plaît…', 'Coucou !'];
  // the noise of each finishing gesture in the simulator (station id + step number, or the station alone)
  var STEP_SND = { jus: 'pour', soupe: 'pour', frites0: 'splash', pizza1: 'chop', sushi2: 'chop', gateau1: 'chop', gateau2: 'chop', wok: 'pour' };
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  var COLW = 164, COLG = 10, COL0 = 16, ROWH = 168;
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';   // <img> drawn with a CSS background

  function el(tag, cls, parent, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function px(v) { return Math.round(v) + 'px'; }
  function fmt(n) { return Util.fmt(n); }

  // wide (PC) layout: the whole screen is the 3D restaurant, the HTML layer follows the 3D objects
  function isWide() { return !!(window.View3D && View3D.isWide()); }
  // the whole kitchen is 3D (wide layout, or first-person simulator on any screen): labels follow the models
  function is3d() { return !!(window.View3D && View3D.isFull()); }
  function fpsOn() { return !!(window.Fps && Fps.active()); }
  function stationCenter(i) {
    if (is3d()) { var o = ST[i]; return { x: o.sx, y: o.sy - o.ph / 2, top: o.sy - o.ph }; }
    var c = i % 4, r = Math.floor(i / 4);
    return { x: COL0 + c * (COLW + COLG) + COLW / 2, y: (r === 0 ? L.row1 : L.row2) + ROWH / 2, top: r === 0 ? L.row1 : L.row2 };
  }
  function seatX(i, n) {
    var sp = n >= 5 ? 136 : n === 4 ? 165 : 200;
    return 360 + (i - (n - 1) / 2) * sp;
  }
  // where a seat is on screen before its customer exists
  function seatPos(seat, n) {
    if (is3d()) return View3D.seatScreen(seat, n);
    return { x: seatX(seat, n), top: L.custBottom - 224, sc: n >= 5 ? 0.82 : n === 4 ? 0.93 : 1 };
  }

  // ---------------- build ----------------
  function build(container) {
    root = container;
    E.vig = el('div', 'vignette', root);
    E.dining = el('div', 'dining-bg', root);
    E.lanterns = el('div', 'lanterns', root);
    E.sign = el('div', 'sign', root, '<div class="ropes"></div><div class="board-s"></div><div class="bulbs"></div><span></span>');
    E.drums = el('div', 'deco-drums', root);
    E.notes = el('div', '', root);
    E.plantL = el('div', 'deco-plant', root);
    E.plantR = el('div', 'deco-plant', root);
    E.postL = el('div', 'post', root);
    E.postR = el('div', 'post', root);
    E.leafL = el('div', 'roof-leaf', root);
    E.leafR = el('div', 'roof-leaf', root);
    E.seats = el('div', '', root);
    E.counter = el('div', 'counter', root);
    E.kitchenBg = el('div', 'kitchen-bg', root);
    E.lane = el('div', '', root);
    CH.waiter = makeChar('waiter', 150, 150);
    CH.commis = makeChar('commis', 150, 150);
    CH.chef = makeChar('chef', 196, 196);
    E.kitchen = el('div', '', root);
    for (var i = 0; i < 8; i++) ST.push(makeStation(i));
    E.fx = el('div', '', root); E.fx.id = 'fx';
    E.hudTop = el('div', 'hud-top', root);
    // top HUD elements
    E.lvl = el('div', 'lvlbox tap', root, '<div class="st">1</div><div class="lbl ctxt">CHEF</div><div class="xb"><i></i></div>');
    E.coins = el('div', 'coinbox', root, '<img><span>0</span>');
    E.coins.querySelector('img').src = Art.coin();
    E.setBtn = el('div', 'sq tap', root); E.setBtn.style.cssText = 'left:604px;top:2px;width:92px;height:92px;background-image:var(--a-b_settings)';
    E.bookBtn = el('div', 'bookbtn tap', root, '<img><div class="badge">!</div><i class="key">C</i>');
    E.bookBtn.querySelector('img').src = Art.book();
    E.bookBtn.addEventListener('click', function () { Sfx.play('click'); Story.openJournal(); });
    // club des chefs: world ranking, daily challenge, missions, gift, codes...
    E.clubBtn = el('div', 'clubbtn tap', root, '<img><div class="badge">!</div><i class="key">K</i>');
    E.clubBtn.querySelector('img').src = Art.icon('trophy');
    E.clubBtn.addEventListener('click', function () { Sfx.play('click'); Club.open(); });
    E.pauseBtn = el('div', 'sq tap', root); E.pauseBtn.style.cssText = 'left:18px;top:2px;width:92px;height:92px;background-image:var(--a-b_pause)';
    E.timer = el('div', 'timer', root, '<img src="' + BLANK + '"><span>1:30</span>');
    E.timer.querySelector('img').style.cssText = 'background:var(--a-clock) center/contain no-repeat';
    E.timer.style.left = '560px';
    E.plaque = el('div', 'plaque', root, '<span></span><small></small>');
    E.goal = el('div', 'goalbar', root, '<div class="trk"><div class="fill"></div></div><div class="txt">0 / 100</div><i class="mk"></i><i class="mk"></i><i class="mk"></i><div class="hearts"></div>');
    E.hearts = E.goal.querySelector('.hearts');
    for (var h = 0; h < 5; h++) el('i', '', E.hearts);
    E.hudBot = el('div', 'hud-bot', root);
    // hub bottom
    E.hub = el('div', 'hub-bot', root);
    E.shopBtn = el('div', 'sq tap', E.hub, '<i class="key">B</i>'); E.shopBtn.style.cssText = 'left:48px;background-image:var(--a-b_shop)';
    el('div', 'lab ctxt', E.hub, 'Boutique').style.left = '30px';
    E.shopBadge = el('div', 'badge', E.shopBtn, '!'); E.shopBadge.style.cssText = 'right:-4px;top:-4px';
    E.openBtn = el('div', 'open-btn tap', E.hub, '<b>OUVRIR</b><small>Jour 1</small><i class="key">Entrée</i>');
    E.mapBtn = el('div', 'mapbtn tap', E.hub, '<div class="badge">!</div><i class="key">M</i>');
    E.mapLab = el('div', 'lab ctxt', E.hub, 'Carte');
    E.mapBtn.addEventListener('click', function () { Sfx.play('click'); World.open(); });
    E.lvBtn = el('div', 'sq tap', E.hub, '<i class="key">N</i>'); E.lvBtn.style.cssText = 'left:568px;background-image:var(--a-b_prize)';
    el('div', 'lab ctxt', E.hub, 'Niveaux').style.left = '550px';
    // boosters
    E.boosts = el('div', 'boosts', root);
    E.bst = {};
    GD.BOOSTER_ORDER.forEach(function (id) {
      var b = el('div', 'rnd tap', E.boosts, '<img><div class="badge">0</div><div class="tm ctxt"></div><i class="key">' + 'AZER'.charAt(GD.BOOSTER_ORDER.indexOf(id)) + '</i>');
      b.title = GD.BOOSTERS[id].name + ' : ' + GD.BOOSTERS[id].desc;
      b.querySelector('img').src = BLANK;
      b.querySelector('img').style.cssText = 'background:var(--a-' + GD.BOOSTERS[id].icon + ') center/contain no-repeat';
      b.addEventListener('pointerdown', function (ev) { ev.preventDefault(); Game.useBooster(id); });
      E.bst[id] = b;
    });
    // events
    E.setBtn.addEventListener('click', function () { Sfx.play('click'); UI.settings(); });
    E.pauseBtn.addEventListener('click', function () { Sfx.play('click'); Game.pause(); });
    E.shopBtn.addEventListener('click', function () { Sfx.play('click'); UI.shop(); });
    E.lvBtn.addEventListener('click', function () { Sfx.play('click'); UI.levels(); });
    E.openBtn.addEventListener('click', function () { Sfx.play('click'); Game.startDay(App.save.unlocked); });
    // manager view (from above) or simulator (first person): the choice is kept for the next days
    E.simBtn = el('div', 'simchip tap', root, '<i></i><span></span><em class="key">V</em>');
    E.simBtn.addEventListener('click', function () { toggleSim(); });
    E.visitBtn = el('div', 'visitbtn tap', root, '<img>');
    E.visitBtn.querySelector('img').src = Art.icon('walk');
    E.visitBtn.addEventListener('click', function () { Sfx.play('click'); need3d(function () { Game.visit(); }); });
    E.lvl.addEventListener('click', function () { Sfx.play('click'); UI.toast('Chef niveau ' + App.save.level + ' — XP ' + Math.floor(App.save.xp) + ' / ' + GD.xpNeed(App.save.level)); });
  }

  function makeChar(kind, w, h) {
    var c = el('div', 'chr', E.lane);
    c.style.width = px(w); c.style.height = px(h);
    var o = { el: c, kind: kind, w: w, h: h, x: kind === 'chef' ? 360 : kind === 'commis' ? 200 : 520, tx: null, path: [], mood: '', moodT: 0, work: 0, dir: 1, y: 0 };
    o.x0 = o.xp = o.x;      // xp: home position in the portrait layout
    return o;
  }
  function setCharMood(o, mood) {
    if (o.mood === mood) return;
    o.mood = mood;
    var key = o.kind === 'waiter' ? 'waiter_happy' :
      o.kind === 'commis' ? (mood === 'happy' ? 'commis_happy' : 'commis_focus') :
        'chef_' + (mood === 'focus' || mood === 'worried' ? mood : 'happy');
    o.key = key;
    o.el.style.backgroundImage = 'var(--a-' + key + ')';
  }

  function makeStation(i) {
    var s = el('div', 'station', E.kitchen);
    s.innerHTML = '<div class="tile"></div><div class="boost-fx"></div><div class="sti"></div><div class="prog prog2"><i></i></div><div class="prog"><i></i></div>' +
      '<div class="nm"></div><div class="lv"></div><div class="ready"></div><div class="over"></div><div class="upg"></div>';
    var o = { el: s, i: i, def: GD.STATIONS[i], sti: s.querySelector('.sti'), prog: s.querySelectorAll('.prog i'), progBox: s.querySelectorAll('.prog'),
      nm: s.querySelector('.nm'), lv: s.querySelector('.lv'), ready: s.querySelector('.ready'), over: s.querySelector('.over'), nReady: -1, state: '',
      sx: 0, sy: 0, ph: 0, hover: false, bumpT: 0 };
    o.sti.style.backgroundImage = Art.stationBg(o.def.id);
    o.nm.innerHTML = '<i class="key">' + (i + 1) + '</i><span>' + o.def.name + '</span>';
    s.addEventListener('pointerdown', function (ev) { ev.preventDefault(); onStation(i); });
    // mouse: the 3D station reacts when the pointer is over it
    s.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') o.hover = true; });
    s.addEventListener('pointerleave', function () { o.hover = false; });
    return o;
  }

  // ---------------- layout ----------------
  function layout(H) {
    L.H = H; L.W = App.W;
    if (is3d()) layoutWide(H); else layoutPortrait(H);
    Object.keys(CH).forEach(function (k) { var o = CH[k]; o.x = o.x0; o.path = []; o.el.style.left = px(o.x - o.w / 2); });
    placeHud();
    layoutSeats();
  }
  function layoutPortrait(H) {
    L.botTop = H - 112;
    L.row2 = L.botTop - 6 - ROWH;
    L.row1 = L.row2 - 12 - ROWH;
    L.counterTop = L.row1 - 162;
    L.custBottom = L.counterTop + 16;
    L.laneBottom = L.row1 + 48;
    E.dining.style.height = px(L.counterTop + 400 + 40);
    E.counter.style.top = px(L.counterTop);
    E.kitchenBg.style.top = px(window.View3D && View3D.active() ? L.row1 - 26 : L.counterTop + 84);
    E.postL.style.cssText = 'left:-10px;top:-200px;height:' + px(L.counterTop + 210);
    E.postR.style.cssText = 'left:696px;top:-200px;height:' + px(L.counterTop + 210);
    var signTop = L.counterTop - 430, small = signTop < 230;
    if (small) signTop = Math.max(150, L.counterTop - 400);
    E.sign.style.top = px(signTop);
    E.sign.style.transform = small ? 'scale(.72)' : '';
    E.lanterns.style.top = px(146);
    E.drums.style.cssText = 'left:20px;top:' + px(signTop + 6);
    E.notes.style.cssText = 'position:absolute;left:56px;top:' + px(signTop + 6);
    E.plantL.style.cssText = 'left:-30px;top:' + px(L.counterTop - 146);
    E.plantR.style.cssText = 'left:630px;top:' + px(L.counterTop - 146);
    E.leafL.style.cssText = 'left:-170px;top:110px;transform:rotate(32deg)';
    E.leafR.style.cssText = 'left:530px;top:110px;transform:scaleX(-1) rotate(32deg)';
    E.hudTop.style.top = '-65px';
    E.hudBot.style.top = px(L.botTop - 22);
    root.style.removeProperty('--sp');
    for (var i = 0; i < 8; i++) {
      var c = i % 4, r = Math.floor(i / 4), o = ST[i];
      o.el.style.width = ''; o.el.style.height = '';
      // back from the first-person view: the labels were scaled, and hidden when behind the player
      o.el.style.transform = ''; o.el.style.visibility = ''; o.vis = true; o.sk = 1;
      o.el.style.left = px(COL0 + c * (COLW + COLG));
      o.el.style.top = px(r === 0 ? L.row1 : L.row2);
    }
    Object.keys(CH).forEach(function (k) {
      var o = CH[k];
      o.x0 = o.xp;
      o.baseTop = L.laneBottom - o.h - (k === 'waiter' ? 10 : k === 'commis' ? 4 : 0);
      o.el.style.top = px(o.baseTop);
    });
    if (window.View3D) View3D.layout();
  }
  function layoutWide(H) {
    View3D.layout();                      // camera first: the stations are placed where the 3D puts them
    var m = View3D.metrics(), W = App.W;
    L.botTop = H - (App.wide ? 126 : 112);
    L.counterTop = m.counterY; L.custBottom = m.counterY + 16;
    root.style.setProperty('--sp', Math.round(m.geo[0].pw) + 'px');
    for (var i = 0; i < 8; i++) {
      var g = m.geo[i], o = ST[i];
      o.sx = g.sx; o.sy = g.base; o.ph = g.ph;
      o.el.style.width = px(g.pw); o.el.style.height = px(g.ph);
      o.el.style.left = px(g.sx - g.pw / 2); o.el.style.top = px(g.base - g.ph);
    }
    CH.chef.x0 = W / 2; CH.commis.x0 = W / 2 - m.geo[0].pw * 1.5; CH.waiter.x0 = W / 2 + m.geo[0].pw * 1.5;
    Object.keys(CH).forEach(function (k) { CH[k].baseTop = 0; });
  }
  // HUD: a 720 px column on phones, spread over the whole screen on a PC
  function placeHud() {
    var wide = isWide(), W = App.W, hub = mode === 'hub';
    function at(e, x, y) { e.style.left = px(x); e.style.top = y == null ? '' : px(y); }
    if (wide) {
      at(E.lvl, 30, 24);
      at(E.coins, hub ? 252 : 36, 30);
      at(E.bookBtn, W - 232, 16); at(E.setBtn, W - 124, 16); at(E.clubBtn, W - 340, 16);
      at(E.timer, W - 300, 30); at(E.pauseBtn, W - 124, 16);
      L.goalW = Math.min(900, W - 760);
      E.goal.style.left = px((W - L.goalW) / 2); E.goal.style.right = 'auto'; E.goal.style.width = px(L.goalW); E.goal.style.top = '18px';
      E.plaque.style.left = px((W - 460) / 2);
      E.hub.style.left = E.boosts.style.left = px((W - 720) / 2);
      // room to spare: the map button sits to the left of the shop instead of squeezing the big button
      E.openBtn.style.left = '200px'; E.openBtn.style.width = '320px';
      E.mapBtn.style.left = '-92px'; E.mapLab.style.left = '-112px';
    } else {
      at(E.lvl, 14, 8);
      at(E.coins, hub ? 232 : 186, 14);
      at(E.bookBtn, 508, 2); at(E.setBtn, 604, 2); at(E.clubBtn, 14, 100);
      at(E.timer, 560, 14); at(E.pauseBtn, 18, 2);
      L.goalW = 672;
      E.goal.style.left = ''; E.goal.style.right = ''; E.goal.style.width = ''; E.goal.style.top = '';
      E.hub.style.left = E.boosts.style.left = '0px';
      E.openBtn.style.left = L.showMap ? '238px' : '200px';
      E.openBtn.style.width = L.showMap ? '290px' : '320px';
      E.mapBtn.style.left = ''; E.mapLab.style.left = '';
    }
    E.hub.style.top = E.boosts.style.top = px(L.botTop);
    // choice of the view: under the name plate on a PC, on the beam under the top bar on a phone
    at(E.simBtn, wide ? (W - 340) / 2 : 190, wide ? 128 : 106);
    at(E.visitBtn, wide ? (W + 340) / 2 + 14 : 614, wide ? 120 : 100);
    L.goalX = wide ? (W - L.goalW) / 2 : 24; L.goalY = wide ? 18 : 92;
    L.coinX = parseFloat(E.coins.style.left) + 20; L.coinY = wide ? 62 : 46;
    L.timerX = parseFloat(E.timer.style.left) + 60;
    if (sh) updateGoal(true);
  }
  function layoutSeats() {
    var n = sh ? sh.seats.length : GD.seatsFor(App.save);
    Object.keys(CU).forEach(function (id) {
      var u = CU[id], p = seatPos(u.c.seat, n);
      u.left = p.x; u.top = p.top; u.sc = p.sc;
      u.el.style.left = px(p.x); u.el.style.top = px(p.top); u.el.style.transform = 'scale(' + p.sc + ')';
    });
  }

  // ---------------- decor & hub refresh ----------------
  function refreshDecor() {
    var s = App.save, d = s.decor, loc = GD.locById(s.loc || 'jungle');
    E.dining.style.backgroundImage = 'var(--a-' + loc.bg + ')';
    root.setAttribute('data-loc', loc.id);
    var jungle = loc.id === 'jungle';
    E.leafL.style.display = E.leafR.style.display = jungle || loc.id === 'plage' ? 'block' : 'none';
    E.lanterns.style.display = d.lanternes ? 'block' : 'none';
    if (d.lanternes) E.lanterns.style.backgroundImage = 'url("' + Art.lanterns(d.lanternes) + '")';
    E.plantL.style.display = d.plantes >= 1 ? 'block' : 'none';
    E.plantR.style.display = d.plantes >= 2 ? 'block' : 'none';
    E.plantL.style.backgroundImage = 'url("' + Art.plant(1) + '")';
    E.plantR.style.backgroundImage = 'url("' + Art.plant(d.plantes >= 3 ? 2 : 1) + '")';
    if (d.plantes >= 3) E.plantL.style.backgroundImage = 'url("' + Art.plant(2) + '")';
    E.drums.style.display = d.musique ? 'block' : 'none';
    E.drums.style.backgroundImage = 'url("' + Art.drums() + '")';
    E.notes.innerHTML = '';
    if (d.musique) {
      var cols = ['#ffd23a', '#ff6f91', '#6ec6ff'];
      for (var i = 0; i < d.musique + 1; i++) {
        var n = el('div', 'deco-note', E.notes);
        n.style.backgroundImage = 'url("' + Art.note(cols[i % 3]) + '")';
        n.style.left = px(i * 26); n.style.animationDelay = (i * 0.85) + 's';
      }
    }
    var restoName = loc.id === 'jungle' ? (s.name || 'Chez Cuistot') : loc.resto;
    E.sign.querySelector('span').textContent = restoName;
    E.plaque.querySelector('span').textContent = restoName;
    E.plaque.querySelector('small').textContent = loc.name + ' • Jour ' + s.unlocked;
    E.sign.classList.toggle('lit', d.enseigne >= 2);
    var bulbs = E.sign.querySelector('.bulbs');
    bulbs.innerHTML = '';
    if (d.enseigne >= 1) {
      var nb = d.enseigne >= 3 ? 14 : 8;
      for (var b = 0; b < nb; b++) {
        var bi = el('i', '', bulbs), t = b / nb;
        var per = 2 * (368 + 100), pos = t * per, x, y;
        if (pos < 368) { x = pos; y = -6; } else if (pos < 468) { x = 362; y = pos - 368 - 6; } else if (pos < 836) { x = 368 - (pos - 468); y = 94; } else { x = -6; y = 100 - (pos - 836) - 6; }
        bi.style.left = px(x); bi.style.top = px(y); bi.style.animationDelay = (b % 2 ? 0.6 : 0) + 's';
      }
    }
    CH.commis.el.style.display = s.staff.commis ? 'block' : 'none';
    CH.waiter.el.style.display = s.staff.serveur ? 'block' : 'none';
  }

  function refreshStations() {
    var s = App.save;
    for (var i = 0; i < 8; i++) {
      var o = ST[i], def = o.def, lv = s.stations[def.id] || 0;
      var owned = lv > 0;
      var cls = 'station' + (owned ? '' : (s.level >= def.unlock ? ' empty' : ' locked'));
      if (mode === 'hub' && owned && lv < GD.MAX_ST_LEVEL && s.coins >= GD.upgradeCost(def, lv)) cls += ' can-up';
      o.el.className = cls + (o.hands ? ' hands' : '');
      o.lv.style.display = owned ? 'flex' : 'none';
      o.lv.textContent = lv;
      o.nm.style.display = owned ? 'flex' : 'none';
      o.sti.style.display = 'block';
      o.sti.style.opacity = owned ? 1 : 0.35;
      if (owned) o.over.innerHTML = '';
      else if (s.__defi) o.over.innerHTML = '<div class="t1" style="opacity:.8">Fermé</div>';
      else if (s.level >= def.unlock) {
        o.over.innerHTML = mode === 'hub' ? '<div class="plus"><img src="' + Art.plus() + '"></div><div class="t1">' + def.name + '</div><div class="t2 gold"><img class="coin" src="' + Art.coin() + '"> ' + fmt(def.cost) + '</div>' : '<div class="t1" style="opacity:.8">À acheter</div>';
      } else {
        o.over.innerHTML = '<div class="lock"></div><div class="t1">Niveau ' + def.unlock + '</div>';
      }
      o.nReady = -1;
    }
  }

  function refreshHud() {
    var s = App.save;
    var hub = mode === 'hub';
    E.lvl.style.display = hub ? 'block' : 'none';
    E.setBtn.style.display = hub ? 'block' : 'none';
    E.pauseBtn.style.display = hub ? 'none' : 'block';
    E.timer.style.display = hub ? 'none' : 'block';
    E.goal.style.display = hub ? 'none' : 'block';
    E.hub.style.display = hub ? 'block' : 'none';
    E.boosts.style.display = hub ? 'none' : 'flex';
    E.plaque.style.display = hub ? '' : 'none';
    E.lvl.querySelector('.st').textContent = s.level;
    E.lvl.querySelector('.xb i').style.width = px(4 + 128 * Math.min(1, s.xp / GD.xpNeed(s.level)));
    E.openBtn.querySelector('small').textContent = 'Jour ' + s.unlocked;
    // shown as soon as the device can draw 3D (if "Vue 3D" is off, the button offers to turn it on)
    var simOk = hub && window.View3D && View3D.supported() && !View3D.failed() && !!s.seenTuto.basic && !fpsOn();
    E.simBtn.style.display = simOk ? 'flex' : 'none';
    E.visitBtn.style.display = simOk ? 'flex' : 'none';
    var simOn = !!s.settings.sim && View3D.usable();
    E.simBtn.classList.toggle('on', simOn);
    E.simBtn.querySelector('span').textContent = simOn ? 'Vue simulateur' : 'Vue gérant';
    E.shopBadge.style.display = Progress.canAffordSomething(s) ? 'flex' : 'none';
    E.bookBtn.style.display = hub ? 'flex' : 'none';
    E.clubBtn.style.display = hub && s.seenTuto.basic ? 'flex' : 'none';
    var cw = hub && window.Daily ? Daily.waiting() : 0, cbg = E.clubBtn.querySelector('.badge');
    cbg.style.display = cw ? 'flex' : 'none'; cbg.textContent = cw;
    var places = GD.LOCATIONS.filter(function (l) { return GD.locUnlocked(s, l.id); }).length;
    var showMap = hub && places > 1;
    L.showMap = showMap;
    E.mapBtn.style.display = E.mapLab.style.display = showMap ? 'block' : 'none';
    var newPlace = GD.LOCATIONS.some(function (l) { return GD.locUnlocked(s, l.id) && !(s.flags.visited || {})[l.id] && l.id !== 'jungle'; });
    E.mapBtn.querySelector('.badge').style.display = newPlace ? 'flex' : 'none';
    var nb = Story.unreadCount(), bb = E.bookBtn.querySelector('.badge');
    bb.style.display = nb ? 'flex' : 'none'; bb.textContent = nb;
    placeHud();
    refreshBoosters();
  }
  function refreshBoosters() {
    var s = App.save;
    GD.BOOSTER_ORDER.forEach(function (id) {
      var b = E.bst[id], B = GD.BOOSTERS[id], n = s.boosters[id] || 0;
      var lockd = s.level < B.unlock;
      b.style.display = lockd ? 'none' : 'flex';
      var bd = b.querySelector('.badge');
      bd.textContent = n; bd.style.display = n > 0 ? 'flex' : 'none';
      b.classList.toggle('zero', n <= 0);
    });
  }

  function setMode(m, shift) {
    mode = m; sh = shift || null;
    // clear customers
    Object.keys(CU).forEach(function (id) { CU[id].el.remove(); delete CU[id]; });
    E.fx.innerHTML = '';
    root.classList.remove('turbo'); root.classList.remove('rush');
    refreshDecor(); refreshStations(); refreshHud();
    for (var i = 0; i < 8; i++) {
      var o8 = ST[i];
      o8.ready.innerHTML = ''; o8.nReady = 0; o8.el.classList.remove('cooking');
      if (o8.units) { o8.units.remove(); o8.stock.remove(); o8.units = null; }      // gauges of the simulator
      o8.hands = false;
    }
    Object.keys(CH).forEach(function (k) { var o = CH[k]; o.x = o.x0; o.path = []; o.work = 0; setCharMood(o, 'happy'); o.el.style.left = px(o.x - o.w / 2); o.el.className = 'chr'; });
    E.goal.classList.toggle('relax', !!(sh && sh.relax));
    E.hearts.style.display = sh && sh.relax ? 'none' : 'flex';
    if (sh) { updateGoal(true); updateHearts(); }
    shownCoins = App.save.coins;
    E.coins.querySelector('span').textContent = fmt(shownCoins);
  }

  // ---------------- input ----------------
  function onStation(i) {
    if (UI.isBlocking()) return;
    if (fpsOn()) { Fps.tapStation(i); return; }
    ST[i].bumpT = performance.now();
    if (mode === 'hub') {
      Sfx.play('click');
      UI.stationPopup(i);
      return;
    }
    if (!sh || sh.over || Game.isPaused()) return;
    var r = sh.tapStation(i);
    var o = ST[i];
    if (r === 'locked') { Sfx.play('nope'); bumpCls(o.el, 'nope'); UI.toast(App.save.level >= o.def.unlock ? 'Achète cette station dans la boutique !' : 'Débloquée au niveau ' + o.def.unlock); }
    else if (r === 'busy') { Sfx.play('nope'); bumpCls(o.el, 'nope'); }
    else if (r === 'nodemand') { Sfx.play('nope'); bumpCls(o.el, 'nope'); UI.toast('Personne n\'a commandé ça !'); }
    else bumpCls(o.el, 'bump');
    Tuto.onAction('station', i, r);
  }
  function onCustomer(id) {
    if (!sh || sh.over || Game.isPaused() || UI.isBlocking()) return;
    if (fpsOn()) { Fps.interact(); return; }
    var u = CU[id]; if (!u) return;
    var n = sh.tapCustomer(u.c.seat);
    if (!n) { bumpCls(u.el, 'shake'); }
  }
  function bumpCls(e, c) { e.classList.remove(c); void e.offsetWidth; e.classList.add(c); setTimeout(function () { e.classList.remove(c); }, 420); }

  // ---------------- customers ----------------
  function makeCust(c) {
    var n = sh.seats.length, p0 = seatPos(c.seat, n);
    var e = el('div', 'cust', E.seats, '<div class="body"></div>');
    e.style.left = px(p0.x);
    e.style.top = px(p0.top);
    if (p0.sc !== 1) e.style.transform = 'scale(' + p0.sc + ')';
    e.style.opacity = 0;
    var known = GD.introduced(App.save, c.animal);
    if (c.vip) el('div', 'vip', e, '<img src="' + Art.crown() + '">' + (known ? 'MME BENALI' : 'CRITIQUE'));
    else if (known) el('div', 'tagn', e, GD.PEOPLE[c.animal].name);
    var u = { el: e, c: c, body: e.querySelector('.body'), mood: '', bub: null, its: [], happyT: 0, y: 70, vein: null, op: 0,
      left: p0.x, top: p0.top, sc: p0.sc };
    e.addEventListener('pointerdown', function (ev) { ev.preventDefault(); onCustomer(c.id); });
    CU[c.id] = u;
    setCustMood(u, 'neutral');
    return u;
  }
  function setCustMood(u, m) {
    if (u.mood === m) return;
    u.mood = m;
    u.body.style.backgroundImage = 'var(--a-cu_' + u.c.animal + '_' + m + ')';
    if (m === 'angry' && !u.vein) { u.vein = el('div', 'vein', u.el); }
    if (m !== 'angry' && u.vein) { u.vein.remove(); u.vein = null; }
  }
  function showBubble(u) {
    var c = u.c;
    var b = el('div', 'bubble' + (c.items.length === 3 ? ' n3' : ''), u.el, '<div class="items"></div><div class="pat"><i></i></div>');
    var box = b.querySelector('.items');
    u.its = c.items.map(function (it) {
      var d = el('div', 'it', box); d.style.backgroundImage = Art.dishBg(it.dish); return d;
    });
    u.pat = b.querySelector('.pat i');
    u.bub = b;
  }

  function updateCustomers(dt) {
    var seen = {};
    for (var k = 0; k < sh.customers.length; k++) {
      var c = sh.customers[k];
      seen[c.id] = 1;
      var u = CU[c.id] || makeCust(c);
      // vertical motion: rise in, sink out
      var target = 0, op = 1;
      if (c.state === 'in') op = Math.min(1, c.stateT / 0.45);
      if (c.state === 'out') {
        if (c.stateT < 0.35) target = c.happy ? -14 : 0;
        else { target = 70; op = Math.max(0, 1 - (c.stateT - 0.35) / 0.4); }
      }
      var sp = c.state === 'in' ? 160 : 260;
      if (u.y < target) u.y = Math.min(target, u.y + sp * dt); else if (u.y > target) u.y = Math.max(target, u.y - sp * dt);
      u.body.style.transform = 'translateY(' + px(u.y) + ')';
      if (u.op !== op) { u.op = op; u.el.style.opacity = op.toFixed(2); }
      // simulator: "?" until somebody takes the order
      if (c.state === 'ask' && !u.ask) {
        u.ask = el('div', 'bubble ask', u.el, '<div class="q">?</div><div class="pat"><i></i></div>');
        u.askPat = u.ask.querySelector('.pat i');
        bumpCls(u.el, 'bounce');
      }
      if (u.ask) {
        if (c.state !== 'ask') { u.ask.remove(); u.ask = null; }
        else { var ra = Math.max(0, c.patience / c.maxPatience); u.askPat.style.width = px(3 + (128 - 6) * ra); u.askPat.className = ra < 0.3 ? 'low' : ra < 0.6 ? 'mid' : ''; }
      }
      if (c.state === 'wait' && !u.bub) { showBubble(u); bumpCls(u.el, 'bounce'); }
      if (u.bub) {
        if (c.state === 'out') { u.bub.remove(); u.bub = null; }
        else {
          for (var j = 0; j < c.items.length; j++) if (c.items[j].done && !u.its[j].classList.contains('done')) u.its[j].classList.add('done');
          var r = Math.max(0, c.patience / c.maxPatience);
          u.pat.style.width = px(3 + (128 - 6) * r);
          u.pat.className = r < 0.3 ? 'low' : r < 0.6 ? 'mid' : '';
        }
      }
      // mood
      var m;
      if (c.state === 'out') m = c.happy ? 'happy' : 'angry';
      else if (u.happyT > 0) { u.happyT -= dt; m = 'happy'; }
      else if (c.state === 'in') m = 'neutral';
      else { var rr = c.patience / c.maxPatience; m = sh.relax ? (rr > 0.45 ? 'neutral' : 'worried') : rr > 0.6 ? 'neutral' : rr > 0.3 ? 'worried' : 'angry'; }
      setCustMood(u, m);
    }
    Object.keys(CU).forEach(function (id) { if (!seen[id]) { CU[id].el.remove(); delete CU[id]; } });
  }

  // ---------------- stations (shift) ----------------
  // simulator: one small gauge per thing on the fire (what it needs is written on it) and the stock left
  var UNIT_IC = { cook: '', mid: '↻', done: '✓', fin: '', burnt: '✖' };
  function updateUnits(o, s) {
    if (!o.units) { o.units = el('div', 'units', o.el); o.stock = el('div', 'stock', o.el); o.uc = []; o.stockV = -1; }
    var n = s.cooking.length, nf = s.hd.fin.length, k;
    while (o.uc.length < n) { var e = el('div', 'unit', o.units, '<i></i><b></b>'); o.uc.push({ el: e, bar: e.firstChild, ic: e.lastChild, cls: '', txt: '', w: -1 }); }
    while (o.uc.length > n) o.uc.pop().el.remove();
    for (k = 0; k < n; k++) {
      var u = s.cooking[k], c = o.uc[k], pct = u.ph === 'cook' || u.ph === 'mid' ? u.t / u.total : 1;
      var cls = 'unit ' + u.ph, txt = u.ph === 'fin' ? u.fin + '/' + nf : UNIT_IC[u.ph];
      if (u.ph === 'done' && s.hd.burn && !sh.relax && u.by !== 'commis' && u.w > GD.SIM.burnDone * 0.5) cls += ' hot';
      if (u.ph === 'mid' && s.hd.burn && !sh.relax && u.by !== 'commis' && u.w > GD.SIM.burnMid * 0.5) cls += ' hot';
      if (c.cls !== cls) { c.cls = cls; c.el.className = cls; }
      if (c.txt !== txt) { c.txt = txt; c.ic.textContent = txt; }
      var w = Math.round(Math.min(1, pct) * 100);
      if (c.w !== w) { c.w = w; c.bar.style.width = w + '%'; }
    }
    if (o.stockV !== s.stock) { o.stockV = s.stock; o.stock.textContent = '×' + s.stock; o.stock.className = 'stock' + (s.stock <= 0 ? ' empty' : s.stock <= 2 ? ' low' : ''); }
  }
  function updateStations() {
    for (var i = 0; i < 8; i++) {
      var o = ST[i], s = sh.stations[i];
      if (o.hands !== !!sh.manual) { o.hands = !!sh.manual; o.el.classList.toggle('hands', o.hands); if (!o.hands && o.units) { o.units.remove(); o.stock.remove(); o.units = null; } }
      if (!s.owned) continue;
      var ck = s.cooking.length;
      if (sh.manual) updateUnits(o, s);
      o.el.classList.toggle('cooking', ck > 0);
      if (ck > 0) {
        o.prog[1].style.width = px(3 + 114 * Math.min(1, s.cooking[0].t / s.cooking[0].total));
        o.progBox[0].style.display = ck > 1 ? 'block' : 'none';
        if (ck > 1) o.prog[0].style.width = px(3 + 114 * Math.min(1, s.cooking[1].t / s.cooking[1].total));
      } else { o.progBox[0].style.display = 'none'; }
      if (o.nReady !== s.ready) {
        var add = s.ready > o.nReady && o.nReady >= 0;
        o.ready.innerHTML = '';
        for (var r = 0; r < Math.min(3, s.ready); r++) {
          var d = el('div', 'dish', o.ready);
          d.style.backgroundImage = Art.dishBg(o.def.dish);
          if (!add || r < s.ready - 1) d.style.animation = 'dishBob 1.2s ease-in-out infinite';
          d.style.animationDelay = (r * 0.15) + 's';
        }
        o.nReady = s.ready;
      }
    }
  }

  // ---------------- characters ----------------
  function goTo(o, x, then) { o.path = [{ x: x, then: then }]; }
  function goPath(o, pts) { o.path = pts; }
  function updateChars(dt) {
    Object.keys(CH).forEach(function (k) {
      var o = CH[k];
      if (o.el.style.display === 'none') return;
      var walking = false;
      if (o.path.length) {
        var p = o.path[0], dx = p.x - o.x, sp = (k === 'chef' ? 1100 : 700) * (is3d() ? 2.2 : 1) * dt;
        if (Math.abs(dx) <= sp) {
          o.x = p.x; o.path.shift();
          if (p.then) p.then();
        } else { o.x += Math.sign(dx) * sp; o.dir = dx < 0 ? -1 : 1; walking = true; }
      }
      if (o.work > 0) o.work -= dt;
      if (o.moodT > 0) { o.moodT -= dt; if (o.moodT <= 0) setCharMood(o, o.work > 0 ? 'focus' : 'happy'); }
      var cls = 'chr' + (walking ? ' walk' : o.work > 0 ? ' work' : '');
      if (o.el.className !== cls) o.el.className = cls;
      o.el.style.left = px(o.x - o.w / 2);
    });
  }

  // ---------------- HUD ----------------
  function updateGoal(force) {
    var g = E.goal, t = sh.thresholds, W = (L.goalW || 672) - (sh.relax ? 0 : 190);
    var f = Math.min(1, sh.earned / t[2]);
    g.querySelector('.fill').style.width = px(8 + (W - 16) * f);
    var next = sh.earned < t[0] ? t[0] : sh.earned < t[1] ? t[1] : t[2];
    g.querySelector('.txt').innerHTML = fmt(Math.floor(sh.earned)) + ' / ' + fmt(next);
    var mks = g.querySelectorAll('.mk');
    for (var i = 0; i < 3; i++) {
      mks[i].style.left = px(8 + (W - 16) * (t[i] / t[2]) - (i === 2 ? 14 : 0));
      var on = sh.earned >= t[i];
      if (on && !mks[i].classList.contains('on')) { mks[i].classList.add('on'); if (!force) { Sfx.play('star'); sparkAt(L.goalX + 12 + (W - 16) * (t[i] / t[2]), L.goalY + 36, 6); } }
      if (!on) mks[i].classList.remove('on');
    }
  }
  function updateHearts() {
    var hs = E.hearts.children;
    for (var i = 0; i < 5; i++) hs[i].className = i < sh.hearts ? '' : 'off';
  }
  function updateTimer() {
    var t = Math.max(0, Math.ceil(sh.timeLeft));
    E.timer.querySelector('span').textContent = Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
    E.timer.classList.toggle('hurry', t <= 10 && !sh.tutorial && !sh.relax);
  }
  function updateCoins(dt) {
    var target = App.save.coins;
    if (shownCoins !== target) {
      var diff = target - shownCoins;
      var step = Math.max(1, Math.abs(diff) * Math.min(1, dt * 8));
      shownCoins = Math.abs(diff) <= step ? target : shownCoins + Math.sign(diff) * step;
      E.coins.querySelector('span').textContent = fmt(Math.floor(shownCoins));
    }
  }
  function updateBoostersUi() {
    GD.BOOSTER_ORDER.forEach(function (id) {
      var b = E.bst[id], act = (id === 'turbo' && sh.boost.turbo > 0) || (id === 'chance' && sh.boost.chance > 0);
      b.classList.toggle('active', act);
      var t = id === 'turbo' ? sh.boost.turbo : id === 'chance' ? sh.boost.chance : 0;
      var n = App.save.boosters[id] || 0;
      var want = act ? Math.ceil(t) + ' s' : n <= 0 ? '<img class="coin" src="' + Art.coin() + '">' + GD.BOOSTERS[id].cost : '';
      var tm = b.querySelector('.tm');
      if (tm._v !== want) { tm._v = want; tm.innerHTML = want; }
    });
    root.classList.toggle('turbo', sh.boost.turbo > 0);
  }

  // ---------------- FX ----------------
  function ftext(x, y, txt, cls) {
    var e = el('div', 'ftxt ' + (cls || 'gold'), E.fx, txt);
    var w = e.offsetWidth || 0;
    e.style.left = px(Util.clamp(x, w / 2 + 10, App.W - 10 - w / 2)); e.style.top = px(y);
    setTimeout(function () { e.remove(); }, 1550);
  }
  function sparkAt(x, y, n) {
    for (var i = 0; i < n; i++) {
      var s = el('div', 'spark', E.fx), a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 50;
      s.style.left = px(x); s.style.top = px(y);
      s.style.setProperty('--dx', px(Math.cos(a) * d)); s.style.setProperty('--dy', px(Math.sin(a) * d));
      setTimeout(function (s) { return function () { s.remove(); }; }(s), 820);
    }
  }
  var flyers = [];
  function flyCoins(x, y, n) {
    var tx = L.coinX, ty = L.coinY;
    for (var i = 0; i < n; i++) {
      var e = el('div', 'fcoin', E.fx);
      flyers.push({ e: e, x0: x + (Math.random() - 0.5) * 50, y0: y + (Math.random() - 0.5) * 30, x1: tx, y1: ty, t: -i * 0.06, d: 0.55 });
    }
  }
  function flyDish(dish, x0, y0, x1, y1) {
    var e = el('div', 'fcoin', E.fx);
    e.style.background = Art.dishBg(dish) + ' center/contain no-repeat';
    e.style.width = '60px'; e.style.height = '60px'; e.style.margin = '-30px 0 0 -30px';
    flyers.push({ e: e, x0: x0, y0: y0, x1: x1, y1: y1, t: 0, d: 0.32, arc: 80 });
  }
  function updateFlyers(dt) {
    for (var i = flyers.length - 1; i >= 0; i--) {
      var f = flyers[i];
      f.t += dt;
      var k = Math.max(0, Math.min(1, f.t / f.d));
      var e2 = k * k * (3 - 2 * k);
      var x = f.x0 + (f.x1 - f.x0) * e2, y = f.y0 + (f.y1 - f.y0) * e2 - (f.arc || 60) * Math.sin(Math.PI * k);
      f.e.style.left = px(x); f.e.style.top = px(y);
      f.e.style.opacity = f.t < 0 ? 0 : 1;
      if (f.t >= f.d) {
        f.e.remove(); flyers.splice(i, 1);
        if (!f.arc) { bumpCls(E.coins, 'bump'); }
      }
    }
  }
  function hearts(x, y) {
    for (var i = 0; i < 3; i++) {
      var h = el('div', 'fheart', E.fx);
      h.style.left = px(x + (i - 1) * 22); h.style.top = px(y); h.style.animationDelay = (i * 0.12) + 's';
      h.style.setProperty('--dx', px((i - 1) * 24));
      setTimeout(function (h) { return function () { h.remove(); }; }(h), 1500);
    }
  }
  function steams(x, y) {
    for (var i = 0; i < 2; i++) {
      var h = el('div', 'fsteam', E.fx);
      h.style.left = px(x + (i ? 40 : -40)); h.style.top = px(y); h.style.setProperty('--dx', px(i ? 26 : -26));
      setTimeout(function (h) { return function () { h.remove(); }; }(h), 1050);
    }
  }

  // ---------------- events from the simulation ----------------
  // where a customer is on screen (2D layout, or projected from the 3D view)
  // where the staff must walk (stage px at the fixed camera) to stand at a station / in front of a customer
  function stStaffX(i) { return is3d() ? View3D.staffSx(View3D.metrics().geo[i].x) : stationCenter(i).x; }
  function seatStaffX(c) { return is3d() ? View3D.staffSx(View3D.seatX(c.seat, sh.seats.length)) : custPos(c).x; }
  function custPos(c) {
    var u = CU[c.id];
    if (u && u.vis === false) return { x: App.W / 2, y: App.H * 0.42, hidden: true };     // first person: behind the player
    if (u) return { x: u.left, y: u.top + 224 - 140 * u.sc };
    var p = seatPos(c.seat, sh.seats.length); return { x: p.x, y: p.top + 224 - 140 * p.sc };
  }
  function handleEvents() {
    var evs = sh.events; sh.events = [];
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i], p;
      switch (e.type) {
        case 'arrive':
          Sfx.play('arrive');
          if (e.c.vip) {
            p = custPos(e.c);
            ftext(p.x, p.y - 150, 'Critique gastronomique !', 'say gold');
            if (!App.save.seenTuto.vip) { App.save.seenTuto.vip = 1; UI.toast('La critique paie le double : sers-la vite !'); }
          }
          break;
        case 'order':
          Tuto.onAction('order', e.c);
          if (e.by) {                       // simulator: somebody took the order
            Sfx.play('order');
            p = custPos(e.c);
            if (!p.hidden) ftext(p.x, p.y - 150, e.by === 'serveur' ? 'C’est noté !' : pick(HELLO), 'say');
            if (e.by === 'serveur') goTo(CH.waiter, seatStaffX(e.c), null);
          }
          break;
        case 'ask': Sfx.play('bell'); break;
        case 'dirty': p = custPos(e.c); if (!p.hidden) ftext(p.x, p.y - 150, 'Oh… c’est sale ici.', 'say'); break;
        case 'mid': if (e.u.by !== 'commis') Sfx.play('tick'); break;
        case 'flip': Sfx.play('flip'); if (e.by === 'commis') goTo(CH.commis, stStaffX(e.st.i), null); break;
        case 'cooked': if (e.u.by !== 'commis') Sfx.play('cooked'); break;
        case 'step':
          Sfx.play(STEP_SND[e.st.def.id + e.step] || STEP_SND[e.st.def.id] || 'stack');
          if (e.by === 'commis') goTo(CH.commis, stStaffX(e.st.i), null);
          break;
        case 'burnt': {
          Sfx.play('burnt'); Vib.buzz(60);
          var sb = stationCenter(e.st.i);
          if (ST[e.st.i].vis !== false) ftext(sb.x, sb.top - 20, 'Brûlé !', 'say');
          if (!App.save.seenTuto.burnt) { App.save.seenTuto.burnt = 1; UI.toast('C’est brûlé ! Jette-le et recommence (en Détente, rien ne brûle).'); }
          break;
        }
        case 'trash': Sfx.play('trash'); break;
        case 'restock': {
          Sfx.play('restock');
          var sr = stationCenter(e.st.i);
          if (ST[e.st.i].vis !== false) ftext(sr.x, sr.top - 20, 'Stock plein !', 'say');
          if (e.by === 'commis') { goTo(CH.commis, stStaffX(e.st.i), null); CH.commis.work = 0.6; }
          break;
        }
        case 'wipe': Sfx.play('wipe'); break;
        case 'rush':
          if (e.on) { Sfx.play('bell'); UI.toast('Coup de feu ! Les clients arrivent plus vite pendant un moment.'); }
          else UI.toast('Le coup de feu est passé. Ouf !');
          Sfx.setTempo((sh.relax ? 104 : 116) + (e.on ? 14 : 0));
          root.classList.toggle('rush', !!e.on);
          break;
        case 'cook': {
          var who = e.by === 'commis' ? CH.commis : CH.chef;
          goTo(who, stStaffX(e.st.i), null); who.work = 0.6; setCharMood(who, 'focus'); who.moodT = 0.7;
          Sfx.play('cook');
          break;
        }
        case 'ready': Sfx.play('ready'); Tuto.onAction('ready', e.st.i); break;
        case 'serve': {
          var sc2 = stationCenter(e.st.i); p = custPos(e.c);
          var idx = e.c.items.indexOf(e.item), nIt = e.c.items.length;
          var cu2 = CU[e.c.id], scl = cu2 ? cu2.sc : 1, sc3 = nIt >= 3 ? 50 : 60;
          var ix = p.x + (idx - (nIt - 1) / 2) * sc3 * scl;
          var from = e.by === 'player' && fpsOn() ? Fps.handsPos() : { x: sc2.x, y: sc2.top + 10 };
          if (!p.hidden && !(fpsOn() && ST[e.st.i].vis === false && e.by !== 'player'))
            flyDish(e.item.dish, from.x, from.y, ix, (cu2 ? cu2.top + 224 : L.custBottom) - (224 + 118 - 50) * scl);
          Sfx.play('serve');
          var u = CU[e.c.id]; if (u) u.happyT = 0.5;
          if (e.by === 'serveur') { goPath(CH.waiter, [{ x: stStaffX(e.st.i) }, { x: seatStaffX(e.c) }]); }
          else if (e.by !== 'auto' && e.by !== 'player') { goTo(CH.chef, stStaffX(e.st.i), null); CH.chef.moodT = 0.6; setCharMood(CH.chef, 'happy'); }
          Vib.buzz(15);
          break;
        }
        case 'prepay':                      // simulator: the order is paid at the register
          p = custPos(e.c);
          if (!p.hidden) { ftext(p.x, p.y - 40, '+' + fmt(e.amount)); flyCoins(p.x, p.y, Math.min(6, 2 + Math.floor(e.amount / 25))); }
          Sfx.play('coin');
          updateGoal();
          break;
        case 'refund':                      // paid at the register, never served: the money goes back
          p = custPos(e.c);
          if (!p.hidden && !sh.over) ftext(p.x, p.y - 112, 'Remboursé −' + fmt(e.amount), 'say bad');
          updateGoal(true);
          break;
        case 'poserr':
          p = custPos(e.c);
          if (!p.hidden) ftext(p.x, p.y - 150, 'Non, ce n’est pas ça !', 'say');
          Sfx.play('nope'); Vib.buzz(30);
          break;
        case 'pay':
          p = custPos(e.c);
          if (e.amount > 0) ftext(p.x, p.y - 40, '+' + fmt(e.amount) + (e.prepaid ? ' pourboire' : ''));
          var pr = e.c.patience / e.c.maxPatience;
          ftext(p.x, p.y - 96, e.c.vip ? 'Excellent ! ×2' : e.fav ? 'Mon plat préféré !' : e.perfect ? 'Service parfait !' : pr >= 0.4 ? pick(YUM) : (sh.relax ? 'Merci !' : 'Enfin…'), 'say');
          if (e.amount > 0) flyCoins(p.x, p.y, Math.min(6, 2 + Math.floor(e.amount / 25)));
          hearts(p.x, p.y - 10);
          Sfx.play(e.amount > 0 ? 'coin' : 'soft');
          updateGoal();
          Tuto.onAction('pay', e.c);
          break;
        case 'angry':
          p = custPos(e.c);
          steams(p.x, p.y - 20);
          Sfx.play('angry'); Vib.buzz(80);
          bumpCls(E.hearts, 'hit');
          updateHearts();
          setCharMood(CH.chef, 'worried'); CH.chef.moodT = 1.2;
          ftext(p.x, p.y - 60, pick(GRR), 'say');
          break;
        case 'booster':
          Sfx.play('booster');
          if (e.id === 'coeur') { updateHearts(); Object.keys(CU).forEach(function (id) { CU[id].happyT = 0.8; }); }
          if (e.id === 'temps') ftext(L.timerX, isWide() ? 130 : 120, '+15 s', 'wtxt');
          refreshBoosters();
          break;
        case 'closing': UI.toast(sh.manual ? 'On ferme ! Sers vite ceux qui ont payé.' : 'Dernières commandes : on termine les plats en cours !'); break;
        case 'friend':
          if (Story.TALES[e.who]) {
            p = custPos(e.c);
            Sfx.play('friend');
            ftext(p.x, p.y - 150, '<img src="' + ASSETS.heart + '" style="width:26px;vertical-align:-4px"> Amitié niv. ' + e.level, 'say gold');
            UI.toast('Amitié avec ' + GD.PEOPLE[e.who].name + ' : niveau ' + e.level + ' ! Nouvelle histoire dans le Carnet.');
          }
          break;
        case 'end': Game.onShiftEnd(e); break;
      }
    }
  }

  // ---------------- main update ----------------
  function update(dt) {
    updateChars(dt);
    updateFlyers(dt);
    updateCoins(dt);
    if (mode === 'shift' && sh) {
      handleEvents();
      updateCustomers(dt);
      updateStations();
      updateTimer();
      updateBoostersUi();
    }
    if (window.View3D) View3D.frame(dt);
  }
  function v3dState() { return { CU: CU, CH: CH, ST: ST, L: L, sh: sh, mode: mode, seatX: seatX }; }

  function stationRect(i) { var c = stationCenter(i); return { x: c.x, y: c.top, w: COLW, h: ROWH }; }
  function custRect(c) { var p = custPos(c); return { x: p.x, y: L.custBottom - 224 - 118 }; }
  // the first-person views need the 3D picture: offer to turn it on when it is off
  function need3d(then) {
    if (View3D.usable()) { then(); return; }
    UI.confirm('VUE 3D', 'Le mode Simulateur a besoin de la vue 3D.<br>L’activer maintenant ?', function () {
      App.save.view3d = true; Store.save(App.save);
      App.relayout();
      if (View3D.usable() && !View3D.failed()) then(); else UI.toast('La 3D ne fonctionne pas sur cet appareil.');
    });
  }
  function toggleSim() {
    var s = App.save;
    if (mode !== 'hub' || !s.seenTuto.basic || fpsOn()) return;
    Sfx.play('click');
    var want = !(s.settings.sim && View3D.usable());
    if (!want) { s.settings.sim = false; Store.save(s); refreshHud(); UI.toast('Vue gérant : tu diriges la cuisine d’en haut'); return; }
    need3d(function () {
      s.settings.sim = true; Store.save(s); refreshHud();
      UI.toast('Mode Simulateur : tu cuisines et tu sers toi-même, à la première personne');
    });
  }
  // keyboard (PC): same thing as a click on the station / the booster
  function pressStation(i) { if (ST[i]) onStation(i); }
  function pressBooster(k) { var id = GD.BOOSTER_ORDER[k]; if (id && E.bst[id].style.display !== 'none') Game.useBooster(id); }

  return {
    build: build, layout: layout, setMode: setMode, update: update, refreshStations: refreshStations, refreshHud: refreshHud,
    refreshDecor: refreshDecor, refreshBoosters: refreshBoosters, stationRect: stationRect, custRect: custRect, L: L, E: E,
    sparkAt: sparkAt, ftext: ftext, mode: function () { return mode; }, v3dState: v3dState, isWide: isWide, is3d: is3d,
    pressStation: pressStation, pressBooster: pressBooster, toggleSim: toggleSim
  };
})();
