import Phaser from 'phaser';
import { DEPTH, GRAVITY, MIN_VIEW_W, VIEW_H } from '../config';
import { characterById } from '../data/characters';
import type { Session } from '../core/session';
import { fadeOutMusic, playHoops } from '../core/music';
import { sfx } from '../core/sfx';
import { loseLife, lives } from '../core/lives';
import { bank } from '../core/bank';
import { ART_RES, CARRY_SWING, CHAR_H, CHAR_W, canvas, carryHand } from '../gfx/draw';
import { ARENA_H, ARENA_W, CROWD_H, FRONT_H, JUMBO, RIBBON, STAGE_OX, STAGE_OY, drawArena, drawArenaFront, drawCrowd, drawCameraFlash, drawRibbonScreen, drawSpotlight, setArenaStyle, type JumboContent } from '../gfx/hoops';
import { PLOP_FRAMES, PLOP_H, PLOP_W, QUEEN_KO_FRAMES, QUEEN_KO_GROUND, QUEEN_KO_H, QUEEN_KO_W, drawPlop, drawQueen, drawQueenKO, type PlopFrame } from '../gfx/plops';
import { POOWAVE_H, POOWAVE_W, drawPooWave } from '../gfx/plopworld';
import { drawPoo } from '../gfx/hazards';
import { drawPrize } from '../gfx/prizes';
import { STYLES } from '../gfx/handdrawn';
import { CHAIR_H, CHAIR_W, KING_SEAT, POO_PALACE, drawFoldingChair, POST_BOX, PUDDLE, RING, RING_BOX, ROPE_COL, TUNNEL, backX, drawArenaPoo, drawFrontPost, drawRing, drawRingFloor, drawRingside, drawTunnel, drawWrestleJumbo } from '../gfx/wrestle';
import { HERO_SHEET_M, addCanvas, hires, makeCarrySheet } from '../gfx/textures';
import { Player } from '../entities/Player';
import { Rocket } from '../entities/Rocket';
import { Fx } from '../world/Fx';
import { stingerReveal } from '../ui/stinger';
import { SimpleConfetti } from '../world/SimpleConfetti';
import { soloSource, sourceById } from '../input/devices';
import type { GameOverState, HudState, ResultState } from './GameScene';

/**
 * Part 3's boss: Queen Plop, in a wrestling ring in the Poo Palace (see sketches/wrestling/DESIGN.md).
 *
 * The fight is the platformer's own: the same hero, controls, jumps and bazooka (two rockets = a hit),
 * side-on across the mat. The ropes at either end are springy (run into them and you're flung
 * back), and you can climb them to the top turnbuckle and dive off (land on her: two hits); there's
 * no leaving the ring. You have 5 hearts (shown over your head; more turn up in the ring, up to 6), there's
 * a folding chair now and then (FIRE swings it while you hold it: two hits), and she takes 12 hits, counted down on
 * the jumbotron.
 */
export interface WrestleData {
  session: Session;
  charId: string;
  checkpoint: number;
  level?: number;
  result: ResultState;
}

/** The arena art is drawn in "stage" units; the world is this much smaller (heroes keep their usual size). */
const K = 0.62;
const WX = (sx: number) => (sx + STAGE_OX) * K;
const WY = (sy: number) => (sy + STAGE_OY) * K;
const WORLD_W = ARENA_W * K;
const WORLD_H = ARENA_H * K;
const ARENA_RES = 1.25;

const MAT_Y = WY(RING.floorY);
const GROUND_Y = WY(RING.groundY);
/** Where the side ropes are across the line you fight on (they run from the back post to the front one). */
const FIGHT_T = (RING.floorY - RING.backY) / (RING.frontY - RING.backY);
const sideX = (x: number) => WX(backX(x) + (x - backX(x)) * FIGHT_T);
const ROPE_L = sideX(RING.x0);
const ROPE_R = sideX(RING.x1);
/** The top rope's height over the mat (world px): below it the ropes stop you; above it you go over. */
const ROPE_TOP = RING.ropes[2] * K;
const POST_L = WX(RING.x0);
const POST_R = WX(RING.x1);
/** The top of the front corner posts (you can stand on them). */
const POST_TOP = WY(RING.frontY - RING.post);

/** Queen Plop: art units → world, and her texture's resolution. */
const QS = 1.3;
const Q_RES = 4;
const Q_PAD = 18;
const Q_TOP = 24;
const HITS = 12;
/** How tough she is overall: faster and quicker to attack again (1 = as in v0.160; v0.164-0.178 had her 5% harder). */
const Q_TOUGH = 1;
/** Your hearts in the ring: you start with all 6, and pick-ups top you back up. */
const HEARTS_START = 6;
const HEARTS_MAX = 6;
/** Folding chairs in a match, and (for each one after the first) how few hits she has left when it comes, at the latest. */
const CHAIRS = 3;
const CHAIR_AT_HP = [-1, 8, 4];
/** The poo puddle on the mat (world x): you sink into it, like the level's. */
const PUD_X0 = WX(PUDDLE.x - PUDDLE.w * 0.78);
const PUD_X1 = WX(PUDDLE.x + PUDDLE.w * 0.78);

const RES = 2;
type Side = -1 | 1;

const DEPTH_W = {
  arena: 0,
  crowd: 1,
  king: 1.5,
  front: 2,
  screens: 2.05,
  ring: 3,
  ringside: 4,
  backRopes: 5,
  shadows: 6,
  queen: 15,
  frontRopes: DEPTH.players + 1,
  posts: DEPTH.players + 1.5,
  dark: DEPTH.players + 3,
  spot: DEPTH.players + 3.5,
};

interface Wave {
  img: Phaser.GameObjects.Image;
  dir: number;
  life: number;
  t: number;
  speed: number;
}
interface Lob {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  /** a big one (rolls on along the mat this way when it lands) */
  big?: Side;
}

class Queen {
  readonly spr: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly shadow: Phaser.GameObjects.Image;
  hp = HITS;
  mode: 'intro' | 'idle' | 'walk' | 'windup' | 'charge' | 'slam' | 'heave' | 'retreat' | 'hurt' | 'taunt' | 'down' = 'intro';
  t = 0;
  dir: Side = -1;
  facing: Side = -1;
  cdCharge = 2.5;
  cdSlam = 4;
  cdLob = 1.6;
  hopIn = 0.8;
  invulnUntil = 0;
  anim = 0;
  frame: PlopFrame = 'idle';
  airborne = false;
  chargeV = 0;
  moodNext = 1.5;
  cdBlock = 0;
  /** Knocked out (the ending has her: her own update leaves her be). */
  ko = false;
  cdHeave = 5;
  fallVy = 0;
  counterNext = false;

  constructor(private s: WrestleScene, x: number, bottom: number) {
    this.spr = s.physics.add.sprite(x, bottom, 'wr-queen', 'idle').setDepth(DEPTH_W.queen);
    const fw = PLOP_W + Q_PAD * 2;
    const fh = PLOP_H + Q_TOP;
    this.spr.setOrigin((50 + Q_PAD) / fw, (100 + Q_TOP) / fh).setScale(QS / Q_RES);
    this.body = this.spr.body as Phaser.Physics.Arcade.Body;
    // (a body a bit smaller than the picture: her arms and swirl don't count)
    this.body.setSize(60 * Q_RES, 66 * Q_RES).setOffset((50 + Q_PAD - 30) * Q_RES, (100 + Q_TOP - 66) * Q_RES);
    this.body.setMaxVelocityY(900);
    this.shadow = s.add.image(x, bottom, 'softshadow').setDepth(DEPTH_W.shadows).setDisplaySize(96, 16).setAlpha(0.45);
  }

  get x() {
    return this.body.center.x;
  }
  get bottom() {
    return this.body.bottom;
  }
  get top() {
    return this.body.top;
  }
  get onGround() {
    return this.body.blocked.down || this.body.touching.down;
  }
  get dangerous() {
    return this.mode !== 'hurt' && this.mode !== 'down' && this.mode !== 'intro';
  }
  /** Tougher as she gets hurt. */
  get rage() {
    return (1 + ((HITS - this.hp) / HITS) * 0.8) * Q_TOUGH;
  }

  setMode(m: Queen['mode'], t = 0) {
    this.mode = m;
    this.t = t;
  }

  update(dt: number) {
    if (this.ko) return;
    const s = this.s;
    const b = this.body;
    const p = s.player;
    this.t -= dt;
    this.cdCharge -= dt;
    this.cdSlam -= dt;
    this.cdLob -= dt;
    this.cdBlock -= dt;
    this.cdHeave -= dt;
    const dx = p.x - this.x;
    const towards: Side = dx < 0 ? -1 : 1;
    const ground = this.onGround;
    const speed = 100 * this.rage;
    let frame: PlopFrame | null = null;

    switch (this.mode) {
      case 'intro':
      case 'down':
        b.setVelocityX(0);
        break;
      case 'hurt':
        if (ground) b.setVelocityX(b.velocity.x * 0.86);
        frame = 'hurt';
        if (this.t <= 0) {
          // she hits back: often straight into a charge
          if (this.counterNext && Math.abs(dx) < 360) {
            this.counterNext = false;
            this.dir = towards;
            this.setMode('windup', 0.32 / this.rage);
            s.fx.popText(this.x, this.top - 14, 'GRRR!', '#ff8a80', 20);
            sfx.roar();
          } else this.setMode('idle', 0.15);
        }
        break;
      case 'idle':
        b.setVelocityX(0);
        this.facing = towards;
        if (this.t <= 0) this.setMode('walk');
        break;
      case 'walk': {
        if (s.heroOnRopes()) {
          this.setMode('retreat');
          break;
        }
        if (!s.heroInRing()) {
          this.setMode('taunt', 0.3);
          break;
        }
        this.facing = towards;
        const close = Math.abs(dx) < 70;
        if (ground) b.setVelocityX(close ? towards * speed * 0.5 : towards * speed);
        // she can't keep still: hop, hop, hop as she comes at you (and now and then a big lunge)
        this.hopIn -= dt;
        // you jumping on her? she jumps up to meet you
        const above = p.alive && p.body.velocity.y > 60 && p.bottom < this.top + 6 && Math.abs(dx) < 90 && !s.heroDiving();
        if (ground && above && this.cdBlock <= 0) {
          b.setVelocity(towards * speed * 0.6, -640);
          this.cdBlock = (2.1 + Math.random()) / Q_TOUGH;
          this.hopIn = 0.45;
        } else if (ground && this.hopIn <= 0) {
          const lunge = Math.abs(dx) < 260 && Math.random() < 0.25;
          const big = !lunge && Math.random() < 0.3;
          b.setVelocityY(lunge ? -600 - Math.random() * 80 : big ? -700 - Math.random() * 60 : -430 - Math.random() * 170);
          if (lunge) b.setVelocityX(towards * speed * 2);
          this.hopIn = 0.4 + Math.random() * 0.52;
        }
        // from further off: a big lump of poo, hurled at you (where it lands, it rolls on at you)
        if (ground && this.cdHeave <= 0 && Math.abs(dx) > 150 && Math.abs(dx) < 520 && p.alive && Math.abs(p.bottom - MAT_Y) < 50) {
          this.dir = towards;
          this.facing = towards;
          this.setMode('heave', 0.45);
          s.fx.popText(this.x, this.top - 14, 'HNNG!', '#c99064', 20);
          sfx.roar();
          break;
        }
        if (ground && this.cdSlam <= 0 && Math.abs(dx) > 100 && Math.random() < 0.03) {
          this.slam(p.x);
          break;
        }
        if (ground && this.cdCharge <= 0 && Math.abs(dx) < 330 && Math.abs(p.bottom - this.bottom) < 40) {
          this.setMode('windup', 0.46 / this.rage);
          this.dir = towards;
          s.fx.popText(this.x, this.top - 14, '!', '#ffd23f', 26);
          sfx.roar();
        }
        break;
      }
      case 'windup':
        b.setVelocityX(0);
        this.facing = this.dir;
        frame = Math.floor(s.time.now / 90) % 2 ? 'yell0' : 'yell1';
        this.spr.setX(this.spr.x + Math.sin(s.time.now / 14) * 0.8);
        if (this.t <= 0) {
          this.setMode('charge', 1.1);
          this.chargeV = Math.min(470, 340 * this.rage);
          sfx.poopa(0.8);
        }
        break;
      case 'charge':
        this.facing = this.dir;
        b.setVelocityX(this.dir * this.chargeV);
        frame = Math.floor(s.time.now / 80) % 2 ? 'run0' : 'run1';
        if (ground && Math.random() < 0.3) s.fx.dust(this.x - this.dir * 20, this.bottom, 1);
        if (this.t <= 0) {
          this.cdCharge = (1.85 + Math.random() * 1.4) / Q_TOUGH;
          this.setMode('idle', 0.2);
        }
        break;
      case 'heave':
        b.setVelocityX(0);
        this.facing = this.dir;
        frame = 'yell1';
        this.spr.setX(this.spr.x + Math.sin(s.time.now / 12) * 0.7);
        if (this.t <= 0) {
          s.heaveAt(this, p.x);
          this.cdHeave = (5.4 + Math.random() * 2.6) / Q_TOUGH;
          this.setMode('idle', 0.25);
        }
        break;
      case 'slam':
        frame = b.velocity.y < 0 ? 'yell1' : 'yell0';
        if (ground && this.t <= 0.0 && this.airborne) {
          this.airborne = false;
          b.setVelocityX(0);
          s.slamLanded(this);
          this.cdSlam = 2.4 + Math.random() * 1.4;
          this.setMode('idle', 0.3);
        }
        if (!ground) this.airborne = true;
        break;
      case 'retreat': {
        // you're on the ropes: she backs off (the dive only lands if you jump quickly)
        const away = (p.x < WORLD_W / 2 ? 1 : -1) as Side;
        this.facing = (-away) as Side;
        frame = 'look';
        const room = away > 0 ? ROPE_R - 50 - this.x : this.x - (ROPE_L + 50);
        b.setVelocityX(room > 4 ? away * 100 * this.rage : 0);
        if (s.heroPerched() && this.cdLob <= 0) {
          // stay up there too long and she'll throw poo at you
          s.lobAt(this, p.x, p.bottom - 20);
          this.cdLob = 1.6;
        }
        if (!s.heroOnRopes() && !s.heroDiving()) this.setMode('idle', 0.2);
        break;
      }
      case 'taunt': {
        // you've left the ring: she waits at the ropes on your side, yelling, and throws poo
        const edge = p.x < WORLD_W / 2 ? ROPE_L + 46 : ROPE_R - 46;
        const d = edge - this.x;
        b.setVelocityX(Math.abs(d) > 6 ? Math.sign(d) * speed : 0);
        this.facing = towards;
        frame = Math.abs(d) > 6 ? null : Math.floor(s.time.now / 140) % 2 ? 'yell0' : 'grin';
        if (this.cdLob <= 0) {
          s.lobAt(this, p.x, p.bottom - 14);
          this.cdLob = 2;
        }
        if (s.heroInRing()) this.setMode('idle', 0.2);
        break;
      }
    }

    // a heavy landing rumbles the ring (like the Giant Plops)
    if (!ground) this.fallVy = Math.max(this.fallVy, b.velocity.y);
    else {
      if (this.fallVy > 300 && this.mode !== 'slam' && this.mode !== 'intro') s.queenLanded(this, this.fallVy);
      this.fallVy = 0;
    }

    // the ropes stop her too (and she bounces off them when she's charging)
    const hw = b.halfWidth;
    if (this.x + hw > ROPE_R + 4) {
      b.x = ROPE_R + 4 - b.width;
      s.ropeHit(1, this.mode === 'charge' ? 18 : 6);
      if (this.mode === 'charge') {
        this.dir = -1;
        this.chargeV *= 0.85;
        sfx.bump();
      } else b.setVelocityX(Math.min(0, b.velocity.x));
    } else if (this.x - hw < ROPE_L - 4) {
      b.x = ROPE_L - 4;
      s.ropeHit(-1, this.mode === 'charge' ? 18 : 6);
      if (this.mode === 'charge') {
        this.dir = 1;
        this.chargeV *= 0.85;
        sfx.bump();
      } else b.setVelocityX(Math.max(0, b.velocity.x));
    }
    // in the poo puddle she wades too
    if (Math.abs(this.x - WX(PUDDLE.x)) < PUDDLE.w * K && ground && this.mode !== 'charge') b.setVelocityX(b.velocity.x * 0.6);

    // pictures: walking, hopping, breathing; the odd blink, grin or glance when she's still
    if (!frame) {
      const moving = Math.abs(b.velocity.x) > 10;
      if (!ground) frame = b.velocity.y < 0 ? 'run1' : 'run0';
      else if (moving) {
        this.anim += dt * (6 + Math.abs(b.velocity.x) / 25);
        frame = (['walk0', 'walk1', 'walk2', 'walk3'] as const)[Math.floor(this.anim) % 4];
      } else {
        this.moodNext -= dt;
        if (this.moodNext <= 0) this.moodNext = 1.2 + Math.random() * 2;
        frame = this.moodNext < 0.15 ? 'blink' : this.moodNext > 2.6 ? 'grin' : Math.floor(s.time.now / 650) % 2 ? 'idle1' : 'idle';
      }
    }
    this.frame = frame;
    this.spr.setFrame(frame);
    this.spr.setFlipX(this.facing > 0);
    const inv = s.time.now < this.invulnUntil;
    this.spr.setTint(inv && Math.floor(s.time.now / 60) % 2 ? 0xffb0b0 : 0xffffff);
    this.shadow.setPosition(this.x, MAT_Y + 2).setVisible(this.bottom <= MAT_Y + 4).setAlpha(Phaser.Math.Clamp(0.5 - (MAT_Y - this.bottom) / 300, 0.15, 0.5));
  }

