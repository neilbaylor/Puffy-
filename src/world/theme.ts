import { PALETTES, seaColor } from '../gfx/world';
import { LIGHT } from '../core/light';

/**
 * The look of Puff Ball Planet drifts slowly while you play, like the day
 * passing: Puff Ball Planet → Candy clouds → Golden hour → Meadow morning →
 * back again (Part 2 cycles its three mountain looks the same way). Each look
 * holds for 20 seconds, then the next one fades in over 10 seconds. One clock
 * for the whole game: it keeps going through restarts; the start screen shows each
 * level in its first look, still, and sets the clock back to it (so a game started
 * from there opens in the look already drawn).
 */
export const THEMES = ['puff', 'candy', 'golden', 'meadow'] as const;
/** Part 2's looks: the three mountain moods. */
export const MOUNTAIN_THEMES = ['m-pastel', 'm-frost', 'm-sunset'] as const;
/** Plop Invasion's looks: murky noon, smoggy dusk, stinky haze. */
export const PLOP_THEMES = ['p-muck', 'p-dusk', 'p-stink'] as const;
export type ThemeId = (typeof THEMES)[number] | (typeof MOUNTAIN_THEMES)[number] | (typeof PLOP_THEMES)[number];

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

export function themeMix(t: number, themes: readonly ThemeId[] = LIGHT ? THEMES.slice(0, 1) : THEMES): ThemeMix {
  const period = HOLD + BLEND;
  const n = themes.length;
  // (one look: no fading at all)
  if (n === 1) return { a: themes[0], b: themes[0], w: 0 };
  const tt = ((t % (period * n)) + period * n) % (period * n);
  const i = Math.floor(tt / period);
  const local = tt - i * period;
  const k = local < HOLD ? 0 : (local - HOLD) / BLEND;
  return { a: themes[i], b: themes[(i + 1) % n], w: k * k * (3 - 2 * k) };
}

/** The looks a level cycles through. */
const allThemesFor = (level: number): readonly ThemeId[] => (level === 2 ? MOUNTAIN_THEMES : level >= 3 ? PLOP_THEMES : THEMES);
/** A level's looks, in order. (Light mode: just its first — no other looks to draw and hold, and
 * never two whole backgrounds showing at once while one fades into the next.) */
export const themesFor = (level: number): readonly ThemeId[] => (LIGHT ? allThemesFor(level).slice(0, 1) : allThemesFor(level));

/** A soft colour grade for the foreground (terrain, trees, flowers) in each look. */
const TINT: Record<ThemeId, number> = {
  puff: 0xffffff,
  meadow: 0xf2fff0,
  candy: 0xfff0fa,
  golden: 0xffe3c4,
  'm-pastel': 0xfdf4ff,
  'm-frost': 0xeef6ff,
  'm-sunset': 0xffe6cc,
  'p-muck': 0xfff2e0,
  'p-dusk': 0xffe2d4,
  'p-stink': 0xf0f4dc,
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
