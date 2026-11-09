import Phaser from 'phaser';
import { DEPTH } from '../config';
import { sfx } from '../core/sfx';
import { ART_RES } from '../gfx/draw';
import { BB_ROSTER, BB_SIZE, PARK, parkSpots, type BBPlayer, type BaseballRole } from '../gfx/baseball';
import { PLOP_H, PLOP_W } from '../gfx/plops';
import { PLOP_TOP, makeBallPlayer, makeBallpark } from '../gfx/textures';
import type { GameScene } from '../scenes/GameScene';
import { BigPlop, Plop } from './enemies/Plops';
import type { Player } from './Player';

/**
 * Plop Park (Plop Invasion · Part 2, at the bottom of the first parachute drop): the Plops (blue
 * caps) are fielding, the Poos (red caps) batting, like the soccer in Part 1 and the volleyball in
 * Part 3. Pitch, swing, CRACK, a fly ball out to a fielder, thrown back in… until one of them spots
 * you. Then the fielders, the catcher and the one on deck come after you, and the pitcher keeps
 * pitching to the batter, who hits line drives straight at you (jump them, or shoot them down).
 * Get past the batter (or beat him) and the game's over: they all come for you.
 */

/** They spot you once you're down on the field (or this near it). */
const SPOT_MARGIN = 90;
/** How far a line drive reaches. */
const REACH = 760;
/** Line drives: speed (px/s) and how much they drop. */
const DRIVE_SPEED = 470;
const DRIVE_G = 200;
/** The ball (world px radius). */
const R = 5.5;

/** What a player's doing in the game (its part, the pose it's in, where it's going). */
interface BallState {
  game: BaseballGame;
  role: BaseballRole;
  /** Its usual pose (standing in its spot) and, for a moment, another (a pitch, a swing, a catch). */
  base: string;
  pose: string | null;
  poseUntil: number;
  mode: 'play' | 'chase';
  home: number;
  target: number | null;
  faceRight: boolean;
  /** Where the sheet's body middle sits (for the body). */
  padX: number;
}

type BallPlayer = (Plop | BigPlop) & { bb: BallState };

const ROLE_FRAMES = new Set<string>(['pitch-windup', 'pitch-throw', 'bat-stance', 'bat-swing', 'on-deck', 'runner', 'catcher', 'fielder', 'fielder-throw']);

/** Its own sheet, at its size, with its body standing on its feet. */
function fit(e: BallPlayer, key: string, kind: keyof typeof BB_SIZE) {
  const { k, w, h, res } = BB_SIZE[kind];
  const pad = e.bb.padX;
  e.setTexture(key, 'idle');
  const s = k / res;
  e.setScale(s);
  e.setOrigin((pad + 50) / (PLOP_W + pad * 2), (52 + PLOP_TOP) / (PLOP_H + PLOP_TOP));
  const bw = w / s;
  const bh = h / s;
  e.body.setSize(bw, bh, false).setOffset((pad + 50) * res - bw / 2, (100 + PLOP_TOP) * res - bh);
}

/** The frame to show while playing (its pose; walking when it's on the move; "ow!" just after a hit). */
function playFrame(e: BallPlayer): string {
  const st = e.bb;
  const now = e.scene.time.now;
  if (now - e.hurtAt < 320) return 'hurt';
  if (Math.abs(e.body.velocity.x) > 12 && e.body.blocked.down) return `walk${Math.floor(now / 100) % 4}`;
  if (st.pose && now < st.poseUntil) return st.pose;
  return st.base;
}

function playTick(e: BallPlayer) {
  const st = e.bb;
  const b = e.body;
  const tx = st.target;
  b.setVelocityX(tx !== null && Math.abs(tx - e.x) > 4 ? Phaser.Math.Clamp((tx - e.x) * 4, -150, 150) : 0);
  if (tx !== null && Math.abs(tx - e.x) > 4) e.setFlipX(tx > e.x);
  else e.setFlipX(st.faceRight);
  e.setFrame(playFrame(e));
}

/** The game's off for this one: it comes after you like any Plop. */
function chase(e: BallPlayer, hero: Player | null) {
  if (e.bb.mode === 'chase' || e.dead) return;
  e.bb.mode = 'chase';
  e.bb.target = null;
  (e as unknown as { dir: number }).dir = hero ? Math.sign(hero.x - e.x) || -1 : -1;
}

