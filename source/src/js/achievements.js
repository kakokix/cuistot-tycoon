// ===================== ACHIEVEMENTS (succès): listed in the Carnet, rewards to collect =====================
var Ach = (function () {
  function claimable(save) {
    save = save || App.save;
    if (!save.ach) save.ach = {};
    return GD.ACHIEVEMENTS.filter(function (a) { return !save.ach[a.id] && GD.achValue(save, a.stat) >= a.goal; });
  }
  function count() { return claimable().length; }
  // a short "succès débloqué" toast the first time an achievement becomes claimable
  var announced = null;
  function check() {
    var s = App.save;
    if (!announced) { announced = {}; claimable(s).forEach(function (a) { announced[a.id] = 1; }); return; }
    claimable(s).forEach(function (a) {
      if (announced[a.id]) return;
      announced[a.id] = 1;
      Sfx.play('star');
      UI.toast('Succès débloqué : ' + a.name + ' ! Récupère ta récompense dans le Carnet.');
    });
  }
  function render(list, rerender) {
    var s = App.save;
    if (!s.ach) s.ach = {};
    var done = GD.ACHIEVEMENTS.filter(function (a) { return s.ach[a.id]; }).length;
    UI.el('div', 'ptxt', list, '<b>' + done + ' / ' + GD.ACHIEVEMENTS.length + ' succès</b>').style.cssText = 'margin:0 0 12px;font-size:24px';
    var order = GD.ACHIEVEMENTS.slice().sort(function (a, b) {
      function rank(x) { var v = GD.achValue(s, x.stat); return s.ach[x.id] ? 2 : v >= x.goal ? 0 : 1; }
      return rank(a) - rank(b);
    });
    order.forEach(function (a) {
      var v = Math.min(a.goal, GD.achValue(s, a.stat)), got = !!s.ach[a.id], ready = !got && v >= a.goal;
      var r = UI.el('div', 'row ach' + (got ? ' got' : ''), list);
      var ic = UI.el('div', 'ic sm', r); ic.style.backgroundImage = got || ready ? 'var(--a-star)' : 'var(--a-sstar1)';
      if (!got && !ready) ic.style.filter = 'grayscale(1) brightness(1.2)';
      UI.el('div', 'nm', r, a.name);
      UI.el('div', 'ds', r, a.desc);
      var bar = UI.el('div', 'abar', r, '<i></i><span>' + Util.fmt(v) + ' / ' + Util.fmt(a.goal) + '</span>');
      bar.querySelector('i').style.width = Math.round(100 * v / a.goal) + '%';
      if (got) UI.el('div', 'pill max', r, 'FAIT ✓');
      else {
        var b = UI.el('div', 'pill' + (ready ? '' : ' dis'), r, '<img class="coin" src="' + Art.coin() + '"> ' + Util.fmt(a.reward));
        b.classList.add('tap');
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!ready) { Sfx.play('nope'); UI.toast('Pas encore : ' + Util.fmt(v) + ' / ' + Util.fmt(a.goal)); return; }
          s.ach[a.id] = 1; s.coins += a.reward; Store.save(s);
          Sfx.play('buy'); Vib.buzz(30);
          UI.toast('+' + Util.fmt(a.reward) + ' pièces !');
          Scene.refreshHud();
          rerender();
        });
      }
    });
  }
  return { claimable: claimable, count: count, check: check, render: render };
})();
