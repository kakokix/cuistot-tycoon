// ===================== SVG ART (cartoon style matching the jungle UI pack) =====================
var Art = (function () {
  var OL = '#3a2210';
  var cache = {};
  function enc(s) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); }
  function svg(w, h, body, defs) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      (defs ? '<defs>' + defs + '</defs>' : '') + body + '</svg>';
  }
  function S(w, c) { return 'stroke="' + (c || OL) + '" stroke-width="' + (w == null ? 4 : w) + '" stroke-linejoin="round" stroke-linecap="round"'; }
  function shadow(cx, cy, rx, ry, op) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#000" opacity="' + (op || 0.22) + '"/>'; }
  function lg(id, stops, x2, y2) {
    var s = '';
    for (var i = 0; i < stops.length; i++) s += '<stop offset="' + (i / (stops.length - 1)) + '" stop-color="' + stops[i] + '"/>';
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 || 0) + '" y2="' + (y2 == null ? 1 : y2) + '">' + s + '</linearGradient>';
  }
  function rg(id, c1, c2, cx, cy, r) {
    return '<radialGradient id="' + id + '" cx="' + (cx || 0.35) + '" cy="' + (cy || 0.3) + '" r="' + (r || 0.8) + '"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></radialGradient>';
  }
  function hl(d, w, op) { return '<path d="' + d + '" fill="none" stroke="#fff" stroke-width="' + (w || 4) + '" stroke-linecap="round" opacity="' + (op || 0.55) + '"/>'; }
  function tube(d, w, col, olw) {
    olw = olw == null ? 3 : olw;
    return '<path d="' + d + '" fill="none" stroke="' + OL + '" stroke-width="' + (w + olw * 2) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function star5(cx, cy, R, r) {
    var p = [];
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
      p.push((cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1));
    }
    return p.join(' ');
  }
  function dots(list, col, op) {
    var s = '';
    for (var i = 0; i < list.length; i++) s += '<circle cx="' + list[i][0] + '" cy="' + list[i][1] + '" r="' + list[i][2] + '" fill="' + (col || '#fff') + '" opacity="' + (op == null ? 0.35 : op) + '"/>';
    return s;
  }
  function flame(x, y, s, c1, c2) {
    s = s || 1;
    var t = 'translate(' + x + ' ' + y + ') scale(' + s + ')';
    return '<g transform="' + t + '"><path d="M0 0 C-9 -4 -8 -14 -3 -20 C-3 -14 1 -13 1 -16 C0 -24 5 -29 8 -32 C7 -24 13 -20 11 -10 C14 -12 14 -16 13 -18 C19 -11 17 -2 9 0 Z" fill="' + (c1 || '#ff8a2a') + '"/>' +
      '<path d="M2 -1 C-2 -4 -1 -9 2 -12 C3 -8 6 -8 6 -11 C9 -7 9 -2 6 -1 Z" fill="' + (c2 || '#ffe066') + '"/></g>';
  }

  // ---------------- DISHES (100x100) ----------------
  var DISH = {};
  DISH.burger = function () {
    var seeds = [[36, 26, -25], [52, 22, 0], [67, 27, 25], [44, 36, -10], [60, 37, 15], [75, 38, 30], [29, 39, -30]].map(function (a) {
      return '<ellipse cx="' + a[0] + '" cy="' + a[1] + '" rx="3.2" ry="1.9" transform="rotate(' + a[2] + ' ' + a[0] + ' ' + a[1] + ')"/>';
    }).join('');
    return svg(100, 100,
      shadow(50, 89, 36, 5) +
      '<path d="M15 66 Q15 84 50 84 Q85 84 85 66 Z" fill="url(#bb)" ' + S() + '/>' +
      '<rect x="11" y="55" width="78" height="14" rx="7" fill="#7a3d1c" ' + S() + '/>' +
      '<path d="M14 52 H86 L84 57 H71 L65 66 L59 57 H35 L29 63 L23 57 H16 Z" fill="#ffcf35" ' + S(3) + '/>' +
      '<path d="M9 45 H91 V49 q-5 8 -10 0 q-5 8 -10 0 q-5 8 -10 0 q-5 8 -10 0 q-5 8 -10 0 q-5 8 -10 0 q-5 8 -10 0 q-5 8 -10 0 q-1 4 -2 0 Z" fill="#6fc63b" ' + S(3) + '/>' +
      '<path d="M11 46 Q11 13 50 13 Q89 13 89 46 Q89 49 86 49 H14 Q11 49 11 46 Z" fill="url(#bt)" ' + S() + '/>' +
      hl('M24 33 Q27 22 40 19', 5) + '<g fill="#fff4d8">' + seeds + '</g>',
      lg('bt', ['#f8bd5c', '#dd8a2e']) + lg('bb', ['#f2ad4c', '#cf7c2a']));
  };
  DISH.frites = function () {
    return svg(100, 100,
      shadow(50, 91, 30, 5) +
      '<g fill="url(#fy)" ' + S(3) + '>' +
      '<rect x="27" y="20" width="10" height="42" rx="3" transform="rotate(-14 32 41)"/>' +
      '<rect x="61" y="20" width="10" height="42" rx="3" transform="rotate(14 66 41)"/>' +
      '<rect x="36" y="10" width="10" height="46" rx="3" transform="rotate(-5 41 33)"/>' +
      '<rect x="53" y="11" width="10" height="46" rx="3" transform="rotate(6 58 34)"/>' +
      '<rect x="45" y="20" width="10" height="40" rx="3"/></g>' +
      '<path d="M20 42 Q50 54 80 42 L72 88 Q50 93 28 88 Z" fill="url(#fr)" ' + S() + '/>' +
      '<path d="M23 53 Q50 63 77 53" fill="none" stroke="#fff" stroke-width="4" opacity=".55"/>' +
      '<polygon points="' + star5(50, 71, 10, 4.6) + '" fill="#ffd23a" ' + S(2.5) + '/>' +
      hl('M27 60 L30 82', 4, 0.35),
      lg('fy', ['#ffe46b', '#f5b324']) + lg('fr', ['#f2513f', '#c72f22']));
  };
  DISH.jus = function () {
    return svg(100, 100,
      shadow(50, 92, 24, 4) +
      '<path d="M67 30 L80 7" fill="none" ' + S(3) + '/>' +
      '<path d="M61 15 Q78 -3 97 13 Q91 9 86 15 Q80 8 74 15 Q68 9 61 15 Z" fill="#ff6f91" ' + S(3) + '/>' +
      '<path d="M24 26 H76 L69 87 Q50 92 31 87 Z" fill="#eefaff" ' + S() + '/>' +
      '<path d="M27 38 Q50 44 73 38 L68.6 84.5 Q50 89 31.4 84.5 Z" fill="url(#oj)"/>' +
      '<ellipse cx="50" cy="39" rx="23" ry="4" fill="#ffd77c"/>' +
      '<rect x="34" y="47" width="12" height="12" rx="3" fill="#fff" opacity=".45" transform="rotate(14 40 53)"/>' +
      '<rect x="49" y="58" width="11" height="11" rx="3" fill="#fff" opacity=".35" transform="rotate(-12 54 63)"/>' +
      tube('M41 6 L49 62', 5, '#ffffff', 2.5) +
      '<path d="M41 6 L49 62" stroke="#ef4545" stroke-width="5" stroke-dasharray="4 5"/>' +
      '<path d="M24 26 H76 L69 87 Q50 92 31 87 Z" fill="none" ' + S() + '/>' +
      hl('M30 31 L35 80', 4, 0.6) +
      '<circle cx="75" cy="27" r="12" fill="#ff9f1c" ' + S(3) + '/><circle cx="75" cy="27" r="8" fill="#ffd36e"/>' +
      '<path d="M75 19 V35 M67 27 H83 M69.5 21.5 L80.5 32.5 M80.5 21.5 L69.5 32.5" stroke="#ffb23a" stroke-width="1.6"/>',
      lg('oj', ['#ffc94a', '#ff7a2a']));
  };
  DISH.pizza = function () {
    return svg(100, 100,
      shadow(50, 92, 24, 4) +
      '<path d="M50 90 L13 26 Q50 6 87 26 Z" fill="url(#chz)" ' + S() + '/>' +
      '<path d="M30 54 q2 8 5 0 M64 50 q2 7 4 0" fill="none" stroke="#ffb02e" stroke-width="3" stroke-linecap="round"/>' +
      tube('M13 26 Q50 6 87 26', 9, '#e8a04c') + hl('M22 21 Q50 9 78 21', 3, 0.45) +
      '<g fill="#d9402f" ' + S(2.5) + '><circle cx="37" cy="36" r="7.5"/><circle cx="63" cy="37" r="7.5"/><circle cx="50" cy="56" r="6.5"/><circle cx="50" cy="75" r="4.3"/></g>' +
      dots([[35, 34, 1.4], [39, 38, 1.2], [61, 35, 1.4], [65, 39, 1.2], [48, 55, 1.3]], '#9e2618', 0.8) +
      '<g fill="#3daa4e"><ellipse cx="49" cy="40" rx="4.2" ry="2.4" transform="rotate(-30 49 40)"/><ellipse cx="42" cy="50" rx="4" ry="2.3" transform="rotate(40 42 50)"/><ellipse cx="58" cy="64" rx="3.6" ry="2.1" transform="rotate(-20 58 64)"/></g>',
      lg('chz', ['#ffe27a', '#ffb733']));
  };
  DISH.soupe = function () {
    return svg(100, 100,
      shadow(50, 92, 32, 5) +
      tube('M36 34 q-6 -7 0 -13 q6 -6 0 -13', 3.5, '#ffffff', 1.5) +
      tube('M52 32 q-6 -7 0 -13 q6 -6 0 -13', 3.5, '#ffffff', 1.5) +
      tube('M67 34 q-6 -7 0 -13 q6 -6 0 -13', 3.5, '#ffffff', 1.5) +
      '<path d="M10 50 H90 Q88 86 50 88 Q12 86 10 50 Z" fill="url(#bw)" ' + S() + '/>' +
      '<path d="M20 67 Q50 77 80 67" fill="none" stroke="#fff" stroke-width="4.5" opacity=".7" stroke-dasharray="0.1 8" stroke-linecap="round"/>' +
      '<ellipse cx="50" cy="50" rx="40" ry="10" fill="url(#sp)" ' + S() + '/>' +
      '<circle cx="35" cy="50" r="3.2" fill="#5cbf4a"/><circle cx="47" cy="47" r="2.6" fill="#fff3c4"/><circle cx="58" cy="52" r="3" fill="#e8562a"/><circle cx="44" cy="54" r="2.2" fill="#5cbf4a"/><circle cx="25" cy="51" r="2" fill="#fff3c4"/>' +
      tube('M66 49 L86 20', 5, '#d8dee6', 2.5) +
      hl('M18 58 Q22 74 34 81', 4, 0.4),
      lg('bw', ['#5fd0f0', '#2a8ccc']) + lg('sp', ['#ffbe55', '#ff8c2e']));
  };
  DISH.nouilles = function () {
    return svg(100, 100,
      shadow(50, 92, 32, 5) +
      tube('M58 46 L86 6', 4, '#c98a4b', 2.5) + tube('M64 48 L94 13', 4, '#c98a4b', 2.5) +
      '<path d="M14 52 Q15 34 30 36 Q36 21 50 29 Q62 19 71 31 Q85 29 86 52 Z" fill="#ffd862" ' + S(3.5) + '/>' +
      '<g fill="none" stroke="#e5ad35" stroke-width="2.6" stroke-linecap="round"><path d="M22 47 q4 -8 8 0 q4 -8 8 0"/><path d="M44 40 q4 -8 8 0 q4 -8 8 0"/><path d="M60 47 q4 -8 8 0 q4 -8 8 0"/><path d="M36 30 q4 -6 8 0"/></g>' +
      '<ellipse cx="33" cy="41" rx="10" ry="8" fill="#fff" ' + S(2.5) + '/><circle cx="33" cy="41" r="4.5" fill="#ffb21f"/>' +
      '<g fill="#6cc24a" ' + S(1.5) + '><circle cx="56" cy="34" r="3"/><circle cx="72" cy="40" r="2.6"/><circle cx="48" cy="45" r="2.4"/></g>' +
      '<path d="M10 50 H90 Q88 86 50 88 Q12 86 10 50 Z" fill="url(#rb)" ' + S() + '/>' +
      '<path d="M17 64 q5.5 -5 11 0 t11 0 t11 0 t11 0 t11 0 t11 0" fill="none" stroke="#fff" stroke-width="3" opacity=".75"/>' +
      hl('M18 56 Q22 74 34 81', 4, 0.35),
      lg('rb', ['#f2603f', '#c53a23']));
  };
  DISH.sushi = function () {
    return svg(100, 100,
      shadow(50, 90, 40, 5) +
      '<rect x="7" y="64" width="86" height="19" rx="7" fill="url(#wd)" ' + S() + '/>' +
      '<path d="M16 72 H40 M58 76 H86" stroke="#b47a3a" stroke-width="2" stroke-linecap="round"/>' +
      '<rect x="10" y="44" width="38" height="21" rx="10" fill="#fffaf0" ' + S(3) + '/>' +
      '<path d="M8 47 Q27 30 50 44 Q49 55 30 53 Q13 55 8 47 Z" fill="#ff8a4c" ' + S(3) + '/>' +
      '<path d="M19 45 Q24 40 29 43 M31 47 Q36 41 41 45" fill="none" stroke="#ffd7c2" stroke-width="2.6" stroke-linecap="round"/>' +
      '<rect x="52" y="44" width="38" height="21" rx="10" fill="#fffaf0" ' + S(3) + '/>' +
      '<path d="M50 47 Q69 30 92 44 Q91 55 72 53 Q55 55 50 47 Z" fill="#ec4a55" ' + S(3) + '/>' +
      hl('M58 44 Q66 39 74 40', 2.6, 0.5) +
      '<circle cx="50" cy="67" r="15" fill="#2e4b3a" ' + S(3) + '/><circle cx="50" cy="67" r="10.5" fill="#fffaf0"/>' +
      '<circle cx="48" cy="67" r="4.4" fill="#ff7a3c"/><circle cx="54" cy="64.5" r="3" fill="#7cc84a"/>',
      lg('wd', ['#e9b46c', '#c98a43']));
  };
  DISH.gateau = function () {
    return svg(100, 100,
      shadow(50, 92, 40, 5) +
      '<ellipse cx="50" cy="84" rx="42" ry="8" fill="#eef3f8" ' + S(3) + '/>' +
      '<path d="M16 48 V78 Q50 90 84 78 V48 Z" fill="url(#cb)" ' + S() + '/>' +
      '<path d="M17 64 Q50 75 83 64" fill="none" stroke="#fff3df" stroke-width="5"/>' +
      '<path d="M14 48 Q14 36 50 36 Q86 36 86 48 Q86 58 80 56 Q77 66 72 57 Q66 62 60 58 Q55 68 50 59 Q42 64 38 58 Q32 66 28 57 Q22 62 20 56 Q14 58 14 48 Z" fill="#ff8fb4" ' + S(3.5) + '/>' +
      hl('M24 44 Q34 40 46 40', 3, 0.6) +
      '<g stroke-width="2.6" stroke-linecap="round"><path d="M30 46 l3 -2" stroke="#ffe066"/><path d="M62 43 l3 2" stroke="#6ec6ff"/><path d="M70 49 l3 -1" stroke="#fff"/><path d="M40 50 l2 2" stroke="#7cd65a"/><path d="M55 49 l3 -1" stroke="#ffe066"/></g>' +
      '<path d="M51 25 Q55 15 63 11" fill="none" ' + S(2.5, '#3d7a2a') + '/>' +
      '<circle cx="49" cy="30" r="8" fill="#e3263a" ' + S(3) + '/><circle cx="46" cy="27" r="2.3" fill="#fff" opacity=".8"/>',
      lg('cb', ['#f7b46b', '#e08e3e']));
  };

  // ---------------- COIN & SMALL ICONS ----------------
  function coin() {
    return svg(64, 64,
      '<circle cx="32" cy="34" r="28" fill="#b86c00"/>' +
      '<circle cx="32" cy="31" r="28" fill="url(#cg)" stroke="#a65d00" stroke-width="3.5"/>' +
      '<circle cx="32" cy="31" r="19.5" fill="none" stroke="#e39a10" stroke-width="3"/>' +
      '<polygon points="' + star5(32, 31.5, 12.5, 5.4) + '" fill="#ffe680" stroke="#c77a00" stroke-width="2.5" stroke-linejoin="round"/>' +
      hl('M13 24 Q17 13 28 10', 4, 0.7),
      rg('cg', '#fff07a', '#f4a300', 0.35, 0.3, 0.8));
  }
  function check() {
    return svg(40, 40, '<circle cx="20" cy="20" r="17" fill="#5cc23a" ' + S(3) + '/><path d="M11 20 L17.5 26.5 L29 13" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>');
  }
  function crown() {
    return svg(60, 40, '<path d="M6 34 L9 10 L21 22 L30 4 L39 22 L51 10 L54 34 Z" fill="url(#cw)" ' + S(3) + '/><circle cx="30" cy="27" r="4" fill="#e8433a" ' + S(2) + '/><circle cx="16" cy="28" r="3" fill="#4fa3e0" ' + S(2) + '/><circle cx="44" cy="28" r="3" fill="#4fa3e0" ' + S(2) + '/>',
      lg('cw', ['#fff07a', '#f4a300']));
  }
  function hand() {
    return svg(80, 90,
      '<path d="M30 6 Q30 0 36 0 Q42 0 42 6 V38 Q44 32 50 33 Q56 34 56 40 Q58 35 64 36 Q70 38 70 44 Q72 40 76 41 Q80 43 80 49 V64 Q80 86 58 88 H44 Q30 88 24 76 L8 52 Q4 46 9 42 Q14 39 19 45 L30 58 Z" fill="#fff" ' + S(4) + '/>' +
      '<path d="M42 38 V54 M56 40 V54 M70 44 V56" fill="none" ' + S(3) + '/>' +
      '<path d="M30 76 Q44 82 60 78" fill="none" stroke="#d9dfe6" stroke-width="4" stroke-linecap="round"/>');
  }
  function vein() {
    return svg(40, 40, '<g stroke="#e8433a" stroke-width="4.5" fill="none" stroke-linecap="round"><path d="M8 14 Q14 14 14 8"/><path d="M26 8 Q26 14 32 14"/><path d="M8 26 Q14 26 14 32"/><path d="M26 32 Q26 26 32 26"/></g>');
  }
  function steam() {
    return svg(60, 50, '<path d="M14 40 Q4 40 6 31 Q2 22 12 20 Q14 10 25 13 Q32 4 41 11 Q52 9 52 20 Q60 24 55 33 Q56 42 45 41 Q38 48 28 43 Q20 47 14 40 Z" fill="#fff" ' + S(3) + '/>');
  }
  function note(col) {
    return svg(40, 50, '<path d="M14 40 V10 L34 5 V34" fill="none" ' + S(4) + '/><ellipse cx="9" cy="40" rx="8" ry="6.5" fill="' + col + '" ' + S(3) + '/><ellipse cx="29" cy="35" rx="8" ry="6.5" fill="' + col + '" ' + S(3) + '/>');
  }
  function plus() {
    return svg(60, 60, '<path d="M30 8 V52 M8 30 H52" stroke="' + OL + '" stroke-width="16" stroke-linecap="round"/><path d="M30 8 V52 M8 30 H52" stroke="#fff" stroke-width="9" stroke-linecap="round"/>');
  }

  // ---------------- STATIONS (150x120) ----------------
  var ST = {};
  ST.grill = function () {
    var bars = '';
    for (var x = 24; x <= 126; x += 10) bars += '<line x1="' + x + '" y1="41" x2="' + x + '" y2="52" stroke="#cfd6de" stroke-width="3"/>';
    return svg(150, 120,
      shadow(75, 112, 58, 6) +
      tube('M36 84 L30 110', 5, '#4a4f57') + tube('M114 84 L120 110', 5, '#4a4f57') +
      '<path d="M18 56 H132 L124 92 Q75 102 26 92 Z" fill="url(#gb)" ' + S() + '/>' +
      '<rect x="56" y="70" width="38" height="8" rx="4" fill="#15181b" opacity=".6"/>' +
      '<circle cx="38" cy="74" r="5.5" fill="#ff5a3c" ' + S(2.5) + '/><circle cx="112" cy="74" r="5.5" fill="#ff5a3c" ' + S(2.5) + '/>' +
      hl('M28 62 H66', 3, 0.3) +
      '<rect x="22" y="44" width="106" height="12" rx="5" fill="url(#coal)"/>' +
      flame(30, 46, 0.7) + flame(52, 46, 0.85) + flame(75, 46, 0.7) + flame(97, 46, 0.85) + flame(117, 46, 0.65) +
      bars + '<line x1="16" y1="46.5" x2="134" y2="46.5" stroke="#cfd6de" stroke-width="2.5"/>' +
      '<rect x="14" y="40" width="122" height="13" rx="6.5" fill="none" ' + S(4) + '/>',
      lg('gb', ['#5c636d', '#2a2e34']) + lg('coal', ['#ffcc4d', '#e8501f']));
  };
  ST.jus = function () {
    return svg(150, 120,
      shadow(75, 112, 62, 6) +
      '<path d="M120 105 Q142 100 144 80 Q148 97 133 108 Q124 113 120 105 Z" fill="#ffd93b" ' + S(3) + '/>' +
      '<circle cx="22" cy="97" r="13" fill="url(#or)" ' + S(3) + '/><path d="M22 84 Q28 76 34 80 Q28 86 22 84 Z" fill="#5cbf4a" ' + S(2) + '/>' +
      '<path d="M50 84 H100 L108 108 H42 Z" fill="url(#rd)" ' + S() + '/>' +
      '<circle cx="75" cy="97" r="6" fill="#fff" ' + S(2.5) + '/>' +
      tube('M97 40 Q116 42 114 60 Q112 74 96 74', 5, '#d7eef8') +
      '<path d="M50 28 H100 L95 84 H55 Z" fill="#eefaff" ' + S() + '/>' +
      '<path d="M52.6 46 H97.4 L94.2 82 H55.8 Z" fill="url(#sm)"/>' +
      dots([[64, 58, 2.5], [80, 66, 2], [70, 74, 2.8], [86, 54, 1.8]], '#fff', 0.6) +
      '<path d="M50 28 H100 L95 84 H55 Z" fill="none" ' + S() + '/>' +
      hl('M59 34 L62 77', 4, 0.6) +
      '<rect x="46" y="20" width="58" height="11" rx="5" fill="#3d4652" ' + S(3.5) + '/><rect x="66" y="11" width="18" height="11" rx="4" fill="#3d4652" ' + S(3.5) + '/>',
      lg('rd', ['#f25f4c', '#c3352a']) + lg('sm', ['#ffa1c4', '#ff5e8e']) + rg('or', '#ffc061', '#f08a0c'));
  };
  ST.frites = function () {
    var grid = '';
    for (var x = 52; x < 90; x += 7) grid += '<line x1="' + x + '" y1="29" x2="' + x + '" y2="47" stroke="#8d99a5" stroke-width="1.6"/>';
    grid += '<line x1="45" y1="36" x2="89" y2="36" stroke="#8d99a5" stroke-width="1.6"/><line x1="45" y1="42" x2="89" y2="42" stroke="#8d99a5" stroke-width="1.6"/>';
    return svg(150, 120,
      shadow(75, 113, 60, 6) +
      '<rect x="28" y="102" width="12" height="10" rx="3" fill="#4a4f57" ' + S(3) + '/><rect x="110" y="102" width="12" height="10" rx="3" fill="#4a4f57" ' + S(3) + '/>' +
      '<rect x="20" y="48" width="110" height="58" rx="10" fill="url(#steel)" ' + S() + '/>' +
      '<rect x="32" y="74" width="86" height="24" rx="7" fill="#7c8894" opacity=".3"/>' +
      '<circle cx="47" cy="86" r="6.5" fill="#ff5a3c" ' + S(2.5) + '/><circle cx="103" cy="86" r="6.5" fill="#ffd23a" ' + S(2.5) + '/>' +
      '<rect x="62" y="80" width="26" height="12" rx="3" fill="#2b3a2a" ' + S(2.5) + '/><rect x="66" y="83" width="12" height="6" rx="1" fill="#7cff6b" opacity=".8"/>' +
      hl('M30 56 V96', 3, 0.5) +
      '<rect x="29" y="39" width="92" height="19" rx="7" fill="#2b2622" ' + S() + '/>' +
      '<rect x="34" y="45" width="82" height="9" rx="4" fill="url(#oil)"/>' + dots([[44, 49, 1.8], [104, 48, 1.6], [97, 51, 1.2]], '#fff8b0', 0.9) +
      '<rect x="44" y="28" width="46" height="20" rx="4" fill="#dfe4ea" fill-opacity=".85" ' + S(3) + '/>' + grid +
      '<rect x="44" y="28" width="46" height="20" rx="4" fill="none" ' + S(3) + '/>' +
      tube('M90 33 L130 16', 5, '#3a3f46') + tube('M120 20 L133 14.5', 6, '#ff5a3c'),
      lg('steel', ['#eef2f6', '#9ba7b4']) + lg('oil', ['#ffe066', '#ffb21f']));
  };
  ST.pizza = function () {
    return svg(150, 120,
      shadow(75, 114, 64, 6) +
      '<rect x="95" y="4" width="18" height="32" rx="3" fill="#8a7c74" ' + S() + '/><rect x="90" y="2" width="28" height="9" rx="3" fill="#6f625b" ' + S(3) + '/>' +
      '<path d="M18 92 Q18 18 75 18 Q132 18 132 92 Z" fill="url(#dm)" ' + S() + '/>' +
      '<path d="M26 74 Q75 60 124 74 M22 56 Q75 40 128 56 M36 37 Q75 24 114 37" fill="none" stroke="#8d3c20" stroke-width="2.5" opacity=".5"/>' +
      '<path d="M50 42 V55 M84 40 V54 M34 57 V72 M66 58 V72 M100 57 V71 M116 74 V88 M30 76 V89 M60 30 V40 M94 29 V39" stroke="#8d3c20" stroke-width="2.5" opacity=".45" stroke-linecap="round"/>' +
      hl('M30 66 Q34 36 62 26', 5, 0.3) +
      '<path d="M47 92 Q47 54 75 54 Q103 54 103 92 Z" fill="#2a150b" ' + S() + '/>' +
      '<path d="M56 92 Q54 78 62 72 Q62 80 68 80 Q66 66 76 59 Q80 72 84 74 Q86 68 90 66 Q97 77 95 92 Z" fill="url(#fire)"/>' +
      '<rect x="58" y="86" width="34" height="6" rx="3" fill="#6b3d1c"/>' +
      '<rect x="12" y="88" width="126" height="22" rx="6" fill="url(#bs)" ' + S() + '/>' +
      '<path d="M40 89 V110 M75 89 V110 M110 89 V110 M14 99 H136" stroke="#5a3520" stroke-width="2" opacity=".5"/>',
      lg('dm', ['#e08a55', '#b1522f']) + lg('fire', ['#ffe46b', '#ff6a2a']) + lg('bs', ['#a57352', '#74482f']));
  };
  ST.soupe = function () {
    var handles = tube('M27 54 Q12 55 14 64 Q16 72 30 70', 4, '#c4461b') + tube('M123 54 Q138 55 136 64 Q134 72 120 70', 4, '#c4461b');
    return svg(150, 120,
      shadow(75, 114, 60, 6) +
      flame(56, 104, 0.9) + flame(73, 102, 1.05) + flame(90, 104, 0.9) +
      tube('M28 110 L122 98', 8, '#8b5a2b') + tube('M28 98 L122 110', 8, '#9b6534') +
      '<circle cx="28" cy="110" r="5" fill="#e0b07a" ' + S(2) + '/><circle cx="122" cy="110" r="5" fill="#e0b07a" ' + S(2) + '/>' +
      handles +
      '<path d="M28 46 H122 L116 94 Q75 104 34 94 Z" fill="url(#pt)" ' + S() + '/>' +
      dots([[44, 62, 2.4], [56, 80, 2], [98, 66, 2.6], [104, 84, 1.8], [80, 76, 2.2], [66, 58, 1.6]], '#fff', 0.45) +
      hl('M38 54 Q40 76 48 90', 4, 0.35) +
      '<rect x="22" y="38" width="106" height="13" rx="6.5" fill="#ff9f55" ' + S() + '/>' +
      tube('M100 40 L122 6', 4, '#c8d0d8'),
      lg('pt', ['#ff8a3d', '#d1491a']));
  };
  ST.wok = function () {
    var blue = '';
    for (var x = 46; x <= 104; x += 11) blue += '<path d="M' + x + ' 94 q-4 -6 0 -12 q4 6 0 12 z" fill="#4fc3f7"/><path d="M' + x + ' 92 q-2 -3 0 -6 q2 3 0 6 z" fill="#ffd54f"/>';
    return svg(150, 120,
      shadow(75, 114, 58, 6) +
      blue +
      '<rect x="36" y="92" width="78" height="18" rx="6" fill="#3b4048" ' + S() + '/><circle cx="75" cy="101" r="4.5" fill="#ff5a3c" ' + S(2) + '/>' +
      tube('M44 50 Q52 28 62 44 Q70 24 80 42 Q90 26 98 46', 4, '#ffd862', 2.5) +
      '<circle cx="58" cy="30" r="4" fill="#6cc24a" ' + S(2) + '/><circle cx="88" cy="30" r="3.6" fill="#e8433a" ' + S(2) + '/><circle cx="74" cy="20" r="3.4" fill="#ff9f1c" ' + S(2) + '/>' +
      '<path d="M14 56 Q75 116 136 56 Z" fill="url(#wk)" ' + S() + '/>' +
      '<path d="M16 57 Q75 66 134 57" fill="none" stroke="#8b939d" stroke-width="3"/>' +
      hl('M30 66 Q48 84 70 88', 3, 0.28) +
      tube('M134 58 L148 47', 6, '#a0602e'),
      lg('wk', ['#565c65', '#24272c']));
  };
  ST.sushi = function () {
    return svg(150, 120,
      shadow(76, 114, 64, 6) +
      '<path d="M24 108 L140 92 L140 98 L24 114 Z" fill="#a8723a" ' + S(3) + '/>' +
      '<path d="M10 76 L126 62 L140 92 L24 108 Z" fill="url(#bd)" ' + S() + '/>' +
      '<path d="M30 92 L80 86 M60 100 L120 92 M20 84 L50 80" stroke="#c48b4c" stroke-width="2" stroke-linecap="round"/>' +
      '<ellipse cx="110" cy="80" rx="18" ry="11" fill="#fffaf0" ' + S(3) + '/>' + dots([[104, 78, 1.4], [112, 76, 1.4], [116, 82, 1.4], [106, 84, 1.4]], '#d9d2c0', 0.9) +
      '<path d="M28 82 Q34 68 64 68 Q84 68 84 82 Q62 92 32 92 Z" fill="#ff8f5a" ' + S(3) + '/>' +
      '<path d="M40 74 Q46 70 52 76 M56 72 Q62 68 68 74 M44 84 Q52 78 60 84" fill="none" stroke="#ffd7c2" stroke-width="2.6" stroke-linecap="round"/>' +
      tube('M48 66 L66 61', 6, '#2e2e2e') +
      '<path d="M66 58 L124 40 Q132 40 130 48 L72 66 Z" fill="#e6ebf0" ' + S(3) + '/>' + hl('M74 60 L122 45', 2, 0.8),
      lg('bd', ['#f2c788', '#d39a55']));
  };
  ST.gateau = function () {
    return svg(150, 120,
      shadow(80, 113, 62, 6) +
      '<path d="M8 86 H34 L30 108 H12 Z" fill="#6ec6ff" ' + S(3) + '/><path d="M15 88 L16 107 M21 88 V107 M27 88 L26 107" stroke="#3f9fdb" stroke-width="2"/>' +
      '<path d="M6 88 Q4 72 21 70 Q38 72 36 88 Z" fill="#fff0f6" ' + S(3) + '/><path d="M12 82 Q21 76 30 82" fill="none" stroke="#ffc2d8" stroke-width="2.5"/>' +
      '<circle cx="21" cy="66" r="4.5" fill="#e3263a" ' + S(2) + '/>' +
      '<rect x="46" y="98" width="94" height="12" rx="5" fill="url(#pk)" ' + S() + '/>' +
      '<rect x="112" y="40" width="22" height="62" rx="9" fill="url(#pk)" ' + S() + '/>' +
      '<path d="M56 66 H112 Q110 98 84 100 Q58 98 56 66 Z" fill="url(#steel)" ' + S() + '/>' +
      '<ellipse cx="84" cy="66" rx="28" ry="5" fill="#fff3d6" ' + S(3) + '/>' +
      tube('M84 50 L84 64', 3, '#cfd6de', 2) +
      '<path d="M50 28 Q50 16 64 16 H120 Q136 16 136 32 V42 Q136 50 128 50 H64 Q50 50 50 40 Z" fill="url(#pk)" ' + S() + '/>' +
      '<path d="M60 35 H122" stroke="#fff" stroke-width="4" opacity=".55" stroke-linecap="round"/>' +
      '<circle cx="126" cy="28" r="4" fill="#fff" ' + S(2) + '/>',
      lg('pk', ['#ff9cc2', '#e8578f']) + lg('steel', ['#eef2f6', '#9ba7b4']));
  };

  // ---------------- DECOR ----------------
  function lanterns(level) {
    var cols = ['#e8433a', '#ff9f1c', '#ffd23a', '#43b047', '#e8433a', '#ff9f1c', '#ffd23a'];
    var n = 3 + level * 2, out = '<path d="M-10 14 Q360 74 730 14" fill="none" stroke="#5a3418" stroke-width="4"/>';
    for (var i = 0; i < n; i++) {
      var t = (i + 1) / (n + 1), x = -10 + 740 * t;
      var y = (1 - t) * (1 - t) * 14 + 2 * (1 - t) * t * 74 + t * t * 14;
      var c = cols[i % cols.length];
      out += '<circle cx="' + x + '" cy="' + (y + 30) + '" r="26" fill="url(#glow)"/>' +
        '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y + 12) + '" stroke="#5a3418" stroke-width="2.5"/>' +
        '<ellipse cx="' + x + '" cy="' + (y + 30) + '" rx="14" ry="18" fill="' + c + '" ' + S(3) + '/>' +
        '<path d="M' + (x - 6) + ' ' + (y + 14) + ' Q' + (x - 10) + ' ' + (y + 30) + ' ' + (x - 6) + ' ' + (y + 46) + ' M' + (x + 6) + ' ' + (y + 14) + ' Q' + (x + 10) + ' ' + (y + 30) + ' ' + (x + 6) + ' ' + (y + 46) + '" fill="none" stroke="' + OL + '" stroke-width="1.6" opacity=".45"/>' +
        '<rect x="' + (x - 8) + '" y="' + (y + 9) + '" width="16" height="6" rx="2" fill="#3a2a20" ' + S(2) + '/>' +
        '<rect x="' + (x - 8) + '" y="' + (y + 45) + '" width="16" height="6" rx="2" fill="#3a2a20" ' + S(2) + '/>' +
        '<ellipse cx="' + (x - 5) + '" cy="' + (y + 24) + '" rx="3" ry="6" fill="#fff" opacity=".45"/>';
    }
    return svg(720, 150, out, '<radialGradient id="glow"><stop offset="0" stop-color="#fff3a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffd23a" stop-opacity="0"/></radialGradient>');
  }
  function plant(v) {
    var leaf = function (x, y, a, s, c) {
      return '<g transform="translate(' + x + ' ' + y + ') rotate(' + a + ') scale(' + s + ')">' +
        '<path d="M0 0 C-22 -10 -30 -44 0 -70 C30 -44 22 -10 0 0 Z" fill="' + c + '" ' + S(3.5) + '/>' +
        '<path d="M0 -4 V-62 M0 -22 L-12 -32 M0 -36 L12 -46 M0 -46 L-9 -54" fill="none" stroke="#2f7a2a" stroke-width="2.5" stroke-linecap="round"/></g>';
    };
    var leaves = v === 1 ?
      leaf(60, 100, -50, 1, '#4fb842') + leaf(60, 100, 40, 0.95, '#5cc84a') + leaf(60, 100, -12, 1.1, '#43a83a') + leaf(60, 100, 18, 0.9, '#6ad456') :
      leaf(60, 100, -36, 1.05, '#43a83a') + leaf(60, 100, 30, 1, '#5cc84a') + leaf(60, 100, -70, 0.85, '#6ad456') + leaf(60, 100, 62, 0.85, '#4fb842') + leaf(60, 100, 0, 1.15, '#4fb842');
    return svg(120, 160,
      shadow(60, 154, 34, 5) + leaves +
      '<path d="M30 102 H90 L82 152 H38 Z" fill="url(#pot)" ' + S() + '/>' +
      '<rect x="26" y="96" width="68" height="14" rx="5" fill="#d96d3c" ' + S() + '/>' + hl('M38 116 L42 144', 4, 0.35),
      lg('pot', ['#e57a45', '#b9532b']));
  }
  function drums() {
    var drum = function (x, w, h) {
      return '<path d="M' + (x - w) + ' 50 L' + (x - w * 0.8) + ' ' + (50 + h) + ' H' + (x + w * 0.8) + ' L' + (x + w) + ' 50 Z" fill="url(#dw)" ' + S() + '/>' +
        '<path d="M' + (x - w * 0.95) + ' 58 L' + (x - w * 0.5) + ' ' + (50 + h * 0.8) + ' L' + x + ' 58 L' + (x + w * 0.5) + ' ' + (50 + h * 0.8) + ' L' + (x + w * 0.95) + ' 58" fill="none" stroke="#f3e2c0" stroke-width="2.5" stroke-linejoin="round"/>' +
        '<ellipse cx="' + x + '" cy="50" rx="' + w + '" ry="' + (w * 0.32) + '" fill="#f6e7c8" ' + S() + '/>' +
        '<rect x="' + (x - w * 1.02) + '" y="52" width="' + (w * 2.04) + '" height="6" rx="3" fill="#e8433a" ' + S(2.5) + '/>';
    };
    return svg(150, 130, shadow(75, 124, 62, 6) + drum(46, 30, 66) + drum(106, 26, 58) +
      '<path d="M20 30 L40 44 M124 22 L110 38" stroke="#7a4622" stroke-width="5" stroke-linecap="round"/><circle cx="18" cy="28" r="5" fill="#f6e7c8" ' + S(2) + '/><circle cx="126" cy="20" r="5" fill="#f6e7c8" ' + S(2) + '/>',
      lg('dw', ['#b8733c', '#7d4520']));
  }

  // ---------------- BUSINESS ICONS (100x100) ----------------
  var BIZ = {};
  BIZ.stand = function () {
    var stripes = '';
    for (var i = 0; i < 6; i++) stripes += '<path d="M' + (12 + i * 13) + ' 22 H' + (25 + i * 13) + ' V40 Q' + (18.5 + i * 13) + ' 46 ' + (12 + i * 13) + ' 40 Z" fill="' + (i % 2 ? '#fff' : '#e8433a') + '"/>';
    return svg(100, 100, shadow(50, 92, 40, 5) +
      '<rect x="18" y="38" width="6" height="40" fill="#8b5a2b" ' + S(2.5) + '/><rect x="76" y="38" width="6" height="40" fill="#8b5a2b" ' + S(2.5) + '/>' +
      '<rect x="12" y="62" width="76" height="28" rx="4" fill="url(#wd)" ' + S() + '/><path d="M18 72 H82 M18 80 H82" stroke="#a8692c" stroke-width="2"/>' +
      stripes + '<path d="M12 22 H90 V40 Q51 46 12 40 Z" fill="none" ' + S(3.5) + '/>' +
      '<path d="M44 46 H58 L56 62 H46 Z" fill="#ffb03b" ' + S(2.5) + '/><path d="M53 40 L56 50" ' + S(2) + '/>' +
      '<circle cx="30" cy="57" r="6" fill="#ff9f1c" ' + S(2.5) + '/><circle cx="72" cy="57" r="6" fill="#7cc84a" ' + S(2.5) + '/>',
      lg('wd', ['#e0a35c', '#b8763a']));
  };
  BIZ.truck = function () {
    return svg(100, 100, shadow(50, 90, 44, 5) +
      '<path d="M6 76 V40 Q6 32 14 32 H66 L72 44 H86 Q94 44 94 54 V76 Z" fill="url(#tk)" ' + S() + '/>' +
      '<rect x="14" y="40" width="40" height="20" rx="3" fill="#2d3a4a" ' + S(3) + '/>' +
      '<path d="M12 38 H56 L60 46 H8 Z" fill="#e8433a" ' + S(2.5) + '/>' +
      '<path d="M68 48 H84 Q88 48 88 54 V58 H68 Z" fill="#9fdcf5" ' + S(2.5) + '/>' +
      '<rect x="22" y="16" width="26" height="16" rx="5" fill="#fff" ' + S(2.5) + '/><path d="M27 24 Q35 16 43 24 Z" fill="#e8a33d" ' + S(1.5) + '/><rect x="26" y="25" width="18" height="3" rx="1.5" fill="#7a3d1c"/>' +
      '<circle cx="24" cy="78" r="9" fill="#2e2e2e" ' + S(3) + '/><circle cx="24" cy="78" r="3.5" fill="#cfd6de"/>' +
      '<circle cx="76" cy="78" r="9" fill="#2e2e2e" ' + S(3) + '/><circle cx="76" cy="78" r="3.5" fill="#cfd6de"/>' +
      hl('M12 66 H40', 3, 0.4),
      lg('tk', ['#ffd54f', '#f4a300']));
  };
  BIZ.kiosque = function () {
    return svg(100, 100, '<ellipse cx="50" cy="88" rx="46" ry="9" fill="#ffe0a3" ' + S(3) + '/>' +
      '<path d="M84 86 Q80 50 88 22" fill="none" ' + S(5, '#8b5a2b') + '/>' +
      '<path d="M88 22 Q72 12 64 22 M88 22 Q100 10 106 24 M88 22 Q80 34 72 38 M88 22 Q98 30 100 40" fill="none" stroke="#43a83a" stroke-width="6" stroke-linecap="round"/>' +
      '<rect x="20" y="48" width="48" height="36" fill="url(#wd)" ' + S() + '/><rect x="34" y="60" width="20" height="24" fill="#5a3418" ' + S(2.5) + '/>' +
      '<path d="M10 52 L44 22 L78 52 Z" fill="url(#straw)" ' + S() + '/>' +
      '<path d="M20 50 L44 28 M34 52 L46 34 M58 52 L48 32 M70 50 L50 30" stroke="#c99a3a" stroke-width="2"/>',
      lg('wd', ['#e0a35c', '#b8763a']) + lg('straw', ['#ffe08a', '#e6b24a']));
  };
  BIZ.franchise = function () {
    var win = '';
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) win += '<rect x="' + (28 + c * 16) + '" y="' + (34 + r * 15) + '" width="10" height="9" rx="2" fill="#9fdcf5" ' + S(2) + '/>';
    return svg(100, 100, shadow(50, 92, 40, 5) +
      '<rect x="20" y="26" width="60" height="64" rx="4" fill="url(#bd)" ' + S() + '/>' + win +
      '<rect x="42" y="76" width="16" height="14" fill="#5a3418" ' + S(2.5) + '/>' +
      '<rect x="14" y="10" width="72" height="18" rx="5" fill="#e8433a" ' + S() + '/>' +
      '<g transform="translate(40 2) scale(.42)"><g fill="' + OL + '"><circle cx="16" cy="20" r="16"/><circle cx="32" cy="14" r="18"/><circle cx="48" cy="20" r="16"/></g><g fill="#fff"><circle cx="16" cy="20" r="12.5"/><circle cx="32" cy="14" r="14.5"/><circle cx="48" cy="20" r="12.5"/></g><rect x="8" y="22" width="48" height="16" rx="4" fill="#fff" ' + S(3.5) + '/></g>',
      lg('bd', ['#ffcf73', '#e9a23b']));
  };

  // ---------------- SMALL DECOR ICONS (100x100) ----------------
  var ICON = {};
  ICON.tabourets = function () {
    return svg(100, 100, shadow(50, 93, 30, 5) +
      tube('M34 50 L26 90', 5, '#8b5a2b') + tube('M66 50 L74 90', 5, '#8b5a2b') + tube('M50 52 V90', 5, '#7a4d25') +
      '<path d="M31 72 H69" ' + S(4) + '/><path d="M31 72 H69" stroke="#a8692c" stroke-width="2"/>' +
      '<ellipse cx="50" cy="46" rx="34" ry="12" fill="#c0392b" ' + S() + '/>' +
      '<path d="M16 42 Q16 28 50 28 Q84 28 84 42 Q84 52 50 52 Q16 52 16 42 Z" fill="url(#cu)" ' + S() + '/>' + hl('M28 36 Q38 32 52 32', 3, 0.6),
      lg('cu', ['#f0614e', '#c0392b']));
  };
  ICON.lanternes = function () {
    return svg(100, 100, '<circle cx="50" cy="56" r="40" fill="url(#gl)"/>' +
      '<line x1="50" y1="2" x2="50" y2="20" stroke="#5a3418" stroke-width="3"/>' +
      '<ellipse cx="50" cy="55" rx="27" ry="33" fill="#e8433a" ' + S() + '/>' +
      '<path d="M38 26 Q30 55 38 84 M62 26 Q70 55 62 84 M50 22 V88" fill="none" stroke="' + OL + '" stroke-width="2" opacity=".4"/>' +
      '<rect x="36" y="17" width="28" height="10" rx="3" fill="#3a2a20" ' + S(2.5) + '/><rect x="36" y="83" width="28" height="10" rx="3" fill="#3a2a20" ' + S(2.5) + '/>' +
      '<ellipse cx="40" cy="46" rx="5" ry="11" fill="#fff" opacity=".45"/>' +
      '<path d="M46 93 V99 M54 93 V99 M50 93 V100" stroke="#ffd23a" stroke-width="2.5"/>',
      '<radialGradient id="gl"><stop offset="0" stop-color="#fff3a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffd23a" stop-opacity="0"/></radialGradient>');
  };
  ICON.enseigne = function () {
    var bulbs = '';
    for (var i = 0; i < 6; i++) bulbs += '<circle cx="' + (18 + i * 12.8) + '" cy="36" r="3.4" fill="#fff6a0" ' + S(1.5) + '/><circle cx="' + (18 + i * 12.8) + '" cy="76" r="3.4" fill="#fff6a0" ' + S(1.5) + '/>';
    return svg(100, 100, '<path d="M26 8 L22 34 M74 8 L78 34" stroke="#5a3418" stroke-width="3"/>' +
      '<rect x="8" y="30" width="84" height="52" rx="9" fill="url(#wd)" ' + S() + '/>' +
      '<rect x="18" y="44" width="64" height="24" rx="5" fill="#5a3418" opacity=".25"/>' +
      '<path d="M30 63 Q30 48 40 50 Q42 42 50 46 Q58 42 60 50 Q70 48 70 63 Z" fill="#fff" ' + S(2.5) + '/>' + bulbs,
      lg('wd', ['#e0a35c', '#b8763a']));
  };

  ICON.book = function () {
    var lines = '';
    for (var i = 0; i < 4; i++) {
      lines += '<path d="M21 ' + (36 + i * 10) + ' Q31 ' + (32 + i * 10) + ' 44 ' + (37 + i * 10) + '" fill="none" stroke="#c9a77a" stroke-width="2.5" stroke-linecap="round"/>';
      lines += '<path d="M56 ' + (37 + i * 10) + ' Q69 ' + (32 + i * 10) + ' 79 ' + (36 + i * 10) + '" fill="none" stroke="#c9a77a" stroke-width="2.5" stroke-linecap="round"/>';
    }
    return svg(100, 100,
      '<path d="M8 30 Q30 20 50 30 Q70 20 92 30 L92 86 Q70 76 50 86 Q30 76 8 86 Z" fill="#a0522d" ' + S(4) + '/>' +
      '<path d="M13 26 Q31 16 50 26 L50 80 Q31 70 13 78 Z" fill="#fff6dc" ' + S(3.5) + '/>' +
      '<path d="M87 26 Q69 16 50 26 L50 80 Q69 70 87 78 Z" fill="#fff6dc" ' + S(3.5) + '/>' + lines +
      '<path d="M62 20 V46 L67 41 L72 46 V18" fill="#e8433a" ' + S(2.5) + '/>' +
      '<path d="M50 26 V80" ' + S(3.5) + '/>');
  };

  // ---------------- PUBLIC API (cached data URIs) ----------------
  function get(key, fn) { if (!cache[key]) cache[key] = enc(fn()); return cache[key]; }
  return {
    // realistic renders when bundled (ASSETS), cartoon SVG fallback otherwise
    dish: function (id) { return (typeof ASSETS !== 'undefined' && ASSETS['dish_' + id]) || get('d_' + id, DISH[id]); },
    station: function (id) { return (typeof ASSETS !== 'undefined' && ASSETS['st_' + id]) || get('s_' + id, ST[id]); },
    dishBg: function (id) { return (typeof ASSETS !== 'undefined' && ASSETS['dish_' + id]) ? 'var(--a-dish_' + id + ')' : 'url("' + get('d_' + id, DISH[id]) + '")'; },
    stationBg: function (id) { return (typeof ASSETS !== 'undefined' && ASSETS['st_' + id]) ? 'var(--a-st_' + id + ')' : 'url("' + get('s_' + id, ST[id]) + '")'; },
    coin: function () { return get('coin', coin); },
    check: function () { return get('check', check); },
    crown: function () { return get('crown', crown); },
    hand: function () { return get('hand', hand); },
    vein: function () { return get('vein', vein); },
    steam: function () { return get('steam', steam); },
    note: function (c) { return get('note' + c, function () { return note(c); }); },
    plus: function () { return get('plus', plus); },
    lanterns: function (l) { return get('lant' + l, function () { return lanterns(l); }); },
    plant: function (v) { return get('plant' + v, function () { return plant(v); }); },
    drums: function () { return get('drums', drums); },
    biz: function (id) { return get('b_' + id, BIZ[id]); },
    icon: function (id) { return get('i_' + id, ICON[id]); },
    book: function () { return get('i_book', ICON.book); },
    _raw: { DISH: DISH, ST: ST }
  };
})();
