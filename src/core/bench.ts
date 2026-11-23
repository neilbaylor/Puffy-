/**
 * How quick this device is at the things the game spends its time on, as a few numbers:
 *
 * - CPU: a fixed batch of work like the game's own updates (moving a thousand things, checking
 *   them against platforms, lots of small objects made and thrown away). Milliseconds a batch.
 * - GPU fill: the graphics chip covering the whole screen, at the resolution the game draws at in
 *   full mode, with a see-through picture blended over what's there — what most of each frame is
 *   (the sky, the hills, the clouds, the ground, one over another). Milliseconds a screenful.
 * - Upload: a 1024 × 512 picture drawn on a canvas sent to the graphics chip, as each of the game's
 *   pictures is once it's drawn. Milliseconds a picture.
 * - Layer (the full run only): the start screen's three background layers drawn on canvases by the
 *   game's own drawing code, as loading and switching Parts do. Milliseconds for the three.
 *
 * Two runs, the same numbers: `quickBench` (about a second, in small steps that never hold the page
 * up for more than a frame or three, needing none of the game's art: it could run behind the loading
 * screen) and `fullBench` (longer, more of each, plus the layers), for the hidden ?bench page, which
 * shows both side by side to see whether the quick one tells the devices apart as well.
 *
 * Nothing here is used by the game itself yet: it's for choosing light mode automatically once the
 * owner's devices have been measured (see core/light).
 */

export interface BenchScores {
  kind: 'quick' | 'full';
  /** How long the run took in all (ms), waiting between steps included. */
  tookMs: number;
  /** CPU: a fixed batch of game-like update work (ms, median; see cpuRound and CPU_ROUNDS). */
  cpuMs: number | null;
  /** GPU fill: one screenful of blended picture at the game's full-mode resolution (ms; see fillPer). */
  fillMs: number | null;
  /** The size of that screenful (device pixels). */
  fillW: number;
  fillH: number;
  /** Upload: a 1024 × 512 picture sent to the graphics chip (ms, median). */
  uploadMs: number | null;
  /** Canvas 2D: the start screen's three background layers drawn (ms, median); null in the quick run. */
  layerMs: number | null;
  /** Setting up the graphics: making the WebGL canvas, its shaders and picture, and the first draw (ms). */
  setupMs: number | null;
  /** How many timings each median is of. */
  samples: { cpu: number; fill: number; upload: number; layer: number };
  /** How long each part of the run took, waiting between steps included (ms). */
  phaseMs: { setup: number; fill: number; upload: number; cpu: number; layer: number };
  /** The longest the run held the page up in one go (ms): what a loading screen would feel. */
  longestStepMs: number;
  /** Which step that was. */
  longestStepAt: string;
  /** Anything that couldn't be measured, and why. */
  notes: string[];
}

export interface FullBenchOptions {
  /** Told what's being measured, and how far along (0–1). */
  onProgress?: (what: string, done: number) => void;
  /** Draw the background layers once, finished (see the top of this file); left out: no layer timing. */
  layer?: () => void;
}

const now = () => performance.now();
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);

/**
 * Let the page draw a frame before the next step: just after the next frame (or within 50 ms where
 * no frames come, e.g. a background tab).
 */
const breathe = () =>
  new Promise<void>((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(() => setTimeout(go, 0));
    setTimeout(go, 50);
  });

/**
 * The size the game draws at in full mode (see main.ts): the window in device pixels, at most 2x
 * (1.75x on a big tablet screen).
 */
export function gameSize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const r = Math.min(window.devicePixelRatio || 1, Math.min(w, h) >= 700 ? 1.75 : 2);
  return { w: Math.max(1, Math.round(w * r)), h: Math.max(1, Math.round(h * r)), r };
}

// ───────────────────────────────────────────────────────────── CPU ──

