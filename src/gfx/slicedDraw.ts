import type { Ctx } from './draw';

/**
 * A picture drawn over a few frames instead of one, for the start screen's quiet jobs.
 *
 * The browser doesn't paint a canvas's pixels as each line or fill is drawn: it writes them down and
 * paints them all at once — at the end of the frame, or when the picture is first sent to the
 * graphics chip. So a background layer drawn in one job was one long frame however the job was cut
 * up: on the start screen, while the other Parts get ready, a dozen and more frames of 150–550 ms
 * at 4× slow CPU (a hill or a ground layer each).
 *
 * Here the drawing code runs once against a stand-in that only notes down each call (none of the
 * painting), and the calls are then made on the real canvas a slice at a time, one slice a frame:
 * the browser paints a slice's worth each frame. The same calls in the same order on the same
 * canvas: the same picture, to the pixel.
 *
 * Only for drawing code that never reads anything back from the canvas (a setting, a measurement,
 * its pixels) and draws no other canvas onto it: the stand-in can't answer those, and stops — then
 * the picture is simply drawn straight away, as before (see record).
 */
export class SlicedDraw {
  /** Where the next call starts, in `ops`. */
  private at = 0;
  private constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly ctx: Ctx,
    /** The calls, one after another: which (see NAMES), how many arguments (-1: a setting), the arguments. */
    private readonly ops: unknown[],
    /** How many calls. */
    readonly size: number,
  ) {}

  /**
   * Run `draw` against a stand-in for `ctx` (a context of `c`, already set up — moved, scaled — as the
   * drawing expects). Null if the drawing couldn't be noted down: it's then been drawn on `c` for real.
   */
  static record(c: HTMLCanvasElement, ctx: Ctx, draw: (ctx: Ctx) => void): SlicedDraw | null {
    const rec = new Recorder(ctx);
    try {
      draw(rec as unknown as Ctx);
      return new SlicedDraw(c, ctx, rec.ops, rec.n);
    } catch {
      // (drawn the ordinary way: the stand-in hasn't touched the canvas. A real fault in the
      // drawing shows up here again, as it always did)
      draw(ctx);
      return null;
    }
  }

  /** Make the next `n` calls (all that are left, by default) on the real canvas. */
  play(n = Infinity) {
    const ctx = this.ctx as unknown as Record<string, unknown>;
    const ops = this.ops;
    let i = this.at;
    for (let k = 0; k < n && i < ops.length; k++) {
      const name = NAMES[ops[i] as number];
      const argc = ops[i + 1] as number;
      if (argc < 0) {
        ctx[name] = ops[i + 2];
        i += 3;
      } else {
        const f = ctx[name] as (...a: unknown[]) => void;
        const a = i + 2;
        // (most calls have a few numbers: called as they are, not via a list made for each)
        if (argc === 0) f.call(ctx);
        else if (argc === 1) f.call(ctx, ops[a]);
        else if (argc === 2) f.call(ctx, ops[a], ops[a + 1]);
        else if (argc === 3) f.call(ctx, ops[a], ops[a + 1], ops[a + 2]);
        else if (argc === 4) f.call(ctx, ops[a], ops[a + 1], ops[a + 2], ops[a + 3]);
        else if (argc === 5) f.call(ctx, ops[a], ops[a + 1], ops[a + 2], ops[a + 3], ops[a + 4]);
        else if (argc === 6) f.call(ctx, ops[a], ops[a + 1], ops[a + 2], ops[a + 3], ops[a + 4], ops[a + 5]);
        else f.apply(ctx, ops.slice(a, a + argc));
        i = a + argc;
      }
    }
    this.at = i;
  }
}

/** The context's calls and settings, by number (see Recorder). */
const NAMES: string[] = [];

/** Calls that answer with something read from the canvas, or draw another canvas: not noted down. */
const READS = new Set(['getImageData', 'putImageData', 'measureText', 'getTransform', 'getLineDash', 'isPointInPath', 'isPointInStroke', 'getContextAttributes', 'drawImage', 'createImageData', 'isContextLost', 'drawFocusIfNeeded']);

class Unrecordable extends Error {}

/**
 * The stand-in: every call and setting of a 2D context, noted down. Gradients and patterns are made
 * on the real context straight away (they're things of their own, and their colour stops go on as
 * the drawing code adds them); anything read back stops it (Unrecordable).
 */
class Recorder {
  ops: unknown[] = [];
  n = 0;
  constructor(readonly real: Ctx) {}
  get canvas() {
    return this.real.canvas;
  }
}
{
  const P = CanvasRenderingContext2D.prototype as unknown as Record<string, unknown>;
  const R = Recorder.prototype as unknown as Record<string, unknown>;
  for (const name of Object.getOwnPropertyNames(P)) {
    if (name === 'constructor' || name === 'canvas') continue;
    const d = Object.getOwnPropertyDescriptor(P, name)!;
    if (typeof d.value === 'function') {
      if (READS.has(name)) {
        R[name] = () => {
          throw new Unrecordable();
        };
      } else if (name.startsWith('create')) {
        R[name] = function (this: Recorder, ...a: unknown[]) {
          return (d.value as (...a: unknown[]) => unknown).apply(this.real, a);
        };
      } else {
        const id = NAMES.push(name) - 1;
        // (a line dash is copied, as the context itself would: the drawing code may change its list after)
        const copy = name === 'setLineDash';
        R[name] = function (this: Recorder) {
          const ops = this.ops;
          const argc = arguments.length;
          ops.push(id, argc);
          for (let i = 0; i < argc; i++) {
            const v: unknown = arguments[i];
            ops.push(copy && Array.isArray(v) ? [...v] : v);
          }
          this.n++;
        };
      }
    } else if (d.set) {
      const id = NAMES.push(name) - 1;
      Object.defineProperty(R, name, {
        set(this: Recorder, v: unknown) {
          this.ops.push(id, -1, v);
          this.n++;
        },
        get() {
          throw new Unrecordable();
        },
      });
    }
  }
}
