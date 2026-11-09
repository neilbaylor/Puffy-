/**
 * Plop Invasion · Part 2's ballpark (at the bottom of the first parachute drop): the Plops are
 * playing baseball, and once they spot you the batter starts hitting line drives at you.
 *
 * Like the soccer pitch in Part 1, seen side on at a low angle: a band of turf over the ground line
 * (mowed in a checkerboard) with the dirt infield, chalk lines, bases, the mound and home plate
 * (home plate at the right: you come in from the left, through the outfield); behind it the
 * outfield wall with ads, a scoreboard, foul poles, the backstop and floodlights.
 * Also the players' gear (caps, mitts, the bat, the catcher's mask) and the ball.
 */
import type { Ctx } from './draw';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from './handdrawn';
import { drawPlop, type PlopFrame, type PlopKind } from './plops';

const ST = STYLES.polished;
const FONT = '"Lilita One", "Arial Black", sans-serif';
const F = (base: string, shade: string, light: string): Fill => ({ base, shade, light });

/**
 * Sizes (world px). Both pictures are (field + 2·END) wide. The front one spans FRONT_UP above the
 * ground line to BAND_BOT below; the back one BACK_UP above. The turf band runs from BAND_TOP above
 * the ground line to BAND_BOT below.
 */
export const PARK = { END: 60, FRONT_UP: 40, BAND_TOP: 12, BAND_BOT: 56, BACK_UP: 230 };

const ADS = [
  { text: 'PLOP DOGS', bg: '#c8102e', fg: '#ffe2b0' },
  { text: 'POO COLA', bg: '#5a2a10', fg: '#ffd23f' },
  { text: 'STINK STADIUM', bg: '#0b7c78', fg: '#eafffb' },
  { text: 'MADE BY HENRY & NEIL', bg: '#5a2aa6', fg: '#ffd23f' },
  { text: 'FLY SWATTERS', bg: '#ffb627', fg: '#4a2a05' },
  { text: 'GO PLOPS!', bg: '#2f6fd6', fg: '#ffffff' },
];

