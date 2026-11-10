import Phaser from 'phaser';
import { DEPTH } from '../config';
import { BG_LAYERS, BG_RES, bgKey, ensureLook } from '../gfx/textures';
import { rng } from '../gfx/draw';
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
const CLOUD_RES = LIGHT ? 1 : 1.25;
const CLOUD_EVERY = 0.45;
/** A cloud's outline is worked out at this many angles round it (the sines and cosines once, here). */
const SIL_N = 60;
const SIL = new Float32Array(SIL_N * 2);
const SIL_COS = Float32Array.from({ length: SIL_N }, (_, k) => Math.cos((k / SIL_N) * Math.PI * 2));
const SIL_SIN = Float32Array.from({ length: SIL_N }, (_, k) => Math.sin((k / SIL_N) * Math.PI * 2));

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

interface Layer {
  id: LayerId;
  /**
   * The current look, and the next look fading in on top of it: each a row of
   * plain images side by side (all sharing one GPU texture). Not TileSprites:
   * those keep their own big canvas copy of the picture, and re-make a canvas
   * whenever their width changes (every frame of a zooming fly-over), which is
   * what was running iPhones out of memory.
   */
  a: Phaser.GameObjects.Image[];
  b: Phaser.GameObjects.Image[];
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
  private cloudCol = { fill: 0xffffff, shade: 0xe3dcf7, ink: 0x9486c8 };
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
  ) {
    this.skyA = scene.add.image(0, 0, bgKey('sky', 'puff')).setOrigin(0, 0).setDepth(DEPTH.sky);
    this.skyB = scene.add.image(0, 0, bgKey('sky', 'puff')).setOrigin(0, 0).setDepth(DEPTH.sky).setVisible(false);
    this.add('far', BG_LAYERS.far.h, 0.08, 0.04, 0.3, 0, DEPTH.far);
    // two bands of living clouds: small far ones up high, big slow ones lower down
    if (!sea) {
      this.bands.push(this.makeBand(5, 7, 0.16, 0.08, 0.02, CLOUD_W, [0.75, 1.25], [34, 150], DEPTH.clouds, 1));
      this.bands.push(this.makeBand(9, 4, 0.28, 0.14, 0.2, 1400, [1.3, 1.8], [40, 110], DEPTH.hills - 1, 0.9));
    }
    // (a climb: nearer clouds spread all the way down the screen, passing quicker as you go up)
    if (vertical) this.bands.push(this.makeBand(13, 6, 0.22, 0.45, 0, 1100, [0.9, 1.4], [0, 640], DEPTH.clouds, 0.85));
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

  private add(id: LayerId, h: number, fx: number, fy: number, anchor: number, drift: number, depth: number) {
    const key = bgKey(id, 'puff');
    this.layers.push({ id, a: [], b: [], keyA: key, keyB: key, depth, w: BG_LAYERS[id].w, y: 0, fx, fy, anchor, drift, offset: 0, h: h + 4 / BG_RES });
  }

  /** Make sure a row has `n` pictures (they're only ever added: a handful at most). */
  private row(imgs: Phaser.GameObjects.Image[], key: string, n: number, depth: number) {
    while (imgs.length < n) imgs.push(this.scene.add.image(0, 0, key).setOrigin(0, 0).setScale(1 / BG_RES).setDepth(depth));
    return imgs;
  }

  /** Show look `a`, with look `b` faded in on top by `w`. */
  setTheme(m: ThemeMix) {
    if (m.a !== this.themeA) ensureLook(this.scene, m.a);
    if (m.b !== this.themeB && m.w > 0.001) ensureLook(this.scene, m.b);
    if (m.a !== this.themeA) {
      this.themeA = m.a;
      this.skyA.setTexture(bgKey('sky', m.a));
      for (const l of this.layers) {
        l.keyA = bgKey(l.id, m.a);
        for (const img of l.a) img.setTexture(l.keyA);
      }
    }
    const showB = m.w > 0.001 && m.b !== m.a;
    if (showB && m.b !== this.themeB) {
      this.themeB = m.b;
      this.skyB.setTexture(bgKey('sky', m.b));
      for (const l of this.layers) {
        l.keyB = bgKey(l.id, m.b);
        for (const img of l.b) img.setTexture(l.keyB);
      }
    }
    this.skyB.setVisible(showB).setAlpha(m.w);
    this.showB = showB;
    this.wB = m.w;
    for (const l of this.layers) for (const img of l.b) img.setVisible(showB).setAlpha(m.w);
    this.fill.setFillStyle(mixSea(m));
    const pa = PALETTES[m.a];
    const pb = PALETTES[m.b];
    const w = m.b === m.a ? 0 : m.w;
    this.cloudCol = {
      fill: lerpRgb(hex(pa.cloud.base), hex(pb.cloud.base), w),
      shade: lerpRgb(hex(pa.cloud.shade), hex(pb.cloud.shade), w),
      ink: lerpRgb(hex(pa.farInk), hex(pb.farInk), w),
    };
  }

  private makeBand(seed: number, n: number, fx: number, fy: number, anchor: number, width: number, size: [number, number], ys: [number, number], depth: number, alpha: number): CloudBand {
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
      const T = this.scene.textures;
      const tex = (T.exists(key) ? T.get(key) : T.createCanvas(key, Math.ceil(CB.w * cs * CLOUD_RES), Math.ceil(CB.h * cs * CLOUD_RES))) as Phaser.Textures.CanvasTexture;
      clouds.push({ x: (i / n) * width + r() * 90, y: ys[0] + r() * (ys[1] - ys[0]), s: cs, drift: (r() - 0.5) * 18, bob: r() * 6.28, lumps, tex, imgs: [], next: -1 - r() * CLOUD_EVERY });
    }
    return { clouds, depth, fx, fy, anchor, width, alpha };
  }

  /** The puffs of a cloud right now: each one slowly swells, shrinks and wanders, so the cloud keeps changing shape. */
  private lumpsNow(c: Cloud) {
    const t = this.t;
    return c.lumps.map((l) => [l.x + Math.sin(t * l.w * 0.7 + l.ph) * 9, l.y + Math.cos(t * l.w + l.ph) * 4, l.r * (1 + 0.3 * Math.sin(t * l.w + l.ph * 1.7))] as const);
  }

  /** Outline of a cloud: the union of its puffs, flat-ish underneath (x, y pairs, in one reused array). */
  private silhouette(c: Cloud, lumps: readonly (readonly [number, number, number])[]): Float32Array {
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
  private paintCloud(c: Cloud, hi: number) {
    const { fill, shade, ink } = this.cloudCol;
    const ctx = c.tex.getContext();
    const col = (n: number, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.tex.width, c.tex.height);
    const k = CLOUD_RES;
    ctx.setTransform(k, 0, 0, k, -CB.x0 * c.s * k, -CB.y0 * c.s * k);
    const lumps = this.lumpsNow(c);
    const pts = this.silhouette(c, lumps);
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
  }

  private drawClouds(view: View, camUp: number, dt: number) {
    this.t += dt;
    this.cloudScroll += 5 * dt;
    const hi = lerpRgb(this.cloudCol.fill, 0xffffff, 0.65);
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
          this.paintCloud(c, hi);
          // (light mode: still shapes — a new one a few times a second is a steady trickle of
          // pictures to make and send to the graphics chip)
          c.next = this.stillClouds || LIGHT ? Infinity : this.t + CLOUD_EVERY;
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
          c.imgs[n].setVisible(true).setPosition(ox + x, oy + y);
        }
        for (; n < c.imgs.length; n++) c.imgs[n].setVisible(false);
      }
    }
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

  update(view: View, dt: number) {
    for (const sky of [this.skyA, this.skyB]) sky.setPosition(view.left - 2, view.top - 2).setDisplaySize(view.width + 4, view.height + 4);
    const camUp = this.lowestViewTop - view.top; // how far the camera is above its lowest point
    if (this.vertical) {
      // (the higher you climb, the smoggier the sky)
      const k = Math.max(0, Math.min(1, camUp / Math.max(1, this.lowestViewTop)));
      this.skyA.setTint(lerpRgb(0xffffff, 0xc89a66, k * 0.55));
    }
    this.drawClouds(view, camUp, dt);
    this.drawSeeds(view, dt);
    for (const l of this.layers) {
      l.offset += l.drift * dt;
      l.y = view.top + view.height * l.anchor + camUp * l.fy;
      // the row scrolls by (camera × parallax + drift), wrapping every picture-width
      const shift = view.left * l.fx + l.offset;
      const x0 = view.left - 2 - (((shift % l.w) + l.w) % l.w);
      const n = Math.ceil((view.width + 4 + l.w) / l.w) + 1;
      const a = this.row(l.a, l.keyA, n, l.depth);
      const b = this.row(l.b, l.keyB, n, l.depth);
      for (let i = 0; i < a.length; i++) {
        const on = i < n;
        // (a hair of overlap so no seam shows between neighbours)
        a[i].setVisible(on).setPosition(x0 + i * l.w - 0.3 * i, l.y);
        b[i].setVisible(on && this.showB).setAlpha(this.wB).setPosition(x0 + i * l.w - 0.3 * i, l.y);
      }
    }
    // solid fill under the nearest layer so the bottom of the screen is always covered
    const near = this.layers[this.layers.length - 1];
    const fillTop = near.y + near.h - 2;
    this.fill.setPosition(view.left - 2, fillTop);
    this.fill.setSize(view.width + 4, Math.max(0, view.top + view.height - fillTop + 4));
  }
}
