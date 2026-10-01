# Prismatic Wave — official site / PWA

Mobile-first static site for **Prismatic Wave**, the hybrid music project of **Justin Erasmus**, produced through
**AlgoRythm Hybrid Music Production (AHMP)**. Plain HTML + CSS + ES modules: **no build step, no framework**.
Upload the folder to any static host and it works.

```
python3 -m http.server 8080        # then open http://localhost:8080
```

## Folder map

| Path | What it is |
|---|---|
| `index.html` | App shell: header, `<main>` view outlet, **persistent player**, mobile bottom nav, CSP, OG/Twitter meta, static JSON-LD |
| `data/site.json` | Artist name/tagline, headline stats, platform + social links, contact, brand images, player settings |
| `data/releases.json` | Every release (albums/EPs/singles) with tracklists and per-platform links |
| `data/about.json` | Bio (DRAFT), Hybrid Music Production copy, AHMP copy + tagline, achievements timeline |
| `data/suno.json` | The Suno playlist + songs (Suno embeds one song at a time) |
| `js/platforms.js` | **Platform registry**: one entry per streaming/social platform (name, icon, URL builder, optional embed) |
| `js/player/` | Player controller + source adapters: `audio-adapter.js`, `spotify-adapter.js`, `suno-adapter.js` |
| `js/views/` | Pages: home, music, discography (+ release sheet), about (+ timeline), connect |
| `js/router.js`, `seo.js`, `share.js`, `embeds.js`, `search.js`, `pwa.js`, `fx/background.js` | Routing, meta/JSON-LD, sharing, click-to-load embeds, search, PWA, hero animation |
| `css/main.css` | All styles. Colours are CSS variables at the top |
| `assets/brand/` | Logos, brand images, OG image. `source/` = Justin's untouched originals, `img/` = optimised copies |
| `assets/artwork/` | Release artwork (WebP) |
| `assets/icons/` | PWA icons (192, 512, maskable) + favicon |
| `sw.js`, `manifest.webmanifest`, `offline.html` | PWA |
| `_headers`, `netlify.toml` | Security headers (CSP etc.) for Netlify / Cloudflare Pages |
| `tools/` | Optional helper scripts (Python/Node). The site never needs them at runtime |

**Rule for every data file:** an empty string, or any value starting with `TODO` or `PLACEHOLDER`, counts as
**not set**. The UI then hides it or shows a "coming soon / link pending" state. Nothing breaks.

---

## Add a release

**Option A: automatic (recommended for Spotify releases).** From the project root:

```
python3 tools/import-spotify-album.py https://open.spotify.com/album/<ID> --write --apple
```

This reads Spotify's public embed/album pages and writes the title, type, release date, tracklist and track IDs
into `data/releases.json`. It saves the cover as `assets/artwork/<id>.webp`. With `--apple` it also adds the
Apple Music link and genre, but **only** when the Apple release's ℗ line names Justin Erasmus or AlgoRythm.
Re-running it on an existing release refreshes the Spotify data and keeps your hand-written `description`, `featured` and `genres`.
It also makes the 300px thumbnail in `assets/artwork/thumbs/`. Without `--write` it only prints the JSON entry (a dry run).
Afterwards run `python3 tools/build-seo.py` (static JSON-LD) and, if you're deploying, bump `VERSION` in `sw.js`.

**Option B: by hand.** Add an object to the `releases` array in `data/releases.json`:

