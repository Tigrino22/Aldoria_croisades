#!/usr/bin/env python3
"""Textures procédurales raccordables (bruit périodique par FFT).
- client/public/assets/ui/{parchment,stone,leather,wood}.jpg (1024x1024, raccordables)
- tools/art/tex/*.png : bibliothèque de textures pour les rendus three.js (couleur, relief -> normales, rugosité)
Usage : python3 tools/art/textures.py
"""
import os, math
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
UI = os.path.join(ROOT, 'client/public/assets/ui')
TEX = os.path.join(HERE, 'tex')
os.makedirs(UI, exist_ok=True); os.makedirs(TEX, exist_ok=True)


def pnoise(n, beta=2.0, seed=0, lo=1, hi=None, aniso=(1.0, 1.0), m=None):
    """Bruit fractal périodique (spectre en 1/f^beta), normalisé [-1,1] env."""
    m = m or n
    r = np.random.default_rng(seed)
    fy = np.fft.fftfreq(m)[:, None] * m * aniso[1]
    fx = np.fft.fftfreq(n)[None, :] * n * aniso[0]
    f = np.sqrt(fx * fx + fy * fy)
    amp = np.where(f >= lo, 1 / np.maximum(f, 1e-9) ** (beta / 2), 0)
    if hi:
        amp *= np.exp(-(f / hi) ** 2)
    ph = r.normal(size=(m, n)) + 1j * r.normal(size=(m, n))
    out = np.real(np.fft.ifft2(amp * ph))
    return out / (np.abs(out).max() + 1e-9)


def pblur(a, s):
    m, n = a.shape
    fy = np.fft.fftfreq(m)[:, None]; fx = np.fft.fftfreq(n)[None, :]
    g = np.exp(-2 * (math.pi * s) ** 2 * (fx ** 2 + fy ** 2))
    if a.ndim == 3:
        return np.dstack([np.real(np.fft.ifft2(np.fft.fft2(a[..., i]) * g)) for i in range(a.shape[2])])
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def worley(n, npts, seed=0, m=None):
    """Distance F1/F2 périodique + identifiant de cellule."""
    m = m or n
    r = np.random.default_rng(seed)
    pts = r.random((npts, 2)) * (n, m)
    yy, xx = np.mgrid[0:m, 0:n].astype(np.float32)
    f1 = np.full((m, n), 1e9, np.float32); f2 = np.full((m, n), 1e9, np.float32); cid = np.zeros((m, n), np.int32)
    for i, (px, py) in enumerate(pts):
        dx = np.abs(xx - px); dx = np.minimum(dx, n - dx)
        dy = np.abs(yy - py); dy = np.minimum(dy, m - dy)
        d = np.sqrt(dx * dx + dy * dy)
        closer = d < f1
        f2 = np.where(closer, f1, np.minimum(f2, d))
        cid = np.where(closer, i, cid)
        f1 = np.where(closer, d, f1)
    return f1, f2, cid


def normal_from_height(h, strength=4.0):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    nz = np.ones_like(h)
    nrm = np.dstack([-dx, dy, nz])
    nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    return nrm


def shade(h, strength=4.0, L=(-0.5, -0.6, 0.62)):
    nrm = normal_from_height(h, strength)
    L = np.array(L); L = L / np.linalg.norm(L)
    nrm2 = nrm.copy(); nrm2[..., 1] *= -1
    return np.clip((nrm2 * L).sum(2), 0, 1) / L[2]


def save_rgb(a, path, q=None):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    if path.endswith('.jpg'):
        im.save(path, quality=q or 84, optimize=True, progressive=True)
    else:
        im.save(path, optimize=True)


def save_normal(h, path, strength=4.0):
    nrm = normal_from_height(h, strength)
    save_rgb(nrm * 0.5 + 0.5, path)


def save_gray(a, path):
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), 'L').save(path, optimize=True)


def c(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255


def mix(a, b, t):
    return a + (b - a) * t[..., None]


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)


N = 1024

