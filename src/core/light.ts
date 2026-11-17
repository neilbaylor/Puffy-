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
 * graphics loss in that version.
 */
import { VERSION } from '../version';

export const LIGHT_KEY = 'puffy.light';
/** What main.ts stores when the graphics run out of memory: light mode for this version. */
export const LIGHT_AUTO = `auto:${VERSION}`;

export const LIGHT: boolean = (() => {
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
  } catch {
    /* private mode */
  }
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem <= 2) return true;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const max = gl ? (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) : 0;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    if (max && max <= 4096) return true;
  } catch {
    /* no WebGL here: the game falls back to its canvas renderer */
  }
  return false;
})();
