import Phaser from 'phaser';
import { DEPTH } from '../config';
import { LIGHT } from '../core/light';
import { sfx } from '../core/sfx';
import { BOARD, FB_GROUND, FB_H, FB_NUMBERS, FB_W, FIELD, FB_FIELD_TILES, FB_SHADOW, POST, fbChest, fbHands, type FBFrame, type FBTeam } from '../gfx/football';
import { makeFootballArt } from '../gfx/textures';
import type { GameScene } from '../scenes/GameScene';
import type { Player } from './Player';

/**
 * Underwater football on the sea bed (Part 6, the open blue): the Snappers (sea turtles, red) and the
 * Stallions (seahorses, blue and gold), six a side, playing while you swim over — huddle up on the
 * line, "HUT! HIKE!", the linemen crash into each other, the receivers run their routes with the
 * corners on their heels, the quarterback drops back and throws; a catch, a run, a TACKLE (or a
 * TOUCHDOWN, and the scoreboard goes up).
 *
 * And once you're over the field, they throw at YOU: the Snappers' quarterback when you're ahead of
 * him (you're "open"; a receiver now and then too), the Stallions' safety (and now and then the
 * linebacker) when you're coming at them — a clear wind-up ("!", the
 * arm cocked right back), then a spiral that comes out fast and slows in the water, aimed where
 * you're going. A hit costs your nuggies like any hit. A rocket knocks a ball away, or a player down
 * for a moment (a quarterback on his back throws nothing).
 *
 * Nothing here has a physics body: the players walk the field (lanes across it, from the far
 * sideline to the near), the balls fly on their own sums. While the field's off the screen nothing
 * runs at all (and nothing's drawn).
 */

/** How big the players are (world px per unit of their frames; a touch smaller across at the far sideline). */
const K = 0.95;
/** The field band, world px from the ground line: the far lane's feet, and how far the near lane's are below that. */
const LANE_TOP = -3;
const LANE_SPAN = 32;
/** How far the field's yard is (world px). */
const YARD = (FB_FIELD_TILES * 32) / 120;
/** The water: a thrown ball's drag (1/s) and its sink (px/s²). */
const DRAG = 0.95;
const SINK = 230;
/** A ball's radius for hitting you (px). */
const BALL_R = 9;
/** How far they'll throw at you (px), and the wind-up (s). */
const REACH = 660;
const WINDUP = 0.6;
/** Never two throws at you closer together than this (s), and each thrower waits this long between his (s). */
const GAP = 1.2;
const QB_EVERY: [number, number] = [1.7, 2.3];
const S_EVERY: [number, number] = [1.9, 2.6];
/** The linebacker and a receiver throw now and then too. */
const OTHER_EVERY: [number, number] = [2.8, 3.6];
/** Knocked down by a rocket (or a stomp): this long on his back (s). */
const OUT_SECS = 3;
/** Where each drive starts (yards from the left end line): their own 35, so the game's mid-field when you come over. */
const START = 45;

/** Set a depth only when it changes (each setDepth re-sorts the scene's whole display list). */
function depth(o: Phaser.GameObjects.Components.Depth, d: number) {
  if (o.depth !== d) o.setDepth(d);
}

type Role = 'C' | 'G' | 'QB' | 'WR' | 'DL' | 'LB' | 'CB' | 'S';
/** Where each lines up: its place from the line of scrimmage (px; + downfield, towards the Stallions' end) and its lane (0 far … 1 near). */
const FORMATION: Record<FBTeam, [Role, number, number][]> = {
  snappers: [
    ['C', -9, 0.5],
    ['G', -12, 0.26],
    ['G', -12, 0.74],
    ['QB', -50, 0.5],
    ['WR', -15, 0.03],
    ['WR', -15, 0.97],
  ],
  stallions: [
    ['DL', 11, 0.36],
    ['DL', 11, 0.66],
    ['LB', 54, 0.5],
    ['CB', 44, 0.06],
    ['CB', 44, 0.94],
    ['S', 150, 0.5],
  ],
};

interface FBPlayer {
  team: FBTeam;
  role: Role;
  img: Phaser.GameObjects.Sprite;
  num: Phaser.GameObjects.Image;
  /** Where it is (feet: x, and its lane across the field), where it's going, how fast. */
  x: number;
  lane: number;
  tx: number;
  tlane: number;
  speed: number;
  /** 1 facing right, −1 left. */
  face: number;
  /** Its stance while standing (or a timed pose over everything). */
  stand: FBFrame;
  pose: FBFrame | null;
  poseT: number;
  /** Its spot in the formation (from the line), its lane. */
  dx: number;
  home: number;
  runT: number;
  blink: number;
  /** >0: knocked down (s left). */
  out: number;
  /** A little shove in the trenches (linemen). */
  push: number;
}

/** One who throws at you: the quarterback (when you're downfield of him) or the safety (when you're coming at him). */
interface Thrower {
  p: FBPlayer;
  /** +1: throws when you're ahead of him; −1: when you're behind. */
  side: number;
  /** >0 while winding up (s left); the ball in his hand. */
  wind: number;
  ball: Ball | null;
  /** Till he can throw again (s). */
  next: number;
  every: [number, number];
}

