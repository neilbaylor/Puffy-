/**
 * World 2 · "Plop Invasion": Puff Ball Planet, taken over by the Plops and
 * covered in poo. The same hand-drawn world, but the puff-moss is a thick
 * glossy layer of poo that drips over every edge, the puff trees wear poo
 * caps, little poo piles sit where the flowers were, the hills in the
 * distance are soft-serve poo mountains, the waterfalls run brown and the
 * sea of clouds below is a sea of sludge.
 *
 * The drawing helpers live here (world.ts draws the poo touches for palettes
 * with `poo: true`); the palettes themselves are in plopLooks.ts.
 */
import type { Ctx } from './draw';
import { STYLES, ellipsePts, type Fill, type Pt } from './handdrawn';

const ST = STYLES.polished;

/** Fresh, glossy poo. */
export const POO: Fill = { base: '#8a5232', shade: '#5c3118', light: '#c99064' };
/** Older, darker poo. */
export const POO_DARK: Fill = { base: '#6b3b20', shade: '#45230f', light: '#a06a44' };

/**
 * A poo swirl: stacked, shrinking tiers with a curled tip and a glossy shine.
 * Base centre (x, groundY), width w.
 */
export function drawPooSwirl(ctx: Ctx, x: number, groundY: number, w: number, fill: Fill = POO, seed = 1) {
  const tiers = w > 26 ? 4 : 3;
  let y = groundY;
  let tw = w;
  for (let i = 0; i < tiers; i++) {
    const th = tw * 0.36;
    ST.shape(ctx, ellipsePts(x + (i % 2 ? -1 : 1) * tw * 0.04, y - th * 0.5, tw / 2, th / 2, 0, 22), fill, seed + i, { lw: Math.max(0.5, w / 40), light: [x - tw * 0.18, y - th * 0.75] });
    y -= th * 0.72;
    tw *= 0.72;
  }
  // the curled tip
  const tip: Pt[] = [
    [x - tw * 0.32, y + 1],
    [x + tw * 0.05, y - tw * 0.55],
    [x + tw * 0.5, y - tw * 1.05],
    [x + tw * 0.32, y - tw * 0.4],
    [x + tw * 0.36, y + 1],
  ];
  ST.shape(ctx, tip, fill, seed + 9, { lw: Math.max(0.5, w / 40), light: [x, y - tw * 0.4] });
  // shine
  ctx.fillStyle = '#ffffff70';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.2, groundY - w * 0.26, w * 0.09, w * 0.045, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** A drip of poo hanging from (x, y): a stretched teardrop `len` long, `w` wide. */
export function drawDrip(ctx: Ctx, x: number, y: number, len: number, w: number, fill: Fill = POO) {
  ctx.fillStyle = fill.shade;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 0.6, y);
  ctx.quadraticCurveTo(x - w / 2 - 0.6, y + len * 0.7, x, y + len + 0.8);
  ctx.quadraticCurveTo(x + w / 2 + 0.6, y + len * 0.7, x + w / 2 + 0.6, y);
  ctx.fill();
  ctx.fillStyle = fill.base;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w / 2, y + len * 0.68, x, y + len);
  ctx.quadraticCurveTo(x + w / 2, y + len * 0.68, x + w / 2, y);
  ctx.fill();
  ctx.fillStyle = fill.light + 'cc';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.15, y + len * 0.62, w * 0.14, len * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A poo pile prop (where Puff Ball Planet had little flowers): a squat swirl,
 * sometimes a flat splat, sometimes with a fly. Feet at (x, groundY). `v` 0..3 picks the variant.
 */
