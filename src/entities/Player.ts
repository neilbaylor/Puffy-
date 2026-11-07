import Phaser from 'phaser';
import { DEPTH, MAX_FALL_SPEED } from '../config';
import type { CharacterDef } from '../data/characters';
import { sfx } from '../core/sfx';
import { ART_RES, WALK_FRAMES } from '../gfx/draw';
import { FaceClock } from '../gfx/face';
import { emptyInput, type InputSource, type InputState } from '../input/types';
import type { GameScene } from '../scenes/GameScene';

const COYOTE = 0.1;
const JUMP_BUFFER = 0.12;
/** The mid-air second jump: a smaller hop (about half the height of a full jump). */
const AIR_JUMP = 0.72;
const HIT_STUN = 0.35;
const INVULN = 1.8;
const RESPAWN_INVULN = 1.5;
/** After running the meter dry you have to let it refill this much before running again. */
const EXHAUSTED_UNTIL = 0.3;
const RECOIL_TIME = 0.16;
/** How fast you sink in a puddle of poo (px/s). */
const GOO_SINK = 28;

const HIT_W = 22;
const HIT_H = 34;
/** Character textures are hi-res; this maps them back to world size. */
const BASE_S = 1 / ART_RES;

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
  /** Running doesn't tire you (a boulder is chasing you!). */
  freeRun = false;
  /** How deep in a puddle of poo you are (px; 0 = not in one). Set by the scene each frame. */
  goo = 0;
  private wasInGoo = false;
  exhausted = false;
  running = false;

  private prev: InputState = emptyInput();
  private coyote = 0;
  private jumpBuffer = 0;
  private jumping = false;
  /** Second jumps left before touching the ground again. */
  private airJumps = 1;
  private fireCooldown = 0;
  private stun = 0;
  private invulnUntil = 0;
  private wasOnGround = true;
  private animTime = 0;
  squash = { x: 1, y: 1 };
  private tilt = 0;
  private recoil = 0;
  private recoilShift = 0;
  /** Horizontal speed when we left the ground (so run-jumps keep their speed). */
  private launchSpeed = 0;
  /** Sprite scale for this hero. */
  private S: number;
  private face = new FaceClock();
  /** Eating a nuggie: seconds left of the munch animation. */
  private eating = 0;

  constructor(
    private scene: GameScene,
    readonly char: CharacterDef,
    readonly input: InputSource,
    x: number,
    y: number,
  ) {
    this.S = BASE_S * char.scale;
    this.hitbox = scene.physics.add.image(x, y, '__DEFAULT').setVisible(false);
    this.body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(char.hitW ?? HIT_W, char.hitH ?? HIT_H, true);
    this.body.setMaxVelocityY(MAX_FALL_SPEED);
    this.body.setCollideWorldBounds(true);
    this.hitbox.setData('player', this);

    this.view = scene.add.sprite(x, y, `char-${char.id}`, 'idle0').setOrigin(0.5, 1).setScale(this.S).setDepth(DEPTH.players);
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
    if (this.running && onGround && !this.freeRun) {
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

    // ── In a puddle of poo: you wade slowly and sink; every jump pops you up and on ──
    const inGoo = this.goo > 0 && this.state === 'alive';
    if (inGoo && !this.wasInGoo) {
      this.scene.fx.pooSplat(this.x, this.bottom - this.goo, 10);
      sfx.dribble(0.6);
    }
    this.wasInGoo = inGoo;
    // sinking slowly and steadily (it's thick): no gravity in it, just the sink — about
    // a second and a half to go right under; a hop out falls back with gravity as usual
    if (inGoo && b.velocity.y >= 0) {
      b.setAllowGravity(false);
      b.setVelocityY(GOO_SINK);
    } else if (!b.allowGravity) b.setAllowGravity(true);

    // ── Horizontal movement ──
    let maxSpeed = this.running ? c.runSpeed : c.walkSpeed;
    if (inGoo) maxSpeed = c.walkSpeed * 0.45;
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
    let jumpedNow = false;
    if (inGoo && controllable && this.jumpBuffer > 0) {
      // a squelchy hop up out of the poo (weaker the deeper you've sunk)
      jumpedNow = true;
      const depth = Phaser.Math.Clamp(this.goo / (c.hitH ?? HIT_H), 0, 1);
      b.setVelocity(vx, -c.jump * (0.8 - depth * 0.25));
      this.launchSpeed = c.walkSpeed;
      this.jumpBuffer = 0;
      this.jumping = true;
      this.airJumps = 1;
      this.squash = { x: 0.78, y: 1.28 };
      this.scene.fx.pooSplat(this.x, this.bottom - this.goo, 8);
      sfx.jump();
    } else if (controllable && this.jumpBuffer > 0 && this.coyote > 0) {
      jumpedNow = true;
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
    if (onGround) {
      this.airJumps = 1;
    } else if (controllable && jumpPressed && !jumpedNow && this.coyote <= 0 && this.airJumps > 0 && this.state === 'alive') {
      // second jump in mid air: a smaller hop that keeps your run speed
      this.airJumps--;
      b.setVelocityY(Math.min(b.velocity.y, -c.jump * AIR_JUMP));
      this.launchSpeed = Math.max(this.launchSpeed, Math.abs(vx));
      this.jumpBuffer = 0;
      this.jumping = true;
      this.squash = { x: 0.7, y: 1.35 };
      this.scene.fx.airPuff(this.x, this.bottom);
      sfx.jump2();
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
    this.eating = Math.max(0, this.eating - dt);

    if (this.state !== 'fainted') {
      this.view.setPosition(b.center.x - this.facing * this.recoilShift, b.bottom + 2);
      this.view.setFlipX(this.facing < 0);
      const speed = Math.abs(b.velocity.x);
      const targetTilt = (b.velocity.x / this.char.runSpeed) * (this.onGround ? 0.14 : 0.06);
      this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 12);
      this.view.setRotation(this.tilt);
      this.view.setScale(this.squash.x * this.S, this.squash.y * this.S);

      let frame: string;
      if (this.stun > 0) frame = 'hurt';
      else if (this.recoil > 0) frame = 'shoot';
      else if (this.eating > 0) frame = this.eating > 0.12 ? (Math.floor(this.eating * 10) % 2 ? 'eat0' : 'eat1') : 'idle0';
      else if (!this.onGround) frame = b.velocity.y < 0 ? 'jump' : 'fall';
      else if (speed > 15) {
        this.animTime += dt * (8 + speed / 11);
        frame = `walk${Math.floor(this.animTime) % WALK_FRAMES}`;
        if (this.running && Math.random() < 0.25) this.scene.fx.dust(this.x - this.facing * 8, this.bottom, 1);
      } else {
        this.animTime += dt * 1.6;
        frame = `idle${Math.floor(this.animTime) % 2}`;
      }
      // standing about, they now and then blink, glance around, smile or chatter
      this.face.tick(dt);
      const fk = frame.startsWith('idle') ? this.face.key : null;
      if (fk) this.view.setTexture(`char-${this.char.id}-face`, fk);
      else if (this.view.texture.key !== `char-${this.char.id}`) this.view.setTexture(`char-${this.char.id}`, frame);
      else this.view.setFrame(frame);
      this.view.setAlpha(this.invulnerable ? (Math.floor(this.scene.time.now / 70) % 2 ? 0.4 : 1) : 1);
    }
    this.drawMeter();
  }

  /** Small stamina ring over the hero's head, only while it isn't full. */
  /** Stamina gauge floating over the hero's head: a little glossy pill with a lightning bolt. */
  private meterAlpha = 0;
  private drawMeter() {
    const g = this.meter;
    g.clear();
    const show = this.state === 'alive' && this.stamina < 0.999;
    this.meterAlpha += ((show ? 1 : 0) - this.meterAlpha) * 0.18;
    if (this.meterAlpha < 0.02) return;
    g.setAlpha(this.meterAlpha);
    const w = 30;
    const h = 7;
    const x0 = Math.round(this.view.x - w / 2 + 4);
    const y = Math.round(this.body.top - 30);
    const flash = Math.floor(this.scene.time.now / 120) % 2;
    const col = this.exhausted ? (flash ? 0xff5a4f : 0xffa89c) : this.stamina < 0.35 ? 0xffb627 : this.running ? 0x7cf0ff : 0x6fe07a;
    // case
    g.fillStyle(0x1b1424, 0.8).fillRoundedRect(x0 - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
    g.fillStyle(0xffffff, 0.16).fillRoundedRect(x0, y, w, h, h / 2);
    // fill + gloss
    const fw = Math.max(h, w * this.stamina);
    g.fillStyle(col, 1).fillRoundedRect(x0, y, fw, h, h / 2);
    g.fillStyle(0xffffff, 0.4).fillRoundedRect(x0 + 2, y + 1, Math.max(2, fw - 4), 2, 1);
    // when worn out: a tick showing how full it must get before you can run again
    if (this.exhausted) g.fillStyle(0xffffff, 0.85).fillRect(x0 + w * EXHAUSTED_UNTIL - 0.5, y - 1, 1.5, h + 2);
    // lightning bolt badge on the left
    const bx = x0 - 7;
    const by = y + h / 2;
    g.fillStyle(0x1b1424, 0.8).fillCircle(bx, by, 6);
    g.fillStyle(this.exhausted ? 0xff8a7a : 0xffd23f, 1).fillPoints(
      [
        { x: bx + 1.2, y: by - 4.2 },
        { x: bx - 2.6, y: by + 0.6 },
        { x: bx - 0.2, y: by + 0.6 },
        { x: bx - 1.2, y: by + 4.2 },
        { x: bx + 2.6, y: by - 0.8 },
        { x: bx + 0.2, y: by - 0.8 },
      ],
      true,
    );
  }

  /** Start the munch animation (nuggie pickup). */
  eat() {
    this.eating = 0.72;
    this.squash = { x: 1.22, y: 0.84 };
    // three big munches, each with a cheek-bulge squash and a spray of crumbs
    for (const [i, at] of [0, 210, 400].entries())
      this.scene.time.delayedCall(at, () => {
        if (this.state === 'fainted') return;
        this.squash = { x: 1.18 - i * 0.03, y: 0.86 + i * 0.02 };
        const m = this.mouth;
        this.scene.fx.crumbs(m.x + this.facing * 3, m.y + 2, 5 - i);
        if (i > 0) sfx.munch();
      });
  }

  /** Where the hero's mouth is in the world (for the nuggie fly-in). */
  get mouth() {
    const h = (this.char.hitH ?? HIT_H);
    return { x: this.view.x + this.facing * 8 * this.char.scale, y: this.bottom - h * 0.62 };
  }

  /** Bounce off something you stomped. Holding jump bounces higher. */
  bounce() {
    const high = this.input.poll().jump;
    this.body.setVelocityY(high ? -this.char.jump : -this.char.jump * 0.62);
    this.jumping = high;
    this.airJumps = 1; // stomping gives your second jump back
    this.squash = { x: 0.8, y: 1.25 };
  }

  /** Hit while carrying aura: knocked back, briefly invulnerable, keeps going. */
  knockBack(fromX: number) {
    sfx.hurt();
    this.invulnUntil = this.scene.time.now + INVULN * 1000;
    this.stun = HIT_STUN;
    const away = Math.sign(this.x - fromX) || -this.facing;
    // heavy heroes (Big Muscles) barely budge
    const k = this.char.knockback ?? 1;
    this.body.setVelocity(away * 240 * k, -360 * (0.5 + 0.5 * k));
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
