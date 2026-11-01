import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { sfx } from '../core/sfx';
import { ART_RES } from '../gfx/draw';
import type { GameScene } from '../scenes/GameScene';
import { Puffball } from './enemies/Enemy';
import type { Player } from './Player';

const BALL_R = 11;
/** How far the kicked ball flies (px/s) and how high it hops. */
const KICK_VX = 390;
const KICK_VY = -230;
/** They spot you once you're this close to one of them (so you can see it happen). */
const SPOT_DIST = 210;

/**
 * Puffballs playing soccer on a little pitch. They pass the ball around until
 * they spot you — a whistle, a "!" over every head — then one of them runs
 * behind the ball and boots it at you. Jump it (or shoot it to pop it; land
 * on it and you bounce off). After the kick the whole team charges.
 */
export class SoccerMatch {
  readonly ball: Phaser.Physics.Arcade.Image;
  private puffs: SoccerPuff[] = [];
  private state: 'idle' | 'play' | 'alert' | 'kicked' | 'done' = 'idle';
  private receiver: SoccerPuff | null = null;
  private kicker: SoccerPuff | null = null;
  private kickDir = -1;
  private timer = 0;
  private kickCooldown = 0.6;
  private dangerous = false;
  private readonly left: number;
  private readonly right: number;

  constructor(
    private gs: GameScene,
    cx: number,
    ground: number,
    widthTiles: number,
  ) {
    const half = (widthTiles * TILE) / 2;
    this.left = cx - half;
    this.right = cx + half;
    // a goal at each end of the pitch
    for (const gx of [this.left - 56, this.right - 2])
      gs.add.image(gx, ground + 1, 'soccergoal').setOrigin(4 / 76, 54 / 56).setScale(1 / 2).setDepth(DEPTH.decor);

    for (const f of [-0.55, 0.05, 0.6]) {
      const e = new SoccerPuff(gs, cx + half * f, ground - 40, this);
      gs.addEnemy(e, ground);
      this.puffs.push(e);
    }
    this.receiver = this.puffs[0];

    this.ball = gs.physics.add.image(this.puffs[0].x + 18, ground - BALL_R, 'soccerball').setScale(1 / ART_RES).setDepth(DEPTH.enemies + 1);
    const b = this.body;
    b.setCircle(BALL_R * ART_RES, 3 * ART_RES, 3 * ART_RES);
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

  /** Where a puff wants to stand right now (null = stay put). */
  targetFor(p: SoccerPuff): number | null {
    if (!this.ball.active) return null;
    if (this.state === 'play') {
      if (p === this.receiver) return this.ball.x + (p.x < this.ball.x ? -14 : 14);
      return p.home;
    }
    if (this.state === 'alert' && p === this.kicker) return this.ball.x - this.kickDir * 16;
    return null;
  }

  /** What a puff is looking at. */
  lookX(p: SoccerPuff): number {
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
    this.ball.rotation += (b.velocity.x * dt) / BALL_R;
    if (onFloor) b.velocity.x *= Math.pow(this.state === 'kicked' && this.dangerous ? 0.8 : 0.3, dt); // rolling friction

    switch (this.state) {
      case 'play': {
        // someone got hurt, or a hero wandered close: they notice you
        if (alive.length < this.puffs.length) return this.startAlert();
        if (hero && alive.some((q) => Math.abs(q.x - hero.x) < SPOT_DIST)) return this.startAlert();
        this.kickCooldown -= dt;
        const r = this.receiver && !this.receiver.dead ? this.receiver : alive[0];
        this.receiver = r ?? null;
        if (r && this.kickCooldown <= 0 && onFloor && Math.abs(r.x - this.ball.x) < 22 && Math.abs(b.velocity.x) < 110) {
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
        const behind = this.ball.x - this.kickDir * 16;
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

  private nearestToBall(list: SoccerPuff[]) {
    return list.reduce((a, c) => (Math.abs(c.x - this.ball.x) < Math.abs(a.x - this.ball.x) ? c : a));
  }

  private startAlert() {
    this.state = 'alert';
    this.timer = 0.8;
    sfx.whistle();
    const hero = this.gs.nearestPlayer(this.ball.x, this.ball.y);
    for (const p of this.alive) p.alert(hero);
  }

  private kick(k: SoccerPuff) {
    const b = this.body;
    this.ball.y -= 2;
    b.setVelocity(this.kickDir * KICK_VX, KICK_VY);
    this.dangerous = true;
    this.state = 'kicked';
    this.timer = 1.2;
    k.kickAnim();
    sfx.kick(1);
    this.gs.cameras.main.shake(90, 0.003);
    this.gs.fx.dust(this.ball.x, this.ball.y + BALL_R, 6);
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
      const r = BALL_R - 2;
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

/** A Puffball on the soccer team. Plays until it spots you, then becomes a normal (faster) Puffball. */
export class SoccerPuff extends Puffball {
  readonly home: number;
  private mode: 'play' | 'alert' | 'chase' = 'play';
  private kickT = 0;

  constructor(
    gs: GameScene,
    x: number,
    y: number,
    private match: SoccerMatch,
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
    const tx = this.match.targetFor(this);
    const fast = this.mode === 'alert' ? 150 : 90;
    const vx = tx !== null && Math.abs(tx - this.x) > 4 ? Phaser.Math.Clamp((tx - this.x) * 5, -fast, fast) : 0;
    this.body.setVelocityX(vx);
    this.setFlipX(this.match.lookX(this) > this.x);
    if (this.kickT > 0) this.setFrame('w1');
    else this.setFrame(Math.abs(vx) > 5 ? (Math.floor(this.t * 9) % 2 ? 'w1' : 'w0') : 'w0');
  }
}
