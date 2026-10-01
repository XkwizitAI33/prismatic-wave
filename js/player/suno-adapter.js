/**
 * SUNO adapter — official per-song embed iframe (https://suno.com/embed/<songId>).
 * Suno publishes NO JavaScript control API / postMessage protocol for its embed, so from the host page we
 * cannot press play, pause, seek, read progress or set volume. Honest behaviour:
 *   ✓ the Suno iframe becomes the active source inside the persistent player (survives navigation)
 *   ✓ track info + queue + next/previous (swapping the iframe to the next song)
 *   ✗ play/pause/seek/progress/volume from our controls — the listener uses the controls inside Suno's player
 * Removing/swapping the iframe is the only reliable way to stop Suno audio, so unload() removes it.
 */
import { iframe } from '../embeds.js';

export function createSunoAdapter({ host, onState }) {
  let frame = null;
  return {
    name: 'suno',
    caps: { playPause: false, seek: false, progress: false, volume: false },
    async load(track) {
      const src = `https://suno.com/embed/${track.sources.suno}`;
      const title = `Suno player: ${track.title}`;
      if (!frame || !frame.isConnected) {
        frame = iframe({ src, height: 240, title });
        frame.loading = 'eager';
        host.replaceChildren(frame);
      } else {
        frame.src = src;
        frame.title = title;
      }
      onState({ playing: null, position: 0, duration: track.duration || 0 });
    },
    play() {}, pause() {}, toggle() {}, seek() {}, setVolume() {},
    unload() { frame?.remove(); frame = null; }
  };
}
