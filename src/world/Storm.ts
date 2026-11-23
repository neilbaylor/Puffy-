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
 * front: the storm sky (a gradient), the clouds, the far sea and rows of swells with whitecaps, the
 * deep; in front of everything, the rain, and splashes on the decks and the sea; now and then a
 * flash of lightning. At the end the storm breaks: the rain stops, the clouds thin, a sunbeam.
 *
 * Cheap by design (see the perf rounds): the sky and the water are a handful of shaded rectangles;
 * the clouds, each row of swells and the rain are one TileSprite each (one quad) over a small picture
 * that repeats, moved by sliding the picture in it; the near rain's big streaks and the splashes are
 * small pools of sprites. What a frame costs here is the graphics chip filling the screen, so the
 * layers that cover it are as few as can be (see BANDS, RAIN_TILES). A flash swaps the cloud and swell
 * pictures for lit-up ones for a moment (no extra layer drawn) and shows a bolt; the white-out is the
 * camera's own flash (not drawn once it's faded: core/fadeFix). Nothing is left on screen see-through:
 * whatever's faded out is hidden.
 *
 * Light mode: the middle clouds alone, two rows of swells, the rain as a few dozen streaks only, no
 * splashes, and the flash is the camera's white-out and the bolt only (no lit-up pictures to hold).
 */

/**
 * The rain: tiles, each a TileSprite over the view from the clouds' bellies down to the sea (a layer
 * of rain over the screen is a screenful for the graphics chip: the dear part of the storm). Full mode:
 * the far and middle layers drawn into one tile (`back`), and the near layer's few big streaks as a
 * handful of sprites of their own (NEAR_STREAKS) rather than a third screenful. Light: no tile at all
 * (that screenful of rain was most of what the storm cost there), just a few dozen of the middle
 * layer's thinner streaks as sprites — sparser rain, nearly free.
 */
const RAIN_TILES: readonly { key: string; layers: RainLayer[]; speed: number; parallax: number }[] = LIGHT
  ? []
  : [{ key: 'f6-rain-back', layers: ['far', 'mid'], speed: (RAIN_LAYERS.far.speed + RAIN_LAYERS.mid.speed) / 2, parallax: 0.4 }];
/** The rain's streaks as sprites: how many on screen at once (design px: 1280 × 720 on screen), and which layer's look and speed (full mode: the near rain's big ones; light: all its rain, the middle layer's). */
const NEAR_STREAKS = LIGHT ? 32 : 26;
const STREAK_LAYER: RainLayer = LIGHT ? 'mid' : 'near';
const STREAK = { w: 6, h: 90 } as const;
/**
 * The clouds: one band, a TileSprite running the length of the world, its picture the clouds of one or
 * more of CLOUD_BANDS drawn together (`parts`: which, and how far down the picture), back to front.
 * Full mode: all three — the far ones lowest, the near ones darkest and on top — in the one picture:
 * as three bands of their own they overlapped, up to three screenfuls over the sky, ~14 ms a frame at
 * 4x slow CPU against ~7 for the one. Light: the middle ones. y: world y of its top; sx, sy: scroll
 * factors; k: shown scale; v: drift (px/s); rainFrom: how far down it the rain starts (its bellies).
 */
