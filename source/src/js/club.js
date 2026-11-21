// ===================== CLUB DES CHEFS =====================
// Everything around the restaurant: the player's online profile and the world ranking, gift codes,
// the daily gift, the missions of the day, the daily challenge, statistics and prestige.
// The ranking lives on a small server (a Postgres database reached through a few locked-down
// functions). Nothing here is needed to play: without a connection the game simply says so.

// the player's real save (during the daily challenge App.save is a temporary kitchen, see Daily.defi)
function SV() { return App.real || App.save; }

// ---------------------------------------------------------------- dates & seeded random
var Daily = (function () {
  // one "day" for everybody: the date in Paris (also the day of the server)
  function day(t) {
    var d = t ? new Date(t) : new Date();
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
    catch (e) { return new Date(d.getTime() + 3600000).toISOString().slice(0, 10); }
  }
  function yesterday() { return day(Date.now() - 86400000); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function coinsFor(base) { var s = SV(); return Math.round(base * (1 + 0.15 * (s.level - 1)) / 10) * 10; }

  // ---------------- daily gift: a 7-day calendar, the streak restarts after a missed day ----------------
  var GIFTS = [
    { coins: 100 }, { turbo: 1 }, { coins: 250 }, { coeur: 1, temps: 1 }, { coins: 500 }, { chance: 1, turbo: 1 },
    { coins: 1200, turbo: 1, coeur: 1, temps: 1, chance: 1 }
  ];
  function giftState() {
    var s = SV(), g = s.gift || (s.gift = { day: '', streak: 0 }), today = day();
    var ready = g.day !== today;
    var streak = g.day === today ? g.streak : g.day === yesterday() ? g.streak + 1 : 1;     // streak after claiming today
    var idx = (streak - 1) % 7;
    return { ready: ready, idx: idx, streak: streak, gifts: GIFTS.map(function (x) { return scaled(x); }) };
  }
  function scaled(r) { var o = {}; for (var k in r) o[k] = k === 'coins' ? coinsFor(r[k]) : r[k]; return o; }
  function claimGift() {
    var st = giftState(), s = SV();
    if (!st.ready) return null;
    s.gift.day = day(); s.gift.streak = st.streak;
    var r = st.gifts[st.idx];
    give(r);
    Store.save(s);
    return r;
  }
  // apply a reward { coins, xp, turbo, coeur, temps, chance, gift } to the real save
  function give(r) {
    var s = SV(), ups = [];
    if (r.coins) s.coins += r.coins;
    ['turbo', 'coeur', 'temps', 'chance'].forEach(function (k) { if (r[k]) s.boosters[k] = (s.boosters[k] || 0) + r[k]; });
    if (r.gift === 'trophy') { s.flags.trophy = 1; if (window.View3D) View3D.refresh(); }
    if (r.xp) ups = Progress.addXp(s, r.xp);
    return ups;
  }
  function rewardText(r) {
    var p = [], coin = '<img class="coin" src="' + Art.coin() + '">';
    if (r.coins) p.push('<b>+' + Util.fmt(r.coins) + '</b> ' + coin);
    if (r.xp) p.push('<b>+' + r.xp + ' XP</b>');
    ['turbo', 'coeur', 'temps', 'chance'].forEach(function (k) { if (r[k]) p.push('<b>' + r[k] + ' × ' + GD.BOOSTERS[k].name + '</b>'); });
    if (r.gift === 'trophy') p.push('<b>Toque d’or</b> pour ton comptoir');
    return p.join(' &nbsp;•&nbsp; ');
  }

  // ---------------- missions of the day ----------------
  // stat: what is counted at the end of each day played (see onDayEnd)
  var QUESTS = [
    { id: 'serve', txt: 'Servir {n} clients', n: [12, 18, 26], w: 1 },
    { id: 'earn', txt: 'Gagner {n} pièces en cuisinant', n: [0.9, 1.5, 2.2], w: 1.1, goal: true },
    { id: 'tips', txt: 'Recevoir {n} pièces de pourboires', n: [0.15, 0.25, 0.35], w: 1, goal: true },
    { id: 'stars', txt: 'Récolter {n} étoiles en fin de journée', n: [3, 4, 6], w: 1 },
    { id: 'days', txt: 'Terminer {n} journées', n: [2, 3, 4], w: 1 },
    { id: 'three', txt: 'Finir une journée avec 3 étoiles', n: [1], w: 1.2 },
    { id: 'dish', txt: 'Servir {n} × {dish}', n: [5, 8, 12], w: 1 },
    { id: 'boost', txt: 'Utiliser {n} bonus pendant une journée', n: [1, 2], w: 0.9, need: function (s) { return s.level >= 2; } },
    { id: 'defi', txt: 'Jouer le défi du jour', n: [1], w: 1, need: function (s) { return !!s.seenTuto.basic; } },
    { id: 'sim', txt: 'Terminer une journée en mode Simulateur', n: [1], w: 1.3, need: function () { return !!(window.View3D && View3D.usable()); } },
    { id: 'vip', txt: 'Servir la critique gastronomique', n: [1], w: 1.3, need: function (s) { return s.unlocked >= 6; } }
  ];
  function questState() {
    var s = SV(), today = day();
    if (!s.quests || s.quests.day !== today || !s.quests.list || !s.quests.list.length) {
      var r = rng(hash(today + ':' + (s.profile && s.profile.pid || 'x'))), pool = QUESTS.filter(function (q) { return !q.need || q.need(s); }), list = [];
      var goal = GD.goalFor(Math.max(1, s.unlocked - 1), s.mode);
      var owned = GD.STATIONS.filter(function (d) { return (s.stations[d.id] || 0) > 0; });
      while (list.length < 3 && pool.length) {
        var q = pool.splice(Math.floor(r() * pool.length), 1)[0], lv = Math.min(q.n.length - 1, Math.floor(r() * q.n.length));
        var n = q.goal ? Math.max(20, Math.round(goal * q.n[lv] / 10) * 10) : q.n[lv], it = { id: q.id, goal: n, prog: 0, claimed: false, lv: lv };
        if (q.id === 'dish') { var d = owned[Math.floor(r() * owned.length)]; it.dish = GD.STATIONS.indexOf(d); }
        it.coins = coinsFor(70 * q.w * (1 + lv * 0.35));
        if (r() < 0.34) it.boost = GD.BOOSTER_ORDER[Math.floor(r() * 4)];
        list.push(it);
      }
      s.quests = { day: today, list: list, bonus: false };
    }
    return s.quests;
  }
  function questText(it) {
    var q = QUESTS.filter(function (x) { return x.id === it.id; })[0];
    return (q ? q.txt : it.id).replace('{n}', Util.fmt(it.goal)).replace('{dish}', it.dish != null ? GD.STATIONS[it.dish].dishName.toLowerCase() : '');
  }
  function addProg(id, n, dish) {
    var qs = questState(), ch = false;
    qs.list.forEach(function (it) {
      if (it.id !== id || it.claimed || (id === 'dish' && it.dish !== dish)) return;
      var before = it.prog; it.prog = Math.min(it.goal, it.prog + n); if (it.prog !== before) ch = true;
    });
    return ch;
  }
  // a normal day just ended (sh: the Shift, res: Progress.applyResult)
  function onDayEnd(sh, res) {
    var s = SV();
    s.stats.bestDay = Math.max(s.stats.bestDay || 0, Math.round(sh.earned));
    if (sh.manual) { s.stats.sim = (s.stats.sim || 0) + 1; s.stats.simH = (s.stats.simH || 0) + 1; }     // simH: days cooked by hand (2.1)
    addProg('serve', sh.served); addProg('earn', Math.round(sh.earned)); addProg('tips', Math.round(sh.tips));
    addProg('stars', sh.stars); addProg('days', 1);
    if (sh.stars >= 3) addProg('three', 1);
    if (sh.manual) addProg('sim', 1);
    if (sh.vips) addProg('vip', sh.vips);
    if (sh.boostUsed) addProg('boost', sh.boostUsed);
    (sh.dishes || []).forEach(function (n, i) { if (n) addProg('dish', n, i); });
  }
  function claimable() { var n = 0; questState().list.forEach(function (it) { if (!it.claimed && it.prog >= it.goal) n++; }); return n; }
  function claimQuest(i) {
    var qs = questState(), it = qs.list[i];
    if (!it || it.claimed || it.prog < it.goal) return null;
    it.claimed = true;
    var r = { coins: it.coins }; if (it.boost) r[it.boost] = 1;
    give(r);
    var all = qs.list.every(function (x) { return x.claimed; }), bonus = null;
    if (all && !qs.bonus) { qs.bonus = true; bonus = { coins: coinsFor(180), chance: 1 }; give(bonus); }
    Store.save(SV());
    return { r: r, bonus: bonus };
  }

  // ---------------- daily challenge: the same kitchen and the same customers for every chef ----------------
  var MODS = [
    { id: 'normal', name: 'Service classique', desc: 'Une journée normale, sans surprise.' },
    { id: 'rush', name: 'Heure de pointe', desc: 'Les clients arrivent beaucoup plus vite.', spawn: 0.72 },
    { id: 'presses', name: 'Clients pressés', desc: 'Les clients ont moins de patience.', patience: 0.78 },
    { id: 'gourmands', name: 'Grosses faims', desc: 'Les commandes sont plus grosses.', p1: 0.2, p3: 0.34 },
    { id: 'vip', name: 'Soirée de gala', desc: 'La critique gastronomique passe souvent (paie double).', vip: 0.22 },
    { id: 'court', name: 'Service éclair', desc: 'La journée est courte mais tout va plus vite.', duration: 55, spawn: 0.8 }
  ];
  function defiInfo(d) {
    d = d || day();
    var r = rng(hash('defi:' + d)), ids = GD.STATIONS.map(function (s) { return s.id; });
    var keep = ['grill'], rest = ids.slice(1), n = 4 + Math.floor(r() * 3);
    while (keep.length < n) keep.push(rest.splice(Math.floor(r() * rest.length), 1)[0]);
    var stations = {};
    ids.forEach(function (id) { stations[id] = keep.indexOf(id) >= 0 ? 2 + Math.floor(r() * 4) : 0; });
    var mod = MODS[Math.floor(r() * MODS.length)];
    var avg = 0; keep.forEach(function (id) { avg += GD.stationStats(GD.stationById(id), stations[id], null).price; }); avg /= keep.length;
    var goal = Math.round(avg * 13 / 10) * 10;
    var cfg = { day: 0, relax: false, duration: mod.duration || 75, spawn: 2.2 * (mod.spawn || 1), patience: 1.15 * (mod.patience || 1),
      p1: mod.p1 || 0.48, p3: mod.p3 || 0.12, vip: mod.vip || 0.06, goal: goal, stars: [goal, Math.round(goal * 1.4 / 5) * 5, Math.round(goal * 1.9 / 5) * 5] };
    return { day: d, stations: stations, list: keep, mod: mod, cfg: cfg, seed: hash('run:' + d) };
  }
  // the temporary save used during the challenge: it inherits the real one (settings, name...) but owns
  // its kitchen, its coins and its counters. Store.save never writes it (see Store.save).
  function defiSave(info) {
    var real = SV(), s = Object.create(real);
    s.stations = info.stations; s.staff = { serveur: 0, commis: 0 };
    s.decor = { plantes: 1, tabourets: 1, lanternes: 1, musique: 0, enseigne: 0 };
    s.boosters = { turbo: 1, coeur: 1, temps: 0, chance: 1 };
    s.business = { stand: 0, truck: 0, kiosque: 0, franchise: 0 };
    s.coins = 0; s.stats = { served: 0, earned: 0, lost: 0, days: 0, vip: 0, ota: 0 };
    s.friends = {}; s.flags = {}; s.loc = 'jungle'; s.mode = 'classique'; s.prestige = 0; s.days = {};
    s.__defi = true;
    return s;
  }
  function defiState() {
    var s = SV(), today = day();
    if (!s.defi || s.defi.day !== today) s.defi = { day: today, best: 0, tries: 0, paid: false };
    return s.defi;
  }
  // the challenge just ended: keep the best score of the day, pay the reward of the first try
  function onDefiEnd(sh) {
    var st = defiState(), score = Math.round(sh.earned), s = SV();
    st.tries++;
    var isBest = score > st.best; if (isBest) st.best = score;
    var reward = null;
    if (!st.paid) { st.paid = true; reward = { coins: coinsFor(120) + Math.round(score * 0.25 / 10) * 10 }; give(reward); }
    s.stats.defis = (s.stats.defis || 0) + 1;
    addProg('defi', 1);
    Store.save(s);
    return { score: score, best: st.best, isBest: isBest, reward: reward, tries: st.tries };
  }

  // ---------------- prestige: start again with a golden toque (+25 % on every dish, for ever) ----------------
  var PRESTIGE_DAY = 25;      // the end of Season 1
  function canPrestige() { return SV().unlocked >= PRESTIGE_DAY; }
  function doPrestige() {
    var s = SV();
    if (!canPrestige()) return false;
    // what is given up is kept: "Annuler" brings it back
    s.prestigeBackup = { coins: s.coins, stations: s.stations, staff: s.staff, decor: s.decor, business: s.business, days: s.days, unlocked: s.unlocked, loc: s.loc, at: Date.now() };
    var fresh = GD.newSave();
    s.stats.starsAll = Math.max(s.stats.starsAll || 0, GD.achValue(s, 'stars'));      // the stars already won stay counted
    s.coins = 0; s.stations = fresh.stations; s.staff = fresh.staff; s.decor = fresh.decor; s.business = fresh.business;
    s.days = {}; s.unlocked = 1; s.loc = 'jungle';
    s.prestige = (s.prestige || 0) + 1;
    Store.save(s);
    return true;
  }
  function undoPrestige() {
    var s = SV(), b = s.prestigeBackup;
    if (!b || !(s.prestige > 0)) return false;
    s.coins = b.coins; s.stations = b.stations; s.staff = b.staff; s.decor = b.decor; s.business = b.business; s.days = b.days; s.unlocked = b.unlocked; s.loc = b.loc;
    s.prestige--; s.prestigeBackup = null;
    Store.save(s);
    return true;
  }

  // how many things wait for the player in the club (badge on the button)
  function waiting() {
    var s = SV();
    if (!s || !s.seenTuto.basic) return 0;
    return (giftState().ready ? 1 : 0) + claimable();
  }

  return { day: day, hash: hash, rng: rng, giftState: giftState, claimGift: claimGift, give: give, rewardText: rewardText,
    questState: questState, questText: questText, claimQuest: claimQuest, claimable: claimable, onDayEnd: onDayEnd, addProg: addProg,
    defiInfo: defiInfo, defiSave: defiSave, defiState: defiState, onDefiEnd: onDefiEnd, MODS: MODS,
    canPrestige: canPrestige, doPrestige: doPrestige, undoPrestige: undoPrestige, PRESTIGE_DAY: PRESTIGE_DAY, waiting: waiting, coinsFor: coinsFor };
})();

// ---------------------------------------------------------------- server: profile, ranking, online codes
var Online = (function () {
  var URL = 'https://c--5e3a385a-dde0-452a-8790-a077bbf0dc8a-prod.lovable.cloud';
  var KEY = 'sb_publishable_H5FTN-AWSQ5B4Cstubr-eA_0FnmbFo5';      // public key: it only gives access to the functions below
  var lastSubmit = 0, sending = false;

  function hex(n) {
    var a = new Uint8Array(n), s = '';
    try { (window.crypto || window.msCrypto).getRandomValues(a); } catch (e) { for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); }
    for (var k = 0; k < n; k++) s += (a[k] < 16 ? '0' : '') + a[k].toString(16);
    return s;
  }
  function uuid() { var h = hex(16); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + '89ab'.charAt(parseInt(h.charAt(16), 16) & 3) + h.slice(17, 20) + '-' + h.slice(20, 32); }
  // the profile: a pseudo chosen by the player, and a random identity made on this device (no account, no e-mail)
  function profile() {
    var s = SV();
    if (!s.profile) s.profile = { name: '', pid: '', secret: '', on: false };
    var p = s.profile;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p.pid || '') || (p.secret || '').length < 32) { p.pid = uuid(); p.secret = hex(24); }
    return p;
  }
  function rpc(fn, body, cb) {
    var done = false, to = setTimeout(function () { finish('timeout'); }, 12000);
    function finish(err, data) { if (done) return; done = true; clearTimeout(to); try { cb(err, data); } catch (e) { console.error(e); } }
    try {
      var x = new XMLHttpRequest();
      x.open('POST', URL + '/rest/v1/rpc/' + fn, true);
      x.setRequestHeader('apikey', KEY);
      x.setRequestHeader('Content-Type', 'application/json');
      x.onload = function () {
        var j = null; try { j = JSON.parse(x.responseText); } catch (e) { }
        if (x.status >= 200 && x.status < 300 && j) finish(null, j); else finish('http' + x.status, j);
      };
      x.onerror = function () { finish('network'); };
      x.send(JSON.stringify(body));
    } catch (e) { finish('network'); }
  }
  function stars() { var s = SV(); return Math.max(s.stats.starsAll || 0, GD.achValue(s, 'stars')); }
  function payload() {
    var s = SV(), p = profile(), st = s.stats, d = s.defi || {};
    return { p_pid: p.pid, p_secret: p.secret, p_name: p.name, p_resto: s.name || '', p_platform: Platform.kind, p_ver: APP_BUILD,
      p_level: s.level, p_prestige: s.prestige || 0, p_fortune: Math.floor(st.earned || 0), p_stars: stars(), p_best_day: Math.floor(st.bestDay || 0), p_days: st.days || 0,
      p_daily_date: d.best > 0 ? d.day : null, p_daily_score: d.best > 0 ? Math.floor(d.best) : 0 };
  }
  function enabled() { var p = SV() && SV().profile; return !!(p && p.on && p.name); }
  // send the scores (quietly). force: right now, even if something was sent a moment ago
  function submit(cb, force) {
    cb = cb || function () { };
    if (!enabled()) { cb('off'); return; }
    var now = Date.now();
    if (sending || (!force && now - lastSubmit < 60000)) { cb('wait'); return; }
    sending = true; lastSubmit = now;
    rpc('lb_submit', payload(), function (err, j) {
      sending = false;
      if (!err && j && j.ok) {
        var p = profile();
        if (j.name && j.name !== p.name) { p.name = j.name; Store.save(SV()); }      // the server may have cleaned the pseudo
        cb(null, j);
      } else cb((j && j.err) || err || 'error', j);
    });
  }
  function top(board, cb) { rpc('lb_top', { p_board: board, p_limit: 50, p_pid: profile().pid }, cb); }
  function redeem(code, cb) { rpc('lb_redeem', { p_pid: profile().pid, p_code: code }, cb); }
  return { profile: profile, submit: submit, top: top, redeem: redeem, enabled: enabled, stars: stars };
})();

