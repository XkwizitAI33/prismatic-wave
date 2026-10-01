/**
 * Prismatic Wave — app entry. Loads data, starts the persistent player, the router and global actions.
 * No framework, no build step: plain ES modules.
 */
import { loadData } from './data.js';
import { createRouter } from './router.js';
import { createPlayer } from './player/player.js';
import { applyMeta, artistLd, setJsonLd } from './seo.js';
import { share, shareTarget } from './share.js';
import { initPwa, refreshInstallButtons } from './pwa.js';
import { homeView } from './views/home.js';
import { musicView } from './views/music.js';
import { discographyView } from './views/discography.js';
import { aboutView } from './views/about.js';
import { connectView } from './views/connect.js';
import { notFoundView } from './views/notfound.js';
import { toast } from './util.js';

initPwa();

async function boot() {
  const outlet = document.getElementById('main');
  let data;
  try {
    data = await loadData();
  } catch (e) {
    console.error(e);
    outlet.innerHTML = '<section class="page-hero"><h1 class="page-title">Something went wrong</h1><p class="lede">The music data could not be loaded. Please refresh.</p></section>';
    return;
  }
  const heroBg = new URL(data.site.brand?.heroBackground || 'assets/brand/hero-bg.svg', location.href).href;
  document.documentElement.style.setProperty('--hero-bg', `url("${heroBg}")`);
  document.querySelectorAll('[data-brand="logo"]').forEach((img) => { if (data.site.brand?.logo) img.src = data.site.brand.logo; });

  // Playback contexts: named track lists the UI can start playing from
  const contexts = new Map([
    ['catalogue', data.tracks],
    ['spotify', data.tracks.filter((t) => t.sources.spotify)],
    ['suno', data.suno.songs]
  ]);
  data.releases.forEach((r) => contexts.set(`release:${r.id}`, r.tracks));
  const listenNow = () => {
    const first = data.featured ? data.featured.tracks : [];
    const rest = data.tracks.filter((t) => !first.includes(t));
    player.playQueue([...first, ...rest], 0, { autoplay: true });
  };

  const player = createPlayer({ priority: data.site.player?.sourcePriority, onIdlePlay: listenNow, defaultArt: data.defaultArt, spotifyIframeApi: data.site.player?.spotifyIframeApi !== false });

  const markPlaying = (root = document) => {
    const { uid, playing } = player.state.track ? { uid: player.state.track.uid, playing: player.state.playing } : {};
    root.querySelectorAll('.trow').forEach((row) => {
      const cur = row.dataset.uid === uid;
      row.classList.toggle('is-current', cur);
      row.classList.toggle('is-playing', cur && playing);
    });
  };
  document.addEventListener('player:change', () => markPlaying());

  const artistJsonLd = artistLd(data);
  const ctx = {
    data,
    setContext: (name, list) => contexts.set(name, list),
    markPlaying,
    setJsonLd: (obj) => setJsonLd(obj || artistJsonLd),
    refreshInstall: refreshInstallButtons
  };

  const router = createRouter({
    outlet,
    routes: [
      { name: 'home', pattern: /^\/$/, view: () => homeView(ctx) },
      { name: 'music', pattern: /^\/music$/, view: (m) => musicView(ctx, m) },
      { name: 'discography', pattern: /^\/discography(?:\/(?<id>[^/]+))?$/, view: (m) => discographyView(ctx, m) },
      { name: 'about', pattern: /^\/about$/, view: () => aboutView(ctx) },
      { name: 'connect', pattern: /^\/connect$/, view: () => connectView(ctx) },
      { name: 'notfound', pattern: /^$/, view: () => notFoundView() }
    ],
    onRoute: ({ title, description, image, hash, soft, params }) => {
      applyMeta(data, { title, description, image, hash: hash || location.hash.split('?')[0] });
      if (!params?.id) setJsonLd(artistJsonLd);
      if (!soft) {
        const first = !document.documentElement.classList.contains('is-ready');
        window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
        const h1 = outlet.querySelector('h1');
        if (!first && h1 && document.activeElement !== document.getElementById('sheet-title')) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      }
      markPlaying();
      refreshInstallButtons();
    }
  });
  ctx.router = router;

  // Global delegated actions
  document.addEventListener('click', (e) => {
    const t = e.target;
    const playUid = t.closest('[data-play-uid]');
    if (playUid) {
      const list = contexts.get(playUid.dataset.context) || data.tracks;
      const track = data.byUid.get(playUid.dataset.playUid);
      if (player.state.track?.uid === track?.uid && player.activeAdapter?.caps.playPause) { player.toggle(); return; }
      const i = list.indexOf(track);
      player.playQueue(i >= 0 ? list : [track], Math.max(0, i), { autoplay: true });
      return;
    }
    const playRel = t.closest('[data-play-release]');
    if (playRel) { player.playQueue(contexts.get(`release:${playRel.dataset.playRelease}`) || [], 0, { autoplay: true }); return; }
    const playCtx = t.closest('[data-play-context]');
    if (playCtx) { player.playQueue(contexts.get(playCtx.dataset.playContext) || [], 0, { autoplay: true }); return; }
    if (t.closest('[data-action="listen-now"]')) { listenNow(); return; }
    const sh = t.closest('[data-share]');
    if (sh) { share(shareTarget(data, sh.dataset.share, sh.dataset.id)); }
  });
  // Broken artwork → default artwork
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || !img.hasAttribute('data-fallback')) return;
    if (img.hasAttribute('srcset')) { img.removeAttribute('srcset'); img.removeAttribute('sizes'); return; } // thumbnail missing → full size
    if (!img.src.endsWith(data.defaultArt)) {
      img.src = data.defaultArt;
    }
  }, true);

  window.__pw = { data, player, router }; // handy for debugging/tests
  await router.start();
  document.documentElement.classList.add('is-ready');
}

boot().catch((e) => { console.error(e); toast('Something went wrong loading the site.'); });
