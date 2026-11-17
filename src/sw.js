/* eslint-disable */
/**
 * The offline helper (a service worker): lets the game start and play with no connection, from the
 * home-screen app or a browser tab that has been to the game before. It's only a fallback: with a
 * connection, the page always comes from the server (a quick "304: no change" when there's nothing
 * new), so a new version shows on the very next load.
 *
 * - The page: from the server; the copy kept here only when the server can't be reached (offline,
 *   or no answer within a few seconds).
 * - The game's code, styles, fonts and songs (/assets/: the name changes whenever the file does):
 *   kept here and used straight from here.
 * - Icons and the app manifest: from the server; the copy kept here when offline.
 * - The account server (/api/), the battle server and anything that isn't a plain download:
 *   never touched, always the network.
 *
 * Built into dist/sw.js by scripts/offline-plugin.ts, which fills in this build's list of files.
 * Not used by the dev server or the single-file build.
 */
const BUILD = self.__PUFFY_BUILD__;
const PREFIX = 'puffy-';
const CACHE = `${PREFIX}${BUILD.version}-${BUILD.id}`;
/** How long the page waits for the server before using the kept copy (a dead connection can hang). */
const PAGE_WAIT = 3500;

const abs = (f) => new URL(f, self.location.href).href;
const INDEX = abs('index.html');
const SHELL = BUILD.shell.map(abs);
const MUSIC = BUILD.music.map(abs);
const ASSETS = abs('assets/');
const API = abs('api/');
/** Icons and the manifest: files the server may change without changing their name. */
const PLAIN = new Set(SHELL.filter((u) => !u.startsWith(ASSETS)));

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// ─────────────────────────────────────────────────────────── installing ──
// Everything the game needs to start, saved now. Files an older version already has (same name, so
// the same file) are copied over rather than downloaded again — the songs too; the rest come from
// the browser's own cache when they can (the page has just loaded them), else the server.
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // the page, checked against this build: a newer one (another update meanwhile) would ask for
      // files this version doesn't have. (If so, nothing is installed: the next visit tries again.)
      const page = await fetch(INDEX, { cache: 'no-cache' });
      if (!page.ok) throw new Error(`page: ${page.status}`);
      if (hex(await crypto.subtle.digest('SHA-256', await page.clone().arrayBuffer())) !== BUILD.index) throw new Error('page is from another build');
      await cache.put(INDEX, page);
      await Promise.all(
        SHELL.filter((u) => u !== INDEX).map(async (u) => {
          const old = !PLAIN.has(u) && (await caches.match(u));
          if (old) return cache.put(u, old);
          const r = await fetch(u, { cache: PLAIN.has(u) ? 'no-cache' : 'default' });
          if (!r.ok) throw new Error(`${u}: ${r.status}`);
          return cache.put(u, r);
        }),
      );
      await Promise.all(
        MUSIC.map(async (u) => {
          const old = await caches.match(u);
          if (old) await cache.put(u, old);
        }),
      );
      // straight in: the page from the server (always) asks for this version's files by name, so
      // nothing changes under a page that's already running
      await self.skipWaiting();
    })(),
  );
});

// the old versions' copies, cleared away once this one takes over
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== CACHE) await caches.delete(k);
      // (the page's request starts while this helper is still waking up, not after)
      await self.registration.navigationPreload?.enable().catch(() => {});
      await self.clients.claim();
    })(),
  );
});

// ─────────────────────────────────────────────────────────── requests ──
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url.split('#')[0];
  if (!url.startsWith(self.location.origin) || url.startsWith(API)) return;
  if (req.mode === 'navigate') return e.respondWith(page(e));
  // (byte ranges: left to the browser and the server)
  if (req.headers.has('range')) return;
  const file = url.split('?')[0];
  if (file.startsWith(ASSETS)) return e.respondWith(asset(e, file));
  if (PLAIN.has(file)) return e.respondWith(plain(req, file));
});

/** The page: the server's, or (no connection / no answer for a few seconds) the copy kept here. */
async function page(e) {
  const net = (async () => (await e.preloadResponse) || fetch(e.request))();
  // (still finished in the background after a slow answer, so the browser doesn't cut it off)
  e.waitUntil(net.catch(() => {}));
  const late = new Promise((r) => setTimeout(r, PAGE_WAIT, 'late'));
  try {
    const r = await Promise.race([net, late]);
    // (the server's answer, whatever it is — unless it's down: a deploy restarting, say)
    if (r !== 'late' && r.status < 500) return r;
  } catch {
    /* no connection */
  }
  const kept = await caches.match(INDEX);
  return kept ?? net;
}

/** Files under /assets/ never change (a new version has a new name): the copy here, else the server's (then kept). */
const saving = new Map();
async function asset(e, file) {
  const kept = (await caches.match(file)) ?? (saving.has(file) && (await saving.get(file), await caches.match(file)));
  if (kept) return kept;
  const r = await fetch(e.request);
  if (r.status === 200) e.waitUntil(keep(file, r.clone()));
  return r;
}
function keep(file, r) {
  const p = caches
    .open(CACHE)
    .then((c) => c.put(file, r))
    .catch(() => {})
    .finally(() => saving.delete(file));
  saving.set(file, p);
  return p;
}

/** Icons and the manifest: the server's (a 304 when unchanged), else the copy here. */
async function plain(req, file) {
  try {
    return await fetch(req);
  } catch (err) {
    const kept = await caches.match(file);
    if (kept) return kept;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────── the songs ──
// The two songs the game starts with are saved as it loads them; the page asks for the rest from
// the start screen ("warm-music"), one at a time, in the background (all here, off the game's
// thread). Songs not saved yet just don't play offline.
let warming = null;
self.addEventListener('message', (e) => {
  if (e.data === 'warm-music') e.waitUntil((warming ??= warm().finally(() => (warming = null))));
});
async function warm() {
  for (const u of MUSIC) {
    if (await caches.match(u)) continue;
    if (saving.has(u)) {
      await saving.get(u);
      continue;
    }
    try {
      const r = await fetch(u, { priority: 'low' });
      if (r.status === 200) await keep(u, r);
    } catch {
      return; // (offline: next time)
    }
  }
}
