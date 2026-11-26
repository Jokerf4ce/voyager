#!/usr/bin/env python3
"""
Voyager — ship sprite generator.

Every ship is a tiny low-poly model (boxes, wedges and plates). It is drawn in a 3/4 view (nose toward the
viewer, lower left) with flat shading and a depth buffer at 4x resolution, then reduced to pixel art: each
pixel takes the colour of the face that covers most of it, faces get 1 px panel lines where they meet, the
silhouette gets a dark outline and a rim light, and engines get a dithered glow.

The sprites are colourless templates: every pixel is a grey level that stands for one material and shade
(hull, metal, accent, glass, glow, void, halo, outline). The game recolours them on the fly with any palette
(DATA.shipPalettes in js/data.js), so one image per ship type serves every faction.

Output:
  assets/ships/<type>.png   the grey templates (to look at)
  js/shipsprites.js         the same templates as data URIs plus the grey -> (material, shade) table,
                            so the game can read the pixels even when opened straight from disk

Run from the repository root:  python3 tools/shipart/render.py   (needs numpy and Pillow)
All ships share one scale (PXU pixels per model unit), so a Battleship really is bigger than a Fighter.
"""
import math, os, sys
import numpy as np
from PIL import Image

SS = 4            # supersampling factor
PXU = 50          # final pixels per model unit
PITCH = -38       # camera looks down at the ship
VIEW = -145      # yaw: nose toward the viewer, lower left
LIGHT = np.array([-0.45, 0.8, -0.4]); LIGHT /= np.linalg.norm(LIGHT)   # upper left, toward the viewer

# Shades per material (dark -> light). The template gives each (material, shade) its own grey level,
# close to how bright it looks in the Covenant palette, so the template still reads as a ship.
RAMP_SIZES = {'hull': 7, 'metal': 6, 'accent': 5, 'glass': 6, 'glow': 2, 'void': 1, 'halo': 2, 'outline': 1}
LOOK = {  # brightness reference for the grey levels (the Covenant colours)
    'hull':   ['#1c1814', '#3a332b', '#5a5145', '#7e7464', '#a89c86', '#d2c6aa', '#ece2c8'],
    'metal':  ['#121010', '#26221e', '#3c3630', '#56504a', '#787068', '#9a9088'],
    'accent': ['#3a140c', '#6a2414', '#9a3a1e', '#c0592e', '#e0804a'],
    'glass':  ['#081014', '#10232c', '#1c3a46', '#2e5a68', '#5aa0b0', '#a8e0e8'],
    'glow':   ['#ffb050', '#ffd890'], 'void': ['#050404'], 'halo': ['#ff7a30', '#c03018'], 'outline': ['#0a0807'],
}

def build_template():
    used, table, pal = set(), {}, {}
    for mat, n in RAMP_SIZES.items():
        pal[mat] = []
        for i in range(n):
            r, g, b = (int(LOOK[mat][i][k:k + 2], 16) for k in (1, 3, 5))
            v0 = int(round(0.3 * r + 0.59 * g + 0.11 * b))
            v = next(c for d in range(256) for c in (v0 + d, v0 - d) if 1 <= c <= 254 and c not in used)  # nearest free grey
            used.add(v); table[v] = [mat, i]
            pal[mat].append('#%02x%02x%02x' % (v, v, v))
    pal['halo'] = tuple(pal['halo'])
    return pal, table

TEMPLATE, GREY_TABLE = build_template()

def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

# ---------------------------------------------------------------- geometry (x right, y up, z = nose)
FACES = [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 3, 7, 4)]

