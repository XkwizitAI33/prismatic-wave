import { html } from '../util.js';
export const notFoundView = () => ({
  title: 'Not found',
  description: 'This page does not exist.',
  render(el) {
    el.innerHTML = html`<section class="page-hero center"><p class="kicker">404</p><h1 class="page-title" tabindex="-1">Lost in the waveform</h1><p class="lede">That page doesn't exist.</p><p><a class="btn btn--prism" href="#/">Back home</a></p></section>`.s;
  }
});
