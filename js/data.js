/**
 * Loads /data/*.json and normalises it into one in-memory model:
 *   site, about, releases[] (sorted newest first), suno {playlist, songs},
 *   tracks[] (every playable item, with uid + sources), genres[]
 */
import { isSet, parseSpotify, parseSuno } from './platforms.js';
import { parseDuration, slug } from './util.js';

const FILES = ['site', 'releases', 'about', 'suno'];

async function getJSON(name) {
  const res = await fetch(`data/${name}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`data/${name}.json: HTTP ${res.status}`);
  return res.json();
}

export async function loadData() {
  const [site, rel, about, suno] = await Promise.all(FILES.map((f) => getJSON(f).catch((e) => { console.warn(e); return {}; })));
  const artistName = site.artist?.name || 'Prismatic Wave';
  const defaultArt = site.brand?.defaultArtwork || 'assets/brand/default-artwork.svg';

  const releases = (rel.releases || [])
    .filter((r) => r && isSet(r.title))
    .map((r) => ({
      ...r,
      id: r.id || slug(r.title),
      type: (r.type || 'single').toLowerCase() === 'ep' ? 'EP' : (r.type || 'single').toLowerCase(),
      artwork: isSet(r.artwork) ? r.artwork : defaultArt,
      genres: (r.genres || []).filter(isSet),
      links: r.links || {},
      tracks: r.tracks || []
    }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const tracks = [];
  const seen = new Set();
  for (const r of releases) {
    r.tracks = r.tracks.map((t, i) => {
      const sp = isSet(t.spotifyTrackId) ? (parseSpotify(t.spotifyTrackId)?.id || t.spotifyTrackId) : null;
      const sn = isSet(t.sunoId) ? parseSuno(t.sunoId)?.id : null;
      const track = {
        uid: sp ? `sp-${sp}` : sn ? `suno-${sn}` : `${r.id}-${i + 1}`,
        title: t.title,
        artist: t.artist || artistName,
        releaseId: r.id,
        releaseTitle: r.title,
        releaseType: r.type,
        artwork: isSet(t.artwork) ? t.artwork : r.artwork,
        duration: parseDuration(t.duration),
        explicit: !!t.explicit,
        genres: r.genres,
        number: i + 1,
        sources: {
          audio: isSet(t.audioUrl) ? t.audioUrl : null,
          spotify: sp ? `spotify:track:${sp}` : null,
          suno: sn
        },
        origin: 'release'
      };
      if (!seen.has(track.uid)) { seen.add(track.uid); tracks.push(track); }
      return track;
    });
  }

  const playlist = suno.playlist || {};
  const sunoSongs = (suno.songs || []).filter((s) => parseSuno(s.id)).map((s, i) => {
    const id = parseSuno(s.id).id;
    const t = {
      uid: `suno-${id}`,
      title: s.title,
      artist: s.artist || artistName,
      releaseId: null,
      releaseTitle: isSet(playlist.title) ? `Suno · ${playlist.title}` : 'Suno',
      artwork: isSet(s.artwork) ? s.artwork : `https://cdn2.suno.ai/image_${id}.jpeg`,
      duration: parseDuration(s.duration),
      explicit: false,
      genres: isSet(s.style) ? [s.style.trim()] : [],
      number: i + 1,
      sources: { audio: isSet(s.audioUrl) ? s.audioUrl : null, spotify: null, suno: id },
      origin: 'suno'
    };
    if (!seen.has(t.uid)) { seen.add(t.uid); tracks.push(t); }
    return t;
  });

  // Genre chips: case-insensitive merge, sorted by frequency
  const counts = new Map();
  for (const t of tracks) for (const g of t.genres) {
    const k = g.toLowerCase();
    const e = counts.get(k) || { name: g, count: 0 };
    e.count++; counts.set(k, e);
  }
  const genres = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const featured = releases.find((r) => r.id === site.featuredReleaseId) || releases.find((r) => r.featured) || releases[0] || null;

  return {
    site, about, releases, tracks, genres, featured,
    suno: { playlist, songs: sunoSongs },
    defaultArt,
    byUid: new Map(tracks.map((t) => [t.uid, t])),
    releaseById: new Map(releases.map((r) => [r.id, r]))
  };
}
