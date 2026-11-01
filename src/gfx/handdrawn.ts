/**
 * A small "hand-drawn" rendering toolkit. Shapes are point lists that get a
 * gentle, smooth wobble, then are inked and colored according to a Style.
 * The same drawing code can therefore be rendered as crayon, polished
 * cartoon, ink & watercolor, or bold sticker art.
 */
import { rng, type Ctx } from './draw';

export type Pt = [number, number];
export interface Fill {
  base: string;
  shade: string;
  light: string;
}
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type StyleId = 'storybook' | 'polished' | 'watercolor' | 'sticker';

export interface Style {
  id: StyleId;
  name: string;
  blurb: string;
  ink: string;
  lineWidth: number;
  wobble: number;
  /** Paper color behind scenes (null = no paper texture). */
  paper: string | null;
  /** Draw a filled + inked shape. */
  shape(ctx: Ctx, pts: Pt[], fill: Fill, seed: number, opts?: ShapeOpts): void;
  /** Ink an open line (stems, legs...). */
  line(ctx: Ctx, pts: Pt[], seed: number, width?: number, color?: string): void;
}

export interface ShapeOpts {
  /** Where the light comes from, as a point in the shape's space. Defaults to top-left of bounds. */
  light?: Pt;
  /** Multiplies the outline width. */
  lw?: number;
  /** Skip the outline. */
  noLine?: boolean;
  /** Skip texture (grain, washes) for tiny details. */
  plain?: boolean;
}

// ───────────────────────────── geometry ──

export function ellipsePts(cx: number, cy: number, rx: number, ry: number, rot = 0, n = 44): Pt[] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

export function roundRectPts(x: number, y: number, w: number, h: number, r: number, perCorner = 6): Pt[] {
  r = Math.min(r, w / 2, h / 2);
  const out: Pt[] = [];
  const corners: [number, number, number][] = [
    [x + w - r, y + r, -Math.PI / 2],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, Math.PI / 2],
    [x + r, y + r, Math.PI],
  ];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= perCorner; i++) {
      const a = a0 + (i / perCorner) * (Math.PI / 2);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  return out;
}

/** Rounded paddle (an oval anchored at one end), for arms. */
export function paddlePts(x: number, y: number, l: number, w: number, rot: number, n = 28): Pt[] {
  return ellipsePts(x + Math.cos(rot) * l * 0.5, y + Math.sin(rot) * l * 0.5, l * 0.5, w * 0.5, rot, n);
}

/** Teardrop / petal pointing along +x from (0,0), length l, width w, then rotated and moved. */
export function petalPts(x: number, y: number, l: number, w: number, rot: number, n = 28): Pt[] {
  const out: Pt[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const px = (Math.cos(t) * 0.5 + 0.5) * l;
    const py = Math.sin(t) * w * 0.5 * (0.35 + 0.65 * Math.sin((px / l) * Math.PI) ** 0.6);
    out.push([x + px * c - py * s, y + px * s + py * c]);
  }
  return out;
}

export function boundsOf(pts: Pt[]): Bounds {
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
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Smooth, low-frequency wobble so lines look drawn by hand rather than noisy. */
export function wobble(pts: Pt[], amp: number, seed: number): Pt[] {
  if (amp <= 0) return pts;
  const bb = boundsOf(pts);
  amp *= Math.min(1, Math.max(0.3, Math.max(bb.w, bb.h) / 26));
  const r = rng(seed);
  const p = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
  const n = pts.length;
  return pts.map(([x, y], i) => {
    const t = (i / n) * Math.PI * 2;
    return [
      x + amp * (Math.sin(t * 3 + p[0]) * 0.7 + Math.sin(t * 7 + p[1]) * 0.3),
      y + amp * (Math.sin(t * 3 + p[2]) * 0.7 + Math.sin(t * 5 + p[3]) * 0.3),
    ];
  });
}

export function trace(ctx: Ctx, pts: Pt[], closed = true) {
  const n = pts.length;
  ctx.beginPath();
  if (n < 3) {
    ctx.moveTo(...pts[0]);
    for (const p of pts.slice(1)) ctx.lineTo(...p);
    if (closed) ctx.closePath();
    return;
  }
  if (closed) {
    const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    ctx.moveTo(...mid(pts[n - 1], pts[0]));
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(...pts[0]);
    for (let i = 1; i < n - 1; i++) {
      const m: Pt = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    ctx.lineTo(...pts[n - 1]);
  }
}

/** Scale points away from their centroid. */
export function grow(pts: Pt[], d: number): Pt[] {
  const b = boundsOf(pts);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return pts.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const l = Math.hypot(dx, dy) || 1;
    return [x + (dx / l) * d, y + (dy / l) * d];
  });
}

