/**
 * Light mode, for older devices that can't keep up with the full-detail pictures: the screen is drawn
 * at 1x, the ground, backgrounds and clouds at a lower resolution (a little softer), and the start
 * screen doesn't build the other Parts ahead. Chosen by measuring the device once a version, before
 * the game starts (see core/lightPick); or picked by hand with the hidden links (?lite / ?full); or
 * switched on once the graphics have run out of memory while playing (see main.ts), until the next
 * version.
 *
 * `puffy.light`: '1' on, '0' off (picked by hand), 'bench:<version>:<0|1>' measured in that version,
 * 'auto:<version>' switched on by a graphics loss in that version; 'slow' (the old speed check,
 * before v0.372) is measured afresh.
 */
import { VERSION } from '../version';

export const LIGHT_KEY = 'puffy.light';
/** What the old speed check (before v0.372) stored: measured afresh now (see core/lightPick). */
export const LIGHT_SLOW = 'slow';
/** What main.ts stores when the graphics run out of memory: light mode for this version. */
export const LIGHT_AUTO = `auto:${VERSION}`;

/**
 * The hidden device-check page (`?bench`, see src/bench) starts the game to time its start screen:
 * nothing that happens there changes this device's mode (see main.ts).
 */
export const BENCH = /[?&]bench(?:[=&]|$)/.test(location.search);

/**
 * Hidden links for a device that needs it: `?lite` puts this device in light mode for good, `?full`
 * in full mode for good (both as if picked by hand: the automatic checks leave it alone). Taken
 * out of the address straight away, so the saved home-screen link stays plain.
 */
function hiddenSwitch() {
  try {
    const q = new URLSearchParams(location.search);
    const pick = q.has('lite') ? '1' : q.has('full') ? '0' : null;
    if (!pick) return;
    localStorage.setItem(LIGHT_KEY, pick);
    // (picked here, not the old automatic '1' that gets one more try at full mode: see below)
    localStorage.setItem('puffy.lightRetried', '1');
    q.delete('lite');
    q.delete('full');
    const rest = q.toString();
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
  } catch {
    /* private mode */
  }
}

export const LIGHT: boolean = (() => {
  hiddenSwitch();
  try {
    let v = localStorage.getItem(LIGHT_KEY);
    // (before v0.332 a graphics loss stored '1', for good: those devices get one more try at full
    // mode. Only real devices: test browsers set '1' on purpose)
    if (v === '1' && !navigator.webdriver && !localStorage.getItem('puffy.lightRetried')) {
      localStorage.setItem('puffy.lightRetried', '1');
      localStorage.removeItem(LIGHT_KEY);
      v = null;
    }
    if (v?.startsWith('auto:')) {
      if (v === LIGHT_AUTO) return true;
      localStorage.removeItem(LIGHT_KEY); // (an older version's switch: full mode again)
      v = null;
    }
    if (v === '1') return true;
    if (v === '0') return false;
    // (measured this version: see core/lightPick)
    if (v?.startsWith(`bench:${VERSION}:`)) return v.endsWith(':1');
  } catch {
    /* private mode */
  }
  return false;
})();
