import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { sfx } from '../core/sfx';
import { ART_RES } from '../gfx/draw';
import { PITCH, drawPitchBack, drawPitchFront } from '../gfx/pitch';
import { addCanvas, hires } from '../gfx/textures';
import type { GameScene } from '../scenes/GameScene';
import { BigPuff, Puffball } from './enemies/Enemy';
import type { Player } from './Player';

export interface SoccerOpts {
  /** One letter per player: p = Puffball, b = Big Puff Ball. */
  team: string;
  /** A big, heavy ball (for the Big Puff Balls). */
  big?: boolean;
  /** Draw the goals at each end (off when two games share a pitch). */
  goals?: boolean;
  /** Extra seconds between spotting you and the kick (to stagger two games). */
  wait?: number;
}
/** They spot you once you're this close to one of them (so you can see it happen). */
const SPOT_DIST = 210;

/**
 * Puffballs playing soccer on a little pitch. They pass the ball around until
 * they spot you — a whistle, a "!" over every head — then one of them runs
 * behind the ball and boots it at you. Jump it (or shoot it to pop it; land
 * on it and you bounce off). After the kick the whole team charges.
 */
export class SoccerMatch implements Coach {
  readonly ball: Phaser.Physics.Arcade.Image;
  private puffs: SoccerMember[] = [];
  /** Ball radius, kick speed and hop. */
  private readonly r: number;
  private readonly kickVX: number;
  private readonly kickVY: number;
  private readonly wait: number;
  /** Other games on the same pitch: when one team spots you, they all do. */
  readonly partners: SoccerMatch[] = [];
  private state: 'idle' | 'play' | 'alert' | 'kicked' | 'done' = 'idle';
  private receiver: SoccerMember | null = null;
  private kicker: SoccerMember | null = null;
  private kickDir = -1;
  private timer = 0;
  private kickCooldown = 0.6;
  private dangerous = false;
  private readonly left: number;
  private readonly right: number;
  get centerX() {
    return (this.left + this.right) / 2;
  }

  constructor(
    private gs: GameScene,
    cx: number,
    ground: number,
    widthTiles: number,
    opts: SoccerOpts,
  ) {
    const half = (widthTiles * TILE) / 2;
    this.left = cx - half;
    this.right = cx + half;
    const big = !!opts.big;
    this.r = big ? 17 : 11;
    this.kickVX = big ? 330 : 390;
    this.kickVY = big ? -260 : -230;
    this.wait = opts.wait ?? 0;
    // a proper pitch: striped turf, lines, goals + corner flags in front; ad boards + floodlights behind
    if (opts.goals !== false) {
      const pitchW = half * 2 + 56;
      const W = pitchW + PITCH.END * 2;
      const x0 = this.left - 28 - PITCH.END;
      const front = `pitch-front-${pitchW}`;
      const back = `pitch-back-${pitchW}`;
      if (!gs.textures.exists(front)) addCanvas(gs, front, hires(W, PITCH.FRONT_UP + PITCH.FRONT_DOWN, 2, (ctx) => drawPitchFront(ctx, pitchW)), undefined, { release: true });
      if (!gs.textures.exists(back)) addCanvas(gs, back, hires(W, PITCH.BACK_UP + 2, 2, (ctx) => drawPitchBack(ctx, pitchW)), undefined, { release: true });
      gs.add.image(x0, ground, back).setOrigin(0, PITCH.BACK_UP / (PITCH.BACK_UP + 2)).setScale(1 / 2).setDepth(DEPTH.decor - 1);
      gs.add.image(x0, ground, front).setOrigin(0, PITCH.FRONT_UP / (PITCH.FRONT_UP + PITCH.FRONT_DOWN)).setScale(1 / 2).setDepth(DEPTH.tiles + 0.5);
    }

    // spread the team over the pitch (a two-player team stands in between the others)
    const n = opts.team.length;
    [...opts.team].forEach((kind, i) => {
      const f = n === 1 ? 0 : big ? -0.35 + (0.7 * i) / (n - 1) : -0.65 + (1.3 * i) / (n - 1);
      const x = cx + half * f;
      const e: SoccerMember = kind === 'b' ? new SoccerBig(gs, x, ground - 60, this) : new SoccerPuff(gs, x, ground - 40, this);
      gs.addEnemy(e, ground);
      this.puffs.push(e);
    });
    this.receiver = this.puffs[0];

    const tex = big ? 'soccerball-big' : 'soccerball';
    const pad = big ? 5 : 3;
    this.ball = gs.physics.add.image(this.puffs[0].x + this.r + 10, ground - this.r, tex).setScale(1 / ART_RES).setDepth(DEPTH.enemies + 1);
    const b = this.body;
    b.setCircle(this.r * ART_RES, pad * ART_RES, pad * ART_RES);
    b.setBounce(0.3, 0.55);
    b.setMaxVelocityY(900);
    gs.physics.add.collider(this.ball, gs.level.layer);
  }