function path(ctx: Ctx, pts: Pt[], close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

/** Where things are on the field (x along it, d: 0 the far edge of the turf … 1 the near edge). */
export function parkSpots(w: number) {
  const { END } = PARK;
  const home = END + w - 110;
  const B = 190; // home to the mound (and the mound to second)
  return {
    home: { x: home, d: 0.56 },
    mound: { x: home - B, d: 0.52 },
    first: { x: home - B, d: 0.93 },
    second: { x: home - B * 2, d: 0.48 },
    third: { x: home - B, d: 0.1 },
    B,
  };
}

/**
 * The turf, the infield and its lines, bases, mound and home plate (just over the ground's top
 * edge, behind the players). w = the field's length.
 */
export function drawBallparkFront(ctx: Ctx, w: number) {
  const { END, FRONT_UP, BAND_TOP, BAND_BOT } = PARK;
  const x0 = END;
  const x1 = END + w;
  const cx = (x0 + x1) / 2;
  const gy = FRONT_UP;
  const top = gy - BAND_TOP;
  const bot = gy + BAND_BOT;
  const bandH = bot - top;
  // low angle: things nearer the viewer spread out a little
  const P = (x: number, d: number): Pt => [x + ((x - cx) / w) * 22 * d, top + d * bandH];
  const S = parkSpots(w);

  // the turf slab
  const slab = roundRectPts(x0 - 26, top, w + 52, bandH, 10);
  ST.shape(ctx, slab, F('#5aa84e', '#3a7d38', '#86cc6e'), 3000, { lw: 1, light: [cx, top + 3] });
  ctx.save();
  path(ctx, slab);
  ctx.clip();
  // mowed in a checkerboard: squares of lighter and darker green, in perspective
  const COLS = Math.round(w / 64);
  const ROWS = 4;
  for (let r = 0; r < ROWS; r++)
    for (let c = -1; c <= COLS + 1; c++) {
      if ((r + c) % 2) continue;
      const xa = x0 + (c * w) / COLS;
      const xb = x0 + ((c + 1) * w) / COLS;
      const da = r / ROWS;
      const db = (r + 1) / ROWS;
      path(ctx, [P(xa, da), P(xb, da), P(xb, db), P(xa, db)]);
      ctx.fillStyle = '#ffffff1f';
      ctx.fill();
    }
  // the infield dirt: a big arc round the diamond, cut off along the foul lines at home
  const { home, mound, first, second, third } = S;
  const dirtC = P(mound.x - 30, 0.5);
  const dirt = ellipsePts(dirtC[0], dirtC[1], S.B * 1.45, bandH * 0.52, 0, 60);
  ctx.save();
  // (only on the fair side of the foul lines, plus a circle round home plate)
  const [hx, hy] = P(home.x, home.d);
  const far = P(third.x - (third.x - home.x) * -1.6, 0);
  const near = P(first.x - (first.x - home.x) * -1.6, 1);
  ctx.beginPath();
  ctx.moveTo(hx + 4, hy);
  ctx.lineTo(far[0], far[1] - 20);
  ctx.lineTo(x0 - 40, top - 20);
  ctx.lineTo(x0 - 40, bot + 20);
  ctx.lineTo(near[0], near[1] + 20);
  ctx.closePath();
  ctx.clip();
  ST.shape(ctx, dirt, F('#c98a52', '#9a6234', '#e6b07a'), 3010, { lw: 0.9, light: [dirtC[0], dirtC[1] - 20] });
  ctx.restore();
  // the infield grass inside the base paths
  const ig = [P(home.x - 26, home.d), P(first.x, first.d - 0.12), P(second.x + 26, second.d), P(third.x, third.d + 0.1)];
  ST.shape(ctx, ig, F('#62b456', '#448a3e', '#8ed276'), 3020, { lw: 0.6, light: [mound.x, 0] });
  // dirt round home plate and the mound
  const [mx, my] = P(mound.x, mound.d);
  ST.shape(ctx, ellipsePts(hx, hy, 34, bandH * 0.2, 0, 30), F('#c98a52', '#9a6234', '#e6b07a'), 3030, { lw: 0.7 });
  ST.shape(ctx, ellipsePts(mx, my, 26, bandH * 0.15, 0, 30), F('#c98a52', '#9a6234', '#e6b07a'), 3031, { lw: 0.7, light: [mx - 8, my - 6] });
  // the chalk: foul lines from home out past first and third, the batter's boxes
  ctx.strokeStyle = '#fffdf6';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  for (const [ax, ay] of [far, near]) {
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(ax, ay);
    ctx.stroke();
  }
  ctx.lineWidth = 1.2;
  for (const s of [-1, 1]) {
    ctx.strokeRect(hx + s * 9 - (s < 0 ? 12 : 0), hy - bandH * 0.12, 12, bandH * 0.24);
  }
  // the pitcher's rubber
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(mx - 5, my - 1.4, 10, 2.8);
  // the bases (white bags), home plate (a white pentagon)
  for (const b of [first, second, third]) {
    const [bx, by] = P(b.x, b.d);
    ST.shape(ctx, [[bx - 7, by], [bx, by - 3.4], [bx + 7, by], [bx, by + 3.4]], F('#ffffff', '#ddd6cc', '#ffffff'), 3040 + b.x, { lw: 0.7, plain: true });
  }
  ST.shape(ctx, [[hx - 6, hy - 2.4], [hx + 6, hy - 2.4], [hx + 7, hy + 0.6], [hx, hy + 3.2], [hx - 7, hy + 0.6]], F('#ffffff', '#ddd6cc', '#ffffff'), 3050, { lw: 0.7, plain: true });
  // the on-deck circle (by the backstop)
  const [ox, oy] = P(home.x + 60, 0.86);
  ctx.strokeStyle = '#fffdf6aa';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(ox, oy, 14, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  // a poo-stained patch or two (it's still Plop Invasion)
  ctx.fillStyle = '#5a341855';
  for (const [x, d, rx] of [[x0 + 120, 0.7, 16], [x0 + 300, 0.3, 11], [mound.x - 260, 0.82, 13]] as const) {
    const [px, py] = P(x, d);
    ctx.beginPath();
    ctx.ellipse(px, py, rx, rx * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // a white chalk line round the warning track at the far edge
  ctx.strokeStyle = '#3a241855';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(P(x0 - 10, 0.04)[0], P(x0 - 10, 0.04)[1]);
  ctx.lineTo(P(x1 + 10, 0.04)[0], P(x1 + 10, 0.04)[1]);
  ctx.stroke();
}

/**
 * Behind the field (BACK_UP tall, ground line at the bottom): the padded outfield wall with ads,
 * the scoreboard over left field, the foul pole, the backstop net behind home, and floodlights.
 */
export function drawBallparkBack(ctx: Ctx, w: number, score: [number, number] = [3, 2]) {
  const { END, BACK_UP } = PARK;
  const x0 = END;
  const x1 = END + w;
  const gy = BACK_UP;
  const S = parkSpots(w);
  // floodlight towers at each end
  for (const tx of [x0 + 30, x1 - 30]) {
    ST.shape(ctx, [[tx - 3, gy - 2], [tx + 3, gy - 2], [tx + 2, gy - 200], [tx - 2, gy - 200]], F('#8f97ad', '#646c84', '#c4cad8'), 3100 + tx, { lw: 0.8 });
    ST.shape(ctx, roundRectPts(tx - 22, gy - 222, 44, 24, 4), F('#4a5266', '#323848', '#6a7488'), 3110 + tx, { lw: 0.9 });
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = '#fff6c4';
        ctx.beginPath();
        ctx.arc(tx - 14 + c * 9.3, gy - 215 + r * 10, 3.3, 0, Math.PI * 2);
        ctx.fill();
      }
    const glow = ctx.createRadialGradient(tx, gy - 210, 2, tx, gy - 210, 46);
    glow.addColorStop(0, '#fff6c466');
    glow.addColorStop(1, '#fff6c400');
    ctx.fillStyle = glow;
    ctx.fillRect(tx - 50, gy - 260, 100, 100);
  }
  // the backstop: tall poles and a net behind home plate
  const bx = S.home.x + 40;
  const bw = 90;
  for (const px of [bx - bw / 2, bx + bw / 2]) ST.shape(ctx, [[px - 2, gy], [px + 2, gy], [px + 2, gy - 120], [px - 2, gy - 120]], F('#5a5a62', '#3a3a42', '#8a8a94'), 3120 + px, { lw: 0.7 });
  ctx.save();
  ctx.strokeStyle = '#2a2a3088';
  ctx.lineWidth = 0.6;
  for (let x = bx - bw / 2; x <= bx + bw / 2; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, gy - 118);
    ctx.lineTo(x, gy - 30);
    ctx.stroke();
  }
  for (let y = gy - 118; y <= gy - 30; y += 6) {
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2, y);
    ctx.lineTo(bx + bw / 2, y);
    ctx.stroke();
  }
  ctx.restore();
  // the outfield wall: padded, dark green, a yellow line along the top, ads on the panels
  // (tall enough that the ads clear the front edge of the turf, which rises BAND_TOP over the ground line)
  const wallTop = gy - 52;
  const wallX1 = bx - bw / 2 - 20;
  ST.shape(ctx, [[x0 - 6, gy], [x0 - 6, wallTop], [wallX1, wallTop + 8], [wallX1, gy]], F('#24603a', '#163e26', '#3c8656'), 3130, { lw: 1 });
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x0 - 4, wallTop + 2);
  ctx.lineTo(wallX1 - 2, wallTop + 10);
  ctx.stroke();
  // ad panels on the wall
  const n = Math.max(3, Math.floor((wallX1 - x0) / 130));
  for (let i = 0; i < n; i++) {
    const a = ADS[i % ADS.length];
    const ax = x0 + 8 + ((wallX1 - x0 - 16) * i) / n;
    const aw = (wallX1 - x0 - 16) / n - 8;
    const ay = wallTop + 7 + ((ax - x0) / (wallX1 - x0)) * 8;
    ST.shape(ctx, roundRectPts(ax, ay, aw, 20, 3), F(a.bg, a.bg, a.bg), 3140 + i, { lw: 0.7, plain: true });
    ctx.font = `${Math.min(12, aw / (a.text.length * 0.62))}px ${FONT}`;
    ctx.fillStyle = a.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(a.text, ax + aw / 2, ay + 10.5);
  }
  // the foul pole (left field)
  ST.shape(ctx, [[x0 + 8, gy], [x0 + 12, gy], [x0 + 11, gy - 170], [x0 + 9, gy - 170]], F('#ffd23f', '#d9a514', '#fff0a0'), 3150, { lw: 0.8 });
  ST.shape(ctx, [[x0 + 12, gy - 168], [x0 + 26, gy - 160], [x0 + 26, gy - 120], [x0 + 12, gy - 118]], F('#ffd23f', '#d9a514', '#fff0a0'), 3151, { lw: 0.7, plain: true });
  // the scoreboard over left-centre field: PLOPS vs POOS, the inning, balls / strikes / outs
  const sx = x0 + w * 0.22;
  const sw = 200;
  const sy = gy - 170;
  for (const lx of [sx + 30, sx + sw - 30]) ST.shape(ctx, [[lx - 4, wallTop], [lx + 4, wallTop], [lx + 4, sy + 80], [lx - 4, sy + 80]], F('#5a5a62', '#3a3a42', '#8a8a94'), 3160 + lx, { lw: 0.7 });
  ST.shape(ctx, roundRectPts(sx, sy, sw, 92, 8), F('#1c2a22', '#101a14', '#2c3c32'), 3170, { lw: 1.2 });
  ST.shape(ctx, roundRectPts(sx + 30, sy - 22, sw - 60, 26, 6), F('#c8102e', '#8a0a1f', '#ff5a6e'), 3171, { lw: 1 });
  ctx.fillStyle = '#ffe2b0';
  ctx.font = `15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PLOP PARK', sx + sw / 2, sy - 9);
  ctx.font = `13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(TEAM.plops.name, sx + 14, sy + 20);
  ctx.fillText(TEAM.poos.name, sx + 14, sy + 42);
  // the score in lit bulbs
  ctx.textAlign = 'center';
  ctx.font = `20px ${FONT}`;
  ctx.fillStyle = '#ffb24a';
  ctx.fillText(String(score[0]), sx + 96, sy + 21);
  ctx.fillText(String(score[1]), sx + 96, sy + 43);
  ctx.font = `10px ${FONT}`;
  ctx.fillStyle = '#e8f0ea';
  ctx.fillText('INNING', sx + 156, sy + 14);
  ctx.font = `22px ${FONT}`;
  ctx.fillStyle = '#ffb24a';
  ctx.fillText('9', sx + 156, sy + 34);
  // B / S / O lamps
  const lamps: [string, number, string][] = [['B', 3, '#4cc25e'], ['S', 2, '#e8484a'], ['O', 2, '#ffd23f']];
  lamps.forEach(([l, on, col], i) => {
    const y = sy + 62 + (i - 1) * 0 ;
    const x = sx + 22 + i * 62;
    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = '#e8f0ea';
    ctx.fillText(l, x, y + 14);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = k < on ? col : '#2e3a32';
      ctx.beginPath();
      ctx.arc(x + 12 + k * 11, y + 14, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** A baseball: white leather, red stitches. (x, y) its middle, r its radius, spin turns the seams. */
export function drawBaseball(ctx: Ctx, x: number, y: number, r: number, spin = 0) {
  ST.shape(ctx, ellipsePts(x, y, r, r, 0, 28), F('#fffaf0', '#ddd2c2', '#ffffff'), 3200, { lw: 0.8, light: [x - r * 0.4, y - r * 0.5] });
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.strokeStyle = '#d8323a';
  ctx.lineWidth = r * 0.12;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * r * 1.15, 0, r * 0.8, Math.PI - 0.9, Math.PI + 0.9);
    if (s < 0) {
      ctx.beginPath();
      ctx.arc(-r * 1.15, 0, r * 0.8, -0.9, 0.9);
    }
    ctx.stroke();
    // the stitches across the seam
    for (let k = -2; k <= 2; k++) {
      const a = (s < 0 ? 0 : Math.PI) + k * 0.36;
      const cxs = s * r * 1.15 * (s < 0 ? 1 : 1);
      const px = (s < 0 ? -r * 1.15 : r * 1.15) + Math.cos(a) * r * 0.8;
      const py = Math.sin(a) * r * 0.8;
      void cxs;
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(px - Math.cos(a) * r * 0.14 - Math.sin(a) * r * 0.1, py - Math.sin(a) * r * 0.14 + Math.cos(a) * r * 0.1);
      ctx.lineTo(px + Math.cos(a) * r * 0.14 + Math.sin(a) * r * 0.1, py + Math.sin(a) * r * 0.14 - Math.cos(a) * r * 0.1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A line drive: the ball with a streak behind it (dir: which way it's going). */
export function drawLineDrive(ctx: Ctx, x: number, y: number, r: number, dir: 1 | -1) {
  const g = ctx.createLinearGradient(x - dir * r * 9, y, x, y);
  g.addColorStop(0, '#ffffff00');
  g.addColorStop(1, '#ffffffcc');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.9);
  ctx.lineTo(x - dir * r * 9, y - r * 0.2);
  ctx.lineTo(x - dir * r * 9, y + r * 0.2);
  ctx.lineTo(x, y + r * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff99';
  ctx.lineWidth = 1;
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x - dir * r * 1.6, y + k * r * 1.2);
    ctx.lineTo(x - dir * r * 5, y + k * r * 1.5);
    ctx.stroke();
  }
  drawBaseball(ctx, x, y, r, dir * 0.6);
}

/** A wooden bat, handle at (0, 0), lying along +x, `len` long. */
export function drawBat(ctx: Ctx, len: number, seed = 1) {
  const pts: Pt[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const rr = 1.2 + Math.pow(u, 2.2) * 3.4;
    pts.push([u * len, -rr]);
  }
  pts.push([len + 1.6, 0]);
  for (let i = N; i >= 0; i--) {
    const u = i / N;
    const rr = 1.2 + Math.pow(u, 2.2) * 3.4;
    pts.push([u * len, rr]);
  }
  ST.shape(ctx, pts, F('#d9a05e', '#a8713a', '#f2c88e'), seed, { lw: 0.8, light: [len * 0.6, -4] });
  // the knob and the grip tape
  ST.shape(ctx, ellipsePts(-0.6, 0, 1.6, 2.4, 0, 12), F('#3a2418', '#1e120a', '#5a3a26'), seed + 1, { lw: 0.6, plain: true });
  ctx.fillStyle = '#1e1e26';
  ctx.fillRect(0.6, -1.4, len * 0.24, 2.8);
}

/** A leather mitt (on the near hand), opening (x, y), facing right. */
function drawMitt(ctx: Ctx, x: number, y: number, s: number, seed: number) {
  const pts: Pt[] = [
    [x - 6 * s, y + 6 * s], [x - 8 * s, y - 2 * s], [x - 5 * s, y - 9 * s], [x - 1 * s, y - 10 * s], [x + 3 * s, y - 9 * s],
    [x + 6 * s, y - 6 * s], [x + 8 * s, y - 1 * s], [x + 6 * s, y + 5 * s], [x, y + 8 * s],
  ];
  ST.shape(ctx, pts, F('#b8672e', '#87451a', '#e09a5c'), seed, { lw: 0.8, light: [x - 3 * s, y - 6 * s] });
  ctx.strokeStyle = '#5a2e10';
  ctx.lineWidth = 0.6;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * 3 * s, y - 7 * s);
    ctx.lineTo(x + k * 2.5 * s, y + 2 * s);
    ctx.stroke();
  }
  // the pocket's laces
  ctx.strokeStyle = '#e8c890';
  ctx.beginPath();
  ctx.moveTo(x + 6 * s, y - 5 * s);
  ctx.lineTo(x + 2 * s, y - 2 * s);
  ctx.stroke();
}

/** A cap perched on the Plop's head (its swirl tip poking out through the top), brim forward. */
function drawCap(ctx: Ctx, col: Fill, seed: number, helmet = false) {
  // (the head's top runs x 33..70 at y ≈ 30; the swirl's tip rises from about x 56..62)
  const crown: Pt[] = [[30, 37], [32, 28], [40, 22], [52, 20], [64, 22], [71, 29], [73, 37]];
  ST.shape(ctx, crown, col, seed, { lw: 1, light: [42, 22] });
  // a hole for the swirl, which pokes up through it
  ctx.fillStyle = '#6b3d22';
  ctx.beginPath();
  ctx.ellipse(57, 21, 4.5, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (helmet) {
    // the batting helmet's ear flap and shine
    ST.shape(ctx, [[30, 34], [27, 44], [33, 47], [38, 38]], col, seed + 1, { lw: 0.8 });
    ctx.fillStyle = '#ffffff66';
    ctx.beginPath();
    ctx.ellipse(45, 25, 7, 2.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // the brim, sticking out forward
  ST.shape(ctx, [[66, 34], [82, 35], [86, 38], [70, 39]], { base: col.shade, shade: col.shade, light: col.base }, seed + 2, { lw: 0.9 });
  // the button on top
  ST.shape(ctx, ellipsePts(52, 20, 2, 1.2, 0, 10), col, seed + 3, { lw: 0.5, plain: true });
}

/**
 * The two teams: the Plops (blue caps: fielding — pitcher, catcher, fielders) and the Poos
 * (red caps and batting helmets: the batter, the one on deck, the runner).
 */
export const TEAM = {
  plops: { name: 'PLOPS', cap: F('#2f5fd6', '#1c3f9e', '#6e96f0') },
  poos: { name: 'POOS', cap: F('#c8102e', '#8a0a1f', '#ff5a6e') },
} as const;
export type Team = keyof typeof TEAM;

export type BaseballRole = 'pitch-windup' | 'pitch-throw' | 'bat-stance' | 'bat-swing' | 'on-deck' | 'runner' | 'catcher' | 'fielder' | 'fielder-throw';
/** Which team plays each part. */
export const ROLE_TEAM: Record<BaseballRole, Team> = {
  'pitch-windup': 'plops', 'pitch-throw': 'plops', catcher: 'plops', fielder: 'plops', 'fielder-throw': 'plops',
  'bat-stance': 'poos', 'bat-swing': 'poos', 'on-deck': 'poos', runner: 'poos',
};

/** How far each plain frame's body (and so its head) bobs up or down from standing (see drawPlop). */
const BOB: Partial<Record<PlopFrame, number>> = { walk0: 1.5, walk1: -3.5, walk2: 1.5, walk3: -3.5, run1: -3, yell1: -3, hurt: 2.5 };

/**
 * A player in an ordinary frame (walking, yelling, hurt…), still in its team's cap (a batting
 * helmet for the Poos): for when the game's off and they come after you.
 */
export function drawCappedPlop(ctx: Ctx, frame: PlopFrame, kind: PlopKind, team: Team, body?: Fill, seed = 7) {
  drawPlop(ctx, 0, 0, frame, ST, kind, body);
  ctx.save();
  ctx.translate(0, BOB[frame] ?? 0);
  drawCap(ctx, TEAM[team].cap, seed + 2, team === 'poos');
  ctx.restore();
}

/**
 * A Plop playing baseball, in its usual 96 × 104 box (facing right; the batter is drawn flipped,
 * facing the pitcher): cap or helmet, a mitt or the bat, the catcher's mask and pads.
 */
export function drawBaseballPlop(ctx: Ctx, role: BaseballRole, kind: PlopKind = 'medium', seed = 7, body?: Fill) {
  const frame: PlopFrame = role === 'pitch-throw' || role === 'bat-swing' || role === 'fielder-throw' ? 'yell1' : role === 'catcher' ? 'grin' : role === 'pitch-windup' ? 'look' : role === 'runner' ? 'run0' : role === 'on-deck' ? 'grin' : 'idle';
  const cap = TEAM[ROLE_TEAM[role]].cap;
  const helmet = role.startsWith('bat') || role === 'on-deck' || role === 'runner';
  // the bat behind the body in the stance (over the shoulder; resting on it on deck), in front mid-swing
  if (role === 'bat-stance' || role === 'on-deck') {
    ctx.save();
    ctx.translate(88, 58);
    ctx.rotate(role === 'on-deck' ? -2.5 : -1.95);
    drawBat(ctx, 50, seed);
    ctx.restore();
  }
  // the catcher: crouched (squashed down a little)
  if (role === 'catcher') {
    ctx.save();
    ctx.translate(0, 18);
    ctx.scale(1.06, 0.82);
  }
  drawPlop(ctx, 0, 0, frame, ST, kind, body);
  if (role === 'catcher') {
    // chest protector and mask
    ST.shape(ctx, [[30, 58], [70, 58], [74, 80], [26, 80]], F('#2f5fd6', '#1c3f9e', '#6e96f0'), seed + 1, { lw: 0.8 });
    ctx.strokeStyle = '#1a1a22';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(36, 36, 34, 18, 6);
    ctx.stroke();
    ctx.lineWidth = 1.1;
    for (const x of [47, 59]) {
      ctx.beginPath();
      ctx.moveTo(x, 36);
      ctx.lineTo(x, 54);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(36, 45);
    ctx.lineTo(70, 45);
    ctx.stroke();
    drawCap(ctx, cap, seed + 2);
    drawMitt(ctx, 92, 60, 1.25, seed + 3);
    ctx.restore();
    return;
  }
  drawCap(ctx, cap, seed + 2, helmet);
  if (role === 'runner') {
    // dust kicked up behind, running hard
    ctx.fillStyle = '#c99a6a88';
    for (const [x, y, r] of [[-6, 96, 6], [-14, 92, 4], [-20, 97, 3]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (role === 'bat-swing') {
    // the bat out in front, level, mid-swing, with a whoosh behind it
    ctx.strokeStyle = '#ffffffaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(82, 60, 46, -1.9, -0.25);
    ctx.stroke();
    ctx.save();
    ctx.translate(86, 60);
    ctx.rotate(-0.12);
    drawBat(ctx, 50, seed);
    ctx.restore();
  }
  if (role === 'fielder' || role === 'pitch-windup') drawMitt(ctx, 93, 54, 1.1, seed + 4);
  if (role === 'pitch-throw' || role === 'fielder-throw') {
    // the throwing arm whipped forward, the ball just leaving it
    drawMitt(ctx, 8, 60, 1.0, seed + 5);
    drawBaseball(ctx, 100, 48, 4.4, 0.4);
    ctx.strokeStyle = '#ffffffaa';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(80, 60, 22, -2.2, -0.5);
    ctx.stroke();
  }
  if (role === 'pitch-windup') {
    // leg up, ball hidden in the mitt (a little hop in the pose)
    ctx.strokeStyle = '#ffffffaa';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(48, 40, 50, -2.6, -2.0);
    ctx.stroke();
  }
}

/** Plop Park's field length (tiles) and its players: who plays what, their size, team and colour. */
export const BB_FIELD_TILES = 36;
export interface BBPlayer {
  key: string;
  role: BaseballRole;
  /** The poses it needs (its usual one first). */
  roles: BaseballRole[];
  kind: 'small' | 'medium';
  team: Team;
  /** Which of PLOP_COLOURS it is. */
  body: number;
  /** Room either side of the body in its frames (the batter's swing reaches a long way). */
  padX: number;
}
export const BB_ROSTER: BBPlayer[] = [
  { key: 'bbp-pitcher', role: 'fielder', roles: ['fielder', 'pitch-windup', 'pitch-throw'], kind: 'small', team: 'plops', body: 1, padX: 16 },
  { key: 'bbp-batter', role: 'bat-stance', roles: ['bat-stance', 'bat-swing'], kind: 'medium', team: 'poos', body: 2, padX: 40 },
  { key: 'bbp-catcher', role: 'catcher', roles: ['catcher', 'fielder-throw'], kind: 'small', team: 'plops', body: 3, padX: 16 },
  { key: 'bbp-f1', role: 'fielder', roles: ['fielder', 'fielder-throw'], kind: 'small', team: 'plops', body: 4, padX: 16 },
  { key: 'bbp-f2', role: 'fielder', roles: ['fielder', 'fielder-throw'], kind: 'medium', team: 'plops', body: 5, padX: 16 },
  { key: 'bbp-f3', role: 'fielder', roles: ['fielder', 'fielder-throw'], kind: 'small', team: 'plops', body: 0, padX: 16 },
  { key: 'bbp-ondeck', role: 'on-deck', roles: ['on-deck'], kind: 'small', team: 'poos', body: 6, padX: 16 },
];
/** The players' sheets: each size shown at (× its art), its body (world px), and the sheet's resolution. */
export const BB_SIZE = { small: { k: 0.42, w: 22, h: 30, res: 1.25 }, medium: { k: 0.74, w: 36, h: 60, res: 1.6 } } as const;
/** The plain frames on every player's sheet (and the ones that share them). */
export const BB_PLAIN: PlopFrame[] = ['idle', 'walk0', 'walk1', 'walk2', 'walk3', 'yell0', 'yell1', 'hurt'];
export const BB_ALIAS: Record<string, PlopFrame> = { idle1: 'idle', blink: 'idle', look: 'idle', grin: 'idle', run0: 'walk1', run1: 'walk3' };
/** Every texture Plop Park draws (so other levels can free them). */
export const BB_KEYS = ['bbpark-back', 'bbpark-front', 'bb-ball', 'bb-drive', ...BB_ROSTER.map((r) => r.key)];
