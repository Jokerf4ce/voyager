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
  assets/ships/<type>.png   the grey templates (to look at); ship types have eleven designs: <type>.png and
                            <type>_2.png … <type>_11.png (a ship rolls one when it is built)
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

    def plate(self, side, rx, rz0, rz1, tx, tz0, tz1, y=0.0, t=0.02, mat='hull', ty=None):
        """a thin swept plate (wing, fin): root at x = side*rx, tip at x = side*tx (tip height ty, default y)"""
        r, tip = side * rx, side * tx
        yt = y if ty is None else ty
        v = [(r, y - t, rz0), (tip, yt - t, tz0), (tip, yt + t, tz0), (r, y + t, rz0),
             (r, y - t, rz1), (tip, yt - t, tz1), (tip, yt + t, tz1), (r, y + t, rz1)]
        self.parts.append((v, mat, {}))

    def fin(self, x, y0, y1, z0, z1, t=0.018, mat='hull', sweep=0.5):
        """a vertical fin standing on y0, swept back toward its top"""
        self.block(x - t, x + t, y0, y1, z0, z1, mat, (1, sweep), (0, -(y1 - y0) * (1 - sweep) / 2))

    def ring(self, z, r, size=0.05, n=8, mat='metal', depth=0.06, x=0.0, y=0.0):
        """a ring of small blocks around the long axis (habitat rings, capacitor coils)"""
        for k in range(n):
            a = 2 * math.pi * k / n
            cx, cy = x + r * math.cos(a), y + r * math.sin(a)
            self.block(cx - size, cx + size, cy - size, cy + size, z - depth, z + depth, mat)

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


# ---------------------------------------------------------------- variants: two more designs per ship type
# Small
def scout_b(m):    # sensor picket: a dish up front, an antenna ring, one big engine
    m.block(-0.07, 0.07, -0.06, 0.06, -0.45, 0.25)
    m.egg(0.17, 0.17, 0.22, 0.42, 'metal', taper=0.5, mid=0.3)                               # sensor dish
    m.block(-0.06, 0.06, -0.06, 0.06, 0.38, 0.44, 'glass')
    m.spike(0, 0, 0.44, 0.02, 0.28, 'metal')
    m.ring(-0.05, 0.16, 0.025, 8, 'accent', 0.03)
    m.block(-0.05, 0.05, 0.06, 0.12, -0.2, 0.1, 'glass', (0.8, 0.5))
    for sd in (-1, 1): m.plate(sd, 0.06, -0.42, -0.25, 0.3, -0.5, -0.42, 0.0, 0.012, 'metal', ty=sd * 0.0 + 0.12)
    m.fin(0, 0.06, 0.24, -0.45, -0.25)
    m.engine(0, 0, -0.45, 0.09, 0.08, 0.12)

def scout_c(m):    # needle probe with solar panel wings
    m.block(-0.05, 0.05, -0.05, 0.05, -0.5, 0.35)
    m.block(-0.05, 0.05, -0.05, 0.05, 0.35, 0.7, 'hull', (0.2, 0.2))
    m.block(-0.045, 0.045, 0.05, 0.1, 0.1, 0.3, 'glass', (0.6, 0.4))
    for sd in (-1, 1):
        m.plate(sd, 0.05, -0.15, 0.1, 0.42, -0.15, 0.1, 0.0, 0.01, 'glass')                    # solar panels
        m.block(sd * 0.42 - 0.015, sd * 0.42 + 0.015, -0.02, 0.02, -0.17, 0.12, 'accent')
        m.plate(sd, 0.04, -0.5, -0.36, 0.2, -0.56, -0.48, 0.0, 0.012, 'hull', ty=-0.08)
    m.fin(0, 0.05, 0.22, -0.5, -0.32)
    m.engine(0, 0, -0.5, 0.06, 0.05, 0.1)

def fighter_b(m):  # four wings in an X, guns on every tip
    m.block(-0.12, 0.12, -0.08, 0.08, -0.6, 0.2)
    m.block(-0.12, 0.12, -0.08, 0.08, 0.2, 0.65, 'hull', (0.35, 0.35))
    m.block(-0.07, 0.07, 0.08, 0.15, -0.05, 0.3, 'glass', (0.7, 0.4), (0, -0.02))
    m.block(-0.08, 0.08, 0.06, 0.1, 0.4, 0.5, 'accent', (0.6, 1))
    for sd in (-1, 1):
        for up in (-1, 1):
            m.plate(sd, 0.1, -0.5, -0.15, 0.55, -0.55, -0.3, up * 0.03, 0.015, 'hull', ty=up * 0.2)
            m.gunpod(sd * 0.55, up * 0.2, -0.55, -0.3, 0.03, 0.35, twin=False)
            m.engine(sd * 0.09, up * 0.05, -0.45, 0.05, 0.04, 0.18)
        m.block(min(sd * 0.3, sd * 0.4), max(sd * 0.3, sd * 0.4), 0.05, 0.09, -0.48, -0.35, 'accent')

def fighter_c(m):  # forward-swept interceptor with twin tails
    m.block(-0.13, 0.13, -0.07, 0.07, -0.55, 0.25)
    m.block(-0.13, 0.13, -0.07, 0.07, 0.25, 0.75, 'hull', (0.2, 0.35), (0, -0.02))
    m.block(-0.08, 0.08, 0.07, 0.15, 0.05, 0.4, 'glass', (0.6, 0.3), (0, -0.03))
    for sd in (-1, 1):
        m.plate(sd, 0.12, -0.35, -0.05, 0.6, -0.05, 0.22, -0.02, 0.018)                        # swept forward
        m.block(sd * 0.58 - 0.03 if sd > 0 else -0.61, sd * 0.58 + 0.03 if sd > 0 else -0.55, -0.04, 0.01, -0.06, 0.24, 'accent')
        m.gunpod(sd * 0.3, -0.04, -0.15, 0.2, 0.035, 0.3, twin=False)
        m.fin(sd * 0.1, 0.07, 0.28, -0.55, -0.3, 0.016, 'hull', 0.45)
        m.engine(sd * 0.08, 0, -0.55, 0.06, 0.06, 0.14)

def heavy_b(m):    # torpedo bomber: a flat wedge with a torpedo slung underneath
    m.block(-0.32, 0.32, -0.07, 0.07, -0.55, 0.1, 'hull', (0.5, 0.8))
    m.block(-0.16, 0.16, -0.07, 0.07, 0.1, 0.55, 'hull', (0.4, 0.5))
    m.block(-0.1, 0.1, 0.07, 0.15, -0.1, 0.25, 'glass', (0.7, 0.4), (0, -0.02))
    m.egg(0.08, 0.08, -0.35, 0.45, 'accent', y=-0.14, taper=0.3)                               # torpedo
    m.spike(0, -0.14, 0.4, 0.03, 0.18, 'metal')
    m.turret(0, 0.07, -0.3, 0.06, 0.18)
    for sd in (-1, 1):
        m.block(min(sd * 0.3, sd * 0.34), max(sd * 0.3, sd * 0.34), -0.05, 0.05, -0.55, -0.2, 'accent')
        m.engine(sd * 0.18, 0, -0.55, 0.08, 0.06, 0.14)
        m.fin(sd * 0.28, 0.05, 0.2, -0.55, -0.38)

def heavy_c(m):    # twin-boom gunship
    m.egg(0.11, 0.1, -0.3, 0.45, 'hull', taper=0.45, mid=0.5)                                 # cockpit pod
    m.block(-0.08, 0.08, 0.06, 0.13, 0.05, 0.3, 'glass', (0.7, 0.4))
    m.plate(1, 0.0, -0.3, -0.05, 0.36, -0.3, -0.05, 0.0, 0.02)
    m.plate(-1, 0.0, -0.3, -0.05, 0.36, -0.3, -0.05, 0.0, 0.02)
    for sd in (-1, 1):
        x = sd * 0.36
        m.block(x - 0.07, x + 0.07, -0.06, 0.06, -0.6, 0.3)                                    # booms
        m.block(x - 0.07, x + 0.07, -0.06, 0.06, 0.3, 0.45, 'hull', (0.5, 0.5))
        m.gunpod(x, -0.09, 0.0, 0.35, 0.04, 0.3)
        m.block(x - 0.072, x + 0.072, 0.05, 0.065, -0.4, 0.1, 'accent')
        m.fin(x, 0.06, 0.22, -0.6, -0.4)
        m.engine(x, 0, -0.6, 0.065, 0.055, 0.12)

# Medium
def corvette_b(m): # arrowhead with a dorsal fin
    m.block(-0.42, 0.42, -0.1, 0.07, -0.7, -0.1, 'hull', (0.55, 0.9))
    m.block(-0.23, 0.23, -0.1, 0.07, -0.1, 0.75, 'hull', (0.08, 0.4), (0, -0.02))
    m.block(-0.09, 0.09, 0.07, 0.17, -0.25, 0.25, 'hull', (0.6, 0.6))
    m.block(-0.07, 0.07, 0.12, 0.16, 0.2, 0.26, 'glass')
    m.fin(0, 0.17, 0.46, -0.7, -0.25, 0.022, 'accent', 0.4)
    m.turret(0, 0.07, 0.4, 0.07, 0.24)
    for sd in (-1, 1):
        m.gunpod(sd * 0.34, -0.05, -0.55, -0.15, 0.045, 0.25)
        m.block(min(sd * 0.36, sd * 0.43), max(sd * 0.36, sd * 0.43), 0.03, 0.07, -0.7, -0.4, 'accent')
        m.engine(sd * 0.22, -0.02, -0.7, 0.07, 0.06, 0.12)
    m.engine(0, -0.01, -0.7, 0.12, 0.09, 0.16)

def corvette_c(m): # hammerhead: a gun-laden prow on a thin spine
    m.block(-0.07, 0.07, -0.07, 0.07, -0.8, 0.3, 'metal')                                        # spine
    m.block(-0.45, 0.45, -0.09, 0.07, 0.3, 0.55, 'hull', (0.9, 0.8))                             # the hammer
    m.block(-0.46, 0.46, 0.04, 0.08, 0.42, 0.5, 'accent')
    m.block(-0.12, 0.12, 0.07, 0.15, 0.32, 0.5, 'glass', (0.9, 0.6))
    for sd in (-1, 1):
        m.gunpod(sd * 0.36, -0.02, 0.4, 0.55, 0.05, 0.3)
        m.plate(sd, 0.06, -0.45, -0.2, 0.3, -0.55, -0.38, 0.0, 0.015, 'metal', ty=0.08)       # radiators
    m.block(-0.18, 0.18, -0.12, 0.12, -0.3, 0.0, 'hull', (0.8, 0.8))                              # mid module
    m.turret(0, 0.12, -0.15, 0.065, 0.2)
    m.block(-0.2, 0.2, -0.13, 0.11, -0.95, -0.75, 'metal')
    for x in (-0.11, 0.11): m.engine(x, -0.01, -0.95, 0.075, 0.07, 0.12)

def frigate_b(m):  # spinal frigate: modules on a long spine, a habitat ring
    m.block(-0.06, 0.06, -0.06, 0.06, -1.0, 0.8, 'metal')                                        # spine
    m.egg(0.2, 0.18, 0.55, 1.05, 'hull', taper=0.4, mid=0.4)                                    # command dome
    m.block(-0.12, 0.12, 0.08, 0.17, 0.75, 0.92, 'glass', (0.7, 0.6))
    m.ring(0.2, 0.3, 0.075, 16, 'hull', 0.09)                                                   # habitat ring
    m.ring(0.2, 0.3, 0.077, 16, 'accent', 0.025)
    for k in range(4):                                                                           # spokes
        ang = math.pi / 4 + k * math.pi / 2
        cx, cy = 0.17 * math.cos(ang), 0.17 * math.sin(ang)
        m.block(cx - 0.025, cx + 0.025, cy - 0.025, cy + 0.025, 0.15, 0.25, 'metal')
    for sd in (-1, 1):
        m.block(sd * 0.09 - 0.07, sd * 0.09 + 0.07, -0.08, 0.08, -0.45, -0.05, 'hull')            # cargo pods
        m.block(sd * 0.1 - 0.072, sd * 0.1 + 0.072, 0.06, 0.09, -0.4, -0.1, 'accent')
        m.plate(sd, 0.06, -0.85, -0.6, 0.42, -0.9, -0.7, 0.0, 0.012, 'metal', ty=0.05)
    m.turret(0, 0.06, 0.4, 0.075, 0.26)
    m.egg(0.17, 0.17, -0.85, -0.5, 'metal', taper=0.6)                                          # reactor
    for x, y in ((-0.1, -0.08), (0.1, -0.08), (-0.1, 0.08), (0.1, 0.08)): m.engine(x, y, -1.0, 0.06, 0.06, 0.12)

def frigate_c(m):  # twin-hulled frigate
    for sd in (-1, 1):
        x = sd * 0.26
        m.egg(0.14, 0.13, -0.95, 0.85, 'hull', x=x, taper=0.45, mid=0.55)
        m.block(x - 0.05, x + 0.05, 0.11, 0.14, -0.7, 0.4, 'accent')
        m.turret(x, 0.12, 0.35, 0.07, 0.25)
        m.engine(x, 0, -0.95, 0.09, 0.09, 0.14)
    for z in (-0.5, 0.1): m.block(-0.26, 0.26, -0.04, 0.04, z - 0.08, z + 0.08, 'metal')            # crossbeams
    m.block(-0.1, 0.1, -0.05, 0.12, -0.35, 0.15, 'hull', (0.8, 1))                                 # command tower
    m.block(-0.08, 0.08, 0.12, 0.27, -0.3, 0.05, 'hull', (0.8, 1))
    m.block(-0.07, 0.07, 0.21, 0.26, 0.05, 0.08, 'glass')
    m.block(-0.01, 0.01, 0.27, 0.45, -0.2, -0.17, 'metal')

def gunboat_b(m):  # spinal cannon: a gun with a ship around it
    m.block(-0.32, 0.32, -0.12, 0.1, -0.8, -0.2, 'hull', (0.6, 0.8))
    m.block(-0.19, 0.19, -0.12, 0.1, -0.2, 0.3, 'hull', (0.7, 0.8))
    m.block(-0.06, 0.06, -0.05, 0.05, 0.3, 1.05, 'metal')                                       # the cannon
    for z in (0.45, 0.65, 0.85): m.ring(z, 0.09, 0.03, 8, 'accent', 0.03)                       # capacitor coils
    m.block(-0.03, 0.03, -0.03, 0.03, 1.05, 1.1, 'glow')
    m.block(-0.11, 0.11, 0.1, 0.2, -0.55, -0.15, 'hull', (0.8, 1))
    m.block(-0.08, 0.08, 0.15, 0.19, -0.15, -0.12, 'glass')
    for sd in (-1, 1):
        m.turret(sd * 0.2, 0.1, -0.35, 0.06, 0.2)
        m.plate(sd, 0.3, -0.75, -0.45, 0.55, -0.8, -0.6, 0.0, 0.015, 'metal', ty=0.12)
        m.engine(sd * 0.17, -0.01, -0.8, 0.09, 0.08, 0.14)

