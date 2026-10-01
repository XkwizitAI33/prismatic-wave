/**
 * Hero "nanotech network": drifting nodes linked by prismatic traces, drawn on a small canvas.
 * Lightweight by design: ≤ 60 nodes, DPR capped at 1.5, ~30fps, pauses when the hero is offscreen or the
 * tab is hidden, and renders a single still frame when the visitor prefers reduced motion.
 */
import { prefersReducedMotion } from '../util.js';

const HUES = [186, 262, 316]; // cyan, violet, magenta

export function mountHeroFx(canvas, observeEl) {
  if (!canvas || !canvas.getContext) return () => {};
  const ctx = canvas.getContext('2d', { alpha: true });
  const reduced = prefersReducedMotion();
  let w = 0, h = 0, dpr = 1, nodes = [], raf = 0, visible = true, last = 0, running = false;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(60, Math.max(24, (w * h) / 16000)));
    nodes = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      hue: HUES[i % 3], r: Math.random() * 1.6 + 0.6
    }));
    draw(0);
  }

  function draw(dt) {
    ctx.clearRect(0, 0, w, h);
    const link = Math.min(150, w / 5);
    for (const n of nodes) {
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < link * link) {
          const o = 1 - Math.sqrt(d2) / link;
          ctx.strokeStyle = `hsla(${a.hue}, 100%, 65%, ${o * 0.28})`;
          ctx.beginPath();
          // circuit-style elbow instead of a straight line
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    for (const n of nodes) {
      ctx.fillStyle = `hsla(${n.hue}, 100%, 70%, 0.85)`;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(64, t - last) / 16.7 : 1;
    if (t - last < 33) return; // ~30fps is plenty for ambience
    last = t;
    draw(dt);
  }
  function start() { if (!running && !reduced && visible && !document.hidden) { running = true; last = 0; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  resize();
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
  io.observe(observeEl || canvas);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);
  start();
  return () => { stop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
}
