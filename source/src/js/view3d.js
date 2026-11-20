// ===================== 3D VIEW (TEST VERSION): the restaurant rendered with three.js =====================
// The gameplay layout stays the same (stations, bubbles, HUD are HTML). The dining room, the counter,
// the decor, the customers and the kitchen staff are drawn in real 3D, with lights, shadows,
// a time-of-day cycle during a shift, weather particles and a slowly moving camera (parallax).
var View3D = (function () {
  var T = null, R = null, scene = null, cam = null, canvas = null;
  var on = false, failed = false, built = false;
  var W = 720, H = 800;              // canvas size in stage px
  var rest = { y: 3.3, z: 9.6, look: null };
  var time = 0, dayP = 0.4;
  var texCache = {};
  var M = {};                        // static meshes / lights
  var props = null, propsKey = '';   // location + decor props
  var anim = [];                     // props with an idle animation
  var lanterns = [];                 // emissive lantern materials
  var custSpr = {}, staffSpr = {};
  var parts = null;
  var V1 = null, V2 = null, V3 = null;
  var COUNTER_TOP = 1.2, Z_CUST = -1.15, Z_STAFF = 2.1;

  // ---------------- support & textures ----------------
  function supported() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  function wanted() { return !!(App.save && App.save.view3d) && !failed && !!window.THREE && supported(); }

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
  function dotTex() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    var t = new T.CanvasTexture(c); return t;
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

  // ---------------- static scene ----------------
  function build() {
    T = window.THREE;
    canvas = document.createElement('canvas');
    canvas.className = 'v3d';
    R = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    R.shadowMap.enabled = true;
    R.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(36, W / H, 0.1, 140);
    V1 = new T.Vector3(); V2 = new T.Vector3(); V3 = new T.Vector3();
    rest.look = new T.Vector3(0, 1.9, -2);

    M.hemi = new T.HemisphereLight(0xfff6e8, 0x6a4a30, 1.15); scene.add(M.hemi);
    M.sun = new T.DirectionalLight(0xffffff, 1.9);
    M.sun.position.set(-6, 11, 8);
    M.sun.castShadow = true;
    M.sun.shadow.mapSize.set(1024, 1024);
    var sc = M.sun.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -6; sc.near = 1; sc.far = 40;
    M.sun.shadow.bias = -0.0006;
    scene.add(M.sun); scene.add(M.sun.target);

    M.back = new T.Mesh(new T.PlaneGeometry(1, 1.5), new T.MeshBasicMaterial({ color: 0xffffff }));
    M.back.position.z = -18;
    scene.add(M.back);
    M.floorD = mesh(new T.PlaneGeometry(60, 18), new T.MeshLambertMaterial({ color: 0x5e8f3a }), 0, 0, -9.6, false);
    M.floorD.rotation.x = -Math.PI / 2; M.floorD.receiveShadow = true;
    M.floorD.visible = false;   // the painted backdrop already shows the ground of each place
    M.floorK = mesh(new T.PlaneGeometry(60, 16), new T.MeshStandardMaterial({ map: tileTex(), roughness: 0.9 }), 0, 0, 8.6, false);
    M.floorK.rotation.x = -Math.PI / 2; M.floorK.receiveShadow = true; scene.add(M.floorK);

    // the counter: wooden body, light top, dark trim and planks on the kitchen side
    var g = new T.Group();
    g.add(mesh(new T.BoxGeometry(18, COUNTER_TOP - 0.08, 1.0), std(0xc78b55, { map: tex('tex_wood', [6, 1]) }), 0, (COUNTER_TOP - 0.08) / 2, 0));
    g.add(mesh(new T.BoxGeometry(18.4, 0.14, 1.32), std(0xf3c88e, { map: tex('tex_wood', [7, 0.6]), roughness: 0.5 }), 0, COUNTER_TOP, 0));
    g.add(mesh(new T.BoxGeometry(18.4, 0.07, 1.34), std(0x7a4520), 0, COUNTER_TOP - 0.1, 0, false));
    var plank = std(0x5a3418);
    for (var i = -8; i <= 8; i++) g.add(mesh(new T.BoxGeometry(0.07, COUNTER_TOP - 0.25, 0.05), plank, i * 1.05, (COUNTER_TOP - 0.2) / 2, 0.52, false));
    M.counter = g; scene.add(g);

    props = new T.Group(); scene.add(props);
    built = true;
  }

  // ---------------- camera fitting: the 3D view lines up with the gameplay layout ----------------
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
    cam.position.set(0, rest.y, rest.z);
    cam.lookAt(rest.look);
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  }
  function fit() {
    var L = Scene.L;
    H = Math.round(L.row1 + 40);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
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
    var tl = worldAt(-40, -60, M.back.position.z), br = worldAt(W + 40, L.counterTop + 60, M.back.position.z);
    var w = Math.max(br.x - tl.x, (tl.y - br.y) / 1.5);
    M.back.scale.set(w, w, 1);
    M.back.position.set(0, br.y + w * 0.75, M.back.position.z);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    R.setPixelRatio(Math.max(0.6, Math.min(2.2, App.scale * dpr)));
    R.setSize(W, H, false);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    propsKey = '';   // rebuild props for the new framing
  }

  // ---------------- location & decor props ----------------
  function clearProps() {
    while (props.children.length) props.remove(props.children[0]);
    anim = []; lanterns = [];
    if (parts) { scene.remove(parts.obj); parts = null; }
  }
  function buildProps() {
    var s = App.save, L = Scene.L, d = s.decor, loc = GD.locById(s.loc || 'jungle');
    var key = loc.id + '|' + JSON.stringify(d) + '|' + H + '|' + (s.name || '');
    if (key === propsKey) return;
    propsKey = key;
    clearProps();
    setRestCamera();
    M.back.material.map = tex(loc.bg); M.back.material.needsUpdate = true;
    var floorCol = { jungle: 0x5e8f3a, plage: 0xf2d9a4, montagne: 0xeef4fa, ville: 0x6b5a73 }[loc.id];
    M.floorD.material.color.setHex(floorCol);
    R.setClearColor(new T.Color(loc.sky), 1);

    // frame of the shop: two posts and a beam, at the edges of the screen
    var edge = worldAt(0, L.counterTop - 40, 0.35).x;
    var px = -edge - 0.18, topY = worldAt(360, 150, 0.35).y;
    var woodM = std(0xa0663a, { map: tex('tex_wood', [1, 3]) });
    [-px, px].forEach(function (x) {
      var post = mesh(new T.CylinderGeometry(0.2, 0.24, topY + 0.4, 14), woodM, x, (topY + 0.4) / 2, 0.35);
      props.add(post);
    });
    props.add(mesh(new T.BoxGeometry(px * 2 + 1.2, 0.34, 0.4), woodM, 0, topY + 0.2, 0.35));
    if (loc.id === 'montagne') {
      var snowM = std(0xffffff, { roughness: 1 });
      props.add(mesh(new T.BoxGeometry(px * 2 + 1.3, 0.16, 0.5), snowM, 0, topY + 0.44, 0.35, false));
      props.add(mesh(new T.BoxGeometry(18.4, 0.08, 1.2), snowM, 0, COUNTER_TOP + 0.1, -0.05, false));
    }

    // hanging sign with the restaurant's name
    var signY = worldAt(360, Math.max(190, L.counterTop - 400) + 60, 0.3).y;
    var sw = 3.0, sh = sw * 200 / 640;
    var sign = new T.Group();
    var board = new T.Mesh(new T.PlaneGeometry(sw, sh), new T.MeshStandardMaterial({ map: signTex(loc.id === 'jungle' ? (s.name || 'Chez Cuistot') : loc.resto), transparent: true, roughness: 0.8, emissive: 0x000000 }));
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

    // lanterns (decor) on a rope under the beam; string lights in the city
    var nl = d.lanternes ? 3 + d.lanternes * 2 : loc.id === 'ville' ? 9 : 0;
    var cols = [0xe8433a, 0xff9f1c, 0xffd23a, 0x43b047];
    for (var i = 0; i < nl; i++) {
      var t = (i + 1) / (nl + 1), x = -px + 2 * px * t, sag = Math.sin(Math.PI * t) * 0.5;
      var lg = new T.Group();
      var small = !d.lanternes;
      var col = small ? 0xfff1a8 : cols[i % 4];
      var mat = new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.4 });
      var ball = mesh(new T.SphereGeometry(small ? 0.09 : 0.2, 16, 12), mat, 0, small ? -0.1 : -0.32, 0);
      if (!small) ball.scale.set(1, 1.25, 1);
      lg.add(ball);
      lg.add(mesh(new T.CylinderGeometry(0.012, 0.012, small ? 0.1 : 0.16, 4), ropeM, 0, small ? -0.03 : -0.08, 0, false));
      lg.position.set(x, topY - 0.1 - sag, 0.6);
      props.add(lg);
      lanterns.push(mat);
      anim.push({ o: lg, kind: 'sway', amp: 0.08, sp: 1.3, ph: i * 0.7 });
    }
    if (nl) {
      M.lampL = M.lampL || new T.PointLight(0xffc870, 0, 9, 1.6);
      M.lampL.position.set(0, topY - 0.8, 1.2);
      props.add(M.lampL);
    }

    // plants on the counter (decor), drums (decor)
    if (d.plantes) {
      [[-1, 1], [1, d.plantes >= 2 ? 2 : 1]].forEach(function (sd, k) {
        if (k === 1 && d.plantes < 2) return;
        var tx = texSvg('plant' + sd[1], Art.plant(sd[1]), 4);
        var pl = new T.Mesh(new T.PlaneGeometry(1.15, 1.53), new T.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: 0.4, roughness: 0.9 }));
        pl.castShadow = true;
        var pg = new T.Group(); pg.add(pl); pl.position.y = 0.76;
        pg.position.set(sd[0] * (px - 0.75), COUNTER_TOP + 0.05, 0.25);
        props.add(pg);
        anim.push({ o: pg, kind: 'sway', amp: 0.03, sp: 0.7, ph: k * 2 });
      });
    }
    if (d.musique) {
      var dr = new T.Mesh(new T.PlaneGeometry(1.2, 1.04), new T.MeshStandardMaterial({ map: texSvg('drums', Art.drums(), 4), transparent: true, alphaTest: 0.4 }));
      dr.position.set(-px + 1.2, worldAt(80, L.counterTop - 330, -2.5).y, -2.5);
      props.add(dr);
    }
    // a few 3D objects on the counter: jars and a fruit bowl
    var jarM = new T.MeshStandardMaterial({ color: 0xcfe9f2, transparent: true, opacity: 0.55, roughness: 0.1 });
    for (var j = 0; j < 3; j++) {
      var jx = px - 0.45 - j * 0.32;
      props.add(mesh(new T.CylinderGeometry(0.13, 0.13, 0.36, 16), jarM, jx, COUNTER_TOP + 0.25, 0.42));
      props.add(mesh(new T.CylinderGeometry(0.14, 0.14, 0.06, 16), std([0xe8433a, 0x43b047, 0xffd23a][j]), jx, COUNTER_TOP + 0.46, 0.42));
    }
    var bowl = mesh(new T.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std(0x2a8ccc, { roughness: 0.4 }), -px + 0.6, COUNTER_TOP + 0.4, 0.4);
    props.add(bowl);
    [[0xff9f1c, -0.12, 0.05], [0xe8433a, 0.12, 0], [0xffd23a, 0, 0.1], [0x7cc84a, 0.02, -0.12]].forEach(function (f) {
      props.add(mesh(new T.SphereGeometry(0.13, 12, 10), std(f[0], { roughness: 0.45 }), -px + 0.6 + f[1], COUNTER_TOP + 0.47, 0.4 + f[2]));
    });

    // leaves in the top corners (jungle and beach)
    if (loc.id === 'jungle' || loc.id === 'plage') {
      [-1, 1].forEach(function (sd) {
        var lf = new T.Mesh(new T.PlaneGeometry(3.4, 1.35), new T.MeshStandardMaterial({ map: tex('leaf'), transparent: true, alphaTest: 0.3, side: T.DoubleSide }));
        var lgp = new T.Group(); lgp.add(lf); lf.position.x = sd * 1.4;
        lgp.position.set(sd * (px + 0.4), topY + 0.25, 1.2);
        lf.rotation.z = sd * -0.55; lf.scale.x = sd;
        props.add(lgp);
        anim.push({ o: lgp, kind: 'sway', amp: 0.04, sp: 0.6, ph: sd });
      });
    }

    // weather: snow in the mountains, fireflies in the jungle and the city
    var pk = loc.id === 'montagne' ? 'snow' : (loc.id === 'jungle' || loc.id === 'ville') ? 'fire' : null;
    if (pk) {
      var n = pk === 'snow' ? 260 : 46, pos = new Float32Array(n * 3), seed = [];
      for (var q = 0; q < n; q++) {
        pos[q * 3] = (Math.random() - 0.5) * 16; pos[q * 3 + 1] = Math.random() * 9; pos[q * 3 + 2] = -6 + Math.random() * 9;
        seed.push(Math.random() * 10);
      }
      var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      var popt = { size: pk === 'snow' ? 0.15 : 0.16, map: dotTex(), transparent: true, depthWrite: false,
        color: pk === 'snow' ? 0xffffff : loc.id === 'ville' ? 0xffd27a : 0xd8ff7a, opacity: pk === 'snow' ? 0.9 : 0.8 };
      if (pk !== 'snow') popt.blending = T.AdditiveBlending;
      var pm = new T.PointsMaterial(popt);
      var pts = new T.Points(geo, pm);
      scene.add(pts);
      parts = { obj: pts, kind: pk, seed: seed, n: n };
    }
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
      // place the billboard where the 2D layout puts the customer (with the camera at rest)
      var sc2 = n >= 5 ? 0.82 : n === 4 ? 0.93 : 1;
      var sx = st.seatX(c.seat, n), bottom = L.custBottom + 30, top = L.custBottom - 224 * sc2;
      var wt = worldAt(sx, top, Z_CUST, V2), wy = wt.y, wb = worldAt(sx, bottom, Z_CUST, V2);
      var h = wy - wb.y;
      s.scale.set(h * 0.75, h, 1);
      s.position.set(wb.x, wb.y - (u.y || 0) / 224 * h, Z_CUST);
      s.material.opacity = u.op == null ? 1 : u.op;
      s.visible = s.material.map.userData.ready !== false;
      s.userData.top = wy; s.userData.x = wb.x;
    });
    Object.keys(custSpr).forEach(function (id) { if (!seen[id]) { scene.remove(custSpr[id]); custSpr[id].material.dispose(); delete custSpr[id]; } });
  }
  function syncStaff(st) {
    var CH = st.CH, L = st.L;
    Object.keys(CH).forEach(function (k) {
      var o = CH[k];
      var vis = o.el.style.display !== 'none';
      var s = staffSpr[k];
      if (!s) { s = staffSpr[k] = spriteFor(o.key || 'chef_happy'); scene.add(s); }
      s.visible = vis;
      if (!vis) return;
      setSpriteKey(s, o.key || 'chef_happy');
      var cls = o.el.className, bob = 0;
      if (cls.indexOf('walk') >= 0) bob = Math.abs(Math.sin(time * 20)) * 0.07;
      var top = worldAt(o.x, o.baseTop, Z_STAFF, V2).y, b = worldAt(o.x, o.baseTop + o.h, Z_STAFF, V2);
      var h = top - b.y;
      s.scale.set(h * (o.w / o.h), h * (cls.indexOf('work') >= 0 ? 1 + Math.sin(time * 22) * 0.015 : 1), 1);
      s.position.set(b.x, b.y + bob, Z_STAFF);
    });
  }
  // after rendering: move the HTML customers (bubbles, name tags, tap zones) onto the 3D billboards
  function syncDom(st) {
    var CU = st.CU;
    Object.keys(CU).forEach(function (id) {
      var u = CU[id], s = custSpr[id];
      if (!s) return;
      var pt = project(V2.set(s.userData.x, s.userData.top, Z_CUST), tmp);
      var x = pt.x, ty = pt.y;
      var line = project(V2.set(s.userData.x, COUNTER_TOP + 0.07, -0.66), tmp).y;
      var sc = Math.max(0.5, (line - ty) / 208);
      var top = line + 16 * sc - 224;
      if (u.left !== x || u.top !== top || u.sc !== sc) {
        u.left = x; u.top = top; u.sc = sc;
        u.el.style.left = x.toFixed(1) + 'px';
        u.el.style.top = top.toFixed(1) + 'px';
        u.el.style.transform = 'scale(' + sc.toFixed(3) + ')';
      }
    });
  }

  // ---------------- light: time of day + location mood ----------------
  var C1 = null, C2 = null;
  function mix(a, b, t) { return a + (b - a) * t; }
  function lighting(st) {
    var loc = GD.locById(App.save.loc || 'jungle');
    var target = st.sh && !st.sh.over ? Math.min(1, 1 - st.sh.timeLeft / st.sh.duration) : 0.4;
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
    M.back.material.color.setRGB(1, mix(1, 0.86, eve), mix(1, 0.74, eve));
    var glow = 0.5 + eve * 1.8 + Math.sin(time * 3) * 0.08;
    lanterns.forEach(function (m) { m.emissiveIntensity = glow; });
    if (M.lampL) M.lampL.intensity = lanterns.length ? 2 + eve * 10 : 0;
    var tint = mix(1, 0.88, eve * 0.6);
    Object.keys(custSpr).forEach(function (id) { custSpr[id].material.color.setRGB(1, tint + 0.05, tint); });
    Object.keys(staffSpr).forEach(function (k) { staffSpr[k].material.color.setRGB(1, tint + 0.05, tint); });
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
          if (arr[i * 3 + 1] < 0) { arr[i * 3 + 1] = 9; arr[i * 3] = (Math.random() - 0.5) * 16; }
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

  // ---------------- public ----------------
  function apply() {
    var want = wanted();
    var root = Scene.E && Scene.E.kitchenBg && Scene.E.kitchenBg.parentNode;
    if (want && !built) {
      try { build(); }
      catch (e) { failed = true; want = false; if (App.save) App.save.view3d = false; UI.toast('La vue 3D n’est pas disponible sur cet appareil.'); }
    }
    on = want;
    if (root) {
      root.classList.toggle('v3d-on', on);
      // the canvas goes first: bubbles, name tags, stations and HUD stay above the 3D picture
      if (on && canvas && canvas.parentNode !== root) root.insertBefore(canvas, root.firstChild);
    }
    if (on) { try { fit(); } catch (e) { console.error(e); } }
    Scene.layout(App.H);
    return on;
  }
  function frame(dt) {
    if (!on || !built) return;
    if (App.screen !== 'game' || (window.Story && Story.active()) || (window.World && World.isOpen())) return;
    time += dt;
    var st = Scene.v3dState();
    try {
      buildProps();
      setRestCamera();
      syncCustomers(st);
      syncStaff(st);
      lighting(st);
      animate(dt);
      // gentle camera drift: the parallax shows the depth of the room
      cam.position.set(Math.sin(time * 0.23) * 0.42, rest.y + Math.sin(time * 0.37) * 0.07, rest.z);
      cam.lookAt(rest.look);
      cam.updateMatrixWorld();
      R.render(scene, cam);
      syncDom(st);
    } catch (e) {
      console.error(e);
      failed = true; App.save.view3d = false; apply();
      UI.toast('La vue 3D a rencontré un problème : retour en 2D.');
    }
  }
  function layout() { if (on && built) { try { fit(); } catch (e) { } } }
  function refresh() { propsKey = ''; }
  return {
    apply: apply, frame: frame, layout: layout, refresh: refresh, supported: supported,
    active: function () { return on; }, failed: function () { return failed; }
  };
})();
