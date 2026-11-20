window.T = {
  rich: function (lvl) {
    var s = App.save; s.coins = 25000; s.level = lvl || 9; s.unlocked = 12;
    s.stations = { grill: 5, jus: 4, frites: 3, pizza: 2, soupe: 1, wok: 1, sushi: 0, gateau: 0 };
    s.decor = { plantes: 2, tabourets: 2, lanternes: 2, musique: 1, enseigne: 2 };
    s.staff = { serveur: 1, commis: 1 }; s.boosters = { turbo: 2, coeur: 1, temps: 1, chance: 1 };
    s.days = { 1: 3, 2: 3, 3: 2, 4: 1, 5: 3, 6: 2, 7: 1, 8: 3, 9: 2, 10: 1, 11: 2 };
    s.seenTuto = { basic: 1, hub1: 1, hub2: 1, mode: 1, vip: 1 }; s.story.seen.prologue = 1; s.lastBuild = APP_BUILD;
    Scene.setMode('hub'); return 'ok';
  },
  ff: function (sec, bot) {
    var sh = Game.shift(); if (!sh) return 'no shift';
    var act = 0;
    // fast-forward without drawing the 3D view at every simulated step (very slow with a software renderer)
    var frame = View3D.frame, n = 0;
    View3D.frame = function (dt) { if (++n % 40 === 0) frame(dt); };
    try { T._ff(sh, sec, bot, act); } finally { View3D.frame = frame; }
    frame(0.016);
    return 'earned ' + Math.round(sh.earned) + ' t=' + Math.round(sh.timeLeft);
  },
  _ff: function (sh, sec, bot, act) {
    for (var t = 0; t < sec; t += 0.05) {
      Game.update(0.05);
      act -= 0.05;
      if (bot && act <= 0 && !sh.over) {
        act = 0.6;
        var done = false;
        for (var i = 0; i < 8 && !done; i++) if (sh.stations[i].ready > 0) { for (var c of sh.customers) if (c.state === 'wait' && c.items.some(function (it) { return !it.done && it.st === i; })) { sh.tapStation(i); done = true; break; } }
        if (!done) { var n = sh.needs(); var best = -1, bn = 0; for (var k = 0; k < 8; k++) { var st = sh.stations[k]; if (st.owned && st.cooking.length + st.ready < st.slots && n[k] > bn) { bn = n[k]; best = k; } } if (best >= 0) sh.tapStation(best); }
      }
    }
  }
};
'kit';
