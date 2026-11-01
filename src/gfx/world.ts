/**
 * World 1 — "Puff Ball Planet" — drawn in the polished hand-drawn style.
 * Sunny rolling hills + a cloud kingdom: organic grassy ground (no tiles,
 * no checkerboard), floating islands with hanging roots, fluffy cloud
 * platforms, puff-ball trees, thorny brambles, blastable puff boulders,
 * a blooming checkpoint flower, a fluffy goal gate and floating aura wisps.
 *
 * Everything here is pure canvas drawing (no Phaser) so the same art is used
 * in the game and on the art/asset review page.
 */
import { rng, type Ctx } from './draw';
import { STYLES, ellipsePts, paddlePts, petalPts, roundRectPts, trace, type Fill, type Pt, type Style } from './handdrawn';
import { fluffPts } from './baddies';

const ST = STYLES.polished;
const INK = ST.ink;

// ───────────────────────────── palettes ──

export interface WorldPalette {
  id: string;
  name: string;
  blurb: string;
  sky: string[];
  sun: string;
  far: Fill;
  farInk: string;
  cloud: Fill;
  hill: Fill;
  hill2: Fill;
  near: Fill;
  soilTop: string;
  soilDeep: string;
  strata: string;
  grass: Fill;
  rock: Fill;
  canopies: Fill[];
  trunk: Fill;
  bramble: Fill;
  flowers: string[];
}

export const PALETTES: Record<string, WorldPalette> = {
  meadow: {
    id: 'meadow',
    name: 'Meadow morning',
    blurb: 'Fresh blue sky, bright green hills, golden and pink puff trees.',
    sky: ['#6ec3ff', '#bfe6ff', '#fff3dc'],
    sun: '#fff1b8',
    far: { base: '#c3d3f5', shade: '#a6b8e6', light: '#e6eeff' },
    farInk: '#8a9bcf',
    cloud: { base: '#ffffff', shade: '#d9e6fb', light: '#ffffff' },
    hill: { base: '#79d066', shade: '#4fae4c', light: '#b6ef92' },
    hill2: { base: '#a9e3a0', shade: '#86cc86', light: '#d4f5c8' },
    near: { base: '#4fae5a', shade: '#33874a', light: '#86d97c' },
    soilTop: '#d39a62',
    soilDeep: '#8d5a36',
    strata: '#7a4a2c',
    grass: { base: '#6fd14b', shade: '#3e9c35', light: '#c2f58c' },
    rock: { base: '#b3aecf', shade: '#857fa8', light: '#e4e0f5' },
    canopies: [
      { base: '#ffd36e', shade: '#e0a43a', light: '#fff0b8' },
      { base: '#ffb0c8', shade: '#e27c9c', light: '#ffe0ea' },
      { base: '#9fe3c9', shade: '#5fbf9e', light: '#d8fbef' },
    ],
    trunk: { base: '#a8754a', shade: '#7a5030', light: '#d29e6e' },
    bramble: { base: '#7a4a9a', shade: '#55306f', light: '#b28bd0' },
    flowers: ['#ff8fb3', '#ffd34d', '#ffffff', '#9fd8ff'],
  },
  candy: {
    id: 'candy',
    name: 'Candy clouds',
    blurb: 'Pastel cloud-kingdom sky, minty hills, pink and lilac puff trees.',
    sky: ['#b7a6ff', '#ffc9ec', '#fff0f6'],
    sun: '#fff4d6',
    far: { base: '#e3cdf5', shade: '#cdb1ea', light: '#f6ecff' },
    farInk: '#b394d6',
    cloud: { base: '#fffafd', shade: '#f1d9ef', light: '#ffffff' },
    hill: { base: '#8fe0a8', shade: '#5fbf86', light: '#c9f6d6' },
    hill2: { base: '#c6efd6', shade: '#a4dcbc', light: '#e6fbef' },
    near: { base: '#62c08a', shade: '#3f9a6c', light: '#9be3b6' },
    soilTop: '#e6a98a',
    soilDeep: '#a8665a',
    strata: '#93564c',
    grass: { base: '#7ee39a', shade: '#46b36e', light: '#cdfbd8' },
    rock: { base: '#c8b8e3', shade: '#9d89c4', light: '#efe6ff' },
    canopies: [
      { base: '#ffb3d6', shade: '#e47fae', light: '#ffe3f1' },
      { base: '#c9b3ff', shade: '#9b80e6', light: '#efe6ff' },
      { base: '#a6f0e6', shade: '#6ccfc0', light: '#e3fffb' },
    ],
    trunk: { base: '#b98a74', shade: '#8a5e4c', light: '#e2b8a4' },
    bramble: { base: '#8b5fb8', shade: '#61408a', light: '#c4a3e8' },
    flowers: ['#ffffff', '#ffd1ea', '#fff2a8', '#c4b5ff'],
  },
  golden: {
    id: 'golden',
    name: 'Golden hour',
    blurb: 'Warm late-afternoon light, peachy sky, sun-baked hills.',
    sky: ['#ff9c78', '#ffcf9e', '#fff1d4'],
    sun: '#fff0c4',
    far: { base: '#f2c3b6', shade: '#df9f93', light: '#ffe4dc' },
    farInk: '#c98b82',
    cloud: { base: '#fff7ee', shade: '#f6d6c4', light: '#ffffff' },
    hill: { base: '#a8cf5a', shade: '#7fa83a', light: '#d6ef93' },
    hill2: { base: '#d6dd96', shade: '#bcc678', light: '#eef3c6' },
    near: { base: '#7aa848', shade: '#587f30', light: '#b0d878' },
    soilTop: '#d08850',
    soilDeep: '#86502c',
    strata: '#703f22',
    grass: { base: '#95cf48', shade: '#5f9a2c', light: '#d9f598' },
    rock: { base: '#c9a9a0', shade: '#9c7b72', light: '#f0dbd4' },
    canopies: [
      { base: '#ffb35c', shade: '#e0842a', light: '#ffe0b0' },
      { base: '#ff8f7a', shade: '#e0604a', light: '#ffd0c4' },
      { base: '#ffe07a', shade: '#e0b03a', light: '#fff4c4' },
    ],
    trunk: { base: '#9c6a42', shade: '#6e4628', light: '#c99668' },
    bramble: { base: '#7a3f6a', shade: '#55284a', light: '#b07aa0' },
    flowers: ['#ffffff', '#ffd34d', '#ff8fb3', '#ffb35c'],
  },
};

