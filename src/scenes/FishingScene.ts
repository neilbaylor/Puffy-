import Phaser from 'phaser';
import { characterById } from '../data/characters';
import type { Session } from '../core/session';
import { fadeOutMusic, playHoops } from '../core/music';
import { sfx } from '../core/sfx';
import { ART_RES, CHAR_H, CHAR_W, carryHand, drawCharacter } from '../gfx/draw';
import { CAST_ANGLES, HERO_SHEET_M, addCanvas, fishingWear, hires, makeCastSheet, makeFishFrames } from '../gfx/textures';
import {
  BOAT,
  BOBBER,
  BOWL,
  COOLER,
  WAVE,
  drawBoat,
  drawBobber,
  drawBowlBack,
  drawBowlFront,
  drawCloud,
  drawCooler,
  drawDeepStrip,
  drawDrop,
  drawFarSeaStrip,
  drawFishShadow,
  drawHullShadow,
  drawIsland,
  drawRay,
  drawRipple,
  drawSkyStrip,
  drawStarburst,
  drawWaveTile,
} from '../gfx/fishing';
import { FISH_SIZE, drawFish, type FishKind } from '../gfx/fish';
import { stingerReveal, stingerTitle } from '../ui/stinger';
import { gamepadSources } from '../input/gamepad';
import { isKeyDown } from '../input/keyboard';
import { usingTouch } from '../input/touch';
import type { GameData, GameOverState, ResultState } from './GameScene';
import { loseLife } from '../core/lives';
import { SimpleConfetti } from '../world/SimpleConfetti';

export interface FishingData {
  session: Session;
  charId: string;
  /** Checkpoint to restart from if King Bob wins. */
  checkpoint: number;
  level?: number;
  /** Level stats so far (shown on the results card if you win). */
  result: ResultState;
}

/** The sea's surface (world y). Above it the sky, below it the cut-away of the water. */
const WATER = 520;
/** How far the world goes (the sea runs off to the right: the lure can fly a long way). */
const WORLD_W = 3600;
const WORLD_TOP = -360;
const WORLD_BOTTOM = 880;
/** The boat picture's left edge (world). */
const BOAT_X = 40;
const BOAT_Y = WATER - BOAT.water;
const ROUNDS = 6;
/** The share of bites you tap in time that end up a fish on the line. */
const CATCH = 0.17;
/** King Bob lands about this share of his casts. */
const KING_CATCH = 0.5;
/** A hero's size here: world px per art unit. */
const HERO_K = 2.15;
/** How long the BITE button can be hit for (ms). */
const BITE_MS = 850;
/** The rods: length (world px), and how far the handle reaches behind the hands. */
const ROD_LEN = 178;
const ROD_BUTT = 34;
const KING_ROD_LEN = 150;

/** What you can catch: the fish, what it's called, its weight range (lb), how common, and how big it's shown. */
const CATCHES: {
  kind: FishKind;
  name: string;
  lb: [number, number];
  odds: number;
  k: number;
  rare?: boolean;
}[] = [
  { kind: 'zippy', name: 'Zippy', lb: [0.6, 1.9], odds: 30, k: 1.7 },
  { kind: 'badguy', name: 'Bad Guy Fish', lb: [1.1, 2.8], odds: 22, k: 1.4 },
  { kind: 'stone', name: 'Stone Fish', lb: [2.2, 4.6], odds: 19, k: 0.95 },
  { kind: 'slinger', name: 'Slinger', lb: [3.1, 6.4], odds: 16, k: 0.9 },
  { kind: 'fat', name: 'Fat Fish', lb: [9, 16], odds: 8, k: 0.6, rare: true },
  {
    kind: 'kai',
    name: 'Kai Fish',
    lb: [1.4, 3.2],
    odds: 5,
    k: 1.25,
    rare: true,
  },
];
const pickCatch = () => {
  let r = Math.random() * CATCHES.reduce((a, c) => a + c.odds, 0);
  for (const c of CATCHES) if ((r -= c.odds) < 0) return c;
  return CATCHES[0];
};

type Who = 'hero' | 'king';
interface Lure {
  who: Who;
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  mode: 'held' | 'fly' | 'float' | 'hooked' | 'gone';
  /** how far it's dipped under (floating: a nibble pulls it down) */
  dip: number;
  spin: number;
}
interface Rod {
  /** the rod's angle (0 = straight out to the right, −π/2 straight up) */
  a: number;
  /** how bent it is (+ = tip pulled down/forward) */
  bend: number;
  /** the reel's handle going round */
  reel: number;
  /** reeling in: turns per second */
  reelRate: number;
  /** a fish on: the line's taut */
  taut: boolean;
  tip: { x: number; y: number };
  hands: { x: number; y: number };
}

/**
 * King Bob's fishing contest: the World 3 boss. Out on his boat, the REEL ROYAL, you take turns:
 * six rounds, then sudden death. Your turn: a cast (the basketball power meter — the better the cast,
 * the more bites, 3 to 6), the lure flying out over the sea on its line, then reeling in. Every so
 * often something bites: a round BITE! button pops up and fades fast — hit it in time and you strike;
 * one strike in about six hooks a fish, and then it's a fight, a leap, and up it comes over the boat.
 * King Bob's turn is quicker (about five seconds): he casts, reels like mad, and lands about half.
 */
export class FishingScene extends Phaser.Scene {
  private fd!: FishingData;
  private clock = 0;
  private waits: { at: number; res: () => void }[] = [];
  private dom!: HTMLElement;
  private tapped = false;
  private prevKey = true;
  private biteHit = false;
  private score = { hero: [] as boolean[], king: [] as boolean[] };
  /** where the camera looks (world) and how close in (1 = the whole boat and a stretch of sea) */
  private cam = { x: 640, y: 420, zoom: 1 };
  private camK = 3;
  private baseZoom = 1;

