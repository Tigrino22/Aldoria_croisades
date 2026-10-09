#!/usr/bin/env python3
"""Logo « Aldoria » (512x128 dessiné -> 1024x256 x2 au plus proche voisin) et icônes PWA
(blason de l'Aube sur fond sombre, 128 px -> 512 et 96 px -> 192).
Prérequis : factions/aube.png doit exister (node tools/art/render.mjs factions/).
Usage : python3 tools/art/logo.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, '..', '..', 'client', 'public', 'assets')
FONTS = ['/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf']
font_path = next(f for f in FONTS if os.path.exists(f))

# ------------------------------------------------------------ logo
W, H = 512, 128
font = ImageFont.truetype(font_path, 104)
mask = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(mask)
bb = d.textbbox((0, 0), 'Aldoria', font=font)
x = (W - (bb[2] - bb[0])) // 2 - bb[0]; y = (H - (bb[3] - bb[1])) // 2 - bb[1]
d.text((x, y), 'Aldoria', font=font, fill=255)
m = np.asarray(mask, dtype=np.float64) / 255
# relief : biseau par différence de flous décalés
hgt = np.asarray(mask.filter(ImageFilter.GaussianBlur(2.5)), dtype=np.float64) / 255
gx = np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1); gy = np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)
light = np.clip(0.55 - (gx * 2.2 + gy * 2.8), 0, 1)
yy = np.linspace(0, 1, H)[:, None] * np.ones((1, W))
top = np.array([250, 222, 140]); bot = np.array([150, 92, 36])
base = top * (1 - yy[..., None]) + bot * yy[..., None]
rng = np.random.default_rng(3)
grain = (rng.random((H // 2, W // 2)) - 0.5)
grain = np.asarray(Image.fromarray(((grain + 0.5) * 255).astype(np.uint8)).resize((W, H), Image.NEAREST), dtype=np.float64) / 255 - 0.5
col = base * (0.55 + 0.9 * light[..., None]) * (1 + grain[..., None] * 0.12)
# bandeau de reflet
col += (np.exp(-((yy - 0.42) ** 2) / 0.004) * 50)[..., None]
col = np.clip(col, 0, 255)
alpha = (m > 0.5)
# contour 2 px sombre + ombre portée
grow = np.asarray(mask.filter(ImageFilter.MaxFilter(5)), dtype=np.float64) / 255 > 0.5
shadow = np.roll(np.roll(grow, 4, 0), 3, 1)
out = np.zeros((H, W, 4))
out[shadow] = [10, 6, 4, 150]
out[grow] = [34, 20, 10, 255]
inner = np.asarray(mask.filter(ImageFilter.MinFilter(3)), dtype=np.float64) / 255 > 0.5
out[alpha] = np.dstack([col, np.full((H, W), 255)])[alpha]
edge = alpha & ~inner
out[edge, :3] = out[edge, :3] * 0.75
im = Image.fromarray(out.astype(np.uint8), 'RGBA')
rgb = im.convert('RGB').quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
im = Image.merge('RGBA', (*rgb.split(), im.split()[3]))
im.resize((W * 2, H * 2), Image.NEAREST).save(os.path.join(A, 'logo.png'), optimize=True)

# ------------------------------------------------------------ icônes PWA
crest = Image.open(os.path.join(A, 'factions', 'aube.png')).convert('RGBA')
crest128 = crest.resize((128, 128), Image.NEAREST)  # pixels dessinés d'origine (x4)
os.makedirs(os.path.join(A, 'icons'), exist_ok=True)
def icon(n, k, path):
    bg = Image.new('RGBA', (n, n))
    yy, xx = np.mgrid[0:n, 0:n] / n
    r = np.sqrt((xx - 0.5) ** 2 + (yy - 0.45) ** 2)
    c = np.array([58, 40, 26]) * (1 - r[..., None] * 1.3) + np.array([14, 10, 8]) * r[..., None] * 1.3
    c = np.clip(c, 10, 255)
    # bordure dorée
    br = (np.maximum(np.abs(xx - 0.5), np.abs(yy - 0.5)) > 0.47)
    c[br] = [176, 128, 52]
    bg = Image.fromarray(np.dstack([c, np.full((n, n), 255)]).astype(np.uint8), 'RGBA')
    s = int(n * 0.86)
    cr = crest128.resize((s, s), Image.BOX) if s != 128 else crest128
    a = np.asarray(cr)[..., 3]
    cr.putalpha(Image.fromarray(((a > 110) * 255).astype(np.uint8)))
    bg.alpha_composite(cr, ((n - s) // 2, (n - s) // 2 + n // 40))
    rgb = bg.convert('RGB').quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    rgb.resize((n * k, n * k), Image.NEAREST).save(path, optimize=True)
icon(128, 4, os.path.join(A, 'icons', 'icon-512.png'))
icon(96, 2, os.path.join(A, 'icons', 'icon-192.png'))
print('ok')