PALETTES.puff = {
  id: 'puff',
  name: 'Puff Ball Planet',
  blurb: 'Marshmallow earth topped with fluffy puff-moss, dandelion puffs, a ringed planet in a candy-blue sky.',
  sky: ['#5fc4ff', '#b9e4ff', '#ffe6f2'],
  sun: '#fff1c8',
  far: { base: '#cfc2f2', shade: '#b2a3e3', light: '#ece6ff' },
  farInk: '#9486c8',
  cloud: { base: '#ffffff', shade: '#e3dcf7', light: '#ffffff' },
  hill: { base: '#8fdcc4', shade: '#5fbfa4', light: '#c6f4e6' },
  hill2: { base: '#c3c8f2', shade: '#a3a8de', light: '#e2e5ff' },
  near: { base: '#6cc8ae', shade: '#4aa58c', light: '#a6ead6' },
  soilTop: '#f7c6a8',
  soilDeep: '#c98ca8',
  strata: '#b07892',
  grass: { base: '#7fe3c2', shade: '#3fb595', light: '#d4fff1' },
  rock: { base: '#b7aee3', shade: '#8a80c2', light: '#e8e3ff' },
  canopies: [
    { base: '#ffcf6e', shade: '#e3a03a', light: '#fff0b8' },
    { base: '#ffa8c8', shade: '#e2759c', light: '#ffe0ec' },
    { base: '#a8ecda', shade: '#62c4aa', light: '#e0fff6' },
  ],
  trunk: { base: '#b98872', shade: '#8a5e4c', light: '#e2b8a4' },
  bramble: { base: '#7a4a9a', shade: '#55306f', light: '#b28bd0' },
  flowers: ['#ffffff', '#ffb3d1', '#ffe17a', '#b9a8ff'],
};

export const DEFAULT_PALETTE = PALETTES.puff;

/** A style variant with a lighter ink, for far-away scenery. */
const inked = (ink: string): Style => ({ ...ST, ink, shape: ST.shape, line: ST.line });

// ───────────────────────────── terrain ──

export type TerrainKind = 'ground' | 'rock';

/**
 * Trace the outline of a set of grid cells as one closed clockwise loop of
 * corner points (in cell units). Cells are "x,y" keys.
 */
export function traceCells(cells: Set<string>): Pt[][] {
  const edges = new Map<string, [number, number][]>(); // start "x,y" -> list of end points
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = `${x0},${y0}`;
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k)!.push([x1, y1]);
  };
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    if (!cells.has(`${x},${y - 1}`)) add(x, y, x + 1, y);
    if (!cells.has(`${x + 1},${y}`)) add(x + 1, y, x + 1, y + 1);
    if (!cells.has(`${x},${y + 1}`)) add(x + 1, y + 1, x, y + 1);
    if (!cells.has(`${x - 1},${y}`)) add(x, y + 1, x, y);
  }
  const loops: Pt[][] = [];
  while (edges.size) {
    const [startKey, list] = edges.entries().next().value as [string, [number, number][]];
    const start = startKey.split(',').map(Number) as Pt;
    let cur: Pt = start;
    let next = list.pop()!;
    if (!list.length) edges.delete(startKey);
    const loop: Pt[] = [start];
    let guard = 0;
    while (guard++ < 100000) {
      cur = next;
      const k = `${cur[0]},${cur[1]}`;
      if (cur[0] === start[0] && cur[1] === start[1]) break;
      loop.push(cur);
      const outs = edges.get(k);
      if (!outs || !outs.length) break;
      next = outs.pop()!;
      if (!outs.length) edges.delete(k);
    }
    // drop collinear points
    const simple = loop.filter((p, i) => {
      const a = loop[(i - 1 + loop.length) % loop.length];
      const b = loop[(i + 1) % loop.length];
      return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
    });
    if (simple.length >= 3) loops.push(simple);
  }
  return loops;
}