interface BandSpec {
  key: string;
  parts: readonly (readonly [CloudBand, number])[];
  h: number;
  y: number;
  sx: number;
  sy: number;
  k: number;
  v: number;
  depth: number;
  rainFrom: number;
}
const BANDS: readonly BandSpec[] = LIGHT
  ? [{ key: 'f6-cloud-mid', parts: [['mid', 0]], h: 256, y: -130, sx: 0.3, sy: 0.55, k: 1.35, v: 7, depth: 0.12, rainFrom: 0.72 }]
  : [
      {
        key: 'f6-cloud-all',
        parts: [
          ['far', 236],
          ['mid', 118],
          ['near', 0],
        ],
        h: 512,
        y: -320,
        sx: 0.34,
        sy: 0.58,
        k: 1.35,
        v: 7,
        depth: 0.12,
        rainFrom: 0.72,
      },
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
  private bands: { ts: Phaser.GameObjects.TileSprite; spec: BandSpec; x0: number }[] = [];
  private swells: { ts: Phaser.GameObjects.TileSprite; key: string; v: number }[] = [];
  private rain: { ts: Phaser.GameObjects.TileSprite; speed: number; parallax: number }[] = [];
  /** The near rain's streaks: where each is on screen (0 … 1 across, 0 … 1 down) and how fast it falls (screens/s). */
  private streaks: { img: Phaser.GameObjects.Image; u: number; w: number; v: number }[] = [];
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
    for (const band of BANDS)
      for (const flash of LIGHT ? [false] : [false, true])
        add(`${band.key}${flash ? '-flash' : ''}`, 1024, band.h, CLOUD_RES, (ctx) => {
          for (const [part, dy] of band.parts) {
            const b = CLOUD_BANDS[part];
            ctx.save();
            ctx.translate(0, dy);
            drawCloudBand(ctx, 1024, b.h, b.clouds, flash, b.curtains);
            ctx.restore();
          }
        });
    // (the rows' pictures don't depend on where they are)
    SWELLS(0).forEach(([, amp, n, tone, seed, th], i) => {
      for (const flash of LIGHT ? [false] : [false, true])
        add(`f6-swell${i}${flash ? '-flash' : ''}`, SWELL_W, th, 1, (ctx) => drawSwells(ctx, SWELL_W, th, amp, n, tone, seed, flash));
    });
    // (the near swell: two rows of it lap the hull, as Boss 5's waves; 512 × 128 at 2x, the swell drawn in its top 90)
    add('f6-wave', STORM_WAVE.w, 128, WAVE_RES, (ctx) => drawStormWaveTile(ctx));
    for (const r of RAIN_TILES) add(r.key, 256, 256, 1, (ctx) => r.layers.forEach((l) => drawRainTile(ctx, l, { far: 61, mid: 62, near: 63 }[l])));
    if (NEAR_STREAKS)
      add('f6-streak', STREAK.w, STREAK.h, 1, (ctx) => {
        const L = RAIN_LAYERS[STREAK_LAYER];
        const g = ctx.createLinearGradient(0, 0, 0, STREAK.h);
        g.addColorStop(0, `rgba(${L.col},0)`);
        g.addColorStop(1, `rgba(${L.col},${L.a})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = L.w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(STREAK.w / 2, 2);
        ctx.lineTo(STREAK.w / 2, STREAK.h - 2);
        ctx.stroke();
      });
    if (!LIGHT)
      add('f6-splash', SPLASH * SPLASH_FRAMES, SPLASH, 1.5, (ctx) => {
        for (let i = 0; i < SPLASH_FRAMES; i++) {
          ctx.save();
          ctx.translate(i * SPLASH, 0);
          drawSplashFrame(ctx, i);
          ctx.restore();
        }
      });
    add('f6-bolt', BOLT.w, BOLT.h, 1, (ctx) => {
      drawLightning(ctx, BOLT.w * 0.4, 6, BOLT.w * 0.6, BOLT.h - 10, 7);
      // (its glow faded out towards the picture's sides: cut off by them, it showed as a lit box; its
      // top's in the clouds and its foot behind the far sea)
      ctx.globalCompositeOperation = 'destination-in';
      const g = ctx.createLinearGradient(0, 0, BOLT.w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.2, 'rgba(0,0,0,1)');
      g.addColorStop(0.8, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, BOLT.w, BOLT.h);
      ctx.globalCompositeOperation = 'source-over';
    });
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
    for (const spec of BANDS) {
      const ts = s.add
        .tileSprite(left - 2000, spec.y, W + 4000, spec.h * spec.k, spec.key)
        .setOrigin(0, 0)
        .setTileScale(spec.k / CLOUD_RES, spec.k / CLOUD_RES)
        .setScrollFactor(spec.sx, spec.sy)
        .setDepth(spec.depth);
      this.bands.push({ ts, spec, x0: Math.random() * 1024 });
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
    RAIN_TILES.forEach((r, i) => {
      const ts = s.add
        .tileSprite(0, 0, 16, 16, r.key)
        .setOrigin(0, 0)
        .setDepth(7.6 + i * 0.05);
      this.rain.push({ ts, speed: r.speed, parallax: r.parallax });
    });
    for (let i = 0; i < NEAR_STREAKS; i++)
      this.streaks.push({
        img: s.add.image(0, 0, 'f6-streak').setOrigin(0.5, 1).setRotation(-Math.atan(RAIN_SLANT)).setDepth(7.7).setVisible(false),
        u: Math.random(),
        w: Math.random(),
        v: (RAIN_LAYERS[STREAK_LAYER].speed / 720) * (0.85 + Math.random() * 0.3),
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
    for (const b of this.bands) b.ts.tilePositionX = (b.x0 + this.t * b.spec.v) / b.ts.tileScaleX;
    for (const w of this.swells) w.ts.tilePositionX += s * w.v;
    // the flash fading
    if (this.flashLeft > 0) {
      this.flashLeft -= dtMs;
      if (this.bolt) this.bolt.setVisible(this.flashLeft > 0 && (this.flashLeft > 260 || Math.floor(this.flashLeft / 60) % 2 === 0));
      if (this.flashLeft <= 0) this.lit(false);
    }
    // the rain: over the view from the front clouds' bellies (where they show, as the camera has them)
    // down to the sea, its streaks the same size on screen however close the camera is
    const v = cam.worldView;
    const base = Math.max(this.scene.scale.width / 1280, this.scene.scale.height / 720);
    const z = cam.zoom / base;
    const fb = BANDS[BANDS.length - 1];
    const from = Math.max(v.y, fb.y + cam.scrollY * (1 - fb.sy) + fb.h * fb.k * fb.rainFrom);
    const h = Math.min(v.bottom, this.w.water + 6) - from;
    for (const r of this.rain) {
      const on = this.raining && h > 0;
      r.ts.setVisible(on);
      if (!on) continue;
      r.ts.setPosition(v.x, from).setSize(v.width, h).setTileScale(1 / z, 1 / z);
      r.ts.tilePositionX = v.x * z * r.parallax - this.t * r.speed * RAIN_SLANT;
      r.ts.tilePositionY = from * z * r.parallax - this.t * r.speed;
    }
    // (the near streaks: falling down the screen, a little sideways; hidden where they're under the sea or over the clouds)
    for (const q of this.streaks) {
      q.w += q.v * s;
      q.u += q.v * s * RAIN_SLANT * (720 / 1280);
      if (q.w > 1.15) {
        q.w -= 1.3;
        q.u = Math.random() * 1.1 - 0.1;
      }
      const x = v.x + q.u * v.width;
      const y = v.y + q.w * v.height;
      const on = this.raining && y > from + 20 && y < this.w.water + 6;
      q.img.setVisible(on);
      if (on) q.img.setPosition(x, y).setScale(1 / z).setAlpha(1 - this.clearing);
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
      for (const b of this.bands) b.ts.setTexture(on ? `${b.spec.key}-flash` : b.spec.key);
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
    for (const q of this.streaks) q.img.setVisible(false);
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
