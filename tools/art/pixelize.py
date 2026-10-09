#!/usr/bin/env python3
"""Post-traitement « illustration 2D / pixel » d'un rendu 3D.
Entrée : <base>_color.png, <base>_normal.png, <base>_depth.png (rendus à ss x la taille dessinée).
Étapes : réduction (moyenne) à la taille dessinée, saturation, quantification de palette avec léger
tramage ordonné, contours (silhouette 1 px + traits intérieurs assombris), agrandissement au plus proche voisin.
Usage : pixelize.py base sortie largeur hauteur div [--colors N] [--dither D] [--edge E] [--quality Q]
"""
import sys, argparse
import numpy as np
from PIL import Image, ImageEnhance

ap = argparse.ArgumentParser()
ap.add_argument('base'); ap.add_argument('out'); ap.add_argument('w', type=int); ap.add_argument('h', type=int); ap.add_argument('div', type=float)
ap.add_argument('--colors', type=int, default=48); ap.add_argument('--dither', type=float, default=0.35)
ap.add_argument('--edge', type=float, default=1.0); ap.add_argument('--quality', type=int, default=92); ap.add_argument('--sat', type=float, default=1.12)
a = ap.parse_args()

aw, ah = round(a.w / a.div), round(a.h / a.div)
col = Image.open(a.base + '_color.png').convert('RGBA')
nrm = Image.open(a.base + '_normal.png').convert('RGBA')
dep = Image.open(a.base + '_depth.png').convert('RGBA')

def down(im):
    return im.resize((aw, ah), Image.BOX)

# couleurs prémultipliées pour une réduction correcte de l'alpha
c = np.asarray(col, dtype=np.float64) / 255
c[..., :3] *= c[..., 3:4]
c = np.asarray(Image.fromarray((c * 255).astype(np.uint8)).resize((aw, ah), Image.BOX), dtype=np.float64) / 255
alpha = c[..., 3]
rgb = np.where(alpha[..., None] > 0.01, c[..., :3] / np.maximum(alpha[..., None], 1e-3), 0)
transparent = col.getextrema()[3][0] < 250
mask = alpha > 0.45 if transparent else np.ones((ah, aw), bool)

img = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
img = ImageEnhance.Color(img).enhance(a.sat)
img = ImageEnhance.Contrast(img).enhance(1.06)
rgb = np.asarray(img, dtype=np.float64)

# tramage ordonné léger (Bayer 4x4)
bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 - 0.5
bt = np.tile(bayer, (ah // 4 + 1, aw // 4 + 1))[:ah, :aw]
rgb = np.clip(rgb + bt[..., None] * 255 / max(8, a.colors / 2) * a.dither * 2, 0, 255)

q = Image.fromarray(rgb.astype(np.uint8))
sample = q if not transparent else Image.fromarray(rgb[mask][None, :, :].astype(np.uint8)) if mask.any() else q
pal = sample.quantize(colors=a.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
qi = q.quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB')
out = np.asarray(qi, dtype=np.float64)

# contours intérieurs : discontinuités de normale / profondeur
if a.edge > 0:
    n = np.asarray(down(nrm), dtype=np.float64)[..., :3] / 255 * 2 - 1
    na = np.asarray(down(nrm), dtype=np.float64)[..., 3] / 255
    d8 = np.asarray(dep.resize((aw, ah), Image.NEAREST), dtype=np.float64)
    d = d8[..., 0] / 255 + d8[..., 1] / 255 / 255
    dA = d8[..., 3] / 255
    e = np.zeros((ah, aw), bool)
    for dy, dx in ((0, 1), (1, 0)):
        n2 = np.roll(np.roll(n, -dy, 0), -dx, 1); d2 = np.roll(np.roll(d, -dy, 0), -dx, 1); a2 = np.roll(np.roll(dA, -dy, 0), -dx, 1)
        nd = np.linalg.norm(n - n2, axis=2)
        dd = d2 - d  # >0 : le voisin est plus loin -> ce pixel est le bord avant
        ee = ((nd > 0.75) & (dA > 0.5) & (a2 > 0.5)) | ((dd > 0.012) & (dA > 0.5)) | ((dA > 0.5) & (a2 < 0.5))
        ee2 = ((-dd > 0.012) & (a2 > 0.5)) | ((a2 > 0.5) & (dA < 0.5))
        e |= ee
        e |= np.roll(np.roll(ee2, dy, 0), dx, 1) & False
        # bord du voisin quand c'est lui qui est devant
        back = np.roll(np.roll(ee2, dy, 0), dx, 1)
        e |= back
    e[-1, :] = False; e[:, -1] = False
    if transparent:
        e &= mask
    k = 0.5 * min(1.0, a.edge)
    out[e] = out[e] * (1 - k) * np.array([0.92, 0.88, 0.95])

res = np.dstack([out, np.full((ah, aw), 255.0)])
if transparent:
    res[..., 3] = mask * 255
    # silhouette extérieure 1 px sombre
    m = mask
    grow = np.zeros_like(m)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        grow |= np.roll(np.roll(m, dy, 0), dx, 1)
    ring = grow & ~m
    # couleur du contour : voisin le plus proche assombri fortement
    near = np.zeros((ah, aw, 3))
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sh = np.roll(np.roll(out, dy, 0), dx, 1); mm = np.roll(np.roll(m, dy, 0), dx, 1)
        near = np.where((mm & (near.sum(2) == 0))[..., None], sh, near)
    res[ring, :3] = near[ring] * 0.22 + np.array([14, 10, 8]) * 0.78
    res[ring, 3] = 255

im = Image.fromarray(res.astype(np.uint8), 'RGBA')
k = int(round(a.div))
big = im.resize((aw * k, ah * k), Image.NEAREST)
if big.size != (a.w, a.h):
    canvas = Image.new('RGBA', (a.w, a.h), (0, 0, 0, 0 if transparent else 255))
    canvas.paste(big, ((a.w - big.size[0]) // 2, (a.h - big.size[1]) // 2))
    big = canvas
if a.out.endswith('.png'):
    if transparent:
        big.save(a.out, optimize=True)
    else:
        big.convert('RGB').save(a.out, optimize=True)
else:
    big.convert('RGB').save(a.out, quality=a.quality, subsampling=0, optimize=True)