class Model:
    def __init__(self): self.parts, self.exhausts = [], []

    def block(self, x0, x1, y0, y1, z0, z1, mat='hull', fs=(1, 1), sh=(0, 0), over=None):
        """a box from z0 (back) to z1 (front); the front face can be scaled (fs) and shifted (sh)"""
        cx, cy, hx, hy = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        v = [(cx - hx, cy - hy, z0), (cx + hx, cy - hy, z0), (cx + hx, cy + hy, z0), (cx - hx, cy + hy, z0),
             (cx + sh[0] - hx * fs[0], cy + sh[1] - hy * fs[1], z1), (cx + sh[0] + hx * fs[0], cy + sh[1] - hy * fs[1], z1),
             (cx + sh[0] + hx * fs[0], cy + sh[1] + hy * fs[1], z1), (cx + sh[0] - hx * fs[0], cy + sh[1] + hy * fs[1], z1)]
        self.parts.append((v, mat, over or {}))

    def plate(self, side, rx, rz0, rz1, tx, tz0, tz1, y=0.0, t=0.02, mat='hull'):
        """a thin swept plate (wing, fin): root at x = side*rx, tip at x = side*tx"""
        r, tip = side * rx, side * tx
        v = [(r, y - t, rz0), (tip, y - t, tz0), (tip, y + t, tz0), (r, y + t, rz0),
             (r, y - t, rz1), (tip, y - t, tz1), (tip, y + t, tz1), (r, y + t, rz1)]
        self.parts.append((v, mat, {}))

    def spike(self, x, y, z, w, length, mat='metal', up=0.0, out=0.0):
        """a tapering spike pointing forward (and optionally up/out)"""
        self.block(x - w, x + w, y - w, y + w, z, z + length, mat, (0.05, 0.05), (out, up))

    def egg(self, rx, ry, z0, z1, mat='hull', x=0.0, y=0.0, taper=0.4, mid=0.5):
        """a rounded body: two blocks meeting at their widest point, tapering to both ends"""
        zm = z0 + (z1 - z0) * mid
        self.block(x - rx, x + rx, y - ry, y + ry, zm, z1, mat, (taper, taper))
        self.block(x - rx, x + rx, y - ry, y + ry, zm, z0, mat, (taper * 0.8, taper * 0.8))

    def turret(self, x, y, z, size=0.06, barrel=0.28, twin=True):
        self.block(x - size, x + size, y, y + size * 0.6, z - size, z + size, 'metal')
        self.block(x - size * 0.7, x + size * 0.7, y + size * 0.6, y + size * 1.2, z - size * 0.6, z + size * 0.9, 'hull', (0.85, 0.7))
        bt = max(0.016, size * 0.22)
        for bx in ((-size * 0.3, size * 0.3) if twin else (0,)):
            self.block(x + bx - bt, x + bx + bt, y + size * 0.7, y + size * 0.7 + 2 * bt, z + size * 0.8, z + size + barrel, 'metal')

    def engine(self, x, y, z, w=0.09, h=0.09, length=0.3):
        self.block(x - w, x + w, y - h, y + h, z - length, z, 'metal', (0.9, 0.9), over={0: 'glow'})
        self.exhausts.append((x, y, z - length - 0.02))

    def gunpod(self, x, y, z0, z1, w=0.05, barrel=0.3, twin=True):
        self.block(x - w, x + w, y - w * 0.9, y + w * 0.9, z0, z1, 'metal')
        for bx in ((-w * 0.45, w * 0.45) if twin else (0,)):
            self.block(x + bx - 0.013, x + bx + 0.013, y - 0.013, y + 0.013, z1, z1 + barrel, 'metal')

# ---------------------------------------------------------------- the ships
def scout(m):
    m.block(-0.09, 0.09, -0.05, 0.05, -0.45, 0.2)
    m.block(-0.09, 0.09, -0.05, 0.05, 0.2, 0.62, 'hull', (0.2, 0.3), (0, -0.02))                 # needle nose
    m.block(-0.055, 0.055, 0.05, 0.11, -0.05, 0.28, 'glass', (0.6, 0.3), (0, -0.02))
    m.block(-0.06, 0.06, 0.05, 0.09, -0.4, -0.05, 'hull', (0.9, 0.6))
    for sd in (-1, 1):
        m.plate(sd, 0.08, -0.4, -0.08, 0.36, -0.5, -0.36, -0.01, 0.015)
        m.block(sd * 0.34 - 0.03 if sd > 0 else -0.37, sd * 0.34 + 0.03 if sd > 0 else -0.31, -0.03, 0.01, -0.52, -0.34, 'accent')
        m.block(sd * 0.05 - 0.01, sd * 0.05 + 0.01, 0.05, 0.18, -0.45, -0.28, 'hull', (1, 0.4), (0, -0.04))
    m.block(-0.012, 0.012, -0.08, -0.05, 0.1, 0.5, 'metal')                                          # sensor lance
    m.engine(0, 0, -0.45, 0.07, 0.05, 0.12)