def gunboat_c(m):  # weapons block: turrets on every face, radiator wings
    m.block(-0.3, 0.3, -0.2, 0.15, -0.6, 0.45)
    m.block(-0.3, 0.3, -0.2, 0.15, 0.45, 0.65, 'hull', (0.8, 0.7))
    m.block(-0.31, 0.31, 0.12, 0.16, -0.1, 0.05, 'accent')
    for z in (0.3, -0.3): m.turret(0, 0.15, z, 0.1, 0.3)
    for sd in (-1, 1):
        m.block(min(sd * 0.3, sd * 0.38), max(sd * 0.3, sd * 0.38), -0.08, 0.02, -0.05, 0.25, 'metal')
        m.turret(sd * 0.34, 0.02, 0.1, 0.055, 0.22)
        m.plate(sd, 0.3, -0.6, -0.42, 0.7, -0.62, -0.5, -0.02, 0.012, 'accent')              # radiators
        m.plate(sd, 0.3, -0.42, -0.36, 0.7, -0.5, -0.46, -0.02, 0.013, 'metal')
    m.block(-0.08, 0.08, 0.15, 0.24, 0.45, 0.55, 'glass')
    for x in (-0.15, 0.15): m.engine(x, -0.03, -0.6, 0.1, 0.1, 0.12)

# Large
def destroyer_b(m):  # dagger: a long blade with fins above and below
    m.block(-0.3, 0.3, -0.12, 0.1, -1.4, 0.3, 'hull', (0.8, 0.9))
    m.block(-0.24, 0.24, -0.11, 0.09, 0.3, 1.5, 'hull', (0.05, 0.3), (0, -0.02))
    m.fin(0, 0.1, 0.5, -1.35, -0.6, 0.025, 'hull', 0.5)
    m.fin(0, 0.47, 0.5, -1.2, -0.8, 0.026, 'accent', 0.9)
    m.block(-0.025, 0.025, -0.45, -0.12, -1.3, -0.6, 'hull', (1, 0.5), (0, 0.08))                # ventral fin
    for z in (0.65, 0.25, -0.15): m.turret(0, 0.1, z, 0.1, 0.32)
    m.block(-0.12, 0.12, 0.1, 0.24, -0.6, -0.3, 'hull', (0.8, 1))
    m.block(-0.09, 0.09, 0.18, 0.22, -0.3, -0.27, 'glass')
    for sd in (-1, 1):
        m.block(min(sd * 0.29, sd * 0.33), max(sd * 0.29, sd * 0.33), -0.08, 0.06, -1.2, 0.2, 'accent')
        m.plate(sd, 0.3, -1.4, -1.0, 0.6, -1.5, -1.25, 0.0, 0.02)
    for x in (-0.16, 0, 0.16): m.engine(x, -0.01, -1.4, 0.08, 0.08, 0.14)

def destroyer_c(m):  # lance: a heavy prow on a long spine, missile wings
    m.block(-0.08, 0.08, -0.08, 0.08, -1.3, 0.6, 'metal')                                        # spine
    m.block(-0.32, 0.32, -0.16, 0.12, 0.6, 1.0, 'hull', (0.85, 0.8))                             # prow block
    m.block(-0.32, 0.32, -0.16, 0.12, 1.0, 1.45, 'hull', (0.15, 0.3), (0, -0.03))
    m.block(-0.33, 0.33, 0.08, 0.13, 0.75, 0.95, 'accent')
    m.turret(0, 0.12, 0.85, 0.11, 0.36)
    m.block(-0.15, 0.15, -0.12, 0.14, -0.4, 0.1, 'hull', (0.85, 0.9))                              # mid section
    m.block(-0.1, 0.1, 0.14, 0.26, -0.3, 0.0, 'hull', (0.8, 1))
    m.block(-0.08, 0.08, 0.2, 0.25, 0.0, 0.03, 'glass')
    for sd in (-1, 1):
        m.plate(sd, 0.12, -0.35, 0.05, 0.62, -0.5, -0.2, 0.0, 0.025)                           # wings
        for z in (-0.42, -0.3): m.block(sd * 0.55 - 0.05, sd * 0.55 + 0.05, 0.02, 0.09, z - 0.05, z + 0.05, 'metal', over={1: 'void'})  # missile pods
        m.block(min(sd * 0.6, sd * 0.64), max(sd * 0.6, sd * 0.64), -0.03, 0.03, -0.5, -0.2, 'accent')
    m.block(-0.3, 0.3, -0.18, 0.16, -1.55, -1.25, 'metal')
    for x in (-0.18, 0, 0.18): m.engine(x, -0.01, -1.55, 0.08, 0.09, 0.12)

def battleship_b(m):  # cathedral: spires, buttresses, a rose window
    m.block(-0.38, 0.38, -0.2, 0.12, -1.4, 0.8)
    m.block(-0.38, 0.38, -0.2, 0.12, 0.8, 1.35, 'hull', (0.3, 0.5), (0, -0.04))
    m.block(-0.3, 0.3, 0.12, 0.3, -1.1, 0.5, 'hull', (0.9, 1))                                  # nave
    m.block(-0.2, 0.2, 0.3, 0.44, -0.9, 0.2, 'hull', (0.85, 1))
    m.block(-0.12, 0.12, 0.3, 0.42, 0.5, 0.54, 'glass')                                          # rose window
    for z, h in ((0.1, 0.85), (-0.45, 1.0), (-0.85, 0.75)):                                       # spires
        m.block(-0.07, 0.07, 0.44, h, z - 0.07, z + 0.07, 'hull', (0.15, 1), (0, 0))
        m.block(-0.075, 0.075, 0.44, 0.5, z - 0.075, z + 0.075, 'accent')
    for sd in (-1, 1):
        for z in (-0.9, -0.5, -0.1, 0.3):
            m.fin(sd * 0.34, 0.1, 0.3, z - 0.1, z + 0.08, 0.025, 'metal', 0.3)                    # buttresses
        m.turret(sd * 0.26, 0.3, 0.35, 0.08, 0.25)
        m.block(min(sd * 0.38, sd * 0.42), max(sd * 0.38, sd * 0.42), -0.15, 0.08, -1.3, 0.75, 'metal')
    m.turret(0, 0.12, 0.95, 0.13, 0.42)
    m.block(-0.4, 0.4, -0.24, 0.16, -1.65, -1.4, 'metal')
    for x in (-0.26, -0.09, 0.09, 0.26): m.engine(x, -0.04, -1.65, 0.075, 0.1, 0.12)

def battleship_c(m):  # wedge dreadnought: a vast flat arrowhead with a command tower at the stern
    m.block(-0.75, 0.75, -0.16, 0.1, -1.3, -0.6, 'hull', (0.75, 1))
    m.block(-0.56, 0.56, -0.16, 0.1, -0.6, 1.4, 'hull', (0.04, 0.4), (0, -0.04))
    m.block(-0.5, 0.5, -0.3, -0.16, -1.2, 0.6, 'metal', (0.3, 1))
    m.block(-0.3, 0.3, 0.1, 0.22, -1.25, -0.4, 'hull', (0.7, 1))                                  # stepped tower
    m.block(-0.2, 0.2, 0.22, 0.36, -1.15, -0.65, 'hull', (0.8, 1))
    m.block(-0.18, 0.18, 0.3, 0.35, -0.65, -0.62, 'glass')
    for sd in (-1, 1):
        m.block(sd * 0.12 - 0.05, sd * 0.12 + 0.05, 0.36, 0.48, -1.0, -0.88, 'metal', (0.6, 1))   # sensor domes
        for z, x in ((-0.25, 0.4), (0.15, 0.3), (0.55, 0.18)): m.turret(sd * x, 0.1, z, 0.08, 0.26)
        m.plate(sd, 0.05, -0.6, 1.3, 0.62, -0.6, -0.55, 0.1, 0.012, 'accent', ty=0.1) if False else None
        m.block(min(sd * 0.7, sd * 0.76), max(sd * 0.7, sd * 0.76), -0.14, 0.06, -1.3, -0.65, 'accent')
    m.block(-0.04, 0.04, 0.1, 0.13, -0.5, 1.2, 'accent')                                          # centre stripe
    m.block(-0.6, 0.6, -0.2, 0.14, -1.5, -1.3, 'metal')
    for x in (-0.42, -0.21, 0, 0.21, 0.42): m.engine(x, -0.03, -1.5, 0.08, 0.1, 0.12)

def carrier_b(m):  # twin-hull carrier: two flight hulls and a bridge between them
    for sd in (-1, 1):
        x = sd * 0.36
        m.block(x - 0.2, x + 0.2, -0.16, 0.08, -1.3, 1.0)
        m.block(x - 0.2, x + 0.2, -0.16, 0.08, 1.0, 1.2, 'hull', (0.7, 0.6))
        m.block(x - 0.15, x + 0.15, -0.12, 0.04, 1.08, 1.21, 'void')                             # hangar mouth
        for z in (-0.9, -0.4, 0.1, 0.6): m.block(x - 0.02, x + 0.02, 0.08, 0.095, z, z + 0.25, 'accent')
        m.engine(x - 0.08, -0.04, -1.3, 0.07, 0.08, 0.1)
        m.engine(x + 0.08, -0.04, -1.3, 0.07, 0.08, 0.1)
    m.block(-0.16, 0.16, -0.08, 0.06, -0.9, 0.4, 'metal')                                         # connecting deck
    m.block(-0.12, 0.12, 0.06, 0.24, -0.5, -0.05, 'hull', (0.85, 1))                               # bridge
    m.block(-0.08, 0.08, 0.24, 0.36, -0.42, -0.15, 'hull', (0.8, 1))
    m.block(-0.07, 0.07, 0.3, 0.35, -0.15, -0.12, 'glass')
    m.block(-0.01, 0.01, 0.36, 0.55, -0.32, -0.28, 'metal')
    m.turret(0, 0.06, 0.25, 0.07, 0.22)

def carrier_c(m):  # hive carrier: a spine lined with launch bays, a ring of hangars
    m.block(-0.14, 0.14, -0.14, 0.14, -1.4, 1.1, 'metal')                                         # spine
    m.egg(0.26, 0.22, 0.8, 1.4, 'hull', taper=0.4, mid=0.35)                                      # command head
    m.block(-0.16, 0.16, 0.12, 0.2, 1.05, 1.2, 'glass', (0.7, 0.5))
    for z in (-0.9, -0.45, 0.0, 0.45):
        for sd in (-1, 1):
            m.block(sd * 0.27 - 0.13, sd * 0.27 + 0.13, -0.12, 0.12, z - 0.17, z + 0.17, 'hull', over={1: 'void'})  # launch bays
            m.block(sd * 0.27 - 0.131, sd * 0.27 + 0.131, 0.09, 0.125, z - 0.05, z + 0.05, 'accent')
        m.block(-0.13, 0.13, 0.12, 0.2, z - 0.15, z + 0.15, 'hull')
    m.ring(-1.15, 0.36, 0.07, 10, 'hull', 0.09)                                                    # aft hangar ring
    m.turret(0, 0.2, 0.25, 0.07, 0.22)
    m.turret(0, 0.2, -0.65, 0.07, 0.22)
    for x, y in ((-0.12, -0.1), (0.12, -0.1), (-0.12, 0.1), (0.12, 0.1)): m.engine(x, y, -1.4, 0.07, 0.07, 0.12)

# ---------------------------------------------------------------- variants 4-6: three more designs per ship type (v0.49)
def xb(m, xa, xc, *a, **k):
    """block with the x-range in any order (mirrored parts)"""
    m.block(min(xa, xc), max(xa, xc), *a, **k)

# Small
def scout_d(m):    # ring-wing probe: an egg body inside an annular wing
    m.egg(0.1, 0.1, -0.45, 0.6, 'hull', taper=0.3, mid=0.55)
    m.block(-0.05, 0.05, 0.08, 0.13, 0.1, 0.35, 'glass', (0.6, 0.4))
    m.ring(-0.2, 0.27, 0.035, 14, 'hull', 0.1)                                                  # the ring wing
    m.ring(-0.2, 0.27, 0.037, 14, 'accent', 0.02)
    for a in (0, math.pi / 2, math.pi, 3 * math.pi / 2):                                       # struts
        cx, cy = 0.17 * math.cos(a), 0.17 * math.sin(a)
        m.block(cx - 0.015, cx + 0.015, cy - 0.015, cy + 0.015, -0.28, -0.12, 'metal')
    m.spike(0, -0.06, 0.55, 0.015, 0.25, 'metal')
    m.engine(0, 0, -0.45, 0.07, 0.07, 0.1)

def scout_e(m):    # outrigger skiff: a slim hull with two pods on long struts and a sensor mast
    m.block(-0.06, 0.06, -0.05, 0.06, -0.5, 0.3)
    m.block(-0.06, 0.06, -0.05, 0.06, 0.3, 0.6, 'hull', (0.25, 0.3))
    m.block(-0.045, 0.045, 0.06, 0.11, 0.05, 0.3, 'glass', (0.6, 0.4))
    for sd in (-1, 1):
        m.plate(sd, 0.05, -0.15, 0.0, 0.32, -0.2, -0.05, 0.0, 0.012, 'metal')                 # struts
        m.egg(0.045, 0.045, -0.4, 0.15, 'hull', x=sd * 0.34, taper=0.4)                          # pods
        xb(m, sd * 0.3, sd * 0.38, 0.03, 0.05, -0.3, 0.0, 'accent')
        m.engine(sd * 0.34, 0, -0.38, 0.035, 0.035, 0.08)
    m.block(-0.012, 0.012, 0.06, 0.32, -0.3, -0.26, 'metal')                                       # mast
    m.block(-0.07, 0.07, 0.3, 0.33, -0.31, -0.25, 'glass')
    m.engine(0, 0, -0.5, 0.05, 0.05, 0.08)

def scout_f(m):    # lantern drone: a cut gem with a glowing eye and four antenna spikes
    m.block(-0.24, 0.24, -0.24, 0.24, 0.0, 0.42, 'hull', (0.15, 0.15))                            # front pyramid
    m.block(-0.24, 0.24, -0.24, 0.24, 0.0, -0.4, 'hull', (0.2, 0.2))                              # back pyramid
    m.block(-0.08, 0.08, -0.08, 0.08, 0.3, 0.42, 'glass')
    m.block(-0.04, 0.04, -0.04, 0.04, 0.41, 0.45, 'glow')                                          # the eye
    m.ring(0.0, 0.24, 0.03, 10, 'accent', 0.035)
    for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        m.spike(dx * 0.14, dy * 0.14, 0.05, 0.02, 0.42, 'metal', up=dy * 0.18, out=dx * 0.18)
    m.engine(0, 0, -0.38, 0.07, 0.07, 0.14)

