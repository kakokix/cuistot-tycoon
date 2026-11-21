// ===================== 3D MODELS =====================
// Every object of the kitchen is built here from simple shapes (boxes, cylinders, lathes...) with
// metal / wood / glass materials: no model file to download. A station is about 1 unit wide,
// stands on y = 0 (the worktop) and faces +z. build(id) returns { group, tick(dt, t, state) }.
var Models = (function () {
  var T = null, MAT = {}, TEX = {};
  function ready() { if (!T) T = window.THREE; return !!T; }

  // ---------------- textures drawn on a canvas ----------------
  function rnd(seed) { var s = seed || 7; return function () { s = (s * 16807) % 2147483647; return (s & 0xffff) / 0xffff; }; }
  function ctex(key, w, h, draw, rep) {
    var k = key + (rep ? '@' + rep.join('x') : '');
    if (TEX[k]) return TEX[k];
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return (TEX[k] = t);
  }
  function planks(g, w, h, o) {
    var r = rnd(o.seed), n = o.n || 4, pw = w / n;
    for (var i = 0; i < n; i++) {
      g.fillStyle = 'hsl(' + (o.h + (r() - 0.5) * 5) + ',' + o.s + '%,' + (o.l + (r() - 0.5) * 7) + '%)';
      g.fillRect(i * pw, 0, pw + 1, h);
      for (var k = 0; k < 7; k++) {
        var gx = i * pw + 4 + r() * (pw - 8), amp = 1.5 + r() * 3, ph = r() * 6;
        g.strokeStyle = r() < 0.5 ? 'rgba(70,35,10,' + (0.05 + r() * 0.07) + ')' : 'rgba(255,240,210,' + (0.05 + r() * 0.06) + ')';
        g.lineWidth = 1 + r() * 2; g.beginPath();
        for (var y = 0; y <= h; y += 16) { var xx = gx + Math.sin(y / h * 6.28 + ph) * amp; if (y) g.lineTo(xx, y); else g.moveTo(xx, y); }
        g.stroke();
      }
      g.fillStyle = 'rgba(45,22,6,.45)'; g.fillRect(i * pw, 0, 2, h);
      g.fillStyle = 'rgba(255,245,220,.14)'; g.fillRect(i * pw + 2, 0, 2, h);
    }
  }
  function woodTex(kind, rep) {
    var o = { light: { h: 34, s: 55, l: 66, seed: 3 }, mid: { h: 27, s: 52, l: 46, seed: 11 }, dark: { h: 22, s: 45, l: 30, seed: 23 }, bamboo: { h: 48, s: 52, l: 70, seed: 5, n: 8 } }[kind];
    return ctex('wood_' + kind, 256, 256, function (g, w, h) { planks(g, w, h, o); }, rep || [1, 1]);
  }
  function brickTex(rep) {
    return ctex('brick', 256, 256, function (g, w, h) {
      g.fillStyle = '#d9cbb6'; g.fillRect(0, 0, w, h);
      var r = rnd(5), bh = 32, bw = 64;
      for (var y = 0; y < h / bh; y++) for (var x = -1; x <= w / bw; x++) {
        var ox = (y % 2) * bw / 2;
        g.fillStyle = 'hsl(' + (10 + r() * 12) + ',' + (52 + r() * 12) + '%,' + (40 + r() * 13) + '%)';
        g.fillRect(x * bw + ox + 2, y * bh + 2, bw - 4, bh - 4);
        g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x * bw + ox + 2, y * bh + 2, bw - 4, 5);
        g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x * bw + ox + 2, y * bh + bh - 8, bw - 4, 6);
      }
    }, rep || [2, 1]);
  }
  function gridTex() {       // wire basket: transparent with thin dark wires
    return ctex('grid', 128, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#3a3d42'; g.lineWidth = 5;
      for (var i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 16); g.lineTo(w, i * 16); g.stroke(); }
    }, [2, 1]);
  }
  function pineTex() {
    return ctex('pine', 128, 128, function (g, w, h) {
      g.fillStyle = '#d99a2b'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8a5a12'; g.lineWidth = 4;
      for (var i = -8; i < 16; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i * 16 + 128, 0); g.lineTo(i * 16, 128); g.stroke(); }
      g.fillStyle = '#f2c14e';
      for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) { g.beginPath(); g.arc(x * 16 + (y % 2 ? 8 : 0), y * 16 + 8, 2.5, 0, 6.3); g.fill(); }
    }, [3, 2]);
  }
  function discTex(key, draw) { return ctex(key, 128, 128, function (g, w, h) { g.clearRect(0, 0, w, h); draw(g, w / 2); }); }
  function makiTex(col) {
    return discTex('maki' + col, function (g, c) {
      g.fillStyle = '#16221b'; g.beginPath(); g.arc(c, c, c, 0, 6.3); g.fill();
      g.fillStyle = '#faf7ee'; g.beginPath(); g.arc(c, c, c * 0.84, 0, 6.3); g.fill();
      g.fillStyle = 'rgba(190,180,160,.5)'; var r = rnd(9);
      for (var i = 0; i < 40; i++) { g.beginPath(); g.arc(c + (r() - 0.5) * c * 1.4, c + (r() - 0.5) * c * 1.4, 2.2, 0, 6.3); g.fill(); }
      g.fillStyle = col; g.beginPath(); g.arc(c, c, c * 0.36, 0, 6.3); g.fill();
      g.fillStyle = '#7cc84a'; g.beginPath(); g.arc(c + c * 0.22, c - c * 0.12, c * 0.14, 0, 6.3); g.fill();
    });
  }
  function pizzaTex() {
    return discTex('pizza', function (g, c) {
      g.fillStyle = '#d9a25a'; g.beginPath(); g.arc(c, c, c, 0, 6.3); g.fill();
      g.fillStyle = '#c8371f'; g.beginPath(); g.arc(c, c, c * 0.84, 0, 6.3); g.fill();
      g.fillStyle = '#f6dc8a'; g.beginPath(); g.arc(c, c, c * 0.78, 0, 6.3); g.fill();
      var r = rnd(4);
      for (var i = 0; i < 9; i++) { var a = r() * 6.3, d = r() * c * 0.6; g.fillStyle = '#b3261a'; g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, c * 0.13, 0, 6.3); g.fill(); }
      for (i = 0; i < 12; i++) { a = r() * 6.3; d = r() * c * 0.65; g.fillStyle = '#3f8f2a'; g.beginPath(); g.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, 6, 3, a, 0, 6.3); g.fill(); }
    });
  }
  function soupTex() {
    return discTex('soup', function (g, c) {
      var gr = g.createRadialGradient(c, c, 4, c, c, c); gr.addColorStop(0, '#f08a3a'); gr.addColorStop(1, '#c9521c');
      g.fillStyle = gr; g.beginPath(); g.arc(c, c, c, 0, 6.3); g.fill();
      var r = rnd(8), cols = ['#f6c544', '#5fae3a', '#f2e6c0', '#e8433a'];
      for (var i = 0; i < 22; i++) { var a = r() * 6.3, d = r() * c * 0.8; g.fillStyle = cols[i % 4]; g.beginPath(); g.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, 5 + r() * 4, 3 + r() * 3, a, 0, 6.3); g.fill(); }
      g.strokeStyle = 'rgba(255,240,200,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(c - 8, c - 6, c * 0.55, 3.4, 4.6); g.stroke();
    });
  }
  function marbleTex() {
    return ctex('marble', 256, 256, function (g, w, h) {
      g.fillStyle = '#f6f1ea'; g.fillRect(0, 0, w, h);
      var r = rnd(21);
      for (var i = 0; i < 14; i++) { g.strokeStyle = 'rgba(150,140,150,' + (0.08 + r() * 0.14) + ')'; g.lineWidth = 1 + r() * 2; g.beginPath(); var x = r() * w, y = r() * h; g.moveTo(x, y); for (var k = 0; k < 5; k++) { x += (r() - 0.3) * 70; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
    }, [2, 1]);
  }

  function chalkTex() {      // the menu written with chalk
    return ctex('chalk', 512, 320, function (g, w, h) {
      g.fillStyle = '#26332c'; g.fillRect(0, 0, w, h);
      var r = rnd(12);
      for (var i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.015 + r() * 0.03) + ')'; g.fillRect(r() * w, r() * h, 30 + r() * 90, 3 + r() * 10); }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffe9a8'; g.font = '50px "Luckiest Guy", sans-serif'; g.fillText('MENU DU JOUR', w / 2, 44);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(70, 78); g.lineTo(w - 70, 78); g.stroke();
      g.font = '30px "Luckiest Guy", sans-serif'; g.textAlign = 'left';
      [['Burger maison', '#ffffff'], ['Pizza au feu de bois', '#ffd0d0'], ['Soupe du chef', '#d6f5c8'], ['Jus tropical', '#ffe9a8'], ['Gâteau de l’île', '#d0e8ff']].forEach(function (l, k) {
        g.fillStyle = l[1]; g.fillText('•  ' + l[0], 70, 118 + k * 42);
      });
      g.strokeStyle = '#ffe9a8'; g.lineWidth = 4; g.beginPath(); g.arc(w - 74, h - 70, 34, 0, 6.3); g.stroke();
      g.beginPath(); g.moveTo(w - 96, h - 62); g.quadraticCurveTo(w - 74, h - 40, w - 52, h - 62); g.stroke();
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(w - 86, h - 80, 4, 0, 6.3); g.arc(w - 62, h - 80, 4, 0, 6.3); g.fill();
    });
  }
  function clockTex() {
    return ctex('clock', 128, 128, function (g, w) {
      var c = w / 2;
      g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, w);
      g.strokeStyle = '#2b1a10'; g.lineCap = 'round';
      for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; g.lineWidth = i % 3 ? 2 : 5; g.beginPath(); g.moveTo(c + Math.cos(a) * 46, c + Math.sin(a) * 46); g.lineTo(c + Math.cos(a) * 56, c + Math.sin(a) * 56); g.stroke(); }
      g.lineWidth = 6; g.beginPath(); g.moveTo(c, c); g.lineTo(c - 22, c - 14); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.moveTo(c, c); g.lineTo(c + 14, c - 38); g.stroke();
      g.fillStyle = '#c62828'; g.beginPath(); g.arc(c, c, 5, 0, 6.3); g.fill();
    });
  }
  // two-colour stripes (awnings, parasols)
  function stripeTex(a, b, rep) {
    return ctex('stripe' + a + b, 64, 64, function (g, w, h) { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; g.fillRect(0, 0, w / 2, h); }, rep || [1, 1]);
  }
  // soft speckles: grass, sand, snow or paving once tinted
  function speckleTex(rep) {
    return ctex('speckle', 256, 256, function (g, w, h) {
      g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, h);
      var r = rnd(33);
      for (var i = 0; i < 1500; i++) {
        var d = r() < 0.5;
        g.fillStyle = d ? 'rgba(0,0,0,' + (0.03 + r() * 0.08) + ')' : 'rgba(255,255,255,' + (0.2 + r() * 0.5) + ')';
        g.beginPath(); g.ellipse(r() * w, r() * h, 1 + r() * 5, 1 + r() * 3, r() * 3, 0, 6.3); g.fill();
      }
    }, rep || [1, 1]);
  }

  // ---------------- materials (shared) ----------------
  function M(key, o) { if (!MAT[key]) MAT[key] = new T.MeshStandardMaterial(o); return MAT[key]; }
  function col(hex, rough, metal) { return M('c' + hex + '_' + (rough == null ? 7 : rough) + '_' + (metal || 0), { color: hex, roughness: rough == null ? 0.7 : rough, metalness: metal || 0 }); }
  function steel() { return M('steel', { color: 0xd6dbe1, metalness: 0.95, roughness: 0.24 }); }
  function steelD() { return M('steelD', { color: 0x9aa1aa, metalness: 0.9, roughness: 0.36 }); }
  function iron() { return M('iron', { color: 0x25272c, metalness: 0.65, roughness: 0.5 }); }
  function black() { return M('black', { color: 0x1b1b1e, metalness: 0.2, roughness: 0.55 }); }
  function copper() { return M('copper', { color: 0xd0733a, metalness: 0.95, roughness: 0.22 }); }
  function brass() { return M('brass', { color: 0xe2b04a, metalness: 0.95, roughness: 0.3 }); }
  function glass() { return M('glass', { color: 0xd8f1f8, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.32, depthWrite: false }); }
  function wood(kind, rep) { return M('wood_' + kind + (rep ? rep.join('x') : ''), { color: 0xffffff, map: woodTex(kind, rep), roughness: 0.72 }); }
  function glow(key, hex, power) { return M('glow_' + key, { color: hex, emissive: hex, emissiveIntensity: power == null ? 1.2 : power, roughness: 0.6 }); }
  function flameM(key, hex) {
    if (!MAT['fl_' + key]) MAT['fl_' + key] = new T.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
    return MAT['fl_' + key];
  }

  // ---------------- shape helpers: each adds a mesh to the group g ----------------
  function add(g, geo, m, x, y, z) { var me = new T.Mesh(geo, m); me.position.set(x || 0, y || 0, z || 0); g.add(me); return me; }
  function box(g, w, h, d, m, x, y, z, r) {
    return add(g, r ? new T.RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)) : new T.BoxGeometry(w, h, d), m, x, y, z);
  }
  function cyl(g, rt, rb, h, m, x, y, z, seg, open) { return add(g, new T.CylinderGeometry(rt, rb, h, seg || 20, 1, !!open), m, x, y, z); }
  function sph(g, r, m, x, y, z, sx, sy, sz) { var me = add(g, new T.SphereGeometry(r, 18, 12), m, x, y, z); if (sx) me.scale.set(sx, sy, sz); return me; }
  function cone(g, r, h, m, x, y, z, seg) { return add(g, new T.ConeGeometry(r, h, seg || 10), m, x, y, z); }
  function torus(g, R, r, m, x, y, z, arc) { return add(g, new T.TorusGeometry(R, r, 8, 20, arc || Math.PI * 2), m, x, y, z); }
  function lathe(g, pts, m, x, y, z, seg) {
    var me = add(g, new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }), seg || 28), m, x, y, z);
    return me;
  }
  function grp(parent, x, y, z, dyn) { var o = new T.Group(); o.position.set(x || 0, y || 0, z || 0); if (dyn) o.userData.dyn = true; parent.add(o); return o; }

  // merge the still meshes of a model by material: 5 to 10 draw calls instead of 60
  function bake(g) {
    g.updateMatrixWorld(true);
    var inv = new T.Matrix4().copy(g.matrixWorld).invert(), byMat = {}, rm = [];
    g.traverse(function (o) {
      if (!o.isMesh || Array.isArray(o.material)) return;
      for (var p = o; p && p !== g; p = p.parent) if (p.userData.dyn) return;
      var geo = o.geometry.clone();
      geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      Object.keys(geo.attributes).forEach(function (k) { if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') geo.deleteAttribute(k); });
      var id = o.material.uuid;
      (byMat[id] = byMat[id] || { m: o.material, list: [] }).list.push(geo);
      rm.push(o);
    });
    rm.forEach(function (o) { o.parent.remove(o); o.geometry.dispose(); });
    Object.keys(byMat).forEach(function (id) {
      var list = byMat[id].list;
      // merging needs the same kind of geometry everywhere: all indexed, or none
      if (list.some(function (q) { return !q.index; })) list = list.map(function (q) { return q.index ? q.toNonIndexed() : q; });
      var geo = list.length > 1 ? T.mergeGeometries(list, false) : list[0];
      if (geo) g.add(new T.Mesh(geo, byMat[id].m)); else console.warn('models: merge failed');
    });
    g.traverse(function (o) {
      if (!o.isMesh) return;
      var m = Array.isArray(o.material) ? o.material[0] : o.material;
      var soft = m.transparent || m.isMeshBasicMaterial;
      o.castShadow = !soft; o.receiveShadow = !soft;
    });
    return g;
  }

  // small flames (cones) that flicker; returns a function(t, power)
  function flames(g, list, key, hex, h) {
    var fs = list.map(function (p, i) {
      var f = cone(g, p[3] || 0.03, h || 0.1, flameM(key, hex), p[0], p[1], p[2], 7);
      f.userData.dyn = true; f.userData.ph = i * 1.7; f.userData.y0 = p[1];
      return f;
    });
    return function (t, power) {
      for (var i = 0; i < fs.length; i++) {
        var f = fs[i], k = (0.75 + 0.25 * Math.sin(t * 17 + f.userData.ph) + 0.12 * Math.sin(t * 31 + f.userData.ph * 2)) * power;
        f.scale.set(0.8 + 0.2 * k, Math.max(0.05, k), 0.8 + 0.2 * k);
        f.position.y = f.userData.y0 + (h || 0.1) * 0.5 * (k - 1);
        f.visible = power > 0.05;
      }
    };
  }
  function knob(g, x, y, z, r) {      // a round control knob on a front panel
    var k = cyl(g, r || 0.034, r || 0.034, 0.035, black(), x, y, z, 14); k.rotation.x = Math.PI / 2;
    var d = box(g, 0.008, (r || 0.034) * 1.1, 0.01, col(0xe8433a, 0.5), x, y + (r || 0.034) * 0.35, z + 0.02);
    return [k, d];
  }
  // portable gas stove shared by the pot and the wok; returns the flame function
  function stove(g) {
    box(g, 0.66, 0.13, 0.54, steel(), 0, 0.085, 0, 0.03);
    box(g, 0.58, 0.02, 0.46, iron(), 0, 0.158, 0);
    [-0.25, 0.25].forEach(function (x) { [-0.19, 0.19].forEach(function (z) { cyl(g, 0.025, 0.03, 0.02, black(), x, 0.01, z, 10); }); });
    knob(g, -0.2, 0.085, 0.272, 0.036); knob(g, 0.2, 0.085, 0.272, 0.036);
    box(g, 0.16, 0.035, 0.012, steelD(), 0, 0.085, 0.272);
    cyl(g, 0.11, 0.12, 0.03, iron(), 0, 0.18, 0, 20);                 // burner
    for (var i = 0; i < 4; i++) { var b = box(g, 0.44, 0.022, 0.03, iron(), 0, 0.2, 0); b.rotation.y = i * Math.PI / 4; }   // pot support
    var ring = [];
    for (i = 0; i < 12; i++) { var a = i / 12 * 6.283; ring.push([Math.cos(a) * 0.125, 0.225, Math.sin(a) * 0.125, 0.022]); }
    return flames(g, ring, 'blue', 0x49a8ff, 0.07);
  }

  // =====================================================================================
  // the 8 stations
  // =====================================================================================
  var BUILD = {};

  // ---- grill: stainless counter grill, cast-iron grate, patties, raised lid ----
  BUILD.grill = function (g) {
    box(g, 0.98, 0.25, 0.6, steel(), 0, 0.165, 0, 0.035);
    [-0.4, 0.4].forEach(function (x) { [-0.22, 0.22].forEach(function (z) { cyl(g, 0.03, 0.035, 0.04, black(), x, 0.02, z, 10); }); });
    box(g, 0.9, 0.085, 0.015, steelD(), 0, 0.15, 0.302);
    [-0.33, -0.11, 0.11, 0.33].forEach(function (x) { knob(g, x, 0.15, 0.315); });
    box(g, 0.5, 0.02, 0.03, steel(), 0, 0.075, 0.31, 0.008);          // grease drawer handle
    box(g, 0.88, 0.035, 0.5, iron(), 0, 0.295, 0);                      // firebox
    var ember = box(g, 0.82, 0.006, 0.44, glow('ember', 0xff5a14, 0.9), 0, 0.316, 0); ember.userData.dyn = true;
    for (var i = 0; i < 12; i++) cyl(g, 0.009, 0.009, 0.46, iron(), -0.385 + i * 0.07, 0.335, 0, 6).rotation.x = Math.PI / 2;
    [-0.24, 0.24].forEach(function (z) { box(g, 0.86, 0.016, 0.016, iron(), 0, 0.335, z); });
    // lid, open at the back
    var lid = grp(g, 0, 0.3, -0.29);
    var shell = add(lid, new T.CylinderGeometry(0.3, 0.3, 0.96, 20, 1, true, 0, Math.PI), M('steelDS', { color: 0xd6dbe1, metalness: 0.95, roughness: 0.24, side: T.DoubleSide }), 0, 0.3, 0);
    shell.rotation.z = Math.PI / 2; shell.rotation.y = Math.PI; shell.position.set(0, 0.02, 0.02);
    lid.rotation.x = -0.55;
    cyl(lid, 0.016, 0.016, 0.5, black(), 0, 0.3, 0.14, 8).rotation.z = Math.PI / 2;
    // food: three patties with grill marks, one bun waiting
    var food = grp(g, 0, 0.345, 0, true), mark = col(0x2a1608, 0.8), pats = [];
    [-0.26, 0, 0.26].forEach(function (x, k) {
      var p = grp(food, x, 0, k === 1 ? -0.06 : 0.05);
      var pm = new T.MeshStandardMaterial({ color: 0x6b3a1c, roughness: 0.75 });     // its own colour: raw, cooked, burnt
      cyl(p, 0.085, 0.09, 0.034, pm, 0, 0.017, 0, 18);
      var mk = grp(p, 0, 0, 0);
      [-0.03, 0.03].forEach(function (z) { box(mk, 0.13, 0.004, 0.012, mark, 0, 0.036, z); });
      pats.push({ g: p, m: pm, marks: mk });
    });
    var bun = col(0xe2a551, 0.6);
    var bunG = grp(g, 0.36, 0.345, -0.14, true);          // a bun waiting (manager's view)
    sph(bunG, 0.085, bun, 0, 0.015, 0, 1, 0.55, 1); cyl(bunG, 0.083, 0.08, 0.025, bun, 0, 0, 0, 16);
    // simulator: the burger being built, layer after layer, next to the grate
    var asm = grp(g, 0.37, 0.345, -0.13, true), lay = [];
    lay.push(cyl(asm, 0.083, 0.078, 0.028, bun, 0, 0.014, 0, 16));
    lay.push(cyl(asm, 0.085, 0.088, 0.03, col(0x5a3018, 0.75), 0, 0.044, 0, 18));
    var chz = box(asm, 0.16, 0.008, 0.16, col(0xffc531, 0.5), 0, 0.064, 0); chz.rotation.y = 0.78; lay.push(chz);
    lay.push(cyl(asm, 0.094, 0.094, 0.012, col(0x57b83a, 0.7), 0, 0.075, 0, 9));
    asm.visible = false;
    // spatula
    var sp = grp(g, -0.36, 0.35, -0.15); sp.rotation.y = 0.5;
    box(sp, 0.09, 0.006, 0.11, steel(), 0, 0, 0.05); cyl(sp, 0.008, 0.008, 0.16, steelD(), 0, 0.012, -0.08, 6).rotation.x = Math.PI / 2;
    box(sp, 0.026, 0.02, 0.1, black(), 0, 0.016, -0.2, 0.008);
    var fl = flames(g, [[-0.3, 0.33, 0.12], [-0.1, 0.33, -0.1], [0.12, 0.33, 0.13], [0.3, 0.33, -0.08]], 'fire', 0xffa02a, 0.09);
    var RAW = new T.Color(0xdb8c84), DONE = new T.Color(0x6b3a1c), BURNT = new T.Color(0x17110d), mode = -1;
    return function (dt, t, s) {
      var k = s.cooking ? 1 : 0.25, h = s.h, i;
      ember.material.emissiveIntensity = (0.5 + 0.35 * Math.sin(t * 9) * 0.3) * (s.cooking ? 2.2 : 0.9);
      fl(t, s.cooking ? 0.9 : 0);
      if ((h ? 1 : 0) !== mode) {
        mode = h ? 1 : 0; bunG.visible = !h; asm.visible = false;
        for (i = 0; i < 3; i++) { pats[i].g.visible = !h; pats[i].m.color.copy(DONE); pats[i].marks.visible = true; pats[i].g.rotation.x = 0; pats[i].g.position.y = 0; }
      }
      if (!h) {
        for (i = 0; i < 3; i++) pats[i].g.position.y = s.cooking ? Math.abs(Math.sin(t * 23 + i * 2)) * 0.006 : 0;
        food.scale.setScalar(1 + (k - 0.25) * 0.02);
        return;
      }
      // simulator: one steak per thing on the fire, and the burger that is being built
      var by = [null, null, null], a = null;
      for (i = 0; i < h.cooking.length; i++) { var u0 = h.cooking[i]; if (u0.ph === 'fin') a = a || u0; else by[(u0.slot || 0) % 3] = u0; }
      for (i = 0; i < 3; i++) {
        var u = by[i], p = pats[i];
        p.g.visible = !!u;
        if (!u) continue;
        if (u.ph === 'burnt') p.m.color.copy(BURNT); else p.m.color.copy(RAW).lerp(DONE, Math.min(1, u.t / u.total * 1.3));
        p.marks.visible = !!u.flip || u.ph === 'burnt';
        if (u.flip && !u._fl) { u._fl = 1; u._ft = 0.001; }          // it jumps and turns over
        if (u._ft) {
          u._ft += dt; var q = Math.min(1, u._ft / 0.32);
          p.g.rotation.x = Math.PI * q; p.g.position.y = Math.sin(Math.PI * q) * 0.1;
          if (q >= 1) { u._ft = 0; p.g.rotation.x = 0; p.g.position.y = 0; }
        } else p.g.position.y = u.ph === 'cook' ? Math.abs(Math.sin(t * 23 + i * 2)) * 0.005 : 0;
      }
      asm.visible = !!a;
      if (a) for (i = 0; i < lay.length; i++) lay[i].visible = a.fin >= (i < 2 ? 1 : 2);
    };
  };

  // ---- juice bar: wooden stand, blender, glass, oranges, pineapple ----
  BUILD.jus = function (g) {
    box(g, 0.96, 0.15, 0.56, wood('mid', [2, 1]), 0, 0.075, 0, 0.02);
    box(g, 1.0, 0.03, 0.6, wood('light', [2, 1]), 0, 0.165, 0, 0.012);
    // blender
    var bl = grp(g, -0.3, 0.18, -0.04, true);
    cyl(bl, 0.085, 0.11, 0.13, black(), 0, 0.065, 0, 20);
    cyl(bl, 0.02, 0.02, 0.012, glow('led', 0x57e06a, 1.6), 0, 0.07, 0.1, 10).rotation.x = Math.PI / 2;
    cyl(bl, 0.07, 0.085, 0.03, steel(), 0, 0.145, 0, 20);
    cyl(bl, 0.105, 0.075, 0.3, glass(), 0, 0.31, 0, 20, true);
    var juice = cyl(bl, 0.094, 0.07, 0.21, M('juice', { color: 0xffa726, roughness: 0.35, emissive: 0xb85c00, emissiveIntensity: 0.25 }), 0, 0.27, 0, 20);
    cyl(bl, 0.11, 0.11, 0.03, black(), 0, 0.475, 0, 20); cyl(bl, 0.03, 0.035, 0.03, black(), 0, 0.5, 0, 12);
    box(bl, 0.03, 0.18, 0.02, black(), 0.12, 0.33, 0, 0.008);
    juice.userData.dyn = true; bake(bl);
    // glass of juice with a straw
    cyl(g, 0.055, 0.042, 0.16, glass(), -0.06, 0.26, 0.12, 16, true);
    cyl(g, 0.049, 0.039, 0.12, M('juice'), -0.06, 0.245, 0.12, 16);
    var straw = cyl(g, 0.007, 0.007, 0.22, col(0xe8433a, 0.5), -0.045, 0.31, 0.12, 6); straw.rotation.z = -0.25;
    // oranges and a cut one
    var or = col(0xff8f1c, 0.55);
    sph(g, 0.068, or, 0.14, 0.248, 0.14); sph(g, 0.068, or, 0.27, 0.248, 0.12); sph(g, 0.066, or, 0.205, 0.345, 0.12);
    sph(g, 0.066, or, 0.07, 0.215, -0.14, 1, 0.5, 1); cyl(g, 0.062, 0.062, 0.006, col(0xffc266, 0.5), 0.07, 0.249, -0.14, 16);
    // pineapple
    var pn = grp(g, 0.32, 0.18, -0.12);
    sph(pn, 0.1, M('pine', { color: 0xffffff, map: pineTex(), roughness: 0.7 }), 0, 0.14, 0, 1, 1.4, 1);
    var leaf = col(0x3f8f2a, 0.7);
    for (var i = 0; i < 9; i++) { var c = cone(pn, 0.028, 0.2, leaf, 0, 0.36, 0, 5); var a = i / 9 * 6.283, tl = i % 3 === 0 ? 0.12 : 0.5; c.rotation.set(Math.cos(a) * tl, 0, -Math.sin(a) * tl); c.position.set(Math.sin(a) * tl * 0.1, 0.36 - tl * 0.04, Math.cos(a) * tl * 0.1); }
    // stack of cups
    for (i = 0; i < 3; i++) cyl(g, 0.045, 0.036, 0.1, glass(), 0.42, 0.235 + i * 0.03, 0.16, 14, true);
    return function (dt, t, s) {
      var run = s.cooking, h = s.h;
      if (h) {                              // simulator: the blender is empty until the fruits go in
        var u = null;
        for (var i = 0; i < h.cooking.length; i++) if (h.cooking[i].ph !== 'fin') { u = h.cooking[i]; break; }
        juice.visible = !!u; run = !!u && u.ph === 'cook';
      } else juice.visible = true;
      juice.rotation.y += dt * (run ? 22 : 0);
      juice.scale.y = run ? 1 + Math.sin(t * 30) * 0.03 : 1;
      bl.position.x = -0.3 + (run ? Math.sin(t * 60) * 0.003 : 0);
      bl.rotation.z = run ? Math.sin(t * 47) * 0.012 : 0;
    };
  };

  // ---- fryer: two oil tanks, wire baskets full of fries ----
  BUILD.frites = function (g) {
    box(g, 0.98, 0.34, 0.56, steel(), 0, 0.2, 0.02, 0.03);
    [-0.4, 0.4].forEach(function (x) { [-0.2, 0.24].forEach(function (z) { cyl(g, 0.03, 0.035, 0.04, black(), x, 0.02, z, 10); }); });
    box(g, 0.98, 0.2, 0.09, steelD(), 0, 0.46, -0.235, 0.02);                    // control tower at the back
    [-0.24, 0.24].forEach(function (x) {
      knob(g, x - 0.08, 0.47, -0.185, 0.03);
      cyl(g, 0.016, 0.016, 0.012, glow('ledR', 0xff4a3a, 1.8), x + 0.04, 0.5, -0.188, 10).rotation.x = Math.PI / 2;
      cyl(g, 0.016, 0.016, 0.012, glow('led', 0x57e06a, 1.6), x + 0.1, 0.5, -0.188, 10).rotation.x = Math.PI / 2;
    });
    box(g, 0.6, 0.03, 0.012, black(), 0, 0.12, 0.305);
    var oilM = M('oil', { color: 0xd49a22, roughness: 0.12, metalness: 0.1, emissive: 0x6b3a00, emissiveIntensity: 0.3 });
    var wire = M('wire', { color: 0xffffff, map: gridTex(), alphaTest: 0.5, side: T.DoubleSide, metalness: 0.7, roughness: 0.4 });
    var fry = col(0xf7c948, 0.6), r = rnd(12), baskets = [], bubbles = [];
    [-0.235, 0.235].forEach(function (x, k) {
      box(g, 0.41, 0.03, 0.38, iron(), x, 0.36, 0.045);
      box(g, 0.37, 0.006, 0.34, oilM, x, 0.378, 0.045);
      var b = grp(g, x, 0.46, 0.045, true);
      [[0, 0, 0.14, 0.3, 0.13, 0], [0, 0, -0.14, 0.3, 0.13, 0], [0.15, 0, 0, 0.28, 0.13, 1], [-0.15, 0, 0, 0.28, 0.13, 1]].forEach(function (p) {
        var side = add(b, new T.PlaneGeometry(p[3], p[4]), wire, p[0], p[1], p[2]); if (p[5]) side.rotation.y = Math.PI / 2;
      });
      add(b, new T.PlaneGeometry(0.3, 0.28), wire, 0, -0.065, 0).rotation.x = Math.PI / 2;
      box(b, 0.31, 0.012, 0.012, steelD(), 0, 0.066, 0.14); box(b, 0.31, 0.012, 0.012, steelD(), 0, 0.066, -0.14);
      box(b, 0.012, 0.012, 0.29, steelD(), 0.15, 0.066, 0); box(b, 0.012, 0.012, 0.29, steelD(), -0.15, 0.066, 0);
      var hd = cyl(b, 0.009, 0.009, 0.2, steelD(), 0, 0.09, 0.24, 6); hd.rotation.x = Math.PI / 2 - 0.25;
      box(b, 0.03, 0.03, 0.1, black(), 0, 0.118, 0.37, 0.012).rotation.x = -0.25;
      for (var i = 0; i < 26; i++) {
        var f = box(b, 0.02, 0.02, 0.09 + r() * 0.07, fry, (r() - 0.5) * 0.24, -0.03 + r() * 0.1, (r() - 0.5) * 0.2);
        f.rotation.set((r() - 0.5) * 1.2, r() * 3.1, (r() - 0.5) * 1.2);
      }
      bake(b);
      // the fries of this basket get their own colour (pale, golden, burnt) and can be taken out
      b.children.forEach(function (me) { if (me.isMesh && me.material === fry) { me.material = fry.clone(); b.userData.fries = me; } });
      b.userData.k = k; baskets.push(b);
      for (i = 0; i < 6; i++) { var bb = sph(g, 0.014, col(0xf7e0a0, 0.3), x + (r() - 0.5) * 0.3, 0.384, 0.045 + (r() - 0.5) * 0.28); bb.userData.dyn = true; bb.userData.ph = r() * 6; bubbles.push(bb); }
    });
    var PALE = new T.Color(0xf4e8bd), GOLD = new T.Color(0xf7c948), DARK = new T.Color(0x3d2814);
    return function (dt, t, s) {
      var h = s.h, hot = [s.cooking, s.cooking];
      for (var i = 0; i < baskets.length; i++) {
        var b = baskets[i], fr = b.userData.fries, down = s.cooking;
        if (h) {                            // simulator: basket i = the thing cooking in tank i
          var u = null;
          for (var q = 0; q < h.cooking.length; q++) if ((h.cooking[q].slot || 0) % 2 === i) { u = h.cooking[q]; break; }
          down = !!u && u.ph !== 'fin';
          hot[i] = down && u.ph !== 'burnt';
          if (fr) {
            fr.visible = !!u;
            if (u) { if (u.ph === 'burnt') fr.material.color.copy(DARK); else fr.material.color.copy(PALE).lerp(GOLD, Math.min(1, u.t / u.total)); }
          }
        } else if (fr) { fr.visible = true; fr.material.color.copy(GOLD); }
        var target = down ? 0.405 : 0.5;
        b.position.y += (target - b.position.y) * Math.min(1, dt * 6);
        b.rotation.z = hot[i] ? Math.sin(t * 9 + i) * 0.015 : 0;
      }
      for (i = 0; i < bubbles.length; i++) {
        var k = hot[i < 6 ? 0 : 1] ? Math.max(0, Math.sin(t * 7 + bubbles[i].userData.ph)) : 0;
        bubbles[i].scale.setScalar(0.01 + k * 1.3); bubbles[i].visible = k > 0.05;
      }
    };
  };

  // ---- pizza oven: brick dome, fire inside, logs below, chimney ----
  BUILD.pizza = function (g) {
    var br = M('brick', { color: 0xffffff, map: brickTex([3, 1]), roughness: 0.9 });
    var br2 = M('brick2', { color: 0xffffff, map: brickTex([4, 2]), roughness: 0.9 });
    var stone = col(0xcfc4b4, 0.85);
    box(g, 0.34, 0.24, 0.7, br, -0.31, 0.12, 0); box(g, 0.34, 0.24, 0.7, br, 0.31, 0.12, 0);    // base, with a niche for the wood
    box(g, 0.3, 0.24, 0.4, br, 0, 0.12, -0.15);
    box(g, 0.3, 0.02, 0.3, col(0x2a1a10, 0.9), 0, 0.012, 0.2);
    var bark = col(0x6b4226, 0.9), cut = col(0xe0b27a, 0.8);
    [[-0.08, 0.05], [0.0, 0.05], [0.08, 0.05], [-0.04, 0.125], [0.04, 0.125]].forEach(function (p) {
      cyl(g, 0.04, 0.04, 0.3, bark, p[0], p[1], 0.2, 10).rotation.x = Math.PI / 2;
      cyl(g, 0.034, 0.034, 0.004, cut, p[0], p[1], 0.352, 10).rotation.x = Math.PI / 2;
    });
    box(g, 1.0, 0.05, 0.74, stone, 0, 0.265, 0, 0.012);
    var dome = add(g, new T.SphereGeometry(0.47, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2), br2, 0, 0.29, -0.02); dome.scale.set(1, 0.84, 0.74);
    // mouth: arch, dark cavity, glow
    var arch = torus(g, 0.19, 0.04, stone, 0, 0.3, 0.315, Math.PI);
    box(g, 0.08, 0.02, 0.07, stone, -0.19, 0.3, 0.315); box(g, 0.08, 0.02, 0.07, stone, 0.19, 0.3, 0.315);
    var cav = add(g, new T.CircleGeometry(0.17, 20, 0, Math.PI), col(0x120a06, 1), 0, 0.3, 0.312);
    var fire = add(g, new T.CircleGeometry(0.15, 20, 0, Math.PI), glow('oven', 0xff6a1a, 1.3), 0, 0.3, 0.3); fire.userData.dyn = true;
    var pzCr = col(0xd9a25a, 0.7).clone(), pzTop = M('pizzaTop', { color: 0xffffff, map: pizzaTex(), roughness: 0.6 }).clone();
    var pz = cyl(g, 0.12, 0.12, 0.014, [pzCr, pzTop, pzCr], 0, 0.3, 0.33, 22);
    pz.userData.dyn = true;
    var fl = flames(g, [[-0.09, 0.33, 0.27, 0.035], [0, 0.34, 0.25, 0.045], [0.09, 0.33, 0.27, 0.035]], 'fire', 0xffa02a, 0.14);
    // chimney
    cyl(g, 0.065, 0.075, 0.24, br, 0.0, 0.76, -0.2, 14); cyl(g, 0.09, 0.09, 0.03, stone, 0, 0.89, -0.2, 14);
    cone(g, 0.1, 0.07, col(0x3a3d42, 0.5, 0.6), 0, 0.95, -0.2, 14);
    var WHITE = new T.Color(0xffffff), CRUST = new T.Color(0xd9a25a), DOUGH = new T.Color(0xf3e4c8), CHAR = new T.Color(0x2a1c14);
    return function (dt, t, s) {
      var h = s.h;
      fire.material.emissiveIntensity = (s.cooking ? 2.4 : 1.0) * (0.85 + 0.15 * Math.sin(t * 11));
      fl(t, s.cooking ? 1.1 : 0.55);
      if (!h) {
        pz.visible = true; pzTop.color.copy(WHITE); pzCr.color.copy(CRUST);
        pz.position.z = s.cooking ? 0.27 : 0.335;
        pz.rotation.y += dt * (s.cooking ? 1.5 : 0);
        return;
      }
      // simulator: the pizza goes in, is turned half-way, comes out on the hearth
      var u = h.cooking[0];
      pz.visible = !!u;
      if (!u) { pz.position.z = 0.345; return; }
      pz.position.z += ((u.ph === 'fin' ? 0.345 : 0.25) - pz.position.z) * Math.min(1, dt * 8);
      if (u.ph === 'burnt') { pzTop.color.copy(CHAR); pzCr.color.copy(CHAR); }
      else { pzTop.color.copy(WHITE); pzCr.color.copy(DOUGH).lerp(CRUST, Math.min(1, u.t / u.total)); }
      if (u.flip && !u._fl) { u._fl = 1; u._ft = 0.001; }
      if (u._ft) { u._ft += dt; pz.rotation.y += dt * 9; if (u._ft > 0.35) u._ft = 0; }
    };
  };

  // ---- copper pot of soup on a gas stove ----
  BUILD.soupe = function (g) {
    var fl = stove(g);
    var pot = grp(g, 0, 0.215, 0);
    lathe(pot, [[0, 0], [0.24, 0], [0.268, 0.025], [0.272, 0.3], [0.29, 0.31], [0.29, 0.33], [0.255, 0.33], [0.252, 0.05], [0, 0.045]], copper());
    [-1, 1].forEach(function (sd) {
      var h = torus(pot, 0.06, 0.014, brass(), sd * 0.3, 0.27, 0, Math.PI); h.rotation.set(Math.PI / 2, 0, sd > 0 ? -Math.PI / 2 : Math.PI / 2);
    });
    var soup = cyl(pot, 0.25, 0.25, 0.01, [col(0xc9521c, 0.4), M('soupTop', { color: 0xffffff, map: soupTex(), roughness: 0.6 }), col(0xc9521c, 0.4)], 0, 0.265, 0, 24);
    soup.userData.dyn = true;
    var lad = grp(pot, 0.12, 0.3, -0.05, true); lad.rotation.z = -0.5; lad.rotation.y = 0.6;
    cyl(lad, 0.011, 0.011, 0.34, steel(), 0, 0.13, 0, 8); sph(lad, 0.014, steel(), 0, 0.3, 0);
    var r = rnd(31), bubbles = [];
    for (var i = 0; i < 7; i++) { var b = sph(pot, 0.022, col(0xf5a45a, 0.25), (r() - 0.5) * 0.34, 0.272, (r() - 0.5) * 0.34); b.userData.dyn = true; b.userData.ph = r() * 6; bubbles.push(b); }
    var ladT = 0;
    return function (dt, t, s) {
      var h = s.h, hot = s.cooking, full = true;
      if (h) {                              // simulator: the pot is empty until a soup is started; each bowl lowers it
        var u = h.cooking[0];
        full = !!u; hot = !!u && u.ph !== 'fin';
        if (u) {
          soup.position.y = 0.265 - 0.05 * (u.fin || 0);
          if (u._sf !== u.fin) { if (u.fin) ladT = 0.45; u._sf = u.fin; }
        }
        if (h._nu !== h.cooking.length) { if (h._nu > h.cooking.length) ladT = 0.45; h._nu = h.cooking.length; }
      } else soup.position.y = 0.265;
      soup.visible = full;
      fl(t, hot ? 1.2 : 0.35);
      soup.rotation.y += dt * (hot ? 0.9 : 0.15);
      for (var i = 0; i < bubbles.length; i++) {
        var k = full ? Math.max(0, Math.sin(t * (hot ? 6 : 2) + bubbles[i].userData.ph)) * (hot ? 1 : 0.45) : 0;
        bubbles[i].scale.setScalar(0.01 + k); bubbles[i].visible = k > 0.08;
        bubbles[i].position.y = soup.position.y + 0.007;
      }
      // the ladle dips in each time a bowl is filled
      var q = ladT > 0 ? Math.sin(Math.PI * ladT / 0.45) : 0;
      if (ladT > 0) ladT -= dt;
      lad.position.y = 0.3 - q * 0.09; lad.rotation.z = -0.5 - q * 0.45;
    };
  };

  // ---- wok with noodles and vegetables ----
  BUILD.wok = function (g) {
    var fl = stove(g);
    var w = grp(g, 0, 0.222, 0, true);
    lathe(w, [[0, 0], [0.1, 0.008], [0.2, 0.05], [0.29, 0.13], [0.35, 0.21], [0.342, 0.22], [0.28, 0.146], [0.19, 0.068], [0.1, 0.026], [0, 0.02]], iron(), 0, 0, 0, 30);
    var hd = cyl(w, 0.022, 0.026, 0.3, wood('mid'), 0.47, 0.25, 0, 10); hd.rotation.z = -Math.PI / 2 + 0.28;
    cyl(w, 0.03, 0.03, 0.04, steelD(), 0.345, 0.213, 0, 10).rotation.z = -Math.PI / 2 + 0.28;
    torus(w, 0.045, 0.01, steelD(), -0.36, 0.215, 0, Math.PI).rotation.set(Math.PI / 2, 0, Math.PI / 2);
    var food = grp(w, 0, 0.05, 0);
    var r = rnd(17), noodle = col(0xf1d28c, 0.55), vg = [col(0x4caf50, 0.6), col(0xe53935, 0.55), col(0xff9800, 0.55), col(0x8bc34a, 0.6)];
    for (var i = 0; i < 12; i++) { var n = torus(food, 0.05 + r() * 0.07, 0.012, noodle, (r() - 0.5) * 0.2, 0.02 + r() * 0.05, (r() - 0.5) * 0.2, 3 + r() * 3); n.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.9, 0, r() * 6.28); }
    for (i = 0; i < 16; i++) { var v = box(food, 0.022, 0.012, 0.07 + r() * 0.05, vg[i % 4], (r() - 0.5) * 0.3, 0.05 + r() * 0.05, (r() - 0.5) * 0.3, 0.005); v.rotation.set((r() - 0.5), r() * 3.14, (r() - 0.5)); }
    for (i = 0; i < 5; i++) sph(food, 0.03, vg[0], (r() - 0.5) * 0.26, 0.07 + r() * 0.03, (r() - 0.5) * 0.26, 1.3, 0.35, 0.7);
    bake(food); food.userData.dyn = true; bake(w);
    return function (dt, t, s) {
      var h = s.h, k = s.cooking ? 1 : 0, flame = s.cooking ? 1.4 : 0.35;
      if (h) {                              // simulator: it only shakes a little... until the big toss
        var u = h.cooking[0];
        food.visible = !!u;
        flame = u && u.ph !== 'fin' ? (u.ph === 'cook' ? 1.4 : 0.8) : 0.35;
        k = u && u.ph === 'cook' ? 0.22 : 0;
        if (u && u.flip && !u._fl) { u._fl = 1; u._ft = 0.001; }
        if (u && u._ft) {
          u._ft += dt; var q = Math.min(1, u._ft / 0.7), up = Math.sin(Math.PI * q);
          fl(t, 1.9);
          w.rotation.z = Math.sin(q * Math.PI * 2) * 0.2;
          w.position.y = 0.222 + up * 0.06;
          food.position.y = 0.05 + up * 0.17;
          food.rotation.y += dt * 10;
          if (q >= 1) u._ft = 0;
          return;
        }
      } else food.visible = true;
      fl(t, flame);
      w.rotation.z = Math.sin(t * 7.5) * 0.11 * k;
      w.position.y = 0.222 + Math.max(0, Math.sin(t * 7.5 + 0.6)) * 0.035 * k;
      food.position.y = 0.05 + Math.max(0, Math.sin(t * 7.5 - 0.5)) * 0.06 * k;
      food.rotation.y += dt * 1.6 * k;
    };
  };

  // ---- sushi bar: bamboo board, rolling mat, makis, nigiris, knife ----
  BUILD.sushi = function (g) {
    box(g, 0.94, 0.2, 0.54, wood('dark', [2, 1]), 0, 0.1, 0, 0.015);
    for (var i = 0; i < 9; i++) box(g, 0.05, 0.17, 0.012, wood('mid'), -0.4 + i * 0.1, 0.1, 0.275, 0.006);
    box(g, 1.0, 0.035, 0.6, wood('bamboo', [1, 1]), 0, 0.218, 0, 0.012);
    // rolling mat with a whole roll
    box(g, 0.3, 0.008, 0.24, M('mat', { color: 0xb9c58a, map: woodTex('bamboo', [1, 3]), roughness: 0.8 }), -0.3, 0.24, -0.1);
    var nori = col(0x16221b, 0.7), rice = col(0xfaf7ee, 0.8);
    var showRoll = grp(g, -0.3, 0.284, -0.1, true);          // a whole roll on the mat (manager's view)
    cyl(showRoll, 0.04, 0.04, 0.26, nori, 0, 0, 0, 16).rotation.z = Math.PI / 2;
    cyl(showRoll, 0.036, 0.036, 0.262, rice, 0, 0, 0, 12).rotation.z = Math.PI / 2;
    // simulator: the roll being made: seaweed and rice, then the fish, then rolled
    var hs = grp(g, -0.3, 0.246, -0.1, true);
    var hNori = box(hs, 0.26, 0.004, 0.2, nori, 0, 0.002, 0), hRice = box(hs, 0.24, 0.012, 0.17, rice, 0, 0.011, 0);
    var hFish = box(hs, 0.24, 0.016, 0.045, col(0xff8a65, 0.45), 0, 0.025, 0);
    var hRoll = grp(hs, 0, 0.04, 0);
    cyl(hRoll, 0.04, 0.04, 0.26, nori, 0, 0, 0, 16).rotation.z = Math.PI / 2;
    cyl(hRoll, 0.036, 0.036, 0.262, rice, 0, 0, 0, 12).rotation.z = Math.PI / 2;
    hs.visible = false;
    // cut makis
    var cols = ['#ff8a65', '#e53935', '#ff8a65', '#ffb300', '#e53935'];
    cols.forEach(function (c, k) {
      var cap = M('makiCap' + c, { color: 0xffffff, map: makiTex(c), roughness: 0.7 });
      cyl(g, 0.043, 0.043, 0.04, [nori, cap, cap], -0.02 + k * 0.095, 0.256, 0.16, 18);
    });
    // nigiris on a small slate
    box(g, 0.34, 0.012, 0.13, col(0x2f3338, 0.5), 0.27, 0.242, -0.02, 0.005);
    [[0xff8a65, 0xffc4ae], [0xd32f2f, 0xf28b82], [0xffa726, 0xffe0b2]].forEach(function (c, k) {
      var x = 0.165 + k * 0.105;
      sph(g, 0.03, rice, x, 0.268, -0.02, 1.0, 0.75, 1.5);
      var top = box(g, 0.05, 0.016, 0.105, col(c[0], 0.45), x, 0.293, -0.02, 0.007);
      box(g, 0.052, 0.004, 0.012, col(c[1], 0.45), x, 0.302, -0.04); box(g, 0.052, 0.004, 0.012, col(c[1], 0.45), x, 0.302, 0.0);
    });
    // bowl of rice, soy sauce, wasabi, ginger
    lathe(g, [[0, 0], [0.05, 0], [0.1, 0.07], [0.105, 0.09], [0.095, 0.09], [0.05, 0.015], [0, 0.012]], col(0x2a2d33, 0.35, 0.2), 0.33, 0.236, -0.2);
    sph(g, 0.09, rice, 0.33, 0.3, -0.2, 1, 0.55, 1);
    lathe(g, [[0, 0], [0.04, 0], [0.055, 0.02], [0.05, 0.02], [0.038, 0.006], [0, 0.005]], col(0xf2f2f2, 0.3), 0.02, 0.236, -0.18, 16);
    cyl(g, 0.036, 0.036, 0.003, col(0x24120a, 0.15), 0.02, 0.248, -0.18, 16);
    sph(g, 0.02, col(0x8bc34a, 0.8), 0.11, 0.25, -0.2, 1, 0.7, 1); sph(g, 0.024, col(0xf8bbd0, 0.7), 0.12, 0.248, -0.14, 1.2, 0.5, 1);
    cyl(g, 0.006, 0.006, 0.3, wood('mid'), 0.3, 0.244, 0.2, 6).rotation.z = Math.PI / 2;
    cyl(g, 0.006, 0.006, 0.3, wood('mid'), 0.3, 0.244, 0.225, 6).rotation.z = Math.PI / 2 + 0.05;
    // knife (chops when a sushi is being made)
    var kn = grp(g, -0.2, 0.25, 0.06, true);
    box(kn, 0.24, 0.045, 0.006, steel(), 0.08, 0.022, 0); box(kn, 0.11, 0.03, 0.02, black(), -0.095, 0.022, 0, 0.008);
    kn.rotation.y = 0.2;
    var chopT = 0;
    return function (dt, t, s) {
      var k = s.cooking ? 1 : 0, c = Math.abs(Math.sin(t * 9)), h = s.h;
      showRoll.visible = !h;
      if (h) {
        var u = h.cooking[0], f = u ? (u.fin || 0) : 0;
        hs.visible = !!u;
        hNori.visible = hRice.visible = f < 2; hFish.visible = f === 1; hRoll.visible = f >= 2;
        // the knife chops when a roll leaves the mat (it has just been cut)
        if (h._nu !== h.cooking.length) { if (h._nu > h.cooking.length) chopT = 0.55; h._nu = h.cooking.length; }
        k = chopT > 0 ? 1 : 0;
        if (chopT > 0) chopT -= dt;
      } else hs.visible = false;
      kn.rotation.z = k * (0.5 - c * 0.5);
      kn.position.y = 0.25 + k * (0.06 - c * 0.06);
      kn.position.x = -0.2 + k * Math.sin(t * 1.2) * 0.04;
    };
  };

  // ---- pastry corner: pink cabinet, stand mixer, cake, cupcakes ----
  BUILD.gateau = function (g) {
    var pink = col(0xf5a9c3, 0.5), pinkD = col(0xe58aab, 0.5), white = col(0xfffaf2, 0.45);
    box(g, 0.96, 0.27, 0.56, pink, 0, 0.135, 0, 0.03);
    [-0.235, 0.235].forEach(function (x) { box(g, 0.42, 0.19, 0.02, pinkD, x, 0.135, 0.283, 0.012); cyl(g, 0.018, 0.018, 0.03, brass(), x, 0.135, 0.3, 10).rotation.x = Math.PI / 2; });
    box(g, 1.0, 0.03, 0.6, M('marble', { color: 0xffffff, map: marbleTex(), roughness: 0.25 }), 0, 0.285, 0, 0.012);
    // stand mixer
    var mx = grp(g, -0.29, 0.3, -0.03);
    box(mx, 0.22, 0.04, 0.3, pink, 0, 0.02, 0, 0.015); box(mx, 0.1, 0.24, 0.1, pink, 0, 0.16, -0.09, 0.03);
    var head = grp(mx, 0, 0.3, -0.09, true);
    box(head, 0.13, 0.11, 0.3, pink, 0, 0.0, 0.11, 0.05);
    cyl(head, 0.03, 0.03, 0.015, steel(), 0, 0, 0.262, 12).rotation.x = Math.PI / 2;
    box(head, 0.02, 0.012, 0.06, white, 0.068, 0.01, 0.05);
    var whisk = grp(head, 0, -0.06, 0.2, true);
    cyl(whisk, 0.008, 0.008, 0.08, steel(), 0, -0.02, 0, 6);
    for (var i = 0; i < 4; i++) { var wb = torus(whisk, 0.035, 0.004, steel(), 0, -0.09, 0); wb.rotation.y = i * Math.PI / 4; wb.scale.set(1, 1.4, 1); }
    lathe(mx, [[0, 0], [0.05, 0], [0.105, 0.08], [0.112, 0.13], [0.104, 0.13], [0.05, 0.012], [0, 0.01]], steel(), 0, 0.04, 0.11, 24);
    sph(mx, 0.09, white, 0, 0.11, 0.11, 1, 0.3, 1);
    bake(whisk); bake(head);
    // cake on a stand
    var ck = grp(g, 0.25, 0.3, -0.1);
    lathe(ck, [[0, 0], [0.09, 0], [0.085, 0.012], [0.02, 0.03], [0.02, 0.1], [0.19, 0.12], [0.19, 0.132], [0, 0.132]], white, 0, 0, 0, 28);
    var cake = grp(ck, 0, 0, 0);                              // the cake itself (the stand is empty until it is built, in the simulator)
    cyl(cake, 0.15, 0.15, 0.13, col(0xfff3e0, 0.6), 0, 0.2, 0, 28);
    cyl(cake, 0.153, 0.153, 0.02, col(0xd32f2f, 0.35), 0, 0.266, 0, 28);
    for (i = 0; i < 8; i++) { var a = i / 8 * 6.283; sph(cake, 0.022, white, Math.cos(a) * 0.115, 0.285, Math.sin(a) * 0.115); sph(cake, 0.018, col(0xc62828, 0.35), Math.cos(a) * 0.115, 0.31, Math.sin(a) * 0.115, 1, 1.15, 1); }
    for (i = 0; i < 12; i++) { a = i / 12 * 6.283; sph(cake, 0.02, col(0xd32f2f, 0.35), Math.cos(a) * 0.152, 0.245 - (i % 3) * 0.012, Math.sin(a) * 0.152, 1, 1.6 + (i % 2) * 0.8, 0.6); }
    bake(cake); cake.userData.dyn = true;
    // cupcakes
    [[0.06, 0.15, 0xf48fb1], [0.2, 0.19, 0x8d5a3b], [0.34, 0.15, 0xfff3e0]].forEach(function (c) {
      var cc = grp(g, c[0], 0.3, c[1]);
      cyl(cc, 0.045, 0.034, 0.055, col(0xffe0b2, 0.8), 0, 0.028, 0, 14);
      sph(cc, 0.046, col(c[2], 0.5), 0, 0.068, 0, 1, 0.6, 1); sph(cc, 0.034, col(c[2], 0.5), 0, 0.094, 0, 1, 0.6, 1); sph(cc, 0.02, col(c[2], 0.5), 0, 0.114, 0, 1, 0.7, 1);
      sph(cc, 0.014, col(0xc62828, 0.3), 0, 0.132, 0);
    });
    return function (dt, t, s) {
      var h = s.h, run = s.cooking;
      if (h) {                              // simulator: the batter is whisked, then the cake is built on the stand
        var on = false; run = false;
        for (var i = 0; i < h.cooking.length; i++) { var u = h.cooking[i]; if (u.ph === 'cook') run = true; if (u.ph === 'fin') on = true; }
        cake.visible = on;
      } else cake.visible = true;
      whisk.rotation.y += dt * (run ? 26 : 0);
      head.rotation.z = run ? Math.sin(t * 50) * 0.01 : 0;
      head.position.y = 0.3 + (run ? Math.sin(t * 44) * 0.002 : 0);
    };
  };

  // ---------------- props of the pack "Kitchen & Diner 3D" by Harning ----------------
  // tools/kpack.py turns the .glb files of the pack into KMODELS (positions on 16 bits, normals and baked
  // shading on 8 bits). The pack is in metres: 1 m = 1.25 units here. Everything works without it
  // (kprop returns null and the callers keep their own simple shapes).
  var KGEO = {}, KMAT = {}, KS = 1.25;
  function bytes(s) { var b = atob(s), n = b.length, a = new Uint8Array(n); for (var i = 0; i < n; i++) a[i] = b.charCodeAt(i); return a; }
  function khas(name) { return typeof KMODELS !== 'undefined' && !!KMODELS && !!KMODELS.m && !!KMODELS.m[name]; }
  function kmat(p) {
    var key = p.c.join(',') + '|' + p.m + '|' + p.r + '|' + (p.a || 0) + (p.d || 0) + '|' + (p.t ? p.t.length + p.t.slice(-20) : '');
    if (KMAT[key]) return KMAT[key];
    var o = { color: new T.Color().setRGB(p.c[0], p.c[1], p.c[2]), metalness: p.m, roughness: p.r, vertexColors: true };
    if (p.a) { o.transparent = true; o.opacity = p.c[3]; o.depthWrite = false; }
    if (p.d) o.side = T.DoubleSide;
    if (p.e) o.emissive = new T.Color().setRGB(p.e[0], p.e[1], p.e[2]);
    if (p.t) {
      var im = new Image(), tx = new T.Texture(im);
      tx.colorSpace = T.SRGBColorSpace; tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.flipY = false; tx.anisotropy = 4;
      im.onload = function () { tx.needsUpdate = true; };
      im.src = p.t;
      o.map = tx;
    }
    return (KMAT[key] = new T.MeshStandardMaterial(o));
  }
  function kgeo(name) {
    if (KGEO[name]) return KGEO[name];
    var d = KMODELS.m[name], b = d.b, sx = (b[3] - b[0]) / 65535, sy = (b[4] - b[1]) / 65535, sz = (b[5] - b[2]) / 65535;
    return (KGEO[name] = d.p.map(function (p) {
      var q = new Uint16Array(bytes(p.p).buffer), n = q.length / 3, pos = new Float32Array(n * 3), i;
      for (i = 0; i < n; i++) { pos[i * 3] = b[0] + q[i * 3] * sx; pos[i * 3 + 1] = b[1] + q[i * 3 + 1] * sy; pos[i * 3 + 2] = b[2] + q[i * 3 + 2] * sz; }
      var nb = new Int8Array(bytes(p.n).buffer), nor = new Float32Array(n * 3), cb = bytes(p.v), cl = new Float32Array(n * 3);
      for (i = 0; i < n * 3; i++) { nor[i] = nb[i] / 127; cl[i] = cb[i] / 255; }
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.BufferAttribute(nor, 3));
      g.setAttribute('color', new T.BufferAttribute(cl, 3));
      if (p.u) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(bytes(p.u).buffer), 2));
      g.setIndex(new T.BufferAttribute(new Uint16Array(bytes(p.i).buffer), 1));
      return { geo: g, mat: kmat(p) };
    }));
  }
  // a prop of the pack (origin at the bottom centre, front towards +z). scale: 1 = real size
  function kprop(name, scale) {
    if (!ready() || !khas(name)) return null;
    var g = new T.Group();
    try {
      kgeo(name).forEach(function (p) { var m = new T.Mesh(p.geo, p.mat); m.castShadow = m.receiveShadow = !p.mat.transparent; g.add(m); });
    } catch (e) { console.warn('kprop', name, e); return null; }
    g.scale.setScalar(KS * (scale || 1));
    return g;
  }
  // the same prop, resized so that it is w units wide (its largest side on the ground)
  function kfit(name, w) {
    if (!khas(name)) return null;
    var b = KMODELS.m[name].b, g = kprop(name, 1);
    if (g) g.scale.setScalar(w / Math.max(b[3] - b[0], b[5] - b[2]));
    return g;
  }
  function kput(g, name, x, y, z, ry, scale) {
    var o = kprop(name, scale);
    if (!o) return null;
    o.position.set(x || 0, y || 0, z || 0); o.rotation.y = ry || 0; g.add(o);
    return o;
  }

  // ---------------- the dishes, as small 3D objects (on the tray the player carries) ----------------
  // each one stands on y = 0 and is about 0.3 wide
  function dplate(g, w) {
    var p = kfit('plate', w);
    if (p) g.add(p); else { cyl(g, w / 2, w * 0.36, 0.02, col(0xfffaf2, 0.3), 0, 0.01, 0, 26); }
  }
  function bowl(g, r, hex) {
    lathe(g, [[0, 0], [r * 0.55, 0], [r * 0.9, r * 0.38], [r, r * 0.74], [r * 0.93, r * 0.74], [r * 0.82, r * 0.4], [r * 0.5, r * 0.08], [0, r * 0.08]], col(hex, 0.35), 0, 0, 0, 24);
  }
  var DISH = {
    burger: function (g) { var b = kfit('burger', 0.21); if (!b) return false; dplate(g, 0.3); b.position.y = 0.022; g.add(b); },
    frites: function (g) { var f = kfit('fries_basket', 0.27); if (!f) return false; g.add(f); },
    gateau: function (g) { var f = kfit('pie_slice', 0.3); if (!f) return false; g.add(f); },
    pizza: function (g) {
      dplate(g, 0.31);
      var cr = col(0xd9a25a, 0.8);
      cyl(g, 0.128, 0.122, 0.022, [cr, M('pizzaTop', { color: 0xffffff, map: pizzaTex(), roughness: 0.7 }), cr], 0, 0.034, 0, 26);
    },
    soupe: function (g) {
      bowl(g, 0.14, 0xf6f0e4);
      var s = col(0xc9521c, 0.5);
      cyl(g, 0.118, 0.118, 0.006, [s, M('soupTop', { color: 0xffffff, map: soupTex(), roughness: 0.6 }), s], 0, 0.092, 0, 24);
      box(g, 0.02, 0.006, 0.17, steel(), 0.06, 0.1, -0.03).rotation.set(0.5, 0.5, 0);
    },
    nouilles: function (g) {
      bowl(g, 0.14, 0x2a6fb0);
      cyl(g, 0.118, 0.118, 0.006, col(0xb8742c, 0.5), 0, 0.09, 0, 24);
      var nd = col(0xf2d27a, 0.6), r = rnd(17);
      for (var i = 0; i < 6; i++) { var t = torus(g, 0.03 + r() * 0.035, 0.009, nd, (r() - 0.5) * 0.09, 0.098 + r() * 0.012, (r() - 0.5) * 0.09); t.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.5, 0, r() * 3); }
      sph(g, 0.03, col(0xfffaf0, 0.4), 0.05, 0.1, 0.04, 1, 0.5, 1); sph(g, 0.014, col(0xf4a300, 0.4), 0.05, 0.112, 0.04);
      [0.012, -0.012].forEach(function (o) { var c = cyl(g, 0.005, 0.004, 0.3, wood('dark'), -0.04 + o, 0.14, 0.02 + o, 6); c.rotation.set(1.25, 0, 0.5); });
    },
    sushi: function (g) {
      box(g, 0.32, 0.02, 0.17, wood('dark', [2, 1]), 0, 0.01, 0, 0.008);
      var nori = col(0x16221b, 0.7);
      [[-0.1, '#f2764a'], [0, '#7cc84a'], [0.1, '#f2764a']].forEach(function (p) { cyl(g, 0.042, 0.042, 0.05, [nori, M('maki_' + p[1], { color: 0xffffff, map: makiTex(p[1]), roughness: 0.7 }), nori], p[0], 0.045, 0, 18); });
    },
    jus: function (g) {
      cyl(g, 0.058, 0.046, 0.17, col(0xff9f1c, 0.25), 0, 0.09, 0, 20);
      cyl(g, 0.064, 0.05, 0.2, glass(), 0, 0.1, 0, 20, true);
      var st = cyl(g, 0.007, 0.007, 0.24, col(0xe53935, 0.4), 0.025, 0.17, 0, 8); st.rotation.z = -0.22;
      var sl = cyl(g, 0.045, 0.045, 0.012, col(0xffb300, 0.5), -0.058, 0.2, 0, 18); sl.rotation.set(Math.PI / 2, 0, 0.3);
    }
  };
  function dish(id) {
    if (!ready() || !DISH[id]) return null;
    var g = new T.Group();
    try { if (DISH[id](g) === false) return null; } catch (e) { console.warn('dish', id, e); return null; }
    bake(g);
    return g;
  }

  // build a station model. Returns { group, tick }
  function station(id) {
    if (!ready() || !BUILD[id]) return null;
    var g = new T.Group();
    var tick = BUILD[id](g);
    bake(g);
    return { group: g, tick: tick || function () { } };
  }

  function hand(g, thumb) {
    var skin = col(0xe8b48e, 0.62), sleeve = col(0xf4f1ea, 0.92);
    sph(g, 0.06, skin, 0, 0, 0, 1.0, 0.5, 1.25);
    var th = sph(g, 0.022, skin, thumb * 0.055, 0.008, -0.03, 1, 0.8, 1.9); th.rotation.y = -thumb * 0.5;
    [-0.036, -0.012, 0.012, 0.036].forEach(function (x, k) { sph(g, 0.0155, skin, x, -0.004, -0.088 + Math.abs(k - 1.5) * 0.009, 1, 0.8, 2.3); });
    var arm = add(g, new T.CapsuleGeometry(0.05, 0.5, 4, 12), sleeve, 0, 0, 0.37); arm.rotation.x = Math.PI / 2;
    cyl(g, 0.058, 0.058, 0.05, sleeve, 0, 0, 0.09, 14).rotation.x = Math.PI / 2;
  }

  // ---------------- small props for the restaurant ----------------
  var PROPS = {
    lockbox: function (g) {             // a station that is not bought yet: a closed crate with a padlock
      box(g, 0.78, 0.5, 0.52, wood('mid', [2, 1]), 0, 0.27, 0);
      [0.07, 0.27, 0.47].forEach(function (y) { box(g, 0.82, 0.07, 0.56, wood('light', [2, 1]), 0, y, 0); });
      [-0.37, 0.37].forEach(function (x) { [-0.24, 0.24].forEach(function (z) { box(g, 0.07, 0.54, 0.07, wood('dark'), x, 0.27, z); }); });
      box(g, 0.84, 0.03, 0.58, wood('dark', [2, 1]), 0, 0.535, 0);
      box(g, 0.16, 0.13, 0.04, brass(), 0, 0.27, 0.3, 0.02);
      torus(g, 0.05, 0.014, steel(), 0, 0.345, 0.3, Math.PI);
      cyl(g, 0.016, 0.016, 0.02, black(), 0, 0.275, 0.325, 10).rotation.x = Math.PI / 2;
    },
    register: function (g) {            // old-style cash register
      box(g, 0.5, 0.22, 0.42, col(0xb7352b, 0.4, 0.3), 0, 0.11, 0, 0.03);
      var top = box(g, 0.46, 0.2, 0.2, col(0xb7352b, 0.4, 0.3), 0, 0.28, -0.1, 0.03); top.rotation.x = -0.25;
      box(g, 0.36, 0.11, 0.012, col(0x16221b, 0.2), 0, 0.31, 0.012).rotation.x = -0.25;
      for (var i = 0; i < 12; i++) cyl(g, 0.018, 0.018, 0.02, col(0xfff6dc, 0.4), -0.15 + (i % 4) * 0.1, 0.225, 0.06 + Math.floor(i / 4) * 0.055, 10);
      box(g, 0.44, 0.06, 0.02, brass(), 0, 0.06, 0.212, 0.008); cyl(g, 0.02, 0.02, 0.03, brass(), 0, 0.06, 0.23, 10).rotation.x = Math.PI / 2;
      cyl(g, 0.014, 0.014, 0.18, brass(), 0.27, 0.2, -0.05, 8); sph(g, 0.03, col(0x1b1b1e, 0.4), 0.27, 0.3, -0.05);
    },
    bell: function (g) {
      cyl(g, 0.09, 0.1, 0.02, black(), 0, 0.01, 0, 18);
      add(g, new T.SphereGeometry(0.075, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), brass(), 0, 0.02, 0);
      cyl(g, 0.012, 0.012, 0.03, brass(), 0, 0.1, 0, 8); sph(g, 0.016, brass(), 0, 0.12, 0);
    },
    tipjar: function (g) {
      cyl(g, 0.1, 0.085, 0.24, glass(), 0, 0.12, 0, 18, true);
      cyl(g, 0.105, 0.105, 0.02, wood('mid'), 0, 0.25, 0, 18);
      var r = rnd(3);
      for (var i = 0; i < 12; i++) { var c = cyl(g, 0.03, 0.03, 0.008, brass(), (r() - 0.5) * 0.1, 0.012 + i * 0.008, (r() - 0.5) * 0.1, 12); c.rotation.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5); }
    },
    bottles: function (g) {             // ketchup, mustard and a napkin holder
      [[0xd32f2f, -0.1], [0xfbc02d, 0.02]].forEach(function (c) {
        cyl(g, 0.04, 0.045, 0.16, col(c[0], 0.35), c[1], 0.08, 0, 14); cone(g, 0.04, 0.06, col(c[0], 0.35), c[1], 0.19, 0, 14); cyl(g, 0.012, 0.016, 0.04, col(0xffffff, 0.4), c[1], 0.235, 0, 8);
      });
      box(g, 0.14, 0.1, 0.05, steel(), 0.2, 0.05, 0, 0.01); box(g, 0.12, 0.11, 0.03, col(0xffffff, 0.9), 0.2, 0.065, 0);
    },
    trophy: function (g) {              // golden toque: the gift of some codes
      var gold = M('goldT', { color: 0xffc83a, metalness: 1, roughness: 0.22 });
      cyl(g, 0.12, 0.14, 0.05, wood('dark'), 0, 0.025, 0, 20);
      cyl(g, 0.04, 0.06, 0.1, gold, 0, 0.1, 0, 16);
      cyl(g, 0.11, 0.1, 0.1, gold, 0, 0.2, 0, 20);
      [[-0.08, 0], [0.08, 0], [0, 0.05], [0, -0.06]].forEach(function (p) { sph(g, 0.085, gold, p[0], 0.3, p[1]); });
      sph(g, 0.09, gold, 0, 0.34, 0);
    },
    stool: function (g) {
      cyl(g, 0.2, 0.2, 0.06, col(0xc62828, 0.5), 0, 0.82, 0, 20); cyl(g, 0.03, 0.03, 0.78, steel(), 0, 0.4, 0, 10);
      cyl(g, 0.17, 0.2, 0.03, steel(), 0, 0.015, 0, 20); torus(g, 0.13, 0.012, steel(), 0, 0.3, 0).rotation.x = Math.PI / 2;
    },
    crate: function (g) {
      box(g, 0.5, 0.3, 0.36, wood('mid', [2, 1]), 0, 0.15, 0);
      for (var i = 0; i < 3; i++) box(g, 0.52, 0.06, 0.38, wood('light', [2, 1]), 0, 0.06 + i * 0.1, 0);
      var r = rnd(6);
      for (i = 0; i < 7; i++) sph(g, 0.06, col([0xe53935, 0xff8f1c, 0x7cc84a][i % 3], 0.5), (r() - 0.5) * 0.36, 0.33, (r() - 0.5) * 0.24);
    },
    lamp: function (g) {                // hanging lamp (origin = fixing point on the ceiling)
      cyl(g, 0.008, 0.008, 0.5, black(), 0, -0.25, 0, 6);
      add(g, new T.ConeGeometry(0.22, 0.18, 20, 1, true), M('lampShade', { color: 0x2f5d3a, metalness: 0.4, roughness: 0.4, side: T.DoubleSide }), 0, -0.55, 0);
      sph(g, 0.06, glow('bulb', 0xfff1c4, 2.2), 0, -0.6, 0);
    },
    fridge: function (g) {
      box(g, 0.9, 2.0, 0.7, steel(), 0, 1.0, 0, 0.04);
      box(g, 0.02, 1.96, 0.02, steelD(), 0, 1.0, 0.352);
      [-0.08, 0.08].forEach(function (x) { cyl(g, 0.016, 0.016, 0.7, steelD(), x, 1.1, 0.38, 8); });
      box(g, 0.2, 0.08, 0.01, col(0x16221b, 0.2), -0.25, 1.75, 0.352);
    },
    // ---- helpers seen in the first-person view: the picture of the bust stands on these legs ----
    bodyCook: function (g) {
      var tr = col(0x2e3340, 0.85), wh = col(0xfafafa, 0.9);
      [-0.115, 0.115].forEach(function (x) { cyl(g, 0.09, 0.075, 0.5, tr, x, 0.3, 0, 10); box(g, 0.14, 0.08, 0.27, black(), x, 0.04, 0.04, 0.035); });
      cyl(g, 0.27, 0.33, 0.62, wh, 0, 0.78, 0, 20);                 // long apron
      cyl(g, 0.25, 0.27, 0.2, wh, 0, 1.16, 0, 20);                  // jacket
      torus(g, 0.268, 0.018, col(0x3f8f4f, 0.7), 0, 1.07, 0).rotation.x = Math.PI / 2;
    },
    bodyWaiter: function (g) {
      var tr = col(0x1e1f24, 0.8);
      [-0.11, 0.11].forEach(function (x) { cyl(g, 0.085, 0.07, 0.62, tr, x, 0.36, 0, 10); box(g, 0.13, 0.08, 0.27, black(), x, 0.04, 0.04, 0.035); });
      cyl(g, 0.25, 0.29, 0.5, tr, 0, 0.84, 0, 20);                  // long black apron
      cyl(g, 0.235, 0.25, 0.2, col(0x24252b, 0.7), 0, 1.16, 0, 20); // waistcoat
      torus(g, 0.255, 0.016, col(0xfafafa, 0.8), 0, 1.07, 0).rotation.x = Math.PI / 2;
    },
    // the player's forearms (first person): white sleeve, bare hand. Origin = the palm; the arm goes
    // towards +z (the player), the fingers towards -z.
    handL: function (g) { hand(g, 1); },
    handR: function (g) { hand(g, -1); },
    tray: function (g) {                // the tray carried by the player (first person)
      box(g, 1.0, 0.03, 0.5, wood('mid', [2, 1]), 0, 0, 0, 0.012);
      [-0.24, 0.24].forEach(function (z) { box(g, 1.0, 0.05, 0.03, wood('dark', [2, 1]), 0, 0.03, z, 0.012); });
      [-0.485, 0.485].forEach(function (x) { box(g, 0.03, 0.05, 0.5, wood('dark', [2, 1]), x, 0.03, 0, 0.012); });
    },
    sink: function (g) {                // steel sink with a tap and a plate rack (stands on the floor, faces +z)
      box(g, 1.3, 0.9, 0.6, steelD(), 0, 0.45, 0, 0.02);
      box(g, 1.34, 0.05, 0.64, steel(), 0, 0.925, 0, 0.015);
      box(g, 0.66, 0.012, 0.4, col(0x565c64, 0.3, 0.8), -0.24, 0.953, 0.02);
      cyl(g, 0.02, 0.02, 0.3, steel(), -0.24, 1.1, -0.22, 10);
      cyl(g, 0.018, 0.018, 0.22, steel(), -0.24, 1.25, -0.12, 10).rotation.x = Math.PI / 2;
      cyl(g, 0.018, 0.018, 0.06, steel(), -0.24, 1.22, -0.01, 10);
      [[-0.37, 0xd32f2f], [-0.11, 0x2a8ccc]].forEach(function (p) { cyl(g, 0.026, 0.026, 0.05, col(p[1], 0.4), p[0], 0.975, -0.22, 10); });
      box(g, 0.4, 0.02, 0.34, steelD(), 0.4, 0.96, 0);
      for (var i = 0; i < 5; i++) { var p = cyl(g, 0.13, 0.13, 0.012, col(0xfffaf2, 0.3), 0.26 + i * 0.06, 1.09, 0, 18); p.rotation.z = Math.PI / 2 - 0.22; }
      [-0.4, 0.4].forEach(function (x) { cyl(g, 0.012, 0.012, 0.5, steelD(), x, 0.5, 0.31, 6); });
    },
    menuboard: function (g) {           // chalkboard in a wooden frame (origin = centre, faces +z)
      box(g, 1.7, 1.1, 0.04, wood('dark', [2, 1]), 0, 0, 0, 0.015);
      add(g, new T.PlaneGeometry(1.56, 0.96), M('chalk', { color: 0xffffff, map: chalkTex(), roughness: 0.95 }), 0, 0, 0.022);
    },
    clock: function (g) {               // wall clock (origin = centre, faces +z)
      cyl(g, 0.25, 0.25, 0.05, col(0xc62828, 0.4, 0.2), 0, 0, 0, 28).rotation.x = Math.PI / 2;
      add(g, new T.CircleGeometry(0.21, 28), M('clockFace', { color: 0xffffff, map: clockTex(), roughness: 0.5 }), 0, 0, 0.027);
    },
    potrack: function (g) {             // pans hanging from a bar (origin = fixing point on the ceiling)
      [-0.7, 0.7].forEach(function (x) { cyl(g, 0.01, 0.01, 0.5, black(), x, -0.25, 0, 6); });
      cyl(g, 0.02, 0.02, 1.7, iron(), 0, -0.5, 0, 10).rotation.z = Math.PI / 2;
      [[-0.6, copper(), 0.17], [-0.2, iron(), 0.14], [0.22, steel(), 0.16], [0.62, copper(), 0.12]].forEach(function (p) {
        cyl(g, 0.008, 0.008, 0.1, black(), p[0], -0.55, 0, 6);
        box(g, 0.035, 0.16, 0.016, black(), p[0], -0.68, 0);
        cyl(g, p[2], p[2] * 0.82, 0.06, p[1], p[0], -0.76 - p[2], 0, 22).rotation.x = Math.PI / 2;
      });
    },
    sacks: function (g) {               // flour sacks
      [[0, 0.2, 0, 0], [0.46, 0.2, 0.06, 0.3], [0.22, 0.56, 0.03, -0.2]].forEach(function (p) {
        var s = sph(g, 0.3, col(0xe9dcc0, 0.95), p[0], p[1], p[2], 1, 0.7, 0.82); s.rotation.y = p[3];
        box(g, 0.2, 0.012, 0.14, col(0xb7352b, 0.8), p[0], p[1] + 0.2, p[2]).rotation.y = p[3];
      });
    },
    door: function (g) {                // back door (stands on the floor, faces +z)
      box(g, 1.1, 2.3, 0.06, wood('dark', [2, 2]), 0, 1.15, 0);
      box(g, 0.94, 2.14, 0.03, wood('mid', [2, 2]), 0, 1.15, 0.03);
      add(g, new T.CircleGeometry(0.2, 24), col(0x9fd4ee, 0.15, 0.2), 0, 1.75, 0.047); torus(g, 0.2, 0.025, brass(), 0, 1.75, 0.047);
      sph(g, 0.045, brass(), 0.38, 1.1, 0.07);
    },
    knives: function (g) {              // magnetic strip with knives (origin = centre, faces +z)
      box(g, 0.8, 0.06, 0.02, black(), 0, 0, 0);
      [-0.3, -0.15, 0, 0.15, 0.3].forEach(function (x, i) { var L = 0.2 + (i % 3) * 0.05; box(g, 0.035, L, 0.006, steel(), x, -0.03 - L / 2, 0.014); box(g, 0.03, 0.1, 0.02, wood('dark'), x, 0.07, 0.014, 0.008); });
    },
    parasol: function (g) {             // terrace table with a parasol and three stools
      cyl(g, 0.75, 0.75, 0.07, col(0xf3e2c0, 0.6), 0, 1.0, 0, 22);
      cyl(g, 0.06, 0.06, 1.0, wood('dark'), 0, 0.5, 0, 8); cyl(g, 0.4, 0.45, 0.06, wood('dark'), 0, 0.03, 0, 16);
      cyl(g, 0.035, 0.035, 2.4, steel(), 0, 2.2, 0, 8);
      [[1.05, 0], [-1.05, 0], [0, 1.05]].forEach(function (c) {
        cyl(g, 0.17, 0.17, 0.05, col(0xc62828, 0.5), c[0], 0.7, c[1], 16); cyl(g, 0.026, 0.026, 0.68, steel(), c[0], 0.35, c[1], 8); cyl(g, 0.15, 0.17, 0.03, steel(), c[0], 0.015, c[1], 16);
      });
    },
    shelfBare: function (g) {           // wall shelf, empty (origin = centre of the board, faces +z)
      box(g, 1.7, 0.05, 0.4, wood('mid', [3, 1]), 0, 0, 0.04);
      [-0.72, 0.72].forEach(function (x) { box(g, 0.04, 0.22, 0.32, iron(), x, -0.13, 0.02); });
    },
    parasolTop: function (g) {          // pole and foot of a parasol (the canopy is added by the scene)
      cyl(g, 0.035, 0.035, 3.3, steel(), 0, 1.75, 0, 8); cyl(g, 0.22, 0.26, 0.08, iron(), 0, 0.04, 0, 16);
    },
    standTable: function (g) {          // tall round table for the bar stools
      cyl(g, 0.5, 0.5, 0.06, col(0xf3e2c0, 0.6), 0, 1.32, 0, 24); cyl(g, 0.05, 0.05, 1.3, steel(), 0, 0.66, 0, 10); cyl(g, 0.3, 0.34, 0.05, iron(), 0, 0.025, 0, 18);
    },
    shelf: function (g) {               // wall shelf with jars and plates
      box(g, 1.6, 0.05, 0.3, wood('mid', [3, 1]), 0, 0, 0);
      [-0.7, 0.7].forEach(function (x) { box(g, 0.04, 0.2, 0.26, iron(), x, -0.12, 0); });
      var r = rnd(14), cs = [0xe8433a, 0x43b047, 0xffd23a, 0x2a8ccc, 0xff9f1c];
      for (var i = 0; i < 6; i++) {
        var x = -0.62 + i * 0.25;
        if (i % 3 === 2) { for (var k = 0; k < 4; k++) cyl(g, 0.11, 0.1, 0.015, col(0xfffaf2, 0.3), x, 0.035 + k * 0.018, 0, 18); }
        else { cyl(g, 0.07, 0.07, 0.2, glass(), x, 0.125, 0, 14); cyl(g, 0.062, 0.062, 0.12 + r() * 0.05, col(cs[i % 5], 0.6), x, 0.09, 0, 14); cyl(g, 0.074, 0.074, 0.03, wood('dark'), x, 0.24, 0, 14); }
      }
    }
  };
  function prop(id) {
    if (!ready() || !PROPS[id]) return null;
    var g = new T.Group(); PROPS[id](g); bake(g); return g;
  }

  return { station: station, prop: prop, ready: ready, mat: M, col: col, wood: wood, brick: brickTex, box: box, cyl: cyl, sph: sph, bake: bake, steel: steel, iron: iron, glow: glow, glass: glass, ctex: ctex, rnd: rnd,
    stripes: stripeTex, speckle: speckleTex, kprop: kprop, kfit: kfit, kput: kput, khas: khas, dish: dish, KS: KS };
})();
