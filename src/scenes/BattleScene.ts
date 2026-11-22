import Phaser from 'phaser';
import { LIGHT } from '../core/light';
import { DEPTH, VIEW_H } from '../config';
import { sfx } from '../core/sfx';
import { characterById } from '../data/characters';
import { ART_RES, CARRY_SWING, CHAR_H, CHAR_W, WALK_FRAMES, bodyLift, carryHand, gearUp } from '../gfx/draw';
import { recolorForSlot, slotRecolors } from '../gfx/recolor';
import { HERO_SHEET_M, addCanvas, ensureLook, frameGrid, hires, makeCarrySheet, makeHeroSheet } from '../gfx/textures';
import { wardrobe } from '../core/wardrobe';
import { PRIZE_COLOR, drawBombBall, drawChute, drawFireball, drawPrize } from '../gfx/prizes';
import { PLOP_FRAMES, PLOP_H, PLOP_W, drawPlop } from '../gfx/plops';
import { canvas } from '../gfx/draw';
import { STYLES } from '../gfx/handdrawn';
import { BLASTER, SAW } from '../gfx/weapons';
import { drawAnvil, drawIceBlock, drawPellet, drawPoo, drawRamp, drawRock } from '../gfx/hazards';
import { CHAIR_H, CHAIR_W, drawFoldingChair } from '../gfx/wrestle';
import { W_RES } from '../gfx/weapons';
import { soloSource } from '../input/devices';
import type { BattleNet, Snapshot } from '../net/battleNet';
import { ARENA_RAMPS, ARENA_VIEW, buildArena } from '../shared/battle/arena';
import { SLOT_COLORS, type SnapChair, type SnapEnemy, type SnapHazard, type SnapPlayer } from '../shared/battle/protocol';
import { ArenaMap, BTN, CHAIR_LIFE, CHAIR_SWING, DT, TILE_PX, ENEMY_BOX, HEARTS, POWER, PRIZE_LIFE, boxH, boxW, heroShot, landingY, moveShot, sizeOf, stepMove, type BEvent, type BPlayer, type BRocket, type EnemyKind, type PrizeKind, type RocketKind } from '../shared/battle/sim';
import { Background } from '../world/Background';
import { Fx } from '../world/Fx';
import { LevelView } from '../world/LevelView';
import { FaceClock } from '../gfx/face';
import { THEMES, mixTint, themeClock, themeMix } from '../world/theme';
import { softEllipse, softShapes, type SoftShapes } from '../gfx/softShapes';

/**
 * How far behind the server's clock the other players are shown (ticks): a tick (to have the next
 * snapshot to blend towards) plus however late snapshots have been coming lately — about 45 ms on a
 * steady connection, more on a bumpy one (it was always 100 ms or more). INTERP_MAX is the most.
 */
const INTERP_MIN = 1.3;
const INTERP_MAX = 7;
/** When the next snapshot's late, the others carry on (as they were going, by the rules) for up to this many ticks, then wait. */
const EXTRAP_TICKS = 3;
/** (ms per tick) */
const TICK_MS = DT * 1000;
/**
 * Your hero's corrections (the server saw it a little differently): further off than this and it just
 * jumps there (a respawn, a real teleport); up to this it glides there — small ones fade out in a few
 * frames, big ones slide over at no more than FIX_GLIDE px/s, about a sixth of a second for the biggest.
 */
const FIX_JUMP = 160;
const FIX_GLIDE = 1000;
/** The hearts pictures' resolution (they're small, and the camera zooms in). */
const HEART_RES = 3;
/** The off-screen pointer's picture: its box round the badge's centre (world units), and resolution. */
const ARROW_BOX = { x: 15, y: 15, w: 43, h: 30 };
const ARROW_RES = 3;

type PrizeView = {
  img: Phaser.GameObjects.Image;
  chute: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  shadow: SoftShapes;
  landY: number;
  lastY: number;
  /** 1 while it floats down, easing to 0 once it's landed. */
  falling: number;
  /** Counts down after it lands: the little squash and bounce. */
  land: number;
};

/** Room either side of a Plop's frame for its arms. */
const PLOP_PAD = 16;
/** Headroom over the art (the big Plops' swirl tip pokes up past the art's frame). */
const PLOP_TOP = 22;

/** Light mode: the other players' hero sheets' resolution (see sheetRes). */
const OTHER_HERO_RES = 1.5;

/** The battle's background look (just the one). */
const BATTLE_LOOKS = [THEMES[0]] as const;

/** Playing, the camera is this much closer in than the whole-arena view. */
const FOLLOW_ZOOM = 1.2;
/** Prizes and things falling from the sky are drawn this much bigger than their art. */
const PRIZE_SCALE = 1.6;
/** Rocks and anvils: most medium, 1 in 3 big (drawn to match their size in the rules). */
const HAZARD_SCALE = 1.75;
const HAZARD_BIG = 1.55;

/**
 * Grabbing a bonus: a happy hop, like picking a hero on the start screen
 * (crouch, spring up, squashy landing); Scruffy does his backflip at the top.
 * t in seconds since the grab; null once it's over.
 */
function cheerPose(t: number, flip: boolean): { up: number; sx: number; sy: number; spin: number; frame: string } | null {
  const len = flip ? 0.84 : 0.75;
  const u = t / len;
  if (u >= 1) return null;
  // [time, height (0..1), squash x, squash y]
  const keys: [number, number, number, number][] = flip
    ? [[0, 0, 1, 1], [0.13, 0, 1.1, 0.88], [0.42, 1, 0.97, 1.04], [0.68, 0, 1, 1], [0.77, 0, 1.12, 0.87], [0.88, 0, 0.97, 1.03], [1, 0, 1, 1]]
    : [[0, 0, 1, 1], [0.14, 0, 1.08, 0.9], [0.44, 1, 0.95, 1.07], [0.72, 0, 1.02, 0.98], [0.8, 0, 1.1, 0.88], [0.9, 0, 0.97, 1.03], [1, 0, 1, 1]];
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const [t0, h0, x0, y0] = keys[i];
  const [t1, h1, x1, y1] = keys[i + 1];
  let f = (u - t0) / (t1 - t0);
  // springing up eases out, falling back eases in
  f = h1 > h0 ? 1 - (1 - f) * (1 - f) : h1 < h0 ? f * f : f * f * (3 - 2 * f);
  const up = h0 + (h1 - h0) * f;
  const sx = x0 + (x1 - x0) * f;
  const sy = y0 + (y1 - y0) * f;
  // the spin: one whole turn backwards, from just after the crouch to near the top of the hop
  const sp = Math.max(0, Math.min(1, (u - 0.17) / (0.58 - 0.17)));
  const spin = flip ? sp * sp * (3 - 2 * sp) : 0;
  const peak = flip ? 0.42 : 0.44;
  const frame = u < (flip ? 0.13 : 0.14) ? 'idle0' : u < peak ? 'jump' : up > 0.02 ? 'fall' : 'idle0';
  return { up, sx, sy, spin, frame };
}

interface HeroView {
  /** What they're drawn wearing (Shop ids, '' nothing). */
  wear: string;
  /** Seconds since this hero grabbed a bonus (the celebration hop), or -1. */
  cheer: number;
  sprite: Phaser.GameObjects.Sprite;
  tag: Phaser.GameObjects.Text;
  hearts: Phaser.GameObjects.Image;
  anim: number;
  tilt: number;
  slot: number;
  hero: string;
  /** Drawn size (eases to big when they grow). */
  size: number;
  sparkT: number;
  /** Blinks, glances and breathing, like in the levels (just for looks: not sent over the net). */
  face: FaceClock;
  /** A soft glow around your own hero, so you can find yourself in the scrum. */
  halo?: Phaser.GameObjects.Image;
  /** Holding a chair: the arms' angle (over the head, or mid-swing); null otherwise. */
  chairA: number | null;
  /** The block of ice they're stuck in (someone grabbed the ice). */
  ice: Phaser.GameObjects.Image;
  /** Off screen: an arrow at the edge pointing to them, with their name (not for you). */
  arrow?: Phaser.GameObjects.Container;
  /** Their pictures' keys (textureFor: worked out once, not twice a frame — it reads what you've got on from storage). */
  bodyKey: string;
  faceKey: string;
}

const PRIZE_TEXT: Record<PrizeKind, [string, string]> = {
  bomb: ['BOMBS!', '#ff8a3d'],
  star: ['INVINCIBLE!', '#ffd23f'],
  grow: ['GROW!', '#c39bff'],
  rapid: ['RAPID FIRE!', '#ff6b6b'],
  heart: ['+1 HEART', '#ff7eb6'],
  ice: ['FREEZE!', '#7fdcff'],
  fire: ['FIREBALLS!', '#ffb03a'],
};
const PRIZE_KINDS: PrizeKind[] = ['bomb', 'star', 'grow', 'rapid', 'heart', 'ice', 'fire'];

/** Plops drawn for each size of bad guy: which Plop, and how big. */
const PLOP_ART: Record<EnemyKind, { kind: 'small' | 'medium' | 'large'; scale: number }> = {
  small: { kind: 'small', scale: 0.4 },
  medium: { kind: 'medium', scale: 0.72 },
  big: { kind: 'large', scale: 1.6 },
};
/**
 * The battle Plops' pictures' resolution, by size: each about what the camera shows of it (the small
 * ones are drawn at 0.4 of their art's size, the big ones at 1.6), so the small and middle ones' sheets
 * aren't several times sharper than the screen. (Light mode, drawn at 1x: 1.25, the small ones 1.)
 */
const PLOP_RES: Record<'small' | 'medium' | 'large', number> = LIGHT ? { small: 1, medium: 1.25, large: 1.25 } : { small: 1, medium: 1.5, large: 2 };

/** How each kind of bad guy is drawn: texture, scale, feet origin, gun size. */
const ENEMY_ART: Record<EnemyKind, { tex: string; scale: number; ox: number; oy: number; gun: number }> = {
  small: { tex: 'puffball', scale: 1 / ART_RES, ox: 0.5, oy: 46 / 48, gun: 0.55 },
  medium: { tex: 'bigpuff', scale: 1 / ART_RES, ox: 0.5, oy: 86 / 88, gun: 0.8 },
  big: { tex: 'giant', scale: 1 / 2.5, ox: 88 / 172, oy: 200 / 204, gun: 1 },
};

interface EnemyView {
  spr: Phaser.GameObjects.Sprite;
  plop: boolean;
  /** What it's carrying (0 none, 1 blaster, 2 chainsaw, 3 ball and chain) and its pictures. */
  weapon: number;
  gun: Phaser.GameObjects.Image | null;
  saw: Phaser.GameObjects.Sprite | null;
  ball: Phaser.GameObjects.Image | null;
  chain: SoftShapes | null;
  chute: Phaser.GameObjects.Image;
  anim: number;
  lastX: number;
  /** Was in the air last frame; and the squash after landing (counts down). */
  air: boolean;
  land: number;
}

/** Plop walk speed, in steps of the four-step walk per second: the small ones scurry, the big ones plod. */
const PLOP_STEP_FPS: Record<EnemyKind, number> = { small: 11, medium: 8.5, big: 6.5 };

/**
 * The pictures only a battle shows: each player's hero in their colour (and its chair-carrying frames),
 * the Plops, the bonuses and their parachutes, the rocks, anvils, bombs and the rest, the hearts and
 * pointers, and the arena's own ground, clouds, trees and ramp.
 */
const BATTLE_ONLY = /^(bchar-|bplop-|prize-|bramp-|barrow-|bhearts|cloud-arena-|tree-arena-|terrain-arena-)|^(bbomb|brock|banvil|bhalo|bfire|bpoo|bice|bpellet)$|^char-[a-z]+-carry$/;

/**
 * Leaving the battles (back to the start screen): free the battle's own pictures, so they don't stay
 * in memory through the start screen and the levels. Anything a running scene still shows is kept.
 */
export function freeBattleArt(game: Phaser.Game) {
  const shown = new Set<string>();
  const look = (list: Phaser.GameObjects.GameObject[]) => {
    for (const o of list) {
      const t = (o as { texture?: Phaser.Textures.Texture }).texture;
      if (t) shown.add(t.key);
      const kids = (o as { list?: Phaser.GameObjects.GameObject[] }).list;
      if (kids) look(kids);
    }
  };
  for (const sc of game.scene.getScenes(true)) look(sc.children.list);
  for (const k of game.textures.getTextureKeys()) if (BATTLE_ONLY.test(k) && !shown.has(k)) game.textures.remove(k);
}

export interface BattleHud {
  timeLeft: number;
  players: { id: string; kos: number; hp: number; slot: number; down: boolean }[];
  /** Bombs you're carrying (they go on their own button). */
  bombs: number;
}

/**
 * The online battle: an arena where up to 4 heroes blast each other. The
 * server runs the real match; this scene moves your own hero straight away
 * with the same rules (then quietly corrects to what the server says), shows
 * everyone else smoothly a moment behind, and plays all the effects.
 */
/** A battle Plop's little moments while it stands about (as in Plop Invasion), and when it was last hit. */
interface PlopMood {
  moodNext?: number;
  moodUntil?: number;
  moodFace?: string;
  hurtAt?: number;
}

