import { html, raw, fmtDate, prefersReducedMotion } from '../util.js';
import { sectionHead, img, extIcon, arrowIcon, statsStrip, picture } from './components.js';
import { isSet } from '../platforms.js';

/** Sort key that tolerates YYYY, YYYY-MM, YYYY-MM-DD and empty (empty sorts last). */
const dateKey = (d) => (isSet(d) && /^\d{4}/.test(d) ? String(d).padEnd(10, '-00') : '9999');
const safeLink = (l) => (isSet(l) && (/^https:\/\//.test(l) || /^#\//.test(l)) ? l : null);

export function timelineHtml(achievements = [], { showPlaceholders = true } = {}) {
  const items = achievements
    .filter((a) => a && isSet(a.title) || a?.placeholder)
    .filter((a) => showPlaceholders || !a.placeholder)
    .map((a, i) => ({ ...a, _i: i }))
    // dated entries chronologically; undated ("Date TBC") entries after them, in the order they are listed
    .sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)) || a._i - b._i);
  if (!items.length) {
    return html`<div class="timeline-empty glass">
      <div class="timeline-empty__orb" aria-hidden="true"></div>
      <p class="kicker">Achievements &amp; accolades</p>
      <h3>The story is being written</h3>
      <p>Verified milestones, releases and recognition will appear here on a timeline.</p>
    </div>`;
  }
  return html`<ol class="timeline">
    ${items.map((a, i) => html`<li class="tl-item${a.placeholder ? ' tl-item--placeholder' : ''}${isSet(a.date) ? '' : ' tl-item--tbc'}" style="--i:${i}">
      <span class="tl-node" aria-hidden="true"></span>
      <article class="tl-card glass">
        <p class="tl-meta">
          ${isSet(a.date) && /^\d{4}/.test(a.date) ? html`<time datetime="${a.date}">${fmtDate(a.date)}</time>` : html`<span class="tl-tbc">Date TBC</span>`}
          ${isSet(a.category) ? html`<span class="badge ${a.placeholder ? 'badge--placeholder' : 'badge--type'}">${a.category}</span>` : ''}
          ${a.confirmed === false ? html`<span class="badge badge--placeholder" title="Details still to be confirmed">To be confirmed</span>` : ''}
        </p>
        <h3 class="tl-title">${a.title}</h3>
        ${isSet(a.description) ? html`<p>${a.description}</p>` : ''}
        ${isSet(a.image) ? img(a.image, a.imageAlt || '', 'tl-img', { w: 640, h: 360 }) : ''}
        ${safeLink(a.link) ? (a.link.startsWith('#')
          ? html`<a class="link-more" href="${a.link}">${a.linkLabel || 'Explore'} ${raw(arrowIcon)}</a>`
          : html`<a class="link-more" href="${a.link}" target="_blank" rel="noopener noreferrer">${a.linkLabel || 'Read more'} ${raw(extIcon)}</a>`) : ''}
      </article>
    </li>`)}
  </ol>`;
}

export function aboutView(ctx) {
  const { data } = ctx;
  const { about, site } = data;
  const draft = String(about.bio?.status || '').toUpperCase() === 'DRAFT';
  let io;
  return {
    title: 'About',
    description: `${about.heading || 'About'}. ${about.role || ''} What Hybrid Music Production is, what AHMP is, and achievements.`,
    render(el) {
      el.innerHTML = html`
      <section class="page-hero about-hero">
        <figure class="about-hero__photo">
          ${about.photo && (typeof about.photo === 'object' || isSet(about.photo)) ? picture(about.photo, { cls: 'about-photo', sizes: '(min-width: 900px) 55vw, 100vw', eager: true })
            : html`<div class="photo-pending" role="img" aria-label="Artist photo coming soon"><img src="${site.brand?.mark || 'assets/brand/logo-mark.svg'}" alt="" width="96" height="96"><span>Photo coming soon</span></div>`}
        </figure>
        <div class="about-hero__text">
          <p class="kicker">About</p>
          <h1 class="page-title" tabindex="-1">${about.heading || ''}</h1>
          <p class="lede">${about.role || ''}</p>
          ${statsStrip(site)}
        </div>
      </section>

      <section class="section prose glass" aria-labelledby="bio-title">
        <header class="section-head"><p class="kicker">Biography ${draft ? html`<span class="badge badge--placeholder" title="Draft: Justin to expand">Draft</span>` : ''}</p><h2 class="section-title" id="bio-title">The artist behind ${site.artist?.name}</h2></header>
        ${(about.bio?.paragraphs || []).filter(isSet).map((p) => html`<p>${p}</p>`)}
      </section>

      <section class="section" aria-labelledby="hybrid-title">
        ${sectionHead('The process', html`<span id="hybrid-title">${about.hybrid?.title || ''}</span>`)}
        <div class="split">
          <div class="prose">${(about.hybrid?.paragraphs || []).map((p) => html`<p>${p}</p>`)}
            ${about.hybrid?.image ? html`<figure class="poster poster--gold">${picture(about.hybrid.image, { cls: 'poster__img', sizes: '(min-width: 980px) 30vw, 80vw' })}</figure>` : ''}
          </div>
          <ol class="pillars">
            ${(about.hybrid?.pillars || []).map((p, i) => html`<li class="pillar glass reveal" style="--i:${i}"><span class="pillar__n">0${i + 1}</span><h3>${p.title}</h3><p>${p.text}</p></li>`)}
          </ol>
        </div>
      </section>

      <section class="section ahmp glass" aria-labelledby="ahmp-title">
        ${about.ahmp?.image ? html`<figure class="poster poster--blue">${picture(about.ahmp.image, { cls: 'poster__img', sizes: '(min-width: 820px) 34vw, 90vw' })}</figure>` : ''}
        <div class="prose">
          <img class="ahmp__logo" src="${about.ahmp?.mark || site.brand?.ahmpLogo || 'assets/brand/logo-ahmp.svg'}" alt="${site.artist?.company?.name || 'AHMP'} logo" width="137" height="52" loading="lazy">
          <h2 class="section-title" id="ahmp-title">${about.ahmp?.title || ''}</h2>
          ${about.ahmp?.tagline ? html`<p class="tagline tagline--lg">${about.ahmp.tagline}</p>` : ''}
          ${(about.ahmp?.paragraphs || []).filter(isSet).map((p) => html`<p>${p}</p>`)}
        </div>
      </section>

      <section class="section" aria-labelledby="tl-title">
        ${sectionHead('Milestones', html`<span id="tl-title">Achievements &amp; Accolades</span>`)}
        ${timelineHtml(about.achievements, { showPlaceholders: about.showPlaceholders !== false })}
      </section>`.s;

      const targets = el.querySelectorAll('.tl-item, .reveal');
      if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
        targets.forEach((t) => t.classList.add('is-in'));
      } else {
        el.classList.add('js-reveal');
        io = new IntersectionObserver((entries) => entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
        }), { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
        targets.forEach((t) => io.observe(t));
      }
    },
    cleanup() { io?.disconnect(); }
  };
}
