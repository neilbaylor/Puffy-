/**
 * The Plops (World 2: Plop Invasion), from the sketches: little poo guys.
 * A wide squashy bottom tier, a smaller dome on top with big oval googly eyes
 * and slit pupils, a pointy swirl tip curling up, leaf-shaped arms sticking
 * out, and two dark legs with curled-up feet. Some have a toothy shouting
 * mouth; the boss Plop wears a little gold crown. Drawn facing LEFT.
 * Frame 96 × 104, feet on y = 100.
 */
import type { Ctx } from './draw';
import { STYLES, ellipsePts, type Fill, type Pt, type Style } from './handdrawn';

export type PlopFrame = 'idle' | 'run0' | 'run1' | 'yell0' | 'yell1' | 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'idle1' | 'blink' | 'look' | 'grin' | 'hurt';
/**
 * The frames: walking, running and yelling, plus little moments while they stand about —
 * idle1 (breathing in: a touch taller and narrower), blink, look (a glance back over the
 * shoulder), grin (a sly toothy grin) — and hurt (squeezed-shut eyes, wobbly mouth).
 */
export const PLOP_FRAMES: PlopFrame[] = ['idle', 'run0', 'run1', 'yell0', 'yell1', 'walk0', 'walk1', 'walk2', 'walk3', 'idle1', 'blink', 'look', 'grin', 'hurt'];
/**
 * A proper four-step walk: [stride, front foot lift, back foot lift, body bob, arm swing].
 * Contact (feet apart, body low) → passing (one foot up, body high) → the other contact → passing.
 */
const WALK: Record<'walk0' | 'walk1' | 'walk2' | 'walk3', [number, number, number, number, number]> = {
  walk0: [9, 0, 2, 1.5, 1],
  walk1: [0, 0, 8, -3.5, 0],
  walk2: [-9, 2, 0, 1.5, -1],
  walk3: [0, 8, 0, -3.5, 0],
};
export const PLOP_W = 96;
export const PLOP_H = 104;

const BODY0: Fill = { base: '#8b5434', shade: '#5f3520', light: '#b98058' };
const BIG_BODY: Fill = { base: '#74432a', shade: '#4c2a18', light: '#a06a48' };
const SMALL_BODY: Fill = { base: '#9c6240', shade: '#6e4128', light: '#c99068' };
const CAPE: Fill = { base: '#d8243a', shade: '#9c1426', light: '#ff6a7a' };
const LEG: Fill = { base: '#6e3f25', shade: '#4a2716', light: '#9a6440' };
const EYE: Fill = { base: '#ffffff', shade: '#ece4dc', light: '#ffffff' };
const GOLD: Fill = { base: '#ffd23f', shade: '#d9a316', light: '#fff2a8' };

function leg(ctx: Ctx, st: Style, x: number, top: number, ground: number, dx: number, lift: number, seed: number) {
  const fy = ground - 3 - lift;
  const fx = x + dx;
  const pts: Pt[] = [
    [x - 4, top],
    [x + 4, top],
    [fx + 3.6, fy - 6],
    [fx + 1, fy + 1],
    [fx - 9, fy + 2],
    [fx - 10, fy - 3],
    [fx - 5, fy - 4],
    [fx - 3, fy - 7],
  ];
  st.shape(ctx, pts, LEG, seed, { lw: 1 });
}

/** The Plop family: three sizes (each with its own personality) and their King. */
export type PlopKind = 'small' | 'medium' | 'large' | 'king';
export const PLOP_KINDS: PlopKind[] = ['small', 'medium', 'large', 'king'];
/** How big each kind is shown in the game (relative). */
export const PLOP_SCALE: Record<PlopKind, number> = { small: 0.68, medium: 1, large: 1.32, king: 1.5 };

