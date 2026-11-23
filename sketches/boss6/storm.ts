// The storm, as the scene would build it: the back (sky, clouds, far sea and swells, the deep) and the
// front (the near surface lapping the hull, the water's tint, splashes, the rain layers), with the
// boat and the cast in between. World units: the sea's surface at WATER, as in Boss 5.
import type { Ctx } from '../../src/gfx/draw';
import {
  BOATS6,
  RAIN_LAYERS,
  STORM_DEEP,
  STORM_FAR,
  STORM_SKY,
  STORM_SKY_FLASH,
  STORM_WAVE,
  drawDeckSplash,
  drawLightning,
  drawRainCurtain,
  drawSeaSplash,
  drawStormCloud,
  drawStormWaveTile,
  drawSwells,
  fillRain,
  fillStops,
  type RainLayer,
} from '../../src/gfx/fishing6';
import { drawFishShadow, drawHullShadow, drawBobber, BOBBER } from '../../src/gfx/fishing';
import { canvasOf, type Placed } from './common';
import { rng } from '../../src/gfx/draw';

export const WATER = 520;
export const HORIZON = WATER - 74;
/** The rematch's boat (option A, the sport-fisher), as placed in the scene: the bow off the left of the stage. */
export const SHIP: Placed = { boat: BOATS6[0], x0: -200, wy: WATER };

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface StormOpts {
  flash?: boolean;
  light?: boolean;
  /** 0 … 1: the clouds parting, a sunbeam (the ending). */
  clearing?: number;
  /** How far on the rain has fallen (shifts the tiles, so frames differ). */
  t?: number;
  /** Where the clouds go: moved by (dx, dy) and scaled by k (for shots away from the boat, e.g. the dock). */
  clouds?: { dx: number; dy: number; k: number };
}

/** Clouds: [x, y, w, h, seed, tone] in the world. */
const FAR_CLOUDS = [
  [-120, 40, 520, 150, 11, 0.05],
  [420, 10, 620, 170, 12, 0.1],
  [980, 50, 560, 150, 13, 0.05],
  [1500, 20, 600, 160, 14, 0.1],
] as const;
const MID_CLOUDS = [
  [-200, -110, 760, 230, 21, 0.5],
  [520, -140, 720, 240, 22, 0.55],
  [1180, -100, 760, 230, 23, 0.5],
] as const;
const NEAR_CLOUDS = [
  [-300, -260, 1000, 280, 31, 1],
  [620, -290, 980, 290, 32, 0.95],
  [1400, -250, 900, 270, 33, 1],
] as const;

export function stormBack(ctx: Ctx, v: View, o: StormOpts = {}) {
  const flash = !!o.flash;
  const clear = o.clearing ?? 0;
  // the sky
  fillStops(ctx, v.x - 10, v.y - 10, v.w + 20, HORIZON - v.y + 20, flash ? STORM_SKY_FLASH : STORM_SKY);
  if (clear > 0) {
    // a break in the clouds: warm light pouring through
    const g = ctx.createRadialGradient(v.x + v.w * 0.72, v.y + 40, 0, v.x + v.w * 0.72, v.y + 40, v.w * 0.6);
    g.addColorStop(0, `rgba(255,236,170,${0.95 * clear})`);
    g.addColorStop(0.5, `rgba(255,214,140,${0.45 * clear})`);
    g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(v.x, v.y, v.w, HORIZON - v.y);
  }
  const clouds = (list: readonly (readonly number[])[], drift: number) => {
    for (const [x, y, w, h, seed, tone] of list) {
      // (parting: the clouds pulled apart from the gap)
      const dx = clear * (x + w / 2 > v.x + v.w * 0.72 ? 260 : -260);
      ctx.save();
      ctx.translate(x + dx + drift, y);
      drawStormCloud(ctx, w, h, seed, tone, flash);
      ctx.restore();
    }
  };
  const cl = o.clouds;
  ctx.save();
  if (cl) {
    ctx.translate(cl.dx, cl.dy);
    ctx.scale(cl.k, cl.k);
  }
  if (!o.light) {
    clouds(FAR_CLOUDS, 0);
    // curtains of rain hanging off the far clouds
    if (clear < 0.5)
      for (const [x, s] of [
        [160, 3],
        [1120, 4],
      ] as const) {
        ctx.save();
        ctx.translate(x, 150);
        drawRainCurtain(ctx, 300, HORIZON - 150, s, flash ? 0.35 : 0.22);
        ctx.restore();
      }
  }
  if (o.light) {
    // light mode: one band of plain clouds
    for (const [x, y, w, h, seed] of MID_CLOUDS) {
      ctx.save();
      ctx.translate(x, y + 30);
      drawStormCloud(ctx, w, h, seed, 0.6, flash);
      ctx.restore();
    }
  } else {
    clouds(MID_CLOUDS, 0);
    if (flash) drawLightning(ctx, v.x + v.w * 0.8, v.y + v.h * 0.12, v.x + v.w * 0.86, HORIZON - 4, 7);
    clouds(NEAR_CLOUDS, 0);
  }
  ctx.restore();
  // the sea: grey-green far off, rows of swells rolling in, whitecaps
  fillStops(ctx, v.x - 10, HORIZON, v.w + 20, WATER - HORIZON + 10, STORM_FAR);
  const swells = (y: number, amp: number, n: number, tone: number, seed: number, period: number) => {
    for (let x = Math.floor((v.x - 20) / period) * period; x < v.x + v.w; x += period) {
      ctx.save();
      ctx.translate(x, y);
      drawSwells(ctx, period, WATER - y + 6, amp, n, tone, seed, flash);
      ctx.restore();
    }
  };
  swells(HORIZON - 6, 8, 10, 0.05, 41, 800);
  if (!o.light) swells(HORIZON + 14, 16, 5, 0.45, 42, 800);
  swells(HORIZON + 34, 26, 3, 0.85, 43, 900);
  // the deep
  fillStops(ctx, v.x - 10, WATER, v.w + 20, v.y + v.h - WATER + 10, STORM_DEEP);
  if (flash) {
    ctx.fillStyle = 'rgba(200,210,255,0.16)';
    ctx.fillRect(v.x, WATER, v.w, v.y + v.h - WATER);
  }
  // fish going by down there (shadows), the hull's shadow
  const r = rng(5);
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.translate(v.x + r() * v.w, WATER + 110 + r() * 140);
    const s = 0.5 + r() * 0.5;
    ctx.scale(i % 2 ? -s : s, s);
    drawFishShadow(ctx, 96, 44);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(SHIP.x0 + 40, WATER + 10);
  ctx.globalAlpha = 0.7;
  drawHullShadow(ctx, SHIP.boat.w * 1.18, 160);
  ctx.restore();
}