def fighter_d(m):  # crescent: wings that curve forward at the tips
    m.egg(0.12, 0.08, -0.5, 0.6, 'hull', taper=0.3, mid=0.4)
    m.block(-0.07, 0.07, 0.07, 0.14, 0.0, 0.35, 'glass', (0.6, 0.3), (0, -0.02))
    for sd in (-1, 1):
        m.plate(sd, 0.1, -0.35, -0.05, 0.4, -0.3, -0.05, 0.0, 0.016)                          # inner wing, swept back
        m.plate(sd, 0.4, -0.3, -0.05, 0.62, 0.05, 0.3, 0.0, 0.016)                             # outer wing, swept forward
        m.gunpod(sd * 0.62, 0, 0.05, 0.3, 0.03, 0.2, twin=False)
        xb(m, sd * 0.38, sd * 0.44, 0.0, 0.03, -0.3, -0.05, 'accent')
        m.engine(sd * 0.08, -0.01, -0.5, 0.05, 0.05, 0.14)
    m.fin(0, 0.07, 0.25, -0.5, -0.25)

def fighter_e(m):  # canard dart: a long needle, small canards up front, a big delta at the back
    m.block(-0.08, 0.08, -0.06, 0.06, -0.6, 0.35)
    m.block(-0.08, 0.08, -0.06, 0.06, 0.35, 0.85, 'hull', (0.1, 0.2), (0, -0.02))
    m.block(-0.06, 0.06, 0.06, 0.13, 0.05, 0.4, 'glass', (0.5, 0.3), (0, -0.02))
    for sd in (-1, 1):
        m.plate(sd, 0.07, 0.35, 0.5, 0.22, 0.38, 0.45, 0.0, 0.012, 'accent')                   # canards
        m.plate(sd, 0.08, -0.6, 0.0, 0.48, -0.62, -0.45, -0.02, 0.016)                         # delta
        m.gunpod(sd * 0.12, -0.06, 0.0, 0.3, 0.03, 0.3, twin=False)
    m.fin(0, 0.06, 0.3, -0.6, -0.3, 0.018, 'hull', 0.4)
    m.engine(0, 0, -0.6, 0.08, 0.06, 0.16)

def fighter_f(m):  # tri-engine skimmer: a flat lens with three engines in a triangle
    m.block(-0.3, 0.3, -0.05, 0.05, -0.4, 0.15, 'hull', (0.5, 0.8))
    m.block(-0.3, 0.3, -0.05, 0.05, -0.4, -0.55, 'hull', (0.6, 0.8))
    m.block(-0.15, 0.15, -0.05, 0.05, 0.15, 0.55, 'hull', (0.2, 0.6))
    m.egg(0.09, 0.07, -0.15, 0.3, 'glass', y=0.07, taper=0.4)
    for sd in (-1, 1):
        m.gunpod(sd * 0.22, 0, 0.0, 0.25, 0.03, 0.25, twin=False)
        xb(m, sd * 0.26, sd * 0.31, 0.04, 0.06, -0.4, -0.1, 'accent')
        m.engine(sd * 0.16, -0.04, -0.55, 0.06, 0.05, 0.1)
    m.engine(0, 0.06, -0.55, 0.06, 0.05, 0.1)

def heavy_d(m):    # brick gunship: armoured box, quad engines, chin cannon
    m.block(-0.22, 0.22, -0.14, 0.12, -0.5, 0.35)
    m.block(-0.22, 0.22, -0.14, 0.12, 0.35, 0.5, 'hull', (0.8, 0.6), (0, -0.02))
    m.block(-0.12, 0.12, 0.1, 0.16, 0.3, 0.46, 'glass', (0.8, 0.5))
    for z in (-0.3, -0.05, 0.2):                                                                     # armour bands
        m.block(-0.235, 0.235, -0.15, 0.13, z, z + 0.06, 'metal')
    m.gunpod(0, -0.17, 0.2, 0.45, 0.05, 0.35)
    m.turret(0, 0.12, -0.15, 0.07, 0.2)
    for sd in (-1, 1):
        for y in (-0.07, 0.06): m.engine(sd * 0.12, y, -0.5, 0.06, 0.05, 0.12)
        xb(m, sd * 0.22, sd * 0.3, -0.05, 0.05, -0.45, -0.1, 'accent')

def heavy_e(m):    # trident: three prongs, each a gun barrel, around a cockpit
    m.egg(0.14, 0.1, -0.5, 0.3, 'hull', taper=0.5, mid=0.5)
    m.block(-0.08, 0.08, 0.08, 0.15, -0.1, 0.2, 'glass', (0.7, 0.4))
    m.block(-0.04, 0.04, -0.04, 0.04, 0.25, 0.85, 'metal', (0.4, 0.4))                             # centre prong
    for sd in (-1, 1):
        m.plate(sd, 0.1, -0.2, 0.15, 0.3, -0.05, 0.25, 0.0, 0.02)
        m.block(sd * 0.3 - 0.04, sd * 0.3 + 0.04, -0.04, 0.04, 0.05, 0.7, 'metal', (0.4, 0.4))   # side prongs
        xb(m, sd * 0.26, sd * 0.34, 0.03, 0.06, 0.0, 0.25, 'accent')
        m.engine(sd * 0.1, 0, -0.5, 0.06, 0.06, 0.14)
        m.fin(sd * 0.14, 0.06, 0.22, -0.5, -0.3)

def heavy_f(m):    # carapace beetle: a low dome split into wing covers, mandible guns
    m.egg(0.3, 0.13, -0.5, 0.35, 'hull', y=0.02, taper=0.5, mid=0.45)                              # carapace
    m.block(-0.012, 0.012, 0.1, 0.16, -0.45, 0.25, 'void')                                          # the split
    m.block(-0.14, 0.14, -0.1, 0.0, -0.4, 0.45, 'metal', (0.7, 0.8))                                # belly
    m.block(-0.08, 0.08, -0.02, 0.06, 0.35, 0.5, 'glass', (0.8, 0.6))
    for sd in (-1, 1):
        m.block(sd * 0.15 - 0.03, sd * 0.15 + 0.03, -0.05, 0.02, 0.35, 0.65, 'metal', (0.4, 0.4), (-sd * 0.05, 0))  # mandibles
        xb(m, sd * 0.18, sd * 0.28, 0.08, 0.11, -0.3, 0.1, 'accent')
        m.engine(sd * 0.12, -0.04, -0.5, 0.06, 0.05, 0.12)

# Medium
def corvette_d(m): # stepped ziggurat with side sponsons
    m.block(-0.32, 0.32, -0.14, 0.04, -0.75, 0.55, 'hull', (0.7, 0.8))
    m.block(-0.32, 0.32, -0.14, 0.04, 0.55, 0.8, 'hull', (0.3, 0.5), (0, -0.03))
    m.block(-0.22, 0.22, 0.04, 0.14, -0.6, 0.3, 'hull', (0.8, 1))
    m.block(-0.13, 0.13, 0.14, 0.24, -0.45, 0.0, 'hull', (0.8, 1))
    m.block(-0.1, 0.1, 0.18, 0.23, 0.0, 0.03, 'glass')
    m.turret(0, 0.14, 0.2, 0.065, 0.22)
    for sd in (-1, 1):
        m.egg(0.07, 0.07, -0.55, 0.25, 'metal', x=sd * 0.38, y=-0.06, taper=0.5)                 # sponsons
        m.gunpod(sd * 0.38, -0.06, 0.2, 0.35, 0.04, 0.22)
        xb(m, sd * 0.3, sd * 0.33, -0.1, 0.02, -0.7, 0.4, 'accent')
        m.engine(sd * 0.16, -0.05, -0.75, 0.08, 0.07, 0.12)

def corvette_e(m): # sensor catamaran: two pontoons and a big array slung between them
    for sd in (-1, 1):
        x = sd * 0.3
        m.egg(0.1, 0.1, -0.8, 0.75, 'hull', x=x, taper=0.35, mid=0.55)
        m.block(x - 0.03, x + 0.03, 0.08, 0.11, -0.5, 0.4, 'accent')
        m.engine(x, 0, -0.8, 0.07, 0.07, 0.12)
    for z in (-0.4, 0.3): m.block(-0.3, 0.3, -0.03, 0.03, z - 0.06, z + 0.06, 'metal')
    m.block(-0.2, 0.2, -0.02, 0.02, -0.3, 0.2, 'glass')                                            # the array
    m.block(-0.08, 0.08, 0.02, 0.18, -0.15, 0.1, 'hull', (0.8, 1))
    m.block(-0.06, 0.06, 0.13, 0.17, 0.1, 0.12, 'glass')
    m.egg(0.12, 0.05, 0.25, 0.55, 'metal', y=-0.05, taper=0.5)                                       # forward dish
    m.turret(0, 0.18, -0.05, 0.06, 0.2)

def corvette_f(m): # tusker: two great forward tusks and an engine block
    m.block(-0.22, 0.22, -0.13, 0.12, -0.7, 0.35, 'hull', (0.8, 0.85))
    m.block(-0.22, 0.22, -0.13, 0.12, 0.35, 0.6, 'hull', (0.4, 0.5))
    m.block(-0.1, 0.1, 0.12, 0.2, -0.1, 0.25, 'glass', (0.8, 0.5))
    for sd in (-1, 1):
        m.block(sd * 0.22 - 0.06, sd * 0.22 + 0.06, -0.12, -0.0, 0.0, 0.5, 'metal')                    # tusk roots
        m.spike(sd * 0.24, -0.06, 0.5, 0.055, 0.55, 'accent', up=0.04, out=-sd * 0.05)                # tusks
        m.plate(sd, 0.2, -0.7, -0.4, 0.42, -0.75, -0.6, 0.0, 0.014, 'metal', ty=-0.1)
    m.turret(0, 0.12, -0.35, 0.07, 0.22)
    m.block(-0.26, 0.26, -0.16, 0.15, -0.92, -0.7, 'metal')
    for x in (-0.13, 0.13): m.engine(x, -0.01, -0.92, 0.08, 0.09, 0.12)

def frigate_d(m):  # container hauler: a spine stacked with modules, guns on top
    m.block(-0.07, 0.07, -0.07, 0.07, -1.0, 0.75, 'metal')
    m.block(-0.2, 0.2, -0.12, 0.14, 0.7, 1.0, 'hull', (0.7, 0.7))
    m.block(-0.12, 0.12, 0.1, 0.18, 0.75, 0.92, 'glass', (0.8, 0.6))
    for i, z in enumerate((-0.6, -0.3, 0.0, 0.3)):
        for sd in (-1, 1):
            m.block(sd * 0.15 - 0.12, sd * 0.15 + 0.12, -0.11, 0.11, z - 0.12, z + 0.12, 'hull' if (i + (sd > 0)) % 2 else 'metal')
        m.block(-0.28, 0.28, 0.105, 0.125, z - 0.02, z + 0.02, 'accent')
    m.turret(0, 0.11, 0.45, 0.07, 0.24)
    m.turret(0, 0.11, -0.8, 0.065, 0.2)
    m.block(-0.011, 0.011, 0.14, 0.42, 0.82, 0.85, 'metal')
    for x in (-0.12, 0.12): m.engine(x, 0, -1.0, 0.08, 0.08, 0.14)

def frigate_e(m):  # radiator-sail frigate: a slim hull under tall dorsal and ventral sails
    m.egg(0.16, 0.14, -0.95, 0.95, 'hull', taper=0.3, mid=0.55)
    m.block(-0.1, 0.1, 0.1, 0.18, 0.5, 0.75, 'glass', (0.7, 0.5))
    m.fin(0, 0.12, 0.62, -0.7, 0.2, 0.02, 'accent', 0.6)                                            # dorsal sail
    m.block(-0.02, 0.02, -0.62, -0.12, -0.7, 0.1, 'accent', (1, 0.6), (0, 0.1))                     # ventral sail
    for z in (-0.4, -0.1): m.block(-0.022, 0.022, 0.15, 0.55, z, z + 0.03, 'metal')                 # sail ribs
    for sd in (-1, 1):
        m.turret(sd * 0.12, 0.08, 0.3, 0.065, 0.22)
        m.plate(sd, 0.14, -0.9, -0.55, 0.36, -0.95, -0.75, 0.0, 0.015)
    m.engine(0, 0, -0.95, 0.12, 0.1, 0.16)

def frigate_f(m):  # warp-ring frigate: a hull threaded through a great ring up front
    m.block(-0.13, 0.13, -0.11, 0.11, -0.95, 0.5, 'hull', (0.8, 0.8))
    m.block(-0.13, 0.13, -0.11, 0.11, 0.5, 0.85, 'hull', (0.3, 0.4))
    m.block(-0.08, 0.08, 0.1, 0.17, 0.1, 0.4, 'glass', (0.7, 0.5))
    m.ring(0.45, 0.42, 0.06, 18, 'metal', 0.05)                                                     # the warp ring
    m.ring(0.45, 0.42, 0.062, 18, 'accent', 0.015)
    for a in (math.pi / 4, 3 * math.pi / 4, 5 * math.pi / 4, 7 * math.pi / 4):
        cx, cy = 0.27 * math.cos(a), 0.27 * math.sin(a)
        m.block(cx - 0.03, cx + 0.03, cy - 0.03, cy + 0.03, 0.4, 0.5, 'metal')
    m.turret(0, 0.11, -0.3, 0.07, 0.24)
    for sd in (-1, 1): m.plate(sd, 0.12, -0.9, -0.5, 0.4, -0.95, -0.7, 0.0, 0.016, 'hull', ty=0.12)
    for x in (-0.07, 0.07): m.engine(x, 0, -0.95, 0.06, 0.08, 0.14)

def gunboat_d(m):  # twin rails: two long rail barrels with the ship at their back
    m.block(-0.28, 0.28, -0.14, 0.12, -0.85, -0.15, 'hull', (0.85, 0.9))
    m.block(-0.12, 0.12, 0.12, 0.24, -0.7, -0.3, 'hull', (0.8, 1))
    m.block(-0.1, 0.1, 0.18, 0.23, -0.3, -0.27, 'glass')
    for sd in (-1, 1):
        x = sd * 0.13
        m.block(x - 0.05, x + 0.05, -0.05, 0.05, -0.15, 1.0, 'metal')                                # rails
        for z in (0.1, 0.4, 0.7): m.block(x - 0.07, x + 0.07, -0.07, 0.07, z - 0.04, z + 0.04, 'accent')
        m.block(x - 0.025, x + 0.025, -0.025, 0.025, 1.0, 1.04, 'glow')
        m.plate(sd, 0.28, -0.8, -0.5, 0.5, -0.85, -0.65, 0.0, 0.014, 'metal', ty=-0.08)
        m.engine(sd * 0.15, -0.02, -0.85, 0.09, 0.08, 0.14)
    m.block(-0.16, 0.16, -0.07, 0.07, 0.25, 0.32, 'metal')                                           # rail brace

