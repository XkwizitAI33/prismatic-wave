#!/usr/bin/env python3
"""Make small artwork thumbnails used by cards and track rows (saves ~75% bandwidth on mobile).

  python3 tools/make-thumbs.py          # creates assets/artwork/thumbs/<name>-300.webp for every assets/artwork/*.webp|jpg|png

Missing thumbnails are harmless: the site falls back to the full-size artwork automatically.
"""
import glob, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "assets", "artwork")
OUT = os.path.join(ART, "thumbs")
os.makedirs(OUT, exist_ok=True)
for f in sorted(glob.glob(os.path.join(ART, "*.*"))):
    name, ext = os.path.splitext(os.path.basename(f))
    if ext.lower() not in (".webp", ".jpg", ".jpeg", ".png"):
        continue
    im = Image.open(f).convert("RGB")
    im.thumbnail((300, 300), Image.LANCZOS)
    dst = os.path.join(OUT, f"{name}-300.webp")
    im.save(dst, "WEBP", quality=78, method=6)
    print(os.path.relpath(dst, ROOT), os.path.getsize(dst) // 1024, "KB")
