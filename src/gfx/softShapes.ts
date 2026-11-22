import Phaser from 'phaser';
import { addCanvas } from './textures';
import { LIGHT } from '../core/light';

/**
 * Shapes drawn while the game runs (ropes, nets, fishing lines, rings, bubbles, shadows…) with soft
 * edges of their own.
 *
 * Why: the screen is drawn without the graphics chip's edge smoothing (see makeGl in main.ts: it
 * keeps four copies of every pixel of the screen and works them all every frame). The game's
 * pictures don't need it — they're drawn into canvases with soft edges already — but a Phaser
 * Graphics shape is cut into hard-edged triangles, and without the smoothing its slanted and curved
 * edges show as little steps.
 *
 * How: the same calls as a Phaser Graphics (lineStyle, strokePoints, fillCircle…), kept until
 * clear() like a Graphics, but each time it's drawn the shapes are worked out on the screen, in
 * screen pixels, and handed to the graphics chip as pictures of one tiny texture: two rows of
 * pixels, see-through over solid. Stretched so that its blend from one row to the other spans
 * exactly one screen pixel at a shape's edge (and held solid beyond it), every edge fades out over
 * one pixel, as the smoothing did. A line is two such strips back to back along its middle; a filled
 * shape is solid inside with a one-pixel strip round its outline. The pieces meet exactly, so a
 * see-through shape is evenly see-through.
 *
 * Like a Graphics it works out every shape again each frame, and goes to the graphics chip in a
 * batch of its own. Measured on the wrestling ring's ropes (slow phone speed): about two thirds of
 * what the Graphics cost to work out, and the same for the graphics chip. (Drawn as plain triangles
 * fading at their corners, like a Graphics, they cost more to work out; drawn in with the other
 * pictures' batches, the chip was slower: see renderWebGL.)
 */

const KEY = 'soft-edge';
/** How the edge texture's blend is read: its two rows' middles are a quarter and three quarters down. */
const T_OUT = 0.25;
const T_IN = 0.75;

/**
 * The texture (3 × 2: an odd width keeps the graphics chip from repeating it, it must stop at its
 * edges). Made at start-up (BootScene), so it's never counted among a boss's own pictures and freed
 * with them; and here, in case.
 */
export function edgeTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(KEY)) return;
  const c = document.createElement('canvas');
  c.width = 3;
  c.height = 2;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 1, 3, 1);
  addCanvas(scene, KEY, c);
}

const Op = { Stroke: 1, Fill: 2, Under: 3 } as const;
type Op = (typeof Op)[keyof typeof Op];
// a record in the list: op, colour, alpha, width (Under: the base's y), flags, n, then n points (x, y)
const F_CLOSED = 1;
const F_CONVEX = 2;
const HEAD = 6;

/** Points round a whole circle for n steps (cached: the same few counts come up all the time). */
const unit = new Map<number, Float64Array>();
function circleTable(n: number) {
  let t = unit.get(n);
  if (!t) {
    t = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      t[i * 2] = Math.cos((i / n) * Math.PI * 2);
      t[i * 2 + 1] = Math.sin((i / n) * Math.PI * 2);
    }
    unit.set(n, t);
  }
  return t;
}

// scratch for the shapes on screen (grown as needed)
let sp = new Float64Array(512);
let nm = new Float64Array(512);
let inner = new Float64Array(512);
/** (the points' x in the world, for fillUnder) */
let wx = new Float64Array(256);
function room(n: number) {
  if (sp.length >= n * 2) return;
  const k = Math.max(n * 2, sp.length * 2);
  sp = new Float64Array(k);
  nm = new Float64Array(k);
  inner = new Float64Array(k);
  wx = new Float64Array(k / 2);
}

type Pt = { x: number; y: number };

