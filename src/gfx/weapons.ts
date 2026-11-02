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

/** Weapons are drawn at a higher resolution than the characters, so they stay crisp. */
export const W_RES = 4;

const WHITE: Fill = { base: '#fbf8f2', shade: '#d9d2c8', light: '#ffffff' };
const ORANGE: Fill = { base: '#ff7f1e', shade: '#d4520c', light: '#ffb86a' };
const FUZZ: Fill = { base: '#a3a1ad', shade: '#6a6876', light: '#dad8e2' };
const BLACK: Fill = { base: '#2a2830', shade: '#141318', light: '#4a4854' };
const STEEL: Fill = { base: '#8f95a3', shade: '#62687a', light: '#c9cfdb' };
const IRON: Fill = { base: '#6f6d7c', shade: '#3e3c4a', light: '#b4b2c2' };

/** Blaster, 64 × 34; the hand grips it at (36, 24). */
export const BLASTER = { w: 64, h: 34, gx: 36, gy: 24, muzzleX: 3, muzzleY: 16 };
export function drawBlaster(ctx: Ctx, st: Style) {
  // trigger guard + trigger + a little knob hanging underneath (behind the barrel)
  st.line(ctx, [[33, 21], [33, 27], [27, 27], [26, 22]], 3001, 1.4);
  st.line(ctx, [[30, 21], [28.5, 25.5]], 3008, 1.1);
  st.line(ctx, [[22, 22], [20, 28], [17, 30.5]], 3009, 1.4);
  st.shape(ctx, ellipsePts(16.5, 31, 2.6, 2.2, 0, 14), { base: '#e8463f', shade: '#b52c27', light: '#ff8a80' }, 3002, { lw: 0.7, plain: true });
  // the fuzzy drum on the back: two layers of fur
  const fx = 49;
  const fy = 15;
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const r2 = 13.5 + (i % 3) * 1.4;
    st.line(ctx, [[fx + Math.cos(a) * 8, fy + Math.sin(a) * 8], [fx + Math.cos(a + 0.2) * r2, fy + Math.sin(a + 0.2) * r2]], 3010 + i, 0.7, '#4c4a56');
  }
  st.shape(ctx, ellipsePts(fx, fy, 11.5, 11, 0, 30), FUZZ, 3003, { lw: 1, light: [fx - 4, fy - 4] });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    st.line(ctx, [[fx + Math.cos(a) * 3, fy + Math.sin(a) * 3], [fx + Math.cos(a + 0.35) * 9.5, fy + Math.sin(a + 0.35) * 9.5]], 3060 + i, 0.45, i % 2 ? '#d8d6de' : '#6e6c78');
  }
  // the barrel: glossy white tube with two orange bands and a shine
  st.shape(ctx, roundRectPts(2, 9, 41, 14, 5.5), WHITE, 3004, { lw: 1.2, light: [12, 12] });
  st.shape(ctx, roundRectPts(11, 9.3, 7, 13.4, 1.2), ORANGE, 3005, { lw: 0.8, plain: true });
  st.shape(ctx, roundRectPts(26, 9.3, 9, 13.4, 1.2), ORANGE, 3006, { lw: 0.8, plain: true });
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(6, 11.4, 34, 1.6);
  ctx.fillStyle = 'rgba(120,60,20,0.18)';
  ctx.fillRect(6, 19.5, 34, 2);
  // a little sight on top
  st.shape(ctx, [[30, 9.3], [31.5, 5.5], [34, 5.5], [35, 9.3]], { base: '#3a3842', shade: '#1c1b22', light: '#6a6878' }, 3009, { lw: 0.6, plain: true });
  // muzzle: a dark bore inside a silver ring
  st.shape(ctx, ellipsePts(3.5, 16, 3.2, 6.2, 0, 18), STEEL, 3007, { lw: 0.8, plain: true });
  st.shape(ctx, ellipsePts(3.3, 16, 1.7, 3.8, 0, 14), BLACK, 3017, { lw: 0.4, plain: true });
}

/**
 * Chainsaw, 84 × 36, like the sketch: a black curved handle at the back (where
 * the hand grips it), a small motor, and a long YELLOW blade with the black
 * chain links running round it, ending in a dark tip. Two frames: the chain
 * links shift. The hand grips the handle at (70, 25).
 */
