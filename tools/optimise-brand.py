#!/usr/bin/env python3
"""
Builds web-optimised copies of Justin's brand images. Originals are NEVER modified.
  source: /workspace/brand-inbox/*.jpg  (or pass --src DIR; copies are also kept in assets/brand/source/)
  output: assets/brand/img/<name>-<width>.{avif,webp,jpg}, assets/brand/ahmp-mark.{png,webp}, assets/brand/og-image.jpg
Re-run after replacing a source image:   python3 tools/optimise-brand.py
Needs Pillow (with AVIF support, Pillow >= 11.3) and fonttools for the OG text.
"""
import argparse, os, shutil, sys
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "brand", "img")
SRC_COPY = os.path.join(ROOT, "assets", "brand", "source")

# name: (source file, crop box or None, widths)
IMAGES = {
    # Studio photo. Crop removes the small sparkle watermark in the bottom-right corner.
    "justin-erasmus-studio": ("2207.jpg", (0, 0, 944, 604), [480, 944]),
    "ahmp-poster-blue": ("3547.jpg", None, [480, 960]),     # primary AHMP brand visual
    "ahmp-poster-gold": ("3538.jpg", None, [480, 960]),     # secondary (framework section)
    "ahmp-poster-studio": ("3549.jpg", None, [480, 960]),   # gallery / connect
}
MARK = ("3547.jpg", (436, 1512, 726, 1645))  # AHMP monogram + equaliser bars from the poster footer


def save_all(img, base):
    img.save(base + ".avif", "AVIF", quality=55, speed=4)
    img.save(base + ".webp", "WEBP", quality=78, method=6)
    img.save(base + ".jpg", "JPEG", quality=80, optimize=True, progressive=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="/workspace/brand-inbox")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True); os.makedirs(SRC_COPY, exist_ok=True)
    src = lambda f: os.path.join(a.src, f) if os.path.exists(os.path.join(a.src, f)) else os.path.join(SRC_COPY, f)

    for name, (f, crop, widths) in IMAGES.items():
        p = src(f)
        if not os.path.exists(p):
            print("missing", p, file=sys.stderr); continue
        if not os.path.exists(os.path.join(SRC_COPY, f)):
            shutil.copy2(p, os.path.join(SRC_COPY, f))  # untouched original, kept with the project
        im = Image.open(p).convert("RGB")
        if crop: im = im.crop(crop)
        for w in widths:
            r = im if w >= im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            save_all(r, os.path.join(OUT, f"{name}-{w}"))
        print(f"✓ {name}: {im.size} -> {widths}")

    # AHMP mark with transparent background (luminance key; designed for dark backgrounds)
    f, box = MARK
    c = Image.open(src(f)).convert("RGB").crop(box)
    arr = np.asarray(c).astype(float)
    alpha = np.clip((arr.max(axis=2) - 95) / (190 - 95), 0, 1)
    al = Image.fromarray((alpha * 255).astype("uint8")).filter(ImageFilter.MedianFilter(3))
    c.putalpha(al)
    c = c.crop(c.getbbox())
    c.save(os.path.join(ROOT, "assets", "brand", "ahmp-mark.png"), optimize=True)
    c.save(os.path.join(ROOT, "assets", "brand", "ahmp-mark.webp"), "WEBP", quality=90, method=6)
    print("✓ ahmp-mark", c.size)

    # Open Graph / social card 1200x630 from the studio photo + typographic Prismatic Wave wordmark
    photo = Image.open(src("2207.jpg")).convert("RGB").crop((0, 40, 944, 536))  # 944x496 ≈ 1.9:1
    og = photo.resize((1200, 630), Image.LANCZOS)
    grad = Image.new("L", (1200, 1))
    for x in range(1200):
        grad.putpixel((x, 0), int(248 * max(0, 1 - x / 860) ** 0.9))
    grad = grad.resize((1200, 630))
    og = Image.composite(Image.new("RGB", og.size, (7, 8, 15)), og, grad)
    try:
        import cairosvg, io
        from fontTools.ttLib import TTFont
        from fontTools.pens.svgPathPen import SVGPathPen
        from fontTools.pens.transformPen import TransformPen
        from fontTools.varLib.instancer import instantiateVariableFont
        fonts = os.path.join(ROOT, "assets", "fonts")
        unb = instantiateVariableFont(TTFont(os.path.join(fonts, "unbounded-latin-wght-normal.woff2")), {"wght": 800})
        sg = TTFont(os.path.join(fonts, "space-grotesk-latin-500-normal.woff2"))
        def tp(font, text, size, tracking=0):
            gs = font.getGlyphSet(); cmap = font.getBestCmap(); s = size / font["head"].unitsPerEm
            pen = SVGPathPen(gs); cx = 0
            for ch in text:
                g = cmap.get(ord(ch))
                if g is None: continue
                gs[g].draw(TransformPen(pen, (s, 0, 0, -s, cx, 0))); cx += gs[g].width * s + tracking
            return pen.getCommands()
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs>
<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#00E5FF"/><stop offset=".5" stop-color="#3D8BFF"/><stop offset="1" stop-color="#B05CFF"/></linearGradient></defs>
<g transform="translate(64 300)"><path d="{tp(unb, "PRISMATIC", 76, 2)}" fill="#fff"/></g>
<g transform="translate(64 385)"><path d="{tp(unb, "WAVE", 76, 2)}" fill="url(#g)"/></g>
<g transform="translate(68 440)"><path d="{tp(sg, "HYBRID MUSIC PRODUCER", 26, 6)}" fill="#C9D6F2"/></g>
<g transform="translate(68 486)"><path d="{tp(sg, "Human creativity \u00d7 AI \u00d7 Music \u00d7 Technology", 22, 1)}" fill="#9FB0D3"/></g>
<rect x="68" y="512" width="160" height="3" rx="1.5" fill="url(#g)"/></svg>'''
        txt = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert("RGBA")
        og.paste(txt, (0, 0), txt)
    except Exception as e:  # text overlay is optional
        print("OG text skipped:", e, file=sys.stderr)
    og.save(os.path.join(ROOT, "assets", "brand", "og-image.jpg"), "JPEG", quality=84, optimize=True, progressive=True)
    print("✓ og-image.jpg 1200x630")


if __name__ == "__main__":
    main()
