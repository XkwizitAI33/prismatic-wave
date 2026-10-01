import { html, raw, $ } from '../util.js';
import { sectionHead, trackRow, img, playIcon, extIcon } from './components.js';
import { facade, hydrateFacades, pending } from '../embeds.js';
import { platformUrl, isSet } from '../platforms.js';
import { filterTracks } from '../search.js';

const SOURCES = [['', 'All'], ['spotify', 'Spotify releases'], ['suno', 'Suno']];
const PAGE = 40;

export function musicView(ctx, { query }) {
  const { data } = ctx;
  const { site, suno, tracks, genres } = data;
  const state = { q: query.q || '', genre: query.genre || '', source: query.source || '', limit: PAGE, track: query.track || '' };
  const spotifyArtist = site.spotify?.artistId || site.platforms?.spotify;
  const playlistUrl = platformUrl('suno', suno.playlist?.url);
  const firstSong = suno.songs[0];
  let root;

  function results() {
    const list = filterTracks(tracks, state);
    ctx.setContext('results', list);
    return list;
  }
  function renderResults() {
    const list = results();
    const shown = list.slice(0, state.limit);
    $('#track-count', root).textContent = `${list.length} ${list.length === 1 ? 'track' : 'tracks'}${state.q || state.genre || state.source ? ' match' : ''}`;
    $('#track-list', root).innerHTML = shown.length
      ? shown.map((t, i) => trackRow(t, { context: 'results', index: i }).s).join('')
      : html`<li class="empty-row"><p><strong>No tracks found.</strong> Try another search or clear the filters.</p><button class="btn btn--ghost" type="button" data-clear>Clear filters</button></li>`.s;
    $('#more-wrap', root).hidden = list.length <= state.limit;
    root.querySelectorAll('[data-genre]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.genre === state.genre)));
    root.querySelectorAll('[data-source]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.source === state.source)));
    ctx.markPlaying(root);
    ctx.router.replaceQuery({ q: state.q, genre: state.genre, source: state.source, track: state.track });
  }

  function sharedTrackBanner() {
    const t = state.track && data.byUid.get(state.track);
    if (!t) return '';
    return html`<div class="shared glass" role="region" aria-label="Shared track">
      ${img(t.artwork, '', 'shared__art', { w: 96, h: 96 })}
      <div><p class="kicker">Shared with you</p><p class="shared__title">${t.title}</p><p class="trow__sub">${t.releaseTitle}</p></div>
      <button class="btn btn--prism" type="button" data-play-uid="${t.uid}" data-context="catalogue">${raw(playIcon)}<span>Play</span></button>
    </div>`;
  }

  return {
    title: 'Music',
    description: `Listen to ${site.artist?.name}: the official Spotify artist player, Suno songs from "${suno.playlist?.title || 'Suno'}", plus search and genre filters across every track.`,
    render(el) {
      root = el;
      el.innerHTML = html`
      <section class="page-hero">
        <p class="kicker">Listen</p>
        <h1 class="page-title" tabindex="-1">Music</h1>
        <p class="lede">Every Prismatic Wave track in one place. Play anything below and it keeps playing in the player while you browse.</p>
      </section>
      ${sharedTrackBanner()}
      <section class="section listen-hub" aria-label="Official players">
        <article class="hub glass hub--spotify">
          <header class="hub__head"><p class="kicker">Spotify</p><h2 class="hub__title">Official artist player</h2></header>
          ${isSet(spotifyArtist)
            ? raw(facade({ platform: 'spotify', value: spotifyArtist, title: `${site.artist?.name} on Spotify`, note: 'Loads Spotify’s official artist player here. Playback inside this box stops if you leave the page. Use the ▶ buttons for playback that continues while you browse.' }))
            : raw(pending('spotify', 'Spotify artist player'))}
          <div class="btn-row">
            <button class="btn btn--glass" type="button" data-play-context="spotify">${raw(playIcon)}<span>Play all releases</span></button>
            ${platformUrl('spotify', site.platforms?.spotify) ? html`<a class="btn btn--ghost" href="${platformUrl('spotify', site.platforms.spotify)}" target="_blank" rel="noopener noreferrer">Open in Spotify ${raw(extIcon)}</a>` : ''}
          </div>
        </article>
        <article class="hub glass hub--suno">
          <header class="hub__head"><p class="kicker">Suno</p><h2 class="hub__title">${suno.playlist?.title || 'Suno catalogue'}</h2></header>
          ${suno.songs.length ? html`
            <div class="hub__playlist">
              ${img(suno.playlist.artwork || data.defaultArt, '', 'hub__art', { w: 160, h: 160 })}
              <div>
                <p>${suno.playlist.description || ''}</p>
                <p class="muted small">${suno.playlist.songCount ? `${suno.playlist.songCount} songs on Suno · ` : ''}${suno.songs.length} listed here</p>
              </div>
            </div>
            ${firstSong ? raw(facade({ platform: 'suno', value: firstSong.sources.suno, title: firstSong.title, note: 'Suno embeds songs one at a time (there’s no playlist embed), so this loads the first song. Use “Play Suno songs” to step through all of them in the player.' })) : ''}
            <div class="btn-row">
              <button class="btn btn--glass" type="button" data-play-context="suno">${raw(playIcon)}<span>Play Suno songs</span></button>
              ${playlistUrl ? html`<a class="btn btn--ghost" href="${playlistUrl}" target="_blank" rel="noopener noreferrer">Full playlist on Suno ${raw(extIcon)}</a>` : ''}
            </div>` : raw(pending('suno', 'Suno playlist'))}
        </article>
      </section>

      <section class="section" aria-labelledby="browse-title">
        ${sectionHead('Browse', html`<span id="browse-title">All tracks</span>`)}
        <div class="filters glass">
          <label class="search">
            <span class="sr-only">Search tracks</span>
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <input id="track-search" type="search" placeholder="Search tracks, releases, genres…" value="${state.q}" autocomplete="off" enterkeyhint="search">
          </label>
          <div class="seg" role="group" aria-label="Source">
            ${SOURCES.map(([v, l]) => html`<button type="button" class="seg__btn" data-source="${v}" aria-pressed="${String(v === state.source)}">${l}</button>`)}
          </div>
          <div class="chips" role="group" aria-label="Genre">
            <button type="button" class="chip" data-genre="" aria-pressed="${String(!state.genre)}">All genres</button>
            ${genres.map((g) => html`<button type="button" class="chip" data-genre="${g.name}" aria-pressed="${String(g.name === state.genre)}">${g.name} <span class="chip__n">${g.count}</span></button>`)}
          </div>
        </div>
        <p class="muted small" id="track-count" aria-live="polite"></p>
        <ol class="tracklist" id="track-list"></ol>
        <div class="center" id="more-wrap" hidden><button class="btn btn--ghost" type="button" data-more>Show more</button></div>
      </section>`.s;

      hydrateFacades(el);
      const input = $('#track-search', el);
      let t;
      input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = input.value.trim(); state.limit = PAGE; renderResults(); }, 120); });
      el.addEventListener('click', (e) => {
        const g = e.target.closest('[data-genre]');
        if (g) { state.genre = g.dataset.genre === state.genre ? '' : g.dataset.genre; state.limit = PAGE; renderResults(); return; }
        const s = e.target.closest('[data-source]');
        if (s) { state.source = s.dataset.source; state.limit = PAGE; renderResults(); return; }
        if (e.target.closest('[data-more]')) { state.limit += PAGE; renderResults(); return; }
        if (e.target.closest('[data-clear]')) { state.q = ''; state.genre = ''; state.source = ''; input.value = ''; renderResults(); input.focus(); }
      });
      renderResults();
      if (state.track) {
        requestAnimationFrame(() => el.querySelector(`.trow[data-uid="${CSS.escape(state.track)}"]`)?.classList.add('is-highlight'));
      }
    }
  };
}
