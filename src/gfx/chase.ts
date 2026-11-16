/**
 * Part 6 (World 3 · The Rise of King Bob, Part 2): the chase. The pack's own bits (speed streaks in
 * the water behind them), and the Fat Fish that falls out of the sky: the warning sign that goes up
 * over the spot, the danger column down through the water, the target ring on the surface and the
 * streaks behind it as it drops.
 *
 * Pure canvas drawing, in the polished hand-drawn style (inked, shaded shapes), like gfx/sea.ts.
 */
import type { Ctx } from './draw';
import { STYLES, ellipsePts, type Fill, type Pt } from './handdrawn';

const ST = STYLES.polished;
const INK = ST.ink;
const F = (base: string, shade: string, light: string): Fill => ({ base, shade, light });

/** The warning sign (units): a rounded red-rimmed triangle with a Fat Fish diving nose first inside. */
export const SIGN = { w: 64, h: 60 };

/** Points of a triangle with rounded corners (apex up), centred on x, its base at y + h/2. */
function roundTri(cx: number, cy: number, w: number, h: number, r: number): Pt[] {
  const corners: Pt[] = [
    [cx, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ];
  const out: Pt[] = [];
  for (let i = 0; i < 3; i++) {
    const [px, py] = corners[(i + 2) % 3];
    const [x, y] = corners[i];
    const [nx, ny] = corners[(i + 1) % 3];
    const a = Math.hypot(px - x, py - y);
    const b = Math.hypot(nx - x, ny - y);
    const p0: Pt = [x + ((px - x) / a) * r, y + ((py - y) / a) * r];
    const p1: Pt = [x + ((nx - x) / b) * r, y + ((ny - y) / b) * r];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const q = 1 - t;
      out.push([q * q * p0[0] + 2 * q * t * x + t * t * p1[0], q * q * p0[1] + 2 * q * t * y + t * t * p1[1]]);
    }
  }
  return out;
}

/** A little Fat Fish, nose down (for the sign): yellow body, the blue hat, motion lines over it. */
function miniFatFish(cx: number, cy: number, s: number, ctx: Ctx) {
  const BODY = F('#fff19a', '#e6cc5e', '#fffbd8');
  const HAT = F('#8fb4ec', '#5b85c8', '#cfe0ff');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 2 - 0.25);
  ctx.scale(s, s);
  // tail (behind, up top once turned)
  ST.shape(ctx, [[-14, -1], [-23, -8], [-20, 0], [-23, 8], [-14, 1]], BODY, 8101, { lw: 1.1 });
  ST.shape(ctx, ellipsePts(0, 0, 15, 10, 0, 30), BODY, 8102, { lw: 1.2, light: [-5, -5] });
  // the hat, on top of the head
  ST.shape(ctx, [[-2, -9], [-1, -15], [5, -17], [9, -14], [10, -8]], HAT, 8103, { lw: 1 });
  ST.shape(ctx, ellipsePts(4, -8.5, 9, 2.2, 0, 20), HAT, 8104, { lw: 1 });
  // a startled eye, a little O of a mouth
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(3, -2, 3.4, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(4.2, -1.6, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12.5, 3, 1.6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // motion lines above it
  for (const [dx, len] of [[-7, 9], [0, 12], [7, 9]] as const) ST.line(ctx, [[cx + dx * s, cy - 22 * s], [cx + dx * s, cy - (22 + len) * s]], 8110 + dx, 1.2);
}

/** The warning sign: up over the spot where the Fat Fish is about to come down. */
export function drawFallSign(ctx: Ctx) {
  const { w, h } = SIGN;
  const cx = w / 2;
  const cy = h / 2 + 2;
  // a soft shadow under it
  ctx.fillStyle = 'rgba(20,40,70,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, h - 3, 20, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ST.shape(ctx, roundTri(cx, cy - 2, w - 6, h - 12, 8), F('#e8463f', '#b82d28', '#ff8a7a'), 8001, { lw: 1.6, light: [cx - 8, cy - 14] });
  ST.shape(ctx, roundTri(cx, cy + 1, w - 20, h - 24, 5), F('#ffe066', '#f2c23a', '#fff6c0'), 8002, { lw: 1, light: [cx - 6, cy - 8] });
  miniFatFish(cx, cy + 6, 0.62, ctx);
}

/** The danger column (a tile, stretched down through the water under the sign): red-orange edges, a pale middle. */
export const COLUMN = { w: 64, h: 64 };
export function drawDangerColumn(ctx: Ctx) {
  const { w, h } = COLUMN;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,90,70,0.0)');
  g.addColorStop(0.08, 'rgba(255,90,70,0.55)');
  g.addColorStop(0.2, 'rgba(255,170,90,0.22)');
  g.addColorStop(0.5, 'rgba(255,236,160,0.12)');
  g.addColorStop(0.8, 'rgba(255,170,90,0.22)');
  g.addColorStop(0.92, 'rgba(255,90,70,0.55)');
  g.addColorStop(1, 'rgba(255,90,70,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // dashes down each edge (they scroll down as it waits)
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const x of [w * 0.08, w * 0.92]) {
    ctx.fillRect(x - 1, 4, 2, h * 0.36);
    ctx.fillRect(x - 1, h * 0.54, 2, h * 0.36);
  }
}

