import Phaser from 'phaser';
import { DEPTH, MAX_FALL_SPEED } from '../../config';
import { sfx } from '../../core/sfx';
import { ART_RES } from '../../gfx/draw';
import type { EnemyKind } from '../../level/builder';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../Player';

export type DeathKind = 'stomp' | 'blast' | 'fall';

/**
 * The bad guys — only the three from the sketches:
 *   Puffball      lots of them        1 shot or 1 stomp
 *   Big Puff Ball fewer of them       2 shots or 2 stomps (gets angry after the first)
 *   Giant         a few, at checkpoints   5 shots; can't be jumped over or stomped;
 *                 slip under him only with a perfectly timed run — he slams down otherwise
 *
 * Enemies sleep until the camera gets close, so the level plays the same way every time.
 */
export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  abstract readonly kind: EnemyKind;
  hp = 1;
  /** Can be killed by jumping on it. */
  stompable = true;
  /** Landing on top just bounces you off (no damage either way). */
  bouncyTop = false;
  dead = false;
  awake = false;
  /** Brief window after being stomped where touching it doesn't count (multi-hit enemies). */
  touchGraceUntil = 0;
  protected t = 0;
  private flashUntil = 0;

  constructor(
    protected gs: GameScene,
    x: number,
    y: number,
    texture: string,
    frame?: string,
  ) {
    super(gs, x, y, texture, frame);
    gs.add.existing(this);
    gs.physics.add.existing(this);
    this.setDepth(DEPTH.enemies);
    this.body.setMaxVelocityY(MAX_FALL_SPEED);
    this.body.moves = false;
  }

  /**
   * Snap the physics body to the sprite and forget any previous motion.
   * (Body.reset() mis-places scaled sprites, and without syncing prev/prevFrame
   * Arcade would "move" the sprite by the distance since the body was created.)
   */
  syncBody() {
    const b = this.body;
    b.updateFromGameObject();
    b.prev.set(b.x, b.y);
    b.prevFrame.set(b.x, b.y);
    b.velocity.set(0, 0);
  }

  wake() {
    this.awake = true;
    this.syncBody();
    this.body.moves = true;
  }

  /** Per-frame behaviour, only called while awake and alive. */
  abstract tick(dt: number): void;

  update(dt: number) {
    if (this.dead) return;
    this.t += dt;
    if (this.flashUntil && this.gs.time.now > this.flashUntil) {
      this.clearTint();
      this.flashUntil = 0;
    }
    if (this.awake) this.tick(dt);
    if (this.y > this.gs.level.heightPx + 120) this.kill('fall');
  }

  damage(n: number, how: DeathKind, by: Player | null) {
    if (this.dead) return;
    this.hp -= n;
    if (this.hp <= 0) {
      this.gs.onEnemyDefeated(this, by);
      this.kill(how);
    } else {
      this.setTintFill(0xffffff);
      this.flashUntil = this.gs.time.now + 90;
      sfx.bump();
    }
  }

  kill(how: DeathKind) {
    if (this.dead) return;
    this.dead = true;
    this.body.enable = false;
    this.clearTint();
    if (how === 'fall') {
      this.destroy();
      return;
    }
    if (how === 'stomp') {
      sfx.stomp();
      this.onStompDeath();
      return;
    }
    // blasted: pop into a puff of fluff and tumble off-screen
    this.gs.fx.fluffBurst(this.x, this.y, this.displayWidth / 40);
    this.setFlipY(true).setDepth(DEPTH.fx);
    this.gs.tweens.add({
      targets: this,
      y: this.y - 50,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () =>
        this.gs.tweens.add({
          targets: this,
          y: this.y + 560,
          angle: Phaser.Math.Between(-200, 200),
          duration: 850,
          ease: 'Quad.easeIn',
          onComplete: () => this.destroy(),
        }),
    });
  }

  protected onStompDeath() {
    this.gs.fx.stars(this.x, this.y, 5);
    this.gs.fx.fluffBurst(this.x, this.y, 0.6);
    this.gs.tweens.add({
      targets: this,
      scaleY: this.scaleY * 0.25,
      scaleX: this.scaleX * 1.3,
      y: this.y + this.displayHeight * 0.35,
      duration: 90,
      onComplete: () =>
        this.gs.tweens.add({ targets: this, alpha: 0, delay: 300, duration: 200, onComplete: () => this.destroy() }),
    });
  }
}

/** Hi-res sketch art: textures are drawn at `res`× and shown scaled down. Sizes in world px. */
function hiRes(e: Phaser.Physics.Arcade.Sprite, w: number, h: number, ox: number, oy: number, res = ART_RES) {
  e.setScale(1 / res);
  (e.body as Phaser.Physics.Arcade.Body).setSize(w * res, h * res).setOffset(ox * res, oy * res);
}

// ─────────────────────────────────────────────────────────────

/** Walks back and forth, turning at walls (and at ledges if `careful`). Art faces left. */
abstract class Walker extends Enemy {
  protected speed = 48;
  protected dir = -1;
  protected careful = false;
  protected frameA = 'w0';
  protected frameB = 'w1';
  protected animRate = 7;

