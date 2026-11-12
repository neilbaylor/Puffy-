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
  drawDock,
  drawHost,
  DOCK,
  HOST,
  HOST_FRAMES,
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
/** The world's left edge: the show's dock is out there, over to the left of the boat. */
const WORLD_L = -3000;
/** The boat picture's left edge (world), and how big it's drawn (world px per picture unit). */
const BOAT_X = 20;
const BS = 1.18;
const BOAT_Y = WATER - BOAT.water * BS;
/** Across the boat (picture units) → the world. */
const bx = (x: number) => BOAT_X + x * BS;
/** King Bob's bowl: how big (world px per bowl unit). */
const BOWL_K = 1.32;
/** The boat sits a touch bow-up. */
const TRIM = 0.014;
/** The dock (world): its left edge, and its deck's height (where the host stands). */
const DOCK_X = -2700;
const DOCK_TOP = WATER - 58;
const HOST_X = DOCK_X + 470;
const ROUNDS = 6;
/** The share of bites you tap in time that end up a fish on the line. */
const CATCH = 0.26;
/** King Bob lands about this share of his casts. */
const KING_CATCH = 0.46;
/** A hero's size here: world px per art unit. */
const HERO_K = 2.38;
/** How long the BITE button can be hit for (ms). */
const BITE_MS = 620;
/** The rods: length (world px), and how far the handle reaches behind the hands. */
const ROD_LEN = 178;
const ROD_BUTT = 34;
const KING_ROD_LEN = 150;

/**
 * What you can catch: the fish, what it's called, its weight range (lb), how common, and how big it's shown.
 * (No Bad Guy Fish: the sea level's bad guy never bites.)
 */
