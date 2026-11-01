/**
 * Basketball finale art: King Puff Ball (from the sketch), the ball, the hoop
 * (red rounded backboard like the sketch) and King Puff Ball's Basketball
 * Palace drawn in a pseudo-3D perspective. Bolder, glossier and darker than
 * the platforming world so the finale feels like a different place.
 */
import { rng, type Ctx } from './draw';
import { STYLES, ellipsePts, paddlePts, roundRectPts, trace, type Fill, type Pt } from './handdrawn';
import { fluffPts } from './baddies';

const st = () => STYLES.polished;

// ───────────────────────────── King Puff Ball (frame 130 × 150, feet at y 146) ──

export type KingFrame = 'idle0' | 'idle1' | 'shoot' | 'laugh0' | 'laugh1' | 'sad' | 'run0' | 'run1';
export const KING_FRAMES: KingFrame[] = ['idle0', 'idle1', 'shoot', 'laugh0', 'laugh1', 'sad', 'run0', 'run1'];
export const KING_W = 130;
export const KING_H = 150;

const KING: Fill = { base: '#f28a2e', shade: '#c55a16', light: '#ffc07a' };
const KING_LIMB: Fill = { base: '#e7791f', shade: '#b04d10', light: '#ffae62' };
const GOLD: Fill = { base: '#ffd23f', shade: '#d9a316', light: '#fff2a8' };
const EYE: Fill = { base: '#ffffff', shade: '#e8e0d4', light: '#ffffff' };
const TOOTH: Fill = { base: '#fffaf0', shade: '#e3d8c6', light: '#ffffff' };

