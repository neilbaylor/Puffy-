/**
 * Bad guys drawn from the original sketches, on the hand-drawn toolkit.
 * Both face LEFT by default (toward a player coming from the left).
 *
 *  Puffball  – small fluffy tan ball, one big side eye, ear + arm paddles,
 *              long legs with round feet. Lots of them. 1 hit.
 *  Big Puff  – tall fluffy brute with a heavy-lidded eye and a huge toothy
 *              mouth. Fewer of them. 2 hits; gets angry after the first.
 */
import type { Ctx } from './draw';
import { ellipsePts, paddlePts, type Fill, type Pt, type Style } from './handdrawn';

export const FLUFF: Fill = { base: '#f0c58f', shade: '#cf9a5f', light: '#ffe6c4' };
export const FLUFF_DARK: Fill = { base: '#e3ad72', shade: '#b8814a', light: '#f7d2a2' };
const EYE: Fill = { base: '#ffffff', shade: '#e8e0d4', light: '#ffffff' };
const MOUTH: Fill = { base: '#fff4e4', shade: '#e9d3b8', light: '#ffffff' };
const ANGRY: Fill = { base: '#f0a07a', shade: '#c9714d', light: '#ffc9ac' };

/** Cloud-like outline: a circle/ellipse with soft lumps around the edge. */
export function fluffPts(cx: number, cy: number, rx: number, ry: number, lumps = 9, depth = 0.08, phase = 0): Pt[] {
  const out: Pt[] = [];
  const n = lumps * 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // rounded lumps with soft notches between them, like a cloud
    const k = 1 + depth * (Math.pow(Math.abs(Math.sin((a * lumps) / 2 + phase)), 0.55) * 2 - 1);
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}

function sideEye(ctx: Ctx, st: Style, x: number, y: number, rx: number, ry: number, seed: number, lid = 0) {
  st.shape(ctx, ellipsePts(x, y, rx, ry, 0, 32), EYE, seed, { lw: 0.8 });
  // tall pupil looking left
  ctx.fillStyle = st.ink;
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.42, y + ry * 0.05, Math.max(1.1, rx * 0.22), ry * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.36, y - ry * 0.4, rx * 0.1, ry * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  if (lid > 0) {
    // heavy eyelid: cover the top of the eye with body color, then ink the lid edge
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx + 0.4, ry + 0.4, 0, 0, Math.PI * 2);
    ctx.clip();
    const top = y - ry - 1;
    const edge = top + ry * 2 * lid;
    ctx.fillStyle = FLUFF_DARK.base;
    ctx.fillRect(x - rx - 1, top, rx * 2 + 2, edge - top);
    ctx.restore();
    st.line(ctx, [[x - rx - 0.5, edge + 0.6], [x, edge - 0.6], [x + rx + 0.5, edge + 0.4]], seed + 3, 1.05);
  }
}

// ───────────────────────────── Puffball (48 × 48, feet at y = 46) ──

export type PuffballFrame = 'w0' | 'w1' | 'flat';
export const PUFFBALL_W = 48;
export const PUFFBALL_H = 48;

export function drawPuffball(ctx: Ctx, ox: number, oy: number, frame: PuffballFrame, st: Style) {
  const cx = ox + 24;
  const ground = oy + 46;
  if (frame === 'flat') {
    st.shape(ctx, fluffPts(cx, ground - 5, 16, 5.5, 11, 0.07), FLUFF, 301);
    st.line(ctx, [[cx - 9, ground - 6], [cx - 6, ground - 7.5], [cx - 3, ground - 6]], 302, 0.9);
    return;
  }
  const step = frame === 'w0' ? 1 : -1;
  const bob = frame === 'w0' ? 0 : -1.2;
  const r = 11.5;
  const cy = ground - 13 - r + bob;
  // back leg + foot
  const leg = (hx: number, dx: number, lift: number, f: Fill, seed: number) => {
    const fx = cx + hx + dx;
    const fy = ground - 3.2 - lift;
    st.line(ctx, [[cx + hx, cy + r - 3], [fx, fy]], seed, 2.3);
    st.line(ctx, [[cx + hx, cy + r - 3], [fx, fy]], seed, 1.05, f.base);
    st.shape(ctx, ellipsePts(fx - 1.2, fy, 4.6, 3.4), f, seed + 1, { lw: 0.8 });
  };
  leg(4, step * 3, step > 0 ? 2 : 0, FLUFF_DARK, 310);
  // ears up top, arms out the sides (the four paddles from the sketch)
  st.shape(ctx, paddlePts(cx + 5, cy - r + 3, 9, 6, -1.05), FLUFF_DARK, 320, { lw: 0.8 });
  st.shape(ctx, paddlePts(cx + 9, cy + 4, 9, 5.5, 0.35 + step * 0.25), FLUFF_DARK, 321, { lw: 0.8 });
  st.shape(ctx, fluffPts(cx, cy, r, r * 0.95, 7, 0.07), FLUFF, 330, { light: [cx - 4, cy - 5] });
  st.shape(ctx, paddlePts(cx - 6, cy - r + 3, 9, 6, -2.1), FLUFF, 322, { lw: 0.8 });
  sideEye(ctx, st, cx - 3.5, cy - 1.5, 4.6, 5.8, 340);
  st.shape(ctx, paddlePts(cx - 8, cy + 5, 9, 5.5, Math.PI - 0.3 - step * 0.25), FLUFF, 323, { lw: 0.8 });
  leg(-3, -step * 3, step < 0 ? 2 : 0, FLUFF, 350);
}

