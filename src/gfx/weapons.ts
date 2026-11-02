/**
 * The bad guys' weapons, from the sketches (all drawn pointing LEFT, the way
 * the bad guys face; the game flips them):
 *  - the blaster: a white barrel with two orange bands, a big fuzzy grey drum
 *    on the back and a little trigger hanging underneath,
 *  - the chainsaw: a black curved handle, a yellow motor with a black grid
 *    and a toothy bar,
 *  - the ball and chain: a grey iron ball with a big zig-zag mouth,
 *  - the blaster's ammo: fuzzy grey pom-poms.
 */
import type { Ctx } from './draw';
import { ellipsePts, roundRectPts, type Fill, type Pt, type Style } from './handdrawn';

const WHITE: Fill = { base: '#fbf8f2', shade: '#d9d2c8', light: '#ffffff' };
const ORANGE: Fill = { base: '#f28a2e', shade: '#c55a16', light: '#ffc07a' };
const FUZZ: Fill = { base: '#9a98a2', shade: '#6e6c78', light: '#c9c7d0' };
const BLACK: Fill = { base: '#2a2830', shade: '#141318', light: '#4a4854' };
const YELLOW: Fill = { base: '#f7dd5a', shade: '#d4b52c', light: '#fff3a8' };
const STEEL: Fill = { base: '#8f95a3', shade: '#62687a', light: '#c9cfdb' };
const IRON: Fill = { base: '#7a7884', shade: '#4e4c58', light: '#aeacb8' };

/** Blaster, 64 × 34; the hand grips it at (36, 24). */
export const BLASTER = { w: 64, h: 34, gx: 36, gy: 24, muzzleX: 3, muzzleY: 16 };
export function drawBlaster(ctx: Ctx, st: Style) {
  // trigger + knob hanging underneath (behind the barrel)
  st.line(ctx, [[30, 21], [28, 27], [24, 30]], 3001, 1.6);
  st.shape(ctx, ellipsePts(23, 30.5, 2.4, 2, 0, 12), BLACK, 3002, { lw: 0.6, plain: true });
  // the fuzzy drum on the back
  const fx = 49;
  const fy = 15;
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const r1 = 9;
    const r2 = 14 + (i % 3) * 1.6;
    st.line(ctx, [[fx + Math.cos(a) * r1, fy + Math.sin(a) * r1], [fx + Math.cos(a + 0.18) * r2, fy + Math.sin(a + 0.18) * r2]], 3010 + i, 0.6, '#5c5a66');
  }
  st.shape(ctx, ellipsePts(fx, fy, 11, 10.5, 0, 28), FUZZ, 3003, { lw: 0.9, light: [fx - 3, fy - 4] });
  for (let k = 0; k < 6; k++) st.line(ctx, [[fx - 7, fy - 6 + k * 2.4], [fx + 7, fy - 6 + k * 2.4 + 0.6]], 3040 + k, 0.35, '#5c5a66');
  // barrel: white with two orange bands
  st.shape(ctx, roundRectPts(2, 9, 40, 14, 5), WHITE, 3004, { lw: 1, light: [12, 12] });
  st.shape(ctx, roundRectPts(11, 9.4, 7, 13.2, 1), ORANGE, 3005, { lw: 0.7, plain: true });
  st.shape(ctx, roundRectPts(26, 9.4, 9, 13.2, 1), ORANGE, 3006, { lw: 0.7, plain: true });
  // muzzle ring
  st.shape(ctx, ellipsePts(3.5, 16, 2.6, 5.6, 0, 16), BLACK, 3007, { lw: 0.7, plain: true });
}

