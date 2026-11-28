import Phaser from 'phaser';
import { DEPTH } from '../config';
import { BG_LAYERS, LAYER_PIECES, bgKey, bgPieces, bgRes, bgSolid, ensureLook, skyColours } from '../gfx/textures';
import { rng } from '../gfx/draw';
import { liveCanvas } from '../gfx/liveCanvas';
import { LIGHT } from '../core/light';
import { PALETTES } from '../gfx/world';
import { hex, lerpRgb, mixSea, type ThemeId, type ThemeMix } from './theme';

export interface View {
  left: number;
  top: number;
  width: number;
  height: number;
}

type LayerId = 'far' | 'clouds' | 'hills' | 'near';

/** Width of the repeating cloud band (matches the other background layers). */
const CLOUD_W = 1024;

interface Cloud {
  x: number;
  y: number;
  s: number;
  /** Each cloud drifts at its own pace on top of the layer's slow drift. */
  drift: number;
  bob: number;
  lumps: { x: number; y: number; r: number; ph: number; w: number }[];
  /** Its picture (redrawn a few times a second as it changes shape), and the copies of it on screen. */
  tex: Phaser.Textures.CanvasTexture;
  imgs: Phaser.GameObjects.Image[];
  next: number;
}

/** A cloud's picture: this box (in cloud units, × its size) and resolution; how often it's redrawn (s). */
const CB = { x0: -92, y0: -62, w: 184, h: 80 };
const CLOUD_RES = LIGHT ? 1 : 1.125;
// (every 1.5 s, was 0.45 s: each new picture is drawn and sent to the graphics chip, ~20 a second
// across the sky before; and they change shape that much slower, so each step is as small as ever)
const CLOUD_EVERY = 1.5;
/**
 * A sky's clock at its first update (s), when it draws its clouds' first shapes: the frame a level's
 * set up in always takes longer than the 1/30 s an update's step is capped at (see GameScene.update).
 */
const FIRST_STEP = 1 / 30;
/** How fast the clouds change shape (1 = as they first did). */
const MORPH_RATE = 0.45 / CLOUD_EVERY;
/** A cloud's outline is worked out at this many angles round it (the sines and cosines once, here). */
const SIL_N = 60;
const SIL = new Float32Array(SIL_N * 2);
const SIL_COS = Float32Array.from({ length: SIL_N }, (_, k) => Math.cos((k / SIL_N) * Math.PI * 2));
const SIL_SIN = Float32Array.from({ length: SIL_N }, (_, k) => Math.sin((k / SIL_N) * Math.PI * 2));

/**
 * Only the part of a cloud's picture it's drawn in is shown: the picture is a box big enough for
 * any shape the cloud takes, and the cloud fills a third of it or so; the rest is see-through,
 * yet every pixel of it was blended onto the sky (clouds made up half a screen of pixels or more
 * in a level, the most of any one kind). The box is kept with the picture, as clouds' pictures
 * are shared by the scenes that show the same sky: whichever drew it last says what's in it.
 */
type CloudTex = Phaser.Textures.CanvasTexture & { box?: { x: number; y: number; w: number; h: number }; drawn?: string };
/** The clouds' colours (see Background.setTheme). */
type CloudCol = { fill: number; shade: number; ink: number };
/** What a cloud's picture was last drawn as: its shape's time and its colours (see Background.paintCloud). */
const drawnAs = (c: CloudCol, at: number) => `${at}|${c.fill},${c.shade},${c.ink}`;
type CroppedCopy = Phaser.GameObjects.Image & { box?: CloudTex['box'] };

/** Note round what was just drawn in a cloud's picture: its outline (as drawn, and lifted for the lit top), plus the ink line and a pixel or two. */
function setCloudCrop(c: Cloud, pts: Float32Array) {
  const k = CLOUD_RES;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < SIL_N; i++) {
    const x = pts[i * 2];
    const y = pts[i * 2 + 1];
    // (the outline, and the lit top: 0.93 × 0.9 of it, lifted 3 — it can poke out above a flat-topped cloud)
    const yl = y * 0.9 - 3 * c.s;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y, yl);
    y1 = Math.max(y1, y, yl);
  }
  // (the soft highlights sit inside the puffs, and so inside the outline)
  const pad = 3;
  const tex = c.tex as CloudTex;
  const bx = Math.max(0, Math.floor((x0 - CB.x0 * c.s) * k) - pad);
  const by = Math.max(0, Math.floor((y0 - CB.y0 * c.s) * k) - pad);
  const bw = Math.min(tex.width, Math.ceil((x1 - CB.x0 * c.s) * k) + pad) - bx;
  const bh = Math.min(tex.height, Math.ceil((y1 - CB.y0 * c.s) * k) + pad) - by;
  tex.box = { x: bx, y: by, w: Math.max(1, bw), h: Math.max(1, bh) };
}

/** The clouds' clock (see Background.cloudClock). */
export interface CloudClock {
  t: number;
  scroll: number;
  next: number[][];
}

/** A band of living clouds at one parallax depth. */
interface CloudBand {
  clouds: Cloud[];
  depth: number;
  fx: number;
  fy: number;
  anchor: number;
  width: number;
  alpha: number;
}

interface Seed {
  x: number;
  y: number;
  vx: number;
  ph: number;
  img: Phaser.GameObjects.Image;
}

/**
 * One picture of a layer's row, shown as the pieces it's cut into (see bgPieces): LAYER_PIECES images
 * made together, each cropped to its piece; the ones a picture doesn't need are hidden.
 */
interface Tile {
  imgs: Phaser.GameObjects.Image[];
  /** How many of `imgs` are in use. */
  n: number;
  /** Each piece in use: its box in the picture (x, w; from row `top`, `h` rows), and how many of those rows it's showing now (see hideUnder). */
  boxes: { x: number; w: number; top: number; h: number; shown: number }[];
}

