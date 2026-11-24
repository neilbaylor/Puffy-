/**
 * Offline play: a few seconds after the start screen is up (never competing with the first load),
 * the offline helper (src/sw.js, a service worker) is set up. It keeps a copy of the game so it
 * starts and plays with no connection; with one, everything still comes from the server as before
 * (see sw.js). Then it's asked to fetch, in the background, the songs not saved yet (not when the
 * phone's data saver is on: those songs are then saved as they're played). Both only start while
 * the start screen is showing, not during a level (the helper's work is off the game's thread
 * anyway, but a level has the device to itself).
 *
 * Only in the real (built) game: not on the dev server, nor in the single-file build (which can't
 * have one), nor the Android/iOS app (its files are inside it already), nor a saved copy of the page. Anything going wrong here just means no offline copy.
 */
const ON = import.meta.env.PROD && import.meta.env.MODE !== 'single' && import.meta.env.MODE !== 'app';
/** How long after the start screen appears. */
const AFTER_MS = 3000;

/**
 * `fn`, as soon as the start screen is showing (now, or once it's back). (Its scene stops the moment
 * Play is tapped, while the start screen's buttons stay up as the level is got ready.)
 */
function onStartScreen(fn: () => void) {
  const menu = () => (window as unknown as { game?: { scene: { isActive(k: string): boolean } } }).game?.scene.isActive('Menu') ?? true;
  const check = () => (document.querySelector('#ui .screen.start') && menu() ? fn() : setTimeout(check, 2000));
  check();
}

async function setUp() {
  try {
    const had = !!navigator.serviceWorker.controller;
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    // a new version since last time? (the page and the game already are: this is the offline copy.
    // Asked every time, not left to the browser, which can put it off a long while; just a "304: no
    // change" from the server, usually)
    if (had) void reg.update().catch(() => {});
    await navigator.serviceWorker.ready;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    onStartScreen(() => (reg.active ?? navigator.serviceWorker.controller)?.postMessage('warm-music'));
  } catch {
    /* no offline copy: the game plays online just as before */
  }
}

if (ON && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const later = () => setTimeout(() => onStartScreen(() => void setUp()), AFTER_MS);
  // (the loading screen is up until the body loses its "booting" class: see BootScene)
  if (!document.body.classList.contains('booting')) later();
  else {
    const watch = new MutationObserver(() => {
      if (document.body.classList.contains('booting')) return;
      watch.disconnect();
      later();
    });
    watch.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
}

export {};
