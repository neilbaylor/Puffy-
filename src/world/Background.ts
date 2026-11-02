import Phaser from 'phaser';
import { DEPTH } from '../config';
import { BG_LAYERS, BG_RES, bgKey } from '../gfx/textures';
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
  lumps: { x: number; y: number; r: number; ph: number; w: number }[];
}

interface Layer {
  id: LayerId;
  /** The current look, and the next look fading in on top of it. */
  a: Phaser.GameObjects.TileSprite;
  b: Phaser.GameObjects.TileSprite;
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
  private cloudG: Phaser.GameObjects.Graphics;
  private clouds: Cloud[] = [];
  private cloudCol = { fill: 0xffffff, shade: 0xe3dcf7, ink: 0x9486c8 };
  private t = 0;
  private cloudScroll = 0;

  constructor(
    private scene: Phaser.Scene,
    private lowestViewTop: number,
  ) {
    this.skyA = scene.add.image(0, 0, bgKey('sky', 'puff')).setOrigin(0, 0).setDepth(DEPTH.sky);
    this.skyB = scene.add.image(0, 0, bgKey('sky', 'puff')).setOrigin(0, 0).setDepth(DEPTH.sky).setVisible(false);
    this.add('far', BG_LAYERS.far.h, 0.08, 0.04, 0.3, 0, DEPTH.far);
    this.cloudG = scene.add.graphics().setDepth(DEPTH.clouds);
    this.makeClouds();
    this.add('hills', BG_LAYERS.hills.h, 0.32, 0.16, 0.42, 0, DEPTH.hills);
    this.add('near', BG_LAYERS.near.h, 0.58, 0.32, 0.68, 0, DEPTH.near);
    this.fill = scene.add.rectangle(0, 0, 10, 10, 0xffffff).setOrigin(0, 0).setDepth(DEPTH.near);
    this.setTheme({ a: 'puff', b: 'puff', w: 0 });
  }

  private add(id: LayerId, h: number, fx: number, fy: number, anchor: number, drift: number, depth: number) {
    const mk = () => {
      const s = this.scene.add.tileSprite(0, 0, 100, h + 4 / BG_RES, bgKey(id, 'puff')).setOrigin(0, 0).setDepth(depth);
      s.setTileScale(1 / BG_RES, 1 / BG_RES);
      return s;
    };
    const a = mk();
    const b = mk().setVisible(false);
    this.layers.push({ id, a, b, fx, fy, anchor, drift, offset: 0, h: h + 4 / BG_RES });
  }

  /** Show look `a`, with look `b` faded in on top by `w`. */
  setTheme(m: ThemeMix) {
    if (m.a !== this.themeA) {
      this.themeA = m.a;
      this.skyA.setTexture(bgKey('sky', m.a));
      for (const l of this.layers) l.a.setTexture(bgKey(l.id, m.a));
    }
    const showB = m.w > 0.001 && m.b !== m.a;
    if (showB && m.b !== this.themeB) {
      this.themeB = m.b;
      this.skyB.setTexture(bgKey('sky', m.b));
      for (const l of this.layers) l.b.setTexture(bgKey(l.id, m.b));
    }
    this.skyB.setVisible(showB).setAlpha(m.w);
    for (const l of this.layers) l.b.setVisible(showB).setAlpha(m.w);
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

  private makeClouds() {
    const r = rng(5);
    const base: [number, number, number][] = [
      [-30, 6, 17],
      [-10, -6, 23],
      [15, -2, 20],
      [34, 7, 14],
    ];
    for (let i = 0; i < 7; i++) {
      const lumps = base.map(([x, y, rr]) => ({ x: x + (r() - 0.5) * 10, y: y + (r() - 0.5) * 6, r: rr * (0.85 + r() * 0.3), ph: r() * 6.28, w: 0.25 + r() * 0.35 }));
      if (r() < 0.6) lumps.push({ x: (r() - 0.5) * 50, y: -10 - r() * 6, r: 12 + r() * 8, ph: r() * 6.28, w: 0.2 + r() * 0.3 });
      this.clouds.push({ x: (i / 7) * CLOUD_W + r() * 80, y: 34 + r() * 120, s: 0.7 + r() * 0.6, drift: (r() - 0.5) * 6, lumps });
    }
  }

  /** Outline of one cloud right now: the union of its breathing puffs, flat-ish underneath. */
  private silhouette(c: Cloud): Phaser.Math.Vector2[] {
    const t = this.t;
    const lumps = c.lumps.map((l) => [l.x + Math.sin(t * l.w * 0.7 + l.ph) * 5, l.y + Math.cos(t * l.w + l.ph) * 2.5, l.r * (1 + 0.16 * Math.sin(t * l.w + l.ph * 1.7))] as const);
    const pts: Phaser.Math.Vector2[] = [];
    for (let k = 0; k < 56; k++) {
      const a = (k / 56) * Math.PI * 2;
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
    const g = this.cloudG;
    g.clear();
    g.setPosition(view.left - 2, view.top + view.height * 0.02 + camUp * 0.08);
    const scroll = view.left * 0.16 + this.cloudScroll;
    const { fill, shade, ink } = this.cloudCol;
    for (const c of this.clouds) {
      const base = c.x + this.t * c.drift - scroll;
      let x = (((base % CLOUD_W) + CLOUD_W) % CLOUD_W) - 90;
      const pts = this.silhouette(c);
      for (; x < view.width + 90; x += CLOUD_W) {
        const at = pts.map((p) => new Phaser.Math.Vector2(x + p.x, c.y + p.y));
        g.fillStyle(shade, 1);
        g.fillPoints(at, true);
        // lit top: the same shape, a touch smaller and lifted, leaves a shaded rim underneath
        g.fillStyle(fill, 1);
        g.fillPoints(pts.map((p) => new Phaser.Math.Vector2(x + p.x * 0.93, c.y + p.y * 0.9 - 3 * c.s)), true);
        g.lineStyle(1.6, ink, 1);
        g.strokePoints(at, true, true);
      }
    }
  }

  update(view: View, dt: number) {
    for (const sky of [this.skyA, this.skyB]) sky.setPosition(view.left - 2, view.top - 2).setDisplaySize(view.width + 4, view.height + 4);
    const camUp = this.lowestViewTop - view.top; // how far the camera is above its lowest point
    this.drawClouds(view, camUp, dt);
    for (const l of this.layers) {
      l.offset += l.drift * dt;
      const screenY = view.height * l.anchor + camUp * l.fy;
      for (const s of [l.a, l.b]) {
        s.setPosition(view.left - 2, view.top + screenY);
        s.width = view.width + 4;
        s.tilePositionX = (view.left * l.fx + l.offset) * BG_RES;
      }
    }
    // solid fill under the nearest layer so the bottom of the screen is always covered
    const near = this.layers[this.layers.length - 1];
    const fillTop = near.a.y + near.h - 2;
    this.fill.setPosition(view.left - 2, fillTop);
    this.fill.setSize(view.width + 4, Math.max(0, view.top + view.height - fillTop + 4));
  }
}
