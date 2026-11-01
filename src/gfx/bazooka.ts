/**
 * The heroes' bazooka, shared by all three characters so it always reads the
 * same: olive launch tube with bands, a flip-up front sight, a pistol grip
 * with trigger, a shoulder pad, a flared exhaust at the back, and the red
 * rocket warhead poking out of the muzzle while it's loaded.
 */
import type { Ctx } from './draw';
import { ellipsePts, roundRectPts, type Fill, type Pt, type Style } from './handdrawn';

export const BAZ = {
  tube: { base: '#6b8a4e', shade: '#4a6334', light: '#a3c27c' } as Fill,
  band: { base: '#3d4a33', shade: '#2a3323', light: '#5e6e50' } as Fill,
  warhead: { base: '#e8463f', shade: '#b02f2a', light: '#ff9a8f' } as Fill,
  steel: { base: '#c9d1dc', shade: '#8e98a6', light: '#ffffff' } as Fill,
  grip: { base: '#5b3a24', shade: '#3a2416', light: '#87593a' } as Fill,
};

export interface BazookaOpts {
  /** Muzzle x (front end, facing right). */
  x1: number;
  /** Rear x. */
  x0: number;
  /** Centre line y. */
  y: number;
  /** Tube thickness. */
  h: number;
  /** Show the warhead in the muzzle. */
  loaded: boolean;
  seed: number;
}

export function drawBazooka(ctx: Ctx, st: Style, o: BazookaOpts) {
  const { x0, x1, y, h, seed } = o;
  const len = x1 - x0;
  const lw = 0.8;

  // pistol grip + trigger under the front third
  const gx = x0 + len * 0.58;
  const grip: Pt[] = [
    [gx - 2.2, y + h * 0.4],
    [gx + 2.2, y + h * 0.4],
    [gx + 1.4, y + h * 0.4 + h * 0.95],
    [gx - 2.6, y + h * 0.4 + h * 0.85],
  ];
  st.shape(ctx, grip, BAZ.grip, seed + 1, { lw, plain: true });
  st.line(ctx, [[gx - 4.5, y + h * 0.45], [gx - 4.8, y + h * 0.95], [gx - 3, y + h * 1.05]], seed + 2, 0.55);

  // warhead peeking out of the muzzle (drawn first so the tube lip overlaps it)
  if (o.loaded) {
    const wh: Pt[] = [];
    const r = h * 0.42;
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI;
      wh.push([x1 + Math.cos(a) * r * 1.9, y + Math.sin(a) * r]);
    }
    wh.push([x1 - 1, y + r]);
    wh.push([x1 - 1, y - r]);
    st.shape(ctx, wh, BAZ.warhead, seed + 3, { lw, plain: true });
  }

  // main tube
  st.shape(ctx, roundRectPts(x0, y - h / 2, len, h, h * 0.35), BAZ.tube, seed + 4, { lw });
  // bands
  for (const t of [0.22, 0.78]) {
    const bx = x0 + len * t;
    st.shape(ctx, roundRectPts(bx - 1.3, y - h / 2 - 0.4, 2.6, h + 0.8, 0.8), BAZ.band, seed + 5 + t * 10, { lw: 0.6, plain: true });
  }
  // shoulder pad
  st.shape(ctx, roundRectPts(x0 + len * 0.3, y - h / 2 - 1.2, len * 0.16, 2.2, 1), BAZ.grip, seed + 9, { lw: 0.6, plain: true });
  // front sight (little flip-up post)
  st.shape(ctx, [[x1 - h * 0.9, y - h / 2], [x1 - h * 0.55, y - h / 2 - h * 0.55], [x1 - h * 0.3, y - h / 2]], BAZ.band, seed + 10, { lw: 0.6, plain: true });
  // muzzle lip
  st.shape(ctx, roundRectPts(x1 - 2, y - h / 2 - 1, 3.4, h + 2, 1.2), BAZ.band, seed + 11, { lw, plain: true });
  // flared exhaust at the back
  const flare: Pt[] = [
    [x0 + 1, y - h / 2],
    [x0 - h * 0.55, y - h / 2 - h * 0.28],
    [x0 - h * 0.55, y + h / 2 + h * 0.28],
    [x0 + 1, y + h / 2],
  ];
  st.shape(ctx, flare, BAZ.band, seed + 12, { lw, plain: true });
  // a little steel highlight rivet so it reads as metal
  st.shape(ctx, ellipsePts(x0 + len * 0.5, y, 0.9, 0.9, 0, 10), BAZ.steel, seed + 13, { noLine: true, plain: true });
}

/** Bazooka rocket (the projectile), facing right, centred on (cx, cy). Length ~22. */
export function drawRocket(ctx: Ctx, st: Style, cx: number, cy: number) {
  // fins
  st.shape(ctx, [[cx - 9, cy - 1], [cx - 13, cy - 6], [cx - 6, cy - 2.5]], BAZ.band, 1, { lw: 0.7, plain: true });
  st.shape(ctx, [[cx - 9, cy + 1], [cx - 13, cy + 6], [cx - 6, cy + 2.5]], BAZ.band, 2, { lw: 0.7, plain: true });
  // body
  st.shape(ctx, roundRectPts(cx - 10, cy - 3, 14, 6, 2.5), BAZ.steel, 3, { lw: 0.8 });
  // warhead cone
  const cone: Pt[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    cone.push([cx + 4 + Math.cos(a) * 8, cy + Math.sin(a) * 3.2]);
  }
  st.shape(ctx, cone, BAZ.warhead, 4, { lw: 0.8 });
  // stripe
  st.shape(ctx, roundRectPts(cx - 3, cy - 3, 2, 6, 0.6), BAZ.warhead, 5, { lw: 0.5, plain: true });
}

/** Cartoon muzzle flash star. */
export function drawMuzzleFlash(ctx: Ctx, st: Style, cx: number, cy: number, r: number) {
  const pts: Pt[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rr = i % 2 ? r * 0.45 : r * (0.8 + ((i * 37) % 10) / 30);
    pts.push([cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr]);
  }
  st.shape(ctx, pts, { base: '#ffd23f', shade: '#ff8a2e', light: '#fff6c8' }, 77, { lw: 0.8, plain: true });
  st.shape(ctx, ellipsePts(cx, cy, r * 0.42, r * 0.34, 0, 16), { base: '#fffbe8', shade: '#fff3b0', light: '#ffffff' }, 78, { noLine: true, plain: true });
}