export class BattleScene extends Phaser.Scene {
  /** A standing Plop's face: breathing, and every few seconds a blink, a glance, a sly grin or a yell. */
  private plopStanding(m: PlopMood, anim: number): string {
    const t = this.time.now / 1000;
    if (m.moodNext === undefined) m.moodNext = t + 0.5 + Math.random() * 2.5;
    if (t >= (m.moodUntil ?? 0) && t >= m.moodNext) {
      const r = Math.random();
      m.moodFace = r < 0.4 ? 'blink' : r < 0.6 ? 'look' : r < 0.75 ? 'grin' : 'yell';
      m.moodUntil = t + (m.moodFace === 'blink' ? 0.13 : m.moodFace === 'yell' ? 1.1 : 0.8 + Math.random() * 0.5);
      m.moodNext = m.moodUntil + 1.2 + Math.random() * 2.5;
    }
    if (t < (m.moodUntil ?? 0)) return m.moodFace === 'yell' ? (Math.floor(anim * 2) % 2 ? 'yell0' : 'yell1') : m.moodFace!;
    return Math.floor(t * 1.5) % 2 ? 'idle1' : 'idle';
  }

  private net!: BattleNet;
  private map!: ArenaMap;
  private level!: LevelView;
  private bg!: Background;
  fx!: Fx;
  private views = new Map<string, HeroView>();
  private rocketViews = new Map<number, Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>();
  /**
   * Your own shots, flying on your phone from the moment you press — the server's copies only come
   * back a moment later (and were drawn a little further behind still, like everyone else's). Each
   * is tied to its server twin (`sid`) when that turns up, and goes when the twin does (the blast
   * comes with that). `hit`: when it stopped (a wall, someone) — it waits there for the server.
   */
  private shots: {
    n: number;
    r: Omit<BRocket, 'id'>;
    sid: number | null;
    born: number;
    hit: number | null;
    /** (the tick it stopped on someone, here) */
    hitSeq: number;
    /** Blew up here (a wall, its fuse): its blast's been shown. */
    boomed: boolean;
    /** Stopped on someone here, waiting for the server to say. */
    onHero: boolean;
    /** It flew on past someone at the server: now it only stops for walls. */
    passed: boolean;
  }[] = [];
  private shotN = 0;
  /** My shots the server had in the last snapshot (a new one there is the twin of my oldest untied shot). */
  private mineSeen = new Set<number>();
  /** Everyone and every bad guy as last drawn (what your shots hit, on your screen). */
  private lastSeen: { players: Map<string, SnapPlayer>; enemies: SnapEnemy[] } | null = null;
  private prizeViews = new Map<number, PrizeView>();
  /** Prizes someone just grabbed (they fly into the grabber; the snapshot may still show them a moment). */
  private grabbed = new Set<number>();
  /** The folding chairs' pictures, by id. */
  private chairViews = new Map<number, Phaser.GameObjects.Image>();
  /** Am I holding a chair (FIRE swings it: the button says so)? */
  private holdingChair = false;
  private snaps: Snapshot[] = [];
  /**
   * The others' clock (in ticks, `interp` behind the server's): it runs with real time and eases
   * toward where it should be, never backwards. (Set from each snapshot as it came in, it jumped
   * back and forth with every one that came a little early or late on a phone network: the others
   * jittered.) When it's further off than that, it just jumps.
   */
  private otherClock: { tick: number; at: number } | null = null;
  /**
   * How far behind the server the others are drawn (ticks, INTERP_MIN to INTERP_MAX): enough that the
   * next snapshot is nearly always in by the time it's needed — a tick plus how late they've been
   * coming (all but the latest few in the last 3 seconds). Up quickly on a bumpier connection, back
   * down slowly. (A rare later one: the others carry on by the rules for a moment — EXTRAP_TICKS.)
   */
  private interp = 3;
  /** When recent snapshots came, less their tick's time (ms; the earliest of them: `lateBase`). */
  private lateness: number[] = [];
  /** (`lateness`, smallest first) */
  private lateSorted: number[] = [];
  private lateBase: number | null = null;
  /** The others carried on past the newest snapshot (by the rules, with their last buttons): a few ticks of it, worked out once per snapshot. */
  private ahead: { tick: number; players: Map<string, BPlayer[]> } | null = null;
  /** …and the last lot, so that coming back from carrying on (the snapshot's in) can be smoothed over. */
  private aheadPrev: { tick: number; players: Map<string, BPlayer[]> } | null = null;
  /** Each other player's drawing's leftover offset after carrying on guessed a little wrong (px; fades out). */
  private otherFix = new Map<string, { x: number; y: number }>();
  /** Each other player carried on last frame: from which snapshot (its tick). */
  private carriedFrom = new Map<string, { tick: number }>();
  /** Each other player's clock of buttons against the server's ticks (ack − tick, eased); and when it was last eased. */
  private ackOff = new Map<string, number>();
  private ackAt = 0;
  private me: BPlayer | null = null;
  /**
   * Your hero one tick on from `me` (the same rules, the buttons held right now): drawn part way
   * there, as far as the time since the last tick — so it moves smoothly on any screen (not in 30
   * steps a second), and what you press shows the very next frame.
   */
  private meNext: BPlayer | null = null;
  /** Your buttons not yet sent, per tick: [seq, buttons, whether a shot was allowed (null: not asked)]. */
  private pending: [number, number, boolean | null][] = [];
  private seq = 0;
  private acc = 0;
  /** Jump, fire and bomb pressed since the last tick (a tap quicker than a tick still counts). */
  private latched = 0;
  /** Blasts of your own shots shown already, on your screen (the server's own for the same shot isn't shown twice). */
  private myBooms: { x: number; y: number; at: number }[] = [];
  /** Prizes you've just touched on your screen: picked up already (the server's word comes a moment later). */
  private myGrabs = new Map<number, { at: number; kind: PrizeKind; x: number; y: number }>();
  /** Visual-only correction for your hero, faded out over a few frames. */
  private fix = { x: 0, y: 0 };
  private names = new Map<string, string>();
  /** What each player's got on (from the room: '' nothing). */
  private wears = new Map<string, string>();
  private hudT = 0;
  private enemyViews = new Map<number, EnemyView>();
  private hazardViews = new Map<number, { img: Phaser.GameObjects.Image; shadow: SoftShapes; landY: number }>();
  /** Just watching (joined mid-battle): no hero of your own, shown in a little window. */
  private spectate = false;
  private preview: { x: number; y: number; w: number; h: number } | null = null;
  /** The zoom that fits the whole arena; playing, the camera is a little closer and follows you. */
  private fitZoom = 1;
  private camC: { x: number; y: number } | null = null;
  /** The players' pictures still to make ahead (see create). */
  private prep: (() => void)[] = [];

  constructor() {
    super('Battle');
  }

