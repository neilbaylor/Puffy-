/**
 * Part 6's pier: a big Ferris wheel standing on it, seaside-pier style — a white steel wheel (twin
 * rims trussed together, spokes to the hub) studded with coloured lights, on an A-frame stand,
 * with little open gondolas hanging from the rim (they stay level as it turns).
 *
 * Three pictures: the wheel (it turns), the stand (still), the gondolas (frames c0…c3, a colour
 * each). Pure canvas drawing in the polished hand-drawn style, like gfx/sea.ts.
 */
import type { Ctx } from './draw';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from './handdrawn';

const ST = STYLES.polished;
const INK = ST.ink;

/** The wheel's radius (world px, to the outer rim) and its picture's size (square, the hub in the middle). */
export const FERRIS = { R: 78, PAD: 8 };
export const FERRIS_SIZE = (FERRIS.R + FERRIS.PAD) * 2;
/** The stand: from the hub down to the deck, this tall; this wide at the feet. */
export const FERRIS_STAND = { w: 116, h: 98 };
/** A gondola: its picture's size, its pivot (where it hangs from) at the top middle. */
export const GONDOLA = { w: 26, h: 26 };
/** How many gondolas round the wheel. */
export const GONDOLAS = 10;
export const GONDOLA_FRAMES = ['c0', 'c1', 'c2', 'c3'] as const;

const STEEL: Fill = { base: '#f4f6f8', shade: '#c9d1d8', light: '#ffffff' };
const LIGHTS = ['#ff5a5a', '#ffd23f', '#58c8ff', '#7ee07e', '#ff8ad8'];

/** A ring as a thick stroke with an ink edge either side. */
function ring(ctx: Ctx, cx: number, cy: number, r: number, w: number) {
  ctx.lineWidth = w + 1.6;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = STEEL.base;
  ctx.stroke();
  // (a shade along the bottom half: lit from above)
  ctx.lineWidth = w * 0.45;
  ctx.strokeStyle = STEEL.shade;
  ctx.beginPath();
  ctx.arc(cx, cy, r - w * 0.18, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
}

/** The wheel: twin rims trussed together, spokes, the hub, coloured lights all round the outside. */
export function drawFerrisWheel(ctx: Ctx) {
  const { R, PAD } = FERRIS;
  const c = R + PAD;
  const rIn = R - 13;
  ctx.lineCap = 'round';
  // spokes: pairs from the hub to the inner rim
  const N = 24;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const ex = c + Math.cos(a) * rIn;
    const ey = c + Math.sin(a) * rIn;
    ctx.strokeStyle = 'rgba(58,36,24,0.55)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 9, c + Math.sin(a) * 9);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = STEEL.base;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
  // the truss between the rims: a zigzag all the way round
  ctx.strokeStyle = STEEL.shade;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const Z = 48;
  for (let i = 0; i <= Z; i++) {
    const a = (i / Z) * Math.PI * 2;
    const r = i % 2 ? R - 2 : rIn + 2;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ring(ctx, c, c, rIn, 3.4);
  ring(ctx, c, c, R, 4.2);
  // the hub: a drum with a cap
  ST.shape(ctx, ellipsePts(c, c, 13, 13, 0, 28), STEEL, 9001, { lw: 1.2, light: [c - 4, c - 5] });
  ST.shape(ctx, ellipsePts(c, c, 6, 6, 0, 20), { base: '#ff5a5a', shade: '#c73c3c', light: '#ffb0a8' }, 9002, { lw: 0.9 });
  // the lights round the outside: a glow, then the bulb
  const L = 40;
  for (let i = 0; i < L; i++) {
    const a = (i / L) * Math.PI * 2 + 0.04;
    const x = c + Math.cos(a) * (R + 0.5);
    const y = c + Math.sin(a) * (R + 0.5);
    const col = LIGHTS[i % LIGHTS.length];
    const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x - 0.5, y - 0.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // a few lights on the inner rim too, every other spoke
  for (let i = 0; i < N; i += 2) {
    const a = (i / N) * Math.PI * 2;
    const x = c + Math.cos(a) * rIn;
    const y = c + Math.sin(a) * rIn;
    ctx.fillStyle = LIGHTS[(i / 2) % LIGHTS.length];
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The stand: an A-frame each side of the hub down to the deck (trussed white steel), a cross-brace, a little platform. */
export function drawFerrisStand(ctx: Ctx) {
  const { w, h } = FERRIS_STAND;
  const cx = w / 2;
  const top = 8;
  const leg = (sx: number): Pt[] => [
    [cx - 3, top],
    [cx + 3, top],
    [cx + sx * (w / 2 - 6) + (sx > 0 ? 1 : 6) * 1, h - 4],
    [cx + sx * (w / 2 - 6) + (sx > 0 ? -7 : 1), h - 4],
  ];
  for (const sx of [-1, 1]) {
    const pts = leg(sx);
    ST.shape(ctx, pts, STEEL, sx < 0 ? 9101 : 9102, { lw: 1.1, light: [cx + sx * 10, top + 10] });
    // (the truss inside each leg)
    ctx.strokeStyle = STEEL.shade;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = cx + sx * (w / 2 - 9) * t + (i % 2 ? sx * 3 : -sx * 2) * t;
      const y = top + (h - 4 - top) * t;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  // a cross-brace between the legs, two-thirds of the way down
  const by = top + (h - top) * 0.66;
  const bx = (w / 2 - 6) * 0.66;
  ST.shape(ctx, roundRectPts(cx - bx, by - 2.5, bx * 2, 5, 2), STEEL, 9110, { lw: 1 });
  // the boarding platform at the bottom, between the feet
  ST.shape(ctx, roundRectPts(cx - 24, h - 12, 48, 8, 2), { base: '#d8434a', shade: '#a52d34', light: '#ff8a8a' }, 9120, { lw: 1 });
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(cx - 20, h - 9.5, 40, 1.4);
  // the axle cap over the hub
  ST.shape(ctx, ellipsePts(cx, top, 7, 7, 0, 20), STEEL, 9130, { lw: 1 });
}

/** A gondola (its frame's colour): a little open car with a striped canopy, hanging from a short bar. */
export function drawGondola(ctx: Ctx, f: (typeof GONDOLA_FRAMES)[number]) {
  const { w } = GONDOLA;
  const cx = w / 2;
  const col: Fill = {
    c0: { base: '#ff5a5a', shade: '#c73c3c', light: '#ffb0a8' },
    c1: { base: '#ffd23f', shade: '#d8a81a', light: '#fff1a8' },
    c2: { base: '#4fb8f0', shade: '#2f86c0', light: '#b8e6ff' },
    c3: { base: '#9a7ae0', shade: '#6e52b8', light: '#d8c8ff' },
  }[f];
  // the hanger
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx, 1.5);
  ctx.lineTo(cx, 7);
  ctx.stroke();
  // the canopy (a little roof, striped)
  ST.shape(ctx, [[cx - 9, 10], [cx - 6, 6], [cx + 6, 6], [cx + 9, 10]], col, 9201, { lw: 1 });
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(cx - 1.5, 6.5, 3, 3.2);
  // the posts, the car
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 7, 10);
  ctx.lineTo(cx - 7, 16);
  ctx.moveTo(cx + 7, 10);
  ctx.lineTo(cx + 7, 16);
  ctx.stroke();
  ST.shape(ctx, roundRectPts(cx - 9, 15, 18, 9, 3), col, 9202, { lw: 1, light: [cx - 5, 16] });
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(cx - 7, 17.5, 14, 1.2);
}
