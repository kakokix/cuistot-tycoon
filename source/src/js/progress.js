// ===================== PROGRESSION (shared by game & balance tool) =====================
var Progress = (function () {
  var G = (typeof GD !== 'undefined') ? GD : require('./data.js').GD;

  function addXp(save, amount) {
    var ups = [];
    save.xp += amount;
    while (save.xp >= G.xpNeed(save.level)) {
      save.xp -= G.xpNeed(save.level);
      save.level++;
      var reward = 20 * save.level;
      save.coins += reward;
      ups.push({ level: save.level, reward: reward, unlocks: unlocksAt(save.level) });
    }
    return ups;
  }

  function unlocksAt(level) {
    var u = [];
    G.STATIONS.forEach(function (s) { if (s.unlock === level) u.push({ kind: 'station', id: s.id, name: s.name + ' (' + s.dishName + ')' }); });
    Object.keys(G.STAFF).forEach(function (k) { if (G.STAFF[k].unlock === level) u.push({ kind: 'staff', id: k, name: G.STAFF[k].name }); });
    Object.keys(G.DECOR).forEach(function (k) { if (G.DECOR[k].unlock === level) u.push({ kind: 'decor', id: k, name: G.DECOR[k].name }); });
    Object.keys(G.BOOSTERS).forEach(function (k) { if (G.BOOSTERS[k].unlock === level) u.push({ kind: 'booster', id: k, name: 'Bonus ' + G.BOOSTERS[k].name }); });
    G.BUSINESS.forEach(function (b) { if (b.unlock === level) u.push({ kind: 'business', id: b.id, name: b.name }); });
    return u;
  }

  function applyResult(save, sh) {
    var prev = save.days[sh.day] || 0;
    var newStars = Math.max(0, sh.stars - prev);
    // every star ever won (the world ranking keeps them after a prestige)
    save.stats.starsAll = Math.max(save.stats.starsAll || 0, G.achValue(save, 'stars')) + newStars;
    var bonus = newStars * Math.round(sh.goal * 0.15);
    save.coins += bonus;
    if (sh.stars > prev) save.days[sh.day] = sh.stars;
    var unlockedNext = false;
    if (sh.win && sh.day >= save.unlocked) { save.unlocked = sh.day + 1; unlockedNext = true; }
    var xpGain = sh.xp + sh.stars * 10 + (sh.win ? sh.day * 2 : 0);
    save.stats.days++;
    var ups = addXp(save, xpGain);
    return { xpGain: xpGain, bonus: bonus, newStars: newStars, levelUps: ups, unlockedNext: unlockedNext };
  }

  // every purchasable thing with its current state (used by shop UI & bot)
  function offers(save) {
    var o = [];
    G.STATIONS.forEach(function (s) {
      var lv = save.stations[s.id] || 0;
      if (lv === 0) o.push({ kind: 'station', id: s.id, buy: true, cost: s.cost, locked: save.level < s.unlock, unlock: s.unlock, level: 0, max: G.MAX_ST_LEVEL });
      else if (lv < G.MAX_ST_LEVEL) o.push({ kind: 'station', id: s.id, buy: false, cost: G.upgradeCost(s, lv), locked: false, level: lv, max: G.MAX_ST_LEVEL });
      else o.push({ kind: 'station', id: s.id, maxed: true, level: lv, max: G.MAX_ST_LEVEL });
    });
    Object.keys(G.STAFF).forEach(function (k) {
      var d = G.STAFF[k], lv = save.staff[k] || 0;
      if (lv < d.costs.length) o.push({ kind: 'staff', id: k, cost: d.costs[lv], locked: save.level < d.unlock, unlock: d.unlock, level: lv, max: d.costs.length });
      else o.push({ kind: 'staff', id: k, maxed: true, level: lv, max: d.costs.length });
    });
    G.DECOR_ORDER.forEach(function (k) {
      var d = G.DECOR[k], lv = save.decor[k] || 0;
      if (lv < d.costs.length) o.push({ kind: 'decor', id: k, cost: d.costs[lv], locked: save.level < d.unlock, unlock: d.unlock, level: lv, max: d.costs.length });
      else o.push({ kind: 'decor', id: k, maxed: true, level: lv, max: d.costs.length });
    });
    G.BUSINESS.forEach(function (b) {
      var n = save.business[b.id] || 0;
      if (n < b.max) o.push({ kind: 'business', id: b.id, cost: G.businessCost(b, n), locked: save.level < b.unlock, unlock: b.unlock, level: n, max: b.max });
      else o.push({ kind: 'business', id: b.id, maxed: true, level: n, max: b.max });
    });
    G.BOOSTER_ORDER.forEach(function (k) {
      var b = G.BOOSTERS[k];
      o.push({ kind: 'booster', id: k, cost: b.cost, locked: save.level < b.unlock, unlock: b.unlock, level: save.boosters[k] || 0, max: 99 });
    });
    return o;
  }

  function buy(save, kind, id) {
    var list = offers(save), off = null;
    for (var i = 0; i < list.length; i++) if (list[i].kind === kind && list[i].id === id) { off = list[i]; break; }
    if (!off || off.maxed || off.locked || save.coins < off.cost) return false;
    save.coins -= off.cost;
    if (kind === 'station') save.stations[id] = (save.stations[id] || 0) + 1;
    else if (kind === 'staff') save.staff[id] = (save.staff[id] || 0) + 1;
    else if (kind === 'decor') save.decor[id] = (save.decor[id] || 0) + 1;
    else if (kind === 'business') save.business[id] = (save.business[id] || 0) + 1;
    else if (kind === 'booster') save.boosters[id] = (save.boosters[id] || 0) + 1;
    return true;
  }

  function canAffordSomething(save) {
    var o = offers(save);
    for (var i = 0; i < o.length; i++) if (!o[i].maxed && !o[i].locked && o[i].kind !== 'booster' && save.coins >= o[i].cost) return true;
    return false;
  }

  function offlineEarnings(save, now) {
    if (!save.lastSeen) return 0;
    var mins = Math.min(G.OFFLINE_CAP_H * 60, Math.max(0, (now - save.lastSeen) / 60000));
    if (mins < 1) return 0;
    return Math.floor(mins * G.passiveRate(save));
  }

  return { addXp: addXp, unlocksAt: unlocksAt, applyResult: applyResult, offers: offers, buy: buy,
    canAffordSomething: canAffordSomething, offlineEarnings: offlineEarnings };
})();
if (typeof module !== 'undefined') module.exports.Progress = Progress;