  create(data: { net: BattleNet; spectate?: boolean; warm?: boolean }) {
    this.net = data.net;
    this.spectate = !!data.spectate;
    // warm: built ahead of time during the countdown, not shown (so the start is instant)
    this.sys.setVisible(!data.warm);
    this.preview = null;
    this.camC = null;
    this.enemyViews.clear();
    this.hazardViews.clear();
    const arena = buildArena();
    this.map = new ArenaMap(arena);
    // (keep the start screen's terrain while it's still on screen: the curtain slides it away)
    this.level = new LevelView(this, arena, { keep: this.spectate || this.scene.isActive('Menu'), cull: true });
    this.drawRamps();
    // (battles use Part 1's first look — one look, as light mode always had: the others were ~11 MB more in
    // full mode, drawn during the countdown, for the sky slowly drifting through them)
    ensureLook(this, BATTLE_LOOKS[0]);
    // (still clouds: they drift and bob but keep their shape — no new cloud pictures to send to the
    // graphics chip ~20 times a second, which a battle's phones can do without)
    this.bg = new Background(this, this.level.heightPx - VIEW_H, true);
    this.fx = new Fx(this, LIGHT);
    this.views.clear();
    this.rocketViews.clear();
    this.prizeViews.clear();
    // (the last battle's chairs: their pictures went with it — kept here, a chair numbered the same in
    // this battle would have been one of those, gone)
    this.chairViews.clear();
    this.makePrizeTextures();
    this.snaps = [];
    this.otherClock = null;
    this.interp = 3;
    this.lateness = [];
    this.lateSorted = [];
    this.lateBase = null;
    this.ahead = this.aheadPrev = null;
    this.otherFix.clear();
    this.carriedFrom.clear();
    this.ackOff.clear();
    this.me = null;
    this.meNext = null;
    this.pending = [];
    this.seq = 0;
    this.acc = 0;
    this.latched = 0;
    this.myBooms = [];
    this.myGrabs.clear();
    // (the scene's used again for the next battle, where the prizes and shots are numbered from 1
    // again: one grabbed last time mustn't stay hidden)
    this.grabbed.clear();
    this.shots = [];
    this.mineSeen.clear();
    this.lastSeen = null;
    this.net.inbox = [];
    const m = themeMix(themeClock.t, BATTLE_LOOKS);
    this.bg.setTheme(m);
    this.level.setTint(mixTint(m));
    this.fitCamera();
    // each player's pictures — their hero in their colour, and its faces — made ahead, one a frame, while
    // the arena's built during the countdown (they were all made at once on the battle's first frame, under
    // the curtain: a stutter as it went up)
    this.prep = [];
    for (const rp of this.net.room?.players ?? [])
      if (rp.slot >= 0 && rp.connected) {
        const wear = rp.wear ?? '';
        this.prep.push(() => this.textureFor(rp.hero, rp.slot, wear), () => this.textureFor(rp.hero, rp.slot, wear, true));
      }
    this.scale.on('resize', this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.fitCamera, this);
      // (the FIRE button back to normal)
      if (this.holdingChair) this.game.events.emit('wrestle-chair', false);
      this.holdingChair = false;
    });
  }

  /**
   * The folding chairs: tumbling down, lying flat on the floor (blinking before they go), or held up
   * over a hero's head — and swung down in front of them, mid-swing.
   */
  private renderChairs(chairs: SnapChair[], dt: number) {
    const S = 0.55 / ART_RES;
    const live = new Set<number>();
    for (const [id, x, y, holder, , , age] of chairs) {
      live.add(id);
      let img = this.chairViews.get(id);
      if (!img) {
        img = this.add.image(x, y, 'wr-chair').setScale(S).setDepth(DEPTH.pickups);
        this.chairViews.set(id, img);
      }
      if (holder) {
        const v = this.views.get(holder);
        if (!v || !v.sprite.visible) {
          img.setVisible(false);
          continue;
        }
        // gripped by its feet in both hands, carried along the arms (up over the head; the swing
        // brings it over the top and down in front) — as in the Poo Palace
        const facing = (v.sprite.flipX ? -1 : 1) as 1 | -1;
        const a = v.chairA ?? -1.75;
        const kx = Math.abs(v.sprite.scaleX) * ART_RES;
        const ky = Math.abs(v.sprite.scaleY) * ART_RES;
        const [hx, hy] = carryHand(v.hero, a);
        const dx = (hx + HERO_SHEET_M - (CHAR_W + HERO_SHEET_M * 2) / 2) * kx;
        const dy = (hy - bodyLift(v.wear) - CHAR_H) * ky;
        const dirA = facing > 0 ? a : Math.PI - a;
        img
          .setVisible(true)
          .setOrigin(0.5, (CHAIR_H - 2) / (CHAIR_H + 4))
          .setScale(kx / ART_RES / characterById(v.hero).scale)
          .setFlipX(facing < 0)
          .setDepth(DEPTH.players - 0.1)
          .setAlpha(1)
          .setPosition(v.sprite.x + facing * dx, v.sprite.y + dy)
          .setRotation(dirA + Math.PI / 2);
        continue;
      }
      img.setVisible(true).setOrigin(0.5, 0.5).setScale(S).setDepth(DEPTH.pickups).setFlipX(false);
      if (age < 0) {
        // tumbling down
        img.setPosition(x, y - (CHAIR_H * 0.55) / 2).setRotation(img.rotation + dt * 7).setAlpha(1);
      } else {
        // lying flat on the floor (blinking for its last 3 s)
        img
          .setPosition(x, y - (CHAIR_W * 0.55) / 2 - 1)
          .setRotation(Math.PI / 2 - 0.04)
          .setAlpha(age > CHAIR_LIFE - 3 && Math.floor(this.time.now / 110) % 2 ? 0.35 : 1);
      }
    }
    for (const [id, img] of this.chairViews)
      if (!live.has(id)) {
        img.destroy();
        this.chairViews.delete(id);
      }
    // (the FIRE button says CHAIR while you've got one)
    const mine = chairs.some((c) => c[3] === this.net.myId);
    if (mine !== this.holdingChair) {
      this.holdingChair = mine;
      this.game.events.emit('wrestle-chair', mine);
    }
  }

  private makePrizeTextures() {
    const R = ART_RES;
    // (still pictures: their canvas pixels go once they're on the graphics chip, nothing reads them back)
    const REL = { release: true };
    for (const k of PRIZE_KINDS) if (!this.textures.exists(`prize-${k}`)) addCanvas(this, `prize-${k}`, hires(30, 30, R, (ctx) => drawPrize(ctx, k)), undefined, REL);
    if (!this.textures.exists('bbomb')) addCanvas(this, 'bbomb', hires(24, 24, R, (ctx) => drawBombBall(ctx, 11, 13, 7)), undefined, REL);
    if (!this.textures.exists('brock')) addCanvas(this, 'brock', hires(42, 42, R, (ctx) => drawRock(ctx)), undefined, REL);
    if (!this.textures.exists('banvil')) addCanvas(this, 'banvil', hires(42, 40, R, (ctx) => drawAnvil(ctx)), undefined, REL);
    if (!this.textures.exists('wr-chair')) addCanvas(this, 'wr-chair', hires(CHAIR_W + 8, CHAIR_H + 4, R, (ctx) => (ctx.translate(4, 2), drawFoldingChair(ctx))), undefined, REL);
    if (!this.textures.exists('bhalo'))
      addCanvas(this, 'bhalo', hires(96, 96, R, (ctx) => {
        // a soft white-gold glow with a brighter ring at its edge
        const g = ctx.createRadialGradient(48, 48, 10, 48, 48, 47);
        g.addColorStop(0, 'rgba(255,248,210,0)');
        g.addColorStop(0.55, 'rgba(255,240,170,0.18)');
        g.addColorStop(0.8, 'rgba(255,236,150,0.55)');
        g.addColorStop(0.9, 'rgba(255,255,235,0.8)');
        g.addColorStop(1, 'rgba(255,236,150,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(48, 48, 47, 0, Math.PI * 2);
        ctx.fill();
      }), undefined, REL);
    for (const k of PRIZE_KINDS) if (!this.textures.exists(`prize-chute-${k}`)) addCanvas(this, `prize-chute-${k}`, hires(30, 22, R, (ctx) => drawChute(ctx, k)), undefined, REL);
    if (!this.textures.exists('bfire')) addCanvas(this, 'bfire', hires(40, 26, R, (ctx) => drawFireball(ctx, 26, 13, 9, 1)), undefined, REL);
    if (!this.textures.exists('bpoo')) addCanvas(this, 'bpoo', hires(26, 24, R, (ctx) => drawPoo(ctx, 13, 21, 1)), undefined, REL);
    if (!this.textures.exists('bice')) addCanvas(this, 'bice', hires(60, 70, R, (ctx) => drawIceBlock(ctx, 60, 70)), undefined, REL);
    for (const kind of ['small', 'medium', 'large'] as const) {
      const key = `bplop-${kind}`;
      if (this.textures.exists(key)) continue;
      // (a margin each side: the leaf arms reach past the art's own frame)
      const R2 = PLOP_RES[kind];
      const fw = Math.round((PLOP_W + PLOP_PAD * 2) * R2);
      const fh = Math.round((PLOP_H + PLOP_TOP) * R2);
      const g = frameGrid(PLOP_FRAMES.length, fw, fh);
      const { c, ctx } = canvas(g.w, g.h);
      PLOP_FRAMES.forEach((f, i) => {
        ctx.save();
        ctx.translate(g.x(i), g.y(i));
        ctx.scale(R2, R2);
        drawPlop(ctx, PLOP_PAD, PLOP_TOP, f, STYLES.polished, kind);
        ctx.restore();
      });
      addCanvas(this, key, c, (t) => PLOP_FRAMES.forEach((f, i) => t.add(f, 0, g.x(i), g.y(i), fw, fh)), { release: true });
    }
    if (!this.textures.exists('bpellet')) addCanvas(this, 'bpellet', hires(16, 16, R, (ctx) => drawPellet(ctx)));
  }

  /** The wooden ramp up to the middle island (its surface is the physics' ramp line). */
  private drawRamps() {
    for (const r of ARENA_RAMPS) {
      const x0 = r.x0 - 10;
      const y0 = r.y1 - 26;
      const w = r.x1 + r.flat - x0 + 10;
      const h = this.map.heightPx - y0;
      const key = `bramp-${r.x0}-${r.y0}`;
      if (!this.textures.exists(key))
        addCanvas(this, key, hires(w, h, ART_RES, (ctx) => drawRamp(ctx, r, x0, y0, (x: number) => landingY(this.mapNoRamps, x))), undefined, { release: true });
      this.add.image(x0, y0, key).setOrigin(0, 0).setScale(1 / ART_RES).setDepth(DEPTH.tiles + 1);
    }
  }

  /** The arena without its ramps (where the ramp's legs stand). */
  private get mapNoRamps() {
    return new ArenaMap(this.map.data, []);
  }

  /** Watch the battle in a little window (a box on the lobby screen, in CSS px), or full screen (null). */
  setPreview(rect: { x: number; y: number; w: number; h: number } | null) {
    this.preview = rect;
    this.fitCamera();
  }

  /** The whole arena is always in view. */
  private fitCamera() {
    const cam = this.cameras.main;
    // the canvas is drawn at device pixels; the lobby box is in CSS pixels
    const k = this.scale.width / window.innerWidth;
    const r = this.preview;
    if (r) cam.setViewport(Math.round(r.x * k), Math.round(r.y * k), Math.round(r.w * k), Math.round(r.h * k));
    else cam.setViewport(0, 0, this.scale.width, this.scale.height);
    const W = r ? r.w * k : this.scale.width;
    const H = r ? r.h * k : this.scale.height;
    // (the empty sky above the highest cloud is trimmed off, so the heroes are bigger)
    const SKY = 56;
    // (one screen of the arena: it's four screens wide, and the camera follows)
    const zoom = Math.min(W / (ARENA_VIEW * TILE_PX), H / (this.map.heightPx - SKY));
    this.fitZoom = zoom;
    cam.setZoom(zoom);
    cam.centerOn(this.camC?.x ?? this.map.widthPx / 2, (this.map.heightPx + SKY) / 2);
  }

  /**
   * Something heavy hits the ground at (x, y): a shockwave ring and dust along
   * the ground, and the camera shakes (hardest when it's near you).
   */
  private groundShake(x: number, y: number, k: number) {
    this.fx.shockwave(x, y, 55 * k);
    this.fx.dust(x - 24 * k, y, Math.round(6 * k));
    this.fx.dust(x + 24 * k, y, Math.round(6 * k));
    const me = this.me;
    const d = me && !this.spectate ? Math.hypot(me.x - x, (me.y - y) * 0.7) : 300;
    const near = d < 350 ? 1 : Math.max(0.35, 1 - (d - 350) / 900);
    this.cameras.main.shake(170 * k * (0.6 + 0.4 * near), 0.0045 * k * near);
  }

  /**
   * A bonus being grabbed: it pops up a touch, then spins and shrinks into the
   * hero who grabbed it (following them), with a trail of sparkles and a ring
   * of its colour when it gets there.
   */
  private collectPrize(x: number, y: number, kind: PrizeKind, v: HeroView | undefined, pid?: number) {
    let best = -1;
    let bd = 90;
    if (pid !== undefined) {
      // (by number: this one's out of the picture now, drawn or not)
      this.grabbed.add(pid);
      if (this.prizeViews.has(pid)) best = pid;
    } else
      for (const [id, pv] of this.prizeViews) {
        const d = Math.hypot(pv.img.x - x, pv.img.y - y);
        if (d < bd) {
          bd = d;
          best = id;
        }
      }
    if (best < 0) return;
    const pv = this.prizeViews.get(best)!;
    this.prizeViews.delete(best);
    this.grabbed.add(best);
    pv.chute.destroy();
    pv.shadow.destroy();
    const { img, glow } = pv;
    img.setVisible(true).setOrigin(0.5, 0.5).setDepth(DEPTH.players + 0.5);
    glow.setVisible(true).setDepth(DEPTH.players + 0.4);
    const x0 = img.x;
    const y0 = img.y - 15 * PRIZE_SCALE;
    const k0 = img.scaleX;
    const col = Phaser.Display.Color.HexStringToColor(PRIZE_COLOR[kind].mid).color;
    const target = () => (v && v.sprite.active ? { x: v.sprite.x, y: v.sprite.y - 22 * v.size } : { x: x0, y: y0 - 40 });
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const { x: hx, y: hy } = target();
        if (t < 0.28) {
          // the pop: up a little, a little bigger
          const u = Math.sin((t / 0.28) * (Math.PI / 2));
          img.setPosition(x0, y0 - 14 * u).setScale(k0 * (1 + 0.3 * u)).setRotation(0);
        } else {
          // then in it goes, spinning and shrinking, faster and faster
          const u = (t - 0.28) / 0.72;
          const e = u * u;
          const sx = x0 + (hx - x0) * e;
          const sy = y0 - 14 + (hy - (y0 - 14)) * e - Math.sin(u * Math.PI) * 18;
          img.setPosition(sx, sy).setScale(k0 * 1.3 * (1 - 0.88 * e)).setRotation(u * Math.PI * 3);
          if (Math.random() < 0.6) this.fx.sparkle(sx, sy, 1);
        }
        glow.setPosition(img.x, img.y).setScale(1.5 * (img.scaleX / k0)).setAlpha(0.7);
      },
      onComplete: () => {
        const { x: hx, y: hy } = target();
        img.destroy();
        glow.destroy();
        // a ring of the bonus's colour round the hero
        const ring = this.add.image(hx, hy, 'ring').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx).setScale(0.12).setAlpha(1);
        this.tweens.add({ targets: ring, scale: 0.75, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
        this.fx.sparkle(hx, hy, 8);
      },
    });
  }

  /** The off-screen pointer for another player: a badge in their colour with a point, and their name. */
  private makeArrow(name: string, col: string) {
    // (drawn pointing right; the whole pointer turns to face them)
    const g = this.add.image(0, 0, this.arrowTex(col)).setOrigin(ARROW_BOX.x / ARROW_BOX.w, ARROW_BOX.y / ARROW_BOX.h).setScale(1 / ARROW_RES);
    const label = this.add
      .text(0, 0, name, { fontFamily: 'Nunito, sans-serif', fontSize: '15px', fontStyle: '900', color: col, stroke: '#ffffff', strokeThickness: 5 })
      .setOrigin(0.5, 0.5)
      .setShadow(0, 1.5, '#3a2418', 0, true, false)
      .setResolution(3);
    return this.add.container(0, 0, [g, label]).setDepth(DEPTH.text + 5).setVisible(false);
  }

  /** Other players off the edge of the screen: a pointer just inside the edge, towards them. */
  private placeArrows(players: Map<string, SnapPlayer>) {
    const cam = this.cameras.main;
    const following = !this.spectate && !this.preview;
    const wv = cam.worldView;
    // constant size on screen (CSS px) whatever the zoom
    const px = this.scale.width / window.innerWidth / cam.zoom;
    for (const [id, v] of this.views) {
      if (!v.arrow) continue;
      const p = players.get(id);
      if (!following || !p || p.respawn > 0) {
        v.arrow.setVisible(false);
        continue;
      }
      // aim at the middle of their body
      const tx = v.sprite.x;
      const ty = v.sprite.y - 20;
      const pad = 6 * px;
      if (tx > wv.x + pad && tx < wv.right - pad && ty > wv.y + pad && ty < wv.bottom - pad) {
        v.arrow.setVisible(false);
        continue;
      }
      // just inside the edge (clear of the clock at the top and the scores at the bottom)
      const mx = 30 * px;
      const x = Phaser.Math.Clamp(tx, wv.x + mx, wv.right - mx);
      const y = Phaser.Math.Clamp(ty, wv.y + 64 * px, wv.bottom - 70 * px);
      const ang = Math.atan2(ty - y, tx - x);
      const [g, label] = v.arrow.list as [Phaser.GameObjects.Image, Phaser.GameObjects.Text];
      g.setRotation(ang);
      // the name sits on the inside, away from the point
      label.setText(this.names.get(id) ?? '');
      label.setPosition(-Math.cos(ang) * (20 + label.width / 2), -Math.sin(ang) * 26);
      v.arrow
        .setVisible(true)
        .setPosition(x, y)
        .setScale(px * 1.4)
        .setAlpha(0.85 + Math.sin(this.time.now / 180) * 0.15);
    }
  }

  /**
   * Playing: a little closer in than a whole screen, following your hero along the arena. Watching
   * (just spectating, or the lobby's little window): the screen-wide view, following whoever's winning.
   */
  private followCamera(dt: number, players: Map<string, SnapPlayer>) {
    const watching = this.spectate || !!this.preview || !this.me;
    let p: { x: number; y: number; respawn: number; kos?: number } | null = null;
    if (!watching) p = { ...this.myDrawn(), respawn: this.me!.respawn };
    else for (const q of players.values()) if (q.respawn <= 0 && (!p || q.kos > (p.kos ?? 0))) p = q;
    if (!p) return;
    const cam = this.cameras.main;
    const SKY = 56;
    const zoom = this.fitZoom * (watching ? 1 : FOLLOW_ZOOM);
    cam.setZoom(zoom);
    const vw = cam.width / zoom;
    const vh = cam.height / zoom;
    const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
    const my = (this.map.heightPx + SKY) / 2;
    const tx = clamp(p.x, vw / 2, this.map.widthPx - vw / 2);
    const ty = clamp(my + (p.y - 40 - my) * 0.5, SKY + vh / 2, this.map.heightPx - vh / 2);
    if (!this.camC) this.camC = { x: tx, y: ty };
    else if (p.respawn <= 0) {
      // (it keeps up with you: the arena's too wide to hang back in the middle)
      const k = 1 - Math.exp(-dt * (watching ? 1.4 : 3.5));
      this.camC.x += (tx - this.camC.x) * k;
      this.camC.y += (ty - this.camC.y) * k;
    }
    cam.centerOn(this.camC.x, this.camC.y);
  }

  /**
   * A hero's pictures in what a player's got on (`wear`: Shop ids, '' nothing; face: their faces), in
   * their slot's colour: the game's own when it's your gear in the first slot's colours (already
   * drawn), else drawn for them — coloured before the sunglasses go on, so those stay orange.
   */
  private textureFor(hero: string, slot: number, wear: string, face = false) {
    const recolor = slotRecolors(slot);
    const mine = !recolor && wardrobe.wearKey === wear;
    const f = face ? '-face' : '';
    const key = mine ? `char-${hero}${f}` : `bchar-${hero}-w${wear ? wear.replace(/,/g, '+') : 'none'}${recolor ? `-${slot}` : ''}${f}`;
    if (!this.textures.exists(key)) makeHeroSheet(this, key, characterById(hero), face, wear, recolor ? (c) => recolorForSlot(c, slot) : undefined, BattleScene.sheetRes(key));
    return key;
  }

  /**
   * The resolution a hero sheet is drawn at. Light mode: the other players' (`bchar-`) at 1.5 — on a 1x
   * screen the camera shows a hero at about a third of their sheet's full 3, so a quarter of the memory
   * (~2.9 MB less a player) and a quarter of the drawing and recolouring at the start, for a picture a
   * 1x screen can show just the same.
   */
  private static sheetRes(key: string) {
    return LIGHT && key.startsWith('bchar-') && !key.endsWith('-carry') ? OTHER_HERO_RES : ART_RES;
  }

  /** The hero's chair-carrying frames (arms up, both hands on it; the swing) in this player's colour. */
  private carryTextureFor(hero: string, slot: number) {
    const base = makeCarrySheet(this, characterById(hero));
    if (slot === 0) return base;
    const key = `bchar-${hero}-${slot}-carry`;
    if (!this.textures.exists(key)) {
      const src = this.textures.get(base);
      const canvas = recolorForSlot(src.getSourceImage() as HTMLCanvasElement, slot);
      addCanvas(this, key, canvas, (t) => {
        for (const name of src.getFrameNames()) {
          const f = src.get(name);
          t.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
        }
      });
    }
    return key;
  }

  /** The carry frame nearest arm angle a. */
  private static carryFrame(a: number) {
    let best = 'sw0';
    let d = Infinity;
    for (const [f, fa] of Object.entries(CARRY_SWING))
      if (Math.abs(fa - a) < d) {
        d = Math.abs(fa - a);
        best = f;
      }
    return best;
  }

  private viewFor(p: SnapPlayer): HeroView {
    let v = this.views.get(p.id);
    const wear = this.wears.get(p.id) ?? '';
    if (v && (v.hero !== p.hero || v.slot !== p.slot || v.wear !== wear)) {
      v.sprite.destroy();
      v.tag.destroy();
      v.hearts.destroy();
      v.halo?.destroy();
      v.ice.destroy();
      v.arrow?.destroy();
      v = undefined;
    }
    if (!v) {
      const c = characterById(p.hero);
      const col = SLOT_COLORS[p.slot % SLOT_COLORS.length];
      const bodyKey = this.textureFor(p.hero, p.slot, wear);
      const sprite = this.add.sprite(p.x, p.y, bodyKey, 'idle0').setOrigin(0.5, 1).setScale(c.scale / BattleScene.sheetRes(bodyKey)).setDepth(DEPTH.players);
      // (and their faces now too, while the curtain's still up: drawn the first time they blinked, it
      // was a stutter in the middle of the battle)
      const faceKey = this.textureFor(p.hero, p.slot, wear, true);
      const tag = this.add
        .text(p.x, p.y, this.names.get(p.id) ?? '', { fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontStyle: '900', color: '#ffffff', stroke: col, strokeThickness: 4 })
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.text)
        .setResolution(2);
      const hearts = this.add.image(0, 0, this.heartsTex(HEARTS)).setScale(1 / HEART_RES).setDepth(DEPTH.text);
      const halo = p.id === this.net.myId ? this.add.image(p.x, p.y, 'bhalo').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.players - 0.05) : undefined;
      const ice = this.add.image(p.x, p.y, 'bice').setOrigin(0.5, 1).setScale(1 / ART_RES).setDepth(DEPTH.players + 0.2).setVisible(false);
      v = { wear, cheer: -1, sprite, tag, hearts, anim: 0, tilt: 0, slot: p.slot, hero: p.hero, size: 1, sparkT: 0, face: new FaceClock(), halo, ice, chairA: null, bodyKey, faceKey };
      if (p.id !== this.net.myId) v.arrow = this.makeArrow(this.names.get(p.id) ?? '', col);
      this.views.set(p.id, v);
    }
    return v;
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    // (one picture made ahead, if any are still to make)
    this.prep.shift()?.();
    // names from the room list
    for (const rp of this.net.room?.players ?? []) {
      this.names.set(rp.id, rp.name);
      this.wears.set(rp.id, rp.wear ?? '');
    }

    // ── new snapshots from the server ──
    if (this.net.inbox.length) {
      const fresh = this.net.inbox.splice(0);
      for (const s of fresh) {
        this.playEvents(s.events);
        this.snaps.push(s);
        this.noteLateness(s);
      }
      if (this.snaps.length > 40) this.snaps.splice(0, this.snaps.length - 40);
      if (!this.spectate) {
        this.reconcile(fresh[fresh.length - 1]);
        this.tieShots(fresh);
        this.checkGrabs();
      }
    }

    // ── your hero: one step per tick with your buttons, sent to the server too ──
    // (the buttons are looked at every frame: a press between two ticks counts at the next one, and
    // shows straight away in where your hero's drawn — see meNext)
    const held = this.spectate ? 0 : this.buttons();
    this.latched |= held & (BTN.jump | BTN.fire | BTN.bomb);
    // (after a hiccup — the phone busy a moment — the ticks it missed are caught up, up to a quarter
    // second: losing them put your hero behind the server's, and that came back as a yank)
    this.acc += Math.min(deltaMs / 1000, 0.25);
    while (this.acc >= DT) {
      this.acc -= DT;
      if (!this.spectate) this.localTick(held | this.latched);
      this.latched = 0;
    }
    const me = this.me;
    if (me && me.respawn <= 0) {
      const n = (this.meNext ??= { ...me });
      Object.assign(n, me);
      stepMove(n, held | this.latched, this.map, undefined, () => false);
    } else this.meNext = null;

    this.render(dt);
  }

  /** Where your hero's drawn: part way to the next tick (as far as the time since this one), plus what's left of a correction. */
  private myDrawn() {
    const me = this.me!;
    const n = this.meNext;
    const k = n ? Phaser.Math.Clamp(this.acc / DT, 0, 1) : 0;
    return { x: me.x + (n ? (n.x - me.x) * k : 0) + this.fix.x, y: me.y + (n ? (n.y - me.y) * k : 0) + this.fix.y };
  }

  private buttons() {
    const i = soloSource.poll();
    // (the bomb button wins over fire on a gamepad's Y, which does both in the levels)
    return (i.left ? BTN.left : 0) | (i.right ? BTN.right : 0) | (i.jump ? BTN.jump : 0) | (i.fire && !i.bomb ? BTN.fire : 0) | (i.run ? BTN.run : 0) | (i.bomb ? BTN.bomb : 0);
  }

  /** The chair I'm holding (by the latest snapshot), if any. */
  private myChair() {
    const last = this.snaps[this.snaps.length - 1];
    return last?.chairs.find((c) => c[3] === this.net.myId) ?? null;
  }

  /**
   * My shots still out, as the server will count them when it gets to this tick's buttons: the ones
   * still flying on my screen (my shots fly on the same ticks as my buttons, so they're where the
   * server's will be then), and any that stopped on someone and the server hasn't blown up yet. (The
   * last snapshot's count was a round trip old: firing fast, it let a shot go here that the server
   * then said no to — a shot that vanished, and a recoil that got taken back.)
   */
  private myShotsOut() {
    let n = 0;
    for (const s of this.shots) if (!s.boomed && (s.hit === null || (s.sid !== null && this.mineSeen.has(s.sid)))) n++;
    return n;
  }

  private localTick(b: number) {
    this.seq++;
    this.net.input(this.seq, b);
    const me = this.me;
    if (!me) return;
    const entry: [number, number, boolean | null] = [this.seq, b, null];
    this.pending.push(entry);
    if (this.pending.length > 90) this.pending.splice(0, this.pending.length - 90);
    if (me.respawn > 0) return;
    const ev: BEvent[] = [];
    const max = characterById(me.hero).maxRockets + (me.power === POWER.rapid ? 3 : 0);
    // (whether a shot was allowed is remembered, so going over these buttons again after a snapshot decides the same)
    const fired = stepMove(me, b, this.map, ev, () => (entry[2] = !this.myChair() && this.myShotsOut() < max));
    for (const e of ev) if (e.k === 'jump') this.jumpFx(me.x, me.y, e.air, true);
    // (your shot leaves now, on your screen — the same shot the server makes, flying the same way)
    if (fired) this.shots.push({ n: ++this.shotN, r: heroShot(me, fired, this.map), sid: null, born: performance.now(), hit: null, hitSeq: 0, boomed: false, onHero: false, passed: false });
    this.flyShots();
    if (fired) {
      const c = characterById(me.hero);
      const k = sizeOf(me);
      if (fired === 2) {
        me.bombs--;
        sfx.whoosh();
      } else {
        sfx.shoot();
        this.fx.muzzle(me.x + me.facing * 24 * c.scale * k, me.y - (c.muzzleY ?? 18) * k, me.facing, me.x - me.facing * 14 * c.scale * k);
      }
    }
    this.grabPrizes(me);
  }

  /**
   * A tick of your own shots' flight. One that reaches a wall (or its fuse runs out) blows up there and
   * then, on your screen — that's certain: the server's twin flies the same way (its blast isn't shown
   * again when it comes). One that reaches someone stops there and waits for the server to say.
   */
  private flyShots() {
    const seen = this.lastSeen;
    const now = performance.now();
    for (const s of this.shots) {
      if (s.hit !== null) continue;
      if (moveShot(s.r, this.map)) {
        s.hit = now;
        s.boomed = true;
        this.myBoom(s.r);
      } else if (seen && !s.passed && this.shotHits(s.r, seen)) {
        s.hit = now;
        s.hitSeq = this.seq;
        s.onHero = true;
      }
    }
  }

  /** One of your shots blowing up on your screen (the same blast the server will make there). */
  private myBoom(r: Omit<BRocket, 'id'>) {
    const x = r.x + (r.kind === 'rocket' ? r.dir * 6 : 0);
    this.myBooms.push({ x, y: r.y, at: performance.now() });
    this.boomFx(x, r.y, r.radius);
  }

  private boomFx(x: number, y: number, radius: number) {
    this.fx.explosion(x, y, radius);
    sfx.explode();
    const me = this.me;
    const near = me ? Math.hypot(me.x - x, me.y - y) : 999;
    this.cameras.main.shake(140, 0.004 * Math.max(0.3, 1 - near / 500) * (radius / 56));
  }

  /**
   * Is one of your shots into a bad guy or another hero (the sim's test)? The others are drawn a
   * moment in the past, and your shot's ahead of the server, so a hero's taken where they'll be by
   * then if they keep going — most of the way: people dodge.
   */
  private shotHits(r: Omit<BRocket, 'id'>, seen: { players: Map<string, SnapPlayer>; enemies: SnapEnemy[] }) {
    for (const e of seen.enemies) {
      const [w, h] = ENEMY_BOX[e[1]];
      if (Math.abs(r.x - e[2]) < w / 2 + 6 && r.y > e[3] - h - 3 && r.y < e[3] + 3) return true;
    }
    if (r.kind !== 'rocket' && r.kind !== 'fire' && r.age <= 0.2) return false;
    const lead = this.lead() * DT;
    for (const p of seen.players.values()) {
      if (p.id === r.owner || p.respawn > 0) continue;
      const c = characterById(p.hero);
      const k = sizeOf(p);
      const px = p.x + Phaser.Math.Clamp(p.vx * lead * 0.7, -90, 90);
      if (Math.abs(r.x - px) < boxW(c, k) / 2 + 6 && r.y > p.y - boxH(c, k) - 3 && r.y < p.y + 3) return true;
    }
    return false;
  }

  /** How far (ticks) your own timeline is ahead of the others' as drawn: the round trip, the server's wait for your buttons, and how far behind the others are drawn. */
  private lead() {
    const last = this.snaps[this.snaps.length - 1];
    const mine = last?.players.find((p) => p.id === this.net.myId);
    if (!last || !mine || !this.otherClock) return 0;
    return Phaser.Math.Clamp(last.tick + (this.seq - mine.ack) - this.otherClock.tick, 0, 15);
  }

  /**
   * Tie your shots to the server's copies as they turn up (each new one of yours to your oldest
   * untied shot of its kind), and let them go when the server's are gone (blown up). One the server
   * never made (it said no — too many in the air) goes after a while. One that stopped on someone on
   * your screen but flew on at the server's (they'd moved) flies on again as soon as that's known.
   */
  private tieShots(fresh: Snapshot[]) {
    const myId = this.net.myId;
    for (const snap of fresh) {
      const now = new Set<number>();
      for (const r of snap.rockets) {
        if (r.owner !== myId) continue;
        now.add(r.id);
        if (this.mineSeen.has(r.id)) continue;
        const s = this.shots.find((q) => q.sid === null && q.r.kind === r.kind);
        if (s) s.sid = r.id;
      }
      this.mineSeen = now;
    }
    const t = performance.now();
    // (the server's twin still flying a couple of ticks past where this one stopped on someone here:
    // it missed them there — so it flies on here too, only stopping for walls now)
    const ack = fresh[fresh.length - 1].players.find((p) => p.id === myId)?.ack ?? 0;
    for (const s of this.shots)
      if (s.onHero && s.hit !== null && s.sid !== null && this.mineSeen.has(s.sid) && ack >= s.hitSeq + 2) {
        s.hit = null;
        s.onHero = false;
        s.passed = true;
      }
    this.shots = this.shots.filter((s) => (s.sid !== null ? this.mineSeen.has(s.sid) : t - s.born < 1200) && (s.hit === null || t - s.hit < (s.boomed ? 1500 : 900)));
    this.myBooms = this.myBooms.filter((b) => t - b.at < 1500);
  }

  /**
   * Touching a prize on your screen: it's yours (the hop, the sparkles and the sound now; what it
   * does comes with the server's word, a moment later). If the server doesn't agree — someone else
   * got there first — it's put back, or goes to them.
   */
  private grabPrizes(me: BPlayer) {
    const n = this.snaps.length;
    if (!n || me.respawn > 0) return;
    // (where they are by your clock: the newest snapshot's, and one still floating down that much
    // further down — you're ahead of the server by the ticks it hasn't had from you yet)
    const last = this.snaps[n - 1];
    const prev = n > 1 ? this.snaps[n - 2] : null;
    const lead = Math.max(0, this.seq - (last.players.find((p) => p.id === me.id)?.ack ?? this.seq));
    const c = characterById(me.hero);
    const k = sizeOf(me);
    for (const [pid, kind, x, y0, age] of last.prizes) {
      if (this.grabbed.has(pid)) continue;
      let y = y0;
      if (age < 0) {
        const py = prev?.prizes.find((z) => z[0] === pid)?.[3];
        const vy = py !== undefined && last.tick > prev!.tick ? (y0 - py) / (last.tick - prev!.tick) : 3;
        y = Math.min(landingY(this.map, x), y0 + Math.max(0, vy) * lead);
      }
      // (the sim's test)
      if (Math.abs(me.x - x) < boxW(c, k) / 2 + 22 && y > me.y - boxH(c, k) - 10 && y - 44 < me.y) {
        this.myGrabs.set(pid, { at: performance.now(), kind, x, y });
        this.prizeFx(x, y, kind, this.views.get(this.net.myId ?? ''), pid);
        break;
      }
    }
  }

  /** Prizes I grabbed on my screen that the server hasn't said I got: back on show if it's still there, a while after it should have said. */
  private checkGrabs() {
    if (!this.myGrabs.size) return;
    const last = this.snaps[this.snaps.length - 1];
    const t = performance.now();
    for (const [pid, g] of this.myGrabs) {
      if (t - g.at < this.net.rtt + 400) continue;
      this.myGrabs.delete(pid);
      if (last.prizes.some((z) => z[0] === pid)) this.grabbed.delete(pid);
    }
  }

  /** Take the server's word for your hero, then replay the buttons it hasn't seen yet. */
  private reconcile(s: Snapshot) {
    const mine = s.players.find((p) => p.id === this.net.myId);
    if (!mine) {
      this.me = null;
      return;
    }
    const before = this.me && this.me.respawn <= 0 ? { x: this.me.x, y: this.me.y } : null;
    const me: BPlayer = { ...mine, lastHitBy: null };
    this.pending = this.pending.filter(([q]) => q > mine.ack);
    const max = characterById(me.hero).maxRockets + (me.power === POWER.rapid ? 3 : 0);
    const mineInFlight = s.rockets.filter((r) => r.owner === me.id).length;
    for (const [, b, ok] of this.pending)
      if (me.respawn <= 0 && stepMove(me, b, this.map, undefined, () => ok ?? (!this.myChair() && mineInFlight < max)) === 2) me.bombs--;
    if (before && me.respawn <= 0) {
      this.fix.x += before.x - me.x;
      this.fix.y += before.y - me.y;
      if (Math.hypot(this.fix.x, this.fix.y) > FIX_JUMP) this.fix = { x: 0, y: 0 }; // too far off: just jump there
    }
    this.me = me;
  }

  /** A snapshot came in: how late was it (see interp)? */
  private noteLateness(s: Snapshot) {
    // (when it would have come if every one came as early as the earliest in the last 3 seconds: so a
    // lasting change — the server stalled and skipped ticks, the clocks drifting apart, a new route —
    // is forgotten within 3 seconds rather than counted as lateness for good)
    const ideal = s.at - s.tick * TICK_MS;
    // (the same numbers kept in order as well, one in and one out per snapshot: sorting all 90 again for
    // every snapshot, and the copies for it, was the most time a snapshot took)
    const sorted = this.lateSorted;
    this.lateness.push(ideal);
    let i = sorted.length;
    sorted.push(ideal);
    for (; i > 0 && sorted[i - 1] > ideal; i--) sorted[i] = sorted[i - 1];
    sorted[i] = ideal;
    if (this.lateness.length > 90) {
      const old = this.lateness.shift()!;
      let j = 0;
      while (sorted[j] !== old) j++;
      for (; j < sorted.length - 1; j++) sorted[j] = sorted[j + 1];
      sorted.pop();
    }
    this.lateBase = sorted[0];
    // (all but the latest few: a rare later one is covered by carrying on for a moment)
    const base = this.lateBase;
    const want = Phaser.Math.Clamp(0.8 + (sorted[Math.floor(sorted.length * 0.9)] - base) / TICK_MS, INTERP_MIN, INTERP_MAX);
    this.interp += (want - this.interp) * (want > this.interp ? 0.3 : 0.02);
  }

  /** The others carried on from snapshot `s` by the rules with the buttons they last had (EXTRAP_TICKS ticks of it, worked out once). */
  private aheadOf(s: Snapshot) {
    if (this.ahead?.tick === s.tick) return this.ahead;
    const players = new Map<string, BPlayer[]>();
    for (const p of s.players) {
      if (p.id === this.net.myId || p.respawn > 0) continue;
      const q: BPlayer = { ...p, lastHitBy: null };
      const steps: BPlayer[] = [];
      for (let i = 0; i < EXTRAP_TICKS; i++) {
        stepMove(q, p.prevBtn, this.map, undefined, () => false);
        steps.push({ ...q });
      }
      players.set(p.id, steps);
    }
    this.aheadPrev = this.ahead;
    this.ahead = { tick: s.tick, players };
    return this.ahead;
  }

  /** Where a player's carried on to, `e` ticks past snapshot `p`'s (null if not worked out). */
  private static carried(p: SnapPlayer, steps: BPlayer[] | undefined, e: number) {
    if (!steps) return null;
    const i = Math.min(Math.floor(e), steps.length);
    const f = e - i;
    const a = i === 0 ? p : steps[i - 1];
    const b = steps[Math.min(i, steps.length - 1)];
    return { a, b, f: i >= steps.length ? 0 : f };
  }

  /** A player blended between two snapshots (none across a respawn: they'd slide across the arena). */
  private snapPlayerAt(id: string, a: Snapshot, b: Snapshot, k: number): SnapPlayer | null {
    const pb = b.players.find((p) => p.id === id);
    if (!pb) return null;
    const pa = a.players.find((p) => p.id === id);
    if (!pa || pa.respawn > 0 !== pb.respawn > 0 || Math.abs(pa.x - pb.x) > 120) return pb;
    return { ...(k < 0.5 ? pa : pb), x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k, vx: pa.vx + (pb.vx - pa.vx) * k, vy: pa.vy + (pb.vy - pa.vy) * k };
  }

  /**
   * Another player, drawn by their own buttons' clock rather than the server's ticks: each snapshot
   * says which of their ticks of buttons they're at (`ack`), and they're blended between those. When
   * their buttons come in late, the server has them wait a tick and then take two steps at once —
   * by its ticks that's a stop and a lurch; by their own ticks it's just how they moved. (The offset
   * between the two clocks: the most it's been lately, eased.) Past their newest, they carry on by
   * the rules with the buttons they last had, for up to EXTRAP_TICKS, and anything that turns out a
   * little wrong is faded out (otherFix).
   */
  private otherAt(id: string, clock: number, now: number): SnapPlayer | null {
    const snaps = this.snaps;
    const last = snaps[snaps.length - 1];
    const newest = last.players.find((p) => p.id === id);
    if (!newest) return null;
    // (the offset, from the last second or so of snapshots)
    let off = -Infinity;
    for (let i = Math.max(0, snaps.length - 30); i < snaps.length; i++) {
      const q = snaps[i].players.find((p) => p.id === id);
      if (q) off = Math.max(off, q.ack - snaps[i].tick);
    }
    const o = this.ackOff.get(id);
    const eased = o === undefined || Math.abs(off - o) > 6 ? off : o + (off - o) * Math.min(1, (off > o ? 0.2 : 0.05) * ((now - this.ackAt) / TICK_MS));
    this.ackOff.set(id, eased);
    const t = clock + eased;
    // the snapshots either side of `t` by their ticks of buttons (the latest one for each)
    let pa: SnapPlayer | null = null;
    let pb: SnapPlayer | null = null;
    for (let i = snaps.length - 1; i >= 0; i--) {
      const q = snaps[i].players.find((p) => p.id === id);
      if (!q) continue;
      if (q.ack > t) {
        if (!pb || q.ack < pb.ack) pb = q;
      } else {
        pa = q;
        break;
      }
    }
    let p: SnapPlayer;
    let basis: { tick: number; e: number } | null = null;
    if (!pa) p = pb ?? newest;
    else if (!pb) {
      // past their newest: carry on a little way
      const e = Phaser.Math.Clamp(t - newest.ack, 0, EXTRAP_TICKS);
      const run = newest.respawn > 0 ? null : BattleScene.carried(newest, this.aheadOf(last).players.get(id), e);
      if (run) {
        const { a: q0, b: q1, f } = run;
        p = { ...newest, ...(f < 0.5 ? q0 : q1), ack: newest.ack, x: q0.x + (q1.x - q0.x) * f, y: q0.y + (q1.y - q0.y) * f };
        basis = { tick: last.tick, e };
      } else p = newest;
    } else if (pa.respawn > 0 !== pb.respawn > 0 || Math.abs(pa.x - pb.x) > 120) p = pb;
    else {
      const k = (t - pa.ack) / (pb.ack - pa.ack);
      p = { ...(k < 0.5 ? pa : pb), x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k, vx: pa.vx + (pb.vx - pa.vx) * k, vy: pa.vy + (pb.vy - pa.vy) * k };
    }
    // (carried on last frame from another snapshot (or not now): where that had them by now, against
    // where they are, faded out rather than jumped)
    const prev = this.carriedFrom.get(id);
    if (prev && (!basis || basis.tick !== prev.tick) && p.respawn <= 0) {
      const cache = [this.ahead, this.aheadPrev].find((c) => c?.tick === prev.tick);
      const base = snaps.find((s) => s.tick === prev.tick)?.players.find((q) => q.id === id);
      const was = cache && base && base.respawn <= 0 ? BattleScene.carried(base, cache.players.get(id), Phaser.Math.Clamp(t - base.ack, 0, EXTRAP_TICKS)) : null;
      if (was) {
        const wx = was.a.x + (was.b.x - was.a.x) * was.f;
        const wy = was.a.y + (was.b.y - was.a.y) * was.f;
        if (Math.hypot(wx - p.x, wy - p.y) < 80) {
          const fo = this.otherFix.get(id) ?? { x: 0, y: 0 };
          fo.x += wx - p.x;
          fo.y += wy - p.y;
          this.otherFix.set(id, fo);
        }
      }
    }
    if (basis) this.carriedFrom.set(id, { tick: basis.tick });
    else this.carriedFrom.delete(id);
    return p;
  }

  /** Where everyone else is right now: a smooth blend between two snapshots, a moment ago. */
  private othersAt(): {
    players: Map<string, SnapPlayer>;
    rockets: Map<number, { x: number; y: number; dir: 1 | -1; kind: RocketKind; owner: string }>;
    prizes: [number, PrizeKind, number, number, number][];
    enemies: SnapEnemy[];
    hazards: SnapHazard[];
    chairs: SnapChair[];
    timeLeft: number;
  } | null {
    const n = this.snaps.length;
    if (!n) return null;
    const last = this.snaps[n - 1];
    const now = performance.now();
    // (the server's clock as it would be showing here at the earliest, less `interp`)
    const want = this.lateBase !== null ? (now - this.lateBase) / TICK_MS - this.interp : last.tick - this.interp;
    const oc = this.otherClock;
    let clock = want;
    if (oc && Math.abs(want - oc.tick) <= 4) {
      const sec = (now - oc.at) / 1000;
      clock = oc.tick + sec / DT;
      clock = Math.max(oc.tick, clock + (want - clock) * (1 - Math.exp(-sec * 6)));
    }
    this.otherClock = { tick: clock, at: now };
    // past the newest snapshot (it's late): carry on a little way, then wait
    const extra = Phaser.Math.Clamp(clock - last.tick, 0, EXTRAP_TICKS);
    const rt = Math.min(last.tick, clock);
    let a = this.snaps[0];
    let b = last;
    for (let i = n - 1; i > 0; i--)
      if (this.snaps[i - 1].tick <= rt) {
        a = this.snaps[i - 1];
        b = this.snaps[i];
        break;
      }
    // (for things that just go on as they were: k past 1 carries them on in a straight line)
    const span = b.tick - a.tick;
    const k = span === 0 ? 1 : Phaser.Math.Clamp((rt - a.tick) / span, 0, 1) + (extra > 0 ? extra / span : 0);
    const kp = Math.min(k, 1);
    const players = new Map<string, SnapPlayer>();
    for (const pl of last.players) {
      const p = pl.id === this.net.myId ? this.snapPlayerAt(pl.id, a, b, kp) : this.otherAt(pl.id, clock, now);
      if (p) players.set(pl.id, p);
    }
    this.ackAt = now;
    // (gone at the server — blown up: not drawn any more, though the others' picture is a moment behind)
    const live = new Set(last.rockets.map((r) => r.id));
    const rockets = new Map<number, { x: number; y: number; dir: 1 | -1; kind: RocketKind; owner: string }>();
    for (const rb of b.rockets) {
      if (!live.has(rb.id)) continue;
      const ra = a.rockets.find((r) => r.id === rb.id);
      rockets.set(rb.id, ra ? { x: ra.x + (rb.x - ra.x) * k, y: ra.y + (rb.y - ra.y) * k, dir: rb.dir, kind: rb.kind, owner: rb.owner } : rb);
    }
    const prizes = b.prizes.map(([id, kind, x, y, age]) => {
      const pa = a.prizes.find((z) => z[0] === id);
      return [id, kind, x, pa ? pa[3] + (y - pa[3]) * kp : y, age] as [number, PrizeKind, number, number, number];
    });
    const liveE = new Set(last.enemies.map((e) => e[0]));
    const enemies: SnapEnemy[] = [];
    for (const eb of b.enemies) {
      if (!liveE.has(eb[0])) continue;
      const ea = a.enemies.find((e) => e[0] === eb[0]);
      enemies.push(ea ? [eb[0], eb[1], ea[2] + (eb[2] - ea[2]) * k, ea[3] + (eb[3] - ea[3]) * k, eb[4], eb[5], eb[6], eb[7], eb[8]] : eb);
    }
    const hazards = b.hazards.map((hb): SnapHazard => {
      const ha = a.hazards.find((h) => h[0] === hb[0]);
      return ha && hb[4] <= 0 ? [hb[0], hb[1], ha[2] + (hb[2] - ha[2]) * kp, ha[3] + (hb[3] - ha[3]) * kp, hb[4], hb[5]] : hb;
    });
    const chairs = b.chairs.map((cb): SnapChair => {
      const ca = a.chairs.find((c) => c[0] === cb[0]);
      return ca && !cb[3] && !ca[3] ? [cb[0], ca[1] + (cb[1] - ca[1]) * kp, ca[2] + (cb[2] - ca[2]) * kp, cb[3], cb[4], cb[5], cb[6]] : cb;
    });
    return { players, rockets, prizes, enemies, hazards, chairs, timeLeft: last.timeLeft };
  }

  private render(dt: number) {
    const cur = this.othersAt();
    if (!cur) return;
    this.lastSeen = { players: cur.players, enemies: cur.enemies };
    // your own shots: drawn where they are on your phone, instead of the server's copies (behind)
    // (and not once they've blown up here)
    if (this.shots.length) {
      for (const s of this.shots) if (s.sid !== null) cur.rockets.delete(s.sid);
      for (const s of this.shots) if (!s.boomed) cur.rockets.set(-s.n, { x: s.r.x, y: s.r.y, dir: s.r.dir, kind: s.r.kind, owner: s.r.owner });
    }
    // (the others' leftover offsets from carrying on a little wrong, fading out)
    const ofk = 1 - Math.exp(-dt * 10);
    for (const [id, o] of this.otherFix) {
      o.x -= o.x * ofk;
      o.y -= o.y * ofk;
      if (Math.abs(o.x) + Math.abs(o.y) < 0.05) this.otherFix.delete(id);
    }
    // (fading out — a big one no faster than FIX_GLIDE, so it slides rather than lurches)
    const fixLen = Math.hypot(this.fix.x, this.fix.y);
    if (fixLen > 0.01) {
      const k = Math.min(1 - Math.exp(-dt * 14), (FIX_GLIDE * dt) / fixLen);
      this.fix.x -= this.fix.x * k;
      this.fix.y -= this.fix.y * k;
    } else this.fix.x = this.fix.y = 0;
    const seen = new Set<string>();
    // (who's holding a chair, and how far into a swing)
    const held = new Map(cur.chairs.filter((c) => c[3]).map((c) => [c[3], c[5]] as const));
    for (const [id, p0] of cur.players) {
      seen.add(id);
      const isMe = id === this.net.myId && this.me;
      const p: SnapPlayer | BPlayer = isMe ? this.me! : p0;
      const v = this.viewFor(p0);
      const down = p.respawn > 0;
      const of = isMe ? null : this.otherFix.get(id);
      const at = isMe ? this.myDrawn() : { x: p.x + (of?.x ?? 0), y: p.y + (of?.y ?? 0) };
      const x = at.x;
      const y = at.y;
      v.sprite.setVisible(!down);
      v.tag.setVisible(!down);
      v.hearts.setVisible(!down);
      v.halo?.setVisible(!down);
      v.ice.setVisible(!down && p.frozen > 0);
      if (down) continue;
      const c = characterById(p.hero);
      // pose, like the hero in the levels
      let frame: string;
      const speed = Math.abs(p.vx);
      if (p.stun > 0) frame = 'hurt';
      else if (p.shotAgo < 0.16) frame = 'shoot';
      else if (!p.onGround) frame = p.vy < 0 ? 'jump' : 'fall';
      else if (speed > 15) {
        v.anim += dt * (8 + speed / 11);
        frame = `walk${Math.floor(v.anim) % WALK_FRAMES}`;
      } else {
        v.anim += dt * 1.6;
        frame = `idle${Math.floor(v.anim) % 2}`;
      }
      // holding a chair: the arms-up frames (and the swing: wind back, then over the top and down)
      const swing = held.get(id);
      v.chairA = null;
      if (swing !== undefined) {
        const t = swing > 0 ? CHAIR_SWING - swing : -1;
        const UP = 0.09;
        const DOWN = 0.17;
        v.chairA = t < 0 ? -1.75 : t < UP ? -1.75 + (CARRY_SWING.sw0 + 1.75) * (t / UP) : CARRY_SWING.sw0 + (CARRY_SWING.sw3 - CARRY_SWING.sw0) * Math.min(1, (t - UP) / DOWN) ** 1.4;
        if (t >= 0 && p.stun <= 0) frame = BattleScene.carryFrame(v.chairA);
      }
      // standing about: blink, glance around, breathe (the face frames, as in the levels)
      v.face.tick(dt);
      const fk = frame.startsWith('idle') && v.chairA === null ? v.face.key : null;
      // (made again if they're ever gone)
      if (!this.textures.exists(v.bodyKey)) v.bodyKey = this.textureFor(p.hero, v.slot, v.wear);
      if (!this.textures.exists(v.faceKey)) v.faceKey = this.textureFor(p.hero, v.slot, v.wear, true);
      const bodyKey = v.chairA !== null ? this.carryTextureFor(p.hero, v.slot) : v.bodyKey;
      if (fk) v.sprite.setTexture(v.faceKey, fk);
      else if (v.sprite.texture.key !== bodyKey) v.sprite.setTexture(bodyKey, frame);
      const targetTilt = (p.vx / c.runSpeed) * (p.onGround ? 0.14 : 0.06);
      v.tilt += (targetTilt - v.tilt) * Math.min(1, dt * 12);
      // growing / shrinking back eases in, with a little wobble
      const size = sizeOf(p);
      v.size += (size - v.size) * Math.min(1, dt * 9);
      const wob = Math.abs(v.size - size) > 0.02 ? 1 + Math.sin(this.time.now / 30) * 0.04 : 1;
      const star = p.power === POWER.star;
      // the celebration hop after grabbing a bonus (just for show: the hero itself doesn't move)
      let cheer: ReturnType<typeof cheerPose> = null;
      if (v.cheer >= 0) {
        v.cheer += dt;
        cheer = cheerPose(v.cheer * 0.8, p.hero === 'scruffy');
        if (!cheer) v.cheer = -1;
      }
      let sx = 1;
      let sy = 1;
      let hx = 0;
      let hy = 0;
      let rot = v.tilt;
      if (cheer) {
        // (the squash and stretch a bit stronger than on the cards: it's smaller on screen)
        sx = 1 + (cheer.sx - 1) * 1.6;
        sy = 1 + (cheer.sy - 1) * 1.6;
        const hh = (c.hitH ?? 34) * v.size;
        hy = -cheer.up * hh * 1.25;
        if (p.onGround && cheer.frame !== 'idle0') {
          frame = cheer.frame;
          if (v.sprite.texture.key !== bodyKey) v.sprite.setTexture(bodyKey, frame);
        }
        if (cheer.spin > 0) {
          // a backflip turns round the middle of the body (the sprite turns round its feet)
          const a = -2 * Math.PI * cheer.spin * (p.facing < 0 ? -1 : 1);
          const hc = hh * 0.55;
          rot += a;
          hx += -Math.sin(a) * hc;
          hy += -hc + Math.cos(a) * hc;
        }
      }
      if (v.sprite.texture.key === bodyKey) v.sprite.setFrame(frame);
      // (the picture showing — body, faces or carrying — and the resolution it was drawn at)
      const sres = BattleScene.sheetRes(v.sprite.texture.key);
      v.sprite
        .setPosition(x + hx, y + 2 + hy)
        .setFlipX(p.facing < 0)
        .setRotation(rot)
        .setScale((c.scale / sres) * v.size * wob * sx, ((c.scale / sres) * v.size / wob) * sy)
        .setAlpha(p.invuln > 0 && !star ? (Math.floor(this.time.now / 70) % 2 ? 0.45 : 1) : 1);
      // invincible: rainbow shimmer and sparkles; rapid fire: sparks off the bazooka
      v.sparkT -= dt;
      if (star) {
        const hue = ((this.time.now / 4) % 360) / 360;
        v.sprite.setTint(Phaser.Display.Color.HSVToRGB(hue, 0.45, 1).color);
        if (v.sparkT <= 0) {
          v.sparkT = 0.06;
          this.fx.sparkle(x + (Math.random() - 0.5) * 30 * v.size, y - Math.random() * 40 * v.size, 1);
        }
      } else if (p.frozen <= 0 && v.sprite.isTinted && v.sprite.tintMode !== Phaser.TintModes.FILL) v.sprite.clearTint();
      if (p.power === POWER.rapid && v.sparkT <= 0) {
        v.sparkT = 0.09;
        this.fx.flameTrail(x + p.facing * 22 * c.scale, y - (c.muzzleY ?? 18), p.facing, 0.5);
      }
      if (p.frozen > 0) {
        const c0 = characterById(p.hero);
        const hh = (c0.hitH ?? 34) * v.size;
        v.ice
          .setPosition(x, y + 3)
          .setDisplaySize(((c0.hitW ?? 22) * v.size + 22) * 1.15, hh + 22)
          .setAlpha(p.frozen < 0.5 && Math.floor(this.time.now / 80) % 2 ? 0.45 : 0.9);
        v.sprite.setTint(0xa8e6ff);
      }
      if (v.halo) {
        const pulse = 1 + Math.sin(this.time.now / 260) * 0.06;
        v.halo
          .setVisible(true)
          .setPosition(x, y - (c.hitH ?? 34) * v.size * 0.5)
          .setScale(((c.hitH ?? 34) / 34) * (1 + (v.size - 1) * 0.3) * 0.6 * pulse)
          .setAlpha(0.36 + Math.sin(this.time.now / 260) * 0.08);
      }
      // (over a hat or a skateboard's lift, if they've one)
      const gu = gearUp(v.wear);
      const top = y - (c.hitH ?? 34) * v.size - 10 - (gu ? (gu + 1) * c.scale * v.size : 0);
      // the name just over the head, the hearts above the name
      v.tag.setText(this.names.get(id) ?? '').setPosition(x, top + 9);
      // (a picture of the hearts, one for each count, moved about — drawn as shapes, every hero's
      // hearts were rebuilt every frame)
      v.hearts.setTexture(this.heartsTex(p.hp)).setPosition(x, top - 13);
    }
    for (const [id, v] of this.views)
      if (!seen.has(id)) {
        v.sprite.destroy();
        v.tag.destroy();
        v.hearts.destroy();
        v.halo?.destroy();
        v.ice.destroy();
        v.arrow?.destroy();
        this.views.delete(id);
      }
    this.renderEnemies(cur.enemies, dt);
    this.renderHazards(cur.hazards);
    this.renderChairs(cur.chairs, dt);
    // rockets
    for (const [id, r] of cur.rockets) {
      let img = this.rocketViews.get(id);
      if (!img) {
        if (r.kind === 'saw') img = this.add.sprite(r.x, r.y, 'w-saw', 's0').setScale(0.8 / W_RES).setDepth(DEPTH.projectiles);
        else {
          const tex = { bomb: 'bbomb', pellet: 'bpellet', fire: 'bfire', poo: 'bpoo', rocket: 'rocket' }[r.kind];
          // (a grown hero's rockets, bombs and fireballs are as much bigger as they are)
          const grown = this.views.get(r.owner)?.size ?? 1;
          img = this.add.image(r.x, r.y, tex).setScale(((r.kind === 'fire' ? 1.3 : r.kind === 'poo' ? 1.15 : 1) * grown) / ART_RES).setDepth(DEPTH.projectiles).setFlipX(r.dir < 0);
        }
        this.rocketViews.set(id, img);
      }
      if (r.kind === 'fire') {
        img.setPosition(r.x, r.y);
        if (Math.random() < 0.8) this.fx.flameTrail(r.x - r.dir * 8, r.y, -r.dir, 0.6);
      } else if (r.kind === 'poo') {
        img.setPosition(r.x, r.y).setRotation(img.rotation + r.dir * dt * 9);
      } else if (r.kind === 'saw') {
        img.setPosition(r.x, r.y).setRotation(img.rotation + r.dir * dt * 16);
        (img as Phaser.GameObjects.Sprite).setFrame(Math.floor(this.time.now / 40) % 2 ? 's0' : 's1');
      } else if (r.kind === 'pellet') {
        img.setPosition(r.x, r.y);
        if (Math.random() < 0.4) this.fx.trail(r.x - r.dir * 6, r.y);
      } else if (r.kind === 'bomb') {
        img.setPosition(r.x, r.y).setRotation(img.rotation + r.dir * dt * 7);
        if (Math.random() < 0.5) this.fx.sparkle(r.x + 6, r.y - 8, 1);
      } else {
        img.setPosition(r.x, r.y).setRotation(Math.sin(this.time.now / 25 + id) * 0.04);
        if (Math.random() < 0.6) this.fx.trail(r.x - r.dir * 12, r.y + (Math.random() - 0.5) * 3);
      }
    }
    for (const [id, img] of this.rocketViews)
      if (!cur.rockets.has(id)) {
        img.destroy();
        this.rocketViews.delete(id);
      }
    // prizes: sway down under a parachute (a shadow growing where they'll land), squash
    // and bounce when they touch down, bob there glowing, blink for their last 2 s
    const live = new Set<number>();
    for (const [pid, kind, px, py, age] of cur.prizes) {
      if (this.grabbed.has(pid)) continue;
      live.add(pid);
      let pv = this.prizeViews.get(pid);
      if (!pv) {
        // the same soft pulsing glow the nuggies have in the levels, in the bonus's colour
        const glow = this.add
          .image(px, py, 'glow')
          .setTint(Phaser.Display.Color.HexStringToColor(PRIZE_COLOR[kind].mid).color)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.6)
          .setDepth(DEPTH.pickups - 1)
          .setScale(1.5);
        const landY = landingY(this.map, px);
        const shadow = softEllipse(this, px, landY, 30, 7, 0x2b1a12, 0.3).setDepth(DEPTH.pickups - 0.2);
        const chute = this.add.image(px, py, `prize-chute-${kind}`).setScale(PRIZE_SCALE / ART_RES).setOrigin(0.5, 1).setDepth(DEPTH.pickups);
        const img = this.add.image(px, py, `prize-${kind}`).setScale(PRIZE_SCALE / ART_RES).setOrigin(0.5, 1).setDepth(DEPTH.pickups + 0.1);
        pv = { img, chute, glow, shadow, landY, lastY: py, falling: age < 0 ? 1 : 0, land: 0 };
        this.prizeViews.set(pid, pv);
      }
      // (the server says age -1 while it's still falling)
      const falling = age < 0;
      if (!falling && pv.falling > 0.9) {
        pv.land = 0.42;
        this.fx.dust(px, py, 5);
        this.fx.sparkle(px, py - 16, 5);
      }
      pv.falling += ((falling ? 1 : 0) - pv.falling) * Math.min(1, dt * 7);
      pv.lastY = py;
      pv.land = Math.max(0, pv.land - dt);
      const t = this.time.now / 1000 + pid;
      // under the chute it swings like a pendulum, drifting a little side to side
      const swing = Math.sin(t * 2.3) * pv.falling;
      const sway = swing * 0.2;
      const drift = Math.sin(t * 1.15) * 5 * pv.falling;
      // landed: a squash on touchdown, then a gentle bob
      const lk = pv.land / 0.42;
      const squash = Math.sin(lk * Math.PI) * 0.22 * lk;
      const bob = falling ? 0 : -3 - Math.abs(Math.sin(t * 2.6)) * 4 * (1 - lk);
      const k = PRIZE_SCALE / ART_RES;
      const ix = px + drift;
      const iy = py + bob;
      pv.img.setPosition(ix, iy).setRotation(sway).setScale(k * (1 + squash), k * (1 - squash));
      // the chute hangs from the bonus; it sags and folds away as it lands
      pv.chute
        .setPosition(ix - Math.sin(sway) * 26 * PRIZE_SCALE, iy - 26 * PRIZE_SCALE + (1 - pv.falling) * 10)
        .setRotation(sway * 1.25)
        .setScale(k * (0.6 + pv.falling * 0.4), k * pv.falling)
        .setAlpha(pv.falling)
        .setVisible(pv.falling > 0.05);
      pv.glow.setPosition(ix, iy - 15 * PRIZE_SCALE).setScale(1.45 + Math.sin(t * 4) * 0.15).setAlpha(0.6);
      // the shadow on the ground tightens and darkens as it gets near
      const near = Math.max(0, Math.min(1, 1 - (pv.landY - py) / 420));
      // (its outline worked out again only when its size changes: a landed one's stays put)
      const sw = 16 + near * 20 - (falling ? 0 : 4);
      const sh = 5 + near * 3;
      if (pv.shadow.width !== sw || pv.shadow.height !== sh) pv.shadow.clear().fillEllipse(0, 0, sw, sh).setSize(sw, sh);
      pv.shadow.setPosition(ix, pv.landY + 1).setAlpha(0.12 + near * 0.22);
      const blink = age > PRIZE_LIFE - 2 && Math.floor(this.time.now / (age > PRIZE_LIFE - 0.8 ? 70 : 130)) % 2 === 0;
      pv.img.setVisible(!blink);
      pv.glow.setVisible(!blink);
    }
    for (const [pid, pv] of this.prizeViews)
      if (!live.has(pid)) {
        pv.img.destroy();
        pv.chute.destroy();
        pv.glow.destroy();
        pv.shadow.destroy();
        this.prizeViews.delete(pid);
      }
    // scenery + HUD (the looks drift slowly, like in the levels)
    themeClock.t += dt;
    const look = themeMix(themeClock.t, BATTLE_LOOKS);
    this.bg.setTheme(look);
    this.level.setTint(mixTint(look));
    this.followCamera(dt, cur.players);
    this.placeArrows(cur.players);
    const cam = this.cameras.main;
    const wv = cam.worldView;
    this.bg.update({ left: wv.x - 40, top: wv.y - 40, width: wv.width + 80, height: wv.height + 80 }, dt);
    this.level.animate(this.time.now / 1000, wv.x, wv.right);
    // the last 10 seconds: the arena starts to shake, harder and harder
    if (!this.spectate && cur.timeLeft > 0 && cur.timeLeft <= 10) {
      const k = 1 - cur.timeLeft / 10;
      this.cameras.main.shake(120, 0.0005 + k * k * 0.0055, true);
    }
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.2;
      const hud: BattleHud = {
        timeLeft: cur.timeLeft,
        bombs: this.me?.bombs ?? 0,
        players: [...cur.players.values()].map((p) => ({ id: p.id, kos: p.kos, hp: p.id === this.net.myId && this.me ? this.me.hp : p.hp, slot: p.slot, down: p.respawn > 0 })),
      };
      this.game.events.emit('battle-hud', hud);
    }
  }

  /** The bad guys: walking (or floating down under a parachute), some carrying a blaster. */
  private renderEnemies(list: SnapEnemy[], dt: number) {
    const seen = new Set<number>();
    for (const [id, kind, x, y, dir, flags, race, weapon, ang] of list) {
      seen.add(id);
      const plop = race === 1;
      const [w, h] = ENEMY_BOX[kind];
      let v = this.enemyViews.get(id);
      if (!v) {
        let spr: Phaser.GameObjects.Sprite;
        if (plop) {
          const pa = PLOP_ART[kind];
          spr = this.add.sprite(x, y, `bplop-${pa.kind}`, 'idle').setOrigin((50 + PLOP_PAD) / (PLOP_W + PLOP_PAD * 2), (100 + PLOP_TOP) / (PLOP_H + PLOP_TOP)).setScale(pa.scale / PLOP_RES[pa.kind]).setDepth(DEPTH.enemies);
        } else {
          const art = ENEMY_ART[kind];
          spr = this.add.sprite(x, y, art.tex, 'w0').setOrigin(art.ox, art.oy).setScale(art.scale).setDepth(DEPTH.enemies);
        }
        const chute = this.add.image(x, y, 'chute').setOrigin(0.5, 1).setScale(1 / ART_RES).setDepth(DEPTH.enemies - 0.1);
        v = { spr, plop, weapon: 0, gun: null, saw: null, ball: null, chain: null, chute, anim: Math.random() * 4, lastX: x, air: false, land: 0 };
        this.enemyViews.set(id, v);
      }
      // what it carries (a chainsaw one throws it away when it's hurt)
      if (v.weapon !== weapon) {
        v.gun?.destroy();
        v.saw?.destroy();
        v.ball?.destroy();
        v.chain?.destroy();
        v.gun = v.saw = v.ball = v.chain = null;
        const k = kind === 'small' ? 0.55 : 0.8;
        if (weapon === 1) v.gun = this.add.image(x, y, 'w-blaster').setScale(k / W_RES).setDepth(DEPTH.enemies + 0.1);
        if (weapon === 2) v.saw = this.add.sprite(x, y, 'w-saw', 's0').setScale(k / W_RES).setDepth(DEPTH.enemies + 0.1);
        if (weapon === 3) {
          v.chain = softShapes(this).setDepth(DEPTH.enemies + 0.05);
          v.ball = this.add.image(x, y, 'w-ball', 'open').setScale(0.85 / W_RES).setDepth(DEPTH.enemies + 0.15);
        }
        v.weapon = weapon;
      }
      const onGround = (flags & 1) !== 0;
      const chute = (flags & 4) !== 0;
      const moving = Math.abs(x - v.lastX) > 0.2;
      v.lastX = x;
      v.anim += dt * (moving ? (plop ? PLOP_STEP_FPS[kind] : 7) : 2);
      let frame: string;
      // each size of Plop has its own walk on top of the four-step walk: the small ones hop
      // along, the middle ones waddle, the big ones stomp (squashing down on every step,
      // kicking up dust); standing still, they shout; landing from a jump, they squash
      const ox = 0;
      let oy = 0;
      let rot = 0;
      let sx = 1;
      let sy = 1;
      // landing from a jump: the big ones shake the ground (as the giants do in the levels)
      const landed = onGround && v.air;
      v.air = !onGround && !chute;
      if (landed && kind === 'big') this.groundShake(x, y, 0.75);
      if (v.plop) {
        if (landed) {
          v.land = 0.22;
          if (kind === 'medium') this.fx.dust(x, y, 3);
        }
        v.land = Math.max(0, v.land - dt);
        const ph = (v.anim * Math.PI) / 2; // a quarter turn per step
        if (!onGround && !chute) {
          frame = 'walk3';
          sy = 1.06;
          sx = 0.95;
        } else if (moving && onGround) {
          frame = `walk${Math.floor(v.anim) % 4}`;
          const contact = Math.abs(Math.cos(ph)); // 1 when a foot hits the ground
          if (kind === 'small') {
            oy = -Math.abs(Math.sin(ph)) * 6;
            sy = 1 + (1 - contact) * 0.07 - contact * 0.05;
            sx = 2 - sy;
            rot = dir * 0.08;
          } else if (kind === 'medium') {
            rot = Math.sin(ph) * 0.11 + dir * 0.05;
            oy = -Math.abs(Math.sin(ph)) * 1.5;
          } else {
            sy = 1 - contact * contact * 0.07;
            sx = 1 + contact * contact * 0.06;
            rot = Math.sin(ph) * 0.04 + dir * 0.03;
            const step = Math.floor(v.anim) % 2 === 0 && v.anim % 1 < 0.2;
            if (step && Math.random() < 0.35) this.fx.dust(x + (Math.random() - 0.5) * w, y, 2);
          }
        } else if (onGround && !chute) {
          // standing about: breathing, blinking, a glance, a grin — and now and then a yell
          frame = this.plopStanding(v as unknown as PlopMood, v.anim);
          sy = 1 + Math.sin(this.time.now / 300 + id) * 0.025; // breathing
        } else frame = 'idle';
        if (v.land > 0) {
          const q = Math.sin((v.land / 0.22) * Math.PI) * (kind === 'big' ? 0.16 : 0.12);
          sy *= 1 - q;
          sx *= 1 + q;
        }
        const base = PLOP_ART[kind].scale / PLOP_RES[PLOP_ART[kind].kind];
        v.spr.setScale(base * sx, base * sy).setRotation(rot);
      } else frame = kind === 'big' && !onGround && !chute ? 'air' : Math.floor(v.anim) % 2 ? 'w1' : 'w0';
      // just hit: a Plop squeezes its eyes shut ("ow!") for a moment
      if (v.plop) {
        const m = v as unknown as PlopMood;
        if (flags & 8) m.hurtAt = this.time.now;
        if (this.time.now - (m.hurtAt ?? -1e9) < 320) frame = 'hurt';
      }
      // (the Plops' art faces left, like the Puff Balls')
      v.spr.setFrame(frame).setPosition(x + ox, y + 2 + oy).setFlipX(dir > 0);
      if (flags & 8) v.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else v.spr.clearTint();
      v.chute.setVisible(chute).setPosition(x, y - h + 4).setRotation(Math.sin(this.time.now / 400 + id) * 0.12);
      // the front hand: a Plop's is the tip of its arm; a Puff Ball's as in the levels
      let handX: number;
      let handY: number;
      if (v.plop) {
        const k = PLOP_ART[kind].scale;
        handX = x + ox + dir * 46 * k * sx;
        handY = y + 2 + oy - 46 * k * sy;
      } else {
        handX = x + dir * (kind === 'small' ? 17 : 31);
        handY = y - (kind === 'small' ? 17 : 39);
      }
      // weapons held by their grip (the art faces left; flipped when facing right)
      if (v.gun) {
        const gx = BLASTER.gx / BLASTER.w;
        v.gun.setOrigin(dir < 0 ? gx : 1 - gx, BLASTER.gy / BLASTER.h).setPosition(handX, handY).setFlipX(dir > 0);
      }
      if (v.saw) {
        const gx = SAW.gx / SAW.w;
        v.saw
          .setOrigin(dir < 0 ? gx : 1 - gx, SAW.gy / SAW.h)
          .setPosition(handX, handY)
          .setFlipX(dir > 0)
          .setFrame(Math.floor(this.time.now / (moving ? 35 : 80)) % 2 ? 's0' : 's1');
      }
      if (v.ball && v.chain) {
        // the ball swings round on its chain (the same swing the server uses for hits)
        const R = kind === 'small' ? 34 : 46;
        const cy = y - h * 0.55;
        const bx = x + Math.cos(ang) * R;
        const by = cy + Math.sin(ang) * R * 0.8;
        v.chain.clear();
        v.chain.lineStyle(2.4, 0x3a2418, 1);
        // the chain runs from the hand to the ball (its links only while it's anywhere near the view:
        // a shape is drawn every frame wherever it is, and its little rings cost the most off screen)
        const wv = this.cameras.main.worldView;
        if (bx > wv.x - 400 && bx < wv.right + 400 && by > wv.y - 400 && by < wv.bottom + 400)
          for (let i = 1; i <= 6; i++) {
            const t = i / 7;
            v.chain.strokeCircle(handX + (bx - handX) * t, handY + (by - handY) * t, 1.6);
          }
        v.ball.setPosition(bx, by).setFrame(Math.floor(this.time.now / 160) % 2 ? 'open' : 'shut').setFlipX(bx > x);
      }
    }
    for (const [id, v] of this.enemyViews)
      if (!seen.has(id)) {
        v.spr.destroy();
        v.gun?.destroy();
        v.saw?.destroy();
        v.ball?.destroy();
        v.chain?.destroy();
        v.chute.destroy();
        this.enemyViews.delete(id);
      }
  }

  /** Rocks and anvils: a growing shadow where it'll land, then down it comes. */
  private renderHazards(list: SnapHazard[]) {
    const seen = new Set<number>();
    for (const [id, kind, x, y, warn, flags] of list) {
      seen.add(id);
      const big = (flags & 1) !== 0;
      const rolling = (flags & 2) !== 0;
      let v = this.hazardViews.get(id);
      if (!v) {
        // where it lands: the ramp, or the first ground or cloud below the sky
        const landY = landingY(this.map, x);
        const shadow = softEllipse(this, x, landY, 40 * (big ? HAZARD_BIG : 1), 10, 0x2b1a12, 0.35).setDepth(DEPTH.pickups - 0.2);
        const img = this.add.image(x, y, kind === 'anvil' ? 'banvil' : 'brock').setOrigin(0.5, kind === 'rock' ? 0.5 : 1).setScale((HAZARD_SCALE * (big ? HAZARD_BIG : 1)) / ART_RES).setDepth(DEPTH.projectiles + 0.5);
        v = { img, shadow, landY };
        this.hazardViews.set(id, v);
        sfx.whoosh();
      }
      // the shadow darkens and tightens as it gets closer
      const near = warn > 0 ? 1 - Math.min(1, warn / 1.1) : 1 - Math.min(1, (v.landY - y) / 500);
      v.shadow.setAlpha(0.15 + 0.35 * near).setScale(1.4 - 0.5 * near, 1);
      // (rocks are drawn round their middle so they can spin; rolling down the ramp they turn with the slope)
      const half = kind === 'rock' ? (21 * HAZARD_SCALE * (big ? HAZARD_BIG : 1)) / 1 : 0;
      v.img.setVisible(warn <= 0).setPosition(x, y - half * 0.92).setRotation(kind === 'rock' ? (rolling ? x * 0.045 : y * 0.02) : 0);
      v.shadow.setVisible(!rolling);
      if (rolling && Math.random() < 0.35) this.fx.dust(x, y, 1);
      if (warn > 0 && Math.floor(this.time.now / 140) % 2) v.shadow.setAlpha(0.6);
    }
    for (const [id, v] of this.hazardViews)
      if (!seen.has(id)) {
        v.img.destroy();
        v.shadow.destroy();
        this.hazardViews.delete(id);
      }
  }

  /**
   * The off-screen pointer's badge in a player's colour, as a picture (made once per colour, at
   * ARROW_RES): drawn as shapes, each one showing was cut into triangles all over again every frame.
   */
  private arrowTex(col: string) {
    const key = `barrow-${col}`;
    if (this.textures.exists(key)) return key;
    const B = ARROW_BOX;
    const cv = document.createElement('canvas');
    cv.width = B.w * ARROW_RES;
    cv.height = B.h * ARROW_RES;
    const ctx = cv.getContext('2d')!;
    ctx.scale(ARROW_RES, ARROW_RES);
    ctx.translate(B.x, B.y);
    const shape = (fill: string, r: number, tri: [number, number, number] | null) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      if (!tri) return;
      const [x0, h, x1] = tri;
      ctx.beginPath();
      ctx.moveTo(x0, -h);
      ctx.lineTo(x0, h);
      ctx.lineTo(x1, 0);
      ctx.closePath();
      ctx.fill();
    };
    // (the same shapes as always: a white edge round a dark outline round their colour, so it stands
    // out on any background, and a little shine)
    shape('#ffffff', 14, [9, 12.5, 26.5]);
    shape('#3a2418', 12, [8.5, 10, 23]);
    shape(col, 9.5, [7.5, 7.5, 19]);
    ctx.translate(-3, -3.5);
    shape('rgba(255,255,255,0.55)', 3.2, null);
    addCanvas(this, key, cv);
    return key;
  }

  /** The picture of a hero's hearts with `hp` of them full (made once per count, at HEART_RES). */
  private heartsTex(hp: number) {
    const n = Math.max(0, Math.min(HEARTS, hp));
    const key = `bhearts${n}`;
    if (this.textures.exists(key)) return key;
    const w = 9;
    const W = HEARTS * w + 8;
    const H = 14;
    const cv = document.createElement('canvas');
    cv.width = W * HEART_RES;
    cv.height = H * HEART_RES;
    const ctx = cv.getContext('2d')!;
    ctx.scale(HEART_RES, HEART_RES);
    const y = 6;
    const x0 = W / 2 - (HEARTS * w) / 2 + w / 2;
    // (the same shapes the hearts always had: two round lobes and a point, an outline under the colour)
    const heart = (cx: number, dx: number, r: number, t: number, lift: number, tip: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx - dx, y - 1, r, 0, Math.PI * 2);
      ctx.moveTo(cx + dx + r, y - 1);
      ctx.arc(cx + dx, y - 1, r, 0, Math.PI * 2);
      ctx.moveTo(cx - t, y - lift);
      ctx.lineTo(cx + t, y - lift);
      ctx.lineTo(cx, y + tip);
      ctx.closePath();
      ctx.fill();
    };
    for (let i = 0; i < HEARTS; i++) {
      const cx = x0 + i * w;
      heart(cx, 1.8, 3.4, 5, 0, 5.4, 'rgba(43,26,18,0.85)');
      heart(cx, 1.7, 2.3, 3.8, 0.4, 3.8, i < n ? '#ff5d7a' : '#6b5a5a');
    }
    addCanvas(this, key, cv);
    return key;
  }

  /** A prize grabbed: it flies into the grabber, who hops; its name pops up. (pid: which one, if known) */
  private prizeFx(x: number, y: number, kind: PrizeKind, v: HeroView | undefined, pid?: number) {
    const [text, col] = PRIZE_TEXT[kind];
    this.collectPrize(x, y, kind, v, pid);
    if (v) {
      v.cheer = 0;
      // a little burst of stars round whoever grabbed it
      this.fx.stars(v.sprite.x, v.sprite.y - 24 * v.size, 10);
      this.fx.sparkle(v.sprite.x, v.sprite.y - 30 * v.size, 10);
    }
    this.fx.popText(x, y - 40, text, col, 18);
    this.fx.sparkle(x, y - 14, 12);
    if (v && kind === 'grow') this.cameras.main.shake(180, 0.006);
    (kind === 'heart' ? sfx.rootbeer : sfx.aura)();
  }

  private jumpFx(x: number, y: number, air: boolean, mine: boolean) {
    if (air) this.fx.airPuff(x, y);
    else this.fx.dust(x, y, 5);
    if (mine) (air ? sfx.jump2 : sfx.jump)();
  }

  /** Sounds and effects for what just happened in the match. */
  private playEvents(events: BEvent[]) {
    const myId = this.net.myId;
    for (const e of events) {
      switch (e.k) {
        case 'jump':
          if (e.id !== myId) {
            const v = this.views.get(e.id);
            if (v) this.jumpFx(v.sprite.x, v.sprite.y - 2, e.air, false);
          }
          break;
        case 'fire':
          if (e.id !== myId) {
            sfx.shoot();
            this.fx.muzzle(e.x, e.y, e.dir, e.x - e.dir * 30);
          }
          break;
        case 'boom': {
          // (one of my shots I've already seen blow up here: not twice)
          const i = this.myBooms.findIndex((b) => Math.abs(b.x - e.x) < 48 && Math.abs(b.y - e.y) < 48);
          if (i >= 0) this.myBooms.splice(i, 1);
          else this.boomFx(e.x, e.y, e.r);
          break;
        }
        case 'hit': {
          const v = this.views.get(e.id);
          if (v) {
            v.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
            this.time.delayedCall(90, () => v.sprite.active && v.sprite.clearTint());
            this.fx.stars(v.sprite.x, v.sprite.y - 30, 5);
          }
          if (e.id === myId) {
            sfx.hurt();
            this.cameras.main.shake(160, 0.008);
          }
          break;
        }
        case 'ko': {
          const v = this.views.get(e.id);
          const by = e.by ? this.views.get(e.by) : null;
          if (v) {
            this.fx.explosion(v.sprite.x, v.sprite.y - 20, 70);
            this.fx.stars(v.sprite.x, v.sprite.y - 30, 14);
            const col = by ? SLOT_COLORS[by.slot % SLOT_COLORS.length] : '#ffffff';
            this.fx.popText(v.sprite.x, v.sprite.y - 70, 'KO!', col, 30);
            // knocked out by a bad guy or the sky (not a friend): that cost them a point
            if (!by && !e.gift) this.fx.popText(v.sprite.x, v.sprite.y - 104, '−1', '#ff8a80', 22);
          }
          // (…and with no points to lose, everyone else got one)
          if (!by && e.gift)
            for (const [id, o] of this.views)
              if (id !== e.id && o.sprite.visible) this.fx.popText(o.sprite.x, o.sprite.y - 70, '+1', SLOT_COLORS[o.slot % SLOT_COLORS.length], 24);
          sfx.die();
          if (e.by === myId) sfx.cheer();
          break;
        }
        case 'chair': {
          // (everyone's chair-carrying frames, ready before anyone can grab it)
          for (const v of this.views.values()) this.carryTextureFor(v.hero, v.slot);
          // a folding chair's coming in from the crowd: CHAIR!
          this.fx.popText(e.x, 70, 'CHAIR!', '#e2e7ec', 26);
          sfx.whoosh();
          break;
        }
        case 'chairland':
          sfx.clank();
          this.fx.dust(e.x, e.y, 6);
          break;
        case 'chairgrab': {
          const v = this.views.get(e.id);
          if (v) this.fx.popText(v.sprite.x, v.sprite.y - 60 * v.size, 'CHAIR!', '#e2e7ec', 18);
          sfx.clank();
          break;
        }
        case 'chairswing':
          sfx.whoosh();
          break;
        case 'chairhit':
          sfx.clank();
          sfx.thud();
          this.fx.stars(e.x, e.y, 6);
          this.fx.popText(e.x, e.y - 30, e.broke ? 'CRUNCH!' : 'WHACK!', '#ffd23f', 20);
          this.cameras.main.shake(120, 0.006);
          break;
        case 'drop': {
          // a prize is coming: a "!" where it'll come down
          this.fx.popText(e.x, 70, '!', '#ffd23f', 34);
          sfx.whoosh();
          break;
        }
        case 'prize': {
          // (one I grabbed on my screen already: it's all been shown)
          if (e.id === myId) {
            const mine = [...this.myGrabs].find(([, g]) => g.kind === e.kind && Math.abs(g.x - e.x) < 48);
            if (mine) {
              this.myGrabs.delete(mine[0]);
              break;
            }
          }
          this.prizeFx(e.x, e.y, e.kind, this.views.get(e.id));
          break;
        }
        case 'bounce':
          sfx.bump();
          this.fx.dust(e.x, e.y + 7, 3);
          break;
        case 'espawn':
          sfx.whoosh();
          if (!e.chute) this.fx.dust(e.x, (this.map.h - 3) * 32, 8);
          break;
        case 'ehit':
          sfx.bump();
          break;
        case 'edie':
          this.fx.explosion(e.x, e.y, e.kind === 'big' ? 110 : 60);
          this.fx.stars(e.x, e.y - 10, e.kind === 'big' ? 18 : 8);
          sfx.pop();
          if (e.kind === 'big') this.cameras.main.shake(260, 0.01);
          break;
        case 'eshot':
          sfx.pew();
          this.fx.muzzle(e.x, e.y, e.dir, e.x - e.dir * 10);
          break;
        case 'crash': {
          const k = e.big ? 1.7 : 1;
          this.fx.dust(e.x, e.y, Math.round((e.kind === 'anvil' ? 16 : 10) * k));
          if (!e.roll) this.fx.debris(e.x, e.y - 8);
          if (e.big && !e.roll) this.fx.debris(e.x + 14, e.y - 12);
          (e.kind === 'anvil' || e.big ? sfx.thud : sfx.stomp)();
          // the ground shakes, like a giant landing in the levels
          if (!e.roll) this.groundShake(e.x, e.y, (e.kind === 'anvil' ? 1 : 0.8) * k);
          break;
        }
        case 'throw':
          sfx.whoosh();
          if (e.kind === 'saw') sfx.saw();
          break;
        case 'stomp': {
          sfx.stomp();
          this.fx.stars(e.x, e.y, 7);
          this.fx.popText(e.x, e.y - 18, 'STOMP!', '#ffffff', 18);
          if (e.id === myId) this.cameras.main.shake(90, 0.004);
          break;
        }
        case 'freeze': {
          // everyone but the grabber turns to ice
          sfx.clank();
          this.cameras.main.flash(220, 190, 235, 255);
          for (const [id, v] of this.views)
            if (id !== e.by) {
              this.fx.sparkle(v.sprite.x, v.sprite.y - 24, 10);
              this.fx.popText(v.sprite.x, v.sprite.y - 64, 'FROZEN!', '#9fe6ff', 16);
            }
          break;
        }
        case 'spawn': {
          const v = this.views.get(e.id);
          if (v) this.fx.fluffBurst(v.sprite.x, v.sprite.y - 20, 1);
          sfx.pop();
          break;
        }
      }
    }
  }
}

