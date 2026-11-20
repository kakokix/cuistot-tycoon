# Cuistot Tycoon : notes pour travailler sur le jeu

L'utilisateur écrit en français et on le tutoie. Le jeu est en français.

## Ce que contient le dépôt

- `source/` : le code du jeu (HTML/CSS/JS sans framework) et les outils.
  - `src/js/` : `data.js` (équilibrage, lieux, succès), `sim.js` (simulation d'une journée, sans DOM), `progress.js`, `scene.js` (affichage du restaurant), `view3d.js` (vue 3D three.js), `ui.js` (fenêtres), `story.js` (histoire, carnet), `world.js` (carte de l'île), `achievements.js`, `updater.js` (mises à jour), `game.js`, `main.js`.
  - `src/version.json` : **numéro de version**. `build` est un entier qui doit augmenter à chaque publication.
  - `tools/build.py` : construit `dist/index.html` (web, Android), `dist/desktop/index.html` (Windows) et `dist/update/` (fichiers de mise à jour).
  - `android/` : appli Android (WebView + pont Java). `desktop/` : appli Windows/Linux (Neutralino).
- `update/` : canal de mises à jour lu par les jeux installés (`version.json`, `game.html`, `desktop.html`).
- `download/` : APK et EXE à jour. `index.html` : version web.

Les images du pack d'interface (CraftPix) ne sont publiées que dans le jeu construit. `setup.sh` les récupère depuis `update/game.html` : ne jamais les ajouter au dépôt comme fichiers séparés.

## Deux mises en page

- **Portrait** (téléphones, fenêtres étroites) : colonne de 720 px de large, stations en tuiles HTML, comptoir en 3D si `save.view3d`.
- **Grand écran** (PC, fenêtre plus large que haute ×1,3 ; `App.wide`) : la scène 3D prend tout l'écran (`App.W` × 1200), les stations sont des objets 3D sur le plan de travail et le HTML (étiquettes, bulles, HUD) suit la 3D (`View3D.metrics()`, `Scene.layoutWide`, `Scene.placeHud`). Elle a besoin de la 3D : sans WebGL ou avec « Vue 3D » coupée, le jeu reste en portrait.
- Les règles CSS du grand écran sont à la fin de `style.css` (`.wide ...`). Les fenêtres (`UI.modal`) font 720 px par défaut, `opts.w` pour plus large (boutique, carnet).
- Toute nouveauté doit marcher dans les deux mises en page.

## Préparer l'environnement

```sh
cd source && sh setup.sh
```

## Publier une nouvelle version (mise à jour automatique)

1. Modifier `source/src/...`.
2. Dans `source/src/version.json` : augmenter `build` de 1, changer `version` et `label`, écrire les `notes` (nouveautés, en français, 6 lignes au plus).
3. `cd source && python3 tools/build.py`, puis tester les deux mises en page (aucune erreur attendue) :
   - portrait : `python3 tools/stress.py file://$PWD/dist/index.html /tmp/s.png detente`
   - grand écran : `python3 tools/stress.py file://$PWD/dist/index.html /tmp/w.png detente 1600 900 6`
4. Copier `source/dist/update/*` dans `update/` et `source/dist/index.html` dans `index.html`.
5. `git add -A && git commit && git push`. Les jeux installés (Android et Windows, version 1.3 ou plus) proposent la mise à jour : la 1.3 à son prochain lancement, la 1.4 et les suivantes toutes seules (vérification toutes les 2 minutes pendant que le jeu est ouvert). GitHub met jusqu'à 5 minutes à servir les nouveaux fichiers.

Si le code natif change (`android/src/...MainActivity.java` ou les permissions Neutralino), il faut aussi reconstruire l'APK/EXE, les mettre dans `download/` et augmenter `minNative` dans `tools/build.py` (Android : `NATIVE_LEVEL` dans MainActivity.java). L'APK doit être signé avec la même clé que les versions précédentes (la clé n'est pas dans le dépôt).

- APK : `GAME=$PWD KEYSTORE=... KS_PASS=... sh android/build_apk.sh` (paquets Ubuntu : aapt, apksigner, zipalign, dalvik-exchange, android-sdk-platform-23).
- EXE : `sh desktop/build_desktop.sh`.

## Règles de fonctionnement

- Mode Détente par défaut : personne ne part fâché, les plats prêts sont servis tout seuls.
- La sauvegarde garde toutes les clés inconnues (`Store.load`) : ne jamais supprimer de données des joueurs.
- La mise à jour n'est proposée qu'au titre ou en cuisine, jamais pendant une journée ou une histoire.
