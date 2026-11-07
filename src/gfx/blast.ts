/**
 * Pieces for a big explosion (the King blowing up at the end of Part 2), drawn once as
 * textures and then thrown about by the scene: a soft fireball, rolling smoke, embers, and
 * bits of the King's orange fluff.
 */
import type { Ctx } from './draw';
import { rng } from './draw';
import { STYLES, type Fill } from './handdrawn';
import { fluffPts } from './baddies';

/** A lumpy ball of fire, white-hot in the middle (size × size, for additive blending). */
export function drawFireball(ctx: Ctx, size: number) {
  const c = size / 2;
  const r = rng(5);
  const blob = (x: number, y: number, rad: number, stops: [number, string][]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    for (const [o, col] of stops) g.addColorStop(o, col);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  };
  // an orange-red body of lumps, then yellow, then the white core
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.5;
    const d = size * (0.14 + r() * 0.08);
    blob(c + Math.cos(a) * d, c + Math.sin(a) * d, size * (0.22 + r() * 0.06), [[0, 'rgba(255,150,50,0.9)'], [0.55, 'rgba(240,90,30,0.55)'], [1, 'rgba(200,40,20,0)']]);
  }
  blob(c, c, size * 0.36, [[0, 'rgba(255,230,120,1)'], [0.6, 'rgba(255,180,60,0.7)'], [1, 'rgba(255,140,40,0)']]);
  blob(c, c, size * 0.2, [[0, 'rgba(255,255,245,1)'], [0.7, 'rgba(255,250,210,0.8)'], [1, 'rgba(255,240,170,0)']]);
}

/** A soft, lumpy puff of smoke (lighter on top, a little darker underneath), no outline. */
export function drawSmoke(ctx: Ctx, size: number, seed: number) {
  const c = size / 2;
  const r = rng(seed);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + r() * 0.6;
    const d = size * (0.1 + r() * 0.12);
    const x = c + Math.cos(a) * d;
    const y = c + Math.sin(a) * d * 0.8;
    const rad = size * (0.2 + r() * 0.08);
    const g = ctx.createRadialGradient(x - rad * 0.25, y - rad * 0.3, rad * 0.1, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.55, 'rgba(225,222,230,0.75)');
    g.addColorStop(0.85, 'rgba(185,180,195,0.35)');
    g.addColorStop(1, 'rgba(170,165,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  // a darker belly, so it reads as a solid puff and not a smudge
  const g = ctx.createRadialGradient(c, c + size * 0.12, 0, c, c + size * 0.12, size * 0.3);
  g.addColorStop(0, 'rgba(120,110,125,0.35)');
  g.addColorStop(1, 'rgba(120,110,125,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

/** A glowing ember (additive). */
export function drawEmber(ctx: Ctx, size: number) {
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.3, 'rgba(255,220,120,0.9)');
  g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

const KING_FLUFF: Fill = { base: '#f28a2e', shade: '#c55a16', light: '#ffc07a' };

/** A chunk of the King's orange fluff, flying off (inked, like everything else). size × size. */
export function drawFluffChunk(ctx: Ctx, size: number, seed: number) {
  const r = rng(seed);
  const c = size / 2;
  STYLES.polished.shape(ctx, fluffPts(c, c, size * (0.3 + r() * 0.08), size * (0.24 + r() * 0.08), 5 + Math.floor(r() * 3), 0.16, r() * 3), KING_FLUFF, seed, { lw: 0.9, light: [c - size * 0.15, c - size * 0.15] });
}
