import Phaser from 'phaser';
import { DEPTH, GRAVITY, MAX_FALL_SPEED } from '../config';
import type { CharacterDef } from '../data/characters';
import { sfx } from '../core/sfx';
import { ART_RES, WALK_FRAMES, bodyLift } from '../gfx/draw';
import { wardrobe } from '../core/wardrobe';
import { FaceClock } from '../gfx/face';
import { emptyInput, type InputSource, type InputState } from '../input/types';
import type { Fx } from '../world/Fx';

/** What a hero needs from the scene it's in (a level, or Queen Plop's ring). */
export interface PlayerHost extends Phaser.Scene {
  fx: Fx;
  fireRocket(p: Player): void;
  onPlayerFainted(p: Player): void;
}

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
/** How fast you sink in a puddle of poo (px/s, for a hero of the usual height). */
const GOO_SINK = 22;
/** Wading speed in poo, the hop out of it, and how fast you carry on through the air after the hop (the same for all heroes). */
const GOO_WADE = 65;
const GOO_HOP = 440;
const GOO_AIR = 150;

/** Parachute drops: how soon the canopy's fully open once you've stepped off (s), how fast you can steer across under it, how quickly. */
const CHUTE_OPEN_AT = 0.16;
const CHUTE_STEER = 165;
const CHUTE_ACCEL = 460;

/**
 * Under the sea (World 3): the water's own gravity (the level's), how fast you can sink, a stroke
 * (every jump press: up you go, a bit at a time), and how fast you swim across (× walk / run speed).
 */