// ───────────────────────────── Big Puff (72 × 88, feet at y = 86) ──

export type BigPuffFrame = 'w0' | 'w1' | 'm0' | 'm1';
export const BIGPUFF_W = 72;
export const BIGPUFF_H = 88;

export function drawBigPuff(ctx: Ctx, ox: number, oy: number, frame: BigPuffFrame, st: Style) {
  const cx = ox + 38;
  const ground = oy + 86;
  const mad = frame[0] === 'm';
  const step = frame.endsWith('0') ? 1 : -1;
  const bob = step > 0 ? 0 : -1.5;
  const body = mad ? ANGRY : FLUFF_DARK;
  const rx = 21;
  const ry = 28;
  const cy = ground - 18 - ry + bob;

  // thick legs + big feet
  const leg = (hx: number, dx: number, lift: number, f: Fill, seed: number) => {
    const top: Pt = [cx + hx, cy + ry - 6];
    const fx = cx + hx + dx;
    const fy = ground - 5 - lift;
    const w = 4.2;
    const legPts: Pt[] = [
      [top[0] - w, top[1]],
      [top[0] + w, top[1]],
      [fx + w * 0.9, fy],
      [fx - w * 0.9, fy],
    ];
    st.shape(ctx, legPts, f, seed, { lw: 0.9 });
    st.shape(ctx, ellipsePts(fx - 2.5, fy + 0.5, 8.5, 5.5), f, seed + 1, { lw: 0.9 });
  };
  leg(9, step * 4, step > 0 ? 3 : 0, body === ANGRY ? { ...ANGRY, base: ANGRY.shade } : FLUFF, 410);
  leg(-8, -step * 4, step < 0 ? 3 : 0, body, 460);

  // arm at the back, ear on the face side (as in the sketch)
  st.shape(ctx, paddlePts(cx + rx - 4, cy + 4, 13, 8, 0.5 + step * 0.2), body, 420, { lw: 0.9 });
  st.shape(ctx, fluffPts(cx, cy, rx, ry, 10, 0.06, 0.4), body, 430, { light: [cx - 7, cy - 12] });
  st.shape(ctx, paddlePts(cx - rx + 3, cy - 2, 14, 9, Math.PI + 0.25), body, 421, { lw: 0.9 });

  // the eye: heavy-lidded when calm, wide open when mad
  sideEye(ctx, st, cx - 7, cy - 11, 7.2, 7.6, 440, mad ? 0 : 0.42);
  if (mad) {
    st.line(ctx, [[cx - 16, cy - 22], [cx - 7, cy - 19.5], [cx + 1, cy - 21]], 445, 1.3);
  }

  // big open mouth with scribbly teeth
  const mx = cx - 8;
  const my = cy + 12;
  st.shape(ctx, ellipsePts(mx, my, 10.5, mad ? 12 : 10, -0.15, 36), MOUTH, 450, { lw: 0.95 });
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(mx, my, 10.5, mad ? 12 : 10, -0.15, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = st.ink;
  ctx.lineWidth = 0.75;
  // loops along the top edge and the back edge, like the scribbled teeth in the drawing
  const loops: Pt[] = [];
  for (let i = 0; i < 6; i++) loops.push([mx - 9 + i * 3.6, my - 8.2 + Math.abs(i - 2.5) * 0.6]);
  for (let i = 0; i < 5; i++) loops.push([mx + 7 - i * 1.6, my + 1 + i * 2.4]);
  for (const [lx, ly] of loops) {
    ctx.beginPath();
    ctx.ellipse(lx, ly, 2.2, 2.6, 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