interface Ball {
  img: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  /**
   * held: in a player's hand; pass: a scripted flight (a snap, a pass), `done` on arrival; throw: at
   * you, on its own sums (dangerous); loose: dropping to the turf, bouncing, fading; off: not in use.
   */
  mode: 'held' | 'pass' | 'throw' | 'loose' | 'off';
  by: FBPlayer | null;
  /** In the far hand (cocked to throw) rather than tucked in the near one. */
  far: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  /** (pass) from, to, how long, how high it arcs; (throw) where it started and its first speed. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  T: number;
  peak: number;
  done: (() => void) | null;
  spin: number;
  life: number;
  bubT: number;
}

export class FootballGame {
  private readonly left: number;
  private readonly right: number;
  private readonly players: FBPlayer[] = [];
  private readonly balls: Ball[] = [];
  private readonly scenery: Phaser.GameObjects.GameObject[] = [];
  private readonly scoreText: Phaser.GameObjects.Text[] = [];
  private score = [0, 0];
  /** The line of scrimmage, in yards from the left end line (the Snappers drive right). */
  private los = START;
  private phase: 'asleep' | 'line' | 'set' | 'play' | 'live' | 'dead' | 'td' = 'asleep';
  private t = 0;
  /** This play's football (the snap, the pass, the carrier's). */
  private ball: Ball | null = null;
  private carrier: FBPlayer | null = null;
  /** The play's pass is in the air / thrown at you this play. */
  private passed = false;
  private seen = false;
  private shown = true;
  /** Till the next throw at you can start (any thrower), s. */
  private gap = 0;
  private qb!: FBPlayer;
  private safety!: FBPlayer;
  private throwers: Thrower[] = [];
  /** Each team sheet's scale for K (its frames are drawn at a resolution of their own). */
  private sheetK = { snappers: 1, stallions: 1 };
  /** The "!" over whoever's winding up to throw at you (one, made once, moved about). */
  private mark: Phaser.GameObjects.Text;
  /** The quarterback's moment before a pass to a receiver (s left). */
  private qbPass = 0;

  constructor(
    private gs: GameScene,
    x0: number,
    private ground: number,
  ) {
    const w = FB_FIELD_TILES * 32;
    this.left = x0;
    this.right = x0 + w;
    makeFootballArt(gs);
    const T = gs.textures;
    const { END, UP, DOWN, BAND_TOP } = FIELD;
    // the field (just over the ground's top edge, behind the players), the stands behind the far
    // sideline, the scoreboard behind them, a goalpost on each end line
    const size = (img: Phaser.GameObjects.Image, wUnits: number) => img.setScale(wUnits / T.getFrame(img.texture.key).width);
    const front = gs.add.image(x0 - END, ground, 'fb-front').setOrigin(0, UP / (UP + DOWN)).setDepth(DEPTH.tiles + 0.5);
    size(front, w + END * 2);
    const stands = gs.add.image(x0 - END, ground - BAND_TOP + 2, 'fb-stands').setOrigin(0, 1).setDepth(DEPTH.decor - 1);
    size(stands, w + END * 2);
    const bx = x0 + w * 0.22;
    const by = ground - BAND_TOP - 46;
    const board = gs.add.image(bx, by, 'fb-board').setOrigin(0.5, BOARD.FOOT / BOARD.H).setDepth(DEPTH.decor - 1.1);
    size(board, BOARD.W);
    for (let i = 0; i < 2; i++) {
      const t = gs.add
        .text(bx - BOARD.W / 2 + BOARD.SCORE_X, by - BOARD.FOOT + BOARD.SCORE_Y[i], '0', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '13px', color: '#ffd23f' })
        .setOrigin(0.5)
        .setDepth(DEPTH.decor - 1.05);
      this.scoreText.push(t);
    }
    // (the posts stand mid-field across, on the end lines; the left one turned round so its crossbar leans out like the lines)
    const postY = ground + LANE_TOP + LANE_SPAN * 0.5;
    const pl = gs.add.image(x0, postY, 'fb-post-snappers').setOrigin(POST.X / POST.W, POST.FOOT / POST.H).setFlipX(true).setDepth(DEPTH.enemies - 1);
    const pr = gs.add.image(x0 + w, postY, 'fb-post-stallions').setOrigin(POST.X / POST.W, POST.FOOT / POST.H).setDepth(DEPTH.enemies - 1);
    size(pl, POST.W);
    size(pr, POST.W);
    // (flipped about its base: the origin's mirrored too)
    pl.setOrigin(1 - POST.X / POST.W, POST.FOOT / POST.H);
    this.scenery.push(front, stands, board, pl, pr, ...this.scoreText);