  tick() {
    const b = this.body;
    if (b.blocked.left) this.dir = 1;
    else if (b.blocked.right) this.dir = -1;
    if (this.careful && b.blocked.down) {
      const aheadX = this.dir > 0 ? b.right + 2 : b.left - 2;
      if (!this.gs.level.isSolidAt(aheadX, b.bottom + 4)) this.dir *= -1;
    }
    b.setVelocityX(this.dir * this.speed);
    this.setFlipX(this.dir > 0);
    this.setFrame(Math.floor(this.t * this.animRate) % 2 ? this.frameB : this.frameA);
  }
}

/** Puffball: small fluffy walker. Lots of them. One shot or one stomp. */
export class Puffball extends Walker {
  readonly kind: EnemyKind = 'puffball';
  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'puffball', 'w0');
    hiRes(this, 22, 30, 13, 16);
  }

  protected onStompDeath() {
    this.gs.fx.stars(this.x, this.y, 5);
    this.setFrame('flat');
    this.gs.tweens.add({ targets: this, alpha: 0, delay: 400, duration: 200, onComplete: () => this.destroy() });
  }
}

/** Big Puff Ball: tall toothy brute. Fewer of them. Two hits; gets angry and faster after the first. */
export class BigPuff extends Walker {
  readonly kind: EnemyKind = 'bigpuff';
  private mad = false;
  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'bigpuff', 'w0');
    hiRes(this, 36, 68, 18, 18);
    this.hp = 2;
    this.speed = 34;
    this.animRate = 4;
    this.careful = true;
  }

  damage(n: number, how: DeathKind, by: Player | null) {
    super.damage(n, how, by);
    if (this.dead || this.mad) return;
    this.mad = true;
    this.speed = 70;
    this.animRate = 7;
    this.frameA = 'm0';
    this.frameB = 'm1';
    this.setFrame('m0');
    if (this.body.blocked.down) this.body.setVelocityY(-260); // angry hop
    this.gs.fx.popText(this.x, this.y - 44, '!!', '#ff5a3c', 22);
  }
}

/**
 * Giant: a boss who guards each checkpoint. Too big to jump over and can't be
 * stomped. Five shots to defeat. He stomps toward you, hops often (crouching
 * first as a warning), and every landing sends a shockwave rolling along the
 * ground — jump over it. Get close and he roars and CHARGES. Running
 * underneath works only with a perfectly timed full-speed dash while he's in
 * the air: if anyone is still under him after his reaction time, he SLAMS
 * straight down.
 */