export function drawPlop(ctx: Ctx, ox: number, oy: number, f: PlopFrame, st: Style, kind: PlopKind | boolean = 'medium') {
  if (kind === true) kind = 'king';
  if (kind === false) kind = 'medium';
  const crowned = kind === 'king';
  const BODY = kind === 'large' ? BIG_BODY : kind === 'small' ? SMALL_BODY : BODY0;
  const ground = oy + 100;
  const cx = ox + 50;
  const walk = f in WALK ? WALK[f as keyof typeof WALK] : null;
  const run = f === 'run0' || f === 'run1' || !!walk;
  const yell = f === 'yell0' || f === 'yell1';
  // breathing in (idle1) stretches the body a little; a hit squashes it down
  const breathe = f === 'idle1' ? 1 : 0;
  const hurt = f === 'hurt';
  const bob = walk ? walk[3] : f === 'run1' || f === 'yell1' ? -3 : breathe ? -1.5 : hurt ? 2.5 : 0;
  const sqX = breathe ? 0.97 : hurt ? 1.07 : 1;
  const sqY = breathe ? 1.05 : hurt ? 0.9 : 1;
  const stride = walk ? walk[0] : f === 'run0' ? 7 : f === 'run1' ? -7 : 0;
  const liftF = walk ? walk[1] : stride > 0 ? 4 : 0;
  const liftB = walk ? walk[2] : stride < 0 ? 4 : 0;
  // (the arms swing against the legs)
  const swing = walk ? walk[4] * 0.32 : 0;

  // legs (behind the body)
  const botY = ground - 30 + bob;
  leg(ctx, st, cx + 10, botY + 8, ground, -stride, liftB, 2001);
  leg(ctx, st, cx - 12, botY + 8, ground, stride, liftF, 2002);

  // the King's royal cape, behind him
  if (kind === 'king') {
    st.shape(ctx, [[cx - 26, botY - 26], [cx + 26, botY - 26], [cx + 38, ground - 6], [cx + 18, ground - 2], [cx, ground - 6], [cx - 18, ground - 2], [cx - 38, ground - 6]], CAPE, 2005, { lw: 1.1, light: [cx - 14, botY - 10] });
    st.line(ctx, [[cx - 30, ground - 6], [cx + 30, ground - 6]], 2006, 2.2, '#ffffff');
  }

  // leaf-shaped arms out to the sides (waving up when yelling)
  const arm = (x: number, y: number, ang: number, seed: number) => {
    const len = 22;
    const tip: Pt = [x + Math.cos(ang) * len, y + Math.sin(ang) * len];
    const nx = -Math.sin(ang) * 6;
    const ny = Math.cos(ang) * 6;
    st.shape(ctx, [[x, y], [x + Math.cos(ang) * len * 0.5 + nx, y + Math.sin(ang) * len * 0.5 + ny], tip, [x + Math.cos(ang) * len * 0.5 - nx, y + Math.sin(ang) * len * 0.5 - ny]], BODY, seed, { lw: 1 });
  };
  const wave = f === 'yell1' ? 0.35 : 0;
  // (arms: up when yelling, flung out when hit, lifting a touch as it breathes in)
  const armL = yell ? 0.95 + wave : hurt ? 1.25 : run ? 0.45 - swing : 0.75 + breathe * 0.12;
  const armR = yell ? -0.95 - wave : hurt ? -1.25 : run ? -0.3 - swing : -0.75 - breathe * 0.12;
  arm(cx - 30 * sqX, botY - 4, Math.PI + armL, 2010);
  arm(cx + 30 * sqX, botY - 4, armR, 2011);

  // top tier: a smaller dome (behind the bottom tier, like the sketch), with the swirl tip
  const topY = botY - 27 * sqY;
  const tipH = kind === 'large' ? 1.25 : kind === 'small' ? 0.75 : 1;
  st.shape(ctx, [[cx - 8, topY - 12], [cx + 2, topY - 12 - 22 * tipH], [cx + 12, topY - 12 - 32 * tipH], [cx + 10, topY - 12 - 18 * tipH], [cx + 14, topY - 12]], BODY, 2030, { lw: 1.2, light: [cx + 4, topY - 26] });
  st.shape(ctx, ellipsePts(cx + 1, topY + 2, 26 * sqX, 19 * sqY, 0, 36), BODY, 2031, { lw: 1.3, light: [cx - 8, topY - 7] });
  // bottom tier: a wide squashy oval in front
  st.shape(ctx, ellipsePts(cx, botY, 35 * sqX, 21 * sqY, 0, 40), BODY, 2020, { lw: 1.3, light: [cx - 12, botY - 8] });

  // big googly eyes with slit pupils (looking left, the way they face)
  const eyeK = kind === 'small' ? 1.22 : kind === 'large' ? 0.9 : 1;
  const blink = f === 'blink';
  const look = f === 'look';
  const grin = f === 'grin';
  for (const [ex, er0, s] of [[cx - 10, 9, 1], [cx + 11, 8.4, 2]] as const) {
    const er = er0 * eyeK;
    if (blink) {
      // shut: a soft curved line where the eye was
      st.line(ctx, [[ex - er * 0.8, topY - 3], [ex, topY - 1], [ex + er * 0.8, topY - 3]], 2040 + s, 1.3);
      continue;
    }
    if (hurt) {
      // squeezed shut: > <
      const d = s === 1 ? 1 : -1;
      st.line(ctx, [[ex - er * 0.6 * d, topY - 3 - er * 0.5], [ex + er * 0.5 * d, topY - 3], [ex - er * 0.6 * d, topY - 3 + er * 0.5]], 2040 + s, 1.4);
      continue;
    }
    st.shape(ctx, ellipsePts(ex, topY - 3, er * 0.82, er * (grin ? 0.78 : 1), 0, 24), EYE, 2040 + s, { lw: 1 });
    ctx.fillStyle = st.ink;
    ctx.beginPath();
    // (glancing back over its shoulder: the pupils swing round the other way)
    const px = look ? ex + 2.6 : ex - 2.4;
    ctx.ellipse(px, topY - 3 + (yell ? -1 : grin ? 0.5 : 1), 1.5, er * (grin ? 0.32 : 0.42), 0, 0, Math.PI * 2);
    ctx.fill();
    if (grin) {
      // half-closed, sly lids
      st.line(ctx, [[ex - er * 0.85, topY - 3 - er * 0.2], [ex + er * 0.85, topY - 3 - er * 0.35]], 2048 + s, 1.2);
    }
  }
  if (kind === 'small') {
    // rosy cheeks
    ctx.fillStyle = 'rgba(255,120,140,0.45)';
    for (const bx of [cx - 22, cx + 22]) {
      ctx.beginPath();
      ctx.ellipse(bx, topY + 8, 4.5, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (look) {
    // one brow up: "huh?"
    st.line(ctx, [[cx - 18, topY - 14], [cx - 4, topY - 15]], 2045, 1.2);
    st.line(ctx, [[cx + 4, topY - 17], [cx + 17, topY - 20]], 2046, 1.2);
  } else if (hurt) {
    st.line(ctx, [[cx - 18, topY - 10], [cx - 5, topY - 15]], 2045, 1.3);
    st.line(ctx, [[cx + 4, topY - 15], [cx + 18, topY - 10]], 2046, 1.3);
  } else if (yell || grin || kind === 'large' || kind === 'king') {
    // angry brows
    st.line(ctx, [[cx - 19, topY - 15], [cx - 4, topY - 10]], 2045, 1.3);
    st.line(ctx, [[cx + 3, topY - 10], [cx + 19, topY - 15]], 2046, 1.3);
  }

  // mouth on the bottom tier: a shouting toothy "POOPA!" or a flat little line
  if (yell) {
    const open = f === 'yell0' ? 11 : 8;
    const m = ellipsePts(cx - 4, botY + 2, 12, open, 0, 28);
    st.shape(ctx, m, { base: '#fdf8ee', shade: '#e4d8c4', light: '#ffffff' }, 2050, { lw: 1.1 });
    // zig-zag teeth top and bottom
    const zig = (y: number, dir: number): Pt[] => Array.from({ length: 7 }, (_, i) => [cx - 14 + i * 3.4, y + (i % 2 ? dir * 3.6 : 0)] as Pt);
    st.line(ctx, zig(botY + 2 - open + 3, 1), 2051, 0.8);
    st.line(ctx, zig(botY + 2 + open - 3, -1), 2052, 0.8);
  } else if (hurt) {
    // OW: a wobbly little open mouth
    st.shape(ctx, ellipsePts(cx - 4, botY + 4, 5, 3.6, 0, 16), { base: '#5a2a18', shade: '#3a1a0e', light: '#7a3a22' }, 2050, { lw: 1 });
  } else if (grin) {
    // a sly, toothy grin, wider on one side
    const g: Pt[] = [[cx - 16, botY + 1], [cx - 8, botY + 7], [cx + 4, botY + 7.5], [cx + 12, botY]];
    st.shape(ctx, [...g, [cx + 4, botY + 3], [cx - 8, botY + 3]], { base: '#fdf8ee', shade: '#e4d8c4', light: '#ffffff' }, 2050, { lw: 1.1 });
    for (const tx of [cx - 9, cx - 3, cx + 3]) st.line(ctx, [[tx, botY + 3], [tx, botY + 7]], 2054 + tx, 0.6);
  } else if (look) {
    st.shape(ctx, ellipsePts(cx - 3, botY + 4, 2.6, 2.6, 0, 12), { base: '#5a2a18', shade: '#3a1a0e', light: '#7a3a22' }, 2050, { lw: 0.9 });
  } else if (kind === 'large' || kind === 'king') {
    // a grumpy underbite with two teeth poking up
    st.line(ctx, [[cx - 14, botY + 3], [cx - 4, botY + 6], [cx + 8, botY + 3]], 2050, 1.2);
    for (const tx of [cx - 10, cx + 3]) st.shape(ctx, [[tx, botY + 4.5], [tx + 2, botY - 0.5], [tx + 4, botY + 5]], { base: '#fdf8ee', shade: '#e4d8c4', light: '#ffffff' }, 2053 + tx, { lw: 0.7, plain: true });
  } else {
    st.line(ctx, [[cx - 12, botY + 4], [cx - 4, botY + 5], [cx + 6, botY + 4]], 2050, 1.1);
  }
  // the King's sceptre, held up in his right hand: a gold rod with bands, an orb and a cross on top
  if (kind === 'king') {
    const hx = cx + 30 * sqX + Math.cos(armR) * 18;
    const hy = botY - 4 + Math.sin(armR) * 18;
    const a = -Math.PI / 2 + 0.22; // (leaning out a little)
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const px = -uy;
    const py = ux;
    const at = (d: number, w: number): Pt => [hx + ux * d + px * w, hy + uy * d + py * w];
    // the rod, from just below his hand up to the orb
    st.shape(ctx, [at(-12, -1.8), at(24, -1.8), at(24, 1.8), at(-12, 1.8)], GOLD, 2070, { lw: 0.8, light: at(10, -2) });
    for (const d of [-11, 18]) st.shape(ctx, [at(d - 1.6, -2.8), at(d + 1.6, -2.8), at(d + 1.6, 2.8), at(d - 1.6, 2.8)], GOLD, 2073 + d, { lw: 0.7, plain: true });
    // the orb, with a red jewel, and a little cross on top
    const [ox, oy] = at(29, 0);
    st.shape(ctx, ellipsePts(ox, oy, 5.2, 5.2, 0, 18), GOLD, 2071, { lw: 0.9, light: [ox - 2, oy - 2] });
    st.shape(ctx, ellipsePts(ox, oy + 0.4, 2, 2, 0, 10), { base: '#e8463f', shade: '#b52c27', light: '#ff8a80' }, 2072, { lw: 0.4, plain: true });
    st.shape(ctx, [at(33.5, -1), at(41, -1), at(41, 1), at(33.5, 1)], GOLD, 2074, { lw: 0.6, plain: true });
    st.shape(ctx, [at(37.5, -3.6), at(39.5, -3.6), at(39.5, 3.6), at(37.5, 3.6)], GOLD, 2075, { lw: 0.6, plain: true });
    // his hand wrapped round it
    st.shape(ctx, ellipsePts(hx, hy, 4.6, 4, a, 14), BODY, 2076, { lw: 0.9, light: [hx - 2, hy - 2] });
  }

  if (crowned) {
    const by = topY - 14;
    st.shape(ctx, [[cx - 17, by + 3], [cx - 19, by - 15], [cx - 9, by - 5], [cx, by - 19], [cx + 9, by - 5], [cx + 19, by - 15], [cx + 17, by + 3]], GOLD, 2060, { lw: 1.1, light: [cx - 4, by - 8] });
    for (const [gx, gy] of [[-11, -2], [0, -5], [11, -2]] as const)
      st.shape(ctx, ellipsePts(cx + gx, by + gy, 2.4, 2.6, 0, 12), { base: '#e8463f', shade: '#b52c27', light: '#ff8a80' }, 2061 + gx, { lw: 0.5, plain: true });
  }
}

/** Queen Plop (Part 3's boss): pink cape, tiara, a bow on her swirl, short lashes, a touch of blush, pearls. */
const PINK: Fill = { base: '#e8579a', shade: '#b23272', light: '#ff9cc8' };
const PEARL: Fill = { base: '#fbf4ea', shade: '#dccfbf', light: '#ffffff' };
const SILVER: Fill = { base: '#f1d36a', shade: '#c79a2c', light: '#fff6c4' };

/**
 * Queen Plop (concept): a Plop with a pink royal cape, a tiara, a bow on her swirl, short
 * lashes, a touch of blush and a pearl necklace. Same frame layout as drawPlop.
 */
export function drawQueen(ctx: Ctx, ox: number, oy: number, f: PlopFrame, st: Style = STYLES.polished) {
  const ST = st;
  const ground = oy + 100;
  const cx = ox + 50;
  const hurt = f === 'hurt';
  const walk = f in WALK ? WALK[f as keyof typeof WALK] : null;
  const bob = walk ? walk[3] : f === 'run1' || f === 'yell1' ? -3 : f === 'idle1' ? -1.5 : hurt ? 2.5 : 0;
  const sqY = f === 'idle1' ? 1.05 : hurt ? 0.9 : 1;
  const botY = ground - 30 + bob;
  const topY = botY - 27 * sqY;
  // the pink cape, flowing out behind her (a frill along its hem)
  ST.shape(ctx, [[cx - 26, botY - 28], [cx + 26, botY - 28], [cx + 44, ground - 4], [cx + 22, ground], [cx, ground - 4], [cx - 22, ground], [cx - 44, ground - 4]], PINK, 3005, { lw: 1.1, light: [cx - 14, botY - 10] });
  drawPlop(ctx, ox, oy, f, st, 'medium');
  // a bow on the swirl's tip
  const tx = cx + 10;
  const ty = topY - 12 - 26;
  ST.shape(ctx, [[tx, ty], [tx - 11, ty - 7], [tx - 11, ty + 6]], PINK, 3010, { lw: 0.8 });
  ST.shape(ctx, [[tx, ty], [tx + 11, ty - 7], [tx + 11, ty + 6]], PINK, 3011, { lw: 0.8 });
  ST.shape(ctx, ellipsePts(tx, ty, 3, 3, 0, 10), PINK, 3012, { lw: 0.7 });
  // a tiara on her brow
  const by = topY - 14;
  ST.shape(ctx, [[cx - 16, by + 4], [cx - 12, by - 3], [cx - 6, by + 1], [cx, by - 9], [cx + 6, by + 1], [cx + 12, by - 3], [cx + 16, by + 4], [cx, by + 2]], SILVER, 3020, { lw: 0.9, light: [cx - 4, by - 4] });
  ST.shape(ctx, ellipsePts(cx, by - 3, 2.6, 3, 0, 12), PINK, 3021, { lw: 0.5, plain: true });
  // long lashes (curling out), even with her eyes shut
  ctx.strokeStyle = ST.ink;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (const [ex, er] of [[cx - 10, 9], [cx + 11, 8.4]] as const) {
    for (const k of [-0.7, -0.2]) {
      const a = -Math.PI / 2 + k + (ex < cx ? -0.25 : 0.25);
      const x0 = ex + Math.cos(a) * er * 0.82 - (ex < cx ? 2 : -2);
      const y0 = topY - 3 + Math.sin(a) * er;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + Math.cos(a) * 2, y0 + Math.sin(a) * 3, x0 + Math.cos(a - 0.4) * 4, y0 + Math.sin(a - 0.4) * 4 - 0.5);
      ctx.stroke();
    }
  }
  // a touch of blush
  ctx.fillStyle = 'rgba(255,110,150,0.3)';
  for (const bx of [cx - 23, cx + 23]) {
    ctx.beginPath();
    ctx.ellipse(bx, topY + 9, 5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // a string of pearls where her two tiers meet
  for (let k = -24; k <= 24; k += 5.5) {
    const py = botY - 17 + (k * k) / 120;
    ST.shape(ctx, ellipsePts(cx + k, py, 2.6, 2.6, 0, 10), PEARL, 3040 + k, { lw: 0.5, plain: true });
  }
}
