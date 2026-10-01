/**
 * AUDIO adapter — native HTML5 <audio> for self-hosted files (track/release field `audioUrl`).
 * The only source where EVERYTHING is truly controllable: play/pause, seek, progress, volume,
 * and lock-screen / notification controls via the Media Session API (Android, desktop Chrome).
 */
export function createAudioAdapter({ onState, onEnded, onError }) {
  const audio = new Audio();
  audio.preload = 'metadata';
  const emit = () => onState({ playing: !audio.paused, position: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
  ['play', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'seeked'].forEach((ev) => audio.addEventListener(ev, emit));
  audio.addEventListener('ended', () => onEnded());
  audio.addEventListener('error', () => onError(new Error('This audio file could not be played.')));

  return {
    name: 'audio',
    caps: { playPause: true, seek: true, progress: true, volume: true, mediaSession: true },
    async load(track, { autoplay }) {
      audio.src = track.sources.audio;
      if (autoplay) {
        try { await audio.play(); } catch (e) { if (e.name !== 'AbortError') onError(e); }
      }
    },
    play: () => audio.play().catch(onError),
    pause: () => audio.pause(),
    toggle: () => (audio.paused ? audio.play().catch(onError) : audio.pause()),
    seek: (s) => { audio.currentTime = s; },
    setVolume: (v) => { audio.volume = v; },
    unload() { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  };
}
