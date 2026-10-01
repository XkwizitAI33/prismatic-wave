import { html, raw, fmtDate } from '../util.js';
import { releaseCard, sectionHead, img, playIcon, arrowIcon, typeLabel, platformButtons, statsStrip, picture } from './components.js';
import { isSet, resolveLinks, platformUrl } from '../platforms.js';
import { mountHeroFx } from '../fx/background.js';

export function homeView(ctx) {
  const { data } = ctx;
  const { site, about, featured, releases, suno } = data;
  const a = site.artist || {};
  const others = releases.filter((r) => r !== featured).slice(0, 8);
  const listen = resolveLinks(site.platforms || {}, { kind: 'stream' });
  const pendingCount = resolveLinks(site.platforms || {}, { kind: 'stream', includePending: true }).filter((l) => l.pending).length;
  let cleanupFx = () => {};

  return {
    title: '',
    description: site.seo?.description,
    render(el) {
      el.innerHTML = html`
      <section class="hero" aria-labelledby="hero-title">
        <canvas class="hero__fx" aria-hidden="true"></canvas>
        <div class="hero__inner">
          <p class="kicker hero__kicker"><span class="pulse" aria-hidden="true"></span>${a.company?.name || ''} presents</p>
          <h1 id="hero-title" class="hero__title" data-text="${(a.name || 'Prismatic Wave').toUpperCase()}">${(a.name || 'Prismatic Wave').toUpperCase()}</h1>
          <p class="hero__subtitle">${a.tagline || 'Hybrid Music Producer'}</p>
          <p class="hero__line">${raw((a.supportingLine || '').split('×').map((s) => `<span>${s.trim().replace(/[<>&]/g, '')}</span>`).join('<b aria-hidden="true">×</b><span class="sr-only">,</span>'))}</p>
          <div class="hero__ctas">
            <button class="btn btn--prism btn--lg" type="button" data-action="listen-now">${raw(playIcon)}<span>Listen now</span></button>
            <a class="btn btn--glass btn--lg" href="#/music"><span>Explore the music</span>${raw(arrowIcon)}</a>
          </div>
          ${statsStrip(site, 'stats--hero')}
          ${listen.length ? html`<div class="hero__platforms" aria-label="Listen on">${platformButtons(site.platforms, { cls: 'chip-link' })}</div>` : ''}
        </div>
        ${site.brand?.heroImage ? html`<div class="hero__visual" aria-hidden="true">${picture(site.brand.heroImage, { cls: 'hero__img', sizes: '(min-width: 900px) 40vw, 100vw', eager: true, alt: '' })}</div>` : ''}
        <div class="hero__eq eq eq--hero" aria-hidden="true">${raw('<i></i>'.repeat(24))}</div>
      </section>

      ${featured ? html`
      <section class="section" aria-labelledby="latest-title">
        ${sectionHead('Latest release', html`<span id="latest-title">New from ${a.name}</span>`, html`<a class="link-more" href="#/discography">All releases ${raw(arrowIcon)}</a>`.s)}
        <article class="feature glass">
          <a class="feature__art" href="#/discography/${featured.id}" aria-label="${featured.title}, view details">${img(featured.artwork, '', 'feature__img', { eager: true })}</a>
          <div class="feature__body">
            <p class="rcard__meta"><span class="badge badge--type">${typeLabel(featured.type)}</span><span>${fmtDate(featured.date)}</span>${featured.genres.length ? html`<span>· ${featured.genres.join(', ')}</span>` : ''}</p>
            <h3 class="feature__title">${featured.title}</h3>
            <p class="feature__desc">${isSet(featured.description) ? featured.description : `${typeLabel(featured.type)} by ${a.name}${featured.tracks.length > 1 ? ` · ${featured.tracks.length} tracks` : ''}.`}</p>
            <div class="btn-row">
              <button class="btn btn--prism" type="button" data-play-release="${featured.id}">${raw(playIcon)}<span>Play</span></button>
              <a class="btn btn--ghost" href="#/discography/${featured.id}">Details</a>
              <button class="btn btn--ghost" type="button" data-share="release" data-id="${featured.id}">Share</button>
            </div>
          </div>
        </article>
        ${others.length ? html`<div class="rail" role="list" aria-label="More releases">${others.map((r) => html`<div role="listitem">${releaseCard(r)}</div>`)}</div>` : ''}
      </section>` : html`
      <section class="section"><div class="empty glass"><p class="kicker">Releases</p><h2>New music is on the way</h2><p>Releases will appear here as soon as they're added.</p></div></section>`}

      <section class="section teasers" aria-label="About the project">
        <article class="teaser glass">
          <p class="kicker">The process</p>
          <h2 class="teaser__title">${about.hybrid?.title || 'What is Hybrid Music Production?'}</h2>
          <p>${about.hybrid?.teaser || ''}</p>
          <ul class="formula" aria-label="The formula">
            ${(about.hybrid?.pillars || []).map((p, i) => html`<li style="--i:${i}"><span>${p.title}</span></li>`)}
          </ul>
          <a class="link-more" href="#/about">How it works ${raw(arrowIcon)}</a>
        </article>
        <article class="teaser teaser--ahmp glass">
          ${about.ahmp?.image ? html`<div class="teaser__bg" aria-hidden="true">${picture(about.ahmp.image, { cls: 'teaser__bgimg', sizes: '(min-width: 820px) 40vw, 90vw', alt: '' })}</div>` : ''}
          <p class="kicker">The studio</p>
          <h2 class="teaser__title">${about.ahmp?.title || 'What is AHMP?'}</h2>
          <div class="teaser__brand">
            <img class="teaser__logo" src="${site.brand?.ahmpLogo || 'assets/brand/logo-ahmp.svg'}" alt="${a.company?.short || 'AHMP'} logo" width="137" height="52" loading="lazy">
            ${about.ahmp?.tagline ? html`<p class="tagline">${about.ahmp.tagline}</p>` : ''}
          </div>
          <p>${about.ahmp?.teaser || ''}</p>
          <a class="link-more" href="#/about">Meet the producer ${raw(arrowIcon)}</a>
        </article>
      </section>

      ${suno.songs.length ? html`
      <section class="section" aria-labelledby="suno-title">
        <article class="lab glass">
          ${img(suno.playlist.artwork || data.defaultArt, '', 'lab__art', { w: 300, h: 300, sizes: '(min-width: 720px) 160px, 96px' })}
          <div class="lab__body">
            <p class="kicker">From the Suno lab</p>
            <h2 class="lab__title" id="suno-title">${suno.playlist.title || 'Suno catalogue'}</h2>
            <p>${suno.playlist.description || ''}${suno.playlist.songCount ? ` · ${suno.playlist.songCount} songs on Suno` : ''}</p>
            <div class="btn-row">
              <button class="btn btn--glass" type="button" data-play-context="suno">${raw(playIcon)}<span>Play Suno songs</span></button>
              ${platformUrl('suno', suno.playlist.url) ? html`<a class="btn btn--ghost" href="${platformUrl('suno', suno.playlist.url)}" target="_blank" rel="noopener noreferrer">Full playlist on Suno</a>` : ''}
            </div>
          </div>
        </article>
      </section>` : ''}

      <section class="section where" aria-labelledby="where-title">
        ${sectionHead('Where to listen', html`<span id="where-title">Stream Prismatic Wave</span>`)}
        <div class="where__grid">${platformButtons(site.platforms, { cls: 'ptile' })}</div>
        ${pendingCount ? html`<p class="pending-note"><span class="dot" aria-hidden="true"></span>More platforms coming soon.</p>` : ''}
      </section>`.s;
      cleanupFx = mountHeroFx(el.querySelector('.hero__fx'), el.querySelector('.hero'));
    },
    cleanup() { cleanupFx(); }
  };
}
