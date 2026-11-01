import Phaser from 'phaser';
import { DEPTH, MAX_FALL_SPEED, TILE } from '../../config';
import { ART_RES } from '../../gfx/draw';
import { sfx } from '../../core/sfx';
import type { EnemyKind } from '../../level/builder';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../Player';

export type DeathKind = 'stomp' | 'blast' | 'fall';

/**
 * Base enemy. Enemies sleep until the camera gets close (like classic
 * platformers) so the level plays the same way every time.
 */
export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  abstract readonly kind: EnemyKind;
  hp = 1;
  score = 100;
  /** Can be killed by jumping on it. */
  stompable = true;
  dead = false;
  awake = false;
  /** Landing on top just bounces you off (no damage either way). For enemies too big to stomp. */
  bouncyTop = false;
  /** Brief window after being stomped where touching it doesn't hurt (multi-hit enemies). */
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
    if (this.y > this.gs.level.heightPx + 64) this.kill('fall');
  }

  damage(n: number, how: DeathKind, by: Player | null) {
    if (this.dead) return;
    this.hp -= n;
    if (this.hp <= 0) {
      if (by) {
        by.stats.kills++;
        this.gs.addScore(by, this.score, this.x, this.y - 20);
      }
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
    // blasted: flip over and tumble off-screen
    this.setFlipY(true).setDepth(DEPTH.fx);
    this.gs.tweens.add({
      targets: this,
      y: this.y - 50,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () =>
        this.gs.tweens.add({
          targets: this,
          y: this.y + 520,
          angle: Phaser.Math.Between(-200, 200),
          duration: 850,
          ease: 'Quad.easeIn',
          onComplete: () => this.destroy(),
        }),
    });
  }

  protected onStompDeath() {
    this.gs.fx.stars(this.x, this.y, 5);
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

  /** Called when a player touches this enemy (not a stomp). */
  touchPlayer(p: Player) {
    p.hurt(this.x);
  }
}

/** Hi-res sketch art: textures are drawn at ART_RES× and shown scaled down. Sizes given in world px. */
function hiRes(e: Phaser.Physics.Arcade.Sprite, w: number, h: number, ox: number, oy: number) {
  const R = ART_RES;
  e.setScale(1 / R);
  (e.body as Phaser.Physics.Arcade.Body).setSize(w * R, h * R).setOffset(ox * R, oy * R);
}

// ─────────────────────────────────────────────────────────────

/** Walks back and forth, turning at walls (and ledges if `careful`). */
export class Walker extends Enemy {
  readonly kind: EnemyKind = 'walker';
  protected speed = 55;
  protected dir = -1;
  protected careful = false;
  protected frameA = 'w0';
  protected frameB = 'w1';

  constructor(gs: GameScene, x: number, y: number, texture = 'walker') {
    super(gs, x, y, texture, 'w0');
    this.body.setSize(30, 26).setOffset(5, 13);
  }

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

  protected animRate = 6;
  /** Sketch-based enemies are drawn facing left; the placeholder beetles face left too. */

  protected onStompDeath() {
    this.gs.fx.stars(this.x, this.y, 5);
    this.setFrame('flat');
    this.gs.tweens.add({ targets: this, alpha: 0, delay: 400, duration: 200, onComplete: () => this.destroy() });
  }
}

/** Puffball (from the sketches): small fluffy walker. Lots of them. One shot or one stomp. */
export class Puffball extends Walker {
  readonly kind: EnemyKind = 'puffball';
  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'puffball');
    hiRes(this, 22, 30, 13, 16);
    this.speed = 48;
    this.animRate = 7;
    this.score = 100;
  }
}

/** Big Puff (from the sketches): tall toothy brute. Fewer of them. Two hits; gets angry and faster after the first. */
export class BigPuff extends Walker {
  readonly kind: EnemyKind = 'bigpuff';
  private mad = false;
  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'bigpuff');
    hiRes(this, 36, 68, 18, 18);
    this.hp = 2;
    this.speed = 34;
    this.animRate = 4;
    this.careful = true;
    this.score = 300;
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

  protected onStompDeath() {
    this.gs.fx.stars(this.x, this.y, 8);
    super.onStompDeath();
  }
}

/**
 * Mega Puff (from the sketches): a giant. Too big to jump over and can't be
 * stomped. Five shots kill him, or run underneath while he's in the air.
 * He crouches before every jump so players can time the dash.
 */
export class MegaPuff extends Enemy {
  readonly kind: EnemyKind = 'megapuff';
  private dir = -1;
  private mode: 'walk' | 'crouch' | 'air' = 'walk';
  private timer = 1.2;
  private pips: Phaser.GameObjects.Graphics;
  private readonly maxHp = 5;

  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'megapuff', 'w0');
    hiRes(this, 104, 176, 36, 24);
    this.hp = this.maxHp;
    this.stompable = false;
    this.bouncyTop = true;
    this.score = 2000;
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
    const onGround = b.blocked.down;

    if (this.mode === 'walk') {
      if (target && Math.abs(target.x - this.x) > 20) this.dir = Math.sign(target.x - this.x);
      const aheadX = this.dir > 0 ? b.right + 4 : b.left - 4;
      const groundAhead = this.gs.level.isSolidAt(aheadX, b.bottom + 6);
      b.setVelocityX(groundAhead && !(this.dir < 0 ? b.blocked.left : b.blocked.right) ? this.dir * 32 : 0);
      this.setFrame(Math.floor(this.t * 3) % 2 ? 'w1' : 'w0');
      if (this.timer <= 0 && onGround) {
        this.mode = 'crouch';
        this.timer = 0.45;
        b.setVelocityX(0);
      }
    } else if (this.mode === 'crouch') {
      this.setFrame('crouch');
      if (this.timer <= 0) {
        this.mode = 'air';
        b.setVelocity(0, -860); // straight up, so the gap underneath is fair
        this.timer = 0.2;
      }
    } else {
      this.setFrame('air');
      if (onGround && this.timer <= 0) {
        this.mode = 'walk';
        this.timer = 1.6 + Math.random() * 0.9;
        b.setVelocityX(0);
        this.gs.cameras.main.shake(220, 0.012);
        this.gs.fx.dust(b.left + 10, b.bottom, 8);
        this.gs.fx.dust(b.right - 10, b.bottom, 8);
        sfx.thud();
      }
    }
    this.setFlipX(this.dir > 0);
    this.drawPips();
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

