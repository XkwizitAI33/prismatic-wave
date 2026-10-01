/**
 * Click-to-load embed facades: no third-party iframe (or its cookies/JS) loads until the visitor asks for it.
 * facade({ platform, value, title, artwork }) returns HTML; hydrateFacades(root) wires the buttons.
 */
import { getPlatform, svgIcon } from './platforms.js';
import { html, raw } from './util.js';

const svgIconFor = (platform) => svgIcon(platform === 'sunoProfile' ? 'suno' : platform);

export function facade({ platform, value, title, artwork, note }) {
  const p = getPlatform(platform);
  const e = p?.embed?.(value);
  if (!e) return pending(platform, title);
  return html`<div class="facade" data-embed-src="${e.src}" data-embed-height="${e.height}" data-embed-title="${e.title}: ${title}" data-platform="${platform}">
    ${artwork ? html`<img class="facade__art" src="${artwork}" alt="" loading="lazy" decoding="async" width="120" height="120">` : ''}
    <div class="facade__body">
      <p class="facade__kicker">${raw(svgIconFor(platform))}<span>${p.name} embed</span></p>
      <p class="facade__title">${title}</p>
      <button class="btn btn--glass facade__btn" type="button">Load ${p.name} player</button>
      <p class="facade__note">${note || `Loads content from ${new URL(e.src).host}. Nothing from ${p.name} loads until you tap.`}</p>
    </div>
  </div>`.s;
}

export function pending(platform, title) {
  const p = getPlatform(platform);
  return html`<div class="facade facade--pending" role="note">
    <div class="facade__body">
      <p class="facade__kicker">${raw(svgIconFor(platform))}<span>${p ? p.name : platform}</span></p>
      <p class="facade__title">${title || 'Player'} — link pending</p>
      <p class="facade__note">This player will appear here as soon as the link is added.</p>
    </div>
  </div>`.s;
}

export function iframe({ src, height, title }) {
  const f = document.createElement('iframe');
  f.src = src;
  f.title = title;
  f.height = String(height);
  f.width = '100%';
  f.loading = 'lazy';
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  // Third-party players need scripts + their own origin storage; popups so "open in app" links work.
  f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation');
  f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  f.className = 'embed-frame';
  return f;
}

export function hydrateFacades(root) {
  root.querySelectorAll('.facade[data-embed-src]').forEach((el) => {
    const btn = el.querySelector('.facade__btn');
    btn?.addEventListener('click', () => {
      const f = iframe({ src: el.dataset.embedSrc, height: el.dataset.embedHeight, title: el.dataset.embedTitle });
      const wrap = document.createElement('div');
      wrap.className = 'embed-wrap';
      wrap.appendChild(f);
      el.replaceWith(wrap);
      f.focus({ preventScroll: true });
    }, { once: true });
  });
}
