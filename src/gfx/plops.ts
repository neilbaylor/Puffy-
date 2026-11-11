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

/** The royals' brown (Queen Plop, the King). */
const BODY0: Fill = { base: '#8b5434', shade: '#5f3520', light: '#b98058' };
/** Each size of Plop its own shade of poo: small ones a light caramel, medium a reddish brown, the big ones dark chocolate. */
const SMALL_BODY: Fill = { base: '#a8743f', shade: '#7a4f26', light: '#d6a46c' };
const MED_BODY: Fill = { base: '#894a2c', shade: '#5c2f1a', light: '#b77856' };
const BIG_BODY: Fill = { base: '#5c3a22', shade: '#3a2213', light: '#8c6346' };
/**
 * More poo colours for a crowd of Plops (Part 2: the baseball teams, the parachutists, the climbs),
 * so a bunch of them never look like copies: caramel, reddish, chocolate, olive, golden, plum.
 */
export const PLOP_COLOURS: Fill[] = [
  SMALL_BODY,
  MED_BODY,
  BIG_BODY,
  { base: '#7a7034', shade: '#544c1e', light: '#a8a060' },
  { base: '#b88a3a', shade: '#86601e', light: '#e2b868' },
  { base: '#6e3a3e', shade: '#4a2226', light: '#9a6266' },
];
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

/** The King's extras drawPlop puts on him (the Plop King's own art turns the cape off: he has a robe instead). */
export const KING_LOOK = { cape: true, sceptre: true };

/** Dressing a Plop: `ref` puts it in a black-and-white striped referee's shirt (the volleyball referee: not someone to hit). */
export const PLOP_DRESS = { ref: false };

/** A referee's striped shirt over an oval body (centre cx, cy; radii rx, ry), with a little collar. */
export function drawRefShirt(ctx: Ctx, st: Style, cx: number, cy: number, rx: number, ry: number, top: number) {
  const body = ellipsePts(cx, cy, rx, ry, 0, 40);
  ctx.save();
  ctx.beginPath();
  body.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#fbfbf6';
  ctx.fillRect(cx - rx, top, rx * 2, cy + ry - top + 2);
  ctx.fillStyle = '#26232a';
  const w = rx / 4.2;
  for (let x = cx - rx + w * 0.5; x < cx + rx; x += w * 2) ctx.fillRect(x, top, w, cy + ry - top + 2);
  // the shirt's neckline
  ctx.strokeStyle = st.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - rx, top);
  ctx.quadraticCurveTo(cx, top + ry * 0.28, cx + rx, top);
  ctx.stroke();
  ctx.restore();
  // a little black collar V
  st.shape(ctx, [[cx - 7, top + 1], [cx, top + 7], [cx + 7, top + 1], [cx, top + 3.5]], { base: '#26232a', shade: '#26232a', light: '#555' }, 2099, { lw: 0.7, plain: true });
  ctx.strokeStyle = st.ink;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  body.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
}

