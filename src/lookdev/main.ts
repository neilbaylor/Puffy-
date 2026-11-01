/**
 * Look development: Puffy + a slice of Sunny Hills rendered in each
 * hand-drawn style, so a direction can be picked before all art is redone.
 */
import { rng, type Ctx, type Pose } from '../gfx/draw';
import {
  STYLES,
  ellipsePts,
  paperTexture,
  roundRectPts,
  type Fill,
  type Pt,
  type Style,
  type StyleId,
} from '../gfx/handdrawn';
import { drawPuffyStyled } from '../gfx/puffy';
import { drawScruffyStyled } from '../gfx/scruffy';
import { drawBigPuff, drawMegaPuff, drawPuffball, type BigPuffFrame, type PuffballFrame } from '../gfx/baddies';

function puffball(ctx: Ctx, st: Style, x: number, feetY: number, scale: number, f: PuffballFrame = 'w0') {
  ctx.save();
  ctx.translate(x, feetY);
  ctx.scale(scale, scale);
  drawPuffball(ctx, -24, -46, f, st);
  ctx.restore();
}

function bigpuff(ctx: Ctx, st: Style, x: number, feetY: number, scale: number, f: BigPuffFrame = 'w0') {
  ctx.save();
  ctx.translate(x, feetY);
  ctx.scale(scale, scale);
  drawBigPuff(ctx, -38, -86, f, st);
  ctx.restore();
}

const U = 600; // scene units wide
const V = 260; // scene units tall
const K = 2; // canvas pixels per unit
const GROUND = 200;

const PAL: Record<StyleId, { sky: [string, string]; hill: Fill; hill2: Fill; grass: Fill; dirtA: Fill; dirtB: Fill }> = {
  storybook: {
    sky: ['#bfe3f2', '#f1ecd9'],
    hill: { base: '#9fcf7a', shade: '#78ad57', light: '#c8e8a6' },
    hill2: { base: '#c2dca0', shade: '#a2c482', light: '#dcefc5' },
    grass: { base: '#78c24f', shade: '#4f9a35', light: '#b4e38a' },
    dirtA: { base: '#d99a5c', shade: '#b57940', light: '#efc08e' },
    dirtB: { base: '#c4824a', shade: '#a26535', light: '#dfa774' },
  },
  polished: {
    sky: ['#4ab8ff', '#c9efff'],
    hill: { base: '#4cc35a', shade: '#2f9a3f', light: '#8ee28a' },
    hill2: { base: '#9fd9a8', shade: '#78c08a', light: '#c9eecf' },
    grass: { base: '#5fd23c', shade: '#2f9a2a', light: '#b2f47a' },
    dirtA: { base: '#d6904c', shade: '#ad6b30', light: '#f2b77c' },
    dirtB: { base: '#b9733a', shade: '#925425', light: '#d99a62' },
  },
  watercolor: {
    sky: ['#9fd0ea', '#f4efe2'],
    hill: { base: '#8cc79a', shade: '#5e9f72', light: '#c3e5c8' },
    hill2: { base: '#b9d8c8', shade: '#8fb9a5', light: '#dcefe6' },
    grass: { base: '#7cbf6a', shade: '#4f924a', light: '#b9e0a5' },
    dirtA: { base: '#d9a77a', shade: '#b0805a', light: '#f0d0b0' },
    dirtB: { base: '#c99468', shade: '#a2704c', light: '#e2b892' },
  },
  sticker: {
    sky: ['#2fb0ff', '#a8e6ff'],
    hill: { base: '#35c25a', shade: '#1f9443', light: '#7fe08f' },
    hill2: { base: '#7fd8a0', shade: '#55bb7c', light: '#b5ecc8' },
    grass: { base: '#56d43a', shade: '#2a9d25', light: '#a6f27a' },
    dirtA: { base: '#e28d3e', shade: '#b8651f', light: '#ffb876' },
    dirtB: { base: '#c46f2a', shade: '#9a5118', light: '#e6984e' },
  },
};

const WHITE: Fill = { base: '#ffffff', shade: '#dfeef8', light: '#ffffff' };
const GOLD: Fill = { base: '#ffc533', shade: '#d18c18', light: '#ffe58a' };
const SUN: Fill = { base: '#ffe27a', shade: '#ffc94a', light: '#fff6c8' };

