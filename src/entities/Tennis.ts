import Phaser from 'phaser';
import { DEPTH, GRAVITY, TILE } from '../config';
import { sfx } from '../core/sfx';
import { COURT, NET_CELL_H, NET_GROUND, SEAT_UP, TCRAB_H, TCRAB_W, drawCourtBack, drawCourtFront, type TCrabTeam } from '../gfx/tennis';
import { addCanvas, hires } from '../gfx/textures';
import type { GameScene } from '../scenes/GameScene';
import { Enemy, type DeathKind } from './enemies/Enemy';
import type { Player } from './Player';

/** They spot you once you're this close to one of them. */
const SPOT = 340;
/** How far a smash reaches (any further and they come after you instead). */
const REACH = 620;
/** The clam's own gravity under the water (px/s²): it floats a little. */
const G = 520;
/** The net's height over the court (world px). */
const NET_H = 34;
/** The clam's radius (world px). */
const R = 10;
/** The crabs' sheets are drawn this many times their art size; shown at CRAB_K of it. */
export const TCRAB_RES = 2.5;
const CRAB_K = 0.8;
const CLAM_K = 0.95;

/**
 * Crabs playing doubles tennis under the sea (World 3's mid-level match, like the soccer in Part 1
 * and the volleyball in Part 3) — with a clam for a ball. They rally it back and forth over the net
 * until one of them spots you: the umpire hops up and down, a "!" over every crab, and whoever has
 * the clam next SMASHES it at you. They fetch it and keep smashing until you're past, the clam's
 * popped open (shoot it) or the crabs are; then they scuttle after you.
 */
export class TennisMatch {
  readonly ball: Phaser.Physics.Arcade.Image;
  private team: TennisCrab[] = [];
  private state: 'idle' | 'rally' | 'alert' | 'smashed' | 'fetch' | 'hold' | 'done' = 'idle';
  private receiver: TennisCrab | null = null;
  private landX = 0;
  private timer = 0;
  private dangerous = false;
  private prevX = 0;
  private prevY = 0;
  private readonly netX: number;
  private ump: Phaser.GameObjects.Sprite;
  private umpY = 0;
  private umpT = 0;
  private shadow: Phaser.GameObjects.Ellipse;
  private readonly left: number;
  private readonly right: number;
  private dangerousMode = false;
  private held = 0;

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
    const w = Math.round(half * 2);
    const { END, UP, DOWN, BACK_UP } = COURT;
    // the court (just over the ground's top edge, behind the players), and behind it the boards,
    // towers, scoreboard and the umpire's chair
    const fkey = `court-front-${w}`;
    const bkey = `court-back-${w}`;
    if (!gs.textures.exists(fkey)) addCanvas(gs, fkey, hires(w + END * 2, UP + DOWN, 2, (ctx) => drawCourtFront(ctx, w)), undefined, { release: true });
    if (!gs.textures.exists(bkey)) addCanvas(gs, bkey, hires(w + END * 2, BACK_UP, 1.5, (ctx) => drawCourtBack(ctx, w)), undefined, { release: true });
    gs.add.image(this.left - END, ground, fkey).setOrigin(0, UP / (UP + DOWN)).setScale(1 / 2).setDepth(DEPTH.tiles + 0.5);
    gs.add.image(this.left - END, ground, bkey).setOrigin(0, 1).setScale(1 / 1.5).setDepth(DEPTH.decor - 1);
    gs.add.image(cx, ground, 'tennisnet').setOrigin(0.5, NET_GROUND / NET_CELL_H).setScale(1 / 3).setDepth(DEPTH.enemies + 2);
    // the umpire: a little crab up on the chair
    this.ump = gs.add
      .sprite(cx + 22, ground - SEAT_UP + 2, 'tcrab-ump', 'ready0')
      .setOrigin(0.5, 1)
      .setScale(0.42 / 2)
      .setDepth(DEPTH.decor - 0.9);
    this.umpY = this.ump.y;
    this.shadow = gs.add.ellipse(cx, ground - 2, 16, 4, 0x1a3050, 0.25).setDepth(DEPTH.tiles + 0.55);