# ============================================================ UI
print('parchemin')
low = pnoise(N, 3.2, 1, lo=1)
midn = pnoise(N, 2.2, 2, lo=4)
fib = pnoise(N, 1.6, 3, lo=8, aniso=(0.15, 1.0))
fib2 = pnoise(N, 1.6, 4, lo=8, aniso=(1.0, 0.2))
grain = pnoise(N, 0.6, 5, lo=60)
stain = ss(0.35, 0.75, pnoise(N, 3.0, 6, lo=2))
base = mix(np.broadcast_to(c('e8d6ad'), (N, N, 3)), np.broadcast_to(c('cfb47e'), (N, N, 3)), ss(-0.6, 0.8, low))
base = base * (1 + 0.08 * midn[..., None] + 0.05 * fib[..., None] + 0.04 * fib2[..., None] + 0.04 * grain[..., None])
base = mix(base, base * c('b08850') / c('e0c896'), stain * 0.45)
spots = ss(0.55, 0.8, pnoise(N, 1.4, 7, lo=20)) * 0.25
base = base * (1 - spots[..., None] * 0.4)
save_rgb(base, os.path.join(UI, 'parchment.jpg'))

print('pierre')
# appareil de pierre de taille : 6 rangs de hauteur 1024/6 ~ 170, longueurs variées, raccordable
r = np.random.default_rng(11)
rows = 4; rh = N / rows
bid = np.zeros((N, N), np.int32); edge = np.ones((N, N))
yy, xx = np.mgrid[0:N, 0:N].astype(np.float64)
jit = pnoise(N, 1.8, 12, lo=6) * 9 + pnoise(N, 1.0, 19, lo=60) * 3
k = 0
for i in range(rows):
    widths = []
    tot = 0
    while tot < N:
        w = r.integers(260, 470); widths.append(w); tot += w
    widths[-1] -= tot - N
    if widths[-1] < 90:
        widths[-2] += widths[-1]; widths.pop()
    off = r.integers(0, N)
    y0, y1 = i * rh, (i + 1) * rh
    x = off
    for w in widths:
        xs = (xx - x) % N
        inside = (yy >= y0) & (yy < y1) & (xs < w)
        bid[inside] = k
        dxe = np.minimum(xs, w - xs); dye = np.minimum(yy - y0, y1 - yy)
        e = np.minimum(dxe, dye) + jit
        edge = np.where(inside, np.clip(e / 22, 0, 1), edge)
        x += w; k += 1
stone_n = pnoise(N, 2.0, 13, lo=3)
stone_f = pnoise(N, 1.2, 14, lo=30)
blocktone = np.random.default_rng(15).random(k + 1)[bid]
pits = ss(0.55, 0.8, pnoise(N, 1.0, 17, lo=40))
hgt = (ss(0, 1, edge) ** 0.6) * 0.6 + stone_n * 0.35 + stone_f * 0.03 - pits * 0.05 + pnoise(N, 2.4, 18, lo=4) * 0.25
lit = shade(hgt * 8, 3.0)
col = mix(np.broadcast_to(c('8a8070'), (N, N, 3)), np.broadcast_to(c('a69c8a'), (N, N, 3)), blocktone)
col = mix(col, np.broadcast_to(c('6c6252'), (N, N, 3)), ss(0.2, 0.6, pnoise(N, 2.6, 16, lo=2)) * 0.6)
warmb = (np.random.default_rng(16).random(k + 1) > 0.6)[bid].astype(float)
col = mix(col, col * c('b8a080') / c('a09a90'), warmb * 0.35)
col = col * (1 + 0.12 * stone_f[..., None] + 0.1 * stone_n[..., None])
mortar = ss(0.32, 0.05, edge)
col = mix(col, np.broadcast_to(c('4a443b'), (N, N, 3)), mortar * 0.85)
col = col * (0.55 + 0.5 * lit[..., None]) * (1 - 0.35 * mortar[..., None])
save_rgb(col * 0.85, os.path.join(UI, 'stone.jpg'))

