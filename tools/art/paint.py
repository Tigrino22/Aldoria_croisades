#!/usr/bin/env python3
"""Post-traitement « peinture numérique » des portraits (numpy + Pillow uniquement).
Entrée : <base>_color.png (rendu 2x), <base>_normal.png, <base>_depth.png.
Étapes : filtre de Kuwahara généralisé (aplats et touches de pinceau qui suivent les formes), réduction à la taille finale,
traits de contour fins et chauds tirés des discontinuités de profondeur/normales, palette légèrement resserrée,
grain de toile, netteté douce.
Usage : paint.py base sortie largeur hauteur [--radius R] [--edge E] [--palette N] [--mix M]
"""
import argparse
import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('base'); ap.add_argument('out'); ap.add_argument('w', type=int); ap.add_argument('h', type=int)
ap.add_argument('--radius', type=int, default=6); ap.add_argument('--edge', type=float, default=0.45)
ap.add_argument('--palette', type=int, default=128); ap.add_argument('--mix', type=float, default=0.12)
ap.add_argument('--quality', type=int, default=90)
a = ap.parse_args()


def box(img, r):
    """Moyenne sur une fenêtre (2r+1)^2 via images intégrales (bords répliqués)."""
    p = np.pad(img, ((r + 1, r), (r + 1, r)) + ((0, 0),) * (img.ndim - 2), mode='edge')
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return s / (k * k)


def shift(img, dy, dx):
    """Décalage avec bords répliqués (pas de repliement d'un bord sur l'autre)."""
    r = max(abs(dy), abs(dx))
    p = np.pad(img, ((r, r), (r, r)) + ((0, 0),) * (img.ndim - 2), mode='edge')
    h, w = img.shape[:2]
    return p[r - dy:r - dy + h, r - dx:r - dx + w]


def kuwahara(rgb, r, q=6.0):
    """Kuwahara à 4 secteurs carrés, pondération douce par la variance (pas d'effet de blocs)."""
    lum = rgb @ np.array([0.3, 0.55, 0.15])
    h = r // 2 + 0 if r > 1 else 1
    m = box(rgb, h); m2 = box(lum[..., None] ** 2, h)[..., 0]; ml = box(lum[..., None], h)[..., 0]
    acc = np.zeros_like(rgb); wsum = np.zeros(lum.shape)
    for dy, dx in ((-h, -h), (-h, h), (h, -h), (h, h)):
        mm = shift(m, dy, dx); v = shift(m2, dy, dx) - shift(ml, dy, dx) ** 2
        w = 1.0 / (1.0 + (np.maximum(v, 0) * 255 * 255 / 40.0) ** (q / 2))
        acc += mm * w[..., None]; wsum += w
    return acc / wsum[..., None]


def blur(img, r, n=3):
    for _ in range(n):
        img = box(img, r)
    return img


def akuwahara(rgb, r=6, sectors=8, q=8.0, alpha=1.0, strip=96):
    """Kuwahara anisotrope (Kyprianidis 2009, simplifié) : secteurs elliptiques orientés selon le tenseur de structure,
    les touches s'allongent le long des contours (cheveux, plis, bords du visage)."""
    H, W = rgb.shape[:2]
    lum = rgb @ np.array([0.3, 0.55, 0.15])
    gx = shift(lum, 0, -1) - shift(lum, 0, 1); gy = shift(lum, -1, 0) - shift(lum, 1, 0)
    T = blur(np.dstack([gx * gx, gx * gy, gy * gy]), 2)
    E, F, G = T[..., 0], T[..., 1], T[..., 2]
    root = np.sqrt((E - G) ** 2 + 4 * F * F)
    l1, l2 = (E + G + root) / 2, (E + G - root) / 2
    tx, ty = l1 - E, -F
    nrm = np.hypot(tx, ty); ok = nrm > 1e-9
    tx = np.where(ok, tx / np.maximum(nrm, 1e-9), 0.0); ty = np.where(ok, ty / np.maximum(nrm, 1e-9), 1.0)
    A = np.where(l1 + l2 > 1e-9, (l1 - l2) / np.maximum(l1 + l2, 1e-9), 0.0)
    ea = r * (alpha + A) / alpha; eb = r * alpha / (alpha + A)
    # échantillons dans le disque unité
    g = np.linspace(-1, 1, 2 * r + 1)
    U, Vv = np.meshgrid(g, g)
    keep = U ** 2 + Vv ** 2 <= 1.0001
    U, Vv = U[keep], Vv[keep]
    wgt = np.exp(-(U ** 2 + Vv ** 2) * 2.0)
    sec = (((np.arctan2(Vv, U) + np.pi) / (2 * np.pi) * sectors).astype(int)) % sectors
    center = (U == 0) & (Vv == 0)
    out = np.empty_like(rgb)
    for y0 in range(0, H, strip):
        y1 = min(H, y0 + strip); hh = y1 - y0
        yy, xx = np.mgrid[y0:y1, 0:W]
        cx, cy = tx[y0:y1], ty[y0:y1]; a_, b_ = ea[y0:y1], eb[y0:y1]
        sw = np.zeros((sectors, hh, W)); sc = np.zeros((sectors, hh, W, 3)); sc2 = np.zeros((sectors, hh, W))
        for u, v, w, k, c0 in zip(U, Vv, wgt, sec, center):
            dx = a_ * u * cx - b_ * v * cy; dy = a_ * u * cy + b_ * v * cx
            px = np.clip(np.rint(xx + dx).astype(np.int32), 0, W - 1); py = np.clip(np.rint(yy + dy).astype(np.int32), 0, H - 1)
            c = rgb[py, px]; l = lum[py, px]
            ks = range(sectors) if c0 else (k,)
            for kk in ks:
                sw[kk] += w; sc[kk] += c * w; sc2[kk] += l * l * w
        m = sc / sw[..., None]
        lm = m @ np.array([0.3, 0.55, 0.15])
        var = np.maximum(sc2 / sw - lm * lm, 0)
        al = 1.0 / (1.0 + (var * 255 * 255 / 25.0) ** (q / 2))
        out[y0:y1] = (m * al[..., None]).sum(0) / al.sum(0)[..., None]
    return out


