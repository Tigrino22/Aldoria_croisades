#!/usr/bin/env python3
"""Planche contact des 12 portraits (une ligne par faction).
Usage : portraits_sheet.py sortie.png [largeur]"""
import sys, os
from PIL import Image
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../client/public/assets/portraits')
out = sys.argv[1]; W = int(sys.argv[2]) if len(sys.argv) > 2 else 1600
names = [f'{f}-{i}' for f in ('aube', 'sables', 'givre') for i in range(1, 5)]
ims = [Image.open(os.path.join(D, n + '.jpg')).convert('RGB') for n in names]
cols = 6 if W >= 1400 else 4
tw = (W - (cols + 1) * 8) // cols; th = tw * 640 // 512
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (W, rows * th + (rows + 1) * 8), (18, 14, 12))
for k, im in enumerate(ims):
    r, c = divmod(k, cols)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (8 + c * (tw + 8), 8 + r * (th + 8)))
sheet.save(out)
