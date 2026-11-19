/**
 * Light mode, for older devices that can't hold the full-detail pictures: the screen is drawn at
 * 1x, the ground, backgrounds and clouds at a lower resolution (a little softer), and the start
 * screen doesn't build the other Parts ahead. On when the device says it has 2 GB or less, when
 * its graphics chip can't take pictures over 4096 px, or once the graphics have run out of memory
 * on it while playing (see main.ts) — that last one only until the next version, which tries full
 * mode again (a later version may need less memory; a device that really can't cope just switches
 * back, once).
 *
 * `puffy.light`: '1' on, '0' off (set by hand, for testing), 'auto:<version>' switched on by a
 * graphics loss in that version, 'slow' switched on because the device was measured too slow for
 * full mode (the start screen or play running under ~35 fps: see main.ts) — kept for good.
 */
import { VERSION } from '../version';

export const LIGHT_KEY = 'puffy.light';
/** What main.ts stores when the device is measured too slow for full mode (kept for good: a slow chip stays slow). */
export const LIGHT_SLOW = 'slow';
/** What main.ts stores when the graphics run out of memory: light mode for this version. */
export const LIGHT_AUTO = `auto:${VERSION}`;

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

/** The graphics chip's biggest picture size (0: no WebGL), for the light-mode check and ?diag. */
export let maxTextureSize = 0;

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
    if (v === '1' || v === LIGHT_SLOW) return true;
    if (v === '0') return false;
  } catch {
    /* private mode */
  }
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem <= 2) return true;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const max = gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 0;
    maxTextureSize = max;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    if (max && max <= 4096) return true;
  } catch {
    /* no WebGL here: the game falls back to its canvas renderer */
  }
  return false;
})();
