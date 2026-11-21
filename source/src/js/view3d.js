// ===================== 3D VIEW: the restaurant rendered with three.js =====================
// Two layouts share this scene:
//  - portrait (phones): the 3D picture fills the top of the screen, the stations stay HTML tiles below it;
//  - wide (PC, landscape): everything is 3D and full screen - backdrop, customers, counter, staff and the
//    stations standing on a worktop in the foreground. The HTML layer (bubbles, labels, HUD) follows the 3D.
var View3D = (function () {
  var T = null, R = null, scene = null, cam = null, canvas = null;
  var on = false, failed = false, built = false, wide = false;
  // full = the whole kitchen is 3D (stations are models): the wide PC layout, or the first-person
  // simulator on any screen. fpsOn = the camera is the player's eyes.
  var full = false, fpsOn = false;
  var W = 720, H = 800;              // canvas size in stage px
  var rest = { pos: null, look: null };      // gameplay camera
  var pose = { pos: null, look: null };      // animated camera (wide)
  var time = 0, dayP = 0.4;
  var texCache = {};
  var M = {};                        // static meshes / lights
  var props = null, propsKey = '';   // location + decor props
  var anim = [];                     // props with an idle animation
  var lanterns = [];                 // { mat, halo }
  var custSpr = {}, staffSpr = {}, stObj = [], titleSpr = [];
  // height of each station model (for a station 1 unit wide): where its labels go
  var MODEL_H = { grill: 0.74, jus: 0.72, frites: 0.6, pizza: 1.0, soupe: 0.62, wok: 0.55, sushi: 0.42, gateau: 0.72 };
  var steam = [];
  var parts = null;
  var V1 = null, V2 = null, V3 = null, V4 = null;
  // quality: 2 = shadows + full resolution, 1 = no shadows, 0 = no shadows + half resolution.
  // It only goes down, when the computer cannot keep up (see govern()).
  var quality = 2, gov = { last: 0, sum: 0, n: 0, until: 0, warned: false };
  var COUNTER_TOP = 1.2, Z_CUST = -1.15, Z_STAFF = 2.1, Z_BACK = -18, ENV = 0.5;
  // wide layout (world units)
  // the drive (first person): the window in the left wall, and the track of the cars along that wall.
  // x: the middle of the track; z0 -> zs: a car drives up and stops; zs -> z1: it drives away;
  // seat: where the driver sits in the car (the bust picture is put there)
  var DRV = { wz: [1.35, 2.95], wy: [1.28, 2.62], x: -9.15, z0: -25.5, zs: 2.45, z1: 18.5, seat: [0.45, 1.1, -0.3], h: 1.08 };
  var PAINTS = [0xd9432f, 0x2fb5a8, 0xf2b632, 0x3a78c9, 0xf2efe6, 0xef7d2a];
  var WD = { zSt: 4.35, wtTop: 0.92, zStaff: 3.5, pitch: 1.2, unit: 0.004, custHalf: 5, postX: 8, geo: [], counterY: 660, zBack: -21 };
  var TITLE = { pos: [-3.3, 3.7, 10.6], look: [-2.5, 2.05, 0] };

  // ---------------- support & textures ----------------
  // WebGL available? Asked once: every test creates a context, and a browser only keeps a few of them
  var sup = null;
  function supported() {
    if (sup !== null) return sup;
    try {
      var c = document.createElement('canvas'), gl = window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'));
      sup = !!gl;
      if (gl) { var lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
    } catch (e) { sup = false; }
    return sup;
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
    // The canvas is given to the texture only once it has its final size: a texture sent to the
    // graphics card while the canvas is still empty (300x150) can never take the bigger picture
    // afterwards (the plants and the drums then stayed invisible for the whole session).
    var c = document.createElement('canvas'), t = new T.Texture();
    t.colorSpace = T.SRGBColorSpace; t.userData.ready = false;
    var im = new Image();
    im.onload = function () {
      c.width = Math.round(im.width * (scale || 4)); c.height = Math.round(im.height * (scale || 4));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      t.image = c; t.needsUpdate = true; t.userData.ready = true;
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
  // crumbs and a ketchup stain left on the counter (simulator)
  function crumbTex() {
    if (texCache._crumb) return texCache._crumb;
    var c = document.createElement('canvas'); c.width = 128; c.height = 88;
    var g = c.getContext('2d'), r = 7;
    function rn() { r = (r * 16807) % 2147483647; return (r & 0xffff) / 0xffff; }
    g.fillStyle = 'rgba(96,56,22,.22)'; g.beginPath(); g.ellipse(60, 46, 46, 26, 0.2, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(196,48,34,.62)'; g.beginPath(); g.ellipse(88, 40, 12, 7, 0.5, 0, 6.3); g.fill();
    g.beginPath(); g.ellipse(74, 52, 4, 3, 0, 0, 6.3); g.fill();
    for (var i = 0; i < 28; i++) {
      g.fillStyle = ['#c98a3c', '#e2b266', '#8a5a2a', '#f1d59a'][i % 4];
      var x = 14 + rn() * 100, y = 12 + rn() * 64, q = 2 + rn() * 4;
      g.beginPath(); g.ellipse(x, y, q, q * 0.7, rn() * 3, 0, 6.3); g.fill();
    }
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    return (texCache._crumb = t);
  }
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
    // reflections: a small studio "room" lights the metal, glass and copper of the models
    try {
      var pm = new T.PMREMGenerator(R);
      scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = ENV;
      pm.dispose();
    } catch (e) { console.warn(e); }
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
    M.floorK = mesh(new T.PlaneGeometry(70, 17.2), new T.MeshStandardMaterial({ map: tileTex(), roughness: 0.9 }), 0, 0, 8.0, false);
    M.floorK.rotation.x = -Math.PI / 2; M.floorK.receiveShadow = true; scene.add(M.floorK);

    // the counter: wooden body, light top, dark trim and planks on the kitchen side
    var g = new T.Group();
    M.cBody = mesh(new T.BoxGeometry(34, COUNTER_TOP - 0.08, 1.0), std(0xffffff, { map: woodTex('cbody', { h: 27, s: 52, l: 47, n: 4, seed: 11, rep: [17, 1] }), roughness: 0.82 }), 0, (COUNTER_TOP - 0.08) / 2, 0);
    M.cTop = mesh(new T.BoxGeometry(34.4, 0.14, 1.32), std(0xffffff, { map: woodTex('ctop', { h: 34, s: 62, l: 71, n: 3, seed: 5, horiz: true, rep: [9, 1] }), roughness: 0.45 }), 0, COUNTER_TOP, 0);
    g.add(M.cBody); g.add(M.cTop);
    g.add(mesh(new T.BoxGeometry(34.4, 0.07, 1.34), std(0x6b3a1c), 0, COUNTER_TOP - 0.1, 0, false));
    g.add(mesh(new T.BoxGeometry(34.2, 0.1, 1.06), std(0x5a3418), 0, 0.05, 0, false));          // plinth
    M.counter = g; scene.add(g);
    // simulator: what some customers leave on the counter (one spot per place)
    M.dirt = [];
    var dirtM = new T.MeshBasicMaterial({ map: crumbTex(), transparent: true, depthWrite: false });
    for (var dq = 0; dq < 6; dq++) {
      var dd = new T.Mesh(new T.PlaneGeometry(0.66, 0.45), dirtM);
      dd.rotation.x = -Math.PI / 2; dd.position.set(0, COUNTER_TOP + 0.075, 0.13); dd.visible = false; dd.renderOrder = 2;
      scene.add(dd); M.dirt.push(dd);
    }

    // wide only: the worktop in the foreground and the 8 stations standing on it
    var wg = new T.Group();
    // (its front edge is placed so that it shows just above the bottom buttons)
    M.wtBody = mesh(new T.BoxGeometry(36, WD.wtTop - 0.06, 1.1), std(0xffffff, { map: woodTex('wbody', { h: 24, s: 50, l: 36, n: 4, seed: 23, rep: [20, 1] }), roughness: 0.85 }), 0, (WD.wtTop - 0.06) / 2, WD.zSt + 0.02);
    M.wtTopM = mesh(new T.BoxGeometry(36.3, 0.12, 1.26), std(0xffffff, { map: woodTex('wtop', { h: 36, s: 55, l: 79, n: 3, seed: 3, dl: 5, horiz: true, rep: [8, 1] }), roughness: 0.4 }), 0, WD.wtTop - 0.03, WD.zSt + 0.02);
    wg.add(M.wtBody); wg.add(M.wtTopM);
    wg.add(mesh(new T.BoxGeometry(36.3, 0.07, 1.28), std(0x5a3418), 0, WD.wtTop - 0.125, WD.zSt + 0.02, false));
    M.wide = wg; wg.visible = false; scene.add(wg);
    for (var s = 0; s < 8; s++) {
      var id = GD.STATIONS[s].id, holder = new T.Group();
      var mdl = Models.station(id), crate = Models.prop('lockbox');
      holder.add(mdl.group); holder.add(crate);
      wg.add(holder);
      stObj.push({ holder: holder, model: mdl, crate: crate, h: MODEL_H[id] || 0.7 });
    }
    for (var q = 0; q < 18; q++) {
      var pf = new T.Sprite(new T.SpriteMaterial({ map: softTex(), transparent: true, depthWrite: false, opacity: 0 }));
      pf.visible = false; pf.renderOrder = 5; scene.add(pf);
      steam.push({ s: pf, life: 0, max: 1, vx: 0, vy: 0 });
    }

    props = new T.Group(); scene.add(props);
    buildRoom();
    built = true;
  }

  // ---------------- first person: the room around the kitchen and the outside ----------------
  // Seen only from inside (hidden for the fixed camera): roof, walls, furniture, lamps, the ground
  // outside with a terrace, a striped awning and a very wide painted horizon.
  var AWN = { jungle: ['#fff6e6', '#d8392b'], plage: ['#ffffff', '#2a8ccc'], montagne: ['#f4f8ff', '#2e7d4f'], ville: ['#f6edff', '#7b4bc4'] };
  function buildRoom() {
    var g = new T.Group(); M.room = g; g.visible = false; scene.add(g);
    var st = new T.Group(); g.add(st);                    // everything that never changes: merged below
    function plane(w, h, mat, x, y, z, rx, ry, to) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); (to || st).add(m); return m;
    }
    function put(id, x, y, z, ry, sc) {
      var o = Models.prop(id); o.position.set(x, y, z); o.rotation.y = ry || 0; if (sc) o.scale.setScalar(sc); st.add(o); return o;
    }
    var wl = { h: 30, s: 48, l: 56, n: 5, seed: 17, rep: [9, 1] }, ws = { h: 30, s: 48, l: 56, n: 5, seed: 17, rep: [3.5, 1] };
    M.roofM = std(0xffffff, { map: woodTex('roof', { h: 26, s: 46, l: 38, n: 6, seed: 41, rep: [8, 3] }), roughness: 0.9 });
    M.wallM = std(0xffffff, { map: woodTex('wall', wl), roughness: 0.85 });
    M.wallS = std(0xffffff, { map: woodTex('wallS', ws), roughness: 0.85 });
    plane(17, 7.4, M.roofM, 0, 4.3, 2.0, Math.PI / 2, 0);              // roof (seen from below)
    plane(17, 4.4, M.wallM, 0, 2.15, 5.25, 0, Math.PI);                // back wall
    // left wall, in four pieces around the window of the drive (the planks run through the pieces)
    function wallL(za, zb, ya, yb) {
      var m = plane(zb - za, yb - ya, M.wallS, -7.8, (ya + yb) / 2, (za + zb) / 2, 0, Math.PI / 2), uv = m.geometry.attributes.uv;
      for (var q = 0; q < uv.count; q++) uv.setXY(q, (5.5 - zb + uv.getX(q) * (zb - za)) / 6.6, (ya + uv.getY(q) * (yb - ya)) / 4.4);
    }
    var WZ = DRV.wz, WY = DRV.wy;
    wallL(-1.1, WZ[0], 0, 4.4); wallL(WZ[1], 5.5, 0, 4.4); wallL(WZ[0], WZ[1], 0, WY[0]); wallL(WZ[0], WZ[1], WY[1], 4.4);
    plane(6.6, 4.4, M.wallS, 7.8, 2.15, 2.2, 0, -Math.PI / 2);         // right wall
    var beamM = std(0xffffff, { map: woodTex('post', { h: 25, s: 48, l: 40, n: 2, seed: 31, rep: [2, 3] }) });
    for (var x = -6; x <= 6; x += 3) st.add(mesh(new T.BoxGeometry(0.2, 0.26, 7.2), beamM, x, 4.14, 2.0, false));
    st.add(mesh(new T.BoxGeometry(17, 0.34, 0.3), beamM, 0, 4.05, -1.0, false));
    st.add(mesh(new T.BoxGeometry(17, 0.22, 0.16), beamM, 0, 0.11, 5.2, false));
    [-7.7, 7.7].forEach(function (px) { st.add(mesh(new T.BoxGeometry(0.3, 4.3, 0.3), beamM, px, 2.15, -1.0, false)); });
    // the window of the drive: a frame as thick as the wall, a sill for the dishes, a sign above
    var wzm = (WZ[0] + WZ[1]) / 2, wzw = WZ[1] - WZ[0];
    st.add(mesh(new T.BoxGeometry(0.3, 0.12, wzw + 0.24), beamM, -7.88, WY[1] + 0.06, wzm, false));
    [WZ[0] - 0.06, WZ[1] + 0.06].forEach(function (pz) { st.add(mesh(new T.BoxGeometry(0.3, WY[1] - WY[0], 0.12), beamM, -7.88, (WY[0] + WY[1]) / 2, pz, false)); });
    st.add(mesh(new T.BoxGeometry(0.7, 0.08, wzw + 0.36), std(0xffffff, { map: woodTex('sill', { h: 34, s: 52, l: 62, n: 3, seed: 9, rep: [1, 1] }), roughness: 0.6 }), -7.82, WY[0] - 0.04, wzm, false));
    [1.1, 3.3].forEach(function (pz) { st.add(mesh(new T.BoxGeometry(0.12, 4.3, 0.16), beamM, -7.72, 2.15, pz, false)); });
    var sign = new T.Mesh(new T.PlaneGeometry(1.5, 0.5), new T.MeshStandardMaterial({ roughness: 0.7, map: Models.ctex('drivesign', 384, 128, function (c2, w, h) {
      c2.fillStyle = '#c62828'; c2.fillRect(0, 0, w, h);
      c2.strokeStyle = '#fff3d6'; c2.lineWidth = 8; c2.strokeRect(8, 8, w - 16, h - 16);
      c2.fillStyle = '#fff3d6'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
      c2.font = '86px "Luckiest Guy", "Arial Black", sans-serif'; c2.fillText('DRIVE', w / 2, h / 2 + 8);
    }) }));
    sign.position.set(-7.74, 3.42, wzm); sign.rotation.y = Math.PI / 2; st.add(sign);
    var pack = Models.khas('wall_panel');          // the props of the pack "Kitchen & Diner 3D" are in the build
    function kp(name, x, y, z, ry, sc) { return Models.kput(st, name, x, y, z, ry, sc); }
    // a shelf on the back wall; items: [name, x, turn, scale, lift] standing on the board
    function shelfAt(sx, y, items) {
      var sh = new T.Group(); sh.position.set(sx, y, 5.0); sh.rotation.y = Math.PI; st.add(sh);
      sh.add(Models.prop('shelfBare'));
      items.forEach(function (it) { Models.kput(sh, it[0], it[1], 0.025 + (it[4] || 0), 0.04, it[2] || 0, it[3] || 1); });
    }
    if (pack) {
      // retro wall panels and a checker floor (one piece = 2 m = 2.5 units)
      for (var i = 0; i < 7; i++) {
        kp('wall_panel', -7.5 + i * 2.5, 0, 5.2, Math.PI);
        for (var r = 0; r < 2; r++) kp('floor_checker', -7.5 + i * 2.5, 0.004, 1.85 + r * 2.5, 0);
      }
      [-1, 1].forEach(function (sd) {
        for (var j = 0; j < 3; j++) {
          if (sd < 0 && j === 1) continue;             // the bay of the drive window is of wood
          var wp = kp('wall_panel', sd * 7.75, 0, j * 2.2, -sd * Math.PI / 2); if (wp) wp.scale.x *= 0.88;
        }
      });
      shelfAt(-4.2, 2.75, [['kettle', -0.5, 0.5], ['toaster', 0.04, 0], ['mug', 0.5, 0.7], ['mug', 0.68, -0.5]]);
      shelfAt(0, 2.75, [['pot', -0.5, 0], ['frying_pan', 0.02, 0.25], ['plate', 0.62, 0], ['plate', 0.62, 0, 1, 0.03], ['plate', 0.62, 0, 1, 0.06]]);
      shelfAt(4.2, 2.75, [['rolling_pin', -0.45, 0.2], ['salt_pepper', 0.02, 0], ['mustard_bottle', 0.28, 0], ['ketchup_bottle', 0.4, 0], ['mug', 0.66, 1.3]]);
      put('shelf', -4.2, 3.5, 5.03, Math.PI); put('shelf', 4.2, 3.5, 5.03, Math.PI);
      // left end: two cabinets around the back door, with the microwave and a little snack
      kp('counter_base', -7.36, 0, 3.3, Math.PI / 2); kp('microwave', -7.36, 1.15, 3.3, Math.PI / 2);
      kp('counter_base', -7.36, 0, 1.12, Math.PI / 2);
      kp('counter_base', -7.36, 0, 2.21, Math.PI / 2);        // under the window of the drive
      kp('plate', -7.34, 1.15, 0.98, 0); kp('donut', -7.34, 1.17, 0.98, 0.4, 1.5); kp('mug', -7.3, 1.15, 1.34, 2.2);
    } else {
      [-4.2, 0, 4.2].forEach(function (sx, k) {
        put('shelf', sx, 2.75, 5.05, Math.PI);
        if (k !== 1) put('shelf', sx, 3.45, 5.05, Math.PI);
      });
      put('crate', -7.25, 0, 3.3, Math.PI / 2, 1.6); put('crate', -7.2, 0.5, 3.32, Math.PI / 2, 1.3);
      put('sacks', -7.3, 0, 1.0, 0.4);
    }
    [-4.2, 0, 4.2].forEach(function (sx) { put('lamp', sx, 4.25, 2.2); });
    put('menuboard', -2.1, 3.3, 5.16, Math.PI, 0.95);
    put('clock', 0, 3.62, 5.16, Math.PI);
    put('potrack', 2.1, 4.26, 4.05);
    put('knives', 6.3, 2.7, 5.15, Math.PI);
    // right end: fridge and sink.  left wall: the back door
    put('fridge', 7.26, 0, 3.05, -Math.PI / 2, 1.25);
    put('sink', 7.4, 0, 1.6, -Math.PI / 2, 1.08);
    // outside: the ground, a terrace, the horizon
    M.groundM = new T.MeshStandardMaterial({ color: 0x5e8f3a, roughness: 1, map: Models.speckle([70, 10]) });
    plane(340, 50, M.groundM, 0, -0.02, -25.4, -Math.PI / 2, 0);
    var canopy = [0xe8433a, 0x2a8ccc, 0xffb300, 0x43b047];
    [[-4.5, -5.4], [4.2, -6.2], [-13, -10.6], [9.5, -8.6], [0.5, -11.5], [-15.6, -5.8], [15, -7.5]].forEach(function (p, k) {
      var t;
      if (pack && k < 4) {             // the nearest tables: diner table and chairs of the pack under the parasol
        t = Models.prop('parasolTop');
        Models.kput(t, 'diner_table', 0, 0, 0, 0);
        Models.kput(t, 'kitchen_chair', 0, 0, -0.86, 0); Models.kput(t, 'kitchen_chair', 0, 0, 0.86, Math.PI);
        if (k % 2) Models.kput(t, 'mug', 0.3, 0.95, 0.15, 1); else { Models.kput(t, 'plate', -0.3, 0.95, -0.1, 0); Models.kput(t, 'burger', -0.3, 0.97, -0.1, 0, 1.3); }
      } else t = Models.prop('parasol');
      var top = new T.Mesh(new T.ConeGeometry(1.6, 0.6, 10), std(canopy[k % 4], { roughness: 0.8, side: T.DoubleSide }));
      top.position.y = 3.5; t.add(top);
      t.position.set(p[0], 0, p[1]); t.rotation.y = k * 1.3;
      st.add(t);
    });
    if (pack) [[-1.6, -3.9], [7.4, -4.4]].forEach(function (p, k) {      // tall tables with the bar stools
      var t = Models.prop('standTable');
      for (var q = 0; q < 3; q++) Models.kput(t, 'bar_stool', Math.cos(q * 2.1 + k) * 0.85, 0, Math.sin(q * 2.1 + k) * 0.85, 0);
      Models.kput(t, 'fries_basket', 0.12, 1.35, 0.05, 0.5, 1.3); Models.kput(t, 'ketchup_bottle', -0.18, 1.35, -0.1, 0); Models.kput(t, 'mustard_bottle', -0.24, 1.35, 0.06, 0);
      t.position.set(p[0], 0, p[1]);
      st.add(t);
    });
    // the drive outside: the ground along the left wall, the track, a hedge behind it, and bushes
    // where the track comes out of the jungle (the cars appear from behind them)
    var gl2 = plane(52, 20.4, M.groundM, -33.8, -0.02, 9.8, -Math.PI / 2, 0), guv = gl2.geometry.attributes.uv;
    for (var q2 = 0; q2 < guv.count; q2++) guv.setXY(q2, guv.getX(q2) * 52 / 340, guv.getY(q2) * 20.4 / 50);
    M.laneM = new T.MeshStandardMaterial({ color: 0xb89a6c, roughness: 1, map: Models.speckle([1, 14]) });
    plane(2.9, 42.5, M.laneM, DRV.x, 0.012, -4.75, -Math.PI / 2, 0);
    M.hedgeM = new T.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 1, map: Models.speckle([9, 2]) });
    st.add(mesh(new T.BoxGeometry(1.1, 2.6, 21), M.hedgeM, -11.7, 1.3, 8, false));
    [[-9.3, 1.3, -26.6, 2.4], [-11.4, 1.1, -25.2, 1.9], [-7.3, 1.0, -25.6, 1.8], [-9.8, 3.0, -27.4, 1.9], [-13, 0.9, -23.8, 1.5], [-6, 0.8, -27.5, 1.6]].forEach(function (b) {
      var bm = mesh(new T.SphereGeometry(b[3], 14, 10), M.hedgeM, b[0], b[1], b[2], false); bm.scale.y = 0.85; st.add(bm);
    });
    Models.bake(st);
    g.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
    // the car of the drive: one jeep, repainted for each customer
    M.carPaint = new T.MeshStandardMaterial({ color: PAINTS[0], roughness: 0.4, metalness: 0.3 });
    M.car = Models.jeep(M.carPaint);
    if (M.car) {
      M.car.traverse(function (o) { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
      var blob = new T.Mesh(new T.CircleGeometry(1, 20), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2; blob.scale.set(1.35, 2.5, 1); blob.position.y = 0.03; M.car.add(blob);
      M.car.visible = false; M.carC = null; scene.add(M.car);
    }
    // the awning in front of the roof: it also hides the top edge of the painted horizon
    M.awnM = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: T.DoubleSide });
    var aw = new T.Mesh(new T.BoxGeometry(36, 0.04, 2.5), M.awnM); aw.position.set(0, 3.97, -2.2); aw.rotation.x = -0.225; g.add(aw);
    var val = new T.Mesh(new T.PlaneGeometry(36, 0.36), M.awnM); val.position.set(0, 3.52, -3.42); g.add(val);
    M.backF = new T.Mesh(new T.PlaneGeometry(323, 26), new T.MeshBasicMaterial({ color: 0xffffff }));
    M.backF.position.set(0, 4.6, -34);
    g.add(M.backF);
    M.fpsLamp = new T.PointLight(0xffe2b0, 5, 11, 1.7); M.fpsLamp.position.set(0, 3.5, 2.2); g.add(M.fpsLamp);
    // the helpers' legs (their bust is a picture) and the tray the player carries
    M.body = {};
    ['commis', 'waiter'].forEach(function (k) {
      var b = Models.prop(k === 'waiter' ? 'bodyWaiter' : 'bodyCook');
      b.traverse(function (o) { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.castShadow = false; } });
      b.visible = false; scene.add(b); M.body[k] = b;
    });
    // the tray the player carries: a little scene of its own, drawn after the kitchen (always in front)
    M.trayScene = new T.Scene(); M.trayCam = new T.PerspectiveCamera(40, 1, 0.05, 20);
    M.trayScene.environment = scene.environment; M.trayScene.environmentIntensity = 0.55;
    M.trayScene.add(new T.HemisphereLight(0xffffff, 0x9a7a5a, 1.25));
    var tl = new T.DirectionalLight(0xfff3e0, 1.7); tl.position.set(-1.2, 3, 2); M.trayScene.add(tl);
    var tr = Models.prop('tray');
    tr.traverse(function (o) { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
    M.trayDish = [];
    for (var di = 0; di < 3; di++) { var hold = new T.Group(); hold.userData.key = ''; tr.add(hold); M.trayDish.push(hold); }
    tr.rotation.x = 0.46; tr.visible = false;
    M.tray = tr; M.trayK = 0; M.dishCache = {};
    M.trayScene.add(tr);
    // ... or a crate of ingredients fetched in the fridge
    M.handCrate = Models.prop('crate');
    M.handCrate.traverse(function (o) { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
    M.handCrate.visible = false; M.crateK = 0;
    M.trayScene.add(M.handCrate);
    // the player's hands: they hold the tray or the crate, and the right one reaches out at each gesture
    M.hands = ['handL', 'handR'].map(function (id) {
      var hd = Models.prop(id);
      hd.traverse(function (o) { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
      hd.visible = false; M.trayScene.add(hd);
      return hd;
    });
  }
  // a dish for the tray: a small 3D model, or its picture when there is no model
  function trayDish(id) {
    var c = M.dishCache[id];
    if (c === undefined) {
      c = Models.dish(id);
      if (c) c.traverse(function (o) { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
      M.dishCache[id] = c || null;
    }
    if (c) return c.clone();
    var sp = new T.Sprite(new T.SpriteMaterial({ map: tex('dish_' + id), transparent: true }));
    sp.center.set(0.5, 0.1); sp.scale.set(0.36, 0.36, 1);
    return sp;
  }
  // the outside follows the current restaurant
  function dressRoom(loc) {
    M.groundM.color.setHex({ jungle: 0x5a9a3c, plage: 0xf0d79c, montagne: 0xf2f6fb, ville: 0x8d8494 }[loc.id] || 0x5a9a3c);
    var key = 'bgw_' + loc.id + '@mirror';
    if (!texCache[key]) {
      var src = tex('bgw_' + loc.id), t = src.clone();
      t.wrapS = T.MirroredRepeatWrapping; t.repeat.set(7, 1); t.colorSpace = T.SRGBColorSpace;
      t.userData = { ready: true };
      var ok = function () { t.image = src.image; t.needsUpdate = true; };
      if (src.image) ok(); else { var iv = setInterval(function () { if (src.image) { clearInterval(iv); ok(); } }, 200); }
      texCache[key] = t;
    }
    M.backF.material.map = texCache[key]; M.backF.material.needsUpdate = true;
    var w = WOODS[loc.id] || WOODS.jungle, a = AWN[loc.id] || AWN.jungle;
    M.roofM.color.setHex(w[0]); M.wallM.color.setHex(w[1]); M.wallS.color.setHex(w[1]);
    M.laneM.color.setHex({ jungle: 0xb89a6c, plage: 0xc9ac78, montagne: 0x9aa3ad, ville: 0x5a5a63 }[loc.id] || 0xb89a6c);
    M.hedgeM.color.setHex({ jungle: 0x3f8a3a, plage: 0x4f9a46, montagne: 0x3d6b4a, ville: 0x3f7f42 }[loc.id] || 0x3f8a3a);
    M.awnM.map = Models.stripes(a[0], a[1], [24, 1]); M.awnM.needsUpdate = true;
  }
  // the tray comes up when the player carries something
  function syncTray(fp, dt) {
    if (!M.tray) return;
    var cr = !!(fp && fp.crate);
    M.crateK += ((cr ? 1 : 0) - M.crateK) * Math.min(1, dt * 9);
    M.handCrate.visible = !!fp && M.crateK > 0.02;
    if (M.handCrate.visible) {
      M.handCrate.scale.setScalar(App.wide ? 1.15 : 0.8);
      M.handCrate.position.set(0, (App.wide ? -0.74 : -0.72) - (1 - M.crateK) * 0.6 + (fp.bob || 0) * 0.6, -1.75);
      M.handCrate.rotation.set(0.3, 0.25, 0);
    }
    var n = fp && fp.carry ? fp.carry.length : 0;
    M.trayK += ((n ? 1 : 0) - M.trayK) * Math.min(1, dt * 9);
    M.tray.visible = !!fp && M.trayK > 0.02;
    if (!M.tray.visible) return;
    var k = App.wide ? 0.62 : 0.42;
    M.tray.scale.setScalar(k);
    M.tray.position.set(0, -0.45 - (1 - M.trayK) * 0.5 + (fp.bob || 0) * 0.5, -1.6);
    for (var i = 0; i < 3; i++) {
      var d = fp.carry[i], h = M.trayDish[i], key = d ? d.dish : '';
      if (h.userData.key !== key) {
        while (h.children.length) h.remove(h.children[0]);
        if (key) h.add(trayDish(key));
        h.userData.key = key;
      }
      h.position.set((i - (n - 1) / 2) * 0.32, 0.02, 0);
    }
  }
  function syncHands(fp) {
    if (!M.hands) return;
    var hk = App.wide ? 1 : 0.7, t0 = fp && fp.actT != null ? fp.actT : 9, bump = t0 < 0.3 ? Math.sin(Math.PI * t0 / 0.3) : 0;
    var holding = !fp ? 0 : M.tray.visible ? 1 : M.handCrate.visible ? 2 : 0;
    for (var i = 0; i < 2; i++) {
      var hd = M.hands[i], sd = i ? 1 : -1, show = !!fp && (holding > 0 || (i === 1 && bump > 0.02));
      hd.visible = show;
      if (!show) continue;
      var x, y, z;
      if (holding === 1) { x = sd * (0.5 * M.tray.scale.x + 0.03 * hk); y = M.tray.position.y + 0.012; z = M.tray.position.z + 0.03; }
      else if (holding === 2) { var cs = M.handCrate.scale.x; x = sd * (0.27 * cs + 0.03 * hk); y = M.handCrate.position.y + 0.24 * cs; z = M.handCrate.position.z + 0.1; }
      else { x = sd * 0.42 * hk; y = -0.9; z = -1.25; }
      if (i === 1 && bump > 0) { x += (0.1 * hk - x) * bump; y += (-0.22 - y) * bump; z += (-1.85 - z) * bump; }
      hd.position.set(x, y, z); hd.scale.setScalar(hk);
      hd.lookAt(x + sd * 0.3, y - 0.55, z + 0.8);
    }
  }
  function drawTray() {
    if (!M.tray || !(M.tray.visible || M.handCrate.visible || M.hands[1].visible)) return;
    if (M.trayCam.aspect !== W / H) { M.trayCam.aspect = W / H; M.trayCam.updateProjectionMatrix(); }
    R.autoClear = false;
    R.clearDepth();
    R.render(M.trayScene, M.trayCam);
    R.autoClear = true;
  }

  // ---------------- camera helpers ----------------
  function project(v, out) {
    V3.copy(v).project(cam);
    out = out || {};
    out.x = (V3.x + 1) / 2 * W; out.y = (1 - V3.y) / 2 * H; out.z = V3.z;      // z > 1: behind the camera
    return out;
  }
  // screen position of a point of the kitchen (front: false when it is behind the camera)
  var so = { x: 0, y: 0, front: true };
  function screenOf(x, y, z) { project(V2.set(x, y, z), tmp); so.x = tmp.x; so.y = tmp.y; so.front = tmp.z < 1; return so; }
  function worldAt(sx, sy, z, out) {
    V1.set(sx / W * 2 - 1, 1 - sy / H * 2, 0.5).unproject(cam);
    V1.sub(cam.position).normalize();
    var t = (z - cam.position.z) / V1.z;
    out = out || new T.Vector3();
    return out.copy(cam.position).addScaledVector(V1, t);
  }
  function setRestCamera() {
    cam.fov = 36;
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
    if (App.wide) {
      var half = Math.abs(worldAt(64, H * 0.78, WD.zSt, V2).x);
      WD.pitch = Math.min(1.36, half * 2 / 8);
      WD.k = Math.min(1.2, WD.pitch / 1.08);          // size of the station models
      WD.custHalf = Math.abs(worldAt(250, H * 0.4, Z_CUST, V2).x);
      WD.postX = Math.abs(worldAt(30, H * 0.45, 0.35, V2).x);
    } else {
      // first-person view on a phone: the fixed camera is not used, the kitchen keeps comfortable sizes
      WD.pitch = 1.25; WD.k = 1.12; WD.custHalf = 4.4; WD.postX = 6.5;
    }
    WD.kStaff = project(V2.set(1, 1.4, WD.zStaff)).x - W / 2;      // screen px per unit at the staff's depth
    WD.counterY = project(V2.set(0, COUNTER_TOP + 0.07, -0.66)).y;
    WD.geo = [];
    for (var i = 0; i < 8; i++) {
      var x = (i - 3.5) * WD.pitch, w = WD.k, h = stObj[i].h * WD.k;
      var b = project(V2.set(x, WD.wtTop, WD.zSt)), t = project(V2.set(x, WD.wtTop + h, WD.zSt));
      var e = project(V2.set(x + WD.pitch / 2, WD.wtTop, WD.zSt));
      WD.geo.push({ x: x, w: w, h: h, sx: b.x, base: b.y, top: t.y, pw: (e.x - b.x) * 2, ph: b.y - t.y });
      stObj[i].holder.position.set(x, WD.wtTop + 0.03, WD.zSt);
      stObj[i].holder.scale.setScalar(WD.k);
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
  function fit() { if (full) fitWide(); else fitPortrait(); }

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
    // first person: it snows outside, not in the kitchen
    var z0 = fpsOn ? -15 : -6, zr = fpsOn ? 13.4 : 9;
    var n = Math.round((pk === 'snow' ? 260 : 46) * spanX / 16 * (fpsOn ? 1.6 : 1)), pos = new Float32Array(n * 3), seed = [];
    for (var q = 0; q < n; q++) {
      pos[q * 3] = (Math.random() - 0.5) * spanX; pos[q * 3 + 1] = Math.random() * topY; pos[q * 3 + 2] = z0 + Math.random() * zr;
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
    var key = (fpsOn ? 'F' : full ? 'W' : 'P') + loc.id + '|' + JSON.stringify(d) + '|' + W + 'x' + H + '|' + (s.name || '') + '|' + GD.seatsFor(s) + (s.flags && s.flags.trophy ? 'T' : '');
    if (key === propsKey) return;
    propsKey = key;
    clearProps();
    setRestCamera();
    R.setClearColor(new T.Color(loc.sky), 1);
    M.back.visible = !full; M.backW.visible = full && !fpsOn; M.wide.visible = full;
    M.room.visible = fpsOn;
    if (fpsOn) dressRoom(loc);
    M.cBody.material.color.setHex(WOODS[loc.id][0]); M.cTop.material.color.setHex(WOODS[loc.id][1]);
    if (full) propsWide(s, d, loc); else propsPortrait(s, d, loc);
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
    if (s.flags && s.flags.trophy) { var tro = Models.prop('trophy'); tro.position.set(px - 1.5, COUNTER_TOP + 0.07, 0.42); tro.scale.setScalar(1.3); props.add(tro); }
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
    var lanY = fpsOn ? 3.95 : worldAt(W / 2, 150, 0.6, V2).y;
    addLanterns(d.lanternes ? 5 + d.lanternes * 4 : loc.id === 'ville' ? 15 : 0, !d.lanternes, -px - 0.4, px + 0.4, lanY, fpsOn ? -1.3 : 0.6, fpsOn ? 0.4 : 0.5);
    // objects on the counter only where no customer sits: next to the posts when there is room
    var n = GD.seatsFor(s), cg = custGeo(n), edge = (n - 1) / 2 * cg.sp + cg.h * 0.3;
    addPlants(px - 0.62, d);
    if (px - 1.5 > edge) addCounterBits(px - 1.25, -px + 1.4);
    // between two customers: the till, a bell, the sauces and the tip jar
    var mids = [], items = ['register', 'bell', 'bottles', 'tipjar', 'snack'];
    for (var j = 0; j < n - 1; j++) mids.push((j - (n - 2) / 2) * cg.sp);
    if (!mids.length) mids = [1.7, -1.7];
    var reg = Math.floor(mids.length / 2), other = 1;
    mids.forEach(function (mx, j) {
      var id = j === reg ? 'register' : items[other++ % items.length], o, y = COUNTER_TOP + 0.07;
      if ((id === 'bottles' || id === 'snack') && Models.khas('plate')) {
        // sauces, salt and pepper / a doughnut and a slice of pie on show (pack "Kitchen & Diner 3D")
        o = new T.Group();
        if (id === 'bottles') { Models.kput(o, 'ketchup_bottle', -0.12, 0, 0, 0, 1.25); Models.kput(o, 'mustard_bottle', 0.02, 0, 0.03, 0, 1.25); Models.kput(o, 'salt_pepper', 0.24, 0, 0, 0.3, 1.25); }
        else { Models.kput(o, 'plate', -0.2, 0, 0, 0, 1.1); Models.kput(o, 'donut', -0.2, 0.03, 0, 0.5, 1.7); Models.kput(o, 'pie_slice', 0.22, 0, 0.02, -0.6, 1.25); }
        o.position.set(mx, y, 0.26); o.rotation.y = Math.PI;
      } else {
        o = Models.prop(id === 'snack' ? 'bell' : id);
        if (id === 'register') { o.position.set(mx, y, 0.3); o.rotation.y = Math.PI; o.scale.setScalar(0.86); }
        else { o.position.set(mx, y, id === 'bell' ? -0.32 : -0.22); o.rotation.y = Math.PI; o.scale.setScalar(1.15); }
      }
      props.add(o);
    });
    if (s.flags && s.flags.trophy) {       // the golden toque offered by a gift code
      var tro = Models.prop('trophy'); tro.position.set(mids[reg] + 0.62, COUNTER_TOP + 0.07, 0.3); tro.scale.setScalar(1.25); props.add(tro);
    }
    if (d.musique) {
      var dr = new T.Mesh(new T.PlaneGeometry(1.5, 1.3), new T.MeshStandardMaterial({ map: texSvg('drums', Art.drums(), 4), transparent: true, alphaTest: 0.4 }));
      dr.position.set(-px + 1.6, COUNTER_TOP + 0.72, 0.1);
      dr.castShadow = true;
      props.add(dr);
    }
    if (!fpsOn && (loc.id === 'jungle' || loc.id === 'plage')) {
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
  // size of a customer: big busts behind the counter for the view from above; in first person they have
  // the size of the helpers and stand on a simple body (the bust picture stops at the chest)
  function custDim(n) { return fpsOn ? { h: 1.02, base: 1.3 } : { h: custGeo(n).h, base: 0.55 }; }
  // colour of the clothes: the average of the bottom of the bust picture
  var shirtCol = {};
  function shirtColor(key) {
    if (shirtCol[key]) return shirtCol[key];
    var im = tex(key).image;
    if (!im || !im.naturalWidth) return null;
    var c = new T.Color(0x7d8fa3);
    try {
      var cv = document.createElement('canvas'); cv.width = 16; cv.height = 8;
      var g = cv.getContext('2d');
      g.drawImage(im, im.naturalWidth * 0.2, im.naturalHeight * 0.8, im.naturalWidth * 0.6, im.naturalHeight * 0.13, 0, 0, 16, 8);
      var d = g.getImageData(0, 0, 16, 8).data, r = 0, gg = 0, b = 0, k = 0;
      for (var i = 0; i < d.length; i += 4) if (d[i + 3] > 110) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; k++; }
      if (k) c.setRGB(r / k / 255, gg / k / 255, b / k / 255, T.SRGBColorSpace);
    } catch (e) { }
    return (shirtCol[key] = c);
  }
  function domFor(x, topY, out, z) {
    var ty = project(V2.set(x, topY, z == null ? Z_CUST : z), tmp).y, px = tmp.x;
    var line = z == null ? project(V2.set(x, COUNTER_TOP + 0.07, -0.66), tmp).y : project(V2.set(x, topY - 1.0, z), tmp).y;
    out.sc = Math.max(0.5, (line - ty) / 208);
    out.x = px; out.top = line + 16 * out.sc - 224;
    return out;
  }
  function seatScreen(seat, n) {
    if (!built || !full) return { x: 0, top: 0, sc: 1 };
    var cd = custDim(n);
    if (seat >= n) return domFor(DRV.x + DRV.seat[0], DRV.seat[1] + DRV.h, { x: 0, top: 0, sc: 1 }, DRV.zs + DRV.seat[2]);      // the driver at the drive
    return domFor(seatWorldX(seat, n), cd.base + cd.h, { x: 0, top: 0, sc: 1 });
  }
  // the car of the drive follows its customer: it drives up, waits at the window, drives away
  function syncCar(st) {
    var car = M.car;
    if (!car) return;
    var s2 = st.sh, c = fpsOn && s2 && s2.manual && !s2.over ? s2.car : null;
    if (!c) { car.visible = false; M.carC = null; return; }
    if (M.carC !== c) { M.carC = c; M.carPaint.color.setHex(PAINTS[(c.paint || 0) % PAINTS.length]); car.position.z = DRV.z0; }
    var D = GD.SIM.drive, z = DRV.zs, u;
    if (c.state === 'in') { u = Math.min(1, c.stateT / D.inT); z = DRV.z0 + (DRV.zs - DRV.z0) * (1 - (1 - u) * (1 - u)); }
    else if (c.state === 'out') { u = Math.min(1, c.stateT / D.outT); z = DRV.zs + (DRV.z1 - DRV.zs) * u * u; }
    var roll = (z - car.position.z) / 0.5, ws = car.userData.wheels;
    for (var i = 0; i < ws.length; i++) ws[i].rotation.x += roll;
    car.position.set(DRV.x, z === DRV.zs ? Math.sin(time * 31) * 0.004 : 0, z);       // the engine idles at the window
    car.visible = true;
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
      var body = s.userData.body;
      if (body) body.visible = false;
      if (c.drive) {                       // the driver of the drive: his bust sits in the car
        var car = M.car, on3 = !!car && car.visible && M.carC === c;
        if (on3) {
          s.scale.set(DRV.h * 0.75, DRV.h, 1);
          s.position.set(car.position.x + DRV.seat[0], DRV.seat[1], car.position.z + DRV.seat[2]);
          s.userData.top = DRV.seat[1] + DRV.h; s.userData.x = s.position.x; s.userData.z = s.position.z;
        }
        s.material.opacity = u.op == null ? 1 : u.op;
        s.visible = on3 && s.material.map.userData.ready !== false;
        return;
      }
      if (full) {
        var cd = custDim(n), hw = cd.h, xw = seatWorldX(c.seat, n), dy = (u.y || 0) / 224 * hw;
        s.scale.set(hw * 0.75, hw, 1);
        s.position.set(xw, cd.base - dy, Z_CUST);
        s.userData.top = cd.base + hw; s.userData.x = xw;
        if (fpsOn) {
          if (!body) {
            body = s.userData.body = new T.Mesh(new T.CylinderGeometry(0.27, 0.31, 0.9, 18), new T.MeshStandardMaterial({ color: 0x7d8fa3, roughness: 0.85, transparent: true }));
            body.scale.z = 0.62; body.userData.key = '';
            scene.add(body);
          }
          var bk = 'cu_' + c.animal + '_neutral';
          if (body.userData.key !== bk) { var sc0 = shirtColor(bk); if (sc0) { body.material.color.copy(sc0); body.userData.key = bk; } }
          body.visible = true;
          body.position.set(xw, cd.base - 0.37 - dy, Z_CUST);
          body.material.opacity = u.op == null ? 1 : u.op;
        }
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
    Object.keys(custSpr).forEach(function (id) {
      if (seen[id]) return;
      var o = custSpr[id], b = o.userData.body;
      if (b) { scene.remove(b); b.geometry.dispose(); b.material.dispose(); }
      scene.remove(o); o.material.dispose(); delete custSpr[id];
    });
  }
  function syncStaff(st, fp) {
    var CH = st.CH, idx = 0;
    if (M.body) { M.body.commis.visible = false; M.body.waiter.visible = false; }
    Object.keys(CH).forEach(function (k) {
      var o = CH[k];
      var vis = o.el.style.display !== 'none';
      var s = staffSpr[k];
      if (!s) { s = staffSpr[k] = spriteFor(o.key || 'chef_happy'); scene.add(s); }
      if (fpsOn && k === 'chef') vis = false;         // first person: the player is the chef
      s.visible = vis;
      idx++;
      if (!vis) return;
      setSpriteKey(s, o.key || 'chef_happy');
      var cls = o.el.className, bob = 0, work = cls.indexOf('work') >= 0 ? 1 + Math.sin(time * 22) * 0.015 : 1;
      if (cls.indexOf('walk') >= 0) bob = Math.abs(Math.sin(time * 20)) * 0.07;
      s.material.opacity = 1;
      if (fp) {
        // first person: the helpers walk in two lanes (along the worktop / along the counter). Their bust
        // is a picture standing on 3D legs; they fade when the player walks through them.
        var lane = k === 'waiter' ? 1.0 : 3.34, fx = (o.x - W / 2) / (WD.kStaff || 200), hb = 1.1;
        var dd = Math.sqrt((fp.x - fx) * (fp.x - fx) + (fp.z - lane) * (fp.z - lane)), op = Math.max(0.06, Math.min(1, (dd - 0.45) / 0.7));
        s.scale.set(hb * (o.w / o.h), hb * work, 1);
        s.position.set(fx, 1.13 + bob * 0.5, lane);
        s.material.opacity = op;
        var bd = M.body[k];
        if (bd) { bd.visible = true; bd.position.set(fx, 0, lane); bd.traverse(function (m) { if (m.isMesh) m.material.opacity = op; }); }
      } else if (full) {
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
      var o = st.ST[i], S = stObj[i], g = WD.geo[i];
      if (!g) continue;
      var owned = (save.stations[o.def.id] || 0) > 0;
      var shs = st.sh ? st.sh.stations[i] : null, hands = shs && st.sh.manual ? shs : null;
      var cooking = !!(shs && shs.cooking.length), burnt = false;
      if (hands) {                         // simulator: the fire is on as long as something is on it
        cooking = false;
        for (var qu = 0; qu < shs.cooking.length; qu++) { var ph = shs.cooking[qu].ph; if (ph === 'burnt') burnt = true; else if (ph !== 'fin') cooking = true; }
      }
      var hv = o.hover && (owned || st.mode === 'hub') ? 1 : 0;
      o.hv = (o.hv || 0) + (hv - (o.hv || 0)) * Math.min(1, dt * 14);
      var bump = o.bumpT ? Math.max(0, 1 - (now - o.bumpT) / 260) : 0;
      var k = WD.k * (1 + o.hv * 0.06 + Math.sin(bump * Math.PI) * 0.09);
      S.holder.scale.setScalar(k);
      S.holder.position.y = WD.wtTop + 0.03 + o.hv * 0.03;
      S.holder.rotation.y = fpsOn ? Math.PI : 0;      // first person: the player stands on the other side
      S.model.group.visible = owned; S.crate.visible = !owned;
      if (owned) S.model.tick(dt, time + i * 1.3, { cooking: cooking, h: hands });
      if (cooking && Math.random() < dt * 4) puff(g);
      if (burnt && Math.random() < dt * 9) puff(g, true);
      syncPass(S, i, hands && fpsOn ? shs.ready : 0, g, dt);
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
      p.s.material.opacity = Math.sin(Math.PI * f) * (p.dark ? 0.7 : 0.34);
    }
  }
  // simulator: the finished dishes wait on the pass, in front of their station, as real little objects
  function syncPass(S, i, n, g, dt) {
    if (!S.pass) {
      if (!n) return;
      S.pass = new T.Group(); S.passD = []; M.wide.add(S.pass);
    }
    n = Math.min(4, n);
    while (S.passD.length < n) {
      var hold = new T.Group(); hold.add(trayDish(GD.STATIONS[i].dish)); hold.scale.setScalar(0.01);
      S.pass.add(hold); S.passD.push(hold);
    }
    S.pass.position.set(g.x, WD.wtTop + 0.035, WD.zSt - 0.47);
    for (var k = 0; k < S.passD.length; k++) {
      var d = S.passD[k], sc = d.scale.x + ((k < n ? 0.82 : 0) - d.scale.x) * Math.min(1, dt * 12);
      d.scale.setScalar(Math.max(0.001, sc)); d.visible = sc > 0.02;
      if (k < n) d.position.x = (k - (n - 1) / 2) * 0.29;
    }
  }
  function syncDirt(st) {
    var s2 = st.sh, n = s2 ? s2.seats.length : 0;
    for (var i = 0; i < M.dirt.length; i++) {
      var show = !!(s2 && s2.manual && i < n && s2.dirt[i]);
      M.dirt[i].visible = show;
      if (show) M.dirt[i].position.x = seatWorldX(i, n);
    }
  }
  function puff(g, dark) {
    for (var q = 0; q < steam.length; q++) {
      var p = steam[q];
      if (p.life > 0) continue;
      p.s.material.color.setHex(dark ? 0x1c1a18 : 0xffffff); p.dark = !!dark;
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

  // is this point (outside, on the left) seen from the camera through the window of the drive?
  function throughWindow(x, y, z) {
    var cx = cam.position.x, k = (-7.8 - cx) / (x - cx);
    if (!(k > 0 && k < 1)) return false;
    var zc = cam.position.z + k * (z - cam.position.z), yc = cam.position.y + k * (y - cam.position.y);
    return zc > DRV.wz[0] && zc < DRV.wz[1] && yc > DRV.wy[0] && yc < DRV.wy[1];
  }
  // after rendering: move the HTML layer (bubbles, name tags, station labels, tap zones) onto the 3D objects
  var dm = { x: 0, top: 0, sc: 1 };
  function syncDom(st) {
    var CU = st.CU;
    Object.keys(CU).forEach(function (id) {
      var u = CU[id], s = custSpr[id];
      if (!s) return;
      domFor(s.userData.x, s.userData.top, dm, s.userData.z);
      var x = dm.x, sc = dm.sc, top = dm.top;
      var vis = !fpsOn || (tmp.z < 1 && x > -200 && x < W + 200 && sc < 8);
      // the driver's bubble shows only when he can be seen through the window of the drive
      if (vis && u.c.drive) vis = s.visible && throughWindow(s.userData.x, s.userData.top - 0.35, s.userData.z);
      if (u.vis !== vis) { u.vis = vis; u.el.style.visibility = vis ? '' : 'hidden'; }
      if (!vis) return;
      // first person: the box follows the bust, but the bubble and the name keep a readable size
      var inv = fpsOn ? Math.min(1, 1.15 / sc) : 1;
      if (u.inv !== inv) { u.inv = inv; u.el.style.setProperty('--inv', inv.toFixed(3)); }
      if (u.left !== x || u.top !== top || u.sc !== sc) {
        u.left = x; u.top = top; u.sc = sc;
        u.el.style.left = x.toFixed(1) + 'px';
        u.el.style.top = top.toFixed(1) + 'px';
        u.el.style.transform = 'scale(' + sc.toFixed(3) + ')';
      }
    });
    if (!full) return;
    for (var i = 0; i < 8; i++) {
      var o = st.ST[i], g = WD.geo[i];
      if (!g) continue;
      var b = project(V2.set(g.x, WD.wtTop, WD.zSt), tmp), bx = b.x, by = b.y, k = 1, show = true;
      if (fpsOn) {
        // first person: the label gets bigger when the player comes closer, and hides behind his back
        var front = b.z < 1, dist = Math.sqrt((g.x - cam.position.x) * (g.x - cam.position.x) + (WD.zSt - cam.position.z) * (WD.zSt - cam.position.z));
        var tp = project(V2.set(g.x, WD.wtTop + g.h, WD.zSt), tmp);
        k = Math.max(0.3, Math.min(1.5, (by - tp.y) / g.ph));
        show = front && tp.z < 1 && dist < 7.5 && bx > -150 && bx < W + 150;
      }
      if (o.vis !== show) { o.vis = show; o.el.style.visibility = show ? '' : 'hidden'; }
      if (!show) continue;
      if (Math.abs((o.sx || 0) - bx) > 0.25 || Math.abs((o.sy || 0) - by) > 0.25 || o.sk !== k) {
        o.sx = bx; o.sy = by; o.sk = k;
        o.el.style.left = (bx - g.pw / 2).toFixed(1) + 'px';
        o.el.style.top = (by - g.ph).toFixed(1) + 'px';
        o.el.style.transform = k === 1 ? '' : 'scale(' + k.toFixed(3) + ')';
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
    M.hemi.intensity = mix(0.95, 0.68, eve);
    scene.environmentIntensity = ENV * mix(1, 0.72, eve);
    (full ? M.backW : M.back).material.color.setRGB(1, mix(1, 0.86, eve), mix(1, 0.74, eve));
    if (M.backF) M.backF.material.color.copy(M.backW.material.color);
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
    if (!on) fpsOn = false;
    full = on && (wide || fpsOn);
    document.getElementById('app').classList.toggle('s3d', full);
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
    var st = Scene.v3dState(), fp = fpsOn && window.Fps && Fps.active() ? Fps.cam() : null;
    try {
      govern();
      buildProps();
      setRestCamera();
      syncCar(st);
      syncCustomers(st);
      syncStaff(st, fp);
      if (full) { syncStations(st, dt); syncTitle(title && wide); }
      syncDirt(st);
      syncTray(fp, dt);
      syncHands(fp);
      lighting(st, title);
      animate(dt);
      if (fp) {
        // first person: the camera is the player's eyes
        cam.fov = fp.fov; cam.updateProjectionMatrix();
        cam.position.set(fp.x, fp.y, fp.z);
        cam.rotation.order = 'YXZ';
        cam.rotation.set(fp.pitch, fp.yaw, 0);
      } else if (wide) {
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
      drawTray();
      if (!title) syncDom(st);
      if (fp && Fps.place) Fps.place(screenOf);
    } catch (e) {
      console.error(e);
      failed = true;
      UI.toast('La vue 3D a rencontré un problème : retour à la vue classique.');
      if (window.Fps && Fps.active()) Fps.abort();        // a simulator day goes on in the manager's view
      if (App.relayout) App.relayout(); else apply();
    }
  }
  function layout() { if (on && built) { try { fit(); } catch (e) { console.error(e); } } }
  function refresh() { propsKey = ''; }
  // snap the camera (no glide), e.g. right after the layout changed
  // first-person simulator on / off (the layout is computed again: the whole kitchen becomes 3D)
  function setFps(v) {
    v = !!v && on;
    if (v === fpsOn) return;
    fpsOn = v;
    propsKey = '';
    if (App.relayout) App.relayout(); else apply();
  }
  function snap() { if (built && wide) { pose.pos.copy(App.screen === 'title' ? V4.set(TITLE.pos[0], TITLE.pos[1], TITLE.pos[2]) : rest.pos); pose.look.copy(App.screen === 'title' ? V4.set(TITLE.look[0], TITLE.look[1], TITLE.look[2]) : rest.look); } }
  return {
    apply: apply, frame: frame, layout: layout, refresh: refresh, snap: snap, supported: supported, usable: usable,
    active: function () { return on; }, isWide: function () { return wide; }, failed: function () { return failed; },
    metrics: function () { return WD; }, seatScreen: seatScreen, quality: function () { return quality; },
    isFull: function () { return full; }, isFps: function () { return fpsOn; }, setFps: setFps,
    _info: function () { return R ? { calls: R.info.render.calls, tris: R.info.render.triangles, geos: R.info.memory.geometries, tex: R.info.memory.textures } : null; },
    seatX: function (seat, n) { return seatWorldX(seat, n); },
    // screen x (at the fixed camera) used by the scene to move the staff to a world position
    staffSx: function (wx) { return W / 2 + wx * (WD.kStaff || 200); }
  };
})();