/** (kept, so the work can't be skipped as unused) */
let cpuSink = 0;
/** (read, so it's kept: see cpuSink) */
export const benchSink = () => cpuSink;

/**
 * One round of game-like work: 100 things falling under gravity for 10 steps, each checked against
 * 24 platforms and pushed out of them, a new little object for each one each step, a few square
 * roots and angles, the fallen ones swapped for new ones. ~0.15 ms on a recent computer once the
 * browser has compiled it (its first few runs are ~20 times slower: see timeCpu).
 */
function cpuRound(seed: number) {
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  type Body = { x: number; y: number; vx: number; vy: number; w: number; h: number; ground: boolean };
  const make = (): Body => ({ x: rnd() * 2000, y: rnd() * 400, vx: (rnd() - 0.5) * 300, vy: 0, w: 12 + rnd() * 20, h: 12 + rnd() * 20, ground: false });
  let bodies: Body[] = Array.from({ length: 100 }, make);
  const plats = Array.from({ length: 24 }, (_, i) => ({ x: i * 90, y: 300 + rnd() * 200, w: 60 + rnd() * 80, h: 20 }));
  const dt = 1 / 60;
  let sum = 0;
  for (let step = 0; step < 10; step++) {
    for (const b of bodies) {
      b.vy += 1600 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ground = false;
      for (const p of plats) {
        if (b.x + b.w < p.x || b.x > p.x + p.w || b.y + b.h < p.y || b.y > p.y + p.h) continue;
        // (landed on it: back up out of it, and stop falling)
        b.y = p.y - b.h;
        b.vy = 0;
        b.ground = true;
      }
      const v = { x: Math.cos(b.x * 0.01), y: Math.sin(b.y * 0.01) };
      sum += Math.sqrt(v.x * v.x + v.y * v.y) + Math.atan2(b.vy, b.vx + 0.1);
    }
    if (step % 5 === 4) bodies = bodies.map((b) => (b.y > 900 ? make() : b));
  }
  return sum;
}

/** Rounds a CPU timing is given as: ~1.5 ms on a recent computer, a slow tablet ~10 times that. */
const CPU_ROUNDS = 10;
/** Each timing runs for at least this long (ms): some browsers' clocks only tick every millisecond. */
const MIN_TIMING = 8;

/**
 * One CPU timing: rounds until MIN_TIMING has passed, as ms per CPU_ROUNDS rounds. The browser
 * compiles the code properly only after its first few dozen runs, so the first few timings of a run
 * are thrown away (a frame between each: the first rounds are the slow ones).
 */
function timeCpu(seed: number) {
  const t = now();
  let n = 0;
  do cpuSink += cpuRound(seed + n++);
  while (now() - t < MIN_TIMING && n < 400);
  return ((now() - t) / n) * CPU_ROUNDS;
}

// ───────────────────────────────────────────────────── the graphics chip ──

/** Quads (each the whole screen) the fill test can draw in one go. */
const MAX_QUADS = 256;

interface FillRig {
  gl: WebGLRenderingContext;
  w: number;
  h: number;
  /** Clear, draw `n` screenfuls, and wait for the chip to finish (reading a pixel back). */
  fill(n: number): void;
  /** Send this canvas to the chip as a new picture, use it once (one pixel), wait for the chip, free it. */
  upload(c: HTMLCanvasElement): void;
  done(): void;
}