  slam(targetX: number) {
    const b = this.body;
    const tAir = 0.8;
    const vy = (GRAVITY * tAir) / 2;
    const x = Phaser.Math.Clamp(targetX, ROPE_L + 50, ROPE_R - 50);
    b.setVelocity(Phaser.Math.Clamp((x - this.x) / tAir, -420, 420), -vy);
    this.airborne = false;
    this.setMode('slam', 0.1);
    this.s.fx.popText(this.x, this.top - 14, 'HNNG!', '#ffd23f', 20);
    sfx.roar();
  }

  /** Hit! Returns whether it counted (she flashes for a moment after each one). */
  hit(n: number, fromX: number) {
    const now = this.s.time.now;
    if (now < this.invulnUntil || this.hp <= 0 || this.mode === 'intro' || this.mode === 'down') return false;
    this.hp = Math.max(0, this.hp - n);
    this.invulnUntil = now + 1100;
    if (this.hp > 0) {
      const away = Math.sign(this.x - fromX) || 1;
      this.body.setVelocity(away * 210, -260);
      this.setMode('hurt', 0.5);
      this.counterNext = Math.random() < 0.5;
    }
    return true;
  }
}

export class WrestleScene extends Phaser.Scene {
  fx!: Fx;
  player!: Player;
  queen!: Queen;
  private wd!: WrestleData;
  private statics!: Phaser.Physics.Arcade.StaticGroup;
  /** (Queen Plop stands on the whole mat: the puddle only swallows you) */
  private qStatics!: Phaser.Physics.Arcade.StaticGroup;
  private rockets: Rocket[] = [];
  private gRockets!: Phaser.Physics.Arcade.Group;
  private waves: Wave[] = [];
  private lobs: Lob[] = [];
  /** A heart to pick up in the ring (instead of nuggies), and when the next one comes. */
  private heartPick: { img: Phaser.GameObjects.Image; t: number; y: number } | null = null;
  private heartIn = 3;
  private heartsG!: Phaser.GameObjects.Graphics;
  /** The folding chair: falls into the ring now and then; pick it up and hit her with it (two hits). */
  private chair: {
    img: Phaser.GameObjects.Image;
    shadow: Phaser.GameObjects.Image;
    state: 'fall' | 'lie' | 'held';
    vy: number;
    t: number;
    bounced: boolean;
    /** held: the arms' angle (see `carry` in gfx/draw) */
    a: number;
    /** held: seconds into a swing (−1 none, −2 picking it up) */
    swing: number;
    cd: number;
    hit: boolean;
    /** a press waiting for the reload */
    queued?: boolean;
  } | null = null;
  private chairIn = 8;
  /** Chairs still to come this match (4 in all), and the hits-left mark that brings each one early. */
  private chairsLeft = CHAIRS;
  /** Hits she's landed on you while you hold the chair (two and you drop it). */
  private chairHurts = 0;
  /** A rocket's landed and the next one counts a hit (two rockets = one hit). */
  private rocketHalf = false;
  private hearts = HEARTS_START;
  private ended = false;
  private fighting = false;
  private crowd!: Phaser.GameObjects.Image;
  private excitedUntil = 0;
  private jumboTex!: Phaser.Textures.CanvasTexture;
  private ribbonTex!: Phaser.Textures.CanvasTexture;
  private jumbo: JumboContent = { kind: 'title' };
  private jumboUntil = 0;
  private ribbonMsg: { text: string; color: string; bg: string; t0: number } | null = null;
  private ropesBack!: Phaser.GameObjects.Graphics;
  private ropesFront!: Phaser.GameObjects.Graphics;
  /** Side ropes (left, right): how far each of the 3 bows out, and how fast. */
  private bow = { [-1]: [0, 0, 0], [1]: [0, 0, 0] } as Record<Side, number[]>;
  private bowV = { [-1]: [0, 0, 0], [1]: [0, 0, 0] } as Record<Side, number[]>;
  /** The long ropes (back 0-2, front 3-5): a wobble, and a sag at each end (where you climb). */
  private wob = [0, 0, 0, 0, 0, 0];
  private sag = { [-1]: [0, 0, 0, 0, 0, 0], [1]: [0, 0, 0, 0, 0, 0] } as Record<Side, number[]>;
  private sagV = { [-1]: [0, 0, 0, 0, 0, 0], [1]: [0, 0, 0, 0, 0, 0] } as Record<Side, number[]>;
  /** The hero and the ring: inside the ropes, bouncing off them, climbing them, diving off the top. */
  private inRing = true;
  private rebound: { side: Side; t: number; v: number } | null = null;
  private loading: { side: Side; vIn: number } | null = null;
  private climb: { side: Side; step: number; t: number; fx: number; fb: number; tx: number; tb: number } | null = null;
  private dive: { vx: number } | null = null;
  private perchedFor = 0;
  /** Just up on the turnbuckle: you stay put until you let go of the direction you climbed with. */
  private perchLock: Side | 0 = 0;
  private prevJump = false;
  private prevFire = false;
  private firePressed = false;
  private rawInput!: { poll(): { fire: boolean } };
  private prevHeroBottom = 0;
  private dark!: Phaser.GameObjects.Rectangle;
  private spot!: Phaser.GameObjects.Image;
  private camFocus: { x: number; y: number; zoom: number } | null = null;
  private camX = WORLD_W / 2;
  private camY = MAT_Y;
  private camZ = 1;
  /** Cutscene shots: the camera goes exactly where camX/camY/camZ/camRot say (tweened by the intro). */
  private camManual = false;
  private camRot = 0;
  private camTok = 0;
  private sweeps: Phaser.GameObjects.Image[] = [];
  private dom!: HTMLElement;
  private skipping = false;
  private inIntro = false;
  private confetti!: SimpleConfetti;
  private king!: Phaser.GameObjects.Sprite;
  private lastHud = '';
  private clock = 0;

  constructor() {
    super('Wrestle');
  }

  init(data: WrestleData) {
    this.wd = data;
    this.rockets = [];
    this.waves = [];
    this.lobs = [];
    this.heartPick = null;
    this.heartIn = 3;
    this.chair = null;
    this.chairIn = 8;
    this.chairsLeft = CHAIRS;
    this.chairHurts = 0;
    this.rocketHalf = false;
    this.hearts = HEARTS_START;
    this.ended = false;
    this.fighting = false;
    this.inRing = true;
    this.rebound = null;
    this.loading = null;
    this.climb = null;
    this.dive = null;
    this.camFocus = null;
    this.camManual = false;
    this.camRot = 0;
    this.sweeps = [];
    this.skipping = false;
    this.lastHud = '';
    this.clock = 0;
  }