function puffy(ctx: Ctx, st: Style, x: number, feetY: number, scale: number, pose: Pose, flip = false) {
  ctx.save();
  ctx.translate(x, feetY);
  ctx.scale(flip ? -scale : scale, scale);
  drawPuffyStyled(ctx, -27, -54, pose, st);
  ctx.restore();
}

function scruffy(ctx: Ctx, st: Style, x: number, feetY: number, scale: number, pose: Pose, flip = false) {
  ctx.save();
  ctx.translate(x, feetY);
  ctx.scale(flip ? -scale : scale, scale);
  drawScruffyStyled(ctx, -26, -54, pose, st);
  ctx.restore();
}

function cloud(ctx: Ctx, st: Style, x: number, y: number, s: number, seed: number) {
  const lumps: [number, number, number][] = [
    [-26, 4, 15],
    [-8, -6, 20],
    [14, -2, 17],
    [30, 6, 12],
  ];
  // one merged silhouette: sample the union of circles
  const pts: Pt[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    let best = 0;
    for (const [lx, ly, r] of lumps) {
      // furthest hit of the ray from cloud centre through each lump
      const dx = lx;
      const dy = ly;
      const b = dx * Math.cos(a) + dy * Math.sin(a);
      const c = dx * dx + dy * dy - r * r;
      const disc = b * b - c;
      if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
    }
    best = Math.max(best, 6);
    pts.push([x + Math.cos(a) * best * s, y + Math.min(Math.sin(a) * best, 12) * s]);
  }
  st.shape(ctx, pts, WHITE, seed, { lw: 0.8 });
}

function qblock(ctx: Ctx, st: Style, x: number, y: number) {
  st.shape(ctx, roundRectPts(x, y, 30, 30, 4), GOLD, 120);
  ctx.font = '400 21px "Lilita One", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD.shade;
  ctx.fillText('?', x + 16, y + 17);
  ctx.fillStyle = '#fff8dc';
  ctx.fillText('?', x + 15, y + 15.5);
}

function coin(ctx: Ctx, st: Style, x: number, y: number, seed: number) {
  st.shape(ctx, ellipsePts(x, y, 6.5, 8.5, 0, 24), GOLD, seed, { lw: 0.75 });
  st.shape(ctx, ellipsePts(x, y, 2.4, 4.6, 0, 16), { base: GOLD.shade, shade: GOLD.shade, light: GOLD.shade }, seed + 1, { noLine: true, plain: true });
}

function flower(ctx: Ctx, st: Style, x: number, y: number, col: string, seed: number) {
  st.line(ctx, [[x, y], [x + 1, y - 7], [x, y - 14]], seed, 1.2, '#3f8a34');
  const f: Fill = { base: col, shade: col, light: '#ffffff' };
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    st.shape(ctx, ellipsePts(x + Math.cos(a) * 4, y - 16 + Math.sin(a) * 4, 3.2, 3.2, 0, 14), f, seed + k, { lw: 0.6, plain: true });
  }
  st.shape(ctx, ellipsePts(x, y - 16, 2.4, 2.4, 0, 12), { base: '#fff3b0', shade: '#ffe08a', light: '#fff' }, seed + 9, { lw: 0.5, plain: true });
}

function groundRun(ctx: Ctx, st: Style, pal: (typeof PAL)[StyleId], x0: number, x1: number, gy: number, h = V) {
  ctx.save();
  st.shape(ctx, roundRectPts(x0, gy, x1 - x0, h - gy + 20, 6), pal.dirtA, 240 + x0, { plain: true });
  ctx.beginPath();
  ctx.rect(x0 + 2, gy, x1 - x0 - 4, h);
  ctx.clip();
  const r = rng(x0 + 7);
  for (let y = gy + 10; y < h; y += 16)
    for (let x = x0; x < x1; x += 16)
      if ((Math.floor((x - x0) / 16) + Math.floor((y - gy) / 16)) % 2)
        st.shape(ctx, roundRectPts(x + r() * 0.8, y + r() * 0.8, 16, 16, 1.5), pal.dirtB, 300 + x + y, { noLine: true });
  ctx.restore();
  const cap: Pt[] = [[x0 - 2, gy - 3], [x1 + 2, gy - 3]];
  for (let x = x1 + 2; x >= x0 - 2; x -= 4) cap.push([x, gy + 9 + Math.sin((x - x0) * 0.4) * 2.5]);
  st.shape(ctx, cap, pal.grass, 260 + x0, { lw: 0.9 });
}

