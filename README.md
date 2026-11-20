# Cuistot Tycoon

Jeu de gestion de restaurant : tu incarnes **Chef Marcel**, qui ouvre « Chez Cuistot » au bord de la jungle, puis d'autres restaurants sur la plage, à la montagne et en ville.

- 2 saisons d'histoire (26 chapitres) et 36 histoires d'habitués
- 4 restaurants avec leurs spécialités, sur la carte de l'île
- Mode Détente (sans stress) ou Classique
- **Version PC grand écran** (1.4) : le restaurant est une scène 3D qui prend tout l'écran, avec menu, boutique, carte et histoires en grand format
- Sur téléphone : mise en page portrait, avec le comptoir en 3D

## Télécharger

- **Android** : [CuistotTycoon.apk](download/CuistotTycoon.apk)
- **Windows** : [CuistotTycoon.exe](download/CuistotTycoon.exe)

## Clavier (PC)

| Touche | Action |
| --- | --- |
| `1` à `8` | cuisiner sur la station (ou ouvrir sa fiche dans la cuisine) |
| `A` `Z` `E` `R` | utiliser les bonus |
| `Espace` ou `P` | pause |
| `Entrée` | jouer / ouvrir le restaurant / ligne suivante d'une histoire |
| `B` `C` `N` `M` | boutique, carnet, niveaux, carte |
| `Échap` | retour |
| `F11` | plein écran |

## Mises à jour

Le jeu installé regarde tout seul s'il existe une nouvelle version (fichier `update/version.json`) et propose de se mettre à jour, sans réinstaller l'application. La partie est gardée.

- **Version 1.3** : la vérification se fait au lancement du jeu (ou avec le bouton « Mises à jour » des paramètres).
- **Depuis la version 1.4** : en plus, le jeu vérifie toutes les 2 minutes pendant qu'il est ouvert, et quand sa fenêtre revient au premier plan. Il n'y a plus besoin de le fermer.
- GitHub peut mettre jusqu'à 5 minutes environ à servir un fichier qui vient d'être publié.
- La proposition n'apparaît qu'à l'écran titre ou dans la cuisine, jamais pendant une journée ou une histoire.

## Pour les développeurs

Le code est dans `source/`. La marche à suivre pour publier une version est dans `CLAUDE.md`.
