#!/usr/bin/env python3
"""
Generates the PLACEHOLDER brand kit in assets/brand + PWA icons in assets/icons.
Re-run after editing colours/text:   python3 tools/make-brand.py
Needs: pip install fonttools cairosvg   (only for regenerating; the site itself needs nothing)

When the real branding arrives you do NOT need this script: just overwrite the files
(see README "Swap branding images"). To regenerate icons from a real square logo, set
SOURCE_MARK below to its path (SVG) and re-run.
"""
import os, cairosvg
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, "assets", "brand")
ICONS = os.path.join(ROOT, "assets", "icons")
FONTS = os.path.join(ROOT, "assets", "fonts")
SOURCE_MARK = None  # e.g. os.path.join(BRAND, "logo-mark.svg") once a real mark exists

CYAN, VIOLET, MAGENTA, INK = "#00E5FF", "#8B5CFF", "#FF3DCB", "#07080F"
os.makedirs(BRAND, exist_ok=True); os.makedirs(ICONS, exist_ok=True)

def load(name, wght=None):
    f = TTFont(os.path.join(FONTS, name))
    if wght and "fvar" in f:
        f = instantiateVariableFont(f, {"wght": wght})
    return f

UNB = load("unbounded-latin-wght-normal.woff2", 700)
UNB4 = load("unbounded-latin-wght-normal.woff2", 400)
SG = load("space-grotesk-latin-500-normal.woff2")

def text_path(font, text, size, x=0, y=0, tracking=0):
    """Return (svg path d, advance width) for text set in `font` at `size` px, baseline at y."""
    gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font["head"].unitsPerEm
    s = size / upm; pen = SVGPathPen(gs); cx = 0
    for ch in text:
        g = cmap.get(ord(ch))
        if g is None: continue
        tp = TransformPen(pen, (s, 0, 0, -s, x + cx, y))
        gs[g].draw(tp)
        cx += gs[g].width * s + tracking
    return pen.getCommands(), cx - tracking

GRAD = f'''<linearGradient id="pw-g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="{CYAN}"/><stop offset=".5" stop-color="{VIOLET}"/><stop offset="1" stop-color="{MAGENTA}"/></linearGradient>'''

def mark_group(scale=1, tx=0, ty=0):
    return f'''<g transform="translate({tx} {ty}) scale({scale})" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="M32 8 L56 52 H8 Z" stroke="url(#pw-g)" stroke-width="3.2"/>
  <path d="M3 39 C9 31 14 45 20 37 S28 33 31 35" stroke="#FFFFFF" stroke-width="2.6"/>
  <path d="M31 35 C41 30 49 24 61 21" stroke="{CYAN}" stroke-width="2.6"/>
  <path d="M31 35 C41 34 50 33 61 33" stroke="{VIOLET}" stroke-width="2.6"/>
  <path d="M31 35 C41 40 49 44 61 46" stroke="{MAGENTA}" stroke-width="2.6"/>
</g>'''

def write(name, svg):
    with open(os.path.join(BRAND, name), "w") as f: f.write(svg)

# 1) Square mark (favicon / icon source)
write("logo-mark.svg", f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Prismatic Wave mark (placeholder)">
<!-- PLACEHOLDER mark. Replace with the real logo mark (square SVG). -->
<defs>{GRAD}</defs>{mark_group()}</svg>''')

# 2) Horizontal logo: mark + wordmark (text converted to paths so it renders identically everywhere)
d1, w1 = text_path(UNB, "PRISMATIC", 30, 78, 44, 1.5)
d2, w2 = text_path(UNB4, "WAVE", 30, 78 + w1 + 14, 44, 1.5)
W = int(78 + w1 + 14 + w2 + 4)
write("logo-prismatic-wave.svg", f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} 64" role="img" aria-label="Prismatic Wave">
<!-- PLACEHOLDER logo (geometric mark + wordmark). Replace with the official Prismatic Wave logo; keep a transparent background. -->
<defs>{GRAD}</defs>{mark_group()}
<path d="{d1}" fill="#FFFFFF"/><path d="{d2}" fill="url(#pw-g)"/></svg>''')

