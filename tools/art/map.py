#!/usr/bin/env python3
"""Carte d'Aldoria : relief procédural (bruit fractal + érosion hydraulique par gouttes),
ombrage du relief, coloration par biome selon les territoires de map-geometry.json.
Sorties : client/public/assets/map/aldoria.jpg (1600x1200) et aldoria-small.jpg (800x600).
Usage : python3 tools/art/map.py
"""
import json, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
GEO = json.load(open(os.path.join(ROOT, 'shared/src/data/map-geometry.json')))
OUT = os.path.join(ROOT, 'client/public/assets/map')
os.makedirs(OUT, exist_ok=True)
W, H = GEO['width'], GEO['height']
rng = np.random.default_rng(1096)


# ---------------------------------------------------------------- outils
def blur(a, s):
    """Flou gaussien par FFT (bords en miroir)."""
    if s <= 0:
        return a
    p = int(3 * s) + 1
    b = np.pad(a, p, mode='reflect')
    h, w = b.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    g = np.exp(-2 * (math.pi * s) ** 2 * (fx ** 2 + fy ** 2))
    r = np.fft.irfft2(np.fft.rfft2(b) * g, s=b.shape)
    return r[p:-p, p:-p]


def upsample(small, w, h):
    im = Image.fromarray(small.astype(np.float32), mode='F')
    return np.asarray(im.resize((w, h), Image.BICUBIC), dtype=np.float64)


def noise(w, h, scale, seed=None):
    g = np.random.default_rng(seed) if seed is not None else rng
    sw, sh = max(2, int(w / scale) + 3), max(2, int(h / scale) + 3)
    big = upsample(g.random((sh, sw)), int(sw * scale), int(sh * scale))
    return big[:h, :w]


def fbm(w, h, base, octaves=7, gain=0.5, lac=2.0, seed=0):
    tot, amp, s, norm = np.zeros((h, w)), 1.0, base, 0
    for o in range(octaves):
        tot += amp * (noise(w, h, max(s, 1.5), seed + o) - 0.5)
        norm += amp
        amp *= gain
        s /= lac
    return tot / norm


def ridged(w, h, base, octaves=6, seed=0):
    tot, amp, s, norm = np.zeros((h, w)), 1.0, base, 0
    for o in range(octaves):
        n = 1 - np.abs(noise(w, h, max(s, 1.5), seed + 100 + o) * 2 - 1)
        tot += amp * n ** 2
        norm += amp
        amp *= 0.5
        s /= 2
    return tot / norm


def poly_mask(poly, w=W, h=H, scale=1.0):
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).polygon([(x * scale, y * scale) for x, y in poly], fill=255)
    return np.asarray(im, dtype=np.float64) / 255


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t[..., None] if a.ndim == 3 or b.ndim == 3 else a + (b - a) * t


