import type { Ctx } from './draw';
import { STYLES, type Fill, type Pt } from './handdrawn';

/** Frame size for the Giant's rolling flames (world units); base at y = FLAME_H - 2. */
export const FLAME_W = 48;
export const FLAME_H = 60;
export const FLAME_FRAMES = ['f0', 'f1', 'f2', 'f3'] as const;

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

/** One frame of a rolling wall of flame (moving right; tips lean back). */
export function drawFlame(ctx: Ctx, frame: number) {
  const S = STYLES.polished;
  const cx = FLAME_W / 2;
  const base = FLAME_H - 4;
  const ph = frame * (Math.PI / 2);
  const wob = (k: number, a: number) => Math.sin(ph + k) * a;
  // back tongues (red), main tongue (orange), core (yellow), white-hot heart
  S.shape(ctx, tongue(cx - 10, base, 17, 30 + wob(0, 5), -7 + wob(1, 2)), RED, 3001 + frame, { lw: 1 });
  S.shape(ctx, tongue(cx + 10, base, 16, 26 + wob(2, 5), -5 + wob(3, 2)), RED, 3011 + frame, { lw: 1 });
  S.shape(ctx, tongue(cx, base, 25, 46 + wob(1.5, 6), -9 + wob(0.5, 3)), ORANGE, 3021 + frame, { lw: 1.1, light: [cx - 4, base - 30] });
  S.shape(ctx, tongue(cx + 1, base, 15, 27 + wob(2.5, 4), -6 + wob(1, 2)), YELLOW, 3031 + frame, { lw: 0.6, plain: true });
  S.shape(ctx, tongue(cx + 1, base, 7, 13 + wob(3.5, 2), -3), HOT, 3041 + frame, { noLine: true, plain: true });
  // a couple of loose sparks
  ctx.fillStyle = '#ffd04a';
  for (let i = 0; i < 2; i++) {
    const sx = cx - 6 + ((frame * 7 + i * 13) % 14);
    const sy = base - 40 - ((frame * 9 + i * 11) % 12);
    ctx.beginPath();
    ctx.arc(sx, sy, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}