class BallPlop extends Plop {
  bb!: BallState;
  setFrame(frame: string | number, updateSize?: boolean, updateOrigin?: boolean) {
    if (this.bb && ROLE_FRAMES.has(String(frame))) return Phaser.Physics.Arcade.Sprite.prototype.setFrame.call(this, frame, updateSize, updateOrigin) as this;
    return super.setFrame(frame, updateSize, updateOrigin);
  }
  tick(dt = 1 / 60) {
    if (this.bb.mode === 'chase') return super.tick(dt);
    playTick(this);
  }
}

class BigBallPlop extends BigPlop {
  bb!: BallState;
  setFrame(frame: string | number, updateSize?: boolean, updateOrigin?: boolean) {
    if (this.bb && ROLE_FRAMES.has(String(frame))) return Phaser.Physics.Arcade.Sprite.prototype.setFrame.call(this, frame, updateSize, updateOrigin) as this;
    return super.setFrame(frame, updateSize, updateOrigin);
  }
  tick(dt = 1 / 60) {
    if (this.bb.mode === 'chase') return super.tick(dt);
    playTick(this);
  }
}

/** A ball on its way somewhere in the game (a pitch, a fly ball, a throw back in). */
interface Flight {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  peak: number;
  T: number;
  t: number;
  done: () => void;
}

/** A line drive off the bat, straight at you: it hurts, unless you jump it or shoot it down. */
class LineDrive {
  img: Phaser.GameObjects.Image;
  private live = true;
  private life = 2.4;
  constructor(
    private gs: GameScene,
    x: number,
    y: number,
    private vx: number,
    private vy: number,
  ) {
    this.img = gs.add.image(x, y, 'bb-drive').setScale(1 / ART_RES).setDepth(DEPTH.projectiles);
    this.face();
  }
  private face() {
    const left = this.vx < 0;
    this.img.setFlipX(left).setOrigin(left ? 9 / 64 : 55 / 64, 0.5);
    this.img.setRotation(Math.atan2(this.vy, Math.abs(this.vx)) * (left ? -1 : 1));
  }
  /** Knocked away (it hit you, a rocket, the ground): it drops, bounces and fades. */
  private deflect(vx: number, vy: number) {
    this.live = false;
    this.vx = vx;
    this.vy = vy;
    this.img.setTexture('bb-ball').setOrigin(0.5).setFlipX(false).setRotation(0);
    this.life = 0.9;
  }
  /** False once it's gone. */
  update(dt: number): boolean {
    const img = this.img;
    if (!img.scene) return false;
    this.life -= dt;
    this.vy += (this.live ? DRIVE_G : 900) * dt;
    img.x += this.vx * dt;
    img.y += this.vy * dt;
    if (this.live) {
      this.face();
      const gs = this.gs;
      for (const p of gs.players) {
        if (!p.alive) continue;
        const pb = p.body;
        const r = R + 1;
        if (img.x + r < pb.left || img.x - r > pb.right || img.y + r < pb.top || img.y - r > pb.bottom) continue;
        gs.hitPlayer(p, img.x - Math.sign(this.vx) * 20);
        sfx.bump();
        this.deflect(-this.vx * 0.25, -220);
        return true;
      }
      const rocket = gs.rocketAt(img.x, img.y, R + 8);
      if (rocket) {
        rocket.explode();
        gs.fx.popText(img.x, img.y - 16, 'THWACK!', '#ffffff', 14);
        this.deflect(this.vx * -0.2, -260);
        return true;
      }
      if (gs.level.isSolidAt(img.x, img.y + R)) {
        gs.fx.dust(img.x, img.y + R, 3);
        this.deflect(this.vx * 0.35, -Math.abs(this.vy) * 0.35 - 80);
        return true;
      }
    } else {
      img.rotation += dt * 10 * Math.sign(this.vx || 1);
      if (this.gs.level.isSolidAt(img.x, img.y + R) && this.vy > 0) {
        this.vy = -this.vy * 0.35;
        this.vx *= 0.6;
        img.y -= 2;
      }
      img.setAlpha(Phaser.Math.Clamp(this.life / 0.4, 0, 1));
    }
    if (this.life <= 0 || img.y > this.gs.level.heightPx + 40) {
      img.destroy();
      return false;
    }
    return true;
  }
  destroy() {
    if (this.img.scene) this.img.destroy();
  }
}

