#!/usr/bin/env python3
"""Importe le maillage humain de MakeHuman (CC0) pour les portraits.

Télécharge (ou lit depuis un dépôt MakeHuman local) le maillage de base « hm08 », une sélection de
cibles de morphose (âge, sexe, origine, musculature, traits du visage) et les yeux « high-poly »,
puis écrit une version compacte, limitée au haut du corps, dans tools/art/assets/mh/ :
  mh.json  : métadonnées (nombre de sommets, liste des cibles, échelles, ajustement des yeux)
  mh.bin   : positions, UV, triangles, puis cibles creuses (indices + deltas int16)
  eye.jpg  : texture d'iris réduite
Source : https://github.com/makehumancommunity/makehuman (assets CC0 1.0, voir LICENSE.md du dépôt).
Usage : python3 tools/art/mh_import.py [chemin/vers/makehuman/makehuman/data]
"""
import io, json, os, struct, sys, urllib.request
import numpy as np
from PIL import Image

COMMIT = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
RAW = f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{COMMIT}/makehuman/data/'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'assets', 'mh')
CACHE = os.path.join(HERE, '.tmp', 'mh-cache')
LOCAL = sys.argv[1] if len(sys.argv) > 1 else None
Y_CUT = 2.4  # décimètres (unités MakeHuman) : on garde le buste et la tête

MACRO = [f'macrodetails/{r}-{g}-{a}' for r in ('african', 'asian', 'caucasian') for g in ('male', 'female') for a in ('young', 'old')]
MACRO += [f'macrodetails/universal-{g}-{a}-{m}' for g in ('male', 'female') for a in ('young', 'old')
          for m in ('maxmuscle-averageweight', 'minmuscle-averageweight', 'averagemuscle-maxweight', 'averagemuscle-minweight')]
FACE = '''nose/nose-hump-incr nose/nose-hump-decr nose/nose-scale-horiz-incr nose/nose-scale-horiz-decr nose/nose-scale-vert-incr
nose/nose-scale-vert-decr nose/nose-point-width-incr nose/nose-flaring-incr nose/nose-flaring-decr nose/nose-greek-incr nose/nose-trans-down
nose/nose-volume-incr nose/nose-volume-decr nose/nose-curve-convex nose/nose-point-up nose/nose-point-down nose/nose-width1-decr nose/nose-width2-decr
chin/chin-width-incr chin/chin-width-decr chin/chin-prominent-incr chin/chin-prominent-decr chin/chin-height-incr chin/chin-height-decr
chin/chin-bones-incr chin/chin-bones-decr chin/chin-cleft-incr chin/chin-jaw-drop-incr chin/chin-prognathism-incr
head/head-square head/head-oval head/head-round head/head-rectangular head/head-triangular head/head-invertedtriangular head/head-diamond
head/head-age-incr head/head-age-decr head/head-fat-incr head/head-fat-decr head/head-scale-horiz-incr head/head-scale-horiz-decr
head/head-scale-vert-incr head/head-scale-vert-decr
mouth/mouth-scale-horiz-incr mouth/mouth-scale-horiz-decr mouth/mouth-lowerlip-volume-incr mouth/mouth-lowerlip-volume-decr
mouth/mouth-upperlip-volume-incr mouth/mouth-upperlip-volume-decr mouth/mouth-angles-down mouth/mouth-angles-up mouth/mouth-cupidsbow-incr
mouth/mouth-laugh-lines-in mouth/mouth-dimples-in mouth/mouth-trans-forward mouth/mouth-trans-backward
eyebrows/eyebrows-trans-down eyebrows/eyebrows-trans-up eyebrows/eyebrows-trans-forward eyebrows/eyebrows-angle-down eyebrows/eyebrows-angle-up
forehead/forehead-trans-forward forehead/forehead-trans-backward forehead/forehead-temple-decr forehead/forehead-nubian-incr
neck/neck-scale-horiz-incr neck/neck-scale-horiz-decr neck/neck-scale-depth-incr neck/neck-double-incr
torso/torso-scale-horiz-incr torso/torso-vshape-incr torso/torso-muscle-pectoral-incr torso/torso-muscle-dorsi-incr'''.split()
for s in ('l', 'r'):
    FACE += [f'cheek/{s}-cheek-bones-incr', f'cheek/{s}-cheek-bones-decr', f'cheek/{s}-cheek-inner-incr', f'cheek/{s}-cheek-volume-incr', f'cheek/{s}-cheek-volume-decr',
             f'eyes/{s}-eye-height2-decr', f'eyes/{s}-eye-height2-incr', f'eyes/{s}-eye-scale-incr', f'eyes/{s}-eye-scale-decr', f'eyes/{s}-eye-bag-incr',
             f'eyes/{s}-eye-epicanthus-in', f'eyes/{s}-eye-epicanthus-out', f'eyes/{s}-eye-eyefold-angle-up', f'eyes/{s}-eye-eyefold-down',
             f'eyes/{s}-eye-push1-in', f'eyes/{s}-eye-trans-down', f'eyes/{s}-eye-corner1-up', f'eyes/{s}-eye-corner2-up', f'eyes/{s}-eye-height1-decr']


