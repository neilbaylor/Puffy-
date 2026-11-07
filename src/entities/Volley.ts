import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { sfx } from '../core/sfx';
import { ART_RES } from '../gfx/draw';
import type { GameScene } from '../scenes/GameScene';
import { Plop } from './enemies/Plops';
import type { Player } from './Player';

/** They spot you once you're this close to one of them. */
const SPOT = 250;
/** The ball floats (beach volleyball): gravity on it, px/s². */
const G = 900;
/** The net's height over the sand (world px). */
const NET_H = 66;
/** Ball radius (world px). */
const R = 11;

/**
 * Plops playing beach volleyball (Plop Invasion's mid-level match, like the
 * soccer in Part 1 and the hockey in Part 2). Two a side, bumping the ball
 * back and forth over the net — until one of them spots you: a whistle, a "!"
 * over every head, and whoever has the ball next jumps and SPIKES it at you.
 * They fetch it and keep spiking until you're past them, the ball's popped
 * (shoot it) or the Plops are. Land on the ball and you bounce off it.
 */
export class VolleyMatch {
  readonly ball: Phaser.Physics.Arcade.Image;
  private team: VolleyPlop[] = [];
  private state: 'idle' | 'rally' | 'alert' | 'spiked' | 'fetch' | 'hold' | 'done' = 'idle';
  /** Who's going for the ball, and where it'll come down. */
  private receiver: VolleyPlop | null = null;
  private landX = 0;
  private timer = 0;
  private dangerous = false;
  private prevX = 0;
  private prevY = 0;
  private readonly netX: number;
  private readonly left: number;
  private readonly right: number;

  constructor(
    private gs: GameScene,
    cx: number,
    private ground: number,
    widthTiles: number,
  ) {
    const half = (widthTiles * TILE) / 2;
    this.netX = cx;
    this.left = cx - half;
    this.right = cx + half;
    // the court: a strip of sand, the net, a beach umbrella at one end
    const sand = gs.add.graphics().setDepth(DEPTH.tiles + 0.5);
    sand.fillStyle(0xe9cf98, 1).fillRoundedRect(this.left - 10, ground - 4, half * 2 + 20, 10, 5);
    sand.fillStyle(0xd2b276, 1).fillRect(this.left - 4, ground + 3, half * 2 + 8, 3);
    for (let x = this.left; x < this.right; x += 7) sand.fillStyle(0xc9a466, 0.8).fillCircle(x + ((x * 37) % 5), ground - 1 + ((x * 13) % 4), 0.9);
    sand.lineStyle(1.6, 0xffffff, 0.9).lineBetween(this.left + 4, ground - 3, this.right - 4, ground - 3);
    gs.add.image(cx, ground + 2, 'volleynet').setOrigin(0.5, 1).setScale(1 / 3).setDepth(DEPTH.decor + 0.5);
    gs.add.image(this.left - 26, ground + 2, 'umbrella').setOrigin(30 / 64, 68 / 70).setScale(1 / 3).setDepth(DEPTH.decor);

    // two a side
    for (const [side, f] of [[-1, 0.72], [-1, 0.32], [1, 0.32], [1, 0.72]] as const) {
      const e = new VolleyPlop(gs, cx + side * half * f, ground - 40, this, side);
      gs.addEnemy(e, ground);
      this.team.push(e);
    }
    this.ball = gs.physics.add.image(this.team[1].x, ground - 50, 'volleyball').setScale(1 / ART_RES).setDepth(DEPTH.enemies + 1);
    const b = this.body;
    b.setCircle(R * ART_RES, 2 * ART_RES, 2 * ART_RES);
    b.setGravityY(G - gs.physics.world.gravity.y);
    b.setBounce(0.5, 0.55);
    b.setMaxVelocityY(900);
    b.moves = false;
    gs.physics.add.collider(this.ball, gs.level.layer);
    this.prevX = this.ball.x;
  }

  private get body() {
    return this.ball.body as Phaser.Physics.Arcade.Body;
  }

  private get alive() {
    return this.team.filter((p) => !p.dead && p.active);
  }

  /** Where a player wants to stand (null: stay put). */
  targetFor(p: VolleyPlop): number | null {
    if (!this.ball.active) return null;
    if (p === this.receiver && (this.state === 'rally' || this.state === 'alert' || this.state === 'fetch')) return this.landX;
    return p.home;
  }

