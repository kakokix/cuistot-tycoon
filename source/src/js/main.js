// ===================== BOOT, LAYOUT, LOOP, PLATFORM GLUE =====================
var App = { save: null, W: 720, H: 1280, scale: 1, wide: false, screen: 'title', visible: true, mx: 0, my: 0 };

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

  function sizeStage(vw, vh) {
    document.getElementById('app').classList.toggle('wide', App.wide);
    stage.style.width = App.W + 'px';
    stage.style.height = App.H + 'px';
    stage.style.transform = 'translate(' + ((vw - App.W * App.scale) / 2) + 'px,' + ((vh - App.H * App.scale) / 2) + 'px) scale(' + App.scale + ')';
  }
  // while loading: size the stage the way the game will most likely use it (so the loading screen does not jump)
  function preLayout() {
    var vw = window.innerWidth || 720, vh = window.innerHeight || 1280;
    var wide = vw / vh >= 1.3 && !!window.THREE && View3D.supported();
    App.wide = wide;
    App.H = wide ? 1200 : Util.clamp(720 * vh / vw, 1180, 1560);
    App.W = wide ? Util.clamp(Math.round(1200 * vw / vh), 1560, 2880) : 720;
    App.scale = Math.min(vw / App.W, vh / App.H);
    sizeStage(vw, vh);
  }

  // Two layouts:
  //  - portrait (phones, narrow windows): a 720 px wide column, as before;
  //  - wide (PC, landscape): the stage takes the whole screen and the restaurant is a full 3D scene.
  //    It needs the 3D view: without WebGL (or with 3D turned off) the game keeps the portrait layout.
  function layout() {
    var vw = window.innerWidth || 720, vh = window.innerHeight || 1280;
    var wide = vw / vh >= 1.3 && View3D.usable();
    var W = 720, H;
    if (wide) { H = 1200; W = Util.clamp(Math.round(H * vw / vh), 1560, 2880); }
    else H = Util.clamp(720 * vh / vw, 1180, 1560);
    var scale = Math.min(vw / W, vh / H);
    var flip = wide !== App.wide;
    App.W = W; App.H = H; App.scale = scale; App.wide = wide;
    sizeStage(vw, vh);
    document.getElementById('screen-title').style.height = H + 'px';
    document.getElementById('screen-game').style.height = H + 'px';
    View3D.apply();                      // creates / resizes the 3D view, then lays the scene out
    if (App.wide !== wide) return;       // the 3D view could not start: layout() already ran again in portrait
    UI.layout(); Story.layout(); World.layout();
    Game.syncScreens();
    if (flip) View3D.snap();
    Tuto.relayout();
    var rot = document.getElementById('rotate');
    var touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    rot.style.display = (Platform.kind === 'web' && touch && vw > vh * 1.15 && vh < 560) ? 'flex' : 'none';
  }
  App.relayout = function () { if (App.save && stage) layout(); };

  function loop(t) {
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (App.save) {
      Game.update(dt);
      // passive business income
      var real = App.real || App.save, rate = GD.passiveRate(real);
      if (rate > 0) {
        passiveAcc += rate / 60 * dt;
        if (passiveAcc >= 1) { var whole = Math.floor(passiveAcc); passiveAcc -= whole; real.coins += whole; }
      }
      saveT += dt;
      if (saveT > 10) { saveT = 0; Store.save(App.save); if (Scene.mode() === 'hub') Scene.refreshHud(); }
    }
    requestAnimationFrame(loop);
  }

  function back() {
    if (Story.active()) { Story.skip(); return true; }
    if (UI.back()) return true;
    if (World.isOpen()) { World.close(); return true; }
    if (Tuto.blocking()) return true;
    if (window.Fps && Fps.posOpen()) { Fps.posClose(); return true; }   // simulator: leave the register
    if (window.Fps && Fps.isFree()) { Fps.stop(); return true; }        // end of a visit of the kitchen
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
    var real = App.real || App.save;
    if (real && hiddenAt && Date.now() - hiddenAt > 60000) {
      var amt = Progress.offlineEarnings(real, Date.now());
      if (amt > 0) { real.coins += amt; UI.offline(amt, Math.round(Math.min(GD.OFFLINE_CAP_H * 60, (Date.now() - hiddenAt) / 60000))); }
    }
    if (real) real.lastSeen = Date.now();
    setTimeout(function () { Updater.poke(); }, 1500);     // back in the game: look for a new version
  }

  // ---------------- keyboard (PC) ----------------
  // Digits are read from the physical key (e.code): on a French AZERTY keyboard the top row gives & é " ' ( …
  // without Shift, so e.key would not work. Bonus keys are the 4 keys labelled A Z E R on AZERTY
  // (same place as Q W E R on QWERTY); a key labelled A or Z also works on any keyboard.
  var BOOST_KEYS = [['a', 'KeyQ'], ['z', 'KeyW'], ['e', 'KeyE'], ['r', 'KeyR']];
  function stationKey(e) {
    var m = /^(?:Digit|Numpad)([1-8])$/.exec(e.code || '');
    if (m) return +m[1];
    var n = e.code ? 0 : parseInt(e.key, 10);
    return n >= 1 && n <= 8 ? n : 0;
  }
  function boosterKey(e) {
    var k = (e.key || '').toLowerCase(), i;
    for (i = 0; i < 4; i++) if (k === BOOST_KEYS[i][0]) return i;
    for (i = 0; i < 4; i++) if (e.code === BOOST_KEYS[i][1]) return i;
    return -1;
  }
  function keys(e) {
    if (!App.save || e.ctrlKey || e.altKey || e.metaKey) return;
    var key = e.key || '', code = e.code || '', low = key.toLowerCase();
    if (key === 'F11') { if (Platform.kind === 'desktop') { UI.setFullscreen(!Platform.isFullscreen()); e.preventDefault(); } return; }
    if (key === 'Escape') { back(); e.preventDefault(); return; }
    // first-person simulator: its own keys (walking is read from the physical keys by Fps itself)
    if (window.Fps && Fps.active() && !UI.isBlocking() && !Tuto.blocking() && !Story.active()) { Fps.key(e); return; }
    if (e.repeat) return;
    var go = key === 'Enter' || key === ' ' || code === 'Space';
    if (Story.active()) { if (go) { Story.next(); e.preventDefault(); } return; }
    if (World.isOpen()) return;
    var sh = Game.shift(), n = stationKey(e);
    if (UI.isBlocking() || Tuto.blocking()) {
      if ((key === ' ' || code === 'Space') && sh && !sh.over && UI.isBlocking()) { UI.back(); e.preventDefault(); }
      return;
    }
    if (App.screen === 'title') { if (go) { Sfx.play('click'); Game.enterHub(); e.preventDefault(); } return; }
    if (sh && !sh.over) {
      if (Game.isPaused()) return;
      if (key === ' ' || code === 'Space' || low === 'p') { Game.pause(); e.preventDefault(); return; }
      if (n) { Scene.pressStation(n - 1); return; }
      var b = boosterKey(e);
      if (b >= 0) Scene.pressBooster(b);
      return;
    }
    if (sh || Game.isPaused()) return;
    // in the kitchen, between two days
    if (n) { Scene.pressStation(n - 1); return; }
    if (key === 'Enter') { Sfx.play('click'); Game.startDay(App.save.unlocked); e.preventDefault(); }
    else if (low === 'b') { Sfx.play('click'); UI.shop(); }
    else if (low === 'c') { Sfx.play('click'); Story.openJournal(); }
    else if (low === 'n') { Sfx.play('click'); UI.levels(); }
    else if (low === 'm' && Scene.E.mapBtn.style.display !== 'none') { Sfx.play('click'); World.open(); }
    else if (low === 'v') { Scene.toggleSim(); }
    else if (low === 'k') { Sfx.play('click'); Club.open(); }
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
    try { preLayout(); } catch (e) { }
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
      // the 3D view is on by default (it can be turned off in the settings); version 1.4 needs it for the PC layout
      if (!save.flags.v13) { save.flags.v13 = 1; save.view3d = true; }
      if (!save.flags.v14) { save.flags.v14 = 1; if (Platform.kind !== 'android') save.view3d = true; }
      App.save = save;
      setLoad(1);
      Sfx.setVol(save.settings.music, save.settings.sfx);
      var game = document.getElementById('screen-game');
      Scene.build(game);
      UI.init(stage, document.getElementById('screen-title'));
      layout();
      Scene.setMode('hub');
      Game.syncScreens();
      View3D.snap();
      if (Platform.kind === 'desktop' && save.settings.fullscreen) UI.setFullscreen(true);
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
    // the camera follows the mouse a little (PC)
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      App.mx = Util.clamp(e.clientX / (window.innerWidth || 1) * 2 - 1, -1, 1);
      App.my = Util.clamp(e.clientY / (window.innerHeight || 1) * 2 - 1, -1, 1);
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { App.mx = 0; App.my = 0; });
    try { if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) document.getElementById('app').classList.add('keys'); } catch (e) { }
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