def gunboat_e(m):  # turtle: a broad armoured shell bristling with small turrets
    m.egg(0.42, 0.18, -0.75, 0.7, 'hull', y=0.0, taper=0.55, mid=0.45)
    m.block(-0.3, 0.3, -0.18, -0.06, -0.65, 0.6, 'metal', (0.7, 1))
    m.block(-0.1, 0.1, 0.12, 0.2, 0.35, 0.55, 'glass', (0.8, 0.5))
    for z, x in ((0.15, 0.0), (-0.2, 0.2), (-0.2, -0.2), (-0.5, 0.0)): m.turret(x, 0.15, z, 0.06, 0.2)
    for sd in (-1, 1):
        xb(m, sd * 0.36, sd * 0.43, -0.04, 0.04, -0.5, 0.3, 'accent')
        m.engine(sd * 0.18, -0.05, -0.75, 0.09, 0.07, 0.12)
    m.engine(0, -0.05, -0.75, 0.07, 0.07, 0.12)

def gunboat_f(m):  # missile barge: a long block covered in launch cells
    m.block(-0.24, 0.24, -0.14, 0.12, -0.85, 0.6)
    m.block(-0.24, 0.24, -0.14, 0.12, 0.6, 0.85, 'hull', (0.5, 0.6), (0, -0.02))
    for z in (-0.6, -0.35, -0.1, 0.15, 0.4):
        for x in (-0.12, 0.0, 0.12):
            m.block(x - 0.045, x + 0.045, 0.12, 0.14, z - 0.08, z + 0.08, 'metal', over={3: 'void'})  # launch cells
    m.block(-0.08, 0.08, 0.12, 0.24, 0.6, 0.75, 'hull', (0.8, 0.8))
    m.block(-0.07, 0.07, 0.18, 0.23, 0.75, 0.78, 'glass')
    for sd in (-1, 1):
        xb(m, sd * 0.24, sd * 0.28, -0.12, 0.1, -0.8, 0.55, 'accent')
        m.block(sd * 0.18 - 0.02, sd * 0.18 + 0.02, -0.38, -0.14, -0.85, -0.5, 'metal', (1, 0.5), (0, 0.06))
        m.engine(sd * 0.13, -0.02, -0.85, 0.08, 0.08, 0.14)

# Large
def destroyer_d(m):  # outrigger trident: a central hull and two forward outriggers
    m.block(-0.2, 0.2, -0.14, 0.12, -1.4, 0.9, 'hull', (0.8, 0.9))
    m.block(-0.2, 0.2, -0.14, 0.12, 0.9, 1.4, 'hull', (0.15, 0.3), (0, -0.03))
    m.block(-0.12, 0.12, 0.12, 0.26, -0.7, -0.3, 'hull', (0.8, 1))
    m.block(-0.1, 0.1, 0.2, 0.25, -0.3, -0.27, 'glass')
    for z in (0.5, 0.1): m.turret(0, 0.12, z, 0.1, 0.32)
    for sd in (-1, 1):
        x = sd * 0.62
        m.plate(sd, 0.18, -0.5, -0.1, 0.6, -0.4, 0.0, 0.0, 0.03)                                 # arms
        m.egg(0.11, 0.1, -0.7, 1.1, 'hull', x=x, taper=0.3, mid=0.6)                              # outriggers
        m.gunpod(x, 0.08, 0.6, 0.95, 0.045, 0.35)
        xb(m, x - 0.03, x + 0.03, 0.08, 0.11, -0.6, 0.5, 'accent')
        m.engine(x, 0, -0.7, 0.07, 0.07, 0.12)
    for x in (-0.1, 0.1): m.engine(x, -0.01, -1.4, 0.08, 0.09, 0.14)

def destroyer_e(m):  # nacelle stiletto: a slim blade with two big engine nacelles on short wings
    m.block(-0.16, 0.16, -0.1, 0.1, -1.3, 0.8, 'hull', (0.8, 0.9))
    m.block(-0.16, 0.16, -0.1, 0.1, 0.8, 1.55, 'hull', (0.05, 0.2), (0, -0.02))
    m.block(-0.1, 0.1, 0.1, 0.18, 0.2, 0.6, 'glass', (0.6, 0.5))
    m.turret(0, 0.1, -0.1, 0.09, 0.3)
    m.turret(0, 0.1, -0.6, 0.08, 0.26)
    for sd in (-1, 1):
        x = sd * 0.55
        m.plate(sd, 0.14, -0.9, -0.4, 0.5, -0.8, -0.45, 0.0, 0.03)
        m.egg(0.13, 0.13, -1.35, -0.1, 'metal', x=x, taper=0.6, mid=0.4)                          # nacelles
        m.ring(-0.6, 0.135, 0.03, 10, 'accent', 0.03, x=x)
        m.engine(x, 0, -1.35, 0.1, 0.1, 0.12)
    m.engine(0, 0, -1.3, 0.08, 0.07, 0.12)

def destroyer_f(m):  # monolith: a tall black slab with a glowing seam
    m.block(-0.13, 0.13, -0.55, 0.55, -1.2, 1.0, 'hull', (0.8, 0.85))
    m.block(-0.13, 0.13, -0.55, 0.55, 1.0, 1.35, 'hull', (0.4, 0.3))
    m.block(-0.135, 0.135, -0.02, 0.02, -1.15, 1.3, 'glow')                                          # the seam
    m.block(-0.14, 0.14, 0.3, 0.45, 0.6, 0.9, 'glass')
    for sd in (-1, 1):
        for z, y in ((0.6, 0.28), (0.0, -0.28), (-0.6, 0.28)):
            m.gunpod(sd * 0.18, y, z - 0.1, z + 0.15, 0.05, 0.25)
        xb(m, sd * 0.13, sd * 0.16, -0.5, 0.5, -1.2, -1.0, 'accent')
    for y in (-0.3, 0.0, 0.3): m.engine(0, y, -1.2, 0.09, 0.1, 0.12)

def battleship_d(m):  # fortress: a vast block with a tower at every corner and a central keep
    m.block(-0.55, 0.55, -0.22, 0.12, -1.3, 1.0)
    m.block(-0.55, 0.55, -0.22, 0.12, 1.0, 1.4, 'hull', (0.5, 0.6), (0, -0.03))
    for sx in (-1, 1):
        for z in (-1.1, 0.75):
            x = sx * 0.45
            m.block(x - 0.11, x + 0.11, 0.12, 0.5, z - 0.11, z + 0.11, 'hull', (0.8, 1))             # corner towers
            m.block(x - 0.12, x + 0.12, 0.44, 0.5, z - 0.12, z + 0.12, 'accent')
            m.turret(x, 0.5, z, 0.06, 0.18)
        for z in (-0.6, -0.2, 0.2): m.turret(sx * 0.42, 0.12, z, 0.08, 0.26)
    m.block(-0.22, 0.22, 0.12, 0.42, -0.55, 0.1, 'hull', (0.85, 1))                                  # keep
    m.block(-0.14, 0.14, 0.42, 0.62, -0.4, -0.05, 'hull', (0.8, 1))
    m.block(-0.12, 0.12, 0.54, 0.6, -0.05, -0.02, 'glass')
    m.block(-0.012, 0.012, 0.62, 0.95, -0.25, -0.22, 'metal')
    m.block(-0.58, 0.58, -0.26, 0.16, -1.55, -1.3, 'metal')
    for x in (-0.36, -0.12, 0.12, 0.36): m.engine(x, -0.05, -1.55, 0.09, 0.1, 0.12)

def battleship_e(m):  # broadside hammer: a long hull, a hammer prow and stepped gun decks along both flanks
    m.block(-0.3, 0.3, -0.2, 0.16, -1.5, 0.8)
    m.block(-0.62, 0.62, -0.22, 0.18, 0.8, 1.25, 'hull', (0.85, 0.85))                                # hammer prow
    m.block(-0.63, 0.63, 0.1, 0.16, 0.95, 1.1, 'accent')
    m.block(-0.15, 0.15, 0.18, 0.3, 0.85, 1.15, 'glass', (0.8, 0.6))
    for sd in (-1, 1):
        for i, z in enumerate((-1.1, -0.7, -0.3, 0.1, 0.5)):
            xb(m, sd * 0.3, sd * 0.44, -0.14, 0.06 + 0.02 * (i % 2), z - 0.16, z + 0.16, 'hull')    # gun decks
            m.turret(sd * 0.38, 0.06 + 0.02 * (i % 2), z, 0.065, 0.2)
        m.gunpod(sd * 0.5, -0.05, 1.0, 1.25, 0.05, 0.3)
    m.block(-0.18, 0.18, 0.16, 0.38, -1.25, -0.7, 'hull', (0.8, 1))
    m.block(-0.15, 0.15, 0.3, 0.36, -0.7, -0.67, 'glass')
    m.block(-0.34, 0.34, -0.24, 0.2, -1.7, -1.5, 'metal')
    for x in (-0.2, 0, 0.2): m.engine(x, -0.02, -1.7, 0.09, 0.11, 0.12)

def battleship_f(m):  # ring-cannon: two great rings around a spinal gun the length of the ship
    m.block(-0.32, 0.32, -0.22, 0.2, -1.5, -0.3)
    m.block(-0.22, 0.22, -0.16, 0.15, -0.3, 0.4, 'hull', (0.8, 0.85))
    m.block(-0.08, 0.08, -0.07, 0.07, 0.4, 1.6, 'metal')                                              # spinal gun
    m.block(-0.04, 0.04, -0.04, 0.04, 1.6, 1.65, 'glow')
    for z in (0.75, 1.25):
        m.ring(z, 0.38, 0.06, 18, 'hull', 0.07)                                                       # the rings
        m.ring(z, 0.38, 0.062, 18, 'accent', 0.02)
        for a in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
            cx, cy = 0.22 * math.cos(a), 0.22 * math.sin(a)
            m.block(cx - 0.025, cx + 0.025, cy - 0.025, cy + 0.025, z - 0.04, z + 0.04, 'metal')
    m.block(-0.18, 0.18, 0.2, 0.42, -1.2, -0.6, 'hull', (0.8, 1))
    m.block(-0.15, 0.15, 0.34, 0.4, -0.6, -0.57, 'glass')
    for sd in (-1, 1):
        m.turret(sd * 0.22, 0.2, -0.2, 0.08, 0.26)
        m.plate(sd, 0.32, -1.45, -0.7, 0.75, -1.55, -1.2, 0.0, 0.02, 'metal', ty=0.1)
    m.block(-0.35, 0.35, -0.25, 0.23, -1.7, -1.5, 'metal')
    for x, y in ((-0.18, -0.1), (0.18, -0.1), (-0.18, 0.1), (0.18, 0.1)): m.engine(x, y, -1.7, 0.09, 0.08, 0.12)

def carrier_d(m):  # flat-top: a long flight deck with an island tower on one side
    m.block(-0.45, 0.45, -0.25, 0.06, -1.35, 1.2, 'hull', (0.9, 1))
    m.block(-0.45, 0.45, -0.25, 0.06, 1.2, 1.4, 'hull', (0.7, 0.7))
    m.block(-0.3, 0.3, -0.2, 0.0, 1.25, 1.41, 'void')                                                  # bow hangar
    m.block(-0.4, 0.4, 0.06, 0.08, -1.2, 1.15, 'metal')                                                # the deck
    for z in (-0.8, -0.2, 0.4, 1.0): m.block(-0.02, 0.02, 0.08, 0.09, z, z + 0.35, 'accent')            # deck markings
    m.block(0.22, 0.4, 0.08, 0.42, -0.6, -0.1, 'hull', (0.9, 1))                                       # island
    m.block(0.24, 0.38, 0.32, 0.38, -0.1, -0.07, 'glass')
    m.block(0.3, 0.32, 0.42, 0.65, -0.4, -0.37, 'metal')
    m.turret(-0.3, 0.08, -1.0, 0.065, 0.2)
    m.turret(0.3, 0.08, 0.7, 0.065, 0.2)
    for x in (-0.28, -0.1, 0.1, 0.28): m.engine(x, -0.1, -1.35, 0.07, 0.1, 0.12)

def carrier_e(m):  # saucer mothership: a wide disc with bays around the rim and a tall command spire
    m.egg(0.85, 0.16, -0.95, 0.95, 'hull', taper=0.6, mid=0.5)                                         # saucer
    m.egg(0.5, 0.12, -0.6, 0.6, 'metal', y=-0.12, taper=0.6, mid=0.5)                                  # belly
    for a in range(8):
        ang = 2 * math.pi * a / 8 + math.pi / 8
        cx, cz = 0.62 * math.sin(ang), 0.62 * math.cos(ang)
        m.block(cx - 0.1, cx + 0.1, 0.05, 0.13, cz - 0.1, cz + 0.1, 'metal', over={3: 'void'})        # rim bays
    m.block(-0.14, 0.14, 0.12, 0.45, -0.25, 0.1, 'hull', (0.6, 1))                                     # spire
    m.block(-0.1, 0.1, 0.34, 0.42, 0.1, 0.13, 'glass')
    m.block(-0.012, 0.012, 0.45, 0.75, -0.1, -0.07, 'metal')
    m.block(-0.86, 0.86, -0.01, 0.01, -0.06, 0.06, 'accent')
    m.block(-0.01, 0.01, -0.01, 0.17, -0.9, 0.9, 'accent')
    for x in (-0.3, 0.0, 0.3): m.engine(x, -0.05, -0.95, 0.08, 0.07, 0.12)

def carrier_f(m):  # drone tree: a spine with racks of drones hanging off its branches
    m.block(-0.11, 0.11, -0.11, 0.11, -1.45, 1.0, 'metal')
    m.block(-0.24, 0.24, -0.16, 0.18, 0.9, 1.4, 'hull', (0.5, 0.6))
    m.block(-0.14, 0.14, 0.12, 0.2, 1.05, 1.25, 'glass', (0.7, 0.5))
    for z in (-0.95, -0.45, 0.05, 0.55):
        for sd in (-1, 1):
            m.plate(sd, 0.1, z - 0.05, z + 0.05, 0.62, z - 0.1, z, 0.0, 0.02, 'metal', ty=0.12)        # branches
            for k, x in enumerate((0.3, 0.46, 0.62)):
                dx = sd * x
                m.block(dx - 0.05, dx + 0.05, 0.02 + k * 0.04, 0.07 + k * 0.04, z - 0.1, z + 0.08, 'hull', (0.3, 0.5))  # drones
            xb(m, sd * 0.62, sd * 0.66, 0.08, 0.16, z - 0.12, z + 0.02, 'accent')
    m.turret(0, 0.11, 0.3, 0.07, 0.22)
    m.block(-0.26, 0.26, -0.2, 0.2, -1.65, -1.45, 'metal')
    for x, y in ((-0.12, -0.1), (0.12, -0.1), (-0.12, 0.1), (0.12, 0.1)): m.engine(x, y, -1.65, 0.08, 0.08, 0.12)

