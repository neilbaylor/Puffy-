/**
 * The mountain goat (Part 2), from the sketch: a round grey head with big
 * mismatched googly eyes and a flat little mouth, yellow curved horns with dark
 * rings, a spiky scribbly charcoal coat, a purple neck and four purple legs that
 * curl up at the bottom. Drawn facing LEFT like the other bad guys (the game
 * flips it to face where it's going). Frame is 64 × 64, feet on y = 62.
 */
import type { Ctx } from './draw';
import { ellipsePts, type Fill, type Pt, type Style } from './handdrawn';

export type GoatFrame = 'w0' | 'w1' | 'c0' | 'c1' | 'stun' | 'sp0' | 'sp1' | 'flop0' | 'flop1';
export const GOAT_FRAMES: GoatFrame[] = ['w0', 'w1', 'c0', 'c1', 'stun', 'sp0', 'sp1', 'flop0', 'flop1'];
/** Where the spit leaves the mouth in the 'sp1' frame (frame px, art facing left). */
export const GOAT_MOUTH = { x: 9, y: 29 };
export const GOAT_W = 64;
export const GOAT_H = 64;

const COAT: Fill = { base: '#4c4856', shade: '#2c2934', light: '#77727f' };
const HEAD: Fill = { base: '#bdb9c4', shade: '#8f8b99', light: '#e6e3ea' };
const LEG: Fill = { base: '#9a63cc', shade: '#6c3f9b', light: '#c8a2ee' };
const HORN: Fill = { base: '#f1e27a', shade: '#cdb748', light: '#fff6c0' };
const EYE: Fill = { base: '#ffffff', shade: '#e8e4ee', light: '#ffffff' };

/** A purple leg that curls up at the foot (the "C" hooks in the sketch). */
function leg(ctx: Ctx, st: Style, x: number, top: number, ground: number, dx: number, lift: number, seed: number) {
  const fy = ground - 1 - lift;
  const fx = x + dx;
  const pts: Pt[] = [
    [x, top],
    [x + dx * 0.5, (top + fy) / 2],
    [fx, fy - 5],
    [fx - 1, fy - 1.2],
    [fx + 1.4, fy + 0.4],
    [fx + 3.8, fy - 0.6],
    [fx + 4.2, fy - 2.8],
  ];
  st.line(ctx, pts, seed, 4.6);
  st.line(ctx, pts, seed, 3, LEG.base);
  st.line(ctx, pts.slice(0, 3).map(([px, py]) => [px - 0.7, py] as Pt), seed + 1, 0.9, LEG.light);
}

/** A curved, ringed horn from (x, y) sweeping back and up. */
function horn(ctx: Ctx, st: Style, x: number, y: number, dir: number, len: number, seed: number) {
  const tip: Pt = [x + dir * len * 0.8, y - len];
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const cx = x + dir * len * 0.8 * Math.pow(t, 1.7);
    const cy = y - len * t;
    const w = 5.4 * (1 - t) + 0.6;
    outer.push([cx - w * 0.9, cy + w * 0.3 * dir]);
    inner.push([cx + w * 0.9, cy - w * 0.3 * dir]);
  }
  st.shape(ctx, [...outer, tip, ...inner.reverse()], HORN, seed, { lw: 0.8, light: [x - 2, y - len * 0.6] });
  // the dark rings
  for (const t of [0.3, 0.55]) {
    const cx = x + dir * len * 0.8 * Math.pow(t, 1.7);
    const cy = y - len * t;
    const w = 4.8 * (1 - t) + 0.6;
    st.line(ctx, [[cx - w * 0.8, cy + 0.5], [cx + w * 0.8, cy - 0.5]], seed + t * 10, 0.55);
  }
}

/** The spiky coat: a shaggy body with zig-zag spikes along the back and a ragged fringe. */
function coatPts(cx: number, cy: number, rx: number, ry: number, spikes: number, phase: number): Pt[] {
  const pts: Pt[] = [];
  const N = 60;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    let r = 1;
    const top = Math.sin(a) < -0.15;
    const bottom = Math.sin(a) > 0.35;
    if (top) {
      // sharp zig-zag spikes along the back (triangle wave)
      const f = (((a - Math.PI) / Math.PI) * spikes * 0.5 + phase * 0.1) % 1;
      const peak = 1 - Math.abs(2 * ((f + 1) % 1) - 1);
      r += 0.85 * peak ** 1.6 * Math.min(1, (-Math.sin(a) - 0.15) * 2.2);
    }
    else if (bottom) r += 0.12 * Math.max(0, Math.sin(a * 9 + phase)) ** 2; // ragged underside
    else r += 0.06 * Math.sin(a * 11 + phase);
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return pts;
}