/** A see-through picture like the game's: soft blobs, gradients, some of it fully clear. */
function artCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(143,211,255,0)');
  g.addColorStop(1, 'rgba(111,209,75,0.8)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.4, w, h * 0.6);
  for (let i = 0; i < 40; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 8 + rnd() * Math.min(w, h) * 0.15;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `hsla(${Math.floor(rnd() * 360)},70%,70%,0.9)`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#3a2418';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  return c;
}

/**
 * A WebGL canvas the size the game draws at, set up as the game sets up its own (no smoothing of
 * edges, no depth or stencil: see main.ts), with a 256 × 256 see-through picture to cover it with.
 * Not on the page: the chip draws it all the same, and nothing flashes up. Null: no WebGL.
 */
function makeRig(w: number, h: number, notes: string[]): FillRig | null {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const attrs: WebGLContextAttributes = { alpha: false, depth: false, stencil: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl', attrs) as WebGLRenderingContext | null;
  } catch {
    /* no WebGL */
  }
  if (!gl || gl.isContextLost()) {
    notes.push('no WebGL');
    return null;
  }
  const shader = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec2 p;attribute vec2 uv;varying vec2 v;void main(){v=uv;gl_Position=vec4(p,0.0,1.0);}'));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, 'precision mediump float;uniform sampler2D t;varying vec2 v;void main(){gl_FragColor=texture2D(t,v);}'));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    notes.push('WebGL shaders failed');
    return null;
  }
  gl.useProgram(prog);
  // each quad covers the screen, its picture shifted a little from the last one's (and repeated
  // across it, each picture pixel about 2 screen pixels, as the game's scaled-up layers are)
  const su = w / 512;
  const sv = h / 512;
  const data = new Float32Array(MAX_QUADS * 6 * 4);
  for (let q = 0; q < MAX_QUADS; q++) {
    const o = (q * 0.37) % 1;
    const corners = [
      [-1, -1, o, o + sv],
      [1, -1, o + su, o + sv],
      [-1, 1, o, o],
      [-1, 1, o, o],
      [1, -1, o + su, o + sv],
      [1, 1, o + su, o],
    ];
    corners.forEach((c, k) => data.set(c, (q * 6 + k) * 4));
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const pLoc = gl.getAttribLocation(prog, 'p');
  const uvLoc = gl.getAttribLocation(prog, 'uv');
  gl.enableVertexAttribArray(pLoc);
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 16, 0);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
  // (premultiplied, as Phaser sends pictures, and blended the way it blends them)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const newTex = (src: HTMLCanvasElement, repeat: boolean) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    return tex;
  };
  const tex = newTex(artCanvas(256, 256), true);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.56, 0.83, 1, 1);
  const px = new Uint8Array(4);
  const finish = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return {
    gl,
    w,
    h,
    fill(n) {
      gl.viewport(0, 0, w, h);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, Math.min(n, MAX_QUADS) * 6);
      finish();
    },
    upload(c) {
      const t = newTex(c, false);
      // (used once, in one pixel: some browsers only really send it when it's first drawn)
      gl.viewport(0, 0, 1, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      finish();
      gl.deleteTexture(t);
    },
    done() {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/**
 * One fill timing: one screenful, then `n`. The difference is n − 1 screenfuls' worth, with the time
 * it takes to start drawing and to read the pixel back taken out; `many` / n is more than a
 * screenful's worth (those included), a safe guess for the next timing's size.
 */
function timeFill(rig: FillRig, n: number) {
  const t0 = now();
  rig.fill(1);
  const t1 = now();
  rig.fill(n);
  const t2 = now();
  return { one: t1 - t0, many: t2 - t1, n };
}

/**
 * A screenful's time from several fill timings: all their extra screenfuls' time together, over how
 * many there were (steadier than the middle one of each on its own, which is the difference of two
 * small times, and the chip's times jump about).
 */
function fillPer(ts: { one: number; many: number; n: number }[]) {
  let extra = 0;
  let screens = 0;
  for (const t of ts) {
    extra += t.many - t.one;
    screens += t.n - 1;
  }
  return screens ? Math.max(0, extra / screens) : null;
}

/** How many screenfuls make a timing of about `ms`, from a first guess at a screenful's time. */
const quadsFor = (ms: number, per: number) => Math.max(2, Math.min(MAX_QUADS, Math.round(ms / Math.max(per, 0.01))));

/**
 * One upload timing: pictures sent until MIN_TIMING has passed, as ms each. A pixel of the picture is
 * changed before each (so it's a new picture each time, as the game's are).
 */
function timeUpload(rig: FillRig, c: HTMLCanvasElement, i: number) {
  const ctx = c.getContext('2d');
  let n = 0;
  let spent = 0;
  do {
    if (ctx) {
      ctx.fillStyle = `rgb(${(i + n) % 256},${(i * 7) % 256},90)`;
      ctx.fillRect((i * 20 + n) % c.width, 0, 1, 1);
    }
    const t = now();
    rig.upload(c);
    spent += now() - t;
    n++;
  } while (spent < MIN_TIMING && n < 20);
  return spent / n;
}

// ─────────────────────────────────────────────────────────────── runs ──

interface Plan {
  kind: 'quick' | 'full';
  cpu: number;
  /** CPU timings thrown away first (see timeCpu). */
  cpuWarm: number;
  fill: number;
  /** About how long each fill timing should take (ms). */
  fillMs: number;
  upload: number;
  layer: number;
  /**
   * How long each part may go on starting new timings (ms; each gets at least one, however slow):
   * the quick run's limit, shared out.
   */
  budget: { fill: number; upload: number; cpu: number };
}

async function run(plan: Plan, opts: FullBenchOptions = {}): Promise<BenchScores> {
  const start = now();
  const notes: string[] = [];
  const total = plan.cpu + plan.cpuWarm + plan.fill + plan.upload + (opts.layer ? plan.layer : 0) + 4;
  let done = 0;
  // (each step's time, from the frame before it to the one after: the longest is what the page felt)
  let stepFrom = now();
  let longest = 0;
  let longestAt = '';
  let at = 'start';
  const tick = async (what: string) => {
    if (now() - stepFrom > longest) {
      longest = now() - stepFrom;
      longestAt = at;
    }
    at = what;
    opts.onProgress?.(what, Math.min(1, ++done / total));
    await breathe();
    stepFrom = now();
  };
  /** Whether a part that started at `from` may start another timing (it always gets its first). */
  const more = (from: number, budget: number, i: number) => i === 0 || now() - from < budget;
  const { w, h } = gameSize();
  const cpu: number[] = [];
  let fillMs: number | null = null;
  let fillN = 0;
  const upload: number[] = [];
  const phase = { setup: 0, fill: 0, upload: 0, cpu: 0, layer: 0 };

  // the graphics chip first (the CPU's numbers then aren't held up by its warming up)
  let from = now();
  const rig = makeRig(w, h, notes);
  phase.setup = now() - from;
  await tick('graphics: setting up');
  if (rig) {
    try {
      // (the first draw sets the chip up — the browser finishes its shaders then: timed as part of
      // setting up. Then one screenful on its own: with the time to start and finish drawing in it,
      // more than a screenful's worth, so a safe first guess)
      from = now();
      rig.fill(1);
      phase.setup += now() - from;
      await tick('graphics: fill');
      from = now();
      const t = now();
      rig.fill(1);
      let per = now() - t;
      // (how many screenfuls the next timing draws: about plan.fillMs' worth by the last one's
      // screenful-plus-a-bit, and never more than 4 times as many as the last)
      let n = 2;
      const next = (f?: { many: number; n: number }) => {
        if (f) per = f.many / f.n;
        return (n = Math.min(quadsFor(plan.fillMs, per), n * 4));
      };
      // (a first timing to warm up on, thrown away)
      let f = timeFill(rig, next());
      const fills: ReturnType<typeof timeFill>[] = [];
      for (let i = 0; i < plan.fill && more(from, plan.budget.fill, i); i++) {
        await tick('graphics: fill');
        f = timeFill(rig, next(f));
        fills.push(f);
      }
      fillMs = fillPer(fills);
      fillN = fills.length;
      phase.fill = now() - from;
      from = now();
      const pic = artCanvas(1024, 512);
      rig.upload(pic); // (warm-up)
      for (let i = 0; i < plan.upload && more(from, plan.budget.upload, i); i++) {
        await tick('graphics: upload');
        upload.push(timeUpload(rig, pic, i + 1));
      }
      phase.upload = now() - from;
      if (rig.gl.isContextLost()) notes.push('WebGL context lost during the run');
    } catch (e) {
      notes.push(`graphics: ${(e as Error).message}`);
    }
    rig.done();
  }
  from = now();
  // (warm-up: the browser compiles the code on its first runs)
  for (let i = 0; i < plan.cpuWarm; i++) {
    await tick('CPU');
    timeCpu(1000 + i);
  }
  for (let i = 0; i < plan.cpu && more(from, plan.budget.cpu, i); i++) {
    await tick('CPU');
    cpu.push(timeCpu(i + 2));
  }
  phase.cpu = now() - from;
  let layerMs: number | null = null;
  let layerSamples = 0;
  if (opts.layer) {
    from = now();
    const l = await timeLayers(opts.layer, plan.layer, () => tick('drawing the start screen layers'));
    phase.layer = now() - from;
    layerMs = l.ms;
    layerSamples = l.samples;
    notes.push(...l.notes);
  }
  if (now() - stepFrom > longest) {
    longest = now() - stepFrom;
    longestAt = at;
  }
  const r = (x: number) => Math.round(x);
  return {
    kind: plan.kind,
    tookMs: r(now() - start),
    cpuMs: round2(median(cpu)),
    fillMs: round2(fillMs),
    fillW: w,
    fillH: h,
    uploadMs: round2(median(upload)),
    layerMs,
    setupMs: rig ? round2(phase.setup) : null,
    samples: { cpu: cpu.length, fill: fillN, upload: upload.length, layer: layerSamples },
    phaseMs: { setup: r(phase.setup), fill: r(phase.fill), upload: r(phase.upload), cpu: r(phase.cpu), layer: r(phase.layer) },
    longestStepMs: r(longest),
    longestStepAt: longestAt,
    notes,
  };
}

/**
 * The layer timing on its own (`n` times after a warm-up, a frame between each): for the ?bench page,
 * which can only draw the layers once the game's code is in, after the rest of the full run.
 */
export async function timeLayers(draw: () => void, n: number, between: () => Promise<void> = breathe) {
  const times: number[] = [];
  const notes: string[] = [];
  try {
    await between();
    draw(); // (warm-up)
    for (let i = 0; i < n; i++) {
      await between();
      const t = now();
      draw();
      times.push(now() - t);
    }
  } catch (e) {
    notes.push(`layers: ${(e as Error).message}`);
  }
  return { ms: round2(median(times)), samples: times.length, notes };
}

/**
 * The quick run: about half a second, at most ~1.5 s (each part stops starting new timings after its
 * share of 1 s: see Plan's budget, plus the setting up and the CPU's warm-up), in steps of a frame each, none much over 25 ms (a fill timing is ~20 ms of the chip's work, an upload or CPU
 * timing ~8 ms; the first CPU rounds, before the browser has compiled them, ~3 ms each on a
 * computer, ~30 on a slow tablet). Needs nothing of the game's.
 */
export function quickBench(): Promise<BenchScores> {
  return run({ kind: 'quick', cpu: 5, cpuWarm: 4, fill: 4, fillMs: 20, upload: 3, layer: 0, budget: { fill: 450, upload: 200, cpu: 350 } });
}

/** The full run, for the ?bench page: ~5–15 s, more timings of each and bigger ones, plus the layers. */
export function fullBench(opts: FullBenchOptions = {}): Promise<BenchScores> {
  return run({ kind: 'full', cpu: 15, cpuWarm: 6, fill: 9, fillMs: 80, upload: 9, layer: 5, budget: { fill: 20000, upload: 20000, cpu: 20000 } }, opts);
}

