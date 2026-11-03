import Phaser from 'phaser';
import { DEPTH } from '../config';
import { BG_LAYERS, BG_RES, bgKey, ensureLook } from '../gfx/textures';
import { rng } from '../gfx/draw';
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
}

/** A band of living clouds at one parallax depth. */
interface CloudBand {
  g: Phaser.GameObjects.Graphics;
  clouds: Cloud[];
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
  ) {
    this.skyA = scene.add.image(0, 0, bgKey('sky', 'puff')).setOrigin(0, 0).setDepth(DEPTH.sky);
    this.skyB = scene.add.image(0, 0, bgKey('sky', 'puff')).setOrigin(0, 0).setDepth(DEPTH.sky).setVisible(false);
    this.add('far', BG_LAYERS.far.h, 0.08, 0.04, 0.3, 0, DEPTH.far);
    // two bands of living clouds: small far ones up high, big slow ones lower down
    this.bands.push(this.makeBand(5, 7, 0.16, 0.08, 0.02, CLOUD_W, [0.75, 1.25], [34, 150], DEPTH.clouds, 1));
    this.bands.push(this.makeBand(9, 4, 0.28, 0.14, 0.2, 1400, [1.3, 1.8], [40, 110], DEPTH.hills - 1, 0.9));
    // dandelion-puff seeds drifting across on the breeze
    const r = rng(77);
    for (let i = 0; i < 14; i++) {
      const img = scene.add.image(0, 0, 'puff').setDepth(DEPTH.near + 1).setScale(0.1 + r() * 0.12).setAlpha(0.85);
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
      clouds.push({ x: (i / n) * width + r() * 90, y: ys[0] + r() * (ys[1] - ys[0]), s: size[0] + r() * (size[1] - size[0]), drift: (r() - 0.5) * 18, bob: r() * 6.28, lumps });
    }
    return { g: this.scene.add.graphics().setDepth(depth).setAlpha(alpha), clouds, fx, fy, anchor, width, alpha };
  }

  /** The puffs of a cloud right now: each one slowly swells, shrinks and wanders, so the cloud keeps changing shape. */
  private lumpsNow(c: Cloud) {
    const t = this.t;
    return c.lumps.map((l) => [l.x + Math.sin(t * l.w * 0.7 + l.ph) * 9, l.y + Math.cos(t * l.w + l.ph) * 4, l.r * (1 + 0.3 * Math.sin(t * l.w + l.ph * 1.7))] as const);
  }

  /** Outline of a cloud: the union of its puffs, flat-ish underneath. */
  private silhouette(c: Cloud, lumps: readonly (readonly [number, number, number])[]): Phaser.Math.Vector2[] {
    const pts: Phaser.Math.Vector2[] = [];
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2;
      let best = 6;
      for (const [lx, ly, lr] of lumps) {
        const b = lx * Math.cos(a) + ly * Math.sin(a);
        const disc = b * b - (lx * lx + ly * ly - lr * lr);
        if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
      }
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * best * c.s, Math.min(Math.sin(a) * best, 12) * c.s));
    }
    return pts;
  }

  private drawClouds(view: View, camUp: number, dt: number) {
    this.t += dt;
    this.cloudScroll += 5 * dt;
    const { fill, shade, ink } = this.cloudCol;
    const hi = lerpRgb(fill, 0xffffff, 0.65);
    for (const band of this.bands) {
      const g = band.g;
      g.clear();
      g.setPosition(view.left - 2, view.top + view.height * band.anchor + camUp * band.fy);
      const scroll = view.left * band.fx + this.cloudScroll * (band.fx / 0.16);
      for (const c of band.clouds) {
        const base = c.x + this.t * c.drift - scroll;
        let x = (((base % band.width) + band.width) % band.width) - 120;
        const y = c.y + Math.sin(this.t * 0.35 + c.bob) * 5;
        const lumps = this.lumpsNow(c);
        const pts = this.silhouette(c, lumps);
        for (; x < view.width + 120; x += band.width) {
          const at = pts.map((p) => new Phaser.Math.Vector2(x + p.x, y + p.y));
          g.fillStyle(shade, 1);
          g.fillPoints(at, true);
          // lit top: same shape a touch smaller and lifted, leaving a shaded rim underneath
          g.fillStyle(fill, 1);
          g.fillPoints(pts.map((p) => new Phaser.Math.Vector2(x + p.x * 0.93, y + p.y * 0.9 - 3 * c.s)), true);
          // soft highlights on the upper puffs give them volume
          g.fillStyle(hi, 0.7);
          for (const [lx, ly, lr] of lumps) if (ly < 2) g.fillCircle(x + (lx - lr * 0.22) * c.s, y + (ly - lr * 0.3) * c.s, lr * 0.45 * c.s);
          g.lineStyle(1.6, ink, 1);
          g.strokePoints(at, true, true);
        }
      }
    }
  }

  /** Puff seeds floating across the screen on the breeze. */
  private drawSeeds(view: View, dt: number) {
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
