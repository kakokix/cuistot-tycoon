// ===================== UTILITIES, STORAGE, VIBRATION =====================
var Util = {
  fmt: function (n) {
    n = Math.floor(n);
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace('.', ',') + ' Md';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' M';
    if (n >= 1e5) return Math.floor(n / 1e3) + ' k';
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  },
  clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; }
};

var Platform = {
  kind: (window.AndroidBridge ? 'android' : (window.NL_PORT || window.NL_OS) ? 'desktop' : 'web'),
  exit: function () {
    try {
      if (window.AndroidBridge && AndroidBridge.exit) { AndroidBridge.exit(); return; }
      if (window.Neutralino && Neutralino.app) { Neutralino.app.exit(); return; }
    } catch (e) { }
    try { window.close(); } catch (e) { }
  },
  canExit: function () { return !!(window.AndroidBridge || window.NL_PORT); },
  isFullscreen: function () { return !!(document.fullscreenElement || document.webkitFullscreenElement || Platform._nlFs); },
  toggleFullscreen: function () {
    try {
      if (window.Neutralino && window.NL_PORT) {
        Platform._nlFs = !Platform._nlFs;
        if (Platform._nlFs) Neutralino.window.setFullScreen(); else Neutralino.window.exitFullScreen();
        return;
      }
      var d = document, de = d.documentElement;
      if (Platform.isFullscreen()) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else (de.requestFullscreen || de.webkitRequestFullscreen).call(de);
    } catch (e) { }
  },
  canFullscreen: function () { return !window.AndroidBridge && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen || window.NL_PORT); }
};

var Vib = {
  buzz: function (ms) {
    if (!App.save || !App.save.settings.vibra) return;
    try {
      if (window.AndroidBridge && AndroidBridge.vibrate) AndroidBridge.vibrate(ms);
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { }
  }
};

var Store = (function () {
  var KEY = 'cuistot_tycoon_v1', backend = 'mem', mem = null;
  function detect() {
    if (window.AndroidBridge && AndroidBridge.load) return 'android';
    if (window.Neutralino && window.NL_PORT) return 'neutralino';
    try { localStorage.setItem('__ct', '1'); localStorage.removeItem('__ct'); return 'local'; } catch (e) { return 'mem'; }
  }
  function merge(def, s) {
    if (!s || typeof s !== 'object') return def;
    Object.keys(s).forEach(function (k) {
      var sv = s[k], dv = def[k];
      if (sv === undefined || sv === null) return;
      if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
        if (typeof sv !== 'object' || Array.isArray(sv)) return;
        // an empty default object is a free-form map (days, seenTuto, story...): keep the saved one as is
        def[k] = Object.keys(dv).length ? merge(dv, sv) : sv;
      }
      else if (dv === undefined) def[k] = sv;          // data unknown to this version (newer counters...): keep it
      else if (typeof sv === typeof dv) def[k] = sv;
    });
    return def;
  }
  function load() {
    backend = detect();
    return new Promise(function (resolve) {
      var done = function (raw) {
        var s = null;
        if (raw) { try { s = JSON.parse(raw); } catch (e) { s = null; } }
        resolve(merge(GD.newSave(), s));
      };
      var ls = function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
      try {
        if (backend === 'android') done(AndroidBridge.load(KEY));
        else if (backend === 'neutralino') Neutralino.storage.getData(KEY).then(function (r) { done(r || ls()); }, function () { done(ls()); });
        else if (backend === 'local') done(localStorage.getItem(KEY));
        else done(mem);
      } catch (e) { done(null); }
    });
  }
  function save(s) {
    s.lastSeen = Date.now();
    var raw = JSON.stringify(s);
    try {
      if (backend === 'android') AndroidBridge.save(KEY, raw);
      else if (backend === 'neutralino') { Neutralino.storage.setData(KEY, raw).catch(function () { }); try { localStorage.setItem(KEY, raw); } catch (e) { } }
      else if (backend === 'local') localStorage.setItem(KEY, raw);
      else mem = raw;
    } catch (e) { }
  }
  function wipe() {
    try {
      if (backend === 'android') AndroidBridge.save(KEY, '');
      else if (backend === 'neutralino') { Neutralino.storage.setData(KEY, '').catch(function () { }); try { localStorage.removeItem(KEY); } catch (e) { } }
      else if (backend === 'local') localStorage.removeItem(KEY);
      mem = null;
    } catch (e) { }
  }
  // save and wait until it is really written (before reloading the page for an update)
  function saveNow(s) {
    save(s);
    if (backend === 'neutralino') {
      try { return Neutralino.storage.setData(KEY, JSON.stringify(s)).catch(function () { }); } catch (e) { }
    }
    return Promise.resolve();
  }
  return { load: load, save: save, saveNow: saveNow, wipe: wipe, backend: function () { return backend; } };
})();
