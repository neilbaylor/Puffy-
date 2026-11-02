/**
 * Concept art for World 1 · Part 2: climbing up the mountain.
 * Three possible looks (same layout, different mood) and a map of the climb.
 * Mountain goats are drawn from the goat sketch.
 */
import { drawBigPuff, drawPuffball } from '../gfx/baddies';
import { canvas, rng, type Ctx } from '../gfx/draw';
import { STYLES, ellipsePts, roundRectPts, type Fill, type Pt } from '../gfx/handdrawn';
import { drawMusclesStyled } from '../gfx/muscles';
import { drawNuggie, drawRootBeer } from '../gfx/collectibles';
import { drawPuffyStyled } from '../gfx/puffy';
import { drawScruffyStyled } from '../gfx/scruffy';
import { drawGoat } from '../gfx/goat';
import { MOUNTAIN_LOOKS, type MountainLook } from '../gfx/mountain';
import { drawBloom, drawCloudLayer, drawTerrainPiece, roundPoly, traceCells, type TerrainKind, type WorldPalette } from '../gfx/world';

const ST = STYLES.polished;
const T = 32;
const FONT = '"Lilita One", "Arial Black", sans-serif';

export { MOUNTAIN_LOOKS };

const fill = (b: string, sh: string, l: string): Fill => ({ base: b, shade: sh, light: l });

function at(ctx: Ctx, x: number, y: number, s: number, fn: () => void, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -s : s, s);
  fn();
  ctx.restore();
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

/** A range of peaks along the bottom of a W × H strip, snow on the tops. */
function range(ctx: Ctx, W: number, H: number, y0: number, peakH: [number, number], col: string, snow: string, seed: number, ink: string) {
  const r = rng(seed);
  const pts: Pt[] = [[-20, H]];
  const tops: Pt[] = [];
  for (let x = -20; x < W + 80; ) {
    const w = 90 + r() * 110;
    const h = peakH[0] + r() * (peakH[1] - peakH[0]);
    pts.push([x + w * 0.5, y0 - h]);
    tops.push([x + w * 0.5, y0 - h]);
    pts.push([x + w, y0 - r() * 30]);
    x += w;
  }
  pts.push([W + 80, H]);
  const darker = (c: string, k: number) => {
    const n = parseInt(c.slice(1), 16);
    const f = (v: number) => Math.round(v * k);
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };
  ST.shape(ctx, pts, fill(col, darker(col, 0.86), darker(col, 1.08)), seed, { lw: 0.8 });
  // snow caps
  ctx.save();
  ctx.strokeStyle = ink;
  for (const [tx, ty] of tops) {
    const cap: Pt[] = [
      [tx, ty],
      [tx + 22, ty + 26],
      [tx + 12, ty + 22],
      [tx + 4, ty + 30],
      [tx - 6, ty + 21],
      [tx - 14, ty + 28],
      [tx - 22, ty + 26],
    ];
    ST.shape(ctx, cap, fill(snow, '#dfe7f4', '#ffffff'), seed + tx, { lw: 0.6, plain: true });
  }
  ctx.restore();
}

/** A snowy puff-pine: stacked rounded tiers. */
function pine(ctx: Ctx, x: number, groundY: number, h: number, pal: WorldPalette, snow: string, seed: number) {
  const trunk: Fill = pal.trunk;
  ST.shape(ctx, roundRectPts(x - 3, groundY - h * 0.25, 6, h * 0.25, 2), trunk, seed, { lw: 0.8 });
  const c = pal.canopies[seed % pal.canopies.length];
  for (let i = 0; i < 3; i++) {
    const w = h * (0.42 - i * 0.1);
    const y = groundY - h * 0.2 - i * h * 0.24;
    const tier: Pt[] = [
      [x - w, y],
      [x - w * 0.55, y - h * 0.16],
      [x, y - h * 0.34],
      [x + w * 0.55, y - h * 0.16],
      [x + w, y],
    ];
    ST.shape(ctx, roundPoly(tier, 5), c, seed + i, { lw: 0.85 });
    ST.shape(ctx, [[x - w * 0.5, y - h * 0.15], [x, y - h * 0.32], [x + w * 0.5, y - h * 0.15], [x + w * 0.2, y - h * 0.12], [x - w * 0.2, y - h * 0.13]], fill(snow, '#dfe7f4', '#ffffff'), seed + 10 + i, { lw: 0.5, plain: true });
  }
}

