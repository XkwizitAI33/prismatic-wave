/**
 * Persistent player — a source-adapter pattern: audio | spotify | suno.
 * The controller owns the queue and the UI; each adapter declares honest capabilities (caps) and the UI only
 * enables controls the active source really supports. The player element lives outside the router outlet,
 * so route changes never reload it or its iframes.
 */
import { createAudioAdapter } from './audio-adapter.js';
import { createSpotifyAdapter } from './spotify-adapter.js';
import { createSunoAdapter } from './suno-adapter.js';
import { $, fmtTime, esc, toast } from '../util.js';

const NOTES = {
  spotify: 'Playing through the official Spotify player. Not logged in to Spotify in this browser? Spotify then plays 30-second previews. Volume: use your device; Spotify’s embed doesn’t let websites change it.',
  suno: 'Suno’s player has no remote-control API, so press ▶ inside the Suno player below. Previous/next here switch songs.',
  spotifyFallback: 'Spotify’s remote-control script isn’t available here (blocked or offline), so this is the plain Spotify player: press ▶ inside it. Previous/next here switch tracks.',
  audio: 'Self-hosted audio: full controls, including lock-screen controls on Android.'
};
const VOLUME_NOTES = {
  spotify: 'Volume isn’t available for Spotify. Its embed doesn’t let websites change volume, so use your device volume.',
  suno: 'Volume isn’t available for Suno. Use the Suno player or your device volume.',
  none: 'Volume is available for self-hosted audio. For Spotify and Suno, use your device volume.'
};