/** The "WOW" moment from the drawing: Puffy meets a giant, puffballs at its feet. */
function giantScene(ctx: Ctx, id: StyleId, w: number, h: number) {
  const st = STYLES[id];
  const pal = PAL[id];
  const gy = h - 34;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, pal.sky[0]);
  g.addColorStop(1, pal.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (st.paper) paperTexture(ctx, w, h, 13);
  for (const [x, rw, rh, sd] of [[90, 140, 70, 1], [520, 170, 110, 2]] as const)
    st.shape(ctx, ellipsePts(x, gy + 10, rw, rh, 0, 60), pal.hill2, 610 + sd, { lw: 0.8 });
  cloud(ctx, st, 120, 40, 0.8, 620);
  groundRun(ctx, st, pal, -10, w + 10, gy, h);
  // giant
  ctx.save();
  ctx.translate(430, gy);
  ctx.scale(0.95, 0.95);
  drawMegaPuff(ctx, -88, -200, 'w0', st);
  ctx.restore();
  // puffball crowd round his feet
  [[330, 0.8, 'w0'], [362, 0.85, 'w1'], [520, 0.8, 'w0'], [552, 0.75, 'w1']].forEach(([x, sc, f]) => puffball(ctx, st, x as number, gy - 1, sc as number, f as PuffballFrame));
  // Puffy: "WOW"
  puffy(ctx, st, 120, gy - 1, 1.35, 'jump');
  scruffy(ctx, st, 62, gy - 30, 1.35, 'jump');
  st.shape(ctx, ellipsePts(152, 96, 34, 20, 0, 40), { base: '#ffffff', shade: '#eeeeee', light: '#ffffff' }, 630, { lw: 0.9, plain: true });
  st.shape(ctx, [[134, 110], [148, 113], [126, 134]], { base: '#ffffff', shade: '#ffffff', light: '#ffffff' }, 631, { lw: 0.9, plain: true });
  ctx.font = '400 20px "Lilita One", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = st.ink;
  ctx.fillText('WOW', 152, 97);
  if (st.paper) {
    ctx.globalAlpha = 0.5;
    paperTexture(ctx, w, h, 14);
    ctx.globalAlpha = 1;
  }
}

function scene(ctx: Ctx, id: StyleId) {
  const st = STYLES[id];
  const pal = PAL[id];
  const g = ctx.createLinearGradient(0, 0, 0, V);
  g.addColorStop(0, pal.sky[0]);
  g.addColorStop(1, pal.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, U, V);
  if (st.paper) paperTexture(ctx, U, V, 3);

  st.shape(ctx, ellipsePts(500, 52, 24, 24, 0, 40), SUN, 200, { lw: 0.8 });
  cloud(ctx, st, 110, 52, 1, 201);
  cloud(ctx, st, 330, 34, 0.75, 202);

  // far + near hills
  for (const [x, w, h, s] of [[60, 120, 70, 1], [250, 150, 95, 2], [470, 140, 60, 3]] as const)
    st.shape(ctx, ellipsePts(x, GROUND + 10, w, h, 0, 60), pal.hill2, 210 + s, { lw: 0.8 });
  for (const [x, w, h, s] of [[170, 90, 62, 1], [560, 100, 80, 2]] as const)
    st.shape(ctx, ellipsePts(x, GROUND + 14, w, h, 0, 60), pal.hill, 220 + s, { lw: 0.9 });

  // bush
  for (const [dx, r] of [[-18, 13], [0, 17], [18, 13]] as const)
    st.shape(ctx, ellipsePts(68 + dx, GROUND - r * 0.6, r, r, 0, 30), pal.hill, 230 + dx, { lw: 0.85 });

  // ground: checker dirt + grass cap, with a pit
  for (const [x0, x1] of [[-10, 300], [372, 610]] as const) groundRun(ctx, st, pal, x0, x1, GROUND);

  // flowers
  [[30, '#ff6fa3'], [118, '#ffd23f'], [262, '#ff6fa3'], [420, '#ffd23f'], [585, '#ff6fa3']].forEach(([x, c], i) =>
    flower(ctx, st, x as number, GROUND - 2, c as string, 400 + i * 10),
  );

  qblock(ctx, st, 180, 92);
  for (let i = 0; i < 4; i++) coin(ctx, st, 312 + i * 18, 128 - Math.sin((i / 3) * Math.PI) * 26, 500 + i * 3);
  puffball(ctx, st, 120, GROUND - 1, 1.15, 'w1');
  puffball(ctx, st, 425, GROUND - 1, 1.15, 'w0');
  bigpuff(ctx, st, 520, GROUND - 1, 1.15, 'w0');

  puffy(ctx, st, 230, GROUND - 1, 1.5, 'walk0');
  scruffy(ctx, st, 330, GROUND - 46, 1.5, 'jump');

  if (st.paper) {
    // light paper grain over everything, so the whole scene sits on one sheet
    ctx.globalAlpha = 0.5;
    paperTexture(ctx, U, V, 8);
    ctx.globalAlpha = 1;
  }
}

