/* Prismatic Wave service worker
 * - App shell precache (bump VERSION when you change any shell file so visitors get the update)
 * - data/*.json: network-first (fresh content), cached fallback offline
 * - images (own + Suno/Spotify artwork CDNs): stale-while-revalidate, capped
 * - navigations: network-first → cached index.html → offline.html
 * - NEVER touches third-party iframes/players or the Spotify iFrame API script
 */
const VERSION = 'pw-v1.2.1';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const IMAGES = `${VERSION}-images`;
const MAX_IMAGES = 160;

const SHELL_FILES = [
  './', 'index.html', 'offline.html', 'manifest.webmanifest', 'css/main.css',
  'js/app.js', 'js/util.js', 'js/data.js', 'js/router.js', 'js/platforms.js', 'js/seo.js', 'js/share.js', 'js/embeds.js',
  'js/search.js', 'js/pwa.js', 'js/fx/background.js',
  'js/player/player.js', 'js/player/audio-adapter.js', 'js/player/spotify-adapter.js', 'js/player/suno-adapter.js',
  'js/views/components.js', 'js/views/home.js', 'js/views/music.js', 'js/views/discography.js', 'js/views/about.js',
  'js/views/connect.js', 'js/views/notfound.js',
  'data/site.json', 'data/releases.json', 'data/about.json', 'data/suno.json',
  'assets/fonts/unbounded-latin-wght-normal.woff2', 'assets/fonts/inter-latin-wght-normal.woff2', 'assets/fonts/space-grotesk-latin-500-normal.woff2',
  'assets/brand/logo-prismatic-wave.svg', 'assets/brand/logo-mark.svg', 'assets/brand/logo-ahmp.svg', 'assets/brand/hero-bg.svg',
  'assets/brand/default-artwork.svg', 'assets/brand/ahmp-mark.webp', 'assets/icons/favicon.svg', 'assets/icons/icon-192.png'
];
const IMAGE_HOSTS = ['cdn2.suno.ai', 'i.scdn.co', 'image-cdn-ak.spotifycdn.com', 'image-cdn-fa.spotifycdn.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.destination === 'iframe' || req.destination === 'frame' || req.destination === 'audio' || req.destination === 'video') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Page navigations
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          // Only refresh the cached app shell from the real start page (never from 404s or other pages).
          const scopePath = new URL(self.registration.scope).pathname;
          if (res.ok && (url.pathname === scopePath || url.pathname === scopePath + 'index.html')) {
            const copy = res.clone(); caches.open(SHELL).then((c) => c.put('index.html', copy));
          }
          return res;
        })
        .catch(async () => {
          // Offline. At the start page serve the cached shell. Deeper paths (/repo/music, typos …) redirect to the
          // start page (relative asset URLs would break at another depth), keeping a matching view as #/route.
          const scope = self.registration.scope;
          const rest = url.pathname.startsWith(new URL(scope).pathname) ? url.pathname.slice(new URL(scope).pathname.length).replace(/\/+$/, '') : '';
          if (rest && rest !== 'index.html') {
            return Response.redirect(scope + (/^(music|discography|about|connect)(\/[a-z0-9-]+)?$/i.test(rest) ? '#/' + rest : ''), 302);
          }
          return (await caches.match('index.html')) || caches.match('offline.html');
        })
    );
    return;
  }

  // Images: own + whitelisted artwork CDNs
  if (req.destination === 'image' && (sameOrigin || IMAGE_HOSTS.includes(url.hostname))) {
    e.respondWith(
      caches.open(IMAGES).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trim(IMAGES, MAX_IMAGES); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  if (!sameOrigin) return; // everything else third-party: straight to network, never cached

  // Data: network-first
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); return res; })
        .catch(async () => (await caches.match(req, { ignoreSearch: true })) || new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // Shell/static: cache-first, then network (and cache)
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
