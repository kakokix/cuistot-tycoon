// ===================== SOUND (Web Audio synthesis: no audio files) =====================
var Sfx = (function () {
  var ctx = null, master, sfxG, musG, noiseBuf = null;
  var vol = { music: 0.6, sfx: 0.8 };
  var musicOn = false, musicTimer = null, step = 0, nextT = 0, tempo = 96;
  var last = {};

  function init() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { ctx = null; return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.connect(master);
    musG = ctx.createGain(); musG.connect(master);
    var len = ctx.sampleRate * 0.6;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    applyVol();
    return true;
  }
  function applyVol() {
    if (!ctx) return;
    sfxG.gain.value = vol.sfx * 0.9;
    musG.gain.value = vol.music * 0.32;
  }
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (musicOn && !musicTimer) startMusicLoop();
  }
  function tone(f, t, dur, type, g, dest, f2) {
    var o = ctx.createOscillator(), a = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    a.gain.setValueAtTime(0.0001, t);
    a.gain.exponentialRampToValueAtTime(g, t + 0.008);
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a); a.connect(dest || sfxG);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, g, freq, type, dest) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), a = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = type || 'bandpass'; f.frequency.value = freq || 3000; f.Q.value = 0.8;
    a.gain.setValueAtTime(g, t);
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(a); a.connect(dest || sfxG);
    s.start(t); s.stop(t + dur + 0.02);
  }
  function mallet(f, t, g, dest) {
    tone(f, t, 0.35, 'sine', g, dest);
    tone(f * 4, t, 0.06, 'sine', g * 0.25, dest);
  }
  var SOUNDS = {
    click: function (t) { tone(620, t, 0.07, 'triangle', 0.3); tone(930, t + 0.015, 0.05, 'sine', 0.12); },
    cook: function (t) { noise(t, 0.4, 0.16, 4200, 'highpass'); tone(160, t, 0.08, 'triangle', 0.12); },
    ready: function (t) { mallet(1046, t, 0.3); mallet(1568, t + 0.09, 0.26); },
    serve: function (t) { tone(520, t, 0.09, 'triangle', 0.25, null, 900); tone(990, t + 0.06, 0.08, 'sine', 0.12); },
    coin: function (t) { [1318, 1760, 2637].forEach(function (f, i) { tone(f, t + i * 0.055, 0.14, 'square', 0.06); tone(f, t + i * 0.055, 0.2, 'sine', 0.12); }); },
    arrive: function (t) { mallet(784, t, 0.18); mallet(988, t + 0.08, 0.16); },
    angry: function (t) { tone(220, t, 0.35, 'sawtooth', 0.12, null, 110); tone(165, t + 0.1, 0.3, 'square', 0.06, null, 90); },
    nope: function (t) { tone(180, t, 0.12, 'square', 0.08, null, 150); },
    buy: function (t) { [523, 659, 784, 1046].forEach(function (f, i) { mallet(f, t + i * 0.06, 0.24); }); noise(t + 0.2, 0.25, 0.05, 6000, 'highpass'); },
    star: function (t) { mallet(1318, t, 0.25); mallet(1976, t + 0.07, 0.22); },
    booster: function (t) { tone(300, t, 0.35, 'sawtooth', 0.08, null, 1200); noise(t, 0.35, 0.1, 2000); mallet(1568, t + 0.25, 0.2); },
    levelup: function (t) { [523, 659, 784, 1046, 784, 1046, 1318].forEach(function (f, i) { mallet(f, t + i * 0.09, 0.28); }); },
    win: function (t) { [392, 523, 659, 784, 659, 784, 1046].forEach(function (f, i) { mallet(f, t + i * 0.11, 0.3); tone(f / 2, t + i * 0.11, 0.2, 'triangle', 0.1); }); },
    lose: function (t) { [523, 494, 466, 392].forEach(function (f, i) { tone(f, t + i * 0.22, 0.32, 'triangle', 0.22); }); },
    soft: function (t) { [523, 659, 784, 659].forEach(function (f, i) { mallet(f, t + i * 0.16, 0.2); }); },
    page: function (t) { noise(t, 0.12, 0.05, 2500, 'bandpass'); tone(880, t, 0.06, 'sine', 0.05); },
    friend: function (t) { [784, 988, 1175, 1568].forEach(function (f, i) { mallet(f, t + i * 0.07, 0.18); }); },
    tick: function (t) { tone(1500, t, 0.04, 'square', 0.05); },
    whoosh: function (t) { noise(t, 0.3, 0.12, 900, 'bandpass'); },
    pop: function (t) { tone(400, t, 0.08, 'sine', 0.25, null, 800); }
  };
  function play(name) {
    if (!ctx || vol.sfx <= 0.001) return;
    if (ctx.state === 'suspended') return;
    var now = ctx.currentTime;
    if (last[name] && now - last[name] < 0.04) return;
    last[name] = now;
    try { SOUNDS[name] && SOUNDS[name](now + 0.005); } catch (e) { }
  }

  // ----- music: cheerful tropical marimba loop -----
  var MEL = [76, 0, 79, 76, 0, 72, 74, 76, 77, 0, 81, 77, 0, 72, 74, 77, 79, 0, 83, 79, 0, 74, 76, 77, 76, 74, 72, 0, 67, 0, 72, 0,
    79, 0, 76, 79, 81, 79, 76, 0, 81, 0, 77, 81, 84, 81, 77, 0, 83, 81, 79, 77, 76, 74, 71, 74, 72, 0, 67, 0, 72, 0, 0, 0];
  var MEL_B = [72, 0, 0, 74, 76, 0, 0, 0, 79, 0, 76, 0, 74, 0, 0, 0, 77, 0, 0, 76, 74, 0, 0, 0, 72, 0, 74, 0, 67, 0, 0, 0,
    69, 0, 0, 72, 74, 0, 0, 0, 76, 0, 79, 0, 81, 0, 0, 0, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0, 0, 0, 0, 0, 0, 0];
  var BASS = [48, 55, 48, 55, 53, 60, 53, 60, 55, 62, 55, 62, 48, 55, 48, 52];
  var CH = [[60, 64, 67], [60, 65, 69], [62, 67, 71], [60, 64, 67]];
  function mf(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function scheduleStep(i, t) {
    var e = 60 / tempo / 2;
    var part = Math.floor(i / 64) % 2;          // A (lively) then B (calm), alternating
    var m = (part ? MEL_B : MEL)[i % 64];
    if (m) mallet(mf(m), t, part ? 0.17 : 0.2, musG);
    if (i % 2 === 0) { var b = BASS[(i / 2) % 16 | 0]; tone(mf(b), t, e * 1.6, 'triangle', 0.32, musG); }
    var bar = Math.floor(i / 8) % 4;
    if (i % 8 === 2 || i % 8 === 6) CH[bar].forEach(function (n) { tone(mf(n), t, e * 1.2, 'sine', 0.06, musG); });
    noise(t, 0.05, i % 2 ? 0.035 : 0.02, 7000, 'highpass', musG);
    if (i % 8 === 4) noise(t, 0.12, 0.05, 1800, 'bandpass', musG);
  }
  function startMusicLoop() {
    if (!ctx || musicTimer) return;
    nextT = ctx.currentTime + 0.1;
    musicTimer = setInterval(function () {
      if (!ctx || ctx.state !== 'running') return;
      var e = 60 / tempo / 2;
      while (nextT < ctx.currentTime + 0.2) { scheduleStep(step, nextT); step++; nextT += e; }
      if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    }, 60);
  }
  function stopMusicLoop() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
  function music(on) {
    musicOn = on;
    if (on && ctx && ctx.state === 'running') startMusicLoop();
    if (!on) stopMusicLoop();
  }
  function setTempo(t) { tempo = t; }
  function setVol(m, s) { vol.music = m; vol.sfx = s; applyVol(); }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  return { unlock: unlock, play: play, music: music, setVol: setVol, setTempo: setTempo, suspend: suspend, resume: resume };
})();
