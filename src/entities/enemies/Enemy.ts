import Phaser from 'phaser';
import { DEPTH, MAX_FALL_SPEED } from '../../config';
import { sfx } from '../../core/sfx';
import { ART_RES } from '../../gfx/draw';
import { GOAT_H, GOAT_MOUTH, GOAT_W } from '../../gfx/goat';
import type { EnemyKind } from '../../level/builder';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../Player';
import { Weapon, type WeaponKind } from './Weapons';
import { TILE } from '../../config';

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
  /** Already took Big Muscles' double-strength first hit. */
  heavyHit = false;
  /** Some bad guys carry a weapon (gun, chainsaw, ball and chain). */
  weapon: Weapon | null = null;
  /** Where its front hand is, if not the usual spot for its size (frame units from the middle, facing left). */
  handAt?: { x: number; y: number };
  /** How big its weapon is drawn (× the usual for its size). */
  weaponK = 1;
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

  /** A real drop ahead at x (no ground within two tiles below the feet), not just a step down. */
  protected pitAt(x: number, bottom: number) {
    for (let d = 6; d <= 72; d += 8) if (this.gs.level.isSolidAt(x, bottom + d)) return false;
    return true;
  }

  /** Fallen into a puddle of poo (Plop Invasion): sinking, like quicksand. */
  inPoo = false;
  /** When it was last hit (and lived): a moment of "ow!" on its face. */
  hurtAt = -1e9;

  /** Per-frame behaviour, only called while awake and alive. */
  abstract tick(dt: number): void;

  update(dt: number) {
    if (this.dead) return;
    this.t += dt;
    if (this.flashUntil && this.gs.time.now > this.flashUntil) {
      this.clearTint();
      this.flashUntil = 0;
    }
    // (stuck in a poo puddle, sinking: no more walking about; the scene does the sinking)
    if (this.awake && !this.inPoo) this.tick(dt);
    this.weapon?.update(dt, this.awake && !this.inPoo);
    if (!this.dead && this.active) this.animateMouth(dt);
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
      this.hurtAt = this.gs.time.now;
      sfx.bump();
    }
  }

  /** Mouth open/shut cycling (bad guys with a closed-mouth version of their frames). */
  private mouthT = Math.random() * 2;
  private mouthShut = false;
  private chomps = 0;
  protected animateMouth(dt: number) {
    const shutName = this.shutFrame(this.frame.name);
    if (shutName === null) return;
    this.mouthT -= dt;
    if (this.mouthT <= 0) {
      if (this.chomps > 0) {
        // a quick chomp-chomp-chomp
        this.chomps--;
        this.mouthShut = !this.mouthShut;
        this.mouthT = 0.09;
      } else if (Math.random() < 0.18) {
        this.chomps = 6;
        this.mouthT = 0;
      } else {
        this.mouthShut = !this.mouthShut;
        this.mouthT = this.mouthShut ? 0.5 + Math.random() * 1.1 : 0.8 + Math.random() * 1.7;
      }
    }
    if (this.mouthShut) this.setFrame(shutName);
  }

  /** The closed-mouth version of a frame (null if this bad guy / frame has none). */
  protected shutFrame(_f: string): string | null {
    return null;
  }

  /** Hand this bad guy a weapon. */
  arm(kind: WeaponKind, size: 'small' | 'big') {
    this.weapon = new Weapon(this.gs, this, kind, size);
  }

  kill(how: DeathKind) {
    if (this.dead) return;
    this.weapon?.drop();
    this.weapon = null;
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

  tick(_dt = 0) {
    const b = this.body;
    if (b.blocked.left) this.dir = 1;
    else if (b.blocked.right) this.dir = -1;
    if (this.careful && b.blocked.down) {
      const aheadX = this.dir > 0 ? b.right + 2 : b.left - 2;
      // (turns at a real drop; a step down the hill is fine)
      if (this.pitAt(aheadX, b.bottom)) this.dir *= -1;
    }
    b.setVelocityX(this.dir * this.speed);
    this.setFlipX(this.dir > 0);
    this.setFrame(Math.floor(this.t * this.animRate) % 2 ? this.frameB : this.frameA);
  }
}

