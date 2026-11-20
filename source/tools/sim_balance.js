// Balance simulation: a bot plays successive days, buys upgrades cheapest-first.
// usage: node sim_balance.js [days] [skill1,skill2] [seed] [mode: detente|classique] [compact]
const path = require('path');
const { GD } = require(path.join(__dirname, '../src/js/data.js'));
const { Shift } = require(path.join(__dirname, '../src/js/sim.js'));
const { Progress } = require(path.join(__dirname, '../src/js/progress.js'));

const DAYS = +(process.argv[2] || 30);
const SKILLS = (process.argv[3] || '1.2,2.2').split(',').map(Number);
let seed = +(process.argv[4] || 7);
const MODE = process.argv[5] || 'classique';
const COMPACT = !!process.argv[6];
function rng() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }

function botNeeds(sh) {
  const n = sh.stations.map(s => -(s.cooking.length + s.ready));
  for (const c of sh.customers) { if (c.state !== 'wait') continue; for (const it of c.items) if (!it.done) n[it.st]++; }
  return n;
}
function decide(sh) {
  // serve the most urgent available dish
  for (let i = 0; i < sh.stations.length; i++) {
    const st = sh.stations[i];
    if (st.ready > 0) {
      for (const c of sh.customers) if (c.state === 'wait' && c.items.some(it => !it.done && it.st === i)) return () => sh.tapStation(i);
    }
  }
  const n = botNeeds(sh);
  let best = -1, bn = 0;
  for (let i = 0; i < sh.stations.length; i++) {
    const st = sh.stations[i];
    if (!st.owned || st.cooking.length + st.ready >= st.slots) continue;
    if (n[i] > bn) { bn = n[i]; best = i; }
  }
  if (best >= 0) return () => sh.tapStation(best);
  return null;
}
function playDay(save, day, skill) {
  const sh = new Shift(save, day, { rng });
  const dt = 0.05; let actT = 0.5;
  while (!sh.over) {
    sh.update(dt); sh.events.length = 0; actT -= dt;
    if (actT <= 0) {
      const a = decide(sh);
      if (a) { a(); actT = (1 / skill) * (0.7 + 0.6 * rng()); }
      else actT = 0.15;
    }
  }
  return sh;
}
function shop(save) {
  let bought = [];
  for (;;) {
    const o = Progress.offers(save).filter(x => !x.maxed && !x.locked && x.kind !== 'booster' && save.coins >= x.cost);
    if (!o.length) break;
    o.sort((a, b) => (a.kind === 'station' && a.buy ? -1e9 : a.cost) - (b.kind === 'station' && b.buy ? -1e9 : b.cost));
    const x = o[0];
    Progress.buy(save, x.kind, x.id);
    bought.push(x.kind[0] + ':' + x.id + (x.level + 1));
  }
  return bought;
}

for (const skill of SKILLS) {
  const save = GD.newSave(); save.mode = MODE;
  console.log(`\n=== ${MODE} skill ${skill} actions/s ===`);
  console.log('day goal  3*    earned served lost hearts stars lvl coinsAfterShop  stations');
  let replays = 0;
  for (let d = 1; d <= DAYS; d++) {
    let sh, tries = 0;
    do {
      sh = playDay(save, d, skill);
      const passive = GD.passiveRate(save) * (sh.duration + 40) / 60;
      save.coins += passive;
      Progress.applyResult(save, sh);
      shop(save);
      tries++;
    } while (!sh.win && tries < 4);
    replays += tries - 1;
    const st = GD.STATIONS.map(s => save.stations[s.id] || 0).join('');
    if (!COMPACT || d % 3 === 0 || tries > 1) console.log(`${String(d).padStart(3)} ${String(sh.goal).padStart(5)} ${String(sh.thresholds[2]).padStart(5)} ${String(Math.round(sh.earned)).padStart(9)} ${String(sh.served).padStart(6)} ${String(sh.lost).padStart(4)} ${String(sh.hearts).padStart(6)} ${String(sh.stars).padStart(5)} ${String(save.level).padStart(3)} ${String(Math.round(save.coins)).padStart(8)}  ${st} st${save.staff.serveur}${save.staff.commis} dec${Object.values(save.decor).join('')} biz${Object.values(save.business).join('')}${tries > 1 ? '  (tries ' + tries + ')' : ''}`);
  }
  console.log('replays:', replays);
}