// ───────────────────────────── fills ──

function grain(ctx: Ctx, b: Bounds, cols: string[], count: number, seed: number, len: number, width: number) {
  const r = rng(seed);
  ctx.lineCap = 'round';
  const area = (b.w * b.h) / 400;
  const n = Math.round(count * Math.min(6, Math.max(0.4, area)));
  for (let i = 0; i < n; i++) {
    const x = b.x + r() * b.w;
    const y = b.y + r() * b.h;
    const l = len * (0.5 + r());
    ctx.strokeStyle = cols[Math.floor(r() * cols.length)];
    ctx.lineWidth = width * (0.6 + r() * 0.8);
    ctx.beginPath();
    ctx.moveTo(x - l * 0.4, y + l);
    ctx.lineTo(x + l * 0.4, y - l);
    ctx.stroke();
  }
}

function speckle(ctx: Ctx, b: Bounds, col: string, count: number, seed: number, size: number) {
  const r = rng(seed);
  ctx.fillStyle = col;
  const n = Math.round(count * Math.max(0.4, (b.w * b.h) / 400));
  for (let i = 0; i < n; i++) ctx.fillRect(b.x + r() * b.w, b.y + r() * b.h, size, size);
}

function radial(ctx: Ctx, b: Bounds, light: Pt, f: Fill) {
  const g = ctx.createRadialGradient(light[0], light[1], 0, light[0], light[1], Math.max(b.w, b.h) * 1.1);
  g.addColorStop(0, f.light);
  g.addColorStop(0.45, f.base);
  g.addColorStop(1, f.shade);
  return g;
}

const withAlpha = (hex: string, a: number) =>
  hex.length === 7 ? hex + Math.round(a * 255).toString(16).padStart(2, '0') : hex;

// ───────────────────────────── styles ──