/** A sagging rope bridge from (x0, y0) to (x1, y1). */
function ropeBridge(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, seed: number) {
  const sag = 18;
  const pt = (t: number): Pt => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * sag];
  const planks = 9;
  for (let i = 0; i < planks; i++) {
    const t = (i + 0.5) / planks;
    const [px, py] = pt(t);
    ST.shape(ctx, roundRectPts(px - 7, py - 2, 14, 6, 1.5), fill('#b07a4a', '#7e5230', '#dcaa7a'), seed + i, { lw: 0.7 });
  }
  for (const dy of [0, -18]) {
    const rope: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const [px, py] = pt(i / 20);
      rope.push([px, py + dy + (dy ? Math.sin(Math.PI * (i / 20)) * -4 : 0)]);
    }
    ST.line(ctx, rope, seed + 30 + dy, 1.2, '#7a5230');
  }
  for (let i = 0; i <= planks; i += 3) {
    const [px, py] = pt(i / planks);
    ST.line(ctx, [[px, py], [px, py - 18]], seed + 50 + i, 0.8, '#7a5230');
  }
  for (const [px, py] of [[x0, y0], [x1, y1]] as Pt[]) ST.shape(ctx, roundRectPts(px - 3, py - 26, 6, 30, 2), fill('#a06a3e', '#704426', '#cc9868'), seed + px, { lw: 0.8 });
}

/** A wooden ladder up a cliff face. */
function ladder(ctx: Ctx, x: number, yTop: number, yBot: number, seed: number) {
  const wood = fill('#b07a4a', '#7e5230', '#dcaa7a');
  for (const dx of [-9, 9]) ST.shape(ctx, roundRectPts(x + dx - 2, yTop - 6, 4, yBot - yTop + 6, 1.5), wood, seed + dx, { lw: 0.7 });
  for (let y = yTop + 6; y < yBot - 2; y += 12) ST.shape(ctx, roundRectPts(x - 9, y, 18, 3.5, 1), wood, seed + y, { lw: 0.55, plain: true });
}

