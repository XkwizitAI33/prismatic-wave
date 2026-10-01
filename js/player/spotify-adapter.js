/**
 * SPOTIFY adapter — official Spotify iFrame API (https://open.spotify.com/embed/iframe-api/v1).
 * What the API really supports, and therefore what we expose:
 *   ✓ loadUri / play / resume / pause / togglePlay / seek(seconds)
 *   ✓ 'playback_update' events → position, duration, isPaused, isBuffering (drives our progress bar)
 *   ✗ volume — the embed exposes no volume control to the host page, so the UI says so instead of faking it
 *   ✗ guaranteed autoplay — browsers (notably Safari/iOS) may require a tap inside the Spotify iframe
 *   ⓘ full-length playback needs the listener to be logged in to Spotify in that browser; otherwise Spotify
 *     plays its 30-second previews. That is Spotify's rule, not ours.
 * The iframe is created ONCE inside the persistent player and reused (loadUri) for every track.
 */
import { iframe } from '../embeds.js';

const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
let apiPromise = null;

export function loadSpotifyApi(timeout = 15000) {
  if (window.__spotifyIFrameAPI) return Promise.resolve(window.__spotifyIFrameAPI);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Spotify player timed out (blocked or offline?)')), timeout);
    window.onSpotifyIframeApiReady = (API) => { clearTimeout(timer); window.__spotifyIFrameAPI = API; resolve(API); };
    const s = document.createElement('script');
    s.src = API_SRC;
    s.async = true;
    s.onerror = () => { clearTimeout(timer); reject(new Error('Spotify player could not be loaded (offline or blocked).')); };
    document.head.appendChild(s);
  }).catch((e) => { apiPromise = null; throw e; });
  return apiPromise;
}

export function createSpotifyAdapter({ host, onState, onEnded, onNeedsGesture, onReady, onFallback, useApi = true }) {
  let controller = null;
  let fallbackFrame = null; // plain embed when the iFrame API is disabled or blocked (CSP, offline, ad-blockers)
  const caps = { playPause: true, seek: true, progress: true, volume: false };
  let creating = null;
  let wasPlaying = false;
  let endedFired = false;
  let gestureTimer = null;
  let isPlaying = false;
  let currentUri = '';

  function ensure(uri) {
    if (controller) return Promise.resolve(controller);
    if (creating) return creating;
    creating = loadSpotifyApi().then((API) => new Promise((resolve) => {
      const el = document.createElement('div');
      host.replaceChildren(el);
      API.createController(el, { uri, width: '100%', height: 152 }, (c) => {
        controller = c;
        let resolved = false;
        const done = () => { if (!resolved) { resolved = true; resolve(c); } };
        c.addListener('ready', () => { onReady?.(); done(); });
        c.addListener('playback_update', (e) => {
          const d = e.data || {};
          // Ignore late events from the previous track after loadUri() (only comparable for track URIs).
          if (d.playingURI && currentUri.startsWith('spotify:track:') && d.playingURI !== currentUri) return;
          const playing = !d.isPaused;
          isPlaying = playing;
          onState({ playing, position: (d.position || 0) / 1000, duration: (d.duration || 0) / 1000, buffering: !!d.isBuffering, uri: d.playingURI });
          const atEnd = d.duration > 0 && d.position >= d.duration - 300;
          if (playing && !d.isBuffering) { wasPlaying = true; clearTimeout(gestureTimer); }
          // End of track: the embed reports position === duration (isPaused can stay false), so test position.
          // endedFired is reset only by load(), so repeated end-of-track events can't skip several tracks.
          if (wasPlaying && atEnd && !endedFired) {
            endedFired = true; wasPlaying = false; isPlaying = false; onEnded();
          }
        });
        setTimeout(done, 5000); // never hang the UI if 'ready' is missed
      });
    }));
    return creating;
  }

  function loadFallback(track) {
    const [, type, id] = track.sources.spotify.split(':');
    const src = `https://open.spotify.com/embed/${type}/${id}`;
    if (!fallbackFrame) {
      fallbackFrame = iframe({ src, height: 152, title: `Spotify player: ${track.title}` });
      fallbackFrame.loading = 'eager';
      host.replaceChildren(fallbackFrame);
    } else { fallbackFrame.src = src; fallbackFrame.title = `Spotify player: ${track.title}`; }
    Object.assign(caps, { playPause: false, seek: false, progress: false });
    onState({ playing: null, position: 0, duration: track.duration || 0 });
  }

  return {
    name: 'spotify',
    caps,
    async load(track, { autoplay }) {
      wasPlaying = false; endedFired = false;
      const uri = track.sources.spotify;
      currentUri = uri;
      if (!useApi || fallbackFrame) { loadFallback(track); return; }
      const fresh = !controller;
      let c;
      try { c = await ensure(uri); }
      catch (e) { console.warn('[spotify] iFrame API unavailable, using plain embed:', e.message); loadFallback(track); onFallback?.(e); return; }
      if (!fresh) c.loadUri(uri);
      if (autoplay) {
        c.play();
        clearTimeout(gestureTimer);
        // If playback hasn't started shortly after, the browser most likely wants a tap inside the iframe.
        gestureTimer = setTimeout(() => { if (!wasPlaying) onNeedsGesture?.(); }, 3500);
      }
    },
    play: () => controller?.resume(),
    pause: () => controller?.pause(),
    toggle: () => controller?.togglePlay(),
    seek: (s) => controller?.seek(Math.max(0, Math.round(s))),
    setVolume: () => {},
    // Only pause if something is actually playing: pausing an ended/empty embed makes Spotify throw inside its iframe.
    unload: () => { clearTimeout(gestureTimer); if (isPlaying) { try { controller?.pause(); } catch { /* iframe gone */ } } isPlaying = false; },
    get controller() { return controller; }
  };
}
