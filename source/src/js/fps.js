// ===================== SIMULATOR MODE: first-person view of the kitchen =====================
// The day is the same simulation as in the manager view (Shift), but the player walks in the kitchen:
// aim at a station to start cooking, take the dish when it is ready (up to 3 in the hands), carry it
// to the counter and hand it to the customer who ordered it.
//   PC     : ZQSD / WASD / arrows to walk (physical keys), mouse to look, click or E to act, 1-4 bonus
//   touch  : left thumb = walk (stick), drag anywhere else = look, big button = act
var Fps = (function () {
  var on = false, sh = null, root = null, hud = null, E = {};
  var P = { x: 0, z: 2.2, yaw: 0, pitch: -0.1, vx: 0, vz: 0, walk: 0 };
  var keys = {}, joy = { id: -1, x0: 0, y0: 0, dx: 0, dy: 0 }, look = { id: -1, x: 0, y: 0, moved: 0, t: 0 };
  var carry = [], MAXC = 3, target = null, locked = false, wantLock = false, tHud = 0, bound = false, free = false;
  var EYE = 2.15, ZMIN = 0.98, ZMAX = 3.32, REACH = 2.5;
  var touchMode = false;

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
    on = true; carry = []; target = null; keys = {};
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
    on = false; sh = null; carry = []; target = null; keys = {};
    unlock();
    if (hud) { hud.remove(); hud = null; }
    if (E.touch) { E.touch.remove(); E.touch = null; }
    hints(false);
    document.getElementById('app').classList.remove('fps');
    var st = Scene.v3dState().ST; for (var i = 0; i < st.length; i++) { st[i].hover = false; st[i].el.classList.remove('tg'); }
    View3D.setFps(false);
    if (!silent && free) { Scene.setMode('hub'); }
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
    try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (e) { }
  }
  function onLockChange() {
    var was = locked;
    locked = !!document.pointerLockElement;
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
    var fx = 0, fz = 0;
    if (!paused && !UI.isBlocking()) {
      if (keys.KeyW || keys.ArrowUp) fz += 1;
      if (keys.KeyS || keys.ArrowDown) fz -= 1;
      if (keys.KeyD || keys.ArrowRight) fx += 1;
      if (keys.KeyA || keys.ArrowLeft) fx -= 1;
      fx += joy.dx; fz -= joy.dy;
    }
    var len = Math.sqrt(fx * fx + fz * fz);
    if (len > 1) { fx /= len; fz /= len; }
    var sp = 4.4 * (keys.ShiftLeft ? 1.45 : 1), s = Math.sin(P.yaw), c = Math.cos(P.yaw);
    // forward is -z when yaw = 0 (towards the counter)
    var tx = (fx * c - fz * s) * sp, tz = (-fx * s - fz * c) * sp, k = Math.min(1, dt * 12);
    P.vx += (tx - P.vx) * k; P.vz += (tz - P.vz) * k;
    var hl = halfLen();
    P.x = Util.clamp(P.x + P.vx * dt, -hl, hl);
    P.z = Util.clamp(P.z + P.vz * dt, ZMIN, ZMAX);
    var v = Math.sqrt(P.vx * P.vx + P.vz * P.vz);
    P.walk += v * dt * 2.3;
    if (!paused) aim();
    tHud -= dt;
    if (tHud <= 0) { tHud = 0.15; drawHud(); }
  }

  function aim() {
    var m = View3D.metrics(), cp = Math.cos(P.pitch);
    var f = { x: -Math.sin(P.yaw) * cp, y: Math.sin(P.pitch), z: -Math.cos(P.yaw) * cp };
    var best = null, bs = -1, st = Scene.v3dState().ST, i;
    function test(type, idx, x, y, z, reach, minCos, obj) {
      var dx = x - P.x, dy = y - EYE, dz = z - P.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > reach) return;
      var cs = (dx * f.x + dy * f.y + dz * f.z) / d;
      if (cs < minCos) return;
      var sc = cs - d * 0.04;
      if (sc > bs) { bs = sc; best = { type: type, i: idx, d: d, obj: obj }; }
    }
    for (i = 0; i < 8; i++) test('station', i, m.geo[i].x, m.wtTop + 0.3, m.zSt - 0.15, REACH, 0.8);
    if (sh) {
      var n = sh.seats.length;
      for (i = 0; i < n; i++) {
        var c = sh.seats[i];
        if (!c || c.state === 'out') continue;
        test('cust', i, View3D.seatX(i, n), 1.9, -1.15, 3.3, 0.87, c);
      }
    }
    for (i = 0; i < 8; i++) { var isT = !!best && best.type === 'station' && best.i === i; st[i].hover = isT; st[i].el.classList.toggle('tg', isT); }
    target = best;
  }

  function dishName(si) { return GD.STATIONS[si].dishName; }
  function describe() {
    if (!target) return { txt: '', can: false };
    if (target.type === 'station') {
      var def = GD.STATIONS[target.i];
      if (!sh) return { txt: def.name, can: false };
      var s = sh.stations[target.i];
      if (!s.owned) return { txt: def.name + ' : à acheter dans la boutique', can: false };
      if (s.ready > 0 && carry.length < MAXC) return { txt: 'Prendre : ' + def.dishName, can: true, act: 'take' };
      if (s.ready > 0) return { txt: 'Mains pleines ! Sers d’abord un client', can: false };
      if (s.slots - s.cooking.length - s.ready > 0) return { txt: 'Cuire : ' + def.dishName, can: true, act: 'cook' };
      var ck = s.cooking[0];
      return { txt: def.dishName + ' : cuisson ' + Math.round(100 * Math.min(1, ck.t / ck.total)) + ' %', can: false };
    }
    var c = target.obj, who = (GD.PEOPLE[c.animal] && GD.introduced(App.save, c.animal)) ? GD.PEOPLE[c.animal].name : 'ce client';
    if (c.state !== 'wait') return { txt: '', can: false };
    for (var k = 0; k < carry.length; k++) if (sh.wants(c, carry[k].st)) return { txt: 'Servir ' + who, can: true, act: 'give' };
    var miss = c.items.filter(function (it) { return !it.done; }).map(function (it) { return dishName(it.st); });
    return { txt: who.charAt(0).toUpperCase() + who.slice(1) + ' attend : ' + miss.join(', '), can: false };
  }

  // ---------------- act ----------------
  function interact() {
    if (!on || !sh || sh.over || Game.isPaused()) return;
    if (!target) return;
    var d = describe();
    if (!d.can) { if (d.txt) { Sfx.play('nope'); } return; }
    if (target.type === 'station') {
      var i = target.i, s = sh.stations[i], o = Scene.v3dState().ST[i];
      o.bumpT = performance.now();
      if (d.act === 'take') {
        var dish = sh.takeDish(i);
        if (dish) { carry.push(dish); Sfx.play('pop'); Vib.buzz(12); }
      } else {
        var freeSlots = s.slots - s.cooking.length - s.ready, n = Math.max(1, Math.min(freeSlots, sh.needs()[i]));
        for (var k = 0; k < n; k++) sh.cook(i, 'chef');
        Tuto.onAction('station', i, 'cook');
      }
    } else {
      var c = target.obj, given = 0;
      for (var j = carry.length - 1; j >= 0; j--) {
        if (sh.giveDish(c, carry[j].st)) { carry.splice(j, 1); given++; if (c.state !== 'wait') break; }
      }
      if (!given) Sfx.play('nope');
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
  function drawHud() {
    if (!hud) return;
    var d = describe();
    var key = touchMode ? '' : '<i class="key wide-key">E</i> ';
    var html = d.txt ? (d.can ? key : '') + d.txt : '';
    if (E.prompt._v !== html) { E.prompt._v = html; E.prompt.innerHTML = html; E.prompt.className = 'fps-prompt' + (d.txt ? ' on' : '') + (d.can ? ' can' : ''); }
    E.cross.className = 'fps-cross' + (d.can ? ' can' : target ? ' aim' : '');
    if (E.act) { E.act.className = 'fps-act' + (d.can ? ' can' : ''); E.act.firstChild.textContent = d.act === 'take' ? 'PRENDRE' : d.act === 'cook' ? 'CUIRE' : d.act === 'give' ? 'SERVIR' : 'ACTION'; }
    // order tickets
    if (!sh) { E.tickets.innerHTML = ''; return; }
    var t = '';
    for (var s = 0; s < sh.seats.length; s++) {
      var c = sh.seats[s];
      if (!c || c.state !== 'wait') continue;
      var r = Math.max(0, c.patience / c.maxPatience);
      t += '<div class="tk' + (target && target.type === 'cust' && target.obj === c ? ' tg' : '') + '"><b style="background-image:var(--a-cu_' + c.animal + '_neutral)"></b>';
      for (var j = 0; j < c.items.length; j++) t += '<i class="' + (c.items[j].done ? 'done' : '') + '" style="background-image:' + Art.dishBg(c.items[j].dish) + '"></i>';
      t += '<u><s style="width:' + Math.round(r * 100) + '%" class="' + (r < 0.3 ? 'low' : r < 0.6 ? 'mid' : '') + '"></s></u></div>';
    }
    if (E.tickets._v !== t) { E.tickets._v = t; E.tickets.innerHTML = t; }
  }

  function cam() {
    var bob = Math.sin(P.walk * 3.1) * 0.035;
    return { x: P.x, y: EYE + bob, z: P.z, yaw: P.yaw, pitch: P.pitch, fov: App.wide ? 64 : 88, carry: carry, bob: bob };
  }
  // where the "hands" are on screen (dishes fly from there to the customer)
  function handsPos() { return { x: App.W / 2, y: App.H * (App.wide ? 0.8 : 0.76) }; }

  return {
    start: start, stop: stop, update: update, cam: cam, key: key, interact: interact, tapStation: tapStation, handsPos: handsPos,
    active: function () { return on; }, isFree: function () { return on && free; }, carrying: function () { return carry.length; },
    relock: function () { if (on && !touchMode && !locked && !UI.isBlocking()) lock(); },
    _p: P, _target: function () { return target; }, _describe: describe, _carry: function () { return carry; }
  };
})();
