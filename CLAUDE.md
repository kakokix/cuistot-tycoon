# Cuistot Tycoon : notes pour travailler sur le jeu

L'utilisateur écrit en français et on le tutoie. Le jeu est en français.

## Ce que contient le dépôt

- `source/` : le code du jeu (HTML/CSS/JS sans framework) et les outils.
  - `src/js/` : `data.js` (équilibrage, lieux, succès), `sim.js` (simulation d'une journée, sans DOM ; contient aussi les gestes du simulateur), `progress.js`, `scene.js` (affichage du restaurant), `models.js` (modèles 3D des stations, des objets et des plats), `view3d.js` (vue 3D three.js), `fps.js` (mode Simulateur à la première personne), `ui.js` (fenêtres), `story.js` (histoire, carnet), `world.js` (carte de l'île), `achievements.js`, `updater.js` (mises à jour), `club.js` (Club des chefs : profil, classement mondial, codes, cadeau du jour, missions, défi du jour, statistiques, prestige), `game.js`, `main.js`.
  - `src/version.json` : **numéro de version**. `build` est un entier qui doit augmenter à chaque publication.
  - `tools/build.py` : construit `dist/index.html` (web, Android), `dist/desktop/index.html` (Windows) et `dist/update/` (fichiers de mise à jour).
  - `tools/kpack.py` : convertit le pack 3D « Kitchen & Diner 3D » en `build/kmodels.json` (voir plus bas).
  - `vendor/three_entry.js` : liste des classes three.js mises dans le jeu (en ajouter une ici si le code en utilise une nouvelle, puis relancer `setup.sh`).
  - `android/` : appli Android (WebView + pont Java). `desktop/` : appli Windows/Linux (Neutralino).
- `update/` : canal de mises à jour lu par les jeux installés (`version.json`, `game.html`, `desktop.html`).
- `download/` : APK et EXE à jour. `index.html` : version web.

Les images du pack d'interface (CraftPix) ne sont publiées que dans le jeu construit. `setup.sh` les récupère depuis `update/game.html` : ne jamais les ajouter au dépôt comme fichiers séparés.

Même règle pour le pack 3D **« Kitchen & Diner 3D » de Harning** (meubles, vaisselle, plats) : sa licence interdit de redistribuer ses fichiers. Les `.glb` ne vont **jamais** dans le dépôt. `tools/kpack.py <dossier du pack>` les convertit en données compactes (`build/kmodels.json`, dossier ignoré par git) que `build.py` met dans le jeu (`KMODELS`) ; `setup.sh` récupère ce fichier depuis `update/game.html` quand on n'a pas le pack. Sans ce fichier le jeu fonctionne quand même (formes simples à la place).

## Deux mises en page

- **Portrait** (téléphones, fenêtres étroites) : colonne de 720 px de large, stations en tuiles HTML, comptoir en 3D si `save.view3d`.
- **Grand écran** (PC, fenêtre plus large que haute ×1,3 ; `App.wide`) : la scène 3D prend tout l'écran (`App.W` × 1200), les stations sont des objets 3D sur le plan de travail et le HTML (étiquettes, bulles, HUD) suit la 3D (`View3D.metrics()`, `Scene.layoutWide`, `Scene.placeHud`). Elle a besoin de la 3D : sans WebGL ou avec « Vue 3D » coupée, le jeu reste en portrait.
- Les règles CSS du grand écran sont à la fin de `style.css` (`.wide ...`). Les fenêtres (`UI.modal`) font 720 px par défaut, `opts.w` pour plus large (boutique, carnet).
- Toute nouveauté doit marcher dans les deux mises en page.

## Mode Simulateur (première personne)