export const SAW = { w: 84, h: 36, gx: 70, gy: 25, tipX: 3 };
export function drawChainsaw(ctx: Ctx, st: Style, phase: number) {
  const BLADE: Fill = { base: '#ffd23a', shade: '#e8a910', light: '#fff1a0' };
  const DARK: Fill = { base: '#3a3842', shade: '#1c1b22', light: '#6a6878' };
  // the blade: long, rounded at the far end
  const y0 = 13;
  const y1 = 27;
  const blade: Pt[] = [[58, y0], [12, y0], [6, y0 + 1.5], [2.5, (y0 + y1) / 2], [6, y1 - 1.5], [12, y1], [58, y1]];
  st.shape(ctx, blade, BLADE, 3101, { lw: 1.3, light: [24, y0 + 3] });
  // the dark tip (sprocket nose)
  st.shape(ctx, [[14, y0 + 0.4], [7, y0 + 1.5], [3.2, (y0 + y1) / 2], [7, y1 - 1.5], [14, y1 - 0.4], [16, (y0 + y1) / 2]], DARK, 3102, { lw: 0.9 });
  ctx.fillStyle = '#9a98a8';
  ctx.beginPath();
  ctx.arc(9, (y0 + y1) / 2, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // the chain: black links in a grid along the blade, plus teeth on the edges
  ctx.strokeStyle = '#1c1b22';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(16, (y0 + y1) / 2);
  ctx.lineTo(57, (y0 + y1) / 2);
  for (let x = 18 + phase * 3; x < 57; x += 6) {
    ctx.moveTo(x, y0 + 1);
    ctx.lineTo(x, y1 - 1);
  }
  ctx.stroke();
  ctx.fillStyle = '#1c1b22';
  for (let x = 15 + phase * 3; x < 57; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, y0 + 0.5);
    ctx.lineTo(x + 3, y0 - 2.6);
    ctx.lineTo(x + 4, y0 + 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 3, y1 - 0.5);
    ctx.lineTo(x + 6, y1 + 2.6);
    ctx.lineTo(x + 7, y1 - 0.5);
    ctx.fill();
  }
  // shine along the blade
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(18, y0 + 2, 36, 1.4);
  // the motor block with a red pull-cord grip
  st.shape(ctx, [[56, 9], [68, 8], [70, 30], [56, 31]], DARK, 3110, { lw: 1.1, light: [60, 12] });
  for (const yy of [14, 18, 22]) st.line(ctx, [[58.5, yy], [66.5, yy]], 3111 + yy, 0.6, '#6a6878');
  st.shape(ctx, [[62, 30], [66, 30], [66, 34], [62, 34]], { base: '#e8463f', shade: '#b52c27', light: '#ff8a80' }, 3115, { lw: 0.7, plain: true });
  // the black curved handle, up and over the back like the sketch
  const handle: Pt[] = [[66, 10], [70, 3], [77, 1.5], [82, 5], [82.5, 14], [78, 26], [74, 30], [71, 27], [75, 22], [78.5, 13], [77.5, 7.5], [74, 7], [70, 12]];
  st.shape(ctx, handle, DARK, 3120, { lw: 1.1, light: [77, 4] });
  st.line(ctx, [[75, 4], [80, 7]], 3121, 0.7, '#8a8898');
}

/** Iron ball with a mouth, 30 × 30 (frames: mouth open / shut). */
export function drawFlailBall(ctx: Ctx, st: Style, open: boolean) {
  const cx = 15;
  const cy = 15;
  // little studs round the edge, then the ball
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    st.shape(ctx, [[cx + Math.cos(a - 0.22) * 11.5, cy + Math.sin(a - 0.22) * 11.5], [cx + Math.cos(a) * 15, cy + Math.sin(a) * 15], [cx + Math.cos(a + 0.22) * 11.5, cy + Math.sin(a + 0.22) * 11.5]], STEEL, 3210 + i, { lw: 0.7, plain: true });
  }
  st.shape(ctx, ellipsePts(cx, cy, 12.5, 12.5, 0, 32), IRON, 3201, { lw: 1.2, light: [cx - 5, cy - 5] });
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx - 5, cy - 6.5, 3, 1.8, -0.6, 0, Math.PI * 2);
  ctx.fill();
  // the mouth: a wide zig-zag grin
  const top = cy + 1;
  const bot = cy + (open ? 9 : 5);
  st.shape(ctx, [[cx - 9, top], [cx + 9, top - 1], [cx + 7, bot], [cx - 7, bot]], { base: '#5e1a2a', shade: '#33091a', light: '#8e2f45' }, 3202, { lw: 0.8 });
  const zig = (y: number, d: number): Pt[] => Array.from({ length: 9 }, (_, i) => [cx - 8 + i * 2, y + (i % 2 ? d * 3 : 0)] as Pt);
  if (open) st.shape(ctx, ellipsePts(cx, bot - 1.6, 4.5, 2, 0, 12), { base: '#e65a73', shade: '#b23a52', light: '#ff9cb0' }, 3207, { lw: 0.5, plain: true });
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