/** A fizzy soda waterfall pouring off a ledge. */
function waterfall(ctx: Ctx, x: number, yTop: number, yBot: number, w: number) {
  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, 'rgba(170,230,255,0.95)');
  g.addColorStop(1, 'rgba(120,200,240,0.75)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, yTop);
  ctx.bezierCurveTo(x - w / 2 - 4, yTop + 40, x - w / 2 + 3, yBot - 40, x - w / 2 - 2, yBot);
  ctx.lineTo(x + w / 2 + 2, yBot);
  ctx.bezierCurveTo(x + w / 2 - 3, yBot - 40, x + w / 2 + 4, yTop + 40, x + w / 2, yTop);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.4;
  const r = rng(9);
  for (let i = 0; i < 7; i++) {
    const sx = x - w / 2 + 3 + r() * (w - 6);
    ctx.beginPath();
    ctx.moveTo(sx, yTop + r() * 20);
    ctx.lineTo(sx + (r() - 0.5) * 3, yTop + 30 + r() * (yBot - yTop - 40));
    ctx.stroke();
  }
  // bubbles + foam
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    ctx.arc(x - w / 2 + r() * w, yTop + r() * (yBot - yTop), 0.8 + r() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(x - w / 2 - 6 + (i / 5) * (w + 12), yBot, 5 + r() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** One gameplay-sized view of the climb (640 × 360 world units). */
export function drawMountainScene(ctx: Ctx, look: MountainLook) {
  const W = 640;
  const H = 360;
  const pal = look.pal;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  pal.sky.forEach((c, i) => g.addColorStop(i / (pal.sky.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // sun / ringed planet
  if (look.id === 'pastel') {
    ST.shape(ctx, ellipsePts(520, 70, 30, 30, 0, 40), fill('#ffc9b4', '#f2a090', '#ffe6dc'), 7, { lw: 0.7 });
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(520, 72, 52, 11, -0.25, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const sun = ctx.createRadialGradient(500, 80, 6, 500, 80, 70);
    sun.addColorStop(0, look.id === 'sunset' ? 'rgba(255,240,190,1)' : 'rgba(255,255,255,0.95)');
    sun.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(400, 0, 200, 180);
  }
  // clouds and three mountain ranges
  const cl = canvas(1024 * 1.5, 200 * 1.5);
  cl.ctx.scale(1.5, 1.5);
  drawCloudLayer(cl.ctx, 1024, 200, pal);
  ctx.drawImage(cl.c, -120, -10, 1024, 200);
  range(ctx, W, H, 200, [90, 150], look.ranges[0], look.snow, 11, pal.farInk);
  range(ctx, W, H, 250, [70, 130], look.ranges[1], look.snow, 23, pal.farInk);
  range(ctx, W, H, 300, [40, 90], look.ranges[2], look.snow, 37, pal.farInk);

  // the climb: switchback ledges stepping up to the right (cliff + ledge = one piece)
  const floor = 13 * T + 60;
  terrain(ctx, rect(-1, 5, 9, 13), 'ground', pal, floor, 11); // base
  terrain(ctx, [...rect(6, 9, 7, 13)], 'ground', pal, floor, 23); // ledge 1
  terrain(ctx, [...rect(13, 16, 5, 13), ...rect(12, 12, 8, 13)], 'ground', pal, floor, 31); // cliff with ledge 2
  terrain(ctx, rect(17, 20, 2, 13), 'ground', pal, floor, 41); // tall cliff to the summit side
  terrain(ctx, rect(10, 11, 4, 4), 'rock', pal, floor, 51); // little rock perch
  // rope bridge over the gorge, ladder up the tall cliff
  ropeBridge(ctx, 9.9 * T, 7 * T, 13 * T, 5 * T, 61);
  ladder(ctx, 16.6 * T, 2 * T, 5 * T, 71);
  if (look.extras === 'waterfall') waterfall(ctx, 17.4 * T, 2.1 * T, 13 * T, 22);
  // trees
  pine(ctx, 0.9 * T, 9 * T + 2, 62, pal, look.snow, 3);
  pine(ctx, 3.8 * T, 9 * T + 2, 48, pal, look.snow, 4);
  pine(ctx, 15.4 * T, 5 * T + 2, 54, pal, look.snow, 5);
  pine(ctx, 19.4 * T, 2 * T + 2, 46, pal, look.snow, 6);
  // checkpoint flower on the ledge, nuggies and a root beer along the path
  at(ctx, 7.9 * T, 7 * T - 102 * 0.6 + 64 * 0.6, 0.6, () => drawBloom(ctx, 0, 102, true));
  drawNuggie(ctx, 12.3 * T, 2.4 * T, 8);
  drawNuggie(ctx, 14 * T, 3.4 * T, 8);
  drawRootBeer(ctx, 18.6 * T, 1.6 * T, 22);
  // heroes on the way up, bad guys, and where the goats go
  at(ctx, 3 * T, 9 * T, 1.1, () => drawMusclesStyled(ctx, -27, -54, 'shoot', ST));
  at(ctx, 11.1 * T, 6.6 * T, 1.0, () => drawScruffyStyled(ctx, -26, -54, 'walk0', ST));
  at(ctx, 15.1 * T, 3.4 * T, 1.15, () => drawPuffyStyled(ctx, -27, -54, 'jump', ST));
  at(ctx, 8.6 * T, 7 * T, 0.95, () => drawPuffball(ctx, -24, -46, 'w1', ST));
  at(ctx, 18.3 * T, 2 * T, 0.8, () => drawBigPuff(ctx, -38, -86, "w0", ST));
  // mountain goats: one charging along the ledge, one pawing on the rock perch
  at(ctx, 13.95 * T - 32 * 1.05, 5 * T - 62 * 1.05, 1.05, () => drawGoat(ctx, 0, 0, 'c0', ST));
  at(ctx, 10.5 * T + 32 * 0.85, 4 * T - 62 * 0.85, 0.85, () => drawGoat(ctx, 0, 0, 'w1', ST), true);
  // weather
  const r = rng(99);
  if (look.extras === 'snowfall') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 90; i++) {
      ctx.beginPath();
      ctx.arc(r() * W, r() * H, 0.8 + r() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look.extras === 'dust') {
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,236,190,${0.25 + r() * 0.4})`;
      ctx.beginPath();
      ctx.arc(r() * W, r() * H * 0.8, 0.8 + r() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The whole climb from the base to the summit, with the sections labelled (300 × 900). */
export function drawClimbMap(ctx: Ctx, look: MountainLook) {
  const W = 300;
  const H = 900;
  const pal = look.pal;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a1a52');
  g.addColorStop(0.35, pal.sky[0]);
  g.addColorStop(1, pal.sky[pal.sky.length - 1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // stars up high
  const r = rng(5);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 40; i++) ctx.fillRect(r() * W, r() * 220, 1.4, 1.4);
  // the mountain
  const m: Pt[] = [[-10, H], [-10, 760], [40, 700], [70, 610], [60, 540], [110, 470], [100, 390], [150, 300], [135, 230], [175, 150], [205, 95], [230, 150], [255, 260], [290, 380], [310, 520], [310, H]];
  ST.shape(ctx, roundPoly(m, 18), fill(pal.soilTop, pal.soilDeep, '#ffffff'), 3, { lw: 1.2 });
  ST.shape(ctx, [[205, 95], [228, 140], [214, 132], [205, 150], [194, 128], [180, 142]], fill(look.snow, '#dfe7f4', '#ffffff'), 4, { lw: 0.8, plain: true });
  // the path (zig-zag up the mountain)
  const path: Pt[] = [[20, 860], [150, 800], [60, 720], [200, 650], [90, 570], [210, 500], [120, 420], [220, 340], [150, 260], [205, 170], [205, 110]];
  ctx.setLineDash([7, 6]);
  ST.line(ctx, path, 9, 2.2, '#3a2418');
  ctx.setLineDash([]);
  const label = (x: number, y: number, n: string, text: string, align: CanvasTextAlign = 'left') => {
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3a2418';
    ctx.font = `400 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n, x, y + 0.5);
    ctx.font = `400 12.5px ${FONT}`;
    ctx.textAlign = align;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#fff8ec';
    const tx = align === 'left' ? x + 14 : x - 14;
    ctx.strokeText(text, tx, y);
    ctx.fillText(text, tx, y);
  };
  label(20, 860, '1', 'Base camp meadow');
  label(150, 800, '2', 'Switchback ledges', 'left');
  label(60, 720, '3', 'Rope bridge gorge');
  label(200, 650, 'C', 'Checkpoint + Giant', 'right');
  label(90, 570, '4', 'Goat cliffs');
  label(210, 500, '5', 'Ladders & soda falls', 'right');
  label(120, 420, 'C', 'Checkpoint + Giant');
  label(220, 340, '6', 'Icy ledges + wind', 'right');
  label(150, 260, '7', 'Falling-rock chute');
  label(205, 170, 'C', 'Last checkpoint', 'right');
  label(205, 110, '★', 'Summit gate');
  ctx.font = `400 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff8ec';
  ctx.fillText('Part 2 · the climb', W / 2, 30);
}
