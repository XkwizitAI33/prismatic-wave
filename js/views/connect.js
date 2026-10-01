import { html, raw, toast } from '../util.js';
import { sectionHead, platformButtons, shareIcon, picture } from './components.js';
import { resolveLinks, svgIcon } from '../platforms.js';

export function connectView(ctx) {
  const { data } = ctx;
  const { site } = data;
  const c = site.contact || {};
  const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email || '') ? c.email : null;
  const pendingStream = resolveLinks(site.platforms || {}, { includePending: true }).filter((l) => l.pending).map((l) => l.platform.name);
  const pendingSocial = resolveLinks(site.socials || {}, { includePending: true }).filter((l) => l.pending).map((l) => l.platform.name);
  const socials = resolveLinks(site.socials || {});

  return {
    title: 'Connect',
    description: `Follow and contact ${site.artist?.name}: streaming platforms, socials and business enquiries.`,
    render(el) {
      el.innerHTML = html`
      <section class="page-hero">
        <p class="kicker">Connect</p>
        <h1 class="page-title" tabindex="-1">Follow, share, get in touch</h1>
        <p class="lede">Find ${site.artist?.name} on your platform, share the music, or contact the studio.</p>
      </section>

      <section class="section" aria-labelledby="stream-title">
        ${sectionHead('Listen', html`<span id="stream-title">Streaming</span>`)}
        <div class="where__grid">${platformButtons(site.platforms, { cls: 'ptile' })}</div>
        ${pendingStream.length ? html`<p class="pending-note"><span class="dot" aria-hidden="true"></span>Coming soon: ${pendingStream.join(', ')}</p>` : ''}
      </section>

      <section class="section" aria-labelledby="social-title">
        ${sectionHead('Follow', html`<span id="social-title">Socials &amp; community</span>`)}
        ${socials.length ? html`<div class="where__grid">${platformButtons(site.socials, { cls: 'ptile', labelPrefix: 'Follow on' })}</div>` : ''}
        ${pendingSocial.length ? html`<p class="pending-note"><span class="dot" aria-hidden="true"></span>Social links coming soon: ${pendingSocial.join(', ')}</p>` : ''}
      </section>

      ${site.gallery?.images?.length ? html`<section class="section" aria-labelledby="gallery-title">
        ${sectionHead(site.artist?.company?.name || 'AHMP', html`<span id="gallery-title">${site.gallery.title || 'Gallery'}</span>`)}
        <ul class="gallery">${site.gallery.images.map((g) => html`<li class="gallery__item">${picture(g, { cls: 'gallery__img', sizes: '(min-width: 900px) 30vw, 80vw' })}</li>`)}</ul>
      </section>` : ''}

      <section class="section contact-grid">
        <article class="contact glass" aria-labelledby="contact-title">
          <p class="kicker">Contact ${c.emailConfirmed ? '' : html`<span class="badge badge--placeholder" title="Placeholder: confirm this is the right public contact">To be confirmed</span>`}</p>
          <h2 class="section-title" id="contact-title">Business enquiries</h2>
          <p>${c.note || ''}</p>
          ${email ? html`
            <div class="btn-row">
              <a class="btn btn--prism" href="mailto:${email}?subject=${encodeURIComponent(c.subject || 'Enquiry')}">${raw(svgIcon('email'))}<span>Email ${site.artist?.company?.short || ''}</span></a>
              <button class="btn btn--ghost" type="button" data-copy="${email}">Copy address</button>
            </div>
            <p class="muted small">${email}</p>` : html`<p class="pending-note"><span class="dot" aria-hidden="true"></span>Contact email coming soon.</p>`}
        </article>
        <article class="contact glass" aria-labelledby="share-title">
          <p class="kicker">Spread the wave</p>
          <h2 class="section-title" id="share-title">Share ${site.artist?.name}</h2>
          <p>Send the music to a friend, or post it to your story.</p>
          <div class="btn-row">
            <button class="btn btn--glass" type="button" data-share="artist">${raw(shareIcon)}<span>Share the artist</span></button>
            <button class="btn btn--ghost" type="button" data-install hidden>Install the app</button>
          </div>
        </article>
      </section>`.s;
      el.querySelector('[data-copy]')?.addEventListener('click', async (e) => {
        try { await navigator.clipboard.writeText(e.currentTarget.dataset.copy); toast('Email address copied'); }
        catch { window.prompt('Copy the email address:', e.currentTarget.dataset.copy); }
      });
      ctx.refreshInstall?.();
    }
  };
}