/** King Puff Ball, facing left (toward the hoop when he stands on the right). */
export function drawKing(ctx: Ctx, ox: number, oy: number, f: KingFrame) {
  const S = st();
  const ground = oy + 146;
  const cx = ox + 66;
  const laugh = f.startsWith('laugh');
  const run = f.startsWith('run');
  const bob = f === 'idle1' || f === 'laugh1' || f === 'run1' ? -3 : 0;
  const rx = 40;
  const ry = 38;
  const cy = ground - 34 - ry + bob;

  // legs: thin, curled feet (like the sketch)
  const leg = (hx: number, dx: number, lift: number, seed: number) => {
    const fx = cx + hx + dx;
    const fy = ground - 6 - lift;
    S.line(ctx, [[cx + hx, cy + ry - 8], [cx + hx + dx * 0.5, cy + ry + 12], [fx, fy]], seed, 3.4);
    S.line(ctx, [[cx + hx, cy + ry - 8], [cx + hx + dx * 0.5, cy + ry + 12], [fx, fy]], seed, 1.9, KING_LIMB.base);
    S.shape(ctx, ellipsePts(fx - 6, fy + 1, 10, 6, -0.1), KING_LIMB, seed + 1, { lw: 1 });
  };
  const step = f === 'run0' ? 10 : f === 'run1' ? -10 : 0;
  leg(14, -step, run && step < 0 ? 6 : 0, 1500);
  leg(-14, step, run && step > 0 ? 6 : 0, 1510);

  // arms: up and waving (idle), clutching belly (laugh), flailing (sad/run)
  const armA = laugh ? 0.9 : f === 'sad' || run ? -2.2 : f === 'shoot' ? -0.2 : -0.75 + bob * 0.04;
  const armB = laugh ? Math.PI - 0.9 : f === 'sad' || run ? Math.PI + 2.2 : f === 'shoot' ? Math.PI + 0.2 : Math.PI + 0.75 - bob * 0.04;
  S.shape(ctx, paddlePts(cx + rx - 8, cy - 2, 30, 13, armA), KING_LIMB, 1520, { lw: 1.1 });
  S.shape(ctx, paddlePts(cx - rx + 8, cy - 2, 30, 13, armB), KING_LIMB, 1521, { lw: 1.1 });

  // body: fluffy puffball
  S.shape(ctx, fluffPts(cx, cy, rx, ry, 10, 0.07, 0.4), KING, 1530, { light: [cx - 14, cy - 16], lw: 1.4 });

  // crown: three gold points with orange gems
  const crownY = cy - ry + 6;
  const crown: Pt[] = [
    [cx - 28, crownY + 6],
    [cx - 26, crownY - 26],
    [cx - 14, crownY - 6],
    [cx, crownY - 32],
    [cx + 14, crownY - 6],
    [cx + 26, crownY - 26],
    [cx + 28, crownY + 6],
  ];
  S.shape(ctx, crown, GOLD, 1540, { lw: 1.2, light: [cx - 10, crownY - 16] });
  for (const [gx, gy] of [[-22, -8], [0, -12], [22, -8]] as const)
    S.shape(ctx, ellipsePts(cx + gx, crownY + gy, 4, 4.6, 0, 14), { base: '#ff7a2e', shade: '#c9461a', light: '#ffc08a' }, 1541 + gx, { lw: 0.7 });

  // eyes: one big, one smaller, angry V brow (like the sketch)
  const sad = f === 'sad' || run;
  if (laugh) {
    for (const [ex, w] of [[cx - 16, 11], [cx + 12, 9]] as const)
      S.line(ctx, [[ex - w, cy - 10], [ex, cy - 18], [ex + w, cy - 10]], 1550 + ex, 1.5);
  } else {
    for (const [ex, ey, er, s] of [[cx - 16, cy - 12, 13, 1], [cx + 13, cy - 13, 10, 2]] as const) {
      S.shape(ctx, ellipsePts(ex, ey, er, er * 1.05, 0, 28), EYE, 1560 + s, { lw: 1.1 });
      const px = sad ? 2 : -er * 0.35;
      ctx.fillStyle = S.ink;
      ctx.beginPath();
      ctx.ellipse(ex + px, ey + (sad ? 3 : 1), er * 0.3, er * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + px - 1.5, ey - 1, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (sad) {
      S.line(ctx, [[cx - 28, cy - 24], [cx - 10, cy - 32]], 1570, 1.6);
      S.line(ctx, [[cx + 4, cy - 32], [cx + 22, cy - 26]], 1571, 1.6);
    } else {
      S.line(ctx, [[cx - 30, cy - 34], [cx - 14, cy - 27], [cx - 4, cy - 20]], 1570, 1.8);
      S.line(ctx, [[cx + 2, cy - 22], [cx + 10, cy - 28], [cx + 22, cy - 30]], 1571, 1.5);
    }
  }

  // mouth: toothy grin / wide open (shoot, laugh) / wobbly (sad)
  const mx = cx - 2;
  const my = cy + 12;
  if (f === 'shoot' || laugh) {
    const open = f === 'shoot' ? 15 : 18;
    const mouth = ellipsePts(mx, my + 2, 20, open, 0, 36);
    S.shape(ctx, mouth, { base: '#5e1a2a', shade: '#33091a', light: '#8e2f45' }, 1580, { lw: 1.2 });
    ctx.save();
    trace(ctx, mouth);
    ctx.clip();
    for (let i = 0; i < 6; i++) S.shape(ctx, [[mx - 18 + i * 6.5, my + 2 - open], [mx - 11.5 + i * 6.5, my + 2 - open], [mx - 14.75 + i * 6.5, my + 2 - open + 8]], TOOTH, 1590 + i, { lw: 0.6, plain: true });
    if (laugh) S.shape(ctx, ellipsePts(mx, my + open - 2, 11, 6, 0, 20), { base: '#e65a73', shade: '#b23a52', light: '#ff9cb0' }, 1599, { lw: 0.7, plain: true });
    ctx.restore();
  } else if (sad) {
    S.line(ctx, [[mx - 14, my + 8], [mx - 7, my + 3], [mx, my + 7], [mx + 7, my + 2], [mx + 14, my + 7]], 1585, 1.3);
  } else {
    // grin with two rows of zigzag teeth
    const grin: Pt[] = [];
    for (let i = 0; i <= 12; i++) grin.push([mx - 20 + i * (40 / 12), my - 3 + Math.sin((i / 12) * Math.PI) * -2]);
    for (let i = 12; i >= 0; i--) grin.push([mx - 20 + i * (40 / 12), my + 3 + Math.sin((i / 12) * Math.PI) * 10]);
    S.shape(ctx, grin, TOOTH, 1580, { lw: 1.2, plain: true });
    const zig: Pt[] = [];
    for (let i = 0; i <= 10; i++) zig.push([mx - 18 + i * 3.6, my + 3 + (i % 2 ? 6 : 0) + Math.sin((i / 10) * Math.PI) * 3]);
    S.line(ctx, zig, 1581, 0.8);
  }
}

// ───────────────────────────── ball ──

/** Basketball, centre (cx, cy), radius r, rotated by `spin`. */
export function drawBall(ctx: Ctx, cx: number, cy: number, r: number, spin = 0) {
  const S = st();
  S.shape(ctx, ellipsePts(cx, cy, r, r, 0, 40), { base: '#f2802e', shade: '#c2531a', light: '#ffb87a' }, 1601, { lw: 0.9, light: [cx - r * 0.4, cy - r * 0.45] });
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  ctx.strokeStyle = S.ink;
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * r * 1.05, 0, r * 0.62, r * 1.1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ───────────────────────────── hoop ──

export const HOOP = {
  /** Rim centre in stage coordinates. */
  rimX: 860,
  rimY: 250,
  rimRX: 44,
  rimRY: 11,
  /** Where the pole meets the floor. */
  baseY: 420,
  /** Backboard scale. */
  k: 1.3,
};

/** Backboard + pole (drawn behind everything at the hoop). */
export function drawBackboard(ctx: Ctx) {
  const S = st();
  const { rimX: x, rimY: y, baseY } = HOOP;
  // pole (unscaled), then the board scaled around the rim
  S.shape(ctx, roundRectPts(x - 7, y, 14, baseY - y, 4), { base: '#2c2c3a', shade: '#16161f', light: '#5a5a70' }, 1700, { lw: 1 });
  S.shape(ctx, ellipsePts(x, baseY, 32, 9, 0, 24), { base: '#3a3a4c', shade: '#22222e', light: '#5a5a70' }, 1701, { lw: 1 });
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(HOOP.k, HOOP.k);
  ctx.translate(-x, -y);
  drawBoard(ctx, x, y);
  ctx.restore();
}

function drawBoard(ctx: Ctx, x: number, y: number) {
  const S = st();
  // the red rounded backboard (like the sketch): flat bottom, dome top
  const bb: Pt[] = [];
  const w = 78;
  const top = y - 118;
  const bottom = y - 10;
  bb.push([x - w, bottom]);
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI + (i / 20) * Math.PI;
    bb.push([x + Math.cos(a) * w, top + 40 + Math.sin(a) * 52]);
  }
  bb.push([x + w, bottom]);
  S.shape(ctx, bb, { base: '#e8463f', shade: '#a82a26', light: '#ff8f84' }, 1702, { lw: 1.6, light: [x - 30, top + 20] });
  // black target square over the rim (the scribbled black patch in the sketch)
  S.shape(ctx, roundRectPts(x - 26, y - 64, 52, 50, 6), { base: '#1d1d26', shade: '#0d0d12', light: '#3a3a4a' }, 1703, { lw: 1.2 });
  S.shape(ctx, roundRectPts(x - 20, y - 58, 40, 38, 4), { base: '#e8463f', shade: '#a82a26', light: '#ff8f84' }, 1704, { lw: 0.9, plain: true });
}

/** Back half of the rim (behind the ball). */
export function drawRimBack(ctx: Ctx) {
  const { rimX: x, rimY: y, rimRX: rx, rimRY: ry } = HOOP;
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ff7a2e';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
}

/** Front half of the rim + the net, drawn into a canvas whose origin is the rim centre. `stretch` 0..1 swishes the net. */
export function drawRimFront(ctx: Ctx, ox: number, oy: number, stretch = 0) {
  const { rimRX: rx, rimRY: ry } = HOOP;
  // net
  const depth = 42 + stretch * 16;
  const bottomR = rx * (0.55 - stretch * 0.12);
  ctx.strokeStyle = '#ffffffdd';
  ctx.lineWidth = 1.6;
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = Math.PI * t;
    const x0 = ox + Math.cos(a) * rx;
    const y0 = oy + Math.sin(a) * ry;
    const x1 = ox + Math.cos(a) * bottomR + (t - 0.5) * 4;
    const y1 = oy + depth + Math.sin(a) * ry * 0.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + (t - 0.5) * 6, (y0 + y1) / 2 + 4, x1, y1);
    ctx.stroke();
  }
  for (let k = 1; k <= 3; k++) {
    const yk = oy + (depth * k) / 3.4;
    const rk = rx - (rx - bottomR) * (k / 3.4);
    ctx.beginPath();
    ctx.ellipse(ox, yk, rk, ry * (1 - k * 0.15), 0, 0, Math.PI);
    ctx.stroke();
  }
  // rim front
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = '#ff7a2e';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = '#ffc08a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(ox, oy - 1, rx - 2, ry - 2, 0, 0.3, Math.PI - 0.3);
  ctx.stroke();
}