const CATCHES: {
  kind: FishKind;
  name: string;
  lb: [number, number];
  odds: number;
  k: number;
  rare?: boolean;
}[] = [
  { kind: 'zippy', name: 'Zippy', lb: [0.6, 1.9], odds: 30, k: 1.7 },
  { kind: 'stone', name: 'Stone Fish', lb: [2.2, 4.6], odds: 19, k: 0.95 },
  { kind: 'slinger', name: 'Slinger', lb: [3.1, 6.4], odds: 16, k: 0.9 },
  { kind: 'fat', name: 'Fat Fish', lb: [9, 16], odds: 6, k: 0.6, rare: true },
  { kind: 'kai', name: 'Kai Fish', lb: [1.4, 3.2], odds: 18, k: 1.25, rare: true },
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
  /** The show's host, on the dock: talking (his mouth going), pointing off at the boat. */
  private host!: Phaser.GameObjects.Image;
  private hostTalk = false;
  /** The hero leaning (radians, + forward): back on the wind-up, into the cast, back as they heave a fish in. */
  private heroLean = 0;
  /** The rod tip's path through the whip (a fading streak), and the lure's trail through the air. */
  private tipTrail: { x: number; y: number; t: number }[] = [];
  private lureTrail: { x: number; y: number }[] = [];
  /** A fish out of the water on the end of the line: its mouth, swinging (verlet) from the rod tip. */
  private swing: { x: number; y: number; px: number; py: number; len: number; target: number; t: number } | null = null;
  private hostPoint = false;
  private hostShock = false;
  /** King Bob out of his bowl (the win: he leaps into the sea), so the boat no longer carries him. */
  private kingFree = false;
  /** The hero hopping for joy (px up). */
  private heroHop = 0;
  private hostMouthT = 0;
  private hostOpen = false;
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
    this.hostTalk = false;
    this.hostPoint = false;
    this.hostShock = false;
    this.noClear = false;
    this.kingFree = false;
    this.heroHop = 0;
    this.boardBox = null;
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
    add('fl-dock', DOCK.w, DOCK.h, 1.5, (ctx) => drawDock(ctx));
    for (const f of HOST_FRAMES) add(`fl-host-${f}`, HOST.w, HOST.h, 2, (ctx) => drawHost(ctx, f));
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
      .image(WORLD_L, WORLD_TOP, 'fl-sky')
      .setOrigin(0, 0)
      .setDisplaySize(WORLD_W - WORLD_L + 400, HORIZON - WORLD_TOP)
      .setDepth(0);
    this.add
      .image(WORLD_L, HORIZON, 'fl-farsea')
      .setOrigin(0, 0)
      .setDisplaySize(WORLD_W - WORLD_L + 400, WATER - HORIZON + 10)
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
    for (let i = 0; i < 9; i++) {
      const c = this.add
        .image(WORLD_L * 0.4 + i * 680 + Math.random() * 200, 40 + Math.random() * 220, `fl-cloud${i % 3}`)
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
      .image(WORLD_L, WATER, 'fl-deep')
      .setOrigin(0, 0)
      .setDisplaySize(WORLD_W - WORLD_L + 400, WORLD_BOTTOM - WATER + 40)
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
      .setScale(BS / 1.5)
      .setDepth(4);
    // (the hull's shadow down in the water under it)
    this.add
      .image(bx(BOAT.w * 0.46), WATER + 70, 'fl-hullshadow')
      .setDisplaySize(BOAT.w * BS * 1.05, 170)
      .setDepth(1.25)
      .setAlpha(0.8);
    // the show's dock off to the left, and its host on it
    this.add
      .image(DOCK_X, DOCK_TOP - DOCK.deck, 'fl-dock')
      .setOrigin(0, 0)
      .setScale(1 / 1.5)
      .setDepth(3.5);
    this.host = this.add
      .image(HOST_X, DOCK_TOP - 12, 'fl-host-t0')
      .setOrigin(62 / HOST.w, 186 / HOST.h)
      .setScale(0.92 / 2)
      .setDepth(3.6);
    this.cooler = this.add
      .image(0, 0, 'fl-cooler')
      .setScale(1 / 2)
      .setOrigin(0.5, 1)
      .setDepth(4.2);
    this.bucket = this.add.image(0, 0, 'fl-cooler').setScale(0.42).setOrigin(0.5, 1).setDepth(4.15).setTint(0xffe28a);
    this.bowlBack = this.add
      .image(0, 0, 'fl-bowl-back')
      .setScale(BOWL_K / 2)
      .setOrigin(0.5, 1)
      .setDepth(4.3);
    this.kingSpr = this.add
      .sprite(0, 0, 'fl-kingbob', 'sw0')
      .setScale((0.98 * BOWL_K) / 2)
      .setDepth(4.35);
    this.bowlFront = this.add
      .image(0, 0, 'fl-bowl-front')
      .setScale(BOWL_K / 2)
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
        .tileSprite(WORLD_L, y, WORLD_W - WORLD_L + 400, WAVE.h, 'fl-wave')
        .setOrigin(0, 0)
        .setTileScale(0.5, 0.5)
        .setDepth(d)
        .setAlpha(a);
      w.setData('sp', sp);
      this.waves.push(w);
    }
    this.add
      .image(WORLD_L, WATER + 22, 'fl-px')
      .setOrigin(0, 0)
      .setDisplaySize(WORLD_W - WORLD_L + 400, WORLD_BOTTOM - WATER)
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
      <div class="tv-old" hidden>
        <div class="tvo-roll"></div>
        <div class="tvo-bug">WWS<small>LIVE</small></div>
        <div class="tvo-title"><small>THE WONDERFUL WORLD OF</small><b>SPORTS</b><span>CHUCK RIVERS · LIVE FROM THE DOCKS</span></div>
        <div class="tvo-cc"></div>
      </div>
      <div class="tv-ticker" hidden><b>REEL ROYAL TV</b><div class="tv-crawl"><span></span></div></div>
      <div class="hoops-meters fsh-meter" hidden>
        <div class="hm" data-m="power"><b>Power</b><div class="hm-bar"><i class="hm-zone"></i><i class="hm-mark"></i></div></div>
        <div class="hm" data-m="aim"><b>Aim</b><div class="hm-bar"><i class="hm-zone"></i><i class="hm-mark"></i></div></div>
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
    const onResize = () => setTimeout(() => this.measureBoard(), 150);
    window.addEventListener('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('resize', onResize));
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
  private onBoat(px0: number, py0: number) {
    // (about the waterline amidships: picture units scaled to the world, then the rock and the bob)
    const px = bx(BOAT.w / 2);
    const py = WATER;
    const x = bx(px0) - px;
    const y = BOAT_Y + py0 * BS - py;
    const a = this.rock + TRIM;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: px + x * c - y * s, y: py + this.bob + x * s + y * c };
  }
  /** A point on King Bob's bowl (bowl units from the bottom of its stand) → the world. */
  private bowlAt(dx: number, dy: number) {
    const base = this.onBoat(BOAT.king, BOAT.feet + 3);
    const a = this.rock + TRIM;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = dx * BOWL_K;
    const y = dy * BOWL_K;
    return { x: base.x + x * c - y * s, y: base.y + x * s + y * c };
  }

  private placeBoat() {
    const a = this.rock + TRIM;
    const p = this.onBoat(BOAT.w / 2, BOAT.h / 2);
    this.boat.setPosition(p.x, p.y).setRotation(a);
    const c = this.onBoat(BOAT.cooler, BOAT.feet + 2);
    this.cooler.setPosition(c.x, c.y).setRotation(a);
    const bk = this.onBoat(BOAT.king - 98, BOAT.feet + 2);
    this.bucket.setPosition(bk.x, bk.y).setRotation(a);
    const b = this.bowlAt(0, 0);
    this.bowlBack.setPosition(b.x, b.y).setRotation(a);
    this.bowlFront.setPosition(b.x, b.y).setRotation(a);
    // King Bob in his water, swaying a little
    if (!this.kingFree) {
      const kc = this.bowlAt(2, -(BOWL.h - BOWL.cy) + 10 + Math.sin(this.clock / 700) * 3);
      this.kingSpr.setPosition(kc.x, kc.y).setRotation(a + Math.sin(this.clock / 900) * 0.05);
    }
    const h = this.onBoat(BOAT.hero, BOAT.feet + 2);
    this.hero.setPosition(h.x, h.y - this.heroHop).setRotation(a + this.heroLean);
  }

  /** The hero's hands (world), from the frame shown. */
  private heroHands(frameA: number) {
    const k = this.heroScale * ART_RES;
    const id = characterById(this.fd.charId).id;
    const [hx, hy] = carryHand(id, frameA);
    const dx = (hx + HERO_SHEET_M - (CHAR_W + HERO_SHEET_M * 2) / 2) * k;
    const dy = (hy - CHAR_H) * k;
    const c = Math.cos(this.rock + TRIM + this.heroLean);
    const s = Math.sin(this.rock + TRIM + this.heroLean);
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
    const c0 = this.clearOfBoard(z);
    const { tx, ty } = this.keepInView(c0.tx, c0.ty, z);
    const k = snap ? 1 : 1 - Math.exp(-Math.min(0.1, this.game.loop.delta / 1000) * this.camK);
    const zoom = cam.zoom + (z - cam.zoom) * k;
    cam.setZoom(zoom);
    const vw = this.scale.width / zoom;
    const vh = this.scale.height / zoom;
    const cx = cam.midPoint.x + (tx - cam.midPoint.x) * k;
    const cy = cam.midPoint.y + (ty - cam.midPoint.y) * k;
    const x = Phaser.Math.Clamp(snap ? tx : cx, WORLD_L + 20 + vw / 2, WORLD_W + 380 - vw / 2);
    const y = Phaser.Math.Clamp(snap ? ty : cy, WORLD_TOP + vh / 2, WORLD_BOTTOM - vh / 2);
    cam.centerOn(x, y);
  }

  /** The scoreboard's corner (CSS px from the top left: its right and bottom edges), measured when it changes. */
  private boardBox: { r: number; b: number } | null = null;
  private measureBoard() {
    const board = this.dom?.querySelector<HTMLElement>('.fsh-board');
    if (!board || board.hidden) return (this.boardBox = null);
    const r = board.getBoundingClientRect();
    this.boardBox = { r: r.right + 10, b: r.bottom + 8 };
  }
  /**
   * The shot's centre, moved so neither the hero nor King Bob's bowl sits under the scoreboard in the
   * top left: the camera slides over (or up, if that's less) just enough. Not in the cut scenes; and
   * never so far that a lure out on the water goes off the far side.
   */
  private clearOfBoard(z: number) {
    let tx = this.cam.x;
    let ty = this.cam.y;
    const bb = this.boardBox;
    if (!bb || this.inIntro || this.noClear) return { tx, ty };
    const f = this.scale.width / Math.max(1, window.innerWidth);
    const vw = this.scale.width / z;
    const vh = this.scale.height / z;
    const bw = (bb.r * f) / z;
    const bh = (bb.b * f) / z;
    const bowl = this.bowlAt(0, 0);
    const boxes = [
      [this.hero.x - 46, this.hero.y - 138, this.hero.x + 46, this.hero.y],
      [bowl.x - 75 * BOWL_K, bowl.y - BOWL.h * BOWL_K, bowl.x + 75 * BOWL_K, bowl.y],
    ];
    for (let pass = 0; pass < 2; pass++)
      for (const [x0, y0, x1] of boxes) {
        const left = tx - vw / 2;
        const top = ty - vh / 2;
        if (x1 < left || x0 > left + vw) continue;
        if (x0 >= left + bw || y0 >= top + bh) continue;
        const dx = left + bw - x0;
        const dy = top + bh - y0;
        if (dx <= dy * 1.4) tx -= dx;
        else ty -= dy;
      }
    // (keep a lure that's out on the water in the shot)
    for (const who of ['hero', 'king'] as const) {
      const L = this.lures[who];
      if (L && L.mode !== 'held' && L.mode !== 'gone') tx = Math.max(tx, L.x + 50 - vw / 2);
    }
    return { tx, ty };
  }
  /**
   * Whoever's in the shot is all in it: if the hero (head to toe, a hop included) or King Bob's bowl (and
   * a bubble's room over it) is in the shot across but cut off at the top or the bottom, the shot moves
   * up or down just enough. (Not on the dock: they're not in that shot.)
   */
  private keepInView(tx: number, ty: number, z: number) {
    const vw = this.scale.width / z;
    const vh = this.scale.height / z;
    const m = 14;
    const bowl = this.bowlAt(0, 0);
    const heroH = HERO_K * CHAR_H * characterById(this.fd.charId).scale;
    const boxes: [number, number, number, number][] = [
      [this.hero.x - 40, this.hero.y - heroH - 16, this.hero.x + 40, this.hero.y + 8],
      [bowl.x - 75 * BOWL_K, bowl.y - BOWL.h * BOWL_K - (this.kingFree ? 0 : 20), bowl.x + 75 * BOWL_K, bowl.y + 6],
    ];
    for (const [x0, y0, x1, y1] of boxes) {
      const left = tx - vw / 2;
      if (x1 < left || x0 > left + vw) continue;
      // (taller than the shot: keep the top, it's the face)
      const top = ty - vh / 2;
      if (y0 < top + m) ty -= top + m - y0;
      else if (y1 > ty + vh / 2 - m && y1 - y0 < vh - 2 * m) ty += y1 - (ty + vh / 2 - m);
    }
    return { tx, ty };
  }

  /** (the camera's left alone: the win and the cut scenes frame things themselves) */
  private noClear = false;

  /** Frame the boat (the stern, King Bob and the sea just off it). */
  private shotBoat(zoom = 1) {
    this.cam = { x: bx(BOAT.hero) - 110, y: WATER - 100, zoom };
  }
  /** Frame the hero's line: from the boat out to the bobber. */
  private shotLine(who: Who = 'hero') {
    const L = this.lures[who];
    const x0 = bx(who === 'hero' ? BOAT.hero : BOAT.king) - 160;
    this.cam = this.frameOut(x0, L.x, 0.62, 1.05, WATER - 60);
  }
  /**
   * A shot from the boat (x0) out to something on the water (x1): both in it when they fit; when it's
   * too far for that (past `minZoom`), the far end in shot and the boat off the side — sliding back to
   * take the boat in as it comes nearer.
   */
  private frameOut(x0: number, x1: number, minZoom: number, maxZoom: number, y: number) {
    const span = Math.max(500, x1 - x0 + 220);
    const zoom = Phaser.Math.Clamp(1280 / span, minZoom, maxZoom);
    const vw = 1280 / zoom;
    return { x: Math.max((x0 + x1 + 120) / 2, x1 + 230 - vw / 2), y: y + (1 - zoom) * 60, zoom };
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
      if (c.x > WORLD_W + 600) c.x = WORLD_L * 0.4 - 300;
    }
    this.rays.forEach((r, i) => r.setRotation(Math.sin(t * 0.3 + i) * 0.08));
    for (const f of this.schools) {
      f.img.x += f.v * s;
      f.img.y = f.y0 + Math.sin(t * 0.8 + f.ph) * 10;
      if (f.img.x > WORLD_W + 200) f.img.x = -300;
      if (f.img.x < -300) f.img.x = WORLD_W + 200;
    }
    this.drawGulls(t, s);

    // the host: his mouth flapping while he talks
    this.hostMouthT -= dt;
    if (this.hostMouthT <= 0) {
      this.hostOpen = this.hostTalk && !this.hostOpen;
      this.hostMouthT = 80 + Math.random() * 110;
    }
    this.host.setTexture(`fl-host-${this.hostShock ? 's' : this.hostPoint ? 'p' : 't'}${this.hostOpen ? 1 : 0}`);
    this.host.y = DOCK_TOP - 12 + (this.hostTalk ? Math.sin(this.clock / 130) * 1.5 : 0);

    // the anglers
    this.placeBoat();
    const cf = this.castFrame();
    this.hero.setFrame(this.heroPose ?? cf.frame);
    const kf = Math.floor(t * 5) % 6;
    // (swimming off: his tail going like mad)
    this.kingSpr.setFrame(this.kingFree ? `sw${Math.floor(t * 16) % 6}` : Math.floor(t * 0.7) % 5 === 0 && t % 1.4 < 0.15 ? 'bl1' : `sw${kf}`);
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
    k.hands = this.bowlAt(44, -BOWL.h + 30);
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
      const drag = Math.exp(-0.25 * s);
      L.vx *= drag;
      L.vy *= drag;
      L.x += L.vx * s;
      L.y += L.vy * s;
      L.spin += s * 9;
      if (who === 'hero') {
        this.lureTrail.push({ x: L.x, y: L.y });
        if (this.lureTrail.length > 14) this.lureTrail.shift();
      }
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
    // the rod tip's streak through the whip, fading fast
    this.tipTrail = this.tipTrail.filter((q) => this.clock - q.t < 240);
    for (let i = 1; i < this.tipTrail.length; i++) {
      const a = this.tipTrail[i - 1];
      const b = this.tipTrail[i];
      const k = 1 - (this.clock - b.t) / 240;
      g.lineStyle(9 * k, 0xffffff, 0.55 * k);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    // the lure's trail through the air
    if (this.lures.hero?.mode === 'fly')
      this.lureTrail.forEach((q, i) => {
        const k = (i + 1) / this.lureTrail.length;
        g.fillStyle(0xffffff, 0.5 * k);
        g.fillCircle(q.x, q.y, 1.5 + 3 * k);
      });
    else this.lureTrail.length = 0;
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
      // (into sudden death: the dots get smaller, and only the last eight rounds show)
      const from = Math.max(0, n - 8);
      row.querySelector('.fsh-dots')!.innerHTML = Array.from({ length: n - from }, (_, j) => {
        const i = from + j;
        return `<i class="${i < s.length ? (s[i] ? 'got' : 'miss') : ''}${i >= ROUNDS ? ' sd' : ''}"></i>`;
      }).join('');
      row.querySelector('.fsh-total')!.textContent = String(s.filter(Boolean).length);
    }
    board.classList.toggle('many', n > ROUNDS);
    requestAnimationFrame(() => this.measureBoard());
    board.querySelector('.fsh-round')!.textContent = round > ROUNDS ? 'SUDDEN DEATH' : `ROUND ${round} OF ${ROUNDS}`;
    const b = this.best;
    board.querySelector('.tv-best')!.innerHTML = b ? `BIGGEST <b>${b.lb.toFixed(1)} lb</b> ${b.who === 'king' ? 'KING BOB' : 'YOU'}` : 'BIGGEST <b>—</b>';
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
  private async lockMeter(phase: 'power' | 'aim', speed: number, zoneW: number) {
    const box = this.dom.querySelector<HTMLElement>('.fsh-meter')!;
    box.hidden = false;
    const el = box.querySelector<HTMLElement>(`[data-m=${phase}]`)!;
    el.classList.add('active');
    el.classList.remove('locked');
    const c = 0.25 + Math.random() * 0.6;
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
    // (how far off and which way: − short of the green, + past it)
    return { pos: m.pos, off, side: m.pos < zone[0] ? -1 : m.pos > zone[1] ? 1 : 0 };
  }
  /** Both meters done: put them away. */
  private hideMeters() {
    this.time.delayedCall(450, () => {
      this.dom.querySelector<HTMLElement>('.fsh-meter')!.hidden = true;
      this.dom.querySelectorAll('.fsh-meter .hm').forEach((e) => e.classList.remove('locked', 'active'));
    });
  }

  /** The BITE! button: up somewhere over the water, fading fast. Resolves true if it was hit in time. */
  private async biteButton(): Promise<boolean> {
    const b = this.dom.querySelector<HTMLElement>('.fsh-bite')!;
    // (anywhere over the sea, clear of the scoreboard; and it drifts off while it's there)
    const x = 30 + Math.random() * 58;
    const y = 26 + Math.random() * 48;
    b.style.left = `${x}%`;
    b.style.top = `${y}%`;
    const da = Math.random() * Math.PI * 2;
    b.style.setProperty('--dx', `${Math.cos(da) * 50}px`);
    b.style.setProperty('--dy', `${Math.sin(da) * 35}px`);
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
    stingerTitle(`<div><div class="crown"></div><small>THE WONDERFUL WORLD OF SPORTS</small><strong>KING BOB'S<br>FISH-OFF</strong><em>LIVE FROM THE REEL ROYAL</em></div>`);
    sfx.drum();
    // ── on the dock: the show's host, on an old telly ──
    const tv = this.dom.querySelector<HTMLElement>('.tv-old')!;
    tv.hidden = false;
    tv.classList.remove('off');
    this.cam = { x: HOST_X + 70, y: DOCK_TOP - 92, zoom: 1.75 };
    this.fitCamera(true);
    await this.iwait(1250);
    void stingerReveal();
    await this.iwait(500);
    // (a slow push in on him while he talks)
    this.camK = 0.4;
    this.cam = { x: HOST_X + 50, y: DOCK_TOP - 96, zoom: 2.0 };
    const name = characterById(this.fd.charId).name;
    await this.hostSays("On today's Wonderful World of Sports, we bring you some HUGE fishing action!", 3400);
    await this.hostSays(`King Bob versus ${name}!`, 2050);
    await this.hostSays('What a duel this should be.', 1850);
    this.hostPoint = true;
    await this.hostSays("Let's head down to the boat to check it out!", 2250);
    // ── and off over the water to the boat ──
    tv.classList.add('off');
    this.time.delayedCall(700, () => (tv.hidden = true));
    // (a long, slow swoop out over the water: pulling up and back on the way, settling in on King Bob)
    const from = { ...this.cam };
    const to = { x: bx(BOAT.king) + 90, y: WATER - 205, zoom: 1.2 };
    this.camK = 14;
    const glide = { t: 0 };
    const tw = this.tweens.add({
      targets: glide,
      t: 1,
      duration: 4400,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = glide.t;
        const arc = Math.sin(t * Math.PI);
        this.cam = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t - arc * 90, zoom: (from.zoom + (to.zoom - from.zoom) * t) * (1 - arc * 0.4) };
        if (this.skipping) tw.timeScale = 6;
      },
    });
    while (!tw.isFinished() && !tw.isDestroyed()) await this.wait(30);
    this.hostPoint = false;
    this.camK = 2.5;
    await this.iwait(300);
    await this.kingSays("You'll NEVER beat me at fishing!", 2200);
    await this.kingFlip();
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

  /** The host says a line: closed captions typed out along the bottom of the old telly, his mouth going. */
  private async hostSays(text: string, ms: number) {
    const cc = this.dom.querySelector<HTMLElement>('.tvo-cc')!;
    cc.textContent = '';
    cc.classList.add('show');
    this.hostTalk = true;
    const t0 = this.clock;
    // (typed out quickly, then a moment to read it)
    const typeMs = Math.min(ms - 550, text.length * 35);
    while (this.clock - t0 < ms && !this.skipping) {
      const n = Math.min(text.length, Math.ceil(((this.clock - t0) / typeMs) * text.length));
      if (cc.textContent!.length !== n) cc.textContent = text.slice(0, n).toUpperCase();
      this.hostTalk = this.clock - t0 < typeMs + 150;
      await this.wait(30);
    }
    this.hostTalk = false;
    cc.classList.remove('show');
  }

  /** King Bob says something (a bubble over his bowl). */
  private async kingSays(text: string, ms: number) {
    // (up to the right of his bowl, the tail pointing in at him: clear of the scoreboard in the corner)
    const at = this.bowlAt(50, -BOWL.h + 26);
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
    this.cam.x = bx(BOAT.hero) + 140;
    // (a little higher: the rod's tip in the shot)
    this.cam.y = WATER - 120;
    this.arm = -0.85;
    this.hangLure('hero');
    await this.callout('YOUR CAST', 'you', 900);
    // the meters, as at basketball: power (how far it goes), then aim; a little quicker and a little
    // narrower as the contest goes on. The nearer both are to the green, the more bites (3 to 6).
    const n = Math.min(round, ROUNDS) - 1;
    const speed = 1.05 + n * 0.08;
    const zw = Math.max(0.1, 0.17 - n * 0.012);
    const p = await this.lockMeter('power', speed, zw);
    const aim = await this.lockMeter('aim', speed * 1.1, zw);
    this.hideMeters();
    const miss = p.off + aim.off;
    const bites = miss === 0 ? 6 : miss <= 0.06 ? 5 : miss <= 0.16 ? 4 : 3;
    const power = 0.25 + p.pos * 0.75;
    await this.heroCast(power, aim.side * Math.min(1, aim.off * 5));
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
    const endX = bx(BOAT.motor) + 80;
    const gaps = Array.from({ length: bites }, () => 1100 + Math.random() * 700);
    const total = gaps.reduce((a, b) => a + b, 0) + 900;
    const t0 = this.clock;
    // (the bites come while the bobber's still well out: it's wound only about halfway in through them,
    // and the rest of the way quickly at the end)
    const outU = 0.5;
    const reelTo = () => {
      const u = Math.min(1, (this.clock - t0) / total);
      L.x = startX + (endX - startX) * u * outU;
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
    // the last of it in, no fish: wound in briskly
    await reelFor(Math.max(0, total - (this.clock - t0)));
    {
      const from = L.x;
      const t1 = this.clock;
      r.reelRate = 2.2;
      while (this.clock - t1 < 1100) {
        L.x = from + (endX - from) * Phaser.Math.Easing.Sine.InOut((this.clock - t1) / 1100);
        this.shotLine('hero');
        this.heroPose = Math.floor(this.clock / 90) % 2 ? 'r1' : 'r0';
        await this.wait(16);
      }
    }
    r.reelRate = 0;
    this.heroPose = null;
    await this.callout('NO FISH<small>this time</small>', 'bad', 1000);
    this.arm = -0.85;
    this.hangLure('hero');
    return false;
  }

  /** The cast: wind back, a beat, whip forward (the lure leaves the tip at the release), and the line pays out. */
  /**
   * The cast. A wind-up: the hero leans back and takes the rod right back over their shoulder (the lure
   * swinging out behind on its line, the rod loading up). A beat. Then the whip: they lunge into it, the
   * rod tip leaves a streak, the blank bends back against the swing, and the lure lets go with a zing of
   * the reel — off over the sea on a long arc, a trail behind it, the camera after it — and splashes
   * down; the bobber bobs up. `wobble`: an aim off the green (−1…1) throws the cast up high or flat.
   */
  private async heroCast(power: number, wobble = 0) {
    const L = this.lures.hero;
    const r = this.rod.hero;
    // ── the wind-up ──
    this.camK = 2.5;
    this.cam = { ...this.cam, zoom: this.cam.zoom * 1.06 };
    r.bend = 0.18;
    // (tweens straight on: `to` would stop the lean along with everything else on the scene)
    this.tweens.killTweensOf(this);
    this.tweens.add({ targets: this, heroLean: -0.12, duration: 520, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this, arm: -2.6, duration: 520, ease: 'Sine.easeInOut' });
    await this.wait(530);
    // (a beat at the top, the rod loaded)
    r.bend = 0.1;
    await this.wait(150);
    // ── the whip ──
    sfx.whoosh();
    this.tipTrail = [];
    this.tweens.add({ targets: this, heroLean: 0.1, duration: 240, ease: 'Cubic.easeIn' });
    const tw = this.tweens.add({ targets: this, arm: 0.15, duration: 240, ease: 'Cubic.easeIn' });
    r.bend = -0.6;
    while (this.arm < -1.0) {
      this.tipTrail.push({ x: r.tip.x, y: r.tip.y, t: this.clock });
      await this.wait(8);
    }
    // ── let go: off it goes, out over the sea ──
    // (well out over the sea: about 1300 px past the rod tip at the least, 1800 at full power)
    const a = -0.68 - power * 0.1 + wobble * 0.15;
    const v = 1000 + power * 360;
    L.mode = 'fly';
    L.x = r.tip.x;
    L.y = r.tip.y;
    L.vx = Math.cos(a) * v;
    L.vy = Math.sin(a) * v;
    L.spin = 0;
    this.lureTrail = [];
    this.sparkle(r.tip.x, r.tip.y, 6);
    sfx.stroke();
    r.reelRate = -7;
    while (!tw.isFinished() && !tw.isDestroyed()) {
      this.tipTrail.push({ x: r.tip.x, y: r.tip.y, t: this.clock });
      await this.wait(8);
    }
    // the follow-through: the rod springs back, the hero settles
    r.bend = 0.4;
    this.tweens.add({ targets: r, bend: 0, duration: 900, ease: 'Elastic.easeOut' });
    this.tweens.add({ targets: this, heroLean: 0, duration: 600, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this, arm: -0.5, duration: 600, ease: 'Sine.easeInOut' });
    // follow the lure through the air (the line paying out, the reel slowing)
    this.camK = 3.2;
    while (L.mode === 'fly') {
      r.reelRate *= 0.97;
      this.cam = { x: Math.max(bx(BOAT.hero) + 220, L.x - 40 + L.vx * 0.12), y: Math.min(WATER - 90, L.y + 70), zoom: 0.9 };
      await this.wait(16);
    }
    // splashdown: the bobber goes under and bobs back up
    r.reelRate = 0;
    L.dip = 14;
    this.tweens.add({ targets: L, dip: 0, duration: 900, ease: 'Elastic.easeOut' });
    this.splash(L.x, WATER, 10, 0.7);
    this.camK = 2;
    this.shotLine('hero');
    await this.wait(500);
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
    // ── the fight: it makes runs away from the boat (the reel screams, line goes out, the rod bends right
    // over); in between you pump the rod and wind, gaining line. It thrashes about under the hook. ──
    const xEnd = bx(BOAT.motor) + 90;
    const fp = { x: fish.x, y: fish.y, vx: 0, vy: 0 };
    let leapt = false;
    const runs = 2 + Math.floor(Math.random() * 2);
    for (let leg = 0; leg < runs * 2; leg++) {
      const run = leg % 2 === 0;
      const dur = run ? 520 + Math.random() * 260 : 760 + Math.random() * 240;
      const from = L.x;
      // (a run takes back some line; a pump-and-wind gains more than that)
      const left = Math.max(0, L.x - xEnd);
      const to = run ? Math.min(L.x + 70 + Math.random() * 70, WORLD_W - 200) : L.x - Math.max(left / (runs - Math.floor(leg / 2)), 120);
      const t0 = this.clock;
      if (run) {
        sfx.stroke();
        this.ripple(L.x, WATER, 0.9);
      }
      while (this.clock - t0 < dur) {
        const u = (this.clock - t0) / dur;
        L.x = from + (Math.max(xEnd, to) - from) * (run ? Phaser.Math.Easing.Quadratic.Out(u) : Phaser.Math.Easing.Sine.InOut(u));
        // the rod: bent right over on a run; pumped up and wound on in between
        if (run) {
          r.reelRate = -5;
          r.bend = 0.95 + Math.sin(this.clock / 50) * 0.05;
          this.arm = -1.15 + Math.sin(this.clock / 45) * 0.04;
          this.heroLean = 0.05;
        } else {
          const pump = Math.sin(u * Math.PI * 2);
          r.reelRate = 4.5;
          r.bend = 0.6 + Math.max(0, pump) * 0.25;
          this.arm = -0.9 - Math.max(0, pump) * 0.55;
          this.heroLean = -0.06 * Math.max(0, pump);
        }
        L.dip = 14 + Math.sin(this.clock / 80) * 6;
        // the fish follows the hook a little behind it, darting, deeper or shallower
        const tx = L.x + (run ? 30 : -10) + Math.sin(this.clock / 90) * 14;
        const ty = WATER + 55 + Math.sin(this.clock / 230) * 18;
        fp.vx += ((tx - fp.x) * 30 - fp.vx * 6) * 0.016;
        fp.vy += ((ty - fp.y) * 30 - fp.vy * 6) * 0.016;
        fp.x += fp.vx * 0.016;
        fp.y += fp.vy * 0.016;
        fish.setPosition(fp.x, fp.y);
        fish.setFlipX(run ? false : true).setRotation(Math.sin(this.clock / 55) * 0.3);
        fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.clock / (run ? 45 : 70)) % 3]);
        if (Math.random() < 0.25) this.bubbles(fish.x, fish.y, 1);
        // (near the surface it throws up a wake)
        if (fp.y < WATER + 50 && Math.random() < 0.25) this.ripple(fp.x, WATER, 0.5);
        this.cam = this.frameOut(bx(BOAT.hero) - 160, L.x, 0.66, 1.12, WATER - 70);
        await this.wait(16);
      }
      // (once, mid-fight, it leaps clean out of the water)
      if (!leapt && leg === 1) {
        leapt = true;
        await this.leap(fish, L);
        fp.x = fish.x;
        fp.y = fish.y;
        fp.vx = fp.vy = 0;
      }
    }
    // ── the heave: the hero hauls back, the fish comes out of the water with a splash and swings on the line ──
    sfx.whoosh();
    sfx.splash();
    this.splash(L.x, WATER, 18, 1.15);
    r.reelRate = 2;
    L.mode = 'gone';
    L.img.setVisible(false);
    fish.setDepth(8.4).setFlipX(false);
    this.tweens.killTweensOf(this);
    this.tweens.add({ targets: this, arm: -0.85, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this, heroLean: -0.12, duration: 300, ease: 'Quad.easeOut', yoyo: true, hold: 200 });
    this.tweens.add({ targets: r, bend: 0.25, duration: 500, ease: 'Sine.easeOut' });
    // (the mouth: a swinging weight on the line; thrown up and in by the heave, the line wound shorter)
    const m0 = this.mouthOf(fish);
    const hangLen = 30;
    this.swing = { x: m0.x, y: m0.y, px: m0.x + 9, py: m0.y + 16, len: Math.hypot(m0.x - r.tip.x, m0.y - r.tip.y), target: hangLen, t: this.clock };
    this.camK = 3.2;
    this.cam = { x: this.hero.x + 70, y: this.hero.y - 150, zoom: 1.6 };
    const tLift = this.clock;
    while (this.clock - tLift < 900) {
      this.swingStep(fish, w * c.k);
      if (Math.random() < 0.3) {
        const d = this.add.image(fish.x, fish.y, 'fl-drop').setScale(0.45).setDepth(8.5);
        this.tweens.add({ targets: d, x: d.x + (Math.random() - 0.5) * 60, y: d.y + 140, alpha: 0, duration: 600, ease: 'Quad.easeIn', onComplete: () => d.destroy() });
      }
      await this.wait(16);
    }
    r.reelRate = 0;
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
      // (still swinging on the line, wriggling now and then)
      if (Math.random() < 0.03 && this.swing) this.swing.px -= (Math.random() - 0.5) * 10;
      this.swingStep(fish, w * c.k);
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
    // off the hook and into the cooler
    this.dangle.hero = null;
    this.swing = null;
    this.cooler.setTexture('fl-cooler-open');
    const cool = this.onBoat(BOAT.cooler, BOAT.feet - 30);
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

  /**
   * A fish swinging on the end of the line out of the water: its mouth a weight on a rope from the
   * rod tip (gravity, a little drag), the fish hanging from it nose-up along the line, wriggling.
   */
  private swingStep(fish: Phaser.GameObjects.Sprite, len: number) {
    const sw = this.swing;
    if (!sw) return;
    const tip = this.rod.hero.tip;
    // (on the scene clock, in 60 Hz steps: the same swing however fast or slow the frames come)
    const steps = Phaser.Math.Clamp(Math.round((this.clock - sw.t) / 16.7), 0, 8);
    sw.t += steps * 16.7;
    for (let i = 0; i < steps; i++) {
      // the line wound in to its hanging length
      sw.len += (sw.target - sw.len) * 0.12;
      const vx = (sw.x - sw.px) * 0.985;
      const vy = (sw.y - sw.py) * 0.985;
      sw.px = sw.x;
      sw.py = sw.y;
      sw.x += vx;
      sw.y += vy + 0.45;
      const dx = sw.x - tip.x;
      const dy = sw.y - tip.y;
      const d = Math.hypot(dx, dy) || 1;
      // (a line, not a stick: it only pulls when it's tight)
      if (d > sw.len) {
        sw.x = tip.x + (dx / d) * sw.len;
        sw.y = tip.y + (dy / d) * sw.len;
      }
    }
    // (nose to the line; its body hanging on down from the mouth)
    const a = Math.atan2(tip.y - sw.y, tip.x - sw.x) + Math.sin(this.clock / 70) * 0.18;
    const half = len * 0.5;
    fish.setPosition(sw.x - Math.cos(a) * half * 0.88, sw.y - Math.sin(a) * half * 0.88).setRotation(a);
    fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.clock / 80) % 3]);
    this.dangle.hero = { x: sw.x, y: sw.y };
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
          x: (bx(BOAT.hero) + fish.x) / 2 + 60,
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
    this.cam.x = bx(BOAT.king) + 180;
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
    const v = 1000 + Math.random() * 380;
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
        x: Math.max(bx(BOAT.king) + 300, L.x - 150),
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
    const xEnd = bx(BOAT.motor) + 70;
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
      if (got && !fish && u > 0.4) {
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
      const b = this.onBoat(BOAT.king - 98, BOAT.feet - 26);
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

  /**
   * You've won. Taking its time: the camera in close on the hero, hopping for joy in the confetti —
   * YOU WIN. Then a cut to the dock: the show's host, on the old telly, gobsmacked ("in a shocking turn
   * of events…"). Back out over the water to the boat, where King Bob vows "I'll get you next time!",
   * leaps out of his bowl into the sea, and swims away. Then the results.
   */
  private async youWin() {
    const ch = characterById(this.fd.charId);
    const score = `${this.total('hero')} – ${this.total('king')}`;
    this.noClear = true;
    this.dom.querySelector<HTMLElement>('.fsh-meter')!.hidden = true;
    // ── 1. in close on the hero: hopping for joy, the confetti going off ──
    this.tweens.killTweensOf(this);
    this.heroLean = 0;
    this.arm = -0.85;
    this.heroPose = 'j0';
    this.camK = 2.6;
    this.cam = { x: this.hero.x - 10, y: this.hero.y - 105, zoom: 1.9 };
    await this.wait(500);
    this.tweens.add({ targets: this, heroHop: 30, duration: 240, ease: 'Quad.easeOut', yoyo: true, repeat: 6, repeatDelay: 140 });
    sfx.cheer();
    for (let i = 0; i < 6; i++)
      this.time.delayedCall(i * 430, () => {
        const v = this.cameras.main.worldView;
        this.confettiFx.cannon(v.x + 10, v.bottom - 10, -1.05 + Math.random() * 0.2, 40, { power: 1100 + Math.random() * 300 });
        this.confettiFx.cannon(v.right - 10, v.bottom - 10, -Math.PI + 1.05 - Math.random() * 0.2, 40, { power: 1100 + Math.random() * 300 });
        sfx.pop();
      });
    await this.callout(`YOU WIN!<small>${score}</small>`, 'good big', 2800);
    await this.wait(600);
    this.heroPose = null;

    // ── 2. cut to the dock: the host, on the old telly, can't believe it ──
    const tv = this.dom.querySelector<HTMLElement>('.tv-old')!;
    const board = this.dom.querySelector<HTMLElement>('.fsh-board')!;
    const ticker = this.dom.querySelector<HTMLElement>('.tv-ticker')!;
    this.cameras.main.flash(220, 255, 250, 235);
    tv.hidden = false;
    tv.classList.remove('off');
    board.hidden = true;
    ticker.hidden = true;
    this.cam = { x: HOST_X + 50, y: DOCK_TOP - 96, zoom: 2.0 };
    this.fitCamera(true);
    this.camK = 0.35;
    this.cam = { x: HOST_X + 40, y: DOCK_TOP - 100, zoom: 2.25 };
    await this.wait(700);
    this.hostShock = true;
    await this.hostSays('Folks... in a SHOCKING turn of events...', 3000);
    await this.hostSays(`${ch.name} has WON! ${ch.name} has beaten King Bob!`, 3200);
    await this.wait(400);
    this.hostShock = false;

    // ── 3. back out to the boat: King Bob ──
    tv.classList.add('off');
    this.time.delayedCall(700, () => (tv.hidden = true));
    board.hidden = false;
    ticker.hidden = false;
    this.camK = 0.9;
    // (King Bob's the one to see now: keep him out from under the scoreboard, and room over him for his bubble)
    this.noClear = false;
    this.cam = { x: bx(BOAT.king) + 150, y: WATER - 215, zoom: 1.3 };
    await this.wait(2700);
    await this.kingSays("I'll get you next time!", 2600);
    await this.wait(300);

    // ── 4. out of his bowl, into the sea, and away ──
    this.noClear = true;
    await this.kingLeaves();
    await this.wait(900);
    fadeOutMusic(500);
    const result: ResultState = { ...this.fd.result, hoops: score, level: this.fd.level ?? 5 };
    this.game.events.emit('level-complete', result);
  }

  /** King Bob, showing off: up out of his bowl in a flip, and back into it with a splash. */
  private async kingFlip() {
    const k = this.kingSpr;
    const rim = this.bowlAt(0, -BOWL.h + 22);
    /** Water thrown up out of the bowl: drops flying up and out, falling back down past the rim. */
    const splash = (n: number, up: number) => {
      for (let i = 0; i < n; i++) {
        const d = this.add.image(rim.x + (Math.random() - 0.5) * 60, rim.y + 4, 'fl-drop').setScale(0.8 + Math.random() * 1.0).setDepth(8.7);
        const vx = (Math.random() - 0.5) * 260;
        const vy = -(up * (0.6 + Math.random() * 0.6));
        const dur = 650 + Math.random() * 300;
        const x0 = d.x;
        const y0 = d.y;
        const o = { t: 0 };
        this.tweens.add({
          targets: o,
          t: 1,
          duration: dur,
          onUpdate: () => {
            const tt = (o.t * dur) / 1000;
            d.setPosition(x0 + vx * tt, y0 + vy * tt + 0.5 * 1300 * tt * tt);
          },
          onComplete: () => d.destroy(),
        });
      }
    };
    this.kingFree = true;
    k.setDepth(8.6);
    const x0 = k.x;
    const y0 = k.y;
    sfx.whoosh();
    splash(10, 380);
    const o = { t: 0 };
    await this.tw({
      targets: o,
      t: 1,
      duration: 1000,
      ease: 'Linear',
      onUpdate: () => {
        const t = o.t;
        // (up, a full flip at the top, back down where he came from)
        k.setPosition(x0 + Math.sin(t * Math.PI) * 14, y0 - Math.sin(t * Math.PI) * 150);
        k.setRotation(-Phaser.Math.Easing.Sine.InOut(t) * Math.PI * 2);
      },
    });
    k.setRotation(0).setDepth(4.35);
    this.kingFree = false;
    // SPLASH: a big burst of his water up out of the bowl, a ring of foam on it
    splash(34, 560);
    sfx.splash();
    // (a burst of spray off the top of the bowl)
    const spray = this.add.image(rim.x, rim.y - 10, 'fl-burst').setDepth(8.65).setTint(0xcff4ff).setAlpha(0.85).setScale(0.12);
    this.tweens.add({ targets: spray, scale: 0.6, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => spray.destroy() });
    const ring = this.add.image(rim.x, rim.y + 6, 'fl-ripple').setDepth(4.45).setScale(0.6, 0.5).setAlpha(1);
    this.tweens.add({ targets: ring, scaleX: 2.2, scaleY: 1.2, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    this.tweens.add({ targets: k, scaleY: k.scaleY * 0.82, scaleX: k.scaleX * 1.12, duration: 130, yoyo: true });
    await this.wait(550);
    // …and he laughs at you
    sfx.laugh();
    const sx = k.scaleX;
    const sy = k.scaleY;
    this.tweens.add({ targets: k, scaleY: sy * 1.08, scaleX: sx * 0.96, duration: 110, yoyo: true, repeat: 5 });
    await this.kingSays('HA HA HA!', 1500);
    k.setScale(sx, sy);
  }

  /** King Bob wriggles, leaps out of his bowl in a great arc over the stern, splashes into the sea and swims off. */
  private async kingLeaves() {
    const k = this.kingSpr;
    const sx = k.scaleX;
    const sy = k.scaleY;
    // a wriggle, squashed down in his water…
    this.tweens.add({ targets: k, scaleX: sx * 1.12, scaleY: sy * 0.82, duration: 200, ease: 'Sine.easeOut', yoyo: true, repeat: 1 });
    await this.wait(820);
    // …and out!
    this.kingFree = true;
    k.setDepth(8.6).setScale(sx, sy);
    const x0 = k.x;
    const y0 = k.y;
    const rim = this.bowlAt(0, -BOWL.h + 22);
    sfx.whoosh();
    for (let i = 0; i < 12; i++) {
      const d = this.add.image(rim.x + (Math.random() - 0.5) * 40, rim.y, 'fl-drop').setScale(0.5 + Math.random() * 0.4).setDepth(8.7);
      this.tweens.add({ targets: d, x: d.x + (Math.random() - 0.3) * 120, y: d.y - 40 - Math.random() * 60, duration: 300, ease: 'Quad.easeOut', yoyo: true, onComplete: () => d.destroy() });
    }
    const land = { x: bx(BOAT.transom) + 240, y: WATER + 8 };
    const peak = Math.min(y0, land.y) - 230;
    const o = { t: 0 };
    this.camK = 2.6;
    await this.tw({
      targets: o,
      t: 1,
      duration: 1250,
      ease: 'Linear',
      onUpdate: () => {
        const t = o.t;
        const u = 1 - t;
        const cx = (x0 + land.x) / 2;
        k.setPosition(u * u * x0 + 2 * u * t * cx + t * t * land.x, u * u * y0 + 2 * u * t * peak + t * t * land.y);
        // (a flip on the way over, nose down into the water at the end)
        k.setRotation(-0.5 + t * (Math.PI * 2 + 1.4));
        this.cam = { x: k.x + 40, y: Math.min(k.y, WATER - 120), zoom: 1.1 };
      },
    });
    // splash!
    sfx.splash();
    this.splash(land.x, WATER, 20, 1.2);
    k.setDepth(5.5);
    // and away under the water, a stream of bubbles behind him
    const o2 = { t: 0 };
    const sx0 = k.x;
    let lastB = 0;
    await this.tw({
      targets: o2,
      t: 1,
      duration: 2600,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const t = o2.t;
        k.setPosition(sx0 + t * 1150, WATER + 30 + Math.min(1, t * 4) * 70 + Math.sin(t * 12) * 8);
        k.setRotation(Math.sin(t * 14) * 0.12).setAlpha(t > 0.8 ? (1 - t) / 0.2 : 1);
        if (this.clock - lastB > 70) {
          lastB = this.clock;
          this.bubbles(k.x - 40, k.y, 2);
        }
        if (t < 0.55) this.cam = { x: k.x - 60, y: WATER - 60, zoom: 1.05 };
      },
    });
    k.setVisible(false);
  }

  private async kingWins() {
    this.shotBoat(1.25);
    this.cam.x = bx(BOAT.king) + 40;
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