# 3) AHMP placeholder logo
a, aw = text_path(UNB, "AHMP", 40, 0, 44, 3)
b, bw = text_path(SG, "ALGORYTHM HYBRID MUSIC PRODUCTION", 11.5, 0, 66, 1.6)
W2 = int(max(aw, bw) + 2)
write("logo-ahmp.svg", f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W2} 72" role="img" aria-label="AlgoRythm Hybrid Music Production (AHMP)">
<!-- PLACEHOLDER AHMP logo (typographic). Replace with the official AlgoRythm Hybrid Music Production logo. -->
<defs>{GRAD}</defs><path d="{a}" fill="url(#pw-g)"/><path d="{b}" fill="#C9D1E4"/></svg>''')

# 4) Circuit / grid hero background (very low contrast; tiles nicely)
traces = []
import random
random.seed(7)
for i in range(26):
    x, y = random.randrange(0, 1600, 40), random.randrange(0, 900, 40)
    pts = [(x, y)]
    for _ in range(random.randint(2, 4)):
        dx, dy = random.choice([(1, 0), (0, 1), (1, 1), (1, -1), (-1, 1)])
        L = random.randrange(40, 200, 40)
        x, y = x + dx * L, y + dy * L
        pts.append((x, y))
    col = random.choice([CYAN, VIOLET, MAGENTA])
    d = "M" + " L".join(f"{px} {py}" for px, py in pts)
    traces.append(f'<path d="{d}" stroke="{col}" stroke-opacity=".22" stroke-width="1.5" fill="none"/>'
                  f'<circle cx="{pts[-1][0]}" cy="{pts[-1][1]}" r="3.5" fill="none" stroke="{col}" stroke-opacity=".45"/>'
                  f'<circle cx="{pts[0][0]}" cy="{pts[0][1]}" r="2" fill="{col}" fill-opacity=".5"/>')
write("hero-bg.svg", f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<!-- PLACEHOLDER hero background: abstract circuit traces. Replace with hero-bg.svg / .jpg / .webp of the same name or update site.json brand.heroBackground. -->
<defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#FFFFFF" stroke-opacity=".035"/></pattern>
<radialGradient id="glow" cx=".7" cy=".3" r=".8"><stop offset="0" stop-color="{VIOLET}" stop-opacity=".22"/><stop offset="1" stop-color="{INK}" stop-opacity="0"/></radialGradient></defs>
<rect width="1600" height="900" fill="{INK}"/><rect width="1600" height="900" fill="url(#glow)"/><rect width="1600" height="900" fill="url(#grid)"/>
{''.join(traces)}</svg>''')

# 5) Default artwork (used when a release/track has no artwork)
t1, tw1 = text_path(UNB, "PRISMATIC WAVE", 34, 0, 0, 2)
t2, tw2 = text_path(SG, "ARTWORK COMING SOON", 22, 0, 0, 4)
write("default-artwork.svg", f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="Artwork coming soon">
<!-- PLACEHOLDER default artwork, shown when a release has no artwork yet. -->
<defs>{GRAD}<radialGradient id="r" cx=".3" cy=".25" r="1"><stop offset="0" stop-color="#1B1640"/><stop offset="1" stop-color="{INK}"/></radialGradient>
<pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#FFFFFF" stroke-opacity=".05"/></pattern></defs>
<rect width="600" height="600" fill="url(#r)"/><rect width="600" height="600" fill="url(#grid)"/>
{mark_group(4.2, 165, 120)}
<g transform="translate({(600 - tw1) / 2:.1f} 470)"><path d="{t1}" fill="#FFFFFF"/></g>
<g transform="translate({(600 - tw2) / 2:.1f} 515)"><path d="{t2}" fill="#9AA4BF"/></g></svg>''')

# 6) PWA icons
def icon_svg(pad, rounded):
    s = (64 - 2 * pad) / 64
    r = 14 if rounded else 0
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>{GRAD}
<radialGradient id="bg" cx=".3" cy=".2" r="1"><stop offset="0" stop-color="#1A1440"/><stop offset="1" stop-color="{INK}"/></radialGradient></defs>
<rect width="64" height="64" rx="{r}" fill="url(#bg)"/>{mark_group(s, pad, pad + 1)}</svg>'''
src_any = icon_svg(8, True); src_mask = icon_svg(14, False)
for size in (192, 512):
    cairosvg.svg2png(bytestring=src_any.encode(), write_to=os.path.join(ICONS, f"icon-{size}.png"), output_width=size, output_height=size)
    cairosvg.svg2png(bytestring=src_mask.encode(), write_to=os.path.join(ICONS, f"maskable-{size}.png"), output_width=size, output_height=size)
cairosvg.svg2png(bytestring=src_mask.encode(), write_to=os.path.join(ICONS, "apple-touch-icon.png"), output_width=180, output_height=180)
with open(os.path.join(ICONS, "favicon.svg"), "w") as f: f.write(src_any)

# 7) Fallback Open Graph image 1200x630 (the real one, og-image.jpg, is built from Justin's photo by tools/optimise-brand.py)
h1, hw = text_path(UNB, "PRISMATIC WAVE", 84, 0, 0, 3)
h2, hw2 = text_path(SG, "HYBRID MUSIC PRODUCER", 30, 0, 0, 7)
h3, hw3 = text_path(SG, "Human creativity \u00d7 AI \u00d7 Music \u00d7 Technology", 28, 0, 0, 1)
bg = open(os.path.join(BRAND, "hero-bg.svg")).read().split("\n", 2)[2].rsplit("</svg>", 1)[0]
og = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><defs>{GRAD}</defs>
<svg viewBox="0 0 1600 900" width="1200" height="630" preserveAspectRatio="xMidYMid slice">{bg}</svg>
{mark_group(2.2, 80, 150)}
<g transform="translate(80 400)"><path d="{h1}" fill="#FFFFFF"/></g>
<g transform="translate(84 460)"><path d="{h2}" fill="url(#pw-g)"/></g>
<g transform="translate(84 515)"><path d="{h3}" fill="#C9D1E4"/></g></svg>'''
cairosvg.svg2png(bytestring=og.encode(), write_to=os.path.join(BRAND, "og-image-placeholder.png"), output_width=1200, output_height=630)
print("brand kit + icons written")
