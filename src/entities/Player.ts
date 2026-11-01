import Phaser from 'phaser';
import { DEPTH, MAX_FALL_SPEED } from '../config';
import type { CharacterDef } from '../data/characters';
import { sfx } from '../core/sfx';
import { ART_RES } from '../gfx/draw';
import { emptyInput, type InputSource, type InputState } from '../input/types';
import type { GameScene } from '../scenes/GameScene';

const COYOTE = 0.1;
const JUMP_BUFFER = 0.12;
const HIT_STUN = 0.35;
const INVULN = 1.8;
const RESPAWN_INVULN = 1.5;
/** After running the meter dry you have to let it refill this much before running again. */
const EXHAUSTED_UNTIL = 0.3;
const RECOIL_TIME = 0.16;

const HIT_W = 22;
const HIT_H = 34;
/** Character textures are hi-res; this maps them back to world size. */
const S = 1 / ART_RES;

export type PlayerState = 'alive' | 'fainted' | 'finished';

/**
 * The hero: an invisible physics hitbox plus a separate visual sprite (so the
 * picture can squash, stretch, tilt and recoil without changing collisions).
 */
export class Player {
  readonly hitbox: Phaser.Physics.Arcade.Image;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly view: Phaser.GameObjects.Sprite;
  private meter: Phaser.GameObjects.Graphics;

  state: PlayerState = 'alive';
  facing: 1 | -1 = 1;
  rocketsInFlight = 0;

  /** 0..1 */
  stamina = 1;
  exhausted = false;
  running = false;

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
  private recoil = 0;
  private recoilShift = 0;
  /** Horizontal speed when we left the ground (so run-jumps keep their speed). */
  private launchSpeed = 0;

  constructor(
    private scene: GameScene,
    readonly char: CharacterDef,
    readonly input: InputSource,
    x: number,
    y: number,
  ) {
    this.hitbox = scene.physics.add.image(x, y, '__DEFAULT').setVisible(false);
    this.body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(char.hitW ?? HIT_W, char.hitH ?? HIT_H, true);
    this.body.setMaxVelocityY(MAX_FALL_SPEED);
    this.body.setCollideWorldBounds(true);
    this.hitbox.setData('player', this);

    this.view = scene.add.sprite(x, y, `char-${char.id}`, 'idle0').setOrigin(0.5, 1).setScale(S).setDepth(DEPTH.players);
    this.meter = scene.add.graphics().setDepth(DEPTH.text);
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

  /** Called once per frame (from GameScene.update). */
  update(dt: number) {
    if (this.state === 'fainted') return;
    let input = this.input.poll();
    if (this.state === 'finished') {
      input = emptyInput();
      input.jump = this.onGround && Math.random() < 0.03; // happy hops at the goal
    }

    const c = this.char;
    const b = this.body;
    const onGround = this.onGround;
    const jumpPressed = input.jump && !this.prev.jump;
    this.stun = Math.max(0, this.stun - dt);
    const controllable = this.stun <= 0;
    const dir = controllable ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;

    // ── Stamina: running drains it fast; it refills as soon as you stop ──
    const wantsRun = input.run && dir !== 0;
    this.running = wantsRun && !this.exhausted && this.stamina > 0;
    if (this.running && onGround) {
      this.stamina -= dt / c.staminaSecs;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.exhausted = true;
        this.running = false;
        this.scene.fx.dust(this.x, this.bottom, 6);
      }
    } else if (!this.running) {
      this.stamina = Math.min(1, this.stamina + dt / c.refillSecs);
      if (this.exhausted && this.stamina >= EXHAUSTED_UNTIL) this.exhausted = false;
    }

    // ── Horizontal movement ──
    let maxSpeed = this.running ? c.runSpeed : c.walkSpeed;
    if (!onGround) maxSpeed = Math.max(maxSpeed, Math.min(this.launchSpeed, c.runSpeed)); // keep run-jump momentum
    let vx = b.velocity.x;
    if (dir !== 0) {
      let accel = onGround ? c.accel : c.airAccel;
      if (this.running) accel *= 1.25;
      if (Math.sign(vx) !== dir && Math.abs(vx) > 20) {
        accel *= onGround ? 2.4 : 1.4; // skid turn
        if (onGround && Math.abs(vx) > 140 && Math.random() < 0.4) this.scene.fx.dust(this.x, this.bottom, 1);
      }
      if (Math.abs(vx) > maxSpeed && Math.sign(vx) === dir) accel = c.accel * 0.5; // ease down from run speed
      vx = approach(vx, dir * maxSpeed, accel * dt);
      this.facing = dir as 1 | -1;
    } else if (controllable) {
      vx = approach(vx, 0, (onGround ? c.accel * 1.4 : c.airAccel * 0.3) * dt);
    }
    b.setVelocityX(vx);

    // ── Jumping (coyote time + input buffer + variable height) ──
    this.coyote = onGround ? COYOTE : this.coyote - dt;
    this.jumpBuffer = jumpPressed ? JUMP_BUFFER : this.jumpBuffer - dt;
    if (controllable && this.jumpBuffer > 0 && this.coyote > 0) {
      const runBoost = this.running ? 1.06 : 1; // running jumps go a little further
      b.setVelocity(vx * runBoost, -(c.jump + Math.abs(vx) * 0.1));
      this.launchSpeed = Math.abs(vx * runBoost);
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.jumping = true;
      this.squash = { x: 0.75, y: 1.3 };
      this.scene.fx.dust(this.x, this.bottom, 5);
      sfx.jump();
    }
    if (onGround) this.launchSpeed = Math.abs(vx);
    if (this.jumping && (!input.jump || b.velocity.y >= 0)) {
      if (b.velocity.y < 0) b.setVelocityY(b.velocity.y * 0.45);
      this.jumping = false;
    }

    // ── Bazooka ──
    this.fireCooldown -= dt;
    if (this.state === 'alive' && controllable && input.fire && this.fireCooldown <= 0 && this.rocketsInFlight < c.maxRockets) {
      this.fireCooldown = c.fireRate;
      this.scene.fireRocket(this);
      b.setVelocityX(b.velocity.x - this.facing * 80); // recoil push
      this.recoil = RECOIL_TIME;
      this.recoilShift = 5;
      this.squash = { x: 1.12, y: 0.92 };
    }
    this.recoil = Math.max(0, this.recoil - dt);

    // ── Landing feedback ──
    if (onGround && !this.wasOnGround) {
      this.squash = { x: 1.3, y: 0.75 };
      this.scene.fx.dust(this.x, this.bottom, 4);
    }
    this.wasOnGround = onGround;
    this.prev = input;
  }