/**
 * Where a level's ground hides whatever's drawn behind it (see LevelView.cover): `at(x0, x1)`, the
 * height (world px) from which it's solid all the way down, all across x0…x1 (Infinity: not all across);
 * `on()`, whether that holds as far down as the camera shows this frame (nothing's cut if not).
 */
export interface GroundCover {
  at: (x0: number, x1: number) => number;
  on: () => boolean;
  /**
   * Where the ground's solid all across x0…x1 higher up too (a floating island, a ledge, the rock
   * between the trenches): its solid stretches there, as top, bottom pairs (world px) into `out`
   * (cleared first). Optional.
   */
  runs?: (x0: number, x1: number, out: number[]) => void;
}

interface Layer {
  id: LayerId;
  /**
   * The current look, and the next look fading in on top of it: each a row of
   * plain images side by side (all sharing one GPU texture). Not TileSprites:
   * those keep their own big canvas copy of the picture, and re-make a canvas
   * whenever their width changes (every frame of a zooming fly-over), which is
   * what was running iPhones out of memory.
   */
  a: Tile[];
  b: Tile[];
  keyA: string;
  keyB: string;
  depth: number;
  /** Width of one picture in world px (they repeat side by side). */
  w: number;
  /** Where the row sits this frame (top edge, world px). */
  y: number;
  /** Horizontal parallax factor: 0 = fixed to screen, 1 = moves with the world. */
  fx: number;
  /** Vertical parallax factor. */
  fy: number;
  /** Where the layer's top sits on screen (fraction of view height) when the camera is at its lowest. */
  anchor: number;
  /** Ambient horizontal drift, world px/s (clouds). */
  drift: number;
  offset: number;
  h: number;
  /** This frame: its row's first picture's left edge, how many pictures it has, and whether it's in view (see update). */
  x0: number;
  n: number;
  rowOn: boolean;
}

/**
 * Hand-drawn parallax background for Puff Ball Planet: sky, far floating
 * islands, puffy clouds, rolling hills, and a sea of clouds far below. Layers are TileSprites
 * re-positioned every frame to cover the camera view at any zoom.
 *
 * Every layer exists twice: the current look and the next one, laid on top
 * and faded in, so the scenery drifts organically from one look to the next.
 */
export class Background {
  private skyA: Phaser.GameObjects.Image;
  private skyB: Phaser.GameObjects.Image;
  private layers: Layer[] = [];
  private fill: Phaser.GameObjects.Rectangle;
  private themeA: ThemeId = 'puff';
  private themeB: ThemeId = 'puff';
  // living clouds: redrawn every frame from slowly breathing puffs
  private bands: CloudBand[] = [];
  private seeds: Seed[] = [];
  private cloudCol: CloudCol = { fill: 0xffffff, shade: 0xe3dcf7, ink: 0x9486c8 };
  private t = 0;
  private cloudScroll = 0;
  private showB = false;
  private wB = 0;

  constructor(
    private scene: Phaser.Scene,
    private lowestViewTop: number,
    /** Still clouds (drawn once, then they only drift): the start screen. */
    private stillClouds = false,
    /** A climb (Plop Invasion · Part 2): clouds stream past as you go up, the sky smoggier higher up. */
    private vertical = false,
    /** Under the sea: no clouds; little bubbles drift up instead of puff seeds. */
    private sea = false,
    /** The start screen's copy of another Part's sky (lower resolution, keys a level never uses: see bgKey). */
    private home = false,
  ) {
    this.res = bgRes(home);
    this.skyA = scene.add.image(0, 0, bgKey('sky', 'puff', home)).setOrigin(0, 0).setDepth(DEPTH.sky);
    this.skyB = scene.add.image(0, 0, bgKey('sky', 'puff', home)).setOrigin(0, 0).setDepth(DEPTH.sky).setVisible(false);
    // (with WebGL, the sky's drawn as shaded bands instead: see drawSkyBands)
    if (scene.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      this.skyBands = scene.add.graphics().setDepth(DEPTH.sky);
      this.skyA.setVisible(false);
    }
    this.add('far', BG_LAYERS.far.h, 0.08, 0.04, 0.3, 0, DEPTH.far);
    // two bands of living clouds: small far ones up high, big slow ones lower down
    if (!sea) this.bands = Background.cloudBands(scene.textures, vertical);
    // dandelion-puff seeds drifting across on the breeze
    const r = rng(77);
    for (let i = 0; i < 14; i++) {
      const img = sea
        ? scene.add.image(0, 0, 'sea-bubble').setDepth(i % 2 ? DEPTH.near + 1 : DEPTH.hills + 1).setScale(0.25 + r() * 0.3).setAlpha(0.7)
        : scene.add.image(0, 0, 'puff').setDepth(DEPTH.near + 1).setScale(0.1 + r() * 0.12).setAlpha(0.85);
      this.seeds.push({ x: r(), y: 0.15 + r() * 0.6, vx: 16 + r() * 26, ph: r() * 6.28, img });
    }
    this.add('hills', BG_LAYERS.hills.h, 0.32, 0.16, 0.42, 0, DEPTH.hills);
    this.add('near', BG_LAYERS.near.h, 0.58, 0.32, 0.68, 0, DEPTH.near);
    this.fill = scene.add.rectangle(0, 0, 10, 10, 0xffffff).setOrigin(0, 0).setDepth(DEPTH.near);
    this.setTheme({ a: 'puff', b: 'puff', w: 0 });
  }