  create() {
    setArenaStyle(POO_PALACE);
    this.makeTextures();
    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.setBounds(0, -200, WORLD_W, WORLD_H + 200, true, true, false, false);
    this.cameras.main.setBackgroundColor('#0b0705');

    // ── the arena (the basketball one, in poo browns), the ring, the floor and steps around it ──
    const AS_ = K / ARENA_RES;
    this.add.image(0, 0, 'wr-arena').setOrigin(0).setScale(AS_).setDepth(DEPTH_W.arena);
    this.crowd = this.add.image(0, 0, 'wr-crowd').setOrigin(0).setScale(AS_).setDepth(DEPTH_W.crowd);
    this.add.image(0, 0, 'wr-front').setOrigin(0).setScale(AS_).setDepth(DEPTH_W.front);
    this.jumboTex = this.textures.exists('wr-jumbo') ? (this.textures.get('wr-jumbo') as Phaser.Textures.CanvasTexture) : this.textures.createCanvas('wr-jumbo', JUMBO.w * 2, JUMBO.h * 2)!;
    // (the screens glow: they're in front of the darkness when the lights go down, like the basketball jumbotron)
    this.add.image(WX(JUMBO.x), WY(JUMBO.y), 'wr-jumbo').setOrigin(0).setScale((JUMBO.s * K) / 2).setDepth(DEPTH_W.dark + 0.05);
    this.ribbonTex = this.textures.exists('wr-ribbon') ? (this.textures.get('wr-ribbon') as Phaser.Textures.CanvasTexture) : this.textures.createCanvas('wr-ribbon', RIBBON.w * 2, RIBBON.h * 2)!;
    this.add.image(WX(RIBBON.x), WY(RIBBON.y), 'wr-ribbon').setOrigin(0).setScale(K / 2).setDepth(DEPTH_W.dark + 0.05);
    this.add.image(WX(RING_BOX.x), WY(RING_BOX.y), 'wr-ring').setOrigin(0).setScale(K / RES).setDepth(DEPTH_W.ring);
    this.add.image(WX(-160), WY(500), 'wr-ringside').setOrigin(0).setScale(K / 1.5).setDepth(DEPTH_W.ringside);
    for (const x of [RING.x0, RING.x1])
      this.add.image(WX(x), WY(RING.frontY), 'wr-post').setOrigin(0.5, (POST_BOX.h - 2) / POST_BOX.h).setScale(K / RES).setDepth(DEPTH_W.posts);
    this.ropesBack = this.add.graphics().setDepth(DEPTH_W.backRopes);
    this.ropesFront = this.add.graphics().setDepth(DEPTH_W.frontRopes).setAlpha(0.6);

    // the King, watching from the front row (unseen until the end)
    this.king = this.add.sprite(WX(KING_SEAT.x), WY(KING_SEAT.feet), 'wr-king', 'idle').setOrigin(0.5, (100 + Q_TOP) / (PLOP_H + Q_TOP)).setScale((0.62 * K) / Q_RES * 1.6).setDepth(DEPTH_W.king).setVisible(false);

    // ── what you stand on ──
    this.statics = this.physics.add.staticGroup();
    this.qStatics = this.physics.add.staticGroup();
    const block = (x0: number, x1: number, top: number, bottom: number, oneWay = false, group = this.statics) => {
      const r = this.add.rectangle((x0 + x1) / 2, (top + bottom) / 2, x1 - x0, bottom - top, 0xff00ff, 0).setVisible(false);
      group.add(r);
      const b = r.body as Phaser.Physics.Arcade.StaticBody;
      if (oneWay) {
        b.checkCollision.down = false;
        b.checkCollision.left = false;
        b.checkCollision.right = false;
      }
      return r;
    };
    // the ring (mat on top, the skirt down to the floor), with a hole under the poo puddle (it's
    // quicksand: there's a floor deep down, so you can't fall through), and the floor all round
    block(WX(RING.x0 - RING.apron), PUD_X0, MAT_Y, GROUND_Y + 2);
    block(PUD_X1, WX(RING.x1 + RING.apron), MAT_Y, GROUND_Y + 2);
    block(PUD_X0, PUD_X1, MAT_Y + 70, GROUND_Y + 2);
    block(-50, WORLD_W + 50, GROUND_Y, WORLD_H + 60);
    block(WX(RING.x0 - RING.apron), WX(RING.x1 + RING.apron), MAT_Y, GROUND_Y + 2, false, this.qStatics);
    // the tops of the corner posts (you land on them from above)
    for (const x of [POST_L, POST_R]) block(x - 11, x + 11, POST_TOP, POST_TOP + 8, true);

    // ── the hero ──
    this.fx = new Fx(this);
    const spec = this.wd.session.players[0] ?? { slot: 0, characterId: this.wd.charId ?? 'puffy', inputId: 'solo' };
    // (the bazooka works in the ring; holding the chair, FIRE swings it instead)
    const src = sourceById(spec.inputId) ?? soloSource;
    this.rawInput = src;
    const input = Object.create(src) as typeof src;
    input.poll = () => {
      const i = src.poll();
      return this.chair?.state === 'held' ? { ...i, fire: false } : i;
    };
    this.player = new Player(this, characterById(spec.characterId), input, WX(330), MAT_Y - 30);
    this.player.facing = 1;
    // (their chair-carrying frames, ready for when a chair comes in)
    makeCarrySheet(this, this.player.char);
    this.physics.add.collider(this.player.hitbox, this.statics);
    this.gRockets = this.physics.add.group({ allowGravity: false });
    this.physics.add.collider(this.gRockets, this.statics, (r) => (r as Rocket).explode());

    // ── Queen Plop ──
    this.queen = new Queen(this, POST_R, POST_TOP);
    this.queen.body.setAllowGravity(false);
    this.physics.add.collider(this.queen.spr, this.qStatics);
    // (rockets go off on her: a hit, and it knocks her back)
    this.physics.add.overlap(this.gRockets, this.queen.spr, (a, b) => {
      const r = (a instanceof Rocket ? a : b) as Rocket;
      if (r.active && this.queen.dangerous) r.explode();
    });

    this.heartsG = this.add.graphics().setDepth(DEPTH.text);
    this.confetti = new SimpleConfetti(this, DEPTH.fx);
    this.dark = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W * 3, WORLD_H * 3, 0x070302, 0).setDepth(DEPTH_W.dark);
    this.spot = this.add.image(0, 0, 'spot').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_W.spot).setAlpha(0);

    // ── the overlay: her health in 8 pieces, call-outs, speech, a Skip button ──
    this.dom = document.createElement('div');
    this.dom.className = 'wrestle';
    this.dom.innerHTML = `
      <div class="wr-callout"></div>
      <div class="hoops-l3 wr-l3"><b></b><span></span></div>
      <div class="wr-speech" hidden></div>
      <button class="wr-skip" hidden>Skip ›</button>`;
    document.getElementById('ui')!.appendChild(this.dom);
    this.dom.querySelector('.wr-skip')!.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.inIntro) this.skipping = true;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dom.remove());

    this.game.events.emit('wrestle-start', this);
    this.emitHud(true);
    this.updateCamera(0, true);
    void this.intro();
  }

  // ───────────────────────────────────────────── art ──

  private makeTextures() {
    const T = this.textures;
    if (!T.exists('wr-arena'))
      addCanvas(this, 'wr-arena', hires(ARENA_W, ARENA_H, ARENA_RES, (ctx) => {
        drawArena(ctx);
        drawRingFloor(ctx);
      }), undefined, { release: true });
    if (!T.exists('wr-crowd')) addCanvas(this, 'wr-crowd', hires(ARENA_W, CROWD_H, ARENA_RES, (ctx) => (drawCrowd(ctx, false), drawTunnel(ctx))), undefined, { release: true });
    if (!T.exists('wr-crowd2')) addCanvas(this, 'wr-crowd2', hires(ARENA_W, CROWD_H, ARENA_RES, (ctx) => (drawCrowd(ctx, true), drawTunnel(ctx))), undefined, { release: true });
    if (!T.exists('wr-front'))
      addCanvas(this, 'wr-front', hires(ARENA_W, FRONT_H, ARENA_RES, (ctx) => {
        drawArenaFront(ctx);
        drawArenaPoo(ctx);
      }), undefined, { release: true });
    if (!T.exists('wr-ring'))
      addCanvas(this, 'wr-ring', hires(RING_BOX.w, RING_BOX.h, RES, (ctx) => {
        ctx.translate(-RING_BOX.x, -RING_BOX.y);
        drawRing(ctx);
      }), undefined, { release: true });
    if (!T.exists('wr-post')) addCanvas(this, 'wr-post', hires(POST_BOX.w, POST_BOX.h, RES, (ctx) => drawFrontPost(ctx)));
    if (!T.exists('wr-ringside'))
      addCanvas(this, 'wr-ringside', hires(1600, 230, 1.5, (ctx) => {
        ctx.translate(160, -500);
        drawRingside(ctx);
      }), undefined, { release: true });
    // Queen Plop and the King, all their frames (a grid: one long strip is too wide for some phones)
    const sheetOf = (key: string, draw: (ctx: CanvasRenderingContext2D, f: PlopFrame) => void) => {
      if (T.exists(key)) return;
      const fw = Math.round((PLOP_W + Q_PAD * 2) * Q_RES);
      const fh = Math.round((PLOP_H + Q_TOP) * Q_RES);
      const COLS = 5;
      const { c, ctx } = canvas(fw * COLS, fh * Math.ceil(PLOP_FRAMES.length / COLS));
      PLOP_FRAMES.forEach((f, i) => {
        ctx.save();
        ctx.translate((i % COLS) * fw, Math.floor(i / COLS) * fh);
        ctx.scale(Q_RES, Q_RES);
        draw(ctx, f);
        ctx.restore();
      });
      addCanvas(this, key, c, (t) => PLOP_FRAMES.forEach((f, i) => t.add(f, 0, (i % COLS) * fw, Math.floor(i / COLS) * fh, fw, fh)), { release: true });
    };
    sheetOf('wr-queen', (ctx, f) => drawQueen(ctx, Q_PAD, Q_TOP, f));
    sheetOf('wr-king', (ctx, f) => drawPlop(ctx, Q_PAD, Q_TOP, f, STYLES.polished, 'king'));
    // Queen Plop knocked out (four frames: breathing, eyes spinning)
    if (!T.exists('wr-queen-ko')) {
      const R = Q_RES;
      const fw = Math.round(QUEEN_KO_W * R);
      const fh = Math.round(QUEEN_KO_H * R);
      const { c, ctx } = canvas(fw * 2, fh * 2);
      QUEEN_KO_FRAMES.forEach((_, i) => {
        ctx.save();
        ctx.translate((i % 2) * fw, Math.floor(i / 2) * fh);
        ctx.scale(R, R);
        drawQueenKO(ctx, 0, 0, i);
        ctx.restore();
      });
      addCanvas(this, 'wr-queen-ko', c, (t) => QUEEN_KO_FRAMES.forEach((f, i) => t.add(f, 0, (i % 2) * fw, Math.floor(i / 2) * fh, fw, fh)), { release: true });
    }
    if (!T.exists('camflash')) addCanvas(this, 'camflash', hires(48, 48, 1, (ctx) => drawCameraFlash(ctx, 24)));
    if (!T.exists('spot')) addCanvas(this, 'spot', hires(300, 700, 1, (ctx) => drawSpotlight(ctx, 300, 700)));
    if (!T.exists('softshadow'))
      addCanvas(this, 'softshadow', hires(128, 40, 1, (ctx) => {
        const g = ctx.createRadialGradient(64, 20, 2, 64, 20, 64);
        g.addColorStop(0, 'rgba(20,10,4,0.8)');
        g.addColorStop(1, 'rgba(20,10,4,0)');
        ctx.fillStyle = g;
        ctx.scale(1, 0.3125);
        ctx.fillRect(0, 0, 128, 128);
      }));
    if (!T.exists('wr-poowave')) {
      const { c, ctx } = canvas(POOWAVE_W * 3 * 4, POOWAVE_H * 3);
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(i * POOWAVE_W * 3, 0);
        ctx.scale(3, 3);
        drawPooWave(ctx, i);
        ctx.restore();
      }
      addCanvas(this, 'wr-poowave', c, (t) => [0, 1, 2, 3].forEach((i) => t.add(`w${i}`, 0, i * POOWAVE_W * 3, 0, POOWAVE_W * 3, POOWAVE_H * 3)));
    }
    if (!T.exists('wr-poo')) addCanvas(this, 'wr-poo', hires(26, 24, ART_RES, (ctx) => drawPoo(ctx, 13, 22, 1)));
    if (!T.exists('prize-heart')) addCanvas(this, 'prize-heart', hires(30, 30, ART_RES, (ctx) => drawPrize(ctx, 'heart')));
    if (!T.exists('wr-chair')) addCanvas(this, 'wr-chair', hires(CHAIR_W + 8, CHAIR_H + 4, ART_RES, (ctx) => (ctx.translate(4, 2), drawFoldingChair(ctx))));
    if (!T.exists('wr-chair-bent')) addCanvas(this, 'wr-chair-bent', hires(CHAIR_W + 8, CHAIR_H + 4, ART_RES, (ctx) => (ctx.translate(4, 2), drawFoldingChair(ctx, true))));
  }

  // ───────────────────────────────────────────── the hero's side ──

  heroInRing() {
    return this.inRing || this.heroOnRopes();
  }
  heroOnRopes() {
    return !!this.climb || this.heroPerched();
  }
  heroPerched() {
    const p = this.player;
    return p.alive && p.onGround && Math.abs(p.bottom - POST_TOP) < 3 && (Math.abs(p.x - POST_L) < 16 || Math.abs(p.x - POST_R) < 16);
  }
  heroDiving() {
    return !!this.dive;
  }

  fireRocket(p: Player) {
    const x = p.x + p.facing * 24 * p.char.scale;
    const y = p.bottom - (p.char.muzzleY ?? 18);
    sfx.shoot();
    this.fx.muzzle(x, y, p.facing, p.x - p.facing * 18);
    const r = new Rocket(this, p, x, y, p.facing);
    this.rockets.push(r);
    this.gRockets.add(r);
    r.body.setAllowGravity(false);
    r.body.setVelocityX(p.facing * p.char.rocketSpeed * 0.45);
  }

  explode(x: number, y: number, owner: Player) {
    const r = owner.char.blastRadius;
    this.fx.explosion(x, y, r);
    sfx.explode();
    this.cameras.main.shake(140, 0.005);
    const q = this.queen;
    const qb = q.body;
    const dx = Math.max(qb.left - x, 0, x - qb.right);
    const dy = Math.max(qb.top - y, 0, y - qb.bottom);
    if (dx * dx + dy * dy < r * r * 0.6) this.hitQueen(1, 'rocket', x);
  }

  onPlayerFainted(_p: Player) {
    if (this.ended) return;
    this.ended = true;
    this.fighting = false;
    const q = this.queen;
    q.setMode('down');
    q.spr.setFrame('grin');
    this.time.delayedCall(500, () => {
      this.callout('HA HA HA!', 'bad', 1500);
      sfx.laugh();
    });
    // (from the Bosses menu: no life lost, and a card offers another go)
    const practice = !!this.wd.result?.practice;
    const hadLife = practice || loseLife();
    this.emitHud(true);
    if (practice) this.game.events.emit('boss-cutscene');
    this.time.delayedCall(2300, () => {
      fadeOutMusic(500);
      if (practice) {
        this.game.events.emit('boss-lost', this.wd.result);
        return;
      }
      if (!hadLife) {
        const ch = characterById(this.wd.charId);
        this.game.events.emit('game-over', { charId: ch.id, name: ch.name, checkpoint: this.wd.checkpoint } satisfies GameOverState);
        return;
      }
      this.cameras.main.fadeOut(400, 20, 10, 6);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart(this.wd));
    });
  }

  /** You got hit: a heart gone (and on the second hit while you hold the chair, the chair). */
  private hurtPlayer(fromX: number) {
    const p = this.player;
    if (!p.alive || p.invulnerable || this.ended || !this.fighting) return;
    if (this.climb) this.endClimb();
    this.dive = null;
    // (holding the chair, you hang on through one hit; the second knocks it out of your hands)
    if (this.chair?.state === 'held' && ++this.chairHurts >= 2) this.dropChair();
    {
      this.hearts--;
      if (this.hearts <= 0) {
        this.hearts = 0;
        this.dropChair();
        this.emitHud(true);
        p.faint(false);
        return;
      }
      p.knockBack(fromX);
      this.fx.popText(p.x, p.y - 30, 'OUCH!', '#ff8a80', 16);
    }
    this.emitHud(true);
  }

  // ───────────────────────────────────────────── the ring's ropes ──

  /** Something pushed into the ropes at one end (they bow out, then spring back). */
  ropeHit(side: Side, amount: number) {
    for (let i = 0; i < 3; i++) this.bowV[side][i] += amount * (i === 2 ? 4 : 9);
  }

  /** The long ropes shake (a dive off the top, a big landing). */
  private shakeRopes(amount: number) {
    for (let i = 0; i < 6; i++) this.wob[i] = Math.max(this.wob[i], amount * (0.7 + Math.random() * 0.6));
    for (const side of [-1, 1] as Side[]) for (let i = 0; i < 3; i++) this.bowV[side][i] += (Math.random() - 0.5) * amount * 20;
  }

  private updateRopes(dt: number) {
    const KS = 210;
    const C = 9;
    for (const side of [-1, 1] as Side[])
      for (let i = 0; i < 3; i++) {
        this.bowV[side][i] += (-KS * this.bow[side][i] - C * this.bowV[side][i]) * dt;
        this.bow[side][i] += this.bowV[side][i] * dt;
        for (let j = 0; j < 6; j++) {
          this.sagV[side][j] += (-260 * this.sag[side][j] - 10 * this.sagV[side][j]) * dt;
          this.sag[side][j] += this.sagV[side][j] * dt;
        }
      }
    for (let i = 0; i < 6; i++) this.wob[i] *= Math.exp(-dt * 2.6);
    this.drawRopes();
  }

  private drawRopes() {
    const t = this.clock / 1000;
    const gb = this.ropesBack.clear();
    const gf = this.ropesFront.clear();
    const line = (g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[], col: string, w: number) => {
      g.lineStyle(w + 1.6, 0x1a0e06, 1).strokePoints(pts, false);
      g.lineStyle(w, Phaser.Display.Color.HexStringToColor(col).color, 1).strokePoints(pts, false);
      g.lineStyle(w * 0.3, 0xffffff, 0.35).strokePoints(pts.map((p) => ({ x: p.x, y: p.y - w * 0.2 })), false);
    };
    const long = (g: Phaser.GameObjects.Graphics, k: number, x0: number, x1: number, y: number, col: string, w: number) => {
      const pts: { x: number; y: number }[] = [];
      const N = 22;
      for (let n = 0; n <= N; n++) {
        const u = n / N;
        let dy = Math.sin(Math.PI * u) * (3 * K * 0.6) + this.wob[k] * Math.sin(Math.PI * u) * Math.cos(t * 17 + k);
        // a sag near each end where someone's climbing
        dy += this.sag[-1][k] * Math.max(0, 1 - u / 0.22) + this.sag[1][k] * Math.max(0, 1 - (1 - u) / 0.22);
        pts.push({ x: x0 + (x1 - x0) * u, y: y + dy });
      }
      line(g, pts, col, w);
    };
    const R = RING;
    for (let i = 0; i < 3; i++) {
      const h = R.ropes[i];
      long(gb, i, WX(backX(R.x0)), WX(backX(R.x1)), WY(R.backY - h * R.back), ROPE_COL[i], 3.2 * R.back * K);
    }
    // the side ropes, from each back post to its front post, bowing out where they're pushed
    for (const side of [-1, 1] as Side[]) {
      const xf = side < 0 ? R.x0 : R.x1;
      for (let i = 0; i < 3; i++) {
        const h = R.ropes[i];
        const a = { x: WX(backX(xf)), y: WY(R.backY - h * R.back) };
        const b = { x: WX(xf), y: WY(R.frontY - h) };
        const mx = a.x + (b.x - a.x) * FIGHT_T + side * this.bow[side][i] * 2;
        const my = a.y + (b.y - a.y) * FIGHT_T;
        const pts: { x: number; y: number }[] = [];
        for (let n = 0; n <= 12; n++) {
          const u = n / 12;
          const v = 1 - u;
          pts.push({ x: v * v * a.x + 2 * v * u * mx + u * u * b.x, y: v * v * a.y + 2 * v * u * my + u * u * b.y });
        }
        line(gb, pts, ROPE_COL[i], 2.6 * K);
      }
    }
    for (let i = 0; i < 3; i++) long(gf, 3 + i, WX(R.x0), WX(R.x1), WY(R.frontY - R.ropes[i]), ROPE_COL[i], 3.6 * K);
  }

  /**
   * The hero and the ropes: inside the ring the ropes at each end stop you; run into them
   * and they stretch and fling you back. There's no leaving the ring (above the top rope you can
   * only go as far as the corner posts).
   */
  private ropePhysics(dt: number) {
    const p = this.player;
    const b = p.body;
    const c = p.char;
    const hw = b.halfWidth;
    const low = b.bottom > MAT_Y - ROPE_TOP + 4;
    if (b.center.x > ROPE_L && b.center.x < ROPE_R && b.bottom <= MAT_Y + 3) this.inRing = true;

    // a rebound: flung back across the ring, fast (you can't steer for a moment)
    if (this.rebound) {
      const r = this.rebound;
      r.t += dt;
      const k = Math.min(1, r.t / 0.34);
      b.setVelocityX(-r.side * r.v * (1 - 0.35 * k));
      if (r.t > 0.34) this.rebound = null;
    }
    for (const side of [-1, 1] as Side[]) {
      const rope = side < 0 ? ROPE_L : ROPE_R;
      const over = side * (b.center.x - rope) + hw;
      if (this.inRing) {
        if (over <= 0) {
          if (this.loading?.side === side) this.loading = null;
          continue;
        }
        if (!low) {
          // above the top rope: still no way out (as far as the corner post, no further)
          const post = side < 0 ? POST_L : POST_R;
          const past = side * (b.center.x - post);
          if (past > 0) {
            b.x -= side * past;
            if (side * b.velocity.x > 0) b.setVelocityX(0);
          }
          continue;
        }
        const vOut = side * b.velocity.x;
        if (this.loading?.side === side || (vOut > c.walkSpeed * 1.12 && !this.rebound)) {
          // running into them: they stretch… then fling you back
          this.loading ??= { side, vIn: vOut };
          const v = Math.max(0, vOut - 2600 * dt);
          b.setVelocityX(side * v);
          const pen = Math.min(over, 18);
          for (let i = 0; i < 3; i++) this.bow[side][i] = Math.max(this.bow[side][i], pen * [0.9, 1, 0.45][i] * 0.5);
          if (v <= 0 || over >= 18) {
            const vIn = this.loading.vIn;
            this.loading = null;
            this.rebound = { side, t: 0, v: Math.max(c.runSpeed * 1.25, vIn * 1.15) };
            for (let i = 0; i < 3; i++) this.bowV[side][i] -= 160 * [0.9, 1, 0.45][i];
            p.squash = { x: 0.82, y: 1.15 };
            p.facing = (-side) as Side;
            this.fx.dust(p.x, p.bottom, 4);
            sfx.jump2();
            this.ropeBoing();
          }
          if (over > 18) b.x -= side * (over - 18);
        } else {
          // just leaning on them
          const pen = Math.min(over, 6);
          for (let i = 0; i < 3; i++) this.bow[side][i] = Math.max(this.bow[side][i], pen * [0.8, 1, 0.4][i] * 0.5);
          if (over > 6) b.x -= side * (over - 6);
          if (vOut > 0) b.setVelocityX(0);
        }
      }
    }
  }

  /**
   * The poo puddle on the mat is quicksand, like the level's: you sink slowly (jump to hop out);
   * only what's above the surface shows; go right under and it costs you (BLUB!), and you're
   * spat out at the edge.
   */
  private quicksand() {
    const p = this.player;
    const b = p.body;
    const surf = MAT_Y + 3;
    const inPud = b.center.x > PUD_X0 && b.center.x < PUD_X1 && b.bottom > MAT_Y + 1;
    p.goo = inPud ? b.bottom - MAT_Y : 0;
    if (inPud && Math.random() < 0.06) this.fx.pooSplat(p.x, MAT_Y, 2);
    if (inPud && b.top > surf) {
      this.fx.pooSplat(p.x, MAT_Y, 14);
      this.fx.popText(p.x, MAT_Y - 30, 'BLUB!', '#c99064', 20);
      sfx.dribble(1);
      const x = b.center.x - PUD_X0 < PUD_X1 - b.center.x ? PUD_X0 - 16 : PUD_X1 + 16;
      p.goo = 0;
      b.reset(x, MAT_Y - b.halfHeight - 2);
      b.setVelocity(0, -380);
      this.hurtPlayer(PUDDLE.x);
    }
  }

  /** Only what's above the poo shows (applied after the hero's picture is placed each frame). */
  private cropInPoo() {
    const p = this.player;
    const v = p.view;
    if (p.goo > 0) {
      const top = v.y - v.displayHeight;
      v.setCrop(0, 0, v.frame.realWidth, Phaser.Math.Clamp((MAT_Y + 3 - top) / Math.abs(v.scaleY), 0, v.frame.realHeight));
    } else if (v.isCropped) v.setCrop();
  }

  /** A satisfying twang (two notes). */
  private ropeBoing() {
    sfx.bump();
    this.time.delayedCall(60, () => sfx.dribble(0.5));
  }

  /** Climbing the ropes in a corner to the top of the post: three rope steps and up. */
  private startClimb(side: Side) {
    const p = this.player;
    const post = side < 0 ? POST_L : POST_R;
    this.climb = { side, step: 0, t: 0, fx: p.x, fb: p.bottom, tx: post - side * 9, tb: MAT_Y - RING.ropes[0] * K };
    p.body.setAllowGravity(false);
    p.body.setVelocity(0, 0);
    p.facing = side;
    this.loading = null;
    this.rebound = null;
  }

  private updateClimb(dt: number) {
    const cl = this.climb!;
    const p = this.player;
    const STEP = 0.16;
    cl.t += dt;
    const u = Math.min(1, cl.t / STEP);
    const e = u * u * (3 - 2 * u);
    const x = cl.fx + (cl.tx - cl.fx) * e;
    const bot = cl.fb + (cl.tb - cl.fb) * e - Math.sin(Math.PI * u) * 6;
    p.body.reset(x, bot - p.body.halfHeight);
    p.body.setAllowGravity(false);
    p.view.setFrame(u < 0.5 ? 'jump' : 'fall');
    if (u >= 1) {
      // a foot on the rope: it dips under you; a little squash
      if (cl.step < 3) {
        this.sagV[cl.side][3 + cl.step] += 70;
        this.sagV[cl.side][cl.step] += 35;
        sfx.bump();
      }
      p.squash = { x: 1.12, y: 0.9 };
      cl.step++;
      cl.fx = cl.tx;
      cl.fb = cl.tb;
      cl.t = 0;
      const post = cl.side < 0 ? POST_L : POST_R;
      if (cl.step < 3) {
        cl.tx = post - cl.side * (9 - cl.step * 2);
        cl.tb = MAT_Y - RING.ropes[cl.step] * K;
      } else if (cl.step === 3) {
        cl.tx = post;
        cl.tb = POST_TOP;
      } else {
        // on top: turn to face the ring (and stay put while you're still pushing that way)
        this.endClimb();
        this.perchLock = cl.side;
        p.facing = (-cl.side) as Side;
        p.squash = { x: 1.2, y: 0.85 };
        this.fx.dust(p.x, p.bottom, 3);
        this.excitedUntil = this.clock + 1500;
        this.flashJumbo({ kind: 'big', text: 'UP TOP!', sub: 'JUMP! JUMP! JUMP!', color: '#ffd23f', bg: '#5c3118' }, 1500);
      }
    }
  }

  private endClimb() {
    const p = this.player;
    this.climb = null;
    p.body.setAllowGravity(true);
    p.body.setVelocity(0, 0);
    // (so the jump you're still holding doesn't fire the moment you're up)
    (p as unknown as { prev: { jump: boolean } }).prev = p.input.poll();
  }

  // ───────────────────────────────────────────── Queen Plop's attacks ──

  /** Her big landing: the ring shakes and poo rolls out both ways along the mat (jump it!). */
  slamLanded(q: Queen) {
    this.cameras.main.shake(260, 0.012);
    sfx.thud();
    this.fx.dust(q.x, q.bottom, 14);
    this.fx.pooSplat(q.x, q.bottom, 14);
    this.shakeRopes(7);
    for (const dir of [-1, 1]) this.spawnWave(q.x + dir * 30, dir);
  }

  /** She throws a lump of poo at (x, y). */
  lobAt(q: Queen, x: number, y: number) {
    const sx = q.x + q.facing * 20;
    const sy = q.top + 10;
    const t = 0.85;
    const vx = (x - sx) / t;
    const vy = (y - sy - 0.5 * GRAVITY * 0.7 * t * t) / t;
    const img = this.add.image(sx, sy, 'wr-poo').setScale(1.2 / ART_RES).setDepth(DEPTH.projectiles);
    this.lobs.push({ img, vx, vy });
    q.spr.setFrame('yell1');
    sfx.spit();
  }

  private updateHazards(dt: number) {
    const p = this.player;
    this.waves = this.waves.filter((w) => {
      w.life -= dt;
      w.t += dt;
      w.img.x += w.dir * w.speed * dt;
      w.img.setFrame(`w${Math.floor(w.t * 10) % 4}`);
      const gone = w.life <= 0 || w.img.x < ROPE_L + 6 || w.img.x > ROPE_R - 6;
      if (!gone && Math.abs(p.x - w.img.x) < 14 && p.bottom > MAT_Y - 14 && p.bottom < MAT_Y + 6) this.hurtPlayer(w.img.x);
      if (gone) {
        this.fx.pooSplat(w.img.x, MAT_Y, 6);
        w.img.destroy();
      }
      return !gone;
    });
    this.lobs = this.lobs.filter((l) => {
      l.vy += GRAVITY * 0.7 * dt;
      l.img.x += l.vx * dt;
      l.img.y += l.vy * dt;
      l.img.rotation += dt * (l.big ? 7 : 6);
      // (the big one trails poo, like the Giant Plops')
      if (l.big && Math.random() < 0.7) this.fx.pooSplat(l.img.x - l.vx * 0.02, l.img.y, 1);
      const floor = l.img.x > WX(RING.x0) && l.img.x < WX(RING.x1) ? MAT_Y : GROUND_Y;
      const r = l.big ? 10 : 0;
      if (Math.abs(p.x - l.img.x) < 16 + r && Math.abs(p.y - l.img.y) < 22 + r) {
        this.hurtPlayer(l.img.x);
        this.fx.pooSplat(l.img.x, l.img.y, 8);
        l.img.destroy();
        return false;
      }
      if (l.img.y > floor || l.img.x < -40 || l.img.x > WORLD_W + 40) {
        this.fx.pooSplat(l.img.x, Math.min(l.img.y, floor), l.big ? 16 : 8);
        if (l.big && floor === MAT_Y) {
          this.cameras.main.shake(160, 0.006);
          this.shakeRopes(3);
          sfx.dribble(0.5);
          this.spawnWave(l.img.x, l.big, 210);
        }
        l.img.destroy();
        return false;
      }
      return true;
    });
  }

  /** A hit on her: counts down the jumbotron; the 8th is the end of her. */
  private hitQueen(n: number, how: 'dive' | 'stomp' | 'chair' | 'topchair' | 'rocket', fromX: number) {
    const q = this.queen;
    // (a rocket is half a hit: it knocks her back every time, but it takes two to count one off.
    // Nothing shows halves: the count just goes down on every second rocket)
    const rocketCounts = how === 'rocket' && this.rocketHalf;
    if (how === 'rocket') n = rocketCounts ? 1 : 0;
    if (!this.fighting || !q.hit(n, fromX)) return false;
    if (how === 'rocket') this.rocketHalf = !this.rocketHalf;
    const big = how === 'dive' || how === 'chair' || how === 'topchair';
    const words = how === 'topchair' ? 'TOP ROPE CHAIR SHOT! ×3' : how === 'dive' ? 'TOP ROPE! ×2' : how === 'chair' ? 'CHAIR SHOT! ×2' : how === 'stomp' ? ['BONK!', 'SPLAT!', 'BOING!'][q.hp % 3] : ['POW!', 'BAM!', 'KABOOM!'][q.hp % 3];
    this.fx.popText(q.x, q.top - 16, words, big ? '#ffd23f' : '#ffffff', big ? 26 : 20);
    this.fx.stars(q.x, q.top + 10, big ? 10 : 5);
    sfx.stomp();
    this.excitedUntil = this.clock + (big ? 2500 : 1200);
    if (big) {
      this.cameras.main.shake(300, 0.014);
      this.shakeRopes(6);
      sfx.cheer();
      if (how === 'topchair') this.flashJumbo({ kind: 'big', text: 'TOP ROPE CHAIR SHOT!', sub: `THAT ONE COUNTS TRIPLE · ${q.hp} TO GO`, color: '#ffd23f', bg: '#c8102e' }, 2600);
      else if (how === 'dive') this.flashJumbo({ kind: 'big', text: 'FROM THE TOP ROPE!', sub: `THAT ONE COUNTS DOUBLE · ${q.hp} TO GO`, color: '#ffd23f', bg: '#c8102e' }, 2200);
      else this.flashJumbo({ kind: 'big', text: 'CHAIR SHOT!', sub: `THAT ONE COUNTS DOUBLE · ${q.hp} TO GO`, color: '#ffd23f', bg: '#3a4652' }, 2200);
    } else this.flashJumbo({ kind: 'big', text: words.replace(/!.*/, '!'), sub: `${q.hp} TO GO`, color: '#ffd23f', bg: '#5c3118' }, 900);
    if (q.hp <= 0) void this.win();
    return true;
  }

  // ───────────────────────────────────────────── the loop ──

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    this.clock += deltaMs;
    const p = this.player;
    const input = p.input.poll();
    const jumpPressed = input.jump && !this.prevJump;
    this.prevJump = input.jump;
    const fireNow = this.rawInput.poll().fire;
    this.firePressed = fireNow && !this.prevFire;
    this.prevFire = fireNow;

    if (this.fighting && p.alive) {
      if (this.climb) this.updateClimb(dt);
      else {
        // in a corner, pushing into the post: up the ropes you go
        const side: Side | 0 = input.right ? 1 : input.left ? -1 : 0;
        const nearPost = side !== 0 && this.inRing && p.onGround && Math.abs(p.bottom - MAT_Y) < 3 && side * (p.x - (side < 0 ? ROPE_L : ROPE_R)) > -p.body.halfWidth - 16;
        if (jumpPressed && nearPost) this.startClimb(side as Side);
        else {
          const perched = this.heroPerched();
          p.update(dt);
          // off the top rope: a big committed leap into the ring
          if (perched && p.body.velocity.y < -100) {
            const toward = (p.x < WORLD_W / 2 ? 1 : -1) as Side;
            const hold = (input.right ? 1 : input.left ? -1 : 0) === toward;
            this.dive = { vx: toward * (hold ? 360 : 290) };
            p.body.setVelocityY(-p.char.jump * 0.95);
            p.facing = toward;
            this.shakeRopes(8);
            for (let i = 3; i < 6; i++) this.sagV[(-toward) as Side][i] -= 90;
            sfx.whoosh();
            this.fx.popText(p.x, p.body.top - 18, 'FROM THE TOP ROPE!', '#ffd23f', 18);
            this.flashJumbo({ kind: 'big', text: 'FROM THE TOP ROPE!', sub: 'OH YEAH!', color: '#ffd23f', bg: '#c8102e' }, 1600);
            this.excitedUntil = this.clock + 2000;
          }
          if (this.dive) {
            if (p.onGround && p.body.velocity.y >= 0) this.dive = null;
            else p.body.setVelocityX(this.dive.vx);
          }
          this.perchedFor = perched ? this.perchedFor + dt : 0;
          if (this.perchLock) {
            const still = this.perchLock > 0 ? input.right : input.left;
            if (!still || !this.heroPerched()) this.perchLock = 0;
            else {
              p.body.setVelocityX(0);
              p.body.x = (this.perchLock < 0 ? POST_L : POST_R) - p.body.halfWidth;
              p.facing = (-this.perchLock) as Side;
            }
          }
        }
      }
      if (!this.climb) this.ropePhysics(dt);
      this.quicksand();
    } else if (!this.fighting && p.state === 'finished') p.update(dt);

    if (this.fighting || this.queen.mode === 'down' || this.queen.mode === 'hurt') this.queen.update(dt);
    if (this.fighting) this.contact();
    this.prevHeroBottom = p.bottom;
    this.rockets = this.rockets.filter((r) => r.active);
    for (const r of this.rockets) {
      r.tick(dt);
      if (r.active && (r.x < -20 || r.x > WORLD_W + 20)) r.fizzle();
    }
    this.updateHazards(dt);
    this.updateHearts(dt);
    this.updateChair(dt);
    this.updateRopes(dt);
    this.updateCamera(dt);
    p.sync(dt);
    this.cropInPoo();
    this.drawHeroHearts();
    if (this.climb) p.view.setFrame(Math.floor(this.clock / 90) % 2 ? 'jump' : 'fall');
    if (this.fighting) this.emitHud();
    // the crowd on its feet for the big moments
    const excited = this.clock < this.excitedUntil && Math.floor(this.clock / 170) % 3 !== 2;
    const want = excited ? 'wr-crowd2' : 'wr-crowd';
    if (this.crowd.texture.key !== want) this.crowd.setTexture(want);
    if (this.jumbo.kind === 'big' && this.jumboUntil && this.clock > this.jumboUntil) {
      this.jumboUntil = 0;
      // (before the fight, back to her title: the hits to go only go up once it's on)
      this.jumbo = this.fighting || this.ended ? this.countJumbo() : { kind: 'title' };
    }
    this.drawScreens();
  }

  /** The hero against her: land on her (from the top rope: two hits), or she gets you. */
  private contact() {
    const p = this.player;
    const q = this.queen;
    if (!p.alive || q.hp <= 0) return;
    const a = p.body;
    const b = q.body;
    // (a dive off the top rope is generous: coming down near her counts)
    // (her head's a little easier to land on than her body is to bump into; a dive, much easier)
    const reach = this.dive ? 22 : 6;
    if (a.right < b.left - reach || a.left > b.right + reach || a.bottom < b.top - (this.dive ? 10 : 0) || a.top > b.bottom) return;
    // (she's leaping up to meet you: that's a headbutt, not a stomp — except off the top rope)
    const rising = b.velocity.y < -250 && !this.dive;
    // (where you were last frame counts too: on a slow phone you can drop right past her head in one frame)
    const falling = a.velocity.y > 40 || a.bottom > this.prevHeroBottom + 1;
    const fromAbove = Math.min(a.bottom, this.prevHeroBottom) < b.top + b.height * 0.5;
    // off the top rope with the chair in your hands: it comes down on her head (three hits)
    if (this.dive && this.chair?.state === 'held' && fromAbove) {
      this.chairHit();
      this.dive = null;
      p.bounce();
      return;
    }
    if (!rising && falling && fromAbove) {
      const dive = !!this.dive;
      this.dive = null;
      this.hitQueen(dive ? 2 : 1, dive ? 'dive' : 'stomp', p.x);
      p.bounce();
      return;
    }
    if (q.dangerous) this.hurtPlayer(q.x);
  }

  /** Hearts turn up in the ring (instead of nuggies), often, until you've got 6: grab one for a heart. */
  private updateHearts(dt: number) {
    const p = this.player;
    if (this.heartPick) {
      const n = this.heartPick;
      n.t += dt;
      n.img.y = n.y + Math.sin(n.t * 3) * 4;
      n.img.setAlpha(n.t > 7 && Math.floor(n.t * 8) % 2 ? 0.35 : 1);
      if (p.alive && this.fighting && Math.abs(p.x - n.img.x) < 22 && Math.abs(p.y - n.img.y) < 28) {
        this.hearts = Math.min(HEARTS_MAX, this.hearts + 1);
        sfx.rootbeer();
        this.fx.auraSparkle(n.img.x, n.img.y, 12);
        this.fx.popText(n.img.x, n.img.y - 20, '+1 ♥', '#ff7eb6', 18);
        n.img.destroy();
        this.heartPick = null;
      } else if (n.t > 9) {
        n.img.destroy();
        this.heartPick = null;
      }
      return;
    }
    if (!this.fighting) return;
    this.heartIn -= dt;
    if (this.heartIn > 0) return;
    // (not when you have the most you can hold)
    if (this.hearts >= HEARTS_MAX) {
      this.heartIn = 2;
      return;
    }
    this.heartIn = 2 + Math.random() * 2;
    const x = this.ringSpot();
    const y = MAT_Y - 30 - Math.random() * 60;
    const img = this.add.image(x, y, 'prize-heart').setScale(0.99 / ART_RES).setDepth(DEPTH.pickups);
    this.tweens.add({ targets: img, scale: { from: 0, to: 0.99 / ART_RES }, duration: 300, ease: 'Back.easeOut' });
    this.fx.auraSparkle(x, y, 6);
    this.heartPick = { img, t: 0, y };
  }

  /** Somewhere on the mat that isn't the poo puddle. */
  private ringSpot() {
    for (;;) {
      const x = ROPE_L + 50 + Math.random() * (ROPE_R - ROPE_L - 100);
      if (x < PUD_X0 - 24 || x > PUD_X1 + 24) return x;
    }
  }

  /** Your hearts, over your head (like Battle). */
  private drawHeroHearts() {
    const g = this.heartsG.clear();
    const p = this.player;
    if (!this.fighting || !p.alive) return;
    // (5 slots, and a 6th when you've got one)
    const n = Math.max(HEARTS_START, this.hearts);
    const w = 8.5;
    const x0 = p.x - ((n - 1) * w) / 2;
    const y = p.body.top - 12;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * w;
      const full = i < this.hearts;
      g.fillStyle(0x2b1a12, 0.85).fillCircle(cx - 1.8, y - 1, 3.4).fillCircle(cx + 1.8, y - 1, 3.4).fillTriangle(cx - 5, y, cx + 5, y, cx, y + 5.4);
      g.fillStyle(full ? 0xff5d7a : 0x6b5a5a, 1).fillCircle(cx - 1.7, y - 1, 2.3).fillCircle(cx + 1.7, y - 1, 2.3).fillTriangle(cx - 3.8, y - 0.4, cx + 3.8, y - 0.4, cx, y + 3.8);
    }
  }

  // ── the folding chair ──

  /** The chair sprite's scale (world px per chair unit / the texture's resolution). */
  private static CHAIR_S = 1.0;

  /** Where the hero's hands are (world), carrying at arm angle a. */
  private heroHand(a: number): [number, number] {
    const p = this.player;
    const v = p.view;
    const k = Math.abs(v.scaleX) * ART_RES;
    const [hx, hy] = carryHand(p.char.id, a);
    const dx = (hx + HERO_SHEET_M - (CHAR_W + HERO_SHEET_M * 2) / 2) * k;
    const dy = (hy - CHAR_H) * Math.abs(v.scaleY) * ART_RES;
    return [v.x + (p.facing < 0 ? -dx : dx), v.y + dy];
  }

  /** The carry frame nearest arm angle a (for the pick-up and the swing). */
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

  private updateChair(dt: number) {
    const p = this.player;
    const q = this.queen;
    const c = this.chair;
    const SC = WrestleScene.CHAIR_S / ART_RES;
    const LEN = CHAIR_H * WrestleScene.CHAIR_S;
    if (!c) {
      if (!this.fighting || this.chairsLeft <= 0) return;
      this.chairIn -= dt;
      // (one every 10–13 s, or sooner as she weakens: all 5 come before she's done)
      const n = CHAIRS - this.chairsLeft;
      if (this.chairIn > 0 && q.hp > CHAIR_AT_HP[n]) return;
      this.chairsLeft--;
      this.chairIn = 10 + Math.random() * 3;
      // one comes flying in from the crowd: CHAIR!
      const x = this.ringSpot();
      const img = this.add.image(x, this.cameras.main.worldView.top - 50, 'wr-chair').setScale(SC).setDepth(DEPTH.pickups);
      const shadow = this.add.image(x, MAT_Y + 2, 'softshadow').setDepth(DEPTH_W.shadows).setDisplaySize(10, 4).setAlpha(0.2);
      this.chair = { img, shadow, state: 'fall', vy: 60, t: 0, bounced: false, a: -1.75, swing: -1, cd: 0, hit: false };
      this.flashJumbo({ kind: 'big', text: 'CHAIR!', sub: 'GRAB IT: IT COUNTS DOUBLE', color: '#ffd23f', bg: '#3a4652' }, 1800);
      this.ribbonMsg = { text: 'CHAIR! CHAIR! CHAIR!', color: '#e2e7ec', bg: '#3a4652', t0: this.clock / 1000 };
      this.excitedUntil = this.clock + 1800;
      sfx.cheer();
      return;
    }
    c.t += dt;
    // (lying flat on the mat, it's this high off it at its middle)
    const lieY = MAT_Y - (CHAIR_W * WrestleScene.CHAIR_S) / 2 + 2;
    if (c.state === 'fall') {
      c.vy += GRAVITY * 0.8 * dt;
      c.img.y += c.vy * dt;
      c.img.rotation += dt * (c.bounced ? 3 : 7);
      const h = Math.max(0, MAT_Y - c.img.y);
      c.shadow.setDisplaySize(40 + 40 * Math.max(0, 1 - h / 300), 9).setAlpha(0.15 + 0.3 * Math.max(0, 1 - h / 300));
      if (c.img.y >= lieY) {
        c.img.y = lieY;
        if (!c.bounced && c.vy > 200) {
          c.bounced = true;
          c.vy = -c.vy * 0.3;
          sfx.clank();
          this.fx.dust(c.img.x, MAT_Y, 6);
          this.shakeRopes(2);
        } else {
          c.state = 'lie';
          c.t = 0;
          c.img.rotation = Math.PI / 2 - 0.04;
          sfx.clank();
        }
      }
    } else if (c.state === 'lie') {
      // grab it quick: it fades away
      c.img.setAlpha(c.t > 4.5 && Math.floor(c.t * 8) % 2 ? 0.35 : 1);
      if (c.t > 6.5) {
        this.tweens.add({ targets: [c.img, c.shadow], alpha: 0, duration: 250, onComplete: () => (c.img.destroy(), c.shadow.destroy()) });
        this.chair = null;
        return;
      }
      if (this.fighting && p.alive && Math.abs(p.x - c.img.x) < LEN / 2 + 6 && p.bottom > MAT_Y - 40 && p.bottom < MAT_Y + 12) {
        // pick it up: bend down, grab it by the feet, and up over your head it goes
        c.state = 'held';
        c.a = CARRY_SWING.lift;
        c.img.setAlpha(1).setDepth(DEPTH.players - 0.1).setOrigin(0.5, (CHAIR_H - 2) / (CHAIR_H + 4));
        c.shadow.setVisible(false);
        p.sheet = makeCarrySheet(this, p.char);
        this.game.events.emit('wrestle-chair', true);
        sfx.clank();
        this.fx.popText(p.x, p.body.top - 20, 'CHAIR!', '#e2e7ec', 18);
        c.swing = -2; // (-2: lifting)
        this.chairHurts = 0;
        c.t = 0;
      }
    }
    if (c.state !== 'held') return;
    // ── held: up over your head; when she's in reach, you swing it (automatically) ──
    c.cd -= dt;
    const toward = (Math.sign(q.x - p.x) || p.facing) as Side;
    const gap = Math.abs(q.x - p.x) - q.body.halfWidth;
    const inReach = q.hp > 0 && gap < LEN * 0.85 && q.top < p.bottom + 6 && q.bottom > p.body.top - LEN * 0.7;
    if (c.swing === -2) {
      // lifting
      const u = Math.min(1, c.t / 0.24);
      c.a = CARRY_SWING.lift + (-1.75 - CARRY_SWING.lift) * (u * u * (3 - 2 * u));
      p.frameOverride = u < 1 ? WrestleScene.carryFrame(c.a) : null;
      if (u >= 1) c.swing = -1;
    }
    // (a press during a swing or the short reload isn't lost: the next swing comes once it's ready)
    if (this.firePressed && (c.swing >= 0 || c.cd > 0)) c.queued = true;
    if (c.swing === -1 && c.cd <= 0 && (this.firePressed || c.queued) && !this.climb) {
      c.queued = false;
      // the CHAIR button: swing it (if she's right there, turn to her)
      c.swing = 0;
      c.hit = false;
      if (inReach && gap < 20) p.facing = toward;
      sfx.whoosh();
    }
    if (c.swing >= 0) {
      // wind up (back), then over the top and down onto her
      c.swing += dt;
      const t = c.swing;
      const UP = 0.09;
      const DOWN = 0.17;
      if (t < UP) c.a = -1.75 + (CARRY_SWING.sw0 + 1.75) * (t / UP);
      else c.a = CARRY_SWING.sw0 + (CARRY_SWING.sw3 - CARRY_SWING.sw0) * Math.min(1, (t - UP) / DOWN) ** 1.4;
      p.frameOverride = WrestleScene.carryFrame(c.a);
      if (!c.hit && c.a > -0.75) {
        c.hit = true;
        if (inReach && toward === p.facing && this.chairHit()) return;
      }
      if (t > UP + DOWN + 0.04) {
        // (a very short breather before the next swing: not rapid fire)
        c.a = -1.75;
        c.swing = -1;
        c.cd = 0.2;
        p.frameOverride = null;
      }
    }
    // the chair, gripped in both hands, carrying on along the arms
    const [hx, hy] = this.heroHand(c.a);
    const dirA = p.facing > 0 ? c.a : Math.PI - c.a;
    c.img.setPosition(hx, hy).setRotation(dirA + Math.PI / 2).setFlipX(p.facing < 0);
  }

  /** Hurt while holding the chair: you drop it (and it won't be there long). */
  private dropChair() {
    const c = this.chair;
    if (!c || c.state !== 'held') return;
    const p = this.player;
    p.sheet = null;
    p.frameOverride = null;
    this.game.events.emit('wrestle-chair', false);
    c.state = 'fall';
    c.vy = -200;
    c.bounced = true;
    c.t = 0;
    c.img.setDepth(DEPTH.pickups).setOrigin(0.5);
    c.shadow.setVisible(true).setX(c.img.x);
    this.time.delayedCall(10, () => {
      if (this.chair === c) c.t = 3.5;
    });
  }

  /** WHACK! The chair over her head: two hits, and it's bent out of shape and gone. */
  private chairHit() {
    const c = this.chair!;
    const q = this.queen;
    const p = this.player;
    // (out of your hands before the hit counts: if it's the knock-out, the ending tidies away any
    // chair still lying about, and this one's busy flying off her head)
    this.chair = null;
    // (a chair that connects always counts — even while she's still flashing from your last hit —
    // and then it's spent: one hit per chair)
    q.invulnUntil = 0;
    // (swung off the top rope, mid-dive: three)
    const fromTop = !!this.dive;
    if (!this.hitQueen(fromTop ? 3 : 2, fromTop ? 'topchair' : 'chair', p.x)) {
      this.chair = c;
      return false;
    }
    p.sheet = null;
    p.frameOverride = null;
    this.game.events.emit('wrestle-chair', false);
    c.shadow.destroy();
    const [x, y] = [c.img.x, c.img.y];
    c.img.setTexture('wr-chair-bent').setOrigin(0.5).setPosition(x + p.facing * 30, Math.min(y, q.top + 10));
    sfx.clank();
    this.time.delayedCall(70, () => sfx.clank());
    this.cameras.main.shake(260, 0.012);
    this.fx.stars(q.x, q.top + 6, 10);
    this.fx.debris(q.x, q.top + 10);
    const dir = p.facing;
    this.tweens.add({ targets: c.img, x: c.img.x + dir * 110, y: MAT_Y - 14, rotation: c.img.rotation + dir * 4, duration: 700, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: c.img, alpha: 0, delay: 450, duration: 350, onComplete: () => c.img.destroy() });
    return true;
  }

  // ── her heavier moves ──

  /** A heavy landing: the camera and the ring rumble. */
  queenLanded(q: Queen, vy: number) {
    const k = Math.min(1.6, vy / 480);
    this.cameras.main.shake(130, 0.0045 * k);
    this.fx.dust(q.body.left + 6, q.bottom, 3);
    this.fx.dust(q.body.right - 6, q.bottom, 3);
    this.shakeRopes(1.5 * k);
    if (vy > 520) sfx.thud();
  }

  /** Poo rolling along the mat (jump it!). */
  private spawnWave(x: number, dir: number, speed = 230) {
    const img = this.add.image(x, MAT_Y + 2, 'wr-poowave', 'w0').setOrigin(0.5, 34 / 36).setScale(0.4 / 3 * 1.1).setFlipX(dir < 0).setDepth(DEPTH.enemies);
    this.waves.push({ img, dir, life: 1.8, t: 0, speed });
  }

  /** Her big lump of poo, like the Giant Plops': it lands near you and rolls on at you. */
  heaveAt(q: Queen, x: number) {
    const sx = q.x + q.facing * 30;
    const sy = q.top + 12;
    // (it lands just short of you, then rolls on at you: jump it)
    const dir = Math.sign(x - sx) || q.facing;
    const tx = Phaser.Math.Clamp(x - dir * 75, ROPE_L + 20, ROPE_R - 20);
    const G = GRAVITY * 0.7;
    const t = Phaser.Math.Clamp(Math.abs(tx - sx) / 330, 0.6, 1.2);
    const vx = (tx - sx) / t;
    const vy = (MAT_Y - 4 - sy - 0.5 * G * t * t) / t;
    const img = this.add.image(sx, sy, 'wr-poo').setScale(2.4 / ART_RES).setDepth(DEPTH.projectiles);
    this.lobs.push({ img, vx, vy, big: (Math.sign(tx - sx) || q.facing) as Side });
    q.spr.setFrame('yell0');
    sfx.spit();
  }

  // ───────────────────────────────────────────── camera, screens, HUD ──

  private updateCamera(dt: number, snap = false) {
    const cam = this.cameras.main;
    const base = Math.min(this.scale.height / VIEW_H, this.scale.width / MIN_VIEW_W);
    if (!this.camManual) {
      let tx: number;
      let ty: number;
      let tz: number;
      if (this.camFocus) {
        tx = this.camFocus.x;
        ty = this.camFocus.y;
        tz = this.camFocus.zoom;
      } else {
        const p = this.player;
        const q = this.queen;
        tx = p.x * 0.62 + q.x * 0.38;
        // (a touch wider than a level, so the whole jumbotron — her hits to go — and the floor round
        // the ring both fit: the view's top sits just above the jumbotron)
        tz = 0.92;
        ty = WY(JUMBO.y) - 8 + this.scale.height / (base * tz) / 2;
      }
      const k = snap ? 1 : 1 - Math.exp(-dt * 3.2);
      this.camX += (tx - this.camX) * k;
      this.camY += (ty - this.camY) * k;
      this.camZ += (tz - this.camZ) * (snap ? 1 : 1 - Math.exp(-dt * 2.4));
      this.camRot *= snap ? 0 : Math.exp(-dt * 4);
    }
    const zoom = base * this.camZ;
    cam.setZoom(zoom);
    cam.setRotation(this.camRot);
    const vw = this.scale.width / zoom;
    const vh = this.scale.height / zoom;
    const x = Phaser.Math.Clamp(this.camX, Math.min(vw / 2, WORLD_W / 2), Math.max(WORLD_W - vw / 2, WORLD_W / 2));
    const y = Phaser.Math.Clamp(this.camY, Math.min(vh / 2, WORLD_H / 2), Math.max(WORLD_H - vh / 2, WORLD_H / 2));
    cam.centerOn(x, y);
  }

  private countJumbo(): JumboContent {
    const n = this.queen?.hp ?? HITS;
    return { kind: 'big', text: `${n} HIT${n === 1 ? '' : 'S'} TO GO`, sub: n <= 2 ? 'SHE’S ALMOST DONE!' : 'QUEEN PLOP vs ' + characterById(this.wd.charId).name.toUpperCase(), color: '#ffd23f', bg: '#3a1d0c' };
  }

  private flashJumbo(c: JumboContent, ms: number) {
    this.jumbo = c;
    this.jumboUntil = this.clock + ms;
  }

  private drawScreens() {
    const t = this.clock / 1000;
    const ctx = this.jumboTex.getContext();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawWrestleJumbo(ctx, this.jumbo, t, [
      ['POO PALACE', '#ffd23f'],
      [`QUEEN PLOP vs ${characterById(this.wd.charId).name.toUpperCase()}`, '#ffffff'],
      ['TITLE MATCH', '#7fe7ff'],
      ['POOPA COLA', '#ffffff'],
    ]);
    this.jumboTex.refresh();
    const rctx = this.ribbonTex.getContext();
    rctx.setTransform(2, 0, 0, 2, 0, 0);
    drawRibbonScreen(rctx, t, this.ribbonMsg);
    this.ribbonTex.refresh();
  }

  private emitHud(force = false) {
    const p = this.player;
    const s: HudState = {
      charId: p.char.id,
      name: p.char.name,
      aura: 0,
      rootbeer: bank.rootbeer,
      stamina: Math.round(p.stamina * 100) / 100,
      exhausted: p.exhausted,
      running: p.running,
      lives: this.hearts,
    };
    const key = `${s.lives}|${s.aura}|${s.rootbeer}|${s.stamina}|${s.exhausted}|${s.running}`;
    if (!force && key === this.lastHud) return;
    this.lastHud = key;
    this.game.events.emit('hud', s);
  }

  /** TV-style name card in the corner (null hides it), like the King's in basketball. */
  private lowerThird(name: string | null, sub = '') {
    const el = this.dom.querySelector<HTMLElement>('.wr-l3')!;
    if (!name) return el.classList.remove('show');
    el.querySelector('b')!.textContent = name;
    el.querySelector('span')!.textContent = sub;
    el.classList.add('show');
  }

  private calloutToken = 0;
  private callout(html: string, cls = '', ms = 1200) {
    const el = this.dom.querySelector<HTMLElement>('.wr-callout')!;
    el.innerHTML = html;
    el.className = `wr-callout show ${cls}`;
    const token = ++this.calloutToken;
    this.time.delayedCall(ms, () => token === this.calloutToken && (el.className = 'wr-callout'));
  }

  /** A speech bubble over someone's head (world point), for `ms`. */
  private say(html: string, wx: number, wy: number, ms: number) {
    const el = this.dom.querySelector<HTMLElement>('.wr-speech')!;
    el.innerHTML = html;
    el.hidden = false;
    const place = () => {
      const cam = this.cameras.main;
      // (the game draws at up to 2× the screen's pixels: the page's own pixels are what the bubble needs)
      const css = this.game.canvas.getBoundingClientRect();
      const k = css.width / this.scale.width;
      const sx = (wx - cam.worldView.x) * cam.zoom * k;
      const sy = (wy - cam.worldView.y) * cam.zoom * k;
      const half = el.offsetWidth / 2 + 10;
      const x = Phaser.Math.Clamp(sx, half, Math.max(half, css.width - half));
      el.style.left = `${x}px`;
      // (never off the top of the screen)
      el.style.top = `${Math.max(el.offsetHeight + 30, sy)}px`;
      el.style.setProperty('--tail', `${Phaser.Math.Clamp(sx - x, -(half - 34), half - 34)}px`);
    };
    place();
    const ev = this.time.addEvent({ delay: 16, loop: true, callback: place });
    return this.wait(ms).then(() => {
      ev.remove();
      el.hidden = true;
    });
  }

  private wait(ms: number) {
    return new Promise<void>((res) => this.time.delayedCall(ms, () => res()));
  }
  /** A wait that ends early if the intro is skipped. */
  private async iwait(ms: number) {
    const end = this.clock + ms;
    while (this.clock < end && !this.skipping) await this.wait(Math.min(50, end - this.clock));
  }

  private setDark(a: number, ms: number) {
    this.tweens.add({ targets: this.dark, fillAlpha: a, duration: ms });
  }
  private aimSpot(x: number, footY: number, alpha: number, ms = 300) {
    this.spot.setPosition(x, footY + 10).setScale(0.55, (footY + 60) / 700);
    this.tweens.add({ targets: this.spot, alpha, duration: ms });
  }

  // ───────────────────────────────────────────── the show ──

  /** A cutscene move: `fn(u)` for u 0→1 over `ms` (finishes at once if the intro is skipped). */
  private glide(ms: number, fn: (u: number) => void, ease = 'Sine.easeInOut') {
    return new Promise<void>((res) => {
      if (this.skipping) return res();
      let done = false;
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        ease,
        onUpdate: (tw) => {
          if (done) return;
          if (this.skipping) {
            done = true;
            res();
            return;
          }
          fn(tw.getValue() ?? 0);
        },
        onComplete: () => {
          if (!done) fn(1);
          done = true;
          res();
        },
      });
    });
  }

  /** A camera move from where it is now to (x, y) at zoom z, tilted by rot. */
  private camTo(x: number, y: number, z: number, ms: number, rot = 0, ease = 'Sine.easeInOut') {
    const a = { x: this.camX, y: this.camY, z: this.camZ, r: this.camRot };
    // (a new move takes over from one still going)
    const tok = ++this.camTok;
    return this.glide(ms, (u) => {
      if (tok !== this.camTok) return;
      this.camX = a.x + (x - a.x) * u;
      this.camY = a.y + (y - a.y) * u;
      this.camZ = a.z + (z - a.z) * u;
      this.camRot = a.r + (rot - a.r) * u;
    }, ease);
  }
  private cut(x: number, y: number, z: number, rot = 0) {
    this.camX = x;
    this.camY = y;
    this.camZ = z;
    this.camRot = rot;
  }

  /** Flashbulbs going off all over the crowd. */
  private flashbulbs(n: number, over: number) {
    for (let i = 0; i < n; i++)
      this.time.delayedCall(Math.random() * over, () => {
        if (!this.inIntro) return;
        const x = WX(-120 + Math.random() * 1520);
        const y = WY(30 + Math.random() * 250);
        const img = this.add.image(x, y, 'camflash').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_W.spot).setScale(0.4 + Math.random() * 0.5).setAlpha(0.95);
        this.tweens.add({ targets: img, alpha: 0, scale: img.scale * 1.4, duration: 220 + Math.random() * 160, onComplete: () => img.destroy() });
      });
  }

  /** Pyro: sparks bursting up from a point. */
  private pyro(x: number, y: number) {
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 110, () => this.fx.sparkle(x + (Math.random() - 0.5) * 20, y - i * 18, 12));
    this.fx.stars(x, y - 10, 4);
  }

  /** Point a sweeping rafters beam at a world point. */
  private aimSweep(img: Phaser.GameObjects.Image, x: number, y: number) {
    return -Math.atan2(x - img.x, y - img.y);
  }

  /**
   * Her entrance (about 9 s), filmed like a big TV show with the camera always on the move: across
   * the crowd to the jumbotron, a crash zoom out as the lights go down and a spotlight finds her,
   * she struts to her corner ("POOPA!"), climbs to the top turnbuckle, "Welcome to MY Poo Palace!",
   * and leaps in. Skip jumps straight to the leap.
   */
  private async intro() {
    const q = this.queen;
    const p = this.player;
    this.inIntro = true;
    // (coming from the level, the TV bars are covering the screen: they sweep away into her entrance — no title
    // card on them, her name card comes with the spotlight)
    // she's the star tonight: lit, and in front of the dark
    q.spr.setDepth(DEPTH_W.spot + 0.3);
    q.shadow.setDepth(DEPTH_W.spot + 0.2);
    const startX = WX(760);
    q.spr.setPosition(startX, MAT_Y).setAlpha(0);
    q.shadow.setPosition(startX, MAT_Y + 2).setAlpha(0);
    q.facing = -1;
    q.spr.setFlipX(false).setFrame('idle');
    this.dark.fillAlpha = 0.72;
    this.camManual = true;
    const jx = WX(JUMBO.x + (JUMBO.w * JUMBO.s) / 2);
    const jy = WY(JUMBO.y + (JUMBO.h * JUMBO.s) / 2);
    this.cut(WX(40), WY(165), 1.6, 0.04);
    this.updateCamera(0, true);
    this.flashJumbo({ kind: 'big', text: 'TONIGHT!', sub: 'TITLE MATCH · LIVE FROM THE POO PALACE', color: '#ffd23f', bg: '#c8102e' }, 1e9);
    // two beams sweeping the crowd from the rafters
    for (const sx of [WX(160), WX(1120)]) {
      const img = this.add.image(sx, WY(-80), 'spot').setOrigin(0.5, 0).setScale(0.42, 0.92).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_W.spot).setAlpha(0.75);
      img.rotation = sx < WORLD_W / 2 ? -0.7 : 0.7;
      this.tweens.add({ targets: img, rotation: sx < WORLD_W / 2 ? 0.5 : -0.5, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.sweeps.push(img);
    }
    const skip = this.dom.querySelector<HTMLElement>('.wr-skip')!;
    await this.wait(this.wd.checkpoint === -1 && !this.wd.result?.seconds ? 300 : 450);
    void stingerReveal();
    skip.hidden = false;
    playHoops();
    sfx.drum();

    // ── 1. one sweeping move: across the crowd (flashbulbs going off) and up onto the jumbotron ──
    this.excitedUntil = this.clock + 6000;
    sfx.cheer();
    this.flashbulbs(24, 1900);
    this.ribbonMsg = { text: 'QUEEN PLOP ♛ QUEEN PLOP', color: '#ff9ccf', bg: '#5a1030', t0: this.clock / 1000 };
    await this.camTo(jx, jy + 6, 2.35, 1600, -0.018, 'Sine.easeInOut');
    // (and stay on it a moment, so it reads)
    // (and stay on it, so both its messages read: TONIGHT!… then her title)
    await this.camTo(jx, jy + 4, 2.46, 1800, -0.012, 'Sine.easeOut');
    if (!this.skipping) {
      this.jumbo = { kind: 'title' };
      this.jumboUntil = 0;
      sfx.drum();
    }
    await this.camTo(jx, jy + 3, 2.52, 1900, -0.008, 'Sine.easeInOut');

    // ── 2. a crash zoom out to the ring… lights down, BOOM: a spotlight finds her ──
    if (!this.skipping) {
      this.setDark(0.82, 350);
      for (const img of this.sweeps) this.tweens.add({ targets: img, alpha: 0.25, duration: 300 });
      await this.camTo(startX - 40, MAT_Y - 95, 1.0, 550, 0.025, 'Quad.easeIn');
    }
    if (!this.skipping) {
      this.jumbo = { kind: 'title' };
      sfx.thud();
      sfx.cheer();
      q.spr.setAlpha(1);
      q.shadow.setAlpha(0.45);
      q.spr.setFrame('yell1');
      this.aimSpot(startX, MAT_Y, 0.9, 60);
      this.cameras.main.flash(160, 255, 230, 240);
      this.cameras.main.shake(180, 0.008);
      this.pyro(startX - 40, MAT_Y);
      this.pyro(startX + 40, MAT_Y);
      this.flashbulbs(14, 900);
      this.lowerThird('QUEEN PLOP', 'Queen of the Poo Palace · undefeated');
    }

    // ── 3. she struts to her corner ("POOPA!"), the camera swinging in alongside her ──
    const climbX = ROPE_R - 26;
    if (!this.skipping) {
      void this.camTo(climbX - 70, MAT_Y - 70, 1.6, 1500, -0.03, 'Sine.easeInOut');
      this.time.delayedCall(500, () => {
        if (!this.inIntro || this.skipping) return;
        this.fx.popText(q.spr.x, q.spr.y - 120, 'POOPA!', '#ff9ccf', 22);
        sfx.poopa(1);
        this.flashbulbs(8, 500);
      });
    }
    {
      const fromX = q.spr.x;
      q.facing = 1;
      q.spr.setFlipX(true);
      const ms = 1500;
      await this.glide(ms, (u) => {
        const x = fromX + (climbX - fromX) * u;
        // a strut: a little bounce in every step
        const ph = u * (ms / 1000) * 7;
        q.spr.setPosition(x, MAT_Y - Math.abs(Math.sin(ph * Math.PI)) * 4);
        q.spr.setFrame(u > 0.3 && u < 0.5 ? 'yell1' : (['walk0', 'walk1', 'walk2', 'walk3'] as const)[Math.floor(ph * 2) % 4]);
        q.shadow.setPosition(x, MAT_Y + 2);
        this.spot.setX(x);
      }, 'Linear');
    }

    // ── 4. up the corner ropes to the top turnbuckle, the camera rising with her ──
    if (!this.skipping) {
      q.spr.setFrame('look');
      sfx.drum();
      void this.camTo(POST_R - 70, POST_TOP - 60, 1.75, 1500, 0.03, 'Sine.easeInOut');
      for (const img of this.sweeps) this.tweens.add({ targets: img, alpha: 0.8, duration: 400 });
    }
    const steps: [number, number][] = [
      [POST_R - 18, MAT_Y - RING.ropes[0] * K],
      [POST_R - 13, MAT_Y - RING.ropes[1] * K],
      [POST_R - 8, MAT_Y - RING.ropes[2] * K],
      [POST_R, POST_TOP],
    ];
    for (let i = 0; i < steps.length && !this.skipping; i++) {
      const fx = q.spr.x;
      const fy = q.spr.y;
      const [tx, ty] = steps[i];
      await this.glide(300, (u) => {
        q.spr.setPosition(fx + (tx - fx) * u, fy + (ty - fy) * u - Math.sin(Math.PI * u) * 10);
        q.spr.setFrame(u < 0.5 ? 'run1' : 'run0');
        q.shadow.setAlpha(0.45 * (1 - (MAT_Y - q.spr.y) / 120));
        this.spot.setPosition(q.spr.x, q.spr.y + 10).setScale(0.55, (q.spr.y + 60) / 700);
        for (const img of this.sweeps) img.rotation += (this.aimSweep(img, q.spr.x, q.spr.y - 40) - img.rotation) * 0.2;
      }, 'Quad.easeOut');
      if (this.skipping) break;
      // her weight on the rope: it dips, and springs back
      if (i < 3) {
        this.sagV[1][3 + i] += 110;
        this.sagV[1][i] += 55;
        this.ropeHit(1, 3);
      }
      sfx.bump();
      q.spr.setScale((QS / Q_RES) * 1.08, (QS / Q_RES) * 0.92);
      this.tweens.add({ targets: q.spr, scaleX: QS / Q_RES, scaleY: QS / Q_RES, duration: 160 });
      await this.iwait(70);
    }
    for (const img of this.sweeps) this.tweens.killTweensOf(img);

    // ── 5. on top: pyro, everyone up, and a word from Her Majesty (plenty of room over her head) ──
    this.lowerThird(null);
    if (!this.skipping) {
      q.facing = -1;
      q.spr.setFlipX(false).setFrame('yell1');
      this.shakeRopes(4);
      this.pyro(POST_R - 30, POST_TOP);
      this.pyro(POST_R + 30, POST_TOP);
      this.cameras.main.flash(180, 255, 235, 245);
      sfx.cheer();
      sfx.roar();
      this.flashbulbs(24, 2200);
      this.excitedUntil = this.clock + 3500;
      this.flashJumbo({ kind: 'big', text: 'QUEEN PLOP!', sub: 'THE QUEEN OF THE POO PALACE', color: '#ff9ccf', bg: '#5a1030' }, 1e9);
      for (const img of this.sweeps) this.tweens.add({ targets: img, rotation: this.aimSweep(img, POST_R, POST_TOP - 40), duration: 300 });
      void this.camTo(POST_R - 70, POST_TOP - 100, 1.5, 450, -0.012, 'Quad.easeOut').then(() => this.camTo(POST_R - 55, POST_TOP - 102, 1.62, 1900, 0.01, 'Sine.easeInOut'));
      const yell = this.time.addEvent({ delay: 140, loop: true, callback: () => q.spr.setFrame(q.spr.frame.name === 'yell0' ? 'yell1' : 'yell0') });
      await this.iwait(80);
      if (!this.skipping) await Promise.race([this.say('“Welcome to MY <b>Poo Palace</b>!”', POST_R, POST_TOP - 136, 2000), this.iwait(2000)]);
      yell.remove();
    }
    this.dom.querySelector<HTMLElement>('.wr-speech')!.hidden = true;

    // ── 7. she leaps into the ring ──
    this.inIntro = false;
    this.lowerThird(null);
    skip.hidden = true;
    this.tweens.killTweensOf(this.spot);
    for (const img of this.sweeps) {
      this.tweens.killTweensOf(img);
      this.tweens.add({ targets: img, alpha: 0, duration: 400, onComplete: () => img.destroy() });
    }
    this.sweeps = [];
    q.spr.setAlpha(1).setScale(QS / Q_RES).setFlipX(false);
    q.shadow.setAlpha(0.45);
    q.facing = -1;
    if (this.skipping) {
      q.spr.setPosition(POST_R, POST_TOP);
      this.spot.setAlpha(0);
    }
    q.spr.setFrame('run1');
    this.tweens.add({ targets: this.spot, alpha: 0, duration: 300 });
    this.setDark(0, 500);
    this.camManual = false;
    p.view.setAlpha(1);
    const landX = WX(820);
    // (the camera rides the leap down, then eases out to the fight)
    this.camFocus = { x: landX + 40, y: MAT_Y - 80, zoom: 1.3 };
    const fromX = q.spr.x;
    const fromY = q.spr.y;
    sfx.whoosh();
    await new Promise<void>((res) =>
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: this.skipping ? 1 : 650,
        onUpdate: (tw) => {
          const u = tw.getValue() ?? 0;
          q.spr.setPosition(fromX + (landX - fromX) * u, fromY + (MAT_Y - fromY) * u - Math.sin(Math.PI * u) * 70);
          q.shadow.setPosition(q.spr.x, MAT_Y + 2);
        },
        onComplete: () => res(),
      }),
    );
    q.spr.setDepth(DEPTH_W.queen);
    q.shadow.setDepth(DEPTH_W.shadows);
    q.body.setAllowGravity(true);
    q.body.reset(landX, MAT_Y - q.body.halfHeight - 2);
    this.camFocus = null;
    this.cameras.main.shake(240, 0.01);
    sfx.thud();
    this.shakeRopes(6);
    this.fx.dust(landX, MAT_Y, 12);
    this.callout('FIGHT!', 'go', 1000);
    // (the count of hits to go goes up on the jumbotron now the fight's on)
    this.jumbo = this.countJumbo();
    this.jumboUntil = 0;
    sfx.whistle();
    sfx.cheer();
    q.setMode('idle', 0.6);
    // (the intro's over: a skip mustn't carry on cutting short the camera moves in the ending)
    this.skipping = false;
    this.fighting = true;
    this.emitHud(true);
    this.game.events.emit('wrestle-fight');
  }

  /** Her last hit: down she goes… "you'll never out-wrestle THE KING!"… and there he is, and he runs. */
  private async win() {
    if (this.ended) return;
    this.ended = true;
    this.game.events.emit('boss-cutscene');
    this.fighting = false;
    const q = this.queen;
    const p = this.player;
    q.setMode('down');
    q.body.setVelocity(0, -200);
    q.spr.setFrame('hurt');
    sfx.explode();
    sfx.cheer();
    this.cameras.main.flash(250, 255, 245, 220);
    this.cameras.main.shake(400, 0.016);
    this.shakeRopes(9);
    this.excitedUntil = this.clock + 6000;
    this.flashJumbo({ kind: 'big', text: 'K.O.!', sub: 'NEW CHAMPION', color: '#ffd23f', bg: '#2a6a1a' }, 1e9);
    this.callout('K.O.!', 'go', 1600);
    this.confetti.burst(q.x, q.top, 260, { power: 1300, spread: Math.PI, scale: 0.6 });
    for (const r of this.rockets) r.fizzle();
    for (const w of this.waves) w.img.destroy();
    this.waves = [];
    for (const l of this.lobs) l.img.destroy();
    this.lobs = [];
    if (this.chair) {
      this.chair.img.destroy();
      this.chair.shadow.destroy();
      this.chair = null;
    }
    p.sheet = null;
    p.frameOverride = null;
    this.game.events.emit('wrestle-chair', false);
    this.heartPick?.img.destroy();
    this.heartPick = null;
    await this.wait(500);
    // flat out on the mat, dazed: a splat as she lands, then she lies there wobbling, stars going round
    q.ko = true;
    q.body.setVelocity(0, 0).setAllowGravity(false);
    const koY = MAT_Y + 2;
    q.spr.setTexture('wr-queen-ko', 'ko0').setOrigin(0.5, QUEEN_KO_GROUND / QUEEN_KO_H).setPosition(q.x, koY).setFlipX(false).setTint(0xffffff);
    q.spr.setScale((QS / Q_RES) * 1.12, (QS / Q_RES) * 0.7);
    this.tweens.add({ targets: q.spr, scaleX: QS / Q_RES, scaleY: QS / Q_RES, duration: 420, ease: 'Back.easeOut' });
    let koF = 0;
    this.time.addEvent({ delay: 210, loop: true, callback: () => q.spr.active && q.spr.setFrame(QUEEN_KO_FRAMES[++koF % 4]) });
    q.shadow.setPosition(q.x, MAT_Y + 2).setDisplaySize(170, 18).setAlpha(0.5);
    sfx.thud();
    this.fx.dust(q.x - 50, MAT_Y, 8);
    this.fx.dust(q.x + 50, MAT_Y, 8);
    this.fx.pooSplat(q.x, MAT_Y, 12);
    this.cameras.main.shake(260, 0.01);
    this.shakeRopes(6);
    const stars = { x: q.x - 8, y: koY - 6 } as Phaser.GameObjects.Sprite;
    this.fx.dizzy(stars, 12000);
    p.finish();
    this.camFocus = { x: q.x, y: MAT_Y - 70, zoom: 1.6 };
    await this.wait(1200);
    await this.say('“Nice work… but you’ll never out-wrestle <b>THE KING</b>!”', q.x - 6, MAT_Y - 58, 3500);
    // the camera pulls right out: who's that in the front row? (the jumbotron's spotted him)
    this.camFocus = { x: WORLD_W / 2, y: WORLD_H * 0.48, zoom: 0.78 };
    this.flashJumbo({ kind: 'big', text: 'THE KING?!', sub: 'HE WAS HERE ALL ALONG', color: '#ffd23f', bg: '#3d1478' }, 1e9);
    this.setDark(0.45, 600);
    const kx = WX(KING_SEAT.x);
    const ky = WY(KING_SEAT.feet);
    this.king.setVisible(true).setFrame('idle').setFlipX(false);
    this.aimSpot(kx, ky - 6, 0.9, 500);
    sfx.drum();
    await this.wait(1700);
    // up to the jumbotron for a moment…
    this.camManual = true;
    const jx = WX(JUMBO.x + (JUMBO.w * JUMBO.s) / 2);
    const jy = WY(JUMBO.y + (JUMBO.h * JUMBO.s) / 2);
    await this.camTo(jx, jy + 6, 2.2, 500, 0.012, 'Quad.easeOut');
    this.excitedUntil = this.clock + 4000;
    await this.wait(950);
    // …then a crash zoom right onto him
    this.king.setFrame('look');
    await this.camTo(kx - 10, ky - 28, 3.1, 420, -0.04, 'Quad.easeIn');
    this.cameras.main.flash(160, 255, 240, 255);
    this.cameras.main.shake(220, 0.008);
    sfx.thud();
    sfx.drum();
    this.king.setFrame('grin');
    void this.camTo(kx - 14, ky - 31, 3.35, 1800, -0.015, 'Sine.easeOut');
    await this.wait(1700);
    this.king.setFrame('yell1');
    sfx.laugh();
    this.callout('THE KING!', 'bad high', 1300);
    this.flashJumbo({ kind: 'big', text: 'THE KING!', sub: 'AFTER HIM!', color: '#ffd23f', bg: '#3d1478' }, 1e9);
    await this.wait(1200);
    // and he runs for the exit (the camera pulling back to watch him go)
    const tx = WX(TUNNEL.x);
    void this.camTo((kx + tx) / 2, ky - 30, 2.3, 900, 0, 'Sine.easeInOut');
    const run = this.time.addEvent({ delay: 90, loop: true, callback: () => this.king.setFrame(this.king.frame.name === 'run0' ? 'run1' : 'run0') });
    this.tweens.add({ targets: this.spot, x: tx, duration: 900 });
    await new Promise<void>((res) => this.tweens.add({ targets: this.king, x: tx, duration: 900, ease: 'Quad.easeIn', onComplete: () => res() }));
    this.tweens.add({ targets: this.king, alpha: 0, scale: this.king.scale * 0.85, duration: 260 });
    await this.wait(500);
    run.remove();
    this.king.setVisible(false);
    await this.wait(600);
    fadeOutMusic(500);
    const res: ResultState = { ...this.wd.result, aura: this.wd.result?.aura ?? 0, lives: lives.left, level: this.wd.level ?? 3, hoops: undefined };
    this.game.events.emit('level-complete', res);
  }
}

/** For the Bosses menu: what a boss fight needs when you jump straight into it (a practice fight). */
export function bossData(session: Session, charId: string, level: number): WrestleData {
  const ch = characterById(charId);
  return {
    session,
    charId,
    checkpoint: -1,
    level,
    result: { charId, name: ch.name, aura: 1, rootbeer: 0, rootbeerTotal: bank.rootbeer, popped: 0, giants: 0, faints: 0, lives: lives.left, seconds: 0, level, practice: true },
  };
}
