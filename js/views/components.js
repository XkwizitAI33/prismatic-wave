/** Reusable view fragments. Every interpolation is escaped by html``. */
import { html, raw, esc, fmtDate, fmtTime, extLink } from '../util.js';
import { resolveLinks, svgIcon, isSet } from '../platforms.js';

const TYPE_LABEL = { album: 'Album', EP: 'EP', single: 'Single' };
export const typeLabel = (t) => TYPE_LABEL[t] || t;

export const playIcon = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7L8 5Z" fill="currentColor"/></svg>';
export const shareIcon = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
export const arrowIcon = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const extIcon = '<svg class="icon icon--xs" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6L10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Local release artwork gets a 300px thumbnail (tools/make-thumbs.py) in srcset; if it is missing, the error handler drops srcset. */
const thumbOf = (src) => { const m = /^assets\/artwork\/([^/]+)\.(webp|jpe?g|png)$/i.exec(src || ''); return m ? `assets/artwork/thumbs/${m[1]}-300.webp` : ''; };
export const img = (src, alt, cls, { w = 600, h = 600, eager = false, sizes = '' } = {}) => {
  const t = sizes && thumbOf(src);
  return html`<img class="${cls}" src="${src}" ${raw(t ? `srcset="${esc(t)} 300w, ${esc(src)} 600w" sizes="${esc(sizes)}"` : '')} alt="${alt}" width="${w}" height="${h}" ${raw(eager ? 'fetchpriority="high"' : 'loading="lazy"')} decoding="async" data-fallback>`;
};

export const sectionHead = (kicker, title, extra = '') =>
  html`<header class="section-head"><p class="kicker">${kicker}</p><h2 class="section-title">${title}</h2>${raw(extra)}</header>`;

export function releaseCard(r, { eager = false } = {}) {
  const year = r.date ? r.date.slice(0, 4) : '';
  return html`<article class="rcard" data-type="${r.type}">
    <a class="rcard__link" href="#/discography/${r.id}" aria-label="${r.title}, ${typeLabel(r.type)}${year ? ', ' + year : ''}. View details">
      <div class="rcard__art">${img(r.artwork, '', 'rcard__img', { eager, sizes: '(min-width: 1100px) 260px, (min-width: 720px) 30vw, 46vw' })}<span class="rcard__shine" aria-hidden="true"></span></div>
    </a>
    <div class="rcard__body">
      <p class="rcard__meta"><span class="badge badge--type">${typeLabel(r.type)}</span><span>${year}</span>${r.tracks.length > 1 ? html`<span>· ${r.tracks.length} tracks</span>` : ''}</p>
      <h3 class="rcard__title"><a href="#/discography/${r.id}">${r.title}</a></h3>
    </div>
    <button class="fab fab--play" type="button" data-play-release="${r.id}" aria-label="Play ${r.title}">${raw(playIcon)}</button>
  </article>`;
}

export function trackRow(t, { context, index, showArt = true, showRelease = true }) {
  const genre = t.genres[0];
  const src = t.sources.audio ? 'Audio' : t.sources.spotify ? 'Spotify' : t.sources.suno ? 'Suno' : '';
  return html`<li class="trow" data-uid="${t.uid}">
    <button class="trow__play" type="button" data-play-uid="${t.uid}" data-context="${context}" aria-label="Play ${t.title}">
      ${showArt ? img(t.artwork, '', 'trow__art', { w: 96, h: 96, sizes: '48px' }) : html`<span class="trow__num">${index + 1}</span>`}
      <span class="trow__icon" aria-hidden="true">${raw(playIcon)}</span>
      <span class="trow__eq eq" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>
    <div class="trow__text">
      <p class="trow__title">${t.title}${t.explicit ? html` <abbr class="badge badge--e" title="Explicit">E</abbr>` : ''}</p>
      ${showRelease ? html`<p class="trow__sub">${t.releaseId ? html`<a href="#/discography/${t.releaseId}">${t.releaseTitle}</a>` : t.releaseTitle}${genre ? ` · ${genre}` : ''}</p>` : ''}
    </div>
    <span class="badge badge--src badge--${src.toLowerCase()}">${src}</span>
    <span class="trow__dur">${t.duration ? fmtTime(t.duration) : ''}</span>
    <button class="icon-btn icon-btn--sm" type="button" data-share="track" data-id="${t.uid}" aria-label="Share ${t.title}">${raw(shareIcon)}</button>
  </li>`;
}

export function platformButtons(links, { cls = 'pbtn', labelPrefix = 'Listen on' } = {}) {
  return resolveLinks(links).map(({ platform, url }) =>
    extLink(url, html`${raw(svgIcon(platform.key === 'sunoProfile' ? 'suno' : platform.key))}<span>${platform.name}</span>${raw(extIcon)}`, `${cls} ${cls}--${platform.key}`, `${labelPrefix} ${platform.name} (opens in a new tab)`));
}

export const pendingNote = (names) => names.length
  ? html`<p class="pending-note"><span class="dot" aria-hidden="true"></span>Coming soon: ${names.join(', ')}</p>`
  : '';

export const dateLabel = (d) => fmtDate(d);

/** Headline stats from site.json "stats" (e.g. 11 Albums · 5 EPs · 20 Singles). Empty list = nothing rendered. */
export function statsStrip(site, cls = '') {
  const stats = (site.stats || []).filter((s) => s && s.value !== '' && s.label);
  if (!stats.length) return '';
  return html`<div class="stats ${cls}">
    <dl class="stats__list">${stats.map((s) => html`<div class="stat"><dt class="stat__label">${s.label}</dt><dd class="stat__value">${s.value}</dd></div>`)}</dl>
    ${site.statsCaption ? html`<p class="stats__caption">${site.statsCaption}</p>` : ''}
  </div>`;
}

/**
 * Responsive <picture> from an image object {base, widths, width, height, alt} → base-<w>.{avif,webp,jpg}
 * (made by tools/optimise-brand.py). A plain path string renders a normal <img>.
 */
export function picture(obj, { cls = '', sizes = '100vw', eager = false, alt } = {}) {
  if (!obj || (typeof obj === 'string' && !isSet(obj))) return '';
  if (typeof obj === 'string') return img(obj, alt || '', cls, { eager });
  const { base, widths = [], width = 1200, height = 800, src } = obj;
  const a = alt ?? obj.alt ?? '';
  if (!base || !widths.length) return isSet(src) ? img(src, a, cls, { w: width, h: height, eager }) : '';
  const set = (ext) => widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ');
  return html`<picture class="pic ${cls}-pic">
    <source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">
    <source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">
    <img class="${cls}" src="${base}-${widths[widths.length - 1]}.jpg" srcset="${set('jpg')}" sizes="${sizes}" alt="${a}" width="${width}" height="${height}" ${raw(eager ? 'fetchpriority="high"' : 'loading="lazy"')} decoding="async">
  </picture>`;
}
