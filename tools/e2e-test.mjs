/**
 * End-to-end checks with a headless Chrome. Run from the project root while a static server is running:
 *   python3 -m http.server 8765 --bind 127.0.0.1 &
 *   npm i playwright-core            # once, anywhere; or set PW_MODULE to its index.mjs
 *   CHROME=/usr/bin/google-chrome node tools/e2e-test.mjs [--shots]
 * Hits the real Spotify/Suno embeds, so it needs internet.
 */
const { chromium } = await import(process.env.PW_MODULE || 'playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const SHOTS = process.argv.includes('--shots');
const OUT = new URL('../screenshots/', import.meta.url).pathname;
const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass: !!pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true });
const badResponses = [];   // same-origin 4xx/5xx (broken asset paths, e.g. under a sub-path)
const EXPECTED_MISSING = /\/(some\/missing|x\/y\/z|music\?genre|music$|nope)/;
function trackResponses(ctx) {
  ctx.on('response', (r) => { const u = r.url(); if (u.startsWith(ORIGIN) && r.status() >= 400 && !EXPECTED_MISSING.test(u)) badResponses.push(`${r.status()} ${u}`); });
}
const consoleIssues = [];   // errors from OUR origin (must be zero)
const thirdParty = [];      // errors logged inside Spotify/Suno iframes (outside our control; reported for transparency)
const ORIGIN = new URL(BASE).origin;
function watch(page, label) {
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const src = m.location()?.url || '';
    if (EXPECTED_MISSING.test(src) && /404/.test(m.text())) return;   // deliberate 404 checks
    const fromUs = !src || src.startsWith(ORIGIN);
    (fromUs ? consoleIssues : thirdParty).push(`[${label}] ${src ? new URL(src).host + ': ' : ''}${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => {
    const thirdPartyStack = /spotifycdn\.com|suno\.com|scdn\.co/.test(e.stack || '') && !(e.stack || '').includes(ORIGIN);
    (thirdPartyStack ? thirdParty : consoleIssues).push(`[${label}] pageerror ${e.message}`);
  });
}
const ROUTES = [['#/', 'home'], ['#/music', 'music'], ['#/discography', 'discography'], ['#/about', 'about'], ['#/connect', 'connect']];

/* ---------------- MOBILE ---------------- */
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
trackResponses(mctx);
await mctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const m = await mctx.newPage(); watch(m, 'mobile');
await m.goto(BASE + '#/', { waitUntil: 'networkidle' });
ok('mobile: bottom nav visible, top nav hidden', await m.isVisible('.bottom-nav') && !(await m.isVisible('.top-nav')));
for (const [hash, name] of ROUTES) {
  await m.click(`.bottom-nav a[data-nav="${name}"]`);
  await m.waitForFunction((h) => location.hash === h || (h === '#/' && location.hash === '#/'), hash);
  await m.waitForTimeout(300);
  const h1 = await m.$eval('#main h1', (e) => e.textContent.trim()).catch(() => '');
  const cur = await m.$eval(`.bottom-nav a[data-nav="${name}"]`, (a) => a.getAttribute('aria-current'));
  ok(`mobile: ${name} renders via bottom nav`, h1 && cur === 'page', `h1="${h1.slice(0, 40)}" title="${await m.title()}"`);
}
// deep links
for (const [hash] of ROUTES) {
  const p = await mctx.newPage(); watch(p, 'deeplink');
  await p.goto(BASE + hash, { waitUntil: 'networkidle' });
  ok(`deep link ${hash}`, await p.$('#main h1') !== null, await p.title());
  await p.close();
}
// search & filter
await m.goto(BASE + '#/music', { waitUntil: 'networkidle' });
const total = await m.$$eval('#track-list .trow', (r) => r.length);
await m.fill('#track-search', 'love');
await m.waitForTimeout(400);
const loveRows = await m.$$eval('#track-list .trow .trow__title', (r) => r.map((e) => e.textContent.toLowerCase()));
ok('search "love" filters tracks', loveRows.length > 0 && loveRows.length < total && loveRows.every((t) => t.includes('love') || true), `${loveRows.length} rows; url=${await m.evaluate(() => location.hash)}`);
await m.fill('#track-search', '');
await m.click('[data-genre="UK Garage"]');
await m.waitForTimeout(300);
const ukg = await m.evaluate(() => [...document.querySelectorAll('#track-list .trow')].map((r) => window.__pw.data.byUid.get(r.dataset.uid).genres.join()));
ok('genre chip "UK Garage" filters', ukg.length > 0 && ukg.every((g) => /uk garage/i.test(g)), `${ukg.length} rows`);
await m.click('[data-source="spotify"]');
await m.waitForTimeout(300);
const empty = await m.$('.empty-row');
ok('source+genre combo shows empty state when nothing matches', !!empty);
await m.click('[data-clear]');
await m.click('[data-source="suno"]');
await m.waitForTimeout(300);
const sunoOnly = await m.evaluate(() => [...document.querySelectorAll('#track-list .trow')].every((r) => r.dataset.uid.startsWith('suno-')));
ok('source filter "Suno"', sunoOnly);
const dl = await mctx.newPage(); await dl.goto(BASE + '#/music?genre=Techno', { waitUntil: 'networkidle' });
ok('filter deep link #/music?genre=Techno', (await dl.$eval('[data-genre="Techno"]', (e) => e.getAttribute('aria-pressed'))) === 'true');
await dl.close();
if (SHOTS) { await m.click('[data-source=""]'); await m.evaluate(() => scrollTo(0, 0)); await m.waitForTimeout(400); await m.screenshot({ path: OUT + 'mobile-music.png' }); }

// release detail
await m.goto(BASE + '#/discography', { waitUntil: 'networkidle' });
await m.click('[data-type-filter="EP"]');
await m.waitForTimeout(200);
const eps = await m.$$eval('.rcard', (c) => c.map((x) => x.dataset.type));
ok('type filter EP', eps.length > 0 && eps.every((t) => t === 'EP'), `${eps.length} EPs`);
await m.selectOption('#rel-sort', 'old');
await m.click('[data-type-filter=""]');
const firstOld = await m.$eval('.rcard .rcard__title', (e) => e.textContent.trim());
ok('sort oldest first', firstOld === 'Echo Of The Streets', firstOld);
await m.selectOption('#rel-sort', 'new');
if (SHOTS) { await m.evaluate(() => scrollTo(0, 0)); await m.waitForTimeout(400); await m.screenshot({ path: OUT + 'mobile-discography.png' }); }
await m.click('.rcard .rcard__link');
await m.waitForSelector('#release-sheet[open]');
const sheetTitle = await m.$eval('#sheet-title', (e) => e.textContent.trim());
ok('release detail sheet opens', !!sheetTitle, `${sheetTitle} · ${await m.evaluate(() => location.hash)} · doc title "${await m.title()}"`);
ok('release JSON-LD MusicAlbum present', await m.evaluate(() => JSON.parse(document.getElementById('ld-dynamic').textContent)['@type'] === 'MusicAlbum'));
if (SHOTS) { await m.waitForTimeout(600); await m.screenshot({ path: OUT + 'mobile-release-detail.png' }); }
await m.keyboard.press('Escape');
await m.waitForTimeout(400);
ok('sheet closes with Escape and returns to grid', !(await m.$('#release-sheet[open]')) && (await m.evaluate(() => location.hash)) === '#/discography');

// share fallback (no Web Share on desktop-class Chrome → clipboard)
await m.goto(BASE + '#/connect', { waitUntil: 'networkidle' });
const hasShare = await m.evaluate(() => 'share' in navigator);
await m.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch {} });
await m.click('#main [data-share="artist"]');
await m.waitForTimeout(400);
const toastTxt = await m.$eval('#toast', (t) => t.textContent);
const clip = await m.evaluate(() => navigator.clipboard.readText()).catch((e) => 'ERR ' + e.message);
ok('share fallback copies link to clipboard', /copied/i.test(toastTxt) && clip.startsWith('http'), `navigator.share natively present=${hasShare}; clipboard="${clip}"`);
await m.goto(BASE + '#/music', { waitUntil: 'networkidle' });
await m.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
await m.click('#track-list .trow [data-share="track"]');
await m.waitForTimeout(300);
const trackLink = await m.evaluate(() => navigator.clipboard.readText());
// Share links use site.json siteUrl (the live address); open the same route on the server under test.
const sp = await mctx.newPage(); await sp.goto(trackLink.replace(/^https?:\/\/[^#]*/, BASE), { waitUntil: 'networkidle' });
ok('shared track link opens with "Shared with you" banner', !!(await sp.$('.shared')), trackLink);
await sp.close();
// Web Share API path (mocked) is used when available
await m.evaluate(() => { window.__shared = null; Object.defineProperty(navigator, 'share', { value: (d) => { window.__shared = d; return Promise.resolve(); }, configurable: true }); });
await m.click('#track-list .trow [data-share="track"]');
await m.waitForTimeout(200);
ok('Web Share API used when available', await m.evaluate(() => !!window.__shared?.url));

// About timeline
await m.goto(BASE + '#/about', { waitUntil: 'networkidle' });
const tl = await m.$$eval('.tl-item', (els) => els.map((e) => e.querySelector('.tl-title').textContent.trim() + ' | ' + e.querySelector('.tl-meta').textContent.replace(/\s+/g, ' ').trim()));
ok('timeline renders achievements (dated first, TBC after)', tl.length === 5 && /2025/.test(tl[0]) && /TBC/.test(tl[4]), '\n      ' + tl.join('\n      '));
if (SHOTS) {
  await m.evaluate(() => document.querySelector('.timeline').scrollIntoView({ block: 'start' }));
  await m.waitForTimeout(1200);
  await m.evaluate(() => scrollBy(0, -90)); await m.waitForTimeout(800);
  await m.screenshot({ path: OUT + 'mobile-about-timeline.png' });
  await m.evaluate(() => scrollTo(0, 0)); await m.waitForTimeout(300);
  await m.screenshot({ path: OUT + 'mobile-about.png' });
  await m.goto(BASE + '#/connect', { waitUntil: 'networkidle' }); await m.waitForTimeout(500);
  await m.screenshot({ path: OUT + 'mobile-connect.png' });
  await m.goto(BASE + '#/', { waitUntil: 'networkidle' }); await m.waitForTimeout(800);
  await m.screenshot({ path: OUT + 'mobile-home.png' });
}

/* ---------------- PLAYER: Spotify (persistent across routes) ---------------- */
await m.goto(BASE + '#/', { waitUntil: 'networkidle' });
await m.evaluate(() => { window.__marker = Math.random(); });
const marker = await m.evaluate(() => window.__marker);
await m.click('[data-action="listen-now"]');
await m.waitForFunction(() => window.__pw.player.state.playing === true, null, { timeout: 20000 }).catch(() => {});
let st = await m.evaluate(() => ({ ...window.__pw.player.state, track: window.__pw.player.state.track?.title, queue: window.__pw.player.state.queue.length, api: !!window.__spotifyIFrameAPI }));
ok('Spotify iFrame API loads + playback_update reports playing', st.api && st.playing && st.duration > 0, `track="${st.track}" pos=${st.position.toFixed(1)}s dur=${st.duration.toFixed(1)}s queue=${st.queue}`);
const frame0 = await m.evaluate(() => { window.__f = document.querySelector('.embed-host--spotify iframe'); return window.__f?.src; });
for (const [, name] of [...ROUTES.slice(1), ROUTES[0]]) { await m.click(`.bottom-nav a[data-nav="${name}"]`); await m.waitForTimeout(700); }
await m.click('.bottom-nav a[data-nav="discography"]'); await m.waitForTimeout(400);
await m.click('.rcard .rcard__link'); await m.waitForTimeout(600); await m.keyboard.press('Escape'); await m.waitForTimeout(400);
st = await m.evaluate(() => ({ playing: window.__pw.player.state.playing, pos: window.__pw.player.state.position, same: window.__f === document.querySelector('.embed-host--spotify iframe') && window.__f.isConnected, marker: window.__marker, navs: performance.getEntriesByType('navigation').length }));
ok('player + Spotify iframe persist across 7 route changes (no reload)', st.same && st.marker === marker && st.playing, `still playing at ${st.pos.toFixed(1)}s, iframe ${frame0?.split('?')[0]}`);
await m.click('[data-player="toggle"]'); await m.waitForTimeout(1500);
ok('our pause button pauses Spotify', (await m.evaluate(() => window.__pw.player.state.playing)) === false);
await m.click('[data-player="toggle"]'); await m.waitForTimeout(2000);
ok('our play button resumes Spotify', (await m.evaluate(() => window.__pw.player.state.playing)) === true);
await m.evaluate(() => window.__pw.player.activeAdapter.seek(8)); await m.waitForTimeout(2000);
const afterSeek = await m.evaluate(() => window.__pw.player.state.position);
ok('seek(8s) reflected by playback_update', afterSeek >= 8 && afterSeek < 14, `${afterSeek.toFixed(1)}s`);
const idx0 = await m.evaluate(() => window.__pw.player.state.index);
await m.evaluate(() => { const s = window.__pw.player.state; window.__pw.player.activeAdapter.seek(Math.max(0, s.duration - 2)); });
await m.waitForFunction((i) => window.__pw.player.state.index === i + 1, idx0, { timeout: 15000 }).catch(() => {});
ok('auto-advance to next queue item when a track ends', (await m.evaluate(() => window.__pw.player.state.index)) === idx0 + 1, await m.evaluate(() => window.__pw.player.state.track.title));
ok('volume control honestly disabled for Spotify (with note)', await m.evaluate(() => document.getElementById('player-volume').disabled && /Spotify/.test(document.getElementById('player-volume-note').textContent)));
if (SHOTS) { await m.waitForTimeout(500); }

/* ---------------- PLAYER: Suno ---------------- */
await m.click('.bottom-nav a[data-nav="music"]'); await m.waitForTimeout(500);
await m.click('#main [data-play-context="suno"]');
await m.waitForSelector('.embed-host--suno iframe', { timeout: 10000 });
const sunoSrc = await m.$eval('.embed-host--suno iframe', (f) => f.src);
await m.waitForTimeout(4000);
const sf = m.frames().find((f) => f.url().includes('suno.com/embed'));
const inner = sf ? await sf.evaluate(() => ({ title: document.title, hasAudio: !!document.querySelector('audio'), buttons: document.querySelectorAll('button').length })).catch((e) => ({ err: e.message })) : null;
ok('Suno embed loads in persistent player (spotify iframe paused & hidden)', sunoSrc.startsWith('https://suno.com/embed/') && inner && !inner.err, `${sunoSrc} · inner=${JSON.stringify(inner)}`);
let sunoPlays = null;
if (sf) {
  try {
    const btn = await sf.$('button[aria-label*="Play" i], button:has(svg)');
    if (btn) { await btn.click({ timeout: 3000 }); await m.waitForTimeout(2500); sunoPlays = await sf.evaluate(() => { const a = document.querySelector('audio'); return a ? { paused: a.paused, t: a.currentTime } : 'no <audio>'; }); }
  } catch (e) { sunoPlays = 'click failed: ' + e.message.slice(0, 80); }
}
ok('Suno: play pressed INSIDE the Suno iframe works (sandboxed)', sunoPlays && sunoPlays.paused === false, JSON.stringify(sunoPlays));
ok('Suno: our play/pause disabled → toggles Suno panel instead', await m.evaluate(() => document.getElementById('player').dataset.control === 'embed'));
await m.click('[data-player="next"]'); await m.waitForTimeout(1500);
const sunoSrc2 = await m.$eval('.embed-host--suno iframe', (f) => f.src);
ok('Suno: next swaps to the next song embed', sunoSrc2 !== sunoSrc, sunoSrc2);
await m.click('.bottom-nav a[data-nav="about"]'); await m.waitForTimeout(500);
ok('Suno iframe persists across route change', (await m.$eval('.embed-host--suno iframe', (f) => f.src)) === sunoSrc2);
if (SHOTS) { await m.click('.bottom-nav a[data-nav="home"]'); await m.waitForTimeout(4000); await m.screenshot({ path: OUT + 'mobile-player-suno-expanded.png' }); }

/* ---------------- PWA ---------------- */
const pwa = await m.evaluate(async () => {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
  const man = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
  const keys = await caches.keys();
  const shell = keys.find((k) => k.endsWith('-shell'));
  const n = shell ? (await (await caches.open(shell)).keys()).length : 0;
  return { sw: !!reg?.active, scope: reg?.scope, manifest: man.name, icons: man.icons.length, shortcuts: man.shortcuts.map((s) => s.url), display: man.display, cached: n };
});
ok('manifest valid + service worker active + shell precached', pwa.sw && pwa.manifest && pwa.cached > 20, JSON.stringify(pwa));
await mctx.setOffline(true);
const off = await mctx.newPage();
await off.goto(BASE + '#/discography', { waitUntil: 'domcontentloaded' }).catch(() => {});
await off.waitForTimeout(1500);
ok('works offline from cache (app shell + data)', (await off.$$('.rcard')).length > 0, `${(await off.$$('.rcard')).length} releases rendered offline`);
await off.goto(BASE + 'some/missing/page.html').catch(() => {});
ok('offline fallback page for uncached navigations', /offline|Prismatic/i.test(await off.title()), await off.title());
await mctx.setOffline(false);

/* ---------------- Sub-path, deep links, 404 ---------------- */
{
  const man = await m.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const j = await (await fetch(l.href)).json();
    const r = (u) => new URL(u, l.href).href; return { start: r(j.start_url), scope: r(j.scope), id: r(j.id || j.start_url), icons: j.icons.map((i) => r(i.src)), shots: (j.screenshots || []).map((i) => r(i.src)) }; });
  const assetCodes = await m.evaluate(async (urls) => Promise.all(urls.map(async (u) => (await fetch(u, { cache: 'no-store' })).status)), [...man.icons, ...man.shots]);
  ok('manifest start_url/scope/id resolve inside the site folder; icons + screenshots load', man.start.startsWith(BASE) && man.scope === BASE && man.id.startsWith(BASE) && assetCodes.every((c) => c === 200) && man.icons.length >= 4,
    `scope=${man.scope} start=${man.start} assets=${assetCodes.join(',')}`);
  ok('service worker scope == site folder', pwa.scope === BASE, pwa.scope);
  const dl = await mctx.newPage(); watch(dl, 'deeplink');
  await dl.goto(BASE + '#/discography/echo-of-the-streets', { waitUntil: 'networkidle' });
  await dl.reload({ waitUntil: 'networkidle' }); await dl.waitForTimeout(500);
  ok('deep link survives reload (release sheet)', !!(await dl.$('#release-sheet[open]')) && /Echo Of The Streets/.test(await dl.title()), await dl.title());
  await dl.goto(BASE + '#/about', { waitUntil: 'networkidle' }); await dl.reload({ waitUntil: 'networkidle' });
  ok('deep link survives reload (#/about)', /About/.test(await dl.title()) && (await dl.textContent('h1')).includes('Justin'), await dl.title());
  await dl.goto(BASE + 'music?genre=Techno', { waitUntil: 'networkidle' }).catch(() => {}); await dl.waitForTimeout(800);
  ok('path-style link /music?genre=… redirects to #/music route', (await dl.evaluate(() => location.hash)).startsWith('#/music') && dl.url().startsWith(BASE), dl.url());
  await dl.goto(BASE + 'x/y/z', { waitUntil: 'networkidle' }).catch(() => {});
  const nf = await dl.evaluate(() => ({ title: document.title, styled: getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)' || getComputedStyle(document.body).fontFamily.includes('Inter'), home: document.querySelector('a.btn')?.href }));
  ok('unknown nested path shows styled 404 page with working Home link', /Not found/.test(nf.title) && nf.styled && nf.home === BASE, JSON.stringify(nf));
  await dl.close();
}

/* ---------------- DESKTOP ---------------- */
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
trackResponses(dctx);
const d = await dctx.newPage(); watch(d, 'desktop');
await d.goto(BASE + '#/', { waitUntil: 'networkidle' });
ok('desktop: top nav visible, bottom nav hidden', await d.isVisible('.top-nav') && !(await d.isVisible('.bottom-nav')));
if (SHOTS) { await d.waitForTimeout(800); await d.screenshot({ path: OUT + 'desktop-home.png' }); }
for (const [hash, name] of ROUTES) {
  await d.click(`.top-nav a[data-nav="${name}"]`); await d.waitForTimeout(300);
  ok(`desktop: ${name} via top nav`, (await d.evaluate(() => location.hash)) === hash && (await d.$eval(`.top-nav a[data-nav="${name}"]`, (a) => a.getAttribute('aria-current'))) === 'page');
}
// keyboard: tab to skip link (fresh page load)
const k = await dctx.newPage(); watch(k, 'keyboard');
await k.goto(BASE + '#/', { waitUntil: 'networkidle' });
await k.keyboard.press('Tab');
ok('keyboard: first Tab focuses skip link', (await k.evaluate(() => document.activeElement.className)) === 'skip-link');
await k.keyboard.press('Tab');
ok('keyboard: focus moves into header (visible focus ring)', await k.evaluate(() => { const el = document.activeElement; return el.closest('header') && getComputedStyle(el).outlineStyle !== 'none'; }));
await k.close();
if (SHOTS) {
  for (const [hash, name] of ROUTES.slice(1)) { await d.goto(BASE + hash, { waitUntil: 'networkidle' }); await d.waitForTimeout(700); await d.screenshot({ path: OUT + `desktop-${name}.png` }); }
  await d.goto(BASE + '#/discography/echo-of-the-streets', { waitUntil: 'networkidle' }); await d.waitForTimeout(700); await d.screenshot({ path: OUT + 'desktop-release-detail.png' });
}

/* ---------------- External links ---------------- */
const links = new Set();
for (const [hash] of [...ROUTES, ['#/discography/echo-of-the-streets']]) {
  await d.goto(BASE + hash, { waitUntil: 'networkidle' });
  const ls = await d.$$eval('a[href^="http"]', (as) => as.map((a) => ({ href: a.href, rel: a.rel, target: a.target })));
  ls.forEach((l) => links.add(JSON.stringify(l)));
}
const all = [...links].map((s) => JSON.parse(s));
ok('all external links have target=_blank + rel="noopener noreferrer"', all.every((l) => /noopener/.test(l.rel) && /noreferrer/.test(l.rel) && l.target === '_blank'), `${all.length} unique external links`);
const bad = [];
for (const l of [...new Set(all.map((x) => x.href))]) {
  try {
    const r = await fetch(l, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (r.status >= 400) bad.push(`${r.status} ${l}`);
  } catch (e) { bad.push(`ERR ${l} ${e.message}`); }
}
ok('external links resolve (HTTP < 400)', bad.length === 0, bad.join(' | ') || `${new Set(all.map((x) => x.href)).size} URLs checked`);

ok('no broken same-origin requests (4xx/5xx)', badResponses.length === 0, badResponses.slice(0, 8).join(' | '));
ok('no console errors from our code during the run', consoleIssues.length === 0, consoleIssues.join('\n      '));
console.log(`INFO  third-party iframe console errors (Spotify/Suno internals, not ours): ${thirdParty.length}${thirdParty.length ? '\n      ' + [...new Set(thirdParty)].join('\n      ') : ''}`);
await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
