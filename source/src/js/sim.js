// ===================== SHIFT SIMULATION (no DOM) =====================
var Shift = (function () {
  var GDx = (typeof GD !== 'undefined') ? GD : require('./data.js').GD;
  var WALK_IN = 0.75, WALK_OUT = 0.8;

  function Shift(save, day, opts) {
    opts = opts || {};
    this.save = save;
    this.day = day;
    this.cfg = GDx.dayConfig(day, save.mode);
    this.relax = this.cfg.relax;          // Détente: nobody leaves angry, ready dishes are served automatically
    this.loc = GDx.locById(save.loc || 'jungle');
    this.closing = false; this.closingT = 0;
    this.rng = opts.rng || Math.random;
    this.tutorial = !!opts.tutorial;
    this.tutoServed = false;
    this.duration = this.cfg.duration;
    this.timeLeft = this.duration;
    this.t = 0;
    this.earned = 0; this.tips = 0; this.served = 0; this.lost = 0; this.xp = 0; this.vips = 0;
    this.maxHearts = 5; this.hearts = 5;
    this.goal = this.cfg.goal;
    this.thresholds = this.cfg.stars;
    var self = this;
    this.stations = GDx.STATIONS.map(function (def, i) {
      var lvl = save.stations[def.id] || 0;
      var s = GDx.stationStats(def, lvl, save);
      var special = self.loc.special.indexOf(def.dish) >= 0;
      return { i: i, def: def, owned: lvl > 0, level: lvl, price: Math.round(s.price * (special ? GDx.SPECIAL_BONUS : 1)), special: special,
        time: s.time, slots: s.slots, cooking: [], ready: 0, by: null };
    });
    this.menu = this.stations.filter(function (s) { return s.owned; }).map(function (s) { return s.i; });
    this.seats = []; var n = GDx.seatsFor(save); for (var k = 0; k < n; k++) this.seats.push(null);
    this.customers = [];
    this.spawnTimer = this.tutorial ? 0.6 : 1.2;
    this.boost = { turbo: 0, chance: 0 };
    this.staffT = { serveur: 1.5, commis: 1.0 };
    this.events = [];
    this.over = false; this.win = false; this.stars = 0;
    this.nextId = 1;
    this.endReason = '';
  }
  var P = Shift.prototype;

  P.emit = function (type, data) { var e = data || {}; e.type = type; this.events.push(e); };
  P.freeSeats = function () { var r = []; for (var i = 0; i < this.seats.length; i++) if (!this.seats[i]) r.push(i); return r; };

  P.spawn = function () {
    var free = this.freeSeats();
    if (!free.length || !this.menu.length) return false;
    var rng = this.rng, cfg = this.cfg;
    var seat = free[Math.floor(rng() * free.length)];
    var r = rng(), k = r < cfg.p1 ? 1 : r < 1 - cfg.p3 ? 2 : 3;
    if (this.tutorial && !this.tutoServed) k = 1;
    var items = [];
    var specials = this.menu.filter(function (m) { return this.stations[m].special; }, this);
    for (var j = 0; j < k; j++) {
      var si = specials.length && rng() < 0.2 ? specials[Math.floor(rng() * specials.length)] : this.menu[Math.floor(rng() * this.menu.length)];
      if (this.tutorial && !this.tutoServed) si = 0;
      items.push({ st: si, dish: this.stations[si].def.dish, done: false });
    }
    var plants = (this.save.decor.plantes || 0);
    var maxP = (11 + 6 * k) * cfg.patience * (1 + 0.12 * plants);
    // the same person never stands twice at the counter
    var present = {};
    for (var q = 0; q < this.customers.length; q++) present[this.customers[q].animal] = 1;
    var vip = rng() < cfg.vip && !present[GDx.VIP_CUSTOMER];
    var save = this.save, crowd = GDx.CUSTOMERS.slice();
    this.loc.regulars.forEach(function (r) { if (GDx.introduced(save, r)) { crowd.push(r); crowd.push(r); } });
    var pool = crowd.filter(function (x) { return !present[x]; });
    if (!pool.length) pool = GDx.CUSTOMERS;
    var animal = vip ? GDx.VIP_CUSTOMER : pool[Math.floor(rng() * pool.length)];
    var c = {
      id: this.nextId++, animal: animal,
      seat: seat, items: items, state: 'in', stateT: 0, patience: maxP, maxPatience: maxP,
      vip: vip, happy: false, pay: 0
    };
    this.seats[seat] = c;
    this.customers.push(c);
    this.emit('arrive', { c: c });
    return true;
  };

  P.update = function (dt) {
    if (this.over) return;
    var tutoHold = this.tutorial && !this.tutoServed;
    if (!tutoHold) { this.t += dt; this.timeLeft -= dt; }
    var i, c, st;
    // boosters
    if (this.boost.turbo > 0) this.boost.turbo = Math.max(0, this.boost.turbo - dt);
    if (this.boost.chance > 0) this.boost.chance = Math.max(0, this.boost.chance - dt);
    // spawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.timeLeft > 2) {
      if (tutoHold && this.customers.length > 0) { this.spawnTimer = 0.5; }
      else if (this.spawn()) {
        var iv = this.cfg.spawn * (1 - 0.1 * (this.save.decor.musique || 0));
        this.spawnTimer = iv * (0.7 + 0.6 * this.rng());
      } else this.spawnTimer = 0.3;
    }
    // cooking
    var speed = this.boost.turbo > 0 ? 2 : 1;
    for (i = 0; i < this.stations.length; i++) {
      st = this.stations[i];
      for (var j = st.cooking.length - 1; j >= 0; j--) {
        var ck = st.cooking[j];
        ck.t += dt * speed;
        if (ck.t >= ck.total) { st.cooking.splice(j, 1); st.ready++; this.emit('ready', { st: st }); }
      }
    }
    // customers
    for (i = this.customers.length - 1; i >= 0; i--) {
      c = this.customers[i];
      c.stateT += dt;
      if (c.state === 'in') {
        if (c.stateT >= WALK_IN) { c.state = 'wait'; c.stateT = 0; this.emit('order', { c: c }); }
      } else if (c.state === 'wait') {
        if (!tutoHold) c.patience -= dt;
        if (c.patience <= 0 && this.relax) c.patience = 0;
        else if (c.patience <= 0) {
          c.patience = 0; c.state = 'out'; c.stateT = 0; c.happy = false;
          this.lost++; this.hearts--; this.save.stats.lost++;
          this.emit('angry', { c: c });
          if (this.hearts <= 0) { this.end('hearts'); return; }
        }
      } else if (c.state === 'out') {
        if (c.stateT >= WALK_OUT) {
          if (this.seats[c.seat] === c) this.seats[c.seat] = null;
          this.customers.splice(i, 1);
          this.emit('gone', { c: c });
        }
      }
    }
    // staff
    this.staffTick(dt);
    if (this.relax) this.autoServe();
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      if (this.relax && !this.tutorial) {
        // "dernières commandes": the door closes, the chef finishes the orders already taken
        if (!this.closing) { this.closing = true; this.emit('closing', {}); }
        this.closingT += dt;
        var waiting = 0;
        for (i = 0; i < this.customers.length; i++) if (this.customers[i].state !== 'out') waiting++;
        if (!waiting || this.closingT > 25) this.end('time');
      } else this.end('time');
    }
  };

  P.autoServe = function () {
    for (var i = 0; i < this.stations.length; i++) {
      var st = this.stations[i];
      while (st.ready > 0 && this.serveFrom(i, null, this.save.staff.serveur > 0 ? 'serveur' : 'auto')) { /* serve every waiting customer */ }
    }
  };

  P.staffTick = function (dt) {
    var lv = this.save.staff, S = GDx.STAFF;
    if (lv.serveur > 0 && !this.relax) {
      this.staffT.serveur -= dt;
      if (this.staffT.serveur <= 0) {
        var done = false;
        for (var i = 0; i < this.stations.length && !done; i++) {
          if (this.stations[i].ready > 0 && this.serveFrom(i, null, 'serveur')) done = true;
        }
        this.staffT.serveur = done ? S.serveur.interval[lv.serveur - 1] : 0.25;
      }
    }
    if (lv.commis > 0) {
      this.staffT.commis -= dt;
      if (this.staffT.commis <= 0) {
        var best = -1, bestNeed = 0, needs = this.needs();
        for (var k = 0; k < this.stations.length; k++) {
          var st = this.stations[k];
          if (!st.owned || st.cooking.length + st.ready >= st.slots) continue;
          if (needs[k] > bestNeed) { bestNeed = needs[k]; best = k; }
        }
        if (best >= 0) { this.cook(best, 'commis'); this.staffT.commis = S.commis.interval[lv.commis - 1]; }
        else this.staffT.commis = 0.25;
      }
    }
  };

  // demand minus supply per station
  P.needs = function () {
    var n = this.stations.map(function (s) { return -(s.cooking.length + s.ready); });
    for (var i = 0; i < this.customers.length; i++) {
      var c = this.customers[i];
      if (c.state !== 'wait' && c.state !== 'in') continue;
      for (var j = 0; j < c.items.length; j++) if (!c.items[j].done) n[c.items[j].st]++;
    }
    return n;
  };

  P.cook = function (si, by) {
    var st = this.stations[si];
    if (!st.owned || st.cooking.length + st.ready >= st.slots) return false;
    st.cooking.push({ t: 0, total: st.time });
    st.by = by || 'chef';
    this.emit('cook', { st: st, by: by || 'chef' });
    return true;
  };

  P.serveFrom = function (si, onlyCust, by) {
    var st = this.stations[si];
    if (!st || st.ready <= 0) return false;
    var best = null, bestItem = null, bestR = Infinity;
    for (var i = 0; i < this.customers.length; i++) {
      var c = this.customers[i];
      if (c.state !== 'wait') continue;
      if (onlyCust && c !== onlyCust) continue;
      for (var j = 0; j < c.items.length; j++) {
        var it = c.items[j];
        if (!it.done && it.st === si) {
          var r = c.patience / c.maxPatience;
          if (r < bestR) { best = c; bestItem = it; bestR = r; }
          break;
        }
      }
    }
    if (!best) return false;
    bestItem.done = true;
    st.ready--;
    this.emit('serve', { st: st, c: best, item: bestItem, by: by || 'chef' });
    if (this.tutorial) this.tutoServed = true;
    var all = true;
    for (var k = 0; k < best.items.length; k++) if (!best.items[k].done) { all = false; break; }
    if (all) this.pay(best);
    return true;
  };

  P.pay = function (c) {
    var base = 0;
    for (var i = 0; i < c.items.length; i++) base += this.stations[c.items[i].st].price;
    var pf = Math.max(0, Math.min(1, c.patience / c.maxPatience));
    var tipMul = (1 + 0.2 * (this.save.decor.lanternes || 0)) * (this.boost.chance > 0 ? 3 : 1) *
      (this.relax ? 1 + 0.1 * (this.save.staff.serveur || 0) : 1);   // Détente: the waiter brings bigger tips
    var tip = base * 0.3 * pf * tipMul;
    var mul = c.vip ? 2 : 1;
    var total = Math.round((base + tip) * mul);
    tip = Math.round(tip * mul);
    c.pay = total; c.tip = tip; c.happy = true;
    c.state = 'out'; c.stateT = 0;
    this.earned += total; this.tips += tip; this.served++;
    var xp = (3 + 2 * c.items.length) * mul;
    this.xp += xp;
    this.save.coins += total;
    this.save.stats.served++; this.save.stats.earned += total;
    if (c.vip) { this.vips++; this.save.stats.vip = (this.save.stats.vip || 0) + 1; }
    // friendship: +1 per visit, +1 more when their favourite dish was on the order
    var who = GDx.PEOPLE[c.animal], fav = false, met = GDx.introduced(this.save, c.animal);
    if (who && who.fav) for (var f = 0; f < c.items.length; f++) if (c.items[f].dish === who.fav) fav = true;
    if (!this.save.friends) this.save.friends = {};
    var before = this.save.friends[c.animal] || 0, after = before + (met ? 1 + (fav ? 1 : 0) : 0);
    this.save.friends[c.animal] = after;
    this.emit('pay', { c: c, amount: total, tip: tip, xp: xp, fav: fav && met });
    var lv = GDx.friendLevel(after);
    if (lv > GDx.friendLevel(before)) this.emit('friend', { c: c, who: c.animal, level: lv });
  };

  // ---- player actions ----
  P.tapStation = function (si) {
    if (this.over) return 'over';
    var st = this.stations[si];
    if (!st || !st.owned) return 'locked';
    if (st.ready > 0 && this.serveFrom(si)) return 'served';
    var free = st.slots - st.cooking.length - st.ready;
    if (free > 0) {
      var n = Math.max(1, Math.min(free, this.needs()[si]));
      for (var k = 0; k < n; k++) this.cook(si, 'chef');
      return 'cook';
    }
    if (st.ready > 0) { this.emit('nodemand', { st: st }); return 'nodemand'; }
    this.emit('busy', { st: st });
    return 'busy';
  };

  P.tapCustomer = function (seat) {
    if (this.over) return 0;
    var c = this.seats[seat];
    if (!c || c.state !== 'wait') return 0;
    var n = 0;
    for (var j = 0; j < c.items.length; j++) {
      var it = c.items[j];
      if (!it.done && this.stations[it.st].ready > 0) { if (this.serveFrom(it.st, c)) n++; if (c.state !== 'wait') break; }
    }
    return n;
  };

  P.useBooster = function (id) {
    if (this.over) return false;
    if (!this.save.boosters[id]) return false;
    var B = GDx.BOOSTERS[id];
    if (id === 'turbo') { if (this.boost.turbo > 0) return false; this.boost.turbo = B.dur; }
    else if (id === 'chance') { if (this.boost.chance > 0) return false; this.boost.chance = B.dur; }
    else if (id === 'coeur') {
      var any = false;
      for (var i = 0; i < this.customers.length; i++) { var c = this.customers[i]; if (c.state === 'wait' || c.state === 'in') { c.patience = c.maxPatience; any = true; } }
      if (!any && this.hearts >= this.maxHearts) return false;
      if (this.hearts < this.maxHearts) this.hearts++;
    } else if (id === 'temps') { this.timeLeft += 15; this.duration += 15; }
    this.save.boosters[id]--;
    this.emit('booster', { id: id });
    return true;
  };

  P.end = function (reason) {
    if (this.over) return;
    this.over = true; this.endReason = reason;
    var s = 0;
    for (var i = 0; i < 3; i++) if (this.earned >= this.thresholds[i]) s = i + 1;
    if (reason === 'hearts' && !this.relax) s = 0;
    this.stars = s; this.win = s > 0;
    this.emit('end', { win: this.win, stars: s });
  };

  P.goalProgress = function () { return Math.min(1, this.earned / this.thresholds[2]); };

  return Shift;
})();
if (typeof module !== 'undefined') module.exports.Shift = Shift;
