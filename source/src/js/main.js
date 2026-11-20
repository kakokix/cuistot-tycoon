// ===================== BOOT, LAYOUT, LOOP, PLATFORM GLUE =====================
var App = { save: null, H: 1280, scale: 1, screen: 'title', visible: true };

(function () {
  var stage, last = 0, passiveAcc = 0, saveT = 0, hiddenAt = 0;

  function toBlobUrl(uri) {
    try {
      var i = uri.indexOf(','), head = uri.slice(5, i), bin = atob(uri.slice(i + 1));
      var arr = new Uint8Array(bin.length);
      for (var k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
      return URL.createObjectURL(new Blob([arr], { type: head.split(';')[0] }));
    } catch (e) { return uri; }
  }
  function injectAssets() {
    if (window.URL && URL.createObjectURL && window.Blob) {
      Object.keys(ASSETS).forEach(function (k) { if (/^data:[^,]*;base64,/.test(ASSETS[k])) ASSETS[k] = toBlobUrl(ASSETS[k]); });
    }
    var css = ':root{';
    Object.keys(ASSETS).forEach(function (k) { css += '--a-' + k + ':url("' + ASSETS[k] + '");'; });
    css += '--a-coinsvg:url("' + Art.coin() + '");--a-steamsvg:url("' + Art.steam() + '");--a-handsvg:url("' + Art.hand() + '");--a-chk:url("' + Art.check() + '");--a-vein:url("' + Art.vein() + '");';
    css += '}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  }

  function layout() {
    var vw = window.innerWidth || 720, vh = window.innerHeight || 1280;
    var H = Util.clamp(720 * vh / vw, 1180, 1560);
    var scale = Math.min(vw / 720, vh / H);
    App.H = H; App.scale = scale;
    stage.style.height = H + 'px';
    stage.style.transform = 'translate(' + ((vw - 720 * scale) / 2) + 'px,' + ((vh - H * scale) / 2) + 'px) scale(' + scale + ')';
    document.getElementById('screen-title').style.height = H + 'px';
    document.getElementById('screen-game').style.height = H + 'px';
    Scene.layout(H); UI.layout(H); Story.layout();
    var rot = document.getElementById('rotate');
    var touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    rot.style.display = (Platform.kind === 'web' && touch && vw > vh * 1.15 && vh < 560) ? 'flex' : 'none';
  }

  function loop(t) {
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (App.save) {
      Game.update(dt);
      // passive business income
      var rate = GD.passiveRate(App.save);
      if (rate > 0) {
        passiveAcc += rate / 60 * dt;
        if (passiveAcc >= 1) { var whole = Math.floor(passiveAcc); passiveAcc -= whole; App.save.coins += whole; }
      }
      saveT += dt;
      if (saveT > 10) { saveT = 0; Store.save(App.save); if (Scene.mode() === 'hub') Scene.refreshHud(); }
    }
    requestAnimationFrame(loop);
  }

  function back() {
    if (Story.active()) { Story.skip(); return true; }
    if (UI.back()) return true;
    if (Tuto.blocking()) return true;
    if (App.screen === 'game') {
      if (Game.shift() && !Game.shift().over) { Game.pause(); return true; }
      Game.toTitle(); return true;
    }
    if (Platform.canExit()) { UI.confirmExit(); return true; }
    return false;
  }
  window.onAndroidBack = function () { Sfx.play('click'); return back(); };
  window.onAppPause = function () { onHide(); };
  window.onAppResume = function () { onShow(); };

  function onHide() {
    if (!App.visible) return;
    App.visible = false; hiddenAt = Date.now();
    if (App.save) Store.save(App.save);
    Sfx.suspend();
    if (Game.shift() && !Game.shift().over && !UI.isBlocking()) Game.pause();
  }
  function onShow() {
    if (App.visible) return;
    App.visible = true;
    Sfx.resume();
    last = 0;
    if (App.save && hiddenAt && Date.now() - hiddenAt > 60000) {
      var amt = Progress.offlineEarnings(App.save, Date.now());
      if (amt > 0) { App.save.coins += amt; UI.offline(amt, Math.round(Math.min(GD.OFFLINE_CAP_H * 60, (Date.now() - hiddenAt) / 60000))); }
    }
    if (App.save) App.save.lastSeen = Date.now();
  }

  function keys(e) {
    if (e.key === 'Escape') { back(); e.preventDefault(); return; }
    var sh = Game.shift();
    if (!sh || sh.over || Game.isPaused()) {
      if (e.key === ' ' && sh && !sh.over && UI.isBlocking()) { UI.back(); e.preventDefault(); }
      return;
    }
    if (e.key === ' ' || e.key === 'p') { Game.pause(); e.preventDefault(); return; }
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 8) {
      var st = document.querySelectorAll('.station')[n - 1];
      if (st) st.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    }
  }

  function neutralinoReady() {
    return new Promise(function (res) {
      if (!(window.Neutralino && window.NL_PORT)) { res(); return; }
      var done = false, fin = function () { if (!done) { done = true; res(); } };
      try {
        Neutralino.init();
        Neutralino.events.on('ready', fin);
        Neutralino.events.on('windowClose', function () { try { Store.save(App.save); } catch (e) { } setTimeout(function () { Neutralino.app.exit(); }, 150); });
      } catch (e) { fin(); }
      setTimeout(fin, 2500);
    });
  }

  function setLoad(p) { var i = document.querySelector('#loading .lb i'); if (i) i.style.width = Math.round(496 * p) + 'px'; }

  function boot() {
    stage = document.getElementById('stage');
    injectAssets();
    setLoad(0.2);
    var fontsP = (document.fonts && document.fonts.load) ? Promise.all([
      document.fonts.load('40px "Luckiest Guy"'), document.fonts.load('600 20px "Fredoka"'), document.fonts.load('700 20px "Fredoka"')
    ]).catch(function () { }) : Promise.resolve();
    // pre-decode a few heavy images
    var keep = window.__img = {};
    var imgs = Object.keys(ASSETS).map(function (k) {
      return new Promise(function (r) {
        var im = new Image(); keep[k] = im;
        im.onload = function () { if (im.decode) im.decode().then(r, r); else r(); };
        im.onerror = r; im.src = ASSETS[k];
      });
    });
    var t0 = Date.now(), n = 0;
    imgs.forEach(function (p) { p.then(function () { n++; setLoad(0.2 + 0.4 * n / imgs.length); }); });
    // never block boot for more than 4 s
    imgs = [Promise.race([Promise.all(imgs), new Promise(function (r) { setTimeout(r, 4000); })])];
    Promise.all([fontsP, neutralinoReady().then(function () { return Updater.desktopBoot(); }), Promise.all(imgs)]).then(function () {
      setLoad(0.6);
      return Store.load();
    }).then(function (save) {
      // version 1.3 test: the 3D view is on by default (it can be turned off in the settings)
      if (!save.flags.v13) { save.flags.v13 = 1; save.view3d = true; }
      App.save = save;
      setLoad(1);
      Sfx.setVol(save.settings.music, save.settings.sfx);
      var game = document.getElementById('screen-game');
      Scene.build(game);
      UI.init(stage, document.getElementById('screen-title'));
      layout();
      Scene.setMode('hub');
      View3D.apply();
      document.getElementById('screen-title').classList.add('on');
      var off = Progress.offlineEarnings(save, Date.now());
      var mins = save.lastSeen ? Math.round(Math.min(GD.OFFLINE_CAP_H * 60, (Date.now() - save.lastSeen) / 60000)) : 0;
      save.lastSeen = Date.now();
      setTimeout(function () {
        var ld = document.getElementById('loading');
        ld.style.opacity = 0;
        setTimeout(function () { ld.remove(); }, 420);
        if (off > 0) { save.coins += off; UI.offline(off, mins); }
        Store.save(save);
        Updater.afterBoot();
        Ach.check();
        setInterval(function () { if (App.save) Ach.check(); }, 5000);
      }, 250);
      requestAnimationFrame(loop);
    });

    window.addEventListener('resize', function () { if (App.save) layout(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) onHide(); else onShow(); });
    window.addEventListener('pagehide', function () { if (App.save) Store.save(App.save); });
    var unlock = function () { Sfx.unlock(); if (App.save) Sfx.music(App.save.settings.music > 0); };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('keydown', keys);
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