def col(hexs):
    hexs = hexs.lstrip('#')
    return np.array([int(hexs[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64) / 255


def mix(c0, c1, t):
    c0 = c0 if np.ndim(c0) == 3 else np.broadcast_to(c0, (H, W, 3))
    c1 = c1 if np.ndim(c1) == 3 else np.broadcast_to(c1, (H, W, 3))
    return c0 + (c1 - c0) * t[..., None]


# ---------------------------------------------------------------- masques
print('masques...')
land = poly_mask(GEO['coast'])
T = GEO['territories']
groups = {
    'north': ['hrafnborg', 'isvik', 'myrkvid'],
    'west': ['clairval', 'ostrevent', 'saint-aubin'],
    'desert': ['al-rimal', 'zahran', 'palmes'],
    'center': ['selenar', 'berenice', 'corbeaux'],
}
gm = {}
for g, ids in groups.items():
    m = np.zeros((H, W))
    for i in ids:
        m = np.maximum(m, poly_mask(T[i]['polygon']))
    gm[g] = m
# frontières de biomes adoucies et irrégulières (déformation par bruit)
warp = fbm(W, H, 120, 5, seed=7)
for g in gm:
    gm[g] = np.clip(blur(gm[g], 38) + warp * 0.9 * (blur(gm[g], 38) * (1 - blur(gm[g], 38))) * 4, 0, 1)
tot = sum(gm.values()) + 1e-6
for g in gm:
    gm[g] /= tot
N, Wt, D, C = gm['north'], gm['west'], gm['desert'], gm['center']
# poids plus larges pour le relief (évite les falaises aux frontières de biomes)
eN, eW, eD, eC = (np.clip(blur(m, 70), 0, 1) for m in (N, Wt, D, C))


# distance approx. à la côte (intérieur > 0, mer < 0)
dl = blur(land, 40) * 2 - 1
coastd = blur(land, 12)

# ---------------------------------------------------------------- relief
print('relief...')
SW, SH = 800, 600  # érosion à demi-résolution
def half(a):
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((SW, SH), Image.BILINEAR), dtype=np.float64)

base = fbm(W, H, 260, 8, 0.52, seed=11)
rid = ridged(W, H, 220, 7, seed=21)
hills = fbm(W, H, 90, 6, 0.55, seed=31)

# chaîne de montagnes à Corbeaux (axe NE-SO) avec un col au centre
yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
cx, cy = T['corbeaux']['center']
ax, ay = math.cos(math.radians(-60)), math.sin(math.radians(-60))
along = (xx - cx) * ax + (yy - cy) * ay
across = -(xx - cx) * ay + (yy - cy) * ax
chain = np.exp(-(across / 70) ** 2) * smoothstep(260, 120, np.abs(along))
notch = 1 - 0.75 * np.exp(-(along / 38) ** 2)
corb = chain * notch

h = (0.18 + 0.25 * np.clip(dl, 0, 1)) * land
h += land * (eN * (0.55 * rid + 0.25 * base + 0.15) * smoothstep(0.0, 0.5, np.clip(dl, 0, 1) + 0.15))
h += land * (eW * (0.06 * hills + 0.08 * base + 0.03))
h += land * (eC * (0.16 * hills + 0.12 * base + 0.06 * rid))
h += land * (eD * (0.06 * base + 0.02 * hills + 0.04))
h += land * corb * (0.35 + 0.35 * rid)
h += (1 - land) * (dl * 0.25)  # pente sous-marine

# vallée du fleuve (Bérénice -> Sélénar -> mer)
river_pts = np.array([(732, 392), (712, 450), (686, 520), (700, 585), (742, 650), (775, 720),
                      (792, 790), (770, 860), (748, 930), (738, 1000), (728, 1060), (722, 1118)], float)
def catmull(pts, n=40):
    out = []
    P = np.vstack([pts[0], pts, pts[-1]])
    for i in range(1, len(P) - 2):
        for t in np.linspace(0, 1, n, endpoint=False):
            p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1])
    return np.array(out)
rp = catmull(river_pts, 60)
# méandres
mw = fbm(len(rp), 1, 30, 4, seed=5)[0] * 40
tang = np.gradient(rp, axis=0); tang /= np.linalg.norm(tang, axis=1)[:, None] + 1e-9
rp = rp + np.stack([-tang[:, 1], tang[:, 0]], 1) * mw[:, None]
rim = Image.new('L', (W, H), 0); rd = ImageDraw.Draw(rim)
rd.line([tuple(p) for p in rp], fill=255, width=3, joint='curve')
river = np.asarray(rim, dtype=np.float64) / 255
rim2 = Image.new('L', (W, H), 0); ImageDraw.Draw(rim2).line([tuple(p) for p in rp], fill=255, width=1)
river_valley = blur(river, 30)
river_valley /= river_valley.max()
h -= 0.12 * river_valley * land