- Bouton « Vue gérant / Vue simulateur » dans la cuisine (touche `V`). La journée est la même simulation (`Shift` avec `opts.manual`), mais tout se fait à la main, comme dans un vrai fast-food :
  - le client arrive dans l'état `ask` : viser le client ouvre la **caisse** (`openPos` dans fps.js). Il dit sa commande en mots (`GD.SAY`), le joueur la tape (touches 1 à 8 ou boutons) et encaisse. `takeOrder(c, by, tipK)` fait payer le prix tout de suite (`c.paid0`) ; le pourboire arrive à la remise du dernier plat (`pay`). Paiement en espèces (`GD.SIM.cash`) : il faut choisir la bonne monnaie parmi trois (`tipK` = bonus ou malus sur le pourboire). Mauvaise commande = `posError` (le client répète, un peu moins patient). Le temps continue pendant qu'on est à la caisse ;
  - un client qui a payé et n'est pas servi est **remboursé** (`refund` : il part fâché en Classique, ou la journée se termine) : l'argent ne compte donc que si la commande est servie, comme en vue gérant. En Détente, la fermeture laisse `GD.SIM.close` secondes pour servir ceux qui ont payé ;
  - chaque station a ses gestes, décrits dans `GD.HANDS` (data.js) : `start` (utilise une portion du stock), `mid` (geste à mi-cuisson : la cuisson attend), `fin` (gestes de finition ; un « + » devant = pose un plat sur le passe), `burn` (brûle en Classique si on l'oublie sur le feu) ;
  - ce qui cuit est une « unité » dans `st.cooking` (`ph` : `cook`, `mid`, `done`, `fin`, `burnt`) : voir `unitsTick`, `midAct`, `finAct`, `trash` dans sim.js ;
  - stock par station (`st.stock`), réassort avec une caisse prise au frigo (`restock`) ; miettes sur le comptoir (`sh.dirt`, `wipe`) ; coup de feu en milieu de journée (`GD.SIM.rush`) ;
  - les aides font les mêmes gestes, un à la fois, à leur rythme (`staffHands`).
- Rythme et réglages dans `GD.SIM` (journées ×2,1, clients plus espacés et plus patients, taille du stock et du passe). L'objectif d'une journée en simulateur est calculé d'après la cuisine du joueur (`sh.potential` × `GD.SIM.goal`, 2 et 3 étoiles à `GD.SIM.stars` fois l'objectif), pas d'après l'objectif de la vue gérant. Repères mesurés au robot marcheur (part du potentiel) : joueur rapide 75 à 105 %, débutant 55 à 75 %, très lent 40 à 50 %.
- `Fps` (fps.js) : marche (touches physiques ZQSD/WASD/flèches, souris capturée ; sur téléphone : manette à gauche, glisser pour regarder, gros bouton d'action), visée (`pos`, `aim`), geste possible (`describe`), et `plan()` = la prochaine chose à faire (sert au conseil des premiers jours et aux robots de test).
- `View3D.setFps(true)` passe toute la cuisine en 3D sur n'importe quel écran (`View3D.isFull()`), ajoute la salle (`buildRoom`). Chaque modèle de station (`models.js`, `BUILD.<id>`) reçoit `s.h` = la station de la journée et montre l'état réel (steaks crus, cuits, brûlés, paniers, pizza, etc.) ; les plats prêts sont posés en 3D sur le passe (`syncPass`) ; les mains du joueur tiennent le plateau ou la caisse (`syncHands`, scène à part dessinée après la cuisine).
- En quittant la vue simulateur, `Scene.layoutPortrait` remet les tuiles des stations en place (en première personne, `View3D.syncDom` les met à l'échelle et cache celles qui sont derrière le joueur) : ne pas retirer cette remise à zéro (bug de la 2.0 : cuisine vide sur téléphone).
- Si la 3D tombe en panne pendant une journée, `Fps.abort()` rend la journée à la vue gérant (`Shift.toAuto`).
- Dans fps.js, l'état de la caisse s'appelle `reg` (et les classes CSS `.fps-reg`, `.reg-*`) : `pos` est déjà la fonction qui donne la position d'une cible.
- La cuisine est plus étroite sur un écran 16:9 que sur un téléphone (`halfLen()` dans fps.js dépend de `View3D.metrics().pitch`) : un robot de test doit rester dans les murs (`T._stand`), sinon il pousse contre le mur du frigo jusqu'à la fin de la journée et fausse les réglages.
- Bouton « visite » : se promener dans la cuisine sans clients (`Game.visit()`).
- Les robots jouent beaucoup de secondes de jeu d'un coup : le navigateur annonce alors la capture et la libération de la souris en retard, et le jeu croyait à un appui sur Échap (pause). Ils jouent donc sans capturer la souris (`T._nomouse`), et le jeu ne prend plus pour une pause une libération qu'il a demandée lui-même (`selfExit` dans fps.js).
- Dans un test Playwright, ne jamais lire ou écrire `localStorage` dans un `add_init_script` : la page reçoit parfois un stockage détaché et vide (la sauvegarde semble perdue, puis réapparaît). Écrire la sauvegarde depuis la page (`page.evaluate`), puis recharger.
- Tests : `T.prof(jour, mode, [serveur, commis])` (sauvegarde type d'un jour donné), `T.fpbot(s)` (robot rapide) et `T.fpwalk(s, adresse)` (robot qui marche vraiment : sert à régler les objectifs) dans `tools/testkit.js`. Après une journée en simulateur, **vérifier aussi la cuisine en portrait** (`Game.toHub()`) : les tests de charge ne jouent pas en simulateur.

## Club des chefs, classement mondial et codes

- Le serveur est une base Postgres (projet Lovable Cloud « Cuistot Tycoon ») : tables `lb_players`, `lb_codes`, `lb_redeems`, `lb_news`, toutes fermées (RLS sans règle). Le jeu n'appelle que trois fonctions : `lb_submit` (envoyer ses scores), `lb_top` (lire un classement : `fortune`, `etoiles`, `record`, `defi`) et `lb_redeem` (utiliser un code). L'adresse et la clé publique sont dans `club.js` (`Online`). La clé ne donne accès qu'à ces fonctions.
- Rien n'est envoyé tant que le joueur n'a pas choisi un pseudo et activé « Dans le classement ». Pas de compte : un identifiant et un secret aléatoires sont créés sur l'appareil (`save.profile`).
- **Ajouter un code cadeau en ligne** : une ligne dans `lb_codes` (`code` en majuscules sans espace, `coins`, `xp`, `turbo`, `coeur`, `temps`, `chance`, `gift`, `message`, `max_uses` (0 = illimité), `expires`, `active`). Les codes hors ligne sont dans `club.js` (table `LOCAL` de `Codes` : des empreintes, pas le texte ; `Codes.fp('MONCODE')` dans la console du jeu donne l'empreinte d'un nouveau code).
- **Défi du jour** : même cuisine et mêmes clients pour tous (`Daily.defiInfo`, tirage selon la date de Paris). Pendant le défi `App.save` est une sauvegarde temporaire et la vraie est dans `App.real` ; `Store.save` n'écrit jamais la temporaire. Utiliser `SV()` pour toucher à la vraie sauvegarde.
- Le classement ne fonctionne pas dans l'aperçu Claude (artifact) : les appels réseau y sont bloqués.

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
- Le prestige (toque d'or) remet la cuisine à zéro à la demande du joueur, après confirmation : ce qui est abandonné est gardé dans `save.prestigeBackup` et peut être repris (« Annuler le dernier »).
- `View3D.supported()` ne teste WebGL qu'une fois (chaque test crée un contexte) : ne pas remettre de test à chaque appel.
- Textures 3D : ne jamais donner à three.js un canvas dont la taille change ensuite. `texSvg` (plantes, tambours) ne donne son canvas à la texture qu'une fois l'image dessinée ; avant la 2.2, ces décors pouvaient rester invisibles toute la partie.
