import Phaser from 'phaser';
import { clearWith } from '../core/screenClear';
import { characterById, type CharacterDef } from '../data/characters';
import type { Session } from '../core/session';
import { fadeOutMusic, playHoops } from '../core/music';
import { sfx } from '../core/sfx';
import { ART_RES, CHAR_H, CHAR_W, carryHand, drawCharacter } from '../gfx/draw';
import { CAST_ANGLES, HERO_SHEET_M, addCanvas, fishingWear, frameGrid, hires, makeCastSheet, makeFishFrames, type Step } from '../gfx/textures';
import {
  DEEP_STOPS,
  FAR_SEA_STOPS,
  SKY_STOPS,
  drawStrip,
  type Stops,
  BOAT as BOAT5,
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
  drawDrop,
  drawFishShadow,
  drawHullShadow,
  drawDock,
  drawHost,
  DOCK,
  HOST,
  HOST_FRAMES,
  HOST_RAIN_UP,
  drawIsland,
  drawRay,
  drawRipple,
  drawStarburst,
  drawWaveTile,
} from '../gfx/fishing';
import { FISH_SIZE, drawFish, kingBobLook, type FishKind } from '../gfx/fish';
import { BIG_SPLASH, BOATS6, SPORT_PARTS, STORM_WAVE, drawBigSplash, drawHook } from '../gfx/fishing6';
import { Storm } from '../world/Storm';
import { LIGHT } from '../core/light';
import { stingerReveal, stingerTitle } from '../ui/stinger';
import { gamepadSources } from '../input/gamepad';
import { isKeyDown } from '../input/keyboard';
import type { GameData, GameOverState, ResultState } from './GameScene';
import { loseLife } from '../core/lives';
import { SimpleConfetti } from '../world/SimpleConfetti';
import { softCircle, softShapes, type SoftShapes } from '../gfx/softShapes';
import { partSteps } from '../gfx/textures';

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
/**
 * The boat (picture units): its picture's size and top (above 0: a tower that reaches up over its
 * frame), the waterline, the deck the hero stands on (`feet`) and the one King Bob's bowl stands on
 * (`kingFeet`), and across it where King Bob, the cooler, the hero, the motor (where a line's wound in
 * to) and the transom are; `x`, the picture's left edge in the world.
 */
interface BoatGeo {
  w: number;
  h: number;
  top: number;
  water: number;
  feet: number;
  kingFeet: number;
  king: number;
  cooler: number;
  hero: number;
  motor: number;
  transom: number;
  x: number;
}
/** Boss 5: the Reel Royal. */
const GEO5: BoatGeo = { ...BOAT5, top: 0, kingFeet: BOAT5.feet, x: 20 };
/**
 * Boss 6: the Reel Royal II (fishing6.ts), a big sport-fisher: King Bob's bowl up on her flybridge, the
 * hero down in the cockpit at the stern. (Her picture's drawn 90 units down its texture: the tuna
 * tower's pennant reaches up past her frame.)
 */
const SPORT = BOATS6[0];
const GEO6: BoatGeo = { w: SPORT.w, h: 760, top: -90, water: SPORT.water, feet: SPORT.hero[1] - 2, kingFeet: SPORT.king[1] - 3, king: SPORT.king[0], cooler: 1132, hero: SPORT.hero[0], motor: 1208, transom: 1176, x: -200 };
/**
 * The boat in this contest (set as the scene starts: there's one contest at a time), how big it's
 * drawn (world px per picture unit), and across it (picture units) → the world.
 */
let BOAT: BoatGeo = GEO5;
const BS = 1.18;
const bx = (x: number) => BOAT.x + x * BS;
/** King Bob's bowl: how big (world px per bowl unit). */
const BOWL_K = 1.32;
/** The boat sits a touch bow-up. */
const TRIM = 0.014;
/** The dock (world): its left edge, and its deck's height (where the host stands). */
const DOCK_X = -2700;
const DOCK_TOP = WATER - 58;
const HOST_X = DOCK_X + 470;
const ROUNDS = 6;
/** Your turn: the bites in a row (hit them all and the fish is yours), and the cast's power (always the same). */
const BITES = 6;
const HERO_CAST = 0.7;
/** King Bob lands about this share of his casts. */
const KING_CATCH = 0.51;
/** A hero's size here: world px per art unit. */
const HERO_K = 2.38;
/** How long the BITE button can be hit for (ms). */
const BITE_MS = 589;
/**
 * Boss 6, the rematch, is a bit harder than Boss 5, in just these two ways (the owner's numbers: tune
 * them here). King Bob lands a bit more of his casts (Boss 5: KING_CATCH, 51%)…
 */
const KING_CATCH6 = 0.57;
/** …and the BITE! button stays up a bit shorter (Boss 5: BITE_MS, 589 ms). */
const BITE_MS6 = 530;

/**
 * How the contest goes. Boss 5 (RULES5) as it always was; Boss 6 (RULES6): the two numbers above, and
 * the storm's swell rocking the boat and the bobbers harder (only to look at: it changes nothing else).
 */
interface Rules {
  /** bites in a row to land a fish (all of them: it's yours; one short, a coin toss; two short, a long shot) */
  bites: number;
  /** how long the BITE! button stays up (ms) */
  biteMs: number;
  /** King Bob lands about this share of his casts */
  kingCatch: number;
  /** the boat's roll (radians, the biggest) and bob (px) in the swell */
  rock: number;
  bob: number;
  /** the bobbers riding the swell (px up and down) */
  swell: number;
  /** a lightning flash every so often, just weather (ms between them: least, most; 0: no storm) — never while a bite's coming or up */
  lightning: readonly [number, number];
}
const RULES5: Rules = { bites: BITES, biteMs: BITE_MS, kingCatch: KING_CATCH, rock: 0.018, bob: 3.2, swell: 2.5, lightning: [0, 0] };
const RULES6: Rules = { bites: BITES, biteMs: BITE_MS6, kingCatch: KING_CATCH6, rock: 0.03, bob: 6, swell: 4, lightning: [7000, 13000] };
/** A key pressed sooner than this after BITE! shows wasn't a reaction (mashing): a miss. */
const BITE_REACT_MS = 120;
/** How far past the BITE! button's edge a tap still hits it (px): its cyan ring (~17) and a fingertip of slop. */
const BITE_SLOP = 30;
/** The rods: length (world px), and how far the handle reaches behind the hands. */
const ROD_LEN = 178;
const ROD_BUTT = 34;
const KING_ROD_LEN = 150;
/** The Reel Royal II's picture resolution (she's big: a little less in light mode). */
const BOAT6_RES = LIGHT ? 1.2 : 1.5;
/**
 * King Bob's looks for Boss 6 (one sheet, `f6-kingbob`): [frame, his frame drawn, the look]. m: cross;
 * a: cross, his crown knocked askew; f: and his fins up, ready for a fight.
 */
const KING_LOOKS = [
  ['m0', 'sw0', { mad: true }],
  ['m2', 'sw2', { mad: true }],
  ['a0', 'sw0', { mad: true, askew: true }],
  ['a2', 'sw2', { mad: true, askew: true }],
  ['a4', 'sw4', { mad: true, askew: true }],
  ['f0', 'sw0', { mad: true, askew: true, fins: true }],
  ['f2', 'sw2', { mad: true, askew: true, fins: true }],
] as const;

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
  { kind: 'stone', name: 'Stone', lb: [2.2, 4.6], odds: 19, k: 0.95 },
  { kind: 'slinger', name: 'Slinger', lb: [3.1, 6.4], odds: 16, k: 0.9 },
  // (the big one: a good deal longer than the hero is tall)
  { kind: 'fat', name: 'Fat Fish', lb: [24, 41], odds: 6, k: 1.3, rare: true },
  { kind: 'kai', name: 'Kai Fish', lb: [1.4, 3.2], odds: 18, k: 1.25, rare: true },
];
type Catch = (typeof CATCHES)[number];
const pickCatch = (): Catch => {
  // (tests can pick: window.__fishKind)
  const forced = CATCHES.find((c) => c.kind === (window as unknown as { __fishKind?: string }).__fishKind);
  if (forced) return forced;
  let r = Math.random() * CATCHES.reduce((a, c) => a + c.odds, 0);
  for (const c of CATCHES) if ((r -= c.odds) < 0) return c;
  return CATCHES[0];
};
/** A catch's pictures' resolution: the big ones drawn finer, so they're not blurry up close. */
const fishRes = (c: Catch) => Math.min(2.2, Math.max(1.6, c.k * 1.6));
/** A catch's size as shown (world px). */
const fishDims = (c: Catch) => ({ w: FISH_SIZE[c.kind].w * c.k, h: FISH_SIZE[c.kind].h * c.k });

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
 * six rounds, then sudden death. Your turn: the cast is automatic (the same long one every time), the
 * lure flying out over the sea on its line, then reeling in while a fish comes to the hook and bites
 * six times: each time a round BITE! button pops up and fades fast. Hit all six and it's yours; five,
 * a 50% chance; four, 20%; fewer and it gets away. Hooked, it's a fight, a leap, and up it comes.
 * King Bob's turn is quicker (about five seconds): he casts, reels like mad, and lands about half.
 *
 * Boss 6, Part 6's boss (the scene's level 6): King Bob's rematch, the same contest on a bigger boat
 * (the Reel Royal II: his bowl up on her flybridge, the hero in the cockpit) out in a storm (world/
 * Storm), a little harder (RULES6), with its own intro (intro6) and ending (youWin6: this time the
 * hero catches him). Everything else is Boss 5's, as it was.
 */