// ---------------------------------------------------------------- gift codes
var Codes = (function () {
  // codes that work without a connection (kept as fingerprints, not as text). Others are asked to the server.
  var LOCAL = {
    'a9ff17b6': { coins: 500, turbo: 1, coeur: 1, msg: 'Bienvenue dans la cuisine, Chef !' },
    '0a7262e3': { coins: 1000, msg: 'Merci de jouer à la version 2 !' },
    '4e072012': { turbo: 2, coeur: 2, temps: 2, chance: 2, msg: 'De quoi briller en mode Simulateur !' },
    '3558691b': { coins: 300, xp: 100, msg: 'Merci à toi !' },
    '0a2e59af': { coins: 2000, chance: 2, msg: 'Le code du créateur du jeu !' }
  };
  function norm(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24); }
  function fp(code) { return ('0000000' + Daily.hash('ct2:' + code + ':' + code.length).toString(16)).slice(-8); }
  function used(code) { var s = SV(); return !!(s.codes && s.codes[code]); }
  function mark(code) { var s = SV(); if (!s.codes) s.codes = {}; s.codes[code] = Daily.day(); }
  // cb(err, reward, message)   err: 'empty' | 'used' | 'unknown' | 'expired' | 'full' | 'offline'
  function redeem(raw, cb) {
    var code = norm(raw);
    if (code.length < 3) { cb('empty'); return; }
    if (used(code)) { cb('used'); return; }
    var loc = LOCAL[fp(code)];
    if (loc) { mark(code); var ups = Daily.give(loc); Store.save(SV()); cb(null, loc, loc.msg, ups); return; }
    Online.redeem(code, function (err, j) {
      if (!err && j && j.ok) { mark(code); var u = Daily.give(j); Store.save(SV()); cb(null, j, j.message || '', u); }
      else if (j && j.err) { if (j.err === 'used') mark(code); cb(j.err === 'invalid' ? 'unknown' : j.err); }
      else cb('offline');
    });
  }
  return { redeem: redeem, norm: norm, fp: fp, _set: function (m) { LOCAL = m; } };
})();

