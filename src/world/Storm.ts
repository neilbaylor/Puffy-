import Phaser from 'phaser';
import { LIGHT } from '../core/light';
import { sfx } from '../core/sfx';
import { addCanvas, hires, type Step } from '../gfx/textures';
import {
  CLOUD_BANDS,
  RAIN_LAYERS,
  RAIN_SLANT,
  SPLASH,
  SPLASH_FRAMES,
  STORM_DEEP,
  STORM_FAR,
  STORM_SKY,
  STORM_SKY_FLASH,
  STORM_WAVE,
  drawCloudBand,
  drawLightning,
  drawRainTile,
  drawSplashFrame,
  drawStormWaveTile,
  drawSunbeam,
  drawSwells,
  type CloudBand,
  type RainLayer,
} from '../gfx/fishing6';

/**
 * King Bob's rematch (Boss 6) out in a storm: the scenery round the contest, and its weather. Back to
 * front: the storm sky (a gradient), cloud bands, the far sea and rows of swells with whitecaps, the
 * deep; in front of everything, the rain, and splashes on the decks and the sea; now and then a
 * flash of lightning. At the end the storm breaks: the rain stops, the clouds part, a sunbeam.
 *
 * Cheap by design (see the perf rounds): the sky and the water are a handful of shaded rectangles;
 * each cloud band, row of swells and layer of rain is one TileSprite (one quad) over a small picture
 * that repeats, moved by sliding the picture in it; the splashes are a pool of 16 little sprites. A
 * flash swaps the cloud and swell pictures for lit-up ones for a moment (no extra layer drawn) and
 * shows a bolt; the white-out is the camera's own flash (not drawn once it's faded: core/fadeFix).
 * Nothing is left on screen see-through: whatever's faded out is hidden.
 *
 * Light mode: one plain cloud band, two rows of swells, one layer of rain, no splashes, and the
 * flash is the camera's white-out and the bolt only (no lit-up pictures to hold).
 */

/** The rain layers drawn (front last). */
const RAIN: RainLayer[] = LIGHT ? ['mid'] : ['far', 'mid', 'near'];
/** How much each rain layer slides as the camera pans (0: fixed to the screen, 1: to the world). */
const RAIN_PARALLAX: Record<RainLayer, number> = { far: 0.25, mid: 0.5, near: 0.9 };
/** The cloud bands: [band, world y of its top, scroll factor x, scroll factor y, scale]. */
const BANDS: readonly (readonly [CloudBand, number, number, number, number])[] = LIGHT
  ? [['mid', -60, 0.3, 0.55, 1.35]]
  : [
      ['far', 40, 0.2, 0.5, 1.2],
      ['mid', -80, 0.3, 0.55, 1.35],
      ['near', -230, 0.42, 0.62, 1.6],
    ];
/** The rows of swells: [world y of the crests' top, crest height, hills in a tile, tone 0 far … 1 near, seed, texture height]. */
const SWELLS = (horizon: number) =>
  (LIGHT
    ? [
        [horizon - 6, 8, 10, 0.05, 41, 128],
        [horizon + 30, 26, 3, 0.85, 43, 64],
      ]
    : [
        [horizon - 6, 8, 10, 0.05, 41, 128],
        [horizon + 14, 16, 5, 0.45, 42, 128],
        [horizon + 34, 26, 3, 0.85, 43, 64],
      ]) as readonly (readonly [number, number, number, number, number, number])[];
const SWELL_W = 1024;
/** Picture resolution of the clouds (they're big and soft: a little under the screen's in light mode). */
const CLOUD_RES = LIGHT ? 0.75 : 1;
/** The near swell's tile (drawn at 2x, as Boss 5's). */
const WAVE_RES = 2;
/** How many splashes can be going at once, and how many start a second. */
const SPLASHES = 16;
const SPLASH_RATE = 22;
/** The bolt's picture (world px). */
const BOLT = { w: 360, h: 520 } as const;
/** The sunbeam's picture (drawn at half size, it's soft; shown at 1.3 × 2 of that: a shaft 585 world px wide at its foot). */
const BEAM = { w: 900, h: 700 } as const;

/** Where on screen things can be hit by rain: segments [x0, y0, x1, y1] in the world (the decks), asked for each splash. */
export type Surfaces = () => readonly (readonly [number, number, number, number])[];

