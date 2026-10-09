"""Génère la géométrie de la carte d'Aldoria : côte, territoires (Voronoï découpé par la côte) et voisinages.
Sortie : shared/src/data/map-geometry.json (coordonnées dans une image 1600 x 1200)."""
import json, math, random, os

W, H = 1600, 1200
random.seed(1096)  # année de la première croisade, pour que la carte soit toujours la même

# Côte : une ellipse déformée par du bruit à plusieurs fréquences
def coast():
    pts = []
    n = 220
    phases = [random.uniform(0, 6.28) for _ in range(6)]
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 1.0
        for k, (f, amp) in enumerate([(2, .07), (3, .05), (5, .035), (9, .02), (17, .012), (29, .007)]):
            r += amp * math.sin(f * a + phases[k])
        # golfe au sud-ouest (mer intérieure)
        d = math.atan2(math.sin(a - 2.2), math.cos(a - 2.2))
        r -= .16 * math.exp(-(d / .18) ** 2)
        x = W / 2 + math.cos(a) * 700 * r
        y = H / 2 + math.sin(a) * 520 * r
        pts.append((round(min(W - 20, max(20, x)), 1), round(min(H - 20, max(20, y)), 1)))
    return pts

SEEDS = {
    'clairval': (250, 620), 'ostrevent': (380, 360), 'saint-aubin': (470, 840),
    'al-rimal': (1360, 820), 'zahran': (1060, 960), 'palmes': (1380, 500),
    'hrafnborg': (820, 170), 'isvik': (1140, 250), 'myrkvid': (560, 190),
    'selenar': (820, 600), 'berenice': (610, 560), 'corbeaux': (1060, 620),
}

def clip(subject, a, b, c):
    """Garde la partie du polygone où a*x + b*y <= c (Sutherland-Hodgman)."""
    out = []
    for i in range(len(subject)):
        p, q = subject[i], subject[(i + 1) % len(subject)]
        fp, fq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if fp <= 0: out.append(p)
        if (fp < 0) != (fq < 0) and fp != fq:
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out

land = coast()
cells, raw = {}, {}
for k, (x, y) in SEEDS.items():
    poly = land[:]
    box = [(0, 0), (W, 0), (W, H), (0, H)]
    for k2, (x2, y2) in SEEDS.items():
        if k2 == k: continue
        a, b = x2 - x, y2 - y
        c = (x2 * x2 + y2 * y2 - x * x - y * y) / 2
        poly = clip(poly, a, b, c)
        box = clip(box, a, b, c)
    cells[k] = [(round(px, 1), round(py, 1)) for px, py in poly]
    raw[k] = box

# Voisins : deux cellules de Voronoï partagent une arête d'au moins 30 px à l'intérieur des terres
def shared_len(k1, k2):
    (x1, y1), (x2, y2) = SEEDS[k1], SEEDS[k2]
    a, b = x2 - x1, y2 - y1
    c = (x2 * x2 + y2 * y2 - x1 * x1 - y1 * y1) / 2
    norm = math.hypot(a, b)
    total = 0.0
    poly = cells[k1]
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]
        if abs(a * p[0] + b * p[1] - c) / norm < 1 and abs(a * q[0] + b * q[1] - c) / norm < 1:
            total += math.dist(p, q)
    return total

keys = list(SEEDS)
neighbors = {k: [] for k in keys}
for i, k1 in enumerate(keys):
    for k2 in keys[i + 1:]:
        if shared_len(k1, k2) >= 30:
            neighbors[k1].append(k2); neighbors[k2].append(k1)

def centroid(poly):
    A = cx = cy = 0
    for i in range(len(poly)):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % len(poly)]
        f = x0 * y1 - x1 * y0
        A += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f
    A /= 2
    return (round(cx / (6 * A)), round(cy / (6 * A)))

out = {
    'width': W, 'height': H, 'coast': land,
    'territories': {k: {'polygon': cells[k], 'center': centroid(cells[k]), 'neighbors': sorted(neighbors[k])} for k in keys},
}
path = os.path.join(os.path.dirname(__file__), '..', 'shared', 'src', 'data', 'map-geometry.json')
with open(path, 'w') as f: json.dump(out, f)
for k in keys: print(k, out['territories'][k]['center'], neighbors[k])