// ---------------------------------------------------------------- screens
var Club = (function () {
  var el, pos, px = function (v) { return Math.round(v) + 'px'; };
  var COIN = function () { return '<img class="coin" src="' + Art.coin() + '">'; };
  function ic(id) { return 'url("' + Art.icon(id) + '")'; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function afterChange() { Scene.refreshHud(); Scene.refreshStations(); if (window.UI) UI.refreshTitle(); }

  // ---------------- the menu ----------------
  function open() {
    el = UI.el; pos = UI.pos;
    var s = SV();
    if (!s.seenTuto.basic) { UI.toast('Termine ta première journée pour entrer au Club des chefs !'); return; }
    var md = UI.modal(1060, { tapOutside: true });
    var I = md.inner;
    function render() {
      I.innerHTML = '';
      UI.board(I, 30, 80, 660, 950);
      UI.leaf(I, 4, 'CLUB DES CHEFS', true);
      UI.closeBtn(I, 628, 64, function () { md.close(); });
      var g = Daily.giftState(), q = Daily.claimable(), d = Daily.defiState(), p = Online.profile();
      var tiles = [
        ['trophy', 'CLASSEMENT', 'Les meilleurs chefs du monde', function () { leaderboard(); }, 0],
        ['target', 'DÉFI DU JOUR', d.best ? 'Ton record : ' + Util.fmt(d.best) : 'Même cuisine pour tous !', function () { md.close(); defi(); }, d.tries ? 0 : '!'],
        ['list', 'MISSIONS', q ? q + ' récompense' + (q > 1 ? 's' : '') + ' à prendre' : 'Trois missions par jour', function () { quests(render); }, q],
        ['gift', 'CADEAU DU JOUR', g.ready ? 'Ton cadeau t’attend !' : 'Reviens demain (série : ' + SV().gift.streak + ')', function () { gift(render); }, g.ready ? '!' : 0],
        ['ticket', 'CODES', 'Entre un code cadeau', function () { codes(render); }, 0],
        ['chart', 'STATISTIQUES', 'Toute ta carrière en chiffres', function () { stats(); }, 0],
        ['toque', 'PRESTIGE', (s.prestige || 0) > 0 ? s.prestige + ' toque' + (s.prestige > 1 ? 's' : '') + ' d’or' : 'Recommence… en mieux', function () { prestige(render); }, 0],
        ['chef', 'MON PROFIL', p.on && p.name ? esc(p.name) : 'Choisis ton pseudo', function () { profile(render); }, 0]
      ];
      tiles.forEach(function (t, i) {
        var c = el('div', 'club-tile tap', I);
        pos(c, 62 + (i % 2) * 304, 188 + Math.floor(i / 2) * 198, 292, 184);
        el('i', '', c).style.backgroundImage = ic(t[0]);
        el('b', '', c, t[1]); el('span', '', c, t[2]);
        if (t[4]) el('div', 'badge', c, t[4]);
        UI.onTap(c, t[3]);
      });
    }
    render();
    md.rec.refresh = render;
    return md;
  }

  // ---------------- a small keyboard drawn by the game (codes, pseudo): the same on every device ----------------
  // opts: { title, value, max, min, hint, space }    onOk(text, api) -> api.error(msg) / api.close()
  function keyboard(opts, onOk) {
    el = UI.el; pos = UI.pos;
    var val = String(opts.value || '').toUpperCase(), max = opts.max || 16, busy = false;
    var md = UI.modal(900, { onBack: function () { finish(); } });
    var I = md.inner;
    UI.board(I, 20, 80, 680, 790, 'b-a');
    UI.leaf(I, 4, opts.title, opts.title.length > 9);
    UI.closeBtn(I, 628, 64, function () { finish(); });
    var hint = UI.txt(I, 70, 186, 580, opts.hint || '', 'ptxt ctxt', 22); hint.style.color = '#fff6dc';
    var field = el('div', 'kb-field', I); pos(field, 70, 262, 580, 86);
    var msg = UI.txt(I, 70, 354, 580, '', 'ptxt lg', 23); msg.style.color = '#ffd0c0';
    var rows = ['1234567890', 'AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'], y = 400;
    rows.forEach(function (r, ri) {
      var n = r.length, w = 58, gap = 6, x0 = (720 - (n * w + (n - 1) * gap + (ri === 3 ? (opts.space ? 2 : 1) * (w * 1.6 + gap) : 0))) / 2;
      r.split('').forEach(function (ch, k) { key(ch, x0 + k * (w + gap), y, w, function () { type(ch); }); });
      if (ri === 3) {
        var x = x0 + n * (w + gap);
        if (opts.space) { key('␣', x, y, w * 1.6, function () { type(' '); }); x += w * 1.6 + gap; }
        key('⌫', x, y, w * 1.6, function () { val = val.slice(0, -1); draw(); }, 'del');
      }
      y += 74;
    });
    var ok = UI.pill(I, 215, 730, 290, 92, opts.ok || 'VALIDER', function () { submit(); });
    function key(label, x, yy, w, fn, cls) {
      var k = el('div', 'kb-key tap' + (cls ? ' ' + cls : ''), I, label);
      pos(k, x, yy, w, 64);
      k.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); if (busy) return; Sfx.play('click'); fn(); });
    }
    function type(ch) {
      if (val.length >= max) return;
      if (ch === ' ' && (!val.length || val.charAt(val.length - 1) === ' ')) return;
      val += ch; draw();
    }
    function draw() {
      field.innerHTML = (val ? esc(val).replace(/ /g, '&nbsp;') : '<em>' + (opts.placeholder || '') + '</em>') + '<i></i>';
      msg.innerHTML = '';
      ok.classList.toggle('dis', val.replace(/ /g, '').length < (opts.min || 1));
    }
    function submit() {
      if (busy) return;
      var t = val.replace(/\s+/g, ' ').replace(/^ | $/g, '');
      if (t.replace(/ /g, '').length < (opts.min || 1)) { Sfx.play('nope'); return; }
      onOk(t, api);
    }
    function finish() { document.removeEventListener('keydown', onKey, true); md.close(); if (opts.onClose) opts.onClose(); }
    // a real keyboard works too
    function onKey(e) {
      var k = e.key || '';
      if (k === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); }
      else if (k === 'Backspace') { e.preventDefault(); e.stopPropagation(); if (!busy) { val = val.slice(0, -1); draw(); } }
      else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var ch = k.toUpperCase().normalize ? k.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() : k.toUpperCase();
        if (/^[A-Z0-9]$/.test(ch) || (ch === ' ' && opts.space)) { e.preventDefault(); e.stopPropagation(); if (!busy) type(ch); }
        else { e.stopPropagation(); }
      } else e.stopPropagation();
    }
    document.addEventListener('keydown', onKey, true);
    md.rec.onClose = function () { document.removeEventListener('keydown', onKey, true); };
    var api = {
      error: function (t) { busy = false; ok.classList.remove('dis'); msg.style.color = '#ffd0c0'; msg.innerHTML = t; Sfx.play('nope'); },
      info: function (t) { msg.style.color = '#d8ffb0'; msg.innerHTML = t; },
      wait: function (t) { busy = true; ok.classList.add('dis'); msg.style.color = '#fff6dc'; msg.innerHTML = t; },
      close: function () { finish(); }, clear: function () { busy = false; val = ''; draw(); }
    };
    draw();
    return api;
  }

  // ---------------- gift codes ----------------
  function codes(after) {
    keyboard({ title: 'CODE CADEAU', hint: 'Tape ton code puis valide.', max: 20, min: 3, placeholder: 'TON CODE', ok: 'VALIDER', onClose: after }, function (text, kb) {
      kb.wait('Vérification…');
      Codes.redeem(text, function (err, r, message, ups) {
        if (err) {
          kb.error({ used: 'Tu as déjà utilisé ce code.', unknown: 'Ce code n’existe pas.', expired: 'Ce code n’est plus valable.', full: 'Ce code a déjà été utilisé par trop de chefs.',
            offline: 'Impossible de vérifier ce code : pas de connexion.', empty: 'Code trop court.' }[err] || 'Ce code ne marche pas.');
          return;
        }
        kb.close();
        afterChange();
        UI.reward('CODE VALIDÉ !', (message ? esc(message) + '<br>' : '') + Daily.rewardText(r), 'star', function () { UI.chainLevelUps(ups || [], function () { afterChange(); if (after) after(); }); });
      });
    });
  }

  // ---------------- profile ----------------
  function profile(after) {
    el = UI.el; pos = UI.pos;
    var p = Online.profile();
    var md = UI.modal(860, { tapOutside: true });
    var I = md.inner;
    function render() {
      I.innerHTML = '';
      UI.board(I, 50, 80, 620, 750);
      UI.leaf(I, 4, 'MON PROFIL', true);
      UI.closeBtn(I, 610, 64, function () { md.close(); if (after) after(); });
      UI.paper(I, 90, 186, 540, 400, 'p-a');
      var face = el('div', '', I); pos(face, 116, 214, 120, 120); face.style.cssText += ';position:absolute;background:' + ic('chef') + ' center/contain no-repeat';
      var t = UI.txt(I, 246, 216, 356, '<span style="font-size:20px">Pseudo</span><br><b class="lg" style="font-size:36px;color:#6b3a14">' + (p.name ? esc(p.name) : '—') + '</b><br><span style="font-size:19px">Restaurant : <b>' + esc(SV().name || '') + '</b></span>', 'ptxt', 22);
      t.style.textAlign = 'left';
      var info = UI.txt(I, 122, 352, 476, 'Ton <b>pseudo</b>, le nom de ton restaurant et tes scores sont visibles par tous les joueurs dans le classement. ' +
        '<b>N’utilise pas ton vrai nom.</b> Aucun compte, aucune adresse e-mail.', 'ptxt', 19);
      info.style.textAlign = 'left'; info.style.lineHeight = '1.25';
      var row = el('div', 'srow', I); pos(row, 122, 484, 476);
      el('div', 'lab', row, 'Dans le classement').style.fontSize = '24px';
      var tg = pos(el('div', 'tog', row), 300, 8);
      tg.style.backgroundImage = 'var(--a-' + (p.on && p.name ? 'tog_on' : 'tog_off') + ')';
      UI.onTap(tg, function () {
        if (!p.name) { edit(true); return; }
        p.on = !p.on; Store.save(SV()); render();
        if (p.on) Online.submit(function (err) { if (err && err !== 'wait') UI.toast('Classement injoignable pour l’instant'); else UI.toast('Te voilà dans le classement !'); }, true);
        else UI.toast('Tes scores ne sont plus envoyés');
      });
      UI.pill(I, 110, 624, 240, 88, 'PSEUDO', function () { edit(false); }).style.fontSize = '26px';
      UI.pill(I, 370, 624, 240, 88, 'RESTAURANT', function () { rename(); }).style.fontSize = '24px';
      UI.txt(I, 100, 730, 520, 'Désactivé : rien n’est envoyé. Tu peux changer d’avis à tout moment.', 'ptxt ctxt', 19).style.color = '#fff6dc';
    }
    function edit(thenOn) {
      keyboard({ title: 'TON PSEUDO', hint: '2 à 12 lettres ou chiffres. Pas ton vrai nom !', value: p.name, max: 12, min: 2, space: true, placeholder: 'PSEUDO' }, function (text, kb) {
        p.name = text;
        if (thenOn) p.on = true;
        Store.save(SV());
        kb.close(); render();
        if (p.on) Online.submit(function (err) { render(); if (!err) UI.toast('Profil enregistré !'); else if (err !== 'wait') UI.toast('Profil gardé. Classement injoignable pour l’instant.'); }, true);
      });
    }
    function rename() {
      keyboard({ title: 'RESTAURANT', hint: 'Le nom écrit sur ton enseigne.', value: (SV().name || '').toUpperCase(), max: 18, min: 2, space: true, placeholder: 'NOM' }, function (text, kb) {
        // "CHEZ LÉA" typed in capitals is stored with nicer capitals
        SV().name = text.toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); });
        Store.save(SV());
        if (window.View3D) View3D.refresh();
        Scene.refreshDecor(); afterChange();
        kb.close(); render();
        Online.submit(null, true);
      });
    }
    render();
    return md;
  }

  // ---------------- world ranking ----------------
  var BOARDS = [['fortune', 'FORTUNE', 'pièces gagnées depuis le début'], ['etoiles', 'ÉTOILES', 'étoiles gagnées'], ['record', 'RECORD', 'meilleure journée'], ['defi', 'DÉFI', 'défi du jour']];
  var lbTab = 'fortune';
  function leaderboard(tab) {
    el = UI.el; pos = UI.pos;
    if (tab) lbTab = tab;
    var wide = App.wide, w = wide ? 1000 : 720, H = wide ? 1080 : Math.min(App.H - 40, 1240);
    var md = UI.modal(H, { w: w });
    var I = md.inner, token = 0;
    UI.board(I, 20, 64, w - 40, H - 70);
    UI.leaf(I, -6, 'CLASSEMENT', false, w);
    UI.closeBtn(I, w - 102, 50, function () { md.close(); });
    var tabs = el('div', 'tabs', I); pos(tabs, 46, 168); tabs.style.width = px(w - 92); tabs.style.justifyContent = 'center'; tabs.style.gap = wide ? '14px' : '6px';
    var sub = UI.txt(I, 46, 238, w - 92, '', 'ptxt ctxt', 20); sub.style.color = '#fff6dc';
    UI.paper(I, 46, 272, w - 92, H - 70 - 236 - 96);
    var list = pos(el('div', 'list lb-list', I), 78, 302, w - 156, H - 70 - 236 - 96 - 62);
    var foot = el('div', 'lb-foot', I); pos(foot, 46, H - 124, w - 92, 96);
    function renderTabs() {
      tabs.innerHTML = '';
      BOARDS.forEach(function (b) {
        UI.onTap(el('div', 'tab' + (b[0] === lbTab ? ' on' : ''), tabs, b[1]), function () { lbTab = b[0]; load(); });
      });
      var cur = BOARDS.filter(function (b) { return b[0] === lbTab; })[0];
      sub.innerHTML = 'Classé par : ' + cur[2];
    }
    function state(html) { list.innerHTML = '<div class="lb-state ptxt">' + html + '</div>'; }
    function footer(j) {
      foot.innerHTML = '';
      var p = Online.profile();
      if (!Online.enabled()) {
        el('span', '', foot, 'Tu n’es pas encore dans le classement.');
        UI.pill(foot, w - 92 - 250, 8, 240, 78, 'PARTICIPER', function () { profile(function () { load(); }); }).style.fontSize = '24px';
      } else if (j && j.me) {
        el('span', '', foot, '<b>' + esc(p.name) + '</b> : rang <b>' + j.me.rank + '</b> sur ' + j.total + ' • ' + Util.fmt(j.me.value) + (lbTab === 'etoiles' ? ' ★' : ' pièces'));
      } else if (j) {
        el('span', '', foot, lbTab === 'defi' ? 'Joue le défi du jour pour entrer dans ce classement.' : j.total + ' chef' + (j.total > 1 ? 's' : '') + ' classé' + (j.total > 1 ? 's' : '') + '.');
        if (lbTab === 'defi') UI.pill(foot, w - 92 - 250, 8, 240, 78, 'LE DÉFI', function () { md.close(); defi(); }).style.fontSize = '24px';
      }
    }
    function show(j) {
      list.innerHTML = '';
      if (j.news) el('div', 'lb-news', list, esc(j.news));
      if (!j.rows || !j.rows.length) { state('Personne pour l’instant…<br><b>Sois le premier !</b>'); if (j.news) list.insertBefore(el('div', 'lb-news', null, esc(j.news)), list.firstChild); footer(j); return; }
      j.rows.forEach(function (r) {
        var row = el('div', 'lb-row' + (r.me ? ' me' : '') + (r.rank <= 3 ? ' top' + r.rank : ''), list);
        el('i', '', row, r.rank);
        el('b', '', row, esc(r.name) + (r.prestige > 0 ? ' <u>★' + r.prestige + '</u>' : ''));
        el('span', '', row, (r.resto ? esc(r.resto) + ' • ' : '') + 'niv. ' + r.level);
        el('em', '', row, Util.fmt(r.value) + (lbTab === 'etoiles' ? ' ★' : ' ' + COIN()));
      });
      footer(j);
    }
    function load() {
      var my = ++token;
      renderTabs();
      state('Le classement se charge…');
      foot.innerHTML = '';
      // send my own scores first so that the list is up to date, then read the board
      Online.submit(function () {
        Online.top(lbTab, function (err, j) {
          if (my !== token || !list.isConnected) return;
          if (err || !j || !j.rows) {
            state('Classement indisponible pour le moment.<br><span style="font-size:20px">Il faut une connexion internet (il ne marche pas dans l’aperçu Claude).</span>');
            var b = UI.pill(list, 0, 0, 250, 80, 'RÉESSAYER', function () { load(); }); b.style.cssText += ';position:relative;margin:18px auto 0;font-size:24px';
            footer(null);
            return;
          }
          show(j);
        });
      }, false);
    }
    load();
    return md;
  }

  // ---------------- daily gift ----------------
  function gift(after) {
    el = UI.el; pos = UI.pos;
    var md = UI.modal(900, { tapOutside: true });
    var I = md.inner;
    function render() {
      I.innerHTML = '';
      var g = Daily.giftState();
      UI.board(I, 30, 80, 660, 790, 'b-a');
      UI.leaf(I, 4, 'CADEAU DU JOUR', true);
      UI.closeBtn(I, 628, 64, function () { md.close(); if (after) after(); });
      UI.txt(I, 80, 182, 560, 'Reviens chaque jour : le 7<sup>e</sup> cadeau est le plus gros !', 'ptxt ctxt', 22).style.color = '#fff6dc';
      g.gifts.forEach(function (r, i) {
        var done = g.ready ? i < g.idx : i <= g.idx, cur = g.ready && i === g.idx;
        var c = el('div', 'gift-day' + (done ? ' done' : '') + (cur ? ' cur' : '') + (i === 6 ? ' big' : ''), I);
        if (i < 6) pos(c, 68 + (i % 3) * 198, 232 + Math.floor(i / 3) * 172, 188, 160); else pos(c, 68, 576, 584, 120);
        el('b', '', c, 'JOUR ' + (i + 1));
        var what = [];
        if (r.coins) what.push(Util.fmt(r.coins) + ' ' + COIN());
        ['turbo', 'coeur', 'temps', 'chance'].forEach(function (k) { if (r[k]) what.push('<img src="' + ASSETS[GD.BOOSTERS[k].icon] + '">' + (r[k] > 1 ? '×' + r[k] : '')); });
        el('span', '', c, what.join(' '));
        if (done) el('u', '', c);
      });
      if (g.ready) UI.pill(I, 190, 730, 340, 96, 'RÉCUPÉRER', function () {
        var r = Daily.claimGift();
        if (!r) return;
        Sfx.play('coin'); UI.burst(I, 360, 420);
        afterChange(); render();
        UI.toast('Cadeau : ' + Daily.rewardText(r));
      });
      else UI.txt(I, 80, 756, 560, 'Cadeau pris ! Prochain cadeau demain. Série : <b>' + SV().gift.streak + ' jour' + (SV().gift.streak > 1 ? 's' : '') + '</b>', 'ptxt ctxt', 23).style.color = '#fff6dc';
    }
    render();
    return md;
  }
  // entering the kitchen: the gift opens by itself, once per session, when it is waiting
  var giftShown = '';
  function autoGift() {
    var s = SV();
    if (!s.seenTuto.basic || (s.stats.days || 0) < 2) return false;
    var today = Daily.day();
    if (giftShown === today || !Daily.giftState().ready) return false;
    giftShown = today;
    gift();
    return true;
  }

  // ---------------- missions ----------------
  function quests(after) {
    el = UI.el; pos = UI.pos;
    var md = UI.modal(900, { tapOutside: true });
    var I = md.inner;
    function render() {
      I.innerHTML = '';
      var qs = Daily.questState();
      UI.board(I, 30, 80, 660, 790);
      UI.leaf(I, 4, 'MISSIONS', false);
      UI.closeBtn(I, 628, 64, function () { md.close(); if (after) after(); });
      UI.paper(I, 62, 180, 596, 590);
      qs.list.forEach(function (it, i) {
        var ready = it.prog >= it.goal, r = el('div', 'row ach quest' + (it.claimed ? ' got' : ''), I);
        pos(r, 96, 214 + i * 142, 528);
        el('div', 'ic sm', r).style.backgroundImage = ic(it.id === 'defi' ? 'target' : it.id === 'sim' ? 'walk' : it.id === 'stars' || it.id === 'three' ? 'trophy' : 'list');
        el('div', 'nm', r, Daily.questText(it));
        el('div', 'ds', r, Util.fmt(it.coins) + ' ' + COIN() + (it.boost ? ' + 1 ' + GD.BOOSTERS[it.boost].name : ''));
        var bar = el('div', 'abar', r); el('i', '', bar).style.width = Math.round(100 * it.prog / it.goal) + '%'; el('span', '', bar, Util.fmt(Math.min(it.prog, it.goal)) + ' / ' + Util.fmt(it.goal));
        if (it.claimed) el('div', 'pill max', r, 'FAIT');
        else {
          var b = el('div', 'pill' + (ready ? '' : ' dis'), r, ready ? 'PRENDRE' : 'EN COURS'); b.style.fontSize = '20px';
          UI.onTap(b, function () {
            var res = Daily.claimQuest(i);
            if (!res) { Sfx.play('nope'); return; }
            Sfx.play('coin'); afterChange(); render();
            UI.toast(res.bonus ? 'Les 3 missions ! Bonus : ' + Daily.rewardText(res.bonus) : 'Mission réussie : ' + Daily.rewardText(res.r));
          }, true);
        }
      });
      var all = qs.list.every(function (x) { return x.claimed; });
      var t = UI.txt(I, 96, 648, 528, all ? '<b>Bravo, tout est fait !</b> De nouvelles missions arrivent demain.' :
        'Termine les 3 missions : <b>coffre bonus</b> de ' + Util.fmt(Daily.coinsFor(180)) + ' ' + COIN() + ' et 1 Trèfle.', 'ptxt', 21);
      t.style.lineHeight = '1.25';
    }
    render();
    return md;
  }

  // ---------------- statistics ----------------
  function stats() {
    el = UI.el; pos = UI.pos;
    var s = SV(), st = s.stats;
    var md = UI.modal(960, { tapOutside: true });
    var I = md.inner;
    UI.board(I, 30, 80, 660, 850);
    UI.leaf(I, 4, 'STATISTIQUES', true);
    UI.closeBtn(I, 628, 64, function () { md.close(); });
    UI.paper(I, 62, 180, 596, 690);
    var friends = 0; Object.keys(s.friends || {}).forEach(function (k) { if (GD.friendLevel(s.friends[k]) >= 1) friends++; });
    var ach = Object.keys(s.ach || {}).length, places = GD.achValue(s, 'places');
    var rows = [
      ['Chef', 'niveau ' + s.level + ((s.prestige || 0) > 0 ? ' • ' + s.prestige + ' toque' + (s.prestige > 1 ? 's' : '') + ' d’or' : '')],
      ['Clients servis', Util.fmt(st.served || 0)],
      ['Pièces gagnées', Util.fmt(st.earned || 0) + ' ' + COIN()],
      ['Journées terminées', Util.fmt(st.days || 0)],
      ['Meilleure journée', Util.fmt(st.bestDay || 0) + ' ' + COIN()],
      ['Étoiles', Util.fmt(Online.stars())],
      ['Clients partis fâchés', Util.fmt(st.lost || 0)],
      ['Critique servie', Util.fmt(st.vip || 0) + ' fois'],
      ['Journées en Simulateur', Util.fmt(st.sim || 0)],
      ['Défis du jour joués', Util.fmt(st.defis || 0)],
      ['Amis parmi les habitués', friends],
      ['Succès', ach + ' / ' + GD.ACHIEVEMENTS.length],
      ['Restaurants ouverts', places + ' / ' + GD.LOCATIONS.length],
      ['Codes utilisés', Object.keys(s.codes || {}).length]
    ];
    var box = el('div', 'stat-list', I); pos(box, 100, 212, 520);
    rows.forEach(function (r) { el('div', '', box, '<span>' + r[0] + '</span><b>' + r[1] + '</b>'); });
    return md;
  }

  // ---------------- prestige ----------------
  function prestige(after) {
    el = UI.el; pos = UI.pos;
    var md = UI.modal(900, { tapOutside: true });
    var I = md.inner;
    function render() {
      I.innerHTML = '';
      var s = SV(), n = s.prestige || 0, can = Daily.canPrestige();
      UI.board(I, 40, 80, 640, 790, 'b-a');
      UI.leaf(I, 4, 'PRESTIGE');
      UI.closeBtn(I, 620, 64, function () { md.close(); if (after) after(); });
      var t = el('div', 'pop', I); pos(t, 280, 176, 160, 160); t.style.cssText += ';position:absolute;background:' + ic('toque') + ' center/contain no-repeat';
      UI.txt(I, 90, 336, 540, n ? '<span class="lg gold" style="font-size:36px">' + n + ' toque' + (n > 1 ? 's' : '') + ' d’or</span><br><span class="lg" style="font-size:22px;color:#fff6dc">Tous tes plats rapportent +' + Math.round(GD.prestigeMul(s) * 100 - 100) + ' %</span>' :
        '<span class="lg gold" style="font-size:34px">La toque d’or</span><br><span class="lg" style="font-size:22px;color:#fff6dc">La récompense des plus grands chefs</span>', 'ptxt', 24);
      UI.paper(I, 84, 430, 552, 250, 'p-a');
      var txt = can ?
        'Saison 1 terminée : une <b>toque d’or</b> t’attend !<br>Tu recommences au <b>jour 1</b> avec une cuisine neuve, mais chaque plat rapporte <b>+25 %</b> pour toujours.<br><span style="font-size:19px">Tu gardes ton niveau de chef, ton histoire, tes amis, tes succès et tes bonus.</span>' :
        'Termine le <b>jour ' + (Daily.PRESTIGE_DAY - 1) + '</b> (fin de la Saison 1) pour gagner ta première <b>toque d’or</b>.<br>Tu recommenceras au jour 1, mais chaque plat rapportera <b>+25 %</b> pour toujours.<br><span style="font-size:19px">Jour actuel : ' + s.unlocked + '.</span>';
      var tt = UI.txt(I, 112, 456, 496, txt, 'ptxt', 21); tt.style.lineHeight = '1.28';
      if (can) UI.pill(I, 170, 712, 380, 96, 'GAGNER UNE TOQUE', function () {
        UI.confirm('PRESTIGE ?', 'Recommencer au jour 1 avec une cuisine neuve<br>et gagner +25 % pour toujours ?', function () {
          if (!Daily.doPrestige()) return;
          Sfx.play('levelup'); if (window.View3D) View3D.refresh();
          Scene.refreshDecor(); afterChange(); render();
          UI.reward('TOQUE D’OR !', 'Chaque plat rapporte maintenant <b>+' + Math.round(GD.prestigeMul(SV()) * 100 - 100) + ' %</b>.<br>À toi de reconstruire ton empire, Chef !', 'star');
          Online.submit(null, true);
        });
      }).style.fontSize = '26px';
      else {
        var need = Daily.PRESTIGE_DAY - 1, done = Math.min(need, s.unlocked - 1);
        var bar = el('div', 'pbar', I, '<i></i><span>Jours terminés : ' + done + ' / ' + need + '</span>'); pos(bar, 140, s.prestigeBackup && n > 0 ? 694 : 722, 440, 44);
        bar.querySelector('i').style.width = Math.round(100 * done / need) + '%';
      }
      if (!can && s.prestigeBackup && n > 0) UI.pill(I, 190, 748, 340, 74, 'ANNULER LE DERNIER', function () {
        UI.confirm('ANNULER ?', 'Rendre la dernière toque d’or<br>et retrouver ton ancienne cuisine ?', function () {
          if (Daily.undoPrestige()) { if (window.View3D) View3D.refresh(); Scene.refreshDecor(); afterChange(); render(); UI.toast('Ton ancienne cuisine est revenue.'); }
        });
      }, 'red').style.fontSize = '20px';
    }
    render();
    return md;
  }

  // ---------------- daily challenge ----------------
  function defi() {
    el = UI.el; pos = UI.pos;
    var info = Daily.defiInfo(), st = Daily.defiState();
    var md = UI.modal(880, { tapOutside: true });
    var I = md.inner;
    UI.board(I, 30, 80, 660, 770);
    UI.leaf(I, 4, 'DÉFI DU JOUR', true);
    UI.closeBtn(I, 628, 64, function () { md.close(); });
    UI.paper(I, 62, 180, 596, 480);
    var h = '<div class="lg" style="font-size:27px;color:#6b3a14">Même cuisine pour tous les chefs</div>' +
      '<div style="font-size:20px;margin:4px 0 10px">Gagne le plus de pièces possible. Les clients s’impatientent, comme en mode Classique. Personne ne garde ses améliorations : seul ton talent compte !</div>';
    h += '<div class="defi-st"></div>';
    h += '<div class="defi-mod"><b class="lg">' + info.mod.name + '</b><br>' + info.mod.desc + '</div>';
    h += '<div style="font-size:21px;margin-top:10px">Durée : <b>' + info.cfg.duration + ' s</b> • 4 places • 1 Turbo, 1 Patience, 1 Trèfle</div>';
    h += '<div style="font-size:22px;margin-top:8px">' + (st.best ? 'Ton record du jour : <b>' + Util.fmt(st.best) + '</b> ' + COIN() + ' (' + st.tries + ' essai' + (st.tries > 1 ? 's' : '') + ')' :
      'Premier essai du jour : <b>+' + Util.fmt(Daily.coinsFor(120)) + '</b> ' + COIN() + ' au moins') + '</div>';
    var t = UI.txt(I, 96, 206, 528, h, 'ptxt', 22); t.style.lineHeight = '1.25';
    var box = t.querySelector('.defi-st');
    info.list.forEach(function (id) { var c = el('i', '', box, '<b>' + info.stations[id] + '</b>'); c.style.backgroundImage = Art.stationBg(id); });
    UI.pill(I, 74, 696, 250, 84, 'CLASSEMENT', function () { leaderboard('defi'); }, 'brown').style.fontSize = '23px';
    UI.pill(I, 344, 688, 302, 100, 'JOUER', function () { md.close(); Game.startDefi(); });
    return md;
  }
  // the result of the challenge
  function defiResults(sh, res, onAction) {
    el = UI.el; pos = UI.pos;
    var md = UI.modal(860, { closable: false, onBack: function () { go('hub'); } });
    var I = md.inner;
    UI.board(I, 60, 90, 600, 700);
    UI.leaf(I, 16, 'DÉFI TERMINÉ', true);
    var star = el('div', 'pop', I); pos(star, 290, 190, 140, 140); star.style.cssText += ';position:absolute;background:' + ic('target') + ' center/contain no-repeat';
    UI.paper(I, 105, 340, 510, 300, 'p-a');
    var h = '<div class="lg" style="font-size:44px;color:#6b3a14">' + Util.fmt(res.score) + ' ' + COIN() + '</div>';
    h += res.isBest ? '<div style="color:#2f8a17"><b>Nouveau record du jour !</b></div>' : '<div>Ton record du jour : <b>' + Util.fmt(res.best) + '</b></div>';
    h += 'Clients servis : <b>' + sh.served + '</b>' + (sh.lost ? ' • partis : <b>' + sh.lost + '</b>' : '') + '<br>';
    if (res.reward) h += 'Récompense : ' + Daily.rewardText(res.reward) + '<br>';
    h += '<span class="defi-rank" style="font-size:21px">' + (Online.enabled() ? 'Envoi de ton score…' : 'Inscris-toi au classement pour comparer ton score !') + '</span>';
    var t = UI.txt(I, 125, 362, 470, h, 'ptxt', 24); t.style.lineHeight = '1.4';
    function go(a) { md.close(); onAction(a); }
    UI.sq(I, 140, 672, 104, 'b_menu', function () { go('hub'); });
    UI.sq(I, 308, 672, 104, 'b_restart', function () { go('retry'); });
    var lb = UI.sq(I, 476, 672, 104, 'btn_round', function () { go('board'); });
    lb.innerHTML = '<img style="position:absolute;left:22%;top:18%;width:56%;height:56%">'; lb.firstChild.src = Art.icon('trophy');
    Sfx.play(res.isBest ? 'win' : 'soft');
    if (res.isBest) setTimeout(function () { UI.burst(I, 360, 260); }, 200);
    if (Online.enabled()) Online.submit(function (err) {
      var r = t.querySelector('.defi-rank'); if (!r) return;
      if (err) { r.textContent = 'Classement injoignable : ton score sera envoyé plus tard.'; return; }
      Online.top('defi', function (e2, j) {
        if (!r.isConnected) return;
        r.innerHTML = !e2 && j && j.me ? 'Ton rang aujourd’hui : <b>' + j.me.rank + '</b> sur ' + j.total : 'Score envoyé au classement !';
      });
    }, true);
    return md;
  }

  return { open: open, leaderboard: leaderboard, codes: codes, gift: gift, autoGift: autoGift, quests: quests, stats: stats, prestige: prestige, profile: profile,
    defi: defi, defiResults: defiResults, keyboard: keyboard };
})();