export class SoftShapes extends Phaser.GameObjects.Image {
  private rec: number[] = [];
  private lw = 1;
  private lc = 0;
  private la = 1;
  private fc = 0;
  private fa = 1;
  /** The path being built (beginPath … strokePath/fillPath): its parts, each a list of points. */
  private parts: number[][] = [];
  private part: number[] | null = null;
  private partClosed: boolean[] = [];

  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    edgeTexture(scene);
    super(scene, x, y, KEY);
  }

  clear() {
    this.rec.length = 0;
    this.parts.length = 0;
    this.part = null;
    return this;
  }

  lineStyle(width: number, color: number, alpha = 1) {
    this.lw = width;
    this.lc = color;
    this.la = alpha;
    return this;
  }

  fillStyle(color: number, alpha = 1) {
    this.fc = color;
    this.fa = alpha;
    return this;
  }

  // ── records ──

  private open(op: Op, flags: number, n: number) {
    const r = this.rec;
    if (op === Op.Stroke) r.push(op, this.lc, this.la, this.lw, flags, n);
    else r.push(op, this.fc, this.fa, 0, flags, n);
    return r;
  }

  /**
   * How many steps round a whole circle of radius r (world) to take: enough that the straight bits
   * stay within a fifth of a screen pixel of the curve at the zoom it's seen at now.
   */
  private steps(r: number) {
    const s = this.scene.cameras.main.zoom * Math.max(Math.abs(this.scaleX), Math.abs(this.scaleY), 1);
    return Math.max(8, Math.min(160, Math.ceil(5 * Math.sqrt(Math.max(0.1, r * s)))));
  }

  private ellipseRec(op: Op, x: number, y: number, rx: number, ry: number) {
    const n = this.steps(Math.max(rx, ry));
    const t = circleTable(n);
    const r = this.open(op, F_CLOSED | F_CONVEX, n);
    for (let i = 0; i < n; i++) r.push(x + t[i * 2] * rx, y + t[i * 2 + 1] * ry);
    return this;
  }

  lineBetween(x0: number, y0: number, x1: number, y1: number) {
    this.open(Op.Stroke, 0, 2).push(x0, y0, x1, y1);
    return this;
  }

  strokePoints(pts: Pt[], closeShape = false) {
    const r = this.open(Op.Stroke, closeShape ? F_CLOSED : 0, pts.length);
    for (const p of pts) r.push(p.x, p.y);
    return this;
  }

  fillPoints(pts: Pt[]) {
    const r = this.open(Op.Fill, F_CLOSED, pts.length);
    for (const p of pts) r.push(p.x, p.y);
    return this;
  }

  /**
   * Fill from a wavy line (points left to right) straight down to y = baseY: a water surface, a
   * puddle's. Only the wavy edge is softened (the base and the ends usually meet something else, or
   * are off the screen); no cutting into triangles, it's a strip down from each stretch of the line.
   */
  fillUnder(pts: Pt[], baseY: number) {
    const r = this.rec;
    r.push(Op.Under, this.fc, this.fa, baseY, 0, pts.length);
    for (const p of pts) r.push(p.x, p.y);
    return this;
  }

  fillCircle(x: number, y: number, r: number) {
    return this.ellipseRec(Op.Fill, x, y, r, r);
  }

  strokeCircle(x: number, y: number, r: number) {
    return this.ellipseRec(Op.Stroke, x, y, r, r);
  }

  /** (width and height, as Graphics.fillEllipse) */
  fillEllipse(x: number, y: number, w: number, h: number) {
    return this.ellipseRec(Op.Fill, x, y, w / 2, h / 2);
  }

  strokeEllipse(x: number, y: number, w: number, h: number) {
    return this.ellipseRec(Op.Stroke, x, y, w / 2, h / 2);
  }

  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) {
    this.open(Op.Fill, F_CLOSED | F_CONVEX, 3).push(x0, y0, x1, y1, x2, y2);
    return this;
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.open(Op.Fill, F_CLOSED | F_CONVEX, 4).push(x, y, x + w, y, x + w, y + h, x, y + h);
    return this;
  }

  private roundRect(op: Op, x: number, y: number, w: number, h: number, radius: number) {
    const rr = Math.max(0, Math.min(radius, w / 2, h / 2));
    const q = Math.max(2, Math.ceil(this.steps(rr) / 4));
    const r = this.open(op, F_CLOSED | F_CONVEX, (q + 1) * 4);
    // corners clockwise from the top right
    const cs = [
      [x + w - rr, y + rr, -Math.PI / 2],
      [x + w - rr, y + h - rr, 0],
      [x + rr, y + h - rr, Math.PI / 2],
      [x + rr, y + rr, Math.PI],
    ];
    for (const [cx, cy, a0] of cs)
      for (let i = 0; i <= q; i++) {
        const a = a0 + (i / q) * (Math.PI / 2);
        r.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
    return this;
  }

  fillRoundedRect(x: number, y: number, w: number, h: number, radius = 20) {
    return this.roundRect(Op.Fill, x, y, w, h, radius);
  }

  strokeRoundedRect(x: number, y: number, w: number, h: number, radius = 20) {
    return this.roundRect(Op.Stroke, x, y, w, h, radius);
  }

  // ── paths ──

  beginPath() {
    this.parts.length = 0;
    this.partClosed.length = 0;
    this.part = null;
    return this;
  }

  moveTo(x: number, y: number) {
    this.part = [x, y];
    this.parts.push(this.part);
    this.partClosed.push(false);
    return this;
  }

  lineTo(x: number, y: number) {
    if (!this.part) return this.moveTo(x, y);
    this.part.push(x, y);
    return this;
  }

  /** (as Graphics.arc: from angle a0 to a1, clockwise unless `anticlockwise`) */
  arc(x: number, y: number, radius: number, a0: number, a1: number, anticlockwise = false) {
    let d = a1 - a0;
    const PI2 = Math.PI * 2;
    if (anticlockwise) {
      if (d < -PI2) d = -PI2;
      else if (d > 0) d = -PI2 + (d % PI2);
    } else if (d > PI2) d = PI2;
    else if (d < 0) d = PI2 + (d % PI2);
    const n = Math.max(2, Math.ceil((this.steps(radius) * Math.abs(d)) / PI2));
    for (let i = 0; i <= n; i++) {
      const a = a0 + (d * i) / n;
      this.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    return this;
  }

  closePath() {
    if (this.part) this.partClosed[this.partClosed.length - 1] = true;
    return this;
  }

  strokePath() {
    this.parts.forEach((p, i) => {
      if (p.length < 4) return;
      this.open(Op.Stroke, this.partClosed[i] ? F_CLOSED : 0, p.length / 2).push(...p);
    });
    return this;
  }

  fillPath() {
    for (const p of this.parts) if (p.length >= 6) this.open(Op.Fill, F_CLOSED, p.length / 2).push(...p);
    return this;
  }

  // ── drawing ──

  renderWebGL(_renderer: unknown, src: SoftShapes, ctx: { camera: Phaser.Cameras.Scene2D.Camera; useCanvas: boolean }, parentMatrix?: Phaser.GameObjects.Components.TransformMatrix) {
    const rec = src.rec;
    if (!rec.length) return;
    // (Phaser's own way of drawing a picture, from the inside: the batch handler pictures go to, and
    // the options it wants, as its picture-drawing node sets them up for this object)
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const nodes = src as any;
    const submitter = nodes.customRenderNodes.Submitter || nodes.defaultRenderNodes.Submitter;
    const batcher = nodes.customRenderNodes.BatchHandler || nodes.defaultRenderNodes.BatchHandler;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    ctx.camera.addToRenderList(src);
    const m = Phaser.GameObjects.GetCalcMatrix(src, ctx.camera, parentMatrix, !ctx.useCanvas).calc;
    submitter.setRenderOptions(src);
    const opts = submitter._renderOptions;
    const frame = src.frame;
    const tex = frame.source.glTexture;
    const v0 = frame.v0;
    const dv = frame.v1 - frame.v0;
    const u = (frame.u0 + frame.u1) / 2;
    const alpha = src.alphaTopLeft;
    const a = m.a, b = m.b, c = m.c, d = m.d, e = m.e, f = m.f;
    const scale = Math.sqrt(Math.abs(a * d - b * c));
    const getTint = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha;
    const vOut = v0 + dv * T_OUT;
    const vIn = v0 + dv * T_IN;

    // one piece: corners top-left, top-right (texture row vTop), bottom-left, bottom-right (vBot)
    let tint = 0;
    const quad = (tlx: number, tly: number, trx: number, try_: number, blx: number, bly: number, brx: number, bry: number, vTop: number, vBot: number) =>
      batcher.batch(ctx, tex, tlx, tly, blx, bly, trx, try_, brx, bry, u, vTop, 0, vBot - vTop, 0, tint, tint, tint, tint, opts);

    // (a batch of their own, as a Graphics has: in with other pictures, the graphics chip would have
    // one more texture to choose from for every one of them, and on a slow chip that costs more than
    // the batch does)
    batcher.run(ctx);
    for (let i = 0; i < rec.length; ) {
      const op = rec[i];
      const col = rec[i + 1];
      const al = rec[i + 2] * alpha;
      let w = rec[i + 3] * scale;
      const flags = rec[i + 4];
      const nIn = rec[i + 5];
      const p0 = i + HEAD;
      i = p0 + nIn * 2;
      if (al <= 0) continue;
      // the points on screen, leaving out any less than a quarter pixel from the last
      room(nIn + 1);
      let n = 0;
      for (let k = 0; k < nIn; k++) {
        const x = rec[p0 + k * 2];
        const y = rec[p0 + k * 2 + 1];
        const sx = a * x + c * y + e;
        const sy = b * x + d * y + f;
        if (n && Math.abs(sx - sp[n * 2 - 2]) + Math.abs(sy - sp[n * 2 - 1]) < 0.25) continue;
        sp[n * 2] = sx;
        sp[n * 2 + 1] = sy;
        wx[n] = x;
        n++;
      }
      if (op === Op.Under) {
        if (n < 2) continue;
        tint = getTint(col, Math.min(1, al));
        const base = rec[p0 - 3];
        // (the line's normals, turned to point away from the base: half a pixel out, the edge has
        // faded away; half a pixel in, solid from there down)
        miters(n, false, 1);
        const side = nm[0] * (sp[0] - (a * wx[0] + c * base + e)) + nm[1] * (sp[1] - (b * wx[0] + d * base + f)) < 0 ? -0.5 : 0.5;
        for (let k = 0; k < n * 2; k++) {
          inner[k] = sp[k] - nm[k] * side;
          sp[k] += nm[k] * side;
        }
        for (let k = 0; k + 1 < n; k++) {
          // (the base straight down from each point in the world, wherever that is on the screen)
          const lx = a * wx[k] + c * base + e;
          const ly = b * wx[k] + d * base + f;
          const rx = a * wx[k + 1] + c * base + e;
          const ry = b * wx[k + 1] + d * base + f;
          const i0 = k * 2;
          quad(inner[i0], inner[i0 + 1], inner[i0 + 2], inner[i0 + 3], lx, ly, rx, ry, vIn, vIn);
          quad(sp[i0], sp[i0 + 1], sp[i0 + 2], sp[i0 + 3], inner[i0], inner[i0 + 1], inner[i0 + 2], inner[i0 + 3], vOut, vIn);
        }
        continue;
      }
      const closed = (flags & F_CLOSED) !== 0;
      if (closed && n > 2 && Math.abs(sp[0] - sp[n * 2 - 2]) + Math.abs(sp[1] - sp[n * 2 - 1]) < 0.25) n--;
      if (op === Op.Stroke) {
        if (n < 2) continue;
        // (thinner than a pixel: a pixel wide, as faint as the line would be)
        let k = al;
        if (w < 1) {
          k *= w;
          w = 1;
        }
        tint = getTint(col, Math.min(1, k));
        const R = w / 2 + 0.5;
        const vMid = v0 + dv * (T_OUT + (T_IN - T_OUT) * R);
        miters(n, closed, 1);
        const segs = closed ? n : n - 1;
        for (let s = 0; s < segs; s++) {
          const j = s;
          const q = s + 1 === n ? 0 : s + 1;
          const x0 = sp[j * 2], y0 = sp[j * 2 + 1], x1 = sp[q * 2], y1 = sp[q * 2 + 1];
          const ox0 = nm[j * 2] * R, oy0 = nm[j * 2 + 1] * R, ox1 = nm[q * 2] * R, oy1 = nm[q * 2 + 1] * R;
          quad(x0 + ox0, y0 + oy0, x1 + ox1, y1 + oy1, x0, y0, x1, y1, vOut, vMid);
          quad(x0 - ox0, y0 - oy0, x1 - ox1, y1 - oy1, x0, y0, x1, y1, vOut, vMid);
        }
      } else {
        if (n < 3) continue;
        tint = getTint(col, Math.min(1, al));
        // outward: which way round the outline goes
        let area = 0;
        for (let k = 0; k < n; k++) {
          const q = k + 1 === n ? 0 : k + 1;
          area += sp[k * 2] * sp[q * 2 + 1] - sp[q * 2] * sp[k * 2 + 1];
        }
        if (!area) continue;
        miters(n, true, area > 0 ? -1 : 1);
        // half a pixel in: the solid part; half a pixel out: where the edge has faded away (in by
        // less for a shape only a pixel or two across: a dot, a far-off shadow — or it'd turn inside out)
        let perim = 0;
        for (let k = 0; k < n; k++) {
          const q = k + 1 === n ? 0 : k + 1;
          perim += Math.hypot(sp[q * 2] - sp[k * 2], sp[q * 2 + 1] - sp[k * 2 + 1]);
        }
        const inset = Math.min(0.5, Math.abs(area) / 2 / perim);
        for (let k = 0; k < n * 2; k++) inner[k] = sp[k] - nm[k] * inset;
        for (let k = 0; k < n * 2; k++) sp[k] += nm[k] * 0.5;
        if (flags & F_CONVEX) {
          // (a fan from the first corner, two triangles a piece)
          for (let k = 1; k + 1 < n; k += 2) {
            const q = k + 2 < n ? k + 2 : k + 1;
            quad(inner[0], inner[1], inner[q * 2], inner[q * 2 + 1], inner[k * 2], inner[k * 2 + 1], inner[(k + 1) * 2], inner[(k + 1) * 2 + 1], vIn, vIn);
          }
        } else {
          const flat: number[] = [];
          for (let k = 0; k < n * 2; k++) flat.push(inner[k]);
          const tri = Phaser.Geom.Polygon.Earcut(flat);
          for (let k = 0; k < tri.length; k += 3) {
            const A = tri[k] * 2, B = tri[k + 1] * 2, C = tri[k + 2] * 2;
            quad(inner[A], inner[A + 1], inner[C], inner[C + 1], inner[A], inner[A + 1], inner[B], inner[B + 1], vIn, vIn);
          }
        }
        for (let k = 0; k < n; k++) {
          const q = k + 1 === n ? 0 : k + 1;
          quad(sp[k * 2], sp[k * 2 + 1], sp[q * 2], sp[q * 2 + 1], inner[k * 2], inner[k * 2 + 1], inner[q * 2], inner[q * 2 + 1], vOut, vIn);
        }
      }
    }
    batcher.run(ctx);
  }

  renderCanvas(renderer: Phaser.Renderer.Canvas.CanvasRenderer, src: SoftShapes, camera: Phaser.Cameras.Scene2D.Camera, parentMatrix?: Phaser.GameObjects.Components.TransformMatrix) {
    // (no WebGL: the canvas smooths its own edges, so just the shapes)
    const rec = src.rec;
    const ctx = renderer.currentContext;
    if (!rec.length || !Phaser.Renderer.Canvas.SetTransform(renderer, ctx, src, camera, parentMatrix)) return;
    camera.addToRenderList(src);
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    for (let i = 0; i < rec.length; ) {
      const op = rec[i];
      const col = rec[i + 1];
      const css = `rgba(${(col >> 16) & 255},${(col >> 8) & 255},${col & 255},${rec[i + 2]})`;
      const n = rec[i + 5];
      const p0 = i + HEAD;
      ctx.beginPath();
      for (let k = 0; k < n; k++) ctx.lineTo(rec[p0 + k * 2], rec[p0 + k * 2 + 1]);
      if (op === Op.Under) {
        ctx.lineTo(rec[p0 + n * 2 - 2], rec[i + 3]);
        ctx.lineTo(rec[p0], rec[i + 3]);
      }
      if (op === Op.Under || rec[i + 4] & F_CLOSED) ctx.closePath();
      if (op === Op.Stroke) {
        ctx.lineWidth = rec[i + 3];
        ctx.strokeStyle = css;
        ctx.stroke();
      } else {
        ctx.fillStyle = css;
        ctx.fill();
      }
      i = p0 + n * 2;
    }
    ctx.restore();
  }
}

/**
 * Each corner's offset direction (into `nm`, for the n points in `sp`): the two sides' normals
 * averaged, lengthened so the sides keep their width round the bend (up to 4×, for sharp corners).
 * `side` turns them over (fills: so they point out of the shape).
 */
function miters(n: number, closed: boolean, side: number) {
  let px = 0;
  let py = 0;
  for (let j = 0; j < n; j++) {
    const hasPrev = closed || j > 0;
    const hasNext = closed || j < n - 1;
    let nx = 0;
    let ny = 0;
    if (hasNext) {
      const q = j + 1 === n ? 0 : j + 1;
      const dx = sp[q * 2] - sp[j * 2];
      const dy = sp[q * 2 + 1] - sp[j * 2 + 1];
      const l = Math.hypot(dx, dy) || 1;
      nx = (-dy / l) * side;
      ny = (dx / l) * side;
    }
    if (j === 0 && closed) {
      const dx = sp[0] - sp[(n - 1) * 2];
      const dy = sp[1] - sp[(n - 1) * 2 + 1];
      const l = Math.hypot(dx, dy) || 1;
      px = (-dy / l) * side;
      py = (dx / l) * side;
    }
    let mx: number;
    let my: number;
    if (!hasPrev) {
      mx = nx;
      my = ny;
    } else if (!hasNext) {
      mx = px;
      my = py;
    } else {
      const bx = px + nx;
      const by = py + ny;
      const bl = Math.hypot(bx, by);
      if (bl < 1e-6) {
        mx = nx;
        my = ny;
      } else {
        const k = 1 / Math.max(0.25, (bx * nx + by * ny) / bl);
        mx = (bx / bl) * k;
        my = (by / bl) * k;
      }
    }
    nm[j * 2] = mx;
    nm[j * 2 + 1] = my;
    px = nx;
    py = ny;
  }
}

/**
 * Light mode's stand-in: a plain Graphics (hard edges). Light mode drew without the screen-edge
 * smoothing before these shapes came, and measured there (slow tablet speed) the soft edges cost a
 * little more of the graphics chip's time in the ring and on the court (3–5%) than the plain shapes
 * — light mode is for speed, so it keeps them. The same calls, and fillUnder as the strips of
 * triangles the puddles had.
 */
class PlainShapes extends Phaser.GameObjects.Graphics {
  width = 0;
  height = 0;

  fillUnder(pts: Pt[], baseY: number) {
    for (let k = 0; k + 1 < pts.length; k++) {
      const p = pts[k];
      const q = pts[k + 1];
      this.fillTriangle(p.x, p.y, q.x, q.y, q.x, baseY);
      this.fillTriangle(p.x, p.y, q.x, baseY, p.x, baseY);
    }
    return this;
  }

  setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
    return this;
  }
}

