import type { Ctx } from './draw';
import { STYLES, type Fill, type Pt } from './handdrawn';

/** Frame size for the Giant's rolling flames (world units); base at y = FLAME_H - 2. */
export const FLAME_W = 48;
export const FLAME_H = 60;
export const FLAME_FRAMES = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'd0', 'd1', 'd2', 'd3'] as const;

const RED: Fill = { base: '#ec4a1e', shade: '#b8260f', light: '#ff8a4a' };
const ORANGE: Fill = { base: '#ff8f1f', shade: '#e2600e', light: '#ffc46a' };
const YELLOW: Fill = { base: '#ffdf4a', shade: '#ffb21e', light: '#fff6b0' };
const HOT: Fill = { base: '#fff8d6', shade: '#ffe9a0', light: '#ffffff' };

/** A flame tongue: round at the base, licking up to a tip that leans by `bend`. */
function tongue(cx: number, base: number, w: number, h: number, bend: number): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const bulge = t < 0.3 ? 0.55 + 0.45 * Math.sin((t / 0.3) * (Math.PI / 2)) : Math.pow((1 - t) / 0.7, 0.85);
    const hw = (w / 2) * bulge;
    const off = bend * t * t;
    const y = base - h * t;
    left.push([cx + off - hw, y]);
    right.push([cx + off + hw, y]);
  }
  // rounded bottom
  const bottom: Pt[] = [];
  for (let k = 1; k < 8; k++) {
    const a = Math.PI - (k / 8) * Math.PI;
    bottom.push([cx + Math.cos(a) * (w / 2) * 0.55, base + Math.sin(a) * 3]);
  }
  return [...left, ...right.reverse(), ...bottom.reverse()];
}

/** One frame of a rolling wall of flame (moving right; tips lean back). 8 frames per loop. */
export function drawFlame(ctx: Ctx, frame: number) {
  const S = STYLES.polished;
  const cx = FLAME_W / 2;
  const base = FLAME_H - 4;
  const ph = frame * (Math.PI / 4);
  const wob = (k: number, a: number) => Math.sin(ph + k) * a + Math.sin(ph * 2 + k * 1.7) * a * 0.35;
  // a soft heat haze behind everything
  const g = ctx.createRadialGradient(cx, base - 16, 2, cx, base - 16, 26);
  g.addColorStop(0, 'rgba(255,170,60,0.35)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FLAME_W, FLAME_H);
  // back tongues (deep red), side licks, main tongue (orange), core (yellow), white-hot heart
  S.shape(ctx, tongue(cx - 12, base, 15, 26 + wob(0, 6), -6 + wob(1, 3)), RED, 3001 + frame, { lw: 1 });
  S.shape(ctx, tongue(cx + 11, base, 14, 23 + wob(2, 6), -5 + wob(3, 3)), RED, 3011 + frame, { lw: 1 });
  S.shape(ctx, tongue(cx - 4, base, 13, 34 + wob(4, 5), -8 + wob(2.2, 3)), RED, 3051 + frame, { lw: 0.9 });
  S.shape(ctx, tongue(cx, base, 25, 46 + wob(1.5, 7), -9 + wob(0.5, 4)), ORANGE, 3021 + frame, { lw: 1.1, light: [cx - 4, base - 30] });
  S.shape(ctx, tongue(cx + 6, base - 2, 11, 30 + wob(5, 5), -6 + wob(1.3, 3)), ORANGE, 3061 + frame, { lw: 0.8 });
  S.shape(ctx, tongue(cx + 1, base, 15, 27 + wob(2.5, 5), -6 + wob(1, 2)), YELLOW, 3031 + frame, { lw: 0.6, plain: true });
  S.shape(ctx, tongue(cx + 1, base, 7, 14 + wob(3.5, 3), -3), HOT, 3041 + frame, { noLine: true, plain: true });
  // a little lick of flame breaking off the top and floating up
  const k = (frame % 4) / 4;
  const bx = cx - 4 - 6 * k;
  const by = base - 46 - 12 * k;
  const bs = 1 - k * 0.7;
  S.shape(ctx, tongue(bx, by, 6 * bs, 9 * bs, -2), ORANGE, 3071 + frame, { lw: 0.6, plain: true });
  // sparks
  ctx.fillStyle = '#ffd04a';
  for (let i = 0; i < 3; i++) {
    const sx = cx - 8 + ((frame * 7 + i * 13) % 18);
    const sy = base - 38 - ((frame * 9 + i * 11) % 16);
    ctx.beginPath();
    ctx.arc(sx, sy, 1.1 + (i % 2) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * A flame burning out (frames d0–d3): it's broken up into a few small, darker
 * flickers over a bed of glowing coals, with curls of smoke starting.
 */
export function drawDyingFlame(ctx: Ctx, frame: number) {
  const S = STYLES.polished;
  const cx = FLAME_W / 2;
  const base = FLAME_H - 4;
  const ph = frame * (Math.PI / 2);
  // glowing coals
  const g = ctx.createRadialGradient(cx, base - 2, 1, cx, base - 2, 16);
  g.addColorStop(0, 'rgba(255,120,40,0.7)');
  g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, base - 18, FLAME_W, 20);
  for (const [dx, r] of [[-9, 3.2], [-2, 4], [6, 3.4], [12, 2.6]] as const) {
    S.shape(ctx, [[cx + dx - r, base + 1], [cx + dx - r * 0.6, base - r], [cx + dx + r * 0.7, base - r * 0.9], [cx + dx + r, base + 1]], { base: '#5a2418', shade: '#2e120c', light: '#ff7a2a' }, 3101 + dx, { lw: 0.7 });
    ctx.fillStyle = `rgba(255,${140 + ((frame * 40 + dx * 9) % 80)},40,0.9)`;
    ctx.beginPath();
    ctx.arc(cx + dx, base - r * 0.4, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  // three small, sputtering tongues
  const h = (k: number) => 9 + Math.max(0, Math.sin(ph + k)) * 9;
  S.shape(ctx, tongue(cx - 7, base - 2, 8, h(0), -3), RED, 3111 + frame, { lw: 0.8 });
  S.shape(ctx, tongue(cx + 2, base - 2, 10, h(1.7) + 4, -4), ORANGE, 3121 + frame, { lw: 0.8 });
  S.shape(ctx, tongue(cx + 2, base - 2, 5, h(1.7) * 0.5 + 2, -2), YELLOW, 3131 + frame, { lw: 0.5, plain: true });
  S.shape(ctx, tongue(cx + 10, base - 2, 7, h(3.4) * 0.8, -2), RED, 3141 + frame, { lw: 0.7 });
}

/** A scorch mark left on the ground where a flame burned out (64 × 16). */
export function drawScorch(ctx: Ctx) {
  const g = ctx.createRadialGradient(32, 9, 2, 32, 9, 30);
  g.addColorStop(0, 'rgba(40,24,30,0.75)');
  g.addColorStop(0.6, 'rgba(40,24,30,0.35)');
  g.addColorStop(1, 'rgba(40,24,30,0)');
  ctx.save();
  ctx.scale(1, 16 / 40);
  ctx.translate(0, 0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 40);
  ctx.restore();
  ctx.fillStyle = '#ff7a2a';
  for (const [x, y, r] of [[24, 9, 1.2], [33, 7, 1.6], [40, 10, 1.1], [29, 11, 0.9]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