export const WATER_G = 420;
const SINK_MAX = 115;
const STROKE = 265;
const STROKE_EVERY = 0.14;
const SWIM_WALK = 0.95;
const SWIM_RUN = 0.62;
/** How far under the surface your middle is held (you can't swim up out of the water). */
const SURFACE_HOLD = 8;

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
  /** In the air after a hop out of poo (everyone carries on at the same speed). */
  private gooHop = false;
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
  /** Drawn from another sheet of the same frames (e.g. holding the chair in the ring), or null. */
  sheet: string | null = null;
  /** A frame that overrides the animation (e.g. swinging the chair), or null. */
  frameOverride: string | null = null;
  /**
   * Under a parachute (Plop Invasion · Part 2's drops): a moment's free fall, then the canopy opens
   * and you drift down at `speed`, steering left and right and firing sideways. null = not.
   */
  chute: { t: number; speed: number; lean: number; x0: number; x1: number } | null = null;
  /** The canopy (behind the hero) and the harness (over them), while under a parachute. */
  private chuteBack: Phaser.GameObjects.Sprite | null = null;
  private chuteFront: Phaser.GameObjects.Sprite | null = null;
  /** The hero's sheet of frames (`char-<id>`; under the sea `char-<id>-sea`, in the dive gear). */
  key: string;
  /** Under the sea: the water's surface (world y), or null on dry levels. */
  water: number | null = null;
  /** In the water now (swimming, not walking). */
  swimming = false;
  /** Diving in off the pier: no control until you're in the water. */
  diving = false;
  private strokeCd = 0;
  /** A stroke's kick in the swim animation (fades out). */
  private stroke = 0;

  constructor(
    private scene: PlayerHost,
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

    this.key = `char-${char.id}`;
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
    if (this.diving) input = emptyInput();

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
    if (this.running && (onGround || this.swimming) && !this.freeRun) {
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

    // ── Under a parachute: its own way of moving (and touching down ends it) ──
    if (this.chute) {
      // (only the ground ends it: bouncing off a Plop's head on the way down doesn't)
      if (b.blocked.down || this.state !== 'alive') this.endChute(b.blocked.down);
      else {
        this.updateChute(dt, input, dir, controllable);
        return;
      }
    }

    // ── Under the sea: in the water you swim (above it, on the pier, the usual gravity) ──
    if (this.water !== null) {
      const inWater = b.center.y > this.water;
      if (inWater !== this.swimming) this.enterWater(inWater);
      if (this.swimming) {
        this.updateSwim(dt, input, dir, jumpPressed, controllable, onGround);
        return;
      }
    }

    // ── In a puddle of poo: you wade slowly and sink; every jump pops you up and on ──
    const inGoo = this.goo > 0 && this.state === 'alive';
    if (inGoo && !this.wasInGoo) {
      this.scene.fx.pooSplat(this.x, this.bottom - this.goo, 10);
      sfx.dribble(0.6);
    }
    this.wasInGoo = inGoo;
    // sinking slowly and steadily (it's thick): no gravity in it, just the sink — about
    // nearly two seconds to go right under; a hop out falls back with gravity as usual
    if (inGoo && b.velocity.y >= 0) {
      b.setAllowGravity(false);
      // (the same for every hero: a taller one sinks a bit faster, so all go under in the same time)
      b.setVelocityY(GOO_SINK * ((c.hitH ?? HIT_H) / HIT_H));
    } else if (!b.allowGravity) b.setAllowGravity(true);

    // ── Horizontal movement ──
    let maxSpeed = this.running ? c.runSpeed : c.walkSpeed;
    if (!onGround) maxSpeed = Math.max(maxSpeed, Math.min(this.launchSpeed, c.runSpeed)); // keep run-jump momentum
    if (onGround) this.gooHop = false;
    if (inGoo) maxSpeed = GOO_WADE;
    else if (this.gooHop) maxSpeed = GOO_AIR;
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
    } else if (controllable && !(this.diving && !onGround)) {
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
      // (the same hop for every hero, so the puddles are just as hard whoever you are)
      const depth = Phaser.Math.Clamp(this.goo / (c.hitH ?? HIT_H), 0, 1);
      b.setVelocity(vx, -GOO_HOP * (1 - depth * 0.45));
      this.launchSpeed = GOO_AIR;
      this.gooHop = true;
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

    this.bazooka(dt, input, controllable);

    // ── Landing feedback ──
    if (onGround && !this.wasOnGround) {
      this.squash = { x: 1.3, y: 0.75 };
      this.scene.fx.dust(this.x, this.bottom, 4);
    }
    this.wasOnGround = onGround;
    this.prev = input;
  }

  /** Under the sea: the surface at world y (in the water already, or above it on the pier). */
  setWater(y: number) {
    this.water = y;
    this.swimming = this.body.center.y > y;
    this.body.setGravityY(this.swimming ? 0 : GRAVITY - WATER_G);
  }

  /** Into the water (a splash, the dive's over: you swim from now on) or out of it. */
  private enterWater(on: boolean) {
    this.swimming = on;
    const b = this.body;
    if (on) {
      // (the water swallows most of the dive's speed)
      b.setVelocity(b.velocity.x * 0.5, Math.min(b.velocity.y * 0.35, 160));
      b.setGravityY(0);
      this.jumping = false;
      this.diving = false;
      this.squash = { x: 0.85, y: 1.18 };
      this.scene.events.emit('hero-splash', this);
    } else b.setGravityY(GRAVITY - WATER_G);
  }

  /**
   * Swimming: every jump press is a stroke up (as often as you like, nearly), and in between you sink
   * slowly back towards the sea bed; you glide on a little when you let go. You can't swim up out of
   * the water. On the sea bed you walk along (in the dive gear that's swimming too).
   */
  private updateSwim(dt: number, input: InputState, dir: number, jumpPressed: boolean, controllable: boolean, onGround: boolean) {
    const b = this.body;
    const c = this.char;
    this.strokeCd -= dt;
    this.stroke = Math.max(0, this.stroke - dt);
    if (b.velocity.y > SINK_MAX) b.setVelocityY(approach(b.velocity.y, SINK_MAX, 1200 * dt));
    if (controllable && jumpPressed && this.strokeCd <= 0 && this.state === 'alive') {
      b.setVelocityY(Math.min(b.velocity.y * 0.3, -STROKE));
      this.strokeCd = STROKE_EVERY;
      this.stroke = 0.4;
      this.squash = { x: 0.9, y: 1.12 };
      this.scene.events.emit('hero-stroke', this);
      sfx.stroke();
    }
    // (held just under the surface)
    const top = this.water! + SURFACE_HOLD;
    if (b.center.y < top) {
      b.y += top - b.center.y;
      if (b.velocity.y < 0) b.setVelocityY(0);
    }
    const max = this.running ? c.runSpeed * SWIM_RUN : c.walkSpeed * SWIM_WALK;
    let vx = b.velocity.x;
    if (dir !== 0) {
      vx = approach(vx, dir * max, c.airAccel * (Math.sign(vx) !== dir ? 0.9 : 0.55) * dt);
      this.facing = dir as 1 | -1;
    } else if (controllable) vx = approach(vx, 0, c.airAccel * (onGround ? 0.8 : 0.22) * dt);
    b.setVelocityX(vx);
    this.jumping = false;
    this.airJumps = 1;
    this.bazooka(dt, input, controllable);
    this.wasOnGround = onGround;
    this.prev = input;
  }

  // ── Bazooka ──
  private bazooka(dt: number, input: InputState, controllable: boolean) {
    const c = this.char;
    const b = this.body;
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
  }

  /**
   * Step off into a parachute drop: a moment's free fall, then the canopy opens and you float down at
   * `speed` (px/s), steering only between x0 and x1 (the drop's sides: no drifting over to somewhere else).
   */
  startChute(speed: number, x0 = -1e9, x1 = 1e9) {
    if (this.chute || this.state !== 'alive') return;
    this.chute = { t: 0, speed, lean: 0, x0, x1 };
    this.jumping = false;
    const key = `chute-${this.char.id}`;
    if (this.scene.textures.exists(key)) {
      this.chuteBack = this.scene.add.sprite(this.view.x, this.view.y, key, 'pack').setOrigin(0.5, 1).setScale(this.S).setDepth(DEPTH.players - 0.02);
      this.chuteFront = this.scene.add.sprite(this.view.x, this.view.y, key, 'harness').setOrigin(0.5, 1).setScale(this.S).setDepth(DEPTH.players + 0.02);
    }
  }

  /** Down (or fainted): the canopy sags over and collapses (or just blows away), and you're on your feet. */
  endChute(landed = true) {
    if (!this.chute) return;
    this.chute = null;
    this.body.setAllowGravity(true);
    const back = this.chuteBack;
    const front = this.chuteFront;
    this.chuteBack = this.chuteFront = null;
    front?.destroy();
    if (back) {
      if (landed) {
        // (gone as you land: it just flops down and fades)
        back.setFrame('land').setRotation(0);
        this.scene.tweens.add({ targets: back, alpha: 0, delay: 120, duration: 260, onComplete: () => back.destroy() });
      } else this.scene.tweens.add({ targets: back, y: back.y - 140, x: back.x + 60, angle: 50, alpha: 0, duration: 1000, ease: 'Sine.easeOut', onComplete: () => back.destroy() });
    }
    if (landed) {
      this.scene.fx.dust(this.x, this.bottom, 6);
      this.scene.events.emit('chute-landed', this);
    }
  }

  private updateChute(dt: number, input: InputState, dir: number, controllable: boolean) {
    const ch = this.chute!;
    const b = this.body;
    ch.t += dt;
    if (ch.t >= CHUTE_OPEN_AT) {
      if (ch.t - dt < CHUTE_OPEN_AT) {
        // the canopy bangs open: a jolt
        this.squash = { x: 1.18, y: 0.86 };
        this.scene.fx.airPuff(this.x, this.y - 30);
        sfx.jump2?.();
      }
      // no gravity under it: you slow quickly to the drift speed (a stomp or a knock still bumps you up)
      b.setAllowGravity(false);
      b.setVelocityY(approach(b.velocity.y, ch.speed, (b.velocity.y > ch.speed ? 1700 : 520) * dt));
    }
    // steering: drift across (a little slower to answer than on foot)
    let vx = b.velocity.x;
    if (dir !== 0) {
      vx = approach(vx, dir * CHUTE_STEER, CHUTE_ACCEL * dt);
      this.facing = dir as 1 | -1;
    } else if (controllable) vx = approach(vx, 0, CHUTE_ACCEL * 0.5 * dt);
    // (kept between the drop's sides)
    if (b.x < ch.x0 + 4) {
      b.x = ch.x0 + 4;
      vx = Math.max(vx, 0);
    } else if (b.right > ch.x1 - 4) {
      b.x = ch.x1 - 4 - b.width;
      vx = Math.min(vx, 0);
    }
    b.setVelocityX(vx);
    ch.lean += (vx / CHUTE_STEER - ch.lean) * Math.min(1, dt * 4);
    this.bazooka(dt, input, controllable);
    this.wasOnGround = false;
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
      let targetTilt = (b.velocity.x / this.char.runSpeed) * (this.onGround ? 0.14 : 0.06);
      // (swimming: nose up as you stroke, down as you sink; diving in: head first)
      if (this.swimming && !this.onGround) targetTilt = (b.velocity.x / this.char.runSpeed) * 0.05 - this.facing * Phaser.Math.Clamp(-b.velocity.y / 1100, -0.1, 0.22);
      if (this.diving && !this.swimming) targetTilt = this.facing * Phaser.Math.Clamp(Math.atan2(b.velocity.y, Math.abs(b.velocity.x) + 1) * 0.9, -0.5, 1.3);
      this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * (this.diving ? 8 : 12));
      this.view.setRotation(this.tilt);
      this.view.setScale(this.squash.x * this.S, this.squash.y * this.S);

      let frame: string;
      if (this.stun > 0) frame = 'hurt';
      else if (this.recoil > 0) frame = 'shoot';
      else if (this.eating > 0) frame = this.eating > 0.12 ? (Math.floor(this.eating * 10) % 2 ? 'eat0' : 'eat1') : 'idle0';
      else if (this.swimming && !this.onGround) {
        // (swimming: the swim cycle all the time, quicker on a stroke and when going along)
        this.animTime += dt * (4 + speed / 28 + this.stroke * 22);
        frame = `walk${Math.floor(this.animTime) % WALK_FRAMES}`;
      } else if (!this.onGround) frame = b.velocity.y < 0 ? 'jump' : 'fall';
      else if (speed > 15) {
        this.animTime += dt * (8 + speed / 11);
        frame = `walk${Math.floor(this.animTime) % WALK_FRAMES}`;
        if (this.running && !this.swimming && Math.random() < 0.25) this.scene.fx.dust(this.x - this.facing * 8, this.bottom, 1);
      } else {
        this.animTime += dt * 1.6;
        frame = `idle${Math.floor(this.animTime) % 2}`;
      }
      // standing about, they now and then blink, glance around, smile or chatter
      this.face.tick(dt);
      // (another sheet of the same frames, e.g. holding the chair in the ring; and a frame that
      // overrides the animation, e.g. a swing)
      if (this.frameOverride && this.stun <= 0) frame = this.frameOverride;
      const fk = frame.startsWith('idle') && !this.sheet ? this.face.key : null;
      if (this.sheet) {
        if (this.view.texture.key !== this.sheet) this.view.setTexture(this.sheet, frame);
        else this.view.setFrame(frame);
      } else if (fk) this.view.setTexture(`${this.key}-face`, fk);
      else if (this.view.texture.key !== this.key) this.view.setTexture(this.key, frame);
      else this.view.setFrame(frame);
      this.view.setAlpha(this.invulnerable ? (Math.floor(this.scene.time.now / 70) % 2 ? 0.4 : 1) : 1);
    }
    // the parachute's layers go with the hero, tipping into a turn (the rig swings round the shoulders)
    if (this.chuteBack && this.chute) {
      const t = this.chute.t;
      // (it's on as soon as you step off: it just billows open)
      const f = t < 0.07 ? 'burst' : t < CHUTE_OPEN_AT ? 'opening' : 'open';
      const lean = this.chute.lean * 0.2 + Math.sin(this.scene.time.now / 520) * 0.03;
      // (on a skateboard the hero's up on its deck: the rig with them)
      const up = bodyLift(wardrobe.wearKey) * ART_RES * Math.abs(this.view.scaleY);
      for (const sp of [this.chuteBack, this.chuteFront!]) {
        sp.setPosition(this.view.x + Math.sin(lean) * up, this.view.y - Math.cos(lean) * up).setFlipX(this.facing < 0).setRotation(lean).setScale(this.view.scaleX, this.view.scaleY).setAlpha(this.view.alpha);
      }
      this.chuteBack.setFrame(f);
      this.view.setRotation(lean * 0.6);
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
    // (under a parachute: knocked sideways, hardly up — so the nuggies you drop are still below you to catch)
    // (and in the water: pushed away through it, hardly up)
    this.body.setVelocity(away * 240 * k, this.chute ? -60 : this.swimming ? -120 : -360 * (0.5 + 0.5 * k));
    this.scene.cameras.main.shake(120, 0.004);
  }

  /** Out of aura and hit (or fell): faint, then the level restarts at the last checkpoint. */
  faint(fell: boolean) {
    if (this.state !== 'alive') return;
    this.endChute(false);
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
    this.chuteBack?.destroy();
    this.chuteFront?.destroy();
    this.hitbox.destroy();
    this.view.destroy();
    this.meter.destroy();
  }
}

function approach(v: number, target: number, step: number) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}