# ---------------------------------------------------------------- variants 7-11: five more designs per ship type (v0.63)
# Small
def scout_g(m):    # stiletto: a forked nose with a glowing sensor core between the prongs
    m.block(-0.08, 0.08, -0.05, 0.05, -0.45, 0.15)
    for sd in (-1, 1):
        xb(m, sd * 0.03, sd * 0.09, -0.04, 0.04, 0.15, 0.62, 'hull', (0.3, 0.5), (sd * 0.01, -0.01))   # prongs
        xb(m, sd * 0.08, sd * 0.1, -0.02, 0.02, 0.1, 0.45, 'accent')
        m.plate(sd, 0.07, -0.42, -0.2, 0.26, -0.5, -0.38, 0.0, 0.012)
    m.block(-0.025, 0.025, -0.025, 0.025, 0.3, 0.42, 'glow')                                         # sensor core
    m.block(-0.05, 0.05, 0.05, 0.1, -0.15, 0.12, 'glass', (0.6, 0.4))
    m.fin(0, 0.05, 0.2, -0.45, -0.25)
    m.engine(0, 0, -0.45, 0.06, 0.045, 0.1)

def scout_h(m):    # moth: a slim body under two wide glass sails
    m.egg(0.07, 0.07, -0.45, 0.5, 'hull', taper=0.3, mid=0.5)
    m.block(-0.04, 0.04, 0.06, 0.1, 0.1, 0.3, 'glass', (0.6, 0.4))
    for sd in (-1, 1):
        m.plate(sd, 0.06, -0.25, 0.2, 0.45, -0.35, 0.05, 0.06, 0.01, 'glass', ty=0.14)                 # sails
        m.plate(sd, 0.06, -0.26, -0.22, 0.46, -0.36, -0.32, 0.061, 0.012, 'accent', ty=0.141)          # sail edge
        m.spike(sd * 0.03, 0.04, 0.42, 0.01, 0.22, 'metal', 0.04, sd * 0.08)                            # feelers
    m.engine(0, 0, -0.45, 0.05, 0.05, 0.08)

def scout_i(m):    # kite: a diamond sensor sail on a short body, trailing a tail of beads
    m.block(-0.06, 0.06, -0.05, 0.05, -0.3, 0.3)
    m.block(-0.06, 0.06, -0.05, 0.05, 0.3, 0.5, 'hull', (0.2, 0.3))
    m.block(-0.04, 0.04, 0.05, 0.09, 0.05, 0.28, 'glass', (0.6, 0.4))
    for sd in (-1, 1):
        m.plate(sd, 0.05, -0.15, 0.3, 0.3, 0.05, 0.1, 0.02, 0.01, 'glass')                                  # the sail, front half
        m.plate(sd, 0.05, -0.2, -0.15, 0.3, 0.05, 0.1, 0.02, 0.01, 'glass')                                 # back half
        m.plate(sd, 0.28, 0.04, 0.11, 0.33, 0.06, 0.09, 0.021, 0.012, 'accent')                              # sail tips
    for k, z in enumerate((-0.42, -0.55, -0.66)): m.block(-0.03 + k * 0.005, 0.03 - k * 0.005, -0.03, 0.03, z - 0.04, z + 0.04, 'accent' if k % 2 else 'metal')   # tail beads
    m.engine(0, 0, -0.3, 0.05, 0.045, 0.08)

def scout_j(m):    # courier: a stubby delta with two drop tanks and a long-range dish
    m.block(-0.1, 0.1, -0.05, 0.05, -0.4, 0.2)
    m.block(-0.1, 0.1, -0.05, 0.05, 0.2, 0.5, 'hull', (0.3, 0.4), (0, -0.02))
    m.block(-0.06, 0.06, 0.05, 0.11, -0.05, 0.25, 'glass', (0.6, 0.35))
    for sd in (-1, 1):
        m.plate(sd, 0.09, -0.4, 0.1, 0.34, -0.42, -0.3, 0.0, 0.014)
        m.egg(0.035, 0.035, -0.35, 0.05, 'metal', x=sd * 0.2, y=-0.06, taper=0.4)                    # drop tanks
        xb(m, sd * 0.31, sd * 0.36, -0.01, 0.02, -0.42, -0.3, 'accent')
    m.block(-0.08, 0.08, 0.08, 0.16, -0.35, -0.3, 'metal', (1.4, 1.4))                                # dish
    m.block(-0.02, 0.02, 0.05, 0.1, -0.33, -0.3, 'metal')
    m.engine(0, 0, -0.4, 0.07, 0.045, 0.1)

def scout_k(m):    # tri-fin needle: three fins at 120 degrees and a lance twice its length
    m.block(-0.06, 0.06, -0.06, 0.06, -0.45, 0.25)
    m.block(-0.06, 0.06, -0.06, 0.06, 0.25, 0.5, 'hull', (0.2, 0.2))
    m.block(-0.04, 0.04, 0.05, 0.09, 0.0, 0.25, 'glass', (0.6, 0.4))
    m.fin(0, 0.06, 0.26, -0.45, -0.15, 0.015, 'hull', 0.4)
    for sd in (-1, 1):
        m.plate(sd, 0.05, -0.45, -0.15, 0.22, -0.5, -0.35, -0.03, 0.012, 'hull', ty=-0.16)             # lower fins
        m.plate(sd, 0.2, -0.5, -0.42, 0.23, -0.5, -0.44, -0.15, 0.014, 'accent', ty=-0.17)
    m.block(-0.01, 0.01, -0.01, 0.01, 0.5, 0.75, 'metal')                                              # lance
    m.block(-0.02, 0.02, -0.02, 0.02, 0.74, 0.78, 'glow')
    m.engine(0, 0, -0.45, 0.055, 0.055, 0.1)

def fighter_g(m):  # talon: forward-swept wings ending in hooked claws
    m.block(-0.12, 0.12, -0.07, 0.07, -0.55, 0.2)
    m.block(-0.12, 0.12, -0.07, 0.07, 0.2, 0.65, 'hull', (0.25, 0.4), (0, -0.02))
    m.block(-0.07, 0.07, 0.07, 0.15, -0.05, 0.3, 'glass', (0.6, 0.35), (0, -0.02))
    for sd in (-1, 1):
        m.plate(sd, 0.11, -0.4, -0.1, 0.55, -0.05, 0.2, 0.0, 0.018)                                    # forward sweep
        m.spike(sd * 0.55, 0.0, 0.1, 0.03, 0.22, 'metal', -0.04, -sd * 0.08)                          # claws
        m.spike(sd * 0.5, 0.0, 0.05, 0.025, 0.18, 'accent', -0.05, -sd * 0.04)
        m.gunpod(sd * 0.3, -0.03, -0.15, 0.1, 0.035, 0.22, twin=False)
        m.engine(sd * 0.08, 0, -0.55, 0.06, 0.06, 0.15)
        m.fin(sd * 0.1, 0.07, 0.22, -0.55, -0.32)

def fighter_h(m):  # twin boom: a central pod between two engine booms joined by one wing
    m.egg(0.1, 0.09, -0.25, 0.55, 'hull', taper=0.35, mid=0.45)
    m.block(-0.065, 0.065, 0.06, 0.14, 0.05, 0.35, 'glass', (0.6, 0.35))
    m.block(-0.55, 0.55, -0.015, 0.015, -0.25, 0.0)                                                    # main wing
    for sd in (-1, 1):
        x = sd * 0.3
        m.block(x - 0.06, x + 0.06, -0.06, 0.06, -0.65, 0.3, 'hull', (0.5, 0.5))                      # booms
        m.block(x - 0.062, x + 0.062, 0.03, 0.05, -0.4, 0.1, 'accent')
        m.fin(x, 0.06, 0.24, -0.65, -0.45)
        m.engine(x, 0, -0.65, 0.05, 0.05, 0.1)
        m.gunpod(sd * 0.52, 0, -0.2, 0.05, 0.03, 0.2, twin=False)
    m.block(-0.3, 0.3, 0.2, 0.23, -0.65, -0.5, 'hull')                                                 # tail plane

def fighter_i(m):  # bat-wing: a scalloped wing with three trailing points and two ear fins
    m.block(-0.1, 0.1, -0.06, 0.06, -0.5, 0.2)
    m.block(-0.1, 0.1, -0.06, 0.06, 0.2, 0.55, 'hull', (0.3, 0.4))
    m.block(-0.06, 0.06, 0.06, 0.13, -0.05, 0.25, 'glass', (0.6, 0.35))
    for sd in (-1, 1):
        for k, (tx, tz) in enumerate(((0.3, -0.5), (0.48, -0.42), (0.64, -0.3))):
            m.plate(sd, 0.09, -0.3 + k * 0.04, 0.15 - k * 0.05, tx, tz - 0.06, tz, 0.0, 0.015, 'hull' if k != 1 else 'accent')
        m.fin(sd * 0.07, 0.06, 0.24, 0.1, 0.3, 0.014, 'hull', 0.3)                                    # ears
        m.gunpod(sd * 0.16, -0.05, 0.0, 0.25, 0.03, 0.2, twin=False)
    m.engine(0, 0, -0.5, 0.08, 0.06, 0.14)

def fighter_j(m):  # box-wing: an upper and a lower wing joined at the tips by gun-carrying end plates
    m.block(-0.11, 0.11, -0.07, 0.07, -0.55, 0.25)
    m.block(-0.11, 0.11, -0.07, 0.07, 0.25, 0.65, 'hull', (0.25, 0.4), (0, -0.02))
    m.block(-0.07, 0.07, 0.07, 0.15, -0.05, 0.3, 'glass', (0.6, 0.35))
    for sd in (-1, 1):
        m.plate(sd, 0.1, -0.35, 0.05, 0.5, -0.45, -0.15, 0.12, 0.016, 'hull', ty=0.16)                       # upper wing
        m.plate(sd, 0.1, -0.4, 0.0, 0.5, -0.45, -0.15, -0.08, 0.016, 'hull', ty=-0.12)                       # lower wing
        xb(m, sd * 0.48, sd * 0.53, -0.13, 0.18, -0.48, -0.12, 'accent')                                     # end plates
        m.gunpod(sd * 0.505, 0.02, -0.2, -0.05, 0.03, 0.28, twin=False)
        m.block(min(sd * 0.1, sd * 0.13), max(sd * 0.1, sd * 0.13), 0.07, 0.13, -0.3, -0.05, 'metal')          # upper wing root
        m.engine(sd * 0.07, 0, -0.55, 0.05, 0.055, 0.14)

def fighter_k(m):  # scythe: long blade wings that sweep back and droop at the tips
    m.block(-0.11, 0.11, -0.07, 0.07, -0.55, 0.15)
    m.block(-0.11, 0.11, -0.07, 0.07, 0.15, 0.7, 'hull', (0.15, 0.3), (0, -0.03))
    m.block(-0.07, 0.07, 0.07, 0.15, -0.1, 0.25, 'glass', (0.6, 0.35))
    for sd in (-1, 1):
        m.plate(sd, 0.1, -0.3, 0.1, 0.42, -0.45, -0.25, 0.02, 0.016, 'hull', ty=-0.02)
        m.plate(sd, 0.42, -0.45, -0.25, 0.72, -0.75, -0.6, -0.02, 0.016, 'hull', ty=-0.16)           # drooping blade
        m.plate(sd, 0.42, -0.26, -0.24, 0.72, -0.61, -0.58, -0.02, 0.018, 'accent', ty=-0.16)
        m.engine(sd * 0.07, 0, -0.55, 0.05, 0.055, 0.15)
        m.gunpod(sd * 0.2, -0.04, -0.1, 0.15, 0.03, 0.25, twin=False)
    m.fin(0, 0.07, 0.28, -0.55, -0.3)

def heavy_g(m):    # hammer bomber: a broad flat hull, an open bomb bay and four engines
    m.block(-0.32, 0.32, -0.1, 0.07, -0.6, 0.3)
    m.block(-0.32, 0.32, -0.1, 0.07, 0.3, 0.55, 'hull', (0.8, 0.5), (0, -0.02))
    m.block(-0.18, 0.18, -0.12, -0.1, -0.35, 0.15, 'void')                                             # bomb bay
    m.block(-0.12, 0.12, 0.07, 0.16, -0.2, 0.25, 'hull', (0.8, 0.6))
    m.block(-0.08, 0.08, 0.1, 0.17, 0.15, 0.3, 'glass', (0.7, 0.4))
    m.block(-0.33, 0.33, 0.05, 0.08, -0.45, -0.35, 'accent')
    for sd in (-1, 1):
        m.plate(sd, 0.3, -0.5, -0.1, 0.55, -0.55, -0.35, 0.0, 0.02)
        m.turret(sd * 0.2, 0.07, -0.05, 0.05, 0.18)
        for x in (0.12, 0.26): m.engine(sd * x, -0.01, -0.6, 0.06, 0.06, 0.12)

def heavy_h(m):    # beetle: an armoured shell over the hull, mandible cannons in front
    m.egg(0.3, 0.12, -0.55, 0.45, 'metal', taper=0.6, mid=0.45)
    m.egg(0.32, 0.16, -0.5, 0.35, 'hull', y=0.06, taper=0.55, mid=0.4)                                 # shell
    m.block(-0.005, 0.005, 0.18, 0.23, -0.45, 0.25, 'accent')                                          # shell seam
    m.block(-0.08, 0.08, 0.03, 0.12, 0.3, 0.45, 'glass', (0.7, 0.5))
    for sd in (-1, 1):
        m.spike(sd * 0.18, -0.03, 0.3, 0.05, 0.4, 'metal', -0.02, -sd * 0.06)                       # mandibles
        m.gunpod(sd * 0.24, -0.06, 0.1, 0.4, 0.04, 0.22)
        m.engine(sd * 0.14, 0, -0.55, 0.07, 0.07, 0.14)
        xb(m, sd * 0.3, sd * 0.34, -0.04, 0.04, -0.4, 0.1, 'accent')

def heavy_i(m):    # tri-hull: a central cockpit hull and two bomb pods, braced by short wings
    m.block(-0.08, 0.08, -0.07, 0.07, -0.55, 0.3)
    m.block(-0.08, 0.08, -0.07, 0.07, 0.3, 0.6, 'hull', (0.3, 0.4))
    m.block(-0.055, 0.055, 0.07, 0.13, 0.05, 0.35, 'glass', (0.6, 0.35))
    for sd in (-1, 1):
        x = sd * 0.3
        m.egg(0.09, 0.09, -0.55, 0.4, 'hull', x=x, taper=0.4, mid=0.5)                                 # pods
        m.block(x - 0.092, x + 0.092, 0.02, 0.04, -0.3, 0.1, 'accent')
        m.block(min(0.08 * sd, x), max(0.08 * sd, x), -0.02, 0.02, -0.25, 0.05, 'metal')                # braces
        m.turret(x, 0.08, 0.05, 0.045, 0.16)
        m.engine(x, 0, -0.55, 0.06, 0.06, 0.12)
    m.engine(0, 0, -0.55, 0.05, 0.05, 0.1)

