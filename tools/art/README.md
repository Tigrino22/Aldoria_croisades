# Générateurs d'images — Aldoria Croisades

Toutes les images de `client/public/assets/` sont produites par des scripts : aucune image n'est copiée d'un autre jeu.
Le style visé est une **illustration 2D façon « 128 px »** : à mi-chemin entre le pixel art et le dessin peint, avec des contours sombres, un ombrage simple et une palette chaude et terreuse.

## Principe

1. **Modèles 3D procéduraux** (three.js, dans Chromium headless piloté par Playwright) : armes, boucliers, casques, armures, personnages, animaux, bâtiments et décors.
   Chaque image est rendue **petite**, à la « taille dessinée » × 3 pour l'anticrénelage. Le rendu produit aussi une passe de normales et une passe de profondeur.
2. **`pixelize.py`** transforme ce rendu en illustration :
   - réduction à la taille dessinée ;
   - palette limitée (32 à 64 couleurs) avec un léger tramage ordonné ;
   - contours : silhouette sombre de 1 px et traits intérieurs tirés des discontinuités de normale et de profondeur ;
   - agrandissement au plus proche voisin vers la taille finale.

| Groupe | Taille dessinée | Taille finale |
|---|---|---|
| objets `items/` | 128×128 | 256×256 (×2) |
| écus `factions/` | 128×128 | 512×512 (×4) |
| portraits | 128×160 | 512×640 (×4) |
| ennemis | 256×192 | 512×384 (×2) |
| travaux `jobs/` | 256×160 | 512×320 (×2) |
| actions | 400×225 | 800×450 (×2) |
| fonds `bg/` | 640×360 | 1920×1080 (×3) |
| carte | 800×600 | 1600×1200 (×2) ; `aldoria-small.jpg` = 800×600 |
| textures UI | 256×256 | 1024×1024 (×4, raccordables) |
| logo | 512×128 | 1024×256 (×2) |
| icônes PWA | 128 / 96 | 512 / 192 |

## Commandes (depuis la racine du dépôt)

```sh
cd tools/art && npm install && cd ../..   # une seule fois (three.js)
python3 tools/art/textures.py             # textures UI + bibliothèque tools/art/tex/ (à lancer avant le rendu 3D)
python3 tools/art/map.py                  # carte (relief fractal, érosion, biomes selon map-geometry.json)
node tools/art/render.mjs                 # tous les rendus 3D (environ 10 min) ; filtre possible :
node tools/art/render.mjs items/ portraits/givre-2 bg/title
python3 tools/art/logo.py                 # logo et icônes (nécessite factions/aube.png)
node tools/art/preview.mjs                # client/public/assets/preview.html + tools/art/preview.png
```

Prérequis :
- Node 22 et Playwright. Le script cherche Playwright localement, puis dans `/opt/node22/lib/node_modules`. Le navigateur Chromium utilisé est `/opt/pw-browsers/chromium-1194`, avec WebGL logiciel (SwiftShader).
- Python 3 avec numpy et Pillow.
- ImageMagick, uniquement pour `sheet.sh`, une petite planche de contrôle.

## Fichiers

- `render.mjs` : serveur statique local + Chromium headless. Il exécute chaque « job » puis appelle `pixelize.py`.
- `web/lib.js` : moteur de rendu, bruit, matériaux PBR, outils de géométrie (loft, sweep, lathe), ciel, capture et passes de contours.
- `web/models.js` : armes, boucliers (peinture usée, emblèmes dessinés : soleil, étoile à huit branches, corbeau, lion), casques, cottes, bottes, bagues.
- `web/people.js` : têtes, barbes, bustes des portraits, silhouettes complètes.
- `web/items.js` : objets et écus. `web/scenes.js` : fonds, ennemis, travaux, actions.
- `pixelize.py` : style illustré. `map.py` : carte. `textures.py` : textures. `logo.py` : logo et icônes. `preview.mjs` : planche contact.
- `tex/` et `.tmp/` : fichiers intermédiaires régénérés à chaque lancement.

Les factions sont fictives : aucun symbole religieux réel (ni croix, ni croissant, ni marteau de Thor).