/** Puffball: small fluffy walker. Lots of them. One shot or one stomp. */
export class Puffball extends Walker {
  readonly kind: EnemyKind = 'puffball';
  constructor(gs: GameScene, x: number, y: number, texture = 'puffball') {
    super(gs, x, y, texture, 'w0');
    if (texture === 'puffball') hiRes(this, 22, 30, 13, 16);
  }

  tick(dt = 0) {
    // a gunner stops, turns to face you and takes aim
    if (this.weapon?.aim) {
      const tgt = this.gs.nearestPlayer(this.x, this.y);
      if (tgt) this.dir = Math.sign(tgt.x - this.x) || this.dir;
      this.body.setVelocityX(0);
      this.setFlipX(this.dir > 0);
      this.setFrame('w0');
      return;
    }
    super.tick(dt);
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
  private noticed = false;
  private pounceCd = 1.2;
  private crouch = 0;
  private hopCd = 0;
  constructor(gs: GameScene, x: number, y: number, texture = 'bigpuff') {
    super(gs, x, y, texture, 'w0');
    if (texture === 'bigpuff') hiRes(this, 36, 68, 18, 18);
    this.hp = 2;
    this.speed = 40;
    this.animRate = 4;
    this.careful = true;
  }

  /**
   * Medium guys are hunters: they patrol until they spot you, then chase —
   * hopping up steps, leaping across small gaps — and when they're close
   * they crouch and POUNCE at you. Three hits to pop (they get madder).
   */
  tick(dt = 1 / 60) {
    const b = this.body;
    const tgt = this.gs.nearestPlayer(this.x, this.y);
    this.pounceCd -= dt;
    this.hopCd -= dt;
    const onGround = b.blocked.down;
    const dx = tgt ? tgt.x - this.x : 0;
    const dy = tgt ? tgt.bottom - b.bottom : 0;
    const sees = !!tgt && tgt.alive && Math.abs(dx) < 340 && dy > -170 && dy < 150;
    if (!sees) {
      if (onGround) super.tick();
      return;
    }
    if (!this.noticed) {
      this.noticed = true;
      this.gs.fx.popText(this.x, b.top - 16, '!', '#ff5a3c', 22);
    }
    // armed: a chainsaw charge drives him; a gunner plants his feet and fires
    if (this.weapon?.busy) {
      this.setFrame(Math.floor(this.t * 12) % 2 ? 'm1' : 'm0');
      return;
    }
    if (this.weapon?.kind === 'gun' && this.weapon.aim && onGround) {
      this.dir = Math.sign(dx) || this.dir;
      this.setFlipX(this.dir > 0);
      b.setVelocityX(0);
      this.setFrame(this.mad ? 'm0' : 'w0');
      return;
    }
    if (!onGround) {
      this.setFrame(this.mad ? 'm1' : 'w1');
      return;
    }
    this.dir = Math.sign(dx) || this.dir;
    this.setFlipX(this.dir > 0);
    // crouching for a pounce
    if (this.crouch > 0) {
      this.crouch -= dt;
      b.setVelocityX(0);
      this.setFrame('m0');
      this.setScale(this.scaleX, this.scaleX * 0.88);
      if (this.crouch <= 0) {
        this.setScale(this.scaleX, this.scaleX);
        b.setVelocity(this.dir * (this.mad ? 270 : 230), -470);
        this.pounceCd = (this.mad ? 1.2 : 1.7) + Math.random() * 0.8;
        sfx.jump2?.();
      }
      return;
    }
    if (Math.abs(dx) < 170 && Math.abs(dy) < 60 && this.pounceCd <= 0) {
      this.crouch = 0.28;
      return;
    }
    // chase, hopping up steps and over small gaps
    const sp = (this.mad ? 112 : 78) * (this.weapon?.kind === 'saw' ? 1.25 : 1);
    const wall = this.dir < 0 ? b.blocked.left : b.blocked.right;
    const aheadX = this.dir > 0 ? b.right + 4 : b.left - 4;
    // (a step down the hill isn't a gap: he just walks off it, so he never stalls at one
    // when you're further down)
    const gap = this.pitAt(aheadX, b.bottom);
    if ((wall || (gap && dy <= 40)) && this.hopCd <= 0) {
      b.setVelocity(this.dir * sp * 1.6, wall ? -560 : -430);
      this.hopCd = 0.6;
    } else if (gap && dy > 40) {
      b.setVelocityX(0); // won't jump down into a pit after you
    } else b.setVelocityX(this.dir * sp);
    this.setFrame(Math.floor(this.t * (this.mad ? 9 : 7)) % 2 ? (this.mad ? 'm1' : 'w1') : this.mad ? 'm0' : 'w0');
  }

  /** How hard he was falling (a heavy landing rumbles the ground). */
  private fallVy = 0;
  update(dt: number) {
    super.update(dt);
    if (this.dead || !this.active) return;
    const b = this.body;
    if (!b.blocked.down) this.fallVy = Math.max(this.fallVy, b.velocity.y);
    else {
      if (this.fallVy > 340 && this.awake) {
        this.gs.shakeFrom(this.x, b.bottom, 130, 0.0045);
        this.gs.fx.dust(b.left + 4, b.bottom, 3);
        this.gs.fx.dust(b.right - 4, b.bottom, 3);
      }
      this.fallVy = 0;
    }
  }

  protected shutFrame(f: string) {
    return f === 'w0' || f === 'w1' || f === 'm0' || f === 'm1' ? `${f[0]}c${f[1]}` : null;
  }

  damage(n: number, how: DeathKind, by: Player | null) {
    super.damage(n, how, by);
    if (this.dead) return;
    this.pounceCd = Math.min(this.pounceCd, 0.5);
    if (this.mad) return;
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
  protected dir = -1;
  protected mode: 'walk' | 'crouch' | 'air' | 'slamWindup' | 'slam' | 'chargeWindup' | 'charge' = 'walk';
  protected timer = 1.0;
  private chargeCooldown = 1.8;
  private underFor = 0;
  private chaseT = 0;
  private givenUp = false;
  private home = 0;
  private pips: Phaser.GameObjects.Graphics;
  private readonly maxHp = 5;

  constructor(gs: GameScene, x: number, y: number, texture = 'giant') {
    super(gs, x, y, texture, 'w0');
    if (texture === 'giant') hiRes(this, 104, 176, 36, 24, 2.5);
    this.hp = this.maxHp;
    this.stompable = false;
    this.bouncyTop = true;
    this.setDepth(DEPTH.enemies + 1);
    this.pips = gs.add.graphics().setDepth(DEPTH.text);
  }

  wake() {
    super.wake();
    this.home = this.x;
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
        // he won't chase you forever: after ~10 s of you staying away he gives up,
        // ambles back to his spot and waits there (until you come close again)
        const far = !target || Math.abs(target.x - this.x) > 240 || Math.abs(target.bottom - b.bottom) > 160;
        this.chaseT = far ? this.chaseT + dt : Math.max(0, this.chaseT - dt * 3);
        if (!this.givenUp && this.chaseT > 10) {
          this.givenUp = true;
          this.gs.fx.popText(this.x, b.top - 20, 'pfff…', '#ffffff', 20);
        } else if (this.givenUp && !far) {
          this.givenUp = false;
          this.chaseT = 0;
          sfx.roar();
        }
        if (this.givenUp) {
          const toHome = this.home - this.x;
          if (Math.abs(toHome) > 16) {
            this.dir = Math.sign(toHome);
            b.setVelocityX(this.dir * 48);
            this.setFrame(Math.floor(this.t * 4) % 2 ? 'w1' : 'w0');
          } else {
            b.setVelocityX(0);
            this.setFrame('w0');
            if (target) this.dir = Math.sign(target.x - this.x) || this.dir;
          }
          break;
        }
        if (target && Math.abs(target.x - this.x) > 20) this.dir = Math.sign(target.x - this.x);
        const aheadX = this.dir > 0 ? b.right + 4 : b.left - 4;
        const groundAhead = !this.pitAt(aheadX, b.bottom); // (a step down the hill is fine to walk off)
        const wallAhead = this.dir < 0 ? b.blocked.left : b.blocked.right;
        // something overhead he can't fit under (a floating island): he waits there, rather
        // than walking (or leaping) into it and getting jammed
        const ceiling = this.lowCeiling(aheadX);
        b.setVelocityX(groundAhead && !wallAhead && !ceiling ? this.dir * 66 : 0);
        // you're up on a step / another block, or across a gap: don't just stand at the
        // wall or edge — get ready to leap over to you soon
        if (target && onGround && !ceiling && (wallAhead || !groundAhead || target.bottom < b.bottom - 24) && Math.abs(target.x - this.x) < 420)
          this.timer = Math.min(this.timer, 0.35);
        this.setFrame(Math.floor(this.t * 5) % 2 ? 'w1' : 'w0');
        const dx = target ? Math.abs(target.x - this.x) : Infinity;
        const sameLevel = target ? Math.abs(target.bottom - b.bottom) < 48 : false;
        // (no charging at you across a gap or a wall: he'll leap over instead)
        if (target && onGround && groundAhead && !wallAhead && this.chargeCooldown <= 0 && dx < 300 && dx > 70 && sameLevel) {
          // wind up, then charge!
          this.mode = 'chargeWindup';
          this.timer = 0.55; // a clear warning
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
          this.timer = 0.75;
        }
        break;
      case 'charge': {
        const aheadX = this.dir > 0 ? b.right + 6 : b.left - 6;
        const stop = this.pitAt(aheadX, b.bottom) || (this.dir < 0 ? b.blocked.left : b.blocked.right) || this.lowCeiling(aheadX);
        b.setVelocityX(stop ? 0 : this.dir * 290);
        this.setFrame(Math.floor(this.t * 12) % 2 ? 'w1' : 'w0');
        if (Math.random() < 0.5) this.gs.fx.dust(this.dir > 0 ? b.left + 8 : b.right - 8, b.bottom, 1);
        if (this.timer <= 0 || stop) {
          this.mode = 'walk';
          this.timer = 0.6;
          this.chargeCooldown = 3.8 + Math.random() * 1.6;
          b.setVelocityX(0);
          this.gs.shakeFrom(this.x, b.bottom, 140, 0.006);
        }
        break;
      }
      case 'crouch':
        this.setFrame('crouch');
        if (this.timer <= 0) {
          this.mode = 'air';
          this.underFor = 0;
          // a hop: straight up when you're close on the same ground (fair to dash under);
          // a leap over to you when you're far, or up on another block / across a gap
          const tgt = this.gs.nearestPlayer(this.x, this.y);
          const dx = tgt ? tgt.x - this.x : 0;
          const higher = tgt ? tgt.bottom < b.bottom - 24 : false;
          const aheadX = dx > 0 ? b.right + 4 : b.left - 4;
          const blockedOff = tgt ? (dx < 0 ? b.blocked.left : b.blocked.right) || !this.gs.level.isSolidAt(aheadX, b.bottom + 6) : false;
          const far = Math.abs(dx) > 260;
          if (tgt && (far || higher || blockedOff)) {
            // aim to come down right on their block (time in the air ≈ up + down to that height)
            const up = higher ? 680 : 620;
            const rise = Math.max(0, b.bottom - tgt.bottom);
            const t = up / 1600 + Math.sqrt(Math.max(0, (up * up) / (2 * 1600) - rise) * 2 / 1600);
            const vx = Phaser.Math.Clamp(dx / Math.max(0.45, t), -300, 300);
            this.dir = Math.sign(dx) || this.dir;
            b.setVelocity(vx, -up);
          } else b.setVelocity(0, -600);
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

  /** Solid at head height just ahead (a ledge or island overhead that he won't fit under). */
  private lowCeiling(aheadX: number) {
    const b = this.body;
    const x = aheadX + this.dir * 6;
    // (an overhang: solid somewhere at head height, but open down at his feet — a wall he'd leap)
    if (this.gs.level.isSolidAt(x, b.bottom - 8)) return false;
    for (let y = b.top + 4; y < b.top + b.height * 0.55; y += 12) if (this.gs.level.isSolidAt(x, y)) return true;
    return false;
  }

  private land(slam: boolean) {
    const b = this.body;
    this.mode = 'walk';
    this.timer = 1.1 + Math.random() * 0.8;
    b.setVelocityX(0);
    this.gs.shakeFrom(this.x, b.bottom, slam ? 320 : 200, slam ? 0.02 : 0.01);
    this.gs.fx.dust(b.left + 10, b.bottom, slam ? 14 : 8);
    this.gs.fx.dust(b.right - 10, b.bottom, slam ? 14 : 8);
    if (slam) this.gs.fx.shockwave(this.x, b.bottom, 70);
    // every landing sends a shockwave rolling along the ground both ways: jump it!
    this.sendWaves(b.left + 6, b.right - 6, b.bottom, slam ? 275 : 220);
    sfx.thud();
  }

  /** What rolls out along the ground when he lands (flames; a Big Plop's are poo). */
  protected sendWaves(left: number, right: number, groundY: number, speed: number) {
    this.gs.spawnShockwave(left, groundY, -1, speed);
    this.gs.spawnShockwave(right, groundY, 1, speed);
  }

  protected shutFrame(f: string) {
    // only while walking (he roars open-mouthed when he crouches, jumps and slams)
    return f === 'w0' || f === 'w1' ? `${f}c` : null;
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

/**
 * Mountain goat (Part 2, from the sketch). Trots along its ledge (turning back
 * at edges). When it spots you it rears back with puffed-out cheeks — "!" —
 * then PTOO! lobs a glob of spit at you in an arc. Jump on it or shoot it once
 * and it keels over onto its back, hooves in the air.
 */
export class Goat extends Enemy {
  readonly kind: EnemyKind = 'goat';
  /** What it spits (Plop Invasion's goats spit poo). */
  protected spitStyle: GlobStyle | undefined;
  private dir = -1;
  private mode: 'walk' | 'windup' | 'spit' = 'walk';
  private timer = 0;
  private cooldown = 1.2;

  constructor(gs: GameScene, x: number, y: number, texture = 'goat') {
    super(gs, x, y, texture, 'w0');
    hiRes(this, 40, 38, 12, 24);
    this.hp = 1;
    this.stompable = true;
  }

  tick(dt: number) {
    const b = this.body;
    const target = this.gs.nearestPlayer(this.x, this.y);
    this.timer -= dt;
    this.cooldown -= dt;
    const ahead = (d: number) => this.gs.level.isSolidAt(d > 0 ? b.right + 4 : b.left - 4, b.bottom + 6);
    switch (this.mode) {
      case 'walk': {
        if ((this.dir < 0 && b.blocked.left) || (this.dir > 0 && b.blocked.right) || (b.blocked.down && !ahead(this.dir))) this.dir *= -1;
        b.setVelocityX(this.dir * 42);
        this.setFrame(Math.floor(this.t * 6) % 2 ? 'w1' : 'w0');
        const dx = target ? target.x - this.x : 0;
        const dy = target ? target.y - this.y : 0;
        if (target && target.alive && this.cooldown <= 0 && b.blocked.down && Math.abs(dx) < 330 && Math.abs(dx) > 26 && dy > -170 && dy < 120) {
          this.dir = Math.sign(dx);
          this.mode = 'windup';
          this.timer = 0.5;
          b.setVelocityX(0);
          this.gs.fx.popText(this.x, b.top - 14, '!', '#9fd84a', 22);
          sfx.bump();
        }
        break;
      }
      case 'windup':
        // rears back, cheeks puffed (with a little shiver)
        this.setFrame('sp0');
        b.setVelocityX(0);
        this.setX(this.x + Math.sin(this.t * 70) * 0.5);
        if (target) this.dir = Math.sign(target.x - this.x) || this.dir;
        if (this.timer <= 0) {
          this.mode = 'spit';
          this.timer = 0.32;
          this.spit(target);
        }
        break;
      case 'spit':
        this.setFrame('sp1');
        b.setVelocityX(0);
        if (this.timer <= 0) {
          this.mode = 'walk';
          this.cooldown = 1.9 + Math.random() * 0.8;
        }
        break;
    }
    this.setFlipX(this.dir > 0);
  }

  /** PTOO! An arcing glob aimed at where you are right now. */
  private spit(target: Player | null) {
    const sx = this.x + this.dir * (GOAT_W / 2 - GOAT_MOUTH.x);
    const sy = this.y + (GOAT_MOUTH.y - GOAT_H / 2);
    const tx = target ? target.x : sx + this.dir * 200;
    const ty = target ? target.body.center.y : sy;
    const G = 760;
    const dist = Math.abs(tx - sx);
    const T = Phaser.Math.Clamp(dist / 330, 0.38, 0.95);
    let vx = (tx - sx) / T;
    if (Math.sign(vx) !== this.dir) vx = this.dir * 60;
    const vy = (ty - sy - 0.5 * G * T * T) / T;
    new Glob(this.gs, sx, sy, vx, vy, G, this.spitStyle);
    sfx.spit();
    this.gs.fx.drip(sx, sy);
  }

  kill(how: DeathKind) {
    if (this.dead || how === 'fall') {
      super.kill(how);
      return;
    }
    // keels over onto its back, hooves up, legs kicking — silly, not sad
    this.dead = true;
    this.body.enable = false;
    this.clearTint();
    const gs = this.gs;
    if (how === 'stomp') sfx.stomp();
    else sfx.bump();
    sfx.bleat();
    gs.fx.stars(this.x, this.y - 10, 7);
    gs.fx.fluffBurst(this.x, this.y, 0.35);
    const flip = this.flipX;
    this.setFrame('flop0').setFlipX(flip).setDepth(DEPTH.fx - 1);
    const baseY = this.y;
    const pop = how === 'stomp' ? 26 : 48;
    // boing up with a spin, land on its back, wobble...
    gs.tweens.add({
      targets: this,
      y: baseY - pop,
      angle: how === 'stomp' ? 0 : (flip ? 1 : -1) * 360,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.setAngle(0);
        gs.tweens.add({
          targets: this,
          y: baseY,
          duration: 220,
          ease: 'Bounce.easeOut',
          onComplete: () => {
            gs.fx.dust(this.x, baseY + 30, 5);
            // the rock-a-bye wobble on its round back
            gs.tweens.add({ targets: this, angle: { from: -9, to: 9 }, yoyo: true, repeat: 2, duration: 170, ease: 'Sine.easeInOut' });
            // ...legs kicking in the air
            let k = 0;
            const kicker = gs.time.addEvent({
              delay: 110,
              repeat: 9,
              callback: () => {
                if (!this.scene) return kicker.remove();
                this.setFrame(++k % 2 ? 'flop1' : 'flop0');
                if (k === 4) gs.fx.stars(this.x + (flip ? 14 : -14), baseY + 14, 4);
              },
            });
            gs.tweens.add({
              targets: this,
              alpha: 0,
              delay: 1250,
              duration: 380,
              onComplete: () => this.destroy(),
            });
          },
        });
      },
    });
  }
}

export interface GlobStyle {
  /** Texture and how it's shown. */
  tex: string;
  scale: number;
  /** Tumbles end over end (a lump of poo) rather than pointing along its path (spit). */
  spin?: number;
  /** Hits the ground: what happens there (the default: a flattened puddle that fades). */
  onLand?: (x: number, y: number, vx: number) => void;
  /** How big it is (for hitting you). */
  r?: number;
  /** Poo (brown splats and drips) rather than goat spit (green). */
  poo?: boolean;
}
const SPIT: GlobStyle = { tex: 'spit', scale: 1.5 };

/** A flying glob (goat spit, a lump of poo): arcs under gravity, splats on the ground or on you. */
export class Glob {
  private img: Phaser.GameObjects.Image;
  private life = 2.2;
  private dripT = 0;
  private readonly onUpdate: (time: number, delta: number) => void;

  constructor(
    private gs: GameScene,
    x: number,
    y: number,
    private vx: number,
    private vy: number,
    private g: number,
    private style: GlobStyle = SPIT,
  ) {
    this.img = gs.add.image(x, y, style.tex).setOrigin(style.tex === 'spit' ? 24 / 36 : 0.5, 0.5).setScale(style.scale / ART_RES).setDepth(DEPTH.projectiles);
    this.onUpdate = (_t, delta) => this.step(Math.min(delta / 1000, 0.05));
    gs.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    gs.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.gone());
  }

  private step(dt: number) {
    const img = this.img;
    if (!img.scene) return this.gone();
    this.life -= dt;
    this.vy += this.g * dt;
    img.x += this.vx * dt;
    img.y += this.vy * dt;
    const st = this.style;
    if (st.spin) img.setRotation(img.rotation + st.spin * Math.sign(this.vx || 1) * dt);
    else img.setRotation(Math.atan2(this.vy, this.vx));
    const wob = 1 + Math.sin(this.life * 40) * 0.08;
    img.setScale((st.scale * wob) / ART_RES, (st.scale * (2 - wob)) / ART_RES);
    this.dripT -= dt;
    if (this.dripT <= 0) {
      this.dripT = 0.07;
      if (this.style.poo) this.gs.fx.pooSplat(img.x, img.y, 1);
      else this.gs.fx.drip(img.x - Math.cos(img.rotation) * 8, img.y - Math.sin(img.rotation) * 8);
    }
    // hit a hero?
    for (const p of this.gs.players) {
      if (!p.alive) continue;
      const pb = p.body;
      const r = st.r ?? 7;
      if (img.x + r < pb.left || img.x - r > pb.right || img.y + r < pb.top || img.y - r > pb.bottom) continue;
      this.gs.hitPlayer(p, img.x - Math.sign(this.vx) * 20);
      return this.splat(true);
    }
    if (this.gs.level.isSolidAt(img.x, img.y + 3) || this.life <= 0 || img.y > this.gs.level.heightPx + 50) this.splat();
  }

  private splat(onHero = false) {
    const { x, y } = this.img;
    if (this.style.poo) this.gs.fx.pooSplat(x, y, 12);
    else this.gs.fx.splat(x, y);
    if (this.style.onLand && !onHero) {
      this.style.onLand(x, y, this.vx);
      sfx.dribble(0.4);
      return this.gone();
    }
    // a flattened goop puddle that fades
    const puddle = this.gs.add.image(x, y, this.style.tex).setOrigin(this.style.tex === 'spit' ? 24 / 36 : 0.5, 0.5).setScale(2 / ART_RES, 0.6 / ART_RES).setDepth(DEPTH.projectiles - 1);
    this.gs.tweens.add({ targets: puddle, alpha: 0, scaleX: 2.6 / ART_RES, delay: 250, duration: 500, onComplete: () => puddle.destroy() });
    sfx.dribble(0.4);
    this.gone();
  }

  private gone() {
    this.gs.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    if (this.img.scene) this.img.destroy();
  }
}

/** A fixed pseudo-random number per level column (so who's armed is the same every play). */
export const colHash = (x: number) => Math.imul(Math.floor(x / TILE) + 101, 2654435761) >>> 0;

export function createEnemy(gs: GameScene, kind: EnemyKind, x: number, y: number): Enemy {
  const h = colHash(x);
  if (kind === 'puffball') {
    // 1 in 3 small guys carry a blaster (still one hit)
    const e = new Puffball(gs, x, y);
    if (h % 3 === 0) e.arm('gun', 'small');
    return e;
  }
  if (kind === 'bigpuff') {
    // 1 in 3 medium guys are specials: a weapon, and three hits instead of two
    const e = new BigPuff(gs, x, y);
    if (h % 3 === 0) {
      e.arm((['flail', 'gun', 'saw'] as const)[(h >>> 7) % 3], 'big');
      e.hp = 3;
    }
    return e;
  }
  switch (kind) {
    case 'goat':
      return new Goat(gs, x, y);
    case 'giant':
      return new Giant(gs, x, y);
    default:
      // (the Plops are made by createBadGuy in Plops.ts)
      throw new Error(`createEnemy: ${kind}`);
  }
}