```json
{
  "id": "my-new-single",                     // URL slug: #/discography/my-new-single
  "title": "My New Single",
  "type": "single",                          // album | EP | single
  "date": "2026-11-20",                      // YYYY-MM-DD (sorting + "latest release")
  "artwork": "assets/artwork/my-new-single.webp",   // square, ≥600px; empty = default artwork
  "genres": ["House"],                       // feeds the genre chips on Music
  "description": "",                         // optional. Only real info, never invented
  "spotifyUri": "spotify:album:XXXXXXXXXXXXXXXXXXXXXX",
  "links": {                                 // any key from js/platforms.js
    "spotify": "https://open.spotify.com/album/XXXXXXXXXXXXXXXXXXXXXX",
    "appleMusic": "https://music.apple.com/…",
    "youtubeMusic": "TODO: add when live"
  },
  "featured": false,                         // true = pin as the home page "Latest release"
  "tracks": [
    { "title": "My New Single", "duration": "3:12",
      "spotifyTrackId": "XXXXXXXXXXXXXXXXXXXXXX",  // enables persistent Spotify playback
      "sunoId": "",                               // or a Suno song ID/URL → Suno playback
      "audioUrl": "",                             // or a self-hosted MP3/M4A preview → full native controls
      "explicit": false }
  ]
}
```

For hand-added artwork, run `python3 tools/make-thumbs.py` to make the small 300px thumbnails used by cards and track
rows. If a thumbnail is missing, the full image is used instead.

The newest release (by `date`) is featured on the home page automatically. To pin a different one, set
`featuredReleaseId` in `site.json` (or `"featured": true` on the release).

## Add Suno songs

Suno has an official **per-song** embed (`https://suno.com/embed/<songId>`) but **no playlist embed**.
`suno.com/embed/playlist/…` returned 404 when checked on 1 Oct 2026. So the site embeds songs one at a time, steps
through them with next/previous, and links to the full playlist.

* Add a song: open it on Suno and copy the ID from `https://suno.com/song/<ID>`. Then add
  `{ "id": "<ID>", "title": "…", "duration": "3:21", "style": "UK Garage" }` to `songs` in `data/suno.json`.
  Artwork is optional: if it's empty, the site uses Suno's cover for that ID.
* The current list holds the **first 50 of 246** songs on "The ultimate music box 2026", in playlist order, with
  titles exactly as Suno shows them (imported 1 Oct 2026).

## Edit the bio, stats and achievements

* `data/about.json → bio.paragraphs`. The bio shows a **Draft** badge while `bio.status` is `"DRAFT"`. Set it to `"final"` once Justin approves the text.
* `data/site.json → stats` holds the headline stats (currently 11 Albums · 5 EPs · 20 Singles) and `statsCaption`. An empty list hides the strip.
* `data/about.json → achievements[]` renders as the animated timeline:
  ```json
  { "date": "2025-02-11", "title": "…", "description": "", "category": "Milestone",
    "link": "https://… or #/discography/…", "image": "assets/…", "confirmed": true, "note": "internal only" }
  ```
  * `date` can be `YYYY-MM-DD`, `YYYY-MM` or `YYYY`. If it's empty, the entry shows **Date TBC**. Undated entries
    sort after dated ones, in the order you list them.
  * `confirmed: false` adds a "To be confirmed" badge. `note` is never shown.
  * `placeholder: true` marks a template entry. Set `showPlaceholders: false` to hide those. With no entries left,
    an empty state is shown.

## Add a new streaming or social platform

1. In `js/platforms.js`, add **one** entry to `PLATFORMS`:
   ```js
   { key: 'amazonMusic', name: 'Amazon Music', kind: 'stream', color: '#25D1DA',
     icon: '<svg path d for a 24×24 viewBox>',          // e.g. from simpleicons.org (CC0)
     hosts: ['music.amazon.com'],                       // links on other hosts are rejected
     url: (v) => v,                                     // build a URL from a handle/ID, or pass a full URL through
     embed: (v) => null }                               // optional {src, height, title} for an official iframe
   ```
2. Put the link in `data/site.json → platforms` (artist level) or a release's `links`.
3. **Only if you added `embed()`:** add its origin to `frame-src` in the CSP in `index.html`, `_headers` and `netlify.toml`.

Tracking parameters (`si`, `utm_*`, `sh`) are stripped automatically.

## Swap branding images