export function createPlayer({ priority = ['audio', 'spotify', 'suno'], onIdlePlay, defaultArt, spotifyIframeApi = true }) {
  const root = $('#player');
  const el = {
    panel: $('#player-panel'), note: $('#player-note'), embed: $('#player-embed'), queue: $('#player-queue'),
    seek: $('#player-seek'), fill: $('#player-progress-fill'), art: $('#player-art'), title: $('#player-title'),
    artist: $('#player-artist'), source: $('#player-source'), time: $('#player-time'),
    volWrap: $('#player-volume-wrap'), vol: $('#player-volume'), volNote: $('#player-volume-note'),
    toggle: root.querySelector('[data-player="toggle"]'), prev: root.querySelector('[data-player="prev"]'),
    next: root.querySelector('[data-player="next"]'), expand: root.querySelector('[data-player="expand"]')
  };
  const hosts = {
    spotify: Object.assign(document.createElement('div'), { className: 'embed-host embed-host--spotify' }),
    suno: Object.assign(document.createElement('div'), { className: 'embed-host embed-host--suno' })
  };
  el.embed.append(hosts.spotify, hosts.suno);

  const state = { queue: [], index: -1, track: null, source: null, playing: false, position: 0, duration: 0, seeking: false, expanded: false };
  const adapters = {};
  let active = null;

  const cb = {
    onState: (s) => {
      if (s.playing !== undefined) state.playing = s.playing === true;
      if (Number.isFinite(s.position)) state.position = s.position;
      if (Number.isFinite(s.duration) && s.duration > 0) state.duration = s.duration;
      renderProgress(); renderPlaying();
    },
    onEnded: () => next({ auto: true }),
    onError: (e) => { console.warn('[player]', e); toast(e.message || 'Playback error'); },
    onNeedsGesture: () => {
      setExpanded(true);
      setNote('Your browser wants a tap inside the Spotify player to start audio. Tap ▶ in the player below; after that our controls work.');
    }
  };
  function adapter(name) {
    if (adapters[name]) return adapters[name];
    if (name === 'audio') adapters.audio = createAudioAdapter(cb);
    if (name === 'spotify') adapters.spotify = createSpotifyAdapter({ host: hosts.spotify, useApi: spotifyIframeApi, ...cb, onFallback: () => { renderMeta(); setExpanded(true); setNote(NOTES.spotifyFallback); renderPlaying(); } });
    if (name === 'suno') adapters.suno = createSunoAdapter({ host: hosts.suno, ...cb });
    return adapters[name];
  }
  const pickSource = (t) => priority.find((s) => t?.sources?.[s]) || null;

  /* ---------- UI ---------- */
  function setNote(text) { el.note.textContent = text || ''; }
  function setExpanded(v) {
    state.expanded = v;
    root.classList.toggle('is-expanded', v);
    el.expand.setAttribute('aria-expanded', String(v));
    if (v) el.panel.removeAttribute('inert'); else el.panel.setAttribute('inert', '');
  }
  function renderPlaying() {
    root.dataset.state = !state.track ? 'idle' : state.playing ? 'playing' : 'paused';
    document.body.classList.toggle('is-playing', state.playing);
    const caps = active?.caps || {};
    if (!state.track) el.toggle.setAttribute('aria-label', 'Listen now');
    else if (!caps.playPause) el.toggle.setAttribute('aria-label', state.expanded ? 'Hide Suno player' : 'Show Suno player (use its play button)');
    else el.toggle.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    document.dispatchEvent(new CustomEvent('player:change', { detail: { uid: state.track?.uid || null, playing: state.playing, source: state.source } }));
  }
  function renderProgress() {
    const caps = active?.caps || {};
    const d = state.duration || 0;
    const p = Math.min(state.position, d || 0);
    const ratio = d ? p / d : 0;
    el.fill.style.transform = `scaleX(${ratio})`;
    if (!state.seeking) el.seek.value = String(Math.round(ratio * 1000));
    el.seek.disabled = !caps.seek || !d;
    el.seek.setAttribute('aria-valuetext', `${fmtTime(p)} of ${fmtTime(d)}`);
    el.time.textContent = caps.progress && d ? `${fmtTime(p)} / ${fmtTime(d)}` : (state.track && d ? fmtTime(d) : '');
  }
  function renderMeta() {
    const t = state.track;
    el.title.textContent = t ? t.title : 'Nothing playing';
    el.artist.textContent = t ? `${t.artist} · ${t.releaseTitle}` : 'Press Listen now to start';
    el.art.src = t?.artwork || defaultArt;
    el.art.onerror = () => { el.art.onerror = null; el.art.src = defaultArt; };
    el.source.hidden = !state.source;
    el.source.textContent = state.source ? { spotify: 'Spotify', suno: 'Suno', audio: 'Audio' }[state.source] : '';
    root.dataset.source = state.source || 'none';
    root.dataset.control = !state.source ? 'none' : (active?.caps.playPause ? 'full' : 'embed');
    el.prev.disabled = !state.track || (state.index <= 0 && !(active?.caps.seek && state.position > 3));
    el.next.disabled = !state.track || state.index >= state.queue.length - 1;
    const caps = active?.caps || {};
    el.volWrap.dataset.supported = String(!!caps.volume);
    el.vol.disabled = !caps.volume;
    el.volNote.textContent = caps.volume ? '' : VOLUME_NOTES[state.source] || VOLUME_NOTES.none;
    el.volWrap.tabIndex = caps.volume ? -1 : 0;
    el.volWrap.setAttribute('aria-label', caps.volume ? 'Volume' : el.volNote.textContent);
    setNote(state.source ? (state.source === 'spotify' && !caps.playPause ? NOTES.spotifyFallback : NOTES[state.source]) : '');
  }
  function renderQueue() {
    el.queue.innerHTML = state.queue.map((t, i) => `<li><button type="button" class="q-item${i === state.index ? ' is-current' : ''}" data-q="${i}"${i === state.index ? ' aria-current="true"' : ''}>
      <span class="q-num">${i + 1}</span><span class="q-title">${esc(t.title)}</span><span class="q-src">${esc({ spotify: 'Spotify', suno: 'Suno', audio: 'Audio' }[pickSource(t)] || '')}</span></button></li>`).join('');
    el.queue.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' });
  }
  function mediaSession() {
    if (!('mediaSession' in navigator)) return;
    const t = state.track;
    if (!t || state.source !== 'audio') { navigator.mediaSession.metadata = null; return; }
    const art = new URL(t.artwork || defaultArt, location.href).href;
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.releaseTitle, artwork: [{ src: art, sizes: '600x600' }] });
    const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch { /* unsupported action */ } };
    set('play', () => active?.play()); set('pause', () => active?.pause());
    set('previoustrack', () => prev()); set('nexttrack', () => next());
    set('seekto', (e) => active?.seek(e.seekTime));
  }

  /* ---------- actions ---------- */
  async function loadIndex(i, { autoplay = true } = {}) {
    const t = state.queue[i];
    if (!t) return;
    const src = pickSource(t);
    if (!src) { toast('No playable source for this track yet.'); return; }
    if (active && active.name !== src) active.unload();
    state.index = i; state.track = t; state.source = src; state.position = 0; state.duration = t.duration || 0; state.playing = false;
    active = adapter(src);
    renderMeta(); renderProgress(); renderPlaying(); renderQueue();
    if (src === 'suno' || !active.caps.playPause) setExpanded(true);
    try {
      await active.load(t, { autoplay });
      if (src === 'audio') active.setVolume(Number(el.vol.value) / 100);
    } catch (e) {
      cb.onError(e);
      setExpanded(true);
      setNote(`${e.message} You can still open it directly on the platform.`);
    }
    mediaSession();
  }

  function playQueue(tracks, start = 0, opts) {
    const playable = tracks.filter(pickSource);
    if (!playable.length) { toast('Nothing playable here yet. Links are pending.'); return; }
    const startTrack = tracks[start];
    state.queue = playable;
    const idx = Math.max(0, playable.indexOf(startTrack));
    return loadIndex(idx, opts);
  }
  function next({ auto = false } = {}) {
    if (state.index < state.queue.length - 1) return loadIndex(state.index + 1, { autoplay: true });
    if (auto) { state.playing = false; renderPlaying(); }
  }
  function prev() {
    if (active?.caps.seek && state.position > 3) { active.seek(0); return; }
    if (state.index > 0) loadIndex(state.index - 1, { autoplay: true });
  }
  function toggle() {
    if (!state.track) { onIdlePlay?.(); return; }
    if (!active.caps.playPause) { setExpanded(!state.expanded); renderPlaying(); return; }
    active.toggle();
  }

  /* ---------- wiring ---------- */
  el.toggle.addEventListener('click', toggle);
  el.next.addEventListener('click', () => next());
  el.prev.addEventListener('click', prev);
  el.expand.addEventListener('click', () => setExpanded(!state.expanded));
  root.querySelector('[data-player="collapse"]').addEventListener('click', () => { setExpanded(false); el.expand.focus(); });
  el.queue.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) loadIndex(Number(b.dataset.q)); });
  el.seek.addEventListener('input', () => {
    state.seeking = true;
    const r = Number(el.seek.value) / 1000;
    el.fill.style.transform = `scaleX(${r})`;
    el.time.textContent = `${fmtTime(r * state.duration)} / ${fmtTime(state.duration)}`;
  });
  el.seek.addEventListener('change', () => {
    state.seeking = false;
    if (active?.caps.seek && state.duration) { const s = (Number(el.seek.value) / 1000) * state.duration; state.position = s; active.seek(s); }
  });
  const savedVol = Number(localStorage.getItem('pw-volume'));
  if (Number.isFinite(savedVol) && localStorage.getItem('pw-volume') !== null) el.vol.value = String(savedVol);
  el.vol.addEventListener('input', () => { active?.setVolume(Number(el.vol.value) / 100); localStorage.setItem('pw-volume', el.vol.value); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.expanded && !document.querySelector('dialog[open]')) setExpanded(false);
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (!typing && e.code === 'Space' && state.track && active?.caps.playPause && !e.target.closest('button,a')) { e.preventDefault(); active.toggle(); }
  });

  renderMeta(); renderProgress(); renderPlaying();
  return {
    playQueue, next, prev, toggle, setExpanded, pickSource,
    get state() { return state; },
    get activeAdapter() { return active; },
    adapters
  };
}