def heavy_j(m):    # rotary gunship: a tall-finned hull carrying two huge cannon pods
    m.block(-0.15, 0.15, -0.09, 0.09, -0.6, 0.25)
    m.block(-0.15, 0.15, -0.09, 0.09, 0.25, 0.55, 'hull', (0.5, 0.5))
    m.block(-0.09, 0.09, 0.09, 0.18, 0.0, 0.35, 'glass', (0.7, 0.4))
    m.fin(0, 0.09, 0.4, -0.6, -0.2, 0.02, 'hull', 0.35)
    m.block(-0.005, 0.005, 0.25, 0.32, -0.55, -0.35, 'accent')
    for sd in (-1, 1):
        x = sd * 0.32
        m.plate(sd, 0.14, -0.3, 0.0, 0.32, -0.25, -0.05, -0.02, 0.02)
        m.block(x - 0.08, x + 0.08, -0.1, 0.06, -0.35, 0.25, 'metal')                                   # cannon pods
        for bx, by in ((-0.03, -0.05), (0.03, -0.05), (-0.03, 0.01), (0.03, 0.01)):
            m.block(x + bx - 0.014, x + bx + 0.014, by - 0.014, by + 0.014, 0.25, 0.55, 'metal')        # rotary barrels
        m.engine(sd * 0.09, 0, -0.6, 0.06, 0.07, 0.12)

def heavy_k(m):    # manta bomber: one broad wing body with a long tail spike
    m.block(-0.12, 0.12, -0.08, 0.08, -0.45, 0.35, 'hull', (0.5, 0.6))
    m.block(-0.08, 0.08, 0.06, 0.13, 0.1, 0.33, 'glass', (0.6, 0.4))
    for sd in (-1, 1):
        m.plate(sd, 0.11, -0.4, 0.3, 0.62, -0.25, -0.05, 0.0, 0.03)                                    # broad wings
        m.plate(sd, 0.11, 0.25, 0.38, 0.22, 0.4, 0.5, -0.02, 0.025, 'hull')                           # head fins
        m.plate(sd, 0.4, -0.3, -0.1, 0.63, -0.26, -0.06, 0.031, 0.01, 'accent')
        m.gunpod(sd * 0.2, -0.06, -0.1, 0.3, 0.035, 0.25, twin=False)
        m.engine(sd * 0.08, 0, -0.45, 0.06, 0.06, 0.12)
    m.spike(0, 0, -0.45, 0.03, -0.45, 'metal')                                                         # tail spike

# Medium
def corvette_g(m): # shark: a tapering hull, a tall dorsal fin and gill slits
    m.egg(0.2, 0.13, -0.8, 0.8, 'hull', taper=0.3, mid=0.4)
    m.block(-0.2, 0.2, -0.13, 0.13, 0.75, 0.95, 'hull', (0.15, 0.3), (0, -0.05))
    m.block(-0.1, 0.1, 0.1, 0.17, 0.35, 0.65, 'glass', (0.6, 0.4))
    m.fin(0, 0.12, 0.5, -0.3, 0.15, 0.025, 'hull', 0.3)                                                 # dorsal fin
    m.fin(0, 0.3, 0.48, -0.25, -0.05, 0.027, 'accent', 0.4)
    for sd in (-1, 1):
        for z in (0.2, 0.3, 0.4): xb(m, sd * 0.17, sd * 0.215, -0.04, 0.06, z, z + 0.03, 'void')       # gills
        m.plate(sd, 0.15, -0.3, 0.1, 0.48, -0.35, -0.15, -0.05, 0.022, 'hull', ty=-0.12)              # pectoral fins
        m.plate(sd, 0.08, -0.85, -0.6, 0.35, -0.95, -0.8, 0.0, 0.02, 'hull', ty=0.12)                 # tail
        m.gunpod(sd * 0.12, -0.12, 0.3, 0.75, 0.04, 0.25)
        m.engine(sd * 0.08, 0, -0.8, 0.07, 0.07, 0.14)

def corvette_h(m): # trident: three forward prongs, guns between them
    m.block(-0.22, 0.22, -0.1, 0.08, -0.75, 0.25)
    for x, ln in ((-0.16, 0.75), (0.0, 0.95), (0.16, 0.75)):
        m.block(x - 0.05, x + 0.05, -0.07, 0.05, 0.25, ln, 'hull', (0.3, 0.5), (0, -0.01))             # prongs
        m.block(x - 0.052, x + 0.052, 0.03, 0.05, 0.25, ln - 0.25, 'accent')
    m.block(-0.14, 0.14, 0.08, 0.2, -0.45, 0.0, 'hull', (0.8, 1))
    m.block(-0.1, 0.1, 0.14, 0.19, 0.0, 0.03, 'glass')
    m.turret(0, 0.08, 0.15, 0.08, 0.26)
    for sd in (-1, 1):
        m.plate(sd, 0.2, -0.7, -0.3, 0.44, -0.8, -0.6, 0.0, 0.022)
        m.gunpod(sd * 0.08, -0.04, 0.3, 0.55, 0.025, 0.25, twin=False)
        m.engine(sd * 0.12, -0.01, -0.75, 0.08, 0.075, 0.14)

def corvette_i(m): # rail corvette: a railgun runs the whole length and past the bow, ringed by coils
    m.block(-0.17, 0.17, -0.12, 0.06, -0.7, 0.4)
    m.block(-0.17, 0.17, -0.12, 0.06, 0.4, 0.6, 'hull', (0.6, 0.6))
    m.block(-0.05, 0.05, 0.06, 0.14, -0.75, 1.05, 'metal')                                              # the rail
    for z in (-0.3, 0.0, 0.3, 0.6, 0.85): m.ring(z, 0.075, 0.025, 8, 'accent', 0.03, y=0.1)              # coils
    m.block(-0.03, 0.03, 0.08, 0.12, 1.03, 1.06, 'glow')
    m.block(-0.12, 0.12, 0.06, 0.2, -0.6, -0.35, 'hull', (0.8, 1))                                     # bridge
    m.block(-0.08, 0.08, 0.15, 0.19, -0.35, -0.32, 'glass')
    for sd in (-1, 1):
        m.plate(sd, 0.16, -0.7, -0.2, 0.5, -0.8, -0.5, -0.03, 0.022)
        xb(m, sd * 0.46, sd * 0.52, -0.06, -0.01, -0.82, -0.5, 'accent')
        xb(m, sd * 0.46, sd * 0.5, -0.05, -0.01, -0.5, -0.2, 'metal')
        m.engine(sd * 0.1, -0.03, -0.7, 0.07, 0.07, 0.14)

def corvette_j(m): # blockade runner: a blunt armoured bow and a cluster of six engines
    m.block(-0.22, 0.22, -0.12, 0.1, -0.5, 0.45)
    m.block(-0.22, 0.22, -0.12, 0.1, 0.45, 0.7, 'hull', (0.85, 0.7), (0, -0.02))
    m.block(-0.15, 0.15, 0.08, 0.14, 0.45, 0.62, 'glass', (0.8, 0.6))
    m.block(-0.23, 0.23, 0.08, 0.11, -0.2, 0.3, 'accent')
    m.block(-0.32, 0.32, -0.16, 0.14, -0.9, -0.5, 'metal')                                              # engine block
    for x in (-0.2, 0.0, 0.2):
        for y in (-0.07, 0.07): m.engine(x, y, -0.9, 0.07, 0.06, 0.1)
    m.turret(0, 0.1, 0.1, 0.07, 0.22)
    for sd in (-1, 1):
        m.fin(sd * 0.28, 0.14, 0.32, -0.9, -0.6)
        m.gunpod(sd * 0.25, -0.08, 0.0, 0.5, 0.04, 0.2)

def corvette_k(m): # raptor: a raised cockpit, a hooked prow and anhedral wings
    m.block(-0.18, 0.18, -0.1, 0.07, -0.75, 0.35)
    m.block(-0.18, 0.18, -0.1, 0.07, 0.35, 0.8, 'hull', (0.2, 0.35), (0, -0.07))                      # hooked prow
    m.block(-0.11, 0.11, 0.07, 0.24, 0.0, 0.45, 'hull', (0.7, 0.6), (0, -0.04))                         # raised neck
    m.block(-0.08, 0.08, 0.18, 0.25, 0.3, 0.48, 'glass', (0.7, 0.5))
    for sd in (-1, 1):
        m.plate(sd, 0.17, -0.6, -0.1, 0.58, -0.75, -0.45, -0.02, 0.022, 'hull', ty=-0.2)               # wings, drooping
        xb(m, sd * 0.54, sd * 0.6, -0.24, -0.18, -0.78, -0.45, 'accent')
        m.gunpod(sd * 0.36, -0.13, -0.5, -0.1, 0.035, 0.3, twin=False)
        m.engine(sd * 0.1, -0.01, -0.75, 0.075, 0.07, 0.15)
    m.fin(0, 0.07, 0.3, -0.75, -0.45)
    m.turret(0, 0.07, -0.25, 0.07, 0.2)

def frigate_g(m):  # ring frigate: the hull runs through a great ring of habitat modules
    m.block(-0.2, 0.2, -0.12, 0.1, -0.95, 0.45)
    m.block(-0.2, 0.2, -0.12, 0.1, 0.45, 0.95, 'hull', (0.3, 0.5), (0, -0.03))
    m.ring(-0.25, 0.48, 0.07, 18, 'hull', 0.1)
    m.ring(-0.25, 0.485, 0.072, 18, 'accent', 0.02)
    for a in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
        cx, cy = 0.3 * math.cos(a), 0.3 * math.sin(a)
        m.block(cx - 0.025, cx + 0.025, cy - 0.025, cy + 0.025, -0.3, -0.2, 'metal')
    m.block(-0.12, 0.12, 0.1, 0.22, 0.05, 0.4, 'hull', (0.8, 1))
    m.block(-0.08, 0.08, 0.16, 0.21, 0.4, 0.43, 'glass')
    m.turret(0, 0.1, 0.65, 0.08, 0.26)
    m.turret(0, 0.1, -0.65, 0.07, 0.22)
    m.block(-0.24, 0.24, -0.14, 0.12, -1.1, -0.95, 'metal')
    for x in (-0.12, 0.12): m.engine(x, 0, -1.1, 0.08, 0.08, 0.12)

def frigate_h(m):  # arch catamaran: two hulls joined by a tall bridge arch
    for sd in (-1, 1):
        x = sd * 0.28
        m.block(x - 0.12, x + 0.12, -0.12, 0.06, -0.95, 0.5)
        m.block(x - 0.12, x + 0.12, -0.12, 0.06, 0.5, 0.95, 'hull', (0.3, 0.5), (0, -0.03))
        m.block(x - 0.122, x + 0.122, 0.04, 0.07, -0.6, 0.3, 'accent')
        m.turret(x, 0.06, 0.55, 0.07, 0.24)
        m.engine(x, -0.02, -0.95, 0.08, 0.07, 0.14)
        m.block(x - 0.05, x + 0.05, 0.06, 0.36, -0.3, -0.05, 'hull', (1, 1), (-sd * 0.08, 0))           # arch legs
    m.block(-0.26, 0.26, 0.32, 0.44, -0.32, -0.05, 'hull', (0.8, 1))                                    # bridge
    m.block(-0.18, 0.18, 0.37, 0.43, -0.05, -0.02, 'glass')
    m.block(-0.012, 0.012, 0.44, 0.62, -0.25, -0.21, 'metal')
    m.block(-0.16, 0.16, -0.08, 0.02, -0.5, 0.2, 'metal')                                                # spine between

def frigate_i(m):  # monitor: a low armoured hull, one huge twin turret and a citadel behind it
    m.block(-0.32, 0.32, -0.14, 0.04, -0.9, 0.55)
    m.block(-0.32, 0.32, -0.14, 0.04, 0.55, 0.95, 'hull', (0.45, 0.5), (0, -0.02))
    m.block(-0.33, 0.33, 0.02, 0.05, -0.7, 0.6, 'accent', (0.8, 1))
    m.turret(0, 0.04, 0.5, 0.16, 0.45)                                                                  # the big gun
    m.block(-0.18, 0.18, 0.04, 0.24, -0.55, 0.05, 'hull', (0.85, 1))                                     # citadel
    m.block(-0.12, 0.12, 0.24, 0.34, -0.45, -0.05, 'hull', (0.8, 1))
    m.block(-0.09, 0.09, 0.28, 0.33, -0.05, -0.02, 'glass')
    for sd in (-1, 1): m.turret(sd * 0.24, 0.04, -0.35, 0.06, 0.18)
    m.block(-0.3, 0.3, -0.16, 0.08, -1.05, -0.9, 'metal')
    for x in (-0.18, 0, 0.18): m.engine(x, -0.04, -1.05, 0.07, 0.07, 0.12)

def frigate_j(m):  # sail frigate: tall dorsal and ventral sails like a cathedral ship
    m.block(-0.2, 0.2, -0.1, 0.1, -0.9, 0.45)
    m.block(-0.2, 0.2, -0.1, 0.1, 0.45, 1.0, 'hull', (0.2, 0.4), (0, -0.02))
    m.fin(0, 0.1, 0.62, -0.6, 0.1, 0.025, 'hull', 0.35)                                                 # dorsal sail
    m.fin(0, 0.4, 0.6, -0.5, -0.25, 0.027, 'accent', 0.5)
    m.block(-0.02, 0.02, -0.5, -0.1, -0.55, 0.05, 'hull', (1, 0.4), (0, 0.12))                          # ventral sail
    m.block(-0.08, 0.08, 0.08, 0.16, 0.45, 0.7, 'glass', (0.6, 0.4))
    for sd in (-1, 1):
        m.plate(sd, 0.18, -0.85, -0.5, 0.42, -0.95, -0.8, 0.0, 0.02)
        m.turret(sd * 0.14, 0.1, 0.25, 0.06, 0.22)
        m.engine(sd * 0.1, 0, -0.9, 0.08, 0.08, 0.14)

def frigate_k(m):  # spear: a slim lance hull with turret outriggers on short wings
    m.block(-0.14, 0.14, -0.1, 0.08, -0.95, 0.6)
    m.block(-0.14, 0.14, -0.1, 0.08, 0.6, 1.2, 'hull', (0.1, 0.3), (0, -0.02))
    m.block(-0.08, 0.08, 0.08, 0.18, -0.4, 0.1, 'hull', (0.8, 1))
    m.block(-0.06, 0.06, 0.13, 0.17, 0.1, 0.13, 'glass')
    for sd in (-1, 1):
        x = sd * 0.46
        m.plate(sd, 0.13, -0.45, -0.05, 0.46, -0.35, -0.1, -0.01, 0.025)
        m.block(x - 0.07, x + 0.07, -0.06, 0.06, -0.5, 0.15, 'hull', (0.6, 0.7))                         # outriggers
        m.block(x - 0.072, x + 0.072, 0.03, 0.05, -0.4, 0.0, 'accent')
        m.turret(x, 0.06, -0.1, 0.06, 0.24)
        m.engine(x, 0, -0.5, 0.05, 0.05, 0.1)
    m.turret(0, 0.08, 0.4, 0.07, 0.24)
    m.engine(0, 0, -0.95, 0.09, 0.08, 0.14)

