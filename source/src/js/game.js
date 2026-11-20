// ===================== GAME CONTROLLER =====================
var Game = (function () {
  var sh = null, intro = false, lastTick = -1, ended = false;

  function enterHub() {
    showScreen('game');
    toHub();
  }
  // back from the daily challenge: the player's real save and kitchen come back
  function endDefi() {
    if (!App.real) return;
    App.save = App.real; App.real = null;
    Scene.refreshStations(); Scene.refreshDecor(); View3D.refresh();
  }
  function toTitle() {
    UI.closeAll(); Tuto.hide(); Fps.stop(true); endDefi();
    sh = null; ended = false;
    Scene.setMode('hub');
    showScreen('title');
    UI.refreshTitle();
    Sfx.setTempo(96);
    Store.save(App.save);
  }
  // On a wide screen the title is drawn over the live 3D restaurant: the game screen stays visible
  // behind it ("titling" hides its HUD and labels).
  function showScreen(name) {
    App.screen = name;
    var g = document.getElementById('screen-game');
    document.getElementById('screen-title').classList.toggle('on', name === 'title');
    g.classList.toggle('on', name === 'game' || App.wide);
    g.classList.toggle('titling', name === 'title');
  }
  function syncScreens() { showScreen(App.screen); }
  function toHub() {
    sh = null; ended = false; Tuto.hide(); Fps.stop(true); endDefi();
    Scene.setMode('hub');
    Sfx.setTempo(96);
    Store.save(App.save);
    firstRun(function () {
      setTimeout(function () {
        if (!sh && !UI.isBlocking() && !Story.active()) Tuto.hubCheck();
        if (!sh) { Ach.check(); Updater.maybePrompt(false); }
        // the daily gift opens by itself when it is waiting (once per day, never over a tip or another window)
        if (!sh && !UI.isBlocking() && !Story.active() && !Tuto.step()) Club.autoGift();
        Online.submit();
        Scene.refreshHud();
      }, 400);
    });
  }
  // first launch (or first launch after the update): prologue, then how the player wants to play
  function firstRun(then) {
    var s = App.save;
    if (!s.story.seen.prologue) Story.playChapter('prologue', function () { firstRun(then); });
    else if (!s.seenTuto.mode) UI.chooseMode(then);
    else then();
  }
  function maybeBreak(then) {
    if (App.save.settings.pause !== false && (App.playT || 0) >= 1800) { App.playT = 0; UI.breakReminder(then); }
    else then();
  }
  // opts.sim: play this day in the first-person simulator (default: the player's last choice)
  function simWanted() { return !!(App.save.settings.sim && App.save.seenTuto.basic && View3D.usable()); }
  function startDay(d, opts) {
    opts = opts || {};
    UI.closeAll(); Tuto.hide(); Fps.stop(true); endDefi();
    showScreen('game');
    if (!App.save.story.seen.prologue || !App.save.seenTuto.mode) {
      sh = null; Scene.setMode('hub');
      firstRun(function () { startDay(d, opts); });
      return;
    }
    var tutorial = !App.save.seenTuto.basic && d === 1;
    var sim = !tutorial && (opts.sim != null ? !!opts.sim && View3D.usable() : simWanted());
    if (sim && !App.save.seenTuto.sim) { App.save.seenTuto.sim = 1; Store.save(App.save); UI.simHelp(function () { startDay(d, opts); }); return; }
    sh = new Shift(App.save, d, { tutorial: tutorial, manual: sim });
    ended = false; lastTick = -1;
    Scene.setMode('shift', sh);
    if (sim && !Fps.start(sh)) { sh = new Shift(App.save, d, { tutorial: tutorial }); Scene.setMode('shift', sh); }
    intro = true;
    Sfx.setTempo(sh.relax ? 104 : 116);
    UI.banner('JOUR ' + d, 'Objectif : ' + Util.fmt(sh.goal) + ' <img class="coin" src="' + Art.coin() + '">', 1500, function () { intro = false; });
  }
  // the daily challenge: the same kitchen and the same customers for every chef (see Daily.defiInfo)
  function startDefi() {
    UI.closeAll(); Tuto.hide(); Fps.stop(true); endDefi();
    showScreen('game');
    var info = Daily.defiInfo();
    App.real = App.save; App.save = Daily.defiSave(info);
    sh = new Shift(App.save, 0, { cfg: info.cfg, rng: Daily.rng(info.seed), challenge: true });
    sh.defi = info;
    ended = false; lastTick = -1;
    Scene.refreshStations(); Scene.refreshDecor(); View3D.refresh();
    Scene.setMode('shift', sh);
    intro = true;
    Sfx.setTempo(116);
    UI.banner('DÉFI DU JOUR', info.mod.name, 1700, function () { intro = false; });
  }
  function isPaused() { return intro || UI.isBlocking() || Tuto.blocking() || Story.active() || !App.visible; }
  function pause() { if (!sh || sh.over || UI.isBlocking()) return; UI.pause(sh); }
  function quitShift() { if (sh) sh.over = true; toHub(); }
  // walk freely in the restaurant, no customers (first-person visit)
  function visit() { UI.closeAll(); Tuto.hide(); showScreen('game'); sh = null; Scene.setMode('hub'); Fps.start(null); }

  function update(dt) {
    if (window.Fps) Fps.update(dt);
    if (sh && !sh.over && !isPaused()) {
      sh.update(dt);
      App.playT = (App.playT || 0) + dt;
      var t = Math.ceil(sh.timeLeft);
      if (!sh.relax && !sh.tutorial && t <= 10 && t !== lastTick && t > 0) { lastTick = t; Sfx.play('tick'); }
    }
    Scene.update(dt);
  }

  function useBooster(id) {
    if (!sh || sh.over || isPaused()) return;
    var s = App.save, B = GD.BOOSTERS[id];
    if (!s.boosters[id]) {
      if (sh.challenge) { Sfx.play('nope'); UI.toast('Pas d’achat pendant le défi : tout le monde a les mêmes bonus'); return; }
      if (s.coins >= B.cost) {
        s.coins -= B.cost; s.boosters[id] = 1;
        if (!sh.useBooster(id)) { UI.toast('Bonus acheté !'); Scene.refreshBoosters(); }
        else UI.toast(B.name + ' acheté et utilisé !');
      } else { Sfx.play('nope'); UI.toast(B.name + ' : ' + B.cost + ' pièces dans la boutique'); }
      return;
    }
    if (!sh.useBooster(id)) { Sfx.play('nope'); UI.toast(id === 'coeur' ? 'Personne à calmer pour l\'instant' : 'Déjà actif !'); }
  }

  function onShiftEnd(e) {
    if (ended) return;
    ended = true;
    var cur = sh;
    Fps.stop(true);
    if (cur.challenge) {
      var dres = Daily.onDefiEnd(cur);
      UI.banner('DÉFI TERMINÉ !', null, 1100, function () {
        Club.defiResults(cur, dres, function (action) {
          if (action === 'retry') startDefi();
          else { toHub(); if (action === 'board') Club.leaderboard('defi'); }
        });
      });
      return;
    }
    var res = Progress.applyResult(App.save, cur);
    Daily.onDayEnd(cur, res);
    Store.save(App.save);
    Online.submit();
    UI.banner(e.win || cur.relax ? 'FERMETURE !' : (cur.endReason === 'hearts' ? 'OH NON !' : 'TEMPS ÉCOULÉ !'), null, 1100, function () {
      Sfx.play(e.win ? 'win' : cur.relax ? 'soft' : 'lose');
      UI.results(cur, res, function (action) {
        var ups = res.levelUps.slice();
        UI.chainLevelUps(ups, function () {
          Scene.refreshHud();
          // a story chapter the first time this day is won, then maybe a break reminder
          Story.afterDay(cur.day, cur.win && res.unlockedNext, function () {
            maybeBreak(function () {
              if (action === 'retry') startDay(cur.day, { sim: cur.manual });
              else if (action === 'next') startDay(Math.min(App.save.unlocked, cur.day + 1), { sim: cur.manual });
              else if (action === 'shop') { toHub(); UI.shop('station'); }
              else toHub();
            });
          });
        });
      });
    });
  }

  function onPurchase(kind, id) {
    if (sh) Scene.refreshBoosters();
    UI.refreshTop();
  }

  return { enterHub: enterHub, toTitle: toTitle, toHub: toHub, startDay: startDay, pause: pause, quitShift: quitShift, update: update, syncScreens: syncScreens,
    useBooster: useBooster, onShiftEnd: onShiftEnd, onPurchase: onPurchase, isPaused: isPaused, shift: function () { return sh; },
    visit: visit, simWanted: simWanted, startDefi: startDefi };
})();