/** Round every corner of a polygon and resample it densely. */
export function roundPoly(poly: Pt[], r: number): Pt[] {
  const out: Pt[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[(i - 1 + n) % n];
    const v = poly[i];
    const q = poly[(i + 1) % n];
    const d1 = Math.hypot(p[0] - v[0], p[1] - v[1]);
    const d2 = Math.hypot(q[0] - v[0], q[1] - v[1]);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a: Pt = [v[0] + ((p[0] - v[0]) / d1) * rr, v[1] + ((p[1] - v[1]) / d1) * rr];
    const b: Pt = [v[0] + ((q[0] - v[0]) / d2) * rr, v[1] + ((q[1] - v[1]) / d2) * rr];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * v[0] + t * t * b[0], u * u * a[1] + 2 * u * t * v[1] + t * t * b[1]]);
    }
    // straight run to the next corner, sampled so wobble has points to work with
    const c: Pt = [q[0] + ((v[0] - q[0]) / d2) * Math.min(r, d2 / 2), q[1] + ((v[1] - q[1]) / d2) * Math.min(r, d2 / 2)];
    const len = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const steps = Math.floor(len / 8);
    for (let k = 1; k < steps; k++) out.push([b[0] + ((c[0] - b[0]) * k) / steps, b[1] + ((c[1] - b[1]) * k) / steps]);
  }
  return out;
}

/** Gentle hand-drawn waviness along a long outline (based on arc length, so it scales). */
export function waver(pts: Pt[], amp: number, seed: number): Pt[] {
  const r = rng(seed);
  const p1 = r() * 6.28;
  const p2 = r() * 6.28;
  let s = 0;
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const next = pts[(i + 1) % pts.length];
    s += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    let nx = next[1] - prev[1];
    let ny = -(next[0] - prev[0]);
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const o = amp * (Math.sin(s * 0.045 + p1) * 0.7 + Math.sin(s * 0.13 + p2) * 0.3);
    return [p[0] + nx * o, p[1] + ny * o];
  });
}

/** Consecutive outline points whose outward normal points up (dir=-1) or down (dir=1). */
function facingRuns(pts: Pt[], dir: -1 | 1, thresh = 0.55): Pt[][] {
  const runs: Pt[][] = [];
  let cur: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const ny = -dx / l; // outward normal y for a clockwise loop in screen coords
    if (ny * dir > thresh) {
      if (!cur.length) cur.push(a);
      cur.push(b);
    } else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) {
    // join with the first run if the loop wrapped around
    if (runs.length && runs[0][0] === pts[0]) runs[0] = [...cur, ...runs[0].slice(1)];
    else runs.push(cur);
  }
  return runs.filter((r) => r.length > 1);
}

function strokeRun(ctx: Ctx, run: Pt[], width: number, color: string) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(...run[0]);
  for (const p of run.slice(1)) ctx.lineTo(...p);
  ctx.stroke();
}

/** Point every `step` px along a polyline. */
function along(run: Pt[], step: number, offset = 0): { p: Pt; dx: number; dy: number }[] {
  const out: { p: Pt; dx: number; dy: number }[] = [];
  let acc = -offset;
  for (let i = 0; i < run.length - 1; i++) {
    const a = run[i];
    const b = run[i + 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!l) continue;
    const dx = (b[0] - a[0]) / l;
    const dy = (b[1] - a[1]) / l;
    let t = acc < 0 ? -acc : step - (acc % step);
    if (acc < 0) t = -acc;
    for (; t <= l; t += step) out.push({ p: [a[0] + dx * t, a[1] + dy * t], dx, dy });
    acc += l;
  }
  return out;
}

export interface TerrainPieceOpts {
  kind: TerrainKind;
  /** Outline in world px (clockwise). */
  outline: Pt[];
  pal: WorldPalette;
  seed: number;
  /** World y below which edges are "the bottom of the world" (no roots/outline there). */
  floorY: number;
}

/**
 * Draws one connected piece of ground or rock. Ground gets soil with soft
 * strata and pebbles, a thick grassy top with blades, and hanging roots under
 * any floating underside. Rock gets a stony body with cracks and moss.
 */
