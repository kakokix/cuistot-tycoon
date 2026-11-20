// ===================== DATA & BALANCE =====================
var GD = (function () {
  // 8 kitchen stations (2 rows of 4). price = base dish price, time = base cook time (s)
  var STATIONS = [
    { id: 'grill',  name: 'Grill',        dish: 'burger',   dishName: 'Burger',      price: 10, time: 3.6, unlock: 1,  cost: 0,     up: 30 },
    { id: 'jus',    name: 'Bar à jus',    dish: 'jus',      dishName: 'Jus tropical', price: 6, time: 2.4, unlock: 1,  cost: 0,     up: 24 },
    { id: 'frites', name: 'Friteuse',     dish: 'frites',   dishName: 'Frites',       price: 8, time: 3.0, unlock: 2,  cost: 150,   up: 45 },
    { id: 'pizza',  name: 'Four à pizza', dish: 'pizza',    dishName: 'Pizza',       price: 18, time: 5.4, unlock: 4,  cost: 650,   up: 140 },
    { id: 'soupe',  name: 'Marmite',      dish: 'soupe',    dishName: 'Soupe',       price: 15, time: 4.6, unlock: 6,  cost: 1600,  up: 300 },
    { id: 'wok',    name: 'Wok',          dish: 'nouilles', dishName: 'Nouilles',    price: 21, time: 5.0, unlock: 8,  cost: 3800,  up: 650 },
    { id: 'sushi',  name: 'Bar à sushis', dish: 'sushi',    dishName: 'Sushis',      price: 27, time: 5.6, unlock: 10, cost: 8000,  up: 1300 },
    { id: 'gateau', name: 'Pâtisserie',   dish: 'gateau',   dishName: 'Gâteau',      price: 34, time: 6.4, unlock: 12, cost: 16000, up: 2500 }
  ];
  var MAX_ST_LEVEL = 10;

  // realistic customers (sprites cu_<id>_<mood>); the food critic is the VIP (pays x2)
  var CUSTOMERS = ['touriste', 'mamie', 'garcon', 'affaires', 'surfeur', 'papi', 'photographe', 'explorateur'];
  var VIP_CUSTOMER = 'critique';
  // who they are in the story (intro = chapter that introduces them), favourite dish (double friendship)
  var PEOPLE = {
    papi:        { name: 'Papi Malo',  fav: 'soupe',    intro: 'prologue', introDay: 0 },
    explorateur: { name: 'Hugo',       fav: 'burger',   intro: 'c1',  introDay: 1 },
    mamie:       { name: 'Mamie Lila', fav: 'frites',   intro: 'c2',  introDay: 2 },
    garcon:      { name: 'Léo',        fav: 'pizza',    intro: 'c2',  introDay: 2 },
    touriste:    { name: 'Awa',        fav: 'jus',      intro: 'c3',  introDay: 3 },
    affaires:    { name: 'M. Tanaka',  fav: 'gateau',   intro: 'c4',  introDay: 5 },
    photographe: { name: 'Zuri',       fav: 'nouilles', intro: 'c7',  introDay: 11 },
    surfeur:     { name: 'Kai',        fav: 'sushi',    intro: 'c8',  introDay: 13 },
    critique:    { name: 'Mme Benali', fav: null,       intro: 'c11', introDay: 21 },
    // season 2
    capitaine:   { name: 'Capitaine Moana', fav: 'sushi',   intro: 's2c1', introDay: 25, loc: 'plage' },
    nina:        { name: 'Nina',            fav: 'frites',  intro: 's2c3', introDay: 28, loc: 'plage' },
    guide:       { name: 'Élise',           fav: 'soupe',   intro: 's2c5', introDay: 32, loc: 'montagne' },
    rival:       { name: 'Chef Gaston',     fav: 'gateau',  intro: 's2c8', introDay: 36, loc: 'ville' }
  };
  var FRIEND_LEVELS = [4, 12, 25];
  // ---------------- locations (Season 2): each restaurant has its own look and specialties ----------------
  var LOCATIONS = [
    { id: 'jungle',   name: 'Jungle',   resto: 'Chez Cuistot',          bg: 'bg_jungle',   unlockDay: 1,  special: [],                   regulars: [],            sky: '#9fd8ef', ground: '#4f8d2d' },
    { id: 'plage',    name: 'Plage',    resto: 'Cuistot Plage',         bg: 'bg_plage',    unlockDay: 24, special: ['jus', 'sushi'],     regulars: ['capitaine', 'nina'], sky: '#7fc8f8', ground: '#f2d9a4' },
    { id: 'montagne', name: 'Montagne', resto: 'Chalet Cuistot',        bg: 'bg_montagne', unlockDay: 30, special: ['soupe', 'gateau'],  regulars: ['guide'],     sky: '#b9dcf5', ground: '#eef4fa' },
    { id: 'ville',    name: 'Ville',    resto: 'Cuistot Rooftop',       bg: 'bg_ville',    unlockDay: 36, special: ['pizza', 'nouilles'], regulars: ['rival'],     sky: '#f6a35c', ground: '#6b5a73' }
  ];
  function locById(id) { for (var i = 0; i < LOCATIONS.length; i++) if (LOCATIONS[i].id === id) return LOCATIONS[i]; return LOCATIONS[0]; }
  function locUnlocked(save, id) { return (save.unlocked || 1) > locById(id).unlockDay || locById(id).unlockDay <= 1; }
  // specialties of the current place pay 30 % more and are ordered more often
  var SPECIAL_BONUS = 1.3;

  // ---------------- achievements (succès) ----------------
  var ACHIEVEMENTS = [
    { id: 'serve50',   name: 'Premier coup de feu', desc: 'Servir 50 clients',             stat: 'served', goal: 50,    reward: 100 },
    { id: 'serve500',  name: 'Cuisine de chef',      desc: 'Servir 500 clients',            stat: 'served', goal: 500,   reward: 600 },
    { id: 'serve2000', name: 'Légende des fourneaux', desc: 'Servir 2 000 clients',         stat: 'served', goal: 2000,  reward: 3000 },
    { id: 'earn5k',    name: 'Tirelire',             desc: 'Gagner 5 000 pièces',           stat: 'earned', goal: 5000,  reward: 250 },
    { id: 'earn100k',  name: 'Magnat',               desc: 'Gagner 100 000 pièces',         stat: 'earned', goal: 100000, reward: 4000 },
    { id: 'days10',    name: 'Habitué du métier',    desc: 'Terminer 10 journées',          stat: 'days',   goal: 10,    reward: 200 },
    { id: 'days50',    name: 'Infatigable',          desc: 'Terminer 50 journées',          stat: 'days',   goal: 50,    reward: 1500 },
    { id: 'stars30',   name: 'Pluie d’étoiles',      desc: 'Gagner 30 étoiles',             stat: 'stars',  goal: 30,    reward: 500 },
    { id: 'stations',  name: 'Cuisine complète',     desc: 'Posséder les 8 stations',       stat: 'stations', goal: 8,   reward: 2000 },
    { id: 'friends3',  name: 'Bon voisin',           desc: 'Devenir ami (3 cœurs) avec 3 habitués', stat: 'bestFriends', goal: 3, reward: 800 },
    { id: 'vip10',     name: 'Sous les projecteurs', desc: 'Servir 10 fois la critique',    stat: 'vip',    goal: 10,    reward: 700 },
    { id: 'season1',   name: 'Fin de la Saison 1',   desc: 'Terminer la Saison 1',          stat: 'season1', goal: 1,    reward: 1000 },
    { id: 'places',    name: 'Globe-trotteur',       desc: 'Ouvrir les 4 restaurants',      stat: 'places', goal: 4,     reward: 5000 },
    { id: 'season2',   name: 'Fin de la Saison 2',   desc: 'Terminer la Saison 2',          stat: 'season2', goal: 1,    reward: 8000 },
    { id: 'ota',       name: 'À la pointe',          desc: 'Mettre le jeu à jour depuis le jeu', stat: 'ota', goal: 1,     reward: 500 }
  ];
  function achValue(save, stat) {
    var st = save.stats || {};
    if (stat === 'stars') { var n = 0; Object.keys(save.days || {}).forEach(function (k) { n += save.days[k]; }); return n; }
    if (stat === 'stations') { var c = 0; STATIONS.forEach(function (s) { if ((save.stations[s.id] || 0) > 0) c++; }); return c; }
    if (stat === 'bestFriends') { var f = 0; Object.keys(save.friends || {}).forEach(function (k) { if (friendLevel(save.friends[k]) >= 3) f++; }); return f; }
    if (stat === 'season1') return save.story && save.story.seen && save.story.seen.c12 ? 1 : 0;
    if (stat === 'season2') return save.story && save.story.seen && save.story.seen.s2c12 ? 1 : 0;
    if (stat === 'places') { var p = 0; LOCATIONS.forEach(function (l) { if (locUnlocked(save, l.id)) p++; }); return p; }
    return st[stat] || 0;
  }

  function introduced(save, cust) { var p = PEOPLE[cust]; return !!p && (p.introDay === 0 || (save.unlocked || 1) > p.introDay); }
  function friendLevel(points) { var l = 0; for (var i = 0; i < FRIEND_LEVELS.length; i++) if (points >= FRIEND_LEVELS[i]) l = i + 1; return l; }

  var STAFF = {
    serveur: { name: 'Serveur', desc: 'Lucas sert tout seul les plats prêts aux clients.', unlock: 3,
      descRelax: 'Lucas rend les clients plus généreux : +10 % de pourboires par niveau.',
      costs: [350, 1100, 3200, 8500, 21000], interval: [2.6, 2.0, 1.6, 1.25, 0.95] },
    commis: { name: 'Commis', desc: 'Théo lance tout seul la cuisson des plats commandés.', unlock: 5,
      costs: [700, 2200, 6000, 15000, 36000], interval: [3.0, 2.3, 1.8, 1.4, 1.05] }
  };

  var DECOR = {
    plantes:   { name: 'Plantes tropicales', desc: '+12 % de patience des clients', unlock: 2, costs: [200, 1000, 4500] },
    tabourets: { name: 'Tabourets', desc: '+1 place au comptoir', unlock: 3, costs: [450, 3500] },
    lanternes: { name: 'Lanternes', desc: '+20 % de pourboires', unlock: 4, costs: [600, 2500, 9000] },
    musique:   { name: 'Tam-tams', desc: 'Les clients arrivent plus vite (+10 %)', unlock: 5, costs: [900, 4000, 14000] },
    enseigne:  { name: 'Enseigne', desc: '+8 % sur le prix de tous les plats', unlock: 7, costs: [2000, 8000, 25000] }
  };
  var DECOR_ORDER = ['plantes', 'tabourets', 'lanternes', 'musique', 'enseigne'];

  var BOOSTERS = {
    turbo:  { name: 'Turbo',    desc: 'Cuisson 2× plus rapide pendant 15 s', unlock: 2, cost: 60,  icon: 'bolt',  dur: 15 },
    coeur:  { name: 'Patience', desc: 'Recharge la patience de tous les clients', unlock: 3, cost: 50, icon: 'heart', dur: 0 },
    temps:  { name: 'Chrono',   desc: '+15 secondes à la journée', unlock: 5, cost: 80, icon: 'time', dur: 0 },
    chance: { name: 'Trèfle',   desc: 'Pourboires ×3 pendant 15 s', unlock: 7, cost: 100, icon: 'luck', dur: 15 }
  };
  var BOOSTER_ORDER = ['turbo', 'coeur', 'temps', 'chance'];

  var BUSINESS = [
    { id: 'stand',     name: 'Stand de jus',      rate: 3,   base: 300,   unlock: 3,  max: 10 },
    { id: 'truck',     name: 'Food truck',        rate: 15,  base: 2200,  unlock: 6,  max: 10 },
    { id: 'kiosque',   name: 'Paillote de plage', rate: 60,  base: 11000, unlock: 9,  max: 10 },
    { id: 'franchise', name: 'Franchise',         rate: 220, base: 52000, unlock: 12, max: 10 }
  ];
  var OFFLINE_CAP_H = 4;

  function stationById(id) { for (var i = 0; i < STATIONS.length; i++) if (STATIONS[i].id === id) return STATIONS[i]; return null; }

  function stationStats(st, level, save) {
    var sign = 1 + 0.08 * ((save && save.decor && save.decor.enseigne) || 0);
    if (save && save.flags && save.flags.livre) sign *= 1.1; // story reward: the Great Book of Flavours
    level = Math.max(1, level);
    return {
      price: Math.round(st.price * (1 + 0.22 * (level - 1)) * sign),
      time: st.time * Math.pow(0.92, level - 1),
      slots: level >= 7 ? 3 : level >= 4 ? 2 : 1
    };
  }
  function upgradeCost(st, level) { return Math.round(st.up * Math.pow(1.55, level - 1)); }
  function seatsFor(save) { return 3 + ((save.decor && save.decor.tabourets) || 0); }
  function businessCost(b, owned) { return Math.round(b.base * Math.pow(1.45, owned)); }
  function passiveRate(save) { // coins per minute
    var r = 0;
    for (var i = 0; i < BUSINESS.length; i++) r += BUSINESS[i].rate * ((save.business && save.business[BUSINESS[i].id]) || 0);
    return r;
  }
  function xpNeed(level) { return Math.round(45 * Math.pow(1.3, level - 1)); }

  // goal curve (fitted with tools/sim_balance.js: ~50% of a steady bot player's earnings)
  function rawGoal(d) {
    if (d <= 5) return 90 * Math.pow(1.33, d - 1);
    var g5 = 90 * Math.pow(1.33, 4);
    if (d <= 38) return g5 * Math.pow(1.113, d - 5);
    var g38 = g5 * Math.pow(1.113, 33);
    return g38 * Math.min(1.3, 1 + 0.01 * (d - 38));
  }
  // shorter days than v1.1 (less tiring); goals scaled with the day length
  function durationFor(d) { return Math.min(105, 70 + 1.5 * (d - 1)); }
  function oldDuration(d) { return Math.min(150, 75 + 3 * (d - 1)); }
  var RELAX_GOAL = 0.85, CLASSIC_GOAL = 1.25;
  function isRelax(mode) { return mode !== 'classique'; }
  function goalFor(d, mode) {
    var g = rawGoal(d) * durationFor(d) / oldDuration(d) * (isRelax(mode) ? RELAX_GOAL : CLASSIC_GOAL);
    var mag = g < 200 ? 5 : g < 1000 ? 10 : g < 5000 ? 50 : 100;
    return Math.round(g / mag) * mag;
  }
  function dayConfig(d, mode) {
    var goal = goalFor(d, mode), relax = isRelax(mode);
    return {
      day: d, relax: relax,
      duration: durationFor(d),
      spawn: Math.max(1.4, 3.8 - 0.09 * (d - 1)) * (relax ? 1.3 : 1),
      patience: Math.max(0.8, 1.1 - 0.012 * (d - 1)) * (relax ? 1.25 : 1),
      p1: Math.max(0.25, 0.72 - 0.02 * (d - 1)),
      p3: Math.min(0.3, 0.015 * (d - 1)),
      vip: d >= 3 ? 0.05 : 0,
      goal: goal,
      stars: [goal, Math.round(goal * 1.35 / 5) * 5, Math.round(goal * 1.75 / 5) * 5]
    };
  }

  function newSave() {
    var st = {};
    STATIONS.forEach(function (s) { st[s.id] = s.cost === 0 ? 1 : 0; });
    return {
      v: 1,
      coins: 0,
      xp: 0, level: 1,
      stations: st,
      staff: { serveur: 0, commis: 0 },
      decor: { plantes: 0, tabourets: 0, lanternes: 0, musique: 0, enseigne: 0 },
      boosters: { turbo: 1, coeur: 1, temps: 0, chance: 0 },
      business: { stand: 0, truck: 0, kiosque: 0, franchise: 0 },
      days: {},           // day -> best stars
      unlocked: 1,        // highest playable day
      stats: { served: 0, earned: 0, lost: 0, days: 0, vip: 0, ota: 0 },
      settings: { music: 0.45, sfx: 0.7, vibra: true, pause: true },
      mode: 'detente',           // 'detente' (relaxed, default) or 'classique'
      story: { seen: {}, read: {} },
      friends: {},
      flags: {},
      loc: 'jungle',             // current restaurant (Season 2)
      ach: {},                   // claimed achievements
      view3d: false,             // 3D test view
      lastBuild: 0,              // last game build that ran (for "what's new")
      seenTuto: {},
      lastSeen: 0,
      name: 'Chez Cuistot'
    };
  }

  return {
    STATIONS: STATIONS, MAX_ST_LEVEL: MAX_ST_LEVEL, CUSTOMERS: CUSTOMERS, VIP_CUSTOMER: VIP_CUSTOMER,
    PEOPLE: PEOPLE, FRIEND_LEVELS: FRIEND_LEVELS, friendLevel: friendLevel, introduced: introduced,
    LOCATIONS: LOCATIONS, locById: locById, locUnlocked: locUnlocked, SPECIAL_BONUS: SPECIAL_BONUS,
    ACHIEVEMENTS: ACHIEVEMENTS, achValue: achValue, isRelax: isRelax, durationFor: durationFor,
    _setGoalFactors: function (r, c) { RELAX_GOAL = r; CLASSIC_GOAL = c; },
    STAFF: STAFF, DECOR: DECOR, DECOR_ORDER: DECOR_ORDER, BOOSTERS: BOOSTERS, BOOSTER_ORDER: BOOSTER_ORDER,
    BUSINESS: BUSINESS, OFFLINE_CAP_H: OFFLINE_CAP_H,
    stationById: stationById, stationStats: stationStats, upgradeCost: upgradeCost, seatsFor: seatsFor,
    businessCost: businessCost, passiveRate: passiveRate, xpNeed: xpNeed, goalFor: goalFor, dayConfig: dayConfig,
    newSave: newSave
  };
})();
if (typeof module !== 'undefined') module.exports.GD = GD;