/** The target on the surface, under the sign: two red-and-white rings (seen from the side, flat). */
export const TARGET = { w: 120, h: 30 };
export function drawSurfaceTarget(ctx: Ctx) {
  const { w, h } = TARGET;
  const cx = w / 2;
  const cy = h / 2;
  for (const [rx, ry, col] of [[56, 13, '#e8463f'], [42, 9.6, '#ffffff'], [29, 6.6, '#e8463f'], [15, 3.4, '#ffffff']] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 56, 13, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Streaks behind a falling Fat Fish (vertical, fading towards the top). */
export const STREAKS = { w: 90, h: 140 };
export function drawFallStreaks(ctx: Ctx) {
  const { h } = STREAKS;
  ctx.lineCap = 'round';
  for (const [x, top, lw] of [[14, 40, 3], [30, 8, 4], [46, 20, 5], [62, 4, 4], [77, 36, 3]] as const) {
    const g = ctx.createLinearGradient(0, top, 0, h - 6);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.85)');
    ctx.strokeStyle = g;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, h - 6);
    ctx.stroke();
  }
}

/** Speed streaks in the water behind the pack (horizontal, fading back towards the left). */
export const WAKE = { w: 120, h: 44 };
export function drawPackWake(ctx: Ctx) {
  const { w, h } = WAKE;
  ctx.lineCap = 'round';
  for (const [y, left, lw] of [[8, 40, 2.5], [17, 10, 3.5], [27, 24, 3], [36, 50, 2.2]] as const) {
    const g = ctx.createLinearGradient(left, 0, w - 4, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.75)');
    ctx.strokeStyle = g;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - 4, y + (y - h / 2) * 0.08);
    ctx.stroke();
  }
}

/** The left edge of the screen glowing red while they're close behind (a strip, stretched to the screen's height). */
export const EDGE = { w: 48, h: 64 };
export function drawEdgeGlow(ctx: Ctx) {
  const { w, h } = EDGE;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(232,50,40,0.85)');
  g.addColorStop(0.35, 'rgba(240,80,60,0.38)');
  g.addColorStop(1, 'rgba(255,120,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** The Fat Fish's shadow on the sea bed, growing as it comes (a soft dark oval). */
export const SHADOW = { w: 128, h: 28 };
export function drawBedShadow(ctx: Ctx) {
  const { w, h } = SHADOW;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, h / w);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  g.addColorStop(0, 'rgba(10,30,50,0.75)');
  g.addColorStop(0.6, 'rgba(10,30,50,0.45)');
  g.addColorStop(1, 'rgba(10,30,50,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The "they're behind you" badge: a white disc in a red rim, a red arrow pointing back (the fish goes in it). */
export const BADGE = { w: 76, h: 56 };
export function drawBehindBadge(ctx: Ctx) {
  const cx = 46;
  const cy = BADGE.h / 2;
  // the arrow, pointing left (back, where they're coming from)
  ST.shape(ctx, [[3, cy], [20, cy - 13], [20, cy + 13]], F('#e8463f', '#b82d28', '#ff8a7a'), 8301, { lw: 1.4 });
  ST.shape(ctx, ellipsePts(cx, cy, 25, 25, 0, 36), F('#e8463f', '#b82d28', '#ff8a7a'), 8302, { lw: 1.6, light: [cx - 8, cy - 12] });
  ST.shape(ctx, ellipsePts(cx, cy, 19.5, 19.5, 0, 32), F('#fff8ec', '#e9dcc4', '#ffffff'), 8303, { lw: 1 });
}
