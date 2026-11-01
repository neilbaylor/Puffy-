import { PALETTES, seaColor } from '../gfx/world';

/**
 * The look of Puff Ball Planet drifts slowly while you play, like the day
 * passing: Puff Ball Planet → Meadow morning → Candy clouds → Golden hour →
 * back again. Each look holds for a while, then the next one fades in over
 * ~20 seconds. The clock keeps running through checkpoint restarts and
 * starts over on a new run.
 */
export const THEMES = ['puff', 'meadow', 'candy', 'golden'] as const;
export type ThemeId = (typeof THEMES)[number];

const HOLD = 40;
const BLEND = 22;

export const themeClock = { t: 0 };

export interface ThemeMix {
  /** The look underneath. */
  a: ThemeId;
  /** The look fading in on top. */
  b: ThemeId;
  /** How far the fade has got, 0..1. */
  w: number;
}

export function themeMix(t: number): ThemeMix {
  const period = HOLD + BLEND;
  const tt = ((t % (period * THEMES.length)) + period * THEMES.length) % (period * THEMES.length);
  const i = Math.floor(tt / period);
  const local = tt - i * period;
  const k = local < HOLD ? 0 : (local - HOLD) / BLEND;
  return { a: THEMES[i], b: THEMES[(i + 1) % THEMES.length], w: k * k * (3 - 2 * k) };
}

/** A soft colour grade for the foreground (terrain, trees, flowers) in each look. */
const TINT: Record<ThemeId, number> = {
  puff: 0xffffff,
  meadow: 0xf2fff0,
  candy: 0xfff0fa,
  golden: 0xffe3c4,
};

const lerpRgb = (x: number, y: number, w: number) => {
  let out = 0;
  for (const s of [16, 8, 0]) {
    const a = (x >> s) & 255;
    const b = (y >> s) & 255;
    out |= Math.round(a + (b - a) * w) << s;
  }
  return out;
};

export const mixTint = (m: ThemeMix) => lerpRgb(TINT[m.a], TINT[m.b], m.w);

const hex = (h: string) => parseInt(h.slice(1), 16);
export const mixSea = (m: ThemeMix) => lerpRgb(hex(seaColor(PALETTES[m.a])), hex(seaColor(PALETTES[m.b])), m.w);