def fighter(m):
    m.block(-0.17, 0.17, -0.07, 0.07, -0.55, 0.15)
    m.block(-0.17, 0.17, -0.07, 0.07, 0.15, 0.62, 'hull', (0.55, 0.45), (0, -0.02))
    m.block(-0.11, 0.11, 0.07, 0.15, -0.35, 0.18, 'hull', (0.8, 0.6), (0, -0.02))
    m.block(-0.085, 0.085, 0.07, 0.17, 0.0, 0.34, 'glass', (0.7, 0.35), (0, -0.03))
    m.block(-0.06, 0.06, 0.055, 0.075, 0.42, 0.52, 'accent', (0.7, 1))
    m.block(-0.012, 0.012, 0.165, 0.185, 0.0, 0.3, 'metal', (1, 0.4), (0, -0.04))
    m.block(-0.03, 0.03, 0.15, 0.18, -0.5, 0.0)
    for sd in (-1, 1):
        m.plate(sd, 0.16, -0.45, 0.05, 0.62, -0.62, -0.38, -0.01, 0.018)
        tx = sd * 0.6
        m.block(min(tx, tx + sd * 0.1), max(tx, tx + sd * 0.1), -0.035, 0.015, -0.66, -0.38, 'accent')
        m.engine(sd * 0.25, 0.01, -0.12, 0.08, 0.07, 0.56)
        m.gunpod(sd * 0.22, -0.05, -0.05, 0.42, 0.055, 0.3)
        m.block(sd * 0.19 - 0.035, sd * 0.19 + 0.035, -0.04, 0.06, -0.3, 0.1, 'metal', (1, 0.8), over={1: 'void'})
        m.block(sd * 0.1 - 0.012, sd * 0.1 + 0.012, 0.07, 0.24, -0.55, -0.32, 'hull', (1, 0.5), (0, -0.04))

def heavy(m):
    m.block(-0.22, 0.22, -0.09, 0.09, -0.6, 0.2)
    m.block(-0.22, 0.22, -0.09, 0.09, 0.2, 0.6, 'hull', (0.6, 0.5), (0, -0.02))
    m.block(-0.14, 0.14, 0.09, 0.18, -0.45, 0.15, 'hull', (0.85, 0.7))
    m.block(-0.09, 0.09, 0.09, 0.19, 0.05, 0.32, 'glass', (0.75, 0.4), (0, -0.03))
    m.block(-0.24, 0.24, 0.07, 0.1, -0.2, 0.0, 'accent')                                             # armour band
    for sd in (-1, 1):
        m.plate(sd, 0.2, -0.5, -0.05, 0.52, -0.6, -0.4, -0.02, 0.025)
        m.block(sd * 0.5 - 0.04 if sd > 0 else -0.54, sd * 0.5 + 0.04 if sd > 0 else -0.46, -0.05, 0.03, -0.62, -0.38, 'accent')
        m.engine(sd * 0.16, -0.01, -0.6, 0.09, 0.08, 0.15)
        m.gunpod(sd * 0.3, -0.06, -0.15, 0.35, 0.06, 0.28)
        m.gunpod(sd * 0.44, -0.05, -0.4, -0.05, 0.045, 0.2, twin=False)                              # wing guns
        m.block(sd * 0.12 - 0.014, sd * 0.12 + 0.014, 0.09, 0.26, -0.6, -0.38, 'hull', (1, 0.5), (0, -0.04))

def corvette(m):
    m.block(-0.2, 0.2, -0.1, 0.07, -0.75, 0.3)
    m.block(-0.2, 0.2, -0.1, 0.07, 0.3, 0.85, 'hull', (0.3, 0.45), (0, -0.03))
    m.block(-0.14, 0.14, -0.16, -0.1, -0.7, 0.6, 'metal', (0.5, 1))
    m.block(-0.11, 0.11, 0.07, 0.18, -0.45, -0.05, 'hull', (0.8, 1))
    m.block(-0.08, 0.08, 0.13, 0.17, -0.06, -0.03, 'glass')
    m.turret(0, 0.07, 0.3, 0.085, 0.3)
    for sd in (-1, 1):
        m.plate(sd, 0.18, -0.75, -0.3, 0.46, -0.85, -0.62, -0.02, 0.022)                             # swept fins
        m.block(sd * 0.44 - 0.035 if sd > 0 else -0.475, sd * 0.44 + 0.035 if sd > 0 else -0.405, -0.04, 0.0, -0.86, -0.62, 'accent')
        m.block(sd * 0.21 - 0.012, sd * 0.21 + 0.012, -0.06, 0.06, -0.5, 0.2, 'accent')
        m.engine(sd * 0.12, -0.02, -0.75, 0.085, 0.075, 0.18)
    m.block(-0.012, 0.012, 0.18, 0.36, -0.3, -0.26, 'metal')