  private get body() {
    return this.ball.body as Phaser.Physics.Arcade.Body;
  }

  private get alive() {
    return this.puffs.filter((p) => !p.dead);
  }

  /** Where a player wants to stand right now (null = stay put). */
  targetFor(p: SoccerMember): number | null {
    if (!this.ball.active) return null;
    const reach = this.r + p.body.width / 2;
    if (this.state === 'play') {
      if (p === this.receiver) return this.ball.x + (p.x < this.ball.x ? -reach : reach);
      return p.home;
    }
    if (this.state === 'alert' && p === this.kicker) return this.ball.x - this.kickDir * reach;
    return null;
  }

  /** What a player is looking at. */
  lookX(p: SoccerMember): number {
    if (this.state === 'alert') return this.gs.nearestPlayer(p.x, p.y)?.x ?? p.x - 1;
    return this.ball.active ? this.ball.x : p.x - 1;
  }

  update(dt: number) {
    const alive = this.alive;
    const hero = this.gs.nearestPlayer((this.left + this.right) / 2, this.ball.active ? this.ball.y : 0);

    if (this.state === 'idle') {
      if (!this.puffs.some((p) => p.awake)) return;
      this.state = 'play';
    }
    if (!this.ball.active) {
      if (this.state !== 'done') this.charge();
      return;
    }
    const b = this.body;
    if (this.ball.y > this.gs.level.heightPx + 60) {
      // rolled off into a pit
      this.ball.destroy();
      if (this.state === 'play') this.charge();
      this.state = 'done';
      return;
    }
    const onFloor = b.blocked.down;
    this.ball.rotation += (b.velocity.x * dt) / this.r;
    if (onFloor) b.velocity.x *= Math.pow(this.state === 'kicked' && this.dangerous ? 0.8 : 0.3, dt); // rolling friction

    switch (this.state) {
      case 'play': {
        // someone got hurt, or a hero wandered close: they notice you
        if (alive.length < this.puffs.length) return this.startAlert();
        if (hero && alive.some((q) => Math.abs(q.x - hero.x) < SPOT_DIST)) return this.startAlert();
        this.kickCooldown -= dt;
        const r = this.receiver && !this.receiver.dead ? this.receiver : alive[0];
        this.receiver = r ?? null;
        if (r && this.kickCooldown <= 0 && onFloor && Math.abs(r.x - this.ball.x) < this.r + r.body.width / 2 + 8 && Math.abs(b.velocity.x) < 110) {
          const others = alive.filter((o) => o !== r);
          const to = others[Math.floor(Math.random() * others.length)];
          if (to) {
            b.setVelocity(Phaser.Math.Clamp((to.x - this.ball.x) * 1.05, -230, 230), -130 - Math.random() * 140);
            this.receiver = to;
            r.kickAnim();
            this.kickCooldown = 0.45;
            sfx.kick(0.5);
          }
        }
        // keep the ball on the pitch
        if (this.ball.x < this.left + 6 && b.velocity.x < 0) b.velocity.x = Math.abs(b.velocity.x) * 0.5;
        if (this.ball.x > this.right - 6 && b.velocity.x > 0) b.velocity.x = -Math.abs(b.velocity.x) * 0.5;
        break;
      }
      case 'alert': {
        this.timer -= dt;
        if (!alive.length) return this.finish();
        const k = this.kicker && !this.kicker.dead ? this.kicker : this.nearestToBall(alive);
        this.kicker = k;
        if (hero) this.kickDir = Math.sign(hero.x - this.ball.x) || -1;
        const behind = this.ball.x - this.kickDir * (this.r + k.body.width / 2);
        if (this.timer <= 0 && (Math.abs(k.x - behind) < 10 || this.timer < -1.4)) this.kick(k);
        break;
      }
      case 'kicked': {
        if (this.dangerous && onFloor && Math.abs(b.velocity.x) < 70) this.dangerous = false;
        if (this.dangerous && hero) this.checkHit();
        if (!this.dangerous) {
          this.timer -= dt;
          if (this.timer <= 0) this.finish();
        }
        break;
      }
    }
  }