/** Chainsaw, 78 × 38 (two frames: the chain teeth shift); the hand grips the handle at (64, 26). */
export const SAW = { w: 78, h: 38, gx: 64, gy: 26, tipX: 4 };
export function drawChainsaw(ctx: Ctx, st: Style, phase: number) {
  // the bar with its chain of teeth
  const bar: Pt[] = roundRectPts(3, 15, 42, 11, 5.5);
  st.shape(ctx, bar, STEEL, 3101, { lw: 1, light: [14, 17] });
  const teeth = (y: number, dir: number) => {
    const pts: Pt[] = [];
    for (let x = 6 + phase * 2.5; x < 44; x += 5) pts.push([x, y], [x + 2.5, y + dir * 3]);
    st.line(ctx, pts, 3102 + dir, 0.9, '#3a3844');
  };
  teeth(15, -1);
  teeth(26, 1);
  // the motor: yellow with a black grid
  st.shape(ctx, roundRectPts(40, 8, 22, 24, 5), YELLOW, 3110, { lw: 1.1, light: [46, 12] });
  for (const x of [46, 52, 57]) st.line(ctx, [[x, 9], [x, 31]], 3111 + x, 0.9);
  st.line(ctx, [[41, 20], [61, 20]], 3115, 0.9);
  st.shape(ctx, [[40, 8], [36, 12], [36, 28], [40, 32]], BLACK, 3116, { lw: 0.8 });
  // the curved black handle (up and over, like the sketch)
  const handle: Pt[] = [[60, 12], [66, 4], [74, 6], [75, 16], [70, 30], [64, 33], [62, 29], [66, 26], [70, 16], [69, 10], [65, 10], [62, 15]];
  st.shape(ctx, handle, BLACK, 3120, { lw: 1, light: [70, 8] });
}

/** Iron ball with a mouth, 30 × 30 (frames: mouth open / shut). */
export function drawFlailBall(ctx: Ctx, st: Style, open: boolean) {
  const cx = 15;
  const cy = 15;
  st.shape(ctx, ellipsePts(cx, cy, 12.5, 12.5, 0, 32), IRON, 3201, { lw: 1.1, light: [cx - 5, cy - 5] });
  // the mouth: a wide zig-zag grin
  const top = cy + 1;
  const bot = cy + (open ? 9 : 5);
  st.shape(ctx, [[cx - 9, top], [cx + 9, top - 1], [cx + 7, bot], [cx - 7, bot]], { base: '#5e1a2a', shade: '#33091a', light: '#8e2f45' }, 3202, { lw: 0.8 });
  const zig = (y: number, d: number): Pt[] => Array.from({ length: 9 }, (_, i) => [cx - 8 + i * 2, y + (i % 2 ? d * 3 : 0)] as Pt);
  st.line(ctx, zig(top, 1), 3203, 0.8, '#ffffff');
  st.line(ctx, zig(bot, -1), 3204, 0.8, '#ffffff');
  // mean little eyes
  ctx.fillStyle = '#ffffff';
  for (const ex of [-5, 4]) {
    ctx.beginPath();
    ctx.ellipse(cx + ex, cy - 4, 2.6, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = st.ink;
  for (const ex of [-5.6, 3.4]) {
    ctx.beginPath();
    ctx.arc(cx + ex, cy - 3.6, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  st.line(ctx, [[cx - 8, cy - 8], [cx - 3, cy - 6.5]], 3205, 0.8);
  st.line(ctx, [[cx + 2, cy - 6.5], [cx + 7, cy - 8]], 3206, 0.8);
}

/** A fuzzy grey pom-pom bullet with an orange band, 18 × 18. */
export function drawBullet(ctx: Ctx, st: Style) {
  const cx = 9;
  const cy = 9;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    st.line(ctx, [[cx + Math.cos(a) * 4, cy + Math.sin(a) * 4], [cx + Math.cos(a + 0.2) * 8.4, cy + Math.sin(a + 0.2) * 8.4]], 3301 + i, 0.5, '#5c5a66');
  }
  st.shape(ctx, ellipsePts(cx, cy, 5.6, 5.6, 0, 20), FUZZ, 3320, { lw: 0.7, light: [cx - 2, cy - 2] });
  ctx.fillStyle = ORANGE.base;
  ctx.fillRect(cx - 1.2, cy - 5, 2.4, 10);
}