const storybook: Style = {
  id: 'storybook',
  name: 'Crayon storybook',
  blurb: 'Closest to the original drawings: graphite pencil lines, crayon-colored fills with paper peeking through.',
  ink: '#3b3436',
  lineWidth: 1.5,
  wobble: 0.55,
  paper: '#f6f0e3',
  shape(ctx, pts, f, seed, o = {}) {
    const p = wobble(pts, this.wobble, seed);
    const b = boundsOf(p);
    ctx.save();
    trace(ctx, p);
    ctx.fillStyle = f.base;
    ctx.fill();
    if (!o.plain) {
      ctx.clip();
      grain(ctx, b, [withAlpha(f.shade, 0.55), withAlpha(f.light, 0.6), withAlpha(f.base, 0.9)], 70, seed + 1, 3.2, 0.9);
      speckle(ctx, b, '#ffffff55', 14, seed + 2, 0.7);
      // a soft darker band along the bottom, like pressing harder with the crayon
      ctx.fillStyle = withAlpha(f.shade, 0.35);
      ctx.beginPath();
      ctx.ellipse(b.x + b.w * 0.55, b.y + b.h * 1.05, b.w * 0.7, b.h * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (!o.noLine) {
      const lw = this.lineWidth * (o.lw ?? 1);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.ink;
      ctx.lineWidth = lw;
      trace(ctx, p);
      ctx.stroke();
      // second, lighter pass slightly off: the "went over it twice" pencil look
      ctx.strokeStyle = withAlpha(this.ink, 0.35);
      ctx.lineWidth = lw * 0.55;
      trace(ctx, wobble(pts, this.wobble * 1.4, seed + 9));
      ctx.stroke();
    }
  },
  line(ctx, pts, seed, width = 1, color?: string) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color ?? this.ink;
    ctx.lineWidth = this.lineWidth * width;
    trace(ctx, wobble(pts, this.wobble * 0.6, seed), false);
    ctx.stroke();
  },
};

const polished: Style = {
  id: 'polished',
  name: 'Polished hand-drawn',
  blurb: 'Cleaner and rounder with soft shading and highlights, but the lines still wobble and a fine crayon grain stays in the color.',
  ink: '#3a2418',
  lineWidth: 2,
  wobble: 0.28,
  paper: null,
  shape(ctx, pts, f, seed, o = {}) {
    const p = wobble(pts, this.wobble, seed);
    const b = boundsOf(p);
    const light: Pt = o.light ?? [b.x + b.w * 0.32, b.y + b.h * 0.22];
    ctx.save();
    trace(ctx, p);
    ctx.fillStyle = o.plain ? f.base : radial(ctx, b, light, f);
    ctx.fill();
    if (!o.plain) {
      ctx.clip();
      // cel shadow crescent on the side away from the light
      ctx.fillStyle = withAlpha(f.shade, 0.55);
      trace(ctx, p.map(([x, y]) => [x + b.w * 0.16, y + b.h * 0.12] as Pt));
      ctx.rect(b.x - 50, b.y - 50, b.w + 100, b.h + 100);
      ctx.fill('evenodd');
      grain(ctx, b, [withAlpha(f.shade, 0.22), withAlpha(f.light, 0.3)], 60, seed + 1, 2.2, 0.5);
      // rim light on the shadow edge
      ctx.strokeStyle = withAlpha(f.light, 0.5);
      ctx.lineWidth = 1.2;
      trace(ctx, grow(p, -1.6).map(([x, y]) => [x + 0.6, y + 0.6] as Pt));
      ctx.setLineDash([0, b.w * 1.6, b.w * 1.2, 1000]);
      ctx.stroke();
      ctx.setLineDash([]);
      // glossy highlight (characters / props only; big scenery stays matte)
      ctx.fillStyle = b.w > 18 && b.w < 90 ? '#ffffffaa' : '#ffffff00';
      ctx.beginPath();
      ctx.ellipse(light[0], light[1], b.w * 0.12, b.h * 0.07, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (!o.noLine) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.ink;
      ctx.lineWidth = this.lineWidth * (o.lw ?? 1);
      trace(ctx, p);
      ctx.stroke();
    }
  },
  line(ctx, pts, seed, width = 1, color?: string) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color ?? this.ink;
    ctx.lineWidth = this.lineWidth * width;
    trace(ctx, wobble(pts, this.wobble * 0.5, seed), false);
    ctx.stroke();
  },
};

const watercolor: Style = {
  id: 'watercolor',
  name: 'Ink & watercolor',
  blurb: 'Loose ink lines that break and thicken, with watercolor washes that bleed a little past the lines.',
  ink: '#1f2430',
  lineWidth: 1.6,
  wobble: 0.6,
  paper: '#f7f3ea',
  shape(ctx, pts, f, seed, o = {}) {
    const r = rng(seed);
    ctx.save();
    // washes: several translucent, slightly offset blobs
    const layers = o.plain ? 1 : 3;
    for (let i = 0; i < layers; i++) {
      const wp = wobble(grow(pts, 0.6 + r() * 1.2), 1.1, seed + i * 13).map(([x, y]) => [x + (r() - 0.5) * 1.6, y + (r() - 0.5) * 1.6] as Pt);
      trace(ctx, wp);
      ctx.fillStyle = o.plain ? withAlpha(f.base, 0.9) : withAlpha(i === 0 ? f.light : f.base, i === 0 ? 0.8 : 0.5);
      ctx.fill();
    }
    if (!o.plain) {
      const p = wobble(pts, 0.8, seed + 3);
      const b = boundsOf(p);
      trace(ctx, p);
      ctx.clip();
      // pigment pooling at the lower edge
      ctx.fillStyle = withAlpha(f.shade, 0.4);
      trace(ctx, p.map(([x, y]) => [x + b.w * 0.12, y + b.h * 0.18] as Pt));
      ctx.rect(b.x - 50, b.y - 50, b.w + 100, b.h + 100);
      ctx.fill('evenodd');
      speckle(ctx, b, withAlpha(f.shade, 0.25), 18, seed + 4, 0.8);
    }
    ctx.restore();
    if (!o.noLine) brushInk(ctx, wobble(pts, this.wobble, seed + 7), seed, this.lineWidth * (o.lw ?? 1), this.ink);
  },
  line(ctx, pts, seed, width = 1, color?: string) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = color ?? this.ink;
    const p = wobble(pts, this.wobble * 0.5, seed);
    for (let i = 0; i < p.length - 1; i++) {
      ctx.lineWidth = this.lineWidth * width * (0.7 + 0.5 * Math.sin(i * 1.3 + seed));
      ctx.beginPath();
      ctx.moveTo(...p[i]);
      ctx.lineTo(...p[i + 1]);
      ctx.stroke();
    }
  },
};

