// Règles du drive, de la fermeture et des remboursements, sans affichage : node tools/sim_drive.js (doit finir par ALL PASS)
var GD = require('../src/js/data.js').GD, Shift = require('../src/js/sim.js').Shift;
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function save(day, mode, staff) {
  var s = GD.newSave(); s.mode = mode || 'detente'; s.level = Math.min(14, 1 + Math.floor(day * 0.8));
  GD.STATIONS.forEach(function (d) { s.stations[d.id] = s.level >= d.unlock ? Math.min(10, 1 + Math.floor((s.level - d.unlock) / 2)) : 0; });
  s.staff = staff || { serveur: 0, commis: 0 }; return s;
}
var ok = true;
function check(name, cond, info) { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' : ' + JSON.stringify(info) : '')); if (!cond) ok = false; }
// 1. no drive before the day, none in the manager view, none in the tutorial
check('1a day 3: no drive', !new Shift(save(3), 3, { manual: true }).driveOn);
check('1b day 4: drive', new Shift(save(4), 4, { manual: true }).driveOn);
check('1c manager view: no drive', !new Shift(save(12), 12, {}).driveOn);
// 2. a day where nobody does anything: cars come one at a time, wait, and (Détente) never leave
var sh = new Shift(save(12), 12, { manual: true, rng: mulberry(3) }), seen = {}, maxCars = 0, ev = {};
for (var t = 0; t < 60; t += 0.05) { sh.update(0.05); sh.events.forEach(function (e) { ev[e.type] = (ev[e.type] || 0) + 1; }); sh.events.length = 0; var n = sh.customers.filter(function (c) { return c.drive; }).length; maxCars = Math.max(maxCars, n); if (sh.car) seen[sh.car.id] = sh.car.state; }
check('2a a car came after ' + GD.SIM.drive.first + ' s and asks', !!sh.car && sh.car.state === 'ask' && sh.car.seat === sh.seats.length && sh.car.items.length >= 2, sh.car && { state: sh.car.state, seat: sh.car.seat, items: sh.car.items.length });
check('2b never two cars', maxCars === 1 && Object.keys(seen).length === 1, { maxCars: maxCars, seen: seen });
check('2c the car is not in the seats', sh.seats.indexOf(sh.car) < 0 && sh.freeSeats().every(function (i) { return i < sh.seats.length; }));
// 3. order, pay, serve: the car leaves happy and another comes after the gap
var car = sh.car, coins0 = sh.save.coins, e0 = sh.earned;
sh.takeOrder(car, 'player', 1);
check('3a paid at the window', car.state === 'wait' && car.paid0 === sh.orderTotal(car) && sh.earned === e0 + car.paid0, { paid0: car.paid0 });
car.items.forEach(function (it) { sh.stations[it.st].ready++; var d = sh.takeDish(it.st); sh.giveDish(car, it.st); });
check('3b served: leaves, counted', car.state === 'out' && sh.cars === 1 && sh.save.stats.cars === 1 && sh.served >= 1 && sh.earned >= e0 + sh.orderTotal(car), { state: car.state, cars: sh.cars, earned: sh.earned - e0 });
check('3c no crumbs at the drive', sh.dirt.length === sh.seats.length && sh.dirt[sh.seats.length] === undefined);
for (t = 0; t < GD.SIM.drive.outT + 0.2; t += 0.05) sh.update(0.05);
check('3d the place is free again, next car in 15-28 s', sh.car === null && sh.carT >= 14.5 && sh.carT <= 28, { carT: sh.carT });
for (t = 0; t < 34; t += 0.05) sh.update(0.05);
check('3e the next car is there', !!sh.car && sh.car.id !== car.id, sh.car && sh.car.id);
// 4. the waiter stays at the counter
var s2 = save(12, 'detente', { serveur: 5, commis: 0 }), sh2 = new Shift(s2, 12, { manual: true, rng: mulberry(9) });
for (t = 0; t < 50; t += 0.05) sh2.update(0.05);
var c2 = sh2.car;
check('4a with a waiter of level 5: counter orders are taken, the car still asks', !!c2 && c2.state === 'ask' && sh2.customers.some(function (c) { return !c.drive && c.state === 'wait'; }), c2 && c2.state);
sh2.takeOrder(c2, 'player', 1); c2.items.forEach(function (it) { sh2.stations[it.st].ready += 2; });
for (t = 0; t < 30; t += 0.05) sh2.update(0.05);
check('4b the waiter does not carry dishes to the car', c2.state === 'wait' && c2.items.every(function (it) { return !it.done; }), c2.items.map(function (it) { return it.done; }));
// 5. Classique: the car leaves angry -> heart lost, paid back
var sh3 = new Shift(save(12, 'classique'), 12, { manual: true, rng: mulberry(5) });
for (t = 0; t < 40 && !(sh3.car && sh3.car.state === 'ask'); t += 0.05) sh3.update(0.05);
var c3 = sh3.car, h0 = sh3.hearts; sh3.takeOrder(c3, 'player', 1); var p3 = c3.paid0; c3.patience = 0.03; sh3.spawnTimer = 999; sh3.update(0.05);
check('5 Classique: an unserved car leaves angry and is paid back, but the drive never costs a heart', c3.state === 'out' && sh3.hearts === h0 && sh3.lost === 1 && sh3.refunds === 1 && sh3.refunded === p3 && c3.paid0 === 0, { state: c3.state, hearts: sh3.hearts, refunds: sh3.refunds });
// 6. the 3D view fails: the car drives away, paid back, the day goes on in the manager view
var sh4 = new Shift(save(12), 12, { manual: true, rng: mulberry(11) });
for (t = 0; t < 40 && !(sh4.car && sh4.car.state === 'ask'); t += 0.05) sh4.update(0.05);
var c4 = sh4.car; sh4.takeOrder(c4, 'player', 1); var e4 = sh4.earned; sh4.events.length = 0; sh4.toAuto();
check('6a toAuto: no car left, paid back', sh4.car === null && !sh4.driveOn && sh4.customers.indexOf(c4) < 0 && sh4.earned === e4 - sh4.orderTotal(c4) && sh4.events.some(function (e) { return e.type === 'gone' && e.c === c4; }));
for (t = 0; t < 400 && !sh4.over; t += 0.05) sh4.update(0.05);
check('6b the day ends normally afterwards', sh4.over && sh4.customers.every(function (c) { return !c.drive; }), { over: sh4.over, earned: sh4.earned });
// 7. end of the day with a car that paid: refund
var sh5 = new Shift(save(12), 12, { manual: true, rng: mulberry(13) });
for (t = 0; t < 40 && !(sh5.car && sh5.car.state === 'ask'); t += 0.05) sh5.update(0.05);
sh5.takeOrder(sh5.car, 'player', 1); var p5 = sh5.car.paid0; sh5.end('time');
check('7 end of the day: the car that paid is paid back', sh5.refunds >= 1 && sh5.refunded >= p5 && sh5.earned === 0, { refunds: sh5.refunds, earned: sh5.earned });
// 9. relaxed mode: a car nobody comes to see drives away after giveUp seconds, without any penalty; it honks before
var sh6 = new Shift(save(12), 12, { manual: true, rng: mulberry(21) }), ev6 = {}, c6 = null, h6 = sh6.hearts;
for (t = 0; t < 16 + 3.6 + GD.SIM.drive.giveUp + 1; t += 0.05) { sh6.update(0.05); if (sh6.car) c6 = sh6.car; sh6.events.forEach(function (e) { if (e.c && e.c.drive) ev6[e.type] = (ev6[e.type] || 0) + 1; }); sh6.events.length = 0; }
check('9a the ignored car left calmly', !!c6 && c6.state === 'out' && c6.calm === true && ev6.giveup === 1 && sh6.hearts === h6 && sh6.lost === 0 && sh6.refunds === 0, { state: c6 && c6.state, ev: ev6 });
check('9b it honked before leaving', ev6.honk === 1, ev6);
var sh7 = new Shift(save(12), 12, { manual: true, rng: mulberry(22) });
for (t = 0; t < 30 && !(sh7.car && sh7.car.state === 'ask'); t += 0.05) sh7.update(0.05);
sh7.car.busy = true; for (t = 0; t < GD.SIM.drive.giveUp + 5; t += 0.05) sh7.update(0.05);
check('9c it does not leave while the player types its order', !!sh7.car && sh7.car.state === 'ask');
sh7.takeOrder(sh7.car, 'player', 1); for (t = 0; t < 80; t += 0.05) sh7.update(0.05);
check('9d a car that paid waits (relaxed mode)', !!sh7.car && sh7.car.state === 'wait');
// 10. Classique: the door closes at the bell, those who paid can still be served, nobody costs a heart any more
var sh8 = new Shift(save(12, 'classique'), 12, { manual: true, rng: mulberry(31) });
for (t = 0; t < 60 && sh8.customers.filter(function (c) { return !c.drive && c.state === 'ask'; }).length < 2; t += 0.05) sh8.update(0.05);
var reg8 = sh8.customers.filter(function (c) { return !c.drive && c.state === 'ask'; }), a8 = reg8[0], b8 = reg8[1], h8 = sh8.hearts;
sh8.takeOrder(a8, 'player', 1); sh8.spawnTimer = 999; sh8.carT = 999; sh8.timeLeft = 0.04; sh8.update(0.05); sh8.update(0.05);
check('10a the bell rings: the day goes on for those who paid', !sh8.over && sh8.closing === true && a8.state === 'wait', { over: sh8.over, closing: sh8.closing });
check('10b who had not ordered leaves calmly', b8.state === 'out' && b8.calm === true && sh8.hearts === h8, { state: b8.state, hearts: sh8.hearts });
a8.patience = 0.02; sh8.update(0.05);
check('10c after the bell, an angry customer is paid back but costs no heart', a8.state === 'out' && sh8.hearts === h8 && sh8.refunds === 1 && sh8.lost === 1, { hearts: sh8.hearts, lost: sh8.lost });
for (t = 0; t < 3; t += 0.05) sh8.update(0.05);
check('10d nobody left: the day ends, and it is not a failure', sh8.over && sh8.endReason === 'time', { over: sh8.over, reason: sh8.endReason });
// 8. goals: the cars are a bonus (not in the potential)
var a = new Shift(save(3), 3, { manual: true }), b = new Shift(save(12), 12, { manual: true });
console.log('potential day 12:', Math.round(b.potential), 'goal', b.goal, b.thresholds, '| day 3 (no drive):', Math.round(a.potential), a.goal);
console.log(ok ? 'ALL PASS' : 'SOME FAILED');
