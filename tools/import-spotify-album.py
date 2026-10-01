#!/usr/bin/env python3
"""
Import one or more PUBLIC Spotify releases into data/releases.json.

Only uses public, unauthenticated pages:
  * https://open.spotify.com/embed/album/<id>   (title, cover art, tracklist, durations)
  * https://open.spotify.com/album/<id>         (release date + type from SEO <meta> tags)
Optionally (--apple) enriches each release with its Apple Music link + primary genre from
the public iTunes Search/Lookup API, but ONLY when the Apple release's copyright line
contains one of OWNER_MARKERS (protects against same-name artists).

Usage (from the project root):
  python3 tools/import-spotify-album.py https://open.spotify.com/album/<id> [more ...] --write --apple
  python3 tools/import-spotify-album.py <id>            # dry run: prints the JSON entry

Spotify markup can change at any time. If this script breaks, add the release by hand
(see README "Add a release"). Nothing here needs an API key.
"""
import argparse, html, json, os, re, sys, unicodedata, urllib.request, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASES = os.path.join(ROOT, "data", "releases.json")
ARTWORK_DIR = os.path.join(ROOT, "assets", "artwork")
ARTIST_ID = "4q1wMDlETpNlIob1xnVQNA"           # Prismatic Wave (confirmed by Justin)
APPLE_ARTIST_ID = "1795750961"                  # Apple artist page also contains a same-name artist: filter by ℗ line
OWNER_MARKERS = ("Justin Erasmus", "AlgoRythm")
UA = "Mozilla/5.0"  # a minimal UA gets the server-rendered page with SEO meta tags


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "release"


def norm(s):
    s = re.sub(r"\s*-\s*(single|ep)$", "", s.strip(), flags=re.I)
    return re.sub(r"[^a-z0-9]", "", s.lower())


def fmt_ms(ms):
    s = round(ms / 1000)
    return f"{s // 60}:{s % 60:02d}"


def album_id(arg):
    m = re.search(r"([A-Za-z0-9]{22})", arg)
    if not m:
        sys.exit(f"Not a Spotify album URL/ID: {arg}")
    return m.group(1)


def fetch_release(aid):
    embed = get(f"https://open.spotify.com/embed/album/{aid}")
    m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', embed, re.S)
    if not m:
        raise RuntimeError("Spotify embed markup changed (no __NEXT_DATA__)")
    ent = json.loads(m.group(1))["props"]["pageProps"]["state"]["data"]["entity"]
    page = get(f"https://open.spotify.com/album/{aid}")
    meta = {}
    for k, v in re.findall(r'<meta (?:property|name)="([^"]+)" content="([^"]*)"', page):
        meta.setdefault(k, html.unescape(v))
    musicians = re.findall(r'music:musician" content="https://open.spotify.com/artist/([A-Za-z0-9]+)"', page)
    if ARTIST_ID not in musicians:
        raise RuntimeError(f"{aid}: release is not credited to artist {ARTIST_ID} (found {musicians})")
    desc = meta.get("og:description", "")          # e.g. "Prismatic Wave · album · 2025 · 12 songs"
    parts = [p.strip().lower() for p in desc.split("·")]
    rtype = next((p for p in parts if p in ("album", "ep", "single", "compilation")), "album")
    rtype = {"ep": "EP"}.get(rtype, rtype)
    images = sorted(ent.get("visualIdentity", {}).get("image", []), key=lambda i: -i.get("maxWidth", 0))
    title = ent.get("name") or ent.get("title")
    return {
        "id": slugify(title),
        "title": title,
        "type": rtype,
        "date": meta.get("music:release_date", ""),
        "artwork": "",
        "_artworkRemote": images[0]["url"] if images else "",
        "genres": [],
        "description": "",
        "spotifyUri": f"spotify:album:{aid}",
        "links": {"spotify": f"https://open.spotify.com/album/{aid}"},
        "tracks": [
            {
                "title": t["title"],
                "duration": fmt_ms(t.get("duration", 0)),
                "spotifyTrackId": t["uri"].split(":")[-1],
                "explicit": bool(t.get("isExplicit")),
                "sunoId": "",
                "audioUrl": "",
            }
            for t in ent.get("trackList", [])
        ],
        "source": {"importedFrom": "Spotify public embed/album page", "importedAt": datetime.date.today().isoformat()},
    }


def apple_catalogue():
    data = json.loads(get(f"https://itunes.apple.com/lookup?id={APPLE_ARTIST_ID}&entity=album&limit=200"))
    out = {}
    for r in data.get("results", [])[1:]:
        if any(mk.lower() in (r.get("copyright") or "").lower() for mk in OWNER_MARKERS):
            out.setdefault(norm(r["collectionName"]), r)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("albums", nargs="+")
    ap.add_argument("--write", action="store_true", help="merge into data/releases.json and download artwork")
    ap.add_argument("--apple", action="store_true", help="add Apple Music link + genre when ownership is provable")
    a = ap.parse_args()
    apple = apple_catalogue() if a.apple else {}
    entries = []
    for arg in a.albums:
        rel = fetch_release(album_id(arg))
        hit = apple.get(norm(rel["title"]))
        if hit:
            rel["links"]["appleMusic"] = hit["collectionViewUrl"].split("?")[0]
            if hit.get("primaryGenreName"):
                rel["genres"] = [hit["primaryGenreName"]]
            rel["source"]["genreFrom"] = "Apple Music primaryGenreName (" + hit.get("copyright", "") + ")"
        entries.append(rel)
        print(f"✓ {rel['date']}  {rel['type']:<7} {rel['title']}  ({len(rel['tracks'])} tracks)", file=sys.stderr)

    if not a.write:
        print(json.dumps(entries, indent=2, ensure_ascii=False))
        return
    os.makedirs(ARTWORK_DIR, exist_ok=True)
    with open(RELEASES, encoding="utf-8") as f:
        doc = json.load(f)
    existing = {r.get("spotifyUri"): i for i, r in enumerate(doc["releases"])}
    for rel in entries:
        remote = rel.pop("_artworkRemote")
        if remote:
            raw = get(remote, binary=True)
            try:                                   # optimise to a 600px WebP when Pillow is installed
                from PIL import Image
                import io
                path = f"assets/artwork/{rel['id']}.webp"
                img = Image.open(io.BytesIO(raw)).convert("RGB")
                img.thumbnail((600, 600))
                img.save(os.path.join(ROOT, path), "WEBP", quality=80, method=6)
                os.makedirs(os.path.join(ROOT, "assets/artwork/thumbs"), exist_ok=True)   # 300px card/track-row thumbnail
                img.thumbnail((300, 300))
                img.save(os.path.join(ROOT, f"assets/artwork/thumbs/{rel['id']}-300.webp"), "WEBP", quality=78, method=6)
            except ImportError:
                path = f"assets/artwork/{rel['id']}.jpg"
                with open(os.path.join(ROOT, path), "wb") as f:
                    f.write(raw)
            rel["artwork"] = path
        if rel["spotifyUri"] in existing:      # keep hand-written fields (description, featured, suno links ...)
            old = doc["releases"][existing[rel["spotifyUri"]]]
            for keep in ("description", "featured", "genres"):
                if old.get(keep):
                    rel[keep] = old[keep]
            doc["releases"][existing[rel["spotifyUri"]]] = {**old, **rel}
        else:
            doc["releases"].append(rel)
    doc["releases"].sort(key=lambda r: r.get("date") or "", reverse=True)
    with open(RELEASES, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {len(entries)} release(s) to data/releases.json", file=sys.stderr)


if __name__ == "__main__":
    main()