export class BaseballGame {
  private readonly x0: number;
  private readonly w: number;
  private readonly home: number;
  private readonly players: BallPlayer[] = [];
  private pitcher: BallPlayer;
  private batter: BallPlayer;
  private catcher: BallPlayer;
  private fielders: BallPlayer[] = [];
  private ball: Phaser.GameObjects.Image;
  private flight: Flight | null = null;
  private timers: { t: number; fn: () => void }[] = [];
  private drives: LineDrive[] = [];
  /** The next pitch is due (nothing in the air, nobody throwing). */
  private ready = true;
  private hot = false;
  private over = false;
  private meleeCd = 0;

  constructor(
    private gs: GameScene,
    x0: number,
    private ground: number,
    widthTiles: number,
  ) {
    this.x0 = x0;
    this.w = widthTiles * 32;
    const w = this.w;
    const { END, FRONT_UP } = PARK;
    // the ballpark: the wall, scoreboard, backstop and lights behind; the turf, infield and bases over the ground
    // (drawn while the level loads; here only if it somehow wasn't)
    makeBallpark(gs);
    gs.add.image(x0 - END, ground, 'bbpark-back').setOrigin(0, 1).setScale(1 / 1.5).setDepth(DEPTH.decor - 1);
    gs.add.image(x0 - END, ground - FRONT_UP, 'bbpark-front').setOrigin(0, 0).setScale(1 / 2).setDepth(DEPTH.tiles + 0.5);

    // the players, in their spots (the field's spots are measured from the picture's left edge)
    const sp = parkSpots(w);
    const at = (x: number) => x0 - END + x;
    this.home = at(sp.home.x);
    const add = (x: number, r: BBPlayer, faceRight: boolean) => {
      makeBallPlayer(gs, r);
      const e = (r.kind === 'medium' ? new BigBallPlop(gs, x, ground - 40) : new BallPlop(gs, x, ground - 40)) as BallPlayer;
      e.bb = { game: this, role: r.role, base: r.role, pose: null, poseUntil: 0, mode: 'play', home: x, target: null, faceRight, padX: r.padX };
      fit(e, r.key, r.kind);
      gs.addEnemy(e, ground);
      e.setFlipX(faceRight).setFrame(r.role);
      this.players.push(e);
      return e;
    };
    const R = (key: string) => BB_ROSTER.find((r) => r.key === key)!;
    this.pitcher = add(at(sp.mound.x), R('bbp-pitcher'), true);
    this.batter = add(this.home + 4, R('bbp-batter'), false);
    this.catcher = add(this.home + 58, R('bbp-catcher'), false);
    this.fielders.push(add(at(sp.second.x - 30), R('bbp-f1'), true));
    this.fielders.push(add(at(END + 300), R('bbp-f2'), true));
    this.fielders.push(add(at(END + 520), R('bbp-f3'), true));
    add(this.home + 100, R('bbp-ondeck'), false);
    // the ball in play
    this.ball = gs.add.image(0, 0, 'bb-ball').setScale(1 / ART_RES).setDepth(DEPTH.enemies + 1).setVisible(false);
  }

  /** In the game (not beaten, not off chasing you). */
  private playing(e: BallPlayer | null): e is BallPlayer {
    return !!e && !e.dead && e.active && e.bb.mode === 'play';
  }

  private after(t: number, fn: () => void) {
    this.timers.push({ t, fn });
  }

  private pose(e: BallPlayer, pose: string, secs: number) {
    e.bb.pose = pose;
    e.bb.poseUntil = this.gs.time.now + secs * 1000;
  }

  private fly(x0: number, y0: number, x1: number, y1: number, peak: number, T: number, done: () => void) {
    this.flight = { x0, y0, x1, y1, peak, T, t: 0, done };
    this.ball.setVisible(true).setPosition(x0, y0);
  }

  /** The pitcher's throwing hand (just ahead of him, at shoulder height). */
  private hand(e: BallPlayer, ahead = 1) {
    const big = e instanceof BigPlop;
    return { x: e.x + (e.flipX ? 1 : -1) * ahead * (big ? 20 : 12), y: e.body.top + (big ? 18 : 10) };
  }

  private get hero() {
    return this.gs.nearestPlayer(this.home, this.ground);
  }

  /** A hero down on the field (or about to be): they've seen you. */
  private sees(hero: Player | null) {
    if (!hero || !hero.alive) return false;
    return hero.body.bottom > this.ground - 150 && hero.x > this.x0 - SPOT_MARGIN && hero.x < this.home + 160;
  }

