/** Track search + filtering over the normalised data (title, release, genre/style, source). */
import { norm } from './util.js';

export function filterTracks(tracks, { q = '', genre = '', source = '' } = {}) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const g = norm(genre);
  return tracks.filter((t) => {
    if (source === 'spotify' && !t.sources.spotify) return false;
    if (source === 'suno' && !t.sources.suno) return false;
    if (source === 'audio' && !t.sources.audio) return false;
    if (g && !t.genres.some((x) => norm(x) === g)) return false;
    if (!terms.length) return true;
    const hay = norm(`${t.title} ${t.releaseTitle} ${t.genres.join(' ')} ${t.releaseType || ''}`);
    return terms.every((term) => hay.includes(term));
  });
}
