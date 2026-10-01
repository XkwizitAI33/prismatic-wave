/** Per-view <title>/meta + JSON-LD (MusicGroup / MusicAlbum) generated from the data files. */
import { isSet, resolveLinks } from './platforms.js';
import { isoDuration } from './util.js';

export function siteBase(site) {
  if (isSet(site?.siteUrl)) return site.siteUrl.replace(/#.*$/, '').replace(/\/?$/, '/');
  return location.origin + location.pathname.replace(/index\.html$/, '');
}
const abs = (base, p) => (!p ? undefined : /^https?:/.test(p) ? p : base + p.replace(/^\//, ''));

function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', value);
}

export function applyMeta(data, { title, description, image, hash }) {
  const name = data.site.artist?.name || 'Prismatic Wave';
  const full = title ? `${title} · ${name}` : `${name} — ${data.site.artist?.tagline || 'Hybrid Music Producer'}`;
  const desc = description || data.site.seo?.description || '';
  const base = siteBase(data.site);
  const url = base + (hash && hash !== '#/' ? hash : '');
  const img = abs(base, image || data.site.brand?.ogImage);
  document.title = full;
  setMeta('name', 'description', desc);
  setMeta('property', 'og:title', full);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:url', url);
  if (img) { setMeta('property', 'og:image', img); setMeta('name', 'twitter:image', img); }
  setMeta('name', 'twitter:title', full);
  setMeta('name', 'twitter:description', desc);
  const canon = document.head.querySelector('link[rel="canonical"]');
  if (canon && isSet(data.site.siteUrl)) canon.href = url;
}

const RELEASE_TYPE = { album: 'https://schema.org/AlbumRelease', EP: 'https://schema.org/EPRelease', single: 'https://schema.org/SingleRelease' };

export function albumLd(data, r, base = siteBase(data.site)) {
  const sameAs = resolveLinks(r.links).map((l) => l.url);
  return {
    '@type': 'MusicAlbum',
    name: r.title,
    url: `${base}#/discography/${r.id}`,
    datePublished: r.date || undefined,
    image: abs(base, r.artwork),
    genre: r.genres.length ? r.genres : undefined,
    albumReleaseType: RELEASE_TYPE[r.type],
    numTracks: r.tracks.length || undefined,
    byArtist: { '@type': 'MusicGroup', name: data.site.artist?.name },
    sameAs: sameAs.length ? sameAs : undefined,
    track: r.tracks.length ? r.tracks.map((t, i) => ({
      '@type': 'MusicRecording', position: i + 1, name: t.title,
      duration: t.duration ? isoDuration(t.duration) : undefined,
      url: t.sources.spotify ? `https://open.spotify.com/track/${t.sources.spotify.split(':').pop()}` : undefined
    })) : undefined
  };
}

export function artistLd(data) {
  const s = data.site;
  const base = siteBase(s);
  const sameAs = [
    ...resolveLinks(s.platforms || {}).map((l) => l.url),
    ...resolveLinks(s.socials || {}).map((l) => l.url)
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: s.artist?.name,
    description: s.seo?.description,
    url: base,
    image: abs(base, s.brand?.ogImage),
    logo: abs(base, s.brand?.logo),
    genre: data.genres.slice(0, 8).map((g) => g.name),
    foundingLocation: s.artist?.country ? { '@type': 'Place', name: s.artist.country } : undefined,
    member: s.artist?.realName ? [{ '@type': 'Person', name: s.artist.realName, jobTitle: 'Hybrid Music Producer' }] : undefined,
    sameAs: [...new Set(sameAs)],
    album: data.releases.map((r) => {
      const a = albumLd(data, r, base);
      delete a.track; delete a.byArtist;
      return a;
    })
  };
}

export function setJsonLd(obj) {
  let el = document.getElementById('ld-dynamic');
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'ld-dynamic';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(obj);
}