def frigate(m):
    m.block(-0.26, 0.26, -0.12, 0.08, -0.9, 0.35)
    m.block(-0.26, 0.26, -0.12, 0.08, 0.35, 0.95, 'hull', (0.35, 0.5), (0, -0.03))
    m.block(-0.18, 0.18, -0.2, -0.12, -0.8, 0.7, 'metal', (0.5, 1))
    for sd in (-1, 1):
        x = sd * 0.29
        m.block(x - 0.035, x + 0.035, -0.1, 0.05, -0.75, 0.3, 'metal')
        m.block(x - 0.037, x + 0.037, 0.04, 0.06, -0.6, 0.15, 'accent')
    m.block(-0.14, 0.14, 0.08, 0.2, -0.45, 0.0, 'hull', (0.85, 1))
    m.block(-0.09, 0.09, 0.2, 0.31, -0.38, -0.1, 'hull', (0.8, 1))
    m.block(-0.07, 0.07, 0.25, 0.3, -0.1, -0.06, 'glass')
    m.block(-0.012, 0.012, 0.31, 0.5, -0.3, -0.26, 'metal')
    m.turret(0, 0.08, 0.3, 0.1, 0.34)
    m.turret(0, 0.08, 0.62, 0.08, 0.26)
    for sd in (-1, 1):
        m.block(min(sd * 0.27, sd * 0.42), max(sd * 0.27, sd * 0.42), -0.07, 0.03, 0.0, 0.3, 'metal')
        m.turret(sd * 0.35, 0.03, 0.15, 0.06, 0.22)
    m.block(-0.3, 0.3, -0.14, 0.12, -1.05, -0.85, 'metal')
    m.block(-0.31, 0.31, 0.06, 0.13, -1.0, -0.9, 'accent')
    for x in (-0.18, 0, 0.18): m.engine(x, -0.02, -1.05, 0.075, 0.075, 0.14)

def gunboat(m):
    m.block(-0.34, 0.34, -0.14, 0.08, -0.75, 0.45)                                                   # a squat brick
    m.block(-0.34, 0.34, -0.14, 0.08, 0.45, 0.75, 'hull', (0.75, 0.6), (0, -0.03))
    m.block(-0.26, 0.26, -0.22, -0.14, -0.7, 0.6, 'metal', (0.7, 1))
    m.block(-0.36, 0.36, 0.06, 0.1, -0.7, -0.55, 'accent')
    m.block(-0.36, 0.36, 0.06, 0.1, 0.3, 0.42, 'accent')
    m.block(-0.12, 0.12, 0.08, 0.2, -0.65, -0.35, 'hull', (0.85, 1))
    m.block(-0.09, 0.09, 0.15, 0.19, -0.36, -0.33, 'glass')
    for z in (-0.18, 0.12, 0.45): m.turret(0, 0.08, z, 0.1, 0.3)
    for sd in (-1, 1):
        m.block(sd * 0.37 - 0.04 if sd > 0 else -0.41, sd * 0.37 + 0.04 if sd > 0 else -0.33, -0.12, 0.05, -0.6, 0.55, 'metal')
        m.engine(sd * 0.18, -0.03, -0.75, 0.1, 0.09, 0.14)

def destroyer(m):
    m.block(-0.26, 0.26, -0.13, 0.08, -1.3, 0.5)                                                     # long and lean
    m.block(-0.26, 0.26, -0.13, 0.08, 0.5, 1.35, 'hull', (0.2, 0.45), (0, -0.04))
    m.block(-0.18, 0.18, -0.21, -0.13, -1.2, 1.0, 'metal', (0.4, 1))
    for sd in (-1, 1):
        m.block(sd * 0.27 - 0.03 if sd > 0 else -0.3, sd * 0.27 + 0.03 if sd > 0 else -0.24, -0.11, 0.06, -1.2, 0.45, 'metal')
        m.block(sd * 0.272 - 0.032 if sd > 0 else -0.304, sd * 0.272 + 0.032 if sd > 0 else -0.24, 0.05, 0.075, -1.0, 0.2, 'accent')
        for z in (-0.75, -0.55): m.block(sd * 0.18 - 0.04, sd * 0.18 + 0.04, 0.08, 0.14, z - 0.08, z + 0.08, 'metal', over={1: 'void'})   # torpedo tubes
    m.block(-0.15, 0.15, 0.08, 0.22, -0.4, 0.1, 'hull', (0.85, 1))
    m.block(-0.1, 0.1, 0.22, 0.36, -0.32, 0.0, 'hull', (0.8, 1))
    m.block(-0.08, 0.08, 0.3, 0.35, 0.0, 0.03, 'glass')
    m.block(-0.012, 0.012, 0.36, 0.58, -0.25, -0.21, 'metal')
    m.turret(0, 0.08, 0.45, 0.11, 0.38)
    m.turret(0, 0.08, 0.85, 0.09, 0.32)
    m.turret(0, 0.08, -0.85, 0.08, 0.26)
    m.block(-0.3, 0.3, -0.15, 0.13, -1.45, -1.25, 'metal')
    m.block(-0.31, 0.31, 0.07, 0.14, -1.4, -1.3, 'accent')
    for x in (-0.18, 0, 0.18): m.engine(x, -0.02, -1.45, 0.08, 0.08, 0.12)

