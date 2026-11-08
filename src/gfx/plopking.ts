/**
 * The Plop King (Plop Invasion's ruler, the boss in the Plop Dome): a big Plop with his crown and
 * sceptre, a long purple robe trimmed with ermine, and a jetpack — two fat rocket tanks on his
 * back, poking out either side, with flames and smoke when it fires (the flames and the smoke are
 * their own little sprites, so they can flicker and drift).
 *
 * Drawn in a KING_W × KING_H box (feet at KING_FEET), facing left like the other Plops.
 */
import { STYLES, ellipsePts, type Fill, type Pt, type Style } from './handdrawn';
import { KING_LOOK, drawPlop, type PlopFrame } from './plops';
import type { Ctx } from './draw';

export const KING_W = 150;
export const KING_H = 150;
/** Where the Plop's own 96 × 104 box sits in the King's (its feet at KING_FEET). */
const PX = 25;
const PY = 34;
export const KING_FEET = PY + 100;
/** His middle (the Plop's own anchor) in the box. */
export const KING_MID: Pt = [PX + 50, PY + 52];
/** Where the jetpack's nozzles point down (box units): the flames and the smoke come out here. */
export const JET_NOZZLES: Pt[] = [
  [PX + 50 - 41, PY + 66],
  [PX + 50 + 41, PY + 66],
];

const F = (base: string, shade: string, light: string): Fill => ({ base, shade, light });
const ROBE = F('#7b3fb8', '#4f2382', '#b07ce6');
const ROBE_LINING = F('#ffd23f', '#d9a316', '#fff2a8');
const ERMINE = F('#fbf7f0', '#ddd3c4', '#ffffff');
const STEEL = F('#c9d0d8', '#8a949e', '#f4f7fa');
const RED = F('#e8463f', '#b52c27', '#ff8a80');
const GOLD = F('#ffd23f', '#d9a316', '#fff2a8');

export type KingFrame = PlopFrame;

/**
 * The King: `robe` his purple robe (off for the fight), `jet` the jetpack on his back, `sceptre` in
 * his hand (he drops it for the fight).
 */
export function drawPlopKing(ctx: Ctx, f: KingFrame, opts: { robe?: boolean; jet?: boolean; sceptre?: boolean } = {}, st: Style = STYLES.polished) {
  const cx = PX + 50;
  const ground = PY + 100;
  const botY = ground - 30;
  // the jetpack's tanks, behind him (they poke out either side, above the robe's spread)
  if (opts.jet) {
    for (const [i, sx] of [-1, 1].entries()) {
      const tx = cx + sx * 41;
      const top = botY - 48;
      const bot = botY - 2;
      st.shape(ctx, [[tx - 9, top + 8], [tx - 6, top], [tx + 6, top], [tx + 9, top + 8], [tx + 9, bot], [tx - 9, bot]], STEEL, 4100 + i, { lw: 1, light: [tx - 3, top + 12] });
      // a red nose cone on top, a red band, and fins at the bottom
      st.shape(ctx, [[tx - 6, top + 1], [tx, top - 9], [tx + 6, top + 1]], RED, 4102 + i, { lw: 0.9, light: [tx - 2, top - 3] });
      st.shape(ctx, [[tx - 9, top + 18], [tx + 9, top + 18], [tx + 9, top + 23], [tx - 9, top + 23]], RED, 4104 + i, { lw: 0.7, plain: true });
      st.shape(ctx, [[tx + sx * 9, bot - 12], [tx + sx * 16, bot + 2], [tx + sx * 9, bot]], RED, 4106 + i, { lw: 0.8 });
      // the nozzle
      st.shape(ctx, [[tx - 5, bot], [tx + 5, bot], [tx + 7, bot + 6], [tx - 7, bot + 6]], F('#5a5550', '#2e2a26', '#8a847c'), 4108 + i, { lw: 0.8 });
      // rivets
      for (const ry of [top + 30, top + 38]) st.shape(ctx, ellipsePts(tx - sx * 4, ry, 1.1, 1.1, 0, 8), F('#8a949e', '#5a636c', '#ffffff'), 4110 + ry + i, { lw: 0.3, plain: true });
    }
  }
  // the robe: from his shoulders down to the ground, flaring out, a gold lining at the edges and an
  // ermine hem (white with black tails)
  if (opts.robe) {
    const hem: Pt[] = [];
    for (let k = 0; k <= 8; k++) hem.push([cx + 48 - k * 12, ground - 3 + (k % 2 ? 2.5 : 0)]);
    st.shape(ctx, [[cx - 27, botY - 30], [cx + 27, botY - 30], [cx + 50, ground - 1], [cx - 50, ground - 1]], ROBE_LINING, 4200, { lw: 1 });
    st.shape(ctx, [[cx - 25, botY - 31], [cx + 25, botY - 31], ...hem], ROBE, 4201, { lw: 1.1, light: [cx - 16, botY - 12] });
    for (const fx of [-30, -12, 14, 32]) st.line(ctx, [[cx + fx * 0.5, botY - 22], [cx + fx, ground - 10]], 4202 + fx, 0.8, '#4f2382');
    // ermine band along the hem
    st.shape(ctx, [[cx + 50, ground - 9], [cx - 50, ground - 9], [cx - 52, ground], [cx + 52, ground]], ERMINE, 4210, { lw: 0.9 });
    for (let k = -44; k <= 44; k += 11) st.shape(ctx, [[cx + k - 1.4, ground - 6], [cx + k + 1.4, ground - 6], [cx + k + 0.6, ground - 1.5], [cx + k - 0.6, ground - 1.5]], F('#2a1a12', '#140a06', '#4a3428'), 4211 + k, { lw: 0.3, plain: true });
  }
  const was = { ...KING_LOOK };
  KING_LOOK.cape = false;
  KING_LOOK.sceptre = opts.sceptre !== false;
  try {
    drawPlop(ctx, PX, PY, f, st, 'king');
  } finally {
    Object.assign(KING_LOOK, was);
  }
}

