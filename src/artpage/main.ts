/**
 * Art & assets page: everything in the game, drawn by the same code the game
 * uses, in the polished hand-drawn style. Also paints three colour options
 * ("looks") for World 1 · Puff Ball Planet.
 */
import { BIGPUFF_W, GIANT_W, PUFFBALL_W, drawBigPuff, drawGiant, drawPuffball, type BigPuffFrame, type GiantFrame, type PuffballFrame } from '../gfx/baddies';
import { drawBazooka, drawMuzzleFlash, drawRocket } from '../gfx/bazooka';
import { canvas, type Ctx, type Pose } from '../gfx/draw';
import { STYLES, type Pt } from '../gfx/handdrawn';
import { drawMusclesStyled } from '../gfx/muscles';
import { drawNuggie, drawRootBeer } from '../gfx/collectibles';
import { KING_FRAMES, drawArena, drawArenaFront, drawCrowd, drawBackboard, drawBall, drawKing, drawRimBack, drawRimFront, HOOP, STAGE_OX, STAGE_OY } from '../gfx/hoops';
import { drawPuffyStyled } from '../gfx/puffy';
import { drawScruffyStyled } from '../gfx/scruffy';
import {
  PALETTES,
  drawAura,
  drawBloom,
  drawBoulder,
  drawBramble,
  drawCloudLayer,
  drawCloudPlatform,
  drawFarLayer,
  drawFlower,
  drawGate,
  drawGateSwirl,
  drawHillsLayer,
  drawNearLayer,
  drawPuffTree,
  drawTerrainPiece,
  roundPoly,
  traceCells,
  type TerrainKind,
  type WorldPalette,
} from '../gfx/world';

const ST = STYLES.polished;
const T = 32;
type HeroFn = (ctx: Ctx, ox: number, oy: number, pose: Pose, st: typeof ST) => void;
const HEROES: [string, HeroFn][] = [
  ['Puffy', drawPuffyStyled],
  ['Scruffy', drawScruffyStyled],
  ['Big Muscles', drawMusclesStyled],
];

function at(ctx: Ctx, x: number, y: number, s: number, fn: () => void, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  fn();
  ctx.restore();
}

/** A background strip drawn once, then tiled horizontally from an offset. */
function layer(ctx: Ctx, W: number, h: number, y: number, viewW: number, offset: number, draw: (c: Ctx) => void) {
  const res = 1.5;
  const { c, ctx: lc } = canvas(Math.ceil(1024 * res), Math.ceil(h * res));
  lc.scale(res, res);
  draw(lc);
  for (let x = -((offset % W) + W) % W; x < viewW; x += W) ctx.drawImage(c, x, y, W, h);
}

function terrain(ctx: Ctx, cells: [number, number][], kind: TerrainKind, pal: WorldPalette, floorY: number, seed: number) {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const loop = traceCells(set)[0];
  const outline = roundPoly(loop.map(([x, y]) => [x * T, y * T] as Pt), kind === 'ground' ? 12 : 7);
  drawTerrainPiece(ctx, { kind, outline, pal, seed, floorY });
}

const rect = (x0: number, x1: number, y0: number, y1: number) => {
  const out: [number, number][] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y]);
  return out;
};

