/**
 * Light mode, for older devices that can't hold the full-detail pictures: the screen is drawn at
 * 1x, the ground, backgrounds and clouds at a lower resolution (a little softer), and the start
 * screen doesn't build the other Parts ahead. On when the device says it has 2 GB or less, when
 * its graphics chip can't take pictures over 4096 px, or once the graphics have run out of memory
 * on it (remembered: see main.ts).
 */
export const LIGHT_KEY = 'puffy.light';

export const LIGHT: boolean = (() => {
  try {
    const v = localStorage.getItem(LIGHT_KEY);
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
