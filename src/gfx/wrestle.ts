/**
 * The Poo Palace: Part 3's boss arena (Queen Plop's wrestling ring). The basketball arena
 * restyled in poo browns, plus a side-on wrestling ring. Everything here is in the arena's
 * "stage" units (1280 × 720, the same as the basketball arena); the scene shrinks it to the
 * game's world size so the heroes keep their usual size and physics.
 */
import { JUMBO, STAGE_OX, STAGE_OY, drawJumboScreen, type ArenaStyle, type JumboContent } from './hoops';
import { rng, type Ctx } from './draw';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from './handdrawn';
import { POO, POO_DARK, drawDrip, drawPooSwirl } from './plopworld';

const ST = STYLES.polished;
const FONT = '"Lilita One", "Arial Black", sans-serif';

/** The ring, as the TV camera sees it from the side (stage units). */
export const RING = {
  /** Front posts (x), and how much the back of the ring shrinks toward the middle. */
  x0: 150,
  x1: 1130,
  back: 0.885,
  /** The mat: its back edge, front edge, and the line the fighters stand on. */
  backY: 440,
  frontY: 506,
  floorY: 482,
  /** The skirt hangs down to here. */
  skirtY: 586,
  /** Where you stand on the arena floor outside the ring. */
  groundY: 650,
  /** Rope heights above the mat at the front, and the posts' height. */
  ropes: [30, 60, 90],
  post: 112,
  /** The apron: the mat reaches a little past the posts. */
  apron: 12,
};
/** A point on the back edge of the ring, from its front x (the back is further away: smaller). */
export const backX = (x: number) => 640 + (x - 640) * RING.back;
/** The steel steps beside each corner (stage units): [x0, x1, top]. */
export const STEPS: [number, number, number][] = [
  [18, 138, 594],
  [58, 138, 538],
  [1142, 1262, 594],
  [1142, 1222, 538],
];
/** The announcers' table (left of the ring): [x0, x1, top]. */
export const TABLE: [number, number, number] = [-150, -20, 600];
/** The poo puddle on the mat (stage x of its middle, half-width). */
export const PUDDLE = { x: 975, w: 100 };
/** The tunnel out of the stands (top of an aisle), and where the King sits in the front row. */
export const TUNNEL = { x: 470, top: 222, bottom: 297 };
export const KING_SEAT = { x: 548, feet: 300 };

export const STEEL: Fill = { base: '#3b3530', shade: '#1d1915', light: '#6d655c' };
const PAD: Fill = { base: '#d8243a', shade: '#9c1426', light: '#ff6a7a' };
const PAD_WHITE: Fill = { base: '#f6f3ee', shade: '#cfc8bd', light: '#ffffff' };
const PAD_BROWN: Fill = { base: '#7a4524', shade: '#4c2a14', light: '#b07a52' };
const SKIRT: Fill = { base: '#3a1f0e', shade: '#22110a', light: '#5e3418' };
/** Rope colours, bottom to top. */
export const ROPE_COL = ['#d8243a', '#f6f3ee', '#d8243a'];

/** The Poo Palace: the basketball arena, gone brown. */
export const POO_PALACE: ArenaStyle = {
  id: 'plopdome',
  bowl: ['#050302', '#0f0804', '#21120a', '#30190c'],
  tierUpper: '#170d06',
  tierLower: '#25150a',
  seatUpper: '#4a2a14',
  seatLower: '#62381a',
  shirts: ['#7a4524', '#7a4524', '#8b5434', '#ffd23f', '#ffd23f', '#f4ead8', '#f4ead8', '#2a1a10', '#9bb84a', '#c8102e', '#a06a48', '#5c3118'],
  wood: ['#c98c50', '#d19659', '#be8047', '#d7a165', '#c4874c', '#cc9256', '#b97b43', '#d39b5e'],
  apron: 'rgba(60,30,12,0.86)',
  lane: 'rgba(90,50,20,0.9)',
  words: ['PLOP', 'DOME'],
  wordColor: 'rgba(255,210,63,0.85)',
  ads: [
    { text: 'POOPA COLA', bg: '#7a3f1a', fg: '#ffe2b0' },
    { text: 'MADE BY HENRY & NEIL', bg: '#ffc629', fg: '#4a1f05' },
    { text: 'POO PALACE', bg: '#3a1d0c', fg: '#ffd23f' },
    { text: 'ROOT BEER · ICE COLD', bg: '#5a2a10', fg: '#ffe2b0' },
    { text: 'STINK STEEL CHAIRS', bg: '#9bb84a', fg: '#2a1a08' },
  ],
  jumboTitle: 'QUEEN PLOP',
  jumboSub: 'P O O   P A L A C E   ·   T I T L E   M A T C H',
  banners: [['PLOP', 'CHAMP'], ['STINK', 'CUP'], ['QUEEN OF', 'THE RING']],
  bannerTop: '#3a1d0c',
  bannerBottom: '#5c3118',
  frame: '#ffd23f',
  padTop: '#3a2414',
  padBottom: '#1a0e06',
  logo: '#ffd23f',
  net: [0xfbfbf8],
  layout: { jumboX: 375, bannerX: 1000, upperY0: -46, aislesU: [-40, 340, 1120, 1390], aislesL: [90, 470, 1270], seeds: [6161, 7373], cam: { dx: 0, dy: 0, zoom: 1, rot: 0 } },
};