    // the teams
    for (const team of ['snappers', 'stallions'] as const) {
      const k = (this.sheetK[team] = (FB_W / T.getFrame(`fb-${team}`, 'idle0').width) * K);
      FORMATION[team].forEach(([role, dx, lane], i) => {
        const x = this.losX + dx;
        const img = gs.add.sprite(x, 0, `fb-${team}`, 'idle0').setOrigin(30 / FB_W, FB_GROUND / FB_H).setScale(k);
        const num = gs.add.image(x, 0, 'fb-num', `${team === 'snappers' ? 's' : 'h'}${FB_NUMBERS[team][i]}`);
        num.setScale((K * 0.5 * 16) / T.getFrame('fb-num', num.frame.name).width);
        const p: FBPlayer = { team, role, img, num, x, lane, tx: x, tlane: lane, speed: 120, face: team === 'snappers' ? 1 : -1, stand: 'idle0', pose: null, poseT: 0, dx, home: lane, runT: Math.random() * 4, blink: 1 + Math.random() * 3, out: 0, push: Math.random() * 6 };
        this.players.push(p);
        if (role === 'QB') this.qb = p;
        if (role === 'S') this.safety = p;
      });
    }
    // the balls (one in play, a couple more to throw at you)
    for (let i = 0; i < 4; i++) {
      const img = gs.add.sprite(0, 0, 'fb-ball', 'b0').setVisible(false).setDepth(DEPTH.projectiles - 1);
      img.setScale((26 * 0.88) / T.getFrame('fb-ball', 'b0').width);
      const shadow = gs.add.image(0, 0, 'fb-shadow').setVisible(false).setDepth(DEPTH.tiles + 0.6);
      shadow.setScale(FB_SHADOW.W / T.getFrame('fb-shadow').width);
      this.balls.push({ img, shadow, mode: 'off', by: null, far: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, x0: 0, y0: 0, x1: 0, y1: 0, T: 1, peak: 0, done: null, spin: 0, life: 0, bubT: 0 });
    }
    const lb = this.players.find((p) => p.role === 'LB')!;
    const wr = this.players.find((p) => p.role === 'WR')!;
    this.throwers = [
      { p: this.qb, side: 1, wind: 0, ball: null, next: 0.4, every: QB_EVERY },
      { p: this.safety, side: -1, wind: 0, ball: null, next: 0.8, every: S_EVERY },
      { p: lb, side: -1, wind: 0, ball: null, next: 2, every: OTHER_EVERY },
      { p: wr, side: 1, wind: 0, ball: null, next: 2.5, every: OTHER_EVERY },
    ];
    this.mark = gs.add
      .text(0, 0, '!', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '24px', color: '#ff5a3c', stroke: '#2a1e2e', strokeThickness: 5 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.text)
      .setVisible(false);
    for (const p of this.players) this.place(p);
    this.show(false);
  }

  // ── where things are ──

  /** The world y the camera keeps in view (the near sideline, and a little more). */
  private get floorView() {
    return this.ground + FIELD.BAND_BOT + 4;
  }

  private get losX() {
    return this.left + this.los * YARD;
  }

  private feetY(p: FBPlayer) {
    return this.ground + LANE_TOP + p.lane * LANE_SPAN;
  }

  private scaleOf(p: FBPlayer) {
    return 0.9 + 0.1 * p.lane;
  }

  /** A hand of a player's (in its current frame) in the world. */
  private hand(p: FBPlayer, far: boolean): [number, number] {
    const h = fbHands(p.team, p.img.frame.name as FBFrame);
    const [hx, hy] = far ? h.far : h.near;
    const k = p.img.scaleX;
    return [p.x + (hx - 30) * k * p.face, this.feetY(p) + (hy - FB_GROUND) * k];
  }

  private get hero() {
    return this.gs.nearestPlayer((this.left + this.right) / 2, this.ground);
  }

  /** Inside the camera's view (not just peeking in at an edge). */
  private onScreen(x: number) {
    const v = this.gs.cameras.main.worldView;
    return x > v.x + v.width * 0.06 && x < v.right - v.width * 0.06;
  }

  private show(on: boolean) {
    if (this.shown === on) return;
    this.shown = on;
    for (const o of this.scenery) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(on);
    for (const p of this.players) {
      p.img.setVisible(on);
      p.num.setVisible(on);
    }
    for (const b of this.balls) if (b.mode === 'held' || b.mode === 'pass') b.img.setVisible(on);
    if (!on) this.mark?.setVisible(false);
  }

  /** Each player (and the number on his back) skipped by the camera while he's off it (see GameScene.cullOffCamera). */
  cullWith(cull: (o: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite) => void) {
    if (!this.shown) return;
    for (const p of this.players) {
      cull(p.img);
      cull(p.num);
    }
  }

  // ── the game ──

  update(dt: number) {
    // (the balls fly on even as the field goes off the screen: one might be on its way to you)
    for (const b of this.balls) if (b.mode !== 'off') this.updateBall(b, dt);
    const v = this.gs.cameras.main.worldView;
    const on = v.right > this.left - FIELD.END - 60 && v.x < this.right + FIELD.END + 60;
    this.show(on);
    if (!on) {
      if (this.gs.camFloor === this.floorView) this.gs.camFloor = null;
      return;
    }
    if (this.phase === 'asleep') this.lineUp();
    this.t += dt;
    this.gap -= dt;
    const hero = this.hero;
    const near = !!hero && hero.alive && hero.x > this.left - 320 && hero.x < this.right + 460 && hero.y < this.ground - 10;
    // (the camera keeps the field in view under you while you're over it)
    this.gs.camFloor = near ? this.floorView : null;
    if (near && !this.seen) {
      this.seen = true;
      this.gs.fx.popText(this.qb.x, this.feetY(this.qb) - 46, '!', '#ff5a3c', 22);
      sfx.whistle();
    }
    this.play(dt, near ? hero : null);
    this.atYou(dt, near ? hero : null);
    for (const p of this.players) this.tick(p, dt, hero);
    // the "!" over the thrower while he winds up (bouncing, growing as the throw comes)
    const th = this.throwers.find((q) => q.wind > 0);
    this.mark.setVisible(!!th);
    if (th) {
      const w = th.p;
      this.mark.setPosition(w.x, this.feetY(w) - 62 * K - Math.abs(Math.sin(this.t * 14)) * 5).setScale(1 + (1 - th.wind / WINDUP) * 0.5);
    }
    if (near && hero) this.touch(hero);
    this.rocketsAtPlayers();
  }

  /** Everyone back to their spots on the line of scrimmage. */
  private lineUp() {
    this.phase = 'line';
    this.t = 0;
    this.passed = false;
    this.carrier = null;
    this.ball = null;
    for (const p of this.players) {
      p.tx = this.losX + p.dx;
      p.tlane = p.home;
      p.stand = 'idle0';
      p.speed = Math.max(130, Math.abs(p.tx - p.x) / 1.6);
    }
    this.qbPass = 0;
  }

  private play(dt: number, hero: Player | null) {
    const hot = !!hero;
    switch (this.phase) {
      case 'line': {
        // (walked back into place; then down in their stances)
        const ready = this.players.every((p) => p.out > 0 || Math.abs(p.x - p.tx) < 4);
        if ((ready && this.t > (hot ? 0.4 : 1)) || this.t > 3) {
          this.phase = 'set';
          this.t = 0;
          for (const p of this.players) p.stand = p.role === 'C' || p.role === 'G' || p.role === 'DL' ? 'set' : 'idle0';
          if (this.up(this.qb)) this.gs.fx.popText(this.qb.x, this.feetY(this.qb) - 44, 'HUT!', '#ffffff', 13);
        }
        break;
      }
      case 'set':
        if (this.t > (hot ? 0.45 : 0.8)) this.snap(hot);
        break;
      case 'play':
        this.playing(dt, hero);
        break;
      case 'live':
        this.running(dt);
        break;
      case 'dead':
        if (this.t > (hot ? 0.7 : 1.3)) this.lineUp();
        break;
      case 'td':
        if (this.t > 2.4) {
          this.los = START;
          this.lineUp();
        }
        break;
    }
  }

  /** HIKE: the centre snaps it back to the quarterback; everyone's off. */
  private snap(hot: boolean) {
    this.phase = 'play';
    this.t = 0;
    this.passed = false;
    const c = this.players.find((p) => p.role === 'C')!;
    if (this.up(c)) this.gs.fx.popText(c.x, this.feetY(c) - 40, 'HIKE!', '#ffd23f', 14);
    sfx.whistle();
    const los = this.losX;
    for (const p of this.players) {
      if (p.out > 0) continue;
      p.stand = 'idle0';
      p.speed = 110;
      switch (p.role) {
        case 'C':
        case 'G':
        case 'DL':
          p.stand = 'block';
          p.tx = los + (p.team === 'snappers' ? -3 : 3);
          break;
        case 'QB':
          p.tx = los - 84;
          p.speed = 70;
          break;
        case 'WR':
          // a go route (far side) and a curl (near side)
          p.tx = los + (p.home < 0.5 ? 270 : 190);
          p.tlane = p.home < 0.5 ? 0.15 : 0.8;
          p.speed = 125 + Math.random() * 15;
          break;
        case 'LB':
          p.tx = los + 70;
          p.speed = 60;
          break;
        case 'CB':
        case 'S':
          break;
      }
    }
    // the snap: back between the centre's legs to the quarterback
    if (!this.up(c) || !this.up(this.qb)) return void (this.phase = 'dead');
    const b = this.take();
    if (!b) return void (this.phase = 'dead');
    this.ball = b;
    const [hx, hy] = this.hand(c, false);
    const [qx, qy] = this.hand(this.qb, false);
    this.fly(b, hx, hy, qx - 10, qy, 6, hot ? 0.22 : 0.3, () => this.hold(b, this.qb, false));
  }

  /** The play's on: routes, blocks; the quarterback drops back and passes (or throws at you). */
  private playing(dt: number, hero: Player | null) {
    const los = this.losX;
    // the corners stick to their receivers, a step behind; the safety drifts over the deeper one
    const wrs = this.players.filter((p) => p.role === 'WR');
    for (const cb of this.players.filter((p) => p.role === 'CB')) {
      const wr = wrs.reduce((a, w) => (Math.abs(w.home - cb.home) < Math.abs(a.home - cb.home) ? w : a));
      cb.tx = wr.x + 16;
      cb.tlane = wr.lane + (cb.home < 0.5 ? 0.06 : -0.06);
      cb.speed = 130;
    }
    if (this.safety.out <= 0 && !this.winding(this.safety)) {
      this.safety.tx = Math.max(los + 150, Math.max(...wrs.map((w) => w.x)) + 50);
      this.safety.speed = 60;
    }
    // (the curl: stop and turn back for it)
    for (const w of wrs) if (w.home >= 0.5 && Math.abs(w.x - w.tx) < 6) w.face = -1;
    const qb = this.qb;
    const b = this.ball;
    if (!b || !this.up(qb)) {
      if (this.t > 1.5) this.whistle();
      return;
    }
    if (b.mode !== 'held' || b.by !== qb || this.passed) {
      // (the pass is out: when it's come down, the play's over unless someone caught it)
      if (this.passed && b.mode !== 'pass' && b.mode !== 'held' && this.t > 0.8) this.whistle();
      if (this.t > 4) this.whistle();
      return;
    }
    // (winding up to throw it at you instead: see atYou)
    if (this.winding(qb)) return;
    // to a receiver, once he's dropped back (a quick release: no "!", it's not at you)
    if (this.qbPass > 0) {
      this.qbPass -= dt;
      qb.pose = 'throw0';
      qb.poseT = 0.1;
      if (this.qbPass <= 0) this.pass(qb, b);
      return;
    }
    if (this.t > 1.25 + (hero ? 0.4 : 0)) this.qbPass = 0.32;
  }

  /** A pass to the open receiver, leading him. */
  private pass(qb: FBPlayer, b: Ball) {
    const wrs = this.players.filter((p) => p.role === 'WR' && p.out <= 0);
    if (!wrs.length) return this.whistle();
    const open = (w: FBPlayer) => Math.min(...this.players.filter((d) => d.team === 'stallions' && d.out <= 0).map((d) => Math.abs(d.x - w.x) + Math.abs(d.lane - w.lane) * 40));
    const to = wrs.reduce((a, w) => (open(w) > open(a) ? w : a));
    qb.pose = 'throw1';
    qb.poseT = 0.35;
    this.passed = true;
    sfx.whoosh();
    const [hx, hy] = this.hand(qb, true);
    const dist = Math.abs(to.x - hx);
    const T = Phaser.Math.Clamp(0.55 + dist / 420, 0.7, 1.4);
    // (leading him; now and then a bit off, and it falls incomplete)
    const ahead = to.face * Math.min(Math.abs(to.tx - to.x), to.speed * T);
    const miss = Math.random() < 0.22 ? (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 30) : 0;
    const lx = to.x + ahead + miss;
    to.tx = to.x + ahead;
    const ly = this.feetY(to) - 30 * K;
    this.fly(b, hx, hy, lx, ly, 60 + dist * 0.12, T, () => {
      if (to.out <= 0 && Math.abs(to.x - lx) < 26 && this.phase === 'play') {
        to.pose = 'catch';
        to.poseT = 0.3;
        sfx.bump();
        this.hold(b, to, false);
        this.carrier = to;
        this.phase = 'live';
        this.t = 0;
      } else {
        this.drop(b, lx > hx ? 60 : -60, -40);
        if (this.phase === 'play') {
          this.gs.fx.popText(lx, this.feetY(to) - 40, 'INCOMPLETE', '#ffffff', 11);
          this.whistle();
        }
      }
    });
  }

  /** After the catch: he runs for the end zone; the defence closes in. A tackle, or a TOUCHDOWN. */
  private running(dt: number) {
    const c = this.carrier;
    if (!c || c.out > 0) return this.whistle();
    c.tx = this.right + 40;
    c.speed = 115;
    c.face = 1;
    for (const d of this.players) {
      if (d.team !== 'stallions' || d.out > 0) continue;
      d.tx = c.x + (d.x < c.x ? -6 : 6);
      d.tlane = c.lane;
      d.speed = 140 + (d.role === 'S' ? 20 : 0);
      if (Math.abs(d.x - c.x) < 14 && Math.abs(d.lane - c.lane) < 0.22) {
        // TACKLE
        sfx.thud();
        c.pose = 'down';
        c.poseT = 0.9;
        d.pose = 'block';
        d.poseT = 0.5;
        this.gs.fx.popText(c.x, this.feetY(c) - 40, 'TACKLE!', '#ffd23f', 12);
        this.los = Phaser.Math.Clamp((c.x - this.left) / YARD, 18, 100);
        this.whistle(0.4);
        return;
      }
    }
    // the blockers and the quarterback jog after the play
    for (const o of this.players) if (o.team === 'snappers' && o !== c && o.out <= 0) {
      o.tx = Math.min(o.tx + dt * 40, c.x - 30);
      o.speed = 90;
    }
    if (c.x > this.left + 110 * YARD) {
      this.phase = 'td';
      this.t = 0;
      sfx.cheer();
      this.gs.fx.popText(c.x, this.feetY(c) - 56, 'TOUCHDOWN!', '#ffd23f', 20);
      this.score[0] += 7;
      this.scoreText[0].setText(String(this.score[0]));
      for (const p of this.players) {
        if (p.out > 0) continue;
        p.tx = p.x;
        if (p.team === 'snappers') p.stand = 'cheer0';
        else p.stand = 'idle0';
      }
      // (he spikes it)
      if (this.ball) this.drop(this.ball, 20, -160);
      this.ball = null;
      return;
    }
    if (this.t > 3.2) {
      // (out of bounds)
      this.los = Phaser.Math.Clamp((c.x - this.left) / YARD, 18, 100);
      this.whistle();
    }
  }

  private whistle(wait = 0) {
    if (this.phase === 'dead' || this.phase === 'td') return;
    this.phase = 'dead';
    this.t = -wait;
    sfx.whistle();
    for (const p of this.players) {
      if (p.out > 0) continue;
      p.tx = p.x;
      if (p.stand === 'block' || p.stand === 'set') p.stand = 'idle0';
    }
    if (this.ball && this.ball.mode === 'held') this.drop(this.ball, 0, -60, true);
    this.ball = null;
    this.carrier = null;
  }

  // ── at you ──

  private canThrowAt(p: FBPlayer, hero: Player) {
    if (this.gs.fatFishFalling) return false;
    if (!hero.alive || hero.y > this.ground - 10) return false;
    const d = Math.abs(hero.x - p.x);
    return d < REACH && d > 60 && this.onScreen(p.x) && this.onScreen(hero.x);
  }

  /** The wind-up: a "!", the arm cocked right back. */
  private windUp(p: FBPlayer) {
    p.pose = 'throw0';
    p.poseT = WINDUP + 0.05;
    sfx.tick();
    this.gap = Math.max(this.gap, GAP);
  }

  private winding(p: FBPlayer) {
    return this.throwers.some((t) => t.p === p && t.wind > 0);
  }

  /**
   * Throws at you: the quarterback when you're downfield of him (you're "open"; with the play's
   * ball if he's got it), the safety when you're coming at him (they've always got a spare ball
   * handy). A wind-up first — a "!", the arm cocked right back — then the throw, if you're still
   * in reach. Never two at once, never while the Fat Fish is coming.
   */
  private atYou(dt: number, hero: Player | null) {
    for (const th of this.throwers) {
      const p = th.p;
      th.next -= dt;
      if (th.wind > 0) {
        th.wind -= dt;
        p.pose = 'throw0';
        p.poseT = 0.2;
        if (th.ball) this.hold(th.ball, p, true);
        if (th.wind <= 0) {
          const b = th.ball;
          th.ball = null;
          th.next = th.every[0] + Math.random() * (th.every[1] - th.every[0]);
          if (b && hero && this.up(p) && this.canThrowAt(p, hero)) this.throwAt(b, p, hero);
          else if (b === this.ball && b) this.hold(b, p, false);
          else if (b) this.put(b);
          // (back to his spot, if they're lining up)
          if (this.phase === 'line' || this.phase === 'set') p.tx = this.losX + p.dx;
        }
        continue;
      }
      if (!hero || th.next > 0 || this.gap > 0 || !this.up(p) || this.phase === 'live' || this.phase === 'td') continue;
      // (once you're over the field, or nearly: not from right across it at you back at the checkpoint)
      if (hero.x < this.left - 140) continue;
      if (th.side > 0 ? hero.x < p.x + 40 : hero.x > p.x - 60) continue;
      if (!this.canThrowAt(p, hero)) continue;
      const own = this.ball && this.ball.mode === 'held' && this.ball.by === p ? this.ball : null;
      const b = own ?? this.take();
      if (!b) continue;
      th.ball = b;
      th.wind = WINDUP;
      p.tx = p.x;
      this.windUp(p);
      this.hold(b, p, true);
    }
  }

  /**
   * The throw at you: a spiral that leaves fast and slows in the water (drag DRAG, sinking SINK), timed
   * to get to where you'll be when it does (a little ahead of you, the way you're going).
   */
  private throwAt(b: Ball, p: FBPlayer, hero: Player) {
    p.pose = 'throw1';
    p.poseT = 0.35;
    p.face = hero.x > p.x ? 1 : -1;
    const [x0, y0] = this.hand(p, true);
    const dist = Math.hypot(hero.x - x0, hero.body.center.y - y0);
    const T = Phaser.Math.Clamp(0.45 + dist / 430, 0.75, 1.55);
    const v = hero.body.velocity;
    const tx = hero.x + v.x * T * 0.85 + (Math.random() - 0.5) * 24;
    const ty = Phaser.Math.Clamp(hero.body.center.y + v.y * T * 0.5, this.gs.viewRect.top + 30, this.ground - 30);
    const e = 1 - Math.exp(-DRAG * T);
    b.mode = 'throw';
    b.by = null;
    b.x0 = b.x = x0;
    b.y0 = b.y = y0;
    b.vx = ((tx - x0) * DRAG) / e;
    b.vy = SINK / DRAG + ((ty - y0 - (SINK * T) / DRAG) * DRAG) / e;
    b.x1 = b.vx;
    b.y1 = b.vy;
    b.t = 0;
    b.life = 3;
    b.img.setVisible(true);
    depth(b.img, DEPTH.projectiles - 1);
    sfx.whoosh();
    sfx.kick(0.4);
    if (b === this.ball) {
      this.passed = true;
      this.ball = null;
    }
  }

  // ── the balls ──

  private take(): Ball | null {
    return this.balls.find((b) => b.mode === 'off') ?? null;
  }

  private put(b: Ball) {
    b.mode = 'off';
    b.by = null;
    b.img.setVisible(false);
    b.shadow.setVisible(false);
  }

  private hold(b: Ball, p: FBPlayer, far: boolean) {
    b.mode = 'held';
    b.by = p;
    b.far = far;
    b.img.setVisible(this.shown);
  }

  private fly(b: Ball, x0: number, y0: number, x1: number, y1: number, peak: number, T: number, done: () => void) {
    Object.assign(b, { mode: 'pass', by: null, x0, y0, x1, y1, peak, T, t: 0, done, x: x0, y: y0 });
    b.img.setVisible(this.shown);
  }

  /** Off it goes, dropping to the turf (or the sea bed) to bounce and fade. */
  private drop(b: Ball, vx: number, vy: number, quick = false) {
    b.mode = 'loose';
    b.by = null;
    b.vx = vx;
    b.vy = vy;
    b.life = quick ? 0.8 : 1.6;
    b.img.setVisible(true);
  }

  private updateBall(b: Ball, dt: number) {
    const img = b.img;
    b.spin += dt;
    switch (b.mode) {
      case 'held': {
        const p = b.by!;
        const [hx, hy] = this.hand(p, b.far);
        b.x = hx;
        b.y = hy;
        img.setPosition(hx, hy).setRotation(b.far ? -0.5 * p.face : 0.25 * p.face).setFlipX(p.face < 0).setFrame('b0');
        depth(img, p.img.depth + 0.002);
        b.shadow.setVisible(false);
        return;
      }
      case 'pass': {
        b.t += dt;
        const u = Math.min(1, b.t / b.T);
        const px = b.x;
        const py = b.y;
        b.x = b.x0 + (b.x1 - b.x0) * u;
        b.y = b.y0 + (b.y1 - b.y0) * u - b.peak * 4 * u * (1 - u);
        this.spiral(b, b.x - px, b.y - py);
        this.shadowOf(b);
        if (u >= 1) {
          const done = b.done;
          b.done = null;
          done?.();
        }
        return;
      }
      case 'throw': {
        b.t += dt;
        const t = b.t;
        const e = 1 - Math.exp(-DRAG * t);
        const px = b.x;
        const py = b.y;
        b.x = b.x0 + (b.x1 * e) / DRAG;
        b.y = b.y0 + (SINK / DRAG) * t + ((b.y1 - SINK / DRAG) * e) / DRAG;
        b.vx = b.x1 * Math.exp(-DRAG * t);
        b.vy = SINK / DRAG + (b.y1 - SINK / DRAG) * Math.exp(-DRAG * t);
        this.spiral(b, b.x - px, b.y - py);
        this.shadowOf(b);
        // (a trail of little bubbles off it)
        b.bubT -= dt;
        if (!LIGHT && b.bubT <= 0) {
          b.bubT = 0.07;
          this.gs.sea?.bubbles(b.x - Math.sign(b.vx) * 8, b.y, 1);
        }
        this.hits(b);
        if (b.mode !== 'throw') return;
        // (spent: it's slowed right down, or it's hit something)
        if (t > 2.6 || this.gs.isSolidAt(b.x, b.y + 4) || Math.hypot(b.vx, b.vy) < 70) this.drop(b, b.vx * 0.5, Math.max(b.vy, 0) * 0.3);
        return;
      }
      case 'loose': {
        b.life -= dt;
        b.vy += 600 * dt;
        b.vx *= Math.pow(0.4, dt);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const floor = this.floorAt(b.x);
        if (b.y > floor - 5) {
          b.y = floor - 5;
          if (b.vy > 60) b.vy = -b.vy * 0.4;
          else b.vy = 0;
          b.vx *= 0.7;
        }
        img.setPosition(b.x, b.y);
        img.rotation += b.vx * dt * 0.05;
        img.setAlpha(Phaser.Math.Clamp(b.life / 0.5, 0, 1));
        this.shadowOf(b);
        if (b.life <= 0) {
          img.setAlpha(1);
          this.put(b);
        }
        return;
      }
    }
  }

  /** The sea bed under x: the field where it is, else the ground there. */
  private floorAt(x: number) {
    if (x > this.left - FIELD.END && x < this.right + FIELD.END) return this.ground + LANE_TOP + LANE_SPAN * 0.5;
    return this.gs.groundUnder(x, this.ground - 200) ?? this.ground;
  }

  /** Pointing the way it's going, the laces going round. */
  private spiral(b: Ball, dx: number, dy: number) {
    const img = b.img;
    const left = dx < 0;
    img.setPosition(b.x, b.y).setFlipX(false).setFlipY(left).setRotation(Math.atan2(dy, dx || 0.001));
    img.setFrame(`b${Math.floor(b.spin * 20) % 4}`);
  }

  private shadowOf(b: Ball) {
    const floor = this.floorAt(b.x);
    const over = b.x > this.left - FIELD.END && b.x < this.right + FIELD.END && b.y < floor;
    b.shadow.setVisible(over);
    if (over) {
      const k = Phaser.Math.Clamp(1 - (floor - b.y) / 300, 0.25, 1);
      b.shadow.setPosition(b.x, floor).setScale((FB_SHADOW.W / this.gs.textures.getFrame('fb-shadow').width) * k).setAlpha(k);
    }
  }

  /** A thrown ball reaching you (or a rocket): it knocks you, or gets knocked away. */
  private hits(b: Ball) {
    const rocket = this.gs.rocketAt(b.x, b.y, BALL_R + 10);
    if (rocket) {
      rocket.explode();
      this.gs.fx.popText(b.x, b.y - 16, 'THWACK!', '#ffffff', 14);
      this.drop(b, -b.vx * 0.25, -220);
      return;
    }
    for (const p of this.gs.players) {
      if (!p.alive) continue;
      const pb = p.body;
      const r = BALL_R;
      if (b.x + r < pb.left || b.x - r > pb.right || b.y + r < pb.top || b.y - r > pb.bottom) continue;
      if (!p.invulnerable) {
        this.gs.hitPlayer(p, b.x - Math.sign(b.vx) * 20);
        sfx.bump();
        this.gs.fx.stars(b.x, b.y, 4);
      }
      this.drop(b, -b.vx * 0.3, -180);
      return;
    }
  }

  // ── the players ──

  /** Standing (not knocked down). */
  private up(p: FBPlayer) {
    return p.out <= 0;
  }

  private tick(p: FBPlayer, dt: number, hero: Player | null) {
    p.poseT -= dt;
    p.blink -= dt;
    if (p.blink < -0.12) p.blink = 1.5 + Math.random() * 3;
    if (p.out > 0) {
      p.out -= dt;
      p.img.setFrame('down');
      if (p.out <= 0) {
        p.pose = 'hurt';
        p.poseT = 0.4;
      }
      this.place(p);
      return;
    }
    // walking (or running) to where it's going
    const dx = p.tx - p.x;
    const step = p.speed * dt;
    let moving = false;
    // (planted while winding up to throw at you)
    if (Math.abs(dx) > 3 && !this.winding(p)) {
      p.x += Phaser.Math.Clamp(dx, -step, step);
      moving = true;
      if (this.phase !== 'play' || (p.role !== 'QB' && p.role !== 'CB' && p.role !== 'S')) p.face = Math.sign(dx);
    } else if (this.phase === 'line' || this.phase === 'set') p.face = p.team === 'snappers' ? 1 : -1;
    const dl = p.tlane - p.lane;
    if (Math.abs(dl) > 0.01) p.lane += Phaser.Math.Clamp(dl, -dt * 0.8, dt * 0.8);
    // (in the trenches: pushing and shoving)
    if (p.stand === 'block' && this.phase === 'play') {
      p.push += dt * 7;
      p.x += Math.sin(p.push) * dt * 14;
    }
    // (the corners and the safety backpedal, facing the play)
    if (this.phase === 'play' && (p.role === 'CB' || p.role === 'S') && p.pose !== 'throw0' && p.pose !== 'throw1') p.face = -1;
    if (this.phase === 'play' && p.role === 'QB' && p.pose === null) p.face = 1;
    // facing you when it's throwing at you
    if (hero && this.winding(p)) p.face = hero.x < p.x ? -1 : 1;
    p.runT += dt * (moving ? 10 : 2.4);
    let f: FBFrame;
    if (p.pose && p.poseT > 0) f = p.pose;
    else if (moving && p.stand !== 'block') f = `run${Math.floor(p.runT) % 4}` as FBFrame;
    else if (p.stand === 'cheer0') f = Math.floor(p.runT * 1.6) % 2 ? 'cheer0' : 'cheer1';
    else if (p.stand !== 'idle0') f = p.stand;
    else if (p.blink < 0) f = 'blink';
    else f = Math.floor(p.runT) % 2 ? 'idle1' : 'idle0';
    if (p.pose && p.poseT <= 0) p.pose = null;
    p.img.setFrame(f);
    this.place(p);
  }

  /** The sprite (and its number) where the player is. */
  private place(p: FBPlayer) {
    const y = this.feetY(p);
    const k = this.scaleOf(p) * this.sheetK[p.team];
    p.img.setPosition(p.x, y).setScale(k).setFlipX(p.face < 0);
    // (the near ones in front; in steps, so it isn't re-sorted every frame they move)
    depth(p.img, DEPTH.enemies + Math.round(p.lane * 20) / 40);
    const ch = fbChest(p.team, p.img.frame.name as FBFrame);
    if (!ch || !this.shown) {
      p.num.setVisible(false);
      return;
    }
    p.num
      .setVisible(true)
      .setPosition(p.x + (ch[0] - 30) * k * p.face, y + (ch[1] - FB_GROUND) * k)
      .setRotation(ch[2] * p.face);
    depth(p.num, p.img.depth + 0.001);
  }

  /** You, down on the field: tackled (unless you came down on one from above: he's flattened). */
  private touch(hero: Player) {
    if (!hero.alive) return;
    const hb = hero.body;
    if (hb.bottom < this.ground - 46) return;
    for (const p of this.players) {
      if (p.out > 0) continue;
      const k = p.img.scaleX;
      const top = this.ground - 40 * k;
      if (hb.right < p.x - 12 * k || hb.left > p.x + 12 * k || hb.bottom < top || hb.top > this.ground) continue;
      if (hb.velocity.y > 30 && hb.bottom < top + 14) {
        hero.bounce();
        this.knockDown(p, 'stomp');
      } else if (!hero.invulnerable) {
        p.pose = 'block';
        p.poseT = 0.4;
        this.gs.fx.popText(p.x, top - 10, 'TACKLE!', '#ff5a3c', 13);
        this.gs.hitPlayer(hero, p.x);
      }
      return;
    }
  }

  /** A rocket reaching a player: he's knocked flat (and anything he had's dropped). */
  private rocketsAtPlayers() {
    if (!this.gs.liveRockets.length) return;
    for (const p of this.players) {
      if (p.out > 0) continue;
      const k = p.img.scaleX;
      const r = this.gs.rocketAt(p.x, this.feetY(p) - 24 * k, 20);
      if (!r) continue;
      r.explode();
      this.knockDown(p, 'rocket');
    }
  }

  private knockDown(p: FBPlayer, how: 'rocket' | 'stomp') {
    p.out = OUT_SECS;
    p.pose = null;
    if (how === 'stomp') sfx.stomp();
    else sfx.pop();
    this.gs.fx.stars(p.x, this.feetY(p) - 30, 5);
    this.gs.amb.sea?.bubbles(p.x, this.feetY(p) - 20, 6);
    this.gs.fx.popText(p.x, this.feetY(p) - 46, 'OOF!', '#ffffff', 13);
    for (const b of this.balls) if (b.mode === 'held' && b.by === p) this.drop(b, p.face * -40, -120);
    for (const th of this.throwers)
      if (th.p === p) {
        th.ball = null;
        th.wind = 0;
      }
    if (this.carrier === p || ((this.phase === 'play' || this.phase === 'set') && (p === this.qb || p.role === 'C'))) this.whistle();
  }

  destroy() {
    this.mark.destroy();
    for (const b of this.balls) {
      b.img.destroy();
      b.shadow.destroy();
    }
  }
}