  /**
   * The sky as a few rectangles shaded from colour to colour (one per step of its gradient), not
   * its picture stretched over the screen. The picture is that same gradient, so it looks the same
   * (to a shade of 1/255 here and there), but filling the screen from colours at the corners is
   * much less work for the graphics chip than reading a picture for every pixel: the sky alone was
   * a fifth of a level's drawing time on the test browser's software graphics chip. And a change
   * of look (one sky fading into the next) is worked out here as one sky, not drawn as two.
   * Null without WebGL (the canvas renderer can't shade like this): the pictures are drawn then.
   */
  private skyBands: Phaser.GameObjects.Graphics | null = null;
  /** (the steps of the sky being drawn, kept from frame to frame) */
  private skyTs: number[] = [];

  private drawSkyBands(g: Phaser.GameObjects.Graphics, view: View, tint: number) {
    const ca = skyColours(this.themeA);
    const cb = this.showB ? skyColours(this.themeB) : undefined;
    g.clear();
    if (!ca) return;
    const rgb = (c: string) => {
      const n = hex(c);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    // the colour of a gradient at t (0 top … 1 bottom): straight lines between its colours, as drawSky's
    const at = (cols: readonly string[], t: number) => {
      const f = t * (cols.length - 1);
      const i = Math.min(cols.length - 2, Math.floor(f));
      const u = f - i;
      const p = rgb(cols[i]);
      const q = rgb(cols[i + 1]);
      return [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u];
    };
    // (the steps of both skies, so each band is a straight line in both)
    const ts = this.skyTs;
    ts.length = 0;
    for (let i = 0; i < ca.length; i++) ts.push(i / (ca.length - 1));
    if (cb) for (let i = 1; i < cb.length - 1; i++) ts.push(i / (cb.length - 1));
    ts.sort((x, y) => x - y);
    const tr = (tint >> 16) & 255;
    const tg = (tint >> 8) & 255;
    const tb = tint & 255;
    const w = cb ? this.wB : 0;
    // (the first sky as tinted — as the picture was — and the next one faded in over it by w)
    const colour = (t: number) => {
      const a = at(ca, t);
      const b = cb ? at(cb, t) : a;
      const mix = (x: number, k: number, y: number) => Math.round(Math.round((x * k) / 255) * (1 - w) + y * w);
      return (mix(a[0], tr, b[0]) << 16) | (mix(a[1], tg, b[1]) << 8) | mix(a[2], tb, b[2]);
    };
    // (the same box the picture covered: the view and 2 px round it)
    const x = view.left - 2;
    const y = view.top - 2;
    const W = view.width + 4;
    const H = view.height + 4;
    // (the stretches across it where what's in front is solid from some height down: see coverLayers)
    const runs = this.skyRuns(x, x + W);
    let c0 = colour(0);
    for (let i = 1; i < ts.length; i++) {
      if (ts[i] <= ts[i - 1]) continue;
      const c1 = colour(ts[i]);
      const y0 = y + ts[i - 1] * H;
      const y1 = y + ts[i] * H;
      if (!runs || y1 <= runs.low) {
        g.fillGradientStyle(c0, c0, c1, c1, 1);
        g.fillRect(x, y0, W, y1 - y0);
      } else
        for (let r = 0; r < runs.n; r++) {
          // (down to where it's hidden, shaded to the colour there: the same shading, cut short)
          const xa = runs.x[r];
          const xb = runs.x[r + 1];
          const yb = Math.min(y1, runs.cut[r]);
          if (yb <= y0) continue;
          const cb = yb < y1 ? colour((yb - y) / H) : c1;
          g.fillGradientStyle(c0, c0, cb, cb, 1);
          g.fillRect(xa, y0, xb - xa, yb - y0);
        }
      c0 = c1;
    }
  }

  /** The resolution its layers' pictures are drawn at. */
  private readonly res: number;

  private add(id: LayerId, h: number, fx: number, fy: number, anchor: number, drift: number, depth: number) {
    const key = bgKey(id, 'puff', this.home);
    this.layers.push({ id, a: [], b: [], keyA: key, keyB: key, depth, w: BG_LAYERS[id].w, y: 0, fx, fy, anchor, drift, offset: 0, h: h + 4 / this.res, x0: 0, n: 0, rowOn: false });
  }

  /** Make sure a row has `n` pictures (they're only ever added: a handful at most). */
  private row(tiles: Tile[], key: string, n: number, depth: number) {
    while (tiles.length < n) {
      // (all of a picture's pieces made at once, in the order the whole pictures were: what's drawn
      // over what stays the same)
      const imgs: Phaser.GameObjects.Image[] = [];
      for (let k = 0; k < LAYER_PIECES; k++) imgs.push(this.scene.add.image(0, 0, key).setOrigin(0, 0).setScale(1 / this.res).setDepth(depth));
      const tile: Tile = { imgs, n: 0, boxes: [] };
      this.cut(tile, key);
      tiles.push(tile);
    }
    return tiles;
  }

  /** Show `key` in a row's picture: its pieces cropped to their boxes (or the whole picture in one). */
  private cut(tile: Tile, key: string) {
    const pieces = this.pieces ? bgPieces(key) : undefined;
    if (!pieces) {
      const img = tile.imgs[0].setTexture(key).setCrop();
      tile.n = 1;
      tile.boxes = [{ x: 0, w: img.frame.width, top: 0, h: img.frame.height, shown: img.frame.height }];
    } else {
      tile.n = pieces.length;
      tile.boxes = pieces.map((p, i) => {
        const img = tile.imgs[i].setTexture(key);
        const h = img.frame.height - p.top;
        img.setCrop(p.x, p.top, p.w, h);
        return { x: p.x, w: p.w, top: p.top, h, shown: h };
      });
    }
    for (let i = tile.n; i < tile.imgs.length; i++) tile.imgs[i].setVisible(false);
  }

  /**
   * The level's ground in front (see GroundCover): what of the far scenery, hills and cloud sea it
   * hides isn't drawn. Each of their pieces stops where the ground in front of it is solid all the way
   * down (and goes altogether if that's above its top): it was drawn there every frame, only to be
   * painted over by the ground — a level's camera sits low over the ground, which fills the bottom
   * quarter of the screen or so, and the three layers run down behind it. The graphics chip blends
   * every pixel of every picture, so on a slow one the drawing time goes with the pixels drawn. What's
   * on screen stays the same: only pixels the ground paints over are left out.
   */
  hideUnder(cover: GroundCover | null) {
    this.cover = cover;
  }
  private cover: GroundCover | null = null;

  /** Show a piece of a layer's picture (see hideUnder): `ground` is the ground's cover where it is (null: none). */
  private showPiece(img: Phaser.GameObjects.Image, b: Tile['boxes'][number], x: number, y: number, ground: { x0: number; x1: number } | null, front: Float64Array | null) {
    let h = b.h;
    let at = Infinity;
    if (ground) at = this.cover!.at(Math.max(x + b.x / this.res, ground.x0), Math.min(x + (b.x + b.w) / this.res, ground.x1));
    if (front) at = Math.min(at, this.hiddenFrom(front, x + b.x / this.res, x + (b.x + b.w) / this.res));
    // (the rows above that height; a piece wholly under it isn't drawn)
    if (at < Infinity) h = Math.min(h, Math.ceil((at - y) * this.res) - b.top);
    if (h <= 0) {
      img.setVisible(false);
      return;
    }
    if (h !== b.shown) {
      b.shown = h;
      img.setCrop(b.x, b.top, b.w, h);
    }
  }

  /** Pieces (see Tile): with WebGL only (the canvas renderer draws only what's in a picture anyway). */
  private get pieces() {
    return this.scene.game.renderer.type === Phaser.WEBGL;
  }

  /** It has clouds (not under the sea). */
  get hasClouds() {
    return this.bands.length > 0;
  }

  /** The look setTheme last showed. */
  private lastMix: ThemeMix | null = null;

  /** Show look `a`, with look `b` faded in on top by `w`. */
  setTheme(m: ThemeMix) {
    // (the same as last time — most frames: a look holds for a while between fades, and light mode
    // has only the one — there's nothing to do: update shows the second look's pictures as they are)
    const last = this.lastMix;
    if (last && last.a === m.a && last.b === m.b && last.w === m.w) return;
    this.lastMix = { a: m.a, b: m.b, w: m.w };
    if (m.a !== this.themeA) ensureLook(this.scene, m.a, this.home);
    if (m.b !== this.themeB && m.w > 0.001) ensureLook(this.scene, m.b, this.home);
    if (m.a !== this.themeA) {
      this.themeA = m.a;
      this.skyA.setTexture(bgKey('sky', m.a, this.home));
      for (const l of this.layers) {
        l.keyA = bgKey(l.id, m.a, this.home);
        for (const t of l.a) this.cut(t, l.keyA);
      }
    }
    const showB = m.w > 0.001 && m.b !== m.a;
    if (showB && m.b !== this.themeB) {
      this.themeB = m.b;
      this.skyB.setTexture(bgKey('sky', m.b, this.home));
      for (const l of this.layers) {
        l.keyB = bgKey(l.id, m.b, this.home);
        for (const t of l.b) this.cut(t, l.keyB);
      }
    }
    this.skyB.setVisible(showB && !this.skyBands).setAlpha(m.w);
    this.showB = showB;
    this.wB = m.w;
    for (const l of this.layers) for (const t of l.b) for (let i = 0; i < t.n; i++) t.imgs[i].setVisible(showB).setAlpha(m.w);
    this.fill.setFillStyle(mixSea(m));
    this.cloudCol = Background.cloudColours(m);
  }

  /** The clouds' colours in look `a` with `b` faded in by `w`. */
  private static cloudColours(m: ThemeMix): CloudCol {
    const pa = PALETTES[m.a];
    const pb = PALETTES[m.b];
    const w = m.b === m.a ? 0 : m.w;
    return {
      fill: lerpRgb(hex(pa.cloud.base), hex(pb.cloud.base), w),
      shade: lerpRgb(hex(pa.cloud.shade), hex(pb.cloud.shade), w),
      ink: lerpRgb(hex(pa.farInk), hex(pb.farInk), w),
    };
  }

  /** A sky's bands of clouds: small far ones up high, big slow ones lower down (and on a climb, nearer ones all the way down). */
  private static cloudBands(T: Phaser.Textures.TextureManager, vertical: boolean): CloudBand[] {
    const bands = [
      Background.makeBand(T, 5, 7, 0.16, 0.08, 0.02, CLOUD_W, [0.75, 1.25], [34, 150], DEPTH.clouds, 1),
      Background.makeBand(T, 9, 4, 0.28, 0.14, 0.2, 1400, [1.3, 1.8], [40, 110], DEPTH.hills - 1, 0.9),
    ];
    // (a climb: nearer clouds spread all the way down the screen, passing quicker as you go up)
    if (vertical) bands.push(Background.makeBand(T, 13, 6, 0.22, 0.45, 0, 1100, [0.9, 1.4], [0, 640], DEPTH.clouds, 0.85));
    return bands;
  }

  /**
   * A sky's clouds drawn ahead in their first shapes, in the colours of `m` (behind a level's loading
   * card): its first frame drew them all (~11 pictures drawn and sent to the graphics chip, about a
   * tenth of that frame at 4x slow CPU); it now shows them as they are if they're still so (see
   * drawClouds). Not while the start screen shows clouds: they're its pictures too, on show.
   */
  static paintFirstClouds(T: Phaser.Textures.TextureManager, m: ThemeMix, vertical: boolean) {
    const col = Background.cloudColours(m);
    for (const band of Background.cloudBands(T, vertical)) for (const c of band.clouds) if ((c.tex as CloudTex).drawn !== drawnAs(col, FIRST_STEP)) Background.paintCloud(c, col, FIRST_STEP);
  }

  private static makeBand(T: Phaser.Textures.TextureManager, seed: number, n: number, fx: number, fy: number, anchor: number, width: number, size: [number, number], ys: [number, number], depth: number, alpha: number): CloudBand {
    const r = rng(seed);
    const base: [number, number, number][] = [
      [-30, 6, 17],
      [-10, -6, 23],
      [15, -2, 20],
      [34, 7, 14],
    ];
    const clouds: Cloud[] = [];
    for (let i = 0; i < n; i++) {
      const lumps = base.map(([x, y, rr]) => ({ x: x + (r() - 0.5) * 12, y: y + (r() - 0.5) * 8, r: rr * (0.8 + r() * 0.35), ph: r() * 6.28, w: 0.18 + r() * 0.3 }));
      for (let k = 0; k < 2; k++) if (r() < 0.6) lumps.push({ x: (r() - 0.5) * 56, y: -8 - r() * 8, r: 11 + r() * 9, ph: r() * 6.28, w: 0.15 + r() * 0.3 });
      const cs = size[0] + r() * (size[1] - size[0]);
      // (each cloud's own picture, shared by every scene that shows this sky)
      const key = `bgcloud-${seed}-${i}`;
      const tex = liveCanvas(T, key, Math.ceil(CB.w * cs * CLOUD_RES), Math.ceil(CB.h * cs * CLOUD_RES));
      clouds.push({ x: (i / n) * width + r() * 90, y: ys[0] + r() * (ys[1] - ys[0]), s: cs, drift: (r() - 0.5) * 18, bob: r() * 6.28, lumps, tex, imgs: [], next: -1 - r() * CLOUD_EVERY });
    }
    return { clouds, depth, fx, fy, anchor, width, alpha };
  }

  /** The puffs of a cloud right now: each one slowly swells, shrinks and wanders, so the cloud keeps changing shape. */
  private static lumpsNow(c: Cloud, at: number) {
    const t = at * MORPH_RATE;
    return c.lumps.map((l) => [l.x + Math.sin(t * l.w * 0.7 + l.ph) * 9, l.y + Math.cos(t * l.w + l.ph) * 4, l.r * (1 + 0.3 * Math.sin(t * l.w + l.ph * 1.7))] as const);
  }

  /** Outline of a cloud: the union of its puffs, flat-ish underneath (x, y pairs, in one reused array). */
  private static silhouette(c: Cloud, lumps: readonly (readonly [number, number, number])[]): Float32Array {
    const pts = SIL;
    for (let k = 0; k < SIL_N; k++) {
      const ca = SIL_COS[k];
      const sa = SIL_SIN[k];
      let best = 6;
      for (const [lx, ly, lr] of lumps) {
        const b = lx * ca + ly * sa;
        const disc = b * b - (lx * lx + ly * ly - lr * lr);
        if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
      }
      pts[k * 2] = ca * best * c.s;
      pts[k * 2 + 1] = Math.min(sa * best, 12) * c.s;
    }
    return pts;
  }

  /**
   * Draw a cloud's current shape into its picture: the shaded underside, the lit top (a touch
   * smaller and lifted), soft highlights on the upper puffs, and the ink outline. (Done a few
   * times a second, not every frame: they change shape slowly, and as pictures they're cheap
   * to show — drawn as shapes every frame they were most of the game's drawing work.)
   */
  private static paintCloud(c: Cloud, cc: CloudCol, at: number) {
    const { fill, shade, ink } = cc;
    const hi = lerpRgb(fill, 0xffffff, 0.65);
    const ctx = c.tex.getContext();
    const col = (n: number, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.tex.width, c.tex.height);
    const k = CLOUD_RES;
    ctx.setTransform(k, 0, 0, k, -CB.x0 * c.s * k, -CB.y0 * c.s * k);
    const lumps = Background.lumpsNow(c, at);
    const pts = Background.silhouette(c, lumps);
    /** The outline, scaled (sx, sy) and lifted (dy). */
    const path = (sx: number, sy: number, dy: number) => {
      ctx.beginPath();
      ctx.moveTo(pts[0] * sx, pts[1] * sy + dy);
      for (let k = 1; k < SIL_N; k++) ctx.lineTo(pts[k * 2] * sx, pts[k * 2 + 1] * sy + dy);
      ctx.closePath();
    };
    path(1, 1, 0);
    ctx.fillStyle = col(shade);
    ctx.fill();
    path(0.93, 0.9, -3 * c.s);
    ctx.fillStyle = col(fill);
    ctx.fill();
    ctx.fillStyle = col(hi, 0.7);
    for (const [lx, ly, lr] of lumps)
      if (ly < 2) {
        ctx.beginPath();
        ctx.arc((lx - lr * 0.22) * c.s, (ly - lr * 0.3) * c.s, lr * 0.45 * c.s, 0, Math.PI * 2);
        ctx.fill();
      }
    path(1, 1, 0);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = col(ink);
    ctx.stroke();
    c.tex.refresh();
    setCloudCrop(c, pts);
    // (see drawClouds)
    (c.tex as CloudTex).drawn = drawnAs(cc, at);
  }

  private drawClouds(view: View, camUp: number, dt: number) {
    this.t += dt;
    this.cloudScroll += 5 * dt;
    for (const band of this.bands) {
      const ox = view.left - 2;
      const oy = view.top + view.height * band.anchor + camUp * band.fy;
      const scroll = view.left * band.fx + this.cloudScroll * (band.fx / 0.16);
      for (const c of band.clouds) {
        const base = c.x + this.t * c.drift - scroll;
        let x = (((base % band.width) + band.width) % band.width) - 120;
        // a new shape now and then (each cloud on its own beat, so they don't all redraw at once);
        // only while it's on screen (a cloud off to the side keeps its last shape till it's back)
        if (this.t >= c.next && x < view.width + 120) {
          // (a picture already holding just this — the same shape in the same colours, e.g. a first
          // shape drawn ahead behind the loading card, or by the start screen's sky of the same look —
          // is shown as it is)
          if ((c.tex as CloudTex).drawn !== drawnAs(this.cloudCol, this.t)) Background.paintCloud(c, this.cloudCol, this.t);
          // (light mode: still shapes — a new one a few times a second is a steady trickle of
          // pictures to make and send to the graphics chip)
          // (the next one on its own beat, not 1.5 s from now: they all get their first picture in
          // the same frame, and counting from then kept them all redrawing in the same frame, every
          // 1.5 s — a hitch each time)
          c.next = this.stillClouds || LIGHT ? Infinity : c.next + CLOUD_EVERY * Math.max(1, Math.ceil((this.t - c.next) / CLOUD_EVERY));
        }
        let y = c.y + Math.sin(this.t * 0.35 + c.bob) * 5;
        if (this.vertical) {
          // (a climb: each cloud wraps round as it scrolls down past the bottom of the screen)
          const period = view.height + 320;
          const sy = oy + y - view.top + 160;
          y = (((sy % period) + period) % period) - 160 + view.top - oy;
        }
        let n = 0;
        for (; x < view.width + 120; x += band.width, n++) {
          if (!c.imgs[n])
            c.imgs[n] = this.scene.add
              .image(0, 0, c.tex.key)
              .setOrigin(-CB.x0 / CB.w, -CB.y0 / CB.h)
              .setScale(1 / CLOUD_RES)
              .setDepth(band.depth)
              .setAlpha(band.alpha);
          const img = c.imgs[n] as CroppedCopy;
          const box = (c.tex as CloudTex).box;
          if (box && img.box !== box) {
            img.box = box;
            img.setCrop(box.x, box.y, box.w, box.h);
          }
          img.setVisible(true).setPosition(ox + x, oy + y);
        }
        for (; n < c.imgs.length; n++) c.imgs[n].setVisible(false);
      }
    }
  }

  /** The clouds' clock (how far they've drifted and changed shape, and when each is next redrawn): see carryOn. */
  get cloudClock(): CloudClock {
    return { t: this.t, scroll: this.cloudScroll, next: this.bands.map((b) => b.clouds.map((c) => c.next)) };
  }

  /**
   * Carry on the clouds of another Background of the same sky from where they were (a checkpoint
   * restart: the level's built again). Their pictures are shared, and hold the shapes that clock last
   * drew: so nothing needs drawing now — they drift on, each redrawn on its own beat as before. (From a
   * clock of their own, every cloud was drawn and sent to the graphics chip again in the restart's
   * first frame, ~1.6 MB.)
   */
  carryOn(k: CloudClock) {
    if (k.next.length !== this.bands.length || k.next.some((n, i) => n.length !== this.bands[i].clouds.length)) return;
    this.t = k.t;
    this.cloudScroll = k.scroll;
    this.bands.forEach((b, i) => b.clouds.forEach((c, j) => (c.next = k.next[i][j])));
  }

  /** Re-draw every cloud on its next showing (their pictures are shared between Backgrounds: after a switch they may be in another look's colours). */
  refreshClouds() {
    for (const band of this.bands) for (const c of band.clouds) c.next = -1;
  }

  /** Puff seeds floating across the screen on the breeze. */
  private drawSeeds(view: View, dt: number) {
    if (this.sea) {
      // (bubbles wobbling up from the sea bed, round again from the bottom)
      for (const sd of this.seeds) {
        sd.y -= (sd.vx * 1.4 * dt) / Math.max(1, view.height);
        if (sd.y < -0.05) {
          sd.y += 1.1;
          sd.x = Math.random();
        }
        sd.img.setPosition(view.left + sd.x * view.width + Math.sin(this.t * 2.2 + sd.ph) * 6, view.top + sd.y * view.height);
      }
      return;
    }
    for (const sd of this.seeds) {
      sd.x += (sd.vx * dt) / Math.max(1, view.width);
      if (sd.x > 1.05) sd.x -= 1.1;
      const wobble = Math.sin(this.t * 1.3 + sd.ph) * 10;
      sd.img.setPosition(view.left + sd.x * view.width, view.top + sd.y * view.height + wobble);
      sd.img.setRotation(Math.sin(this.t * 2 + sd.ph) * 0.4);
    }
  }

  /**
   * The game: each background layer — and the sky — is also cut short where the layers in front of it
   * are solid all the way down (the hills hide the far scenery, the cloud sea in front hides both; and
   * the sky is behind them all), as the ground already hides them (see hideUnder). The graphics chip
   * blends every pixel of every picture, so on a slow one the drawing time goes with the pixels drawn:
   * the sky alone was drawn over the whole screen, and the half of it or so under the hills, the cloud
   * sea and the ground painted over. What's on screen stays the same: only pixels something solid in
   * front paints over are left out. (Not the start screen: its scenery fades between Parts.)
   */
  coverLayers(on: boolean) {
    this.layerCover = on;
  }
  private layerCover = false;
  /** (this frame's stretches, see findCovers: their left edges, how many, and how wide) */
  private stripX0 = 0;
  private stripN = 0;
  /** (this frame's view, across: what's outside it doesn't matter) */
  private viewX0 = 0;
  private viewX1 = 0;
  private static readonly STRIP = 16;
  /** Per stretch, each layer's solid band this frame (world y, top and bottom; top ≥ bottom: none). */
  private bandTop: Float64Array[] = [];
  private bandBot: Float64Array[] = [];
  /** Per stretch, from how high everything in front of each layer (and of the sky: [0]) hides it, all the way down the view. */
  private hidden: Float64Array[] = [];
  /** (the ground's solid stretches in a stretch of the view: see GroundCover.runs) */
  private runsAt: number[] = [];
  /** The sky's, this frame (null: not cut). */
  private skyCut: Float64Array | null = null;

  /**
   * Where the layers in front, and the ground, hide what's behind them this frame: across the view in
   * stretches STRIP world px wide, for the sky (index 0) and each layer (index 1 + its own): the height
   * from which they're solid all the way down past the view's bottom (Infinity: they aren't).
   */
  private findCovers(view: View, groundOn: boolean): Float64Array[] {
    const cam = this.scene.cameras.main;
    // the view as the camera shows it (turned, maybe), and a shake's worth more below
    const r = (cam as unknown as { rotation: number }).rotation;
    const hw = (cam.width / cam.zoom / 2) * Math.abs(Math.cos(r)) + (cam.height / cam.zoom / 2) * Math.abs(Math.sin(r));
    const hh = (cam.height / cam.zoom / 2) * Math.abs(Math.cos(r)) + (cam.width / cam.zoom / 2) * Math.abs(Math.sin(r));
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;
    const bottom = Math.max(cy + hh, view.top + view.height) + 24;
    const SW = Background.STRIP;
    const sx0 = Math.floor((Math.min(cx - hw, view.left) - 16) / SW) * SW;
    const n = Math.ceil((Math.max(cx + hw, view.left + view.width) + 16 - sx0) / SW);
    this.stripX0 = sx0;
    this.stripN = n;
    this.viewX0 = cx - hw - 1;
    this.viewX1 = cx + hw + 1;
    const L = this.layers.length;
    const grow = (arr: Float64Array[], k: number) => {
      for (let i = 0; i < k; i++) if (!arr[i] || arr[i].length < n) arr[i] = new Float64Array(Math.max(n, 96));
    };
    grow(this.bandTop, L);
    grow(this.bandBot, L);
    grow(this.hidden, L + 1);
    // each layer's solid band in each stretch: what all its columns there share
    const right = view.left + view.width;
    for (let li = 0; li < L; li++) {
      const l = this.layers[li];
      const top = this.bandTop[li];
      const bot = this.bandBot[li];
      const solid = bgSolid(l.keyA);
      // (its pictures shown: see update)
      let shown = 0;
      while (shown < l.n && l.x0 + shown * l.w - 0.3 * shown < right) shown++;
      const rowEnd = l.x0 + (shown - 1) * l.w - 0.3 * (shown - 1) + l.w;
      const near = li === L - 1;
      for (let s = 0; s < n; s++) {
        top[s] = Infinity;
        bot[s] = -Infinity;
        const a = Math.max(sx0 + s * SW, cx - hw - 2);
        const b = Math.min(sx0 + (s + 1) * SW, cx + hw + 2);
        if (!solid || !l.rowOn || !shown || b <= a || a < l.x0 || b > rowEnd) continue;
        let t = -Infinity;
        let e = Infinity;
        const colW = solid.col / this.res;
        for (let i = 0; i < shown && t < e; i++) {
          const x = l.x0 + i * l.w - 0.3 * i;
          const k0 = Math.max(0, Math.floor((a - x) / colW));
          const k1 = Math.min(solid.top.length - 1, Math.floor((b - x) / colW));
          for (let k = k0; k <= k1; k++) {
            t = Math.max(t, l.y + solid.top[k] / this.res);
            // (the cloud sea in front runs on into the plain fill under it: see `fill`)
            e = Math.min(e, near && solid.toEnd[k] ? Infinity : l.y + solid.bottom[k] / this.res);
          }
        }
        if (t < e) {
          top[s] = t;
          bot[s] = e;
        }
      }
    }
    // for each layer (and the sky), from how high what's in front hides it, down past the view's bottom
    // (and the cloud sea in front, index L: only the ground's in front of it)
    const runs = this.runsAt;
    const groundRuns = this.cover?.runs;
    for (let s = 0; s < n; s++) {
      let g = Infinity;
      runs.length = 0;
      if (groundOn) {
        g = this.cover!.at(sx0 + s * SW, sx0 + (s + 1) * SW);
        groundRuns?.(sx0 + s * SW, sx0 + (s + 1) * SW, runs);
      }
      for (let target = 0; target <= L; target++) {
        let cur = Math.min(bottom, g);
        // (bands in front, and the ground's solid stretches, reaching down to where it's hidden so far
        // hide it from their tops)
        for (let more = true; more; ) {
          more = false;
          for (let f = target; f < L; f++)
            if (this.bandTop[f][s] < cur && this.bandBot[f][s] >= cur) {
              cur = this.bandTop[f][s];
              more = true;
            }
          for (let i = 0; i < runs.length; i += 2)
            if (runs[i] < cur && runs[i + 1] >= cur) {
              cur = runs[i];
              more = true;
            }
        }
        this.hidden[target][s] = cur < bottom ? cur : Infinity;
      }
    }
    return this.hidden;
  }

  /** From how high everything in front hides all of x0…x1 (see findCovers): Infinity if any of it isn't. */
  private hiddenFrom(front: Float64Array, x0: number, x1: number) {
    const SW = Background.STRIP;
    x0 = Math.max(x0, this.viewX0);
    x1 = Math.min(x1, this.viewX1);
    if (x1 < x0) return Infinity;
    const s0 = Math.floor((x0 - this.stripX0) / SW);
    const s1 = Math.floor((x1 - this.stripX0) / SW);
    // (the part outside the stretches is outside the view)
    let at = -Infinity;
    for (let s = Math.max(0, s0); s <= Math.min(this.stripN - 1, s1); s++) if (front[s] > at) at = front[s];
    return at === -Infinity ? Infinity : at;
  }

  /** The sky's stretches this frame (see drawSkyBands): their edges (x, n + 1 of them), each one's cut, and the lowest. Null: not cut anywhere. */
  private skyRuns(x0: number, x1: number): { n: number; x: number[]; cut: number[]; low: number } | null {
    const cut = this.skyCut;
    if (!cut) return null;
    const SW = Background.STRIP;
    const xs = this.runX;
    const cs = this.runCut;
    xs.length = 0;
    cs.length = 0;
    let low = Infinity;
    let any = false;
    for (let x = x0; x < x1; ) {
      const s = Math.floor((x - this.stripX0) / SW);
      const next = Math.min(x1, this.stripX0 + (s + 1) * SW);
      // (outside the stretches: not cut; cut a little higher, to a step of 8 px, so neighbours join up:
      // each stretch is a few more shapes to draw)
      const c = s < 0 || s >= this.stripN ? Infinity : Math.floor(cut[s] / 8) * 8;
      if (c < Infinity) any = true;
      if (c < low) low = c;
      if (cs.length && cs[cs.length - 1] === c) xs[xs.length - 1] = next;
      else {
        if (!xs.length) xs.push(x);
        xs.push(next);
        cs.push(c);
      }
      x = next;
    }
    return any ? { n: cs.length, x: xs, cut: cs, low } : null;
  }
  private runX: number[] = [];
  private runCut: number[] = [];

  update(view: View, dt: number) {
    for (const sky of [this.skyA, this.skyB]) sky.setPosition(view.left - 2, view.top - 2).setDisplaySize(view.width + 4, view.height + 4);
    const camUp = this.lowestViewTop - view.top; // how far the camera is above its lowest point
    let tint = 0xffffff;
    if (this.vertical) {
      // (the higher you climb, the smoggier the sky)
      const k = Math.max(0, Math.min(1, camUp / Math.max(1, this.lowestViewTop)));
      tint = lerpRgb(0xffffff, 0xc89a66, k * 0.55);
      this.skyA.setTint(tint);
    }
    this.drawClouds(view, camUp, dt);
    this.drawSeeds(view, dt);
    // (the ground's cover: across the view and a little either side — a shake moves the picture a
    // few pixels)
    const ground = this.cover?.on() ? { x0: view.left - 40, x1: view.left + view.width + 40 } : null;
    for (const l of this.layers) {
      l.offset += l.drift * dt;
      l.y = view.top + view.height * l.anchor + camUp * l.fy;
      // the row scrolls by (camera × parallax + drift), wrapping every picture-width
      const shift = view.left * l.fx + l.offset;
      l.x0 = view.left - 2 - (((shift % l.w) + l.w) % l.w);
      l.n = Math.ceil((view.width + 4 + l.w) / l.w) + 1;
      // (and none of the row while it's wholly above or below the view: up a climb, or high over the
      // ground, the far layers are a long way down, and were drawn there every frame all the same)
      l.rowOn = l.y < view.top + view.height + 8 && l.y + l.h > view.top - 8;
    }
    // (where the layers in front hide each one: see coverLayers)
    const fronts = this.layerCover ? this.findCovers(view, ground !== null) : null;
    for (let li = 0; li < this.layers.length; li++) {
      const l = this.layers[li];
      const x0 = l.x0;
      const n = l.n;
      const a = this.row(l.a, l.keyA, n, l.depth);
      const b = this.row(l.b, l.keyB, n, l.depth);
      const rowOn = l.rowOn;
      const front = fronts ? fronts[li + 1] : null;
      const right = view.left + view.width;
      for (let i = 0; i < a.length; i++) {
        // (a hair of overlap so no seam shows between neighbours)
        const x = x0 + i * l.w - 0.3 * i;
        // (only the ones in view: the row's last picture or two are past the right edge, and Phaser
        // draws a picture wherever it is. All of a picture's pieces go with it: the start screen's
        // view turns a little, so the corners of the screen can show what's just outside the box)
        const on = rowOn && i < n && x < right;
        for (const [t, show] of [[a[i], on], [b[i], on && this.showB]] as const)
          for (let j = 0; j < t.n; j++) {
            const img = t.imgs[j];
            img.setVisible(show).setPosition(x, l.y);
            if (t === b[i]) img.setAlpha(this.wB);
            if (show) this.showPiece(img, t.boxes[j], x, l.y, ground, front);
          }
      }
    }
    if (this.skyBands) {
      this.skyA.setVisible(false);
      this.skyB.setVisible(false);
      this.skyCut = fronts ? fronts[0] : null;
      this.drawSkyBands(this.skyBands, view, tint);
    }
    // solid fill under the nearest layer so the bottom of the screen is always covered
    const near = this.layers[this.layers.length - 1];
    const fillTop = near.y + near.h - 2;
    // (not drawn at all while it's below the view: its few pixels' strip off the bottom of the screen
    // still cost a break in the drawing's batching, every frame)
    // (nor what of it the ground hides, all across the view: see hideUnder)
    const fillEnd = Math.min(view.top + view.height + 4, ground ? this.cover!.at(ground.x0, ground.x1) : Infinity);
    const fillOn = fillTop < view.top + view.height + 8 && fillTop < fillEnd;
    this.fill.setVisible(fillOn);
    if (fillOn) {
      this.fill.setPosition(view.left - 2, fillTop);
      this.fill.setSize(view.width + 4, Math.max(0, fillEnd - fillTop));
    }
  }
}