export class Giant extends Enemy {
  readonly kind: EnemyKind = 'giant';
  static readonly REACTION = 0.27;
  private dir = -1;
  private mode: 'walk' | 'crouch' | 'air' | 'slamWindup' | 'slam' | 'chargeWindup' | 'charge' = 'walk';
  private timer = 1.0;
  private chargeCooldown = 1.2;
  private underFor = 0;
  private pips: Phaser.GameObjects.Graphics;
  private readonly maxHp = 5;

  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'giant', 'w0');
    hiRes(this, 104, 176, 36, 24, 2.5);
    this.hp = this.maxHp;
    this.stompable = false;
    this.bouncyTop = true;
    this.setDepth(DEPTH.enemies + 1);
    this.pips = gs.add.graphics().setDepth(DEPTH.text);
  }

  wake() {
    super.wake();
    sfx.roar();
  }

  tick(dt: number) {
    const b = this.body;
    const target = this.gs.nearestPlayer(this.x, this.y);
    this.timer -= dt;
    this.chargeCooldown -= dt;
    const onGround = b.blocked.down;

    switch (this.mode) {
      case 'walk': {
        if (target && Math.abs(target.x - this.x) > 20) this.dir = Math.sign(target.x - this.x);
        const aheadX = this.dir > 0 ? b.right + 4 : b.left - 4;
        const groundAhead = this.gs.level.isSolidAt(aheadX, b.bottom + 6);
        b.setVelocityX(groundAhead && !(this.dir < 0 ? b.blocked.left : b.blocked.right) ? this.dir * 72 : 0);
        this.setFrame(Math.floor(this.t * 5) % 2 ? 'w1' : 'w0');
        const dx = target ? Math.abs(target.x - this.x) : Infinity;
        const sameLevel = target ? Math.abs(target.bottom - b.bottom) < 48 : false;
        if (target && onGround && this.chargeCooldown <= 0 && dx < 300 && dx > 70 && sameLevel) {
          // wind up, then charge!
          this.mode = 'chargeWindup';
          this.timer = 0.45;
          b.setVelocityX(-this.dir * 40);
          sfx.roar();
          this.gs.fx.popText(this.x, b.top - 26, '!!', '#ff5a3c', 26);
        } else if (this.timer <= 0 && onGround) {
          this.mode = 'crouch';
          this.timer = 0.38;
          b.setVelocityX(0);
        }
        break;
      }
      case 'chargeWindup':
        this.setFrame('crouch');
        this.setX(this.x + Math.sin(this.t * 80) * 0.8);
        if (this.timer <= 0) {
          this.mode = 'charge';
          this.timer = 0.85;
        }
        break;
      case 'charge': {
        const aheadX = this.dir > 0 ? b.right + 6 : b.left - 6;
        const stop = !this.gs.level.isSolidAt(aheadX, b.bottom + 6) || (this.dir < 0 ? b.blocked.left : b.blocked.right);
        b.setVelocityX(stop ? 0 : this.dir * 310);
        this.setFrame(Math.floor(this.t * 12) % 2 ? 'w1' : 'w0');
        if (Math.random() < 0.5) this.gs.fx.dust(this.dir > 0 ? b.left + 8 : b.right - 8, b.bottom, 1);
        if (this.timer <= 0 || stop) {
          this.mode = 'walk';
          this.timer = 0.6;
          this.chargeCooldown = 3.2 + Math.random() * 1.5;
          b.setVelocityX(0);
          this.gs.cameras.main.shake(140, 0.006);
        }
        break;
      }
      case 'crouch':
        this.setFrame('crouch');
        if (this.timer <= 0) {
          this.mode = 'air';
          this.underFor = 0;
          // a hop: straight up when you're close (fair to dash under), a lunge toward you from afar
          const tgt = this.gs.nearestPlayer(this.x, this.y);
          const far = tgt ? Math.abs(tgt.x - this.x) > 260 : false;
          b.setVelocity(far ? this.dir * 150 : 0, far ? -620 : -600);
          this.timer = 0.15;
        }
        break;
      case 'air': {
        this.setFrame('air');
        // is anyone sneaking underneath? He reacts just slower than it takes that
        // hero to cross under him at full running speed — so only a perfectly
        // timed run gets through; walking (or a late run) gets slammed.
        const sneaker = this.gs.players.find((p) => p.alive && p.body.right > b.left + 2 && p.body.left < b.right - 2 && p.body.top >= b.bottom - 6);
        this.underFor = sneaker ? this.underFor + dt : 0;
        const reaction = sneaker ? Math.max(Giant.REACTION, (0.86 * (b.width + sneaker.body.width)) / sneaker.char.runSpeed) : Infinity;
        if (this.underFor >= reaction) {
          this.mode = 'slamWindup';
          this.timer = 0.05;
          b.setVelocity(0, 0);
          b.setAllowGravity(false);
          this.setFrame('slam');
          sfx.roar();
        } else if (onGround && this.timer <= 0) this.land(false);
        break;
      }
      case 'slamWindup':
        if (this.timer <= 0) {
          this.mode = 'slam';
          b.setAllowGravity(true);
          b.setVelocity(0, 1400);
        }
        break;
      case 'slam':
        this.setFrame('slam');
        if (onGround) this.land(true);
        break;
    }
    this.setFlipX(this.dir > 0);
    this.drawPips();
  }

  private land(slam: boolean) {
    const b = this.body;
    this.mode = 'walk';
    this.timer = 0.9 + Math.random() * 0.7;
    b.setVelocityX(0);
    this.gs.cameras.main.shake(slam ? 320 : 200, slam ? 0.02 : 0.01);
    this.gs.fx.dust(b.left + 10, b.bottom, slam ? 14 : 8);
    this.gs.fx.dust(b.right - 10, b.bottom, slam ? 14 : 8);
    if (slam) this.gs.fx.shockwave(this.x, b.bottom, 70);
    // every landing sends a shockwave rolling along the ground both ways: jump it!
    this.gs.spawnShockwave(b.left + 6, b.bottom, -1, slam ? 300 : 240);
    this.gs.spawnShockwave(b.right - 6, b.bottom, 1, slam ? 300 : 240);
    sfx.thud();
  }

  private drawPips() {
    const g = this.pips;
    g.clear();
    const w = 12;
    const x0 = this.x - (this.maxHp * w) / 2;
    const y = this.body.top - 16;
    for (let i = 0; i < this.maxHp; i++) {
      g.fillStyle(0x2a1e2e, 1).fillRoundedRect(x0 + i * w, y, w - 3, 7, 2);
      g.fillStyle(i < this.hp ? 0xff4d6d : 0x6b5a70, 1).fillRoundedRect(x0 + i * w + 1, y + 1, w - 5, 5, 1.5);
    }
  }

  damage(n: number, how: DeathKind, by: Player | null) {
    super.damage(n, how, by);
    if (!this.dead) this.drawPips();
  }

  kill(how: DeathKind) {
    this.pips.destroy();
    if (!this.dead && how !== 'fall') {
      this.gs.fx.explosion(this.x, this.y, 90);
      this.gs.fx.stars(this.x, this.y - 40, 16);
      this.gs.cameras.main.shake(300, 0.015);
    }
    super.kill(how === 'stomp' ? 'blast' : how);
  }
}

export function createEnemy(gs: GameScene, kind: EnemyKind, x: number, y: number): Enemy {
  switch (kind) {
    case 'puffball':
      return new Puffball(gs, x, y);
    case 'bigpuff':
      return new BigPuff(gs, x, y);
    case 'giant':
      return new Giant(gs, x, y);
  }
}