| File | Status | How to replace |
|---|---|---|
| `assets/brand/logo-prismatic-wave.svg` | **Typographic placeholder.** No Prismatic Wave logo exists yet | Overwrite it with the real logo (same name, transparent background, ~7:1), or point `site.json → brand.logo` at a new file |
| `assets/brand/logo-mark.svg` | Placeholder prism mark (favicon + PWA icons) | Overwrite, then run `python3 tools/make-brand.py` to regenerate icons (set `SOURCE_MARK`) |
| `assets/brand/ahmp-mark.webp/.png` | **Real**: the AHMP monogram + equaliser, cropped from Justin's poster | Overwrite with an official vector/PNG logo when available |
| `assets/brand/img/*` | **Real**: optimised copies of Justin's images (AVIF/WebP/JPEG, 480/960 widths) | Put new originals (same file names) in a folder and run `python3 tools/optimise-brand.py --src <folder>` (default folder: `/workspace/brand-inbox`). Crops and output names are set at the top of the script |
| `assets/brand/og-image.jpg` | **Real**: social card made from the studio photo | Regenerated by `tools/optimise-brand.py` |
| `assets/brand/hero-bg.svg`, `default-artwork.svg`, `logo-ahmp.svg` (+ `og-image-placeholder.png`, not deployed) | Placeholders / fallbacks | Overwrite with files of the same name |

Image fields in the data files accept a plain path (`"assets/brand/photo.webp"`) or an image object
`{ "base": "assets/brand/img/name", "widths": [480, 960], "width": 960, "height": 1440, "alt": "…" }`.
An image object becomes a responsive `<picture>` with AVIF/WebP/JPEG versions.
Colours are CSS variables at the top of `css/main.css`: electric blue `#1e7bff`, chrome `#c9d3e6`, gold `#f2a33a`, plus the cyan/violet/magenta prism.

## How the player works (and what it honestly can't do)

The player lives **outside** the page outlet, so its iframe is never reloaded when you navigate. Each track gets the
first available source from `site.json → player.sourcePriority` (default `audio → spotify → suno`).

| Source | Controls that really work | Not possible (and why) |
|---|---|---|
| **audio** (`audioUrl`, self-hosted) | Play/pause, previous/next, progress + seek, **volume**, lock-screen and notification controls (Media Session API) | Nothing missing |
| **spotify** (official iFrame API) | Play/pause, previous/next in our queue, progress + seek (from `playback_update`), track info, auto-advance at the end of a track | **Volume:** Spotify's embed has no volume API, so the control is disabled with a note. **Full tracks** play only if the listener is logged in to Spotify in that browser; otherwise Spotify plays **previews** (about 20–30 s). Some browsers (Safari/iOS) may need a tap inside the Spotify iframe the first time, and the player then says so. |
| **suno** (official song embed) | The Suno player sits inside the persistent player, with track info, queue and previous/next (which swap songs) | **Play/pause, seek, progress and volume from our controls:** Suno publishes no embed control API. The listener uses the controls inside Suno's player, and our main button opens or closes the Suno panel. |

If Spotify's iFrame API script can't load (blocked, offline, or disabled with `player.spotifyIframeApi: false`),
the Spotify adapter falls back to a plain Spotify embed and behaves like Suno.
**Visualiser bars** are decorative: they animate while something plays. Cross-origin players don't expose audio data.

## Security notes

* CSP is set in a `<meta>` tag (works on GitHub Pages) and as real headers in `_headers` / `netlify.toml`
  (these also add `frame-ancestors`, HSTS and more). `frame-src` allows only `open.spotify.com` and `suno.com`.
* **`'unsafe-eval'` + `https://embed-cdn.spotifycdn.com` in `script-src` are needed only by Spotify's official
  iFrame API.** Its bundle is shipped as eval()'d modules (checked 1 Oct 2026). If you prefer a stricter CSP, set
  `"spotifyIframeApi": false` in `site.json → player` and remove both from the CSP. Spotify then plays as a plain embed.