/** A jetpack flame (pointing down from a nozzle at (x, y)): three lengths to flicker between. */
export const JETFLAME_W = 24;
export const JETFLAME_H = 48;
export function drawJetFlame(ctx: Ctx, n: number, st: Style = STYLES.polished) {
  const len = [34, 42, 28][n % 3];
  const w = [9, 10, 8][n % 3];
  const x = JETFLAME_W / 2;
  const tear = (l: number, ww: number): Pt[] => [
    [x - ww, 2],
    [x + ww, 2],
    [x + ww * 0.8, l * 0.35],
    [x + ww * 0.25, l * 0.75],
    [x, l],
    [x - ww * 0.3, l * 0.72],
    [x - ww * 0.85, l * 0.35],
  ];
  st.shape(ctx, tear(len, w), F('#ff7a1a', '#e0450a', '#ffb060'), 4400 + n, { lw: 0.8 });
  st.shape(ctx, tear(len * 0.7, w * 0.62), F('#ffd23f', '#f2a81e', '#fff6c0'), 4410 + n, { lw: 0, plain: true });
  st.shape(ctx, tear(len * 0.38, w * 0.32), F('#ffffff', '#fff2c0', '#ffffff'), 4420 + n, { lw: 0, plain: true });
}

/** A puff of jetpack smoke: a soft grey cloud (the game grows it, drifts it and fades it out). */
export const SMOKE_R = 16;
export function drawJetSmoke(ctx: Ctx, n: number) {
  const c = SMOKE_R;
  const blobs: [number, number, number][] = n % 2 ? [[c - 5, c + 2, 9], [c + 5, c + 1, 8], [c, c - 4, 9]] : [[c - 4, c - 1, 8], [c + 6, c + 2, 9], [c - 1, c + 4, 8]];
  for (const [bx, by, r] of blobs) {
    const g = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.2, bx, by, r);
    g.addColorStop(0, 'rgba(236,232,226,0.95)');
    g.addColorStop(0.7, 'rgba(178,170,160,0.85)');
    g.addColorStop(1, 'rgba(150,142,132,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** His robe, dropped: a crumpled purple heap on the floor, the ermine hem and the gold clasp showing. */
export const ROBE_W = 120;
export const ROBE_H = 44;
export function drawRobeHeap(ctx: Ctx, st: Style = STYLES.polished) {
  const g = ROBE_H - 3;
  const heap: Pt[] = [];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI + (k / 16) * Math.PI;
    const r = k % 3 === 1 ? 0.86 : 1;
    heap.push([60 + Math.cos(a) * 56 * r, g + Math.sin(a) * 30 * r]);
  }
  st.shape(ctx, heap, ROBE, 4500, { lw: 1.1, light: [44, g - 20] });
  // folds
  for (const [x0, x1] of [[26, 44], [58, 66], [84, 96]] as const) st.line(ctx, [[x0, g - 4], [(x0 + x1) / 2, g - 20], [x1, g - 6]], 4501 + x0, 0.9, '#4f2382');
  // the ermine hem, flopped over the front
  st.shape(ctx, [[8, g - 2], [30, g - 9], [60, g - 6], [92, g - 10], [114, g - 2], [114, g + 2], [6, g + 2]], ERMINE, 4510, { lw: 0.9 });
  for (let x = 16; x < 110; x += 12) st.shape(ctx, [[x - 1.3, g - 6], [x + 1.3, g - 6], [x + 0.6, g - 1.5], [x - 0.6, g - 1.5]], F('#2a1a12', '#140a06', '#4a3428'), 4511 + x, { lw: 0.3, plain: true });
  st.shape(ctx, ellipsePts(70, g - 24, 4, 4, 0, 14), GOLD, 4530, { lw: 0.7, light: [68.5, g - 26] });
}
