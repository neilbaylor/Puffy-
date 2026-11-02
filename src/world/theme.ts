import { PALETTES, seaColor } from '../gfx/world';

/**
 * The look of Puff Ball Planet drifts slowly while you play, like the day
 * passing: Puff Ball Planet → Candy clouds → Golden hour → Meadow morning →
 * back again (Part 2 cycles its three mountain looks the same way). Each look
 * holds for 20 seconds, then the next one fades in over 10 seconds. One clock
 * for the whole game: it never resets (not on a restart, not on a new run) and
 * keeps going on the start screen too.
 */
export const THEMES = ['puff', 'candy', 'golden', 'meadow'] as const;
/** Part 2's looks: the three mountain moods. */
export const MOUNTAIN_THEMES = ['m-pastel', 'm-frost', 'm-sunset'] as const;
export type ThemeId = (typeof THEMES)[number] | (typeof MOUNTAIN_THEMES)[number];

const HOLD = 20;
const BLEND = 10;

export const themeClock = { t: 0 };

export interface ThemeMix {
  /** The look underneath. */
  a: ThemeId;
  /** The look fading in on top. */
  b: ThemeId;
  /** How far the fade has got, 0..1. */
  w: number;
}

export function themeMix(t: number, themes: readonly ThemeId[] = THEMES): ThemeMix {
  const period = HOLD + BLEND;
  const n = themes.length;
  const tt = ((t % (period * n)) + period * n) % (period * n);
  const i = Math.floor(tt / period);
  const local = tt - i * period;
  const k = local < HOLD ? 0 : (local - HOLD) / BLEND;
  return { a: themes[i], b: themes[(i + 1) % n], w: k * k * (3 - 2 * k) };
}

/** The looks a level cycles through. */
export const themesFor = (level: number): readonly ThemeId[] => (level === 2 ? MOUNTAIN_THEMES : THEMES);

/** A soft colour grade for the foreground (terrain, trees, flowers) in each look. */
const TINT: Record<ThemeId, number> = {
  puff: 0xffffff,
  meadow: 0xf2fff0,
  candy: 0xfff0fa,
  golden: 0xffe3c4,
  'm-pastel': 0xfdf4ff,
  'm-frost': 0xeef6ff,
  'm-sunset': 0xffe6cc,
};

export const lerpRgb = (x: number, y: number, w: number) => {
  let out = 0;
  for (const s of [16, 8, 0]) {
    const a = (x >> s) & 255;
    const b = (y >> s) & 255;
    out |= Math.round(a + (b - a) * w) << s;
  }
  return out;
};

export const mixTint = (m: ThemeMix) => lerpRgb(TINT[m.a], TINT[m.b], m.w);

export const hex = (h: string) => parseInt(h.slice(1), 16);
export const mixSea = (m: ThemeMix) => lerpRgb(hex(seaColor(PALETTES[m.a])), hex(seaColor(PALETTES[m.b])), m.w);