def battleship(m):
    m.block(-0.42, 0.42, -0.18, 0.1, -1.35, 0.6)
    m.block(-0.42, 0.42, -0.18, 0.1, 0.6, 1.25, 'hull', (0.4, 0.55), (0, -0.04))
    m.block(-0.06, 0.06, -0.16, 0.0, 1.25, 1.45, 'metal', (0.3, 0.5))
    m.block(-0.3, 0.3, -0.3, -0.18, -1.2, 1.0, 'metal', (0.5, 1))
    for sd in (-1, 1):
        x = sd * 0.45
        m.block(x - 0.04, x + 0.04, -0.16, 0.06, -1.25, 0.7, 'metal')
        m.block(x - 0.042, x + 0.042, 0.04, 0.07, -1.1, 0.5, 'accent')
    m.block(-0.26, 0.26, 0.1, 0.24, -0.95, 0.15, 'hull', (0.9, 1))
    m.block(-0.18, 0.18, 0.24, 0.38, -0.8, -0.05, 'hull', (0.85, 1))
    m.block(-0.11, 0.11, 0.38, 0.52, -0.65, -0.2, 'hull', (0.8, 1))
    m.block(-0.09, 0.09, 0.46, 0.5, -0.2, -0.17, 'glass')
    m.block(-0.03, 0.03, 0.52, 0.85, -0.5, -0.4, 'metal', (0.3, 1))
    for sd in (-1, 1): m.block(sd * 0.2 - 0.04, sd * 0.2 + 0.04, 0.24, 0.48, -0.95, -0.85, 'metal', (0.5, 1))
    m.turret(0, 0.1, 0.5, 0.14, 0.45)
    m.turret(0, 0.1, 0.95, 0.11, 0.36)
    m.turret(0, 0.24, 0.28, 0.1, 0.32)
    for sd in (-1, 1):
        for z in (-0.45, 0.15): m.turret(sd * 0.33, 0.1, z, 0.07, 0.2)
    m.block(-0.44, 0.44, -0.22, 0.16, -1.6, -1.35, 'metal')
    m.block(-0.45, 0.45, 0.1, 0.17, -1.55, -1.42, 'accent')
    for x in (-0.3, -0.1, 0.1, 0.3): m.engine(x, -0.04, -1.6, 0.08, 0.1, 0.12)

def carrier(m):
    m.block(-0.48, 0.48, -0.16, 0.06, -1.3, 1.0)                                                     # flight deck slab
    m.block(-0.48, 0.48, -0.16, 0.06, 1.0, 1.25, 'hull', (0.85, 0.6), (0, -0.03))
    m.block(-0.38, 0.38, -0.28, -0.16, -1.2, 1.1, 'metal', (0.8, 1))
    m.block(-0.34, 0.34, -0.12, 0.02, 1.1, 1.24, 'void')                                             # hangar mouth
    for z in (-1.0, -0.6, -0.2, 0.2, 0.6): m.block(-0.03, 0.03, 0.06, 0.075, z, z + 0.22, 'accent')   # deck centre line
    for sd in (-1, 1): m.block(sd * 0.46 - 0.02 if sd > 0 else -0.48, sd * 0.46 + 0.02 if sd > 0 else -0.44, 0.06, 0.08, -1.25, 1.2, 'accent')
    # the island: a tall tower on the right side
    m.block(0.24, 0.42, 0.06, 0.3, -0.7, -0.1, 'hull', (0.85, 1))
    m.block(0.27, 0.39, 0.3, 0.46, -0.6, -0.25, 'hull', (0.8, 1))
    m.block(0.27, 0.39, 0.38, 0.44, -0.25, -0.22, 'glass')
    m.block(0.32, 0.35, 0.46, 0.68, -0.5, -0.46, 'metal')
    m.turret(-0.3, 0.06, -0.9, 0.07, 0.2)
    m.turret(-0.3, 0.06, 0.4, 0.07, 0.2)
    m.block(-0.46, 0.46, -0.2, 0.1, -1.5, -1.3, 'metal')
    for x in (-0.3, -0.1, 0.1, 0.3): m.engine(x, -0.05, -1.5, 0.08, 0.08, 0.1)