print('cuir')
f1, f2, _ = worley(512, 1400, 21)
peb = np.tile((f2 - f1), (2, 2))
peb = peb / peb.max()
crease = np.abs(pnoise(N, 1.8, 22, lo=6, aniso=(1, 0.35)))
crease = ss(0.0, 0.08, crease)
lowl = pnoise(N, 3.0, 23, lo=1)
hgt = ss(0, 0.5, peb) * 0.4 + crease * 0.5 + lowl * 0.3
lit = shade(hgt * 3, 3.0)
col = mix(np.broadcast_to(c('5a3720'), (N, N, 3)), np.broadcast_to(c('7a4c2a'), (N, N, 3)), ss(-0.6, 0.7, lowl))
wear = ss(0.35, 0.8, pnoise(N, 2.2, 24, lo=3))
col = mix(col, np.broadcast_to(c('9a6a40'), (N, N, 3)), wear * 0.5)
col = col * (0.6 + 0.45 * lit[..., None]) * (0.85 + 0.15 * crease[..., None])
save_rgb(col, os.path.join(UI, 'leather.jpg'))

print('bois')
# planches verticales (4 de 256 px), fil du bois raccordable
planks = 4; pw = N // planks
wood = np.zeros((N, N, 3)); hgt = np.zeros((N, N))
for p in range(planks):
    rr = np.random.default_rng(30 + p)
    sl = slice(p * pw, (p + 1) * pw)
    u = xx[:, sl] - p * pw
    warp = pnoise(N, 2.2, 31 + p, lo=1, aniso=(1, 6))[:, sl] * 22
    ringpos = (u * 0.9 + warp + rr.random() * 100)
    rings = np.sin(ringpos / (5 + rr.random() * 3)) * 0.5 + 0.5
    rings = rings ** 3
    fibers = pnoise(N, 1.3, 40 + p, lo=10, aniso=(1.0, 30))[:, sl] + 0.5 * pnoise(N, 2.0, 50 + p, lo=2, aniso=(1.0, 8))[:, sl]
    tone = rr.random()
    a = c('6b4528') * (0.85 + 0.3 * tone); b = c('3e2614') * (0.85 + 0.3 * tone)
    pc = mix(np.broadcast_to(a, rings.shape + (3,)), np.broadcast_to(b, rings.shape + (3,)), ss(0.3, 1.0, rings) * 0.7)
    pc = pc * (1 + 0.18 * fibers[..., None])
    # noeud
    ky, kx = rr.random() * N, 60 + rr.random() * (pw - 120)
    dyk = np.abs(yy[:, sl] - ky); dyk = np.minimum(dyk, N - dyk)
    knot = np.exp(-((u - kx) ** 2 / 300 + dyk ** 2 / 900))
    pc = mix(pc, np.broadcast_to(c('2a170b'), pc.shape), ss(0.3, 0.9, knot))
    edgep = np.minimum(u, pw - 1 - u)
    gap = ss(0, 5, edgep)
    wood[:, sl] = pc * (0.45 + 0.55 * gap[..., None])
    hgt[:, sl] = fibers * 0.3 + rings * 0.15 + gap * 0.6
lit = shade(hgt * 3, 2.5)
wood = wood * (0.7 + 0.4 * lit[..., None])
save_rgb(wood, os.path.join(UI, 'wood.jpg'))