  private nearestToBall(list: SoccerMember[]) {
    return list.reduce((a, c) => (Math.abs(c.x - this.ball.x) < Math.abs(a.x - this.ball.x) ? c : a));
  }

  startAlert() {
    if (this.state !== 'play' && this.state !== 'idle') return;
    if (!this.ball.active) return;
    this.state = 'alert';
    for (const m of this.partners) m.startAlert();
    this.timer = 0.8 + this.wait;
    sfx.whistle();
    const hero = this.gs.nearestPlayer(this.ball.x, this.ball.y);
    for (const p of this.alive) p.alert(hero);
  }

  private kick(k: SoccerMember) {
    const b = this.body;
    this.ball.y -= 2;
    b.setVelocity(this.kickDir * this.kickVX, this.kickVY);
    this.dangerous = true;
    this.state = 'kicked';
    this.timer = 1.2;
    k.kickAnim();
    sfx.kick(1);
    this.gs.cameras.main.shake(this.r > 12 ? 140 : 90, this.r > 12 ? 0.005 : 0.003);
    this.gs.fx.dust(this.ball.x, this.ball.y + this.r, this.r > 12 ? 10 : 6);
    this.charge();
  }

  /** The whole team runs at you. */
  private charge() {
    if (this.state !== 'kicked') this.state = 'done';
    for (const p of this.alive) p.chase(this.gs.nearestPlayer(p.x, p.y));
  }

  /** Ball touches a hero: land on it and bounce off; otherwise it knocks you. */
  private checkHit() {
    const b = this.body;
    for (const p of this.gs.players) {
      if (!p.alive) continue;
      const pb = p.body;
      const x = this.ball.x;
      const y = this.ball.y;
      const r = this.r - 2;
      if (x + r < pb.left || x - r > pb.right || y + r < pb.top || y - r > pb.bottom) continue;
      this.dangerous = false;
      if (pb.velocity.y > 30 && pb.bottom < y) {
        p.bounce();
        b.setVelocity(b.velocity.x * 0.5, 160);
        this.gs.fx.stars(x, y - 6, 4);
        sfx.kick(0.6);
      } else {
        this.gs.hitPlayer(p, x);
        b.setVelocity(-b.velocity.x * 0.35, -200);
      }
      return;
    }
  }

  /** A rocket hit the ball: it pops. */
  popBall() {
    if (!this.ball.active) return;
    this.gs.fx.fluffBurst(this.ball.x, this.ball.y, 0.5);
    this.gs.fx.popText(this.ball.x, this.ball.y - 20, 'POP!', '#ffffff', 16);
    this.ball.destroy();
    this.charge();
    this.state = 'done';
  }

  private finish() {
    this.state = 'done';
    this.dangerous = false;
    if (!this.ball.active) return;
    const ball = this.ball;
    this.gs.tweens.add({ targets: ball, alpha: 0, delay: 1500, duration: 500, onComplete: () => ball.destroy() });
  }
}

