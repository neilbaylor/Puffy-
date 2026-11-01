import Phaser from 'phaser';
import { DEPTH, MAX_FALL_SPEED } from '../config';
import type { CharacterDef } from '../data/characters';
import { sfx } from '../core/sfx';
import { emptyInput, type InputSource, type InputState } from '../input/types';
import type { GameScene } from '../scenes/GameScene';

const COYOTE = 0.1;
const JUMP_BUFFER = 0.12;
const HURT_STUN = 0.35;
const INVULN = 1.6;
const RESPAWN_INVULN = 2.4;

const HIT_W = 22;
const HIT_H = 34;

export type PlayerState = 'alive' | 'dead' | 'waiting' | 'finished';

/**
 * A player is an invisible physics hitbox plus a separate visual sprite.
 * Keeping them separate lets the visual squash/stretch/tilt freely without
 * ever changing the collision box.
 */
export class Player {
  readonly hitbox: Phaser.Physics.Arcade.Image;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly view: Phaser.GameObjects.Sprite;
  private tag: Phaser.GameObjects.Text;

  state: PlayerState = 'alive';
  hp: number;
  facing: 1 | -1 = 1;
  rocketsInFlight = 0;

  stats = { coins: 0, kills: 0, score: 0, deaths: 0 };

  private prev: InputState = emptyInput();
  private coyote = 0;
  private jumpBuffer = 0;
  private jumping = false;
  private fireCooldown = 0;
  private stun = 0;
  private invulnUntil = 0;
  private wasOnGround = true;
  private animTime = 0;
  private squash = { x: 1, y: 1 };
  private tilt = 0;
  bumpedThisFrame = false;

  constructor(
    private scene: GameScene,
    readonly slot: number,
    readonly char: CharacterDef,
    readonly input: InputSource,
    x: number,
    y: number,
    tagColor: string,
  ) {
    this.hp = char.maxHp;
    this.hitbox = scene.physics.add.image(x, y, '__DEFAULT').setVisible(false);
    this.body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(HIT_W, HIT_H, true);
    this.body.setMaxVelocityY(MAX_FALL_SPEED);
    this.body.setCollideWorldBounds(true);
    this.hitbox.setData('player', this);

    this.view = scene.add.sprite(x, y, `char-${char.id}`, 'idle0').setOrigin(0.5, 1).setDepth(DEPTH.players + slot);
    this.tag = scene.add
      .text(x, y, `P${slot + 1}`, {
        fontFamily: '"Lilita One", "Arial Black", sans-serif',
        fontSize: '13px',
        color: tagColor,
        stroke: '#2a1e2e',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.text);
  }

  get x() {
    return this.body.center.x;
  }
  get y() {
    return this.body.center.y;
  }
  get bottom() {
    return this.body.bottom;
  }
  get alive() {
    return this.state === 'alive';
  }
  get invulnerable() {
    return this.scene.time.now < this.invulnUntil;
  }
  get onGround() {
    return this.body.blocked.down || this.body.touching.down;
  }

  /** Called once per frame before physics resolves (from GameScene.update). */
  update(dt: number) {
    this.bumpedThisFrame = false;
    const input = this.state === 'alive' || this.state === 'finished' ? this.input.poll() : emptyInput();
    if (this.state === 'finished') {
      // auto-celebrate: stop and hop
      input.left = input.right = input.fire = input.run = false;
      input.jump = this.onGround && Math.random() < 0.03;
    }
    if (this.state !== 'alive' && this.state !== 'finished') {
      this.prev = input;
      return;
    }

    const c = this.char;
    const b = this.body;
    const onGround = this.onGround;
    const jumpPressed = input.jump && !this.prev.jump;
    this.stun = Math.max(0, this.stun - dt);
    const controllable = this.stun <= 0;

    // ── Horizontal movement ──
    const dir = controllable ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
    const maxSpeed = input.run ? c.runSpeed : c.walkSpeed;
    let vx = b.velocity.x;
    if (dir !== 0) {
      let accel = onGround ? c.accel : c.airAccel;
      if (Math.sign(vx) !== dir && Math.abs(vx) > 20) {
        accel *= onGround ? 2.2 : 1.4; // skid turn
        if (onGround && Math.abs(vx) > 120 && Math.random() < 0.4) this.scene.fx.dust(this.x, this.bottom, 1);
      }
      if (Math.abs(vx) > maxSpeed && Math.sign(vx) === dir) accel = c.accel * 0.4; // ease down from run speed
      vx = approach(vx, dir * maxSpeed, accel * dt);
      this.facing = dir as 1 | -1;
    } else if (controllable) {
      vx = approach(vx, 0, (onGround ? c.accel * 1.3 : c.airAccel * 0.35) * dt);
    }
    b.setVelocityX(vx);

    // ── Jumping (coyote time + input buffering + variable height) ──
    this.coyote = onGround ? COYOTE : this.coyote - dt;
    this.jumpBuffer = jumpPressed ? JUMP_BUFFER : this.jumpBuffer - dt;
    if (controllable && this.jumpBuffer > 0 && this.coyote > 0) {
      b.setVelocityY(-(c.jump + Math.abs(vx) * 0.12));
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.jumping = true;
      this.squash = { x: 0.75, y: 1.3 };
      this.scene.fx.dust(this.x, this.bottom, 5);
      sfx.jump();
    }
    if (this.jumping && (!input.jump || b.velocity.y >= 0)) {
      if (b.velocity.y < 0) b.setVelocityY(b.velocity.y * 0.45);
      this.jumping = false;
    }

    // ── Bazooka ──
    this.fireCooldown -= dt;
    if (controllable && input.fire && this.fireCooldown <= 0 && this.rocketsInFlight < c.maxRockets) {
      this.fireCooldown = c.fireRate;
      this.scene.fireRocket(this);
      b.setVelocityX(b.velocity.x - this.facing * 70); // recoil
      this.squash = { x: 1.15, y: 0.9 };
    }

    // ── Landing feedback ──
    if (onGround && !this.wasOnGround) {
      this.squash = { x: 1.3, y: 0.75 };
      this.scene.fx.dust(this.x, this.bottom, 4);
    }
    this.wasOnGround = onGround;
    this.prev = input;
  }

  /** Called after physics so the visual matches the resolved position. */
  sync(dt: number) {
    const b = this.body;
    // ease squash back to 1
    const k = 1 - Math.pow(0.0005, dt);
    this.squash.x += (1 - this.squash.x) * k;
    this.squash.y += (1 - this.squash.y) * k;

    if (this.state === 'alive' || this.state === 'finished') {
      this.view.setPosition(b.center.x, b.bottom + 2);
      this.view.setFlipX(this.facing < 0);
      const speed = Math.abs(b.velocity.x);
      const targetTilt = this.onGround ? (b.velocity.x / this.char.runSpeed) * 0.12 : (b.velocity.x / this.char.runSpeed) * 0.06;
      this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 12);
      this.view.setRotation(this.tilt);
      this.view.setScale(this.squash.x, this.squash.y);

      // frame selection
      let frame: string;
      if (this.stun > 0) frame = 'hurt';
      else if (!this.onGround) frame = b.velocity.y < 0 ? 'jump' : 'fall';
      else if (speed > 15) {
        this.animTime += dt * (4 + speed / 22);
        frame = `walk${Math.floor(this.animTime) % 4}`;
        if (speed > this.char.walkSpeed + 20 && Math.floor(this.animTime * 2) % 4 === 0 && Math.random() < 0.3)
          this.scene.fx.dust(this.x - this.facing * 8, this.bottom, 1);
      } else {
        this.animTime += dt * 1.6;
        frame = `idle${Math.floor(this.animTime) % 2}`;
      }
      this.view.setFrame(frame);

      // invulnerability flicker
      this.view.setAlpha(this.invulnerable ? (Math.floor(this.scene.time.now / 70) % 2 ? 0.35 : 1) : 1);
    }
    this.tag.setPosition(this.view.x, this.view.y - 52 * this.view.scaleY);
    this.tag.setVisible(this.state === 'alive' && this.scene.players.length > 1);
  }