  /** The player is at the ball when it comes down: bump it over (or spike it at you). */
  update(dt: number) {
    if (this.state === 'done') return;
    const alive = this.alive;
    if (!this.ball.active) return;
    if (!alive.length) return this.finish();
    const hero = this.gs.nearestPlayer(this.netX, this.ground);
    const b = this.body;
    if (this.state === 'idle') {
      if (!alive.some((p) => p.awake)) return;
      // serve: a toss, then over the net
      this.state = 'rally';
      this.serve(alive.find((p) => p.side < 0) ?? alive[0]);
      return;
    }
    if (this.ball.y > this.gs.level.heightPx + 60) return this.finish();
    this.ball.rotation += (b.velocity.x * dt) / R;
    // the net: a ball crossing it low bounces back
    if (b.moves && Math.sign(this.prevX - this.netX) !== Math.sign(this.ball.x - this.netX) && this.ball.y > this.ground - NET_H) {
      this.ball.x = this.prevX;
      b.setVelocityX(-b.velocity.x * 0.35);
      sfx.bump();
    }
    this.prevX = this.ball.x;
    // you came too close (or one of them got hurt): they've seen you
    if ((this.state === 'rally' || this.state === 'hold') && hero && (alive.length < this.team.length || alive.some((p) => Math.abs(p.x - hero.x) < SPOT))) this.alert(hero);

    switch (this.state) {
      case 'rally':
      case 'alert': {
        const r = this.receiver && !this.receiver.dead ? this.receiver : null;
        if (!r) {
          this.receiver = this.nearest(alive, this.ball.x);
          this.landX = this.ball.x;
        }
        const rec = this.receiver!;
        // (it reaches the ball as it comes down through head height — checked over the whole
        // frame, so a slow device that moves the ball a long way in one frame doesn't miss it)
        const top = this.ground - 52;
        const bottom = this.ground - 10;
        const through = this.prevY <= bottom && this.ball.y >= top;
        const reach = Math.abs(rec.x - this.ball.x) < 26 && through && b.velocity.y > 0;
        if (reach) {
          if (this.state === 'alert' && hero && hero.alive) this.spike(rec, hero);
          else this.bump(rec);
        } else if (b.blocked.down && Math.abs(b.velocity.y) < 40) {
          // it hit the sand: whoever's nearest picks it up and serves again
          this.state = this.state === 'alert' ? 'fetch' : 'rally';
          this.fetchBy(this.nearest(alive, this.ball.x));
        }
        this.prevY = this.ball.y;
        break;
      }
      case 'spiked': {
        this.prevY = this.ball.y;
        if (this.dangerous) this.checkHit();
        if (b.blocked.down && Math.abs(b.velocity.x) < 120) this.dangerous = false;
        this.timer -= dt;
        if (!this.dangerous && this.timer <= 0) {
          // off the court: they've lost it — they come after you instead
          if (this.ball.x < this.left - 90 || this.ball.x > this.right + 90) return this.charge();
          this.state = 'fetch';
          this.fetchBy(this.nearest(alive, this.ball.x));
        }
        break;
      }
      case 'fetch': {
        const f = this.receiver && !this.receiver.dead ? this.receiver : this.nearest(alive, this.ball.x);
        this.receiver = f;
        this.landX = this.ball.x;
        if (Math.abs(f.x - this.ball.x) < 16 && (b.blocked.down || this.ball.y > this.ground - 30)) {
          this.state = 'hold';
          this.timer = 0.55;
          b.moves = false;
          b.setVelocity(0, 0);
        }
        break;
      }
      case 'hold': {
        // held up over its head, then (if it's seen you) spiked at you, else served
        const f = this.receiver;
        if (!f || f.dead) {
          b.moves = true;
          this.state = 'fetch';
          break;
        }
        this.ball.setPosition(f.x, f.body.top - R - 2);
        this.timer -= dt;
        if (this.timer <= 0) {
          b.moves = true;
          if (this.dangerousMode && hero && hero.alive && Math.abs(hero.x - f.x) < 460) this.spike(f, hero);
          else if (this.dangerousMode) this.charge();
          else {
            this.state = 'rally';
            this.serve(f);
          }
        }
        break;
      }
    }
  }

  /** Once they've seen you, every touch is a spike at you. */
  private dangerousMode = false;

  private nearest(list: VolleyPlop[], x: number) {
    return list.reduce((a, c) => (Math.abs(c.x - x) < Math.abs(a.x - x) ? c : a));
  }

  private fetchBy(p: VolleyPlop) {
    this.receiver = p;
    this.landX = this.ball.x;
  }

  /** Over the net to a spot on the other side; the nearest player there goes to meet it. */
  private bump(from: VolleyPlop) {
    const otherSide = from.x < this.netX ? 1 : -1;
    const side = this.alive.filter((p) => Math.sign(p.x - this.netX) === otherSide);
    const lo = otherSide > 0 ? this.netX + 30 : this.left + 20;
    const hi = otherSide > 0 ? this.right - 20 : this.netX - 30;
    this.landX = Phaser.Math.Between(Math.round(lo), Math.round(hi));
    this.launch(this.landX, this.ground - 30, 1.05 + Math.random() * 0.25);
    from.bumpAnim();
    sfx.kick(0.4);
    this.receiver = side.length ? this.nearest(side, this.landX) : this.nearest(this.alive, this.landX);
  }

  /** A serve: tossed up, then over the net. */
  private serve(from: VolleyPlop) {
    const b = this.body;
    b.moves = true;
    this.ball.setPosition(from.x, from.body.top - R);
    this.bump(from);
  }