  private boat!: Phaser.GameObjects.Image;
  private cooler!: Phaser.GameObjects.Image;
  private bowlBack!: Phaser.GameObjects.Image;
  private bowlFront!: Phaser.GameObjects.Image;
  private kingSpr!: Phaser.GameObjects.Sprite;
  private bucket!: Phaser.GameObjects.Image;
  private hero!: Phaser.GameObjects.Sprite;
  private heroKey = '';
  private heroScale = 1;
  /** the hero's arm angle (the frame nearest it is shown; the rod follows it, a bit more upright) */
  private arm = -0.85;
  private heroPose: string | null = null;
  private rods!: Phaser.GameObjects.Graphics;
  private rod: Record<Who, Rod> = {
    hero: {
      a: -1.35,
      bend: 0,
      reel: 0,
      reelRate: 0,
      taut: false,
      tip: { x: 0, y: 0 },
      hands: { x: 0, y: 0 },
    },
    king: {
      a: -1.1,
      bend: 0,
      reel: 0,
      reelRate: 0,
      taut: false,
      tip: { x: 0, y: 0 },
      hands: { x: 0, y: 0 },
    },
  };
  private lures: Record<Who, Lure> = {} as Record<Who, Lure>;
  /** A fish on the end of a line out of the water: where the line goes from the rod tip (its mouth). */
  private dangle: Record<Who, { x: number; y: number } | null> = { hero: null, king: null };
  private waves: Phaser.GameObjects.TileSprite[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private rays: Phaser.GameObjects.Image[] = [];
  private schools: {
    img: Phaser.GameObjects.Image;
    v: number;
    y0: number;
    ph: number;
  }[] = [];
  private gulls!: Phaser.GameObjects.Graphics;
  private gullList: { x: number; y: number; v: number; ph: number }[] = [];
  private confettiFx!: SimpleConfetti;
  /** the boat rocking (radians) and bobbing (px) */
  private rock = 0;
  private bob = 0;
  private skipping = false;
  private inIntro = false;
  private tapListener = (e: Event) => {
    const t = e.target as Element | null;
    if (t?.closest?.('.hud, .screen, .fsh-bite')) return;
    this.tapped = true;
  };

  constructor() {
    super('Fishing');
  }

  init(data: FishingData) {
    this.fd = data;
    this.clock = 0;
    this.waits = [];
    this.tapped = false;
    this.prevKey = true;
    this.biteHit = false;
    this.score = { hero: [], king: [] };
    this.cam = { x: 640, y: 420, zoom: 1 };
    this.camK = 3;
    this.arm = -0.85;
    this.heroPose = null;
    this.rod.hero = {
      a: -1.35,
      bend: 0,
      reel: 0,
      reelRate: 0,
      taut: false,
      tip: { x: 0, y: 0 },
      hands: { x: 0, y: 0 },
    };
    this.rod.king = {
      a: -1.1,
      bend: 0,
      reel: 0,
      reelRate: 0,
      taut: false,
      tip: { x: 0, y: 0 },
      hands: { x: 0, y: 0 },
    };
    this.waves = [];
    this.clouds = [];
    this.rays = [];
    this.schools = [];
    this.gullList = [];
    this.skipping = false;
    this.inIntro = false;
  }

  // ───────────────────────────────────────────── setup ──

  private makeTextures() {
    const T = this.textures;
    const add = (key: string, w: number, h: number, res: number, fn: (ctx: CanvasRenderingContext2D) => void) => {
      if (!T.exists(key))
        addCanvas(this, key, hires(w, h, res, fn), undefined, {
          release: true,
        });
    };
    add('fl-boat', BOAT.w, BOAT.h, 1.5, (ctx) => drawBoat(ctx));
    add('fl-hullshadow', 256, 64, 1, (ctx) => drawHullShadow(ctx, 256, 64));
    add('fl-cooler', COOLER.w, COOLER.h, 2, (ctx) => drawCooler(ctx, false));
    add('fl-cooler-open', COOLER.w, COOLER.h, 2, (ctx) => drawCooler(ctx, true));
    add('fl-bowl-back', BOWL.w, BOWL.h, 2, (ctx) => drawBowlBack(ctx));
    add('fl-bowl-front', BOWL.w, BOWL.h, 2, (ctx) => drawBowlFront(ctx));
    add('fl-bobber', BOBBER.w, BOBBER.h, 3, (ctx) => drawBobber(ctx));
    add('fl-bobber-gold', BOBBER.w, BOBBER.h, 3, (ctx) => drawBobber(ctx, true));
    add('fl-sky', 4, 512, 1, (ctx) => drawSkyStrip(ctx, 512));
    add('fl-deep', 4, 256, 1, (ctx) => drawDeepStrip(ctx, 256));
    add('fl-farsea', 4, 64, 1, (ctx) => drawFarSeaStrip(ctx, 64));
    add('fl-wave', WAVE.w, WAVE.h, 2, (ctx) => drawWaveTile(ctx));
    add('fl-island', 520, 120, 1.5, (ctx) => drawIsland(ctx, 520, 120));
    for (let i = 0; i < 3; i++) add(`fl-cloud${i}`, 240, 90, 1.5, (ctx) => drawCloud(ctx, 240, 90, 31 + i * 17));
    add('fl-ray', 120, 360, 1, (ctx) => drawRay(ctx, 120, 360));
    add('fl-shadow', 96, 44, 2, (ctx) => drawFishShadow(ctx, 96, 44));
    add('fl-burst', 256, 256, 1, (ctx) => drawStarburst(ctx, 256));
    add('fl-ripple', 64, 18, 2, (ctx) => drawRipple(ctx, 64, 18));
    add('fl-drop', 8, 8, 2, (ctx) => drawDrop(ctx, 4));
    add('fl-px', 2, 2, 1, (ctx) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 2, 2);
    });
    makeFishFrames(this, 'fl-kingbob', 'kingbob', ['sw0', 'sw1', 'sw2', 'sw3', 'sw4', 'sw5', 'bl1', 'bl4'], 2);
    for (const c of CATCHES) makeFishFrames(this, `fl-fish-${c.kind}`, c.kind, ['sw0', 'sw2', 'sw4'], 1.6);
  }

  create() {
    this.makeTextures();
    const ch = characterById(this.fd.charId);
    this.heroKey = makeCastSheet(this, ch);
    this.cameras.main.setBackgroundColor('#8fd0f6');

    // ── the sky, the far-off sea and an island on the horizon ──
    const HORIZON = WATER - 74;
    this.add
      .image(-400, WORLD_TOP, 'fl-sky')
      .setOrigin(0, 0)
      .setDisplaySize(WORLD_W + 800, HORIZON - WORLD_TOP)
      .setDepth(0);
    this.add
      .image(-400, HORIZON, 'fl-farsea')
      .setOrigin(0, 0)
      .setDisplaySize(WORLD_W + 800, WATER - HORIZON + 10)
      .setDepth(0.2);
    // the sun, a soft glow (it barely moves: far away)
    this.add.image(1180, 150, 'fl-burst').setScale(1.1).setAlpha(0.55).setDepth(0.1).setScrollFactor(0.15, 0.6);
    this.add.circle(1180, 150, 40, 0xfff6c8).setDepth(0.12).setScrollFactor(0.15, 0.6);
    this.add
      .image(1500, HORIZON + 2, 'fl-island')
      .setOrigin(0.5, 1)
      .setDepth(0.15)
      .setScrollFactor(0.35, 1)
      .setAlpha(0.95);
    this.add
      .image(3000, HORIZON + 2, 'fl-island')
      .setOrigin(0.5, 1)
      .setDepth(0.15)
      .setScrollFactor(0.35, 1)
      .setScale(0.6)
      .setFlipX(true)
      .setAlpha(0.9);
    for (let i = 0; i < 7; i++) {
      const c = this.add
        .image(-200 + i * 620 + Math.random() * 200, 40 + Math.random() * 220, `fl-cloud${i % 3}`)
        .setDepth(0.13)
        .setScrollFactor(0.4, 0.8)
        .setScale(0.7 + Math.random() * 0.6)
        .setAlpha(0.95);
      this.clouds.push(c);
    }
    this.gulls = this.add.graphics().setDepth(0.3);
    for (let i = 0; i < 4; i++)
      this.gullList.push({
        x: Math.random() * 2400,
        y: 90 + Math.random() * 160,
        v: 30 + Math.random() * 30,
        ph: Math.random() * 6,
      });

    // ── the water: deep under the surface, light coming down in rays, little fish going by ──
    this.add
      .image(-400, WATER, 'fl-deep')
      .setOrigin(0, 0)
      .setDisplaySize(WORLD_W + 800, WORLD_BOTTOM - WATER + 40)
      .setDepth(1);
    for (let i = 0; i < 7; i++) {
      const r = this.add
        .image(200 + i * 520 + Math.random() * 160, WATER + 4, 'fl-ray')
        .setOrigin(0.5, 0)
        .setDepth(1.2)
        .setAlpha(0.22 + Math.random() * 0.12)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(1 + Math.random() * 0.6, 1);
      this.rays.push(r);
    }
    for (let i = 0; i < 9; i++) {
      const y0 = WATER + 120 + Math.random() * 220;
      const img = this.add
        .image(Math.random() * WORLD_W, y0, 'fl-shadow')
        .setDepth(1.3)
        .setAlpha(0.22 + Math.random() * 0.12)
        .setScale(0.35 + Math.random() * 0.3);
      const v = (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 30);
      img.setFlipX(v < 0);
      this.schools.push({ img, v, y0, ph: Math.random() * 6 });
    }

    // ── the boat, King Bob in his bowl, the cooler, the hero ──
    this.boat = this.add
      .image(0, 0, 'fl-boat')
      .setScale(1 / 1.5)
      .setDepth(4);
    // (the hull's shadow down in the water under it)
    this.add
      .image(BOAT_X + BOAT.w * 0.46, WATER + 64, 'fl-hullshadow')
      .setDisplaySize(BOAT.w * 1.05, 150)
      .setDepth(1.25)
      .setAlpha(0.8);
    this.cooler = this.add
      .image(0, 0, 'fl-cooler')
      .setScale(1 / 2)
      .setOrigin(0.5, 1)
      .setDepth(4.2);
    this.bucket = this.add.image(0, 0, 'fl-cooler').setScale(0.42).setOrigin(0.5, 1).setDepth(4.15).setTint(0xffe28a);
    this.bowlBack = this.add
      .image(0, 0, 'fl-bowl-back')
      .setScale(1 / 2)
      .setOrigin(0.5, 1)
      .setDepth(4.3);
    this.kingSpr = this.add
      .sprite(0, 0, 'fl-kingbob', 'sw0')
      .setScale(0.95 / 2)
      .setDepth(4.35);
    this.bowlFront = this.add
      .image(0, 0, 'fl-bowl-front')
      .setScale(1 / 2)
      .setOrigin(0.5, 1)
      .setDepth(4.4);
    this.heroScale = (HERO_K / ART_RES) * ch.scale;
    this.hero = this.add.sprite(0, 0, this.heroKey, 'c5').setOrigin(0.5, 1).setScale(this.heroScale).setDepth(5);

    // the near surface (it laps over the hull at the waterline), then the water's tint over all that's under it
    for (const [y, a, d, sp] of [
      [WATER - WAVE.top - 6, 0.55, 3.9, 0.6],
      [WATER - WAVE.top, 1, 6, 1],
    ] as const) {
      const w = this.add
        .tileSprite(-400, y, WORLD_W + 800, WAVE.h, 'fl-wave')
        .setOrigin(0, 0)
        .setTileScale(0.5, 0.5)
        .setDepth(d)
        .setAlpha(a);
      w.setData('sp', sp);
      this.waves.push(w);
    }
    this.add
      .image(-400, WATER + 22, 'fl-px')
      .setOrigin(0, 0)
      .setDisplaySize(WORLD_W + 800, WORLD_BOTTOM - WATER)
      .setTint(0x0d5f92)
      .setAlpha(0.3)
      .setDepth(6.4);

    // the rods and the lines (drawn every frame), the bobbers
    this.rods = this.add.graphics().setDepth(7);
    for (const who of ['hero', 'king'] as const) {
      const img = this.add
        .image(0, 0, who === 'king' ? 'fl-bobber-gold' : 'fl-bobber')
        .setScale(1 / 3)
        .setDepth(7.2);
      this.lures[who] = {
        who,
        img,
        x: 0,
        y: 0,
        px: 0,
        py: 0,
        vx: 0,
        vy: 0,
        mode: 'held',
        dip: 0,
        spin: 0,
      };
    }
    this.confettiFx = new SimpleConfetti(this, 12);
    this.placeBoat();
    for (const who of ['hero', 'king'] as const) this.hangLure(who);

    // ── the HUD: the scoreboard, the cast meter, the BITE button, the call-outs ──
    this.dom = document.createElement('div');
    this.dom.className = 'hoops fishing';
    this.dom.innerHTML = `
      <div class="fsh-board" hidden>
        <div class="tv-head"><i class="tv-logo"></i><span class="tv-title"><small>KING BOB'S</small>FISH-OFF</span><span class="tv-live"><i></i>LIVE</span></div>
        <div class="fsh-row" data-who="hero"><img class="tv-face" alt=""><span class="fsh-name">${ch.name.toUpperCase()}</span><span class="fsh-dots"></span><b class="fsh-total">0</b></div>
        <div class="fsh-row" data-who="king"><img class="tv-face" alt=""><span class="fsh-name">KING BOB</span><span class="fsh-dots"></span><b class="fsh-total">0</b></div>
        <div class="tv-foot"><span class="fsh-round"></span><span class="tv-best"></span></div>
      </div>
      <div class="tv-ticker" hidden><b>REEL ROYAL TV</b><div class="tv-crawl"><span></span></div></div>
      <div class="hoops-meters fsh-meter" hidden>
        <div class="hm" data-m="power"><b>Cast</b><div class="hm-bar"><i class="hm-zone"></i><i class="hm-mark"></i></div></div>
        <p class="hm-hint">${usingTouch() ? 'Tap' : 'Press Space or click'} to stop the marker in the green!</p>
      </div>
      <button class="fsh-bite" hidden aria-label="Bite: strike now"><svg class="fb-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" pathLength="100"></circle></svg><b>BITE!</b></button>
      <div class="fsh-callout"></div>
      <div class="fsh-catch" hidden><em></em><div class="lt"><small></small><b></b><span></span></div></div>
      <button class="hoops-skip" hidden>Skip ›</button>`;
    document.getElementById('ui')!.appendChild(this.dom);
    window.addEventListener('pointerdown', this.tapListener);
    this.drawPortraits();
    const bite = this.dom.querySelector<HTMLButtonElement>('.fsh-bite')!;
    bite.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.biteHit = true;
    });
    const skip = this.dom.querySelector<HTMLButtonElement>('.hoops-skip')!;
    skip.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.inIntro) this.skipping = true;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('pointerdown', this.tapListener);
      this.dom.remove();
    });
    (window as unknown as { __fishing: FishingScene }).__fishing = this;
    this.game.events.emit('fishing-start', this);
    this.fitCamera(true);
    void this.run();
  }

  // ───────────────────────────────────────────── helpers ──

  private wait(ms: number) {
    return new Promise<void>((res) => this.waits.push({ at: this.clock + ms, res }));
  }
  /** A wait the intro's Skip cuts short. */
  private async iwait(ms: number) {
    const end = this.clock + ms;
    while (this.clock < end && !this.skipping) await this.wait(Math.min(50, end - this.clock));
  }
  /** Tween something on the scene clock; resolves when it's done. */
  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((res) => this.tweens.add({ ...cfg, onComplete: () => res() }));
  }
  /** Ease a number on an object to a value over ms (the scene clock). */
  private to<T extends object>(obj: T, key: keyof T & string, value: number, ms: number, ease = 'Sine.easeInOut') {
    // (waits on the scene clock, not the tween's completion: a tween killed or finished early never hangs it)
    this.tweens.killTweensOf(obj);
    this.tweens.add({ targets: obj, [key]: value, duration: ms, ease });
    return this.wait(ms + 10);
  }

  private tapPressed() {
    let key = isKeyDown('Space') || isKeyDown('Enter') || isKeyDown('KeyF') || isKeyDown('KeyJ') || isKeyDown('ArrowUp') || isKeyDown('KeyW');
    for (const g of gamepadSources) if (g.connected()) key ||= g.poll().jump || g.poll().fire;
    const pressed = this.tapped || (key && !this.prevKey);
    this.prevKey = key;
    this.tapped = false;
    return pressed;
  }

  /** A point on the boat (picture coords) → the world, with the boat's rock and bob. */
  private onBoat(bx: number, by: number) {
    const px = BOAT_X + BOAT.w / 2;
    const py = WATER;
    const x = BOAT_X + bx - px;
    const y = BOAT_Y + by - py;
    const c = Math.cos(this.rock);
    const s = Math.sin(this.rock);
    return { x: px + x * c - y * s, y: py + this.bob + x * s + y * c };
  }

  private placeBoat() {
    const p = this.onBoat(BOAT.w / 2, BOAT.h / 2);
    this.boat.setPosition(p.x, p.y).setRotation(this.rock);
    const c = this.onBoat(BOAT.cooler, BOAT.deck + 2);
    this.cooler.setPosition(c.x, c.y).setRotation(this.rock);
    const bk = this.onBoat(BOAT.king - 92, BOAT.deck + 2);
    this.bucket.setPosition(bk.x, bk.y).setRotation(this.rock);
    const b = this.onBoat(BOAT.king, BOAT.deck + 4);
    this.bowlBack.setPosition(b.x, b.y).setRotation(this.rock);
    this.bowlFront.setPosition(b.x, b.y).setRotation(this.rock);
    // King Bob in his water, swaying a little
    const kc = this.onBoat(BOAT.king + 2, BOAT.deck + 4 - BOWL.h + BOWL.cy + 8 + Math.sin(this.clock / 700) * 3);
    this.kingSpr.setPosition(kc.x, kc.y).setRotation(this.rock + Math.sin(this.clock / 900) * 0.05);
    const h = this.onBoat(BOAT.hero, BOAT.deck + 2);
    this.hero.setPosition(h.x, h.y).setRotation(this.rock);
  }

  /** The hero's hands (world), from the frame shown. */
  private heroHands(frameA: number) {
    const k = this.heroScale * ART_RES;
    const id = characterById(this.fd.charId).id;
    const [hx, hy] = carryHand(id, frameA);
    const dx = (hx + HERO_SHEET_M - (CHAR_W + HERO_SHEET_M * 2) / 2) * k;
    const dy = (hy - CHAR_H) * k;
    const c = Math.cos(this.rock);
    const s = Math.sin(this.rock);
    return {
      x: this.hero.x + dx * c - dy * s,
      y: this.hero.y + dx * s + dy * c,
    };
  }

  /** The frame (and its arm angle) nearest the hero's arm angle. */
  private castFrame() {
    let best = 0;
    for (let i = 1; i < CAST_ANGLES.length; i++) if (Math.abs(CAST_ANGLES[i] - this.arm) < Math.abs(CAST_ANGLES[best] - this.arm)) best = i;
    return { frame: `c${best}`, a: CAST_ANGLES[best] };
  }

  /** The lure back at the rod tip, hanging. */
  private hangLure(who: Who) {
    this.updateRods(0);
    const L = this.lures[who];
    const t = this.rod[who].tip;
    L.mode = 'held';
    L.x = L.px = t.x;
    L.y = L.py = t.y + 30;
    L.vx = L.vy = 0;
    L.dip = 0;
    L.img.setVisible(true).setDepth(7.2);
  }

  // ───────────────────────────────────────────── the camera ──

  private fitCamera(snap = false) {
    const cam = this.cameras.main;
    this.baseZoom = Math.max(this.scale.width / 1280, this.scale.height / 720);
    const z = this.baseZoom * this.cam.zoom;
    const k = snap ? 1 : 1 - Math.exp(-Math.min(0.1, this.game.loop.delta / 1000) * this.camK);
    const zoom = cam.zoom + (z - cam.zoom) * k;
    cam.setZoom(zoom);
    const vw = this.scale.width / zoom;
    const vh = this.scale.height / zoom;
    const cx = cam.midPoint.x + (this.cam.x - cam.midPoint.x) * k;
    const cy = cam.midPoint.y + (this.cam.y - cam.midPoint.y) * k;
    const x = Phaser.Math.Clamp(snap ? this.cam.x : cx, -380 + vw / 2, WORLD_W + 380 - vw / 2);
    const y = Phaser.Math.Clamp(snap ? this.cam.y : cy, WORLD_TOP + vh / 2, WORLD_BOTTOM - vh / 2);
    cam.centerOn(x, y);
  }

  /** Frame the boat (the stern, King Bob and the sea just off it). */
  private shotBoat(zoom = 1) {
    this.cam = { x: BOAT_X + BOAT.hero - 110, y: WATER - 70, zoom };
  }
  /** Frame the hero's line: from the boat out to the bobber. */
  private shotLine(who: Who = 'hero') {
    const L = this.lures[who];
    const x0 = BOAT_X + (who === 'hero' ? BOAT.hero : BOAT.king) - 160;
    const span = Math.max(500, L.x - x0 + 220);
    const zoom = Phaser.Math.Clamp(1280 / span, 0.6, 1.05);
    this.cam = {
      x: (x0 + L.x + 120) / 2,
      y: WATER - 60 + (1 - zoom) * 60,
      zoom,
    };
  }

  // ───────────────────────────────────────────── frame loop ──

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50);
    const s = dt / 1000;
    this.clock += dt;
    const due = this.waits.filter((w) => w.at <= this.clock);
    this.waits = this.waits.filter((w) => w.at > this.clock);
    due.forEach((w) => w.res());

    // the sea: the boat rocks and bobs, the waves roll by
    const t = this.clock / 1000;
    this.rock = Math.sin(t * 1.05) * 0.012 + Math.sin(t * 0.47 + 1) * 0.006;
    this.bob = Math.sin(t * 1.3) * 3.2;
    for (const w of this.waves) w.tilePositionX += s * 22 * (w.getData('sp') as number);
    for (const c of this.clouds) {
      c.x += s * 6;
      if (c.x > WORLD_W + 600) c.x = -500;
    }
    this.rays.forEach((r, i) => r.setRotation(Math.sin(t * 0.3 + i) * 0.08));
    for (const f of this.schools) {
      f.img.x += f.v * s;
      f.img.y = f.y0 + Math.sin(t * 0.8 + f.ph) * 10;
      if (f.img.x > WORLD_W + 200) f.img.x = -300;
      if (f.img.x < -300) f.img.x = WORLD_W + 200;
    }
    this.drawGulls(t, s);

    // the anglers
    this.placeBoat();
    const cf = this.castFrame();
    this.hero.setFrame(this.heroPose ?? cf.frame);
    const kf = Math.floor(t * 5) % 6;
    this.kingSpr.setFrame(Math.floor(t * 0.7) % 5 === 0 && t % 1.4 < 0.15 ? 'bl1' : `sw${kf}`);
    this.updateRods(s);
    for (const who of ['hero', 'king'] as const) this.updateLure(who, s);
    this.drawRods();
    this.fitCamera();

    if (this.inIntro) {
      const canSkip = this.clock > 1800;
      this.dom.querySelector<HTMLElement>('.hoops-skip')!.hidden = !canSkip || this.skipping;
      if (canSkip && !this.skipping && (isKeyDown('Enter') || isKeyDown('Escape'))) this.skipping = true;
    }
    // the meter's marker
    if (this.meter) {
      const m = this.meter;
      m.pos += m.dir * m.speed * s;
      if (m.pos > 1) {
        m.pos = 2 - m.pos;
        m.dir = -1;
      } else if (m.pos < 0) {
        m.pos = -m.pos;
        m.dir = 1;
      }
      m.el.querySelector<HTMLElement>('.hm-mark')!.style.left = `${m.pos * 100}%`;
    }
    // BITE! can be hit with a key too
    const bite = this.dom.querySelector<HTMLElement>('.fsh-bite')!;
    if (!bite.hidden && this.tapPressed()) this.biteHit = true;
  }

  private drawGulls(t: number, s: number) {
    const g = this.gulls;
    g.clear();
    g.lineStyle(2.4, 0x3a3a48, 0.8);
    for (const b of this.gullList) {
      b.x += b.v * s;
      if (b.x > WORLD_W + 200) b.x = -200;
      const flap = Math.sin(t * 7 + b.ph) * 6;
      const y = b.y + Math.sin(t * 0.9 + b.ph) * 8;
      g.beginPath();
      g.moveTo(b.x - 12, y - flap * 0.6);
      g.lineTo(b.x - 5, y - 2 - flap * 0.2);
      g.lineTo(b.x, y);
      g.lineTo(b.x + 5, y - 2 - flap * 0.2);
      g.lineTo(b.x + 12, y - flap * 0.6);
      g.strokePath();
    }
  }

  /** Where each rod is: the hero's from their hands (the frame shown), King Bob's from his fin at the bowl's rim. */
  private updateRods(s: number) {
    const h = this.rod.hero;
    const cf = this.castFrame();
    const hands = this.heroHands(cf.a);
    h.hands = hands;
    // (the rod's a touch more upright than the arms)
    const target = this.arm - 0.5;
    h.a += (target - h.a) * Math.min(1, s * 30 || 1);
    const tipOf = (r: Rod, len: number) => {
      const a = r.a + this.rock;
      const bx = r.hands.x + Math.cos(a) * len;
      const by = r.hands.y + Math.sin(a) * len;
      // (bent: the tip pulled round, more the more it's loaded)
      const n = { x: -Math.sin(a), y: Math.cos(a) };
      // (+ : pulled round the way the rod turns going forward — by a fish, or settling after a cast; − : lagging behind a whip)
      return {
        x: bx + n.x * r.bend * len * 0.32,
        y: by + n.y * r.bend * len * 0.32,
      };
    };
    h.tip = tipOf(h, ROD_LEN);
    const k = this.rod.king;
    k.hands = this.onBoat(BOAT.king + 42, BOAT.deck + 4 - BOWL.h + 30);
    k.tip = tipOf(k, KING_ROD_LEN);
    h.reel += h.reelRate * s * Math.PI * 2;
    k.reel += k.reelRate * s * Math.PI * 2;
  }

  /** The lure: hanging from the tip (a pendulum), flying (gravity, a little drag), or floating. */
  private updateLure(who: Who, s: number) {
    const L = this.lures[who];
    const tip = this.rod[who].tip;
    if (L.mode === 'held') {
      // verlet: gravity, then the line pulls it back to within reach of the tip
      const vx = (L.x - L.px) * 0.985;
      const vy = (L.y - L.py) * 0.985;
      L.px = L.x;
      L.py = L.y;
      L.x += vx;
      L.y += vy + 900 * s * s;
      const dx = L.x - tip.x;
      const dy = L.y - tip.y;
      const d = Math.hypot(dx, dy);
      const max = 30;
      if (d > max) {
        L.x = tip.x + (dx / d) * max;
        L.y = tip.y + (dy / d) * max;
      }
      L.img.setPosition(L.x, L.y).setRotation(Math.atan2(dy, dx) - Math.PI / 2);
    } else if (L.mode === 'fly') {
      L.vy += 900 * s;
      const drag = Math.exp(-0.32 * s);
      L.vx *= drag;
      L.vy *= drag;
      L.x += L.vx * s;
      L.y += L.vy * s;
      L.spin += s * 9;
      L.img.setPosition(L.x, L.y).setRotation(L.spin);
      if (L.y >= WATER - 6 && L.vy > 0) this.landLure(L);
    } else if (L.mode === 'float' || L.mode === 'hooked') {
      const t = this.clock / 1000;
      const y = WATER - 7 + Math.sin(t * 2.4 + (who === 'king' ? 1 : 0)) * 2.5 + L.dip;
      L.y = y;
      L.img.setPosition(L.x, y).setRotation(Math.sin(t * 1.8) * 0.12);
    }
  }

  private landLure(L: Lure) {
    L.mode = 'float';
    L.y = WATER - 7;
    L.vx = L.vy = 0;
    this.splash(L.x, WATER, 10, 0.8);
    sfx.splash();
  }

  /** The rods (tapered, bending), their reels, and the lines out to the lures. */
  private drawRods() {
    const g = this.rods;
    g.clear();
    for (const who of ['king', 'hero'] as const) {
      const r = this.rod[who];
      const len = who === 'hero' ? ROD_LEN : KING_ROD_LEN;
      const a = r.a + this.rock;
      const dir = { x: Math.cos(a), y: Math.sin(a) };
      const butt = {
        x: r.hands.x - dir.x * (who === 'hero' ? ROD_BUTT : 16),
        y: r.hands.y - dir.y * (who === 'hero' ? ROD_BUTT : 16),
      };
      const mid = {
        x: r.hands.x + dir.x * len * 0.5,
        y: r.hands.y + dir.y * len * 0.5,
      };
      const P = (u: number) => {
        // butt → tip as a quadratic through the straight midpoint (so the bend shows near the tip)
        const q = 1 - u;
        return {
          x: q * q * butt.x + 2 * q * u * mid.x + u * u * r.tip.x,
          y: q * q * butt.y + 2 * q * u * mid.y + u * u * r.tip.y,
        };
      };
      // the line first (under the rod): out to the lure — or straight down to a fish on the end of it
      const L = this.lures[who];
      const dg = this.dangle[who];
      if (dg) {
        g.lineStyle(1.6, 0xffffff, 0.9);
        g.lineBetween(r.tip.x, r.tip.y, dg.x, dg.y);
      }
      if (L.mode !== 'gone') {
        const end = { x: L.x, y: L.mode === 'held' ? L.y - 10 : L.y - 6 };
        const dx = end.x - r.tip.x;
        const dy = end.y - r.tip.y;
        const dist = Math.hypot(dx, dy);
        const sag = r.taut ? 0 : L.mode === 'fly' ? Math.min(90, dist * 0.1) : L.mode === 'held' ? 0 : Math.min(70, dist * 0.08);
        g.lineStyle(1.6, 0xffffff, 0.85);
        g.beginPath();
        g.moveTo(r.tip.x, r.tip.y);
        const cx = r.tip.x + dx * 0.5;
        const cy = r.tip.y + dy * 0.5 + sag;
        for (let i = 1; i <= 16; i++) {
          const u = i / 16;
          const q = 1 - u;
          g.lineTo(q * q * r.tip.x + 2 * q * u * cx + u * u * end.x, q * q * r.tip.y + 2 * q * u * cy + u * u * end.y);
        }
        g.strokePath();
        // the hook under a floating bobber (the line on down to it, a wriggly worm on it)
        if (L.mode === 'float' || L.mode === 'hooked') {
          const hy = L.y + 46 + L.dip * 0.5;
          g.lineStyle(1.2, 0xffffff, 0.7);
          g.lineBetween(L.x, L.y + 8, L.x + 2, hy);
          g.lineStyle(2, 0x9aa4ad, 1);
          g.beginPath();
          g.arc(L.x + 2 - 4, hy, 4, 0, Math.PI, false);
          g.strokePath();
          if (L.mode === 'float') {
            g.lineStyle(3, 0xff8fa0, 1);
            g.beginPath();
            const t = this.clock / 160;
            for (let i = 0; i <= 6; i++) g.lineTo(L.x - 2 + Math.sin(t + i) * 2.5, hy - 2 + i * 2.2);
            g.strokePath();
          }
        }
      }
      // the rod: a cork handle, then the blank tapering to the tip
      const N = 14;
      for (let i = 0; i < N; i++) {
        const p0 = P(i / N);
        const p1 = P((i + 1) / N);
        const u = i / N;
        const w = who === 'hero' ? 6.2 - u * 4.8 : 5.4 - u * 4;
        const handle = u < 0.2;
        const col = handle ? 0xc89a5e : who === 'hero' ? 0x2b2f3a : 0xd9a316;
        g.lineStyle(w + 2.4, 0x2a1a12, 1);
        g.lineBetween(p0.x, p0.y, p1.x, p1.y);
        g.lineStyle(w, col, 1);
        g.lineBetween(p0.x, p0.y, p1.x, p1.y);
      }
      // a few line guides along the blank
      for (const u of [0.42, 0.62, 0.8, 0.94]) {
        const p = P(u);
        g.fillStyle(0xdfe6ec, 1);
        g.fillCircle(p.x - dir.y * 3, p.y + dir.x * 3, 1.8);
      }
      // the reel, under the rod by the hands, its handle going round
      const rc = {
        x: r.hands.x + dir.x * 10 - dir.y * 10,
        y: r.hands.y + dir.y * 10 + dir.x * 10,
      };
      g.fillStyle(0x2a1a12, 1).fillCircle(rc.x, rc.y, who === 'hero' ? 8.5 : 7.5);
      g.fillStyle(who === 'hero' ? 0xe8463f : 0xffd23f, 1).fillCircle(rc.x, rc.y, who === 'hero' ? 6.5 : 5.5);
      g.fillStyle(0xffffff, 0.8).fillCircle(rc.x - 2, rc.y - 2, 1.6);
      const ha = r.reel;
      g.lineStyle(2.4, 0x2a1a12, 1);
      g.lineBetween(rc.x, rc.y, rc.x + Math.cos(ha) * 9, rc.y + Math.sin(ha) * 9);
      g.fillStyle(0xf2f2f2, 1).fillCircle(rc.x + Math.cos(ha) * 9, rc.y + Math.sin(ha) * 9, 2.4);
    }
  }

  // ───────────────────────────────────────────── effects ──

  /** A splash at the surface: drops thrown up and out, a ring spreading. */
  private splash(x: number, y: number, n: number, k = 1) {
    for (let i = 0; i < n; i++) {
      const d = this.add
        .image(x, y, 'fl-drop')
        .setScale((0.5 + Math.random() * 0.7) * k * 0.5)
        .setDepth(9);
      const vx = (Math.random() - 0.5) * 260 * k;
      const vy = -(160 + Math.random() * 260) * k;
      const dur = 500 + Math.random() * 300;
      const obj = { t: 0 };
      this.tweens.add({
        targets: obj,
        t: 1,
        duration: dur,
        onUpdate: () => {
          const tt = (obj.t * dur) / 1000;
          d.setPosition(x + vx * tt, y + vy * tt + 0.5 * 1100 * tt * tt);
          if (d.y > y + 4) d.setAlpha(0);
        },
        onComplete: () => d.destroy(),
      });
    }
    this.ripple(x, y, 1.4 * k);
  }
  private ripple(x: number, y: number, k = 1) {
    for (let i = 0; i < 2; i++) {
      const r = this.add
        .image(x, y + 2, 'fl-ripple')
        .setScale(0.3 * k, 0.3 * k)
        .setDepth(6.2)
        .setAlpha(0.9);
      this.tweens.add({
        targets: r,
        scaleX: 1.4 * k,
        scaleY: 1.2 * k,
        alpha: 0,
        delay: i * 180,
        duration: 700,
        ease: 'Quad.easeOut',
        onComplete: () => r.destroy(),
      });
    }
  }
  private sparkle(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 60;
      const star = this.add
        .star(x, y, 4, 2, 7, 0xfff3a0)
        .setDepth(8.6)
        .setScale(0.6 + Math.random() * 0.8);
      this.tweens.add({
        targets: star,
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        alpha: 0,
        angle: 180,
        duration: 600 + Math.random() * 400,
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  // ───────────────────────────────────────────── the HUD ──

  private callout(html: string, cls = '', ms = 1300) {
    const el = this.dom.querySelector<HTMLElement>('.fsh-callout')!;
    el.className = `fsh-callout ${cls}`;
    el.innerHTML = html;
    void el.offsetWidth;
    el.classList.add('show');
    const tok = (this.calloutTok = (this.calloutTok + 1) % 1e6);
    this.time.delayedCall(ms, () => tok === this.calloutTok && el.classList.remove('show'));
    return this.wait(ms + 150);
  }
  private calloutTok = 0;

  private renderBoard(round: number) {
    const board = this.dom.querySelector<HTMLElement>('.fsh-board')!;
    board.hidden = false;
    const n = Math.max(ROUNDS, this.score.hero.length, this.score.king.length);
    for (const who of ['hero', 'king'] as const) {
      const row = board.querySelector<HTMLElement>(`[data-who=${who}]`)!;
      const s = this.score[who];
      row.querySelector('.fsh-dots')!.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < s.length ? (s[i] ? 'got' : 'miss') : ''}${i >= ROUNDS ? ' sd' : ''}"></i>`).join('');
      row.querySelector('.fsh-total')!.textContent = String(s.filter(Boolean).length);
    }
    board.querySelector('.fsh-round')!.textContent = round > ROUNDS ? 'SUDDEN DEATH' : `ROUND ${round} OF ${ROUNDS}`;
    const b = this.best;
    board.querySelector('.tv-best')!.innerHTML = b ? `BIGGEST <b>${b.lb.toFixed(1)} lb</b> ${b.who === 'king' ? 'King Bob' : 'You'}` : 'BIGGEST <b>—</b>';
    this.tickerOn();
  }

  /** The biggest fish caught so far (for the scoreboard's footer and the ticker). */
  private best: { who: Who; name: string; lb: number } | null = null;
  /** News for the ticker: the latest catches first. */
  private news: string[] = [];
  /** A catch: onto the board (if it's the biggest) and the ticker. */
  private logCatch(who: Who, name: string, lb: number) {
    if (!this.best || lb > this.best.lb) this.best = { who, name, lb };
    const by = who === 'king' ? 'KING BOB' : characterById(this.fd.charId).name.toUpperCase();
    this.news.unshift(`${by} LANDS A ${lb.toFixed(1)} LB ${name.toUpperCase()}!`);
    this.news.length = Math.min(this.news.length, 3);
    this.tickerOn(true);
  }
  /** The news crawl along the bottom (redone when there's news). */
  private tickerOn(fresh = false) {
    const t = this.dom.querySelector<HTMLElement>('.tv-ticker')!;
    const span = t.querySelector<HTMLElement>('.tv-crawl span')!;
    if (!t.hidden && !fresh) return;
    t.hidden = false;
    const items = [
      ...this.news,
      'WATER 72°F',
      'WIND NE 6 KNOTS',
      'SEAS 1–2 FT',
      'KING BOB: 312 CONTESTS, 312 WINS',
      'PRO TIP: STOP THE MARKER IN THE GREEN FOR MORE BITES',
      'THE BITES DON’T WAIT — STRIKE FAST!',
    ];
    span.textContent = items.join('   ◆   ') + '   ◆   ';
    span.style.animation = 'none';
    void span.offsetWidth;
    span.style.animation = '';
  }

  /** The faces on the scoreboard: the hero (as they are on the boat) and King Bob, drawn small. */
  private drawPortraits() {
    const ch = characterById(this.fd.charId);
    const mk = (w: number, h: number, fn: (ctx: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas');
      c.width = w * 2;
      c.height = h * 2;
      const ctx = c.getContext('2d')!;
      ctx.scale(2, 2);
      fn(ctx);
      return c.toDataURL();
    };
    const hero = mk(40, 40, (ctx) => {
      // (the head and shoulders: the top of the frame)
      ctx.translate(-8, 2);
      drawCharacter(ctx, 0, 0, ch, 'idle0', undefined, fishingWear());
    });
    const king = mk(40, 40, (ctx) => {
      ctx.scale(0.5, 0.5);
      ctx.translate(-14, -8);
      drawFish(ctx, 0, 0, 'kingbob', 'sw0');
    });
    this.dom.querySelector<HTMLImageElement>('[data-who=hero] .tv-face')!.src = hero;
    this.dom.querySelector<HTMLImageElement>('[data-who=king] .tv-face')!.src = king;
  }
  private total(who: Who) {
    return this.score[who].filter(Boolean).length;
  }

  private meter: null | {
    pos: number;
    dir: number;
    speed: number;
    zone: [number, number];
    el: HTMLElement;
  } = null;
  /** The cast meter: the marker runs back and forth; stop it in the green. Gives where it stopped and how far off the green. */
  private async lockMeter(speed: number, zoneW: number) {
    const box = this.dom.querySelector<HTMLElement>('.fsh-meter')!;
    box.hidden = false;
    const el = box.querySelector<HTMLElement>('[data-m=power]')!;
    el.classList.add('active');
    el.classList.remove('locked');
    const c = 0.35 + Math.random() * 0.5;
    const zone: [number, number] = [c - zoneW / 2, c + zoneW / 2];
    const z = el.querySelector<HTMLElement>('.hm-zone')!;
    z.style.left = `${zone[0] * 100}%`;
    z.style.width = `${zoneW * 100}%`;
    this.meter = { pos: Math.random() * 0.15, dir: 1, speed, zone, el };
    await this.wait(250);
    this.tapped = false;
    for (;;) {
      await this.wait(16);
      if (this.tapPressed()) break;
    }
    const m = this.meter!;
    this.meter = null;
    el.classList.remove('active');
    el.classList.add('locked');
    sfx.select();
    const off = m.pos < zone[0] ? zone[0] - m.pos : m.pos > zone[1] ? m.pos - zone[1] : 0;
    this.time.delayedCall(500, () => {
      box.hidden = true;
      el.classList.remove('locked');
    });
    return { pos: m.pos, off };
  }

  /** The BITE! button: up somewhere over the water, fading fast. Resolves true if it was hit in time. */
  private async biteButton(): Promise<boolean> {
    const b = this.dom.querySelector<HTMLElement>('.fsh-bite')!;
    // (somewhere over the sea, clear of the scoreboard and the hero)
    const x = 38 + Math.random() * 44;
    const y = 30 + Math.random() * 38;
    b.style.left = `${x}%`;
    b.style.top = `${y}%`;
    b.style.setProperty('--life', `${BITE_MS}ms`);
    b.hidden = false;
    b.classList.remove('go', 'hit');
    void b.offsetWidth;
    b.classList.add('go');
    this.biteHit = false;
    this.tapped = false;
    this.prevKey = true;
    const end = this.clock + BITE_MS;
    while (this.clock < end && !this.biteHit) await this.wait(16);
    const hit = this.biteHit;
    this.biteHit = false;
    if (hit) {
      b.classList.add('hit');
      await this.wait(160);
    }
    b.hidden = true;
    b.classList.remove('go', 'hit');
    return hit;
  }

  // ───────────────────────────────────────────── the contest ──

  private async run() {
    playHoops();
    this.inIntro = true;
    stingerTitle(`<div><div class="crown"></div><small>KING BOB'S</small><strong>FISHING<br>CONTEST</strong><em>ON THE REEL ROYAL</em></div>`);
    sfx.drum();
    // (the camera starts out over the open sea and drifts back to the boat)
    this.cam = { x: 2000, y: WATER - 120, zoom: 0.9 };
    this.fitCamera(true);
    await this.iwait(1300);
    void stingerReveal();
    this.camK = 1.1;
    this.shotBoat(1.25);
    this.cam.x = BOAT_X + BOAT.king + 40;
    await this.iwait(2200);
    await this.kingSays('Nobody out-fishes the King!', 1900);
    this.camK = 2.2;
    this.shotBoat(1);
    await this.iwait(700);
    this.inIntro = false;
    this.skipping = false;
    this.dom.querySelector<HTMLElement>('.hoops-skip')!.hidden = true;
    this.game.events.emit('fishing-play');

    for (let round = 1; ; round++) {
      this.renderBoard(round);
      await this.callout(round > ROUNDS ? `SUDDEN DEATH<small>Round ${round}</small>` : `ROUND ${round}<small>of ${ROUNDS}</small>`, 'turn', 1100);
      this.score.hero.push(await this.heroTurn(round));
      this.renderBoard(round);
      if (this.decided(round, 'hero')) break;
      this.score.king.push(await this.kingTurn());
      this.renderBoard(round);
      if (this.decided(round, 'king')) break;
    }
    const you = this.total('hero');
    const king = this.total('king');
    if (you > king) await this.youWin();
    else await this.kingWins();
  }

  /** Is it over, after `who` has gone in this round? (Out of reach in the six, or sudden death settled.) */
  private decided(round: number, who: Who) {
    const y = this.total('hero');
    const k = this.total('king');
    if (round <= ROUNDS) {
      const yLeft = ROUNDS - this.score.hero.length;
      const kLeft = ROUNDS - this.score.king.length;
      if (y + yLeft < k || k + kLeft < y) return true;
      return round === ROUNDS && who === 'king' && y !== k;
    }
    return who === 'king' && y !== k;
  }

  /** King Bob says something (a bubble over his bowl). */
  private async kingSays(text: string, ms: number) {
    // (up to the right of his bowl, the tail pointing in at him: clear of the scoreboard in the corner)
    const at = this.onBoat(BOAT.king + 48, BOAT.deck - BOWL.h + 30);
    const t = this.add
      .text(0, 0, text, { fontFamily: 'Nunito, sans-serif', fontSize: '17px', fontStyle: '900', color: '#3a2418', align: 'center', wordWrap: { width: 200 } })
      .setOrigin(0.5)
      .setDepth(11)
      .setResolution(3);
    const w = t.width + 26;
    const h = t.height + 16;
    const bx = at.x + w / 2 + 18;
    const by = at.y - h / 2 - 34;
    t.setPosition(bx, by);
    const g = this.add.graphics().setDepth(10.9);
    g.fillStyle(0xffffff, 1).lineStyle(3, 0x3a2418, 1);
    g.fillRoundedRect(bx - w / 2, by - h / 2, w, h, 12).strokeRoundedRect(bx - w / 2, by - h / 2, w, h, 12);
    const tx = bx - w / 2 + 16;
    const ty = by + h / 2 - 2;
    g.fillTriangle(tx - 10, ty, tx + 6, ty, at.x, at.y);
    g.lineBetween(tx - 10, ty + 1, at.x, at.y).lineBetween(tx + 6, ty + 1, at.x, at.y);
    for (const o of [t, g]) {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 160 });
    }
    sfx.bloop();
    await this.wait(ms);
    t.destroy();
    g.destroy();
  }

  // ── your turn ──

  private async heroTurn(round: number): Promise<boolean> {
    const L = this.lures.hero;
    this.shotBoat(1.12);
    this.cam.x = BOAT_X + BOAT.hero + 140;
    // (a little higher: the rod's tip in the shot)
    this.cam.y = WATER - 120;
    this.arm = -0.85;
    this.hangLure('hero');
    await this.callout('YOUR CAST', 'you', 900);
    // the meter: a little quicker and a little narrower as the contest goes on
    const n = Math.min(round, ROUNDS) - 1;
    const { pos, off } = await this.lockMeter(1.05 + n * 0.08, Math.max(0.1, 0.17 - n * 0.012));
    const bites = off === 0 ? 6 : off <= 0.05 ? 5 : off <= 0.12 ? 4 : 3;
    const power = 0.25 + pos * 0.75;
    await this.heroCast(power);
    this.callout(
      bites === 6 ? 'PERFECT CAST!<small>6 bites</small>' : bites === 5 ? 'GREAT CAST!<small>5 bites</small>' : bites === 4 ? 'GOOD CAST<small>4 bites</small>' : 'WEAK CAST<small>3 bites</small>',
      bites >= 5 ? 'good' : bites === 3 ? 'bad' : '',
      1300,
    );
    // ── reeling in: the bites come, one after another, as the bobber comes back in ──
    const r = this.rod.hero;
    r.reelRate = 0.9;
    this.heroPose = null;
    this.arm = -0.5;
    const startX = L.x;
    const endX = BOAT_X + BOAT.motor + 80;
    const gaps = Array.from({ length: bites }, () => 1100 + Math.random() * 700);
    const total = gaps.reduce((a, b) => a + b, 0) + 900;
    const t0 = this.clock;
    const reelTo = () => {
      const u = Math.min(1, (this.clock - t0) / total);
      L.x = startX + (endX - startX) * u;
    };
    const reelFor = async (ms: number) => {
      const end = this.clock + ms;
      while (this.clock < end) {
        reelTo();
        this.shotLine('hero');
        this.heroPose = Math.floor(this.clock / 140) % 2 ? 'r1' : 'r0';
        await this.wait(16);
      }
    };
    for (let i = 0; i < bites; i++) {
      // a fish's shadow comes over to the hook while you reel
      const fish = this.add
        .image(L.x + (Math.random() < 0.5 ? -1 : 1) * 320, WATER + 130 + Math.random() * 60, 'fl-shadow')
        .setDepth(5.5)
        .setAlpha(0);
      const fromLeft = fish.x < L.x;
      fish.setFlipX(!fromLeft).setScale(0.7 + Math.random() * 0.4);
      this.tweens.add({ targets: fish, alpha: 0.85, duration: 300 });
      const approach = gaps[i] - 300;
      const tA = this.clock;
      const sx = fish.x;
      const sy = fish.y;
      while (this.clock - tA < approach) {
        reelTo();
        this.shotLine('hero');
        this.heroPose = Math.floor(this.clock / 140) % 2 ? 'r1' : 'r0';
        const u = Phaser.Math.Easing.Sine.InOut(Math.min(1, (this.clock - tA) / approach));
        fish.x = sx + (L.x + (fromLeft ? -34 : 34) - sx) * u;
        fish.y = sy + (WATER + 52 - sy) * u + Math.sin(this.clock / 180) * 3;
        await this.wait(16);
      }
      // nibble, nibble… BITE
      for (let k = 0; k < 2; k++) {
        L.dip = 5;
        fish.x += fromLeft ? 6 : -6;
        this.ripple(L.x, WATER, 0.5);
        await this.wait(150);
        L.dip = 0;
        fish.x -= fromLeft ? 6 : -6;
        await this.wait(170 + Math.random() * 120);
      }
      L.dip = 16;
      r.bend = 0.35;
      this.ripple(L.x, WATER, 1);
      sfx.bloop();
      const hit = await this.biteButton();
      if (hit) {
        // strike! the rod snaps up
        this.heroPose = null;
        this.arm = -1.55;
        r.bend = 0.6;
        sfx.whoosh();
        await this.wait(140);
        if (Math.random() < ((window as unknown as { __fishOdds?: number }).__fishOdds ?? CATCH)) {
          await this.heroCatch(fish);
          return true;
        }
        // …it's off: the fish bolts
        L.dip = 0;
        r.bend = 0;
        this.arm = -0.5;
        this.callout('MISSED!', 'bad small', 700);
        this.tweens.add({
          targets: fish,
          x: fish.x + (fromLeft ? -420 : 420),
          y: fish.y + 80,
          alpha: 0,
          duration: 450,
          ease: 'Quad.easeIn',
          onComplete: () => fish.destroy(),
        });
        this.bubbles(L.x, WATER + 50, 6);
      } else {
        // too slow: it takes the bait and goes
        L.dip = 0;
        r.bend = 0;
        this.callout('TOO SLOW!', 'bad small', 700);
        this.tweens.add({
          targets: fish,
          x: fish.x + (fromLeft ? -360 : 360),
          alpha: 0,
          duration: 900,
          ease: 'Sine.easeIn',
          onComplete: () => fish.destroy(),
        });
      }
      await reelFor(260);
    }
    // the last of it in, no fish
    await reelFor(Math.max(0, total - (this.clock - t0)));
    r.reelRate = 0;
    this.heroPose = null;
    await this.callout('NO FISH<small>this time</small>', 'bad', 1000);
    this.arm = -0.85;
    this.hangLure('hero');
    return false;
  }

  /** The cast: wind back, a beat, whip forward (the lure leaves the tip at the release), and the line pays out. */
  private async heroCast(power: number) {
    const L = this.lures.hero;
    const r = this.rod.hero;
    // wind back over the shoulder
    this.camK = 2.5;
    r.bend = 0.12;
    await this.to(this as unknown as Record<string, number>, 'arm', -2.6, 420, 'Sine.easeInOut');
    r.bend = 0;
    await this.wait(120);
    // the whip: forward hard; the rod loads (the tip lags behind), and lets go about halfway
    sfx.whoosh();
    const tw = this.tweens.add({
      targets: this,
      arm: 0.1,
      duration: 260,
      ease: 'Cubic.easeIn',
    });
    r.bend = -0.5;
    while (this.arm < -1.0) await this.wait(8);
    // release: off it goes, out over the sea
    const a = -0.68 - power * 0.1;
    const v = 560 + power * 820;
    L.mode = 'fly';
    L.x = r.tip.x;
    L.y = r.tip.y;
    L.vx = Math.cos(a) * v;
    L.vy = Math.sin(a) * v;
    L.spin = 0;
    r.reelRate = -3;
    while (!tw.isFinished() && !tw.isDestroyed()) await this.wait(16);
    r.bend = 0.3;
    this.tweens.add({
      targets: r,
      bend: 0,
      duration: 700,
      ease: 'Elastic.easeOut',
    });
    this.to(this as unknown as Record<string, number>, 'arm', -0.5, 500);
    // follow the lure through the air
    this.camK = 4;
    while (L.mode === 'fly') {
      this.cam = {
        x: Math.max(BOAT_X + BOAT.hero + 200, L.x - 120),
        y: Math.min(WATER - 80, L.y + 60),
        zoom: 0.92,
      };
      await this.wait(16);
    }
    r.reelRate = 0;
    this.camK = 2;
    this.shotLine('hero');
    await this.wait(450);
  }

  private bubbles(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const b = this.add.circle(x + (Math.random() - 0.5) * 30, y + Math.random() * 20, 2 + Math.random() * 3, 0xffffff, 0.55).setDepth(5.6);
      this.tweens.add({
        targets: b,
        y: WATER + 4,
        x: b.x + (Math.random() - 0.5) * 20,
        alpha: 0.2,
        duration: 600 + Math.random() * 500,
        ease: 'Sine.easeIn',
        onComplete: () => b.destroy(),
      });
    }
  }

  /**
   * Fish on! It fights (the rod bends right over, the line goes tight, it thrashes about), leaps clean
   * out of the water halfway in, and comes up over the side on the line — held up in the light, its
   * name and weight — then into the cooler.
   */
  private async heroCatch(shadow: Phaser.GameObjects.Image) {
    const L = this.lures.hero;
    const r = this.rod.hero;
    const c = pickCatch();
    const lb = Math.round((c.lb[0] + Math.random() * (c.lb[1] - c.lb[0])) * 10) / 10;
    const { w } = FISH_SIZE[c.kind];
    const fish = this.add
      .sprite(shadow.x, shadow.y, `fl-fish-${c.kind}`, 'sw0')
      .setScale(c.k / 1.6)
      .setDepth(5.55);
    shadow.destroy();
    L.mode = 'hooked';
    r.taut = true;
    r.reelRate = 3.2;
    this.heroPose = null;
    this.arm = -1.2;
    sfx.splash();
    this.splash(L.x, WATER, 12, 0.9);
    this.callout('FISH ON!', 'good', 900);
    this.camK = 3;
    // the fight: in towards the boat, thrashing, the rod bending
    const x0 = L.x;
    const xEnd = BOAT_X + BOAT.motor + 90;
    const dur = 2300;
    const t0 = this.clock;
    let leapt = false;
    let frameT = 0;
    while (this.clock - t0 < dur) {
      const u = (this.clock - t0) / dur;
      const thrash = Math.sin(this.clock / 70) * 18 * (1 - u * 0.5);
      L.x = x0 + (xEnd - x0) * Phaser.Math.Easing.Sine.InOut(u);
      L.dip = 14 + Math.sin(this.clock / 90) * 6;
      r.bend = 0.75 + Math.sin(this.clock / 80) * 0.18;
      this.arm = -1.25 + Math.sin(this.clock / 110) * 0.12;
      fish.setPosition(L.x + thrash, WATER + 60 + Math.cos(this.clock / 85) * 10);
      fish.setFlipX(Math.sin(this.clock / 260) > 0).setRotation(Math.sin(this.clock / 60) * 0.35);
      frameT += 16;
      fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(frameT / 60) % 3]);
      if (Math.random() < 0.2) this.bubbles(fish.x, fish.y, 1);
      if (Math.random() < 0.06) this.ripple(L.x + thrash, WATER, 0.6);
      this.cam = {
        x: (BOAT_X + BOAT.hero + L.x) / 2 + 60,
        y: WATER - 70,
        zoom: Phaser.Math.Clamp(1280 / (L.x - BOAT_X - BOAT.hero + 520), 0.7, 1.15),
      };
      // halfway: it LEAPS clean out of the water
      if (!leapt && u > 0.42) {
        leapt = true;
        await this.leap(fish, L);
      }
      await this.wait(16);
    }
    // the last pull: up and over the side, swinging on the line
    sfx.whoosh();
    sfx.splash();
    this.splash(L.x, WATER, 16, 1.1);
    this.arm = -1.2;
    r.bend = 0.3;
    r.reelRate = 0;
    L.mode = 'gone';
    L.img.setVisible(false);
    fish.setDepth(8.4).setFlipX(false);
    this.arm = -0.85;
    // (hung by the mouth, nose up: its middle half its length under the hook)
    const hang = () => ({ x: r.tip.x, y: r.tip.y + 18 + w * c.k * 0.62 });
    this.camK = 3.2;
    this.cam = { x: this.hero.x + 70, y: this.hero.y - 150, zoom: 1.6 };
    const from = { x: fish.x, y: fish.y };
    const arc = { t: 0 };
    await this.tw({
      targets: arc,
      t: 1,
      duration: 650,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        const to = hang();
        fish.setPosition(from.x + (to.x - from.x) * arc.t, from.y + (to.y - from.y) * arc.t - Math.sin(arc.t * Math.PI) * 120);
        this.dangle.hero = this.mouthOf(fish);
        fish.setRotation(arc.t * Math.PI * 2 - (Math.PI / 2) * arc.t);
      },
    });
    // the show: held up on the line in a burst of light
    this.heroPose = 'j0';
    this.arm = -0.85;
    const burst = this.add.image(fish.x, fish.y, 'fl-burst').setDepth(8.2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0.9);
    this.tweens.add({
      targets: burst,
      scale: 1.6,
      duration: 500,
      ease: 'Back.easeOut',
    });
    this.tweens.add({ targets: burst, angle: 360, duration: 8000, repeat: -1 });
    this.tweens.add({
      targets: fish,
      scale: fish.scale * 1.25,
      duration: 300,
      ease: 'Back.easeOut',
    });
    this.sparkle(fish.x, fish.y, 14);
    sfx.cheer();
    sfx.kaching();
    this.camK = 3;
    const card = this.dom.querySelector<HTMLElement>('.fsh-catch')!;
    card.querySelector('em')!.textContent = c.rare ? 'RARE CATCH!' : 'FISH ON THE BOARD!';
    card.querySelector('small')!.textContent = `${characterById(this.fd.charId).name} lands a`;
    this.logCatch('hero', c.name, lb);
    card.querySelector('b')!.textContent = c.name;
    card.querySelector('span')!.textContent = `${lb.toFixed(1)} lb`;
    card.classList.toggle('rare', !!c.rare);
    card.hidden = false;
    card.classList.remove('show');
    void card.offsetWidth;
    card.classList.add('show');
    const tShow = this.clock;
    while (this.clock - tShow < 2300) {
      const p = hang();
      const sw = Math.sin(this.clock / 140) * 0.35;
      fish.setPosition(p.x + Math.sin(this.clock / 260) * 4, p.y).setRotation(-Math.PI / 2 + sw);
      this.dangle.hero = this.mouthOf(fish);
      fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.clock / 90) % 3]);
      burst.setPosition(fish.x, fish.y);
      this.cam = {
        x: (this.hero.x + fish.x) / 2 + 20,
        y: fish.y + 40,
        zoom: 1.6,
      };
      if (Math.random() < 0.08) this.sparkle(fish.x, fish.y, 2);
      // (a drip now and then)
      if (Math.random() < 0.12) {
        const d = this.add
          .image(fish.x + (Math.random() - 0.5) * 20, fish.y + w * c.k * 0.4, 'fl-drop')
          .setScale(0.4)
          .setDepth(8.5);
        this.tweens.add({
          targets: d,
          y: d.y + 120,
          alpha: 0,
          duration: 500,
          ease: 'Quad.easeIn',
          onComplete: () => d.destroy(),
        });
      }
      await this.wait(16);
    }
    card.classList.remove('show');
    this.tweens.add({
      targets: burst,
      alpha: 0,
      scale: 0.4,
      duration: 300,
      onComplete: () => burst.destroy(),
    });
    // into the cooler
    this.cooler.setTexture('fl-cooler-open');
    const cool = this.onBoat(BOAT.cooler, BOAT.deck - 30);
    const f0 = { x: fish.x, y: fish.y };
    const s0 = fish.scale;
    const arc2 = { t: 0 };
    sfx.whoosh();
    await this.tw({
      targets: arc2,
      t: 1,
      duration: 520,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        fish.setPosition(f0.x + (cool.x - f0.x) * arc2.t, f0.y + (cool.y - f0.y) * arc2.t - Math.sin(arc2.t * Math.PI) * 90);
        fish.setRotation(-Math.PI / 2 + arc2.t * Math.PI * 1.5).setScale(s0 * (1 - arc2.t * 0.55));
      },
    });
    fish.destroy();
    this.splash(cool.x, cool.y + 10, 8, 0.5);
    sfx.thud();
    this.time.delayedCall(260, () => this.cooler.setTexture('fl-cooler'));
    this.tweens.add({
      targets: this.cooler,
      scaleY: this.cooler.scaleY * 0.9,
      yoyo: true,
      duration: 90,
    });
    card.hidden = true;
    this.dangle.hero = null;
    r.taut = false;
    r.bend = 0;
    this.heroPose = null;
    this.arm = -0.85;
    await this.wait(300);
    this.hangLure('hero');
    this.camK = 2.2;
    this.shotBoat(1);
    await this.wait(500);
  }

  /** Where a fish's mouth is (its nose: the art faces right, flipped faces left), for the line. */
  private mouthOf(fish: Phaser.GameObjects.Sprite) {
    const half = fish.displayWidth * 0.44 * (fish.flipX ? -1 : 1);
    return { x: fish.x + Math.cos(fish.rotation) * half, y: fish.y + Math.sin(fish.rotation) * half };
  }

  /** The hooked fish jumps right out of the water and dives back in. */
  private async leap(fish: Phaser.GameObjects.Sprite, L: Lure) {
    const x0 = fish.x;
    const up = 140 + Math.random() * 60;
    const dx = -40 - Math.random() * 50;
    sfx.splash();
    this.splash(x0, WATER, 12, 0.9);
    fish.setDepth(8);
    const o = { t: 0 };
    await this.tw({
      targets: o,
      t: 1,
      duration: 820,
      ease: 'Linear',
      onUpdate: () => {
        const t = o.t;
        fish.setPosition(x0 + dx * t, WATER + 40 - Math.sin(t * Math.PI) * (up + 40));
        fish.setFlipX(dx < 0).setRotation((dx < 0 ? 1 : -1) * (0.9 - t * 1.8));
        fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(t * 12) % 3]);
        L.x = fish.x;
        this.cam = {
          x: (BOAT_X + BOAT.hero + fish.x) / 2 + 60,
          y: WATER - 110,
          zoom: 0.95,
        };
      },
    });
    this.splash(fish.x, WATER, 14, 1);
    sfx.splash();
    fish.setDepth(5.55);
  }

  // ── King Bob's turn (quick) ──

  private async kingTurn(): Promise<boolean> {
    const L = this.lures.king;
    const r = this.rod.king;
    this.camK = 2.4;
    this.shotBoat(1.15);
    this.cam.x = BOAT_X + BOAT.king + 180;
    this.hangLure('king');
    await this.callout("KING BOB'S CAST", 'king', 800);
    // his cast: back, and a flick
    await this.to(r, 'a', -2.7, 330);
    sfx.whoosh();
    const tw = this.tweens.add({
      targets: r,
      a: -0.55,
      duration: 200,
      ease: 'Cubic.easeIn',
    });
    r.bend = -0.4;
    while (r.a < -1.2) await this.wait(8);
    const v = 700 + Math.random() * 500;
    const a = -0.72;
    L.mode = 'fly';
    L.x = r.tip.x;
    L.y = r.tip.y;
    L.vx = Math.cos(a) * v;
    L.vy = Math.sin(a) * v;
    r.reelRate = -3;
    while (!tw.isFinished() && !tw.isDestroyed()) await this.wait(16);
    r.bend = 0.25;
    this.tweens.add({
      targets: r,
      bend: 0,
      duration: 600,
      ease: 'Elastic.easeOut',
    });
    this.camK = 3.5;
    while (L.mode === 'fly') {
      this.cam = {
        x: Math.max(BOAT_X + BOAT.king + 300, L.x - 150),
        y: Math.min(WATER - 80, L.y + 60),
        zoom: 0.95,
      };
      await this.wait(16);
    }
    this.to(r, 'a', -0.75, 300);
    // reeling like mad: a couple of nibbles, and — maybe
    r.reelRate = 2.6;
    const got = Math.random() < KING_CATCH;
    const x0 = L.x;
    const xEnd = BOAT_X + BOAT.motor + 70;
    const dur = 2400;
    const t0 = this.clock;
    let nib = 0;
    let fish: Phaser.GameObjects.Sprite | null = null;
    const c = pickCatch();
    while (this.clock - t0 < dur) {
      const u = (this.clock - t0) / dur;
      L.x = x0 + (xEnd - x0) * u;
      this.shotLine('king');
      if (nib < 2 && u > 0.2 + nib * 0.25) {
        nib++;
        L.dip = 8;
        this.ripple(L.x, WATER, 0.6);
        this.time.delayedCall(140, () => (L.dip = 0));
      }
      if (got && !fish && u > 0.65) {
        // he strikes: fish on
        sfx.splash();
        this.splash(L.x, WATER, 10, 0.8);
        r.bend = 0.7;
        r.taut = true;
        r.reelRate = 4;
        L.mode = 'hooked';
        fish = this.add
          .sprite(L.x, WATER + 60, `fl-fish-${c.kind}`, 'sw0')
          .setScale((c.k / 1.6) * 0.7)
          .setDepth(5.55);
      }
      if (fish) {
        L.dip = 12 + Math.sin(this.clock / 80) * 5;
        r.bend = 0.65 + Math.sin(this.clock / 70) * 0.15;
        fish
          .setPosition(L.x + Math.sin(this.clock / 60) * 14, WATER + 55)
          .setRotation(Math.sin(this.clock / 55) * 0.4)
          .setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.clock / 60) % 3]);
      }
      await this.wait(16);
    }
    r.reelRate = 0;
    if (fish) {
      // up it comes and into his gold bucket
      L.mode = 'gone';
      L.img.setVisible(false);
      sfx.splash();
      this.splash(L.x, WATER, 14, 1);
      fish.setDepth(8.4);
      this.to(r, 'a', -1.9, 250);
      const b = this.onBoat(BOAT.king - 92, BOAT.deck - 26);
      const f0 = { x: fish.x, y: fish.y };
      const o = { t: 0 };
      this.cam = { x: (b.x + f0.x) / 2, y: WATER - 140, zoom: 1.05 };
      await this.tw({
        targets: o,
        t: 1,
        duration: 900,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          fish!.setPosition(f0.x + (b.x - f0.x) * o.t, f0.y + (b.y - f0.y) * o.t - Math.sin(o.t * Math.PI) * 260);
          fish!.setRotation(o.t * Math.PI * 3).setFlipX(true);
          // (on the line till it's swung in over the bucket)
          this.dangle.king = o.t < 0.7 ? this.mouthOf(fish!) : null;
        },
      });
      fish.destroy();
      this.dangle.king = null;
      this.splash(b.x, b.y + 10, 6, 0.5);
      sfx.thud();
      r.taut = false;
      r.bend = 0;
      sfx.laugh();
      void this.kingSays(['HA HA! Another one!', 'Too easy!', 'The King always delivers!', 'Look at THIS beauty!'][Math.floor(Math.random() * 4)], 1500);
      const lb = Math.round((c.lb[0] + Math.random() * (c.lb[1] - c.lb[0])) * 10) / 10;
      this.logCatch('king', c.name, lb);
      await this.callout(`KING BOB CAUGHT<small>a ${c.name} · ${lb.toFixed(1)} lb</small>`, 'king', 1400);
    } else {
      sfx.groan();
      await this.callout('NOTHING<small>for King Bob</small>', 'good', 1100);
    }
    this.to(r, 'a', -1.1, 300);
    this.hangLure('king');
    return !!fish;
  }

  // ───────────────────────────────────────────── the end ──

  private async youWin() {
    const view = this.cameras.main.worldView;
    this.shotBoat(1.12);
    this.cam.x = BOAT_X + (BOAT.hero + BOAT.king) / 2;
    this.cam.y = WATER - 110;
    this.heroPose = 'j0';
    this.dom.querySelector<HTMLElement>('.fsh-meter')!.hidden = true;
    for (let i = 0; i < 4; i++)
      this.time.delayedCall(i * 350, () => {
        this.confettiFx.pop(view.x + view.width * (0.2 + Math.random() * 0.6), view.y + view.height * (0.15 + Math.random() * 0.3), 90, 900);
        sfx.pop();
      });
    sfx.cheer();
    await this.callout(`YOU WIN!<small>${this.total('hero')} – ${this.total('king')}</small>`, 'good big', 2400);
    await this.kingSays('WHAT?! Impossible!', 1700);
    fadeOutMusic(500);
    const result: ResultState = {
      ...this.fd.result,
      hoops: `${this.total('hero')} – ${this.total('king')}`,
      level: this.fd.level ?? 5,
    };
    this.game.events.emit('level-complete', result);
  }

  private async kingWins() {
    this.shotBoat(1.25);
    this.cam.x = BOAT_X + BOAT.king + 40;
    sfx.laugh();
    await this.kingSays('HA HA HA! Nobody beats the King!', 1900);
    const practice = !!this.fd.result?.practice;
    const hadLife = practice || loseLife();
    const next = practice ? '' : hadLife ? ' · back to your last checkpoint' : ' · no lives left';
    await this.callout(`KING BOB WINS<small>${this.total('king')} – ${this.total('hero')}${next}</small>`, 'bad big', 2600);
    fadeOutMusic(500);
    if (practice) {
      this.game.events.emit('boss-lost', {
        ...this.fd.result,
        hoops: `${this.total('hero')} – ${this.total('king')}`,
        level: this.fd.level ?? 5,
      } satisfies ResultState);
      return;
    }
    if (!hadLife) {
      const ch = characterById(this.fd.charId);
      this.game.events.emit('game-over', {
        charId: ch.id,
        name: ch.name,
        checkpoint: this.fd.checkpoint,
      } satisfies GameOverState);
      return;
    }
    this.cameras.main.fadeOut(400, 20, 10, 38);
    await this.wait(450);
    this.scene.start('Game', {
      session: this.fd.session,
      checkpoint: this.fd.checkpoint,
      retry: true,
      level: this.fd.level ?? 5,
    } satisfies GameData);
  }
}
