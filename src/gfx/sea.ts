/**
 * Under the sea (World 3 · The Rise of King Bob): the water's looks (it drifts between them like
 * the other levels' skies), the sandy sea floor and coral rock, the reef backgrounds, the plants
 * that sway on the sea bed, the sea creatures that drift about behind you, the pier you dive off,
 * the sky over the water and the shimmering surface.
 *
 * Pure canvas drawing, in the polished hand-drawn style (inked, shaded shapes), like gfx/world.ts.
 */
import { rng, type Ctx } from './draw';
import { STYLES, ellipsePts, petalPts, roundRectPts, type Fill, type Pt, type Style } from './handdrawn';
import { fluffPts } from './baddies';
import { PALETTES, type WorldPalette } from './world';

const ST = STYLES.polished;
const INK = ST.ink;
/** A lighter ink for far-away scenery. */
const inked = (ink: string): Style => ({ ...ST, ink, shape: ST.shape, line: ST.line });
const wrapX = (W: number, fn: (dx: number) => void) => [-W, 0, W].forEach(fn);

// ───────────────────────────── palettes ──

/** The sea floor (terrain, rocks, props): one palette for the whole level. */
PALETTES.sea = {
  id: 'sea',
  name: 'Under the sea',
  blurb: 'Soft golden sand, pink coral rock, swaying sea plants.',
  sky: ['#7fe0ec', '#3fb4d6', '#1e78b0'],
  sun: '#fff6d0',
  far: { base: '#5fb6d6', shade: '#4a9cc0', light: '#8fd2e8' },
  farInk: '#3a86aa',
  cloud: { base: '#bff3f6', shade: '#2a7fae', light: '#ffffff' },
  hill: { base: '#ff9fb2', shade: '#e0708a', light: '#ffd0da' },
  hill2: { base: '#8fd8c8', shade: '#5fb8a8', light: '#c8f4ea' },
  near: { base: '#f0d79c', shade: '#cfae6c', light: '#fff0c8' },
  soilTop: '#f6dea8',
  soilDeep: '#cf9f62',
  strata: '#a87a48',
  grass: { base: '#fbe8bc', shade: '#ddbb80', light: '#fffbe8' },
  rock: { base: '#c98fb4', shade: '#96628c', light: '#f0c8de' },
  canopies: [
    { base: '#6fcf7a', shade: '#3f9a52', light: '#b6f0b0' },
    { base: '#8fd8a0', shade: '#56a86a', light: '#cff6d2' },
    { base: '#b6d86a', shade: '#7fa83a', light: '#e2f6a8' },
  ],
  trunk: { base: '#5aa860', shade: '#3a7a44', light: '#94d48e' },
  bramble: { base: '#7a4a9a', shade: '#55306f', light: '#b28bd0' },
  flowers: [],
  sea: true,
};

/** The looks the water drifts through: a sunny lagoon, the deep blue, a twilight reef. */
const look = (id: string, name: string, blurb: string, o: Partial<WorldPalette>): WorldPalette => ({ ...PALETTES.sea, id, name, blurb, ...o, sea: true });

PALETTES['w-lagoon'] = look('w-lagoon', 'Sunny lagoon', 'Bright turquoise water, full of light.', {});
PALETTES['w-deep'] = look('w-deep', 'Deep blue', 'Cool, deep ocean blue.', {
  sky: ['#62b4f2', '#2f74cc', '#17438e'],
  far: { base: '#4a8ed0', shade: '#3a78ba', light: '#7cb4e6' },
  farInk: '#2c62a0',
  cloud: { base: '#b8e2ff', shade: '#1d4f98', light: '#ffffff' },
  hill: { base: '#f49ac4', shade: '#c86a9c', light: '#ffcce4' },
  hill2: { base: '#7cc6e0', shade: '#4a9cc0', light: '#bfe8f6' },
  near: { base: '#d8c89c', shade: '#a89a70', light: '#f2e6c4' },
});
PALETTES['w-dusk'] = look('w-dusk', 'Twilight reef', 'Purple evening water, glowing coral.', {
  sky: ['#a6a2f0', '#6a6ad0', '#33328a'],
  far: { base: '#7e7ed0', shade: '#6a66bc', light: '#a8a6e6' },
  farInk: '#4e4aa0',
  cloud: { base: '#e2dcff', shade: '#3b3a94', light: '#ffffff' },
  hill: { base: '#ffa88a', shade: '#e07a60', light: '#ffd6c4' },
  hill2: { base: '#9a8ee0', shade: '#7266c0', light: '#cdc6f6' },
  near: { base: '#e6c8a8', shade: '#b89a86', light: '#fbe6d2' },
});


// ───────────────────────────── backgrounds (tileable, width W) ──

/** A soft, wavy beam pattern on the water: light from the surface (drawn into a layer). */
function caustics(ctx: Ctx, W: number, y0: number, h: number, col: string, seed: number) {
  const r = rng(seed);
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const y = y0 + r() * h;
    const w = 14 + r() * 26;
    ctx.lineWidth = 1 + r() * 1.4;
    wrapX(W, (dx) => {
      ctx.beginPath();
      ctx.moveTo(x + dx - w / 2, y);
      ctx.quadraticCurveTo(x + dx, y - 4 - r() * 3, x + dx + w / 2, y + 1);
      ctx.stroke();
    });
  }
  ctx.restore();
}