export function drawGoat(ctx: Ctx, ox: number, oy: number, frame: GoatFrame, st: Style) {
  if (frame === 'flop0' || frame === 'flop1') return drawFlop(ctx, ox, oy, frame === 'flop1', st);
  const ground = oy + 62;
  const rear = frame === 'sp0'; // head reared back, cheeks full of spit
  const spit = frame === 'sp1'; // head thrust forward: PTOO!
  const charge = frame === 'c0' || frame === 'c1';
  const stun = frame === 'stun';
  const step = frame === 'w0' || frame === 'c0' || rear ? 1 : -1;
  const lean = charge ? 1 : 0; // head down, body forward
  const bodyX = ox + 38 + lean * 2;
  const bodyY = ground - 25 + (charge ? 2 : 0) + (stun ? 1 : 0);

  // far legs (behind the body)
  const legTop = bodyY + 6;
  const stride = charge ? 6 : 3.5;
  leg(ctx, st, bodyX + 8, legTop, ground, -step * stride, step < 0 ? 2.5 : 0, 401);
  leg(ctx, st, bodyX - 9, legTop, ground, step * stride, step > 0 ? 2.5 : 0, 402);

  // coat
  st.shape(ctx, coatPts(bodyX, bodyY - 1, 17.5, 10, 13, stun ? 0.5 : step * 0.3), COAT, 410, { lw: 1, light: [bodyX - 6, bodyY - 10] });
  // scribbly fur strokes, like the crayon in the drawing
  for (const [a, b, c, d] of [
    [-12, -4, 2, -10],
    [-8, 2, 8, -6],
    [-2, 5, 13, -2],
    [-14, 1, -4, -5],
  ])
    st.line(ctx, [[bodyX + a, bodyY + b], [bodyX + c, bodyY + d]], 420 + a, 0.7, COAT.light);

  // neck
  const headX = ox + 15 - lean * 3 + (rear ? 5 : 0) - (spit ? 4 : 0);
  const headY = charge ? ground - 31 : ground - 40 - (rear ? 4 : 0) + (spit ? 1 : 0);
  const neck: Pt[] = [
    [bodyX - 13, bodyY - 4],
    [(bodyX - 13 + headX) / 2 + 1, (bodyY - 4 + headY) / 2 + 2],
    [headX + 4, headY + 6],
  ];
  st.line(ctx, neck, 430, 7);
  st.line(ctx, neck, 430, 5.2, LEG.base);

  // near legs (in front)
  leg(ctx, st, bodyX + 12, legTop + 1, ground, step * stride, step > 0 ? 2.5 : 0, 403);
  leg(ctx, st, bodyX - 5, legTop + 1, ground, -step * stride, step < 0 ? 2.5 : 0, 404);

  // horns (behind the head), head, face
  const hr = 10.5;
  const hTilt = charge ? -0.5 : rear ? 0.35 : spit ? -0.2 : 0;
  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(hTilt);
  horn(ctx, st, -5, -hr + 4, -1, 13, 440);
  horn(ctx, st, 5, -hr + 4, 1, 13, 445);
  st.shape(ctx, ellipsePts(0, 0, hr, hr * 0.98, 0, 36), HEAD, 450, { light: [-4, -5] });
  if (rear) {
    // puffed-out cheeks, squeezed eyes: here it comes...
    st.shape(ctx, ellipsePts(-7.5, 4, 4.6, 3.8, 0, 20), HEAD, 452, { lw: 0.8, light: [-9, 2] });
    ctx.fillStyle = 'rgba(255,120,150,0.45)';
    ctx.beginPath();
    ctx.ellipse(-7.5, 4.5, 2.6, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    st.line(ctx, [[-7, -3.5], [-4.2, -1.6], [-1.6, -3.4]], 461, 0.9);
    st.line(ctx, [[1.8, -3.8], [4.6, -1.8], [7.4, -3.8]], 466, 0.9);
    st.line(ctx, [[-3.5, 6], [-1.6, 6.6]], 481, 0.8);
    ctx.restore();
    return;
  }
  if (spit) {
    // big googly eyes, round "O" mouth and a fleck of spit
    const er = 4.6;
    for (const [ex, ey, r] of [[-4.2, -2.6, er * 0.95], [4.6, -3, er * 1.1]] as const) {
      st.shape(ctx, ellipsePts(ex, ey, r, r * 1.05, 0, 24), EYE, 462 + ex, { lw: 0.8, plain: true });
      ctx.fillStyle = st.ink;
      ctx.beginPath();
      ctx.arc(ex - 1.2, ey + 0.4, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    st.shape(ctx, ellipsePts(-3, 5.4, 2.6, 2.2, 0, 16), { base: '#5a2a3a', shade: '#3a1826', light: '#7a3a4e' }, 483, { lw: 0.8, plain: true });
    ctx.restore();
    return;
  }
  // googly eyes: one bigger than the other, pupils looking slightly different ways
  const eye = (ex: number, ey: number, er: number, px: number, py: number, seed: number) => {
    st.shape(ctx, ellipsePts(ex, ey, er, er * 1.05, 0, 24), EYE, seed, { lw: 0.8, plain: true });
    ctx.fillStyle = st.ink;
    ctx.beginPath();
    ctx.arc(ex + px, ey + py, er * 0.3, 0, Math.PI * 2);
    ctx.fill();
  };
  if (stun) {
    // dizzy: swirly eyes
    for (const [ex, er] of [[-4.2, 4], [4.6, 4.6]] as const) {
      st.shape(ctx, ellipsePts(ex, -2, er, er, 0, 24), EYE, 460 + ex, { lw: 0.8, plain: true });
      const sp: Pt[] = [];
      for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * Math.PI * 3.6;
        const r = 0.3 + (i / 20) * er * 0.75;
        sp.push([ex + Math.cos(a) * r, -2 + Math.sin(a) * r]);
      }
      st.line(ctx, sp, 470 + ex, 0.7);
    }
    st.line(ctx, [[-4, 5], [-1, 6.5], [2, 5], [5, 6.5]], 480, 0.8);
  } else {
    eye(-4.2, -2, 4, charge ? -1.4 : -0.6, 0.6, 460);
    eye(4.6, -2.4, 4.8, charge ? -1.2 : 1.2, 0.4, 465);
    // the flat little mouth (a grit when charging)
    st.line(ctx, charge ? [[-4, 5.5], [-1, 4.8], [2.5, 5.6]] : [[-2.5, 5.5], [2.8, 5.4]], 480, 0.85);
  }
  ctx.restore();

  if (charge) {
    // speed lines behind
    for (const dy of [-8, 0, 7]) st.line(ctx, [[ox + 58, bodyY + dy], [ox + 63, bodyY + dy]], 490 + dy, 0.7, '#ffffffcc');
  }
}

/**
 * Defeated: flopped on its back with all four hooves sticking up in the air,
 * X-ed out eyes and the tongue lolling out. flop1 = the legs mid-kick.
 */
function drawFlop(ctx: Ctx, ox: number, oy: number, kick: boolean, st: Style) {
  const ground = oy + 62;
  const bodyX = ox + 36;
  const bodyY = ground - 13;
  // the coat, upside down (spikes squashed into the ground)
  ctx.save();
  ctx.translate(bodyX, bodyY);
  ctx.rotate(Math.PI);
  st.shape(ctx, coatPts(0, 0, 17.5, 10, 13, 0.4), COAT, 410, { lw: 1, light: [4, 6] });
  ctx.restore();
  // pale belly
  st.shape(ctx, ellipsePts(bodyX, bodyY - 6, 12, 4.2, 0, 24), { base: '#8d8898', shade: '#6d6878', light: '#b4afbe' }, 412, { lw: 0.8, plain: true });
  // four stiff legs straight up, hooves curled, splayed a little (and kicking)
  const legs: [number, number, number][] = [
    [-13, -0.5, 0],
    [-5, -0.18, 1],
    [5, 0.18, 2],
    [13, 0.5, 3],
  ];
  for (const [dx, lean, i] of legs) {
    const k = kick ? (i % 2 ? 2.4 : -2.4) : 0;
    const bx = bodyX + dx;
    const by = bodyY - 8;
    const len = 15 + (i % 2) * 2;
    const tx = bx + Math.sin(lean) * len + k;
    const ty = by - Math.cos(lean) * len + Math.abs(k) * 0.4;
    const pts: Pt[] = [
      [bx, by],
      [(bx + tx) / 2 + k * 0.3, (by + ty) / 2],
      [tx, ty],
    ];
    st.line(ctx, pts, 500 + i, 4.6);
    st.line(ctx, pts, 500 + i, 3, LEG.base);
    // little split hoof at the top
    st.shape(ctx, ellipsePts(tx, ty - 1.6, 3.4, 2.5, lean, 14), { base: '#3a3344', shade: '#221d2a', light: '#5a5266' }, 510 + i, { lw: 0.7, plain: true });
    st.line(ctx, [[tx, ty - 3.2], [tx, ty - 0.4]], 520 + i, 0.6, '#8f86a0');
  }
  // the head flopped over on its side, lying by the ground
  const headX = ox + 13;
  const headY = ground - 10;
  const hr = 10;
  const neck: Pt[] = [
    [bodyX - 14, bodyY - 1],
    [headX + 8, headY - 1],
  ];
  st.line(ctx, neck, 530, 7);
  st.line(ctx, neck, 530, 5.2, LEG.base);
  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(-1.9);
  horn(ctx, st, -5, -hr + 4, -1, 12, 440);
  horn(ctx, st, 5, -hr + 4, 1, 12, 445);
  st.shape(ctx, ellipsePts(0, 0, hr, hr * 0.98, 0, 36), HEAD, 450, { light: [-4, -5] });
  // X X eyes
  for (const [ex, ey] of [[-4.2, -2.2], [4.4, -2.4]] as const) {
    st.line(ctx, [[ex - 2.6, ey - 2.6], [ex + 2.6, ey + 2.6]], 540 + ex, 1);
    st.line(ctx, [[ex + 2.6, ey - 2.6], [ex - 2.6, ey + 2.6]], 545 + ex, 1);
  }
  // goofy open mouth with the tongue hanging out
  st.line(ctx, [[-3.5, 5], [0, 6.2], [3.5, 5]], 550, 0.85);
  st.shape(ctx, [[-0.4, 5.6], [3.2, 5.4], [3.8, 9], [2.4, 11.4], [0.4, 10.6], [-0.6, 8]], { base: '#ff7aa2', shade: '#e0507e', light: '#ffb0c8' }, 555, { lw: 0.7 });
  st.line(ctx, [[1.6, 6.4], [1.7, 9.4]], 556, 0.5, '#c23a66');
  ctx.restore();
}

/** A glob of goat spit, flying RIGHT (rotate it to the direction of travel). Centre at (cx, cy). */
export function drawSpit(ctx: Ctx, cx: number, cy: number, st: Style) {
  const GOOP: Fill = { base: '#c8f26a', shade: '#8cc63a', light: '#f2ffd6' };
  // a teardrop: round front, a drippy tail behind
  const pts: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (i / 24) * Math.PI;
    pts.push([cx + 1 + Math.cos(a) * 5.2, cy + Math.sin(a) * 4.6]);
  }
  pts.push([cx - 4, cy + 3.2], [cx - 7, cy + 1.6], [cx - 10, cy + 0.4], [cx - 7.6, cy - 1], [cx - 4.4, cy - 3.6]);
  st.shape(ctx, pts, GOOP, 600, { lw: 0.8, light: [cx + 2, cy - 2] });
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(cx + 2.4, cy - 1.8, 1.6, 1, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // a couple of trailing droplets
  st.shape(ctx, ellipsePts(cx - 12.5, cy + 2.4, 1.4, 1.2, 0, 10), GOOP, 601, { lw: 0.6, plain: true });
  st.shape(ctx, ellipsePts(cx - 15.5, cy - 0.8, 0.9, 0.8, 0, 10), GOOP, 602, { lw: 0.5, plain: true });
}