export class FishingScene extends Phaser.Scene {
  private fd!: FishingData;
  /** Boss 6: King Bob's rematch, in a storm on the Reel Royal II (Part 6's boss). Otherwise Boss 5, as ever. */
  private v6 = false;
  /** How hard it is (see RULES5, RULES6). */
  private R: Rules = RULES5;
  /** Boss 6's weather. */
  private storm: Storm | null = null;
  /** When the next flash of lightning is due (scene clock). */
  private boltAt = 0;
  /** A bite's coming or its BITE! button's up: no lightning now (a white-out mustn't hide it). */
  private biteSoon = false;
  private clock = 0;
  private waits: { at: number; res: () => void }[] = [];
  private dom!: HTMLElement;
  private prevKey = true;
  private biteHit = false;
  /** A key mashed the moment BITE! came up: that bite's lost. (A tap off the button isn't: it stays up.) */
  private biteMiss = false;
  /** When the BITE! button came up (scene clock). */
  private biteAt = 0;
  /** There was a tap off the BITE! button (or a mashed key) during this bite: MISSED!, not TOO SLOW!. */
  private biteOff = false;
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
  /** The host's pictures: Boss 5's, or Boss 6's in his rain gear. */
  private get hostKey() {
    return this.v6 ? 'f6-host' : 'fl-host';
  }
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
  private rods!: SoftShapes;
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
  private gulls!: SoftShapes;
  private gullList: { x: number; y: number; v: number; ph: number }[] = [];
  private confettiFx!: SimpleConfetti;
  /** the boat rocking (radians) and bobbing (px) */
  private rock = 0;
  private bob = 0;
  private skipping = false;
  private inIntro = false;
  private tapListener = (e: PointerEvent) => {
    // BITE! up: a tap on it — the whole drawn button, its ring and a finger's width round that — is a
    // hit. Measured here rather than by what the browser says was under the finger: that was only the
    // white disc as it's drawn that instant (tiny while it pops in, shrinking as it fades), so taps on
    // the ring or just off the edge counted as misses.
    // (paused — the Paused menu, the phone turned upright: the contest clock has stopped with BITE! still
    // up, and a tap on the menu over that spot caught the fish)
    if (!this.sys.isActive()) return;
    const b = this.dom?.querySelector<HTMLElement>('.fsh-bite');
    if (b && !b.hidden && !this.biteHit && !this.biteMiss) {
      const r = b.getBoundingClientRect();
      const reach = b.offsetWidth / 2 + BITE_SLOP;
      if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) <= reach) {
        e.preventDefault();
        this.biteHit = true;
        return;
      }
      // (a miss doesn't end it: the button stays up for another go, if you're quick enough)
      const t = e.target as Element | null;
      if (!t?.closest?.('.hud, .screen')) this.missMark(e.clientX, e.clientY);
      return;
    }
  };

  constructor() {
    super('Fishing');
  }

  init(data: FishingData) {
    this.fd = data;
    this.v6 = data.level === 6;
    this.R = this.v6 ? RULES6 : RULES5;
    BOAT = this.v6 ? GEO6 : GEO5;
    this.storm = null;
    this.dock = null;
    this.kingLook = '';
    this.kingSwim = null;
    this.kingHooked = false;
    this.boltAt = 0;
    this.biteSoon = false;
    this.clock = 0;
    this.waits = [];
    this.prevKey = true;
    this.biteHit = false;
    this.biteMiss = false;
    this.score = { hero: [], king: [] };
    this.best = null;
    this.news = [];
    this.cam = { x: 640, y: 420, zoom: 1 };
    this.camK = 3;
    this.arm = -0.85;
    this.heroPose = null;
    // (left mid-cast or mid-landing by the Paused menu's Home screen: the rod tip's streak — timed on the
    // last contest's clock — the line down to a fish on the hook, and the hero's lean all go with it)
    this.heroLean = 0;
    this.tipTrail = [];
    this.lureTrail = [];
    this.swing = null;
    this.dangle = { hero: null, king: null };
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
    this.lineShot = false;
    this.kingShot = false;
    this.kingFree = false;
    this.heroHop = 0;
    this.boardBox = null;
  }

  // ───────────────────────────────────────────── setup ──

  private makeTextures() {
    for (const step of this.artSteps(this.fd.level ?? 5)) step.run();
  }

  /**
   * The contest's pictures not drawn yet, one step each (and the hero's casting frames, given the
   * hero). As the contest starts they're all drawn at once (makeTextures); from the Bosses menu
   * they're drawn first, a few at a time behind the loading card (see UI.gameArt) — drawn in the
   * scene's first frame, they held that frame up for a second or so on a slow phone. (The level
   * makes no difference: there's the one contest.)
   */
  artSteps(level: number, ch?: CharacterDef): Step[] {
    if (level === 6) return this.artSteps6(ch);
    const T = this.textures;
    const steps: Step[] = [];
    const add = (key: string, w: number, h: number, res: number, fn: (ctx: CanvasRenderingContext2D) => void) => {
      if (!T.exists(key))
        steps.push({
          name: key,
          run: () => {
            if (T.exists(key)) return;
            addCanvas(this, key, hires(w, h, res, fn), undefined, {
              // (the waves' tile keeps its pixels: a TileSprite of a picture that isn't a power of two in
              // both directions is drawn from a copy Phaser makes of them — without them, no waves)
              release: key !== 'fl-wave',
            });
          },
        });
    };
    // (a sheet of frames: made by its own maker, which does nothing if it's there)
    const sheet = (key: string, make: () => void) => {
      if (!T.exists(key)) steps.push({ name: key, run: make });
    };
    add('fl-boat', BOAT.w, BOAT.h, 1.5, (ctx) => drawBoat(ctx));
    add('fl-hullshadow', 256, 64, 1, (ctx) => drawHullShadow(ctx, 256, 64));
    add('fl-dock', DOCK.w, DOCK.h, 1.5, (ctx) => drawDock(ctx));
    for (const f of HOST_FRAMES) add(`fl-host-${f}`, HOST.w, HOST.h, 2, (ctx) => drawHost(ctx, f));
    add('fl-cooler', COOLER.w, COOLER.h, 2, (ctx) => drawCooler(ctx, false));
    add('fl-bowl-back', BOWL.w, BOWL.h, 2, (ctx) => drawBowlBack(ctx));
    add('fl-bowl-front', BOWL.w, BOWL.h, 2, (ctx) => drawBowlFront(ctx));
    add('fl-bobber', BOBBER.w, BOBBER.h, 3, (ctx) => drawBobber(ctx));
    add('fl-bobber-gold', BOBBER.w, BOBBER.h, 3, (ctx) => drawBobber(ctx, true));
    add('fl-sky', 4, 512, 1, (ctx) => drawStrip(ctx, 512, SKY_STOPS));
    add('fl-deep', 4, 256, 1, (ctx) => drawStrip(ctx, 256, DEEP_STOPS));
    add('fl-farsea', 4, 64, 1, (ctx) => drawStrip(ctx, 64, FAR_SEA_STOPS));
    add('fl-wave', WAVE.w, WAVE.h, 2, (ctx) => drawWaveTile(ctx));
    add('fl-island', 520, 120, 1.5, (ctx) => drawIsland(ctx, 520, 120));
    for (let i = 0; i < 3; i++) add(`fl-cloud${i}`, 240, 90, 1.5, (ctx) => drawCloud(ctx, 240, 90, 31 + i * 17));
    add('fl-ray', 120, 360, 1, (ctx) => drawRay(ctx, 120, 360));
    add('fl-shadow', 96, 44, 2, (ctx) => drawFishShadow(ctx, 96, 44));
    add('fl-burst', 256, 256, 1, (ctx) => drawStarburst(ctx, 256));
    add('fl-ripple', 64, 18, 2, (ctx) => drawRipple(ctx, 64, 18));
    add('fl-drop', 8, 8, 2, (ctx) => drawDrop(ctx, 4));
    sheet('fl-kingbob', () => makeFishFrames(this, 'fl-kingbob', 'kingbob', ['sw0', 'sw1', 'sw2', 'sw3', 'sw4', 'sw5', 'bl1', 'bl4'], 2));
    for (const c of CATCHES) sheet(`fl-fish-${c.kind}`, () => makeFishFrames(this, `fl-fish-${c.kind}`, c.kind, ['sw0', 'sw2', 'sw4'], fishRes(c)));
    if (ch) sheet(`char-${ch.id}-cast`, () => makeCastSheet(this, ch));
    return steps;
  }

  /**
   * Boss 6's pictures (as artSteps): the Reel Royal II (in three parts, a frame each), the host in his
   * rain gear, King Bob's cross looks, the storm's; and Boss 5's that it shares (the dock, the bowl,
   * the bobbers, the fish…). Not Boss 5's sunny sky, clouds, island, waves or boat.
   */
  private artSteps6(ch?: CharacterDef): Step[] {
    const T = this.textures;
    const steps: Step[] = [];
    const add = (key: string, w: number, h: number, res: number, fn: (ctx: CanvasRenderingContext2D) => void) => {
      if (!T.exists(key)) steps.push({ name: key, run: () => void (T.exists(key) || addCanvas(this, key, hires(w, h, res, fn), undefined, { release: true })) });
    };
    const sheet = (key: string, make: () => void) => {
      if (!T.exists(key)) steps.push({ name: key, run: make });
    };
    // the boat: her top (the tower, the hardtop), the flybridge, salon and cockpit, then the hull
    if (!T.exists('f6-boat'))
      steps.push(
        ...partSteps(
          'f6-boat',
          () => T.exists('f6-boat'),
          () => hires(GEO6.w, GEO6.h, BOAT6_RES, () => {}),
          SPORT_PARTS.map((part) => (c: HTMLCanvasElement) => {
            const ctx = c.getContext('2d')!;
            ctx.save();
            ctx.setTransform(BOAT6_RES, 0, 0, BOAT6_RES, 0, 0);
            ctx.translate(0, -GEO6.top);
            part(ctx);
            ctx.restore();
          }),
          (c) => addCanvas(this, 'f6-boat', c, undefined, { release: true }),
        ),
      );
    add('fl-hullshadow', 256, 64, 1, (ctx) => drawHullShadow(ctx, 256, 64));
    add('fl-dock', DOCK.w, DOCK.h, 1.5, (ctx) => drawDock(ctx));
    // (the host's sou'wester reaches up over his frame: HOST_RAIN_UP more room on top)
    for (const f of HOST_FRAMES)
      add(`f6-host-${f}`, HOST.w, HOST.h + HOST_RAIN_UP, 2, (ctx) => {
        ctx.translate(0, HOST_RAIN_UP);
        drawHost(ctx, f, true);
      });
    add('fl-cooler', COOLER.w, COOLER.h, 2, (ctx) => drawCooler(ctx, false));
    add('fl-bowl-back', BOWL.w, BOWL.h, 2, (ctx) => drawBowlBack(ctx));
    add('fl-bowl-front', BOWL.w, BOWL.h, 2, (ctx) => drawBowlFront(ctx));
    add('fl-bobber', BOBBER.w, BOBBER.h, 3, (ctx) => drawBobber(ctx));
    add('fl-bobber-gold', BOBBER.w, BOBBER.h, 3, (ctx) => drawBobber(ctx, true));
    add('fl-shadow', 96, 44, 2, (ctx) => drawFishShadow(ctx, 96, 44));
    add('fl-burst', 256, 256, 1, (ctx) => drawStarburst(ctx, 256));
    add('fl-ripple', 64, 18, 2, (ctx) => drawRipple(ctx, 64, 18));
    add('fl-drop', 8, 8, 2, (ctx) => drawDrop(ctx, 4));
    add('f6-bigsplash', BIG_SPLASH.w, BIG_SPLASH.h, 1.5, (ctx) => drawBigSplash(ctx));
    add('f6-hook', 24, 30, 3, (ctx) => drawHook(ctx, 14, 28, 22));
    steps.push(...Storm.artSteps(this));
    sheet('fl-kingbob', () => makeFishFrames(this, 'fl-kingbob', 'kingbob', ['sw0', 'sw1', 'sw2', 'sw3', 'sw4', 'sw5', 'bl1', 'bl4'], 2));
    // King Bob cross (red in the face, scowling, shouting), his crown knocked askew, his fins up
    sheet('f6-kingbob', () => {
      const { w, h } = FISH_SIZE.kingbob;
      const res = 2;
      const fw = Math.round(w * res);
      const fh = Math.round(h * res);
      const g = frameGrid(KING_LOOKS.length, fw, fh);
      const c = hires(g.w, g.h, 1, (ctx) =>
        KING_LOOKS.forEach(([, f, look], i) => {
          Object.assign(kingBobLook, look);
          try {
            ctx.save();
            ctx.beginPath();
            ctx.rect(g.x(i), g.y(i), fw, fh);
            ctx.clip();
            ctx.translate(g.x(i), g.y(i));
            ctx.scale(res, res);
            drawFish(ctx, 0, 0, 'kingbob', f);
            ctx.restore();
          } finally {
            kingBobLook.mad = kingBobLook.askew = kingBobLook.fins = false;
          }
        }),
      );
      addCanvas(this, 'f6-kingbob', c, (t) => KING_LOOKS.forEach(([name], i) => t.add(name, 0, g.x(i), g.y(i), fw, fh)), { release: true });
    });
    for (const c of CATCHES) sheet(`fl-fish-${c.kind}`, () => makeFishFrames(this, `fl-fish-${c.kind}`, c.kind, ['sw0', 'sw2', 'sw4'], fishRes(c)));
    if (ch) sheet(`char-${ch.id}-cast`, () => makeCastSheet(this, ch));
    return steps;
  }

  /**
   * A gradient strip stretched over a box of the scene (the sky, the far sea, the deep water). With
   * WebGL it's drawn as rectangles shaded from colour to colour, one per step, not as the strip's
   * picture: the same gradient (to 1/255), and much less work for the graphics chip than reading
   * a picture for every pixel — together they cover the whole screen.
   */
  private strip(x: number, y: number, w: number, h: number, key: string, stops: Stops, depth: number) {
    if (!(this.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) {
      this.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(w, h).setDepth(depth);
      return;
    }
    const g = this.add.graphics().setDepth(depth);
    for (let i = 1; i < stops.length; i++) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const a = Phaser.Display.Color.HexStringToColor(c0).color;
      const b = Phaser.Display.Color.HexStringToColor(c1).color;
      g.fillGradientStyle(a, a, b, b, 1);
      g.fillRect(x, y + t0 * h, w, (t1 - t0) * h);
    }
  }

  create() {
    this.makeTextures();
    const ch = characterById(this.fd.charId);
    this.heroKey = makeCastSheet(this, ch);
    clearWith(this, this.v6 ? '#3a4458' : '#8fd0f6');

    if (this.v6) this.stormScenery();
    else this.sunnyScenery();

    // ── the boat, King Bob in his bowl, the cooler, the hero ──
    this.boat = this.add
      .image(0, 0, this.v6 ? 'f6-boat' : 'fl-boat')
      .setScale(BS / (this.v6 ? BOAT6_RES : 1.5))
      .setDepth(4);
    // (the hull's shadow down in the water under it)
    this.add
      .image(bx(BOAT.w * 0.46), WATER + 70, 'fl-hullshadow')
      .setDisplaySize(BOAT.w * BS * 1.05, 170)
      .setDepth(1.25)
      .setAlpha(0.8);
    // the show's dock off to the left, and its host on it
    this.dock = this.add
      .image(DOCK_X, DOCK_TOP - DOCK.deck, 'fl-dock')
      .setOrigin(0, 0)
      .setScale(1 / 1.5)
      .setDepth(3.5);
    // (Boss 6: in his rain gear, his hat up over the top of his frame)
    const up = this.v6 ? HOST_RAIN_UP : 0;
    this.host = this.add
      .image(HOST_X, DOCK_TOP - 12, `${this.hostKey}-t0`)
      .setOrigin(62 / HOST.w, (186 + up) / (HOST.h + up))
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
    if (this.v6) this.stormSurface();
    else {
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
      // (a plain colour: a rectangle, not a white picture tinted — the same, without a picture read
      // for each of its pixels, a good part of the screen)
      this.add
        .rectangle(WORLD_L, WATER + 22, WORLD_W - WORLD_L + 400, WORLD_BOTTOM - WATER, 0x0d5f92)
        .setOrigin(0, 0)
        .setAlpha(0.3)
        .setDepth(6.4);
    }

    // the rods and the lines (drawn every frame), the bobbers
    this.rods = softShapes(this).setDepth(7);
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
    this.shadeBoat();
    for (const who of ['hero', 'king'] as const) this.hangLure(who);

    // ── the HUD: the scoreboard, the BITE button, the call-outs ──
    this.dom = document.createElement('div');
    this.dom.className = 'hoops fishing';
    this.dom.innerHTML = `
      <div class="fsh-board" hidden>
        <div class="tv-head"><i class="tv-logo"></i><span class="tv-title"><small>KING BOB'S</small>${this.v6 ? 'REMATCH' : 'FISH-OFF'}</span><span class="tv-live"><i></i>LIVE</span></div>
        <div class="fsh-row" data-who="hero"><img class="tv-face" alt=""><span class="fsh-name">${ch.name.toUpperCase()}</span><span class="fsh-dots"></span><b class="fsh-total">0</b></div>
        <div class="fsh-row" data-who="king"><img class="tv-face" alt=""><span class="fsh-name">KING BOB</span><span class="fsh-dots"></span><b class="fsh-total">0</b></div>
        <div class="tv-foot"><span class="fsh-round"></span><span class="tv-best"></span></div>
      </div>
      <div class="tv-old" hidden>
        <div class="tvo-roll"></div>
        <div class="tvo-bug">WWS<small>LIVE</small></div>
        <div class="tvo-title"><small>THE WONDERFUL WORLD OF</small><b>SPORTS</b><span>CHUCK RIVERS · ${this.v6 ? 'LIVE IN THE STORM' : 'LIVE FROM THE DOCKS'}</span></div>
        <div class="tvo-cc"></div>
      </div>
      <div class="tv-ticker" hidden><b>${this.v6 ? 'REEL ROYAL II TV' : 'REEL ROYAL TV'}</b><div class="tv-crawl"><span></span></div></div>
      <button class="fsh-bite" hidden aria-label="Bite: strike now"><svg class="fb-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" pathLength="100"></circle></svg><b>BITE!</b></button>
      <div class="fsh-callout"></div>
      <div class="fsh-catch" hidden><em></em><div class="lt"><small></small><b></b><span></span></div></div>
      <button class="hoops-skip" hidden>Skip ›</button>`;
    document.getElementById('ui')!.appendChild(this.dom);
    window.addEventListener('pointerdown', this.tapListener, true);
    this.drawPortraits();
    const bite = this.dom.querySelector<HTMLButtonElement>('.fsh-bite')!;
    // (hits are measured in tapListener; this only keeps the tap from going on to anything else)
    bite.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
    const skip = this.dom.querySelector<HTMLButtonElement>('.hoops-skip')!;
    skip.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.inIntro) this.skipping = true;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('pointerdown', this.tapListener, true);
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

  /** Boss 6's near surface: the storm's taller swell lapping the hull (as Boss 5's waves), and the murk's tint under it. */
  private stormSurface() {
    // (Boss 6: the storm's taller swell, the same way)
    for (const [y, a, d, sp] of [
      [WATER - STORM_WAVE.top - 14, 0.55, 3.9, 0.7],
      [WATER - STORM_WAVE.top, 1, 6, 1.4],
    ] as const) {
      const w = this.add
        .tileSprite(WORLD_L, y, WORLD_W - WORLD_L + 400, STORM_WAVE.h, 'f6-wave')
        .setOrigin(0, 0)
        .setTileScale(1 / Storm.WAVE_RES, 1 / Storm.WAVE_RES)
        .setDepth(d)
        .setAlpha(a);
      w.setData('sp', sp);
      this.waves.push(w);
    }
    this.add
      .rectangle(WORLD_L, WATER + STORM_WAVE.h - STORM_WAVE.top - 2, WORLD_W - WORLD_L + 400, WORLD_BOTTOM - WATER, 0x08243a)
      .setOrigin(0, 0)
      .setAlpha(0.32)
      .setDepth(6.4);
  }

  /** Boss 5's scenery: a sunny day, the sky, the far-off sea and an island, clouds and gulls, light down into the water. */
  private sunnyScenery() {
    // ── the sky, the far-off sea and an island on the horizon ──
    const HORIZON = WATER - 74;
    this.strip(WORLD_L, WORLD_TOP, WORLD_W - WORLD_L + 400, HORIZON - WORLD_TOP, 'fl-sky', SKY_STOPS, 0);
    this.strip(WORLD_L, HORIZON, WORLD_W - WORLD_L + 400, WATER - HORIZON + 10, 'fl-farsea', FAR_SEA_STOPS, 0.2);
    // the sun, a soft glow (it barely moves: far away)
    this.add.image(1180, 150, 'fl-burst').setScale(1.1).setAlpha(0.55).setDepth(0.1).setScrollFactor(0.15, 0.6);
    softCircle(this, 1180, 150, 40, 0xfff6c8).setDepth(0.12).setScrollFactor(0.15, 0.6);
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
    this.gulls = softShapes(this).setDepth(0.3);
    for (let i = 0; i < 4; i++)
      this.gullList.push({
        x: Math.random() * 2400,
        y: 90 + Math.random() * 160,
        v: 30 + Math.random() * 30,
        ph: Math.random() * 6,
      });

    // ── the water: deep under the surface, light coming down in rays, little fish going by ──
    this.strip(WORLD_L, WATER, WORLD_W - WORLD_L + 400, WORLD_BOTTOM - WATER + 40, 'fl-deep', DEEP_STOPS, 1);
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
  }

  /**
   * Boss 6's scenery: the storm (see world/Storm: the sky, cloud bands, the swells, the deep, the rain
   * and its splashes), and fish going by down in the murk.
   */
  private stormScenery() {
    this.gulls = softShapes(this).setDepth(0.3);
    this.storm = new Storm(this, { water: WATER, horizon: WATER - 74, left: WORLD_L, right: WORLD_W + 400, top: WORLD_TOP, bottom: WORLD_BOTTOM }, () => this.rainHits());
    this.storm.build();
    // (a flash lights the boat up: it's shaded darker for the storm otherwise)
    this.storm.onLit = (on) => this.shadeBoat(on);
    for (let i = 0; i < 7; i++) {
      const y0 = WATER + 120 + Math.random() * 220;
      const img = this.add
        .image(Math.random() * WORLD_W, y0, 'fl-shadow')
        .setDepth(1.3)
        .setAlpha(0.16 + Math.random() * 0.1)
        .setScale(0.35 + Math.random() * 0.3);
      const v = (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 30);
      img.setFlipX(v < 0);
      this.schools.push({ img, v, y0, ph: Math.random() * 6 });
    }
  }

  /** The boat's shade in the storm (a touch darker: the heroes and King Bob aren't, so they stand out), lit by a flash, gone as it clears. */
  private shadeBoat(lit = false) {
    if (!this.v6 || !this.boat) return;
    const k = lit ? 0 : 0.2 * (1 - (this.storm?.clearing ?? 0));
    const c = (v: number) => Math.round(255 - (255 - v) * k);
    const tint = Phaser.Display.Color.GetColor(c(28), c(40), c(64));
    this.boat.setTint(tint);
    this.dock?.setTint(tint);
  }
  private dock: Phaser.GameObjects.Image | null = null;

  /**
   * Where the rain splashes (world segments): along the boat's decks in Boss 6 — the cockpit, the
   * flybridge, the hardtop, the top of the tower, the foredeck — and the dock's (picture points from
   * the concept's DECK_HITS, on the boat as she rolls).
   */
  private rainHits(): [number, number, number, number][] {
    const out: [number, number, number, number][] = [];
    const seg = (x0: number, y0: number, x1: number, y1: number) => {
      const a = this.onBoat(x0, y0);
      const b = this.onBoat(x1, y1);
      out.push([a.x, a.y, b.x, b.y]);
    };
    // (picture units, the superstructure's 15 up already taken off)
    seg(880, 414, 1170, 419);
    seg(460, 253, 900, 251);
    seg(462, 156, 780, 155);
    seg(574, -17, 676, -17);
    seg(110, 345, 300, 391);
    out.push([DOCK_X + 30, DOCK_TOP + 2, DOCK_X + DOCK.w - 40, DOCK_TOP + 2]);
    return out;
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



  /** A key (or a gamepad button) just went down. */
  private keyPressed() {
    let key = isKeyDown('Space') || isKeyDown('Enter') || isKeyDown('KeyF') || isKeyDown('KeyJ') || isKeyDown('ArrowUp') || isKeyDown('KeyW');
    for (const g of gamepadSources) if (g.connected()) key ||= g.poll().jump || g.poll().fire;
    const pressed = key && !this.prevKey;
    this.prevKey = key;
    return pressed;
  }

  /** A point on the boat (picture coords) → the world, with the boat's rock and bob. */
  private onBoat(px0: number, py0: number) {
    // (about the waterline amidships: picture units scaled to the world, then the rock and the bob)
    const px = bx(BOAT.w / 2);
    const py = WATER;
    const x = bx(px0) - px;
    const y = WATER - BOAT.water * BS + py0 * BS - py;
    const a = this.rock + TRIM;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: px + x * c - y * s, y: py + this.bob + x * s + y * c };
  }
  /** A point on King Bob's bowl (bowl units from the bottom of its stand) → the world. */
  private bowlAt(dx: number, dy: number) {
    const base = this.onBoat(BOAT.king, BOAT.kingFeet + 3);
    const a = this.rock + TRIM;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = dx * BOWL_K;
    const y = dy * BOWL_K;
    return { x: base.x + x * c - y * s, y: base.y + x * s + y * c };
  }

  private placeBoat() {
    const a = this.rock + TRIM;
    const p = this.onBoat(BOAT.w / 2, BOAT.top + BOAT.h / 2);
    this.boat.setPosition(p.x, p.y).setRotation(a);
    const c = this.onBoat(BOAT.cooler, BOAT.feet + 2);
    this.cooler.setPosition(c.x, c.y).setRotation(a);
    const bk = this.onBoat(BOAT.king - 98, BOAT.kingFeet + 2);
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
    if (this.v6 && (this.lineShot || this.kingFree)) boxes.pop();
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
    // (Boss 6: King Bob's bowl is up on the flybridge, well over the hero: out on a line, or once he's
    // out of it, the shot isn't pulled up to take it in)
    if (this.v6 && (this.lineShot || this.kingFree)) boxes.pop();
    // (and a shot of King Bob talking keeps him and his bubble in, the hero down below or not)
    else if (this.v6 && this.kingShot) {
      boxes.shift();
      boxes[0][1] -= 90;
    }
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
    this.lineShot = false;
    this.cam = { x: bx(BOAT.hero) - 110, y: WATER - 100 - this.lift, zoom };
  }
  /** The shot's out along a line (or after a fish on one), not on the boat. */
  private lineShot = false;
  /** Boss 6: the shot's on King Bob, saying something (see keepInView). */
  private kingShot = false;
  /** How much higher the shots of the boat sit (Boss 6: King Bob's bowl is up on the flybridge). */
  private get lift() {
    return this.v6 ? 150 : 0;
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
    this.lineShot = true;
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
    this.rock = Math.sin(t * 1.05) * this.R.rock * (2 / 3) + Math.sin(t * 0.47 + 1) * this.R.rock * (1 / 3);
    this.bob = Math.sin(t * 1.3) * this.R.bob;
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
    if (this.storm) this.weather(dt);

    // the host: his mouth flapping while he talks
    this.hostMouthT -= dt;
    if (this.hostMouthT <= 0) {
      this.hostOpen = this.hostTalk && !this.hostOpen;
      this.hostMouthT = 80 + Math.random() * 110;
    }
    this.host.setTexture(`${this.hostKey}-${this.hostShock ? 's' : this.hostPoint ? 'p' : 't'}${this.hostOpen ? 1 : 0}`);
    this.host.y = DOCK_TOP - 12 + (this.hostTalk ? Math.sin(this.clock / 130) * 1.5 : 0);

    // the anglers
    this.placeBoat();
    const cf = this.castFrame();
    this.hero.setFrame(this.heroPose ?? cf.frame);
    const kf = Math.floor(t * 5) % 6;
    // (swimming off: his tail going like mad)
    if (this.kingLook) this.kingFrame(t);
    else this.kingSpr.setFrame(this.kingFree ? `sw${Math.floor(t * 16) % 6}` : Math.floor(t * 0.7) % 5 === 0 && t % 1.4 < 0.15 ? 'bl1' : `sw${kf}`);
    if (this.kingSwim) this.swimKing(s);
    this.updateRods(s);
    for (const who of ['hero', 'king'] as const) this.updateLure(who, s);
    // (King Bob on the end of your line: he swings from the rod tip)
    if (this.kingHooked && this.swing) this.swingStep(this.kingSpr, this.kingSpr.displayWidth);
    this.drawRods();
    this.fitCamera();

    if (this.inIntro) {
      const canSkip = this.clock > 1800;
      this.dom.querySelector<HTMLElement>('.hoops-skip')!.hidden = !canSkip || this.skipping;
      if (canSkip && !this.skipping && (isKeyDown('Enter') || isKeyDown('Escape'))) this.skipping = true;
    }
    // BITE! is hit by tapping IT (its own listener) — a tap anywhere else while it's up is a miss
    // (it used to count as a hit: tapping anywhere caught fish). A key or gamepad button hits it
    // too, but not one pressed quicker than anyone could react (mashing): that's a miss as well.
    const bite = this.dom.querySelector<HTMLElement>('.fsh-bite')!;
    if (!bite.hidden && !this.biteHit && !this.biteMiss) {
      const key = this.keyPressed();
      if (key && this.clock - this.biteAt < BITE_REACT_MS) this.biteMiss = true;
      else if (key) this.biteHit = true;
    }
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

  /**
   * Boss 6's weather each frame: the storm, and a flash of lightning every so often — but never while
   * a bite's coming or its BITE! button's up (a white-out mustn't hide it: see heroTurn), and none once
   * the storm's breaking up.
   */
  private weather(dt: number) {
    const storm = this.storm!;
    storm.update(dt);
    const [lo, hi] = this.R.lightning;
    if (!lo || storm.clearing > 0) return;
    if (!this.boltAt) this.boltAt = this.clock + lo + Math.random() * (hi - lo);
    if (this.clock < this.boltAt || storm.flashing) return;
    // (a bite on its way: try again in a moment)
    if (this.biteSoon) {
      this.boltAt = this.clock + 700;
      return;
    }
    storm.flash();
    this.boltAt = this.clock + lo + Math.random() * (hi - lo);
  }

  /** King Bob's look (Boss 6's sheet of cross faces, crown askew, fins up), or '' for his usual. */
  private kingLook: '' | 'm' | 'a' | 'f' = '';
  private kingFrame(t: number) {
    const k = this.kingSpr;
    const n = this.kingLook === 'a' ? ['0', '2', '4'] : ['0', '2'];
    const f = `${this.kingLook}${n[Math.floor(t * (this.kingFree ? 12 : 4)) % n.length]}`;
    if (k.texture.key !== 'f6-kingbob') k.setTexture('f6-kingbob', f);
    else k.setFrame(f);
  }
  /** Back to his usual look. */
  private kingPlain() {
    this.kingLook = '';
    if (this.kingSpr.texture.key !== 'fl-kingbob') this.kingSpr.setTexture('fl-kingbob', 'sw0');
  }
  /** Boss 6's ending: King Bob swimming off under the water (px/s), and hooked on your line. */
  private kingSwim: { v: number; y: number } | null = null;
  private kingHooked = false;
  private swimKing(s: number) {
    const k = this.kingSpr;
    const sw = this.kingSwim!;
    k.x += sw.v * s;
    k.y = sw.y + Math.sin(this.clock / 160) * 6;
    k.setRotation(Math.sin(this.clock / 90) * 0.12);
    if (Math.random() < s * 14) this.bubbles(k.x - 40, k.y, 1);
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
      const y = WATER - 7 + Math.sin(t * 2.4 + (who === 'king' ? 1 : 0)) * this.R.swell + L.dip;
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
    const items = this.v6
      ? [
          ...this.news,
          'STORM WARNING IN EFFECT',
          'WIND NW 38 KNOTS',
          'SEAS 8–12 FT',
          'KING BOB: 313 CONTESTS, 312 WINS',
          `PRO TIP: HOOK ALL ${this.R.bites} BITES AND THE FISH IS YOURS`,
          'THE BITES DON’T WAIT — STRIKE FAST!',
        ]
      : [
          ...this.news,
          'WATER 72°F',
          'WIND NE 6 KNOTS',
          'SEAS 1–2 FT',
          'KING BOB: 312 CONTESTS, 312 WINS',
          'PRO TIP: HOOK ALL 6 BITES AND THE FISH IS YOURS',
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

  /** A tap that missed BITE!: a little ring where it landed (the button stays up for another go). */
  private missMark(x: number, y: number) {
    this.biteOff = true;
    const m = document.createElement('i');
    m.className = 'fsh-miss';
    m.style.left = `${x}px`;
    m.style.top = `${y}px`;
    this.dom.appendChild(m);
    m.addEventListener('animationend', () => m.remove());
    setTimeout(() => m.remove(), 600);
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
    b.style.setProperty('--life', `${this.R.biteMs}ms`);
    b.hidden = false;
    b.classList.remove('go', 'hit');
    void b.offsetWidth;
    b.classList.add('go');
    this.biteHit = false;
    this.biteMiss = false;
    this.biteAt = this.clock;
    this.biteOff = false;
    this.prevKey = true;
    const end = this.clock + this.R.biteMs;
    while (this.clock < end && !this.biteHit && !this.biteMiss) await this.wait(16);
    const hit = this.biteHit && !this.biteMiss;
    this.biteOff ||= this.biteMiss;
    this.biteHit = false;
    this.biteMiss = false;
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
    if (this.v6) await this.intro6();
    else await this.intro5();
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
    if (you > king) await (this.v6 ? this.youWin6() : this.youWin());
    else await this.kingWins();
  }

  /** Boss 5's intro: the show's host on the dock, the swoop out to the boat, King Bob's flip. */
  private async intro5() {
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
    // (the purple sweep clears (760 ms); then a beat on him, mic up, before he speaks)
    await this.iwait(760);
    // (a slow push in on him while he talks)
    this.camK = 0.4;
    this.cam = { x: HOST_X + 50, y: DOCK_TOP - 96, zoom: 2.0 };
    await this.iwait(1100);
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
    await this.say(text, this.bowlAt(50, -BOWL.h + 26), ms);
  }
  /** A speech bubble up to the right of `at` (world), its tail pointing in at it. */
  private async say(text: string, at: { x: number; y: number }, ms: number) {
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
    const g = softShapes(this).setDepth(10.9);
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

  private async heroTurn(_round: number): Promise<boolean> {
    const L = this.lures.hero;
    this.shotBoat(1.12);
    this.cam.x = bx(BOAT.hero) + 140;
    // (a little higher: the rod's tip in the shot)
    this.cam.y = WATER - 120 - this.lift * 0.6;
    this.arm = -0.85;
    this.hangLure('hero');
    await this.callout('YOUR CAST', 'you', 900);
    // the cast is automatic, the same good long one every time; it's all in the bites
    await this.heroCast(HERO_CAST);
    this.callout(`HOOK IT!<small>${this.R.bites} bites — get them all</small>`, 'good', 1300);
    // ── reeling in: one fish comes to the hook and bites, again and again, as the bobber comes in ──
    const r = this.rod.hero;
    r.reelRate = 0.9;
    this.heroPose = null;
    this.arm = -0.5;
    const startX = L.x;
    const endX = bx(BOAT.motor) + 80;
    // (a random wait before each bite)
    const BITES = this.R.bites;
    const gaps = Array.from({ length: BITES }, () => 1100 + Math.random() * 700);
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
    // the fish: its shadow comes over to the hook, and stays about it, biting (as big as the fish it is:
    // a huge one means the Fat Fish's about)
    const c = pickCatch();
    const shK = Phaser.Math.Clamp((fishDims(c).w * 0.85) / 96, 0.7, 2.6);
    const deep = (shK - 1) * 14;
    const fish = this.add
      .image(L.x + (Math.random() < 0.5 ? -1 : 1) * 320, WATER + 130 + Math.random() * 60 + deep, 'fl-shadow')
      .setDepth(5.5)
      .setAlpha(0);
    const fromLeft = fish.x < L.x;
    fish.setFlipX(!fromLeft).setScale(shK * (0.92 + Math.random() * 0.16));
    this.tweens.add({ targets: fish, alpha: 0.85, duration: 300 });
    let hits = 0;
    for (let i = 0; i < BITES; i++) {
      // (the first time it swims in from off to the side; after that it hangs about the hook, backing
      // off a little and nosing in again)
      const approach = gaps[i] - 300;
      const tA = this.clock;
      const sx = fish.x;
      const sy = fish.y;
      while (this.clock - tA < approach) {
        reelTo();
        this.shotLine('hero');
        this.heroPose = Math.floor(this.clock / 140) % 2 ? 'r1' : 'r0';
        const u = Phaser.Math.Easing.Sine.InOut(Math.min(1, (this.clock - tA) / approach));
        fish.x = sx + (L.x + (fromLeft ? -34 : 34) * shK - sx) * u;
        fish.y = sy + (WATER + 52 + deep - sy) * u + Math.sin(this.clock / 180) * 3;
        await this.wait(16);
      }
      // nibble, nibble… BITE (no lightning from here till it's over)
      this.biteSoon = true;
      for (let k = 0; k < 2; k++) {
        L.dip = 5;
        fish.x += fromLeft ? 6 : -6;
        this.ripple(L.x, WATER, 0.5);
        await this.wait(150);
        L.dip = 0;
        fish.x -= fromLeft ? 6 : -6;
        await this.wait(170 + Math.random() * 120);
      }
      // (and should a flash be showing, the bite waits for it to go: the button's never hidden by it)
      while (this.storm?.flashing) await this.wait(16);
      L.dip = 16;
      r.bend = 0.35;
      this.ripple(L.x, WATER, 1);
      sfx.bloop();
      const hit = await this.biteButton();
      this.biteSoon = false;
      if (hit) {
        // a strike: the rod snaps up
        hits++;
        this.heroPose = null;
        this.arm = -1.3;
        r.bend = 0.55;
        sfx.whoosh();
        this.callout(`GOT IT!<small class="cnt">${hits} of ${BITES}</small>`, 'good small', 650);
        await this.wait(160);
        this.arm = -0.5;
      } else {
        this.callout(`${this.biteOff ? 'MISSED!' : 'TOO SLOW!'}<small class="cnt">${hits} of ${BITES}</small>`, 'bad small', 650);
      }
      L.dip = 0;
      r.bend = 0;
      // (it backs off a little before it comes in again)
      if (i < BITES - 1) this.tweens.add({ targets: fish, x: fish.x + (fromLeft ? -50 : 50), y: fish.y + 22, duration: 300, ease: 'Sine.easeOut' });
      await reelFor(260);
    }
    // all six: it's yours; five: a coin toss; four: a long shot; fewer, it gets away
    const forced = (window as unknown as { __fishOdds?: number }).__fishOdds;
    const chance = forced ?? (hits >= BITES ? 1 : hits === BITES - 1 ? 0.5 : hits === BITES - 2 ? 0.2 : 0);
    if (Math.random() < chance) {
      this.heroPose = null;
      this.arm = -1.55;
      r.bend = 0.6;
      sfx.whoosh();
      await this.wait(140);
      await this.heroCatch(fish, c);
      return true;
    }
    // it gets away
    this.callout(hits >= BITES - 2 ? 'IT GOT AWAY!' : 'GONE!', 'bad small', 800);
    this.tweens.add({
      targets: fish,
      x: fish.x + (fromLeft ? -420 : 420),
      y: fish.y + 80,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeIn',
      onComplete: () => fish.destroy(),
    });
    this.bubbles(L.x, WATER + 50, 6);
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
      this.lineShot = true;
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
      const b = softCircle(this, x + (Math.random() - 0.5) * 30, y + Math.random() * 20, 2 + Math.random() * 3, 0xffffff, 0.55).setDepth(5.6);
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
   * name and weight — then tossed back in the sea.
   */
  private async heroCatch(shadow: Phaser.GameObjects.Image, c: Catch) {
    const L = this.lures.hero;
    const r = this.rod.hero;
    const dims = fishDims(c);
    // (a big fish swims deeper, so it's all under the water; and the camera stands back to fit it in)
    const dd = Math.max(0, dims.h / 2 - 40);
    const fitZ = Math.min(1, 165 / Math.max(dims.w, dims.h * 1.2));
    const lb = Math.round((c.lb[0] + Math.random() * (c.lb[1] - c.lb[0])) * 10) / 10;
    const { w } = FISH_SIZE[c.kind];
    const fish = this.add
      .sprite(shadow.x, shadow.y, `fl-fish-${c.kind}`, 'sw0')
      .setScale(c.k / fishRes(c))
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
        const ty = WATER + 55 + dd + Math.sin(this.clock / 230) * 18;
        fp.vx += ((tx - fp.x) * 30 - fp.vx * 6) * 0.016;
        fp.vy += ((ty - fp.y) * 30 - fp.vy * 6) * 0.016;
        fp.x += fp.vx * 0.016;
        fp.y += fp.vy * 0.016;
        fish.setPosition(fp.x, fp.y);
        fish.setFlipX(run ? false : true).setRotation(Math.sin(this.clock / 55) * 0.3);
        fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.clock / (run ? 45 : 70)) % 3]);
        if (Math.random() < 0.25) this.bubbles(fish.x, fish.y, 1);
        // (near the surface it throws up a wake)
        if (fp.y - dd < WATER + 50 && Math.random() < 0.25) this.ripple(fp.x, WATER, 0.5 * Math.max(1, dims.w / 140));
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
    this.cam = { x: this.hero.x + 70, y: this.hero.y - 150, zoom: 1.6 * fitZ };
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
    // (a big one held further out, over the side, so it's not on top of the hero)
    this.arm = -0.85 + Math.max(0, dims.w / 120 - 1) * 0.15;
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
        y: fish.y + 40 * fitZ,
        zoom: 1.6 * fitZ,
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
    // off the hook and back in the sea it goes
    await this.tossBack(fish, c);
    card.hidden = true;
    this.dangle.hero = null;
    r.taut = false;
    r.bend = 0;
    this.heroPose = null;
    this.arm = -0.85;
    await this.wait(120);
    this.hangLure('hero');
    this.camK = 2.2;
    this.shotBoat(1);
    await this.wait(500);
  }

  /**
   * Back it goes: the hero swings the rod up and back, then flicks it forward; the fish comes off the
   * hook and sails out over the side, turning over in the air (a little one spins, the Fat Fish
   * flops), lands with a splash as big as it is, and swims off — with a happy leap on its way.
   * Everything scales with the fish: how far and high it goes, how fast it turns, the splash.
   */
  private async tossBack(fish: Phaser.GameObjects.Sprite, c: Catch) {
    const r = this.rod.hero;
    const dims = fishDims(c);
    // (how hefty it is: 1 = a Stone; the Fat Fish about 2.3, a Zippy under 0.8)
    const m = Phaser.Math.Clamp(dims.w / 120, 0.6, 2.6);
    const dd = Math.max(0, dims.h / 2 - 40);
    const fitZ = Math.min(1, 165 / Math.max(dims.w, dims.h * 1.2));
    const heroX = this.hero.x;
    this.camK = 2.6;
    // ── 1. the swing back: the rod up and back over the shoulder, the fish swinging along under it ──
    this.heroPose = null;
    this.tweens.killTweensOf(this);
    this.tweens.killTweensOf(r);
    this.tweens.add({ targets: this, heroLean: -0.1, duration: 440, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this, arm: -2.05, duration: 440, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: r, bend: Math.min(0.75, 0.3 + 0.15 * m), duration: 440, ease: 'Sine.easeOut' });
    let t0 = this.clock;
    while (this.clock - t0 < 500) {
      this.swingStep(fish, dims.w);
      this.cam = { x: (heroX + fish.x) / 2 + 30, y: Math.min(fish.y, this.hero.y - 120) + 20, zoom: 1.35 * fitZ };
      await this.wait(16);
    }
    // ── 2. the flick: the rod whips forward and the fish comes off the hook at the top ──
    sfx.whoosh();
    this.tipTrail = [];
    this.tweens.add({ targets: this, heroLean: 0.1, duration: 260, ease: 'Cubic.easeIn' });
    const whip = this.tweens.add({ targets: this, arm: -0.35, duration: 260, ease: 'Cubic.easeIn' });
    r.bend = -0.45;
    while (this.arm < -1.05 && !whip.isFinished()) {
      this.swingStep(fish, dims.w);
      this.tipTrail.push({ x: r.tip.x, y: r.tip.y, t: this.clock });
      await this.wait(8);
    }
    const mouth = this.dangle.hero ?? r.tip;
    this.swing = null;
    this.dangle.hero = null;
    this.sparkle(mouth.x, mouth.y, 5);
    sfx.pop();
    // (the rod springs back and the hero settles, as after a cast)
    whip.once('complete', () => {
      r.bend = 0.35;
      this.tweens.add({ targets: r, bend: 0, duration: 900, ease: 'Elastic.easeOut' });
      this.tweens.add({ targets: this, heroLean: 0, duration: 600, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: this, arm: -0.85, duration: 600, ease: 'Sine.easeInOut' });
    });
    // ── 3. through the air: out over the side, turning over; a big one goes less far and turns slower ──
    const p = { x: fish.x, y: fish.y, vx: 640 / Math.pow(m, 0.35), vy: -560 / Math.pow(m, 0.3) };
    const spin = 7 / m;
    let rot = fish.rotation;
    let tS = this.clock;
    this.camK = 4.5;
    const G = 1250;
    while (!(p.y >= WATER + 6 && p.vy > 0)) {
      // (on the scene clock in 60 Hz steps, like the swing: the same flight whatever the frame rate)
      const steps = Phaser.Math.Clamp(Math.round((this.clock - tS) / 16.7), 0, 8);
      tS += steps * 16.7;
      for (let i = 0; i < steps; i++) {
        p.vy += G / 60;
        p.x += p.vx / 60;
        p.y += p.vy / 60;
        rot += spin / 60;
      }
      fish.setPosition(p.x, p.y).setRotation(rot);
      fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.clock / (40 + 25 * m)) % 3]);
      if (Math.random() < 0.15) {
        const d = this.add.image(p.x, p.y, 'fl-drop').setScale(0.4).setDepth(8.5);
        this.tweens.add({ targets: d, y: d.y + 90, alpha: 0, duration: 450, ease: 'Quad.easeIn', onComplete: () => d.destroy() });
      }
      // (the camera goes with it, the boat still in shot behind)
      this.cam = { x: (heroX + 2 * p.x) / 3, y: Math.min(WATER - 70, p.y + 30), zoom: Math.max(0.72, 1.15 * fitZ + 0.1) };
      await this.wait(16);
    }
    // ── 4. splash! (as big as the fish) ──
    sfx.splash();
    this.splash(p.x, WATER, Math.round(9 + 8 * m), 0.65 + 0.35 * m);
    if (m > 1.6) {
      // (the Fat Fish: a belly flop you can feel)
      sfx.thud();
      this.cameras.main.shake(260, 0.005);
      this.time.delayedCall(160, () => this.ripple(p.x, WATER, 1.6 * m));
    }
    fish.setDepth(5.55);
    // under it goes, turning to swim away from the boat
    const under = { x: p.x, y: p.y, r: rot };
    const rTo = Math.round(rot / (Math.PI * 2)) * Math.PI * 2;
    await this.tw({
      targets: under,
      x: p.x + 90 / Math.sqrt(m),
      y: WATER + 60 + dd,
      r: rTo,
      duration: 480,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        fish.setPosition(under.x, under.y).setRotation(under.r).setAlpha(Math.max(0.85, fish.alpha - 0.01));
        fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.clock / 90) % 3]);
      },
    });
    this.camK = 3;
    fish.setFlipX(false).setRotation(0);
    this.bubbles(fish.x, fish.y, Math.round(4 + 2 * m));
    // ── 5. off it swims, faster and faster — then a happy leap, and away ──
    const sp = 300 / Math.pow(m, 0.3);
    const swimZ = Math.max(0.72, 1.2 * fitZ + 0.1);
    let x = fish.x;
    t0 = this.clock;
    let last = this.clock;
    while (this.clock - t0 < 420) {
      const dt = (this.clock - last) / 1000;
      last = this.clock;
      x += sp * dt * (0.5 + (this.clock - t0) / 840);
      fish.setPosition(x, WATER + 60 + dd + Math.sin(this.clock / 120) * 4).setRotation(Math.sin(this.clock / 70) * 0.12);
      fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.clock / 55) % 3]);
      if (Math.random() < 0.2) this.bubbles(fish.x - dims.w * 0.4, fish.y, 1);
      this.cam = { x: x - 140, y: WATER - 60, zoom: swimZ };
      await this.wait(16);
    }
    // the leap: up out of the water and over, nose first (a little one higher, the Fat Fish a heave)
    const lx0 = fish.x;
    const ly0 = fish.y;
    const up = 40 + 60 / m + dd;
    const along = 170 / Math.sqrt(m);
    sfx.splash();
    this.splash(lx0 + along * 0.15, WATER, Math.round(5 + 3 * m), 0.5 + 0.25 * m);
    fish.setDepth(8);
    this.heroPose = 'j0';
    this.tweens.add({ targets: this, heroHop: 16, duration: 200, ease: 'Quad.easeOut', yoyo: true, repeat: 1, repeatDelay: 60 });
    const lp = { t: 0 };
    await this.tw({
      targets: lp,
      t: 1,
      duration: 560 + 120 * m,
      ease: 'Linear',
      onUpdate: () => {
        const t = lp.t;
        fish.setPosition(lx0 + along * t, ly0 - Math.sin(t * Math.PI) * (up + (ly0 - WATER)));
        fish.setRotation(-(0.9 - t * 1.8) * 0.75);
        fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(t * 10) % 3]);
        if (t > 0.45 && t < 0.5 && Math.random() < 0.5) this.sparkle(fish.x, fish.y - dims.h * 0.3, 2);
        this.cam = { x: fish.x - 140, y: Math.min(WATER - 60, fish.y + 50), zoom: swimZ };
      },
    });
    sfx.splash();
    this.splash(fish.x, WATER, Math.round(6 + 4 * m), 0.5 + 0.3 * m);
    fish.setDepth(5.55).setRotation(0);
    this.heroPose = null;
    // (and away, fading into the deep)
    t0 = this.clock;
    last = this.clock;
    x = fish.x;
    while (this.clock - t0 < 520) {
      const dt = (this.clock - last) / 1000;
      last = this.clock;
      const u = (this.clock - t0) / 520;
      x += sp * 1.4 * dt;
      fish.setPosition(x, WATER + 60 + dd + u * 50).setAlpha(0.85 * (1 - u));
      this.cam = { x: x - 160, y: WATER - 60, zoom: swimZ };
      fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.clock / 50) % 3]);
      await this.wait(16);
    }
    fish.destroy();
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
    // (King Bob on the line, Boss 6: his own looks, see kingFrame)
    if (fish !== this.kingSpr) fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.clock / 80) % 3]);
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
    const got = Math.random() < this.R.kingCatch;
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
          .setScale((c.k / fishRes(c)) * 0.7)
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
      const b = this.onBoat(BOAT.king - 98, BOAT.kingFeet - 26);
      const f0 = { x: fish.x, y: fish.y };
      const o = { t: 0 };
      this.cam = { x: (b.x + f0.x) / 2, y: WATER - 140 - this.lift, zoom: 1.05 };
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
    this.kingShot = true;
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

  // ───────────────────────────────────────────── Boss 6: the rematch ──

  /** Run `fn(u)` every frame for `ms` (u: 0 … 1 through it), on the scene clock. */
  private async during(ms: number, fn: (u: number) => void) {
    const t0 = this.clock;
    while (this.clock - t0 < ms) {
      fn(Math.min(1, (this.clock - t0) / ms));
      await this.wait(16);
    }
  }

  /** The hero says something (a bubble up by their head). */
  private heroSays(text: string, ms: number) {
    const h = HERO_K * CHAR_H * characterById(this.fd.charId).scale;
    return this.say(text, { x: this.hero.x + 16, y: this.hero.y - h + 4 }, ms);
  }

  /** Water thrown up out of King Bob's bowl at its rim: n drops flying up (to about `up` px) and out, falling back past it. */
  private bowlSlosh(rim: { x: number; y: number }, n: number, up: number) {
    for (let i = 0; i < n; i++) {
      const d = this.add.image(rim.x + (Math.random() - 0.5) * 70, rim.y + 4, 'fl-drop').setScale(0.8 + Math.random() * 1.0).setDepth(8.7);
      const vx = (Math.random() - 0.5) * 320;
      const vy = -(up * (0.6 + Math.random() * 0.6));
      const dur = 700 + Math.random() * 300;
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
  }

  /**
   * Boss 6's intro. On the dock in the storm, on the old telly: Chuck Rivers in his rain gear, live in
   * the storm (a crack of lightning; his sou'wester jumps off his head on the third line). Then the
   * swoop out over the swell to the Reel Royal II, settling on King Bob up on the flybridge: a taunt,
   * a splashy flip in his bowl, and fins up.
   */
  private async intro6() {
    stingerTitle(`<div><div class="crown"></div><small>THE WONDERFUL WORLD OF SPORTS</small><strong>KING BOB'S<br>REMATCH</strong><em>LIVE IN THE STORM</em></div>`);
    sfx.drum();
    const tv = this.dom.querySelector<HTMLElement>('.tv-old')!;
    tv.hidden = false;
    tv.classList.remove('off');
    this.cam = { x: HOST_X + 70, y: DOCK_TOP - 100, zoom: 1.75 };
    this.fitCamera(true);
    await this.iwait(1250);
    void stingerReveal();
    await this.iwait(760);
    this.camK = 0.4;
    this.cam = { x: HOST_X + 50, y: DOCK_TOP - 104, zoom: 2.0 };
    // (a crack of lightning before he starts)
    await this.iwait(450);
    if (!this.skipping) this.storm?.flash();
    this.boltAt = this.clock + 6500;
    await this.iwait(650);
    const name = characterById(this.fd.charId).name;
    await this.hostSays("Folks, it's raining cats and dogfish out here!", 3200);
    this.hostPoint = true;
    await this.hostSays(`But nothing stops the REMATCH! King Bob versus ${name}!`, 3500);
    this.hostPoint = false;
    // (so excited his hat jumps clean off his head)
    this.hostShock = true;
    if (!this.skipping) sfx.pop();
    await this.hostSays("And this time... it's for ALL of Puff Ball Planet!", 3500);
    await this.iwait(250);
    this.hostShock = false;
    // ── off over the water to the boat, settling on King Bob up on the flybridge ──
    tv.classList.add('off');
    this.time.delayedCall(700, () => (tv.hidden = true));
    const from = { ...this.cam };
    const kb = this.bowlAt(0, 0);
    const to = { x: kb.x + 90, y: kb.y - 68, zoom: 1.2 };
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
    this.camK = 2.5;
    this.kingShot = true;
    await this.iwait(300);
    this.kingLook = 'm';
    await this.kingSays('You were lucky last time!', 2200);
    await this.kingFlip6();
    // (landed facing you, fins up: bring it on)
    this.kingLook = 'f';
    sfx.bloop();
    await this.kingSays('Not AGAIN!', 1800);
    this.kingShot = false;
    this.kingPlain();
    this.camK = 2.2;
    this.shotBoat(1);
    await this.iwait(700);
  }

  /**
   * King Bob's flip, Boss 6's way: a big one up out of his bowl, his water sloshing out after him and
   * his crown wobbling at the top; back in nose first with a SPLOOSH over both sides, and up again
   * with his crown knocked crooked.
   */
  private async kingFlip6() {
    const k = this.kingSpr;
    const rim = this.bowlAt(0, -BOWL.h + 22);
    this.kingFree = true;
    k.setDepth(8.6);
    const x0 = k.x;
    const y0 = k.y;
    sfx.whoosh();
    this.bowlSlosh(rim, 16, 440);
    const o = { t: 0 };
    await this.tw({
      targets: o,
      t: 1,
      duration: 1150,
      ease: 'Linear',
      onUpdate: () => {
        const t = o.t;
        // (up, three-quarters of a turn and a bit over the top, down nose first and on in deep)
        k.setPosition(x0 + Math.sin(t * Math.PI) * 18, y0 - Math.sin(t * Math.PI) * 190 + t * t * t * 26);
        k.setRotation(-Phaser.Math.Easing.Sine.InOut(t) * Math.PI * 1.5);
        // (his crown wobbling, up at the top)
        this.kingLook = t > 0.3 && t < 0.75 && Math.floor(this.clock / 70) % 2 ? 'a' : 'm';
      },
    });
    // SPLOOSH: in nose first, a huge slosh up out of the bowl
    k.setDepth(4.35);
    this.kingLook = 'a';
    this.bowlSlosh(rim, 42, 620);
    sfx.splash();
    const spray = this.add.image(rim.x, rim.y - 10, 'fl-burst').setDepth(8.65).setTint(0xcff4ff).setAlpha(0.85).setScale(0.12);
    this.tweens.add({ targets: spray, scale: 0.75, alpha: 0, duration: 500, ease: 'Quad.easeOut', onComplete: () => spray.destroy() });
    const ring = this.add.image(rim.x, rim.y + 6, 'fl-ripple').setDepth(4.45).setScale(0.6, 0.5).setAlpha(1);
    this.tweens.add({ targets: ring, scaleX: 2.6, scaleY: 1.3, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    // (and he rights himself, crown crooked)
    await this.tw({ targets: k, rotation: -Math.PI * 2, x: x0, y: y0, duration: 420, ease: 'Back.easeOut' });
    k.setRotation(0);
    this.kingFree = false;
    await this.wait(250);
  }

  /** King Bob out of his bowl and over the stern (Boss 5's leap, from higher up), into the sea, and off he swims under the water. */
  private async kingLeap6() {
    const k = this.kingSpr;
    const sx = k.scaleX;
    const sy = k.scaleY;
    this.tweens.add({ targets: k, scaleX: sx * 1.12, scaleY: sy * 0.82, duration: 200, ease: 'Sine.easeOut', yoyo: true, repeat: 1 });
    await this.wait(820);
    this.kingFree = true;
    k.setDepth(8.6).setScale(sx, sy);
    const x0 = k.x;
    const y0 = k.y;
    sfx.whoosh();
    this.bowlSlosh(this.bowlAt(0, -BOWL.h + 22), 12, 300);
    const land = { x: bx(BOAT.transom) + 240, y: WATER + 8 };
    const peak = Math.min(y0, land.y) - 150;
    const o = { t: 0 };
    this.camK = 2.6;
    await this.tw({
      targets: o,
      t: 1,
      duration: 1350,
      ease: 'Linear',
      onUpdate: () => {
        const t = o.t;
        const u = 1 - t;
        const cx = (x0 + land.x) / 2;
        k.setPosition(u * u * x0 + 2 * u * t * cx + t * t * land.x, u * u * y0 + 2 * u * t * peak + t * t * land.y);
        k.setRotation(-0.5 + t * (Math.PI * 2 + 1.4));
        this.cam = { x: k.x + 40, y: Math.min(k.y + 40, WATER - 120), zoom: 1.05 };
      },
    });
    sfx.splash();
    this.splash(land.x, WATER, 20, 1.2);
    k.setDepth(5.5);
    await this.tw({ targets: k, x: land.x + 70, y: WATER + 72, rotation: 0, duration: 420, ease: 'Quad.easeOut' });
    this.bubbles(k.x, k.y, 6);
    this.kingSwim = { v: 250, y: WATER + 72 };
  }

  /**
   * You've won the rematch. YOU WIN, King Bob furious; "Ha! You'll NEVER catch me!" and he's out of his
   * bowl and over the stern (as in Boss 5) — but "Not so fast, King Bob!": the hero casts after him.
   * GOTCHA! Hooked by the lip, he bursts up out of the sea in a huge splash, the rod bent right over,
   * the gold catch burst behind him: "HEY!! Unhand me, I am a KING!" Towed in and hauled up out, he
   * dangles off the rod tip, furious, his crown askew; the storm breaks (the rain stops, the clouds
   * part, a sunbeam), confetti, and the show's lower third: YOU CAUGHT KING BOB! · 212 lb. "Put me
   * DOWN! This is MOST un-royal!" Plopped back in his bowl, he sulks: "Best of three?" Then the results.
   */
  private async youWin6() {
    const score = `${this.total('hero')} – ${this.total('king')}`;
    const r = this.rod.hero;
    const L = this.lures.hero;
    const k = this.kingSpr;
    // (no more lightning: nothing to white out the catch)
    this.boltAt = Infinity;
    // ── 1. YOU WIN! The hero hops for joy; King Bob's cross ──
    this.tweens.killTweensOf(this);
    this.heroLean = 0;
    this.arm = -0.85;
    this.heroPose = 'j0';
    this.kingLook = 'm';
    this.camK = 2.4;
    const kb = this.bowlAt(0, 0);
    // (the camera keeps King Bob out from under the scoreboard)
    this.noClear = false;
    this.lineShot = false;
    this.cam = { x: (this.hero.x + kb.x) / 2 + 20, y: (this.hero.y + kb.y) / 2 - 110, zoom: 1.35 };
    await this.wait(400);
    this.tweens.add({ targets: this, heroHop: 26, duration: 230, ease: 'Quad.easeOut', yoyo: true, repeat: 3, repeatDelay: 120 });
    sfx.cheer();
    await this.callout(`YOU WIN!<small>${score}</small>`, 'good big', 2400);
    this.heroPose = null;

    // ── 2. "Ha! You'll NEVER catch me!" and over the stern he goes ──
    this.noClear = false;
    this.kingShot = true;
    this.camK = 2.2;
    this.cam = { x: kb.x + 150, y: kb.y - 120, zoom: 1.3 };
    await this.wait(1000);
    sfx.laugh();
    await this.kingSays("Ha! You'll NEVER catch me!", 2200);
    this.kingShot = false;
    this.noClear = true;
    await this.kingLeap6();

    // ── 3. "Not so fast, King Bob!" — the hero casts after him ──
    this.camK = 2.4;
    this.cam = { x: this.hero.x + 130, y: this.hero.y - 120, zoom: 1.4 };
    this.arm = -0.85;
    this.hangLure('hero');
    await this.wait(450);
    await this.heroSays('Not so fast, King Bob!', 1500);
    await this.heroCast(HERO_CAST);
    // (he swims straight into it)
    this.kingSwim = null;
    const back = k.x > L.x - 46;
    k.setFlipX(back);
    const d = Math.abs(L.x - 46 - k.x);
    await this.tw({ targets: k, x: L.x + (back ? 46 : -46), y: WATER + 46, duration: Phaser.Math.Clamp(d * 1.2, 300, 1000), ease: 'Sine.easeIn', onUpdate: () => (this.cam = this.frameOut(bx(BOAT.hero) - 160, L.x, 0.62, 1.05, WATER - 60)) });

    // ── 4. GOTCHA! ──
    L.mode = 'gone';
    L.img.setVisible(false);
    k.setFlipX(false).setDepth(8.4);
    this.kingLook = 'a';
    const hook = this.add.image(0, 0, 'f6-hook').setOrigin(0.6, 0.95).setScale(1 / 3).setDepth(8.45);
    const lip = () => {
      const m = this.mouthOf(k);
      this.dangle.hero = m;
      hook.setPosition(m.x + 2, m.y + 8);
      return m;
    };
    sfx.splash();
    sfx.whoosh();
    sfx.thud();
    this.cameras.main.shake(260, 0.006);
    const big = this.add.image(L.x, WATER + 8, 'f6-bigsplash').setOrigin(0.5, 1 - 14 / BIG_SPLASH.h).setScale(0.25 / 1.5).setDepth(8.3);
    this.tweens.add({ targets: big, scale: 1.25 / 1.5, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: big, alpha: 0, delay: 700, duration: 600, onComplete: () => big.destroy() });
    this.splash(L.x, WATER, 26, 1.35);
    const burst = this.add.image(L.x, WATER - 140, 'fl-burst').setDepth(8.2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0.9);
    this.tweens.add({ targets: burst, scale: 1.8, duration: 500, ease: 'Back.easeOut' });
    const spin = this.tweens.add({ targets: burst, angle: 360, duration: 8000, repeat: -1 });
    r.taut = true;
    r.bend = 0.95;
    this.heroPose = null;
    this.arm = -1.55;
    this.heroLean = -0.2;
    r.reelRate = -4;
    this.callout('GOTCHA!', 'gotcha', 1700);
    const gx = L.x;
    // (in on him: the line runs off to the boat)
    this.camK = 3.5;
    this.cam = { x: gx - 120, y: WATER - 150, zoom: 1.15 };
    // (bursting up out of the sea…)
    await this.during(380, (u) => {
      const e = Phaser.Math.Easing.Quadratic.Out(u);
      k.setPosition(gx + 10 * e, WATER + 46 - e * 196).setRotation(-0.45 * e);
      lip();
    });
    // (…and hanging there, outraged, wriggling)
    sfx.roar();
    void this.say('HEY!! Unhand me, I am a KING!', { x: k.x + 34, y: k.y - 36 }, 2300);
    await this.during(2500, () => {
      k.setPosition(gx + 10 + Math.sin(this.clock / 60) * 3, WATER - 150 + Math.sin(this.clock / 140) * 4).setRotation(-0.45 + Math.sin(this.clock / 50) * 0.12);
      r.bend = 0.92 + Math.sin(this.clock / 50) * 0.05;
      lip();
      if (Math.random() < 0.2) {
        const dr = this.add.image(k.x + (Math.random() - 0.5) * 50, k.y + 30, 'fl-drop').setScale(0.5).setDepth(8.5);
        this.tweens.add({ targets: dr, y: dr.y + 130, alpha: 0, duration: 500, ease: 'Quad.easeIn', onComplete: () => dr.destroy() });
      }
    });
    this.tweens.add({ targets: burst, alpha: 0, scale: 0.4, duration: 300, onComplete: () => (spin.remove(), burst.destroy()) });

    // ── 5. reeled in: back down into the sea, towed in, then hauled up out on the line ──
    await this.during(260, (u) => {
      k.setPosition(gx + 10, WATER - 150 + u * u * 186).setRotation(-0.45 + u * 0.45);
      lip();
    });
    sfx.splash();
    this.splash(k.x, WATER, 14, 1);
    const xEnd = bx(BOAT.motor) + 60;
    r.reelRate = 4.5;
    this.heroLean = -0.08;
    await this.during(1500, (u) => {
      const x = gx + (xEnd - gx) * Phaser.Math.Easing.Sine.InOut(u);
      k.setFlipX(true).setPosition(x + Math.sin(this.clock / 70) * 10, WATER + 22 + Math.sin(this.clock / 110) * 6).setRotation(Math.sin(this.clock / 55) * 0.35);
      const pump = Math.sin(u * Math.PI * 4);
      r.bend = 0.6 + Math.max(0, pump) * 0.25;
      this.arm = -0.95 - Math.max(0, pump) * 0.5;
      lip();
      if (Math.random() < 0.3) this.ripple(k.x, WATER, 0.8);
      if (Math.random() < 0.08) this.splash(k.x, WATER, 3, 0.5);
      this.cam = this.frameOut(bx(BOAT.hero) - 160, k.x, 0.62, 1.12, WATER - 70);
    });
    // the heave: up out of the water, swinging on the line
    sfx.whoosh();
    sfx.splash();
    this.splash(k.x, WATER, 18, 1.15);
    r.reelRate = 2;
    k.setFlipX(false);
    this.tweens.killTweensOf(this);
    this.tweens.add({ targets: this, arm: -1.15, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this, heroLean: -0.12, duration: 300, ease: 'Quad.easeOut', yoyo: true, hold: 200 });
    this.tweens.add({ targets: r, bend: 0.4, duration: 500, ease: 'Sine.easeOut' });
    const m0 = this.mouthOf(k);
    this.swing = { x: m0.x, y: m0.y, px: m0.x + 9, py: m0.y + 16, len: Math.hypot(m0.x - r.tip.x, m0.y - r.tip.y), target: 34, t: this.clock };
    this.kingHooked = true;
    const follow = () => {
      hook.setPosition((this.dangle.hero?.x ?? k.x) + 2, (this.dangle.hero?.y ?? k.y) + 8);
      this.cam = { x: (this.hero.x + k.x) / 2 + 30, y: Math.min(this.hero.y - 110, k.y + 50), zoom: 1.45 };
    };
    await this.during(900, follow);
    r.reelRate = 0;

    // ── the storm breaks: the sunbeam, the confetti, the lower third ──
    this.heroPose = 'j0';
    const v = this.cameras.main.worldView;
    void this.storm?.breakUp(2600, { x: this.hero.x + 60, y: v.y - 120 });
    sfx.cheer();
    sfx.kaching();
    this.sparkle(k.x, k.y, 14);
    for (let i = 0; i < 6; i++)
      this.time.delayedCall(i * 430, () => {
        const w = this.cameras.main.worldView;
        this.confettiFx.cannon(w.x + 10, w.bottom - 10, -1.05 + Math.random() * 0.2, 40, { power: 1100 + Math.random() * 300 });
        this.confettiFx.cannon(w.right - 10, w.bottom - 10, -Math.PI + 1.05 - Math.random() * 0.2, 40, { power: 1100 + Math.random() * 300 });
        sfx.pop();
      });
    const card = this.dom.querySelector<HTMLElement>('.fsh-catch')!;
    card.querySelector('em')!.textContent = 'ROYAL CATCH!';
    card.querySelector('small')!.textContent = 'You caught';
    card.querySelector('b')!.textContent = 'KING BOB!';
    card.querySelector('span')!.textContent = '212 lb';
    card.classList.add('royal');
    card.hidden = false;
    card.classList.remove('show');
    void card.offsetWidth;
    card.classList.add('show');
    await this.during(900, (u) => {
      follow();
      this.shadeBoat();
      if (u > 0.5 && Math.random() < 0.02 && this.swing) this.swing.px -= (Math.random() - 0.5) * 10;
    });
    void this.say('Put me DOWN! This is MOST un-royal!', { x: k.x + 30, y: k.y - 46 }, 2700);
    await this.during(3000, () => {
      follow();
      this.shadeBoat();
      if (Math.random() < 0.03 && this.swing) this.swing.px -= (Math.random() - 0.5) * 12;
    });
    card.classList.remove('show');

    // ── 6. plopped back in his bowl: "Best of three?" ──
    this.heroPose = null;
    this.tweens.add({ targets: this, arm: -1.9, duration: 520, ease: 'Sine.easeInOut' });
    await this.during(540, follow);
    this.kingHooked = false;
    this.swing = null;
    this.dangle.hero = null;
    hook.destroy();
    r.taut = false;
    sfx.whoosh();
    const home = this.kingHome();
    const p0 = { x: k.x, y: k.y };
    const r0 = k.rotation;
    const peak = Math.min(p0.y, home.y) - 110;
    this.tweens.add({ targets: r, bend: 0, duration: 700, ease: 'Elastic.easeOut' });
    this.tweens.add({ targets: this, arm: -0.85, duration: 600, ease: 'Sine.easeInOut' });
    await this.during(700, (t) => {
      const u = 1 - t;
      const to = this.kingHome();
      const cx = (p0.x + to.x) / 2;
      k.setPosition(u * u * p0.x + 2 * u * t * cx + t * t * to.x, u * u * p0.y + 2 * u * t * peak + t * t * to.y).setRotation(r0 + (Math.PI * 2 - r0) * t);
      this.cam = { x: (this.hero.x + to.x) / 2, y: to.y - 40, zoom: 1.35 };
    });
    k.setRotation(0).setDepth(4.35);
    this.kingFree = false;
    sfx.splash();
    this.bowlSlosh(this.bowlAt(0, -BOWL.h + 22), 22, 380);
    this.kingLook = 'a';
    this.noClear = false;
    this.lineShot = false;
    this.kingShot = true;
    this.camK = 2.2;
    this.cam = { x: home.x + 60, y: home.y - 90, zoom: 1.35 };
    await this.wait(700);
    sfx.groan();
    await this.kingSays('Best of three?', 2300);
    await this.wait(500);
    card.hidden = true;
    fadeOutMusic(500);
    const result: ResultState = { ...this.fd.result, hoops: score, level: this.fd.level ?? 6 };
    this.game.events.emit('level-complete', result);
  }

  /** Where King Bob sits in his water (world), as placeBoat puts him (without his sway). */
  private kingHome() {
    return this.bowlAt(2, -(BOWL.h - BOWL.cy) + 10);
  }
}