col = np.asarray(Image.open(a.base + '_color.png').convert('RGB'), dtype=np.float64) / 255
H0, W0 = col.shape[:2]
# 1. touches de peinture : Kuwahara anisotrope puis petite passe isotrope pour fondre
p = akuwahara(col, r=a.radius)
p = kuwahara(p, 2)
# 2. réduction
img = Image.fromarray((np.clip(p, 0, 1) * 255).astype(np.uint8)).resize((a.w, a.h), Image.LANCZOS)
rgb = np.asarray(img, dtype=np.float64)

# 3. contours : profondeur et normales, à la résolution finale
nrm = np.asarray(Image.open(a.base + '_normal.png').convert('RGBA').resize((a.w, a.h), Image.BILINEAR), dtype=np.float64) / 255
dep = np.asarray(Image.open(a.base + '_depth.png').convert('RGBA').resize((a.w, a.h), Image.NEAREST), dtype=np.float64) / 255
n = nrm[..., :3] * 2 - 1; na = nrm[..., 3]
d = dep[..., 0] + dep[..., 1] / 255; da = dep[..., 3]
e = np.zeros((a.h, a.w))
for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
    n2 = shift(n, -dy, -dx); d2 = shift(d, -dy, -dx); a2 = shift(da, -dy, -dx)
    nd = np.linalg.norm(n - n2, axis=2)
    dd = np.abs(d2 - d)
    e = np.maximum(e, np.clip((nd - 0.55) / 0.5, 0, 1) * (na > 0.5))
    e = np.maximum(e, np.clip((dd - 0.004) / 0.008, 0, 1) * ((da > 0.5) | (a2 > 0.5)))
    e = np.maximum(e, ((da > 0.5) != (a2 > 0.5)).astype(float))
e = np.asarray(Image.fromarray((e * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float64) / 255
line = np.array([34, 22, 16], dtype=np.float64)
rgb = rgb * (1 - a.edge * e[..., None]) + line * a.edge * e[..., None]

# 4. palette resserrée (mélange partiel avec une version quantifiée)
q = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).quantize(colors=a.palette, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
rgb = rgb * (1 - a.mix) + np.asarray(q, dtype=np.float64) * a.mix

# 5. grain de toile : bruit doux multi-échelle + trame diagonale très légère
rs = np.random.RandomState(7)
g = np.zeros((a.h, a.w))
for s, amp in ((64, 0.5), (16, 0.3), (4, 0.2)):
    small = rs.rand(a.h // s + 2, a.w // s + 2)
    g += amp * np.asarray(Image.fromarray((small * 255).astype(np.uint8)).resize((a.w + s * 2, a.h + s * 2), Image.BICUBIC), dtype=np.float64)[:a.h, :a.w] / 255
yy, xx = np.mgrid[0:a.h, 0:a.w]
weave = 0.5 + 0.5 * np.sin((xx + yy) * 1.9) * np.sin((xx - yy) * 1.9)
tex = 1 + 0.045 * (g - 0.5) + 0.018 * (weave - 0.5)
rgb = rgb * tex[..., None]

# 6. netteté douce (yeux, bords)
out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(radius=1.2, percent=45, threshold=2))
out.save(a.out, quality=a.quality, subsampling=0, optimize=True)
