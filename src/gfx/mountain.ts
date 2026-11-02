/**
 * Part 2 (the mountain): the three looks it cycles through, the terrain
 * palettes for its zones (snowy rock, green valleys, the frozen pond), puff
 * pines, and tileable mountain background layers drawn in the hand-drawn style.
 */
import { rng, type Ctx } from './draw';
import { STYLES, roundRectPts, type Fill, type Pt, type Style } from './handdrawn';
import { PALETTES, roundPoly, type WorldPalette } from './world';

const ST = STYLES.polished;
const fill = (b: string, s: string, l: string): Fill => ({ base: b, shade: s, light: l });
const inked = (ink: string): Style => ({ ...ST, ink, shape: ST.shape, line: ST.line });
const wrapX = (W: number, fn: (dx: number) => void) => [-W, 0, W].forEach(fn);

export interface MountainLook {
  id: string;
  name: string;
  blurb: string;
  pal: WorldPalette;
  /** Far, mid and near mountain ranges (base colours) and snow on the peaks. */
  ranges: [string, string, string];
  snow: string;
  extras: 'waterfall' | 'snowfall' | 'dust';
}

const base = PALETTES.puff;

export const MOUNTAIN_LOOKS: MountainLook[] = [
  {
    id: 'pastel',
    name: 'Marshmallow Mountain',
    blurb: 'The same candy world as Part 1, stood on end: lilac rock, puff-moss ledges dusted with snow, soda waterfalls and the ringed planet behind the peaks.',
    pal: {
      ...base,
      id: 'm-pastel',
      name: 'Marshmallow Mountain',
      sky: ['#78c6ff', '#c4e6ff', '#ffe6f2'],
      soilTop: '#dccbee',
      soilDeep: '#a28bc0',
      strata: '#8f76ad',
      grass: fill('#f4fbff', '#cfe0f2', '#ffffff'),
      rock: fill('#b7aade', '#8a7fbf', '#e6e0ff'),
      canopies: [fill('#a8ecda', '#62c4aa', '#e0fff6'), fill('#ffb0cc', '#e27c9c', '#ffe0ea')],
    },
    ranges: ['#d8d0f2', '#b9abe0', '#9a88c9'],
    snow: '#ffffff',
    extras: 'waterfall',
  },
  {
    id: 'frost',
    name: 'Frosty Puff Peaks',
    blurb: 'Higher and colder: icy blue rock, thick puff-snow on every ledge, frosted pines and snow drifting down. Ice ledges could be slippery.',
    pal: {
      ...base,
      id: 'm-frost',
      name: 'Frosty Puff Peaks',
      sky: ['#4f9fe6', '#b8ddff', '#f2fbff'],
      cloud: fill('#ffffff', '#dbe9f8', '#ffffff'),
      soilTop: '#c9d9ee',
      soilDeep: '#7f97bb',
      strata: '#6c84a8',
      grass: fill('#ffffff', '#d6e6f7', '#ffffff'),
      rock: fill('#a7c4e6', '#7593bd', '#e3f0ff'),
      canopies: [fill('#7fcfb8', '#4a9e8a', '#c8f2e6')],
      farInk: '#7f9cc6',
    },
    ranges: ['#d6e6f8', '#b0c9e8', '#8aa7cf'],
    snow: '#ffffff',
    extras: 'snowfall',
  },
  {
    id: 'sunset',
    name: 'Sunset Crags',
    blurb: 'Warm canyon cliffs at golden hour: orange rock, dry golden grass, wooden ladders and rope bridges, dust drifting in the light.',
    pal: {
      ...base,
      id: 'm-sunset',
      name: 'Sunset Crags',
      sky: ['#ff8f6e', '#ffc79c', '#fff0d4'],
      cloud: fill('#fff6ec', '#f7d4c0', '#ffffff'),
      soilTop: '#e7a06c',
      soilDeep: '#a8603c',
      strata: '#8c4c2e',
      grass: fill('#e8c25a', '#b8902e', '#fbe7a0'),
      rock: fill('#cf8f6e', '#a0624a', '#f2c8b0'),
      canopies: [fill('#f2a640', '#c9781e', '#ffd99a'), fill('#e8705a', '#b8463a', '#ffb4a4')],
      farInk: '#c98b82',
    },
    ranges: ['#f4c6b0', '#e29a80', '#c07258'],
    snow: '#fff4e6',
    extras: 'dust',
  },
];

// the looks are cycled like Part 1's (registered by id so the theme system can find them)
for (const l of MOUNTAIN_LOOKS) PALETTES[l.pal.id] = l.pal;