def fetch(rel, binary=False):
    if LOCAL:
        p = os.path.join(LOCAL, rel)
        if not os.path.exists(p):
            return None
        return open(p, 'rb').read() if binary else open(p, encoding='utf-8').read()
    c = os.path.join(CACHE, rel)
    if not os.path.exists(c):
        os.makedirs(os.path.dirname(c), exist_ok=True)
        try:
            data = urllib.request.urlopen(RAW + rel, timeout=60).read()
        except Exception as e:  # cible absente : ignorée
            print('  absent :', rel, e)
            return None
        open(c, 'wb').write(data)
    d = open(c, 'rb').read()
    return d if binary else d.decode('utf-8')


def main():
    os.makedirs(OUT, exist_ok=True)
    # ---- maillage de base
    V, VT, F, groups, cur = [], [], [], {}, None
    for l in fetch('3dobjs/base.obj').splitlines():
        if l.startswith('v '):
            V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('vt '):
            VT.append([float(x) for x in l.split()[1:3]])
        elif l.startswith('g '):
            cur = l.split()[1]
        elif l.startswith('f '):
            F.append((cur, [tuple(int(x) - 1 for x in t.split('/')[:2]) for t in l.split()[1:]]))
    V = np.array(V, np.float64); VT = np.array(VT, np.float64)
    # ---- yeux (proxy ajusté sur le maillage de base)
    mhclo = fetch('eyes/high-poly/high-poly.mhclo').splitlines()
    scales, refs, inv = {}, [], False
    for l in mhclo:
        t = l.split()
        if not t or t[0].startswith('#'):
            continue
        if t[0] in ('x_scale', 'y_scale', 'z_scale'):
            scales[t[0][0]] = [int(t[1]), int(t[2]), float(t[3])]
        elif t[0] == 'verts':
            inv = True
        elif inv and len(t) == 9:
            refs.append([int(t[0]), int(t[1]), int(t[2])] + [float(x) for x in t[3:]])
        elif inv and len(t) == 1:
            refs.append([int(t[0]), int(t[0]), int(t[0]), 1, 0, 0, 0, 0, 0])
    EV, EVT, EF = [], [], []
    for l in fetch('eyes/high-poly/high-poly.obj').splitlines():
        if l.startswith('v '):
            EV.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('vt '):
            EVT.append([float(x) for x in l.split()[1:3]])
        elif l.startswith('f '):
            EF.append([tuple(int(x) - 1 for x in t.split('/')[:2]) for t in l.split()[1:]])
    need = set()
    for r in refs:
        need.update(r[:3])
    for s in scales.values():
        need.update(s[:2])

    # ---- sommets conservés : corps au-dessus de Y_CUT + sommets d'appui des yeux
    body = [f for g, f in F if g == 'body']
    keepf = [f for f in body if max(V[v][1] for v, _ in f) > Y_CUT]
    keep = sorted(set(v for f in keepf for v, _ in f) | need)
    remap = {v: i for i, v in enumerate(keep)}
    # sommets dédoublés par UV (coutures)
    vkey, pos, uv, idx, src = {}, [], [], [], []
    for f in keepf:
        ids = []
        for v, t in f:
            k = (v, t)
            if k not in vkey:
                vkey[k] = len(pos); pos.append(V[v]); uv.append(VT[t]); src.append(remap[v])
            ids.append(vkey[k])
        idx += [ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]]
    nk = len(keep)
    # ---- cibles
    tdata, tmeta = [], []
    for name in MACRO + FACE:
        txt = fetch(f'targets/{name}.target')
        if txt is None:
            continue
        ii, dd = [], []
        for l in txt.splitlines():
            t = l.split()
            if len(t) == 4 and not l.startswith('#'):
                v = int(t[0])
                if v in remap:
                    ii.append(remap[v]); dd.append([float(x) for x in t[1:]])
        if not ii:
            tmeta.append({'name': name.split('/')[-1], 'n': 0, 'scale': 0}); continue
        dd = np.array(dd) * 0.1  # décimètres -> mètres
        sc = max(np.abs(dd).max() / 32000, 1e-9)
        tdata.append(np.array(ii, np.uint16).tobytes() + np.round(dd / sc).astype(np.int16).tobytes())
        tmeta.append({'name': name.split('/')[-1], 'n': len(ii), 'scale': sc})
    base = (V[keep] * 0.1).astype(np.float32)
    eref = [[remap[r[0]], remap[r[1]], remap[r[2]]] + r[3:] for r in refs]
    eyes = {
        'refs': eref, 'scales': {k: [remap[a], remap[b], c * 0.1] for k, (a, b, c) in scales.items()},
        'uv': None,
    }
    # yeux : sommets dédoublés par UV
    ek, epos_src, euv, eidx, cidx = {}, [], [], [], []
    for f in EF:
        ids = []
        for v, t in f:
            if (v, t) not in ek:
                ek[(v, t)] = len(epos_src); epos_src.append(v); euv.append(EVT[t])
            ids.append(ek[(v, t)])
        tgt = cidx if all(EVT[t][0] > 0.84 and EVT[t][1] < 0.16 for _, t in f) else eidx  # cornée transparente
        for k in range(1, len(ids) - 1):
            tgt += [ids[0], ids[k], ids[k + 1]]
    blob = io.BytesIO()
    parts = {}

    def put(name, arr):
        while blob.tell() % 4:
            blob.write(b'\0')
        parts[name] = [blob.tell(), arr.size, str(arr.dtype)]
        blob.write(arr.tobytes())
    put('base', base.ravel())
    put('src', np.array(src, np.uint16))
    put('uv', np.array(uv, np.float32).ravel())
    put('index', np.array(idx, np.uint32))
    put('eyeSrc', np.array(epos_src, np.uint16))
    put('eyeUv', np.array(euv, np.float32).ravel())
    put('eyeIndex', np.array(eidx, np.uint32))
    put('corneaIndex', np.array(cidx, np.uint32))
    for m, d in zip([m for m in tmeta if m['n']], tdata):
        while blob.tell() % 4:
            blob.write(b'\0')
        m['offset'] = blob.tell(); blob.write(d)
    open(os.path.join(OUT, 'mh.bin'), 'wb').write(blob.getvalue())
    json.dump({'source': RAW, 'license': 'CC0 1.0 (MakeHuman assets)', 'nBase': nk, 'nVerts': len(pos), 'parts': parts,
               'targets': tmeta, 'eyes': eyes}, open(os.path.join(OUT, 'mh.json'), 'w'), separators=(',', ':'))
    im = Image.open(io.BytesIO(fetch('eyes/materials/brown_eye.png', True))).convert('RGB').resize((512, 512), Image.LANCZOS)
    im.save(os.path.join(OUT, 'eye.jpg'), quality=90)
    print(f'{nk} sommets de base, {len(pos)} sommets rendus, {len(idx) // 3} triangles, {len(tdata)} cibles, '
          f'{os.path.getsize(os.path.join(OUT, "mh.bin")) / 1e6:.2f} Mo')


main()
