import { html, raw, $, fmtDate, fmtTime } from '../util.js';
import { releaseCard, trackRow, img, playIcon, shareIcon, typeLabel, platformButtons } from './components.js';
import { facade, hydrateFacades } from '../embeds.js';
import { isSet, resolveLinks } from '../platforms.js';
import { albumLd } from '../seo.js';

const TYPES = [['', 'All'], ['album', 'Albums'], ['EP', 'EPs'], ['single', 'Singles']];
const SORTS = [['new', 'Newest first'], ['old', 'Oldest first'], ['az', 'A–Z']];

export function discographyView(ctx, { params, query }) {
  const { data } = ctx;
  const { releases, site } = data;
  const state = { type: query.type || '', sort: query.sort || 'new' };
  let root, sheet, lastFocus = null, openedFromGrid = false;

  const count = (t) => releases.filter((r) => !t || r.type === t).length;
  function list() {
    const l = releases.filter((r) => !state.type || r.type === state.type);
    if (state.sort === 'old') l.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    else if (state.sort === 'az') l.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
    else l.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return l;
  }
  function renderGrid() {
    const l = list();
    $('#rel-grid', root).innerHTML = l.length
      ? l.map((r, i) => releaseCard(r, { eager: i < 2 }).s).join('')
      : html`<div class="empty glass"><h2>No ${state.type ? typeLabel(state.type).toLowerCase() + 's' : 'releases'} yet</h2><p>They'll appear here once added to data/releases.json.</p></div>`.s;
    $('#rel-count', root).textContent = `${l.length} ${l.length === 1 ? 'release' : 'releases'}`;
    root.querySelectorAll('[data-type-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.typeFilter === state.type)));
    if (!params.id) ctx.router.replaceQuery({ type: state.type, sort: state.sort === 'new' ? '' : state.sort });
  }

  function sheetHtml(r) {
    const total = r.tracks.reduce((s, t) => s + (t.duration || 0), 0);
    const pendingLinks = resolveLinks(r.links, { includePending: true }).filter((l) => l.pending).map((l) => l.platform.name);
    return html`
      <div class="sheet__bar">
        <span class="sheet__grip" aria-hidden="true"></span>
        <button class="icon-btn" type="button" data-close-sheet aria-label="Close release details">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="sheet__hero">
        <div class="sheet__art">${img(r.artwork, `${r.title} artwork`, 'sheet__img', { eager: true })}</div>
        <div class="sheet__meta">
          <p class="rcard__meta"><span class="badge badge--type">${typeLabel(r.type)}</span>${r.date ? html`<time datetime="${r.date}">${fmtDate(r.date)}</time>` : html`<span>Date TBC</span>`}</p>
          <h2 class="sheet__title" id="sheet-title" tabindex="-1">${r.title}</h2>
          <p class="muted">${site.artist?.name}${r.tracks.length ? ` · ${r.tracks.length} ${r.tracks.length === 1 ? 'track' : 'tracks'}` : ''}${total ? ` · ${fmtTime(total)}` : ''}</p>
          ${r.genres.length ? html`<p class="tags">${r.genres.map((g) => html`<a class="chip chip--sm" href="#/music?genre=${encodeURIComponent(g)}">${g}</a>`)}</p>` : ''}
          ${isSet(r.description) ? html`<p class="sheet__desc">${r.description}</p>` : ''}
          <div class="btn-row">
            <button class="btn btn--prism" type="button" data-play-release="${r.id}">${raw(playIcon)}<span>Play</span></button>
            <button class="btn btn--ghost" type="button" data-share="release" data-id="${r.id}">${raw(shareIcon)}<span>Share</span></button>
          </div>
        </div>
      </div>
      ${r.tracks.length ? html`<h3 class="sheet__h">Tracklist</h3>
        <ol class="tracklist tracklist--compact">${r.tracks.map((t, i) => trackRow(t, { context: `release:${r.id}`, index: i, showArt: false, showRelease: false }))}</ol>` : ''}
      <h3 class="sheet__h">Listen on</h3>
      <div class="plinks">${platformButtons(r.links)}</div>
      ${pendingLinks.length ? html`<p class="pending-note"><span class="dot" aria-hidden="true"></span>Link pending: ${pendingLinks.join(', ')}</p>` : ''}
      ${r.spotifyUri || r.links.spotify ? html`<h3 class="sheet__h">Spotify player</h3>${raw(facade({ platform: 'spotify', value: r.spotifyUri || r.links.spotify, title: r.title, artwork: r.artwork }))}` : ''}
      ${r.source?.importedFrom ? html`<p class="muted small source-note">Data source: ${r.source.importedFrom}${r.source.genreFrom ? ` · genre from ${r.source.genreFrom.split(' (')[0]}` : ''}.</p>` : ''}`.s;
  }

  function openSheet(id) {
    const r = data.releaseById.get(id);
    if (!r) { closeSheet(true); return null; }
    $('#sheet-content').innerHTML = sheetHtml(r);
    hydrateFacades(sheet);
    ctx.markPlaying(sheet);
    if (!sheet.open) { lastFocus = document.activeElement; sheet.showModal(); }
    sheet.querySelector('.sheet__inner').scrollTop = 0;
    $('#sheet-title').focus({ preventScroll: true });
    ctx.setJsonLd({ '@context': 'https://schema.org', ...albumLd(data, r) });
    return { title: `${r.title} (${typeLabel(r.type)})`, description: `${r.title}: ${typeLabel(r.type).toLowerCase()} by ${site.artist?.name}${r.date ? `, released ${fmtDate(r.date)}` : ''}. ${r.tracks.length} tracks. Listen on ${resolveLinks(r.links).map((l) => l.platform.name).join(', ') || 'streaming platforms'}.`, image: r.artwork, hash: `#/discography/${r.id}` };
  }
  function closeSheet(navigate) {
    if (sheet?.open) sheet.close();
    $('#sheet-content').innerHTML = '';
    if (navigate) {
      if (openedFromGrid) history.back();
      else location.hash = '#/discography';
    }
    lastFocus?.focus?.({ preventScroll: true });
  }

  const meta = { title: 'Discography', description: `Albums, EPs and singles by ${site.artist?.name}. ${releases.length} releases with tracklists and links to Spotify and more.` };

  return {
    render(el) {
      root = el;
      sheet = $('#release-sheet');
      el.innerHTML = html`
      <section class="page-hero">
        <p class="kicker">Catalogue</p>
        <h1 class="page-title" tabindex="-1">Discography</h1>
        <p class="lede">Albums, EPs and singles. Tap a cover for the tracklist, links and player.</p>
      </section>
      <section class="section">
        <div class="toolbar glass">
          <div class="seg" role="group" aria-label="Release type">
            ${TYPES.map(([v, l]) => html`<button type="button" class="seg__btn" data-type-filter="${v}" aria-pressed="${String(v === state.type)}">${l} <span class="chip__n">${count(v)}</span></button>`)}
          </div>
          <label class="select"><span class="sr-only">Sort releases</span>
            <select id="rel-sort">${SORTS.map(([v, l]) => html`<option value="${v}" ${raw(v === state.sort ? 'selected' : '')}>${l}</option>`)}</select>
          </label>
        </div>
        <p class="muted small" id="rel-count" aria-live="polite"></p>
        <div class="grid" id="rel-grid"></div>
        <p class="muted small source-note">Listed: the releases found on Prismatic Wave’s public Spotify pages. See the full catalogue in the <a href="#/music">official Spotify artist player</a>.</p>
      </section>`.s;
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-type-filter]');
        if (b) { state.type = b.dataset.typeFilter; renderGrid(); }
        if (e.target.closest('.rcard a')) openedFromGrid = true;
      });
      $('#rel-sort', el).addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
      sheet.onclick = (e) => { if (e.target === sheet || e.target.closest('[data-close-sheet]')) closeSheet(true); };
      sheet.oncancel = (e) => { e.preventDefault(); closeSheet(true); };
      renderGrid();
      if (params.id) { const m = openSheet(params.id); if (m) Object.assign(meta, m); }
    },
    get title() { return meta.title; },
    get description() { return meta.description; },
    get image() { return meta.image; },
    get hash() { return meta.hash; },
    update({ params: p }) {
      params = p;
      if (p.id) return openSheet(p.id);
      if (sheet.open) closeSheet(false);
      openedFromGrid = false;
      ctx.setJsonLd(null);
      return { title: 'Discography', description: meta.description, hash: '#/discography' };
    },
    cleanup() { if (sheet?.open) sheet.close(); sheet.onclick = null; sheet.oncancel = null; }
  };
}