# monsters: hull = flesh, metal = bone, accent = sinew, glass = eyes
def lurker(m):
    m.egg(0.2, 0.13, -0.5, 0.42, 'hull', taper=0.45, mid=0.55)
    m.egg(0.1, 0.06, -0.4, 0.25, 'accent', y=0.1, taper=0.3)                                         # dorsal sinew
    for sd in (-1, 1):
        m.block(sd * 0.09 - 0.035, sd * 0.09 + 0.035, 0.02, 0.09, 0.3, 0.38, 'glass')                # eyes
        m.spike(sd * 0.1, -0.06, 0.32, 0.035, 0.4, 'metal', -0.03, sd * 0.05)                        # claws
        m.spike(sd * 0.16, -0.03, 0.05, 0.03, 0.36, 'metal', -0.04, sd * 0.28)
        m.spike(sd * 0.15, -0.02, -0.25, 0.03, 0.32, 'accent', -0.02, sd * 0.26)                     # legs
    for z in (-0.3, -0.1, 0.1): m.spike(0, 0.12, z, 0.035, 0.16, 'metal', 0.13, 0)                     # back spines
    m.spike(0, -0.02, -0.45, 0.05, -0.32, 'accent', -0.02, 0)                                         # tail

def maw(m):
    m.egg(0.38, 0.22, -0.75, 0.5, 'hull', taper=0.55, mid=0.6)
    m.egg(0.2, 0.08, -0.6, 0.3, 'accent', y=0.18, taper=0.35)
    m.block(-0.2, 0.2, -0.1, 0.06, 0.44, 0.5, 'void')                                                 # the mouth
    for sd in (-1, 1):
        m.spike(sd * 0.2, 0.0, 0.4, 0.07, 0.55, 'metal', -0.05, -sd * 0.12)                           # mandibles
        m.spike(sd * 0.17, -0.1, 0.38, 0.05, 0.36, 'metal', -0.06, -sd * 0.1)
        for z in (-0.5, -0.2, 0.1): m.spike(sd * 0.32, -0.06, z, 0.045, 0.28, 'metal', -0.03, sd * 0.3)
        m.block(sd * 0.15 - 0.045, sd * 0.15 + 0.045, 0.1, 0.18, 0.34, 0.42, 'glass')
    for z in (-0.55, -0.3, -0.05, 0.2): m.spike(0, 0.2, z, 0.055, 0.22, 'metal', 0.17, 0)

def leviathan(m):
    # a segmented serpent: a great head, then rounded segments shrinking toward the tail
    zs = [(0.45, 1.1, 0.42), (-0.15, 0.55, 0.38), (-0.7, -0.05, 0.31), (-1.15, -0.6, 0.24), (-1.5, -1.05, 0.17)]
    for i, (z0, z1, r) in enumerate(zs):
        m.egg(r, r * 0.62, z0, z1, 'hull', taper=0.7)
        m.egg(r * 0.45, r * 0.2, z0 + 0.05, z1 - 0.05, 'accent', y=r * 0.5, taper=0.5)
        m.spike(0, r * 0.55, z0 + 0.12, 0.05, 0.3, 'metal', r * 0.55, 0)
        for sd in (-1, 1): m.spike(sd * r * 0.85, 0, (z0 + z1) / 2, 0.04, 0.3, 'metal', -0.05, sd * 0.28)
    m.egg(0.36, 0.22, 1.0, 1.45, 'hull', taper=0.55, mid=0.4)
    m.block(-0.2, 0.2, -0.1, 0.04, 1.38, 1.42, 'void')
    for sd in (-1, 1):
        m.spike(sd * 0.26, -0.05, 1.2, 0.07, 0.55, 'metal', -0.06, -sd * 0.06)                        # tusks
        m.block(sd * 0.17 - 0.05, sd * 0.17 + 0.05, 0.1, 0.18, 1.18, 1.28, 'glass')
    m.spike(0, 0, -1.45, 0.08, -0.45, 'accent', 0, 0)

def defense(m):
    # an orbital bastion: a squat hub, four armoured arms, guns on top, a central spire
    m.block(-0.3, 0.3, -0.18, 0.12, -0.3, 0.3)
    m.block(-0.2, 0.2, 0.12, 0.26, -0.2, 0.2, 'hull', (0.85, 1))
    m.block(-0.03, 0.03, 0.26, 0.6, -0.03, 0.03, 'metal', (0.4, 1))
    m.block(-0.12, 0.12, 0.2, 0.24, 0.19, 0.21, 'glass')
    for (x0, x1, z0, z1) in ((-0.75, -0.3, -0.12, 0.12), (0.3, 0.75, -0.12, 0.12), (-0.12, 0.12, 0.3, 0.75), (-0.12, 0.12, -0.75, -0.3)):
        m.block(x0, x1, -0.1, 0.06, z0, z1, 'metal')
    for (x, z) in ((-0.65, 0), (0.65, 0), (0, 0.65), (0, -0.65)):
        m.block(x - 0.1, x + 0.1, -0.12, 0.1, z - 0.1, z + 0.1, 'hull')
        m.block(x - 0.105, x + 0.105, 0.06, 0.1, z - 0.105, z + 0.105, 'accent')
        m.turret(x, 0.1, z, 0.07, 0.22)
    m.turret(0, 0.26, 0.05, 0.09, 0.28)