  /** A hero in reach of a line drive (in front of the batter, down near the field, on screen). */
  private inReach(hero: Player | null, from: number) {
    if (!hero || !hero.alive) return false;
    const v = this.gs.cameras.main.worldView;
    return hero.x < from - 30 && from - hero.x < REACH && hero.body.bottom > this.ground - 210 && from < v.right - 20 && from > v.x;
  }

  update(dt: number) {
    for (const t of this.timers) t.t -= dt;
    const due = this.timers.filter((t) => t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    for (const t of due) t.fn();
    this.drives = this.drives.filter((d) => d.update(dt));
    if (this.over) return;
    if (!this.players.some((e) => e.awake)) return;
    // the ball in the air
    const f = this.flight;
    if (f) {
      f.t += dt;
      const u = Math.min(1, f.t / f.T);
      this.ball.setPosition(f.x0 + (f.x1 - f.x0) * u, f.y0 + (f.y1 - f.y0) * u - f.peak * 4 * u * (1 - u));
      this.ball.rotation += dt * 14;
      if (u >= 1) {
        this.flight = null;
        f.done();
      }
    }
    const hero = this.hero;
    // they've seen you (or someone hit one of them)
    if (!this.hot && (this.sees(hero) || this.players.some((e) => e.dead || e.hp < (e instanceof BigPlop ? 2 : 1) || e.bb.mode === 'chase'))) this.alert(hero);
    if (this.hot) this.hotPlay(hero, dt);
    if (this.ready && this.playing(this.pitcher)) this.pitch();
  }

  /** The pitcher winds up and pitches to the batter. */
  private pitch() {
    const p = this.pitcher;
    const hero = this.hero;
    // (once it's on: only when there's someone to hit it at)
    if (this.hot && !(this.playing(this.batter) && this.inReach(hero, this.batter.x))) return;
    this.ready = false;
    this.ball.setVisible(false);
    const wind = this.hot ? 0.45 : 0.75;
    this.pose(p, 'pitch-windup', wind);
    this.after(wind, () => {
      if (!this.playing(p)) return void (this.ready = true);
      this.pose(p, 'pitch-throw', 0.3);
      sfx.whoosh();
      const h = this.hand(p);
      const plateX = this.batter.x - 16;
      this.fly(h.x, h.y, plateX, this.ground - 26, 6, this.hot ? 0.28 : 0.4, () => this.atPlate());
    });
  }

  /** The pitch reaches the plate: a swing (or not). */
  private atPlate() {
    const b = this.batter;
    const hero = this.hero;
    if (!this.playing(b)) return this.toCatcher();
    this.pose(b, 'bat-swing', 0.32);
    if (this.hot) {
      if (this.inReach(hero, b.x)) this.lineDrive(b, hero!);
      else this.ball.setVisible(false);
      this.after(0.9, () => (this.ready = true));
      return;
    }
    if (Math.random() < 0.35) {
      // a swing and a miss
      sfx.whoosh();
      return this.toCatcher(true);
    }
    // CRACK: a fly ball out to one of the fielders, who runs under it
    sfx.crack();
    this.gs.fx.popText(b.x - 10, b.body.top - 12, 'CRACK!', '#ffffff', 14);
    const out = this.fielders.filter((e) => this.playing(e));
    if (!out.length) {
      this.ball.setVisible(false);
      this.after(0.8, () => (this.ready = true));
      return;
    }
    const fe = out[Math.floor(Math.random() * out.length)];
    const landX = fe.bb.home + Phaser.Math.Between(-60, 60);
    fe.bb.target = landX;
    this.fly(b.x - 20, b.body.top + 20, landX, this.ground - 24, 150 + Math.random() * 60, 1.5 + Math.random() * 0.3, () => {
      fe.bb.target = null;
      if (!this.playing(fe)) {
        this.ball.setVisible(false);
        this.after(0.6, () => (this.ready = true));
        return;
      }
      sfx.bump();
      this.ball.setVisible(false);
      this.pose(fe, 'fielder', 0.4);
      this.after(0.4, () => this.throwIn(fe));
    });
  }

  /** Past the batter: into the catcher's mitt ("STRIKE!" now and then), and he throws it back. */
  private toCatcher(strike = false) {
    const c = this.catcher;
    if (!this.playing(c)) {
      this.ball.setVisible(false);
      return this.after(0.6, () => (this.ready = true));
    }
    this.fly(this.ball.x, this.ball.y, c.x - 10, this.ground - 18, 2, 0.14, () => {
      sfx.bump();
      this.ball.setVisible(false);
      if (strike && Math.random() < 0.6) this.gs.fx.popText(c.x, c.body.top - 14, 'STRIKE!', '#ffd23f', 13);
      this.after(0.45, () => this.throwIn(c));
    });
  }

  /** A fielder (or the catcher) throws it back in to the pitcher. */
  private throwIn(e: BallPlayer) {
    const p = this.pitcher;
    if (!this.playing(e) || !this.playing(p)) return void (this.ready = true);
    e.setFlipX(p.x > e.x);
    e.bb.faceRight = p.x > e.x;
    this.pose(e, 'fielder-throw', 0.3);
    const h = this.hand(e);
    const to = this.hand(p, 0.6);
    const T = Phaser.Math.Clamp(Math.abs(to.x - h.x) / 420, 0.45, 1);
    this.fly(h.x, h.y, to.x, to.y, 30 + T * 40, T, () => {
      this.ball.setVisible(false);
      sfx.bump();
      e.bb.faceRight = e === this.catcher ? false : true;
      this.after(0.5, () => (this.ready = true));
    });
  }

  /** CRACK: straight at you. */
  private lineDrive(from: BallPlayer, hero: Player) {
    sfx.crack();
    this.gs.cameras.main.shake(80, 0.003);
    this.gs.fx.popText(from.x - 6, from.body.top - 14, 'CRACK!', '#ff5a3c', 16);
    this.ball.setVisible(false);
    const sx = from.x - (from instanceof BigPlop ? 24 : 14);
    const sy = from.body.top + (from instanceof BigPlop ? 24 : 12);
    const tx = hero.x;
    const ty = hero.body.center.y;
    const T = Phaser.Math.Clamp(Math.hypot(tx - sx, ty - sy) / DRIVE_SPEED, 0.3, 1.8);
    const vx = (tx - sx) / T;
    const vy = (ty - sy - 0.5 * DRIVE_G * T * T) / T;
    this.drives.push(new LineDrive(this.gs, sx, sy, vx, vy));
  }

  /** They've spotted you: the fielders, the catcher and the one on deck come for you; the pitcher pitches at you. */
  private alert(hero: Player | null) {
    this.hot = true;
    sfx.whistle();
    for (const e of this.players) {
      if (!this.playing(e)) continue;
      this.gs.fx.popText(e.x, e.body.top - 14, '!', '#ff5a3c', 22);
      if (e.body.blocked.down) e.body.setVelocityY(-200);
      e.bb.target = null;
      if (e !== this.pitcher && e !== this.batter) this.after(0.35 + Math.random() * 0.4, () => chase(e, this.hero));
    }
    if (this.playing(this.batter)) this.gs.fx.popText(this.batter.x, this.batter.body.top - 34, 'BATTER UP!', '#ffd23f', 15);
    void hero;
  }

  private hotPlay(hero: Player | null, dt: number) {
    const b = this.batter;
    const p = this.pitcher;
    this.meleeCd -= dt;
    if (!hero || !hero.alive) return;
    // past the batter (or he's beaten): the game's over, everyone comes for you
    if (!this.playing(b) || hero.x > b.x + 24) {
      if (this.playing(p)) chase(p, hero);
      if (this.playing(b)) chase(b, hero);
      this.ball.setVisible(false);
      this.flight = null;
      this.over = true;
      return;
    }
    // right up close in front of him: he swings the bat at you
    const dx = b.x - hero.x;
    if (this.meleeCd <= 0 && dx > 0 && dx < 70 && hero.body.bottom > b.body.top && hero.body.top < b.body.bottom) {
      this.meleeCd = 1.2;
      this.pose(b, 'bat-swing', 0.32);
      sfx.whoosh();
      this.after(0.12, () => {
        if (!this.playing(b) || !hero.alive) return;
        const d = b.x - hero.x;
        if (d > -10 && d < 64 && hero.body.bottom > b.body.top && hero.body.top < b.body.bottom) {
          sfx.crack();
          this.gs.fx.stars(hero.x, hero.body.top + 8, 4);
          this.gs.hitPlayer(hero, b.x);
        }
      });
    }
    // no pitcher: the batter tosses it up and hits it himself
    if (!this.playing(p) && this.ready && this.inReach(hero, b.x)) {
      this.ready = false;
      this.ball.setVisible(true);
      this.fly(b.x - 14, b.body.top + 6, b.x - 16, this.ground - 30, 40, 0.5, () => this.atPlate());
    }
  }

  destroy() {
    for (const d of this.drives) d.destroy();
    this.drives = [];
  }
}
