window.T = {
  rich: function (lvl) {
    var s = App.save; s.coins = 25000; s.level = lvl || 9; s.unlocked = 12;
    s.stations = { grill: 5, jus: 4, frites: 3, pizza: 2, soupe: 1, wok: 1, sushi: 0, gateau: 0 };
    s.decor = { plantes: 2, tabourets: 2, lanternes: 2, musique: 1, enseigne: 2 };
    s.staff = { serveur: 1, commis: 1 }; s.boosters = { turbo: 2, coeur: 1, temps: 1, chance: 1 };
    s.days = { 1: 3, 2: 3, 3: 2, 4: 1, 5: 3, 6: 2, 7: 1, 8: 3, 9: 2, 10: 1, 11: 2 };
    s.seenTuto = { basic: 1, hub1: 1, hub2: 1, mode: 1, vip: 1, sim: 1, sim2: 1 }; s.story.seen.prologue = 1; s.lastBuild = APP_BUILD;
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
  // a typical save on a given day (the progress of the bot of tools/sim_balance.js), to test the pace of the simulator
  prof: function (day, mode, staff) {
    var L = [[2, [4, 5, 4, 0, 0, 0, 0, 0], [0, 0], [0, 0, 0, 0, 0], 4], [5, [6, 7, 6, 3, 0, 0, 0, 0], [0, 0], [1, 0, 0, 0, 0], 7],
      [9, [8, 9, 7, 5, 0, 0, 0, 0], [1, 0], [1, 1, 0, 0, 0], 10], [12, [9, 9, 8, 5, 3, 0, 0, 0], [1, 0], [1, 1, 1, 0, 0], 11],
      [16, [10, 10, 9, 6, 4, 0, 0, 0], [2, 1], [2, 1, 1, 1, 0], 12], [20, [10, 10, 10, 7, 6, 4, 0, 0], [2, 1], [2, 1, 1, 1, 0], 14],
      [28, [10, 10, 10, 9, 7, 5, 4, 0], [2, 2], [2, 1, 2, 1, 1], 16]];
    var p = L[0]; for (var i = 0; i < L.length; i++) if (L[i][0] <= day) p = L[i];
    T.rich(p[4]);
    var s = App.save; s.mode = mode || 'detente';
    GD.STATIONS.forEach(function (d, k) { s.stations[d.id] = p[1][k]; });
    s.staff = { serveur: staff ? staff[0] : p[2][0], commis: staff ? staff[1] : p[2][1] };
    GD.DECOR_ORDER.forEach(function (id, k) { s.decor[id] = p[3][k]; });
    s.settings.sim = true; s.gift = { day: Daily.day(), streak: 1 };
    Scene.setMode('hub');
    return 'profile of day ' + p[0];
  },
  // ---- simulator robots ----
  // what a sensible player would go and do next (the same advice as the coach of the first days)
  _plan: function () { return Fps._plan(); },
  // where to stand to do it
  _stand: function (g) {
    var p = Fps._pos(g.type, g.i);
    if (g.type === 'station') return { x: p.x, z: 2.9, t: p };
    if (g.type === 'fridge') return { x: 5.6, z: 3.0, t: p };
    return { x: p.x, z: g.type === 'dirt' ? 1.5 : 1.4, t: p };
  },
  _look: function (P, t) { var dx = t.x - P.x, dz = t.z - P.z, dy = t.y - 2.15; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)); },
  // plays a day in the first-person simulator, jumping from one thing to the next (fast: one gesture every 0.25 s)
  fpbot: function (sec) {
    var sh = Game.shift(); if (!sh || !Fps.active()) return 'no simulator day';
    var frame = View3D.frame, n = 0, P = Fps._p, acts = {}, pend = false, step = 0;
    View3D.frame = function (dt) { if (++n % 60 === 0) frame(dt); };
    try {
      for (var t = 0; t < sec && !sh.over; t += 0.05) {
        Game.update(0.05); step++;
        if (pend) { var d = Fps._describe(); if (d.can) { acts[d.act] = (acts[d.act] || 0) + 1; Fps.interact(); } else acts.miss = (acts.miss || 0) + 1; pend = false; continue; }
        if (step % 5) continue;
        var g = T._plan(sh);
        if (!g) continue;
        var s = T._stand(g); P.x = s.x; P.z = s.z; P.vx = P.vz = 0; T._look(P, s.t); pend = true;
      }
    } finally { View3D.frame = frame; }
    frame(0.016);
    return 'earned ' + Math.round(sh.earned) + '/' + sh.goal + ' t=' + Math.round(sh.timeLeft) + ' over=' + sh.over + ' ' + JSON.stringify(acts);
  },
  // like fpbot, but the bot really walks (4.4 units/s) and needs a moment to aim: what a good player can do.
  // skill: seconds to aim at something new (0.35 = good player, 0.8 = beginner)
  fpwalk: function (sec, skill) {
    var sh = Game.shift(); if (!sh || !Fps.active()) return 'no simulator day';
    var frame = View3D.frame, n = 0, P = Fps._p, acts = {}, goal = null, wait = 0, last = '', aim = skill || 0.35;
    View3D.frame = function (dt) { if (++n % 60 === 0) frame(dt); };
    try {
      for (var t = 0; t < sec && !sh.over; t += 0.05) {
        Game.update(0.05);
        if (!goal) {
          var g = T._plan(sh);
          if (!g) continue;
          goal = T._stand(g); goal.key = g.type + g.i;
          wait = goal.key === last ? aim * 0.6 : aim;      // another gesture on the same thing is quicker
        }
        var dx = goal.x - P.x, dz = goal.z - P.z, d = Math.sqrt(dx * dx + dz * dz), step = 4.4 * (Fps._crate() ? 0.88 : 1) * 0.05;
        T._look(P, goal.t);
        if (d > 0.08) { P.x += dx / d * Math.min(step, d); P.z += dz / d * Math.min(step, d); continue; }
        wait -= 0.05; if (wait > 0) continue;
        var ds = Fps._describe(); if (ds.can) { acts[ds.act] = (acts[ds.act] || 0) + 1; Fps.interact(); } else acts.miss = (acts.miss || 0) + 1;
        last = goal.key; goal = null;
      }
    } finally { View3D.frame = frame; }
    frame(0.016);
    return 'earned ' + Math.round(sh.earned) + '/' + sh.goal + ' (3 stars ' + sh.thresholds[2] + ', potential ' + Math.round(sh.potential) + ' -> ' + Math.round(100 * sh.earned / sh.potential) + ' %) t=' + Math.round(sh.timeLeft) + ' served=' + sh.served + ' lost=' + sh.lost + ' stars=' + (sh.over ? sh.stars : '?') + ' ' + JSON.stringify(acts);
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
