// ===================== WORLD MAP: travel between the restaurants of the island =====================
var World = (function () {
  var root = null;
  // pin positions on the 720 x (720*1.5) map image (fractions of width/height)
  var PINS = { jungle: [0.29, 0.53], plage: [0.74, 0.68], montagne: [0.30, 0.20], ville: [0.73, 0.22] };
  function el(t, c, p, h) { return UI.el(t, c, p, h); }
  function px(v) { return Math.round(v) + 'px'; }
  function dishName(d) { var s = GD.STATIONS.filter(function (x) { return x.dish === d; })[0]; return s ? s.dishName : d; }

  function open() {
    if (root) return;
    var H = App.H, s = App.save;
    root = el('div', 'world', document.getElementById('stage'));
    root.style.height = px(H);
    el('div', 'w-bg', root);
    var mapH = Math.min(1080, H - 120), mapW = mapH / 1.5, scale = Math.min(1, 700 / mapW);
    mapW *= scale; mapH *= scale;
    var map = el('div', 'w-map', root);
    map.style.cssText += ';left:' + px((720 - mapW) / 2) + ';top:' + px(H - mapH - 22) + ';width:' + px(mapW) + ';height:' + px(mapH);
    var title = el('div', 'w-title', root, '<div class="leaf" style="position:relative;margin:0 auto"><span>L’ÎLE</span></div>');
    title.style.top = px(Math.max(-30, H - mapH - 22 - 150));
    var cl = el('div', 'close tap w-close', root);
    cl.addEventListener('click', function (e) { e.stopPropagation(); Sfx.play('click'); close(); });
    GD.LOCATIONS.forEach(function (L) {
      var un = GD.locUnlocked(s, L.id), cur = (s.loc || 'jungle') === L.id;
      var p = PINS[L.id];
      var pin = el('div', 'w-pin tap' + (cur ? ' cur' : '') + (un ? '' : ' lock'), root);
      pin.style.left = px((720 - mapW) / 2 + p[0] * mapW);
      pin.style.top = px(H - mapH - 22 + p[1] * mapH - 50);
      var pp = el('div', 'pp', pin); pp.style.backgroundImage = 'var(--a-' + L.bg + ')';
      el('div', 'pn', pin, un ? L.resto : L.name);
      var desc = !un ? '<img src="' + ASSETS.lock + '"> Jour ' + L.unlockDay :
        cur ? 'Tu es ici' : L.special.length ? 'Spécialités : ' + L.special.map(function (d) { return '<img src="' + Art.dish(d) + '">'; }).join('') : 'La maison';
      el('div', 'pd', pin, desc);
      if (un && !cur && !(s.flags.visited || {})[L.id] && L.id !== 'jungle') el('div', 'badge', pin, '!');
      pin.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!un) { Sfx.play('nope'); UI.toast('Ce restaurant ouvrira avec l’histoire (jour ' + L.unlockDay + ')'); return; }
        if (cur) { Sfx.play('click'); close(); return; }
        travel(L.id);
      });
    });
    Sfx.play('page');
  }
  function close(cb) {
    if (!root) { if (cb) cb(); return; }
    var r = root; root = null;
    r.classList.add('closing');
    setTimeout(function () { r.remove(); if (cb) cb(); }, 220);
  }
  function travel(id) {
    var s = App.save, L = GD.locById(id);
    Sfx.play('whoosh');
    close(function () {
      var t = el('div', 'travel', document.getElementById('stage'), '<div class="t-wipe"></div><div class="t-name">' + L.resto + '</div>');
      t.style.height = px(App.H);
      setTimeout(function () {
        s.loc = id;
        if (!s.flags.visited) s.flags.visited = {};
        var first = !s.flags.visited[id];
        s.flags.visited[id] = 1;
        Store.save(s);
        Scene.setMode('hub');
        if (window.View3D) View3D.refresh();
        if (first && L.special.length) setTimeout(function () { UI.toast('Spécialités : ' + L.special.map(dishName).join(' et ') + ' rapportent 30 % de plus ici !'); }, 700);
      }, 420);
      setTimeout(function () { t.remove(); }, 1150);
    });
  }
  function isOpen() { return !!root; }
  return { open: open, close: close, travel: travel, isOpen: isOpen };
})();
