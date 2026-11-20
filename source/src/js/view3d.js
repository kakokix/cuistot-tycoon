// ===================== 3D VIEW: the restaurant rendered with three.js =====================
// Two layouts share this scene:
//  - portrait (phones): the 3D picture fills the top of the screen, the stations stay HTML tiles below it;
//  - wide (PC, landscape): everything is 3D and full screen - backdrop, customers, counter, staff and the
//    stations standing on a worktop in the foreground. The HTML layer (bubbles, labels, HUD) follows the 3D.
var View3D = (function () {
  var T = null, R = null, scene = null, cam = null, canvas = null;
  var on = false, failed = false, built = false, wide = false;
  var W = 720, H = 800;              // canvas size in stage px
  var rest = { pos: null, look: null };      // gameplay camera
  var pose = { pos: null, look: null };      // animated camera (wide)
  var time = 0, dayP = 0.4;
  var texCache = {};
  var M = {};                        // static meshes / lights
  var props = null, propsKey = '';   // location + decor props
  var anim = [];                     // props with an idle animation
  var lanterns = [];                 // { mat, halo }
  var custSpr = {}, staffSpr = {}, stSpr = [], stShadow = [], titleSpr = [];
  var steam = [];
  var parts = null;
  var V1 = null, V2 = null, V3 = null, V4 = null;
  // quality: 2 = shadows + full resolution, 1 = no shadows, 0 = no shadows + half resolution.
  // It only goes down, when the computer cannot keep up (see govern()).
  var quality = 2, gov = { last: 0, sum: 0, n: 0, until: 0, warned: false };
  var COUNTER_TOP = 1.2, Z_CUST = -1.15, Z_STAFF = 2.1, Z_BACK = -18;
  // wide layout (world units)
  var WD = { zSt: 4.35, wtTop: 0.92, zStaff: 3.5, pitch: 1.2, unit: 0.004, custHalf: 5, postX: 8, geo: [], counterY: 660, zBack: -21 };
  var TITLE = { pos: [-3.3, 3.7, 10.6], look: [-2.5, 2.05, 0] };

  // ---------------- support & textures ----------------
  function supported() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  function usable() { return !!(App.save && App.save.view3d) && !failed && !!window.THREE && supported(); }

  function texFromImage(key, im, repeat) {
    var t = new T.Texture();
    t.colorSpace = T.SRGBColorSpace;
    t.userData.ready = false;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    var done = function (i) { t.image = i; t.needsUpdate = true; t.userData.ready = true; };
    if (im && im.complete && im.naturalWidth) done(im);
    else {
      var i2 = new Image();
      i2.onload = function () { done(i2); };
      i2.src = ASSETS[key];
    }
    return t;
  }
  function tex(key, repeat) {
    var k = key + (repeat ? '@' + repeat.join('x') : '');
    if (!texCache[k]) texCache[k] = texFromImage(key, window.__img && window.__img[key], repeat);
    return texCache[k];
  }
  // SVG art (plants, drums...) rasterised at high resolution for a crisp texture
  function texSvg(id, src, scale) {
    if (texCache['svg_' + id]) return texCache['svg_' + id];
    var c = document.createElement('canvas'), t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace; t.userData.ready = false;
    var im = new Image();
    im.onload = function () {
      c.width = Math.round(im.width * (scale || 4)); c.height = Math.round(im.height * (scale || 4));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      t.needsUpdate = true; t.userData.ready = true;
    };
    im.src = src;
    texCache['svg_' + id] = t;
    return t;
  }
  function tileTex() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? '#b8643a' : '#d98a55';
      g.fillRect(x * 64, y * 64, 64, 64);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x * 64 + 4, y * 64 + 4, 56, 10);
    }
    g.strokeStyle = '#6b3a1c'; g.lineWidth = 4;
    for (var i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(14, 6);
    return t;
  }
  // clean cartoon planks drawn on a canvas: base colour, soft grain, a few knots, dark joints
  function woodTex(id, o) {
    if (texCache['wood_' + id]) return texCache['wood_' + id];
    var S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d'), seed = o.seed || 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed & 0xffff) / 0xffff; }
    var n = o.n || 4, w = S / n;
    if (o.horiz) { g.translate(S, 0); g.rotate(Math.PI / 2); }
    for (var i = 0; i < n; i++) {
      var x0 = i * w, l = o.l + (rnd() - 0.5) * (o.dl || 8);
      g.fillStyle = 'hsl(' + (o.h + (rnd() - 0.5) * 5) + ',' + o.s + '%,' + l + '%)';
      g.fillRect(x0, 0, w + 1, S);
      for (var k = 0; k < 9; k++) {            // grain: long, slightly wavy lines
        var gx = x0 + 6 + rnd() * (w - 12), amp = 2 + rnd() * 4, ph = rnd() * 6;
        g.strokeStyle = rnd() < 0.5 ? 'rgba(70,35,10,' + (0.05 + rnd() * 0.07) + ')' : 'rgba(255,240,210,' + (0.05 + rnd() * 0.07) + ')';
        g.lineWidth = 1 + rnd() * 2.5;
        g.beginPath();
        for (var y = 0; y <= S; y += 32) { var xx = gx + Math.sin(y / S * Math.PI * 2 + ph) * amp; if (y) g.lineTo(xx, y); else g.moveTo(xx, y); }
        g.stroke();
      }
      if (rnd() < 0.6) {                        // a knot
        var kx = x0 + w * (0.3 + rnd() * 0.4), ky = S * (0.15 + rnd() * 0.7);
        g.strokeStyle = 'rgba(70,35,10,.16)'; g.lineWidth = 2;
        for (var r = 3; r < 16; r += 5) { g.beginPath(); g.ellipse(kx, ky, r * 0.6, r, 0, 0, Math.PI * 2); g.stroke(); }
      }
      g.fillStyle = 'rgba(45,22,6,.5)'; g.fillRect(x0, 0, 3, S);                 // joint
      g.fillStyle = 'rgba(255,245,220,.16)'; g.fillRect(x0 + 3, 0, 2.5, S);      // light edge
      g.fillStyle = 'rgba(45,22,6,.12)'; g.fillRect(x0 + w - 5, 0, 5, S);
    }
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping;
    if (o.rep) t.repeat.set(o.rep[0], o.rep[1]);
    t.anisotropy = 4;
    texCache['wood_' + id] = t;
    return t;
  }
  function radialTex(stops) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(c);
  }
  function dotTex() { return texCache._dot || (texCache._dot = radialTex([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.85)'], [1, 'rgba(255,255,255,0)']])); }
  function softTex() { return texCache._soft || (texCache._soft = radialTex([[0, 'rgba(255,255,255,.9)'], [0.5, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']])); }
  function blobTex() { return texCache._blob || (texCache._blob = radialTex([[0, 'rgba(0,0,0,.75)'], [0.55, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']])); }
  function signTex(text) {
    var c = document.createElement('canvas'); c.width = 640; c.height = 200;
    var g = c.getContext('2d'), im = window.__img && window.__img.board_c;
    if (im && im.naturalWidth) g.drawImage(im, 0, 0, 640, 200);
    else { g.fillStyle = '#9a5a2a'; g.fillRect(0, 0, 640, 200); }
    g.font = '64px "Luckiest Guy", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var size = 64;
    while (g.measureText(text).width > 540 && size > 30) { size -= 4; g.font = size + 'px "Luckiest Guy", sans-serif'; }
    g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = '#3d200b'; g.strokeText(text, 320, 112);
    g.fillStyle = '#fff3cc'; g.fillText(text, 320, 106);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function std(color, extra) {
    var o = { color: color, roughness: 0.75 };
    if (extra) for (var k in extra) o[k] = extra[k];
    return new T.MeshStandardMaterial(o);
  }
  function mesh(geo, mat, x, y, z, shadow) {
    var m = new T.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  }
  function imgSize(key, dw, dh) {
    var im = window.__img && window.__img[key];
    return im && im.naturalWidth ? [im.naturalWidth, im.naturalHeight] : [dw, dh];
  }

  // ---------------- static scene ----------------
  function build() {
    T = window.THREE;
    canvas = document.createElement('canvas');
    canvas.className = 'v3d';
    R = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    R.shadowMap.enabled = true;
    R.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(36, W / H, 0.1, 160);
    V1 = new T.Vector3(); V2 = new T.Vector3(); V3 = new T.Vector3(); V4 = new T.Vector3();
    rest.pos = new T.Vector3(0, 3.3, 9.6); rest.look = new T.Vector3(0, 1.9, -2);
    pose.pos = new T.Vector3(0, 4.6, 12.5); pose.look = new T.Vector3(0, 1.9, 0);

    M.hemi = new T.HemisphereLight(0xfff6e8, 0x6a4a30, 1.15); scene.add(M.hemi);
    M.sun = new T.DirectionalLight(0xffffff, 1.9);
    M.sun.position.set(-6, 11, 8);
    M.sun.castShadow = true;
    M.sun.shadow.mapSize.set(2048, 2048);
    var sc = M.sun.shadow.camera; sc.left = -13; sc.right = 13; sc.top = 10; sc.bottom = -8; sc.near = 1; sc.far = 44;
    M.sun.shadow.bias = -0.0006;
    scene.add(M.sun); scene.add(M.sun.target);

    // painted backdrops: portrait (2:3) and wide (16:9)
    M.back = new T.Mesh(new T.PlaneGeometry(1, 1.5), new T.MeshBasicMaterial({ color: 0xffffff }));
    M.back.position.z = Z_BACK;
    scene.add(M.back);
    M.backW = new T.Mesh(new T.PlaneGeometry(16, 9), new T.MeshBasicMaterial({ color: 0xffffff }));
    M.backW.position.z = WD.zBack; M.backW.visible = false;
    scene.add(M.backW);
    M.floorK = mesh(new T.PlaneGeometry(70, 16), new T.MeshStandardMaterial({ map: tileTex(), roughness: 0.9 }), 0, 0, 8.6, false);
    M.floorK.rotation.x = -Math.PI / 2; M.floorK.receiveShadow = true; scene.add(M.floorK);

    // the counter: wooden body, light top, dark trim and planks on the kitchen side
    var g = new T.Group();
    M.cBody = mesh(new T.BoxGeometry(34, COUNTER_TOP - 0.08, 1.0), std(0xffffff, { map: woodTex('cbody', { h: 27, s: 52, l: 47, n: 4, seed: 11, rep: [17, 1] }), roughness: 0.82 }), 0, (COUNTER_TOP - 0.08) / 2, 0);
    M.cTop = mesh(new T.BoxGeometry(34.4, 0.14, 1.32), std(0xffffff, { map: woodTex('ctop', { h: 34, s: 62, l: 71, n: 3, seed: 5, horiz: true, rep: [9, 1] }), roughness: 0.45 }), 0, COUNTER_TOP, 0);
    g.add(M.cBody); g.add(M.cTop);
    g.add(mesh(new T.BoxGeometry(34.4, 0.07, 1.34), std(0x6b3a1c), 0, COUNTER_TOP - 0.1, 0, false));
    g.add(mesh(new T.BoxGeometry(34.2, 0.1, 1.06), std(0x5a3418), 0, 0.05, 0, false));          // plinth
    M.counter = g; scene.add(g);

    // wide only: the worktop in the foreground and the 8 stations standing on it
    var wg = new T.Group();
    // (its front edge is placed so that it shows just above the bottom buttons)
    M.wtBody = mesh(new T.BoxGeometry(36, WD.wtTop - 0.06, 1.1), std(0xffffff, { map: woodTex('wbody', { h: 24, s: 50, l: 36, n: 4, seed: 23, rep: [20, 1] }), roughness: 0.85 }), 0, (WD.wtTop - 0.06) / 2, WD.zSt + 0.02);
    M.wtTopM = mesh(new T.BoxGeometry(36.3, 0.12, 1.26), std(0xffffff, { map: woodTex('wtop', { h: 36, s: 55, l: 79, n: 3, seed: 3, dl: 5, horiz: true, rep: [8, 1] }), roughness: 0.4 }), 0, WD.wtTop - 0.03, WD.zSt + 0.02);
    wg.add(M.wtBody); wg.add(M.wtTopM);
    wg.add(mesh(new T.BoxGeometry(36.3, 0.07, 1.28), std(0x5a3418), 0, WD.wtTop - 0.125, WD.zSt + 0.02, false));
    M.wide = wg; wg.visible = false; scene.add(wg);
    for (var s = 0; s < 8; s++) {
      var id = GD.STATIONS[s].id;
      var sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.6 }));
      sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1; wg.add(sh); stShadow.push(sh);
      var sp = new T.Sprite(new T.SpriteMaterial({ map: tex('st_' + id), transparent: true, alphaTest: 0.06 }));
      sp.center.set(0.5, 0); sp.renderOrder = 2; wg.add(sp); stSpr.push(sp);
    }
    for (var q = 0; q < 18; q++) {
      var pf = new T.Sprite(new T.SpriteMaterial({ map: softTex(), transparent: true, depthWrite: false, opacity: 0 }));
      pf.visible = false; pf.renderOrder = 5; scene.add(pf);
      steam.push({ s: pf, life: 0, max: 1, vx: 0, vy: 0 });
    }

    props = new T.Group(); scene.add(props);
    built = true;
  }

  // ---------------- camera helpers ----------------
  function project(v, out) {
    V3.copy(v).project(cam);
    out = out || {};
    out.x = (V3.x + 1) / 2 * W; out.y = (1 - V3.y) / 2 * H;
    return out;
  }
  function worldAt(sx, sy, z, out) {
    V1.set(sx / W * 2 - 1, 1 - sy / H * 2, 0.5).unproject(cam);
    V1.sub(cam.position).normalize();
    var t = (z - cam.position.z) / V1.z;
    out = out || new T.Vector3();
    return out.copy(cam.position).addScaledVector(V1, t);
  }
  function setRestCamera() {
    cam.position.copy(rest.pos);
    cam.lookAt(rest.look);
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  }
  function sizeRenderer() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    R.setPixelRatio(Math.max(0.5, Math.min(2.2, App.scale * dpr)) * (quality === 0 ? 0.55 : 1));
    R.setSize(W, H, false);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }

  // portrait: the 3D view lines up with the 2D gameplay layout
  function fitPortrait() {
    var L = Scene.L;
    W = 720; H = Math.round(L.row1 + 40);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    rest.pos.set(0, 3.3, 9.6);
    // find the look-at height that puts the back edge of the counter top on the 2D counter line
    var target = L.counterTop + 6, lo = -6, hi = 8;
    for (var k = 0; k < 40; k++) {
      var mid = (lo + hi) / 2;
      rest.look.set(0, mid, -2); setRestCamera();
      var p = project(V2.set(0, COUNTER_TOP + 0.07, -0.66));
      if (p.y > target) hi = mid; else lo = mid;   // looking lower moves the scene up on screen
    }
    rest.look.set(0, (lo + hi) / 2, -2); setRestCamera();
    // backdrop: covers the whole view behind the dining room ("cover" like the 2D background)
    var tl = worldAt(-40, -60, Z_BACK), br = worldAt(W + 40, L.counterTop + 60, Z_BACK);
    var w = Math.max(br.x - tl.x, (tl.y - br.y) / 1.5);
    M.back.scale.set(w, w, 1);
    M.back.position.set(0, br.y + w * 0.75, Z_BACK);
    sizeRenderer();
    propsKey = '';   // rebuild props for the new framing
    gov.sum = 0; gov.n = 0; gov.until = performance.now() + 1500;
  }

  // wide: a fixed cinematic camera; the HTML layer reads its metrics from here
  function fitWide() {
    W = App.W; H = App.H;
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    rest.pos.set(0, 4.6, 12.5); rest.look.set(0, 1.9, 0);
    setRestCamera();
    var half = Math.abs(worldAt(64, H * 0.78, WD.zSt, V2).x);
    WD.pitch = Math.min(1.36, half * 2 / 8);
    WD.unit = WD.pitch * 0.9 / 300;
    WD.custHalf = Math.abs(worldAt(250, H * 0.4, Z_CUST, V2).x);
    WD.postX = Math.abs(worldAt(30, H * 0.45, 0.35, V2).x);
    WD.counterY = project(V2.set(0, COUNTER_TOP + 0.07, -0.66)).y;
    WD.geo = [];
    for (var i = 0; i < 8; i++) {
      var sz = imgSize('st_' + GD.STATIONS[i].id, 300, 230);
      var x = (i - 3.5) * WD.pitch, w = sz[0] * WD.unit, h = sz[1] * WD.unit;
      var b = project(V2.set(x, WD.wtTop, WD.zSt)), t = project(V2.set(x, WD.wtTop + h, WD.zSt));
      var e = project(V2.set(x + WD.pitch / 2, WD.wtTop, WD.zSt));
      WD.geo.push({ x: x, w: w, h: h, sx: b.x, base: b.y, top: t.y, pw: (e.x - b.x) * 2, ph: b.y - t.y });
      stSpr[i].position.set(x, WD.wtTop + 0.03, WD.zSt);
      stSpr[i].userData.w = w; stSpr[i].userData.h = h;
      stShadow[i].position.set(x, WD.wtTop + 0.035, WD.zSt + 0.1);
      stShadow[i].scale.set(w * 1.25, 0.62, 1);
    }
    // backdrop: the top ~57 % of the 16:9 picture sits between the top of the view and the counter
    var tl = worldAt(-80, -30, WD.zBack, V2).clone(), br = worldAt(W + 80, WD.counterY + 30, WD.zBack, V4);
    var hh = (tl.y - br.y) / 0.57, ww = hh * 16 / 9;
    if (ww < br.x - tl.x) { ww = br.x - tl.x; hh = ww * 9 / 16; }
    M.backW.scale.set(ww / 16, hh / 9, 1);
    M.backW.position.set(0, tl.y + 0.02 * hh - hh / 2, WD.zBack);
    sizeRenderer();
    propsKey = '';
    gov.sum = 0; gov.n = 0; gov.until = performance.now() + 1500;
  }
  function fit() { if (wide) fitWide(); else fitPortrait(); }

  // ---------------- location & decor props ----------------
  function clearProps() {
    while (props.children.length) props.remove(props.children[0]);
    anim = []; lanterns = [];
    if (parts) { scene.remove(parts.obj); parts = null; }
  }
  function addLanterns(n, small, x0, x1, y, z, sagAmt) {
    var cols = [0xe8433a, 0xff9f1c, 0xffd23a, 0x43b047];
    var ropeM = std(0x4a2a12), capM = std(0x3d200b), goldM = std(0xffd23a), prev = null;
    function at(t) { return { x: x0 + (x1 - x0) * t, y: y - Math.sin(Math.PI * t) * sagAmt }; }
    // the rope: short straight pieces following the sag
    for (var k = 0; k <= 24 && n; k++) {
      var q = at(k / 24);
      if (prev) {
        var dx = q.x - prev.x, dy = q.y - prev.y, len = Math.sqrt(dx * dx + dy * dy);
        var seg = mesh(new T.CylinderGeometry(0.016, 0.016, len + 0.01, 5), ropeM, (q.x + prev.x) / 2, (q.y + prev.y) / 2, z, false);
        seg.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
        props.add(seg);
      }
      prev = q;
    }
    for (var i = 0; i < n; i++) {
      var p = at((i + 1) / (n + 1));
      var lg = new T.Group();
      var col = small ? 0xfff1a8 : cols[i % 4];
      var mat = new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.4 });
      var r = small ? 0.085 : 0.17, cy = small ? -0.12 : -0.34;
      var ball = mesh(new T.SphereGeometry(r, 18, 12), mat, 0, cy, 0);
      if (!small) {
        ball.scale.set(1, 1.2, 1);
        lg.add(mesh(new T.CylinderGeometry(0.07, 0.09, 0.05, 10), capM, 0, cy + r * 1.2, 0, false));
        lg.add(mesh(new T.CylinderGeometry(0.09, 0.07, 0.05, 10), capM, 0, cy - r * 1.2, 0, false));
        lg.add(mesh(new T.CylinderGeometry(0.012, 0.012, 0.14, 4), goldM, 0, cy - r * 1.2 - 0.09, 0, false));
      }
      lg.add(ball);
      lg.add(mesh(new T.CylinderGeometry(0.01, 0.01, small ? 0.08 : 0.16, 4), ropeM, 0, small ? -0.03 : -0.07, 0, false));
      var halo = new T.Sprite(new T.SpriteMaterial({ map: dotTex(), color: col, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.2 }));
      halo.position.set(0, cy, 0.05); halo.scale.set(small ? 0.5 : 1.0, small ? 0.5 : 1.0, 1);
      lg.add(halo);
      lg.position.set(p.x, p.y, z);
      props.add(lg);
      lanterns.push({ mat: mat, halo: halo.material });
      anim.push({ o: lg, kind: 'sway', amp: 0.08, sp: 1.3, ph: i * 0.7 });
    }
    if (n) {
      M.lampL = M.lampL || new T.PointLight(0xffc870, 0, 12, 1.6);
      M.lampL.position.set(0, y - 0.8, z + 0.6);
      props.add(M.lampL);
    }
  }
  function addPlants(xs, d) {
    if (!d.plantes) return;
    [[-1, 1], [1, d.plantes >= 3 ? 2 : 1]].forEach(function (sd, k) {
      if (k === 1 && d.plantes < 2) return;
      var v = k === 0 && d.plantes >= 3 ? 2 : sd[1];
      var tx = texSvg('plant' + v, Art.plant(v), 4);
      var pl = new T.Mesh(new T.PlaneGeometry(1.15, 1.53), new T.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: 0.4, roughness: 0.9 }));
      pl.castShadow = true;
      var pg = new T.Group(); pg.add(pl); pl.position.y = 0.76;
      pg.position.set(sd[0] * xs, COUNTER_TOP + 0.05, 0.25);
      props.add(pg);
      anim.push({ o: pg, kind: 'sway', amp: 0.03, sp: 0.7, ph: k * 2 });
    });
  }
  // a few 3D objects on the counter: jars (right) and a fruit bowl (left)
  function addCounterBits(jarX, bowlX) {
    var jarM = new T.MeshStandardMaterial({ color: 0xcfe9f2, transparent: true, opacity: 0.55, roughness: 0.1 });
    for (var j = 0; j < 3; j++) {
      var jx = jarX - j * 0.32;
      props.add(mesh(new T.CylinderGeometry(0.13, 0.13, 0.36, 16), jarM, jx, COUNTER_TOP + 0.25, 0.42));
      props.add(mesh(new T.CylinderGeometry(0.14, 0.14, 0.06, 16), std([0xe8433a, 0x43b047, 0xffd23a][j]), jx, COUNTER_TOP + 0.46, 0.42));
    }
    props.add(mesh(new T.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std(0x2a8ccc, { roughness: 0.4 }), bowlX, COUNTER_TOP + 0.4, 0.4));
    [[0xff9f1c, -0.12, 0.05], [0xe8433a, 0.12, 0], [0xffd23a, 0, 0.1], [0x7cc84a, 0.02, -0.12]].forEach(function (f) {
      props.add(mesh(new T.SphereGeometry(0.13, 12, 10), std(f[0], { roughness: 0.45 }), bowlX + f[1], COUNTER_TOP + 0.47, 0.4 + f[2]));
    });
  }
  function addWeather(loc, spanX, topY) {
    var pk = loc.id === 'montagne' ? 'snow' : (loc.id === 'jungle' || loc.id === 'ville') ? 'fire' : null;
    if (!pk) return;
    var n = Math.round((pk === 'snow' ? 260 : 46) * spanX / 16), pos = new Float32Array(n * 3), seed = [];
    for (var q = 0; q < n; q++) {
      pos[q * 3] = (Math.random() - 0.5) * spanX; pos[q * 3 + 1] = Math.random() * topY; pos[q * 3 + 2] = -6 + Math.random() * 9;
      seed.push(Math.random() * 10);
    }
    var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    var popt = { size: pk === 'snow' ? 0.15 : 0.16, map: dotTex(), transparent: true, depthWrite: false,
      color: pk === 'snow' ? 0xffffff : loc.id === 'ville' ? 0xffd27a : 0xd8ff7a, opacity: pk === 'snow' ? 0.9 : 0.8 };
    if (pk !== 'snow') popt.blending = T.AdditiveBlending;
    var pts = new T.Points(geo, new T.PointsMaterial(popt));
    scene.add(pts);
    parts = { obj: pts, kind: pk, seed: seed, n: n, span: spanX, top: topY };
  }

  // each place has its own wood: the plank textures are multiplied by these tints [body, top]
  var WOODS = { jungle: [0xffffff, 0xffffff], plage: [0xffe9c4, 0xfff6e2], montagne: [0xcfb39a, 0xe9e2da], ville: [0x8a7f9a, 0xd9d3e6] };
  function buildProps() {
    var s = App.save, d = s.decor, loc = GD.locById(s.loc || 'jungle');
    var key = (wide ? 'W' : 'P') + loc.id + '|' + JSON.stringify(d) + '|' + W + 'x' + H + '|' + (s.name || '');
    if (key === propsKey) return;
    propsKey = key;
    clearProps();
    setRestCamera();
    R.setClearColor(new T.Color(loc.sky), 1);
    M.back.visible = !wide; M.backW.visible = wide; M.wide.visible = wide;
    M.cBody.material.color.setHex(WOODS[loc.id][0]); M.cTop.material.color.setHex(WOODS[loc.id][1]);
    if (wide) propsWide(s, d, loc); else propsPortrait(s, d, loc);
  }

  function propsPortrait(s, d, loc) {
    var L = Scene.L;
    M.back.material.map = tex(loc.bg); M.back.material.needsUpdate = true;
    // frame of the shop: two posts and a beam, at the edges of the screen
    var edge = worldAt(0, L.counterTop - 40, 0.35).x;
    var px = -edge - 0.18, topY = worldAt(360, 150, 0.35).y;
    var woodM = std(0xffffff, { map: woodTex('post', { h: 25, s: 48, l: 40, n: 2, seed: 31, rep: [2, 3] }) });
    [-px, px].forEach(function (x) { props.add(mesh(new T.CylinderGeometry(0.2, 0.24, topY + 0.4, 14), woodM, x, (topY + 0.4) / 2, 0.35)); });
    props.add(mesh(new T.BoxGeometry(px * 2 + 1.2, 0.34, 0.4), woodM, 0, topY + 0.2, 0.35));
    if (loc.id === 'montagne') {
      var snowM = std(0xffffff, { roughness: 1 });
      props.add(mesh(new T.BoxGeometry(px * 2 + 1.3, 0.16, 0.5), snowM, 0, topY + 0.44, 0.35, false));
      props.add(mesh(new T.BoxGeometry(34.4, 0.08, 1.2), snowM, 0, COUNTER_TOP + 0.1, -0.05, false));
    }
    // hanging sign with the restaurant's name
    var signY = worldAt(360, Math.max(190, L.counterTop - 400) + 60, 0.3).y;
    var sw = 3.0, sh = sw * 200 / 640;
    var sign = new T.Group();
    var board = new T.Mesh(new T.PlaneGeometry(sw, sh), new T.MeshStandardMaterial({ map: signTex(loc.id === 'jungle' ? (s.name || 'Chez Cuistot') : loc.resto), transparent: true, roughness: 0.8 }));
    board.castShadow = true;
    sign.add(board);
    var ropeM = std(0x5a3418);
    [-sw * 0.36, sw * 0.36].forEach(function (x) {
      var len = topY - (signY + sh / 2) + 0.05;
      sign.add(mesh(new T.CylinderGeometry(0.025, 0.025, len, 6), ropeM, x, sh / 2 + len / 2, 0, false));
    });
    sign.position.set(0, signY, 0.3);
    props.add(sign);
    anim.push({ o: sign, kind: 'sway', amp: 0.025, sp: 0.9, ph: 0.3 });
    addLanterns(d.lanternes ? 3 + d.lanternes * 2 : loc.id === 'ville' ? 9 : 0, !d.lanternes, -px, px, topY - 0.1, 0.6, 0.5);
    addPlants(px - 0.75, d);
    addCounterBits(px - 0.45, -px + 0.6);
    if (d.musique) {
      var dr = new T.Mesh(new T.PlaneGeometry(1.2, 1.04), new T.MeshStandardMaterial({ map: texSvg('drums', Art.drums(), 4), transparent: true, alphaTest: 0.4 }));
      dr.position.set(-px + 1.2, worldAt(80, L.counterTop - 330, -2.5).y, -2.5);
      props.add(dr);
    }
    if (loc.id === 'jungle' || loc.id === 'plage') addLeaves(px, topY);
    addWeather(loc, 16, 9);
  }
  function addLeaves(px, topY) {
    [-1, 1].forEach(function (sd) {
      var lf = new T.Mesh(new T.PlaneGeometry(3.4, 1.35), new T.MeshStandardMaterial({ map: tex('leaf'), transparent: true, alphaTest: 0.3, side: T.DoubleSide }));
      var lgp = new T.Group(); lgp.add(lf); lf.position.x = sd * 1.4;
      lgp.position.set(sd * (px + 0.4), topY + 0.25, 1.2);
      lf.rotation.z = sd * -0.55; lf.scale.x = sd;
      props.add(lgp);
      anim.push({ o: lgp, kind: 'sway', amp: 0.04, sp: 0.6, ph: sd });
    });
  }

  function propsWide(s, d, loc) {
    M.backW.material.map = tex('bgw_' + loc.id); M.backW.material.needsUpdate = true;
    // each place has its own wood
    var wood = WOODS[loc.id];
    M.wtBody.material.color.setHex(wood[0]); M.wtTopM.material.color.setHex(wood[1]);
    var px = WD.postX, topY = worldAt(W / 2, -20, 0.35, V2).y;
    var woodM = std(0xffffff, { map: woodTex('post', { h: 25, s: 48, l: 40, n: 2, seed: 31, rep: [2, 3] }) });
    [-px, px].forEach(function (x) {
      props.add(mesh(new T.CylinderGeometry(0.22, 0.27, topY + 1, 16), woodM, x, (topY + 1) / 2, 0.35));
      props.add(mesh(new T.CylinderGeometry(0.3, 0.3, 0.16, 16), std(0x5a3418), x, COUNTER_TOP + 0.16, 0.35, false));    // ring where the post meets the counter
    });
    if (loc.id === 'montagne') props.add(mesh(new T.BoxGeometry(34.4, 0.08, 1.2), std(0xffffff, { roughness: 1 }), 0, COUNTER_TOP + 0.1, -0.05, false));
    var lanY = worldAt(W / 2, 150, 0.6, V2).y;
    addLanterns(d.lanternes ? 5 + d.lanternes * 4 : loc.id === 'ville' ? 15 : 0, !d.lanternes, -px - 0.4, px + 0.4, lanY, 0.6, 0.5);
    // objects on the counter only where no customer sits: next to the posts when there is room
    var n = GD.seatsFor(s), cg = custGeo(n), edge = (n - 1) / 2 * cg.sp + cg.h * 0.3;
    addPlants(px - 0.62, d);
    if (px - 1.5 > edge) addCounterBits(px - 1.25, -px + 1.4);
    if (d.musique) {
      var dr = new T.Mesh(new T.PlaneGeometry(1.5, 1.3), new T.MeshStandardMaterial({ map: texSvg('drums', Art.drums(), 4), transparent: true, alphaTest: 0.4 }));
      dr.position.set(-px + 1.6, COUNTER_TOP + 0.72, 0.1);
      dr.castShadow = true;
      props.add(dr);
    }
    if (loc.id === 'jungle' || loc.id === 'plage') {
      var ly = worldAt(W / 2, 40, 1.2, V2).y;
      addLeaves(Math.abs(worldAt(0, 60, 1.2, V2).x) - 0.9, ly - 0.2);
    }
    addWeather(loc, WD.postX * 2 + 6, 9);
  }

  // ---------------- characters (billboards using the realistic renders) ----------------
  function spriteFor(key) {
    var m = new T.SpriteMaterial({ map: tex(key), transparent: true, depthWrite: true, alphaTest: 0.08 });
    var s = new T.Sprite(m);
    s.center.set(0.5, 0);
    s.userData.key = key;
    return s;
  }
  function setSpriteKey(s, key) {
    if (s.userData.key === key) return;
    s.userData.key = key;
    s.material.map = tex(key);
    s.material.needsUpdate = true;
  }
  var tmp = { x: 0, y: 0 };
  // wide: spacing and size of the customers at the counter (smaller when 5 of them share a narrow screen)
  function custGeo(n) {
    var sp = n > 1 ? Math.min(2.7, WD.custHalf * 2 / (n - 1)) : 2.7;
    return { sp: sp, h: 2.9 * Math.min(1, Math.max(0.78, sp / 2.2)) };
  }
  function seatWorldX(seat, n) { return (seat - (n - 1) / 2) * custGeo(n).sp; }
  function domFor(x, topY, out) {
    var ty = project(V2.set(x, topY, Z_CUST), tmp).y, px = tmp.x;
    var line = project(V2.set(x, COUNTER_TOP + 0.07, -0.66), tmp).y;
    out.sc = Math.max(0.5, (line - ty) / 208);
    out.x = px; out.top = line + 16 * out.sc - 224;
    return out;
  }
  function seatScreen(seat, n) {
    if (!built || !wide) return { x: 0, top: 0, sc: 1 };
    return domFor(seatWorldX(seat, n), 0.55 + custGeo(n).h, { x: 0, top: 0, sc: 1 });
  }
  function syncCustomers(st) {
    var CU = st.CU, L = st.L, seen = {};
    var n = st.sh ? st.sh.seats.length : 3;
    Object.keys(CU).forEach(function (id) {
      var u = CU[id], c = u.c;
      seen[id] = 1;
      var key = 'cu_' + c.animal + '_' + (u.mood || 'neutral');
      var s = custSpr[id];
      if (!s) { s = custSpr[id] = spriteFor(key); scene.add(s); }
      setSpriteKey(s, key);
      if (wide) {
        var hw = custGeo(n).h, xw = seatWorldX(c.seat, n);
        s.scale.set(hw * 0.75, hw, 1);
        s.position.set(xw, 0.55 - (u.y || 0) / 224 * hw, Z_CUST);
        s.userData.top = 0.55 + hw; s.userData.x = xw;
      } else {
        // place the billboard where the 2D layout puts the customer (with the camera at rest)
        var sc2 = n >= 5 ? 0.82 : n === 4 ? 0.93 : 1;
        var sx = st.seatX(c.seat, n), bottom = L.custBottom + 30, top = L.custBottom - 224 * sc2;
        var wt = worldAt(sx, top, Z_CUST, V2), wy = wt.y, wb = worldAt(sx, bottom, Z_CUST, V2);
        var h = wy - wb.y;
        s.scale.set(h * 0.75, h, 1);
        s.position.set(wb.x, wb.y - (u.y || 0) / 224 * h, Z_CUST);
        s.userData.top = wy; s.userData.x = wb.x;
      }
      s.material.opacity = u.op == null ? 1 : u.op;
      s.visible = s.material.map.userData.ready !== false;
    });
    Object.keys(custSpr).forEach(function (id) { if (!seen[id]) { scene.remove(custSpr[id]); custSpr[id].material.dispose(); delete custSpr[id]; } });
  }
  function syncStaff(st) {
    var CH = st.CH, idx = 0;
    Object.keys(CH).forEach(function (k) {
      var o = CH[k];
      var vis = o.el.style.display !== 'none';
      var s = staffSpr[k];
      if (!s) { s = staffSpr[k] = spriteFor(o.key || 'chef_happy'); scene.add(s); }
      s.visible = vis;
      idx++;
      if (!vis) return;
      setSpriteKey(s, o.key || 'chef_happy');
      var cls = o.el.className, bob = 0, work = cls.indexOf('work') >= 0 ? 1 + Math.sin(time * 22) * 0.015 : 1;
      if (cls.indexOf('walk') >= 0) bob = Math.abs(Math.sin(time * 20)) * 0.07;
      if (wide) {
        var ks = Math.max(0.86, Math.min(1.06, 0.55 + 0.4 * WD.pitch));
        var hw = (k === 'chef' ? 2.08 : 1.8) * ks, z = WD.zStaff - idx * 0.04;
        var wx = worldAt(o.x, H * 0.7, z, V2).x;
        s.scale.set(hw * (o.w / o.h), hw * work, 1);
        s.position.set(wx, 0.36 + bob + Math.sin(time * 1.7 + idx) * 0.012, z);
      } else {
        var top = worldAt(o.x, o.baseTop, Z_STAFF, V2).y, b = worldAt(o.x, o.baseTop + o.h, Z_STAFF, V2);
        var h = top - b.y;
        s.scale.set(h * (o.w / o.h), h * work, 1);
        s.position.set(b.x, b.y + bob, Z_STAFF);
      }
    });
  }
  // wide: the stations (owned or not, hovered, cooking) and the steam above the ones that cook
  function syncStations(st, dt) {
    var save = App.save, now = performance.now();
    for (var i = 0; i < 8; i++) {
      var o = st.ST[i], sp = stSpr[i], g = WD.geo[i];
      if (!g) continue;
      var owned = (save.stations[o.def.id] || 0) > 0, can = save.level >= o.def.unlock;
      var cooking = !!(st.sh && st.sh.stations[i].cooking.length);
      var hv = o.hover && (owned || st.mode === 'hub') ? 1 : 0;
      o.hv = (o.hv || 0) + (hv - (o.hv || 0)) * Math.min(1, dt * 14);
      var bump = o.bumpT ? Math.max(0, 1 - (now - o.bumpT) / 260) : 0;
      var k = 1 + o.hv * 0.07 + Math.sin(bump * Math.PI) * 0.1;
      var wob = cooking ? Math.sin(time * 13 + i) * 0.018 : 0;
      sp.scale.set(g.w * k * (1 + wob), g.h * k * (1 - wob), 1);
      sp.position.y = WD.wtTop + 0.03 + o.hv * 0.03;
      var c = owned ? 1 : can ? 0.42 : 0.13;
      sp.material.opacity = owned ? 1 : can ? 0.96 : 0.9;
      sp.material.color.setRGB(c, c, owned ? 1 : c * 1.12);
      sp.visible = sp.material.map.userData.ready !== false;
      stShadow[i].material.opacity = owned ? 0.6 : 0.25;
      if (cooking && Math.random() < dt * 4) puff(g);
    }
    for (var q = 0; q < steam.length; q++) {
      var p = steam[q];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      var f = 1 - p.life / p.max;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt;
      var sc = 0.16 + f * 0.3;
      p.s.scale.set(sc, sc, 1);
      p.s.material.opacity = Math.sin(Math.PI * f) * 0.34;
    }
  }
  function puff(g) {
    for (var q = 0; q < steam.length; q++) {
      var p = steam[q];
      if (p.life > 0) continue;
      p.max = p.life = 0.7 + Math.random() * 0.4;
      p.vx = (Math.random() - 0.5) * 0.18; p.vy = 0.3 + Math.random() * 0.2;
      p.s.position.set(g.x + (Math.random() - 0.5) * g.w * 0.45, WD.wtTop + g.h * 0.72, WD.zSt + 0.05);
      p.s.visible = true;
      return;
    }
  }
  // wide title screen: a few happy regulars at the counter
  function syncTitle(show) {
    var keys = ['cu_touriste_happy', 'cu_explorateur_happy', 'cu_papi_happy', 'cu_mamie_happy'];
    var xs = [-3.9, -1.3, 1.3, 3.9];
    for (var i = 0; i < keys.length; i++) {
      var s = titleSpr[i];
      if (!s) {
        if (!show) continue;
        s = titleSpr[i] = spriteFor(keys[i]); scene.add(s);
        s.scale.set(2.9 * 0.75, 2.9, 1);
      }
      // on a narrow screen the first one would stand behind the menu
      s.visible = show && s.material.map.userData.ready !== false && !(i === 0 && W < 1850);
      s.position.set(xs[i], 0.55 + Math.sin(time * 1.3 + i * 1.7) * 0.02, Z_CUST);
    }
  }

  // after rendering: move the HTML layer (bubbles, name tags, station labels, tap zones) onto the 3D objects
  var dm = { x: 0, top: 0, sc: 1 };
  function syncDom(st) {
    var CU = st.CU;
    Object.keys(CU).forEach(function (id) {
      var u = CU[id], s = custSpr[id];
      if (!s) return;
      domFor(s.userData.x, s.userData.top, dm);
      var x = dm.x, sc = dm.sc, top = dm.top;
      if (u.left !== x || u.top !== top || u.sc !== sc) {
        u.left = x; u.top = top; u.sc = sc;
        u.el.style.left = x.toFixed(1) + 'px';
        u.el.style.top = top.toFixed(1) + 'px';
        u.el.style.transform = 'scale(' + sc.toFixed(3) + ')';
      }
    });
    if (!wide) return;
    for (var i = 0; i < 8; i++) {
      var o = st.ST[i], g = WD.geo[i];
      if (!g) continue;
      var b = project(V2.set(g.x, WD.wtTop, WD.zSt), tmp), bx = b.x, by = b.y;
      if (Math.abs((o.sx || 0) - bx) > 0.25 || Math.abs((o.sy || 0) - by) > 0.25) {
        o.sx = bx; o.sy = by;
        o.el.style.left = (bx - g.pw / 2).toFixed(1) + 'px';
        o.el.style.top = (by - g.ph).toFixed(1) + 'px';
      }
    }
  }

  // ---------------- light: time of day + location mood ----------------
  var C1 = null, C2 = null;
  function mix(a, b, t) { return a + (b - a) * t; }
  function lighting(st, title) {
    var loc = GD.locById(App.save.loc || 'jungle');
    var target = title ? 0.62 : st.sh && !st.sh.over ? Math.min(1, 1 - st.sh.timeLeft / st.sh.duration) : 0.4;
    if (loc.id === 'ville') target = Math.max(target, 0.75);
    dayP += (target - dayP) * 0.03;
    var eve = Math.max(0, (dayP - 0.5) / 0.5);
    C1 = C1 || new T.Color(); C2 = C2 || new T.Color();
    var base = loc.id === 'montagne' ? 0xe8f1ff : 0xfff3e2;
    C1.setHex(base); C2.setHex(0xffa060);
    M.sun.color.copy(C1).lerp(C2, eve * 0.75);
    M.sun.intensity = mix(2.0, 1.15, eve);
    M.sun.position.set(mix(-7, 7, dayP), mix(10, 6, eve), 8);
    M.hemi.intensity = mix(1.2, 0.85, eve);
    (wide ? M.backW : M.back).material.color.setRGB(1, mix(1, 0.86, eve), mix(1, 0.74, eve));
    var glow = 0.5 + eve * 1.8 + Math.sin(time * 3) * 0.08;
    lanterns.forEach(function (l) { l.mat.emissiveIntensity = glow; l.halo.opacity = 0.12 + eve * 0.5; });
    if (M.lampL) M.lampL.intensity = lanterns.length ? 2 + eve * 10 : 0;
    var tint = mix(1, 0.88, eve * 0.6);
    Object.keys(custSpr).forEach(function (id) { custSpr[id].material.color.setRGB(1, tint + 0.05, tint); });
    Object.keys(staffSpr).forEach(function (k) { staffSpr[k].material.color.setRGB(1, tint + 0.05, tint); });
    titleSpr.forEach(function (s) { if (s) s.material.color.setRGB(1, tint + 0.05, tint); });
  }
  function animate(dt) {
    anim.forEach(function (a) { a.o.rotation.z = Math.sin(time * a.sp + a.ph) * a.amp; });
    if (parts) {
      var p = parts.obj.geometry.attributes.position, arr = p.array;
      for (var i = 0; i < parts.n; i++) {
        var sd = parts.seed[i];
        if (parts.kind === 'snow') {
          arr[i * 3 + 1] -= dt * (0.5 + (sd % 1) * 0.6);
          arr[i * 3] += Math.sin(time * 0.8 + sd) * dt * 0.25;
          if (arr[i * 3 + 1] < 0) { arr[i * 3 + 1] = parts.top; arr[i * 3] = (Math.random() - 0.5) * parts.span; }
        } else {
          arr[i * 3] += Math.sin(time * 0.5 + sd) * dt * 0.35;
          arr[i * 3 + 1] += Math.cos(time * 0.7 + sd * 1.3) * dt * 0.25;
          if (arr[i * 3 + 1] < 1.4) arr[i * 3 + 1] = 1.4 + Math.random() * 0.4;
          if (arr[i * 3 + 1] > 8) arr[i * 3 + 1] = 7.5;
        }
      }
      p.needsUpdate = true;
      if (parts.kind === 'fire') parts.obj.material.opacity = 0.35 + 0.6 * Math.max(0, dayP - 0.3);
    }
  }

  // ---------------- quality: keep the game smooth on slow computers ----------------
  function setQuality(q) {
    quality = q;
    R.shadowMap.enabled = q >= 2;
    M.sun.castShadow = q >= 2;
    scene.traverse(function (o) { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.needsUpdate = true; }); } });
    sizeRenderer();
    gov.sum = 0; gov.n = 0; gov.until = performance.now() + 1200;
  }
  function govern() {
    var now = performance.now(), d = now - gov.last;
    gov.last = now;
    if (window.V3D_QUALITY != null) { if (quality !== window.V3D_QUALITY) setQuality(window.V3D_QUALITY); return; }
    if (d > 600 || d <= 0 || document.hidden) { gov.until = now + 800; return; }      // pause, hidden tab, first image
    if (now < gov.until) return;                                                     // let the scene settle first
    gov.sum += d; gov.n++;
    if (gov.n < 20 || (gov.sum < 2500 && gov.n < 150)) return;
    var avg = gov.sum / gov.n;
    gov.sum = 0; gov.n = 0;
    if (avg > 42 && quality > 0) setQuality(avg > 110 ? 0 : quality - 1);           // under ~24 images per second
    else if (avg > 80 && quality === 0 && !gov.warned) {
      gov.warned = true;
      UI.toast('Le jeu rame ? Tu peux couper « Vue 3D » dans les Paramètres.');
    }
  }

  // ---------------- public ----------------
  function apply() {
    var want = usable();
    var root = Scene.E && Scene.E.kitchenBg && Scene.E.kitchenBg.parentNode;
    if (want && !built) {
      try { build(); }
      catch (e) { console.error(e); failed = true; want = false; UI.toast('La vue 3D n’est pas disponible sur cet appareil.'); }
    }
    on = want;
    wide = on && !!App.wide;
    if (root) {
      root.classList.toggle('v3d-on', on);
      // the canvas goes first: bubbles, name tags, stations and HUD stay above the 3D picture
      if (on && canvas && canvas.parentNode !== root) root.insertBefore(canvas, root.firstChild);
    }
    Scene.layout(App.H);
    return on;
  }
  function frame(dt) {
    if (!on || !built) return;
    var title = App.screen === 'title';
    if ((title && !wide) || (window.Story && Story.active()) || (window.World && World.isOpen())) return;
    time += dt;
    var st = Scene.v3dState();
    try {
      govern();
      buildProps();
      setRestCamera();
      syncCustomers(st);
      syncStaff(st);
      if (wide) { syncStations(st, dt); syncTitle(title); }
      lighting(st, title);
      animate(dt);
      if (wide) {
        // cinematic camera: glides between the title pose and the kitchen, follows the mouse a little
        var mx = App.mx || 0, my = App.my || 0;
        var k = Math.min(1, 1 - Math.exp(-dt * 2.4));
        if (title) {
          V4.set(TITLE.pos[0] + Math.sin(time * 0.16) * 0.9 + mx * 0.5, TITLE.pos[1] + Math.sin(time * 0.23) * 0.12 - my * 0.2, TITLE.pos[2]);
          pose.pos.lerp(V4, k);
          pose.look.lerp(V4.set(TITLE.look[0] + mx * 0.2, TITLE.look[1], TITLE.look[2]), k);
        } else {
          V4.set(rest.pos.x + Math.sin(time * 0.21) * 0.2 + mx * 0.5, rest.pos.y + Math.sin(time * 0.33) * 0.05 - my * 0.16, rest.pos.z);
          pose.pos.lerp(V4, k);
          pose.look.lerp(V4.set(rest.look.x + mx * 0.12, rest.look.y, rest.look.z), k);
        }
        cam.position.copy(pose.pos); cam.lookAt(pose.look);
      } else {
        // gentle camera drift: the parallax shows the depth of the room
        cam.position.set(Math.sin(time * 0.23) * 0.42, rest.pos.y + Math.sin(time * 0.37) * 0.07, rest.pos.z);
        cam.lookAt(rest.look);
      }
      cam.updateMatrixWorld();
      R.render(scene, cam);
      if (!title) syncDom(st);
    } catch (e) {
      console.error(e);
      failed = true;
      UI.toast('La vue 3D a rencontré un problème : retour à la vue classique.');
      if (App.relayout) App.relayout(); else apply();
    }
  }
  function layout() { if (on && built) { try { fit(); } catch (e) { console.error(e); } } }
  function refresh() { propsKey = ''; }
  // snap the camera (no glide), e.g. right after the layout changed
  function snap() { if (built && wide) { pose.pos.copy(App.screen === 'title' ? V4.set(TITLE.pos[0], TITLE.pos[1], TITLE.pos[2]) : rest.pos); pose.look.copy(App.screen === 'title' ? V4.set(TITLE.look[0], TITLE.look[1], TITLE.look[2]) : rest.look); } }
  return {
    apply: apply, frame: frame, layout: layout, refresh: refresh, snap: snap, supported: supported, usable: usable,
    active: function () { return on; }, isWide: function () { return wide; }, failed: function () { return failed; },
    metrics: function () { return WD; }, seatScreen: seatScreen, quality: function () { return quality; }
  };
})();