def gunboat_g(m):  # fortress: a square keep with four turrets on the corners and side cannons
    m.block(-0.38, 0.38, -0.15, 0.1, -0.6, 0.5)
    m.block(-0.38, 0.38, -0.15, 0.1, 0.5, 0.7, 'hull', (0.8, 0.6))
    m.block(-0.2, 0.2, 0.1, 0.3, -0.35, 0.15, 'hull', (0.85, 1))                                         # keep
    m.block(-0.14, 0.14, 0.24, 0.29, 0.15, 0.18, 'glass')
    m.block(-0.39, 0.39, 0.08, 0.11, -0.55, 0.45, 'accent', (1, 1))
    for sd in (-1, 1):
        for z in (-0.4, 0.3): m.turret(sd * 0.27, 0.1, z, 0.07, 0.22)
        m.gunpod(sd * 0.42, -0.04, -0.2, 0.3, 0.05, 0.25)
        m.engine(sd * 0.2, -0.03, -0.6, 0.09, 0.09, 0.12)

def gunboat_h(m):  # mortar boat: two great barrels angled up over a heavy base
    m.block(-0.34, 0.34, -0.16, 0.06, -0.65, 0.5)
    m.block(-0.34, 0.34, -0.16, 0.06, 0.5, 0.7, 'hull', (0.7, 0.6))
    m.block(-0.35, 0.35, 0.04, 0.08, -0.4, 0.3, 'accent', (0.9, 1))
    for sd in (-1, 1):
        x = sd * 0.15
        m.block(x - 0.1, x + 0.1, 0.06, 0.22, -0.25, 0.1, 'metal')                                       # mounts
        m.block(x - 0.05, x + 0.05, 0.12, 0.22, 0.0, 0.6, 'metal', (0.9, 0.9), (0, 0.3))                  # barrels, angled up
        m.block(x - 0.06, x + 0.06, 0.38, 0.5, 0.55, 0.62, 'metal')
        m.engine(x, -0.04, -0.65, 0.09, 0.08, 0.12)
    m.block(-0.1, 0.1, 0.06, 0.18, -0.6, -0.35, 'hull')
    m.block(-0.07, 0.07, 0.13, 0.17, -0.36, -0.34, 'glass')

def gunboat_i(m):  # flak hedgehog: a squat ball bristling with small guns
    m.egg(0.38, 0.28, -0.55, 0.55, 'hull', taper=0.55, mid=0.5)
    m.ring(0.0, 0.38, 0.035, 14, 'accent', 0.04)
    for k in range(10):
        a = 2 * math.pi * k / 10
        cx, cy = 0.3 * math.cos(a), 0.22 * math.sin(a)
        m.spike(cx, cy, 0.0, 0.025, 0.4, 'metal', cy * 0.4, cx * 0.6)                                    # flak guns
    m.turret(0, 0.27, 0.05, 0.08, 0.24)
    m.block(-0.1, 0.1, 0.05, 0.16, 0.42, 0.52, 'glass', (0.7, 0.6))
    for x in (-0.14, 0.14): m.engine(x, 0, -0.55, 0.08, 0.08, 0.12)

def gunboat_j(m):  # twin cannon: two giant parallel barrels on a squat hull
    m.block(-0.3, 0.3, -0.16, 0.06, -0.7, 0.25)
    m.block(-0.12, 0.12, 0.06, 0.2, -0.65, -0.35, 'hull', (0.85, 1))
    m.block(-0.09, 0.09, 0.15, 0.19, -0.35, -0.33, 'glass')
    for sd in (-1, 1):
        x = sd * 0.16
        m.block(x - 0.1, x + 0.1, -0.04, 0.14, -0.3, 0.3, 'metal')                                       # breech
        m.block(x - 0.06, x + 0.06, 0.0, 0.1, 0.3, 0.95, 'metal')                                         # barrel
        m.block(x - 0.075, x + 0.075, -0.015, 0.115, 0.85, 0.95, 'hull')                                  # muzzle
        m.block(x - 0.062, x + 0.062, 0.08, 0.102, 0.35, 0.8, 'accent')
        m.engine(x, -0.05, -0.7, 0.09, 0.08, 0.12)
        xb(m, sd * 0.3, sd * 0.36, -0.14, 0.04, -0.6, 0.15, 'hull')

def gunboat_k(m):  # crab: a wide shell with two claw arms that hold its guns
    m.egg(0.36, 0.14, -0.55, 0.4, 'hull', taper=0.6, mid=0.45)
    m.egg(0.24, 0.08, -0.4, 0.3, 'accent', y=0.1, taper=0.5)
    m.block(-0.1, 0.1, 0.05, 0.12, 0.3, 0.42, 'glass', (0.7, 0.5))
    for sd in (-1, 1):
        m.block(sd * 0.3 - 0.05, sd * 0.3 + 0.05, -0.05, 0.05, 0.0, 0.45, 'metal', (1, 1), (sd * 0.12, 0))  # arms
        m.spike(sd * 0.42, 0.03, 0.45, 0.05, 0.3, 'metal', 0, -sd * 0.08)                                 # claws
        m.spike(sd * 0.42, -0.06, 0.45, 0.04, 0.22, 'metal', -0.03, -sd * 0.02)
        m.gunpod(sd * 0.42, 0.0, 0.3, 0.45, 0.035, 0.3)
        for z in (-0.4, -0.2): m.spike(sd * 0.3, -0.08, z, 0.03, 0.25, 'accent', -0.06, sd * 0.25)      # legs
        m.engine(sd * 0.14, 0, -0.55, 0.08, 0.07, 0.12)

# Large
def destroyer_g(m):  # sword: a long blade, a crossguard of wings and a pommel engine
    m.block(-0.2, 0.2, -0.06, 0.06, -0.6, 1.0)
    m.block(-0.2, 0.2, -0.06, 0.06, 1.0, 1.5, 'hull', (0.05, 0.3))                                        # blade tip
    m.block(-0.01, 0.01, 0.06, 0.09, -0.5, 1.35, 'accent', (1, 1))                                       # fuller
    m.block(-0.55, 0.55, -0.1, 0.1, -0.85, -0.6, 'hull', (0.8, 1))                                       # crossguard
    for sd in (-1, 1):
        m.spike(sd * 0.55, 0, -0.75, 0.06, 0.25, 'metal', 0, sd * 0.05)
        m.turret(sd * 0.4, 0.1, -0.72, 0.07, 0.22)
    m.block(-0.12, 0.12, -0.12, 0.12, -1.3, -0.85, 'metal')                                              # grip
    m.ring(-1.05, 0.13, 0.03, 10, 'accent', 0.04)
    m.egg(0.2, 0.2, -1.6, -1.25, 'hull', taper=0.5)                                                      # pommel
    m.block(-0.08, 0.08, 0.1, 0.18, -0.8, -0.65, 'glass', (0.8, 0.6))
    m.turret(0, 0.06, 0.2, 0.08, 0.3)
    m.turret(0, 0.06, 0.65, 0.07, 0.26)
    m.engine(0, 0, -1.6, 0.11, 0.11, 0.12)

def destroyer_h(m):  # torpedo lancer: a long spine lined with racks of torpedoes
    m.block(-0.12, 0.12, -0.1, 0.1, -1.4, 1.1, 'metal')
    m.block(-0.22, 0.22, -0.14, 0.12, 0.8, 1.45, 'hull', (0.3, 0.5), (0, -0.02))                         # prow
    m.block(-0.12, 0.12, 0.1, 0.24, 0.85, 1.15, 'hull', (0.8, 0.8))
    m.block(-0.08, 0.08, 0.17, 0.22, 1.15, 1.18, 'glass')
    for z in (-0.9, -0.35, 0.2):
        for sd in (-1, 1):
            m.block(sd * 0.12 if sd > 0 else -0.42, 0.42 if sd > 0 else -0.12, -0.08, 0.08, z - 0.2, z + 0.2, 'hull', (1, 0.8))  # racks
            for k in range(3):
                x = sd * (0.18 + k * 0.09)
                m.block(x - 0.03, x + 0.03, 0.08, 0.12, z - 0.18, z + 0.24, 'metal', (0.4, 0.4))          # torpedoes
            xb(m, sd * 0.4, sd * 0.43, -0.06, 0.06, z - 0.2, z + 0.2, 'accent')
    m.block(-0.3, 0.3, -0.18, 0.16, -1.65, -1.4, 'metal')
    for x in (-0.15, 0.15): m.engine(x, 0, -1.65, 0.1, 0.1, 0.12)

def destroyer_i(m):  # stealth wedge: a flat faceted arrowhead with glowing slits
    m.block(-0.6, 0.6, -0.08, 0.04, -1.2, -0.1, 'metal', (0.4, 0.8))
    m.block(-0.24, 0.24, -0.08, 0.04, -0.1, 1.35, 'metal', (0.05, 0.6))
    m.block(-0.3, 0.3, 0.04, 0.16, -1.0, 0.3, 'metal', (0.2, 0.6), (0, -0.04))                           # raised spine
    m.block(-0.1, 0.1, 0.1, 0.17, -0.2, 0.15, 'glass', (0.5, 0.5))
    for sd in (-1, 1):
        for k in range(3): xb(m, sd * (0.15 + k * 0.12), sd * (0.2 + k * 0.12), 0.03, 0.05, -0.9 + k * 0.08, -0.55 + k * 0.08, 'glow')  # slits
        m.fin(sd * 0.5, 0.0, 0.2, -1.2, -0.9, 0.018, 'metal', 0.3)
        xb(m, sd * 0.55, sd * 0.6, -0.08, 0.04, -1.2, -0.95, 'accent')
    for x in (-0.3, -0.1, 0.1, 0.3): m.engine(x, -0.02, -1.2, 0.07, 0.04, 0.08)

def destroyer_j(m):  # twin spine: two long hulls, braced with cross beams and a gun deck between
    for sd in (-1, 1):
        x = sd * 0.3
        m.block(x - 0.1, x + 0.1, -0.1, 0.08, -1.3, 0.8)
        m.block(x - 0.1, x + 0.1, -0.1, 0.08, 0.8, 1.35, 'hull', (0.2, 0.5), (0, -0.02))
        m.block(x - 0.102, x + 0.102, 0.06, 0.09, -1.0, 0.7, 'accent', (1, 1))
        m.engine(x, -0.01, -1.3, 0.08, 0.08, 0.14)
    for z in (-0.9, -0.4, 0.1, 0.6): m.block(-0.2, 0.2, -0.04, 0.02, z - 0.05, z + 0.05, 'metal')        # braces
    m.block(-0.2, 0.2, -0.02, 0.06, -0.3, 0.3, 'hull')                                                     # gun deck
    m.turret(0, 0.06, 0.0, 0.1, 0.36)
    m.block(-0.12, 0.12, 0.06, 0.24, -0.75, -0.4, 'hull', (0.8, 1))
    m.block(-0.09, 0.09, 0.18, 0.23, -0.4, -0.37, 'glass')
    m.block(-0.012, 0.012, 0.24, 0.44, -0.65, -0.61, 'metal')

def destroyer_k(m):  # ram: a massive armoured beak with spikes, built to break hulls
    m.block(-0.26, 0.26, -0.14, 0.1, -1.3, 0.3)
    m.block(-0.36, 0.36, -0.2, 0.16, 0.3, 0.9, 'metal', (0.9, 0.8))                                        # ram housing
    m.block(-0.36, 0.36, -0.2, 0.16, 0.9, 1.45, 'metal', (0.05, 0.1), (0, -0.02))                          # the beak
    for sd in (-1, 1): xb(m, sd * 0.3, sd * 0.36, 0.16, 0.18, 0.35, 0.85, 'accent')                       # warning stripes
    for sd in (-1, 1):
        for z in (0.5, 0.75): m.spike(sd * 0.32, 0.0, z, 0.04, 0.3, 'metal', 0.0, sd * 0.12)
        m.turret(sd * 0.18, 0.1, -0.35, 0.07, 0.22)
        m.plate(sd, 0.25, -1.25, -0.8, 0.5, -1.35, -1.15, -0.02, 0.022)
    m.block(-0.14, 0.14, 0.1, 0.26, -0.9, -0.5, 'hull', (0.8, 1))
    m.block(-0.1, 0.1, 0.2, 0.25, -0.5, -0.47, 'glass')
    m.block(-0.3, 0.3, -0.16, 0.12, -1.5, -1.3, 'metal')
    for x in (-0.18, 0, 0.18): m.engine(x, -0.02, -1.5, 0.08, 0.08, 0.12)

def battleship_g(m):  # citadel: a stepped ziggurat of armour crowned with turrets
    m.block(-0.55, 0.55, -0.2, 0.06, -1.35, 0.9)
    m.block(-0.55, 0.55, -0.2, 0.06, 0.9, 1.4, 'hull', (0.5, 0.6), (0, -0.03))
    m.block(-0.42, 0.42, 0.06, 0.18, -1.15, 0.75, 'hull', (0.9, 1))                                       # step 1
    m.block(-0.3, 0.3, 0.18, 0.3, -0.95, 0.45, 'hull', (0.9, 1))                                          # step 2
    m.block(-0.18, 0.18, 0.3, 0.44, -0.75, 0.1, 'hull', (0.85, 1))                                         # step 3
    m.block(-0.14, 0.14, 0.38, 0.43, 0.1, 0.13, 'glass')
    for y, w, z0, z1 in ((0.16, 0.43, -1.1, 0.7), (0.28, 0.31, -0.9, 0.4)): m.block(-w, w, y, y + 0.025, z0, z1, 'accent', (1, 1))
    m.turret(0, 0.06, 1.05, 0.12, 0.4)
    m.turret(0, 0.18, 0.62, 0.11, 0.36)
    m.turret(0, 0.3, 0.3, 0.1, 0.32)
    for sd in (-1, 1):
        for z in (-0.9, -0.3, 0.3): m.turret(sd * 0.48, 0.06, z, 0.07, 0.22)
        m.block(sd * 0.1 - 0.03, sd * 0.1 + 0.03, 0.44, 0.75, -0.6, -0.5, 'metal', (0.4, 1))
    m.block(-0.5, 0.5, -0.24, 0.14, -1.6, -1.35, 'metal')
    for x in (-0.36, -0.12, 0.12, 0.36): m.engine(x, -0.05, -1.6, 0.09, 0.1, 0.12)

def battleship_h(m):  # spinal lance: the whole ship is built around one enormous gun
    m.block(-0.38, 0.38, -0.2, 0.12, -1.4, 0.3)
    m.block(-0.38, 0.38, -0.2, 0.12, 0.3, 0.75, 'hull', (0.6, 0.7))
    m.block(-0.12, 0.12, -0.1, 0.1, 0.3, 1.75, 'metal')                                                   # the lance
    for z in (0.75, 1.0, 1.25, 1.5): m.ring(z, 0.16, 0.04, 10, 'accent', 0.05)                            # focusing rings
    m.block(-0.06, 0.06, -0.06, 0.06, 1.74, 1.78, 'glow')
    m.block(-0.24, 0.24, 0.12, 0.3, -1.1, -0.2, 'hull', (0.85, 1))
    m.block(-0.14, 0.14, 0.3, 0.44, -0.95, -0.4, 'hull', (0.8, 1))
    m.block(-0.1, 0.1, 0.38, 0.43, -0.4, -0.37, 'glass')
    m.block(-0.02, 0.02, 0.44, 0.75, -0.8, -0.74, 'metal')
    for sd in (-1, 1):
        x = sd * 0.48
        m.block(x - 0.1, x + 0.1, -0.16, 0.06, -1.3, 0.2, 'hull', (0.6, 0.8))                              # side hulls
        m.block(x - 0.102, x + 0.102, 0.04, 0.07, -1.1, 0.0, 'accent')
        for z in (-0.8, -0.2): m.turret(x, 0.06, z, 0.07, 0.22)
    m.block(-0.44, 0.44, -0.24, 0.16, -1.65, -1.4, 'metal')
    for x in (-0.3, -0.1, 0.1, 0.3): m.engine(x, -0.04, -1.65, 0.08, 0.1, 0.12)

