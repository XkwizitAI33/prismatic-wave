/**
 * Hash router (#/path?query) — works on any static host, deep links and shares included.
 * Each route: { pattern: RegExp, name, view: async ({params, query, ctx}) => ({ title, description, render(el) , cleanup? }) }
 */
import { $$ } from './util.js';

export function createRouter({ routes, outlet, onRoute }) {
  let current = null;
  let currentName = '';

  function parse() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs = ''] = h.split('?');
    return { path: path.replace(/\/+$/, '') || '/', query: Object.fromEntries(new URLSearchParams(qs)) };
  }

  async function resolve() {
    const { path, query } = parse();
    let match = null, params = {};
    for (const r of routes) {
      const m = path.match(r.pattern);
      if (m) { match = r; params = m.groups || {}; break; }
    }
    if (!match) match = routes.find((r) => r.name === 'notfound');
    const sameView = current && currentName === match.name && typeof current.update === 'function';
    if (sameView) {
      // Same view, different params (e.g. open release sheet / change filters): let the view update in place
      const meta = await current.update({ params, query });
      if (meta) onRoute?.({ name: match.name, ...meta, params, query, soft: true });
      return;
    }
    try { current?.cleanup?.(); } catch (e) { console.warn(e); }
    const view = await match.view({ params, query });
    currentName = match.name;
    current = view;
    outlet.innerHTML = '';
    view.render(outlet);
    // nav state
    const section = match.section || match.name;
    $$('[data-nav]').forEach((a) => {
      if (a.dataset.nav === section) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    onRoute?.({ name: match.name, ...view, params, query, soft: false });
  }

  window.addEventListener('hashchange', resolve);
  return {
    start: resolve,
    go: (hash) => { if (location.hash === hash) resolve(); else location.hash = hash; },
    /** Update the query string without creating a history entry or re-rendering */
    replaceQuery(query) {
      const { path } = parse();
      const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString();
      history.replaceState(history.state, '', `#${path}${qs ? '?' + qs : ''}`);
    }
  };
}