# érosion hydraulique vectorisée (gouttes)
print('érosion...')
hs = half(h)
def bil(a, x, y):
    x0 = np.clip(x.astype(int), 0, SW - 2); y0 = np.clip(y.astype(int), 0, SH - 2)
    fx, fy = x - x0, y - y0
    a00, a10, a01, a11 = a[y0, x0], a[y0, x0 + 1], a[y0 + 1, x0], a[y0 + 1, x0 + 1]
    hgt = a00 * (1 - fx) * (1 - fy) + a10 * fx * (1 - fy) + a01 * (1 - fx) * fy + a11 * fx * fy
    gx = (a10 - a00) * (1 - fy) + (a11 - a01) * fy
    gy = (a01 - a00) * (1 - fx) + (a11 - a10) * fx
    return hgt, gx, gy, x0, y0, fx, fy

er_rng = np.random.default_rng(3)
landh = half(land)
for batch in range(14):
    n = 60000
    x = er_rng.random(n) * (SW - 2); y = er_rng.random(n) * (SH - 2)
    keep = landh[y.astype(int), x.astype(int)] > 0.5
    x, y = x[keep], y[keep]; n = len(x)
    dx = np.zeros(n); dy = np.zeros(n); vel = np.ones(n); water = np.ones(n); sed = np.zeros(n)
    alive = np.ones(n, bool)
    for step in range(40):
        hgt, gx, gy, x0, y0, fx, fy = bil(hs, x, y)
        dx = dx * 0.3 - gx * 0.7; dy = dy * 0.3 - gy * 0.7
        ln = np.sqrt(dx * dx + dy * dy) + 1e-9
        dx /= ln; dy /= ln
        nx, ny = x + dx, y + dy
        alive &= (nx > 0) & (nx < SW - 2) & (ny > 0) & (ny < SH - 2)
        nh = bil(hs, np.clip(nx, 0, SW - 2), np.clip(ny, 0, SH - 2))[0]
        dh = nh - hgt
        cap = np.maximum(-dh, 0.0005) * vel * water * 4.0
        dep = np.where((sed > cap) | (dh > 0), np.where(dh > 0, np.minimum(dh, sed), (sed - cap) * 0.3), 0)
        ero = np.where((sed <= cap) & (dh <= 0), np.minimum((cap - sed) * 0.3, -dh), 0)
        amt = (dep - ero) * alive
        sed = sed - amt
        for (ox, oy, wgt) in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
            np.add.at(hs, (y0 + oy, x0 + ox), amt * wgt)
        vel = np.sqrt(np.maximum(vel * vel + (-dh) * 4, 0.01))
        water *= 0.98
        x, y = np.where(alive, nx, x), np.where(alive, ny, y)
diff = hs - half(h)
diff = np.clip(diff, -0.08, 0.04)
h = h + 1.6 * upsample(diff, W, H)[:H, :W]

# détail fin
h += land * fbm(W, H, 14, 4, 0.5, seed=41) * (0.002 + 0.012 * N + 0.006 * C + 0.008 * corb)

# dunes dans le désert : ondes déformées
dwarp = fbm(W, H, 140, 4, seed=51) * 60
dunes = np.sin((xx * 0.55 + yy * 0.83 + dwarp) / 3.2)
dunes = (np.abs(dunes) ** 0.7) * smoothstep(0.1, 0.6, fbm(W, H, 160, 3, seed=52) + 0.5)
dunes2 = np.sin((xx * 0.9 - yy * 0.3 + dwarp * 1.3) / 1.6) * 0.25
plateau_mask = smoothstep(0.11, 0.2, fbm(W, H, 70, 6, seed=53))
terr = blur(np.floor(h * 25) / 25, 1.5)
h = h + land * D * ((dunes + dunes2) * 0.004 * (1 - plateau_mask) + plateau_mask * (terr - h) * 0.5 + plateau_mask * 0.02)