MODELS = {'scout': scout, 'fighter': fighter, 'heavy': heavy, 'corvette': corvette, 'frigate': frigate,
          'gunboat': gunboat, 'destroyer': destroyer, 'battleship': battleship, 'carrier': carrier,
          'lurker': lurker, 'maw': maw, 'leviathan': leviathan, 'defense': defense}

# ---------------------------------------------------------------- rendering
def render(model_fn, pal, yaw_deg):
    m = Model(); model_fn(m)
    yaw, pitch = math.radians(yaw_deg), math.radians(PITCH)
    def rot(v):
        x, y, z = v
        x, z = x * math.cos(yaw) + z * math.sin(yaw), -x * math.sin(yaw) + z * math.cos(yaw)
        y, z = y * math.cos(pitch) - z * math.sin(pitch), y * math.sin(pitch) + z * math.cos(pitch)
        return np.array([x, y, z])

    faces = []
    for verts, mat, over in m.parts:
        P = [rot(v) for v in verts]
        C = sum(P) / 8
        for fi, f in enumerate(FACES):
            q = [P[i] for i in f]
            n = np.cross(q[1] - q[0], q[2] - q[0])
            if np.linalg.norm(n) < 1e-9: n = np.cross(q[2] - q[0], q[3] - q[0])
            if np.linalg.norm(n) < 1e-9: continue
            n = n / np.linalg.norm(n)
            if np.dot(n, sum(q) / 4 - C) < 0: n = -n
            if n[2] > 0.02: continue                       # facing away
            faces.append((q, n, over.get(fi, mat)))

    pxu = PXU * SS
    pts = np.array([[p[0], p[1]] for q, n, mt in faces for p in q] + [list(rot(e))[:2] for e in m.exhausts] or [[0, 0]])
    minx, maxy = pts[:, 0].min(), pts[:, 1].max()
    ox, oy = -minx * pxu + 2 * SS, maxy * pxu + 2 * SS
    W = int((pts[:, 0].max() - minx) * pxu) + 4 * SS
    H = int((maxy - pts[:, 1].min()) * pxu) + 4 * SS
    W, H = (W + SS - 1) // SS * SS, (H + SS - 1) // SS * SS
    zbuf = np.full((H, W), np.inf); fid = np.full((H, W), -1, int)
    colours = []
    for k, (q, n, mt) in enumerate(faces):
        ramp = pal[mt]
        lam = max(0.0, float(np.dot(n, LIGHT)))
        idx = min(len(ramp) - 1, 1 if lam > 0.2 else 0) if mt in ('glow', 'void') else min(len(ramp) - 1, int(round((0.18 + 0.82 * lam) * (len(ramp) - 1))))
        colours.append((mt, idx))
        S = [np.array([ox + p[0] * pxu, oy - p[1] * pxu, p[2]]) for p in q]
        for tri in ((S[0], S[1], S[2]), (S[0], S[2], S[3])):
            (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = tri
            den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
            if abs(den) < 1e-9: continue
            bx0, bx1 = max(0, int(min(x0, x1, x2))), min(W - 1, int(max(x0, x1, x2)) + 1)
            by0, by1 = max(0, int(min(y0, y1, y2))), min(H - 1, int(max(y0, y1, y2)) + 1)
            if bx1 < bx0 or by1 < by0: continue
            X, Y = np.meshgrid(np.arange(bx0, bx1 + 1) + 0.5, np.arange(by0, by1 + 1) + 0.5)
            a1 = ((y1 - y2) * (X - x2) + (x2 - x1) * (Y - y2)) / den
            a2 = ((y2 - y0) * (X - x2) + (x0 - x2) * (Y - y2)) / den
            a3 = 1 - a1 - a2
            inside = (a1 >= -1e-6) & (a2 >= -1e-6) & (a3 >= -1e-6)
            Z = a1 * z0 + a2 * z1 + a3 * z2
            sz, sf = zbuf[by0:by1 + 1, bx0:bx1 + 1], fid[by0:by1 + 1, bx0:bx1 + 1]
            upd = inside & (Z < sz)
            sz[upd] = Z[upd]; sf[upd] = k

    # reduce: each pixel takes the face covering most of it
    nh, nw = H // SS, W // SS
    blocks = fid.reshape(nh, SS, nw, SS).transpose(0, 2, 1, 3).reshape(nh, nw, SS * SS)
    zb = zbuf.reshape(nh, SS, nw, SS).transpose(0, 2, 1, 3).reshape(nh, nw, SS * SS)
    face_at = np.full((nh, nw), -1, int); depth_at = np.full((nh, nw), np.inf)
    for y in range(nh):
        for x in range(nw):
            b = blocks[y, x]; solid = b[b >= 0]
            if len(solid) < SS * SS * 0.4: continue
            vals, cnt = np.unique(solid, return_counts=True)
            face_at[y, x] = vals[cnt.argmax()]
            depth_at[y, x] = zb[y, x][b == face_at[y, x]].mean()
    pad = 14
    out = np.zeros((nh + 2 * pad, nw + 2 * pad, 4), np.uint8)
    for y in range(nh):
        for x in range(nw):
            k = face_at[y, x]
            if k < 0: continue
            mt, idx = colours[k]
            # panel lines: darker where a face in front of this one begins
            for dy, dx in ((-1, 0), (0, -1), (1, 0), (0, 1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < nh and 0 <= xx < nw and face_at[yy, xx] >= 0 and face_at[yy, xx] != k \
                        and depth_at[yy, xx] < depth_at[y, x] - 0.01 and colours[face_at[yy, xx]][0] != 'glow':
                    if mt in ('hull', 'metal', 'accent'): idx = max(0, idx - 2)
                    break
            out[y + pad, x + pad] = rgb(pal[mt][idx]) + (255,)

    # outline and rim light
    alpha = out[:, :, 3] > 0
    H2, W2 = alpha.shape
    nb = lambda y, x: 0 <= y < H2 and 0 <= x < W2 and alpha[y, x]
    lut = {rgb(c): (name, i) for name, r in pal.items() if isinstance(r, list) for i, c in enumerate(r)}
    o = out.copy()
    for y in range(H2):
        for x in range(W2):
            if alpha[y, x]:
                info = lut.get(tuple(out[y, x, :3]))
                if info and info[0] in ('hull', 'accent') and info[1] >= 2 and (not nb(y - 1, x) or not nb(y, x - 1)):
                    r = pal[info[0]]; o[y, x] = rgb(r[min(len(r) - 1, info[1] + 2)]) + (255,)
            elif nb(y + 1, x) or nb(y - 1, x) or nb(y, x + 1) or nb(y, x - 1):
                o[y, x] = rgb(pal['outline'][0]) + (255,)

    # engine glow: a dithered halo around each exhaust, behind the hull
    inner, outer = rgb(pal['halo'][0]), rgb(pal['halo'][1])
    bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    R = max(6, int(PXU * 0.24))
    for e in m.exhausts:
        p = rot(e)
        gy, gx = int((oy - p[1] * pxu) / SS) + pad, int((ox + p[0] * pxu) / SS) + pad
        for dy in range(-R, R + 1):
            for dx in range(-R, R + 1):
                Y, X = gy + dy, gx + dx
                if not (0 <= Y < H2 and 0 <= X < W2) or o[Y, X, 3]: continue
                dist = math.hypot(dx, dy) / R
                if dist < 1 and bayer[Y % 4][X % 4] / 16 > dist * 1.15:
                    o[Y, X] = (inner + (255,)) if dist < 0.45 else (outer + (150,))
    img = Image.fromarray(o, 'RGBA')
    return img.crop(img.getbbox())

def main():
    import base64, io, json
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    outdir = os.path.join(root, 'assets', 'ships')
    os.makedirs(outdir, exist_ok=True)
    images = {}
    for name, fn in MODELS.items():
        img = render(fn, TEMPLATE, VIEW)
        img.save(os.path.join(outdir, f'{name}.png'), optimize=True)
        buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True)
        images[name] = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
        print(f'{name:11s} {img.size[0]}x{img.size[1]}')
    js = ('// Voyager — ship sprite templates. GENERATED by tools/shipart/render.py: do not edit by hand.\n'
          '// Each sprite is grey: a pixel\'s grey level names a material and a shade, listed in `greys`.\n'
          '// js/sprites.js paints them with a palette from DATA.shipPalettes.\n'
          'const ShipSprites = {\n'
          f'  ramps: {json.dumps(RAMP_SIZES)},\n'
          f'  greys: {json.dumps({str(k): v for k, v in sorted(GREY_TABLE.items())})},\n'
          '  images: {\n' + ''.join(f'    {k}: {json.dumps(v)},\n' for k, v in images.items()) + '  },\n};\n')
    with open(os.path.join(root, 'js', 'shipsprites.js'), 'w') as f: f.write(js)
    print('wrote js/shipsprites.js', len(js) // 1024, 'KB')

if __name__ == '__main__':
    main()