  /** Bounce off an enemy you stomped. Holding jump bounces higher. */
  bounce() {
    const high = this.input.poll().jump;
    this.body.setVelocityY(high ? -this.char.jump * 1.0 : -this.char.jump * 0.62);
    this.jumping = high;
    this.squash = { x: 0.8, y: 1.25 };
  }

  hurt(fromX: number) {
    if (this.state !== 'alive' || this.invulnerable) return;
    this.hp -= 1;
    if (this.hp <= 0) {
      this.die(false);
      return;
    }
    sfx.hurt();
    this.invulnUntil = this.scene.time.now + INVULN * 1000;
    this.stun = HURT_STUN;
    const away = Math.sign(this.x - fromX) || -this.facing;
    this.body.setVelocity(away * 240, -360);
    this.scene.cameras.main.shake(120, 0.004);
    this.scene.onPlayerHurt(this);
  }

  heal(n = 1) {
    this.hp = Math.min(this.char.maxHp, this.hp + n);
  }

  /** @param fell true when the player fell into a pit (no hop animation). */
  die(fell: boolean) {
    if (this.state !== 'alive') return;
    this.state = 'dead';
    this.hp = 0;
    this.stats.deaths++;
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    sfx.die();
    this.view.setFrame('hurt').setAlpha(1).setRotation(0).setScale(1);
    if (!fell) {
      // classic hop-and-fall-off-screen
      this.view.setDepth(DEPTH.fx + 5);
      this.scene.tweens.add({
        targets: this.view,
        y: this.view.y - 70,
        duration: 380,
        ease: 'Quad.easeOut',
        onComplete: () =>
          this.scene.tweens.add({
            targets: this.view,
            y: this.view.y + 600,
            angle: 200 * this.facing,
            duration: 900,
            ease: 'Quad.easeIn',
          }),
      });
    } else {
      this.view.setVisible(false);
    }
    this.scene.onPlayerDied(this);
  }

  /** Bring a player back in at (x, y) with brief invulnerability. */
  respawn(x: number, y: number) {
    this.scene.tweens.killTweensOf(this.view);
    this.state = 'alive';
    this.hp = this.char.maxHp;
    this.body.enable = true;
    this.body.reset(x, y);
    this.body.setVelocity(0, -200);
    this.invulnUntil = this.scene.time.now + RESPAWN_INVULN * 1000;
    this.stun = 0;
    this.prev = emptyInput();
    this.view.setVisible(true).setAngle(0).setDepth(DEPTH.players + this.slot);
    this.squash = { x: 0.6, y: 1.5 };
    this.scene.fx.stars(x, y, 8);
  }

  finish() {
    this.state = 'finished';
    this.invulnUntil = 0;
  }

  setWaiting() {
    this.state = 'waiting';
    this.view.setVisible(false);
  }

  /** Clamp inside the visible camera area (co-op screen edges, like modern co-op platformers). */
  clampTo(left: number, right: number) {
    if (this.state !== 'alive') return;
    const b = this.body;
    if (b.left < left) {
      b.x = left;
      if (b.velocity.x < 0) b.setVelocityX(0);
    } else if (b.right > right) {
      b.x = right - b.width;
      if (b.velocity.x > 0) b.setVelocityX(0);
    }
  }

  destroy() {
    this.hitbox.destroy();
    this.view.destroy();
    this.tag.destroy();
  }
}

function approach(v: number, target: number, step: number) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}
