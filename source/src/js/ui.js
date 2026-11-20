// ===================== UI: screens, modals, toasts, tutorial =====================
var UI = (function () {
  var layer, stack = [], titleEl, toastEl;
  var COIN = function () { return '<img class="coin" src="' + Art.coin() + '">'; };
  function el(tag, cls, parent, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function px(v) { return Math.round(v) + 'px'; }
  function pos(e, x, y, w, h) { e.style.left = px(x); e.style.top = px(y); if (w != null) e.style.width = px(w); if (h != null) e.style.height = px(h); return e; }
  function fmt(n) { return Util.fmt(n); }
  function onTap(e, fn, silent) { e.classList.add('tap'); e.addEventListener('click', function (ev) { ev.stopPropagation(); if (!silent) Sfx.play('click'); fn(ev); }); return e; }

  function board(p, x, y, w, h, k) { return pos(el('div', 'board' + (k ? ' ' + k : ''), p), x, y, w, h); }
  function paper(p, x, y, w, h, k) { return pos(el('div', 'paper' + (k ? ' ' + k : ''), p), x, y, w, h); }
  function leaf(p, y, txt, sm) { return pos(el('div', 'leaf', p, '<span' + (sm ? ' class="sm"' : '') + '>' + txt + '</span>'), 125, y); }
  function pill(p, x, y, w, h, html, fn, cls) { var b = pos(el('div', 'pill' + (cls ? ' ' + cls : ''), p, html), x, y, w, h); if (fn) onTap(b, fn); return b; }
  function sq(p, x, y, s, icon, fn) { var b = pos(el('div', 'sq', p), x, y, s, s); b.style.backgroundImage = 'var(--a-' + icon + ')'; if (fn) onTap(b, fn); return b; }
  function closeBtn(p, x, y, fn) { return onTap(pos(el('div', 'close', p), x, y), fn); }
  function txt(p, x, y, w, html, cls, size) { var t = pos(el('div', cls || 'ptxt', p, html), x, y, w); t.style.position = 'absolute'; if (size) t.style.fontSize = px(size); return t; }

  // ---------------- modal system ----------------
  function modal(h, opts) {
    opts = opts || {};
    var m = el('div', 'modal in', layer);
    var inner = el('div', 'inner', m);
    inner.style.height = px(h);
    var rec = { m: m, inner: inner, h: h, closable: opts.closable !== false, onClose: opts.onClose, onBack: opts.onBack };
    stack.push(rec);
    place(rec);
    if (opts.closable !== false && opts.tapOutside) m.addEventListener('click', function (e) { if (e.target === m) close(rec); });
    var api = { inner: inner, close: function (cb) { close(rec, cb); }, rec: rec };
    rec.api = api;
    return api;
  }
  function place(rec) { rec.inner.style.top = px(500 + Math.max(0, (App.H - rec.h) / 2)); }
  function close(rec, cb) {
    var i = stack.indexOf(rec);
    if (i < 0) { if (cb) cb(); return; }
    stack.splice(i, 1);
    rec.m.classList.add('closing');
    setTimeout(function () { rec.m.remove(); }, 180);
    if (rec.onClose) rec.onClose();
    if (cb) cb();
  }
  function closeAll() { while (stack.length) { var r = stack.pop(); r.m.remove(); } }
  function isBlocking() { return stack.length > 0; }
  function back() {
    if (!stack.length) return false;
    var top = stack[stack.length - 1];
    if (top.onBack) { top.onBack(); return true; }
    if (top.closable) { Sfx.play('click'); close(top); }
    return true;
  }
  function layout() { stack.forEach(place); if (titleEl) layoutTitle(); }

  function toast(msg) {
    toastEl.innerHTML = '';
    var d = el('div', '', toastEl, msg);
    var sh = Game.shift();
    toastEl.style.top = px(sh && !sh.over ? 172 : App.H * 0.42);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 2000);
  }

  // ---------------- banner ----------------
  function banner(title, sub, dur, then) {
    var b = el('div', 'banner in', layer.parentNode);
    b.style.top = px(App.H * 0.3);
    el('div', 'leaf', b, '<span>' + title + '</span>');
    if (sub) el('div', 'sub', b, sub);
    Sfx.play('whoosh');
    setTimeout(function () { b.className = 'banner out'; setTimeout(function () { b.remove(); if (then) then(); }, 380); }, dur || 1500);
  }

  // ---------------- title screen ----------------
  function buildTitle(scr) {
    titleEl = scr;
    scr.innerHTML = '';
    el('div', 't-bg', scr);
    var logo = el('div', 'logo', scr, '<span class="l1" data-t="CUISTOT"><span class="g">CUISTOT</span></span><br><span class="l2" data-t="TYCOON"><span class="g">TYCOON</span></span><span class="sub">Le resto de la jungle</span>');
    var a1 = el('div', 't-cust', scr); a1.style.backgroundImage = 'var(--a-cu_touriste_happy)';
    var a3 = el('div', 't-cust r', scr); a3.style.backgroundImage = 'var(--a-cu_papi_happy)';
    var chef = el('div', 't-chef', scr); chef.style.backgroundImage = 'var(--a-chef_happy)';
    var counter = el('div', 'counter t-counter', scr);
    var play = onTap(el('div', 't-play', scr), function () { Game.enterHub(); });
    var lab = el('div', 't-label lg wtxt', scr, 'JOUER');
    var row = el('div', 't-btns', scr);
    var b1 = onTap(el('div', '', row), function () { settings(); }); b1.style.backgroundImage = 'var(--a-big_setting)';
    var b2 = onTap(el('div', '', row), function () { levels(); }); b2.style.backgroundImage = 'var(--a-big_leader)';
    var b3 = onTap(el('div', '', row), function () { help(); }); b3.style.backgroundImage = 'var(--a-big_about)';
    if (Platform.canExit()) { var b4 = onTap(el('div', '', row), function () { confirmExit(); }); b4.style.backgroundImage = 'var(--a-b_close)'; b4.style.backgroundSize = '92%'; }
    el('div', 't-ver' + (/test/.test(APP_VERSION) ? ' test' : ''), scr, 'v' + APP_LABEL);
    titleEl._p = { logo: logo, a1: a1, a3: a3, chef: chef, counter: counter, play: play, lab: lab, row: row };
    layoutTitle();
  }
  function layoutTitle() {
    var p = titleEl._p, H = App.H;
    var logoTop = Math.round(H * 0.05);
    p.logo.style.top = px(logoTop);
    var chefS = Util.clamp(Math.round(300 + (H - 1280) * 0.4), 290, 370);
    var counterTop = Math.max(Math.round(H * 0.53), logoTop + 288 + chefS - 26);
    var custW = Math.round(chefS * 0.66), custH = Math.round(custW * 4 / 3);
    pos(p.chef, 360 - chefS / 2, counterTop + 26 - chefS, chefS, chefS);
    pos(p.a1, 112 - custW / 2, counterTop + 18 - custH, custW, custH);
    pos(p.a3, 608 - custW / 2, counterTop + 18 - custH, custW, custH);
    p.counter.style.top = px(counterTop);
    var playS = H < 1240 ? 190 : 210;
    pos(p.play, 360 - playS / 2, counterTop + 100, playS, playS);
    p.lab.style.top = px(counterTop + 100 + playS - 14);
    p.row.style.top = px(Math.max(H * 0.84, counterTop + 100 + playS + 44));
  }
  function confirmExit() {
    confirm('QUITTER ?', 'Tu veux vraiment quitter le jeu ?<br>Ta partie est sauvegardée.', function () { Store.save(App.save); Platform.exit(); });
  }

  // ---------------- confirm ----------------
  function confirm(title, text, onYes, onNo) {
    var md = modal(520);
    var I = md.inner;
    board(I, 100, 70, 520, 420, 'b-a');
    leaf(I, 0, title, title.length > 11);
    txt(I, 150, 190, 420, text, 'ptxt ctxt lg', 27).style.color = '#fff6dc';
    pill(I, 140, 360, 210, 84, 'NON', function () { md.close(); if (onNo) onNo(); }, 'red');
    pill(I, 370, 360, 210, 84, 'OUI', function () { md.close(); onYes(); });
    return md;
  }

  // ---------------- pause ----------------
  function pause(sh) {
    var md = modal(660, { onBack: function () { md.close(); } });
    var I = md.inner;
    board(I, 80, 70, 560, 540, 'b-a');
    leaf(I, 0, 'PAUSE');
    var pp = paper(I, 130, 170, 460, 250, 'p-a');
    txt(I, 130, 196, 460, '<span class="lg" style="font-size:34px;color:#6b3a14">JOUR ' + sh.day + '</span><br>Objectif : <b>' + fmt(sh.goal) + '</b> ' + COIN() + '<br>Gagné : <b>' + fmt(sh.earned) + '</b> ' + COIN(), 'ptxt', 26);
    var mb = sq(I, 238, 330, 74, App.save.settings.music > 0 ? 'b_sound' : 'b_sound_off', function () {
      App.save.settings.music = App.save.settings.music > 0 ? 0 : 0.6; applySettings(); mb.style.backgroundImage = 'var(--a-' + (App.save.settings.music > 0 ? 'b_sound' : 'b_sound_off') + ')';
    });
    var sb = sq(I, 408, 330, 74, App.save.settings.sfx > 0 ? 'b_misic' : 'b_music_off', function () {
      App.save.settings.sfx = App.save.settings.sfx > 0 ? 0 : 0.8; applySettings(); sb.style.backgroundImage = 'var(--a-' + (App.save.settings.sfx > 0 ? 'b_misic' : 'b_music_off') + ')';
    });
    sq(I, 150, 452, 100, 'b_restart', function () { confirm('RECOMMENCER ?', 'Recommencer le jour ' + sh.day + ' ?<br>Les pièces déjà gagnées sont gardées.', function () { md.close(); Game.startDay(sh.day); }); });
    sq(I, 300, 440, 124, 'b_play', function () { md.close(); });
    sq(I, 470, 452, 100, 'b_menu', function () { confirm('QUITTER ?', 'Fermer le restaurant et revenir à la cuisine ?<br>Le jour ne sera pas validé.', function () { md.close(); Game.quitShift(); }); });
    return md;
  }

  // ---------------- results ----------------
  function results(sh, res, onAction) {
    var win = sh.win, H = win ? 880 : 860;
    var md = modal(H, { closable: false, onBack: function () { go('hub'); } });
    var I = md.inner;
    board(I, 60, 100, 600, 700);
    leaf(I, 26, win ? 'VICTOIRE !' : (sh.relax ? 'PRESQUE !' : 'PERDU !'));
    var starPos = [[178, 190, 120], [300, 158, 138], [438, 190, 120]];
    var stars = starPos.map(function (p, i) {
      var s = pos(el('div', '', I), p[0] - 6 + (i === 1 ? -8 : 0), p[1], p[2], p[2]);
      s.style.cssText += ';position:absolute;background:var(--a-star) center/contain no-repeat;filter:grayscale(1) brightness(1.25) contrast(.8);transition:filter .2s';
      return s;
    });
    var pp = paper(I, 105, 320, 510, 330, 'p-a');
    var lines = '';
    lines += '<div class="lg" style="font-size:32px;color:#6b3a14;margin-bottom:6px">JOUR ' + sh.day + (win ? ' RÉUSSI !' : '') + '</div>';
    lines += 'Gains : <b>' + fmt(sh.earned) + '</b> ' + COIN() + ' <span style="opacity:.75">(objectif ' + fmt(sh.goal) + ')</span><br>';
    lines += 'Clients servis : <b>' + sh.served + '</b>' + (sh.lost ? ' • partis fâchés : <b>' + sh.lost + '</b>' : '') + '<br>';
    if (sh.tips) lines += 'Pourboires : <b>' + fmt(sh.tips) + '</b> ' + COIN() + (sh.vips ? ' • VIP : <b>' + sh.vips + '</b>' : '') + '<br>';
    lines += 'Expérience : <b>+' + res.xpGain + ' XP</b>';
    if (res.bonus) lines += '<br>Bonus étoiles : <b>+' + fmt(res.bonus) + '</b> ' + COIN();
    if (!win) lines += '<br><span style="color:#a8321e">' + (sh.relax ? 'Encore un petit effort ! Améliore ta cuisine dans la boutique.' : sh.endReason === 'hearts' ? 'Trop de clients sont partis fâchés !' : 'Améliore ta cuisine dans la boutique !') + '</span>';
    var tb = txt(I, 125, 342, 470, lines, 'ptxt', 25); tb.style.lineHeight = '1.45';
    function go(a) { md.close(); if (onAction) onAction(a); }
    sq(I, 140, 690, 104, 'b_menu', function () { go('hub'); });
    sq(I, 308, 690, 104, 'b_restart', function () { go('retry'); });
    if (win) sq(I, 476, 690, 104, 'b_next', function () { go('next'); });
    else sq(I, 476, 690, 104, 'b_shop', function () { go('shop'); });
    // animate stars
    for (var i = 0; i < sh.stars; i++) {
      (function (i) {
        setTimeout(function () {
          stars[i].style.filter = 'none';
          stars[i].classList.add('pop');
          Sfx.play('star');
          burst(I, starPos[i][0] + starPos[i][2] / 2, starPos[i][1] + starPos[i][2] / 2);
        }, 450 + i * 380);
      })(i);
    }
    return md;
  }
  function burst(parent, x, y) {
    for (var i = 0; i < 8; i++) {
      var s = el('div', 'spark', parent), a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 60;
      s.style.left = px(x); s.style.top = px(y);
      s.style.setProperty('--dx', px(Math.cos(a) * d)); s.style.setProperty('--dy', px(Math.sin(a) * d));
      setTimeout(function (s) { return function () { s.remove(); }; }(s), 820);
    }
  }

  // ---------------- level up ----------------
  function levelUp(up, then) {
    var md = modal(800, { closable: false, onBack: function () { md.close(then); } });
    var I = md.inner;
    board(I, 70, 90, 580, 640);
    leaf(I, 20, 'BRAVO CHEF !', true);
    var ch = pos(el('div', '', I), 128, 172, 220, 220);
    ch.style.cssText += ';position:absolute;background:var(--a-chef_happy) center bottom/contain no-repeat';
    ch.classList.add('pop');
    var st = pos(el('div', '', I), 352, 182, 196, 196);
    st.style.cssText += ';position:absolute;background:var(--a-star) center/contain no-repeat;display:flex;align-items:center;justify-content:center;font-family:"Luckiest Guy";font-size:78px;color:#fff;padding-top:22px;text-shadow:0 5px 0 #a85a00,3px 3px 0 #a85a00,-3px 3px 0 #a85a00';
    st.textContent = up.level;
    st.classList.add('pop');
    paper(I, 110, 390, 500, 240, 'p-a');
    var u = '<span class="lg" style="font-size:30px;color:#6b3a14">NIVEAU ' + up.level + ' !</span><br>Récompense : <b>+' + fmt(up.reward) + '</b> ' + COIN();
    if (up.unlocks.length) u += '<br><span style="color:#2f8a17">Nouveau : ' + up.unlocks.map(function (x) { return x.name; }).join(', ') + '</span>';
    txt(I, 140, 422, 440, u, 'ptxt', 24);
    pill(I, 235, 668, 250, 88, 'SUPER !', function () { md.close(then); });
    Sfx.play('levelup');
    setTimeout(function () { burst(I, 360, 280); }, 200);
    return md;
  }
  function chainLevelUps(ups, then) {
    if (!ups || !ups.length) { if (then) then(); return; }
    var u = ups.shift();
    levelUp(u, function () { chainLevelUps(ups, then); });
  }

  // ---------------- offline earnings ----------------
  function offline(amount, mins) {
    var md = modal(600);
    var I = md.inner;
    board(I, 90, 70, 540, 480, 'b-a');
    leaf(I, 0, 'BON RETOUR !', true);
    var c = pos(el('img', '', I), 300, 170, 120, 120); c.src = Art.coin(); c.style.position = 'absolute'; c.classList.add('pop');
    txt(I, 140, 296, 440, '<span class="lg gold" style="font-size:52px">+' + fmt(amount) + '</span>', 'ptxt');
    txt(I, 150, 366, 420, 'Tes commerces ont travaillé pendant ton absence' + (mins ? ' (' + (mins >= 60 ? Math.floor(mins / 60) + ' h ' : '') + (mins % 60) + ' min)' : '') + ' !', 'ptxt ctxt', 22).style.color = '#fff6dc';
    pill(I, 235, 470, 250, 88, 'MERCI !', function () { md.close(); });
    Sfx.play('coin');
  }

  // ---------------- station popup ----------------
  function stationPopup(i) {
    var def = GD.STATIONS[i], s = App.save;
    var md = modal(800, { tapOutside: true });
    var I = md.inner;
    function render() {
      I.innerHTML = '';
      var lv = s.stations[def.id] || 0, owned = lv > 0;
      board(I, 60, 80, 600, 660);
      leaf(I, 8, def.name.toUpperCase(), def.name.length > 9);
      closeBtn(I, 584, 64, function () { md.close(); });
      paper(I, 105, 180, 510, 420, 'p-a');
      var img = pos(el('img', '', I), 250, 196, 220, 176); img.src = Art.station(def.id); img.style.position = 'absolute';
      if (!owned) img.style.filter = 'grayscale(.6)';
      var cur = GD.stationStats(def, Math.max(1, lv), s), nxt = GD.stationStats(def, Math.max(1, lv) + (owned ? 1 : 0), s);
      var dish = '<img src="' + Art.dish(def.dish) + '" style="width:44px;vertical-align:-12px"> <b class="lg" style="font-size:28px">' + def.dishName + '</b>';
      var h = dish + '<br>';
      if (owned && lv < GD.MAX_ST_LEVEL) {
        h += 'Prix : <b>' + cur.price + '</b> ➜ <b style="color:#2f8a17">' + nxt.price + '</b> ' + COIN() + '<br>';
        h += 'Cuisson : <b>' + cur.time.toFixed(1) + ' s</b> ➜ <b style="color:#2f8a17">' + nxt.time.toFixed(1) + ' s</b>';
        if (nxt.slots > cur.slots) h += '<br>Capacité : <b>' + cur.slots + '</b> ➜ <b style="color:#2f8a17">' + nxt.slots + ' plats</b>';
      } else if (owned) {
        h += 'Prix : <b>' + cur.price + '</b> ' + COIN() + ' • Cuisson : <b>' + cur.time.toFixed(1) + ' s</b><br>Capacité : <b>' + cur.slots + ' plats</b>';
      } else {
        h += 'Nouvelle recette au menu !<br>Prix : <b>' + cur.price + '</b> ' + COIN() + ' • Cuisson : <b>' + cur.time.toFixed(1) + ' s</b>';
      }
      txt(I, 130, 380, 460, h, 'ptxt', 23);
      var pips = el('div', '', I); pips.style.cssText = 'position:absolute;left:0;width:720px;top:532px;display:flex;justify-content:center;gap:5px';
      for (var k = 1; k <= GD.MAX_ST_LEVEL; k++) { var pi = el('i', '', pips); pi.style.cssText = 'width:16px;height:46px;background:var(--a-' + (k <= lv ? 'pip_on' : 'pip_off') + ') center/contain no-repeat'; }
      if (s.level < def.unlock) {
        txt(I, 130, 640, 460, '<span class="lg ctxt" style="font-size:30px">Débloqué au niveau ' + def.unlock + '</span>', 'ptxt');
      } else if (!owned) {
        var b = pill(I, 200, 626, 320, 96, 'ACHETER ' + COIN() + ' ' + fmt(def.cost), function () { tryBuy('station', def.id, render); });
        if (s.coins < def.cost) b.classList.add('dis');
      } else if (lv < GD.MAX_ST_LEVEL) {
        var c = GD.upgradeCost(def, lv);
        var b2 = pill(I, 190, 626, 340, 96, 'AMÉLIORER ' + COIN() + ' ' + fmt(c), function () { tryBuy('station', def.id, render); });
        if (s.coins < c) b2.classList.add('dis');
      } else {
        txt(I, 130, 645, 460, '<span class="lg ctxt" style="font-size:32px">NIVEAU MAX !</span>', 'ptxt');
      }
    }
    render();
    Tuto.onAction('stationPopup', i);
  }

  function tryBuy(kind, id, after) {
    var s = App.save;
    var ok = Progress.buy(s, kind, id);
    if (!ok) {
      var off = Progress.offers(s).filter(function (o) { return o.kind === kind && o.id === id; })[0];
      if (off && off.locked) toast('Débloqué au niveau ' + off.unlock);
      else toast('Pas assez de pièces !');
      Sfx.play('nope');
      return false;
    }
    Sfx.play('buy'); Vib.buzz(30);
    Store.save(s);
    Scene.refreshStations(); Scene.refreshDecor(); Scene.refreshHud();
    Game.onPurchase(kind, id);
    if (after) after();
    return true;
  }

  // ---------------- shop ----------------
  var TABS = [['station', 'Cuisine'], ['staff', 'Équipe'], ['decor', 'Déco'], ['booster', 'Bonus'], ['business', 'Affaires']];
  var shopTab = 'station';
  function shop(tab) {
    if (tab) shopTab = tab;
    var H = Math.min(App.H - 40, 1240);
    var md = modal(H, { tapOutside: false });
    var I = md.inner;
    board(I, 20, 64, 680, H - 70);
    leaf(I, -6, 'BOUTIQUE');
    closeBtn(I, 618, 50, function () { md.close(); });
    var cb = el('div', 'coinbox', I, '<img src="' + Art.coin() + '"><span></span>');
    cb.style.cssText = 'left:236px;top:150px;width:248px;height:58px';
    var tabs = el('div', 'tabs', I); pos(tabs, 58, 222);
    paper(I, 46, 286, 628, H - 70 - 250);
    var list = pos(el('div', 'list', I), 80, 318, 562, H - 70 - 250 - 66);
    function renderTabs() {
      tabs.innerHTML = '';
      var offs = Progress.offers(App.save);
      TABS.forEach(function (t) {
        var b = onTap(el('div', 'tab' + (t[0] === shopTab ? ' on' : ''), tabs, t[1]), function () { shopTab = t[0]; renderAll(); list.scrollTop = 0; });
        var n = offs.filter(function (o) { return o.kind === t[0] && !o.maxed && !o.locked && o.kind !== 'booster' && App.save.coins >= o.cost; }).length;
        if (n) el('div', 'badge', b, n);
      });
    }
    function renderAll() { cb.querySelector('span').textContent = fmt(App.save.coins); renderTabs(); renderList(); }
    function renderList() {
      var keep = list.scrollTop;
      list.innerHTML = '';
      var s = App.save;
      if (shopTab === 'business') {
        var r0 = el('div', 'ptxt', list, 'Revenus passifs : <b>' + fmt(GD.passiveRate(s)) + '</b> ' + COIN() + ' / min<br><span style="font-size:19px">Ils rapportent même quand le jeu est fermé (jusqu\'à ' + GD.OFFLINE_CAP_H + ' h).</span>');
        r0.style.cssText += ';margin:2px 0 12px;font-size:22px';
      }
      if (shopTab === 'booster') {
        var r1 = el('div', 'ptxt', list, '<span style="font-size:20px">Utilise les bonus pendant la journée avec les boutons du bas.</span>');
        r1.style.cssText += ';margin:2px 0 10px';
      }
      Progress.offers(s).filter(function (o) { return o.kind === shopTab; }).forEach(function (o) { list.appendChild(row(o, renderAll)); });
      list.scrollTop = keep;
    }
    renderAll();
    md.rec.refresh = renderAll;
    return md;
  }
  function row(o, rerender) {
    var s = App.save, r = el('div', 'row' + (o.locked ? ' locked' : ''));
    var ic = el('div', 'ic', r), name = '', desc = '';
    if (o.kind === 'station') {
      var d = GD.stationById(o.id), st = GD.stationStats(d, Math.max(1, o.level), s);
      ic.style.backgroundImage = Art.stationBg(o.id);
      name = d.name;
      desc = o.level ? '<img src="' + Art.dish(d.dish) + '" style="width:26px;vertical-align:-7px"> ' + d.dishName + ' : ' + st.price + ' ' + COIN() + ' • ' + st.time.toFixed(1) + ' s' + (st.slots > 1 ? ' • ×' + st.slots : '') : 'Nouvelle recette : <b>' + d.dishName + '</b>';
    } else if (o.kind === 'staff') {
      var sd = GD.STAFF[o.id];
      ic.style.backgroundImage = o.id === 'commis' ? 'var(--a-commis_happy)' : 'var(--a-waiter_happy)';
      name = sd.name + (o.level ? ' niv. ' + o.level : '');
      desc = o.id === 'serveur' && GD.isRelax(App.save.mode) ? sd.descRelax : sd.desc + (o.level ? ' (' + sd.interval[o.level - 1].toFixed(1) + ' s)' : '');
    } else if (o.kind === 'decor') {
      var dd = GD.DECOR[o.id];
      ic.className = 'ic sm';
      ic.style.backgroundImage = 'url("' + decorIcon(o.id) + '")';
      name = dd.name; desc = dd.desc;
    } else if (o.kind === 'booster') {
      var bd = GD.BOOSTERS[o.id];
      ic.className = 'ic sm';
      ic.style.backgroundImage = 'var(--a-' + bd.icon + ')';
      name = bd.name; desc = bd.desc;
    } else if (o.kind === 'business') {
      var bz = GD.BUSINESS.filter(function (b) { return b.id === o.id; })[0];
      ic.style.backgroundImage = 'url("' + Art.biz(o.id) + '")';
      name = bz.name; desc = '+' + bz.rate + ' ' + COIN() + ' / min chacun';
    }
    el('div', 'nm', r, name);
    el('div', 'ds', r, desc);
    if (o.kind === 'booster' || o.kind === 'business') el('div', 'cntv', r, o.kind === 'booster' ? 'En stock : ' + o.level : 'Possédés : ' + o.level + ' / ' + o.max);
    else {
      var pips = el('div', 'pips', r);
      for (var k = 1; k <= o.max; k++) el('i', k <= o.level ? 'on' : '', pips);
      if (o.max > 6) { pips.style.gap = '1px'; Array.prototype.forEach.call(pips.children, function (c) { c.style.width = '11px'; }); }
    }
    if (o.locked) el('div', 'lockinfo', r, '<i></i><span>Niveau ' + o.unlock + '</span>');
    else if (o.maxed) el('div', 'pill max', r, 'MAX');
    else {
      var label = o.kind === 'station' && !o.level ? '' : '';
      var b = el('div', 'pill', r, COIN() + ' ' + fmt(o.cost));
      if (s.coins < o.cost) b.classList.add('dis');
      onTap(b, function () { if (tryBuy(o.kind, o.id)) rerender(); }, true);
    }
    return r;
  }
  function decorIcon(id) {
    if (id === 'plantes') return Art.plant(1);
    if (id === 'musique') return Art.drums();
    return Art.icon(id);
  }

  // ---------------- levels ----------------
  var lvPage = -1;
  function levels() {
    var s = App.save;
    if (lvPage < 0) lvPage = Math.floor((s.unlocked - 1) / 9);
    var md = modal(900, { tapOutside: false });
    var I = md.inner;
    function render() {
      I.innerHTML = '';
      var maxPage = Math.floor((s.unlocked - 1) / 9);
      lvPage = Util.clamp(lvPage, 0, Math.max(maxPage, 0));
      board(I, 50, 80, 620, 780);
      leaf(I, 6, 'NIVEAUX');
      closeBtn(I, 600, 66, function () { md.close(); });
      txt(I, 110, 178, 500, 'Jours ' + (lvPage * 9 + 1) + ' à ' + (lvPage * 9 + 9), 'lg ctxt', 32).style.textAlign = 'center';
      paper(I, 85, 220, 550, 560);
      var g = pos(el('div', 'lgrid', I), 113, 262);
      for (var k = 0; k < 9; k++) {
        (function (d) {
          var lock = d > s.unlocked, st = s.days[d] || 0;
          var c = el('div', 'lcell' + (lock ? ' lock' : '') + (d === s.unlocked ? ' cur' : ''), g, '<div class="n">' + d + '</div>');
          if (!lock) { var sd = el('div', 's', c); sd.style.backgroundImage = 'var(--a-lstar' + (st === 3 ? 1 : st === 2 ? 2 : st === 1 ? 3 : 4) + ')'; }
          onTap(c, function () {
            if (lock) { toast('Termine le jour ' + (d - 1) + ' d\'abord !'); return; }
            md.close(); Game.startDay(d);
          });
        })(lvPage * 9 + k + 1);
      }
      var dots = el('div', 'dots', I);
      var np = Math.max(maxPage + 1, 1);
      for (var p = 0; p < Math.min(np, 8); p++) el('i', p === lvPage % 8 ? 'on' : '', dots);
      pos(dots, (720 - Math.min(np, 8) * 48 + 12) / 2, 800);
      if (lvPage > 0) sq(I, 20, 470, 90, 'b_prew', function () { lvPage--; render(); });
      if (lvPage < maxPage) sq(I, 610, 470, 90, 'b_next', function () { lvPage++; render(); });
      var tot = 0; Object.keys(s.days).forEach(function (k) { tot += s.days[k]; });
      txt(I, 110, 728, 500, 'Étoiles : ' + tot + ' / ' + ((s.unlocked - 1) * 3 + (s.days[s.unlocked] ? 3 : 0)), 'ptxt', 22);
    }
    render();
  }

  // ---------------- settings ----------------
  function applySettings() {
    var st = App.save.settings;
    Sfx.setVol(st.music, st.sfx);
    Sfx.music(st.music > 0);
    Store.save(App.save);
  }
  function settings() {
    var md = modal(1160, { tapOutside: true });
    var I = md.inner;
    function render() {
      I.innerHTML = '';
      var st = App.save.settings;
      board(I, 40, 80, 640, 1040, 'b-c');
      leaf(I, 6, 'PARAMÈTRES', true);
      closeBtn(I, 620, 66, function () { md.close(); });
      var y = 196;
      function slider(label, key) {
        var r = pos(el('div', 'srow', I), 100, y, 520); y += 92;
        el('div', 'lab ctxt', r, label).style.color = '#fff6dc';
        var mn = sq(r, 210, 6, 64, 'minus', function () { st[key] = Math.max(0, Math.round((st[key] - 0.2) * 10) / 10); applySettings(); upd(); Sfx.play('click'); });
        var tr = pos(el('div', 'trk', r), 284, 22, 160); var fi = el('i', '', tr);
        sq(r, 452, 6, 64, 'plus', function () { st[key] = Math.min(1, Math.round((st[key] + 0.2) * 10) / 10); applySettings(); upd(); Sfx.play('click'); });
        function upd() { fi.style.width = px(3 + 154 * st[key]); fi.style.display = st[key] > 0 ? 'block' : 'none'; }
        upd();
      }
      function toggle(label, get, set) {
        var r = pos(el('div', 'srow', I), 100, y, 520); y += 92;
        el('div', 'lab ctxt', r, label).style.color = '#fff6dc';
        var t = pos(el('div', 'tog', r), 330, 8);
        t.style.backgroundImage = 'var(--a-' + (get() ? 'tog_on' : 'tog_off') + ')';
        onTap(t, function () { set(!get()); t.style.backgroundImage = 'var(--a-' + (get() ? 'tog_on' : 'tog_off') + ')'; Store.save(App.save); });
      }
      slider('Musique', 'music');
      slider('Effets', 'sfx');
      toggle('Vibrations', function () { return App.save.settings.vibra; }, function (v) { App.save.settings.vibra = v; if (v) Vib.buzz(40); });
      if (Platform.canFullscreen()) toggle('Plein écran', function () { return Platform.isFullscreen(); }, function () { Platform.toggleFullscreen(); });
      toggle('Rappel de pause', function () { return App.save.settings.pause !== false; }, function (v) { App.save.settings.pause = v; });
      if (window.View3D && View3D.supported()) toggle('Vue 3D (test)', function () { return !!App.save.view3d; }, function (v) {
        App.save.view3d = v; Store.save(App.save);
        var ok = View3D.apply();
        toast(ok ? 'Vue 3D activée (version test)' : v ? 'La vue 3D n’est pas disponible ici' : 'Vue 2D classique');
      });
      var mr = pos(el('div', 'srow', I), 100, y, 520); y += 92;
      el('div', 'lab ctxt', mr, 'Mode').style.color = '#fff6dc';
      var seg = pos(el('div', 'seg', mr), 196, 6);
      [['detente', 'DÉTENTE'], ['classique', 'CLASSIQUE']].forEach(function (m) {
        var on = (App.save.mode === 'classique') === (m[0] === 'classique');
        onTap(el('div', 'pill' + (on ? '' : ' off'), seg, m[1]), function () {
          App.save.mode = m[0]; Store.save(App.save); render(); Scene.refreshHud();
          toast(m[0] === 'classique' ? 'Mode Classique : sers vite, les clients s’impatientent !' : 'Mode Détente : joue tranquille !');
        });
      });
      var vr = pos(el('div', 'srow', I), 100, y, 520); y += 92;
      el('div', 'lab ctxt', vr, 'Version ' + APP_LABEL).style.cssText += ';color:#fff6dc;font-size:24px;top:22px';
      pill(vr, 300, 4, 220, 70, 'MISES À JOUR', function () { md.close(); Updater.check(true); }).style.fontSize = '20px';
      var by = y + 24;
      pill(I, 90, by, 170, 80, 'AIDE', function () { help(); });
      pill(I, 275, by, 170, 80, 'MENU', function () { md.close(); Game.toTitle(); });
      pill(I, 460, by, 170, 80, 'EFFACER', function () {
        confirm('EFFACER ?', 'Effacer toute ta partie<br>et recommencer à zéro ?', function () {
          Store.wipe(); App.save = GD.newSave(); Store.save(App.save); closeAll(); Game.toTitle(); toast('Nouvelle partie !');
        });
      }, 'red');
    }
    render();
  }

  // ---------------- help ----------------
  function help() {
    var md = modal(1090, { tapOutside: true });
    var I = md.inner;
    board(I, 40, 80, 640, 970);
    leaf(I, 6, 'COMMENT JOUER', true);
    closeBtn(I, 620, 66, function () { md.close(); });
    paper(I, 76, 178, 568, 752);
    var steps = [
      [ASSETS.cu_touriste_neutral, 'Les <b>clients</b> arrivent au comptoir et commandent des plats.'],
      [Art.station('grill'), 'Touche une <b>station</b> pour cuisiner le plat demandé.'],
      [Art.dish('burger'), App.save.mode === 'classique' ? 'Quand le plat est prêt, <b>touche-le</b> pour le servir. Sers vite : les clients s\'impatientent !' : 'En mode <b>Détente</b>, les plats prêts sont <b>servis tout seuls</b> et personne ne part fâché.'],
      [Art.coin(), 'Gagne des <b>pièces</b> et des pourboires. Atteins l\'objectif du jour pour gagner jusqu\'à 3 étoiles.'],
      [ASSETS.chef_happy, 'Entre deux journées, <b>améliore</b> tes stations, embauche, décore et investis : deviens un vrai Tycoon !'],
      [Art.book(), 'Ouvre le <b>Carnet</b> pour suivre l\'histoire du restaurant. Sers souvent tes <b>habitués</b> pour découvrir leurs histoires.']
    ];
    var y = 212;
    steps.forEach(function (s) {
      var im = pos(el('img', '', I), 108, y, 92, 92); im.src = s[0]; im.style.position = 'absolute'; im.style.objectFit = 'contain';
      var t = txt(I, 212, y + 4, 400, s[1], 'ptxt', 22); t.style.textAlign = 'left';
      y += 118;
    });
    pill(I, 235, 956, 250, 86, 'COMPRIS !', function () { md.close(); });
  }

  // ---------------- init ----------------
  function init(stageEl, titleScreen) {
    layer = el('div', '', stageEl); layer.id = 'modals';
    toastEl = el('div', '', stageEl); toastEl.id = 'toast';
    buildTitle(titleScreen);
  }
  function refreshTop() { var t = stack[stack.length - 1]; if (t && t.refresh) t.refresh(); }

  // ---------------- updates ----------------
  function notesHtml(list) {
    return '<div class="unotes">' + (list || []).slice(0, 6).map(function (n) { return '<div>• ' + n + '</div>'; }).join('') + '</div>';
  }
  function updatePrompt(m, onYes, onLater) {
    var md = modal(900, { closable: false, onBack: function () { md.close(); if (onLater) onLater(); } });
    var I = md.inner;
    board(I, 50, 70, 620, 800, 'b-a');
    leaf(I, 0, 'MISE À JOUR', true);
    txt(I, 100, 168, 520, '<span class="lg gold" style="font-size:40px">Version ' + (m.label || m.version) + '</span><br><span class="lg" style="font-size:22px;color:#fff6dc">disponible ! Ta partie est gardée.</span>', 'ptxt', 26);
    paper(I, 96, 276, 528, 420, 'p-a');
    var t = txt(I, 126, 302, 468, '<b class="lg" style="font-size:23px">Nouveautés :</b>' + notesHtml(m.notes), 'ptxt', 20);
    t.style.textAlign = 'left';
    t.querySelector('.unotes').style.fontSize = '19px';
    pill(I, 86, 716, 240, 92, 'PLUS TARD', function () { md.close(); if (onLater) onLater(); }, 'red');
    pill(I, 344, 712, 300, 100, 'METTRE À JOUR', function () { md.close(); onYes(); }).style.fontSize = '27px';
    Sfx.play('soft');
  }
  function updateProgress(m) {
    var md = modal(600, { closable: false, onBack: function () { } });
    var I = md.inner;
    board(I, 80, 70, 560, 500, 'b-a');
    leaf(I, 0, 'MISE À JOUR', true);
    var label = txt(I, 130, 180, 460, 'Téléchargement de la version<br><b class="lg gold" style="font-size:34px">' + (m.label || m.version) + '</b>', 'ptxt ctxt', 26);
    label.style.color = '#fff6dc';
    var bar = pos(el('div', 'ubar', I), 150, 320, 420, 46);
    var fill = el('i', '', bar), pct = el('span', '', bar, '0 %');
    var info = txt(I, 130, 386, 460, 'Ne quitte pas le jeu…', 'ptxt ctxt', 22); info.style.color = '#fff6dc';
    var api = {
      set: function (p) { fill.style.width = Math.max(4, p) + '%'; pct.textContent = p + ' %'; },
      done: function () { api.set(100); info.innerHTML = '<b>Installé ! Redémarrage du jeu…</b>'; Sfx.play('levelup'); },
      fail: function (msg) {
        info.innerHTML = '<span style="color:#ffb0a0">Échec : ' + (msg || 'erreur') + '</span>';
        Sfx.play('nope');
        pill(I, 235, 470, 250, 84, 'FERMER', function () { md.close(); }, 'red');
      },
      close: function () { md.close(); }
    };
    return api;
  }
  function whatsNew(updated) {
    var md = modal(900, { tapOutside: true });
    var I = md.inner;
    board(I, 50, 70, 620, 800);
    leaf(I, 0, updated ? 'MIS À JOUR !' : 'NOUVEAUTÉS', true);
    txt(I, 100, 172, 520, '<span class="lg gold" style="font-size:38px">Version ' + APP_LABEL + '</span>', 'ptxt', 26);
    paper(I, 96, 250, 528, 450, 'p-a');
    var t = txt(I, 130, 280, 460, (updated ? '<b>Mise à jour installée depuis le jeu : tout est prêt !</b>' : '') + notesHtml(APP_NOTES), 'ptxt', 21);
    t.style.textAlign = 'left';
    pill(I, 235, 736, 250, 90, 'SUPER !', function () { md.close(); });
    if (updated) { Sfx.play('levelup'); setTimeout(function () { burst(I, 360, 200); }, 200); }
  }

  // ---------------- reward, game style choice, break reminder ----------------
  function reward(title, html, icon, done) {
    var md = modal(660, { closable: false, onBack: function () { md.close(done); } });
    var I = md.inner;
    board(I, 80, 70, 560, 560, 'b-a');
    leaf(I, 0, title, title.length > 11);
    var ic = pos(el('div', 'pop', I), 285, 168, 150, 150);
    ic.style.cssText += ';position:absolute;background:' + (icon === 'book' ? 'url("' + Art.book() + '")' : icon === 'map' ? 'var(--a-map)' : 'var(--a-star)') + ' center/contain no-repeat';
    if (icon === 'map') { ic.style.borderRadius = '18px'; ic.style.boxShadow = '0 0 0 5px #6b3a14'; ic.style.backgroundSize = 'cover'; }
    txt(I, 140, 334, 440, html, 'ptxt ctxt', 25).style.color = '#fff6dc';
    pill(I, 235, 548, 250, 88, 'SUPER !', function () { md.close(done); });
    Sfx.play('levelup');
    setTimeout(function () { burst(I, 360, 240); }, 150);
  }
  function chooseMode(done) {
    var md = modal(900, { closable: false, onBack: function () { } });
    var I = md.inner;
    board(I, 40, 80, 640, 790);
    leaf(I, 6, 'TON STYLE');
    txt(I, 100, 188, 520, 'Comment veux-tu jouer ?', 'ptxt ctxt lg', 30).style.color = '#fff6dc';
    function card(y, mode, title, desc, icon, rec) {
      var c = pos(el('div', 'mode-card', I), 90, y);
      el('div', 'ic', c).style.backgroundImage = 'var(--a-' + icon + ')';
      el('div', 't', c, title); el('div', 'd', c, desc);
      if (rec) el('div', 'rec', c, 'CONSEILLÉ');
      onTap(c, function () { App.save.mode = mode; App.save.seenTuto.mode = 1; Store.save(App.save); md.close(done); });
    }
    card(250, 'detente', 'DÉTENTE', 'Les clients ne partent jamais fâchés et les plats prêts sont <b>servis tout seuls</b>. Idéal pour jouer tranquille.', 'heart', true);
    card(516, 'classique', 'CLASSIQUE', 'Les clients s’impatientent : sers-les vite avant qu’ils partent ! Pour les chefs qui aiment le défi.', 'time', false);
    txt(I, 100, 776, 520, 'Tu pourras changer à tout moment dans les Paramètres.', 'ptxt ctxt', 21).style.color = '#fff6dc';
  }
  function breakReminder(done) {
    var md = modal(660, { closable: false, onBack: function () { md.close(done); } });
    var I = md.inner;
    board(I, 80, 70, 560, 560, 'b-a');
    leaf(I, 0, 'PETITE PAUSE ?', true);
    var ic = pos(el('div', 'pop', I), 270, 160, 180, 180);
    ic.style.cssText += ';position:absolute;background:var(--a-chef_happy) center bottom/contain no-repeat';
    txt(I, 140, 350, 440, 'Tu joues depuis un bon moment, Chef !<br>Bois un verre d’eau et repose tes yeux. Le restaurant t’attendra.', 'ptxt ctxt', 24).style.color = '#fff6dc';
    pill(I, 235, 548, 250, 88, 'D’ACCORD', function () { md.close(done); });
    Sfx.play('soft');
  }

  return {
    init: init, layout: layout, modal: modal, closeAll: closeAll, isBlocking: isBlocking, back: back, toast: toast, banner: banner,
    confirm: confirm, confirmExit: confirmExit, pause: pause, results: results, levelUp: levelUp, chainLevelUps: chainLevelUps, offline: offline,
    stationPopup: stationPopup, shop: shop, levels: levels, settings: settings, help: help, applySettings: applySettings, refreshTop: refreshTop,
    buildTitle: buildTitle, el: el, pos: pos, reward: reward, chooseMode: chooseMode, breakReminder: breakReminder,
    updatePrompt: updatePrompt, updateProgress: updateProgress, whatsNew: whatsNew
  };
})();