  /** Called after physics so the picture matches the resolved position. */
  sync(dt: number) {
    const b = this.body;
    const k = 1 - Math.pow(0.0005, dt);
    this.squash.x += (1 - this.squash.x) * k;
    this.squash.y += (1 - this.squash.y) * k;
    this.recoilShift += (0 - this.recoilShift) * Math.min(1, dt * 14);

    if (this.state !== 'fainted') {
      this.view.setPosition(b.center.x - this.facing * this.recoilShift, b.bottom + 2);
      this.view.setFlipX(this.facing < 0);
      const speed = Math.abs(b.velocity.x);
      const targetTilt = (b.velocity.x / this.char.runSpeed) * (this.onGround ? 0.14 : 0.06);
      this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 12);
      this.view.setRotation(this.tilt);
      this.view.setScale(this.squash.x * S, this.squash.y * S);

      let frame: string;
      if (this.stun > 0) frame = 'hurt';
      else if (this.recoil > 0) frame = 'shoot';
      else if (!this.onGround) frame = b.velocity.y < 0 ? 'jump' : 'fall';
      else if (speed > 15) {
        this.animTime += dt * (4 + speed / 22);
        frame = `walk${Math.floor(this.animTime) % 4}`;
        if (this.running && Math.random() < 0.25) this.scene.fx.dust(this.x - this.facing * 8, this.bottom, 1);
      } else {
        this.animTime += dt * 1.6;
        frame = `idle${Math.floor(this.animTime) % 2}`;
      }
      this.view.setFrame(frame);
      this.view.setAlpha(this.invulnerable ? (Math.floor(this.scene.time.now / 70) % 2 ? 0.4 : 1) : 1);
    }
    this.drawMeter();
  }

  /** Small stamina ring over the hero's head, only while it isn't full. */
  private drawMeter() {
    const g = this.meter;
    g.clear();
    if (this.state !== 'alive' || this.stamina >= 0.999) return;
    const x = this.view.x;
    const y = this.body.top - 14;
    const r = 6.5;
    const col = this.exhausted ? (Math.floor(this.scene.time.now / 120) % 2 ? 0xff5a4f : 0xffb3a8) : this.stamina < 0.35 ? 0xffb627 : 0x6fe07a;
    g.fillStyle(0x2a1e2e, 0.55).fillCircle(x, y, r + 2);
    g.lineStyle(3, 0xffffff, 0.25).beginPath().arc(x, y, r, 0, Math.PI * 2).strokePath();
    g.lineStyle(3, col, 1)
      .beginPath()
      .arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.stamina)
      .strokePath();
  }

  /** Bounce off something you stomped. Holding jump bounces higher. */
  bounce() {
    const high = this.input.poll().jump;
    this.body.setVelocityY(high ? -this.char.jump : -this.char.jump * 0.62);
    this.jumping = high;
    this.squash = { x: 0.8, y: 1.25 };
  }

  /** Hit while carrying aura: knocked back, briefly invulnerable, keeps going. */
  knockBack(fromX: number) {
    sfx.hurt();
    this.invulnUntil = this.scene.time.now + INVULN * 1000;
    this.stun = HIT_STUN;
    const away = Math.sign(this.x - fromX) || -this.facing;
    this.body.setVelocity(away * 240, -360);
    this.scene.cameras.main.shake(120, 0.004);
  }

  /** Out of aura and hit (or fell): faint, then the level restarts at the last checkpoint. */
  faint(fell: boolean) {
    if (this.state !== 'alive') return;
    this.state = 'fainted';
    this.body.setVelocity(0, 0);
    this.body.enable = false;
    sfx.die();
    this.view.setFrame('hurt').setAlpha(1);
    this.meter.clear();
    if (fell) {
      this.view.setVisible(false);
    } else {
      // wobble, tip over, little dizzy stars
      this.scene.tweens.add({
        targets: this.view,
        rotation: this.facing * -1.45,
        y: this.view.y - 2,
        duration: 420,
        ease: 'Bounce.easeOut',
      });
      this.scene.fx.dizzy(this.view, 1400);
    }
    this.scene.onPlayerFainted(this);
  }

  /** Brief invulnerability when starting at a checkpoint. */
  spawnProtection() {
    this.invulnUntil = this.scene.time.now + RESPAWN_INVULN * 1000;
    this.squash = { x: 0.6, y: 1.5 };
  }

  finish() {
    this.state = 'finished';
    this.invulnUntil = 0;
  }

  /** Keep inside the camera view (used for co-op later). */
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
    this.meter.destroy();
  }
}

function approach(v: number, target: number, step: number) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}