/** Terrain palettes for Part 2's zones. */
PALETTES['z-snow'] = {
  ...base,
  id: 'z-snow',
  name: 'Snowy rock',
  soilTop: '#d6cde6',
  soilDeep: '#9d92b8',
  strata: '#8a80a6',
  grass: fill('#ffffff', '#d7e2f2', '#ffffff'),
  rock: fill('#b9b0d6', '#8c84b0', '#e8e4fa'),
  canopies: [fill('#86d6be', '#4fa88f', '#cdf6ea')],
  flowers: ['#ffffff'],
};
PALETTES['z-valley'] = {
  ...base,
  id: 'z-valley',
  name: 'Green valley',
  soilTop: '#d8a274',
  soilDeep: '#9a6644',
  strata: '#87553a',
  grass: fill('#79d66a', '#46a84a', '#bff29a'),
  rock: fill('#b8aec8', '#8a80a0', '#e6e0f0'),
  canopies: [fill('#9fe38a', '#5fb85a', '#d6f8c4'), fill('#ffd36e', '#e0a43a', '#fff0b8'), fill('#ffb0c8', '#e27c9c', '#ffe0ea')],
  flowers: ['#ff8fb3', '#ffd34d', '#ffffff', '#9fd8ff'],
};
PALETTES['z-ice'] = {
  ...base,
  id: 'z-ice',
  name: 'Frozen pond',
  soilTop: '#cfe2f5',
  soilDeep: '#8fabd0',
  strata: '#7a98c0',
  grass: fill('#e6f6ff', '#b4d6f0', '#ffffff'),
  rock: fill('#a7c4e6', '#7593bd', '#e3f0ff'),
  canopies: [fill('#7fcfb8', '#4a9e8a', '#c8f2e6')],
  flowers: ['#ffffff'],
};

const darker = (c: string, k: number) => {
  const n = parseInt(c.slice(1), 16);
  const f = (v: number) => Math.min(255, Math.round(v * k));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

/** A snowy puff-pine: stacked rounded tiers with snow on each. */
export function drawPine(ctx: Ctx, x: number, groundY: number, h: number, pal: WorldPalette, snow: string, seed: number, st: Style = ST) {
  st.shape(ctx, roundRectPts(x - 3, groundY - h * 0.25, 6, h * 0.25, 2), pal.trunk, seed, { lw: 0.8 });
  const c = pal.canopies[Math.abs(seed) % pal.canopies.length];
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
    st.shape(ctx, roundPoly(tier, 5), c, seed + i, { lw: 0.85 });
    st.shape(ctx, [[x - w * 0.5, y - h * 0.15], [x, y - h * 0.32], [x + w * 0.5, y - h * 0.15], [x + w * 0.2, y - h * 0.12], [x - w * 0.2, y - h * 0.13]], fill(snow, '#dfe7f4', '#ffffff'), seed + 10 + i, { lw: 0.5, plain: true });
  }
}

/** A tileable range of snow-capped peaks along the bottom of a W × H strip. */
/**
 * A jagged, irregular mountain range that tiles horizontally: main peaks of
 * random height and width (some tall and sharp, some low and broad, often
 * leaning), joined by notched saddles, then roughened with fractal midpoint
 * displacement. Each peak gets a shadowed face and a ragged snow cap.
 */
