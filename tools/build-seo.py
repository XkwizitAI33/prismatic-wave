#!/usr/bin/env python3
"""
Regenerates SEO files from the data (run after editing data/*.json; optional but recommended):
  * the static JSON-LD block in index.html (between JSONLD:START / JSONLD:END) -> MusicGroup + albums
  * the pre-rendered home hero in index.html (between SHELL:START / SHELL:END), from data/site.json artist
  * sitemap.xml, robots.txt and the <base href> in 404.html (sub-path aware, e.g. GitHub Pages project sites)
  * canonical / og:url / og:image / twitter:image / robots Sitemap line when data/site.json siteUrl is set
The site also builds JSON-LD at runtime (js/seo.js); this static copy is for crawlers that don't run JS.
Usage:  python3 tools/build-seo.py
"""
import json, os, re, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load = lambda n: json.load(open(os.path.join(ROOT, "data", n), encoding="utf-8"))
site, rel, suno = load("site.json"), load("releases.json"), load("suno.json")
is_set = lambda v: isinstance(v, str) and v.strip() and not re.match(r"^(TODO|PLACEHOLDER)", v.strip(), re.I)

base = site.get("siteUrl") if is_set(site.get("siteUrl")) else "https://prismaticwave.example/"
base = base.split("#")[0].rstrip("/") + "/"
absu = lambda p: p if not p or p.startswith("http") else base + p.lstrip("/")
TYPES = {"album": "AlbumRelease", "ep": "EPRelease", "single": "SingleRelease"}

same_as = [v for k, v in {**site.get("platforms", {}), **site.get("socials", {})}.items() if is_set(v) and v.startswith("https://")]
ld = {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    "name": site["artist"]["name"],
    "description": site.get("seo", {}).get("description"),
    "url": base,
    "image": absu(site.get("brand", {}).get("ogImage", "")),
    "logo": absu(site.get("brand", {}).get("logo", "")),
    "foundingLocation": {"@type": "Place", "name": site["artist"].get("country")},
    "member": [{"@type": "Person", "name": site["artist"].get("realName"), "jobTitle": "Hybrid Music Producer", "url": "https://xkwizitai33.github.io/justin-erasmus-site/", "sameAs": ["https://xkwizitai33.github.io/justin-erasmus-site/"]}],
    "sameAs": same_as,
    "album": [
        {
            "@type": "MusicAlbum",
            "name": r["title"],
            "datePublished": r.get("date") or None,
            "albumReleaseType": "https://schema.org/" + TYPES.get(r.get("type", "").lower(), "AlbumRelease"),
            "numTracks": len(r.get("tracks", [])) or None,
            "image": absu(r.get("artwork", "")),
            "url": f"{base}#/discography/{r['id']}",
            "genre": r.get("genres") or None,
            "sameAs": [v for v in r.get("links", {}).values() if is_set(v) and v.startswith("https://")] or None,
        }
        for r in sorted(rel.get("releases", []), key=lambda r: r.get("date") or "", reverse=True)
    ],
}
def clean(o):
    if isinstance(o, dict): return {k: clean(v) for k, v in o.items() if v not in (None, "", [], {})}
    if isinstance(o, list): return [clean(v) for v in o]
    return o
ld = clean(ld)

