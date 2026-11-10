/**
 * Battle colours: every player slot gets its own colour of hero (1 the normal
 * orange, 2 purple, 3 red, 4 green). Only the orange body is shifted — the
 * green bazooka, white eyes, pink tongue and dark ink lines stay as they are.
 */

/** Hue (degrees) each slot's orange is turned into; null = keep the normal orange. */
const SLOT_HUE: (number | null)[] = [null, 272, 352, 112];
/** A little extra saturation / lightness per slot so each colour reads well. */
const SLOT_TUNE: [number, number][] = [
  [1, 1],
  [0.92, 1.02],
  [1.08, 0.94],
  [0.9, 0.96],
];

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h: number;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

/** Does this slot change the hero's colour? (The first keeps the hero's own orange.) */
export const slotRecolors = (slot: number) => SLOT_HUE[slot % SLOT_HUE.length] !== null;

/** A copy of `src` with the hero's orange turned into the slot's colour (slot 0 returns `src`). */
export function recolorForSlot(src: HTMLCanvasElement | HTMLImageElement, slot: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const hue = SLOT_HUE[slot % SLOT_HUE.length];
  if (hue === null) return c;
  const [ks, kl] = SLOT_TUNE[slot % SLOT_TUNE.length];
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  // remember results for colours we've seen (the art uses a modest palette + gradients)
  const memo = new Map<number, number>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let out = memo.get(key);
    if (out === undefined) {
      const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      // the hero's oranges: warm hues, clearly coloured, not the dark ink or near-white
      if (h >= 6 && h <= 50 && s > 0.3 && l > 0.2 && l < 0.92) {
        const [r, g, b] = hslToRgb(hue + (h - 28) * 0.6, Math.min(1, s * ks), Math.min(0.95, l * kl));
        out = (r << 16) | (g << 8) | b;
      } else out = key;
      memo.set(key, out);
    }
    d[i] = (out >> 16) & 255;
    d[i + 1] = (out >> 8) & 255;
    d[i + 2] = out & 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