export function drawPlop(ctx: Ctx, ox: number, oy: number, f: PlopFrame, st: Style, kind: PlopKind | boolean = 'medium', body?: Fill) {
  if (kind === true) kind = 'king';
  if (kind === false) kind = 'medium';
  const crowned = kind === 'king';
  const BODY = body ?? (kind === 'large' ? BIG_BODY : kind === 'small' ? SMALL_BODY : kind === 'medium' ? MED_BODY : BODY0);
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
  if (kind === 'king' && KING_LOOK.cape) {
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
  if (PLOP_DRESS.ref) drawRefShirt(ctx, st, cx, botY, 35 * sqX, 21 * sqY, botY - 9);

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
  if (kind === 'king' && KING_LOOK.sceptre) {
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
const PINK_LINING: Fill = { base: '#ffb3d4', shade: '#e07fae', light: '#ffe0ee' };
const LEATHER: Fill = { base: '#4a2412', shade: '#2e1408', light: '#7a4224' };
const RUBY: Fill = { base: '#e8463f', shade: '#b52c27', light: '#ff8a80' };

/**
 * Queen Plop, Part 3's boss: a Plop with a royal cape (pink, with a pale lining and a gold
 * trim), a jewelled tiara, a bow on her swirl, short lashes, a touch of blush, a string of
 * pearls, and her gold championship belt. Same frame layout as drawPlop.
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
  // the royal cape, flowing out behind her: a pale lining showing at the hem, the cape over it
  // with a couple of folds, and a gold trim along the bottom
  const flare = walk ? walk[0] * 0.25 : 0;
  ST.shape(ctx, [[cx - 24, botY - 26], [cx + 24, botY - 26], [cx + 48 + flare, ground - 2], [cx - 48 + flare, ground - 2]], PINK_LINING, 3004, { lw: 1, light: [cx, botY] });
  const hem: Pt[] = [[cx + 44 + flare, ground - 5], [cx + 22, ground - 1], [cx, ground - 5], [cx - 22, ground - 1], [cx - 44 + flare, ground - 5]];
  ST.shape(ctx, [[cx - 26, botY - 28], [cx + 26, botY - 28], ...hem], PINK, 3005, { lw: 1.1, light: [cx - 14, botY - 10] });
  for (let k = -40; k <= 40; k += 10) ST.shape(ctx, ellipsePts(cx + k + flare * (Math.abs(k) / 44), ground - 4 + (Math.abs(k) % 20 === 0 ? -1 : 2), 2.1, 2.1, 0, 10), SILVER, 3006 + k, { lw: 0.5, plain: true });
  for (const fx of [-20, 18]) st.line(ctx, [[cx + fx * 0.45, botY - 18], [cx + fx * 0.8 + flare, ground - 12]], 3007 + fx, 0.8, '#b23272');
  drawPlop(ctx, ox, oy, f, st, 'medium', BODY0);
  // her championship belt: leather round her middle, a big gold plate with a crown on it
  const beltY = botY + 11 + (hurt ? 1 : 0);
  ST.shape(ctx, [[cx - 33, beltY - 4], [cx - 16, beltY - 1], [cx + 16, beltY - 1], [cx + 33, beltY - 4], [cx + 31, beltY + 3], [cx + 15, beltY + 6], [cx - 15, beltY + 6], [cx - 31, beltY + 3]], LEATHER, 3050, { lw: 0.9, light: [cx - 10, beltY - 2] });
  for (const sx of [-26, -20, 20, 26]) ST.shape(ctx, ellipsePts(cx + sx, beltY + 1 + Math.abs(sx) * -0.06, 1.6, 1.6, 0, 8), SILVER, 3051 + sx, { lw: 0.4, plain: true });
  ST.shape(ctx, ellipsePts(cx, beltY + 2, 12, 8, 0, 24), SILVER, 3060, { lw: 1, light: [cx - 4, beltY - 2] });
  ST.shape(ctx, ellipsePts(cx, beltY + 2, 8.5, 5.4, 0, 20), { base: '#ffe27a', shade: '#d9a316', light: '#fff6c4' }, 3061, { lw: 0.6, plain: true });
  ST.shape(ctx, [[cx - 5, beltY + 4], [cx - 6, beltY - 1], [cx - 2.5, beltY + 1.5], [cx, beltY - 2], [cx + 2.5, beltY + 1.5], [cx + 6, beltY - 1], [cx + 5, beltY + 4]], RUBY, 3062, { lw: 0.5, plain: true });
  // a bow on the swirl's tip, with ribbon tails
  const tx = cx + 10;
  const ty = topY - 12 - 26;
  st.line(ctx, [[tx - 1, ty + 2], [tx - 4, ty + 9], [tx - 2, ty + 13]], 3013, 1.6, '#b23272');
  st.line(ctx, [[tx + 1, ty + 2], [tx + 5, ty + 8], [tx + 4, ty + 13]], 3014, 1.6, '#b23272');
  ST.shape(ctx, [[tx, ty], [tx - 12, ty - 8], [tx - 13, ty + 1], [tx - 11, ty + 7]], PINK, 3010, { lw: 0.8, light: [tx - 8, ty - 5] });
  ST.shape(ctx, [[tx, ty], [tx + 12, ty - 8], [tx + 13, ty + 1], [tx + 11, ty + 7]], PINK, 3011, { lw: 0.8, light: [tx + 6, ty - 5] });
  ST.shape(ctx, ellipsePts(tx, ty, 3.4, 3.4, 0, 12), PINK, 3012, { lw: 0.7 });
  // a jewelled tiara on her brow (five points; a ruby in the middle, pink gems either side)
  const by = topY - 14;
  ST.shape(ctx, [[cx - 18, by + 4], [cx - 15, by - 4], [cx - 10, by + 1], [cx - 6, by - 7], [cx - 2, by], [cx, by - 12], [cx + 2, by], [cx + 6, by - 7], [cx + 10, by + 1], [cx + 15, by - 4], [cx + 18, by + 4], [cx, by + 2.5]], SILVER, 3020, { lw: 0.9, light: [cx - 4, by - 6] });
  ST.shape(ctx, ellipsePts(cx, by - 3, 2.8, 3.4, 0, 12), RUBY, 3021, { lw: 0.5, plain: true });
  for (const gx of [-8, 8]) ST.shape(ctx, ellipsePts(cx + gx, by - 0.5, 1.7, 1.9, 0, 10), PINK, 3022 + gx, { lw: 0.4, plain: true });
  // (a glint on it)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - 13, by - 7);
  ctx.lineTo(cx - 13, by - 2);
  ctx.moveTo(cx - 15.5, by - 4.5);
  ctx.lineTo(cx - 10.5, by - 4.5);
  ctx.stroke();
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

/** Queen Plop knocked out: the frame (art units) and where the mat is in it. */
export const QUEEN_KO_W = 160;
export const QUEEN_KO_H = 80;
export const QUEEN_KO_GROUND = 72;
export const QUEEN_KO_FRAMES = ['ko0', 'ko1', 'ko2', 'ko3'] as const;

/**
 * Queen Plop, K.O.'d: flat out on the mat on her spread-out cape, swirly dizzy eyes, tongue
 * lolling, legs in the air, her swirl flopped over with its bow drooping, the tiara knocked off
 * and her pearls scattered. Four frames (`phase` 0–3): she breathes, the eyes spin, the tongue
 * and the legs wobble. Facing left like the rest; (ox, oy) is the frame's top-left.
 */
export function drawQueenKO(ctx: Ctx, ox: number, oy: number, phase: number, st: Style = STYLES.polished) {
  const ST = st;
  const G = oy + QUEEN_KO_GROUND;
  const cx = ox + QUEEN_KO_W / 2 + 4;
  const ph = (phase / 4) * Math.PI * 2;
  const breathe = Math.sin(ph); // −1…1
  const BODY = BODY0;
  // her cape, spread flat on the mat under her (lining, then pink, gold beads round the edge)
  ST.shape(ctx, ellipsePts(cx - 2, G - 3, 70, 7.5, 0, 48), PINK_LINING, 3101, { lw: 1, plain: true });
  ST.shape(ctx, ellipsePts(cx + 2, G - 4, 62, 6, 0.02, 48), PINK, 3102, { lw: 1, light: [cx - 20, G - 7] });
  for (let k = -56; k <= 56; k += 12) ST.shape(ctx, ellipsePts(cx + 2 + k, G - 4 + (k * k) / 1600 + 4.5, 1.9, 1.9, 0, 10), SILVER, 3103 + k, { lw: 0.4, plain: true });
  // the tiara, knocked off and lying on the mat in front of her (tipped over)
  {
    const tx = ox + 18;
    const ty = G - 5;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(-0.55);
    ST.shape(ctx, [[-14, 4], [-11, -3], [-7, 1], [-4, -6], [-1, 0], [0, -10], [1, 0], [4, -6], [7, 1], [11, -3], [14, 4], [0, 2.5]], SILVER, 3110, { lw: 0.8, light: [-3, -5] });
    ST.shape(ctx, ellipsePts(0, -2.5, 2.4, 2.9, 0, 12), RUBY, 3111, { lw: 0.4, plain: true });
    ctx.restore();
  }
  // a few pearls from her necklace, rolled away across the mat
  for (const [px, py, r] of [[ox + 34, G - 4, 2.4], [ox + 42, G - 2.5, 2.1], [ox + 128, G - 3, 2.4], [ox + 137, G - 1.5, 2], [ox + 146, G - 4, 1.8]] as const)
    ST.shape(ctx, ellipsePts(px, py, r, r, 0, 10), PEARL, 3120 + px, { lw: 0.5, plain: true });
  // legs up in the air (behind her), feet curled, wobbling
  // (the legs kick feebly, one then the other)
  for (const [lx, ang, seed, off] of [[cx + 26, -0.7, 3130, 0], [cx + 36, -0.35, 3131, Math.PI]] as const) {
    const a = ang + Math.sin(ph + off) * 0.28;
    const fx = lx + Math.cos(a) * 26;
    const fy = G - 12 + Math.sin(a) * 26;
    ST.shape(ctx, [[lx - 4, G - 12], [lx + 4, G - 10], [fx + 3, fy + 1], [fx + 6, fy - 4], [fx - 1, fy - 6], [fx - 3, fy - 1]], LEG, seed, { lw: 1 });
  }
  // arms flopped out flat on the mat either side
  const flop = (x: number, y: number, ang: number, seed: number) => {
    const len = 22;
    const tip: Pt = [x + Math.cos(ang) * len, y + Math.sin(ang) * len];
    const nx = -Math.sin(ang) * 5.5;
    const ny = Math.cos(ang) * 5.5;
    ST.shape(ctx, [[x, y], [x + Math.cos(ang) * len * 0.5 + nx, y + Math.sin(ang) * len * 0.5 + ny], tip, [x + Math.cos(ang) * len * 0.5 - nx, y + Math.sin(ang) * len * 0.5 - ny]], BODY, seed, { lw: 1 });
  };
  flop(cx - 40, G - 10, Math.PI + 0.12 + Math.sin(ph) * 0.18, 3140);
  flop(cx + 40, G - 10, -0.12 - Math.sin(ph + 1.5) * 0.18, 3141);
  // the body, squashed flat: a wide bottom tier, the top tier behind it, breathing
  // (a big slow breath in and out)
  const sq = 1 + breathe * 0.1;
  const topY = G - 27 - breathe * 3.2;
  // the swirl, flopped over to the front (left), its bow drooping off the end
  const tipWob = Math.sin(ph + 0.8) * 4.5;
  ST.shape(ctx, [[cx - 4, topY - 8], [cx - 14, topY - 17 + tipWob], [cx - 30, topY - 16 + tipWob], [cx - 38, topY - 9 + tipWob], [cx - 31, topY - 10 + tipWob], [cx - 17, topY - 10], [cx + 8, topY - 7]], BODY, 3150, { lw: 1.1, light: [cx - 18, topY - 14] });
  {
    const bx = cx - 38;
    const by = topY - 8 + tipWob;
    st.line(ctx, [[bx, by + 1], [bx - 2, by + 8], [bx + 1, by + 12]], 3151, 1.5, '#b23272');
    st.line(ctx, [[bx + 2, by + 1], [bx + 5, by + 8], [bx + 3, by + 12]], 3152, 1.5, '#b23272');
    ST.shape(ctx, [[bx, by], [bx - 10, by - 2], [bx - 9, by + 6], [bx - 4, by + 7]], PINK, 3153, { lw: 0.7 });
    ST.shape(ctx, [[bx, by], [bx + 7, by + 5], [bx + 3, by + 9], [bx - 1, by + 6]], PINK, 3154, { lw: 0.7 });
    ST.shape(ctx, ellipsePts(bx, by + 1, 2.8, 2.8, 0, 10), PINK, 3155, { lw: 0.6 });
  }
  ST.shape(ctx, ellipsePts(cx - 2, topY + 2, 28 * sq, 13 / sq, 0, 36), BODY, 3160, { lw: 1.2, light: [cx - 12, topY - 4] });
  ST.shape(ctx, ellipsePts(cx, G - 12, 44 * sq, 13 / sq, 0, 44), BODY, 3161, { lw: 1.3, light: [cx - 16, G - 18] });
  // what's left of her pearls, round her middle (a few missing)
  for (let k = -26; k <= 26; k += 5.2) {
    if (Math.abs(k - 10.4) < 1 || Math.abs(k + 15.6) < 1) continue;
    ST.shape(ctx, ellipsePts(cx + k, G - 19 + (k * k) / 150, 2.3, 2.3, 0, 10), PEARL, 3170 + k, { lw: 0.45, plain: true });
  }
  // her belt, gone crooked, the gold plate tipped up
  ST.shape(ctx, [[cx - 40, G - 9], [cx - 14, G - 7], [cx + 14, G - 6], [cx + 40, G - 8], [cx + 39, G - 3], [cx + 14, G - 1], [cx - 14, G - 2], [cx - 39, G - 4]], LEATHER, 3180, { lw: 0.8, plain: true });
  ctx.save();
  ctx.translate(cx + 4, G - 5);
  ctx.rotate(0.22);
  ST.shape(ctx, ellipsePts(0, 0, 10, 6.5, 0, 22), SILVER, 3181, { lw: 0.9, light: [-3, -3] });
  ST.shape(ctx, [[-4, 2], [-5, -2], [-2, 0.5], [0, -3], [2, 0.5], [5, -2], [4, 2]], RUBY, 3182, { lw: 0.4, plain: true });
  ctx.restore();
  // dizzy eyes: big googly whites with spirals going round
  const eyes: [number, number, number, number][] = [[cx - 15, topY - 1, 7.5, 8.5], [cx + 5, topY - 2, 7, 8]];
  eyes.forEach(([ex, ey, rx, ry], i) => {
    ST.shape(ctx, ellipsePts(ex, ey, rx, ry, 0, 24), EYE, 3190 + i, { lw: 1 });
    const sp: Pt[] = [];
    const turn = ph * (i ? -1 : 1);
    for (let n = 0; n <= 36; n++) {
      const t = n / 36;
      const a = turn + t * Math.PI * 4.4;
      const r = 0.4 + t * (rx - 2.2);
      sp.push([ex + Math.cos(a) * r, ey + Math.sin(a) * r * (ry / rx)]);
    }
    st.line(ctx, sp, 3195 + i, 0.9);
  });
  // long lashes, all askew
  ctx.strokeStyle = ST.ink;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (const [ex, ey, dir] of [[cx - 15, topY - 9.5, -1], [cx + 5, topY - 10, 1]] as const) {
    ctx.beginPath();
    ctx.moveTo(ex + dir * 2, ey);
    ctx.quadraticCurveTo(ex + dir * 4, ey - 3, ex + dir * 7, ey - 3);
    ctx.stroke();
  }
  // mouth hanging open, tongue lolling out to the side (wobbling)
  const mx = cx - 6;
  const my = topY + 9;
  ST.shape(ctx, ellipsePts(mx, my, 6, 3.6 + breathe * 0.6, 0.15, 20), { base: '#5e1a2a', shade: '#3e1020', light: '#7e2a3a' }, 3200, { lw: 0.8, plain: true });
  const tw = Math.sin(ph) * 4.2;
  ST.shape(ctx, [[mx - 4, my + 1], [mx - 9 + tw, my + 7], [mx - 6 + tw, my + 11], [mx - 1 + tw * 0.5, my + 8], [mx + 1, my + 2]], { base: '#ff7d93', shade: '#e0566e', light: '#ffb3c0' }, 3201, { lw: 0.7 });
  // a little sweat drop, and blush
  ST.shape(ctx, [[cx + 19, topY - 10], [cx + 22, topY - 4], [cx + 19, topY - 1.5], [cx + 16.5, topY - 4]], { base: '#bfe8ff', shade: '#8cc8ea', light: '#ffffff' }, 3210, { lw: 0.6 });
  ctx.fillStyle = 'rgba(255,110,150,0.3)';
  for (const bx of [cx - 22, cx + 15]) {
    ctx.beginPath();
    ctx.ellipse(bx, topY + 6, 4.5, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