    // doubles: two a side, red on the left, orange on the right
    for (const [side, f] of [[-1, 0.7], [-1, 0.3], [1, 0.3], [1, 0.7]] as const) {
      const e = new TennisCrab(gs, cx + side * half * f, ground - 30, this, side, side < 0 ? 'red' : 'orange');
      gs.addEnemy(e, ground);
      this.team.push(e);
    }
    this.ball = gs.physics.add.image(this.team[1].x, ground - 50, 'clam', 'shut').setScale(CLAM_K / 3).setDepth(DEPTH.enemies + 1);
    const b = this.body;
    b.setCircle(R * (3 / CLAM_K), 14 * 3 - R * (3 / CLAM_K), 12 * 3 - R * (3 / CLAM_K));
    b.setGravityY(G - gs.physics.world.gravity.y);
    b.setBounce(0.45, 0.5);
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

  /** They've seen you (they hurry). */
  get hot() {
    return this.dangerousMode;
  }

  /** Where a crab wants to stand (null: stay put). */
  targetFor(p: TennisCrab): number | null {
    if (!this.ball.active) return null;
    if (p === this.receiver && (this.state === 'rally' || this.state === 'alert' || this.state === 'fetch')) return this.landX;
    return p.home;
  }

  /** The umpire (hops when they spot you) and the clam's shadow on the court. */
  private updateDecor(dt: number) {
    const on = this.ball.active && this.ball.x > this.left - 40 && this.ball.x < this.right + 40;
    this.shadow.setVisible(on);
    if (on) {
      const k = Phaser.Math.Clamp(1 - (this.ground - this.ball.y) / 240, 0.3, 1);
      this.shadow.setPosition(this.ball.x, this.ground - 1).setScale(k).setAlpha(0.3 * k);
    }
    this.umpT = Math.max(0, this.umpT - dt);
    this.ump.y = this.umpY - (this.umpT > 0 ? Math.abs(Math.sin(this.umpT * 14)) * 5 : 0);
    if (this.ball.active) this.ump.setFlipX(this.ball.x < this.ump.x);
    const blink = Math.floor(this.gs.time.now / 100) % 37 === 0;
    this.ump.setFrame(this.umpT > 0 ? (Math.floor(this.umpT * 10) % 2 ? 'smash0' : 'ready0') : blink ? 'blink' : 'ready0');
  }