/** A player on a soccer (or hockey) team. */
export type SoccerMember = SoccerPuff | SoccerBig;

/** Whatever runs the game: tells each player where to stand and what to look at. */
export interface Coach {
  targetFor(p: SoccerMember): number | null;
  lookX(p: SoccerMember): number;
  /** Optional: how fast players jog (default 90, 150 when alerted). */
  jog?: number;
}

/** Shared "playing soccer" behaviour: jog to the ball or back to your spot, watch the ball. */
export function playTick(e: SoccerMember, match: Coach, mode: 'play' | 'alert', kickT: number, t: number, frames: [string, string]) {
  const tx = match.targetFor(e);
  const fast = mode === 'alert' ? 150 : match.jog ?? 90;
  const vx = tx !== null && Math.abs(tx - e.x) > 4 ? Phaser.Math.Clamp((tx - e.x) * 5, -fast, fast) : 0;
  e.body.setVelocityX(vx);
  e.setFlipX(match.lookX(e) > e.x);
  if (kickT > 0) e.setFrame(frames[1]);
  else e.setFrame(Math.abs(vx) > 5 ? (Math.floor(t * 9) % 2 ? frames[1] : frames[0]) : frames[0]);
}

/** A Puffball on the soccer team. Plays until it spots you, then becomes a normal (faster) Puffball. */
export class SoccerPuff extends Puffball {
  readonly home: number;
  private mode: 'play' | 'alert' | 'chase' = 'play';
  private kickT = 0;

  constructor(
    gs: GameScene,
    x: number,
    y: number,
    private match: Coach,
  ) {
    super(gs, x, y);
    this.home = x;
  }

  alert(hero: Player | null) {
    if (this.mode !== 'play') return;
    this.mode = 'alert';
    this.body.setVelocityX(0);
    if (hero) this.setFlipX(hero.x > this.x);
    this.gs.fx.popText(this.x, this.y - 30, '!', '#ff5a3c', 22);
    if (this.body.blocked.down) this.body.setVelocityY(-200);
  }

  chase(hero: Player | null) {
    if (this.mode === 'chase') return;
    this.mode = 'chase';
    this.dir = hero ? Math.sign(hero.x - this.x) || -1 : -1;
    this.speed = 64;
  }

  kickAnim() {
    this.kickT = 0.22;
  }

  tick(dt: number) {
    if (this.mode === 'chase') return super.tick();
    this.kickT -= dt;
    playTick(this, this.match, this.mode, this.kickT, this.t, ['w0', 'w1']);
  }
}

/** A Big Puff Ball on the soccer team: kicks the big ball, then charges (still two hits). */
export class SoccerBig extends BigPuff {
  readonly home: number;
  private mode: 'play' | 'alert' | 'chase' = 'play';
  private kickT = 0;

  constructor(
    gs: GameScene,
    x: number,
    y: number,
    private match: Coach,
  ) {
    super(gs, x, y);
    this.home = x;
  }

  alert(hero: Player | null) {
    if (this.mode !== 'play') return;
    this.mode = 'alert';
    this.body.setVelocityX(0);
    if (hero) this.setFlipX(hero.x > this.x);
    this.gs.fx.popText(this.x, this.body.top - 18, '!!', '#ff5a3c', 24);
  }

  chase(hero: Player | null) {
    if (this.mode === 'chase') return;
    this.mode = 'chase';
    this.dir = hero ? Math.sign(hero.x - this.x) || -1 : -1;
    this.speed = 56;
    this.frameA = 'm0';
    this.frameB = 'm1';
  }

  kickAnim() {
    this.kickT = 0.3;
  }

  tick(dt: number) {
    if (this.mode === 'chase') return super.tick();
    this.kickT -= dt;
    playTick(this, this.match, this.mode, this.kickT, this.t, this.mode === 'alert' ? ['m0', 'm1'] : ['w0', 'w1']);
  }
}
