// Concept screens for the Part 3 boss fight: a poo-covered wrestling arena (not shipped code).
import {
  ARENA_H, ARENA_W, JUMBO, RIBBON, STAGE_OX, STAGE_OY,
  drawArena, drawArenaFront, drawCrowd, drawJumboScreen, drawRibbonScreen, setArenaStyle,
  type ArenaStyle, type JumboContent,
} from '../../src/gfx/hoops';
import { drawPlop, type PlopFrame } from '../../src/gfx/plops';
import { drawCharacter, rng, type Ctx, type Pose } from '../../src/gfx/draw';
import { CHARACTERS } from '../../src/data/characters';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from '../../src/gfx/handdrawn';
import { POO, POO_DARK, drawDrip, drawPooSwirl } from '../../src/gfx/plopworld';
import { drawNuggie } from '../../src/gfx/collectibles';

const ST = STYLES.polished;
const FONT = '"Lilita One", "Arial Black", sans-serif';

/** The Plop Dome: the basketball arena, gone brown. */
const PLOP_DOME: ArenaStyle = {
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

function mk(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

// ───────────────────────── the arena (stage coordinates, 1280 × 720) ──

/** Drawn once at 2× (the arena pictures, then the poo on top). */
function arenaBackdrop(jumbo: JumboContent, excited: boolean) {
  setArenaStyle(PLOP_DOME);
  const S = 2;
  const { c, ctx } = mk(ARENA_W * S, ARENA_H * S);
  ctx.scale(S, S);
  drawArena(ctx);
  drawCrowd(ctx, excited);
  drawArenaFront(ctx);
  // live screens
  const j = mk(JUMBO.w * 2, JUMBO.h * 2);
  j.ctx.scale(2, 2);
  drawJumboScreen(j.ctx, jumbo, 1.3);
  // (the crawl along the bottom: this show's own, not the basketball one)
  {
    const c2 = j.ctx;
    const y0 = JUMBO.h - 18 + 1.5;
    const bar = c2.createLinearGradient(0, y0, 0, JUMBO.h);
    bar.addColorStop(0, '#1c1430');
    bar.addColorStop(1, '#0a0714');
    c2.fillStyle = bar;
    c2.fillRect(50, y0, JUMBO.w - 50, JUMBO.h - y0);
    c2.font = `400 12px ${FONT}`;
    c2.textAlign = 'left';
    c2.textBaseline = 'middle';
    let x = 56;
    for (const [t, col] of [['POO PALACE', '#ffd23f'], ['  ★  ', '#ffd23f'], ['QUEEN PLOP vs PUFFY', '#ffffff'], ['  ★  ', '#ffd23f'], ['TITLE MATCH', '#7fe7ff'], ['  ★  ', '#ffd23f'], ['POOPA COLA', '#ffffff']]) {
      c2.fillStyle = col;
      c2.fillText(t, x, y0 + (JUMBO.h - y0) / 2 + 0.5);
      x += c2.measureText(t).width;
    }
  }
  ctx.drawImage(j.c, JUMBO.x + STAGE_OX, JUMBO.y + STAGE_OY, JUMBO.w * JUMBO.s, JUMBO.h * JUMBO.s);
  const rb = mk(RIBBON.w * 2, RIBBON.h * 2);
  rb.ctx.scale(2, 2);
  drawRibbonScreen(rb.ctx, 3.2, null);
  ctx.drawImage(rb.c, RIBBON.x + STAGE_OX, RIBBON.y + STAGE_OY, RIBBON.w, RIBBON.h);

  ctx.translate(STAGE_OX, STAGE_OY);
  const r = rng(77);
  // poo dripping off the rafters, the jumbotron and the decks
  for (let x = -150; x < 1430; x += 22 + r() * 40) drawDrip(ctx, x, -64, 8 + r() * 26, 4 + r() * 4, r() < 0.5 ? POO : POO_DARK);
  for (let x = JUMBO.x + 6; x < JUMBO.x + JUMBO.w * JUMBO.s - 6; x += 18 + r() * 34) drawDrip(ctx, x, JUMBO.y + JUMBO.h * JUMBO.s + 4, 6 + r() * 22, 4 + r() * 3);
  for (let x = -150; x < 1430; x += 30 + r() * 60) drawDrip(ctx, x, 147, 5 + r() * 16, 3 + r() * 3, r() < 0.5 ? POO : POO_DARK);
  for (let x = -150; x < 1430; x += 40 + r() * 80) drawDrip(ctx, x, 331, 4 + r() * 12, 3 + r() * 3);
  // splats on the LED boards
  for (let i = 0; i < 9; i++) splat(ctx, -100 + r() * 1480, 300 + r() * 28, 6 + r() * 9, r);
  // brown haze hanging in the bowl
  const haze = ctx.createLinearGradient(0, -90, 0, 330);
  haze.addColorStop(0, 'rgba(70,40,10,0.0)');
  haze.addColorStop(0.6, 'rgba(90,55,18,0.10)');
  haze.addColorStop(1, 'rgba(110,70,25,0.16)');
  ctx.fillStyle = haze;
  ctx.fillRect(-160, -90, 1600, 420);
  // fans' signs
  const signs = ['POOPA!', 'GO PUFFY', 'STINKY!', 'QUEEN ♛ PLOP', 'POO PALACE', 'P.U.!'];
  for (let i = 0; i < 9; i++) {
    const x = -60 + i * 160 + r() * 50;
    const y = 175 + r() * 90;
    sign(ctx, x, y, signs[i % signs.length], i % 3 === 1 ? '#ffd23f' : '#f6efe2', i % 3 === 1 ? '#3a1d0c' : '#5c3118', (r() - 0.5) * 0.18);
  }
  return c;
}

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

// ───────────────────────── the ring (side-on "hard cam") ──

/**
 * The ring, as the TV hard camera sees it from the side: the fight is plain 2D along
 * one line across the canvas (FLOOR_Y); everything else is scenery around that line.
 */
export const RING = {
  /** Front posts (stage x), and how much the back of the ring shrinks toward the middle. */
  x0: 150,
  x1: 1130,
  back: 0.885,
  /** The canvas: its back edge, front edge, and the line the fighters stand on. */
  backY: 440,
  frontY: 506,
  floorY: 482,
  /** The apron's skirt hangs down to here; ringside floor below. */
  skirtY: 586,
  /** Rope heights above the canvas at the front, and the post height. */
  ropes: [30, 60, 90],
  post: 112,
};

const bx = (x: number) => 640 + (x - 640) * RING.back;

const STEEL: Fill = { base: '#3b3530', shade: '#1d1915', light: '#6d655c' };
const PAD: Fill = { base: '#ffd23f', shade: '#c9971a', light: '#fff0a8' };
const PAD_BROWN: Fill = { base: '#7a4524', shade: '#4c2a14', light: '#b07a52' };
const SKIRT: Fill = { base: '#3a1f0e', shade: '#22110a', light: '#5e3418' };
const MAT: Fill = { base: '#e9dcc4', shade: '#c8b597', light: '#fbf4e6' };
const ROPE_COL = ['#c8102e', '#f4ead8', '#7a4524'];

function ringBack(ctx: Ctx) {
  const R = RING;
  // ringside floor: black mats, with poo
  const fl = ctx.createLinearGradient(0, 330, 0, 720);
  fl.addColorStop(0, '#1a110b');
  fl.addColorStop(1, '#2a1a10');
  ctx.fillStyle = fl;
  ctx.fillRect(-160, 331, 1600, 480);
  const r = rng(404);
  for (let i = 0; i < 14; i++) {
    const x = -100 + r() * 1480;
    const y = 345 + r() * 100;
    ctx.fillStyle = `rgba(110,62,28,${0.25 + r() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 20 + r() * 50, 4 + r() * 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // the barricade in front of the front row (steel, padded)
  ST.shape(ctx, [[-170, 345], [1450, 345], [1450, 360], [-170, 360]], PAD_BROWN, 3, { lw: 0.8 });
  // back posts + back ropes (behind the fighters)
  for (const x of [bx(R.x0), bx(R.x1)]) post(ctx, x, R.backY, R.post * R.back, 0.9);
  R.ropes.forEach((h, i) => rope(ctx, bx(R.x0), bx(R.x1), R.backY - h * R.back, ROPE_COL[i], 3.2 * R.back, 0.012));
  // side ropes (back post → front post) on the far side are hidden by the posts; draw both ends
  for (const [xb, xf] of [[bx(R.x0), R.x0], [bx(R.x1), R.x1]] as const)
    R.ropes.forEach((h, i) => sideRope(ctx, xb, R.backY - h * R.back, xf, R.frontY - h, ROPE_COL[i]));
  // the mat
  const mat: Pt[] = [[bx(R.x0), R.backY], [bx(R.x1), R.backY], [R.x1 + 12, R.frontY], [R.x0 - 12, R.frontY]];
  flat(ctx, mat, '#e9dcc4', '#c8b597', R.backY, R.frontY);
  // the King's logo in the middle of the mat (squashed by the camera angle), poo stains
  ctx.save();
  ctx.translate(640, (R.backY + R.frontY) / 2 + 4);
  ctx.scale(1, 0.24);
  ctx.globalAlpha = 0.45;
  ctx.font = `400 92px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8a5232';
  ctx.fillText('♛ QUEEN PLOP ♛', 0, 0);
  ctx.restore();
  for (let i = 0; i < 9; i++) {
    const x = 230 + r() * 820;
    const y = R.backY + 8 + r() * (R.frontY - R.backY - 14);
    ctx.fillStyle = `rgba(120,70,30,${0.18 + r() * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + r() * 26, 2.5 + r() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // a poo puddle in the far-right corner of the mat (a hazard: slows you, like the level's puddles)
  pooPuddle(ctx, 925, R.floorY + 3);
  // the skirt (the front face of the ring) with the show's name
  flat(ctx, [[R.x0 - 12, R.frontY], [R.x1 + 12, R.frontY], [R.x1 + 12, R.skirtY], [R.x0 - 12, R.skirtY]], '#3a1f0e', '#22110a', R.frontY, R.skirtY);
  ctx.fillStyle = '#ffd23f';
  ctx.font = `400 46px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POO PALACE', 640, (R.frontY + R.skirtY) / 2 + 2);
  ctx.font = `400 22px ${FONT}`;
  ctx.fillStyle = '#c99064';
  ctx.fillText('♛', 640 - 205, (R.frontY + R.skirtY) / 2);
  ctx.fillText('♛', 640 + 205, (R.frontY + R.skirtY) / 2);
  // poo slopped over the apron edge, dripping down the skirt
  for (let x = R.x0; x < R.x1; x += 26 + r() * 50) drawDrip(ctx, x, R.frontY + 1, 6 + r() * 26, 5 + r() * 5, r() < 0.6 ? POO : POO_DARK);
  // shadow under the ring
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(R.x0 - 12, R.skirtY, R.x1 - R.x0 + 24, 6);
}

/** Things in front of the fighters: the front ropes (see-through, so they never hide the fight) and posts. */
function ringFront(ctx: Ctx, ropeAlpha = 0.55) {
  const R = RING;
  ctx.save();
  ctx.globalAlpha = ropeAlpha;
  R.ropes.forEach((h, i) => rope(ctx, R.x0, R.x1, R.frontY - h, ROPE_COL[i], 3.6, 0.018));
  ctx.restore();
  for (const x of [R.x0, R.x1]) post(ctx, x, R.frontY, R.post, 1);
}

function ringside(ctx: Ctx) {
  const R = RING;
  // steel steps at the right corner
  const sx = R.x1 + 30;
  const steps: [number, number, number][] = [[0, 720, 70], [18, 676, 52], [36, 636, 34]];
  steps.forEach(([dx, y, w], i) => ST.shape(ctx, roundRectPts(sx + dx, y - 40, w + 40, 40, 4), STEEL, 30 + i, { lw: 1 }));
  // the announce table at the left, with two monitors and a bell
  ST.shape(ctx, roundRectPts(-40, 640, 210, 90, 6), SKIRT, 40, { lw: 1.1 });
  ctx.fillStyle = '#ffd23f';
  ctx.font = `400 22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('POOPA TV', 65, 690);
  ST.shape(ctx, roundRectPts(10, 610, 54, 32, 3), STEEL, 41, { lw: 0.9 });
  ST.shape(ctx, roundRectPts(84, 610, 54, 32, 3), STEEL, 42, { lw: 0.9 });
  ctx.fillStyle = '#7fe7ff55';
  ctx.fillRect(15, 614, 44, 22);
  ctx.fillRect(89, 614, 44, 22);
  ST.shape(ctx, ellipsePts(150, 634, 10, 7, 0, 18), PAD, 43, { lw: 0.8 });
  // poo piles on the ringside floor
  drawPooSwirl(ctx, 300, 700, 34, POO, 51);
  drawPooSwirl(ctx, 1000, 712, 26, POO_DARK, 52);
}

/** The poo puddle on the mat: big, glossy, bubbling and stinking (you can't miss it). */
function pooPuddle(ctx: Ctx, x: number, y: number) {
  // a dark rim where it's soaked into the mat, then the glossy poo, raised a little
  ctx.fillStyle = 'rgba(70,35,12,0.45)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 84, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ST.shape(ctx, ellipsePts(x, y - 1, 74, 12, 0, 40), POO_DARK, 21, { lw: 1.1 });
  ST.shape(ctx, ellipsePts(x - 4, y - 3, 62, 9, 0, 40), POO, 22, { lw: 0.6, plain: true });
  // ripples, shine and bubbles
  ctx.strokeStyle = 'rgba(255,230,200,0.45)';
  ctx.lineWidth = 1.4;
  for (const [rx, ry] of [[22, 3.5], [38, 6]]) {
    ctx.beginPath();
    ctx.ellipse(x + 14, y - 3, rx, ry, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffffaa';
  ctx.beginPath();
  ctx.ellipse(x - 30, y - 6, 16, 2.6, -0.05, 0, Math.PI * 2);
  ctx.fill();
  for (const [bx, by, br] of [[x + 30, y - 6, 5], [x - 8, y - 4, 3.5], [x + 48, y - 2, 3]]) ST.shape(ctx, ellipsePts(bx, by - br, br, br, 0, 14), POO, Math.round(bx), { lw: 0.7, light: [bx - br / 2, by - br * 1.5] });
  // a swirl poking up out of it, and stink
  drawPooSwirl(ctx, x - 44, y - 2, 20, POO, 23);
  ctx.strokeStyle = 'rgba(160,200,90,0.75)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (const sx of [x - 20, x + 6, x + 32]) {
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) {
      const yy = y - 14 - k * 4;
      const xx = sx + Math.sin(k * 0.9 + sx) * 4;
      if (k) ctx.lineTo(xx, yy);
      else ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
}

/** A big flat panel (mat, skirt): a top-to-bottom shade and an ink outline (no round sheen). */
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
  RING.ropes.forEach((rh, i) => ST.shape(ctx, roundRectPts(x - 11 * s, footY - rh * s - 9 * s, 22 * s, 18 * s, 5 * s), i === 1 ? PAD_BROWN : PAD, Math.round(x) + i, { lw: 0.9 * s }));
  ST.shape(ctx, ellipsePts(x, footY - h, 9 * s, 4 * s, 0, 16), STEEL, Math.round(x) + 9, { lw: 0.8 * s });
}

function rope(ctx: Ctx, x0: number, x1: number, y: number, col: string, w: number, sag: number) {
  const mid = y + (x1 - x0) * sag;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1a0e06';
  ctx.lineWidth = w + 2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, mid, x1, y);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = w * 0.3;
  ctx.beginPath();
  ctx.moveTo(x0, y - w * 0.2);
  ctx.quadraticCurveTo((x0 + x1) / 2, mid - w * 0.2, x1, y - w * 0.2);
  ctx.stroke();
}

function sideRope(ctx: Ctx, xa: number, ya: number, xb: number, yb: number, col: string) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#1a0e06';
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(xa, ya);
  ctx.lineTo(xb, yb);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.8;
  ctx.stroke();
}

// ───────────────────────── fighters ──

function hero(ctx: Ctx, id: string, x: number, footY: number, pose: Pose, s = 1.7, flip = false) {
  const ch = CHARACTERS.find((c) => c.id === id)!;
  const k = s * ch.scale;
  shadow(ctx, x, footY, 24 * k);
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(flip ? -k : k, k);
  drawCharacter(ctx, -28, -56, ch, pose);
  ctx.restore();
}

function king(ctx: Ctx, x: number, footY: number, f: PlopFrame, s = 2.2, flip = true) {
  shadow(ctx, x, footY, 34 * s);
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(flip ? -s : s, s);
  drawQueen(ctx, -50, -100, f);
  ctx.restore();
}

const PINK: Fill = { base: '#e8579a', shade: '#b23272', light: '#ff9cc8' };
const PEARL: Fill = { base: '#fbf4ea', shade: '#dccfbf', light: '#ffffff' };
const SILVER: Fill = { base: '#f1d36a', shade: '#c79a2c', light: '#fff6c4' };

/**
 * Queen Plop (concept): a Plop with a pink royal cape, a tiara, long lashes, pink lips,
 * rosy cheeks, a pearl necklace and a bow on her swirl. Same frame layout as drawPlop.
 */
function drawQueen(ctx: Ctx, ox: number, oy: number, f: PlopFrame) {
  const ground = oy + 100;
  const cx = ox + 50;
  const yell = f === 'yell0' || f === 'yell1';
  const hurt = f === 'hurt';
  const bob = f === 'run1' || f === 'yell1' ? -3 : f === 'idle1' ? -1.5 : hurt ? 2.5 : 0;
  const sqY = f === 'idle1' ? 1.05 : hurt ? 0.9 : 1;
  const botY = ground - 30 + bob;
  const topY = botY - 27 * sqY;
  // the pink cape, flowing out behind her (a frill along its hem)
  ST.shape(ctx, [[cx - 26, botY - 28], [cx + 26, botY - 28], [cx + 44, ground - 4], [cx + 22, ground], [cx, ground - 4], [cx - 22, ground], [cx - 44, ground - 4]], PINK, 3005, { lw: 1.1, light: [cx - 14, botY - 10] });
  for (let k = -40; k <= 40; k += 8) ST.shape(ctx, ellipsePts(cx + k, ground - 3, 4.4, 3.2, 0, 12), PEARL, 3006 + k, { lw: 0.6, plain: true });
  drawPlop(ctx, ox, oy, f, ST, 'medium');
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
    for (const k of [-0.9, -0.45, 0]) {
      const a = -Math.PI / 2 + k + (ex < cx ? -0.25 : 0.25);
      const x0 = ex + Math.cos(a) * er * 0.82 - (ex < cx ? 2 : -2);
      const y0 = topY - 3 + Math.sin(a) * er;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + Math.cos(a) * 3, y0 + Math.sin(a) * 5, x0 + Math.cos(a - 0.5) * 6, y0 + Math.sin(a - 0.5) * 6 - 1);
      ctx.stroke();
    }
  }
  // rosy cheeks
  ctx.fillStyle = 'rgba(255,110,150,0.5)';
  for (const bx of [cx - 23, cx + 23]) {
    ctx.beginPath();
    ctx.ellipse(bx, topY + 9, 5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // pink lips (over the little mouth line), unless she's shouting or hurt
  if (!yell && !hurt) {
    ST.shape(ctx, [[cx - 12, botY + 4], [cx - 7, botY + 1], [cx - 4, botY + 2.5], [cx - 1, botY + 1], [cx + 4, botY + 4], [cx - 4, botY + 8]], { base: '#ff6fae', shade: '#d4407f', light: '#ffc0dc' }, 3030, { lw: 0.8, plain: true });
  }
  // a string of pearls where her two tiers meet
  for (let k = -24; k <= 24; k += 5.5) {
    const py = botY - 17 + (k * k) / 120;
    ST.shape(ctx, ellipsePts(cx + k, py, 2.6, 2.6, 0, 10), PEARL, 3040 + k, { lw: 0.5, plain: true });
  }
}

function plop(ctx: Ctx, x: number, footY: number, f: PlopFrame, s: number, flip = false) {
  shadow(ctx, x, footY, 26 * s);
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(flip ? -s : s, s);
  drawPlop(ctx, -50, -100, f, ST, 'small');
  ctx.restore();
}

function shadow(ctx: Ctx, x: number, y: number, rx: number) {
  ctx.fillStyle = 'rgba(40,20,5,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, rx, rx * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** The ring announcer's / referee's striped shirt drawn over a small Plop. */
function refStripes(ctx: Ctx, x: number, footY: number, s: number) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, footY - 40 * s, 30 * s, 22 * s, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = -6; i < 6; i++) {
    ctx.fillStyle = i % 2 ? '#111' : '#f4f4f0';
    ctx.fillRect(x + i * 6 * s, footY - 70 * s, 6 * s, 60 * s);
  }
  ctx.restore();
}

// ───────────────────────── lights, HUD, notes ──

function spot(ctx: Ctx, x: number, top: number, bottom: number, w: number, a = 0.13, col = '255,240,200') {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const f = 1 - i * 0.17;
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 8 * f, top);
    ctx.lineTo(x + 8 * f, top);
    ctx.lineTo(x + (w / 2) * f, bottom);
    ctx.lineTo(x - (w / 2) * f, bottom);
    ctx.fill();
  }
  ctx.restore();
}

function vignette(ctx: Ctx, k = 0.55) {
  const g = ctx.createRadialGradient(640, 420, 200, 640, 400, 900);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${k})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 720);
}

function healthBars(ctx: Ctx, you: number, boss: number, nugs = 2) {
  const bar = (x: number, w: number, name: string, v: number, col: string, right: boolean) => {
    ctx.fillStyle = 'rgba(20,10,4,0.85)';
    ctx.beginPath();
    ctx.roundRect(x - 6, 22, w + 12, 50, 12);
    ctx.fill();
    ctx.fillStyle = '#3a2416';
    ctx.beginPath();
    ctx.roundRect(x, 48, w, 16, 8);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    if (right) ctx.roundRect(x + w * (1 - v), 48, w * v, 16, 8);
    else ctx.roundRect(x, 48, w * v, 16, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(right ? x + w * (1 - v) + 6 : x + 6, 50, w * v - 12, 4);
    ctx.font = `400 20px ${FONT}`;
    ctx.fillStyle = '#fff6e4';
    ctx.textAlign = right ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(name, right ? x + w : x, 43);
  };
  // you: 3 hearts (like Battle mode) and your nuggies (a hit with a nuggie costs the nuggie;
  // with none, it costs a heart)
  ctx.fillStyle = 'rgba(20,10,4,0.85)';
  ctx.beginPath();
  ctx.roundRect(24, 22, 300, 50, 12);
  ctx.fill();
  ctx.font = `400 20px ${FONT}`;
  ctx.fillStyle = '#fff6e4';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('PUFFY', 38, 48);
  for (let i = 0; i < 3; i++) heart(ctx, 128 + i * 32, 47, 12, i < you);
  drawNuggie(ctx, 246, 47, 13);
  ctx.font = `400 24px ${FONT}`;
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('× ' + nugs, 266, 49);
  bar(870, 380, 'QUEEN PLOP', boss, '#e8579a', true);
}

function heart(ctx: Ctx, x: number, y: number, r: number, full: boolean) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.45);
  ctx.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  ctx.fillStyle = full ? '#ff4d6d' : 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.strokeStyle = '#1a0e06';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function tag(ctx: Ctx, x: number, y: number, n: string, text: string, tx: number, ty: number) {
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `800 17px Nunito, "Arial Black", sans-serif`;
  const lines = text.split('\n');
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 50;
  const h = 14 + lines.length * 21;
  const bx0 = Math.min(Math.max(tx - w / 2, 8), 1272 - w);
  ctx.fillStyle = 'rgba(255,248,236,0.96)';
  ctx.beginPath();
  ctx.roundRect(bx0, ty - h / 2, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = '#3a2416';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#e0812e';
  ctx.beginPath();
  ctx.arc(bx0 + 18, ty - h / 2 + 18, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `400 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(n, bx0 + 18, ty - h / 2 + 18.5);
  ctx.fillStyle = '#3a2416';
  ctx.font = `800 17px Nunito, "Arial Black", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, bx0 + 36, ty - h / 2 + 24 + i * 21));
}

function bubble2(ctx: Ctx, x: number, y: number, lines: string[]) {
  ctx.font = `400 30px ${FONT}`;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 50;
  const h = lines.length * 38 + 26;
  ctx.fillStyle = '#e8579a';
  ctx.strokeStyle = '#fff3d6';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 20);
  ctx.moveTo(x - 30, y + h / 2);
  ctx.lineTo(x - 50, y + h / 2 + 34);
  ctx.lineTo(x - 2, y + h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff6e4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => {
    ctx.fillStyle = i === lines.length - 1 ? '#ffd23f' : '#fff6e4';
    ctx.fillText(l, x, y - h / 2 + 32 + i * 38);
  });
}

function caption(ctx: Ctx, t: string) {
  ctx.font = `400 26px ${FONT}`;
  const w = ctx.measureText(t).width + 40;
  ctx.fillStyle = 'rgba(20,10,4,0.82)';
  ctx.beginPath();
  ctx.roundRect(640 - w / 2, 664, w, 42, 21);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t, 640, 686);
}

function bubble(ctx: Ctx, x: number, y: number, text: string) {
  ctx.font = `400 34px ${FONT}`;
  const w = ctx.measureText(text).width + 50;
  ctx.fillStyle = '#5c3118';
  ctx.strokeStyle = '#fff3d6';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 34, w, 68, 18);
  ctx.moveTo(x + 10, y + 34);
  ctx.lineTo(x + 26, y + 58);
  ctx.lineTo(x + 40, y + 34);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 2);
}

// ───────────────────────── the screens ──

/** Paint a 1280 × 720 frame: camera zoom z around (cx, cy) in stage coordinates. */
function frame(back: HTMLCanvasElement, z: number, cx: number, cy: number, draw: (ctx: Ctx) => void, overlay?: (ctx: Ctx) => void) {
  const { c, ctx } = mk(1280 * 2, 720 * 2);
  ctx.scale(2, 2);
  ctx.save();
  ctx.translate(640, 360);
  ctx.scale(z, z);
  ctx.translate(-cx, -cy);
  ctx.drawImage(back, -STAGE_OX, -STAGE_OY, ARENA_W, ARENA_H);
  draw(ctx);
  ctx.restore();
  overlay?.(ctx);
  return c;
}

export async function render() {
  await document.fonts.ready;
  const out: Record<string, HTMLCanvasElement> = {};
  const title = arenaBackdrop({ kind: 'title' }, false);
  const loud = arenaBackdrop({ kind: 'big', text: 'OH NO HE DIDN’T!', sub: 'PUFFY OFF THE TOP ROPE', color: '#ffd23f', bg: '#5c3118' }, true);
  const count = arenaBackdrop({ kind: 'big', text: 'K.O.!', sub: 'NEW CHAMPION', color: '#ffd23f', bg: '#2a6a1a' }, true);
  const R = RING;

  // 1. The whole arena, as the fight's camera sees it
  out.wide = frame(title, 0.93, 640, 352, (ctx) => {
    ringBack(ctx);
    spot(ctx, 640, -90, R.frontY, 700, 0.08);
    hero(ctx, 'puffy', 300, R.floorY, 'idle0');
    king(ctx, 790, R.floorY, 'grin');
    ringFront(ctx);
    ringside(ctx);
    vignette(ctx, 0.35);
  });

  // 2. A moment mid-fight (the camera a little closer, following the action)
  out.fight = frame(loud, 1.12, 640, 400, (ctx) => {
    ringBack(ctx);
    spot(ctx, 470, -90, R.frontY, 380, 0.1);
    spot(ctx, 860, -90, R.frontY, 420, 0.09);
    // Puffy flying off the top turnbuckle
    hero(ctx, 'puffy', 520, 372, 'jump', 1.7);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 9]);
    ctx.beginPath();
    ctx.moveTo(R.x0 + 4, R.frontY - R.post - 6);
    ctx.quadraticCurveTo(330, 250, 490, 330);
    ctx.stroke();
    ctx.setLineDash([]);
    // the Queen, caught by the dive: it counts double
    king(ctx, 760, R.floorY, 'hurt', 2.2, true);
    ctx.fillStyle = '#ffd23f';
    ctx.font = `400 26px ${FONT}`;
    ctx.fillText('✶', 720, 268);
    ctx.fillText('✶', 790, 258);
    ctx.save();
    ctx.translate(840, 250);
    ctx.rotate(-0.12);
    ctx.font = `400 40px ${FONT}`;
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#3a1d0c';
    ctx.strokeText('TOP ROPE! ×2', 0, 0);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('TOP ROPE! ×2', 0, 0);
    ctx.restore();
    drawDrip(ctx, 960, 200, 26, 12);
    ringFront(ctx);
    ringside(ctx);
    vignette(ctx, 0.3);
  }, (ctx) => healthBars(ctx, 2, 0.38, 2));

  // 3. The ring as a level: what each part does
  out.plan = frame(title, 0.93, 640, 352, (ctx) => {
    ringBack(ctx);
    hero(ctx, 'puffy', 300, R.floorY, 'idle0');
    king(ctx, 760, R.floorY, 'idle');
    ringFront(ctx, 0.8);
    ringside(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-160, -90, 1600, 900);
    // the fight line
    ctx.strokeStyle = '#8fd14f';
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(R.x0, R.floorY);
    ctx.lineTo(R.x1, R.floorY);
    ctx.stroke();
    ctx.setLineDash([]);
  }, (ctx) => {
    healthBars(ctx, 3, 1, 1);
    tag(ctx, 300, 66, '9', '3 hearts + your nuggies: a hit costs a nuggie,\nonly with none left does it cost a heart', 330, 128);
    tag(ctx, 640, R.floorY, '1', 'The mat = the floor. The whole fight\nis normal 2D along this one line.', 640, 610);
    tag(ctx, R.x1, R.frontY - R.post, '2', 'Climb the ropes to the top turnbuckle;\ndive off and hit her: counts double', 1010, 150);
    tag(ctx, 500, R.frontY - 60, '3', 'Ropes: run into them and\nbounce back fast (springboard)', 360, 250);
    tag(ctx, 800, R.floorY - 150, '8', 'Queen Plop: jumps a lot, aggressive;\nbacks off when you climb the ropes', 830, 245);
    tag(ctx, 960, R.floorY, '4', 'Poo puddle: sinks you\nlike the level', 1060, 420);
    tag(ctx, 1190, 690, '5', 'Fall off = ringside floor;\nclimb the steps back in', 1000, 560);
    tag(ctx, 80, 650, '6', 'Announce table + steel steps:\nringside props to jump on', 240, 470);
    tag(ctx, 640, 180, '7', 'Poo drips off the jumbotron:\nfalling hazards', 640, 90);
  });

  // 4. The entrance: the King on the top turnbuckle, lights down
  out.entrance = frame(title, 1.55, 860, 330, (ctx) => {
    ringBack(ctx);
    ringFront(ctx);
    ctx.fillStyle = 'rgba(5,2,0,0.62)';
    ctx.fillRect(-160, -90, 1600, 900);
    spot(ctx, R.x1 - 4, -90, R.frontY, 300, 0.22);
    spot(ctx, R.x1 - 4, -90, R.frontY, 160, 0.16, '255,210,63');
    king(ctx, R.x1 - 4, R.frontY - R.post - 4, 'yell1', 2, true);
    // pyro sparks
    const r = rng(9);
    for (let i = 0; i < 60; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 1.6;
      const d = 30 + r() * 150;
      ctx.fillStyle = r() < 0.5 ? '#ffd23f' : '#ff9a3c';
      ctx.fillRect(R.x1 - 4 + Math.cos(a) * d, 420 + Math.sin(a) * d * 1.3, 2.2, 2.2);
    }
  }, (ctx) => {
    bubble(ctx, 520, 120, '“Welcome to MY Poo Palace!”');
  });

  // 5. The end of the fight: the Queen on the mat, dazed, and her warning
  out.finish = frame(count, 1.3, 700, 420, (ctx) => {
    ringBack(ctx);
    spot(ctx, 700, -90, R.frontY, 460, 0.16);
    // lying on her back (squashed flat), stars and little birds circling her head
    shadow(ctx, 760, R.floorY, 92);
    ctx.save();
    ctx.translate(760, R.floorY + 4);
    ctx.rotate(-0.08);
    ctx.scale(-2.2, 2.2 * 0.5);
    drawQueen(ctx, -50, -100, 'hurt');
    ctx.restore();
    ctx.save();
    ctx.translate(745, R.floorY - 132);
    ctx.scale(1, 0.32);
    ctx.strokeStyle = 'rgba(255,210,63,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 70, 70, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#ffd23f';
    ctx.font = `400 26px ${FONT}`;
    ctx.textAlign = 'center';
    for (const [dx, dy] of [[-70, 0], [20, 18], [62, -10]]) ctx.fillText('✶', 745 + dx, R.floorY - 124 + dy);
    // Puffy, arms up (the crowd going wild)
    hero(ctx, 'puffy', 520, R.floorY, 'jump', 1.7);
    ringFront(ctx);
    vignette(ctx, 0.35);
  }, (ctx) => {
    healthBars(ctx, 2, 0, 0);
    bubble2(ctx, 800, 170, ['“Nice work…', 'but you’ll never out-wrestle', 'THE KING!”']);
  });

  // 6. …then the camera pulls right out: there's the King, up in the stands, and he RUNS
  const king2 = arenaBackdrop({ kind: 'big', text: 'THE KING?!', sub: 'HE WAS HERE ALL ALONG', color: '#ffd23f', bg: '#3d1478' }, true);
  out.king = frame(king2, 0.8, 640, 330, (ctx) => {
    ringBack(ctx);
    shadow(ctx, 760, R.floorY, 92);
    ctx.save();
    ctx.translate(760, R.floorY + 4);
    ctx.rotate(-0.08);
    ctx.scale(-2.2, 2.2 * 0.5);
    drawQueen(ctx, -50, -100, 'hurt');
    ctx.restore();
    hero(ctx, 'puffy', 520, R.floorY, 'idle0', 1.7, true);
    ringFront(ctx);
    ringside(ctx);
    ctx.fillStyle = 'rgba(5,2,0,0.45)';
    ctx.fillRect(-260, -190, 1800, 1100);
    // the King in an aisle of the lower bowl, caught in a follow-spot, running for the exit
    spot(ctx, 1235, -150, 300, 200, 0.26);
    ctx.fillStyle = '#0b0705';
    ctx.fillRect(1290, 196, 90, 104);
    ctx.fillStyle = '#ffd23f';
    ctx.font = `400 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', 1335, 190);
    ctx.save();
    ctx.translate(1235, 300);
    ctx.scale(-1.15, 1.15);
    drawPlop(ctx, -50, -100, 'run1', ST, 'king');
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 4; i++) ctx.fillRect(1150 - i * 22, 230 + i * 12, 46, 4);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(1240, 250, 80, 80, 0, 0, Math.PI * 2);
    ctx.stroke();
  }, (ctx) => {
    caption(ctx, 'Zoom out… the King was watching. He runs out — end of the fight.');
  });
  return out;
}