export function drawPooPile(ctx: Ctx, x: number, groundY: number, v: number) {
  if (v === 3) {
    // a flat splat
    const pts: Pt[] = [];
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      const rr = (k % 2 ? 6.5 : 8.5) + Math.sin(k * 2.7) * 1.2;
      pts.push([x + Math.cos(a) * rr, groundY - 2.5 + Math.sin(a) * rr * 0.32]);
    }
    ST.shape(ctx, pts, POO_DARK, 77, { lw: 0.6, light: [x - 3, groundY - 4] });
    return;
  }
  drawPooSwirl(ctx, x, groundY, [12, 15, 10][v], v === 1 ? POO_DARK : POO, 60 + v);
  if (v === 1) {
    // a little fly buzzing over it
    const fx = x + 5;
    const fy = groundY - 17;
    ctx.fillStyle = '#ffffffb0';
    ctx.beginPath();
    ctx.ellipse(fx - 2, fy - 2, 2.2, 1.3, -0.5, 0, Math.PI * 2);
    ctx.ellipse(fx + 2, fy - 2, 2.2, 1.3, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2230';
    ctx.beginPath();
    ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Distant soft-serve poo mountain for the hills layer: base centre (x, baseY), width w, height h. */
export function drawPooMountain(ctx: Ctx, x: number, baseY: number, w: number, h: number, fill: Fill, ink: typeof ST, seed: number) {
  const tiers = 4;
  let y = baseY;
  let tw = w;
  const th = h / (tiers + 0.6);
  for (let i = 0; i < tiers; i++) {
    const pts: Pt[] = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24;
      const a = Math.PI + t * Math.PI;
      pts.push([x + (i % 2 ? -1 : 1) * tw * 0.03 + Math.cos(a) * tw / 2, y + Math.sin(a) * th * 1.15]);
    }
    pts.push([x + tw / 2, y + 4]);
    pts.push([x - tw / 2, y + 4]);
    ink.shape(ctx, pts, fill, seed + i, { lw: 0.8, light: [x - tw * 0.2, y - th] });
    y -= th * 0.95;
    tw *= 0.74;
  }
  const tip: Pt[] = [
    [x - tw * 0.3, y + 2],
    [x + tw * 0.1, y - th * 0.7],
    [x + tw * 0.55, y - th * 1.2],
    [x + tw * 0.35, y - th * 0.3],
    [x + tw * 0.35, y + 2],
  ];
  ink.shape(ctx, tip, fill, seed + 9, { lw: 0.8 });
}

/** The Big Plop's rolling poo wave: 56 × 36, rolling to the right, its foot on y = 34. Frames 0..3 wobble it. */
export const POOWAVE_W = 56;
export const POOWAVE_H = 36;
export function drawPooWave(ctx: Ctx, f: number) {
  const k = [0, 1, 2, 1][f] - 1; // -1..1
  const crestX = 38 + k * 1.5;
  const crestY = 7 - k * 1.5;
  const lipX = 50 + k * 1.2;
  const pts: Pt[] = [
    [2, 34],
    [8, 30],
    [16, 25 + k],
    [24, 18 - k * 0.5],
    [31, 11],
    [crestX, crestY],
    [lipX - 3, crestY + 1],
    [lipX, crestY + 6],
    [lipX - 2, crestY + 11],
    [lipX - 6, crestY + 10],
    [lipX - 5, 22],
    [lipX - 1, 30],
    [lipX + 1, 34],
  ];
  ST.shape(ctx, pts, POO, 4100 + f, { lw: 1.2, light: [26, 16] });
  // darker under the curl
  ctx.fillStyle = POO.shade + 'aa';
  ctx.beginPath();
  ctx.ellipse(lipX - 7, crestY + 12, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // drips off the lip
  drawDrip(ctx, lipX - 2, crestY + 10, 4 + f, 2.6);
  drawDrip(ctx, lipX - 7, crestY + 11, 6 - f * 0.8, 2.2);
  // bubbles and shine
  ctx.fillStyle = '#ffffff60';
  for (const [bx, by, br] of [[18 + f * 2, 28, 1.6], [28 - f, 22, 1.2], [34, 17 + f, 1]] as const) {
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#ffffff80';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(22, 20);
  ctx.quadraticCurveTo(30, 11, crestX - 1, crestY + 2);
  ctx.stroke();
}

/** A wavy stink line (rises off the Plops): 12 × 26. */
export function drawStink(ctx: Ctx) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#a8c24ad0';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = 6 + Math.sin(t * Math.PI * 2.5) * 3.6;
    const y = 25 - t * 23;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