* Embeds use click-to-load facades. Static iframes are sandboxed (`allow-scripts allow-same-origin allow-popups
  allow-popups-to-escape-sandbox allow-presentation`) with `referrerpolicy="strict-origin-when-cross-origin"`.
* All external links use `target="_blank" rel="noopener noreferrer"`, and all data is HTML-escaped when rendered.

## Performance notes

* `index.html` contains a **pre-rendered home hero** between `SHELL:START`/`SHELL:END`, generated from `site.json → artist` by
  `tools/build-seo.py`. It paints straight away, before any JS (fast LCP, and visible to no-JS crawlers), and the app replaces it on boot.
  A tiny inline script hides it on deep links (`#/music` …). Its `sha256-…` hash is in the CSP. If you change that one line, update the hash.
* Don't add `<link rel="modulepreload">` for every module. In testing it **lowered** the mobile Lighthouse score (77 vs 92–98),
  because 21 parallel requests compete with the first paint on slow phones.
* Images: AVIF/WebP/JPEG `<picture>` for brand images, 300px thumbnails for artwork, `loading="lazy"` below the fold.
* Lighthouse 12 (1 Oct 2026, mobile, home page): Performance 98 / Accessibility 100 / Best practices 100 / SEO 100 on a gzip+cache
  server like Netlify/Cloudflare; 92 on Python's plain `http.server` (no compression). Desktop: 99 / 100 / 100 / 100.
  Lighthouse 12 no longer has a PWA category. The PWA is covered by the e2e test (manifest, SW, offline).

## SEO

* Per-view `<title>`, description, OG and Twitter tags are updated on navigation (`js/seo.js`). The static tags in
  `index.html` serve link previews, because crawlers and messengers don't run JavaScript.
* JSON-LD: a `MusicGroup` with all albums is generated at runtime, plus a `MusicAlbum` on each release sheet. A static copy for
  crawlers lives in `index.html`. Regenerate it after data edits with `python3 tools/build-seo.py`.
* **Before going live:** set `site.json → siteUrl`, then run `python3 tools/build-seo.py`. This replaces the
  `https://prismaticwave.example/` placeholders in canonical, OG, sitemap and robots.

## Deploy

No build step. Publish the folder root.

* **Netlify:** drag-and-drop the folder, or connect the repo (publish directory `.`). `netlify.toml` applies the headers.
* **Cloudflare Pages:** framework "None", build command empty, output directory `/`. `_headers` applies.
* **GitHub Pages** (live: https://xkwizitai33.github.io/prismatic-wave/): push to `main`; Pages deploys from branch `main`, folder `/` (root).
  `.nojekyll` is included. GitHub Pages ignores `_headers`/`netlify.toml`, so security relies on the `<meta>` CSP in `index.html`
  (it can't set `frame-ancestors`/HSTS; GitHub Pages forces HTTPS itself).
* `.gitignore` keeps `screenshots/` (QA only), `assets/brand/source/` (Justin's full-size originals, only needed by
  `optimise-brand.py`: keep a copy locally) and the unused OG placeholder out of the repo. The two install-dialog screenshots
  used by the manifest live in `assets/pwa/`.
* **Sub-path hosting** (e.g. `https://user.github.io/prismatic-wave/`) works out of the box: all URLs are relative, and the
  manifest scope and service worker scope follow the folder. Set `siteUrl` and run `python3 tools/build-seo.py`. It updates canonical/OG
  URLs, the sitemap, robots.txt and the `<base href>` in `404.html`. `404.html` also sends paths like `/prismatic-wave/music`
  to `#/music`.
* After changing any shell file (JS/CSS/HTML), bump `VERSION` in `sw.js` so installed PWAs update. Data files are
  fetched network-first, so content edits show up straight away.

## Testing

```
python3 -m http.server 8765 --bind 127.0.0.1 &
npm i playwright-core     # once
CHROME=/usr/bin/google-chrome node tools/e2e-test.mjs --shots   # 50+ checks, writes screenshots/
```
