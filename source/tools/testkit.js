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
  // plays a day in the first-person simulator: aims at stations and customers like a player would
  fpbot: function (sec) {
    var sh = Game.shift(); if (!sh || !Fps.active()) return 'no simulator day';
    var frame = View3D.frame, n = 0, P = Fps._p, m = View3D.metrics(), acts = { cook: 0, take: 0, give: 0, miss: 0 }, pend = false, step = 0;
    View3D.frame = function (dt) { if (++n % 60 === 0) frame(dt); };
    function face(x, z, tx, ty, tz) {
      P.x = x; P.z = z; P.vx = P.vz = 0;
      var dx = tx - x, dz = tz - z, dy = ty - 2.15;
      P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
    }
    function toStation(i) { var g = m.geo[i]; face(g.x, 3.0, g.x, m.wtTop + 0.3, m.zSt - 0.15); pend = true; }
    try {
      for (var t = 0; t < sec && !sh.over; t += 0.05) {
        Game.update(0.05); step++;
        if (pend) { var d = Fps._describe(); if (d.can) { acts[d.act]++; Fps.interact(); } else acts.miss++; pend = false; continue; }
        if (step % 5) continue;
        var cs = sh.customers.filter(function (c) { return c.state === 'wait'; }), carry = Fps._carry(), i, k, done = false;
        for (i = 0; i < cs.length && !done; i++) for (k = 0; k < carry.length; k++) if (sh.wants(cs[i], carry[k].st)) {
          var sx = View3D.seatX(cs[i].seat, sh.seats.length); face(sx, 1.3, sx, 1.9, -1.15); pend = done = true; break;
        }
        if (done || carry.length >= 3) continue;
        for (i = 0; i < 8 && !done; i++) {
          if (sh.stations[i].ready <= 0) continue;
          var held = carry.filter(function (c) { return c.st === i; }).length, want = 0;
          cs.forEach(function (c) { c.items.forEach(function (it) { if (!it.done && it.st === i) want++; }); });
          if (want > held) { toStation(i); done = true; }
        }
        if (done) continue;
        var nd = sh.needs(), best = -1, bn = 0;
        for (k = 0; k < 8; k++) { var st = sh.stations[k]; if (st.owned && st.cooking.length + st.ready < st.slots && nd[k] > bn) { bn = nd[k]; best = k; } }
        if (best >= 0) toStation(best);
      }
    } finally { View3D.frame = frame; }
    frame(0.016);
    return 'earned ' + Math.round(sh.earned) + '/' + sh.goal + ' t=' + Math.round(sh.timeLeft) + ' over=' + sh.over + ' ' + JSON.stringify(acts);
  },
  // like fpbot, but the bot really walks (4.4 units/s) and needs a moment to aim: what a good player can do
  fpwalk: function (sec) {
    var sh = Game.shift(); if (!sh || !Fps.active()) return 'no simulator day';
    var frame = View3D.frame, n = 0, P = Fps._p, m = View3D.metrics(), acts = { cook: 0, take: 0, give: 0, miss: 0 }, goal = null, wait = 0;
    View3D.frame = function (dt) { if (++n % 60 === 0) frame(dt); };
    function look(tx, ty, tz) { var dx = tx - P.x, dz = tz - P.z, dy = ty - 2.15; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)); }
    function plan() {
      var cs = sh.customers.filter(function (c) { return c.state === 'wait'; }), carry = Fps._carry(), i, k;
      for (i = 0; i < cs.length; i++) for (k = 0; k < carry.length; k++) if (sh.wants(cs[i], carry[k].st)) { var sx = View3D.seatX(cs[i].seat, sh.seats.length); return { x: sx, z: 1.4, t: [sx, 1.9, -1.15] }; }
      if (carry.length < 3) {
        for (i = 0; i < 8; i++) {
          if (sh.stations[i].ready <= 0) continue;
          var held = carry.filter(function (c) { return c.st === i; }).length, want = 0;
          cs.forEach(function (c) { c.items.forEach(function (it) { if (!it.done && it.st === i) want++; }); });
          if (want > held) return { x: m.geo[i].x, z: 2.9, t: [m.geo[i].x, m.wtTop + 0.3, m.zSt - 0.15] };
        }
        var nd = sh.needs(), best = -1, bn = 0;
        for (k = 0; k < 8; k++) { var st = sh.stations[k]; if (st.owned && st.cooking.length + st.ready < st.slots && nd[k] > bn) { bn = nd[k]; best = k; } }
        if (best >= 0) return { x: m.geo[best].x, z: 2.9, t: [m.geo[best].x, m.wtTop + 0.3, m.zSt - 0.15] };
      }
      return null;
    }
    try {
      for (var t = 0; t < sec && !sh.over; t += 0.05) {
        Game.update(0.05);
        if (!goal) { goal = plan(); wait = 0.35; if (!goal) continue; }
        var dx = goal.x - P.x, dz = goal.z - P.z, d = Math.sqrt(dx * dx + dz * dz), step = 4.4 * 0.05;
        if (d > 0.08) { P.x += dx / d * Math.min(step, d); P.z += dz / d * Math.min(step, d); look(goal.t[0], goal.t[1], goal.t[2]); continue; }
        look(goal.t[0], goal.t[1], goal.t[2]);
        wait -= 0.05; if (wait > 0) continue;
        var ds = Fps._describe(); if (ds.can) { acts[ds.act]++; Fps.interact(); } else acts.miss++;
        goal = null;
      }
    } finally { View3D.frame = frame; }
    frame(0.016);
    return 'earned ' + Math.round(sh.earned) + '/' + sh.goal + ' (normal goal ' + GD.goalFor(sh.day, App.save.mode) + ') t=' + Math.round(sh.timeLeft) + ' served=' + sh.served + ' ' + JSON.stringify(acts);
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