function splat(ctx: Ctx, x: number, y: number, s: number, r: () => number) {
  const pts: Pt[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = i % 2 ? 0.55 + r() * 0.3 : 0.9 + r() * 0.5;
    pts.push([x + Math.cos(a) * s * k, y + Math.sin(a) * s * k * 0.6]);
  }
  ST.shape(ctx, pts, POO, Math.floor(r() * 99), { lw: 0.5, plain: true });
}

function sign(ctx: Ctx, x: number, y: number, text: string, bg: string, fg: string, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `400 15px ${FONT}`;
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-w / 2 + 2, -11, w, 24);
  ctx.fillStyle = bg;
  ctx.fillRect(-w / 2, -13, w, 24);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function pooPuddle(ctx: Ctx, x: number, y: number) {
  const r = rng(31);
  // splats flung out round it across the mat
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = 112 + r() * 40;
    splat(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.16, 5 + r() * 6, r);
  }
  // a dark wet stain soaked into the mat, then a big glossy heap of poo, bulging up
  ctx.fillStyle = 'rgba(70,35,12,0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 112, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  const heap: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI;
    // the top edge lumpy, the bottom edge flat on the mat
    heap.push([x - Math.cos(t) * 100, y + 4 - Math.sin(t) * (16 + Math.sin(i * 1.7) * 3)]);
  }
  for (let i = 40; i >= 0; i--) heap.push([x - Math.cos((i / 40) * Math.PI) * 100, y + 6 + Math.sin((i / 40) * Math.PI) * 9]);
  ST.shape(ctx, heap, POO_DARK, 21, { lw: 1.4, light: [x - 40, y - 20] });
  ST.shape(ctx, ellipsePts(x - 6, y - 4, 82, 10, 0, 40), POO, 22, { lw: 0.6, plain: true });
  // ripples and a big wet shine
  ctx.strokeStyle = 'rgba(255,230,200,0.55)';
  ctx.lineWidth = 1.8;
  for (const [rx, ry] of [[24, 3.5], [44, 6.5]]) {
    ctx.beginPath();
    ctx.ellipse(x + 20, y - 4, rx, ry, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffffcc';
  ctx.beginPath();
  ctx.ellipse(x - 40, y - 9, 22, 3, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 52, y - 7, 8, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // bubbles (one popping)
  for (const [bx, by, br] of [[x + 34, y - 7, 7], [x - 6, y - 5, 4.5], [x + 64, y - 3, 4], [x - 66, y - 3, 3.5]])
    ST.shape(ctx, ellipsePts(bx, by - br, br, br, 0, 16), POO, Math.round(bx), { lw: 0.8, light: [bx - br / 2, by - br * 1.5] });
  ctx.strokeStyle = 'rgba(255,230,200,0.8)';
  ctx.lineWidth = 1.6;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + 10 + Math.cos(a) * 7, y - 16 + Math.sin(a) * 5);
    ctx.lineTo(x + 10 + Math.cos(a) * 11, y - 16 + Math.sin(a) * 8);
    ctx.stroke();
  }
  // swirls poking up out of it, and a big cloud of stink (with flies)
  drawPooSwirl(ctx, x - 58, y - 4, 26, POO, 23);
  drawPooSwirl(ctx, x + 76, y - 2, 18, POO_DARK, 24);
  ctx.strokeStyle = 'rgba(150,200,70,0.85)';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  for (const sx of [x - 34, x - 6, x + 22, x + 50]) {
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const yy = y - 18 - k * 4.5;
      const xx = sx + Math.sin(k * 0.8 + sx) * 5;
      if (k) ctx.lineTo(xx, yy);
      else ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#1a120c';
  for (const [fx, fy] of [[x - 20, y - 70], [x + 40, y - 84], [x + 8, y - 98]]) {
    ctx.beginPath();
    ctx.ellipse(fx, fy, 2.6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(fx - 2, fy - 3, 2.4, 1.4, -0.5, 0, Math.PI * 2);
    ctx.ellipse(fx + 2, fy - 3, 2.4, 1.4, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a120c';
  }
}

function flat(ctx: Ctx, pts: Pt[], top: string, bottom: string, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = ST.ink;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function post(ctx: Ctx, x: number, footY: number, h: number, s: number) {
  ST.shape(ctx, roundRectPts(x - 7 * s, footY - h, 14 * s, h, 3 * s), STEEL, Math.round(x), { lw: s });
  // turnbuckle pads at each rope, and a cap on top
  RING.ropes.forEach((rh, i) => ST.shape(ctx, roundRectPts(x - 11 * s, footY - rh * s - 9 * s, 22 * s, 18 * s, 5 * s), i === 1 ? PAD_WHITE : PAD, Math.round(x) + i, { lw: 0.9 * s }));
  ST.shape(ctx, ellipsePts(x, footY - h, 9 * s, 4 * s, 0, 16), STEEL, Math.round(x) + 9, { lw: 0.8 * s });
}



/**
 * The poo on the arena: drips off the rafters, the jumbotron and the decks, splats on the LED
 * boards, a brown haze, and fans holding up signs (drawn over the arena's front layer).
 */
export function drawArenaPoo(ctx: Ctx) {
  ctx.save();
  ctx.translate(STAGE_OX, STAGE_OY);
  const r = rng(77);
  for (let x = -150; x < 1430; x += 22 + r() * 40) drawDrip(ctx, x, -64, 8 + r() * 26, 4 + r() * 4, r() < 0.5 ? POO : POO_DARK);
  for (let x = JUMBO.x + 6; x < JUMBO.x + JUMBO.w * JUMBO.s - 6; x += 18 + r() * 34) drawDrip(ctx, x, JUMBO.y + JUMBO.h * JUMBO.s + 4, 6 + r() * 22, 4 + r() * 3);
  for (let x = -150; x < 1430; x += 30 + r() * 60) drawDrip(ctx, x, 147, 5 + r() * 16, 3 + r() * 3, r() < 0.5 ? POO : POO_DARK);
  for (let x = -150; x < 1430; x += 40 + r() * 80) drawDrip(ctx, x, 331, 4 + r() * 12, 3 + r() * 3);
  for (let i = 0; i < 9; i++) splat(ctx, -100 + r() * 1480, 300 + r() * 28, 6 + r() * 9, r);
  const haze = ctx.createLinearGradient(0, -90, 0, 330);
  haze.addColorStop(0, 'rgba(70,40,10,0.0)');
  haze.addColorStop(0.6, 'rgba(90,55,18,0.10)');
  haze.addColorStop(1, 'rgba(110,70,25,0.16)');
  ctx.fillStyle = haze;
  ctx.fillRect(-160, -90, 1600, 420);
  const signs = ['POOPA!', 'GO PUFFY', 'STINKY!', 'QUEEN ♛ PLOP', 'POO PALACE', 'P.U.!'];
  for (let i = 0; i < 9; i++) {
    const x = -60 + i * 160 + r() * 50;
    const y = 175 + r() * 90;
    const rot = (r() - 0.5) * 0.18;
    if (i === 3) continue; // (clear of the tunnel out of the stands)
    sign(ctx, x, y, signs[i % signs.length], i % 3 === 1 ? '#ffd23f' : '#f6efe2', i % 3 === 1 ? '#3a1d0c' : '#5c3118', rot);
  }
  ctx.restore();
}

/** The tunnel out of the lower stands (on the crowd layer: the King runs into it). */
export function drawTunnel(ctx: Ctx) {
  ctx.save();
  ctx.translate(STAGE_OX, STAGE_OY);
  const { x, top, bottom } = TUNNEL;
  ctx.fillStyle = '#050302';
  ctx.beginPath();
  ctx.moveTo(x - 24, bottom);
  ctx.lineTo(x - 24, top + 14);
  ctx.quadraticCurveTo(x, top, x + 24, top + 14);
  ctx.lineTo(x + 24, bottom);
  ctx.fill();
  ctx.strokeStyle = '#3b3530';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#1d6b2a';
  ctx.fillRect(x - 15, top - 14, 30, 11);
  ctx.fillStyle = '#eafff0';
  ctx.font = `400 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', x, top - 8);
  ctx.restore();
}

/** The arena floor around the ring: black mats with poo on them, and the barricade in front of the fans. */
export function drawRingFloor(ctx: Ctx) {
  ctx.save();
  ctx.translate(STAGE_OX, STAGE_OY);
  const fl = ctx.createLinearGradient(0, 330, 0, 810);
  fl.addColorStop(0, '#1a110b');
  fl.addColorStop(1, '#2a1a10');
  ctx.fillStyle = fl;
  ctx.fillRect(-160, 331, 1600, 480);
  const r = rng(404);
  for (let i = 0; i < 18; i++) {
    const x = -100 + r() * 1480;
    const y = 345 + r() * 360;
    ctx.fillStyle = `rgba(110,62,28,${0.2 + r() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 20 + r() * 50, 4 + r() * 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ST.shape(ctx, [[-170, 345], [1450, 345], [1450, 360], [-170, 360]], PAD_BROWN, 3, { lw: 0.8 });
  ctx.restore();
}

/** The ring's box for its texture (stage units): what drawRing covers. */
export const RING_BOX = { x: 100, y: 330, w: 1080, h: 270 };

/**
 * The ring itself (no ropes: those move): the back posts, the mat with the Queen's name on it,
 * stains, the poo puddle, and the skirt with POO PALACE on it, poo slopping down it.
 * Drawn in stage units (the caller translates to RING_BOX).
 */
export function drawRing(ctx: Ctx) {
  const R = RING;
  for (const x of [backX(R.x0), backX(R.x1)]) post(ctx, x, R.backY, R.post * R.back, 0.9);
  const mat: Pt[] = [[backX(R.x0), R.backY], [backX(R.x1), R.backY], [R.x1 + R.apron, R.frontY], [R.x0 - R.apron, R.frontY]];
  flat(ctx, mat, '#f8f5f0', '#d9d2c6', R.backY, R.frontY);
  ctx.save();
  ctx.translate(640, (R.backY + R.frontY) / 2 + 4);
  ctx.scale(1, 0.24);
  ctx.globalAlpha = 0.45;
  ctx.font = `400 92px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c8102e';
  ctx.fillText('♛ QUEEN PLOP ♛', 0, 0);
  ctx.restore();
  const r = rng(404);
  for (let i = 0; i < 9; i++) {
    const x = 230 + r() * 820;
    const y = R.backY + 8 + r() * (R.frontY - R.backY - 14);
    ctx.fillStyle = `rgba(120,70,30,${0.18 + r() * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + r() * 26, 2.5 + r() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  pooPuddle(ctx, PUDDLE.x, R.floorY + 3);
  // the skirt: red, with white trim top and bottom; the show's name in brown
  const sx0 = R.x0 - R.apron;
  const sx1 = R.x1 + R.apron;
  flat(ctx, [[sx0, R.frontY], [sx1, R.frontY], [sx1, R.skirtY], [sx0, R.skirtY]], '#e0303f', '#a3172a', R.frontY, R.skirtY);
  ctx.fillStyle = '#f6f3ee';
  ctx.fillRect(sx0 + 1.5, R.frontY + 1.5, sx1 - sx0 - 3, 9);
  ctx.fillRect(sx0 + 1.5, R.skirtY - 12, sx1 - sx0 - 3, 7);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(sx0 + 1.5, R.frontY + 10.5, sx1 - sx0 - 3, 2);
  ctx.font = `400 46px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#fff3d6';
  ctx.strokeText('POO PALACE', 640, (R.frontY + R.skirtY) / 2 + 2);
  ctx.fillStyle = '#5c3118';
  ctx.fillText('POO PALACE', 640, (R.frontY + R.skirtY) / 2 + 2);
  ctx.font = `400 22px ${FONT}`;
  ctx.fillStyle = '#f6f3ee';
  ctx.fillText('♛', 640 - 175, (R.frontY + R.skirtY) / 2);
  ctx.fillText('♛', 640 + 175, (R.frontY + R.skirtY) / 2);
  for (let x = R.x0; x < R.x1; x += 50 + r() * 90) drawDrip(ctx, x, R.frontY + 1, 6 + r() * 22, 5 + r() * 5, r() < 0.6 ? POO : POO_DARK);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(R.x0 - R.apron, R.skirtY, R.x1 - R.x0 + R.apron * 2, 6);
}

/** One front corner post with its turnbuckle pads (in front of the fighters). Box: 40 × (post + 16), foot at the bottom middle. */
export const POST_BOX = { w: 40, h: RING.post + 16 };
export function drawFrontPost(ctx: Ctx) {
  post(ctx, POST_BOX.w / 2, POST_BOX.h - 2, RING.post, 1);
}

/** The steel steps and the announcers' table (stage units, untranslated: drawn where they stand). */
export function drawRingside(ctx: Ctx) {
  // the steel steps: one staircase at each corner (diamond-plate treads, bolted side panels)
  for (const side of [-1, 1]) {
    const steps = STEPS.filter(([x0]) => (side < 0 ? x0 < 640 : x0 > 640)).sort((a, b) => b[2] - a[2]);
    steps.forEach(([x0, x1, top], i) => stepBlock(ctx, x0, x1, top, RING.groundY + 6, side, 30 + i * 3 + (side > 0 ? 10 : 0)));
  }
  const [tx0, tx1, ttop] = TABLE;
  ST.shape(ctx, roundRectPts(tx0, ttop, tx1 - tx0, RING.groundY + 6 - ttop, 6), SKIRT, 40, { lw: 1.1 });
  ctx.fillStyle = '#ffd23f';
  ctx.font = `400 20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POOPA TV', (tx0 + tx1) / 2, ttop + 28);
  ST.shape(ctx, roundRectPts(tx0 + 12, ttop - 30, 46, 30, 3), STEEL, 41, { lw: 0.9 });
  ST.shape(ctx, roundRectPts(tx0 + 70, ttop - 30, 46, 30, 3), STEEL, 42, { lw: 0.9 });
  ctx.fillStyle = '#7fe7ff55';
  ctx.fillRect(tx0 + 16, ttop - 26, 38, 20);
  ctx.fillRect(tx0 + 74, ttop - 26, 38, 20);
  drawPooSwirl(ctx, 330, RING.groundY + 8, 30, POO, 51);
  drawPooSwirl(ctx, 960, RING.groundY + 14, 24, POO_DARK, 52);
}

/** One block of the steel steps: a riveted steel box with a diamond-plate tread on top. */
function stepBlock(ctx: Ctx, x0: number, x1: number, top: number, bottom: number, side: number, seed: number) {
  // its shadow on the floor
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse((x0 + x1) / 2, bottom - 2, (x1 - x0) / 2 + 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ST.shape(ctx, roundRectPts(x0, top, x1 - x0, bottom - top, 5), STEEL, seed, { lw: 1.1, light: [side < 0 ? x1 - 8 : x0 + 8, top] });
  // the tread: a bright steel lip with a diamond pattern
  const g = ctx.createLinearGradient(0, top, 0, top + 12);
  g.addColorStop(0, '#b9b2a8');
  g.addColorStop(1, '#6d655c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x0 + 2, top + 2, x1 - x0 - 4, 11, 4);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0 + 2, top + 2, x1 - x0 - 4, 11, 4);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.2;
  for (let x = x0 - 10; x < x1 + 10; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, top + 13);
    ctx.lineTo(x + 6, top + 3);
    ctx.moveTo(x + 6, top + 13);
    ctx.lineTo(x, top + 3);
    ctx.stroke();
  }
  ctx.restore();
  // the side panel: a darker inset with rivets in each corner
  const py0 = top + 18;
  const py1 = bottom - 8;
  if (py1 - py0 > 14) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.roundRect(x0 + 8, py0, x1 - x0 - 16, py1 - py0, 4);
    ctx.fill();
    ctx.fillStyle = '#c9c2b8';
    for (const [rx, ry] of [[x0 + 13, py0 + 5], [x1 - 13, py0 + 5], [x0 + 13, py1 - 5], [x1 - 13, py1 - 5]]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The jumbotron: one of the scoreboard's screens, with this show's own crawl along the bottom. */
export function drawWrestleJumbo(ctx: Ctx, c: JumboContent, t: number, crawl: [string, string][]) {
  drawJumboScreen(ctx, c, t);
  const y0 = JUMBO.h - 18 + 1.5;
  const bar = ctx.createLinearGradient(0, y0, 0, JUMBO.h);
  bar.addColorStop(0, '#1c1430');
  bar.addColorStop(1, '#0a0714');
  ctx.fillStyle = bar;
  ctx.fillRect(50, y0, JUMBO.w - 50, JUMBO.h - y0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(50, y0, JUMBO.w - 50, JUMBO.h - y0);
  ctx.clip();
  ctx.font = `400 12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const items: [string, string][] = crawl.flatMap((it, i) => (i ? [['   ★   ', '#ffd23f'] as [string, string], it] : [it]));
  const total = items.reduce((a, [s]) => a + ctx.measureText(s).width, 0) + ctx.measureText('   ★   ').width;
  for (let x = 56 - ((t * 46) % total) - total; x < JUMBO.w; x += total) {
    let xx = x;
    for (const [s, col] of items) {
      ctx.fillStyle = col;
      ctx.fillText(s, xx, y0 + (JUMBO.h - y0) / 2 + 0.5);
      xx += ctx.measureText(s).width;
    }
  }
  ctx.restore();
}