export function drawTerrainPiece(ctx: Ctx, o: TerrainPieceOpts) {
  const { pal, seed } = o;
  const pts = waver(o.outline, o.kind === 'ground' ? 1.6 : 1.1, seed);
  const r = rng(seed + 7);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const tops = facingRuns(pts, -1);
  const bottoms = facingRuns(pts, 1).filter((run) => run.some(([, y]) => y < o.floorY - 4));

  ctx.save();
  trace(ctx, pts);
  if (o.kind === 'ground') {
    const g = ctx.createLinearGradient(0, y0, 0, Math.min(y1, y0 + 260));
    g.addColorStop(0, pal.soilTop);
    g.addColorStop(1, pal.soilDeep);
    ctx.fillStyle = g;
  } else {
    const g = ctx.createLinearGradient(x0, y0, x0 + 60, y1);
    g.addColorStop(0, pal.rock.light);
    g.addColorStop(0.35, pal.rock.base);
    g.addColorStop(1, pal.rock.shade);
    ctx.fillStyle = g;
  }
  ctx.fill();
  ctx.clip();

  const area = (x1 - x0) * (y1 - y0);
  if (o.kind === 'ground') {
    // soft wavy marshmallow bands
    for (let y = y0 + 30, k = 0; y < y1 + 40; y += 26 + r() * 12, k++) {
      ctx.fillStyle = k % 2 ? '#ffffff1f' : pal.strata + '26';
      ctx.beginPath();
      ctx.moveTo(x0 - 10, y1 + 50);
      for (let x = x0 - 10; x <= x1 + 10; x += 10) ctx.lineTo(x, y + Math.sin(x * 0.028 + k * 1.7) * 5);
      ctx.lineTo(x1 + 10, y1 + 50);
      ctx.fill();
    }
    // puff fossils: little curled spirals and sleeping puff seeds in the earth
    const fossils = Math.round(area / 3400);
    for (let i = 0; i < fossils; i++) {
      const px = x0 + r() * (x1 - x0);
      const py = y0 + 30 + r() * Math.max(1, y1 - y0 - 30);
      if (r() < 0.55) {
        const sp: Pt[] = [];
        const rr = 3 + r() * 3;
        for (let t = 0; t < 1; t += 0.06) sp.push([px + Math.cos(t * 11) * rr * t, py + Math.sin(t * 11) * rr * t]);
        ST.line(ctx, sp, seed + i, 0.55, pal.strata);
      } else {
        const rr = 2.6 + r() * 2.4;
        ST.shape(ctx, fluffPts(px, py, rr, rr, 6, 0.12, r() * 3), { base: '#fff4ea', shade: '#efd2d6', light: '#ffffff' }, seed + i, { lw: 0.45, plain: true });
      }
    }
    // fine crayon grain
    ctx.lineCap = 'round';
    for (let i = 0; i < area / 260; i++) {
      const gx = x0 + r() * (x1 - x0);
      const gy = y0 + r() * (y1 - y0);
      ctx.strokeStyle = r() > 0.5 ? '#00000012' : '#ffffff18';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(gx - 1.2, gy + 3);
      ctx.lineTo(gx + 1.2, gy - 3);
      ctx.stroke();
    }
    // darker band + hanging roots under floating undersides
    for (const run of bottoms) strokeRun(ctx, run, 22, pal.soilDeep);
    // puff-moss: a fluffy band of overlapping cotton puffs along every top edge
    for (const run of tops) {
      strokeRun(ctx, run, 26, pal.grass.shade);
      strokeRun(ctx, run, 20, pal.grass.base);
      for (const { p, dx, dy } of along(run, 8, 3)) {
        const rr = 5 + r() * 2.5;
        const ox = p[0] - dy * (9 + r() * 3);
        const oy = p[1] + dx * (9 + r() * 3);
        ctx.fillStyle = pal.grass.shade;
        ctx.beginPath();
        ctx.arc(ox, oy + 1.2, rr + 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.grass.base;
        ctx.beginPath();
        ctx.arc(ox, oy, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.grass.light + 'aa';
        ctx.beginPath();
        ctx.arc(ox - rr * 0.3, oy - rr * 0.35, rr * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      strokeRun(ctx, run, 4, pal.grass.light);
    }
  } else {
    // rock: cracks + facets
    for (let i = 0; i < Math.max(2, area / 1800); i++) {
      const cx = x0 + 8 + r() * (x1 - x0 - 16);
      const cy = y0 + 10 + r() * (y1 - y0 - 16);
      ST.line(ctx, [[cx, cy], [cx + 4 - r() * 8, cy + 6], [cx + 2 - r() * 4, cy + 11]], seed + 50 + i, 0.6, pal.rock.shade);
    }
    ctx.globalAlpha = 0.5;
    strokeRun(ctx, pts.slice(0, Math.max(2, Math.floor(pts.length / 3))), 7, pal.rock.light);
    ctx.globalAlpha = 1;
    // moss on top
    for (const run of tops) {
      strokeRun(ctx, run, 12, pal.grass.shade);
      strokeRun(ctx, run, 8, pal.grass.base);
      strokeRun(ctx, run, 3, pal.grass.light);
    }
  }
  ctx.restore();

  // ink outline
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  trace(ctx, pts);
  ctx.stroke();

  if (o.kind === 'ground') {
    // hanging roots + little dangling puff tufts under floating parts
    for (const run of bottoms) {
      for (const { p } of along(run, 14 + r() * 8, 6)) {
        if (r() < 0.35) continue;
        const len = 6 + r() * 14;
        const sway = (r() - 0.5) * 6;
        ST.line(ctx, [p, [p[0] + sway * 0.4, p[1] + len * 0.5], [p[0] + sway, p[1] + len]], seed + p[0], 0.7, pal.strata);
        if (r() < 0.3) ST.shape(ctx, ellipsePts(p[0] + sway, p[1] + len + 2, 2.4, 2.4, 0, 10), pal.grass, seed + p[0] + 1, { lw: 0.5, plain: true });
      }
    }
    // fluffy bumps cresting the top edge, and the odd dandelion-puff stalk
    for (const run of tops) {
      for (const { p } of along(run, 11 + r() * 6, r() * 6)) {
        const roll = r();
        if (roll < 0.5) {
          const rr = 3.2 + r() * 2.6;
          ST.shape(ctx, ellipsePts(p[0], p[1] - rr * 0.35, rr * 1.2, rr, 0, 16), pal.grass, seed + p[0], { lw: 0.6, plain: true });
        } else if (roll < 0.58) {
          const h = 9 + r() * 7;
          const lean = (r() - 0.5) * 5;
          ST.line(ctx, [[p[0], p[1]], [p[0] + lean * 0.4, p[1] - h * 0.5], [p[0] + lean, p[1] - h]], seed + p[0] + 2, 0.55, pal.grass.shade);
          const hx = p[0] + lean;
          const hy = p[1] - h - 3;
          ctx.fillStyle = '#ffffffdd';
          ctx.beginPath();
          ctx.arc(hx, hy, 3.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.7;
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(hx + Math.cos(a) * 5.4, hy + Math.sin(a) * 5.4);
            ctx.stroke();
          }
        }
      }
    }
  }
}

// ───────────────────────────── props ──

export const AURA: Fill = { base: '#6ff0d8', shade: '#2fb8b0', light: '#e6fffa' };

/** A floating aura wisp: a soft flame-teardrop of mint light with a swirl. Centre (cx, cy), height ~2.2r. */
export function drawAura(ctx: Ctx, cx: number, cy: number, r: number) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
  g.addColorStop(0, '#c8fff4aa');
  g.addColorStop(0.5, '#9ffbe855');
  g.addColorStop(1, '#9ffbe800');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  const flame: Pt[] = [];
  for (let i = 0; i < 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const x = Math.sin(t) * r * (0.72 + 0.28 * Math.cos(t));
    const y = -Math.cos(t) * r * 1.15 + (Math.cos(t) > 0 ? -Math.cos(t) * r * 0.25 : 0);
    flame.push([cx + x, cy + y + r * 0.2]);
  }
  // tip curls a little to one side
  flame.forEach((p, i) => {
    const t = (i / 40) * Math.PI * 2;
    if (Math.cos(t) > 0.6) p[0] += (Math.cos(t) - 0.6) * r * 0.9;
  });
  ST.shape(ctx, flame, AURA, 901, { lw: 0.75, light: [cx - r * 0.3, cy] });
  ST.line(ctx, [[cx - r * 0.35, cy + r * 0.45], [cx + r * 0.2, cy + r * 0.2], [cx - r * 0.05, cy - r * 0.25], [cx + r * 0.25, cy - r * 0.55]], 902, 0.6, '#ffffff');
  ST.shape(ctx, ellipsePts(cx - r * 0.05, cy + r * 0.3, r * 0.32, r * 0.36, 0, 16), { base: '#ffffff', shade: '#e6fffa', light: '#ffffff' }, 903, {
    noLine: true,
    plain: true,
  });
}

/** Blastable puff boulder filling one 32×32 cell at (x, y) top-left. */
export function drawBoulder(ctx: Ctx, x: number, y: number, pal: WorldPalette, seed: number) {
  const r = rng(seed);
  const pts = fluffPts(x + 16, y + 16, 17, 16.5, 6, 0.06, r() * 3);
  ST.shape(ctx, pts, { base: pal.rock.base, shade: pal.rock.shade, light: pal.rock.light }, seed, { lw: 0.95, light: [x + 10, y + 9] });
  // cracks that hint "blast me"
  ST.line(ctx, [[x + 9 + r() * 4, y + 6], [x + 14, y + 13], [x + 11, y + 19], [x + 16, y + 25]], seed + 1, 0.65, pal.rock.shade);
  ST.line(ctx, [[x + 14, y + 13], [x + 21, y + 15]], seed + 2, 0.55, pal.rock.shade);
}

/** Thorny bramble on a 32-wide cell whose ground surface is at y = groundY. */
export function drawBramble(ctx: Ctx, x: number, groundY: number, pal: WorldPalette, seed: number) {
  const r = rng(seed);
  // tangled vines
  for (let i = 0; i < 3; i++) {
    const y = groundY - 6 - i * 5;
    const pts: Pt[] = [];
    for (let k = 0; k <= 6; k++) pts.push([x - 2 + k * 6, y + Math.sin(k * 1.4 + i * 2 + seed) * 3]);
    ST.line(ctx, pts, seed + i, 1.9);
    ST.line(ctx, pts, seed + i, 1.0, i % 2 ? pal.bramble.base : pal.bramble.shade);
  }
  // thorns pointing up and out
  for (let k = 0; k < 6; k++) {
    const tx = x + 3 + k * 5.4 + (r() - 0.5) * 2;
    const ty = groundY - 12 - r() * 8;
    const ang = -Math.PI / 2 + (r() - 0.5) * 1.1;
    ST.shape(ctx, petalPts(tx, ty, 9, 4.6, ang), { base: '#f2ecf6', shade: '#bfb2c9', light: '#ffffff' }, seed + 10 + k, { lw: 0.7, plain: true });
  }
}

/** Fluffy one-way cloud platform. (x, y) = top-left of the walkable surface, w = width. */
export function drawCloudPlatform(ctx: Ctx, x: number, y: number, w: number, pal: WorldPalette, seed: number) {
  const r = rng(seed);
  const pts: Pt[] = [];
  // flat-ish top so feet sit on it, puffy lumps below and at the ends
  const n = Math.max(3, Math.round(w / 14));
  pts.push([x - 2, y + 2]);
  for (let i = 0; i <= n; i++) pts.push([x + (i / n) * w, y - 2.5 - Math.sin((i / n) * Math.PI) * 1.5]);
  pts.push([x + w + 6, y + 4]);
  for (let i = n; i >= 0; i--) {
    const cx = x + (i / n) * w;
    pts.push([cx + 3, y + 12 + r() * 2]);
    pts.push([cx - 3, y + 15 + r() * 3]);
  }
  pts.push([x - 7, y + 8]);
  ST.shape(ctx, pts, pal.cloud, seed, { lw: 1, light: [x + w * 0.3, y] });
  // soft shading lumps along the bottom
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = pal.cloud.shade;
    ctx.beginPath();
    ctx.ellipse(x + ((i + 0.5) / n) * w, y + 11, w / n / 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Puff-ball tree: curvy trunk with a cluster of pastel puff canopies. Feet at (x, groundY). */
export function drawPuffTree(ctx: Ctx, x: number, groundY: number, h: number, pal: WorldPalette, seed: number) {
  const r = rng(seed);
  const canopy = pal.canopies[Math.floor(r() * pal.canopies.length)];
  const lean = (r() - 0.5) * 10;
  const topX = x + lean;
  const topY = groundY - h;
  const trunk: Pt[] = [
    [x - 4.5, groundY + 2],
    [x + 4.5, groundY + 2],
    [topX + 3, topY + 10],
    [topX - 3, topY + 10],
  ];
  ST.shape(ctx, trunk, pal.trunk, seed + 1, { lw: 0.9 });
  ST.line(ctx, [[x - 1, groundY - 6], [topX - 0.5, topY + 16]], seed + 2, 0.5, pal.trunk.shade);
  // a little branch
  ST.shape(ctx, paddlePts(topX + 1, topY + 26, 12, 4, -0.5), pal.trunk, seed + 3, { lw: 0.8 });
  const blobs: [number, number, number][] = [
    [topX - 13, topY + 4, 13],
    [topX + 13, topY + 6, 12],
    [topX, topY - 6, 17],
    [topX + 16, topY + 22, 8],
  ];
  for (const [bx, by, br] of blobs) ST.shape(ctx, fluffPts(bx, by, br, br * 0.95, 7, 0.08, r() * 3), canopy, seed + bx, { lw: 0.95, light: [bx - br * 0.3, by - br * 0.4] });
}

/** Little puff flower (round fluffy head on a stem). */
export function drawFlower(ctx: Ctx, x: number, groundY: number, color: string, seed: number) {
  ST.line(ctx, [[x, groundY], [x + 1, groundY - 6], [x, groundY - 12]], seed, 0.9, '#3f8a34');
  ST.shape(ctx, paddlePts(x, groundY - 5, 6, 3, -0.4), { base: '#6fd14b', shade: '#3e9c35', light: '#c2f58c' }, seed + 1, { lw: 0.5, plain: true });
  const f: Fill = { base: color, shade: color, light: '#ffffff' };
  ST.shape(ctx, fluffPts(x, groundY - 15, 4.6, 4.4, 6, 0.12), f, seed + 2, { lw: 0.6, plain: true });
  ctx.fillStyle = '#ffffffaa';
  ctx.beginPath();
  ctx.arc(x - 1.4, groundY - 16.5, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

/** Checkpoint: a puff-bloom flower. Closed bud until reached, then it opens and glows. Feet at (x, groundY). */
export function drawBloom(ctx: Ctx, x: number, groundY: number, open: boolean) {
  const stemTop = groundY - 62;
  ST.line(ctx, [[x, groundY], [x - 3, groundY - 24], [x + 2, groundY - 44], [x, stemTop]], 951, 2.4);
  ST.line(ctx, [[x, groundY], [x - 3, groundY - 24], [x + 2, groundY - 44], [x, stemTop]], 951, 1.3, '#4fae4c');
  ST.shape(ctx, paddlePts(x - 1, groundY - 20, 18, 8, Math.PI + 0.45), { base: '#6fd14b', shade: '#3e9c35', light: '#c2f58c' }, 952, { lw: 0.8 });
  ST.shape(ctx, paddlePts(x + 1, groundY - 34, 16, 7, -0.4), { base: '#6fd14b', shade: '#3e9c35', light: '#c2f58c' }, 953, { lw: 0.8 });
  const petal: Fill = open ? { base: '#ffb0d0', shade: '#e07aa6', light: '#ffe6f1' } : { base: '#c9a3e6', shade: '#9b77c2', light: '#eadcf7' };
  if (open) {
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i / 7) * Math.PI * 2;
      ST.shape(ctx, paddlePts(x, stemTop - 8, 17, 11, a), petal, 960 + i, { lw: 0.85 });
    }
    drawAura(ctx, x, stemTop - 9, 7);
  } else {
    const bud: Pt[] = [];
    for (let i = 0; i < 30; i++) {
      const t = (i / 30) * Math.PI * 2;
      bud.push([x + Math.sin(t) * 9 * (1 - 0.35 * Math.max(0, -Math.cos(t))), stemTop - 10 - Math.cos(t) * 13]);
    }
    ST.shape(ctx, bud, petal, 970, { lw: 0.9 });
    ST.line(ctx, [[x - 4, stemTop - 2], [x - 1, stemTop - 14], [x + 1, stemTop - 22]], 971, 0.6, petal.shade);
    ST.line(ctx, [[x + 4, stemTop - 2], [x + 2, stemTop - 12]], 972, 0.6, petal.shade);
  }
}

/** Goal: the Puff Gate — an arch of puffs. (The swirl inside is drawn separately so it can spin.) Feet at (x, groundY). */
export function drawGate(ctx: Ctx, x: number, groundY: number, pal: WorldPalette) {
  const W = 46;
  const H = 104;
  // stone feet
  for (const s of [-1, 1]) ST.shape(ctx, roundRectPts(x + s * W - 10, groundY - 14, 20, 16, 6), pal.rock, 980 + s, { lw: 1 });
  // the arch: a ring of puffs
  const n = 13;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    const px = x + Math.cos(a) * W;
    const py = groundY - 18 - (i === 0 || i === n ? 0 : 0) + Math.sin(a) * (H - 34) - 0;
    const pr = 11 + (i % 2) * 2;
    ST.shape(ctx, fluffPts(px, py - 4, pr, pr, 6, 0.1, i), pal.canopies[i % pal.canopies.length], 990 + i, { lw: 0.9, light: [px - 4, py - 8] });
  }
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) {
      const px = x + s * W;
      const py = groundY - 18 - k * 0;
      ST.shape(ctx, fluffPts(px, py - 4 + k * 0, 12, 12, 6, 0.1, k), pal.canopies[(k + 1) % pal.canopies.length], 1010 + s * 3 + k, { lw: 0.9 });
    }
  }
}

/** The aura swirl inside the gate (rotated by the game). Centred at (cx, cy), radius r. */
export function drawGateSwirl(ctx: Ctx, cx: number, cy: number, r: number) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, '#ffffffee');
  g.addColorStop(0.35, '#b8fff0cc');
  g.addColorStop(0.75, '#6ff0d888');
  g.addColorStop(1, '#6ff0d800');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 3; arm++) {
    ctx.strokeStyle = arm === 0 ? '#ffffffcc' : '#2fb8b088';
    ctx.lineWidth = 3 - arm * 0.6;
    ctx.beginPath();
    for (let t = 0; t < 1; t += 0.03) {
      const a = arm * ((Math.PI * 2) / 3) + t * Math.PI * 2.2;
      const rr = r * (0.1 + t * 0.8);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

// ───────────────────────────── backgrounds (tileable, width W) ──

const wrapX = (W: number, fn: (dx: number) => void) => [-W, 0, W].forEach(fn);

export function drawSky(ctx: Ctx, w: number, h: number, pal: WorldPalette) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  pal.sky.forEach((c, i) => g.addColorStop(i / (pal.sky.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Far layer: dreamy floating islands with little waterfalls, over soft distant domes. */
export function drawFarLayer(ctx: Ctx, W: number, H: number, pal: WorldPalette) {
  const far = inked(pal.farInk);
  const r = rng(41);
  // a big ringed planet and a little moon hanging in the sky
  wrapX(W, (dx) => {
    const px = 700 + dx;
    const py = 52;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = pal.far.light;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(px, py, 66, 15, -0.25, Math.PI * 0.95, Math.PI * 2.05);
    ctx.stroke();
    far.shape(ctx, fluffPts(px, py, 38, 38, 9, 0.05), { base: '#ffd2b8', shade: '#f0a8a8', light: '#fff0e2' }, 30, { lw: 0.8, light: [px - 14, py - 16] });
    ctx.strokeStyle = pal.far.light;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(px, py, 66, 15, -0.25, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
    ctx.restore();
    far.shape(ctx, ellipsePts(160 + dx, 28, 11, 11, 0, 24), { base: '#f6f0ff', shade: '#d8cff0', light: '#ffffff' }, 31, { lw: 0.7 });
  });
  // distant puffy domes along the bottom
  for (let x = 0; x < W; x += 120 + r() * 70) {
    const w = 90 + r() * 60;
    const h = 50 + r() * 40;
    wrapX(W, (dx) => far.shape(ctx, fluffPts(x + dx, H - 6, w, h, 9, 0.05, r() * 3), pal.far, 300 + x, { lw: 0.8 }));
  }
  ctx.fillStyle = pal.far.base;
  ctx.fillRect(0, H - 12, W, 12);
  // floating islands
  for (const [ix, iy, iw] of [[150, 70, 70], [520, 44, 54], [820, 90, 80]] as const) {
    wrapX(W, (dx) => {
      const x = ix + dx;
      // waterfall
      ctx.fillStyle = '#ffffffaa';
      ctx.fillRect(x + iw * 0.25, iy + 12, 5, 70);
      // rocky underside
      const under: Pt[] = [
        [x - iw, iy],
        [x + iw, iy],
        [x + iw * 0.45, iy + 24],
        [x + 6, iy + 46],
        [x - iw * 0.5, iy + 22],
      ];
      far.shape(ctx, under, { base: pal.far.shade, shade: pal.far.shade, light: pal.far.base }, 400 + ix, { lw: 0.8, plain: true });
      // grassy top
      far.shape(ctx, roundRectPts(x - iw - 2, iy - 8, iw * 2 + 4, 14, 7), pal.hill2, 410 + ix, { lw: 0.8, plain: true });
      // a tiny puff tree
      far.shape(ctx, fluffPts(x + iw * 0.3, iy - 18, 11, 10, 6, 0.1), pal.canopies[ix % 3], 420 + ix, { lw: 0.7, plain: true });
    });
  }
}

/** Cloud layer: hand-drawn puffy clouds. */
export function drawCloudLayer(ctx: Ctx, W: number, H: number, pal: WorldPalette) {
  const r = rng(5);
  for (let i = 0; i < 6; i++) {
    const cx = (i / 6) * W + r() * 60;
    const cy = 30 + r() * (H - 70);
    const s = 0.7 + r() * 0.6;
    wrapX(W, (dx) => {
      const lumps: [number, number, number][] = [
        [-30, 6, 17],
        [-10, -6, 23],
        [15, -2, 20],
        [34, 7, 14],
      ];
      // merge lumps into one silhouette by sampling the union
      const pts: Pt[] = [];
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        let best = 6;
        for (const [lx, ly, lr] of lumps) {
          const b = lx * Math.cos(a) + ly * Math.sin(a);
          const c = lx * lx + ly * ly - lr * lr;
          const disc = b * b - c;
          if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
        }
        pts.push([cx + dx + Math.cos(a) * best * s, cy + Math.min(Math.sin(a) * best, 12) * s]);
      }
      inked(pal.farInk).shape(ctx, pts, pal.cloud, 500 + i, { lw: 0.8 });
    });
  }
}

/** Mid layer: rolling hills (no checkerboard) dotted with little puff trees. */
export function drawHillsLayer(ctx: Ctx, W: number, H: number, pal: WorldPalette) {
  const mid = inked('#4c8a5a');
  const r = rng(21);
  const hills: [number, number, number][] = [];
  for (let x = 0; x < W; x += 150 + r() * 100) hills.push([x, H - 70 - r() * 80, 120 + r() * 70]);
  for (const [i, [hx, hy, hw]] of hills.entries()) {
    wrapX(W, (dx) => {
      const x = hx + dx;
      const pts: Pt[] = [];
      for (let k = 0; k <= 30; k++) {
        const t = k / 30;
        pts.push([x - hw + t * hw * 2, H + 10 - Math.pow(Math.sin(t * Math.PI), 0.8) * (H + 10 - hy)]);
      }
      mid.shape(ctx, pts, i % 2 ? pal.hill : pal.hill2, 600 + i, { lw: 0.9, light: [x - hw * 0.3, hy + 10] });
      // a couple of tiny puff trees on the crest
      for (let k = 0; k < 2; k++) {
        const tx = x - hw * 0.4 + k * hw * 0.7;
        const t = (tx - (x - hw)) / (hw * 2);
        const ty = H + 10 - Math.pow(Math.sin(t * Math.PI), 0.8) * (H + 10 - hy);
        mid.line(ctx, [[tx, ty + 2], [tx, ty - 10]], 610 + k, 0.8, pal.trunk.shade);
        mid.shape(ctx, fluffPts(tx, ty - 15, 7, 6.5, 6, 0.1), pal.canopies[(i + k) % 3], 620 + i * 3 + k, { lw: 0.7 });
      }
    });
  }
  ctx.fillStyle = pal.hill2.base;
  ctx.fillRect(0, H - 8, W, 8);
}

/** Near layer: a sea of clouds far below the level, so pits read as a long drop. */
export function drawNearLayer(ctx: Ctx, W: number, H: number, pal: WorldPalette) {
  const sea = inked(pal.farInk);
  const r = rng(33);
  const back: Fill = { base: pal.cloud.shade, shade: pal.far.shade, light: pal.cloud.base };
  // back row of cloud tops (a little darker), then a brighter front row
  for (const [row, fill, y0, rMin] of [[0, back, 34, 22], [1, pal.cloud, 58, 26]] as const) {
    for (let x = row * 30; x < W + 60; x += 52 + r() * 30) {
      const rr = rMin + r() * 18;
      const y = y0 + r() * 12;
      wrapX(W, (dx) => sea.shape(ctx, fluffPts(x + dx, y, rr * 1.25, rr * 0.8, 7, 0.08, r() * 3), fill, 700 + x + row * 999, { lw: 0.8, light: [x + dx - rr * 0.4, y - rr * 0.4] }));
    }
  }
  const g = ctx.createLinearGradient(0, 70, 0, H);
  g.addColorStop(0, pal.cloud.base);
  g.addColorStop(1, pal.cloud.shade);
  ctx.fillStyle = g;
  ctx.fillRect(0, 74, W, H - 74);
}

/** Colour under the cloud sea (fills the bottom of the screen). */
export const seaColor = (pal: WorldPalette) => pal.cloud.shade;

export { drawNuggie, drawRootBeer } from './collectibles';