/** Closed brush-ink outline whose width swells and thins, with the odd tiny gap. */
function brushInk(ctx: Ctx, p: Pt[], seed: number, width: number, color: string) {
  const r = rng(seed + 21);
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  const n = p.length;
  for (let i = 0; i < n; i++) {
    if (r() < 0.06) continue;
    const a = p[i];
    const b = p[(i + 1) % n];
    ctx.lineWidth = width * (0.55 + 0.75 * (0.5 + 0.5 * Math.sin((i / n) * Math.PI * 4 + seed)));
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
  }
}

const sticker: Style = {
  id: 'sticker',
  name: 'Bold sticker',
  blurb: 'Chunky outlines, flat bright color with one hard shadow and a shine. Very readable on small phone screens.',
  ink: '#22161c',
  lineWidth: 2.8,
  wobble: 0.15,
  paper: null,
  shape(ctx, pts, f, seed, o = {}) {
    const p = wobble(pts, this.wobble, seed);
    const b = boundsOf(p);
    ctx.save();
    trace(ctx, p);
    ctx.fillStyle = f.base;
    ctx.fill();
    if (!o.plain) {
      ctx.clip();
      ctx.fillStyle = f.shade;
      trace(ctx, p.map(([x, y]) => [x + b.w * 0.2, y + b.h * 0.14] as Pt));
      ctx.rect(b.x - 50, b.y - 50, b.w + 100, b.h + 100);
      ctx.fill('evenodd');
      ctx.fillStyle = b.w > 18 && b.w < 90 ? '#ffffffcc' : '#ffffff00';
      ctx.beginPath();
      ctx.ellipse(b.x + b.w * 0.3, b.y + b.h * 0.22, b.w * 0.1, b.h * 0.06, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (!o.noLine) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.ink;
      ctx.lineWidth = this.lineWidth * (o.lw ?? 1);
      trace(ctx, p);
      ctx.stroke();
    }
  },
  line(ctx, pts, seed, width = 1, color?: string) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color ?? this.ink;
    ctx.lineWidth = this.lineWidth * width;
    trace(ctx, wobble(pts, this.wobble, seed), false);
    ctx.stroke();
  },
};

export const STYLES: Record<StyleId, Style> = { storybook, polished, watercolor, sticker };

/** Paper grain for the storybook / watercolor looks. */
export function paperTexture(ctx: Ctx, w: number, h: number, seed = 5) {
  const r = rng(seed);
  for (let i = 0; i < (w * h) / 90; i++) {
    ctx.fillStyle = r() > 0.5 ? '#00000009' : '#ffffff22';
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, '#00000000');
  g.addColorStop(1, '#3b2a1018');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