/** A bobber floating on the swell at x (its line comes from the tip). */
export function floatBobber(ctx: Ctx, x: number, tip: { x: number; y: number }, gold = false) {
  const y = WATER - 10;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.quadraticCurveTo((tip.x + x) / 2, (tip.y + y) / 2 + Math.min(70, Math.abs(x - tip.x) * 0.08), x, y - 6);
  ctx.stroke();
  ctx.save();
  ctx.translate(x - BOBBER.w / 2, y - 20);
  ctx.rotate(0.12);
  drawBobber(ctx, gold);
  ctx.restore();
}

/** The near surface: two rows of the storm swell tile across the view (the back one fainter), then the water's tint under. */
export function stormSurface(ctx: Ctx, v: View, o: StormOpts = {}, shift = 0) {
  const { c, ctx: t } = canvasOf(STORM_WAVE.w, STORM_WAVE.h);
  drawStormWaveTile(t, !!o.flash);
  for (const [dy, a, sh] of [
    [-14, 0.55, 180],
    [0, 1, 0],
  ] as const) {
    ctx.save();
    ctx.globalAlpha = a;
    const y = WATER - STORM_WAVE.top + dy;
    for (let x = Math.floor((v.x - sh - shift) / STORM_WAVE.w) * STORM_WAVE.w + sh + shift; x < v.x + v.w; x += STORM_WAVE.w) ctx.drawImage(c, x, y);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(8,36,58,0.32)';
  ctx.fillRect(v.x - 10, WATER + STORM_WAVE.h - STORM_WAVE.top - 2, v.w + 20, v.y + v.h);
}

/** Rain hitting the sea: splashes scattered over the water, smaller further off. */
export function seaSplashes(ctx: Ctx, v: View, n: number, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const d = r();
    const y = HORIZON + 10 + d * d * (WATER - HORIZON - 4);
    drawSeaSplash(ctx, v.x + r() * v.w, y, 6 + (y - HORIZON) * 0.22, 0.55 + d * 0.3);
  }
}
/** Rain hitting things: a splash at each point. */
export function deckSplashes(ctx: Ctx, pts: { x: number; y: number }[], seed: number, s = 16) {
  const r = rng(seed);
  for (const p of pts) drawDeckSplash(ctx, p.x + (r() - 0.5) * 8, p.y, s * (0.7 + r() * 0.6));
}

/** The rain: the layers wanted, over the whole view. */
export function rain(ctx: Ctx, v: View, layers: RainLayer[], t = 0, bright = false) {
  // (only down to the sea: not over the cut-away of the water under it)
  const top = { ...v, h: WATER + 6 - v.y };
  v = top;
  for (const l of layers) {
    const L = RAIN_LAYERS[l];
    const seed = { far: 61, mid: 62, near: 63 }[l];
    ctx.save();
    if (bright) ctx.filter = 'brightness(1.4)';
    fillRain(ctx, v.x, v.y, v.w, v.h, l, seed, v.x + t * L.speed * 0.22, v.y + t * L.speed);
    ctx.restore();
  }
}

/** A dark vignette round the edges (the storm closing in). */
export function vignette(ctx: Ctx, v: View, a = 0.45) {
  const g = ctx.createRadialGradient(v.x + v.w / 2, v.y + v.h / 2, v.h * 0.45, v.x + v.w / 2, v.y + v.h / 2, v.w * 0.75);
  g.addColorStop(0, 'rgba(5,10,25,0)');
  g.addColorStop(1, `rgba(5,10,25,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(v.x, v.y, v.w, v.h);
}