  update(dt: number) {
    this.updateDecor(dt);
    if (this.state === 'done') return;
    const alive = this.alive;
    if (!this.ball.active) return;
    if (!alive.length) return this.charge();
    const hero = this.gs.nearestPlayer(this.netX, this.ground);
    const b = this.body;
    if (this.state === 'idle') {
      if (!alive.some((p) => p.awake)) return;
      this.state = 'rally';
      this.serve(alive.find((p) => p.side < 0) ?? alive[0]);
      return;
    }
    if (this.ball.y > this.gs.level.heightPx + 60) return this.charge();
    // the clam tumbles end over end
    this.ball.rotation += (b.velocity.x * dt) / (R * 1.5);
    // the net: low over it bounces it back
    if (b.moves && Math.sign(this.prevX - this.netX) !== Math.sign(this.ball.x - this.netX) && this.ball.y > this.ground - NET_H) {
      this.ball.x = this.prevX;
      b.setVelocityX(-b.velocity.x * 0.35);
      sfx.bump();
    }
    this.prevX = this.ball.x;
    // you came too close (or one got hurt): they've seen you
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
        // (it reaches the clam as it comes down past racket height — across the whole frame, so a
        // slow device moving the clam a long way at once doesn't miss)
        const top = this.ground - 50;
        const bottom = this.ground - 8;
        const through = this.prevY <= bottom && this.ball.y >= top;
        const reach = Math.abs(rec.x - this.ball.x) < (this.dangerousMode ? 36 : 28) && through && b.velocity.y > 0;
        if (reach) {
          if (this.state === 'alert' && hero && hero.alive && this.onScreen(rec.x)) this.smash(rec, hero);
          else this.hit(rec);
        } else if (b.blocked.down && (Math.abs(b.velocity.y) < 40 || this.dangerousMode)) {
          if (this.dangerousMode) b.setVelocity(b.velocity.x * 0.2, 0);
          this.state = this.state === 'alert' ? 'fetch' : 'rally';
          this.fetchBy(this.nearest(alive, this.ball.x));
        }
        this.prevY = this.ball.y;
        break;
      }
      case 'smashed': {
        this.prevY = this.ball.y;
        if (this.dangerous) this.checkHit();
        if (b.blocked.down && Math.abs(b.velocity.x) < 120) this.dangerous = false;
        this.timer -= dt;
        if (!this.dangerous && this.timer <= 0) {
          if (this.ball.x < this.left - 220 || this.ball.x > this.right + 220) return this.charge();
          this.state = 'fetch';
          this.fetchBy(this.nearest(alive, this.ball.x));
        }
        break;
      }
      case 'fetch': {
        const f = this.receiver && !this.receiver.dead ? this.receiver : this.nearest(alive, this.ball.x);
        this.receiver = f;
        this.landX = this.ball.x;
        if (b.blocked.down) b.setVelocityX(b.velocity.x * Math.pow(0.02, dt));
        if (Math.abs(f.x - this.ball.x) < 22 && (b.blocked.down || this.ball.y > this.ground - 30)) {
          this.state = 'hold';
          this.timer = this.dangerousMode ? 0.3 : 0.5;
          this.held = 0;
          b.moves = false;
          b.setVelocity(0, 0);
        }
        break;
      }
      case 'hold': {
        // tossed up over its head, then (if it's seen you) smashed at you, else served
        const f = this.receiver;
        if (!f || f.dead) {
          b.moves = true;
          this.state = 'fetch';
          break;
        }
        this.ball.setPosition(f.x, f.body.top - R - 10 - Math.sin(Math.min(1, this.held * 2.5) * Math.PI) * 14);
        this.timer -= dt;
        this.held += dt;
        const farSide = hero ? Math.sign(f.x - this.netX) !== Math.sign(hero.x - this.netX) : false;
        if (this.timer <= 0 && this.dangerousMode && hero && hero.alive && !this.onScreen(f.x) && farSide) {
          b.moves = true;
          this.state = 'alert';
          this.hit(f);
          break;
        }
        if (this.timer <= 0 && this.dangerousMode && hero && hero.alive && Math.abs(hero.x - f.x) < REACH && !this.onScreen(f.x) && this.held < 2) this.timer = 0.05;
        if (this.timer <= 0) {
          b.moves = true;
          if (this.dangerousMode && hero && hero.alive && Math.abs(hero.x - f.x) < REACH) this.smash(f, hero);
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

  /** Inside the camera's view (not just peeking in at an edge). */
  private onScreen(x: number) {
    const v = this.gs.cameras.main.worldView;
    return x > v.x + v.width * 0.1 && x < v.right - v.width * 0.1;
  }

  private nearest(list: TennisCrab[], x: number) {
    return list.reduce((a, c) => (Math.abs(c.x - x) < Math.abs(a.x - x) ? c : a));
  }

  private fetchBy(p: TennisCrab) {
    this.receiver = p;
    this.landX = this.ball.x;
  }

  /** A shot over the net to a spot on the other side; the nearest crab there goes to meet it. */
  private hit(from: TennisCrab) {
    const otherSide = from.x < this.netX ? 1 : -1;
    const side = this.alive.filter((p) => Math.sign(p.x - this.netX) === otherSide);
    const lo = otherSide > 0 ? this.netX + 30 : this.left + 20;
    const hi = otherSide > 0 ? this.right - 20 : this.netX - 30;
    this.landX = Phaser.Math.Between(Math.round(lo), Math.round(hi));
    // once they've seen you: straight to the one nearest you on that side (no running for it), for the smash
    const hero = this.dangerousMode ? this.gs.nearestPlayer(this.netX, this.ground) : null;
    const setter = hero && side.length ? this.nearest(side, hero.x) : null;
    if (setter) this.landX = Phaser.Math.Clamp(setter.x, lo, hi);
    this.launch(this.landX, this.ground - 26, setter ? 0.85 + Math.random() * 0.1 : 0.95 + Math.random() * 0.3);
    from.swingAnim();
    sfx.kick(0.5);
    this.receiver = setter ?? (side.length ? this.nearest(side, this.landX) : this.nearest(this.alive, this.landX));
  }

  private serve(from: TennisCrab) {
    this.body.moves = true;
    this.ball.setPosition(from.x, from.body.top - R - 6);
    this.hit(from);
  }

  /** Send the clam so it passes through (tx, ty) after T seconds. */
  private launch(tx: number, ty: number, T: number) {
    this.ball.y -= 2;
    this.body.setVelocity((tx - this.ball.x) / T, (ty - this.ball.y - 0.5 * G * T * T) / T);
  }

  private alert(hero: Player) {
    if (this.dangerousMode) return;
    this.dangerousMode = true;
    if (this.state === 'rally') this.state = 'alert';
    sfx.whistle();
    this.umpT = 1.1;
    for (const p of this.alive) p.alert(hero);
  }

  /** A leap and an overhead SMASH, straight at you. */
  private smash(p: TennisCrab, hero: Player) {
    p.smashAnim();
    this.body.moves = true;
    this.ball.setPosition(p.x + Math.sign(hero.x - p.x) * 8, p.body.top - R - 8);
    const T = Phaser.Math.Clamp(Math.abs(hero.x - this.ball.x) / 460, 0.35, 0.95);
    this.launch(hero.x, hero.body.center.y, T);
    this.dangerous = true;
    this.state = 'smashed';
    this.timer = 1.1;
    sfx.kick(1);
    this.gs.fx.popText(p.x, p.body.top - 20, 'SMASH!', '#ffd23f', 16);
    this.gs.amb.sea?.bubbles(this.ball.x, this.ball.y, 5);
    this.gs.cameras.main.shake(90, 0.003);
  }

  /** The clam reaches a hero: land on it and bounce off; otherwise it knocks you. */
  private checkHit() {
    const b = this.body;
    for (const p of this.gs.players) {
      if (!p.alive) continue;
      const pb = p.body;
      const { x, y } = this.ball;
      const r = R;
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

  /** A rocket hit the clam: it pops open (a pearl!) and sinks; the crabs come after you. */
  popBall() {
    if (!this.ball.active) return;
    const ball = this.ball;
    this.gs.fx.sparkle(ball.x, ball.y, 10);
    this.gs.amb.sea?.bubbles(ball.x, ball.y, 8);
    this.gs.fx.popText(ball.x, ball.y - 20, 'POP!', '#ffffff', 16);
    sfx.pop();
    ball.setFrame('open').setRotation(0);
    (ball.body as Phaser.Physics.Arcade.Body).enable = false;
    this.gs.tweens.add({ targets: ball, y: ball.y + 40, alpha: 0, delay: 500, duration: 900, ease: 'Sine.easeIn', onComplete: () => ball.destroy() });
    this.shadow.setVisible(false);
    this.charge();
  }

  /** The game's off: every crab comes for you. */
  private charge() {
    this.state = 'done';
    this.dangerous = false;
    for (const p of this.alive) p.chase();
    if (this.ball.active && this.body.enable) {
      const ball = this.ball;
      this.gs.tweens.add({ targets: ball, alpha: 0, delay: 1200, duration: 500, onComplete: () => ball.destroy() });
    }
  }
}

/**
 * A crab on the tennis court: plays till it spots you; once the game's off it scuttles after you
 * along the sea bed, hopping up to pinch when you're above it. Touching one hurts; a rocket (or a
 * stomp) and it's out.
 */
export class TennisCrab extends Enemy {
  readonly kind = 'crab' as const;
  readonly home: number;
  private mode: 'play' | 'chase' = 'play';
  private animT = 0;
  private anim: 'swing' | 'smash' = 'swing';
  private runT = 0;
  private blinkIn = 1 + Math.random() * 3;
  private hopT = 1;

  constructor(
    gs: GameScene,
    x: number,
    y: number,
    private match: TennisMatch,
    readonly side: number,
    team: TCrabTeam,
  ) {
    super(gs, x, y, `tcrab-${team}`, 'ready0');
    this.home = x;
    this.setScale(CRAB_K / TCRAB_RES);
    this.body.setSize(28 * TCRAB_RES, 26 * TCRAB_RES);
    this.body.setOffset((TCRAB_W / 2 - 16) * TCRAB_RES, (TCRAB_H - 27) * TCRAB_RES);
    // (crabs walk the sea bed: heavy, not floaty like a swimmer)
    this.body.setGravityY(GRAVITY - gs.physics.world.gravity.y);
  }

  alert(hero: Player | null) {
    if (hero) this.setFlipX(hero.x < this.x);
    this.gs.fx.popText(this.x, this.body.top - 14, '!', '#ff5a3c', 22);
    if (this.body.blocked.down) this.body.setVelocityY(-180);
  }

  chase() {
    this.mode = 'chase';
  }

  swingAnim() {
    this.anim = 'swing';
    this.animT = 0.3;
  }

  smashAnim() {
    this.anim = 'smash';
    this.animT = 0.4;
    if (this.body.blocked.down) this.body.setVelocityY(-300);
  }

  tick(dt: number) {
    const b = this.body;
    this.animT -= dt;
    this.blinkIn -= dt;
    if (this.blinkIn < -0.12) this.blinkIn = 1.5 + Math.random() * 3;
    let moving = false;
    if (this.mode === 'chase') {
      // scuttle after you, sideways of course; a hop up when you're over it
      const hero = this.gs.nearestPlayer(this.x, this.y);
      const dx = hero ? hero.x - this.x : 0;
      const dir = Math.sign(dx) || -1;
      b.setVelocityX(Math.abs(dx) > 6 ? dir * 88 : 0);
      this.setFlipX(dir < 0);
      this.hopT -= dt;
      if (hero && b.blocked.down && this.hopT <= 0 && Math.abs(dx) < 70 && hero.y < this.y - 30 && hero.y > this.y - 150) {
        b.setVelocityY(-250);
        this.hopT = 0.9 + Math.random() * 0.6;
      }
      if ((b.blocked.left || b.blocked.right) && b.blocked.down) b.setVelocityY(-280);
      moving = Math.abs(b.velocity.x) > 10;
    } else {
      const tx = this.match.targetFor(this);
      const top = this.match.hot ? 230 : 140;
      const vx = tx !== null && Math.abs(tx - this.x) > 4 ? Phaser.Math.Clamp((tx - this.x) * 5, -top, top) : 0;
      b.setVelocityX(vx);
      moving = Math.abs(vx) > 10;
      const ballX = this.match.ball.active ? this.match.ball.x : this.x - this.side;
      this.setFlipX(ballX < this.x);
    }
    this.runT += dt * (moving ? 12 : 2.2);
    let f: string;
    if (this.gs.time.now - this.hurtAt < 300) f = 'hurt';
    else if (this.animT > 0) f = this.anim === 'smash' ? (this.animT > 0.22 ? 'smash0' : 'smash1') : this.animT > 0.16 ? 'swing0' : 'swing1';
    else if (moving) f = Math.floor(this.runT) % 2 ? 'run0' : 'run1';
    else if (this.blinkIn < 0) f = 'blink';
    else f = Math.floor(this.runT) % 2 ? 'ready1' : 'ready0';
    this.setFrame(f);
  }

  /** Out: a puff of bubbles, flipped over, and it sinks away. */
  kill(how: DeathKind) {
    if (this.dead) return;
    if (how === 'fall') return super.kill(how);
    if (how === 'stomp') sfx.stomp();
    else sfx.pop();
    this.dead = true;
    this.body.enable = false;
    this.clearTint();
    this.gs.amb.sea?.bubbles(this.x, this.y, 10);
    this.gs.fx.stars(this.x, this.y - 6, 4);
    this.setFrame('hurt').setFlipY(true).setDepth(DEPTH.fx - 1);
    this.gs.tweens.add({ targets: this, y: this.y - 30, duration: 300, ease: 'Quad.easeOut', onComplete: () => this.gs.tweens.add({ targets: this, y: this.y + 60, alpha: 0, angle: this.flipX ? -40 : 40, duration: 900, ease: 'Quad.easeIn', onComplete: () => this.destroy() }) });
  }
}