  /** Throw the ball so it passes through (tx, ty) after T seconds. */
  private launch(tx: number, ty: number, T: number) {
    const b = this.body;
    this.ball.y -= 2;
    b.setVelocity((tx - this.ball.x) / T, (ty - this.ball.y - 0.5 * G * T * T) / T);
  }

  private alert(hero: Player) {
    if (this.dangerousMode) return;
    this.dangerousMode = true;
    if (this.state === 'rally') this.state = 'alert';
    sfx.whistle();
    for (const p of this.alive) p.alert(hero);
  }

  /** It jumps and smashes the ball straight at you. */
  private spike(p: VolleyPlop, hero: Player) {
    p.spikeAnim();
    const b = this.body;
    b.moves = true;
    this.ball.setPosition(p.x + Math.sign(hero.x - p.x) * 6, p.body.top - R - 6);
    const dx = hero.x - this.ball.x;
    const T = Phaser.Math.Clamp(Math.abs(dx) / 430, 0.35, 0.95);
    this.launch(hero.x, hero.body.center.y, T);
    this.dangerous = true;
    this.state = 'spiked';
    this.timer = 1.1;
    sfx.kick(1);
    this.gs.fx.popText(p.x, p.body.top - 20, 'SPIKE!', '#ffd23f', 16);
    this.gs.cameras.main.shake(90, 0.003);
  }

  /** The ball touches a hero: land on it and bounce off; otherwise it knocks you. */
  private checkHit() {
    const b = this.body;
    for (const p of this.gs.players) {
      if (!p.alive) continue;
      const pb = p.body;
      const x = this.ball.x;
      const y = this.ball.y;
      const r = R - 2;
      if (x + r < pb.left || x - r > pb.right || y + r < pb.top || y - r > pb.bottom) continue;
      this.dangerous = false;
      if (pb.velocity.y > 30 && pb.bottom < y) {
        p.bounce();
        b.setVelocity(b.velocity.x * 0.5, 160);
        this.gs.fx.stars(x, y - 6, 4);
        sfx.kick(0.6);
      } else {
        this.gs.hitPlayer(p, x);
        b.setVelocity(-b.velocity.x * 0.35, -220);
      }
      return;
    }
  }

  /** A rocket hit the ball: it pops, and they come after you. */
  popBall() {
    if (!this.ball.active) return;
    this.gs.fx.fluffBurst(this.ball.x, this.ball.y, 0.5);
    this.gs.fx.popText(this.ball.x, this.ball.y - 20, 'POP!', '#ffffff', 16);
    this.ball.destroy();
    this.charge();
  }

  /** The game's off: the whole team comes for you. */
  private charge() {
    this.state = 'done';
    this.dangerous = false;
    for (const p of this.alive) p.chase(this.gs.nearestPlayer(p.x, p.y));
    if (this.ball.active) {
      const ball = this.ball;
      this.gs.tweens.add({ targets: ball, alpha: 0, delay: 1200, duration: 500, onComplete: () => ball.destroy() });
    }
  }

  private finish() {
    this.charge();
  }
}

/** A Plop on the volleyball court: plays until it spots you, then (once the game's off) it's a normal Plop. */
export class VolleyPlop extends Plop {
  readonly home: number;
  private mode: 'play' | 'chase' = 'play';
  private animT = 0;

  constructor(
    gs: GameScene,
    x: number,
    y: number,
    private match: VolleyMatch,
    readonly side: number,
  ) {
    super(gs, x, y);
    this.home = x;
  }

  alert(hero: Player | null) {
    if (hero) this.setFlipX(hero.x > this.x);
    this.gs.fx.popText(this.x, this.body.top - 14, '!', '#ff5a3c', 22);
    if (this.body.blocked.down) this.body.setVelocityY(-200);
  }

  chase(hero: Player | null) {
    if (this.mode === 'chase') return;
    this.mode = 'chase';
    this.dir = hero ? Math.sign(hero.x - this.x) || -1 : -1;
    this.speed = 62;
  }

  bumpAnim() {
    this.animT = 0.25;
    if (this.body.blocked.down) this.body.setVelocityY(-170);
  }

  spikeAnim() {
    this.animT = 0.35;
    if (this.body.blocked.down) this.body.setVelocityY(-330);
  }

  tick(dt = 1 / 60) {
    if (this.mode === 'chase') return super.tick(dt);
    this.animT -= dt;
    const tx = this.match.targetFor(this);
    const vx = tx !== null && Math.abs(tx - this.x) > 4 ? Phaser.Math.Clamp((tx - this.x) * 5, -150, 150) : 0;
    this.body.setVelocityX(vx);
    const ballX = this.match.ball.active ? this.match.ball.x : this.x - 1;
    this.setFlipX(ballX > this.x);
    this.setFrame(this.animT > 0 ? 'm0' : 'w0');
  }
}