/** Spiky shell: hurts if you jump on it. Use the bazooka. */
export class Spiker extends Walker {
  readonly kind: EnemyKind = 'spiker';
  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'spiker');
    this.stompable = false;
    this.speed = 42;
    this.careful = true;
    this.hp = 2;
    this.score = 200;
  }
}

/** Waits, then leaps toward the nearest player. */
export class Hopper extends Enemy {
  readonly kind: EnemyKind = 'hopper';
  private wait = 0.8;

  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'hopper', 'idle');
    this.body.setSize(28, 26).setOffset(6, 16);
    this.score = 150;
  }

  tick(dt: number) {
    const b = this.body;
    const target = this.gs.nearestPlayer(this.x, this.y);
    if (b.blocked.down) {
      b.setVelocityX(b.velocity.x * 0.8);
      this.setFrame('idle');
      this.wait -= dt;
      if (this.wait <= 0) {
        const dir = target ? Math.sign(target.x - this.x) || -1 : -1;
        b.setVelocity(dir * 140, -620);
        this.setFlipX(dir > 0);
        this.wait = 1.1 + Math.random() * 0.6;
      }
    } else {
      this.setFrame('jump');
    }
  }
}

/** Flies in a figure-8-ish pattern around its spawn point. */
export class Flyer extends Enemy {
  readonly kind: EnemyKind = 'flyer';
  private baseX: number;
  private baseY: number;

  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'flyer', 'f0');
    this.body.setAllowGravity(false);
    this.body.setSize(26, 22).setOffset(9, 10);
    this.baseX = x;
    this.baseY = y;
    this.score = 150;
  }

  tick() {
    const t = this.t;
    const tx = this.baseX + Math.sin(t * 0.9) * TILE * 2.5;
    const ty = this.baseY + Math.sin(t * 2.4) * 22;
    this.body.setVelocity((tx - this.x) * 8, (ty - this.y) * 8);
    this.setFlipX(Math.cos(t * 0.9) > 0);
    this.setFrame(Math.floor(t * 14) % 2 ? 'f1' : 'f0');
  }

  protected onStompDeath() {
    this.body.enable = false;
    this.gs.fx.stars(this.x, this.y, 5);
    this.setFlipY(true);
    this.gs.tweens.add({ targets: this, y: this.y + 500, duration: 900, ease: 'Quad.easeIn', onComplete: () => this.destroy() });
  }
}

/** Stationary cannon that lobs slow orbs at the nearest player. */
export class Turret extends Enemy {
  readonly kind: EnemyKind = 'turret';
  private barrel: Phaser.GameObjects.Image;
  private cooldown = 1.2;

  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'turret');
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(56, 34).setOffset(4, 14);
    this.hp = 3;
    this.score = 300;
    this.barrel = gs.add.image(x, y - 6, 'barrel').setOrigin(0.15, 0.5).setDepth(DEPTH.enemies - 1);
    this.barrel.setRotation(Math.PI);
  }

  tick(dt: number) {
    const p = this.gs.nearestPlayer(this.x, this.y);
    this.barrel.setPosition(this.x, this.y - 6);
    if (!p) return;
    const dx = p.x - this.x;
    const dy = p.y - (this.y - 6);
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    this.barrel.setRotation(Phaser.Math.Angle.RotateTo(this.barrel.rotation, ang, dt * 3));
    this.cooldown -= dt;
    if (dist < 520 && this.cooldown <= 0) {
      this.cooldown = 2.2;
      const a = this.barrel.rotation;
      const speed = 190;
      const mx = this.x + Math.cos(a) * 30;
      const my = this.y - 6 + Math.sin(a) * 30;
      this.gs.spawnBullet(mx, my, Math.cos(a) * speed, Math.sin(a) * speed);
      this.gs.fx.dust(mx, my, 3);
      // recoil
      this.gs.tweens.add({ targets: this.barrel, scaleX: 0.75, duration: 70, yoyo: true });
    }
  }

  kill(how: DeathKind) {
    super.kill(how === 'stomp' ? 'blast' : how);
    this.gs.fx.explosion(this.x, this.y, 40);
    this.barrel.destroy();
  }
}

export function createEnemy(gs: GameScene, kind: EnemyKind, x: number, y: number): Enemy {
  switch (kind) {
    case 'puffball':
      return new Puffball(gs, x, y);
    case 'bigpuff':
      return new BigPuff(gs, x, y);
    case 'megapuff':
      return new MegaPuff(gs, x, y);
    case 'walker':
      return new Walker(gs, x, y);
    case 'spiker':
      return new Spiker(gs, x, y);
    case 'hopper':
      return new Hopper(gs, x, y);
    case 'flyer':
      return new Flyer(gs, x, y);
    case 'turret':
      return new Turret(gs, x, y);
  }
}