/** One slice of Puff Ball Planet in a given palette. 600 × 300 world units. */
function worldScene(ctx: Ctx, pal: WorldPalette) {
  const W = 600;
  const H = 300;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  pal.sky.forEach((c, i) => g.addColorStop(i / (pal.sky.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  layer(ctx, 1024, 220, 40, W, 120, (c) => drawFarLayer(c, 1024, 220, pal));
  layer(ctx, 1024, 200, -6, W, 300, (c) => drawCloudLayer(c, 1024, 200, pal));
  layer(ctx, 1024, 230, 110, W, 40, (c) => drawHillsLayer(c, 1024, 230, pal));
  layer(ctx, 1024, 150, 196, W, 0, (c) => drawNearLayer(c, 1024, 150, pal));
  ctx.fillStyle = pal.cloud.shade;
  ctx.fillRect(0, 290, W, 10);

  // terrain: ground with a little hill, a pit, a floating island, a rock ledge
  const floor = 10; // rows 0..9 visible (300px), ground from row 7
  terrain(ctx, [...rect(-1, 8, 7, 12), ...rect(4, 7, 6, 6)], 'ground', pal, floor * T + 60, 11);
  terrain(ctx, [...rect(12, 19, 7, 12)], 'ground', pal, floor * T + 60, 23);
  terrain(ctx, [...rect(9, 11, 3, 4), [10, 5]], 'ground', pal, floor * T + 60, 31);
  terrain(ctx, rect(16, 17, 5, 6), 'rock', pal, floor * T + 60, 41);
  // boulder wall + brambles
  for (const [x, y] of [[13, 5], [13, 6], [14, 5], [14, 6]]) drawBoulder(ctx, x * T - 2, y * T - 2, pal, x * 7 + y);
  drawBramble(ctx, 2 * T - 2, 7 * T, pal, 3);
  drawBramble(ctx, 3 * T - 2, 6 * T + 0 + 32, pal, 9);
  // clouds to hop on
  drawCloudPlatform(ctx, 8.6 * T, 2.6 * T + 70, 2.2 * T, pal, 5);
  // trees & flowers
  drawPuffTree(ctx, 1 * T, 7 * T + 3, 58, pal, 101);
  drawPuffTree(ctx, 18.6 * T, 7 * T + 3, 66, pal, 117);
  [[0.4, 0], [6.3, 1], [12.4, 2], [15.4, 3]].forEach(([x, i]) => drawFlower(ctx, x * T, 7 * T + 2, pal.flowers[i], 40 + i));
  // aura floating over the gap
  drawAura(ctx, 9.4 * T, 1.6 * T, 9);
  drawAura(ctx, 10.6 * T, 1.2 * T, 9);
  drawAura(ctx, 11.8 * T, 1.6 * T, 9);
  // checkpoint bloom
  at(ctx, 15.4 * T, 5 * T - 102 + 64, 0.62, () => drawBloom(ctx, 0, 102, true));
  // heroes and bad guys
  at(ctx, 5.5 * T, 6 * T, 1.15, () => drawPuffyStyled(ctx, -27, -54, 'walk0', ST));
  at(ctx, 10.4 * T, 3 * T, 1.15, () => drawScruffyStyled(ctx, -26, -54, 'jump', ST));
  at(ctx, 2.6 * T, 7 * T - 22, 1, () => drawMusclesStyled(ctx, -27, -54, 'shoot', ST));
  at(ctx, 7.2 * T, 7 * T, 1, () => drawPuffball(ctx, -24, -46, 'w1', ST));
  at(ctx, 18 * T, 7 * T, 1, () => drawBigPuff(ctx, -38, -86, 'w0', ST));
  at(ctx, 16.6 * T, 5 * T, 1, () => drawPuffball(ctx, -24, -46, 'w0', ST));
}

function heroSheet(c: HTMLCanvasElement) {
  const poses: Pose[] = ['idle0', 'walk0', 'walk2', 'jump', 'fall', 'shoot', 'hurt'];
  const S = 2.2;
  c.width = poses.length * 60 * S;
  c.height = HEROES.length * 60 * S;
  const ctx = c.getContext('2d')!;
  HEROES.forEach(([, fn], r) => poses.forEach((p, i) => at(ctx, i * 60 * S + 2 * S, r * 60 * S + 2 * S, S, () => fn(ctx, 0, 0, p, ST))));
}

function baddieSheet(c: HTMLCanvasElement) {
  const S = 1.4;
  c.width = Math.round((PUFFBALL_W * 3 + BIGPUFF_W * 4 + GIANT_W * 4) * S * 0.86 + 60);
  c.height = Math.round(236 * S);
  const ctx = c.getContext('2d')!;
  let x = 10;
  const foot = 232 * S;
  for (const f of ['w0', 'w1', 'flat'] as PuffballFrame[]) {
    at(ctx, x, foot - 46 * S, S, () => drawPuffball(ctx, 0, 0, f, ST));
    x += PUFFBALL_W * S * 0.95;
  }
  x += 10;
  for (const f of ['w0', 'w1', 'm0', 'm1'] as BigPuffFrame[]) {
    at(ctx, x, foot - 86 * S, S, () => drawBigPuff(ctx, 0, 0, f, ST));
    x += BIGPUFF_W * S * 0.85;
  }
  x += 10;
  for (const f of ['w0', 'crouch', 'air', 'slam'] as GiantFrame[]) {
    const lift = f === 'air' ? 20 : f === 'slam' ? 8 : 0;
    at(ctx, x, foot - 200 * S - lift * S, S, () => drawGiant(ctx, 0, 0, f, ST));
    x += GIANT_W * S * 0.78;
  }
}

function propSheet(c: HTMLCanvasElement, pal: WorldPalette) {
  c.width = 1340;
  c.height = 300;
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  // big bazooka close-up + rocket + flash
  at(ctx, 6, 18, 2.4, () => drawBazooka(ctx, ST, { x0: 6, x1: 40, y: 10, h: 7, loaded: true, seed: 3 }));
  at(ctx, 34, 70, 2, () => drawRocket(ctx, ST, 15, 8));
  at(ctx, 100, 66, 1.6, () => drawMuzzleFlash(ctx, ST, 12, 12, 12));
  // nuggie + root beer
  drawNuggie(ctx, 168, 40, 14);
  drawRootBeer(ctx, 168, 132, 46);
  // checkpoint off/on
  at(ctx, 196, 18, 1.1, () => drawBloom(ctx, 32, 102, false));
  at(ctx, 246, 18, 1.1, () => drawBloom(ctx, 32, 102, true));
  // goal gate + swirl
  at(ctx, 318, 10, 1, () => {
    drawGateSwirl(ctx, 65, 64, 40);
    drawGate(ctx, 65, 126, pal);
  });
  // boulder, bramble, cloud platform
  drawBoulder(ctx, 458, 30, pal, 7);
  drawBoulder(ctx, 492, 30, pal, 19);
  drawBoulder(ctx, 475, -2, pal, 11);
  drawBramble(ctx, 458, 112, pal, 3);
  drawBramble(ctx, 490, 112, pal, 11);
  drawCloudPlatform(ctx, 540, 26, 70, pal, 4);
  // puff trees
  drawPuffTree(ctx, 572, 146, 62, pal, 101);
  drawPuffTree(ctx, 628, 146, 52, pal, 113);
}

async function paint() {
  try {
    await Promise.race([document.fonts.load('21px "Lilita One"'), new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    /* fallback font */
  }
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-look]').forEach((c) => {
    const pal = PALETTES[c.dataset.look!];
    c.width = 1200;
    c.height = 600;
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    worldScene(ctx, pal);
  });
  const hs = document.querySelector<HTMLCanvasElement>('canvas[data-sheet=heroes]');
  if (hs) heroSheet(hs);
  const bs = document.querySelector<HTMLCanvasElement>('canvas[data-sheet=baddies]');
  if (bs) baddieSheet(bs);
  const ks = document.querySelector<HTMLCanvasElement>('canvas[data-sheet=king]');
  if (ks) {
    ks.width = KING_FRAMES.length * 130 * 1.4;
    ks.height = 150 * 1.4;
    const ctx = ks.getContext('2d')!;
    KING_FRAMES.forEach((f, i) => at(ctx, i * 130 * 1.4, 0, 1.4, () => drawKing(ctx, 0, 0, f)));
  }
  const ar = document.querySelector<HTMLCanvasElement>('canvas[data-sheet=arena]');
  if (ar) {
    ar.width = 1280;
    ar.height = 720;
    const ctx = ar.getContext('2d')!;
    ctx.translate(-STAGE_OX, -STAGE_OY);
    drawArena(ctx);
    drawCrowd(ctx);
    drawArenaFront(ctx);
    ctx.translate(STAGE_OX, STAGE_OY);
    ctx.save();
    ctx.translate(HOOP.rimX, HOOP.rimY);
    ctx.scale(1, 1);
    ctx.translate(-HOOP.rimX, -HOOP.rimY);
    drawBackboard(ctx);
    drawRimBack(ctx);
    drawBall(ctx, HOOP.rimX - 6, HOOP.rimY - 14, 13, 0.5);
    drawRimFront(ctx, HOOP.rimX, HOOP.rimY, 0);
    ctx.restore();
    at(ctx, 360, 520, 2.6, () => drawPuffyStyled(ctx, 0, 0, 'shoot', ST));
    at(ctx, 1010 - 66 * 1.45, 650 - 146 * 1.45, 1.45, () => drawKing(ctx, 0, 0, 'idle0'));
  }
  const ps = document.querySelector<HTMLCanvasElement>('canvas[data-sheet=props]');
  if (ps) propSheet(ps, PALETTES.meadow);
}
void paint();