// ===================== TUTORIAL =====================
var Tuto = (function () {
  var box = null, block = false, step = '';
  function seen(id) { return App.save.seenTuto[id]; }
  function mark(id) { App.save.seenTuto[id] = 1; Store.save(App.save); }
  function hide() { if (box) { box.remove(); box = null; } block = false; step = ''; }
  function show(id, html, target, opts) {
    hide();
    opts = opts || {};
    step = id;
    var layer = document.getElementById('stage');
    box = UI.el('div', 'tuto', layer);
    var tip = UI.el('div', 'tip', box, html);
    var sh = Game.shift();
    tip.style.top = Math.round(opts.top != null ? opts.top : (sh && !sh.over ? Scene.L.row2 + 8 : App.H * 0.17)) + 'px';
    if (opts.ok) {
      block = true;
      var b = UI.el('div', 'pill ok tap', tip, 'OK !');
      b.addEventListener('click', function (e) { e.stopPropagation(); Sfx.play('click'); hide(); if (opts.ok !== true) opts.ok(); });
    }
    if (target) {
      var h = UI.el('div', 'hand', box);
      h.style.left = Math.round(target.x - 10) + 'px';
      h.style.top = Math.round(target.y + (target.dy || 20)) + 'px';
    }
  }
  function stTarget(i, dy) { var r = Scene.stationRect(i); return { x: r.x, y: r.y + (dy || 50) }; }
  function onAction(type, a, b) {
    if (!App.save || seen('basic')) {
      if (type === 'stationPopup' && step === 'hub1') { hide(); mark('hub1'); }
      return;
    }
    if (type === 'order' && !step) show('t1', 'Un client ! Il veut un <b>burger</b>.<br>Touche le <b>grill</b> pour le cuire.', stTarget(0));
    else if (type === 'station' && step === 't1' && a === 0 && b === 'cook') show('t2', App.save.mode === 'classique' ? 'Ça cuit ! Attends que le burger soit prêt…' : 'Ça cuit ! Le burger sera servi tout seul dès qu’il sera prêt.', null);
    else if (type === 'ready' && (step === 't2' || step === 't1') && a === 0) { if (App.save.mode === 'classique') show('t3', 'Le burger est prêt !<br><b>Touche-le</b> pour le servir.', stTarget(0, 0)); }
    else if (type === 'pay' && step) {
      show('t4', App.save.mode === 'classique' ? 'Bravo Chef ! Le client a payé.<br>Sers vite pour gagner des <b>pourboires</b> et atteins l\'<b>objectif</b> avant la fin de la journée !' :
        'Bravo Chef ! Le burger a été <b>servi tout seul</b>.<br>Cuisine ce que les clients demandent : plus tu es rapide, plus les <b>pourboires</b> sont gros. Pas de stress, personne ne part fâché !', null, { ok: function () { mark('basic'); } });
    }
  }
  function hubCheck() {
    var s = App.save;
    if (!seen('basic')) {
      show('hub0', 'Bienvenue Chef ! Les clients de la jungle ont faim.<br>Touche <b>OUVRIR</b> pour lancer ta première journée !', { x: 380, y: Scene.L.botTop + 10, dy: 0 }, { top: App.H * 0.2 });
      return;
    }
    if (!seen('hub1') && s.coins >= GD.upgradeCost(GD.STATIONS[0], s.stations.grill || 1)) {
      show('hub1', 'Utilise tes pièces pour <b>améliorer</b> ta cuisine !<br>Touche le <b>grill</b>.', stTarget(0, 40), { top: App.H * 0.2 });
      return;
    }
    if (!seen('hub2') && s.level >= 2 && !s.stations.frites && s.coins >= GD.STATIONS[2].cost) {
      show('hub2', 'Nouvelle station disponible !<br>Touche le <b>+</b> pour acheter la <b>friteuse</b>.', stTarget(2, 30), { top: App.H * 0.2 });
      mark('hub2');
    }
  }
  return { onAction: onAction, hubCheck: hubCheck, hide: hide, blocking: function () { return block; }, step: function () { return step; } };
})();