# ============================================================ bibliothèque pour three.js
print('bibliothèque 3D')
M = 512
# mailles : anneaux rivetés en quinconce (une texture 512 = 16x16 anneaux)
ring_r, cells = 11.0, 16
cw = M / cells
yy2, xx2 = np.mgrid[0:M, 0:M].astype(np.float64)
hm = np.zeros((M, M))
nrows = 26; rsp = M / nrows
pad = 16
big = np.zeros((M + 2 * pad, M + 2 * pad))
py_, px_ = np.mgrid[-pad:pad, -pad:pad].astype(np.float64)
for oy in range(-1, nrows + 1):
    for ox in range(-1, cells + 1):
        cx = ox * cw + (cw / 2 if oy % 2 else 0); cy = oy * rsp
        ix, iy = int(round(cx)), int(round(cy))
        dx = px_ - (cx - ix); dy = py_ - (cy - iy)
        d = np.sqrt(dx * dx + dy * dy)
        tor = np.clip(1 - ((d - ring_r * 0.78) / (ring_r * 0.3)) ** 2, 0, 1)
        # les anneaux s'inclinent : un côté plus haut que l'autre (entrelacement)
        tilt = 0.75 + 0.25 * (dx / ring_r) * (1 if oy % 2 else -1)
        hv = np.sqrt(tor) * tilt
        x0, y0 = ix + pad - pad, iy + pad - pad
        if x0 < 0 or y0 < 0 or x0 + 2 * pad > big.shape[1] or y0 + 2 * pad > big.shape[0]:
            continue
        big[y0:y0 + 2 * pad, x0:x0 + 2 * pad] = np.maximum(big[y0:y0 + 2 * pad, x0:x0 + 2 * pad], hv)
hm = big[pad:pad + M, pad:pad + M]
save_normal(hm * 6, os.path.join(TEX, 'mail_n.png'), 1.0)
save_gray(np.clip(hm * 1.4, 0, 1), os.path.join(TEX, 'mail_a.png'))  # alpha / ao
save_gray(0.42 + 0.58 * hm, os.path.join(TEX, 'mail_ao.png'))

def lib(name, h, strength, colmap=None, rough=None):
    save_normal(h, os.path.join(TEX, name + '_n.png'), strength)
    if colmap is not None:
        save_rgb(colmap, os.path.join(TEX, name + '_c.png'))
    if rough is not None:
        save_gray(rough, os.path.join(TEX, name + '_r.png'))

# métal martelé, rayé, piqué de rouille (gris -> teinté dans three)
hamm = pnoise(M, 2.6, 50, lo=6, hi=60)
scr = np.zeros((M, M))
rs = np.random.default_rng(51)
for i in range(260):
    x0, y0 = rs.random(2) * M; ang = rs.random() * math.pi; L = 10 + rs.random() * 90
    t = np.linspace(0, 1, int(L * 2))
    xs = ((x0 + np.cos(ang) * L * t) % M).astype(int); ys = ((y0 + np.sin(ang) * L * t) % M).astype(int)
    scr[ys, xs] = 1
scr = pblur(scr, 0.6); scr /= scr.max()
rust = ss(0.25, 0.7, pnoise(M, 2.0, 52, lo=4) + pnoise(M, 1.0, 53, lo=40) * 0.3)
mc = np.ones((M, M, 3)) * (0.85 + 0.1 * pnoise(M, 1.5, 54, lo=10))[..., None]
mc = mix(mc, np.broadcast_to(c('5a3a22') * 1.4, (M, M, 3)), rust * 0.75)
mc = mc * (1 - 0.25 * scr[..., None] * 0)
lib('metal', hamm * 3 - scr * 1.2, 2.0, mc, np.clip(0.35 + 0.25 * hamm + 0.4 * rust - 0.25 * scr, 0, 1))

# bois (fil)
wf = pnoise(M, 1.5, 60, lo=6, aniso=(1.0, 20))
wr = np.sin((xx2 + pnoise(M, 2.5, 61, lo=1, aniso=(1, 6)) * 30) / 4.0)
wc = np.ones((M, M, 3)) * (0.8 + 0.12 * wf + 0.08 * wr)[..., None]
lib('wood', wf * 2 + wr * 0.4, 2.0, wc, np.clip(0.7 + 0.15 * wf, 0, 1))

# cuir
f1, f2, _ = worley(M, 900, 70)
pebm = (f2 - f1); pebm /= pebm.max()
cr = ss(0.0, 0.1, np.abs(pnoise(M, 1.8, 71, lo=4, aniso=(1, 0.4))))
lw = ss(0.2, 0.8, pnoise(M, 2.2, 72, lo=2))
lc = np.ones((M, M, 3)) * (0.75 + 0.15 * cr + 0.2 * lw)[..., None]
lib('leather', ss(0, 0.5, pebm) * 0.8 + cr * 1.5, 2.0, lc, np.clip(0.55 + 0.2 * cr - 0.25 * lw, 0, 1))