/** A SoftShapes in the scene (in place of scene.add.graphics()): in light mode, a plain one. */
export function softShapes(scene: Phaser.Scene, x = 0, y = 0): SoftShapes {
  if (LIGHT) return scene.add.existing(new PlainShapes(scene, { x, y })) as unknown as SoftShapes;
  return scene.add.existing(new SoftShapes(scene, x, y));
}

/**
 * A filled ellipse (in place of scene.add.ellipse: w × h, centred on x, y), e.g. a shadow. Sized
 * like one, for the checks that skip things off the camera.
 */
export function softEllipse(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number, alpha = 1) {
  const s = softShapes(scene, x, y).fillStyle(color, alpha).fillEllipse(0, 0, w, h);
  s.setSize(w, h);
  return s;
}

/** A filled circle with an outline (in place of scene.add.circle(...).setStrokeStyle(...)). */
export function softCircle(scene: Phaser.Scene, x: number, y: number, r: number, color: number, alpha = 1, line?: { width: number; color: number; alpha?: number }) {
  const s = softShapes(scene, x, y).fillStyle(color, alpha).fillCircle(0, 0, r);
  if (line) s.lineStyle(line.width, line.color, line.alpha ?? 1).strokeCircle(0, 0, r);
  s.setSize(r * 2, r * 2);
  return s;
}
