/** Service worker registration + Android/desktop install prompt (beforeinstallprompt). */
import { toast } from './util.js';

let deferred = null;

export function refreshInstallButtons() {
  document.querySelectorAll('[data-install]').forEach((b) => { b.hidden = !deferred; });
}

export function initPwa() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) toast('Site updated: refresh for the latest version', 5000);
          });
        });
      }).catch((e) => console.warn('SW registration failed', e));
    });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    refreshInstallButtons();
  });
  window.addEventListener('appinstalled', () => { deferred = null; refreshInstallButtons(); toast('Installed. Find Prismatic Wave on your home screen'); });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-install]');
    if (!b || !deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    refreshInstallButtons();
  });
}