# tissu (toile de lin/laine) : armure toile 64x64 fils
th = 8.0
wx = np.sin(xx2 / th * math.pi) ** 2; wy = np.sin(yy2 / th * math.pi) ** 2
chk = ((np.floor(xx2 / th) + np.floor(yy2 / th)) % 2)
weave = np.where(chk > 0, wx * 0.6 + 0.4 * wy * 0.3, wy * 0.6 + 0.4 * wx * 0.3)
slub = pnoise(M, 1.2, 80, lo=20, aniso=(1, 0.1)) + pnoise(M, 1.2, 81, lo=20, aniso=(0.1, 1))
dirt = ss(0.2, 1.0, pnoise(M, 2.6, 82, lo=2)) * 0.5
cc = np.ones((M, M, 3)) * (0.8 + 0.15 * weave + 0.08 * slub)[..., None] * (1 - 0.35 * dirt)[..., None]
lib('cloth', weave * 1.2 + slub * 0.4 + pnoise(M, 2.6, 83, lo=2) * 2.5, 1.5, cc, np.ones((M, M)) * 0.9)

# matelassage (gambison) : coutures verticales tous les 32 px
quil = np.abs(np.sin(xx2 / 32 * math.pi)) ** 0.5
lib('quilt', quil * 3 + weave * 0.5, 2.0, None, None)

# pierre / roche
rk = pnoise(M, 2.2, 90, lo=2) + 0.3 * pnoise(M, 1.2, 91, lo=30)
f1, f2, cid = worley(M, 40, 92)
crack = ss(0.0, 4.0, f2 - f1)
rcol = np.ones((M, M, 3)) * (0.75 + 0.2 * rk)[..., None] * (0.6 + 0.4 * crack)[..., None]
lib('rock', rk * 6 + crack * 2, 2.0, rcol, np.clip(0.85 + 0.1 * rk, 0, 1))

# fourrure : mèches allongées
fur = pnoise(M, 1.3, 100, lo=12, aniso=(1.0, 12)) + 0.5 * pnoise(M, 1.0, 101, lo=40, aniso=(1.0, 6))
fc = np.ones((M, M, 3)) * (0.6 + 0.4 * ss(-0.5, 0.8, fur))[..., None]
lib('fur', fur * 3, 2.5, fc, None)

# sable (rides éoliennes)
sw = pnoise(M, 2.4, 110, lo=1) * 25
rip = np.sin((xx2 * 0.8 + yy2 * 0.6 + sw) / 3.0)
sg = pnoise(M, 0.5, 111, lo=100)
lib('sand', rip * 0.6 + sg * 0.3 + pnoise(M, 2.6, 112, lo=2) * 4, 2.0,
    np.ones((M, M, 3)) * (0.88 + 0.06 * rip + 0.06 * sg)[..., None], None)

# sol herbeux/terre (grand motif)
gn = pnoise(M, 2.0, 120, lo=2); gf = pnoise(M, 0.8, 121, lo=60)
gc = mix(np.broadcast_to(c('4d5a2a'), (M, M, 3)), np.broadcast_to(c('6f5a3a'), (M, M, 3)), ss(-0.2, 0.4, gn))
gc = gc * (1 + 0.3 * gf[..., None])
lib('ground', gn * 3 + gf * 0.8, 2.0, gc, None)

# peinture écaillée (masque d'usure pour boucliers)
wear = pnoise(M, 2.3, 130, lo=3) + 0.35 * pnoise(M, 1.0, 131, lo=40)
save_gray(ss(0.25, 0.4, wear), os.path.join(TEX, 'chip.png'))
save_gray(ss(-0.6, 0.9, pnoise(M, 2.8, 132, lo=1)), os.path.join(TEX, 'grime.png'))
print('ok')
