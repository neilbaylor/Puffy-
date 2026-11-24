/**
 * The app keeps its game up to date between store releases (the app only: loaded by core/native).
 *
 * The app starts straight away with the game it has (the one inside it, or one it downloaded). Once
 * the start screen is up, it asks the website, in the background, for its newest version
 * (app/latest.json); if there's a newer one this app can run, it downloads the files it hasn't got
 * (usually only the game's code: the songs and pictures are mostly unchanged), each one checked
 * against its fingerprint. That version is started the NEXT time the app is opened, never in the
 * middle of a game. A downloaded game that doesn't reach its start screen is put back to the last
 * one that did, by itself (the updater waits for notifyAppReady). Store updates are then only
 * needed for the app's native side (see NEEDS_NATIVE in core/updatePick).
 *
 * The updater is @capgo/capacitor-updater, open source, used on its own: no Capgo account or
 * server, nothing sent anywhere (capacitor.config.json turns its update checks and reports off).
 */
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App } from '@capacitor/app';
import { VERSION } from '../version';
import { APP_SERVER } from './native';
import { newer, worthTaking } from './updatePick';

/** A version downloaded, to start the next time the app is opened: {id, version}. */
const NEXT = 'puffy.update.next';
/** The version last switched to (one that then failed to start isn't tried again). */
const TRIED = 'puffy.update.tried';
/** How long after the start screen is up to ask the website (never competing with the start). */
const CHECK_AFTER_MS = 5000;

function get(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function put(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* (nowhere to keep it: no update this time) */
  }
}

/** Once the loading screen has gone (the start screen is up). */
const started = () =>
  new Promise<void>((ok) => {
    if (!document.body.classList.contains('booting')) return ok();
    const watch = new MutationObserver(() => {
      if (document.body.classList.contains('booting')) return;
      watch.disconnect();
      ok();
    });
    watch.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  });

export async function startAppUpdates() {
  // a newer game downloaded last time: the app has just been opened (this is its loading screen),
  // so switch to it now
  let next: { id?: unknown; version?: unknown } | null = null;
  try {
    next = JSON.parse(get(NEXT) ?? 'null');
  } catch {
    /* (unreadable: forget it) */
  }
  if (next) {
    put(NEXT, null);
    if (typeof next.id === 'string' && typeof next.version === 'string' && newer(next.version, VERSION)) {
      put(TRIED, next.version);
      try {
        await CapacitorUpdater.set({ id: next.id }); // (the page starts again, in the new game)
        return;
      } catch {
        /* (gone: a new app from the store clears downloaded ones) */
      }
    }
  }
  await started();
  // this game got to its start screen: it's a good one (a downloaded one that doesn't is rolled back)
  await CapacitorUpdater.notifyAppReady().catch(() => {});
  setTimeout(() => void check(), CHECK_AFTER_MS);
}

/** Ask the website for a newer game; download it (only the files not already here) for next time. */
async function check() {
  try {
    const r = await fetch(`${APP_SERVER}/app/latest.json`, { cache: 'no-store' });
    if (!r.ok) return;
    const m: unknown = await r.json();
    const native = Number((await App.getInfo()).build) || 0;
    if (!worthTaking(m, VERSION, native, get(TRIED))) return;
    // (downloaded already, on an earlier start that was closed before it was used?)
    const { bundles } = await CapacitorUpdater.list();
    const have = bundles.find((b) => b.version === m.version && (b.status === 'pending' || b.status === 'success'));
    const bundle =
      have ??
      (await CapacitorUpdater.download({
        url: `${APP_SERVER}/app/latest.json`,
        version: m.version,
        // each file with its fingerprint: the updater copies the ones it has (inside the app, or from
        // an earlier download), downloads the rest, and checks every one before it's used
        manifest: m.files.map((f) => ({ file_name: f.path, file_hash: f.sha256, download_url: new URL(f.path, `${APP_SERVER}/`).href })),
      }));
    put(NEXT, JSON.stringify({ id: bundle.id, version: m.version }));
  } catch {
    /* (offline, or the website busy: next time the app is opened) */
  }
}