export interface StormWorld {
  water: number;
  horizon: number;
  /** the world's left and right edges, top and bottom */
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class Storm {
  private sky!: Phaser.GameObjects.Graphics;
  private bands: { ts: Phaser.GameObjects.TileSprite; key: string; v: number; x0: number }[] = [];
  private swells: { ts: Phaser.GameObjects.TileSprite; key: string; v: number }[] = [];
  private rain: { ts: Phaser.GameObjects.TileSprite; layer: RainLayer }[] = [];
  private splashes: { img: Phaser.GameObjects.Image; t: number; sea: boolean }[] = [];
  private bolt: Phaser.GameObjects.Image | null = null;
  private beam: Phaser.GameObjects.Image | null = null;
  private splashDue = 0;
  private t = 0;
  /** Lit up by a flash (ms left). */
  private flashLeft = 0;
  /** 0 … 1: the storm breaking up (the ending). */
  clearing = 0;
  /** Rain falling (off once it's cleared). */
  private raining = true;

  constructor(
    private scene: Phaser.Scene,
    private w: StormWorld,
    private surfaces: Surfaces,
  ) {}

  /** The storm's pictures not drawn yet, one step each (drawn behind the loading card: see FishingScene.artSteps). */
  static artSteps(scene: Phaser.Scene): Step[] {
    const T = scene.textures;
    const steps: Step[] = [];
    const add = (key: string, w: number, h: number, res: number, fn: (ctx: CanvasRenderingContext2D) => void, release = true) => {
      if (!T.exists(key)) steps.push({ name: key, run: () => void (T.exists(key) || addCanvas(scene, key, hires(w, h, res, fn), undefined, { release })) });
    };
    for (const [band] of BANDS) {
      const b = CLOUD_BANDS[band];
      for (const flash of LIGHT ? [false] : [false, true])
        add(`f6-cloud-${band}${flash ? '-flash' : ''}`, 1024, b.h, CLOUD_RES, (ctx) => drawCloudBand(ctx, 1024, b.h, b.clouds, flash, b.curtains));
    }
    const horizon = 446;
    SWELLS(horizon).forEach(([y, amp, n, tone, seed, th], i) => {
      for (const flash of LIGHT ? [false] : [false, true])
        add(`f6-swell${i}${flash ? '-flash' : ''}`, SWELL_W, th, 1, (ctx) => drawSwells(ctx, SWELL_W, th, amp, n, tone, seed, flash));
      void y;
    });
    // (the near swell: two rows of it lap the hull, as Boss 5's waves; 512 × 128 at 2x, the swell drawn in its top 90)
    add('f6-wave', STORM_WAVE.w, 128, WAVE_RES, (ctx) => drawStormWaveTile(ctx));
    for (const l of RAIN) add(`f6-rain-${l}`, 256, 256, 1, (ctx) => drawRainTile(ctx, l, { far: 61, mid: 62, near: 63 }[l]));
    if (!LIGHT)
      add('f6-splash', SPLASH * SPLASH_FRAMES, SPLASH, 1.5, (ctx) => {
        for (let i = 0; i < SPLASH_FRAMES; i++) {
          ctx.save();
          ctx.translate(i * SPLASH, 0);
          drawSplashFrame(ctx, i);
          ctx.restore();
        }
      });
    add('f6-bolt', BOLT.w, BOLT.h, 1, (ctx) => drawLightning(ctx, BOLT.w * 0.4, 6, BOLT.w * 0.6, BOLT.h - 10, 7));
    add('f6-beam', BEAM.w, BEAM.h, 0.5, (ctx) => drawSunbeam(ctx, BEAM.w, BEAM.h));
    return steps;
  }

  /** The splash frames (made as the storm's built: its picture's one strip). */
  private splashFrames() {
    const tex = this.scene.textures.get('f6-splash');
    if (tex.has('s0')) return;
    const px = SPLASH * 1.5;
    for (let i = 0; i < SPLASH_FRAMES; i++) tex.add(`s${i}`, 0, i * px, 0, px, px);
  }

  /** A gradient over a box of the world, as shaded rectangles (one per stop: see FishingScene.strip). */
  private fill(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, stops: readonly (readonly [number, string])[], mix?: readonly (readonly [number, string])[], k = 0) {
    const col = (i: number) => {
      const a = Phaser.Display.Color.HexStringToColor(stops[i][1]);
      if (!mix || !k) return a.color;
      const b = Phaser.Display.Color.HexStringToColor(mix[i][1]);
      return Phaser.Display.Color.GetColor(a.red + (b.red - a.red) * k, a.green + (b.green - a.green) * k, a.blue + (b.blue - a.blue) * k);
    };
    for (let i = 1; i < stops.length; i++) {
      const a = col(i - 1);
      const b = col(i);
      g.fillGradientStyle(a, a, b, b, 1);
      g.fillRect(x, y + stops[i - 1][0] * h, w, (stops[i][0] - stops[i - 1][0]) * h);
    }
  }
  private drawSky() {
    const { left, right, top, horizon } = this.w;
    const g = this.sky;
    g.clear();
    // (a flash lights it up; the storm breaking warms it to a clearing sky)
    const stops = this.flashLeft > 0 ? STORM_SKY_FLASH : STORM_SKY;
    this.fill(g, left, top, right - left, horizon - top, stops, this.flashLeft > 0 ? undefined : CLEAR_SKY, this.clearing);
  }

  build() {
    const s = this.scene;
    const { left, right, bottom, water, horizon } = this.w;
    const W = right - left;
    this.sky = s.add.graphics().setDepth(0);
    this.drawSky();
    // the clouds: bands that run the length of the world, further ones moving less as the camera pans
    for (const [band, y, sx, sy, k] of BANDS) {
      const key = `f6-cloud-${band}`;
      const h = CLOUD_BANDS[band].h;
      const ts = s.add
        .tileSprite(left - 2000, y, W + 4000, h * k, key)
        .setOrigin(0, 0)
        .setTileScale(k / CLOUD_RES, k / CLOUD_RES)
        .setScrollFactor(sx, sy)
        .setDepth(band === 'far' ? 0.11 : band === 'mid' ? 0.12 : 0.13);
      this.bands.push({ ts, key, v: band === 'far' ? 4 : band === 'mid' ? 7 : 11, x0: Math.random() * 1024 });
    }
    // the far sea, the swells rolling by, the deep
    const sea = s.add.graphics().setDepth(0.2);
    this.fill(sea, left, horizon, W, water - horizon + 10, STORM_FAR);
    SWELLS(horizon).forEach(([y, , , , , th], i) => {
      const key = `f6-swell${i}`;
      const h = Math.min(th, water - y + 6);
      const ts = s.add
        .tileSprite(left, y, W, h, key)
        .setOrigin(0, 0)
        .setDepth(0.21 + i * 0.01);
      this.swells.push({ ts, key, v: [6, 12, 20][i] ?? 20 });
    });
    const deep = s.add.graphics().setDepth(1);
    this.fill(deep, left, water, W, bottom - water + 40, STORM_DEEP);
    // the bolt (shown in a flash), the sunbeam (the ending): hidden till then
    this.bolt = s.add.image(0, 0, 'f6-bolt').setOrigin(0.5, 0).setDepth(0.125).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.beam = s.add.image(0, 0, 'f6-beam').setOrigin(0.5, 0).setScale(1.3, 2).setDepth(6.5).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    // the rain: one tile each, kept over what the camera sees above the sea (see update)
    RAIN.forEach((layer, i) => {
      const ts = s.add
        .tileSprite(0, 0, 16, 16, `f6-rain-${layer}`)
        .setOrigin(0, 0)
        .setDepth(7.6 + i * 0.05);
      this.rain.push({ ts, layer });
    });
    if (!LIGHT) {
      this.splashFrames();
      for (let i = 0; i < SPLASHES; i++) this.splashes.push({ img: s.add.image(0, 0, 'f6-splash', 's0').setOrigin(0.5, 0.8).setScale(1 / 1.5).setDepth(7.5).setVisible(false), t: -1, sea: false });
    }
  }

  /** The near swells' rows (as Boss 5's waves): the scene places them. */
  static readonly WAVE_RES = WAVE_RES;

  update(dtMs: number) {
    const s = dtMs / 1000;
    this.t += s;
    const cam = this.scene.cameras.main;
    for (const b of this.bands) b.ts.tilePositionX = (b.x0 + this.t * b.v) / b.ts.tileScaleX;
    for (const w of this.swells) w.ts.tilePositionX += s * w.v;
    // the flash fading
    if (this.flashLeft > 0) {
      this.flashLeft -= dtMs;
      if (this.bolt) this.bolt.setVisible(this.flashLeft > 0 && (this.flashLeft > 260 || Math.floor(this.flashLeft / 60) % 2 === 0));
      if (this.flashLeft <= 0) this.lit(false);
    }
    // the rain: over the view, down to the sea, its streaks the same size on screen however close the camera is
    const v = cam.worldView;
    const base = Math.max(this.scene.scale.width / 1280, this.scene.scale.height / 720);
    const z = cam.zoom / base;
    const h = Math.min(v.bottom, this.w.water + 6) - v.y;
    for (const r of this.rain) {
      const on = this.raining && h > 0;
      r.ts.setVisible(on);
      if (!on) continue;
      const L = RAIN_LAYERS[r.layer];
      const p = RAIN_PARALLAX[r.layer];
      r.ts.setPosition(v.x, v.y).setSize(v.width, h).setTileScale(1 / z, 1 / z);
      r.ts.tilePositionX = v.x * z * p - this.t * L.speed * RAIN_SLANT;
      r.ts.tilePositionY = v.y * z * p - this.t * L.speed;
    }
    // splashes: a few frames each, popping up on the decks and the sea in view
    if (this.splashes.length && this.raining) {
      this.splashDue += s * SPLASH_RATE * (1 - this.clearing);
      while (this.splashDue >= 1) {
        this.splashDue -= 1;
        const sp = this.splashes.find((q) => q.t < 0);
        if (!sp) break;
        const segs = this.surfaces();
        const sea = !segs.length || Math.random() < 0.4;
        let x: number;
        let y: number;
        if (sea) {
          x = v.x + Math.random() * v.width;
          y = this.w.water - 4 + Math.random() * 6;
        } else {
          const [x0, y0, x1, y1] = segs[Math.floor(Math.random() * segs.length)];
          const u = Math.random();
          x = x0 + (x1 - x0) * u;
          y = y0 + (y1 - y0) * u;
        }
        if (x < v.x - 20 || x > v.right + 20 || y < v.y || y > v.bottom + 20) continue;
        sp.t = 0;
        sp.sea = sea;
        sp.img.setPosition(x, y).setVisible(true).setFrame(sea ? 's5' : 's0').setScale((0.7 + Math.random() * 0.5) / 1.5);
      }
    }
    for (const sp of this.splashes) {
      if (sp.t < 0) continue;
      sp.t += dtMs;
      const f = Math.floor(sp.t / 45);
      if (f >= 5) {
        sp.t = -1;
        sp.img.setVisible(false);
      } else sp.img.setFrame(`s${f + (sp.sea ? 5 : 0)}`);
    }
  }

  /** Swap to the lit-up pictures (or back). */
  private lit(on: boolean) {
    if (!LIGHT) {
      for (const b of this.bands) b.ts.setTexture(on ? `${b.key}-flash` : b.key);
      for (const w of this.swells) w.ts.setTexture(on ? `${w.key}-flash` : w.key);
    }
    this.drawSky();
    this.onLit?.(on);
  }
  /** Told when a flash lights things up and when it's over (the scene lightens the boat). */
  onLit: ((on: boolean) => void) | null = null;

  /** Is a flash showing? */
  get flashing() {
    return this.flashLeft > 0;
  }

  /** How long a flash lasts (ms): the white-out, the lit-up sky and the bolt. */
  static readonly FLASH_MS = 420;

  /** Lightning: a white-out, everything lit up, a bolt down to the horizon somewhere in view, thunder a beat later. */
  flash() {
    if (this.clearing > 0.3) return;
    const cam = this.scene.cameras.main;
    const v = cam.worldView;
    this.flashLeft = Storm.FLASH_MS;
    this.lit(true);
    cam.flash(LIGHT ? 160 : 220, 235, 235, 255);
    if (this.bolt) {
      const x = v.x + v.width * (0.55 + Math.random() * 0.35);
      const top = Math.max(this.w.top, v.y - 40);
      const h = Math.max(120, this.w.horizon - top);
      this.bolt
        .setPosition(x, top)
        .setScale((h / BOLT.h) * (Math.random() < 0.5 ? -1 : 1), h / BOLT.h)
        .setVisible(true);
    }
    this.scene.time.delayedCall(300 + Math.random() * 500, () => sfx.thunder());
  }

  /** The storm breaking (the ending): the rain eases off, the clouds part and thin, the sky warms, a sunbeam pours through. */
  async breakUp(ms: number, beamAt: { x: number; y: number }) {
    const s = this.scene;
    const o = { k: 0 };
    if (this.beam) {
      this.beam.setPosition(beamAt.x, beamAt.y).setAlpha(0).setVisible(true);
      s.tweens.add({ targets: this.beam, alpha: 0.5, duration: ms, ease: 'Sine.easeOut' });
    }
    await new Promise<void>((res) =>
      s.tweens.add({
        targets: o,
        k: 1,
        duration: ms,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          this.clearing = o.k;
          for (const r of this.rain) r.ts.setAlpha(1 - o.k);
          this.bands.forEach((b, i) => b.ts.setAlpha(1 - o.k * (0.35 + i * 0.15)));
          // (the sky's redrawn in a few steps, not every frame)
          const step = Math.round(o.k * 8);
          if (step !== this.skyStep) {
            this.skyStep = step;
            this.drawSky();
          }
        },
        onComplete: () => res(),
      }),
    );
    this.raining = false;
    for (const r of this.rain) r.ts.setVisible(false);
    for (const sp of this.splashes) sp.img.setVisible(false);
  }
  private skyStep = 0;
}

/** The sky as the storm breaks (as many stops as STORM_SKY): a washed blue, warm at the horizon. */
const CLEAR_SKY: readonly (readonly [number, string])[] = [
  [0, '#4f6f9c'],
  [0.5, '#8aa6c4'],
  [0.85, '#d9cfae'],
  [1, '#f4dfa8'],
];
