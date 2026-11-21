// ===================== SHIFT SIMULATION (no DOM) =====================
var Shift = (function () {
  var GDx = (typeof GD !== 'undefined') ? GD : require('./data.js').GD;
  var WALK_IN = 0.75, WALK_OUT = 0.8;

  function Shift(save, day, opts) {
    opts = opts || {};
    this.save = save;
    this.day = day;
    this.cfg = opts.cfg || GDx.dayConfig(day, save.mode);
    this.relax = this.cfg.relax;          // Détente: nobody leaves angry, ready dishes are served automatically
    // first-person "simulator" day: the player takes the orders, cooks every dish step by step with his
    // hands (GD.HANDS), carries it to the counter, fetches the ingredients and keeps the counter clean
    this.manual = !!opts.manual;
    this.challenge = !!opts.challenge;    // daily challenge: same kitchen and same customers for everybody
    this.loc = GDx.locById(save.loc || 'jungle');
    this.closing = false; this.closingT = 0;
    this.rng = opts.rng || Math.random;
    this.tutorial = !!opts.tutorial;
    this.tutoServed = false;
    var SIM = GDx.SIM, simPace = this.manual && !opts.cfg;
    this.duration = simPace ? Math.round(this.cfg.duration * SIM.duration) : this.cfg.duration;
    this.timeLeft = this.duration;
    this.t = 0;
    this.earned = 0; this.tips = 0; this.served = 0; this.lost = 0; this.xp = 0; this.vips = 0;
    this.dishes = [0, 0, 0, 0, 0, 0, 0, 0]; this.boostUsed = 0;      // counted for the missions of the day
    this.orders = 0; this.burnt = 0; this.wiped = 0; this.restocks = 0; this.posErr = 0;
    this.refunds = 0; this.refunded = 0;        // simulator: orders paid at the register and never served
    this.notes = [];                            // what each customer thought of the service, 1 to 5 (see rate)
    // simulator: the rush of the middle of the day (customers come faster for a moment)
    this.rush = 0; this.rushDone = false;
    this.rushAt = simPace && day >= SIM.rush.day ? this.duration * SIM.rush.at : -1;
    this.maxHearts = 5; this.hearts = 5;
    this.goal = this.cfg.goal;
    this.thresholds = this.cfg.stars;
    var self = this;
    this.stations = GDx.STATIONS.map(function (def, i) {
      var lvl = save.stations[def.id] || 0;
      var s = GDx.stationStats(def, lvl, save);
      var special = self.loc.special.indexOf(def.dish) >= 0;
      return { i: i, def: def, owned: lvl > 0, level: lvl, price: Math.round(s.price * (special ? GDx.SPECIAL_BONUS : 1)), special: special,
        time: s.time, slots: s.slots, cooking: [], ready: 0, by: null,
        hd: GDx.HANDS[def.id], stock: SIM.stock, stockMax: SIM.stock, held: 0 };
    });
    this.menu = this.stations.filter(function (s) { return s.owned; }).map(function (s) { return s.i; });
    // simulator: the drive. One car at a time stops at the window. Its driver is a customer like the
    // others (same states, same register, same refund) whose place number is seats.length.
    this.driveOn = simPace && day >= SIM.drive.day && !this.tutorial && !this.challenge;
    this.car = null; this.carT = SIM.drive.first; this.cars = 0;
    if (simPace) {
      // simulator: the goal is worked out from this kitchen. "potential" = what the day would bring if
      // every customer who can come was served quickly; the goal is a share of it.
      var cf = this.cfg, iv = Math.max(cf.spawn * SIM.spawn, SIM.spawnMin[this.relax ? 0 : 1]) * (1 - 0.1 * (save.decor.musique || 0));
      var items = cf.p1 + 2 * (1 - cf.p1 - cf.p3) + 3 * cf.p3, price = 0;
      this.menu.forEach(function (m) { price += self.stations[m].price; });
      price /= Math.max(1, this.menu.length);
      var secs = this.duration - 2 + (this.rushAt >= 0 ? SIM.rush.dur * (1 / SIM.rush.mul - 1) : 0);
      this.potential = secs / iv * items * price * 1.2 * (1 + cf.vip);
      var g0 = this.potential * SIM.goal * (this.relax ? 1 : SIM.goalClassic), mag = g0 < 200 ? 5 : g0 < 1000 ? 10 : 50;
      this.goal = Math.max(10, Math.round(g0 / mag) * mag);
      this.thresholds = [this.goal, Math.round(this.goal * SIM.stars[0] / mag) * mag, Math.round(this.goal * SIM.stars[1] / mag) * mag];
    }
    this.seats = []; var n = GDx.seatsFor(save); for (var k = 0; k < n; k++) this.seats.push(null);
    this.dirt = this.seats.map(function () { return false; });       // crumbs left on the counter (simulator)
    this.dirtT = this.seats.map(function () { return 0; });
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
    var maxP = (11 + 6 * k) * cfg.patience * (1 + 0.12 * plants) * (this.manual ? GDx.SIM.patience : 1);
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
      vip: vip, happy: false, pay: 0, dirty: this.manual && !!this.dirt[seat]
    };
    this.seats[seat] = c;
    this.customers.push(c);
    this.emit('arrive', { c: c });
    return true;
  };

  // simulator: a car drives up to the window of the drive
  P.spawnCar = function () {
    if (!this.menu.length) return false;
    var rng = this.rng, D = GDx.SIM.drive, k = rng() < D.p3 ? 3 : 2, items = [];
    for (var j = 0; j < k; j++) {
      var si = this.menu[Math.floor(rng() * this.menu.length)];
      items.push({ st: si, dish: this.stations[si].def.dish, done: false });
    }
    var present = {};
    for (var q = 0; q < this.customers.length; q++) present[this.customers[q].animal] = 1;
    var pool = GDx.CUSTOMERS.filter(function (x) { return !present[x]; });
    if (!pool.length) pool = GDx.CUSTOMERS;
    var maxP = (11 + 6 * k) * this.cfg.patience * (1 + 0.12 * (this.save.decor.plantes || 0)) * GDx.SIM.patience * D.patience;
    var c = {
      id: this.nextId++, animal: pool[Math.floor(rng() * pool.length)],
      seat: this.seats.length, drive: true, paint: Math.floor(rng() * 6),
      items: items, state: 'in', stateT: 0, patience: maxP, maxPatience: maxP,
      vip: false, happy: false, pay: 0, dirty: false
    };
    this.car = c; this.customers.push(c);
    this.emit('arrive', { c: c });
    return true;
  };

  P.update = function (dt) {
    if (this.over) return;
    var tutoHold = this.tutorial && !this.tutoServed;
    if (!tutoHold) { this.t += dt; this.timeLeft -= dt; }
    var i, c, st, SIM = GDx.SIM;
    // boosters
    if (this.boost.turbo > 0) this.boost.turbo = Math.max(0, this.boost.turbo - dt);
    if (this.boost.chance > 0) this.boost.chance = Math.max(0, this.boost.chance - dt);
    if (this.rushAt >= 0 && !this.rushDone) {
      if (this.rush > 0) { this.rush -= dt; if (this.rush <= 0) { this.rush = 0; this.rushDone = true; this.emit('rush', { on: false }); } }
      else if (this.t >= this.rushAt && this.timeLeft > SIM.rush.dur) { this.rush = SIM.rush.dur; this.spawnTimer = Math.min(this.spawnTimer, 1.5); this.emit('rush', { on: true }); }
    }
    // spawn
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.timeLeft > 2) {
      if (tutoHold && this.customers.length > 0) { this.spawnTimer = 0.5; }
      else if (this.spawn()) {
        var iv = this.cfg.spawn;
        if (this.manual) iv = Math.max(iv * SIM.spawn, SIM.spawnMin[this.relax ? 0 : 1]) * (this.rush > 0 ? SIM.rush.mul : 1);
        iv *= 1 - 0.1 * (this.save.decor.musique || 0);
        this.spawnTimer = iv * (0.7 + 0.6 * this.rng());
      } else this.spawnTimer = 0.3;
    }
    if (this.driveOn && !this.car && this.timeLeft > 8) { this.carT -= dt; if (this.carT <= 0) this.spawnCar(); }
    // cooking
    var speed = this.boost.turbo > 0 ? 2 : 1;
    for (i = 0; i < this.stations.length; i++) {
      st = this.stations[i];
      if (this.manual) { this.unitsTick(st, dt, speed); continue; }
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
        if (c.stateT >= (c.drive ? SIM.drive.inT : WALK_IN)) {
          c.stateT = 0;
          if (this.manual) {              // simulator: somebody has to come and take the order
            c.state = 'ask'; this.emit('ask', { c: c });
            if (c.dirty) this.emit('dirty', { c: c });
          } else { c.state = 'wait'; this.emit('order', { c: c }); }
        }
      } else if (c.state === 'wait' || c.state === 'ask') {
        // Who leaves without a fuss: a car nobody comes to see (nobody is forced to take its order), and,
        // once the door is closed, the cars and (Classique) the people who have not ordered yet.
        if (c.state === 'ask' && !c.busy && ((c.drive && (c.stateT >= SIM.drive.giveUp || this.closing)) || (this.closing && this.manual && !this.relax))) {
          c.state = 'out'; c.stateT = 0; c.happy = false; c.calm = true;      // (no review: he was not served at all)
          this.emit('giveup', { c: c, closed: this.closing });
          continue;
        }
        if (!tutoHold) c.patience -= dt * (c.state === 'ask' ? SIM.askDrain : 1);
        // a car honks when it has waited long: half-way before giving up, and when its patience runs low
        if (c.drive && !c.honked && (c.state === 'ask' ? c.stateT >= SIM.drive.giveUp / 2 && !c.busy : c.patience < c.maxPatience * SIM.drive.honk)) { c.honked = true; this.emit('honk', { c: c }); }
        if (c.patience <= 0 && this.relax) c.patience = 0;
        else if (c.patience <= 0) {
          c.patience = 0; c.state = 'out'; c.stateT = 0; c.happy = false;
          // (a heart is lost at the counter while the restaurant is open: not for a car of the drive,
          // which is a bonus, and not after the door closed, when the last orders are being finished)
          var heart = !c.drive && !this.closing;
          this.lost++; this.save.stats.lost++;
          if (heart) this.hearts--;
          this.rate(c, 1);
          this.emit('angry', { c: c, heart: heart });
          this.refund(c);
          if (this.hearts <= 0) { this.end('hearts'); return; }
        }
      } else if (c.state === 'out') {
        if (c.stateT >= (c.drive ? SIM.drive.outT : WALK_OUT)) {
          if (this.seats[c.seat] === c) this.seats[c.seat] = null;
          if (this.car === c) { this.car = null; this.carT = SIM.drive.gap[0] + (SIM.drive.gap[1] - SIM.drive.gap[0]) * this.rng(); }
          this.customers.splice(i, 1);
          this.emit('gone', { c: c });
        }
      }
    }
    // staff
    this.staffTick(dt);
    if (this.relax && !this.manual) this.autoServe();
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      if ((this.relax || this.manual) && !this.tutorial) {
        // "dernières commandes": the door closes, the chef finishes the orders already taken
        // (simulator: in both modes, so that those who paid can still be served)
        if (!this.closing) { this.closing = true; this.emit('closing', {}); }
        this.closingT += dt;
        var waiting = 0;
        for (i = 0; i < this.customers.length; i++) if (this.customers[i].state !== 'out') waiting++;
        if (!waiting || this.closingT > (this.manual ? SIM.close : 25)) this.end('time');
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
    var lv = this.save.staff, S = GDx.STAFF, SIM = GDx.SIM, i;
    if (this.manual) { this.staffHands(dt); return; }
    if (lv.serveur > 0 && !this.relax) {
      this.staffT.serveur -= dt;
      if (this.staffT.serveur <= 0) {
        var done = false;
        for (i = 0; i < this.stations.length && !done; i++) {
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
          if (!st.owned || !this.canCook(k)) continue;
          if (needs[k] > bestNeed) { bestNeed = needs[k]; best = k; }
        }
        if (best >= 0) { this.cook(best, 'commis'); this.staffT.commis = S.commis.interval[lv.commis - 1]; }
        else this.staffT.commis = 0.25;
      }
    }
  };
  // simulator: the helpers are two more pairs of hands. One gesture at a time, at their own pace
  // (the pace of their level), exactly the gestures the player does.
  P.staffHands = function (dt) {
    var lv = this.save.staff, S = GDx.STAFF, SIM = GDx.SIM, i, k, st, u, c;
    if (lv.serveur > 0) {
      this.staffT.serveur -= dt;
      if (this.staffT.serveur <= 0) {
        var did = false;
        for (i = 0; i < this.stations.length && !did; i++) if (this.stations[i].ready > 0 && this.serveFrom(i, null, 'serveur')) did = true;
        // he takes the orders nobody took and, from level 2, wipes the free places
        var wait = SIM.waiterAsk[lv.serveur - 1];
        for (i = 0; i < this.customers.length && !did; i++) { c = this.customers[i]; if (c.state === 'ask' && !c.busy && !c.drive && c.stateT >= wait) did = this.takeOrder(c, 'serveur'); }
        if (lv.serveur >= 2) for (i = 0; i < this.seats.length && !did; i++) if (this.dirt[i] && !this.seats[i]) did = this.wipe(i, 'serveur');
        this.staffT.serveur = did ? S.serveur.interval[lv.serveur - 1] * SIM.staffPace : 0.25;
      }
    }
    if (lv.commis > 0) {
      this.staffT.commis -= dt;
      if (this.staffT.commis <= 0) {
        var act = false;
        // what he started first: turn it, then finish it (it never burns: he keeps an eye on it)
        for (k = 0; k < this.stations.length && !act; k++) {
          st = this.stations[k];
          for (i = 0; i < st.cooking.length && !act; i++) { u = st.cooking[i]; if (u.by === 'commis' && u.ph === 'mid') act = this.midAct(k, 'commis', u); }
        }
        for (k = 0; k < this.stations.length && !act; k++) {
          st = this.stations[k];
          for (i = 0; i < st.cooking.length && !act; i++) { u = st.cooking[i]; if (u.by === 'commis' && (u.ph === 'done' || u.ph === 'fin')) act = this.finAct(k, 'commis', u); }
        }
        if (!act) {
          var best = -1, bestNeed = 0, needs = this.needs();
          for (k = 0; k < this.stations.length; k++) {
            if (!this.stations[k].owned || !this.canCook(k)) continue;
            if (needs[k] > bestNeed) { bestNeed = needs[k]; best = k; }
          }
          // an empty station is filled again first (he goes to the fridge himself)
          if (best >= 0) act = this.stations[best].stock <= 0 ? this.restock(best, 'commis') : this.cook(best, 'commis');
        }
        this.staffT.commis = act ? S.commis.interval[lv.commis - 1] * SIM.staffPace : 0.25;
      }
    }
  };

  // demand minus supply per station
  P.needs = function () {
    var self = this;
    var n = this.stations.map(function (s) {
      var sup = s.ready + (s.held || 0);
      if (self.manual) for (var q = 0; q < s.cooking.length; q++) sup += self.yieldLeft(s, s.cooking[q]);
      else sup += s.cooking.length;
      return -sup;
    });
    for (var i = 0; i < this.customers.length; i++) {
      var c = this.customers[i];
      if (c.state !== 'wait' && (this.manual || c.state !== 'in')) continue;     // simulator: only the orders taken
      for (var j = 0; j < c.items.length; j++) if (!c.items[j].done) n[c.items[j].st]++;
    }
    return n;
  };

  P.canCook = function (si) {
    var st = this.stations[si];
    if (!st || !st.owned) return false;
    if (this.manual) return st.cooking.length < st.slots && st.ready < GDx.SIM.pass;
    return st.cooking.length + st.ready < st.slots;
  };

  P.cook = function (si, by) {
    var st = this.stations[si];
    if (!this.canCook(si)) return false;
    if (this.manual) {
      if (st.stock <= 0) { this.emit('empty', { st: st }); return false; }
      st.stock--;
      var used = {}, slot = 0;              // each thing keeps its own place on the station (grate, tank...)
      st.cooking.forEach(function (q) { used[q.slot] = 1; });
      while (used[slot]) slot++;
      st.cooking.push({ t: 0, total: st.time * (st.hd.quick || 1), ph: 'cook', flip: false, w: 0, fin: 0, slot: slot, by: by || 'chef' });
    } else st.cooking.push({ t: 0, total: st.time });
    st.by = by || 'chef';
    this.emit('cook', { st: st, by: by || 'chef' });
    return true;
  };

  // =================== simulator: cooking by hand ===================
  // A "unit" is what is on the fire: one steak, one basket of fries, one pot of soup...
  //   ph: cook -> (mid: waits to be turned) -> cook -> done (cooked, still on the heat)
  //       -> fin (the finishing gestures have begun) -> gone;   burnt = forgotten on the heat
  P.unitsTick = function (st, dt, speed) {
    var hd = st.hd, SIM = GDx.SIM;
    for (var j = st.cooking.length - 1; j >= 0; j--) {
      var u = st.cooking[j];
      if (u.ph === 'cook') {
        u.t += dt * speed;
        if (hd.mid && !u.flip && u.t >= u.total * 0.5) { u.t = u.total * 0.5; u.ph = 'mid'; u.w = 0; this.emit('mid', { st: st, u: u }); }
        else if (u.t >= u.total) { u.t = u.total; u.ph = 'done'; u.w = 0; this.emit('cooked', { st: st, u: u }); }
      } else if (u.ph === 'mid' || u.ph === 'done') {
        u.w += dt;
        // (what the kitchen helper started never burns: he keeps an eye on it, see staffHands)
        if (u.by !== 'commis' && hd.burn && !this.relax && u.w > (u.ph === 'mid' ? SIM.burnMid : SIM.burnDone)) {
          u.ph = 'burnt'; u.w = 0; this.burnt++; this.emit('burnt', { st: st, u: u });
        }
      } else u.w += dt;                       // fin: off the heat.  burnt: stays until somebody throws it away
    }
  };
  P.unitIn = function (si, ph) {
    var cs = this.stations[si].cooking;
    for (var j = 0; j < cs.length; j++) if (cs[j].ph === ph) return cs[j];
    return null;
  };
  // dishes this unit will still put on the pass
  P.yieldLeft = function (st, u) {
    if (u.ph === 'burnt') return 0;
    var n = 0, f = st.hd.fin;
    for (var k = u.fin || 0; k < f.length; k++) if (f[k].charAt(0) === '+') n++;
    return n;
  };
  // the gesture in the middle of the cooking (turn the steak, toss the wok...)
  P.midAct = function (si, by, u) {
    var st = this.stations[si];
    u = u || this.unitIn(si, 'mid');
    if (this.over || !u || u.ph !== 'mid') return false;
    u.flip = true; u.ph = 'cook'; u.w = 0;
    this.emit('flip', { st: st, u: u, by: by || 'chef' });
    return true;
  };
  // the next finishing gesture of a cooked unit. Returns false when nothing can be done (pass full...)
  P.nextFin = function (si) { return this.unitIn(si, 'fin') || this.unitIn(si, 'done'); };
  P.finAct = function (si, by, u) {
    var st = this.stations[si];
    u = u || this.nextFin(si);
    if (this.over || !u || (u.ph !== 'done' && u.ph !== 'fin')) return false;
    var step = st.hd.fin[u.fin], plus = step.charAt(0) === '+';
    if (plus && st.ready >= GDx.SIM.pass) return false;
    u.ph = 'fin'; u.fin++; u.w = 0;
    this.emit('step', { st: st, u: u, step: u.fin - 1, by: by || 'chef' });
    if (plus) {
      st.ready++; this.emit('ready', { st: st });
      if (by !== 'commis') this.save.stats.hand = (this.save.stats.hand || 0) + 1;        // dishes cooked by hand (achievement)
    }
    if (u.fin >= st.hd.fin.length) { var k = st.cooking.indexOf(u); if (k >= 0) st.cooking.splice(k, 1); }
    return true;
  };
  P.trash = function (si, by) {
    var st = this.stations[si], u = this.unitIn(si, 'burnt');
    if (this.over || !u) return false;
    st.cooking.splice(st.cooking.indexOf(u), 1);
    this.emit('trash', { st: st, by: by || 'chef' });
    return true;
  };
  // a crate of ingredients from the fridge fills the station again
  P.restock = function (si, by) {
    var st = this.stations[si];
    if (this.over || !st || !st.owned || st.stock >= st.stockMax) return false;
    st.stock = st.stockMax; this.restocks++;
    this.emit('restock', { st: st, by: by || 'chef' });
    return true;
  };
  // what the order costs (the price on the register)
  P.orderTotal = function (c) {
    var base = 0;
    for (var i = 0; i < c.items.length; i++) base += this.stations[c.items[i].st].price;
    return Math.round(base * (c.vip ? 2 : 1));
  };
  // The order is typed on the register: the customer pays its price at once (the tip comes when he
  // is served). tipK: bonus or penalty on the tip (the right change was given back, or not).
  P.takeOrder = function (c, by, tipK) {
    if (this.over || !c || c.state !== 'ask') return false;
    c.state = 'wait'; c.stateT = 0; c.busy = false; this.orders++;
    if (tipK) c.tipK = tipK;
    if (by !== 'serveur') this.save.stats.orders = (this.save.stats.orders || 0) + 1;
    c.paid0 = this.orderTotal(c);
    this.earned += c.paid0; this.save.coins += c.paid0; this.save.stats.earned += c.paid0;
    this.emit('order', { c: c, by: by || 'player' });
    this.emit('prepay', { c: c, amount: c.paid0, by: by || 'player' });
    return true;
  };
  // What a customer thinks of the service, from 1 to 5 stars: the results of the day show the average
  // ("avis des clients"). Served quickly = 5; a wrong order typed, the wrong change, a dirty counter
  // or a long wait cost stars; leaving angry or unserved = 1.
  P.rate = function (c, n) {
    n = Math.max(1, Math.min(5, n));
    c.note = n; this.notes.push(n);
    var st = this.save.stats;
    st.rateN = (st.rateN || 0) + 1; st.rateSum = (st.rateSum || 0) + n;
  };
  P.rating = function () {
    if (!this.notes.length) return 0;
    for (var i = 0, s = 0; i < this.notes.length; i++) s += this.notes[i];
    return s / this.notes.length;
  };
  // simulator: a customer who paid at the register and leaves without his order gets his money back
  // (he leaves angry, or the day ends). So the money only counts once the order is served.
  P.refund = function (c) {
    if (!c || !c.paid0) return 0;
    var a = c.paid0; c.paid0 = 0;
    this.earned -= a; this.refunds++; this.refunded += a;
    this.save.coins = Math.max(0, this.save.coins - a);
    this.save.stats.earned = Math.max(0, this.save.stats.earned - a);
    this.emit('refund', { c: c, amount: a });
    return a;
  };
  // a wrong order was typed: the customer says it again, a little less patient
  P.posError = function (c) {
    if (this.over || !c || c.state !== 'ask') return;
    c.patience = Math.max(0, c.patience - c.maxPatience * GDx.SIM.posPenalty);
    this.posErr++; c.posErrs = (c.posErrs || 0) + 1;
    this.emit('poserr', { c: c });
  };
  P.wipe = function (seat, by) {
    if (this.over || !this.dirt[seat]) return false;
    this.dirt[seat] = false; this.dirtT[seat] = 0; this.wiped++;
    if (by !== 'serveur') this.save.stats.wipes = (this.save.stats.wipes || 0) + 1;
    var c = this.seats[seat];
    if (c) c.dirty = false;                   // wiped in front of the customer: no harm done
    this.emit('wipe', { seat: seat, by: by || 'player' });
    return true;
  };

  // the first-person view had to stop in the middle of a day (the 3D view failed): the day goes on
  // the manager's way. What is on the fire simply finishes cooking, the orders are known.
  P.toAuto = function () {
    if (!this.manual) return;
    var self = this;
    this.stations.forEach(function (st) {
      var keep = [];
      st.cooking.forEach(function (u) {
        if (u.ph === 'cook' || u.ph === 'mid') keep.push({ t: u.t, total: u.total });
        else if (u.ph !== 'burnt') st.ready += Math.max(1, self.yieldLeft(st, u));
      });
      st.cooking = keep; st.held = 0;
    });
    this.manual = false;
    // no drive in the manager view: the car drives away (paid back if it had paid)
    if (this.car) { var car = this.car, ci = this.customers.indexOf(car); this.refund(car); if (ci >= 0) this.customers.splice(ci, 1); this.car = null; this.emit('gone', { c: car }); }
    this.driveOn = false;
    for (var i = 0; i < this.customers.length; i++) { var c = this.customers[i]; if (c.state === 'ask') { c.state = 'wait'; c.stateT = 0; this.emit('order', { c: c }); } }
    for (i = 0; i < this.dirt.length; i++) this.dirt[i] = false;
    this.rushAt = -1; this.rush = 0;
  };

  P.serveFrom = function (si, onlyCust, by) {
    var st = this.stations[si];
    if (!st || st.ready <= 0) return false;
    var best = null, bestItem = null, bestR = Infinity;
    for (var i = 0; i < this.customers.length; i++) {
      var c = this.customers[i];
      if (c.state !== 'wait') continue;
      if (onlyCust && c !== onlyCust) continue;
      if (c.drive && by === 'serveur') continue;        // the waiter stays at the counter: the drive is the player's
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
    st.ready--; this.dishes[si]++;
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
    var tipMul = (c.drive ? GDx.SIM.drive.tip : 1) * (1 + 0.2 * (this.save.decor.lanternes || 0)) * (this.boost.chance > 0 ? 3 : 1) *
      (this.relax ? 1 + 0.1 * (this.save.staff.serveur || 0) : 1);   // Détente: the waiter brings bigger tips
    // simulator: the right order at the first try, the right change, a clean counter, served in good time
    var perfect = this.manual && !c.posErrs && (c.tipK || 1) >= 1 && pf >= 0.5 && !c.dirty;
    this.rate(c, (pf >= 0.4 ? 5 : pf >= 0.2 ? 4 : pf >= 0.05 ? 3 : 2) - Math.min(2, c.posErrs || 0) - ((c.tipK || 1) < 1 ? 1 : 0) - (c.dirty ? 1 : 0));
    var tip = base * 0.3 * pf * tipMul * (c.dirty ? 0.5 : 1) * (c.tipK || 1) * (perfect ? 1.1 : 1);   // a dirty counter: half the tip
    var mul = c.vip ? 2 : 1;
    var total = Math.round((base + tip) * mul);
    tip = Math.round(tip * mul);
    var pre = c.paid0 || 0, due = total - pre;   // simulator: the price was paid at the register, the tip comes now
    c.paid0 = 0;                                 // served: nothing to give back any more
    c.pay = total; c.tip = tip; c.happy = true;
    c.state = 'out'; c.stateT = 0;
    this.earned += due; this.tips += tip; this.served++;
    var xp = (3 + 2 * c.items.length) * mul;
    this.xp += xp;
    // (the daily challenge runs on a temporary save: nothing of it reaches the real one)
    this.save.coins += due;
    this.save.stats.served++; this.save.stats.earned += due;
    if (c.vip) { this.vips++; this.save.stats.vip = (this.save.stats.vip || 0) + 1; }
    // friendship: +1 per visit, +1 more when their favourite dish was on the order
    var who = GDx.PEOPLE[c.animal], fav = false, met = GDx.introduced(this.save, c.animal);
    if (who && who.fav) for (var f = 0; f < c.items.length; f++) if (c.items[f].dish === who.fav) fav = true;
    if (!this.save.friends) this.save.friends = {};
    var before = this.save.friends[c.animal] || 0, after = before + (met ? 1 + (fav ? 1 : 0) : 0);
    this.save.friends[c.animal] = after;
    this.emit('pay', { c: c, amount: due, tip: tip, xp: xp, fav: fav && met, prepaid: pre > 0, perfect: perfect });
    var lv = GDx.friendLevel(after);
    if (lv > GDx.friendLevel(before)) this.emit('friend', { c: c, who: c.animal, level: lv });
    // simulator: some customers leave crumbs behind them
    if (c.drive) { this.cars++; this.save.stats.cars = (this.save.stats.cars || 0) + 1; }
    if (this.manual && !c.drive && !this.dirt[c.seat] && this.rng() < GDx.SIM.dirt) { this.dirt[c.seat] = true; this.dirtT[c.seat] = 0; this.emit('crumbs', { seat: c.seat }); }
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

  // ---- first-person actions: take a ready dish from a station, hand a dish to a customer ----
  P.takeDish = function (si) {
    var st = this.stations[si];
    if (this.over || !st || !st.owned || st.ready <= 0) return null;
    st.ready--; st.held = (st.held || 0) + 1;      // held: on the player's tray, still counted as "on its way"
    this.emit('take', { st: st });
    return { st: si, dish: st.def.dish };
  };
  P.putBack = function (si) { var st = this.stations[si]; if (st) { st.ready++; st.held = Math.max(0, (st.held || 0) - 1); } };
  // true when the customer was waiting for this dish
  P.giveDish = function (c, si) {
    if (this.over || !c || c.state !== 'wait') return false;
    for (var j = 0; j < c.items.length; j++) {
      var it = c.items[j];
      if (!it.done && it.st === si) {
        it.done = true; this.dishes[si]++;
        this.stations[si].held = Math.max(0, (this.stations[si].held || 0) - 1);
        this.emit('serve', { st: this.stations[si], c: c, item: it, by: 'player' });
        if (this.tutorial) this.tutoServed = true;
        var all = true;
        for (var k = 0; k < c.items.length; k++) if (!c.items[k].done) { all = false; break; }
        if (all) this.pay(c);
        return true;
      }
    }
    return false;
  };
  P.wants = function (c, si) {
    if (!c || c.state !== 'wait') return false;
    for (var j = 0; j < c.items.length; j++) if (!c.items[j].done && c.items[j].st === si) return true;
    return false;
  };
  // how many dishes of this station the customers who ordered are still waiting for
  P.wanted = function (si) {
    var n = 0;
    for (var i = 0; i < this.customers.length; i++) {
      var c = this.customers[i];
      if (c.state !== 'wait') continue;
      for (var j = 0; j < c.items.length; j++) if (!c.items[j].done && c.items[j].st === si) n++;
    }
    return n;
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
      for (var i = 0; i < this.customers.length; i++) { var c = this.customers[i]; if (c.state === 'wait' || c.state === 'ask' || c.state === 'in') { c.patience = c.maxPatience; any = true; } }
      if (!any && this.hearts >= this.maxHearts) return false;
      if (this.hearts < this.maxHearts) this.hearts++;
    } else if (id === 'temps') { this.timeLeft += 15; this.duration += 15; }
    this.save.boosters[id]--; this.boostUsed++;
    this.emit('booster', { id: id });
    return true;
  };

  P.end = function (reason) {
    if (this.over) return;
    this.over = true; this.endReason = reason;
    for (var k = 0; k < this.customers.length; k++) {                                   // paid and not served
      if (this.customers[k].paid0 && this.customers[k].state !== 'out') this.rate(this.customers[k], 1);
      this.refund(this.customers[k]);
    }
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