idx = os.path.join(ROOT, "index.html")
html = open(idx, encoding="utf-8").read()
block = '<script type="application/ld+json" id="ld-static">' + json.dumps(ld, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>"
html = re.sub(r"(<!-- JSONLD:START.*?-->\s*).*?(\s*<!-- JSONLD:END -->)", lambda m: m.group(1) + block + m.group(2), html, flags=re.S)
# Pre-rendered home hero (same classes/size as js/views/home.js, so the app's render doesn't shift the layout)
from html import escape as E
a = site["artist"]
spotify = site.get("platforms", {}).get("spotify", "")
line = '<b aria-hidden="true">×</b><span class="sr-only">,</span>'.join(f"<span>{E(x.strip())}</span>" for x in a.get("supportingLine", "").split("×") if x.strip())
name = E(a.get("name", "Prismatic Wave").upper())
hero = site.get("brand", {}).get("heroImage") or {}
visual = ""
if isinstance(hero, dict) and hero.get("base") and hero.get("widths"):
    b, ws = hero["base"], hero["widths"]
    srcset = lambda ext: ", ".join(f"{b}-{w}.{ext} {w}w" for w in ws)
    sz = "(min-width: 900px) 40vw, 100vw"   # keep in sync with js/views/home.js
    visual = f'''
      <div class="hero__visual" aria-hidden="true"><picture class="pic hero__img-pic">
        <source type="image/avif" srcset="{srcset('avif')}" sizes="{sz}">
        <source type="image/webp" srcset="{srcset('webp')}" sizes="{sz}">
        <img class="hero__img" src="{b}-{ws[-1]}.jpg" srcset="{srcset('jpg')}" sizes="{sz}" alt="" width="{hero.get('width', 960)}" height="{hero.get('height', 1440)}" fetchpriority="high" decoding="async">
      </picture></div>'''
shell = f'''<section class="hero hero--shell" aria-labelledby="hero-title">
      <div class="hero__inner">
        <p class="kicker hero__kicker"><span class="pulse" aria-hidden="true"></span>{E(a.get("company", {}).get("name", ""))} presents</p>
        <h1 id="hero-title" class="hero__title" data-text="{name}">{name}</h1>
        <p class="hero__subtitle">{E(a.get("tagline", ""))}</p>
        <p class="hero__line">{line}</p>
        <div class="hero__ctas">
          {f'<a class="btn btn--prism btn--lg" href="{E(spotify)}" target="_blank" rel="noopener noreferrer">Listen now</a>' if is_set(spotify) else ''}
          <a class="btn btn--glass btn--lg" href="#/music">Explore the music</a>
        </div>
      </div>
    </section>'''
html = re.sub(r"(<!-- SHELL:START.*?-->\s*).*?(\s*<!-- SHELL:END -->)", lambda m: m.group(1) + shell + m.group(2), html, flags=re.S)
if is_set(site.get("siteUrl")):
    m_old = re.search(r'<link rel="canonical" href="([^"]+)"', html)     # previous base (placeholder or an older siteUrl)
    html = html.replace(m_old.group(1) if m_old else "https://prismaticwave.example/", base)
open(idx, "w", encoding="utf-8").write(html)

today = datetime.date.today().isoformat()
sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by tools/build-seo.py. Views use hash routes (#/music etc.), which search engines treat as the same URL,
     so only the root is listed. {'TODO: set data/site.json siteUrl and re-run.' if base.endswith('.example/') else ''} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>{base}</loc><lastmod>{today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>
"""
open(os.path.join(ROOT, "sitemap.xml"), "w").write(sitemap)
from urllib.parse import urlparse
base_path = urlparse(base).path or "/"          # e.g. "/prismatic-wave/" on a GitHub Pages project site
# 404.html: <base href> = site root, so its CSS/JS load at any depth (GitHub Pages serves it for every unknown path)
p404 = os.path.join(ROOT, "404.html")
h404 = open(p404, encoding="utf-8").read()
h404 = re.sub(r"(<!-- BASE:START.*?-->\s*).*?(\s*<!-- BASE:END -->)", lambda m: m.group(1) + f'<base href="{base_path}">' + m.group(2), h404, flags=re.S)
open(p404, "w", encoding="utf-8").write(h404)
if is_set(site.get("siteUrl")):
    note = ("# Note: crawlers only read robots.txt at the domain root. On a GitHub Pages *project* site\n"
            "# (user.github.io/repo/) this file is informational; submit the sitemap in Search Console instead.\n") if base_path != "/" else ""
    open(os.path.join(ROOT, "robots.txt"), "w").write(
        f"# Generated by tools/build-seo.py\n{note}User-agent: *\nAllow: {base_path}\nDisallow: {base_path}tools/\n\nSitemap: {base}sitemap.xml\n")
print(f"JSON-LD: MusicGroup + {len(ld.get('album', []))} albums; sitemap base {base}")
