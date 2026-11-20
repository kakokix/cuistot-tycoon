// ===================== UPDATES: the installed game checks GitHub and updates itself =====================
// version.json (on github.com/kakokix/cuistot-tycoon) says which version is the newest.
// The game looks at it when it starts, then every 2 minutes while it is open (and when its window
// comes back to the front): no need to close and reopen it to hear about a new version.
// GitHub itself can take up to about 5 minutes to serve a file that has just been pushed.
//  - Android: the new game is downloaded by the app (Java) and loaded instead of the bundled one.
//  - Windows/Linux: the new game is saved next to the .exe and served by the app.
//  - Web: the page is simply reloaded.
// If a new native app is required (minNative), the player is sent to the download link instead.
var Updater = (function () {
  var REPO = 'https://raw.githubusercontent.com/kakokix/cuistot-tycoon/main/';
  var DESK_DIR = '/.cuistot_maj', DESK_MOUNT = '/maj';
  var latest = null, busy = false, pending = null, justUpdated = false;
  var lastCheck = 0, autoT = null;
  var AUTO_MS = 120000, MIN_GAP = 45000;      // automatic check every 2 min, never more often than every 45 s

  function nativeLevel() {
    try { if (window.AndroidBridge) return AndroidBridge.nativeLevel ? AndroidBridge.nativeLevel() : 1; } catch (e) { return 1; }
    return 0;
  }
  function manifestUrl() {
    if (window.NL_UPDATEURL) return window.NL_UPDATEURL;           // desktop test builds
    try { var o = localStorage.getItem('cuistot_update_url'); if (o) return o; } catch (e) { }
    if (Platform.kind === 'web') return /github\.io$/.test(location.hostname) ? 'update/version.json' : null;
    return REPO + 'update/version.json';
  }
  function bust(url) { return url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(); }
  function getText(url) {
    return new Promise(function (res, rej) {
      if (window.AndroidBridge && AndroidBridge.fetchText) {
        var cb = '__updtxt' + Date.now();
        window[cb] = function (ok, text) { delete window[cb]; if (ok) res(text); else rej(new Error(text)); };
        AndroidBridge.fetchText(url, cb);
        return;
      }
      fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(res, rej);
    });
  }
  function getBinary(url, size, onPct) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var total = +r.headers.get('content-length') || size || 0;
      if (!r.body || !r.body.getReader) return r.arrayBuffer();
      var reader = r.body.getReader(), chunks = [], got = 0;
      return (function pump() {
        return reader.read().then(function (st) {
          if (st.done) {
            var out = new Uint8Array(got), o = 0;
            chunks.forEach(function (c) { out.set(c, o); o += c.length; });
            return out.buffer;
          }
          chunks.push(st.value); got += st.value.length;
          if (total) onPct(Math.min(99, Math.round(100 * got / total)));
          return pump();
        });
      })();
    });
  }
  function sha256(buf) {
    if (!(window.crypto && crypto.subtle)) return Promise.resolve('');
    return crypto.subtle.digest('SHA-256', buf).then(function (h) {
      return Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function openUrl(url) {
    try {
      if (window.AndroidBridge && AndroidBridge.openUrl) { AndroidBridge.openUrl(url); return; }
      if (window.Neutralino && window.NL_PORT) { Neutralino.os.open(url); return; }
    } catch (e) { }
    window.open(url, '_blank');
  }

  // ---------------- check ----------------
  function check(manual) {
    var url = manifestUrl();
    if (!url) { if (manual) UI.toast('Cette version se met à jour toute seule : tu as déjà la dernière !'); return Promise.resolve(null); }
    if (manual) UI.toast('Recherche de mises à jour…');
    lastCheck = Date.now();
    return getText(bust(url)).then(function (txt) {
      var m = JSON.parse(txt);
      latest = m;
      if (m.build > APP_BUILD) { pending = m; UI.refreshTitle(); maybePrompt(manual); }
      else if (manual) UI.toast('Tu as la dernière version (' + APP_LABEL + ') !');
      return m;
    }).catch(function () {
      if (manual) UI.toast('Impossible de vérifier : vérifie ta connexion Internet.');
      return null;
    });
  }
  // only interrupt the player on the title screen or in the kitchen (never during a day or a story)
  function canPrompt() {
    var sh = window.Game && Game.shift();
    return !busy && !(sh && !sh.over) && !(window.Story && Story.active()) && !UI.isBlocking();
  }
  function maybePrompt(force) {
    if (!pending) return;
    if (!force && !canPrompt()) return;
    if (!force && pending.build === App.save.flags.skipBuild) return;
    var m = pending;
    UI.updatePrompt(m, function () { apply(m); }, function () { App.save.flags.skipBuild = m.build; Store.save(App.save); });
  }

  // ---------------- automatic checks while the game is open ----------------
  function auto() {
    if (busy || !App.save || App.visible === false || !manifestUrl()) return;
    if (Date.now() - lastCheck < MIN_GAP) return;
    check(false);
  }
  function startAuto() {
    if (autoT) return;
    var every = AUTO_MS;
    try { var o = +(window.NL_UPDATEEVERY || localStorage.getItem('cuistot_update_every') || 0); if (o >= 2000) { every = o; MIN_GAP = Math.min(MIN_GAP, o / 2); } } catch (e) { }
    autoT = setInterval(auto, every);
    var soon = function () { setTimeout(auto, 1500); };
    window.addEventListener('focus', soon);
    window.addEventListener('online', soon);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) soon(); });
  }

  // ---------------- install ----------------
  function apply(m) {
    if (busy) return;
    busy = true;
    var p = UI.updateProgress(m);
    var fail = function (msg) { busy = false; delete App.save.flags.pendingOta; Store.save(App.save); p.fail(msg); };
    App.save.flags.pendingOta = m.build;
    Store.save(App.save);
    var k = Platform.kind;
    if (k === 'android') {
      var need = (m.android && m.android.minNative) || 1;
      if (nativeLevel() < need || !AndroidBridge.otaInstall) {
        busy = false; p.close();
        UI.toast('Cette mise à jour demande de réinstaller l’application : téléchargement de la nouvelle version…');
        openUrl(m.android.apk); return;
      }
      window.__otaProgress = function (pct) { p.set(pct); };
      var cb = '__otadone' + Date.now();
      window[cb] = function (ok, msg) {
        delete window[cb];
        if (!ok) { fail(msg || 'Téléchargement impossible'); return; }
        p.done();
        Store.save(App.save);
        setTimeout(function () { AndroidBridge.restartApp(); }, 900);
      };
      AndroidBridge.otaInstall(m.web.url, m.web.sha256 || '', m.build, m.web.size || 0, cb);
    } else if (k === 'desktop') {
      var dneed = (m.desktop && m.desktop.minNative) || 1;
      if (dneed > 2) { busy = false; p.close(); openUrl(m.desktop.exe); return; }
      var dir = NL_PATH + DESK_DIR, d = m.desktop;
      getBinary(bust(d.url), d.size, p.set).then(function (buf) {
        return sha256(buf).then(function (h) {
          if (d.sha256 && h && h !== d.sha256) throw new Error('fichier abîmé, réessaie');
          return new TextDecoder('utf-8').decode(new Uint8Array(buf));
        });
      }).then(function (html) {
        return Neutralino.filesystem.createDirectory(dir).catch(function () { }).then(function () {
          return Neutralino.filesystem.writeFile(dir + '/index.html', html);
        }).then(function () {
          return Neutralino.filesystem.writeFile(dir + '/version.json', JSON.stringify({ build: m.build, version: m.version }));
        });
      }).then(function () { return Store.saveNow(App.save); })
        .then(function () { return Neutralino.storage.setData('cuistot_ota_tries', '1').catch(function () { }); })
        .then(function () { return Neutralino.server.mount(DESK_MOUNT, dir).catch(function () { }); })
        .then(function () { p.done(); setTimeout(function () { location.replace(DESK_MOUNT + '/index.html?b=' + m.build); }, 800); })
        .catch(function (e) { fail(e && e.message ? e.message : 'erreur'); });
    } else {
      p.done();
      setTimeout(function () { location.replace(location.pathname + '?v=' + m.build); }, 700);
    }
  }

  // ---------------- desktop: start the downloaded version if it is newer than the .exe ----------------
  function desktopBoot() {
    return new Promise(function (res) {
      if (!(window.Neutralino && window.NL_PORT) || location.pathname.indexOf(DESK_MOUNT + '/') === 0) { res(); return; }
      var dir = NL_PATH + DESK_DIR;
      Neutralino.filesystem.readFile(dir + '/version.json').then(function (txt) {
        var v = JSON.parse(txt);
        if (!(v.build > APP_BUILD)) { res(); return; }
        return Neutralino.storage.getData('cuistot_ota_tries').catch(function () { return '0'; }).then(function (t) {
          var tries = parseInt(t, 10) || 0;
          if (tries >= 2) { res(); return; }   // the downloaded version failed to start twice: use the built-in one
          return Neutralino.storage.setData('cuistot_ota_tries', String(tries + 1)).catch(function () { }).then(function () {
            return Neutralino.server.mount(DESK_MOUNT, dir).catch(function () { });
          }).then(function () {
            location.replace(DESK_MOUNT + '/index.html?b=' + v.build);
            setTimeout(res, 4000);   // safety: keep booting if the navigation did not happen
          });
        });
      }).catch(function () { res(); });
    });
  }

  // ---------------- after boot: "what's new", then a silent check ----------------
  function bootOk() {
    try { if (window.AndroidBridge && AndroidBridge.bootOk) AndroidBridge.bootOk(APP_BUILD); } catch (e) { }
    try { if (window.Neutralino && window.NL_PORT) Neutralino.storage.setData('cuistot_ota_tries', '0').catch(function () { }); } catch (e) { }
  }
  function afterBoot() {
    bootOk();
    var s = App.save;
    if (s.flags.pendingOta) {
      if (APP_BUILD >= s.flags.pendingOta) { s.stats.ota = (s.stats.ota || 0) + 1; justUpdated = true; }
      delete s.flags.pendingOta;
    }
    var veteran = (s.stats.days || 0) > 0 || (s.story && s.story.seen && s.story.seen.prologue);
    if ((s.lastBuild || 0) < APP_BUILD) {
      if (veteran || justUpdated) setTimeout(function () { UI.whatsNew(justUpdated); }, 600);
      s.lastBuild = APP_BUILD;
    }
    Store.save(s);
    setTimeout(function () { check(false); }, 4000);
    startAuto();
  }
  return {
    check: check, maybePrompt: maybePrompt, apply: apply, desktopBoot: desktopBoot, afterBoot: afterBoot,
    latest: function () { return latest; }, pending: function () { return pending; }, nativeLevel: nativeLevel, poke: auto,
    lastCheck: function () { return lastCheck; }
  };
})();