// ───────────────────────────── arena (1600 × 900, the 1280 × 720 stage sits at +160, +90) ──

export const ARENA_W = 1600;
export const ARENA_H = 900;
export const STAGE_OX = 160;
export const STAGE_OY = 90;
/** Floor horizon and vanishing point (stage coordinates). */
const HORIZON = 330;
const VPX = 860;
const VPY = 120;

/** Shooting spots on the floor (stage coordinates, feet). */
export const SPOTS = {
  hero: { x: 400, y: 640 },
  king: { x: 1010, y: 650 },
};

export function drawArena(ctx: Ctx) {
  const S = st();
  const r = rng(808);
  ctx.save();
  ctx.translate(STAGE_OX, STAGE_OY);
  const L = -STAGE_OX;
  const R = 1280 + STAGE_OX;
  const T = -STAGE_OY;
  const B = 720 + STAGE_OY;

  // back wall: deep royal purple with gold trim
  const wall = ctx.createLinearGradient(0, T, 0, HORIZON);
  wall.addColorStop(0, '#1c0f3a');
  wall.addColorStop(0.6, '#3b1d6e');
  wall.addColorStop(1, '#5a2b8f');
  ctx.fillStyle = wall;
  ctx.fillRect(L, T, R - L, HORIZON - T + 2);

  // crowd stands: tiers of puffball fans, receding toward the vanishing point
  for (let row = 0; row < 5; row++) {
    const y = 120 + row * 40;
    const sz = 9 + row * 3;
    ctx.fillStyle = row % 2 ? '#2a1452' : '#331a63';
    ctx.fillRect(L, y + sz * 0.6, R - L, 40);
    for (let x = L + (row % 2) * 14; x < R; x += sz * 2.3 + r() * 6) {
      if (Math.abs(x - VPX) < 120 && row < 3) continue; // leave room behind the hoop
      const tint = [['#f0c58f', '#cf9a5f'], ['#f28a2e', '#c55a16'], ['#ffb0c8', '#e27c9c'], ['#e3ad72', '#b8814a']][Math.floor(r() * 4)];
      ctx.fillStyle = tint[1];
      ctx.beginPath();
      ctx.arc(x, y + 1.5, sz + 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tint[0];
      ctx.beginPath();
      ctx.arc(x, y, sz, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x - sz * 0.3, y - sz * 0.15, sz * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d1d26';
      ctx.beginPath();
      ctx.arc(x - sz * 0.38, y - sz * 0.1, sz * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // banner: KING PUFF BALL PALACE with a crown
  const bx = 460;
  const by = 40;
  S.shape(ctx, roundRectPts(bx - 230, by - 30, 460, 62, 14), { base: '#ffd23f', shade: '#d9a316', light: '#fff2a8' }, 1801, { lw: 1.8 });
  S.shape(ctx, roundRectPts(bx - 220, by - 22, 440, 46, 10), { base: '#7a2ec2', shade: '#55208a', light: '#a46ae0' }, 1802, { lw: 1, plain: true });
  ctx.font = '400 30px "Lilita One", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#3a2418';
  ctx.strokeText('KING PUFF BALL PALACE', bx, by + 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('KING PUFF BALL PALACE', bx, by + 2);
  // hanging pennants
  for (let i = 0; i < 14; i++) {
    const px = L + 40 + i * 110;
    const col = i % 2 ? '#ffd23f' : '#ff5a8a';
    S.shape(ctx, [[px - 14, T + 2], [px + 14, T + 2], [px, T + 46]], { base: col, shade: col, light: '#ffffff' }, 1810 + i, { lw: 0.9, plain: true });
  }
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(L, T + 3);
  ctx.lineTo(R, T + 3);
  ctx.stroke();

  // floor: polished wood in perspective
  ctx.save();
  ctx.beginPath();
  ctx.rect(L, HORIZON, R - L, B - HORIZON);
  ctx.clip();
  const floor = ctx.createLinearGradient(0, HORIZON, 0, B);
  floor.addColorStop(0, '#b8743c');
  floor.addColorStop(1, '#e8a860');
  ctx.fillStyle = floor;
  ctx.fillRect(L, HORIZON, R - L, B - HORIZON);
  // planks converging on the vanishing point
  ctx.strokeStyle = '#8a4f22';
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.5;
  for (let i = -30; i <= 30; i++) {
    const bxp = VPX + i * 70;
    ctx.beginPath();
    ctx.moveTo(VPX + (bxp - VPX) * ((HORIZON - VPY) / (B - VPY)), HORIZON);
    ctx.lineTo(bxp, B);
    ctx.stroke();
  }
  // cross seams, spaced so they get denser toward the back
  for (let k = 1; k < 18; k++) {
    const t = Math.pow(k / 18, 1.9);
    const y = HORIZON + (B - HORIZON) * t;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(L, y);
    ctx.lineTo(R, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // the key (paint) under the hoop in perspective, purple
  const key: Pt[] = [
    [VPX - 120, HORIZON + 40],
    [VPX + 120, HORIZON + 40],
    [VPX + 330, 600],
    [VPX - 330, 600],
  ];
  ctx.fillStyle = '#7a2ec2cc';
  ctx.beginPath();
  key.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fff8ec';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(key[0][0], key[0][1]);
  ctx.lineTo(key[1][0], key[1][1]);
  ctx.lineTo(key[2][0], key[2][1]);
  ctx.lineTo(key[3][0], key[3][1]);
  ctx.closePath();
  ctx.stroke();
  // free-throw circle
  ctx.beginPath();
  ctx.ellipse(VPX, 600, 330, 46, 0, 0, Math.PI * 2);
  ctx.stroke();
  // crown logo at centre court
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(VPX - 70, 470);
  ctx.lineTo(VPX - 64, 438);
  ctx.lineTo(VPX - 30, 456);
  ctx.lineTo(VPX, 430);
  ctx.lineTo(VPX + 30, 456);
  ctx.lineTo(VPX + 64, 438);
  ctx.lineTo(VPX + 70, 470);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // floor shine
  const shine = ctx.createRadialGradient(VPX, 560, 10, VPX, 560, 520);
  shine.addColorStop(0, '#ffffff38');
  shine.addColorStop(1, '#ffffff00');
  ctx.fillStyle = shine;
  ctx.fillRect(L, HORIZON, R - L, B - HORIZON);
  ctx.restore();

  // wall-floor edge
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(L, HORIZON);
  ctx.lineTo(R, HORIZON);
  ctx.stroke();

  // shooting spots
  for (const sp of [SPOTS.hero, SPOTS.king]) {
    ctx.fillStyle = '#ffffff55';
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y + 4, 70, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff8ec';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

/** A soft spotlight cone, for additive blending. Width w at the bottom, height h. */
export function drawSpotlight(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fff6d0aa');
  g.addColorStop(1, '#fff6d000');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 12, 0);
  ctx.lineTo(w / 2 + 12, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
}