def battleship_i(m):  # monolith: a vast black slab split by glowing seams
    m.block(-0.45, 0.45, -0.25, 0.25, -1.4, 1.1, 'metal')
    m.block(-0.45, 0.45, -0.25, 0.25, 1.1, 1.45, 'metal', (0.6, 0.6))
    for z in (-1.0, -0.5, 0.0, 0.5, 1.0): m.block(-0.46, 0.46, -0.26, 0.26, z - 0.015, z + 0.015, 'glow')     # seams
    m.block(-0.005, 0.005, 0.25, 0.27, -1.35, 1.05, 'accent')
    m.block(-0.2, 0.2, 0.25, 0.38, -0.9, -0.3, 'hull', (0.8, 1))
    m.block(-0.14, 0.14, 0.32, 0.37, -0.3, -0.27, 'glass')
    for sd in (-1, 1):
        m.turret(sd * 0.25, 0.25, 0.3, 0.09, 0.3)
        m.turret(sd * 0.25, 0.25, 0.8, 0.08, 0.26)
        for y in (-0.15, 0.15): m.block(sd * 0.45 if sd > 0 else -0.55, 0.55 if sd > 0 else -0.45, y - 0.04, y + 0.04, -1.2, -0.6, 'hull')
    for x in (-0.25, 0.0, 0.25):
        for y in (-0.12, 0.12): m.engine(x, y, -1.4, 0.08, 0.08, 0.1)

def battleship_j(m):  # trident dreadnought: a long central hull flanked by two shorter ones
    m.block(-0.24, 0.24, -0.16, 0.12, -1.45, 0.9)
    m.block(-0.24, 0.24, -0.16, 0.12, 0.9, 1.55, 'hull', (0.2, 0.5), (0, -0.03))
    m.block(-0.15, 0.15, 0.12, 0.28, -0.9, 0.0, 'hull', (0.85, 1))
    m.block(-0.1, 0.1, 0.28, 0.42, -0.75, -0.2, 'hull', (0.8, 1))
    m.block(-0.08, 0.08, 0.36, 0.41, -0.2, -0.17, 'glass')
    m.turret(0, 0.12, 0.45, 0.11, 0.38)
    m.turret(0, 0.12, 0.95, 0.09, 0.3)
    for sd in (-1, 1):
        x = sd * 0.58
        m.block(x - 0.16, x + 0.16, -0.14, 0.08, -1.2, 0.45)
        m.block(x - 0.16, x + 0.16, -0.14, 0.08, 0.45, 0.95, 'hull', (0.25, 0.5), (0, -0.02))
        m.block(x - 0.162, x + 0.162, 0.06, 0.09, -0.9, 0.3, 'accent')
        m.turret(x, 0.08, 0.1, 0.08, 0.26)
        m.turret(x, 0.08, -0.5, 0.07, 0.22)
        m.engine(x, -0.03, -1.2, 0.09, 0.08, 0.12)
        for z in (-0.6, 0.2): m.block(min(sd * 0.24, sd * 0.42), max(sd * 0.24, sd * 0.42), -0.06, 0.02, z - 0.08, z + 0.08, 'metal')
    m.block(-0.28, 0.28, -0.2, 0.16, -1.7, -1.45, 'metal')
    for x in (-0.12, 0.12): m.engine(x, -0.02, -1.7, 0.1, 0.1, 0.12)

def battleship_k(m):  # ark: a rounded hull with a great habitat ring and twin spires
    m.egg(0.45, 0.25, -1.45, 1.4, 'hull', taper=0.35, mid=0.45)
    m.egg(0.3, 0.12, -1.2, 1.0, 'accent', y=0.2, taper=0.4)
    m.ring(-0.45, 0.62, 0.08, 22, 'hull', 0.12)                                                            # habitat ring
    m.ring(-0.45, 0.625, 0.082, 22, 'glass', 0.025)
    for a in (math.pi / 4, 3 * math.pi / 4, 5 * math.pi / 4, 7 * math.pi / 4):
        cx, cy = 0.5 * math.cos(a), 0.5 * math.sin(a)
        m.block(cx - 0.03, cx + 0.03, cy - 0.03, cy + 0.03, -0.5, -0.4, 'metal')
    for sd in (-1, 1): m.block(sd * 0.12 - 0.04, sd * 0.12 + 0.04, 0.25, 0.75, 0.0, 0.12, 'metal', (0.3, 1))  # spires
    m.block(-0.12, 0.12, 0.25, 0.36, 0.3, 0.6, 'glass', (0.6, 0.6))
    m.turret(0, 0.25, 0.85, 0.1, 0.34)
    for sd in (-1, 1): m.turret(sd * 0.3, 0.15, 0.4, 0.07, 0.24)
    for x in (-0.22, 0, 0.22): m.engine(x, 0, -1.45, 0.09, 0.09, 0.12)

def carrier_g(m):  # angled deck: a slab with a second deck angled off to the side and two islands
    m.block(-0.45, 0.45, -0.16, 0.06, -1.3, 1.1)
    m.block(-0.45, 0.45, -0.16, 0.06, 1.1, 1.3, 'hull', (0.8, 0.6))
    m.block(-0.38, 0.38, -0.28, -0.16, -1.2, 1.1, 'metal', (0.8, 1))
    m.block(-0.36, 0.36, -0.12, 0.02, 1.15, 1.29, 'void')
    m.block(-0.15, 0.25, -0.02, 0.07, -0.2, 0.9, 'hull', (1, 1), (-0.45, 0))                               # angled deck
    for z in (-1.0, -0.5, 0.0, 0.5): m.block(-0.03, 0.03, 0.06, 0.075, z, z + 0.25, 'accent')
    for x, z in ((0.33, -0.6), (0.33, 0.35)):
        m.block(x - 0.09, x + 0.09, 0.06, 0.32, z - 0.2, z + 0.2, 'hull', (0.85, 1))                         # islands
        m.block(x - 0.07, x + 0.07, 0.24, 0.3, z + 0.2, z + 0.22, 'glass')
        m.block(x - 0.012, x + 0.012, 0.32, 0.5, z - 0.05, z, 'metal')
    m.turret(-0.32, 0.06, -0.9, 0.07, 0.2)
    m.block(-0.44, 0.44, -0.2, 0.1, -1.5, -1.3, 'metal')
    for x in (-0.3, -0.1, 0.1, 0.3): m.engine(x, -0.05, -1.5, 0.08, 0.08, 0.1)

def carrier_h(m):  # hangar wheel: a spine through a closed wheel of hangar modules, four spokes
    m.block(-0.14, 0.14, -0.14, 0.14, -1.4, 1.1, 'metal')
    m.block(-0.26, 0.26, -0.18, 0.18, 0.9, 1.4, 'hull', (0.4, 0.5))
    m.block(-0.14, 0.14, 0.13, 0.2, 1.05, 1.3, 'glass', (0.7, 0.5))
    n = 12
    for k in range(n):                                                                                      # the wheel
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        x0, y0, x1, y1 = 0.72 * math.cos(a0), 0.55 * math.sin(a0), 0.72 * math.cos(a1), 0.55 * math.sin(a1)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        hw, hh = abs(x1 - x0) / 2 + 0.08, abs(y1 - y0) / 2 + 0.08
        m.block(cx - hw, cx + hw, cy - hh, cy + hh, -0.5, 0.05, 'hull', over={1: 'void'} if k % 3 == 0 else None)
        if k % 3 == 1: m.block(cx - hw - 0.005, cx + hw + 0.005, cy - 0.025, cy + 0.025, -0.45, 0.0, 'accent')
    for a in (0, math.pi / 2, math.pi, 3 * math.pi / 2):                                                    # spokes
        cx, cy = 0.42 * math.cos(a), 0.32 * math.sin(a)
        hw, hh = (0.28, 0.035) if abs(math.cos(a)) > 0.5 else (0.035, 0.2)
        m.block(cx - hw, cx + hw, cy - hh, cy + hh, -0.3, -0.15, 'metal')
    m.turret(0, 0.14, 0.6, 0.07, 0.22)
    m.block(-0.3, 0.3, -0.22, 0.22, -1.6, -1.4, 'metal')
    for x, y in ((-0.14, -0.1), (0.14, -0.1), (-0.14, 0.1), (0.14, 0.1)): m.engine(x, y, -1.6, 0.08, 0.08, 0.1)

def carrier_i(m):  # manta carrier: a vast wing with launch bays along its trailing edge
    m.block(-0.2, 0.2, -0.14, 0.14, -1.0, 1.0, 'hull', (0.4, 0.6))
    m.block(-0.12, 0.12, 0.1, 0.22, 0.4, 0.85, 'hull', (0.6, 0.6))
    m.block(-0.09, 0.09, 0.16, 0.22, 0.85, 0.9, 'glass')
    for sd in (-1, 1):
        m.plate(sd, 0.18, -0.95, 0.7, 1.1, -0.7, -0.25, 0.0, 0.07)                                          # the wing
        m.plate(sd, 0.5, -0.8, -0.3, 1.1, -0.72, -0.58, 0.071, 0.012, 'accent')
        for k in range(4):
            x = sd * (0.35 + k * 0.18)
            m.block(x - 0.06, x + 0.06, -0.06, 0.04, -0.98 + k * 0.08, -0.88 + k * 0.08, 'metal', over={0: 'void'})  # launch bays
        m.turret(sd * 0.45, 0.07, -0.3, 0.06, 0.2)
    for x in (-0.12, 0.12): m.engine(x, 0, -1.0, 0.09, 0.09, 0.12)

def carrier_j(m):  # tiered decks: three flight decks stacked like a ziggurat, the hangars open at the bow
    for k, (w, y0, z0, z1) in enumerate(((0.5, -0.2, -1.3, 1.1), (0.38, -0.04, -1.1, 0.9), (0.26, 0.12, -0.9, 0.7))):
        m.block(-w, w, y0, y0 + 0.16, z0, z1, 'hull')
        m.block(-w + 0.06, w - 0.06, y0 + 0.02, y0 + 0.12, z1 - 0.01, z1 + 0.012, 'void')                    # hangar mouths
        for sd in (-1, 1): xb(m, sd * (w - 0.05), sd * (w - 0.02), y0 + 0.16, y0 + 0.175, z0 + 0.15, z1 - 0.15, 'accent')  # deck edge lights
    m.block(-0.12, 0.12, 0.28, 0.46, -0.6, -0.2, 'hull', (0.8, 1))
    m.block(-0.09, 0.09, 0.38, 0.45, -0.2, -0.17, 'glass')
    m.block(-0.012, 0.012, 0.46, 0.7, -0.5, -0.46, 'metal')
    for sd in (-1, 1): m.turret(sd * 0.44, -0.04, -0.6, 0.06, 0.2)
    m.block(-0.48, 0.48, -0.22, 0.12, -1.5, -1.3, 'metal')
    for x in (-0.32, -0.11, 0.11, 0.32): m.engine(x, -0.05, -1.5, 0.08, 0.08, 0.1)

def carrier_k(m):  # hive: a swollen segmented body, its back studded with launch pits, a crown of spikes
    for z0, z1, rx, ry in ((-1.25, -0.45, 0.48, 0.3), (-0.55, 0.35, 0.62, 0.38), (0.25, 1.05, 0.5, 0.3)):  # segments
        m.egg(rx, ry, z0, z1, 'hull', taper=0.65, mid=0.5)
        m.egg(rx * 0.55, ry * 0.3, z0 + 0.1, z1 - 0.1, 'accent', y=ry * 0.72, taper=0.6)
    for x, z in ((-0.25, -0.35), (0.25, -0.35), (0.0, -0.05), (-0.25, 0.2), (0.25, 0.2), (0.0, 0.6), (-0.2, -0.9), (0.2, -0.9)):
        m.block(x - 0.07, x + 0.07, 0.3, 0.4, z - 0.07, z + 0.07, 'metal', over={3: 'void'})                 # launch pits
    for k in range(5):                                                                                      # crown of spikes
        a = math.pi * (0.15 + 0.7 * k / 4)
        m.spike(0.35 * math.cos(a), 0.2 * math.sin(a), 0.85, 0.04, 0.45, 'metal', 0.2 * math.sin(a), 0.3 * math.cos(a))
    m.block(-0.1, 0.1, 0.05, 0.14, 0.95, 1.08, 'glass', (0.7, 0.6))
    for sd in (-1, 1): m.turret(sd * 0.48, 0.1, -0.1, 0.06, 0.2)
    for x in (-0.2, 0.0, 0.2): m.engine(x, -0.05, -1.25, 0.09, 0.09, 0.12)

VARIANTS = {t: [globals()[f'{t}_{c}'] for c in 'bcdefghijk'] for t in
            ('scout', 'fighter', 'heavy', 'corvette', 'frigate', 'gunboat', 'destroyer', 'battleship', 'carrier')}

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
    images, counts = {}, {}
    for name, fn in MODELS.items():
        designs = [fn] + VARIANTS.get(name, [])
        counts[name] = len(designs)
        for v, f in enumerate(designs):
            key = name if v == 0 else f'{name}_{v + 1}'          # scout, scout_2 … scout_11
            img = render(f, TEMPLATE, VIEW)
            img.save(os.path.join(outdir, f'{key}.png'), optimize=True)
            buf = io.BytesIO(); img.save(buf, 'PNG', optimize=True)
            images[key] = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
            print(f'{key:13s} {img.size[0]}x{img.size[1]}')
    js = ('// Voyager — ship sprite templates. GENERATED by tools/shipart/render.py: do not edit by hand.\n'
          '// Each sprite is grey: a pixel\'s grey level names a material and a shade, listed in `greys`.\n'
          '// js/sprites.js paints them with a palette from DATA.shipPalettes.\n'
          'const ShipSprites = {\n'
          f'  ramps: {json.dumps(RAMP_SIZES)},\n'
          f'  greys: {json.dumps({str(k): v for k, v in sorted(GREY_TABLE.items())})},\n'
          f'  variants: {json.dumps(counts)},\n'
          '  images: {\n' + ''.join(f'    {k}: {json.dumps(v)},\n' for k, v in images.items()) + '  },\n};\n')
    with open(os.path.join(root, 'js', 'shipsprites.js'), 'w') as f: f.write(js)
    print('wrote js/shipsprites.js', len(js) // 1024, 'KB')

if __name__ == '__main__':
    main()
