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
| portraits (rendu peint, voir plus bas) | 1024×1280 | 512×640 |
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

- `render.mjs` : serveur statique local + Chromium headless. Il exécute chaque « job » puis appelle `pixelize.py` (ou `paint.py` pour les portraits).
- `web/lib.js` : moteur de rendu, bruit, matériaux PBR, outils de géométrie (loft, sweep, lathe), ciel, capture et passes de contours.
- `web/models.js` : armes, boucliers (peinture usée, emblèmes dessinés : soleil, étoile à huit branches, corbeau, lion), casques, cottes, bottes, bagues.
- `web/people.js` : têtes, barbes et silhouettes complètes des scènes.
- `web/human.js`, `web/hair.js`, `web/gear.js`, `web/portraits.js`, `paint.py`, `mh_import.py`, `portraits_sheet.py`, `assets/mh/` : portraits réalistes (section suivante).
- `web/items.js` : objets et écus. `web/scenes.js` : fonds, ennemis, travaux, actions.
- `pixelize.py` : style illustré. `map.py` : carte. `textures.py` : textures. `logo.py` : logo et icônes. `preview.mjs` : planche contact.
- `tex/` et `.tmp/` : fichiers intermédiaires régénérés à chaque lancement.

## Portraits réalistes (`portraits/*.jpg`)

Les 12 portraits (buste de trois quarts, 512×640) ne sont plus des têtes en primitives : ils partent d'un **vrai maillage humain**.

1. **Maillage de base MakeHuman (CC0)** : `mh_import.py` lit le maillage « hm08 » de MakeHuman, ~140 cibles de morphose
   (sexe, âge, origine, musculature, corpulence, nez, menton, bouche, yeux, joues, front, cou…) et les yeux « high-poly »
   avec leur texture d'iris. Il n'en garde que le haut du corps et écrit une version compacte dans `assets/mh/`
   (`mh.bin` ≈ 1,8 Mo, `mh.json`, `eye.jpg`). Ces fichiers sont versionnés : pas besoin de réseau pour rendre.
   Pour les régénérer : `python3 tools/art/mh_import.py` (télécharge depuis GitHub, commit figé) ou
   `python3 tools/art/mh_import.py chemin/vers/makehuman/makehuman/data`.
2. **`web/human.js`** : morphose (mélange des cibles comme MakeHuman), bras abaissés, rotation de la tête, régions du
   visage (lèvres, joues, orbites, zone de barbe, sourcils, cuir chevelu) définies sur la topologie, peau peinte par
   sommet (teint, rougeurs, lèvres, barbe naissante, taches de rousseur, hâle, cicatrice), occlusion par courbure,
   éclairage « wrap » imitant la diffusion sous la peau, rugosité variable (zone T brillante), yeux avec cornée.
3. **`web/hair.js`** : poils et cheveux en dizaines de milliers de mèches (lignes) qui poussent depuis la peau, évitent
   le visage, se regroupent en touffes ; ombrage Kajiya-Kay avec les ombres portées de la scène. Barbes, sourcils,
   cils, chevelures, tresses, fourrures.
4. **`web/gear.js`** : l'équipement est **ajusté au corps** : coiffes de mailles, cottes, surcots, gambisons, kaftans,
   lamelles, foulards, capes et mantelets sont des coques tirées de la topologie du corps (décalées, lissées, bords
   ourlés) ; mailles et tissus en projection triplanaire. Casques mesurés sur le crâne (conique à nasal, bulbe
   enturbanné à pointe, calotte à lunettes), turban, broches à emblème (soleil, étoile à huit branches, corbeau).
5. **`web/portraits.js`** : les 12 fiches (visage, peau, yeux, pilosité, équipement, pose), éclairage trois points
   (clé chaude ou froide selon la faction, contre-jour, débouchage) et environnement de reflets dédié.
6. **`paint.py`** : rendu 1024×1280 → filtre de Kuwahara **anisotrope** (touches qui suivent les formes), réduction à
   512×640, traits de contour fins et chauds, palette légèrement resserrée, grain de toile. numpy + Pillow seulement.

```sh
node tools/art/render.mjs portraits/        # les 12 portraits (≈ 6 à 8 min) ; ou portraits/givre-3
node tools/art/render.mjs _close/aube-2     # gros plan brut de contrôle dans tools/art/.tmp/
python3 tools/art/portraits_sheet.py planche.png 1600   # planche contact des 12 portraits
```

### Ressource tierce

- **MakeHuman** — maillage de base hm08, cibles de morphose, yeux high-poly et texture `brown_eye.png`.
  Source : <https://github.com/makehumancommunity/makehuman> (commit `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`,
  dossier `makehuman/data/`). Licence des ressources : **CC0 1.0 Universal** (voir `LICENSE.md` du dépôt : « The base
  mesh and proxies, targets and modifiers, textures… have been released under CC0 1.0 Universal ») ; aucune
  attribution requise, mention conservée par courtoisie. Le code AGPL de MakeHuman n'est **pas** utilisé.

Les factions sont fictives : aucun symbole religieux réel (ni croix, ni croissant, ni marteau de Thor).
