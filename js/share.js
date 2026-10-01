/** Web Share API with clipboard fallback (and a last-resort manual copy prompt). */
import { siteBase } from './seo.js';
import { toast } from './util.js';

export function shareUrl(data, hash = '') {
  return siteBase(data.site) + hash;
}

export async function share({ title, text, url }) {
  const payload = { title, text, url };
  if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
    try { await navigator.share(payload); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; /* fall through to clipboard */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied to clipboard');
    return 'copied';
  } catch {
    // Clipboard blocked (insecure context / permissions): show the link so it can be copied manually
    window.prompt('Copy this link:', url);
    return 'prompted';
  }
}

export function shareTarget(data, kind, id) {
  const name = data.site.artist?.name || 'Prismatic Wave';
  if (kind === 'release') {
    const r = data.releaseById.get(id);
    if (r) return { title: `${r.title} — ${name}`, text: `Listen to ${r.title} (${r.type}) by ${name}`, url: shareUrl(data, `#/discography/${r.id}`) };
  }
  if (kind === 'track') {
    const t = data.byUid.get(id);
    if (t) return { title: `${t.title} — ${name}`, text: `Listen to “${t.title}” by ${name}`, url: shareUrl(data, `#/music?track=${encodeURIComponent(t.uid)}`) };
  }
  return { title: `${name} — ${data.site.artist?.tagline || ''}`.trim(), text: `${name}: ${data.site.artist?.supportingLine || ''}`.trim(), url: shareUrl(data, '') };
}