function strip(ctx: Ctx, id: StyleId, w: number, h: number, items: ((x: number, feet: number, s: number) => void)[]) {
  const st = STYLES[id];
  ctx.fillStyle = st.paper ?? '#ffffff';
  ctx.fillRect(0, 0, w, h);
  if (st.paper) paperTexture(ctx, w, h, 11);
  const cell = w / items.length;
  const s = Math.min(cell / 60, h / 62);
  items.forEach((f, i) => f(cell * i + cell / 2, h - 6 * s, s));
}

function heroStrip(ctx: Ctx, id: StyleId, w: number, h: number) {
  const st = STYLES[id];
  const poses: Pose[] = ['idle0', 'walk0', 'jump', 'hurt'];
  strip(ctx, id, w, h, [
    ...poses.map((p) => (x: number, f: number, s: number) => puffy(ctx, st, x, f, s, p)),
    ...poses.map((p) => (x: number, f: number, s: number) => scruffy(ctx, st, x, f, s * 1.1, p)),
  ]);
}

function baddieStrip(ctx: Ctx, id: StyleId, w: number, h: number) {
  const st = STYLES[id];
  strip(ctx, id, w, h, [
    // one shared scale, so sizes compare honestly (Big Puff is ~2x a Puffball)
    (x, f) => puffball(ctx, st, x, f, (h - 14) / 88, 'w0'),
    (x, f) => puffball(ctx, st, x, f, (h - 14) / 88, 'w1'),
    (x, f) => puffball(ctx, st, x, f, (h - 14) / 88, 'flat'),
    (x, f) => bigpuff(ctx, st, x, f, (h - 14) / 88, 'w0'),
    (x, f) => bigpuff(ctx, st, x, f, (h - 14) / 88, 'm1'),
  ]);
}

async function paint() {
  try {
    await Promise.race([document.fonts.load('21px "Lilita One"'), new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    /* fallback font */
  }
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-scene]').forEach((c) => {
    const id = c.dataset.scene as StyleId;
    c.width = U * K;
    c.height = V * K;
    const ctx = c.getContext('2d')!;
    ctx.scale(K, K);
    scene(ctx, id);
  });
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-giant]').forEach((c) => {
    const id = c.dataset.giant as StyleId;
    c.width = 1200;
    c.height = 520;
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    giantScene(ctx, id, 600, 260);
  });
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-heroes]').forEach((c) => {
    c.width = 1200;
    c.height = 200;
    heroStrip(c.getContext('2d')!, c.dataset.heroes as StyleId, c.width, c.height);
  });
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-baddies]').forEach((c) => {
    c.width = 1200;
    c.height = 200;
    baddieStrip(c.getContext('2d')!, c.dataset.baddies as StyleId, c.width, c.height);
  });
}
void paint();