function rangeTile(ctx: Ctx, W: number, H: number, baseY: number, peakH: [number, number], col: string, snow: string, seed: number, st: Style) {
  const r = rng(seed);
  // anchors: valley, peak, valley, peak … ; first and last valley coincide (wraps)
  const peaks: { x: number; y: number; w: number }[] = [];
  for (let x = 0; x < W - 40; ) {
    const w = 50 + Math.pow(r(), 1.4) * 190;
    const tall = r();
    peaks.push({ x: x + w * (0.3 + r() * 0.4), y: baseY - (peakH[0] + Math.pow(tall, 0.8) * (peakH[1] - peakH[0])), w });
    x += w;
  }
  const scale = W / peaks.reduce((s2, p) => s2 + p.w, 0);
  let acc = 0;
  for (const p of peaks) {
    const lean = (p.x - acc) / p.w;
    p.w *= scale;
    p.x = acc + p.w * lean;
    acc += p.w;
  }
  const valleyY = () => baseY - 6 - r() * Math.min(40, (peakH[0] * 0.6));
  const v0 = valleyY();
  const anchors: Pt[] = [[0, v0]];
  let edge = 0;
  for (const p of peaks) {
    anchors.push([p.x, p.y]);
    edge += p.w;
    if (edge < W - 1) anchors.push([edge + (r() - 0.5) * 10, valleyY()]);
  }
  anchors.push([W, v0]);
  // fractal roughening
  const ridge: Pt[] = [anchors[0]];
  const rough = (a: Pt, b: Pt, depth: number) => {
    if (depth === 0) {
      ridge.push(b);
      return;
    }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const m: Pt = [(a[0] + b[0]) / 2 + (r() - 0.5) * len * 0.12, (a[1] + b[1]) / 2 + (r() - 0.5) * len * 0.32];
    rough(a, m, depth - 1);
    rough(m, b, depth - 1);
  };
  for (let k = 1; k < anchors.length; k++) rough(anchors[k - 1], anchors[k], 4);
  const f = fill(col, darker(col, 0.86), darker(col, 1.08));
  const shadow = darker(col, 0.8);
  // all the randomness is decided up front, so every wrapped copy is identical (seamless)
  const jit = peaks.map(() => ({ foot: (r() - 0.5) * 8, snow: Array.from({ length: 8 }, () => 0.7 + r() * 0.5) }));
  wrapX(W, (dx) => {
    const pts: Pt[] = [[dx, H + 4], ...ridge.map(([x, y]) => [x + dx, y] as Pt), [dx + W, H + 4]];
    st.shape(ctx, pts, f, seed + dx, { lw: 0.8 });
    // the shadowed face of each peak (light from the upper left)
    ctx.fillStyle = shadow;
    ctx.globalAlpha = 0.55;
    for (const [pi, p] of peaks.entries()) {
      const face = ridge.filter(([x]) => x >= p.x && x <= p.x + p.w * 0.55);
      if (face.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(dx + p.x, p.y);
      for (const [x, y] of face) ctx.lineTo(dx + x, y);
      const last = face[face.length - 1];
      ctx.lineTo(dx + last[0] - 4, Math.min(H + 4, last[1] + 40));
      ctx.lineTo(dx + p.x + jit[pi].foot, Math.min(H + 4, baseY + 10));
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // ragged snow caps on the taller peaks
    for (const [pi, p] of peaks.entries()) {
      const tall = baseY - p.y;
      if (tall < peakH[0] * 0.75) continue;
      const depth = Math.min(46, tall * 0.34);
      const cap = ridge.filter(([x, y]) => Math.abs(x - p.x) < p.w * 0.6 && y < p.y + depth);
      if (cap.length < 3) continue;
      const pts2: Pt[] = cap.map(([x, y]) => [x + dx, y] as Pt);
      // jagged lower edge, back the other way
      const n = 7;
      const xa = cap[0][0];
      const xb = cap[cap.length - 1][0];
      for (let k = n; k >= 0; k--) {
        const x = xa + ((xb - xa) * k) / n;
        const near = cap.reduce((best, q) => (Math.abs(q[0] - x) < Math.abs(best[0] - x) ? q : best), cap[0]);
        pts2.push([x + dx, Math.max(near[1], p.y + depth * (k % 2 ? 0.55 : 1) * jit[pi].snow[k])]);
      }
      st.shape(ctx, pts2, fill(snow, '#dfe7f4', '#ffffff'), seed + p.x + dx, { lw: 0.6, plain: true });
    }
  });
}

/** Far layer: two distant snowy ranges. */
export function drawMountainFar(ctx: Ctx, W: number, H: number, look: MountainLook) {
  const st = inked(look.pal.farInk);
  rangeTile(ctx, W, H, H - 40, [110, 180], look.ranges[0], look.snow, 11, st);
  rangeTile(ctx, W, H, H, [60, 120], look.ranges[1], look.snow, 23, st);
}

/** Mid layer: a nearer range with pines along its foot. */
export function drawMountainMid(ctx: Ctx, W: number, H: number, look: MountainLook) {
  const st = inked(darker(look.ranges[2], 0.7));
  rangeTile(ctx, W, H, H - 10, [80, 150], look.ranges[2], look.snow, 37, st);
  const r = rng(51);
  for (let x = 10; x < W; x += 34 + r() * 50) {
    const h = 30 + r() * 26;
    wrapX(W, (dx) => drawPine(ctx, x + dx, H + 4, h, look.pal, look.snow, 60 + Math.round(x), st));
  }
}

/** Near layer: rolling foothills (snowy or golden) dotted with pines, a band of mist below. */
export function drawMountainNear(ctx: Ctx, W: number, H: number, look: MountainLook) {
  const st = inked(look.pal.farInk);
  const r = rng(71);
  const hill = fill(look.pal.grass.base, look.pal.grass.shade, look.pal.grass.light);
  for (let x = -40; x < W + 40; x += 140 + r() * 80) {
    const w = 120 + r() * 70;
    const top = 40 + r() * 30;
    wrapX(W, (dx) => {
      const pts: Pt[] = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        pts.push([x + dx - w + 2 * w * t, top + (1 - Math.sin(Math.PI * t)) * 60]);
      }
      pts.push([x + dx + w, H + 4], [x + dx - w, H + 4]);
      st.shape(ctx, pts, hill, 700 + x, { lw: 0.8 });
    });
    for (let k = 0; k < 2; k++) {
      const px = x + (r() - 0.5) * w;
      const h = 26 + r() * 20;
      const py = top + 34 + r() * 6;
      wrapX(W, (dx) => drawPine(ctx, px + dx, py, h, look.pal, look.snow, 90 + Math.abs(Math.round(px)), st));
    }
  }
  const g = ctx.createLinearGradient(0, 96, 0, H);
  g.addColorStop(0, look.pal.cloud.base);
  g.addColorStop(1, look.pal.cloud.shade);
  ctx.fillStyle = g;
  ctx.fillRect(0, 100, W, H - 100);
}