# ---------------------------------------------------------------- ombrage
print('ombrage...')
zf = 380.0
gy_, gx_ = np.gradient(h * zf)
nrm = np.dstack([-gx_, -gy_, np.ones_like(h)])
nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
L = np.array([-0.55, -0.6, 0.58]); L /= np.linalg.norm(L)
shade = np.clip((nrm * L).sum(2), 0, 1)
slope = 1 - nrm[..., 2]
ao = np.clip(1 + (h - blur(h, 6)) * 12, 0.6, 1.2)
hl = np.clip(h, 0, None)

# ---------------------------------------------------------------- couleurs
print('couleurs...')
fine = fbm(W, H, 6, 3, seed=61)
mid = fbm(W, H, 40, 4, seed=62)
large = fbm(W, H, 200, 4, seed=63)

# Ouest : champs en patchwork, prairies, forêts
fields_id = noise(W, H, 1, 64)  # placeholder (remplacé ci-dessous)
cells = np.asarray(Image.fromarray((rng.random((H // 8 + 2, W // 11 + 2)) * 255).astype(np.uint8)).resize(
    (W // 11 * 11 + 22, H // 8 * 8 + 16), Image.NEAREST), dtype=np.float64)[:H, :W] / 255
# léger cisaillement des parcelles
cells = np.asarray(Image.fromarray((cells * 255).astype(np.uint8)).rotate(17, Image.NEAREST, expand=False), dtype=np.float64) / 255
cells = np.where(cells == 0, 0.5, cells)
cells = np.clip(cells + fine * 0.25, 0, 1)
west_c = mix(col('6f8a3c'), col('8f9a52'), cells)
west_c = mix(west_c, col('b8a466'), smoothstep(0.75, 0.9, cells))
west_c = mix(west_c, col('557a2e'), smoothstep(0.3, 0.1, cells))
forest_w = smoothstep(0.02, 0.09, mid + large * 0.6 + fine * 0.15)
wtree = blur((rng.random((H, W)) > 0.5).astype(float), 0.8)
west_c = mix(west_c, col('2d4520') * (0.7 + 0.6 * wtree[..., None]), forest_w * 0.92)

# Nord : forêts de conifères sombres, toundra, roche, neige (seuils par percentiles)
nm = (N > 0.5) & (land > 0.5)
p60, p80, p92 = np.percentile(hl[nm], [55, 78, 90])
tree = blur((rng.random((H, W)) > 0.5).astype(float), 0.8)
north_c = mix(col('1d2e1f'), col('2e3d2a'), smoothstep(-0.1, 0.1, mid))
north_c = north_c * (0.65 + 0.7 * tree[..., None])
bog = smoothstep(0.05, 0.15, mid * -1 + fine * 0.2) * smoothstep(p60, p60 * 0.8, hl)
north_c = mix(north_c, col('59603f'), bog * 0.6)
tundra = smoothstep(p60, p80, hl + mid * 0.05)
north_c = mix(north_c, col('6a6858'), tundra)
rock = smoothstep(0.15, 0.4, slope * 3)
north_c = mix(north_c, col('4f4d4a'), rock * smoothstep(p60, p80, hl))
snow = smoothstep(p80, p92, hl + fine * 0.03 - slope * 0.05) * N
north_c = mix(north_c, col('e4e9ef'), snow)

# Centre : collines méditerranéennes sèches, maquis, oliveraies
olive = blur((rng.random((H, W)) > 0.72).astype(float), 0.7)
cent_c = mix(col('b49f6e'), col('a08a5a'), smoothstep(-0.15, 0.15, mid))
cent_c = mix(cent_c, col('5f6638') * (0.7 + 0.6 * olive[..., None]), smoothstep(0.0, 0.18, mid + fine * 0.3) * 0.7)
cent_c = mix(cent_c, col('c9b585'), smoothstep(0.1, 0.25, large) * 0.6)
cent_c = mix(cent_c, col('857560'), smoothstep(0.2, 0.5, slope * 3) * 0.6)
cm = (corb > 0.3) & (land > 0.5)
cp = np.percentile(hl[cm], 85) if cm.any() else 1
cent_c = mix(cent_c, col('8a7f72'), smoothstep(0.2, 0.6, corb))
cent_c = mix(cent_c, col('e2e0da'), smoothstep(cp, cp + 0.06, hl + fine * 0.04) * smoothstep(0.4, 0.8, corb) * 0.8)

# Désert : sable, plateaux rocheux ocre, oasis
des_c = mix(col('d9b77c'), col('c99a5b'), smoothstep(-0.2, 0.2, large + dunes * 0.15))
des_c = mix(des_c, col('e6cc98'), smoothstep(0.3, 0.9, dunes) * 0.5)
des_c = mix(des_c, col('9d6d42'), plateau_mask * 0.85)
des_c = mix(des_c, col('7a5236'), plateau_mask * smoothstep(0.2, 0.5, slope * 3))

color = Wt[..., None] * west_c + N[..., None] * north_c + C[..., None] * cent_c + D[..., None] * des_c

# oasis : taches vertes avec points de palmiers
oases = [(1330, 520), (1290, 600), (1365, 455), (1300, 800), (1360, 760), (1040, 960), (930, 1020), (1180, 880), (1240, 700)]
oz = np.zeros((H, W))
for (ox, oy) in oases:
    r = 6 + rng.random() * 6
    oz = np.maximum(oz, np.exp(-(((xx - ox) ** 2 + (yy - oy) ** 2) / (2 * r * r))))
specks = (rng.random((H, W)) > 0.55).astype(float)
specks = blur(specks, 0.7)
oasis = smoothstep(0.2, 0.7, oz + fine * 0.6 + (specks - 0.5) * 0.5) * D
color = mix(color, col('3d5a24') * (0.6 + 0.6 * specks[..., None]), oasis)
# petits lacs d'oasis
lakes = smoothstep(0.93, 0.98, oz) * D
color = mix(color, col('2f6d78'), lakes)

# ripisylve le long du fleuve
rip = smoothstep(0.08, 0.5, blur(river, 4) * 6) * land
color = mix(color, col('4c6a2c') * (0.8 + 0.4 * fine[..., None] + 0.2), rip * 0.85)

# éclairage
lit = (0.35 + 0.85 * shade)[..., None] * ao[..., None]
lit = lit * (1 - 0.12 * snow[..., None])
landrgb = color * lit
# reflets d'eau douce
rv = blur(river, 0.6)
landrgb = mix(landrgb, col('3d6b80') * 0.9, np.clip(rv * 1.6, 0, 1))

# ---------------------------------------------------------------- mer
print('mer...')
depth = np.clip(-dl, 0, 1)
near = blur(land, 5)
sea_noise = fbm(W, H, 80, 5, seed=71)
deep = mix(col('0b2a4a'), col('061a33'), smoothstep(0.1, 0.9, depth))
cold = smoothstep(500, 200, yy)[..., None]
warm_t = mix(col('2f8f9a'), col('3aa5a0'), smoothstep(0.6, 1.0, xx / W))
shallow_c = warm_t * (1 - cold) + col('2b5d6e') * cold
sea = mix(deep, shallow_c, smoothstep(0.0, 0.65, blur(land, 18) * 1.7 + sea_noise * 0.25))
sea = mix(sea, col('7fb7b0') * (1 - 0.4 * cold) + col('556f78') * 0.4 * cold, smoothstep(0.35, 0.8, near) * 0.8)
# houle et reflets
waves = fbm(W, H, 3, 2, seed=72)
sea = sea * (1 + waves[..., None] * 0.12 + sea_noise[..., None] * 0.15)
# écume côtière
coast_line = np.clip(1 - np.abs(land - blur(land, 1.5)) * 0, 0, 1)
edge = blur(land, 1.2) * (1 - land)
sea = mix(sea, col('dfe8e4'), np.clip(edge * 2.5, 0, 1) * (0.5 + 0.5 * (fine + 0.5)))

# plage / sable côtier côté terre (ouest/centre/désert)
beach = land * smoothstep(0.75, 0.55, blur(land, 2.5)) * (1 - N * 0.8)
landrgb = mix(landrgb, col('d6c79c') * lit, beach * 0.6)

# fjords : bras de mer étroits et sinueux sur la côte nord
fj = Image.new('L', (W, H), 0); fd = ImageDraw.Draw(fj)
coast = np.array(GEO['coast'])
for (tx, ty, ang, ln) in [(560, 160, 1.15, 70), (700, 110, 1.45, 85), (930, 75, 1.6, 75), (1080, 120, 1.9, 80), (1240, 190, 2.3, 65)]:
    i = np.argmin(((coast - (tx, ty)) ** 2).sum(1)); px, py = coast[i]
    pts = []
    for k in range(12):
        t = k / 11
        wob = math.sin(t * 7 + tx) * 6
        pts.append((px + math.cos(ang) * ln * t - math.sin(ang) * wob, py + math.sin(ang) * ln * t + math.cos(ang) * wob))
    for k in range(len(pts) - 1):
        fd.line([pts[k], pts[k + 1]], fill=255, width=max(1, int(7 * (1 - k / 11)) + 1))
fjord = blur(np.asarray(fj, dtype=np.float64) / 255, 0.8) * land
fjord_c = col('1d3a4a') * (1 + waves[..., None] * 0.1)
landrgb = mix(landrgb, fjord_c, np.clip(fjord * 1.5, 0, 1))
img = mix(sea, landrgb, land)

# ---------------------------------------------------------------- atmosphère
# légère brume bleutée, vignettage, nuages fins
clouds = smoothstep(0.12, 0.35, fbm(W, H, 220, 7, 0.55, seed=81))
cloud_sh = np.roll(np.roll(clouds, 14, 0), 18, 1)
sea_only = 1 - blur(land, 25)
pass
pass  # pas de nuages (lisibilité de la côte)
vig = 1 - 0.35 * (((xx / W - 0.5) ** 2 + (yy / H - 0.5) ** 2) * 2.2)
img = img * vig[..., None]
img = np.clip(img, 0, 1) ** (1 / 1.05)

# ---------------------------------------------------------------- style illustré « 128 px »
# On dessine à 800x600 (moyenne), palette limitée avec léger tramage, trait de côte sombre,
# puis agrandissement x2 au plus proche voisin.
print('style pixel...')
full = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
aw, ah = 800, 600
small = np.asarray(full.resize((aw, ah), Image.BOX), dtype=np.float64)
bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 - 0.5
small = np.clip(small + np.tile(bayer, (ah // 4, aw // 4))[..., None] * 10, 0, 255)
sm = Image.fromarray(small.astype(np.uint8)).filter(ImageFilter.MedianFilter(3))
pal = sm.quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
q = np.asarray(sm.quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB').filter(ImageFilter.ModeFilter(3)), dtype=np.float64)
lm = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).resize((aw, ah), Image.BOX), dtype=np.float64) / 255 > 0.5
edge = np.zeros_like(lm)
for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
    edge |= lm & ~np.roll(np.roll(lm, dy, 0), dx, 1)
q[edge] = q[edge] * 0.35 + np.array([30, 24, 16]) * 0.65
outer = np.zeros_like(lm)
for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
    outer |= ~lm & np.roll(np.roll(lm, dy, 0), dx, 1)
q[outer] = q[outer] * 0.6 + np.array([210, 225, 220]) * 0.4
px = Image.fromarray(q.astype(np.uint8))
px.resize((W, H), Image.NEAREST).save(os.path.join(OUT, 'aldoria.jpg'), quality=92, subsampling=0, optimize=True)
px.save(os.path.join(OUT, 'aldoria-small.jpg'), quality=92, subsampling=0, optimize=True)
print('ok', OUT)