/** Far layer: hazy rock pillars and arches, kelp forests in silhouette. */
export function drawSeaFar(ctx: Ctx, W: number, H: number, pal: WorldPalette) {
  const far = inked(pal.farInk);
  const r = rng(51);
  caustics(ctx, W, 4, 70, pal.far.light + '66', 52);
  const haze: Fill = { base: pal.far.base, shade: pal.far.shade, light: pal.far.light };
  // tall kelp silhouettes far off
  for (let x = 20; x < W; x += 60 + r() * 70) {
    const h = 80 + r() * 110;
    const ph = r() * 6;
    wrapX(W, (dx) => {
      ctx.strokeStyle = pal.far.shade;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const px = x + dx + Math.sin(t * 5 + ph) * 6 * t;
        const py = H - t * h;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = pal.far.shade;
      for (let k = 2; k < 12; k += 2) {
        const t = k / 12;
        const px = x + dx + Math.sin(t * 5 + ph) * 6 * t;
        const py = H - t * h;
        ctx.beginPath();
        ctx.ellipse(px + (k % 4 ? 5 : -5), py, 6, 2.6, k % 4 ? -0.5 : 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  // rock pillars, one with an arch through it
  for (const [px, pw, ph, arch] of [[120, 46, 150, false], [420, 90, 120, true], [760, 38, 170, false], [930, 60, 96, false]] as const) {
    wrapX(W, (dx) => {
      const x = px + dx;
      const pts: Pt[] = [];
      const n = 26;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const wob = Math.sin(t * 9 + px) * 4;
        pts.push([x - pw / 2 - wob + Math.sin(t * Math.PI) * 4, H + 4 - t * ph]);
      }
      for (let k = n; k >= 0; k--) {
        const t = k / n;
        const wob = Math.sin(t * 7 + px * 2) * 4;
        pts.push([x + pw / 2 + wob - Math.sin(t * Math.PI) * 6, H + 4 - t * ph]);
      }
      far.shape(ctx, pts, haze, 530 + px, { lw: 0.7, light: [x - pw / 3, H - ph] });
      if (arch) {
        ctx.save();
        ctx.fillStyle = pal.sky[1];
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(x, H + 4, pw * 0.3, ph * 0.45, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  }
  // rounded mounds along the bottom
  for (let x = 0; x < W; x += 110 + r() * 60) {
    const w = 80 + r() * 60;
    const h = 30 + r() * 26;
    wrapX(W, (dx) => far.shape(ctx, fluffPts(x + dx, H - 2, w, h, 7, 0.06, r() * 3), haze, 560 + x, { lw: 0.7, plain: true }));
  }
  ctx.fillStyle = pal.far.base;
  ctx.fillRect(0, H - 10, W, 10);
}

/** A branching coral (fingers reaching up), drawn round its base. */
export function drawBranchCoral(ctx: Ctx, st: Style, x: number, y: number, s: number, fill: Fill, seed: number) {
  const r = rng(seed);
  const arms: Pt[][] = [];
  const grow = (px: number, py: number, a: number, len: number, w: number, depth: number) => {
    const ex = px + Math.cos(a) * len;
    const ey = py + Math.sin(a) * len;
    arms.push([[px, py], [ex, ey], [w, 0]]);
    if (depth > 0) {
      grow(ex, ey, a - 0.45 - r() * 0.2, len * 0.72, w * 0.78, depth - 1);
      grow(ex, ey, a + 0.45 + r() * 0.2, len * 0.72, w * 0.78, depth - 1);
    }
  };
  grow(x, y, -Math.PI / 2 + (r() - 0.5) * 0.2, 14 * s, 6.5 * s, 2);
  // ink first (every arm a fat line), then the colour on top: reads as one branching shape
  ctx.lineCap = 'round';
  for (const pass of [0, 1, 2]) {
    for (const [a, b, [w]] of arms) {
      ctx.strokeStyle = pass === 0 ? st.ink : pass === 1 ? fill.base : fill.light;
      ctx.lineWidth = pass === 0 ? w + 2.6 : pass === 1 ? w : w * 0.32;
      ctx.beginPath();
      if (pass === 2) {
        ctx.moveTo(a[0] - w * 0.18, a[1]);
        ctx.lineTo(b[0] - w * 0.18, b[1]);
      } else {
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
  }
  // little polyp dots on the tips
  ctx.fillStyle = fill.light;
  for (const [, b, [w]] of arms) if (w < 4 * s) {
    ctx.beginPath();
    ctx.arc(b[0], b[1], Math.max(0.8, w * 0.28), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A brain coral: a round dome with wiggly grooves. */
export function drawBrainCoral(ctx: Ctx, st: Style, x: number, y: number, rr: number, fill: Fill, seed: number) {
  const dome = ellipsePts(x, y - rr * 0.5, rr, rr * 0.7, 0, 36).map(([px, py]) => [px, Math.min(py, y)] as Pt);
  st.shape(ctx, dome, fill, seed, { lw: 0.8, light: [x - rr * 0.4, y - rr] });
  ctx.save();
  ctx.strokeStyle = fill.shade;
  ctx.lineWidth = Math.max(0.8, rr * 0.07);
  ctx.lineCap = 'round';
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    for (let t = -1; t <= 1.001; t += 0.1) {
      const px = x + t * rr * 0.8 * Math.sqrt(1 - (k / 3) ** 2);
      const py = y - rr * 0.5 + k * rr * 0.17 + Math.sin(t * 9 + k) * rr * 0.05;
      if (t === -1) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** A sea fan: a lacy fan on a short stalk. */
export function drawSeaFan(ctx: Ctx, st: Style, x: number, y: number, s: number, fill: Fill, seed: number) {
  const fan: Pt[] = [];
  for (let k = 0; k <= 20; k++) {
    const a = Math.PI + (k / 20) * Math.PI;
    const rr = 18 * s * (1 + Math.sin(k * 1.7 + seed) * 0.06);
    fan.push([x + Math.cos(a) * rr * 0.9, y - 6 * s + Math.sin(a) * rr]);
  }
  fan.push([x + 3 * s, y - 4 * s], [x - 3 * s, y - 4 * s]);
  st.shape(ctx, fan, fill, seed, { lw: 0.7 });
  ctx.save();
  ctx.strokeStyle = fill.shade;
  ctx.lineWidth = 0.7 * s;
  for (let k = 1; k < 8; k++) {
    const a = Math.PI + (k / 8) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y - 4 * s);
    ctx.lineTo(x + Math.cos(a) * 16 * s * 0.9, y - 6 * s + Math.sin(a) * 16 * s);
    ctx.stroke();
  }
  ctx.restore();
  st.line(ctx, [[x, y], [x, y - 6 * s]], seed + 1, 1.1 * s, fill.shade);
}

/** Mid layer: the reef — coral domes, branch coral and sea fans on rounded rocks. */
export function drawSeaMid(ctx: Ctx, W: number, H: number, pal: WorldPalette) {
  const mid = inked(pal.farInk);
  const r = rng(61);
  const corals: Fill[] = [pal.hill, pal.hill2, { base: '#ffd27a', shade: '#e0a84a', light: '#fff0c0' }];
  for (let x = 0; x < W; x += 130 + r() * 80) {
    const w = 110 + r() * 70;
    const top = H - 50 - r() * 60;
    const seed = 700 + Math.floor(x);
    const placed: [number, number, number][] = [];
    for (let k = 0; k < 5; k++) placed.push([x - w * 0.6 + r() * w * 1.2, r(), r()]);
    wrapX(W, (dx) => {
      const pts: Pt[] = [];
      for (let k = 0; k <= 30; k++) {
        const t = k / 30;
        pts.push([x + dx - w + t * w * 2, H + 10 - Math.pow(Math.sin(t * Math.PI), 0.7) * (H + 10 - top) + Math.sin(t * 13 + x) * 3]);
      }
      mid.shape(ctx, pts, { base: pal.far.shade, shade: pal.farInk, light: pal.far.base }, seed, { lw: 0.8, light: [x + dx - w * 0.3, top] });
      for (const [i, [cx, a, b]] of placed.entries()) {
        const t = (cx - (x - w)) / (w * 2);
        if (t < 0.12 || t > 0.88) continue;
        const cy = H + 10 - Math.pow(Math.sin(t * Math.PI), 0.7) * (H + 10 - top) + 3;
        const fill = corals[Math.floor(a * corals.length)];
        if (b < 0.4) drawBranchCoral(ctx, mid, cx + dx, cy, 0.9 + a * 0.6, fill, seed + i);
        else if (b < 0.7) drawBrainCoral(ctx, mid, cx + dx, cy, 9 + a * 7, fill, seed + i);
        else drawSeaFan(ctx, mid, cx + dx, cy, 0.9 + a * 0.5, fill, seed + i);
      }
    });
  }
  ctx.fillStyle = pal.far.shade;
  ctx.fillRect(0, H - 8, W, 8);
}

/** Near layer: the sand of the sea bed in front of the reef, sea grass and the odd shell. */
export function drawSeaNear(ctx: Ctx, W: number, H: number, pal: WorldPalette) {
  const r = rng(71);
  const sea = inked(pal.farInk);
  const sandBack: Fill = { base: pal.near.shade, shade: pal.near.shade, light: pal.near.base };
  for (const [row, fill, y0, rMin] of [[0, sandBack, 40, 26], [1, pal.near, 62, 30]] as const) {
    for (let x = row * 40; x < W + 60; x += 70 + r() * 40) {
      const rr = rMin + r() * 20;
      const y = y0 + r() * 10;
      wrapX(W, (dx) => sea.shape(ctx, ellipsePts(x + dx, y + rr * 0.5, rr * 2, rr * 0.75, 0, 40), fill, 800 + x + row * 999, { lw: 0.7, plain: true, light: [x + dx - rr, y] }));
    }
    // sea grass clumps on the crests (smaller and hazier on the back row)
    for (let x = 10 + row * 25; x < W; x += 64 + r() * 70) {
      const y = y0 + 8 + r() * 8;
      const kind = Math.floor(r() * GRASS_FILLS.length);
      const bend = (r() - 0.5) * 0.8;
      const sc = row ? 0.6 + r() * 0.2 : 0.45 + r() * 0.15;
      const seed = 840 + Math.floor(x);
      wrapX(W, (dx) => {
        ctx.save();
        if (!row) ctx.globalAlpha = 0.8;
        drawSeaGrass(ctx, x + dx, y, kind, bend, seed, sc);
        ctx.restore();
      });
    }
  }
  const g = ctx.createLinearGradient(0, 70, 0, H);
  g.addColorStop(0, pal.near.base);
  g.addColorStop(1, pal.cloud.shade);
  ctx.fillStyle = g;
  ctx.fillRect(0, 84, W, H - 84);
}

// ───────────────────────────── sea bed props ──

/** Sea grass colours: green, red, gold, teal. */
export const GRASS_FILLS: Fill[] = [
  { base: '#5ec46a', shade: '#2f8a46', light: '#b4f0a4' },
  { base: '#ef6f8e', shade: '#b23e62', light: '#ffc0d0' },
  { base: '#d8b24a', shade: '#9a7420', light: '#fbe6a0' },
  { base: '#4fc0b0', shade: '#24847a', light: '#a8f0e4' },
];

/**
 * A clump of sea grass standing on (x, y): long ribbon blades, each tapering to a point with a pale
 * vein down its middle, leaning by `bend` (−1…1: the current pushing them, most at the tips).
 */
export function drawSeaGrass(ctx: Ctx, x: number, y: number, kind: number, bend: number, seed: number, scale = 1) {
  const r = rng(seed);
  const fill = GRASS_FILLS[kind % GRASS_FILLS.length];
  const n = 5;
  const blades: { lean: number; h: number; w: number; ph: number; dx: number }[] = [];
  for (let k = 0; k < n; k++) blades.push({ lean: (k - (n - 1) / 2) * 3.4 + (r() - 0.5) * 3, h: (26 + r() * 20) * scale, w: (3 + r() * 1.4) * scale, ph: r() * 6, dx: (k - (n - 1) / 2) * 2.2 * scale });
  // (the tallest at the back)
  blades.sort((a, b) => b.h - a.h);
  for (const [i, bl] of blades.entries()) {
    const spine: Pt[] = [];
    for (let j = 0; j <= 12; j++) {
      const t = j / 12;
      // (each blade a little behind or ahead of the others in the sway)
      const sway = bend * (0.85 + 0.3 * Math.sin(bl.ph)) * 14 * scale * Math.pow(t, 1.7);
      spine.push([x + bl.dx + bl.lean * t + Math.sin(t * 5 + bl.ph) * 2 * t + sway, y - t * bl.h * (1 - Math.abs(bend) * 0.06 * t)]);
    }
    const left: Pt[] = [];
    const right: Pt[] = [];
    spine.forEach(([px, py], j) => {
      const t = j / 12;
      const [qx, qy] = spine[Math.min(12, j + 1)];
      const [ax, ay] = spine[Math.max(0, j - 1)];
      const dx = qx - ax;
      const dy = qy - ay;
      const len = Math.hypot(dx, dy) || 1;
      const ww = bl.w * (1 - t) ** 0.8 * (0.9 + 0.2 * Math.sin(t * 9 + bl.ph)) + 0.2;
      left.push([px + (dy / len) * ww, py - (dx / len) * ww]);
      right.push([px - (dy / len) * ww, py + (dx / len) * ww]);
    });
    const f: Fill = i % 2 ? fill : { base: fill.shade, shade: fill.shade, light: fill.base };
    ST.shape(ctx, [...left, ...right.reverse()], f, seed + i, { lw: 0.55, plain: true });
    // the pale vein
    ctx.strokeStyle = fill.light + 'aa';
    ctx.lineWidth = 0.7 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    spine.slice(1, 10).forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  }
}

/** Sea grass on the sea bed: four colours, each in SWAY_N frames of its sway (`g<kind>_<frame>`), drawn in a 44 × 56 cell standing at (22, 54). */
export const SWAY_N = 8;
export const GRASS_W = 44;
export const GRASS_H = 56;
export const GRASS_FRAMES = Array.from({ length: GRASS_FILLS.length * SWAY_N }, (_, i) => `g${Math.floor(i / SWAY_N)}_${i % SWAY_N}`);
/** How far a sway frame leans (−1…1). */
export const swayBend = (i: number) => Math.sin((i / SWAY_N) * Math.PI * 2);
export function drawGrassFrame(ctx: Ctx, f: string) {
  const [k, i] = f.slice(1).split('_').map(Number);
  drawSeaGrass(ctx, 22, 54, k, swayBend(i) * 0.6, 870 + k * 11);
}
/** Kelp for the sway sheet (`k<frame>`): KELP_H tall, in a KELP_W-wide cell, standing at its bottom middle. */
export const KELP_H = 220;
export const KELP_W = 84;
export const KELP_FRAMES = Array.from({ length: SWAY_N }, (_, i) => `k${i}`);
export function drawKelpFrame(ctx: Ctx, f: string) {
  drawKelp(ctx, KELP_W / 2, KELP_H + 20, KELP_H, 333, swayBend(+f.slice(1)));
}

/** Kelp: one tall golden-green strand with leaves (drawn standing on (x, y), `h` tall), bent by `bend` (−1…1). */
export function drawKelp(ctx: Ctx, x: number, y: number, h: number, seed: number, bend = 0) {
  const r = rng(seed);
  const stem: Fill = { base: '#7fae3c', shade: '#4f7e22', light: '#b8dc7a' };
  const leaf: Fill = { base: '#9cc84a', shade: '#62922a', light: '#d4ee98' };
  const ph = r() * 6;
  const at = (t: number): Pt => [x + Math.sin(t * 4.2 + ph) * 7 * t + bend * 16 * Math.pow(t, 1.8), y - t * h];
  // the stem
  const n = Math.ceil(h / 6);
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [cx, cy] = at(t);
    const w = 2.6 - t * 1.2;
    left.push([cx - w, cy]);
    right.push([cx + w, cy]);
  }
  // leaves either side, each with a little air float at its root
  const leaves: [Pt, number][] = [];
  for (let t = 0.14; t < 0.98; t += 0.1 + r() * 0.05) leaves.push([at(t), leaves.length % 2 ? -1 : 1]);
  for (const [[lx, ly], s] of leaves) ST.shape(ctx, petalPts(lx, ly, 15 + r() * 6, 7, (s > 0 ? -0.55 : Math.PI + 0.55) + bend * 0.35), leaf, seed + Math.floor(ly), { lw: 0.6 });
  ST.shape(ctx, [...left, ...right.reverse()], stem, seed, { lw: 0.7 });
  for (const [[lx, ly], s] of leaves) ST.shape(ctx, ellipsePts(lx + s * 1.5, ly, 2.4, 2.4, 0, 12), { base: '#e0c45a', shade: '#a88a2a', light: '#fff2b0' }, seed + 3, { lw: 0.5, plain: true });
  // a frond on top
  const [tx, ty] = at(1);
  ST.shape(ctx, petalPts(tx, ty + 2, 14, 7, -Math.PI / 2 - 0.3 + bend * 0.5), leaf, seed + 9, { lw: 0.6 });
}

/** A starfish (radius rr) lying on the sand. */
export function drawStarfish(ctx: Ctx, x: number, y: number, rr: number, fill: Fill, seed: number) {
  const pts: Pt[] = [];
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2 - Math.PI / 2;
    const arm = Math.pow(Math.abs(Math.cos((a + Math.PI / 2) * 2.5)), 0.7);
    const rad = rr * (0.42 + 0.58 * arm);
    pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.62]);
  }
  ST.shape(ctx, pts, fill, seed, { lw: 0.6 });
  ctx.fillStyle = fill.light;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * rr * 0.45, y + Math.sin(a) * rr * 0.28, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A scallop shell. */
export function drawShell(ctx: Ctx, x: number, y: number, s: number, fill: Fill, seed: number) {
  const pts: Pt[] = [];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI + (k / 16) * Math.PI;
    const rr = 7 * s * (1 + 0.08 * Math.abs(Math.sin(k * Math.PI * 0.5)));
    pts.push([x + Math.cos(a) * rr, y - 2 * s + Math.sin(a) * rr * 0.9]);
  }
  pts.push([x + 2.5 * s, y], [x - 2.5 * s, y]);
  ST.shape(ctx, pts, fill, seed, { lw: 0.6 });
  ctx.strokeStyle = fill.shade;
  ctx.lineWidth = 0.6;
  for (let k = 1; k < 6; k++) {
    const a = Math.PI + (k / 6) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y - 1);
    ctx.lineTo(x + Math.cos(a) * 6 * s, y - 2 * s + Math.sin(a) * 6 * s * 0.9);
    ctx.stroke();
  }
}

/** Props scattered on the sea bed (LevelView): the frame names and how to draw each into a 40 × 48 cell, standing at (20, 46). */
export const SEA_PROPS = ['coral0', 'coral1', 'coral2', 'brain', 'fan', 'star0', 'star1', 'shell'] as const;
export const SEA_PROP_W = 40;
export const SEA_PROP_H = 48;
const CORALS: Fill[] = [
  { base: '#ff8fa8', shade: '#d0607e', light: '#ffd0dc' },
  { base: '#ffa860', shade: '#d47a34', light: '#ffd8b0' },
  { base: '#b48cf0', shade: '#8462c4', light: '#e0cfff' },
];
export function drawSeaProp(ctx: Ctx, f: (typeof SEA_PROPS)[number]) {
  const x = 20;
  const y = 46;
  switch (f) {
    case 'coral0':
    case 'coral1':
    case 'coral2':
      return drawBranchCoral(ctx, ST, x, y, 1.15, CORALS[+f[5]], 920 + +f[5]);
    case 'brain':
      return drawBrainCoral(ctx, ST, x, y, 13, { base: '#ffd27a', shade: '#d8a440', light: '#fff0c0' }, 930);
    case 'fan':
      return drawSeaFan(ctx, ST, x, y, 1.1, CORALS[2], 940);
    case 'star0':
      return drawStarfish(ctx, x, y - 4, 9, { base: '#ff8a5c', shade: '#d05a34', light: '#ffc8a8' }, 950);
    case 'star1':
      return drawStarfish(ctx, x, y - 4, 8, { base: '#ffcf5c', shade: '#d8a030', light: '#fff0b8' }, 951);
    case 'shell':
      return drawShell(ctx, x, y - 1, 1.1, { base: '#ffe4ec', shade: '#e0aabc', light: '#ffffff' }, 960);
  }
}

// ───────────────────────────── sea creatures (background, drawn white-ish or in colour) ──

/** A jellyfish (frames j0–j3: the bell squeezes and relaxes), 40 × 64, its bell's middle at (20, 18). */
export const JELLY_W = 40;
export const JELLY_H = 64;
export const JELLY_FRAMES = ['j0', 'j1', 'j2', 'j3'] as const;
export function drawJelly(ctx: Ctx, f: (typeof JELLY_FRAMES)[number]) {
  const k = [0, 0.5, 1, 0.5][+f[1]];
  const cx = 20;
  const cy = 18;
  const rx = 14 - k * 3;
  const ry = 11 + k * 2;
  ctx.save();
  // tentacles (wavy, trailing)
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const x0 = cx - rx * 0.7 + (i / 4) * rx * 1.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = i % 2 ? 1.2 : 2;
    ctx.beginPath();
    ctx.moveTo(x0, cy + 4);
    for (let t = 0; t <= 1; t += 0.1) ctx.lineTo(x0 + Math.sin(t * 7 + i + k * 2) * 3, cy + 4 + t * (34 + (i % 2) * 8 - k * 6));
    ctx.stroke();
  }
  // the bell
  const bell: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i / 24) * Math.PI;
    bell.push([cx + Math.cos(a) * rx, cy + 4 + Math.sin(a) * ry]);
  }
  for (let i = 0; i <= 8; i++) bell.push([cx + rx - (i / 8) * rx * 2, cy + 4 + Math.sin(i * Math.PI) * 2 + (i % 2) * 2.5]);
  ctx.globalAlpha = 0.92;
  ST.shape(ctx, bell, { base: '#ffffff', shade: '#e6e6f0', light: '#ffffff' }, 970, { lw: 0.7, light: [cx - rx * 0.5, cy - ry] });
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.35, cy - ry * 0.35, rx * 0.22, ry * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A little fish for the schools far off (drawn white, tinted per school), 24 × 14, frames s0/s1. */
export const SCHOOL_FRAMES = ['s0', 's1'] as const;
export function drawSchoolFish(ctx: Ctx, f: (typeof SCHOOL_FRAMES)[number]) {
  const flick = f === 's0' ? 1 : -1;
  const body = ellipsePts(13, 7, 8, 4.3, 0, 24);
  const tail: Pt[] = [
    [6, 7],
    [1, 2.5 + flick * 1.2],
    [2.6, 7],
    [1, 11.5 + flick * 1.2],
  ];
  ST.shape(ctx, tail, { base: '#ffffff', shade: '#dfe6ee', light: '#ffffff' }, 980, { lw: 0.6, plain: true });
  ST.shape(ctx, body, { base: '#ffffff', shade: '#dfe6ee', light: '#ffffff' }, 981, { lw: 0.6, plain: true });
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(17, 6, 1.1, 0, Math.PI * 2);
  ctx.fill();
}

/** A sea turtle swimming right, 96 × 60, frames t0/t1 (flippers up / down). */
export const TURTLE_W = 96;
export const TURTLE_H = 60;
export const TURTLE_FRAMES = ['t0', 't1'] as const;
export function drawTurtle(ctx: Ctx, f: (typeof TURTLE_FRAMES)[number]) {
  const up = f === 't0' ? 1 : -1;
  const skin: Fill = { base: '#a8d88a', shade: '#6ea65a', light: '#d8f4c0' };
  const shell: Fill = { base: '#8a6a3a', shade: '#5e4422', light: '#c09a62' };
  // back flippers, front flipper behind
  ST.shape(ctx, petalPts(30, 36, 16, 8, Math.PI - 0.5 * up), skin, 990, { lw: 0.7 });
  ST.shape(ctx, petalPts(58, 30, 26, 10, -0.5 * up - 0.4), { base: skin.shade, shade: skin.shade, light: skin.base }, 991, { lw: 0.7 });
  // head
  ST.shape(ctx, ellipsePts(80, 28, 11, 8, 0.1, 28), skin, 992, { lw: 0.8 });
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(84, 25.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(85, 30, 3, 0.2, 1.2);
  ctx.stroke();
  // shell (dome) and its plates
  const dome: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i / 24) * Math.PI;
    dome.push([46 + Math.cos(a) * 26, 34 + Math.sin(a) * 17]);
  }
  dome.push([72, 36], [46, 39], [20, 36]);
  ST.shape(ctx, dome, shell, 993, { lw: 0.9, light: [36, 20] });
  ctx.strokeStyle = shell.shade;
  ctx.lineWidth = 1.2;
  for (const [x, y, r] of [[46, 25, 7], [33, 30, 6], [59, 30, 6]] as const) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
      else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
    }
    ctx.closePath();
    ctx.stroke();
  }
  // belly rim
  ST.shape(ctx, roundRectPts(22, 34, 50, 6, 3), { base: '#f0e2a8', shade: '#c8b478', light: '#fff6d8' }, 994, { lw: 0.7, plain: true });
  // front flipper in front
  ST.shape(ctx, petalPts(62, 37, 24, 9, 0.5 * up + 0.35), skin, 995, { lw: 0.7 });
}

/** A little red crab on the sand, 44 × 30, frames c0/c1 (legs and claws). Its feet at the bottom. */
export const CRAB_W = 44;
export const CRAB_H = 30;
export const CRAB_FRAMES = ['c0', 'c1'] as const;
export function drawCrab(ctx: Ctx, f: (typeof CRAB_FRAMES)[number]) {
  const k = f === 'c0' ? 1 : -1;
  const red: Fill = { base: '#ff6a4a', shade: '#cc3e26', light: '#ffb4a0' };
  ctx.lineCap = 'round';
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const x0 = 22 + s * (5 + i * 3);
      ST.line(ctx, [[x0, 20], [x0 + s * 6, 22 - (i % 2 ? k : -k)], [x0 + s * 8, 29]], 1000 + i, 1.4, red.shade);
    }
  // claws up
  for (const s of [-1, 1]) {
    ST.line(ctx, [[22 + s * 8, 16], [22 + s * 14, 10 - k * s]], 1010, 1.6, red.shade);
    ST.shape(ctx, ellipsePts(22 + s * 15, 8 - k * s, 4.4, 3.4, s * 0.4, 18), red, 1011 + s, { lw: 0.6 });
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(22 + s * 15, 8 - k * s);
    ctx.lineTo(22 + s * 18, 6 - k * s);
    ctx.stroke();
  }
  ST.shape(ctx, ellipsePts(22, 19, 11, 7, 0, 30), red, 1020, { lw: 0.8, light: [18, 13] });
  // eyes on stalks
  for (const s of [-1, 1]) {
    ST.line(ctx, [[22 + s * 3, 13], [22 + s * 4, 8]], 1030, 1, red.shade);
    ST.shape(ctx, ellipsePts(22 + s * 4, 7, 2.4, 2.4, 0, 12), { base: '#ffffff', shade: '#dddddd', light: '#ffffff' }, 1031, { lw: 0.5, plain: true });
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(22 + s * 4.3, 7.2, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A small round bubble (white ring + glint), 16 × 16. */
export function drawSeaBubble(ctx: Ctx) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(8, 8, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(5.6, 5.4, 1.8, 1.2, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** A soft beam of light from the surface (drawn white, shown with an additive blend), 64 × 256. */
export function drawLightRay(ctx: Ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(42, 0);
  ctx.lineTo(64, 256);
  ctx.lineTo(0, 256);
  ctx.closePath();
  ctx.fill();
}

// ───────────────────────────── above the water ──

/** The sky over the sea (tileable, W wide, H tall): a sunny blue, a few clouds, a far island; the water line is the bottom edge. */
export function drawSeaSky(ctx: Ctx, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#5fc0f6');
  g.addColorStop(0.75, '#bfe8ff');
  g.addColorStop(1, '#eaf8ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const far = inked('#7aa6c8');
  // a far-off island with a palm tree
  wrapX(W, (dx) => {
    const x = 640 + dx;
    far.shape(ctx, fluffPts(x, H - 2, 80, 22, 6, 0.05), { base: '#9ccf9a', shade: '#78b07a', light: '#c6eac0' }, 1100, { lw: 0.7, plain: true });
    far.line(ctx, [[x + 10, H - 18], [x + 16, H - 40], [x + 14, H - 58]], 1101, 1.6, '#a07a52');
    for (const a of [-2.6, -1.9, -1.2, -0.5]) far.shape(ctx, petalPts(x + 14, H - 58, 22, 7, a), { base: '#6fbf6a', shade: '#4a9a50', light: '#a8e0a0' }, 1102, { lw: 0.6, plain: true });
  });
  // clouds
  const r = rng(1110);
  for (let i = 0; i < 5; i++) {
    const cx = (i / 5) * W + r() * 80;
    const cy = 22 + r() * (H * 0.4);
    const s = 0.7 + r() * 0.5;
    wrapX(W, (dx) => far.shape(ctx, fluffPts(cx + dx, cy, 40 * s, 14 * s, 6, 0.12, r() * 3), { base: '#ffffff', shade: '#e2eef8', light: '#ffffff' }, 1120 + i, { lw: 0.7 }));
  }
  // the far sea along the bottom
  ctx.fillStyle = '#6ccbe6';
  ctx.fillRect(0, H - 6, W, 6);
}

/** The water's surface seen side-on (tileable, W wide, 26 tall, the waterline at y 8): glinting little waves on top, a pale band below. */
export const SURFACE_H = 26;
export const SURFACE_LINE = 8;
export function drawSurface(ctx: Ctx, W: number) {
  const y = SURFACE_LINE;
  const wave = (x: number) => y + Math.sin((x / W) * Math.PI * 2 * 16) * 2.2 + Math.sin((x / W) * Math.PI * 2 * 7) * 1.2;
  // the water just under the surface: paler, fading down
  const g = ctx.createLinearGradient(0, y, 0, SURFACE_H);
  g.addColorStop(0, 'rgba(225,252,255,0.85)');
  g.addColorStop(1, 'rgba(225,252,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, SURFACE_H);
  for (let x = 0; x <= W; x += 4) ctx.lineTo(x, wave(x));
  ctx.lineTo(W, SURFACE_H);
  ctx.closePath();
  ctx.fill();
  // the waterline
  ctx.strokeStyle = '#2e6f96';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let x = 0; x <= W; x += 4) (x ? ctx.lineTo(x, wave(x)) : ctx.moveTo(x, wave(x)));
  ctx.stroke();
  // glints
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  const r = rng(1130);
  for (let x = 6; x < W; x += 18 + r() * 26) {
    const w = 5 + r() * 9;
    ctx.beginPath();
    ctx.moveTo(x, wave(x) + 3.2);
    ctx.lineTo(x + w, wave(x + w) + 3.2);
    ctx.stroke();
  }
}

/** The wooden pier you dive off: `w` wide; its deck's top at y = 6, posts reaching down `h`. */
export function drawPier(ctx: Ctx, w: number, h: number) {
  const wood: Fill = { base: '#c0905a', shade: '#8a5e34', light: '#e6bf8a' };
  const post: Fill = { base: '#9a6c40', shade: '#6a4422', light: '#c8966a' };
  // posts (going down into the water), with cross braces
  const posts: number[] = [];
  for (let x = 14; x < w - 6; x += 46) posts.push(x);
  posts.push(w - 12);
  for (let i = 0; i < posts.length - 1; i++) {
    ST.line(ctx, [[posts[i] + 4, 22], [posts[i + 1] - 4, h * 0.6]], 1200 + i, 1.6, post.shade);
    ST.line(ctx, [[posts[i + 1] - 4, 22], [posts[i] + 4, h * 0.6]], 1210 + i, 1.6, post.shade);
  }
  for (const [i, x] of posts.entries()) ST.shape(ctx, roundRectPts(x - 5, 10, 10, h - 10, 3), post, 1220 + i, { lw: 0.9, light: [x - 4, 14] });
  // the deck: planks side on
  ST.shape(ctx, roundRectPts(0, 6, w, 12, 3), wood, 1230, { lw: 1, light: [10, 6] });
  ctx.strokeStyle = wood.shade;
  ctx.lineWidth = 1;
  for (let x = 22; x < w - 4; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, 16);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  for (let x = 11; x < w - 4; x += 22) {
    ctx.beginPath();
    ctx.arc(x, 12, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // a rope coil and a life ring on the end post
  const ex = posts[posts.length - 1];
  ST.shape(ctx, ellipsePts(ex - 26, 2, 8, 4, 0, 24), { base: '#e8d6a8', shade: '#bca878', light: '#fff4d8' }, 1240, { lw: 0.7 });
  ctx.save();
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(ex, 32, 9, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = i % 2 ? '#ffffff' : '#ff5a4a';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(ex, 32, 9, (i / 4) * Math.PI * 2, ((i + 1) / 4) * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** An octopus drifting along (frames o0–o3: its mantle squeezes, its arms trail and curl), 64 × 76, head at the top. */
export const OCTO_W = 64;
export const OCTO_H = 76;
export const OCTO_FRAMES = ['o0', 'o1', 'o2', 'o3'] as const;
export function drawOctopus(ctx: Ctx, f: (typeof OCTO_FRAMES)[number]) {
  const i = +f[1];
  const ph = (i / 4) * Math.PI * 2;
  const squeeze = 0.5 + 0.5 * Math.cos(ph);
  const skin: Fill = { base: '#e88aa8', shade: '#b8587a', light: '#ffc8da' };
  const cx = 32;
  const hy = 22;
  // the arms: eight wavy tapering ribbons, curling at the tips
  for (let k = 0; k < 8; k++) {
    const s = (k - 3.5) / 3.5;
    const x0 = cx + s * 12 * (0.8 + 0.2 * squeeze);
    const y0 = hy + 12;
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let j = 0; j <= 14; j++) {
      const t = j / 14;
      const wave = Math.sin(t * 5 + ph + k) * 4 * t;
      const spread = s * (6 + 16 * t) * (1.15 - squeeze * 0.4);
      const curl = t > 0.8 ? Math.sin((t - 0.8) * 12 + k) * 4 * s : 0;
      const x = x0 + spread + wave + curl;
      const y = y0 + t * (34 + squeeze * 6) - (t > 0.85 ? (t - 0.85) * 18 : 0);
      const w = 3.4 * (1 - t * 0.85);
      left.push([x - w, y]);
      right.push([x + w, y]);
    }
    ST.shape(ctx, [...left, ...right.reverse()], k % 2 ? skin : { base: skin.shade, shade: skin.shade, light: skin.base }, 1300 + k, { lw: 0.6, plain: true });
  }
  // the mantle (head): a bulb, squeezing as it swims
  const head = ellipsePts(cx, hy, 15 * (1.05 - squeeze * 0.12), 18 * (0.9 + squeeze * 0.15), 0, 36);
  ST.shape(ctx, head, skin, 1310, { lw: 1, light: [cx - 6, hy - 10] });
  ctx.fillStyle = skin.light + 'aa';
  for (const [sx, sy, r] of [[-5, -8, 2], [4, -11, 1.4], [6, -3, 1.6]] as const) {
    ctx.beginPath();
    ctx.arc(cx + sx, hy + sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // eyes
  for (const s of [-1, 1]) {
    ST.shape(ctx, ellipsePts(cx + s * 6, hy + 7, 3.4, 3.8, 0, 16), { base: '#ffffff', shade: '#e6e6e6', light: '#ffffff' }, 1320, { lw: 0.6, plain: true });
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(cx + s * 6 + 0.5, hy + 7.6, 1.3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
