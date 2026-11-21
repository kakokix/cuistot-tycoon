// ===================== SIMULATOR MODE: first-person view of the kitchen =====================
// The day is the same simulation as in the manager view (Shift), but the player does everything with
// his own hands, like in a real fast-food kitchen:
//   - go to the counter and take the customer's order,
//   - cook each dish step by step (GD.HANDS: put the steak on the grill, turn it, build the burger...),
//   - take the dishes on the tray (3 at most), carry them to the counter and hand them over,
//   - fetch a crate of ingredients in the fridge when a station is empty, wipe the counter.
//   PC     : ZQSD / WASD / arrows to walk (physical keys), mouse to look, click or E to act, 1-4 bonus
//   touch  : left thumb = walk (stick), drag anywhere else = look, big button = act
var Fps = (function () {
  var on = false, sh = null, root = null, hud = null, E = {};
  var P = { x: 0, z: 2.2, yaw: 0, pitch: -0.1, vx: 0, vz: 0, walk: 0 };
  var keys = {}, joy = { id: -1, x0: 0, y0: 0, dx: 0, dy: 0 }, look = { id: -1, x: 0, y: 0, moved: 0, t: 0 };
  var carry = [], crate = false, MAXC = 3, target = null, locked = false, wantLock = false, tHud = 0, bound = false, free = false;
  var EYE = 2.15, ZMIN = 0.98, ZMAX = 3.32, REACH = 2.5;
  var FRIDGE = { x: 6.9, y: 1.35, z: 3.05 };      // the middle of the fridge door (see View3D.buildRoom)
  var DRIVE = { x: -7.62, y: 1.8, z: 2.15 };      // the window of the drive, in the left wall (see View3D.buildRoom)
  var XDRIVE = 6.5;                               // how far to the left the cook can walk (up to the window)
  var touchMode = false, stepN = 0, ambT = 0, actAt = -1e9;
  var reg = null;                                 // the register, while an order is being typed (see openPos)
  var selfExit = false;                           // the game itself has just released the mouse (see onLockChange)

  function el(tag, cls, parent, html) { return UI.el(tag, cls, parent, html); }
  function isTouch() { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }
  function halfLen() { var m = View3D.metrics(); return m.pitch * 4 + 0.75; }

  // ---------------- start / stop ----------------
  function start(shift, opts) {
    opts = opts || {};
    if (on) stop(true);
    if (!View3D.usable()) { UI.toast('Le mode Simulateur a besoin de la vue 3D (Paramètres).'); return false; }
    sh = shift || null; free = !sh;
    root = document.getElementById('screen-game');
    on = true; carry = []; crate = false; target = null; keys = {};
    P.x = 0; P.z = 2.3; P.yaw = 0; P.pitch = -0.12; P.vx = P.vz = 0;
    touchMode = isTouch() && !(window.matchMedia && matchMedia('(pointer: fine)').matches);
    buildHud();
    document.getElementById('app').classList.add('fps');
    View3D.setFps(true);
    if (!View3D.isFull()) { stop(true); UI.toast('La vue 3D n’a pas pu démarrer : mode Simulateur indisponible.'); return false; }
    bind();
    hints(true);
    if (!touchMode) lock();
    return true;
  }
  // bonus keys: 1-4 here (A Z E R are used to walk and act)
  function hints(fps) {
    var ks = document.querySelectorAll('.boosts .rnd .key');
    for (var i = 0; i < ks.length; i++) ks[i].textContent = fps ? String(i + 1) : 'AZER'.charAt(i);
  }
  function stop(silent) {
    if (!on) return;
    // dishes still in the hands go back to their station
    if (sh && !sh.over) carry.forEach(function (d) { sh.putBack(d.st); });
    on = false; sh = null; carry = []; crate = false; target = null; keys = {}; reg = null;
    unlock();
    Sfx.ambOff();
    if (hud) { hud.remove(); hud = null; }
    if (E.touch) { E.touch.remove(); E.touch = null; }
    hints(false);
    document.getElementById('app').classList.remove('fps');
    var st = Scene.v3dState().ST; for (var i = 0; i < st.length; i++) { st[i].hover = false; st[i].el.classList.remove('tg'); }
    View3D.setFps(false);
    if (!silent && free) { Scene.setMode('hub'); }
  }

  // the 3D view broke down during a day: back to the manager's view, and the day goes on that way
  function abort() {
    if (!on) return;
    var s = sh;
    stop(true);
    if (s && !s.over) s.toAuto();
  }

  // ---------------- HUD ----------------
  function buildHud() {
    if (hud) hud.remove();
    hud = el('div', 'fps-hud', root);
    // the layer that catches the look / walk gestures sits just above the picture, under every button
    if (E.touch) E.touch.remove();
    E.touch = el('div', 'fps-touch');
    var cv = root.querySelector('canvas.v3d');
    root.insertBefore(E.touch, cv ? cv.nextSibling : root.firstChild);
    E.cross = el('div', 'fps-cross', hud);
    E.prompt = el('div', 'fps-prompt', hud);
    E.tickets = el('div', 'fps-tickets', hud);
    E.hint = el('div', 'fps-hint', hud);
    E.hands = el('div', 'fps-hands', hud);
    E.coach = el('div', 'fps-coach', hud);
    E.reg = el('div', 'fps-reg', hud);
    E.reg.addEventListener('pointerdown', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      var t = ev.target.closest ? ev.target.closest('[data-a]') : null;
      if (!t) return;
      var a = t.getAttribute('data-a');
      if (a === 'x') closePos(); else if (a === 'u') posUndo(); else if (a === 'ok') posOk();
      else if (a.charAt(0) === 'k') posPick(+a.slice(1));
      else if (a.charAt(0) === 'c') posChange(+a.slice(1));
    });
    // labels standing in the kitchen: the fridge, the places to wipe (see place())
    E.fridge = el('div', 'fps-tag fridge', hud, '<b>FRIGO</b><span>ingrédients</span>');
    E.drive = el('div', 'fps-tag drive', hud, '<b>UNE VOITURE</b><span>attend sa commande</span>');
    E.call = el('div', 'fps-call', hud, '<i></i><b>DRIVE</b><span>une voiture attend</span>');
    E.dirt = [];
    if (touchMode) {
      E.joy = el('div', 'fps-joy', hud, '<i></i>');
      E.act = el('div', 'fps-act', hud, '<span>ACTION</span>');
      E.act.addEventListener('pointerdown', function (ev) { ev.preventDefault(); ev.stopPropagation(); interact(); });
      if (free) E.act.style.display = 'none';          // a visit: nothing to cook
    } else {
      E.hint.innerHTML = '<i class="key wide-key">Z</i><i class="key wide-key">Q</i><i class="key wide-key">S</i><i class="key wide-key">D</i> marcher &nbsp; <i class="key wide-key">Souris</i> regarder &nbsp; <i class="key wide-key">Clic</i> ou <i class="key wide-key">E</i> agir &nbsp; <i class="key wide-key">Échap</i> pause';
    }
    if (free) {
      E.leave = el('div', 'pill fps-leave tap', hud, 'QUITTER LA VISITE');
      E.leave.addEventListener('click', function (ev) { ev.stopPropagation(); Sfx.play('click'); stop(); });
    }
    E.touch.addEventListener('pointerdown', onDown);
    E.touch.addEventListener('pointermove', onMove);
    E.touch.addEventListener('pointerup', onUp);
    E.touch.addEventListener('pointercancel', onUp);
  }

  // ---------------- pointer lock (mouse look) ----------------
  function lock() {
    wantLock = true;
    try {
      var p = root.requestPointerLock && root.requestPointerLock();
      if (p && p.catch) p.catch(function () { });
    } catch (e) { }
  }
  function unlock() {
    wantLock = false;
    try { if (document.pointerLockElement && document.exitPointerLock) { document.exitPointerLock(); selfExit = true; } } catch (e) { }
  }
  function onLockChange() {
    var was = locked, self = selfExit;
    locked = !!document.pointerLockElement; selfExit = false;
    // the game itself has just released the mouse (register, window): the browser says so a little
    // later, sometimes after the mouse was asked for again. That is not the player pressing Esc.
    if (was && !locked && self) return;
    // Esc released the mouse while a day is running: that is "pause"
    if (was && !locked && on && wantLock && sh && !sh.over && !UI.isBlocking() && !Tuto.blocking()) Game.pause();
  }
  function onMouseMove(e) {
    if (!on || !locked || Game.isPaused()) return;
    turn(e.movementX || 0, e.movementY || 0, 0.0024);
  }
  function turn(dx, dy, k) {
    P.yaw -= dx * k;
    P.pitch = Util.clamp(P.pitch - dy * k, -1.15, 0.95);
  }

  // ---------------- touch / mouse without lock ----------------
  function stageXY(ev) {
    var r = document.getElementById('stage').getBoundingClientRect();
    return { x: (ev.clientX - r.left) / App.scale, y: (ev.clientY - r.top) / App.scale };
  }
  function onDown(ev) {
    if (!on) return;
    ev.preventDefault();
    if (reg) return;                              // at the register: no walking, no looking around
    if (ev.pointerType === 'mouse') {
      if (locked) return;
      if (!touchMode && !UI.isBlocking()) { lock(); }
      look.id = ev.pointerId; look.x = ev.clientX; look.y = ev.clientY; look.moved = 0; look.t = performance.now();
      return;
    }
    var p = stageXY(ev);
    if (joy.id < 0 && p.x < App.W * 0.46 && p.y > App.H * 0.42) {
      joy.id = ev.pointerId; joy.x0 = p.x; joy.y0 = p.y; joy.dx = joy.dy = 0;
      if (E.joy) { E.joy.style.left = Math.round(p.x) + 'px'; E.joy.style.top = Math.round(p.y) + 'px'; E.joy.classList.add('on'); }
    } else if (look.id < 0) {
      look.id = ev.pointerId; look.x = ev.clientX; look.y = ev.clientY; look.moved = 0; look.t = performance.now();
    }
    try { E.touch.setPointerCapture(ev.pointerId); } catch (e) { }
  }
  function onMove(ev) {
    if (!on) return;
    if (ev.pointerId === joy.id) {
      var p = stageXY(ev), dx = p.x - joy.x0, dy = p.y - joy.y0, d = Math.sqrt(dx * dx + dy * dy), m = 90;
      if (d > m) { dx *= m / d; dy *= m / d; }
      joy.dx = dx / m; joy.dy = dy / m;
      if (E.joy) E.joy.firstChild.style.transform = 'translate(' + Math.round(dx) + 'px,' + Math.round(dy) + 'px)';
    } else if (ev.pointerId === look.id && !locked) {
      var mx = ev.clientX - look.x, my = ev.clientY - look.y;
      look.x = ev.clientX; look.y = ev.clientY; look.moved += Math.abs(mx) + Math.abs(my);
      if (!Game.isPaused()) turn(mx, my, ev.pointerType === 'mouse' ? 0.004 : 0.0054 / Math.max(0.35, App.scale));
    }
  }
  function onUp(ev) {
    if (ev.pointerId === joy.id) { joy.id = -1; joy.dx = joy.dy = 0; if (E.joy) { E.joy.classList.remove('on'); E.joy.firstChild.style.transform = ''; } }
    else if (ev.pointerId === look.id) {
      // a short tap without moving = act (mouse without lock, or a tap on the picture on a phone)
      if (look.moved < 12 && performance.now() - look.t < 350 && !locked) interact();
      look.id = -1;
    }
  }

  // ---------------- keyboard ----------------
  function onKey(e, down) {
    if (!on) return;
    keys[e.code] = down;
  }
  // called by the main keyboard handler while the simulator is running. Returns true when handled.
  function key(e) {
    var c = e.code || '';
    if (reg) {                                    // the register has its own keys
      var mk = /^(?:Digit|Numpad)([1-9])$/.exec(c);
      if (mk) { if (reg.stage === 'cash') posChange(+mk[1] - 1); else posPick(+mk[1] - 1); }
      else if (c === 'Backspace' || c === 'Delete') posUndo();
      else if ((c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || c === 'KeyE') && !e.repeat) posOk();
      e.preventDefault();
      return true;
    }
    if (c === 'KeyE' || c === 'Enter' || c === 'Space' || c === 'KeyF') { if (!e.repeat) interact(); e.preventDefault(); return true; }
    var m = /^(?:Digit|Numpad)([1-4])$/.exec(c);
    if (m && sh) { Scene.pressBooster(+m[1] - 1); return true; }
    if (c === 'KeyP') { if (sh) Game.pause(); return true; }
    return /^(Key[WASD]|Arrow)/.test(c) || c === 'ShiftLeft';
  }
  function bind() {
    if (bound) return; bound = true;
    document.addEventListener('keydown', function (e) { onKey(e, true); });
    document.addEventListener('keyup', function (e) { onKey(e, false); });
    window.addEventListener('blur', function () { keys = {}; });
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);
    // while the mouse is captured, clicks go to the game screen itself
    document.addEventListener('mousedown', function (e) { if (on && locked && e.button === 0 && !UI.isBlocking()) interact(); });
  }

  // ---------------- update: walking, aiming ----------------
  function update(dt) {
    if (!on) return;
    var paused = Game.isPaused() && !free;
    if ((UI.isBlocking() || Tuto.blocking()) && locked) { var w = wantLock; unlock(); wantLock = w; }
    if (reg && locked) unlock();                  // the register needs the mouse free, whatever happened before
    var fx = 0, fz = 0;
    if (reg) {
      if (reg.closeT) { reg.closeT -= dt; if (reg.closeT <= 0) closePos(); }
      else if (!sh || sh.over || reg.c.state !== 'ask') closePos();         // the customer left, or the day is over
    }
    if (!paused && !UI.isBlocking() && !reg) {
      if (keys.KeyW || keys.ArrowUp) fz += 1;
      if (keys.KeyS || keys.ArrowDown) fz -= 1;
      if (keys.KeyD || keys.ArrowRight) fx += 1;
      if (keys.KeyA || keys.ArrowLeft) fx -= 1;
      fx += joy.dx; fz -= joy.dy;
    }
    var len = Math.sqrt(fx * fx + fz * fz);
    if (len > 1) { fx /= len; fz /= len; }
    // a crate is heavy: no running with it
    var sp = 4.4 * (keys.ShiftLeft && !crate ? 1.45 : 1) * (crate ? 0.88 : 1), s = Math.sin(P.yaw), c = Math.cos(P.yaw);
    // forward is -z when yaw = 0 (towards the counter)
    var tx = (fx * c - fz * s) * sp, tz = (-fx * s - fz * c) * sp, k = Math.min(1, dt * 12);
    P.vx += (tx - P.vx) * k; P.vz += (tz - P.vz) * k;
    var hl = halfLen();
    P.x = Util.clamp(P.x + P.vx * dt, -Math.max(hl, XDRIVE), hl);
    P.z = Util.clamp(P.z + P.vz * dt, ZMIN, ZMAX);
    var v = Math.sqrt(P.vx * P.vx + P.vz * P.vz);
    P.walk += v * dt * 2.3;
    // footsteps: one at each low point of the head bob
    var sn = Math.floor(P.walk * 3.1 / Math.PI);
    if (sn !== stepN) { stepN = sn; if (v > 1.2) Sfx.play(sn % 2 ? 'step' : 'step2'); }
    if (!paused) aim();
    tHud -= dt;
    if (tHud <= 0) { tHud = 0.12; drawHud(); }
    ambT -= dt;
    if (ambT <= 0) { ambT = 0.1; ambient(paused); }
  }

  // the sounds of the kitchen: louder when the player stands next to what is cooking
  function ambient(paused) {
    var a = { sizzle: 0, fry: 0, boil: 0, whirr: 0 };
    if (sh && !sh.over && !paused) {
      var m = View3D.metrics(), KIND = { grill: 'sizzle', wok: 'sizzle', frites: 'fry', pizza: 'boil', soupe: 'boil', jus: 'whirr', gateau: 'whirr' };
      for (var i = 0; i < 8; i++) {
        var s = sh.stations[i], kind = KIND[s.def.id], n = 0;
        if (!kind) continue;
        for (var j = 0; j < s.cooking.length; j++) { var ph = s.cooking[j].ph; if (ph === 'cook' || (ph !== 'fin' && ph !== 'burnt' && kind !== 'whirr')) n++; }
        if (!n) continue;
        var dx = m.geo[i].x - P.x, dz = m.zSt - P.z, d = Math.sqrt(dx * dx + dz * dz);
        a[kind] = Math.max(a[kind], Math.max(0.12, 1 - d / 7.5) * Math.min(1, 0.7 + 0.15 * n));
      }
    }
    Sfx.amb(a);
  }

  // ---------------- what the player is aiming at ----------------
  // where each kind of target is in the kitchen (the test robots use it too)
  function pos(type, i) {
    var m = View3D.metrics();
    if (type === 'station') return { x: m.geo[i].x, y: m.wtTop + 0.3, z: m.zSt - 0.15 };
    if (type === 'fridge') return FRIDGE;
    if (type === 'cust' && sh && i >= sh.seats.length) return DRIVE;      // the car of the drive has the place after the last one
    var sx = View3D.seatX(i, sh ? sh.seats.length : 3);
    if (type === 'dirt') return { x: sx, y: 1.28, z: 0.12 };
    return { x: sx, y: 1.9, z: -1.15 };                 // a customer
  }
  function aim() {
    var cp = Math.cos(P.pitch);
    var f = { x: -Math.sin(P.yaw) * cp, y: Math.sin(P.pitch), z: -Math.cos(P.yaw) * cp };
    var best = null, bs = -1, st = Scene.v3dState().ST, i;
    function test(type, idx, reach, minCos, obj) {
      var p = pos(type, idx), dx = p.x - P.x, dy = p.y - EYE, dz = p.z - P.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > reach) return;
      var cs = (dx * f.x + dy * f.y + dz * f.z) / d;
      if (cs < minCos) return;
      var sc = cs - d * 0.04;
      if (sc > bs) { bs = sc; best = { type: type, i: idx, d: d, obj: obj }; }
    }
    for (i = 0; i < 8; i++) test('station', i, REACH, 0.8);
    if (sh) {
      var n = sh.seats.length;
      for (i = 0; i < n; i++) {
        var c = sh.seats[i];
        if (c && c.state !== 'out') test('cust', i, 3.3, 0.87, c);
        if (sh.dirt[i]) test('dirt', i, 2.7, 0.93);
      }
      test('fridge', 0, 2.9, 0.8);
      if (sh.car && sh.car.state !== 'out') test('cust', n, 3.4, 0.86, sh.car);
    }
    for (i = 0; i < 8; i++) { var isT = !!best && best.type === 'station' && best.i === i; st[i].hover = isT; st[i].el.classList.toggle('tg', isT); }
    target = best;
  }

  function dishName(si) { return GD.STATIONS[si].dishName; }
  function clean(t) { return t.charAt(0) === '+' ? t.slice(1) : t; }
  function heldOf(si) { var n = 0; for (var k = 0; k < carry.length; k++) if (carry[k].st === si) n++; return n; }
  // the gesture the player would do now.  { txt, can, act }   act: order give wipe crate uncrate
  //   restock trash mid fin take cook
  function describe() {
    if (!target || reg) return { txt: '', can: false };
    var t = target, i = t.i;
    if (t.type === 'station') {
      var def = GD.STATIONS[i];
      if (!sh) return { txt: def.name, can: false };
      var s = sh.stations[i], hd = s.hd, u;
      if (!s.owned) return { txt: def.name + ' : à acheter dans la boutique', can: false };
      if (crate) {
        if (s.stock >= s.stockMax) return { txt: def.name + ' : le stock est déjà plein', can: false };
        return { txt: 'Ranger la caisse : ' + def.name, can: true, act: 'restock' };
      }
      if (sh.unitIn(i, 'burnt')) return { txt: 'Jeter : c’est brûlé !', can: true, act: 'trash' };
      if (sh.unitIn(i, 'mid')) return { txt: hd.mid, can: true, act: 'mid' };
      var room = carry.length < MAXC, want = sh.wanted(i) - heldOf(i);
      if (s.ready > 0 && room && want > 0) return { txt: 'Prendre : ' + def.dishName, can: true, act: 'take' };
      u = sh.nextFin(i);
      if (u) {
        var step = hd.fin[u.fin], n = hd.fin.length;
        if (step.charAt(0) === '+' && s.ready >= GD.SIM.pass) return { txt: 'Le passe est plein : sers d’abord ces plats', can: false };
        return { txt: clean(step) + (n > 1 ? ' <small>' + (u.fin + 1) + '/' + n + '</small>' : ''), can: true, act: 'fin' };
      }
      // a dish in the hands that nobody is waiting for any more goes back on the pass
      if (heldOf(i) > sh.wanted(i) && s.ready < GD.SIM.pass) return { txt: 'Reposer : ' + def.dishName, can: true, act: 'back' };
      if (s.ready > 0 && room) return { txt: 'Prendre : ' + def.dishName, can: true, act: 'take' };
      if (s.ready > 0) return { txt: 'Mains pleines ! Sers d’abord un client', can: false };
      if (sh.canCook(i)) {
        if (s.stock <= 0) return { txt: 'Plus d’ingrédients : va chercher une caisse au frigo', can: false, empty: true };
        return { txt: hd.start, can: true, act: 'cook' };
      }
      u = sh.unitIn(i, 'cook');
      if (u) return { txt: hd.cook + '… ' + Math.round(100 * Math.min(1, u.t / u.total)) + ' %', can: false };
      return { txt: def.name, can: false };
    }
    if (t.type === 'fridge') {
      if (crate) return { txt: 'Reposer la caisse', can: true, act: 'uncrate' };
      if (carry.length) return { txt: 'Frigo : sers d’abord tes plats', can: false };
      return { txt: 'Prendre une caisse d’ingrédients', can: true, act: 'crate' };
    }
    if (t.type === 'dirt') return crate ? { txt: 'Pose d’abord la caisse', can: false } : { txt: 'Essuyer le comptoir', can: true, act: 'wipe' };
    var c = t.obj, who = (GD.PEOPLE[c.animal] && GD.introduced(App.save, c.animal)) ? GD.PEOPLE[c.animal].name : 'ce client';
    if (c.drive) who = 'la voiture';
    if (c.state === 'ask') return { txt: c.drive ? 'Drive : prendre la commande' : 'Prendre la commande', can: true, act: 'order' };
    if (c.state !== 'wait') return { txt: '', can: false };
    for (var k = 0; k < carry.length; k++) if (sh.wants(c, carry[k].st)) return { txt: 'Servir ' + who, can: true, act: 'give' };
    var miss = c.items.filter(function (it) { return !it.done; }).map(function (it) { return dishName(it.st); });
    return { txt: who.charAt(0).toUpperCase() + who.slice(1) + ' attend : ' + miss.join(', '), can: false };
  }

  // ---------------- the next thing to do ----------------
  // What a sensible cook would go and do now: { type, i, act }. The coach of the first days says it
  // in words, and the test robots follow it.
  function plan() {
    if (!sh || sh.over) return null;
    if (reg) return { type: 'cust', i: reg.c.seat, act: 'reg' };
    var cs = sh.customers, i, k, st, u;
    if (crate) {                              // a crate in the hands: to the emptiest station
      var bs = -1, lo = 99;
      for (i = 0; i < 8; i++) { st = sh.stations[i]; if (st.owned && st.stock < st.stockMax && st.stock < lo) { lo = st.stock; bs = i; } }
      return bs >= 0 ? { type: 'station', i: bs, act: 'restock' } : { type: 'fridge', i: 0, act: 'uncrate' };
    }
    for (i = 0; i < cs.length; i++) for (k = 0; k < carry.length; k++) if (sh.wants(cs[i], carry[k].st)) return { type: 'cust', i: cs[i].seat, act: 'give' };
    for (i = 0; i < 8; i++) { u = sh.unitIn(i, 'burnt'); if (u && u.by !== 'commis') return { type: 'station', i: i, act: 'trash' }; }
    for (i = 0; i < 8; i++) { u = sh.unitIn(i, 'mid'); if (u && u.by !== 'commis') return { type: 'station', i: i, act: 'mid' }; }
    // (once the door is closed, those who already paid come first: a new order waits)
    // (a car is a big order and nobody is forced to take it: with three orders already running, two in
    // Classique, it is left alone and drives away by itself)
    var busyN = 0;
    for (i = 0; i < cs.length; i++) if (cs[i].state === 'wait') busyN++;
    function asks(c) { return c.state === 'ask' && !(c.drive && busyN >= (sh.relax ? 3 : 2)); }
    if (!sh.closing) for (i = 0; i < cs.length; i++) if (asks(cs[i])) return { type: 'cust', i: cs[i].seat, act: 'order' };
    if (carry.length < MAXC) for (i = 0; i < 8; i++) { st = sh.stations[i]; if (st.ready > 0 && sh.wanted(i) > heldOf(i)) return { type: 'station', i: i, act: 'take' }; }
    for (i = 0; i < 8; i++) {
      st = sh.stations[i]; u = sh.nextFin(i);
      if (!u || u.by === 'commis') continue;
      var plus = st.hd.fin[u.fin].charAt(0) === '+';
      if (plus && st.ready >= GD.SIM.pass) continue;
      if (u.ph === 'done' || !plus || sh.wanted(i) > heldOf(i) + st.ready) return { type: 'station', i: i, act: 'fin', u: u };
    }
    var nd = sh.needs(), best = -1, bn = 0;
    for (k = 0; k < 8; k++) if (sh.canCook(k) && nd[k] > bn) { bn = nd[k]; best = k; }
    if (best >= 0) {
      if (sh.stations[best].stock > 0) return { type: 'station', i: best, act: 'cook' };
      if (!carry.length) return { type: 'fridge', i: 0, act: 'crate' };
    }
    if (sh.closing) for (i = 0; i < cs.length; i++) if (asks(cs[i])) return { type: 'cust', i: cs[i].seat, act: 'order' };
    if (!carry.length) for (i = 0; i < sh.seats.length; i++) if (sh.dirt[i]) return { type: 'dirt', i: i, act: 'wipe' };
    return null;
  }
  function low(t) { return t.charAt(0).toLowerCase() + t.slice(1); }
  function coachText(g) {
    var nm = g.type === 'station' ? GD.STATIONS[g.i].name : '', hd = g.type === 'station' ? sh.stations[g.i].hd : null;
    var drv = g.type === 'cust' && g.i >= sh.seats.length;
    switch (g.act) {
      case 'order': return drv ? 'Une voiture attend au drive, à gauche : prends sa commande' : 'Un client attend au comptoir : prends sa commande';
      case 'reg': return 'Caisse : tape ce que demande le client, puis ENCAISSER';
      case 'give': return drv ? 'Apporte la commande à la voiture, au drive' : 'Apporte le plat au client, au comptoir';
      case 'trash': return nm + ' : c’est brûlé, jette-le';
      case 'mid': return nm + ' : ' + low(hd.mid);
      case 'take': return nm + ' : prends ' + low(GD.STATIONS[g.i].dishName);
      case 'fin': return nm + ' : ' + low(clean(hd.fin[g.u.fin]));
      case 'cook': return nm + ' : ' + low(hd.start);
      case 'crate': return 'Plus d’ingrédients : prends une caisse au frigo';
      case 'restock': return 'Range la caisse : ' + nm;
      case 'uncrate': return 'Repose la caisse au frigo';
      case 'wipe': return 'Essuie le comptoir';
    }
    return '';
  }
  // an arrow towards the thing to do: ahead, on the left, on the right or behind the player
  function arrowTo(g) {
    var p = pos(g.type, g.i), want = Math.atan2(-(p.x - P.x), -(p.z - P.z)), d = want - P.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return Math.abs(d) < 0.45 ? 'up' : Math.abs(d) > 2.5 ? 'down' : d > 0 ? 'left' : 'right';
  }
  // on during the first three days by hand, then only if the player asks for it (pause window)
  function coachOn() { var c = App.save.settings.coach; return !!sh && (c === true || (c !== false && (App.save.stats.simH || 0) < 3)); }

  // ---------------- the register ----------------
  // E on a customer who wants to order opens the register: the customer says what he wants, the
  // player types it (keys 1-8 or the buttons) and cashes. He pays the price at once, by card or in
  // cash (then the right change has to be given back). Time goes on meanwhile, like in a real rush.
  function sayOrder(c, again) {
    var cnt = {}, ord = [];
    c.items.forEach(function (it) { if (!cnt[it.st]) { cnt[it.st] = 0; ord.push(it.st); } cnt[it.st]++; });
    var parts = ord.map(function (st) { return GD.SAY[GD.STATIONS[st].dish][Math.min(3, cnt[st]) - 1]; });
    var list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' et ' + parts[parts.length - 1] : parts[0];
    var T = again ? ['Non… je répète : {l}.', 'Pas tout à fait ! Je voudrais {l}.']
      : c.drive ? ['Bonjour ! À emporter : {l}, s’il vous plaît.', 'C’est pour emporter : {l}.', 'Salut chef ! Je prends {l}, à emporter.']
      : ['Bonjour ! Je voudrais {l}, s’il vous plaît.', 'Pour moi, ce sera {l}.', 'Salut chef ! {L}, s’il vous plaît.', 'Je vais prendre {l}.'];
    return T[c.id % T.length].replace('{l}', list).replace('{L}', list.charAt(0).toUpperCase() + list.slice(1));
  }
  function openPos(c) {
    if (c.cash == null) c.cash = Math.random() < GD.SIM.cash;
    c.busy = true;                                // the waiter leaves this customer to the player
    reg = { c: c, pick: [], stage: 'order', err: 0, say: sayOrder(c, false), closeT: 0, total: sh.orderTotal(c), shake: 0 };
    P.vx = P.vz = 0; joy.dx = joy.dy = 0; joy.id = -1; look.id = -1;
    if (E.joy) { E.joy.classList.remove('on'); E.joy.firstChild.style.transform = ''; }
    if (!touchMode) unlock();                     // the mouse is free to press the keys of the register
    Sfx.play('order');
    drawPos(); drawHud();
  }
  // noLock: closed with the Escape key. The browser would release the mouse again at once (and the
  // game would take that for "pause"): the next click on the picture captures it.
  function closePos(noLock) {
    if (!reg) return;
    if (reg.c && reg.c.state === 'ask') reg.c.busy = false;
    reg = null;
    if (E.reg) E.reg.className = 'fps-reg';
    if (noLock !== true && on && !touchMode && !UI.isBlocking()) lock();
    drawHud();
  }
  function posPick(k) {
    if (!reg || reg.stage !== 'order' || reg.closeT) return;
    var st = sh.menu[k];
    if (st == null) return;
    if (reg.pick.length >= 6) { Sfx.play('nope'); return; }
    reg.pick.push(st); Sfx.play('tick'); drawPos();
  }
  function posUndo() { if (reg && reg.stage === 'order' && reg.pick.length) { reg.pick.pop(); Sfx.play('soft'); drawPos(); } }
  function posOk() {
    if (!reg || reg.stage !== 'order' || reg.closeT) return;
    if (!reg.pick.length) { Sfx.play('nope'); return; }
    var c = reg.c, want = {}, got = {}, ok = true, k;
    c.items.forEach(function (it) { want[it.st] = (want[it.st] || 0) + 1; });
    reg.pick.forEach(function (st) { got[st] = (got[st] || 0) + 1; });
    for (k in want) if (want[k] !== got[k]) ok = false;
    for (k in got) if (want[k] !== got[k]) ok = false;
    if (!ok) {                                    // wrong: the customer says it again
      reg.err++; reg.pick = []; reg.say = sayOrder(c, true); reg.shake = performance.now();
      sh.posError(c); drawPos();
      return;
    }
    var bills = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000], given = 0;
    for (k = 0; k < bills.length; k++) if (bills[k] > reg.total) { given = bills[k]; break; }
    if (c.cash && given) {
      // cash: three amounts, only one is the right change
      var ch = given - reg.total, d = given >= 1000 ? 100 : given >= 100 ? 10 : given >= 20 ? 2 : 1;
      var o = [ch, ch + d, ch - d > 0 ? ch - d : ch + 2 * d];
      for (k = 2; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), t = o[k]; o[k] = o[j]; o[j] = t; }
      reg.stage = 'cash'; reg.given = given; reg.change = ch; reg.opts = o;
      reg.say = 'Je paie en espèces : voilà ' + given + ' pièces.';
      Sfx.play('pop'); drawPos();
    } else posDone(1, 'Je paie par carte… bip ! Merci.');
  }
  function posChange(k) {
    if (!reg || reg.stage !== 'cash' || reg.closeT || k < 0 || k >= reg.opts.length) return;
    var good = reg.opts[k] === reg.change;
    if (!good) Sfx.play('nope');
    posDone(good ? GD.SIM.changeGood : GD.SIM.changeBad, good ? 'Le compte est bon, merci !' : 'Hmm… ce n’est pas la bonne monnaie.');
  }
  function posDone(tipK, msg) {
    var c = reg.c;
    reg.stage = 'done'; reg.say = msg; reg.closeT = 0.8;
    sh.takeOrder(c, 'player', tipK);
    drawPos();
  }
  // (test robots) types the right order and gives the right change
  function posSolve() {
    if (!reg) return false;
    if (reg.stage === 'order') { reg.pick = reg.c.items.map(function (it) { return it.st; }); posOk(); }
    if (reg && reg.stage === 'cash') posChange(reg.opts.indexOf(reg.change));
    return true;
  }
  function drawPos() {
    if (!E.reg || !reg) return;
    var c = reg.c, i, coin = '<img class="coin" src="' + Art.coin() + '">';
    var h = '<div class="reg-say"><b style="background-image:var(--a-cu_' + c.animal + '_neutral)"></b>' + (c.drive ? '<u class="reg-drive">DRIVE</u>' : '') + '<span>« ' + reg.say + ' »</span></div>';
    if (reg.stage === 'order') {
      h += '<div class="reg-grid">';
      for (i = 0; i < sh.menu.length; i++) {
        var d = GD.STATIONS[sh.menu[i]];
        h += '<div class="reg-key" data-a="k' + i + '"><em>' + (i + 1) + '</em><i style="background-image:' + Art.dishBg(d.dish) + '"></i><span>' + d.dishName + '</span></div>';
      }
      h += '</div>';
      var cnt = {}, ord = [], tot = 0;
      reg.pick.forEach(function (st) { if (!cnt[st]) { cnt[st] = 0; ord.push(st); } cnt[st]++; tot += sh.stations[st].price; });
      if (c.vip) tot *= 2;
      h += '<div class="reg-ticket"><div class="reg-items">' + (ord.length ? ord.map(function (st) {
        return '<u><i style="background-image:' + Art.dishBg(GD.STATIONS[st].dish) + '"></i>×' + cnt[st] + '</u>';
      }).join('') : '<s>Tape la commande du client…</s>') + '</div><div class="reg-total">' + Math.round(tot) + ' ' + coin + '</div></div>';
      h += '<div class="reg-acts"><div class="reg-btn x" data-a="x">✕</div><div class="reg-btn clear" data-a="u">⌫ Effacer</div>' +
        '<div class="reg-btn ok' + (reg.pick.length ? '' : ' off') + '" data-a="ok">ENCAISSER<em>Entrée</em></div></div>';
    } else if (reg.stage === 'cash') {
      h += '<div class="reg-cash">Total : <b>' + reg.total + '</b> ' + coin + ' &nbsp;•&nbsp; Reçu : <b>' + reg.given + '</b> ' + coin + '<br>Combien lui rends-tu ?</div><div class="reg-grid cash">';
      for (i = 0; i < reg.opts.length; i++) h += '<div class="reg-key cashk" data-a="c' + i + '"><em>' + (i + 1) + '</em><span>' + reg.opts[i] + '</span></div>';
      h += '</div>';
    } else h += '<div class="reg-cash done">✔ Commande enregistrée : ' + reg.total + ' ' + coin + '</div>';
    E.reg.innerHTML = h;
    E.reg.className = 'fps-reg on' + (touchMode ? ' touch' : '') + (reg.shake && performance.now() - reg.shake < 400 ? ' err' : '');
  }

  // ---------------- act ----------------
  function interact() {
    if (!on || !sh || sh.over || Game.isPaused() || reg) return;
    if (!target) return;
    var d = describe(), i = target.i;
    if (!d.can) { if (d.txt) { Sfx.play('nope'); if (d.empty) UI.toast('Le frigo est au bout de la cuisine, à droite du comptoir.'); } return; }
    actAt = performance.now();              // the right hand reaches out (see View3D.syncHands)
    if (target.type === 'station') {
      var o = Scene.v3dState().ST[i];
      o.bumpT = performance.now();
      if (d.act === 'take') {
        var dish = sh.takeDish(i);
        if (dish) { carry.push(dish); Sfx.play('pop'); Vib.buzz(12); }
      } else if (d.act === 'back') {
        for (var b = carry.length - 1; b >= 0; b--) if (carry[b].st === i) { carry.splice(b, 1); sh.putBack(i); Sfx.play('pop'); break; }
      } else if (d.act === 'cook') { sh.cook(i, 'chef'); Tuto.onAction('station', i, 'cook'); }
      else if (d.act === 'mid') sh.midAct(i, 'chef');
      else if (d.act === 'fin') sh.finAct(i, 'chef');
      else if (d.act === 'trash') sh.trash(i, 'chef');
      else if (d.act === 'restock') { if (sh.restock(i, 'chef')) crate = false; }
    } else if (target.type === 'fridge') {
      crate = d.act === 'crate';
      Sfx.play(crate ? 'crate' : 'pop'); Vib.buzz(14);
    } else if (target.type === 'dirt') sh.wipe(i, 'player');
    else {
      var c = target.obj, given = 0;
      if (d.act === 'order') { openPos(c); return; }
      else {
        for (var j = carry.length - 1; j >= 0; j--) {
          if (sh.giveDish(c, carry[j].st)) { carry.splice(j, 1); given++; if (c.state !== 'wait') break; }
        }
        if (!given) Sfx.play('nope');
      }
    }
    drawHud();
  }
  // a tap on a station / customer label (touch): same as aiming at it and pressing the button
  function tapStation(i) {
    if (!on) return false;
    if (target && target.type === 'station' && target.i === i) interact();
    else UI.toast('Approche-toi et regarde la station');
    return true;
  }

  // ---------------- HUD refresh ----------------
  var SHORT = { order: 'COMMANDE', give: 'SERVIR', take: 'PRENDRE', back: 'REPOSER', trash: 'JETER', wipe: 'ESSUYER', crate: 'PRENDRE', uncrate: 'REPOSER', restock: 'RANGER' };
  function shortOf(d) {
    if (!d.act) return 'ACTION';
    if (SHORT[d.act]) return SHORT[d.act];
    return d.txt.replace(/<[^>]*>.*$/, '').split(' ')[0].toUpperCase();      // the verb of the gesture
  }
  function drawHud() {
    if (!hud) return;
    if (hud._pos !== !!reg) { hud._pos = !!reg; hud.classList.toggle('posing', !!reg); }
    var d = describe();
    var key = touchMode ? '' : '<i class="key wide-key">E</i> ';
    var html = d.txt ? (d.can ? key : '') + d.txt : '';
    if (E.prompt._v !== html) { E.prompt._v = html; E.prompt.innerHTML = html; E.prompt.className = 'fps-prompt' + (d.txt ? ' on' : '') + (d.can ? ' can' : ''); }
    E.cross.className = 'fps-cross' + (d.can ? ' can' : target ? ' aim' : '');
    if (E.act) { E.act.className = 'fps-act' + (d.can ? ' can' : ''); E.act.firstChild.textContent = shortOf(d); }
    if (!sh) { E.tickets.innerHTML = ''; return; }
    // what the hands carry, said in words (the crate hides the tray)
    var hv = crate ? 'Caisse d’ingrédients : range-la dans une station' : '';
    if (E.hands._v !== hv) { E.hands._v = hv; E.hands.textContent = hv; E.hands.className = 'fps-hands' + (hv ? ' on' : ''); }
    // the coach of the first days: what to do next, and where it is
    var cv = '';
    if (coachOn() && !Game.isPaused()) { var g = plan(); if (g) cv = '<i class="ar ' + arrowTo(g) + '"></i><span>' + coachText(g) + '</span>'; }
    if (E.coach._v !== cv) { E.coach._v = cv; E.coach.innerHTML = cv; E.coach.className = 'fps-coach' + (cv ? ' on' : ''); }
    // order tickets: "?" while nobody took the order
    var t = '';
    var tl = sh.car ? sh.seats.concat([sh.car]) : sh.seats;       // the car of the drive has its ticket too
    for (var s = 0; s < tl.length; s++) {
      var c = tl[s];
      if (!c || (c.state !== 'wait' && c.state !== 'ask')) continue;
      var r = Math.max(0, c.patience / c.maxPatience);
      t += '<div class="tk' + (c.drive ? ' car' : '') + (c.state === 'ask' ? ' ask' : '') + (target && target.type === 'cust' && target.obj === c ? ' tg' : '') + '"><b style="background-image:var(--a-cu_' + c.animal + '_neutral)"></b>';
      if (c.state === 'ask') t += '<em>?</em>';
      else for (var j = 0; j < c.items.length; j++) t += '<i class="' + (c.items[j].done ? 'done' : '') + '" style="background-image:' + Art.dishBg(c.items[j].dish) + '"></i>';
      t += '<u><s style="width:' + Math.round(r * 100) + '%" class="' + (r < 0.3 ? 'low' : r < 0.6 ? 'mid' : '') + '"></s></u></div>';
    }
    if (E.tickets._v !== t) { E.tickets._v = t; E.tickets.innerHTML = t; }
  }

  // called by the 3D view after each picture: the labels of the kitchen follow the things they name
  function tag(e, show, p, cls) {
    var v = show ? 'visible' : 'hidden';
    if (e._v !== v) { e._v = v; e.style.visibility = v; }
    if (!show) return;
    e.style.left = p.x.toFixed(1) + 'px'; e.style.top = p.y.toFixed(1) + 'px';
    if (cls !== undefined && e._c !== cls) { e._c = cls; e.className = cls; }
  }
  function place(scr) {
    if (!hud || !E.fridge) return;
    var p = scr(FRIDGE.x, 2.3, FRIDGE.z), i, empty = false;
    if (sh) for (i = 0; i < 8; i++) if (sh.stations[i].owned && sh.stations[i].stock <= 0) empty = true;
    tag(E.fridge, !!sh && !sh.over && p.front && Math.abs(FRIDGE.x - P.x) < 9 && p.x > -120 && p.x < App.W + 120, p,
      'fps-tag fridge' + (empty && !crate ? ' alert' : '') + (target && target.type === 'fridge' ? ' tg' : ''));
    // the drive: a label above the window, and a call on the edge of the screen while a car waits out of sight
    var car = sh && !sh.over ? sh.car : null, asks = !!car && car.state === 'ask' && !reg;
    p = scr(DRIVE.x, 2.86, DRIVE.z);
    var seen = p.front && p.x > 40 && p.x < App.W - 40;
    // (the sign above the window already says DRIVE: the label only calls when a car waits for its order)
    tag(E.drive, asks && p.front && p.x > -120 && p.x < App.W + 120 && !(target && target.type === 'cust' && target.obj === car), p, 'fps-tag drive alert');
    var cv = asks && !seen ? (arrowTo({ type: 'cust', i: sh.seats.length }) === 'right' ? 'fps-call on r' : 'fps-call on') : 'fps-call';
    if (E.call._c !== cv) { E.call._c = cv; E.call.className = cv; }
    var n = sh ? sh.seats.length : 0;
    while (E.dirt.length < n) E.dirt.push(el('div', 'fps-tag dirt', hud, 'À essuyer'));
    for (i = 0; i < E.dirt.length; i++) {
      var on2 = i < n && sh.dirt[i], q = on2 ? pos('dirt', i) : null;
      if (on2) p = scr(q.x, q.y + 0.2, q.z);
      tag(E.dirt[i], !!on2 && p.front && p.x > -80 && p.x < App.W + 80 && Math.abs(q.x - P.x) < 6, p,
        'fps-tag dirt' + (target && target.type === 'dirt' && target.i === i ? ' tg' : ''));
    }
  }

  function cam() {
    var bob = Math.sin(P.walk * 3.1) * 0.035;
    return { x: P.x, y: EYE + bob, z: P.z, yaw: P.yaw, pitch: P.pitch, fov: App.wide ? 64 : 88, carry: carry, crate: crate, bob: bob, actT: (performance.now() - actAt) / 1000 };
  }
  // where the "hands" are on screen (dishes fly from there to the customer)
  function handsPos() { return { x: App.W / 2, y: App.H * (App.wide ? 0.8 : 0.76) }; }

  return {
    start: start, stop: stop, update: update, cam: cam, key: key, interact: interact, tapStation: tapStation, handsPos: handsPos,
    active: function () { return on; }, isFree: function () { return on && free; }, carrying: function () { return carry.length; },
    relock: function () { if (on && !touchMode && !locked && !UI.isBlocking() && !reg) lock(); },
    posOpen: function () { return !!reg; }, posClose: function () { closePos(true); },
    FRIDGE: FRIDGE, DRIVE: DRIVE, place: place, coachOn: coachOn, abort: abort, _xmin: function () { return -Math.max(halfLen(), XDRIVE); },
    _p: P, _target: function () { return target; }, _describe: describe, _carry: function () { return carry; }, _crate: function () { return crate; },
    _pos: pos, _aim: aim, _plan: plan, _reg: function () { return reg; }, _posSolve: posSolve
  };
})();
