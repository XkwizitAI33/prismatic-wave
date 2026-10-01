/** Small shared helpers (no dependencies). */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Tagged template that escapes interpolations unless wrapped with raw() */
const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: true, s: String(s ?? '') });
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (Array.isArray(v)) out += v.map((x) => (x && x[RAW] ? x.s : esc(x))).join('');
      else if (v && v[RAW]) out += v.s;
      else if (v === false || v == null) out += '';
      else out += esc(v);
    }
  });
  return raw(out);
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
export function parseDuration(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  return String(str).split(':').reduce((acc, p) => acc * 60 + (parseInt(p, 10) || 0), 0);
}
export function isoDuration(sec) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `PT${m}M${s}S`;
}
export function fmtDate(iso, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!iso) return '';
  const parts = String(iso).split('-').map(Number);
  if (parts.length === 1) return String(parts[0]);
  const d = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1));
  if (parts.length === 2) return d.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', timeZone: 'UTC' });
  return d.toLocaleDateString('en-ZA', { ...opts, timeZone: 'UTC' });
}
export const slug = (s) => String(s).normalize('NFKD').replace(/[\u0300-\u036f']/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const norm = (s) => String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let toastTimer;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), ms);
}

/** Render an external link with safe rel/target attributes. */
export const extLink = (href, inner, cls = '', label = '') =>
  html`<a class="${cls}" href="${href}" target="_blank" rel="noopener noreferrer"${label ? raw(` aria-label="${esc(label)}"`) : ''}>${inner}</a>`;
