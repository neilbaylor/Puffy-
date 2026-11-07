import Phaser from 'phaser';
import { sfx } from '../../core/sfx';
import { ART_RES } from '../../gfx/draw';
import { BLASTER, SAW, W_RES } from '../../gfx/weapons';
import type { GameScene } from '../../scenes/GameScene';
import type { Enemy } from './Enemy';

/**
 * Weapons some bad guys carry (from the sketches):
 *  - gun: the striped blaster. They stop, turn to face you, the barrel
 *    shakes for a moment (that's your warning), then it fires a fuzzy
 *    pom-pom straight at you. Jump it or shoot the bad guy first.
 *  - saw: a chainsaw. The bad guy chases harder; up close it revs and
 *    charges, and the saw blade hurts.
 *  - flail: a ball and chain whose iron ball has a chomping mouth, swung
 *    round and round (wider when you get close). Don't touch the ball.
 */
export type WeaponKind = 'gun' | 'saw' | 'flail';

/** Where each bad guy's front hand is (frame units from the sprite centre, facing left). */
const HAND = { small: { x: -17, y: 5 }, big: { x: -31, y: 3 } };

export class Weapon {
  private img: Phaser.GameObjects.Image;
  private ball: Phaser.GameObjects.Image | null = null;
  private chain: Phaser.GameObjects.Graphics | null = null;
  private cd: number;
  private warn = 0;
  private t = Math.random() * 10;
  private angle = Math.random() * Math.PI * 2;
  private bx: number | null = null;
  private by: number | null = null;
  private bitePhase: 'stalk' | 'lunge' | 'snap' | 'back' = 'stalk';
  private biteT = 0.6;
  private charge = 0;
  private recoil = 0;
  /** The owner should stand still facing its target (aiming / revving). */
  aim = false;
  /** The weapon is driving the owner right now (a chainsaw charge). */
  busy = false;
  private readonly k: number;

  constructor(
    private gs: GameScene,
    private owner: Enemy,
    readonly kind: WeaponKind,
    private size: 'small' | 'big',
  ) {
    this.k = (kind === 'gun' ? (size === 'small' ? 0.52 : 0.8) : kind === 'saw' ? 0.82 : 0.9) * owner.weaponK;
    const key = kind === 'gun' ? 'w-blaster' : kind === 'saw' ? 'w-saw' : 'w-ball';
    if (kind === 'flail') {
      this.chain = gs.add.graphics().setDepth(owner.depth + 0.15);
      this.ball = gs.add.image(owner.x, owner.y, 'w-ball', 'open').setScale(this.k / W_RES).setDepth(owner.depth + 0.2);
      this.img = gs.add.image(owner.x, owner.y, 'w-ball', 'open').setVisible(false);
    } else {
      this.img = gs.add.image(owner.x, owner.y, key, kind === 'saw' ? 's0' : undefined).setScale(this.k / W_RES).setDepth(owner.depth + 0.1);
    }
    this.cd = 1 + Math.random();
  }

  private get facing() {
    return this.owner.flipX ? 1 : -1; // art faces left; flipped = facing right
  }

  private get hand() {
    const h = this.owner.handAt ?? HAND[this.size];
    return { x: this.owner.x + h.x * -this.facing, y: this.owner.y + h.y };
  }

  update(dt: number, active: boolean) {
    this.t += dt;
    // hurt twice, the chainsaw guy loses his temper and THROWS it at you
    if (this.kind === 'saw' && this.owner.hp <= 1 && active) return this.throwSaw();
    const o = this.owner;
    const f = this.facing;
    const hand = this.hand;
    const tgt = this.gs.nearestPlayer(o.x, o.y);
    const dx = tgt ? tgt.x - o.x : 0;
    const dy = tgt ? tgt.y - o.y : 0;
    const alive = !!tgt && tgt.alive && active;

    if (this.kind === 'gun') {
      const range = this.size === 'small' ? 330 : 380;
      this.aim = alive && Math.abs(dx) < range && Math.abs(dx) > 30 && Math.abs(dy) < 70;
      this.cd -= dt;
      if (this.aim && this.cd <= 0 && this.warn <= 0) {
        this.warn = 0.45;
        sfx.bump();
      }
      let jitter = 0;
      if (this.warn > 0) {
        this.warn -= dt;
        jitter = Math.sin(this.t * 90) * 1.2;
        if (this.warn <= 0) {
          if (this.aim) this.fire();
          this.cd = this.size === 'small' ? 2.3 + Math.random() * 0.8 : 1.6 + Math.random() * 0.6;
        }
      }
      this.recoil *= Math.exp(-dt * 12);
      const ox = BLASTER.gx / BLASTER.w;
      this.img
        .setOrigin(f < 0 ? ox : 1 - ox, BLASTER.gy / BLASTER.h)
        .setFlipX(f > 0)
        .setPosition(hand.x - f * this.recoil + jitter, hand.y + Math.sin(this.t * 3) * 0.6)
        .setTint(this.warn > 0 && Math.floor(this.t * 20) % 2 ? 0xffd0c0 : 0xffffff);
    } else if (this.kind === 'saw') {
      // idle rumble; up close it revs and charges
      this.img.setFrame(Math.floor(this.t * (this.charge > 0 ? 30 : 12)) % 2 ? 's0' : 's1');
      this.cd -= dt;
      if (this.charge > 0) {
        this.charge -= dt;
        const b = o.body;
        const wall = f < 0 ? b.blocked.left : b.blocked.right;
        const gap = !this.gs.level.isSolidAt(f > 0 ? b.right + 6 : b.left - 6, b.bottom + 6);
        b.setVelocityX(wall || gap ? 0 : f * 250);
        if (Math.random() < 0.6) this.gs.fx.dust(hand.x + f * SAW.w * this.k * 0.6, o.body.bottom, 1);
        if (Math.random() < 0.3) this.gs.fx.sparkle(hand.x + f * SAW.w * this.k * 0.75, hand.y, 2);
        if (this.charge <= 0 || wall || gap) {
          this.charge = 0;
          this.busy = false;
          this.cd = 1.4 + Math.random() * 0.8;
        }
      } else if (alive && o.body.blocked.down && this.cd <= 0 && Math.abs(dx) < 210 && Math.abs(dy) < 60 && Math.sign(dx) === f) {
        this.charge = 0.85;
        this.busy = true;
        sfx.saw();
        this.gs.fx.popText(o.x, o.body.top - 16, 'VRRR!', '#ffd23f', 18);
      }
      const ox = SAW.gx / SAW.w;
      const shake = this.charge > 0 ? Math.sin(this.t * 80) * 1.4 : Math.sin(this.t * 40) * 0.5;
      this.img
        .setOrigin(f < 0 ? ox : 1 - ox, SAW.gy / SAW.h)
        .setFlipX(f > 0)
        .setPosition(hand.x, hand.y + shake)
        .setRotation(f * (this.charge > 0 ? -0.05 : 0.12));
      // the blade hurts
      if (tgt && tgt.alive && active) {
        const x0 = hand.x + f * 4;
        const x1 = hand.x + f * (SAW.gx - SAW.tipX) * this.k;
        const pb = tgt.body;
        if (Math.max(x0, x1) > pb.left && Math.min(x0, x1) < pb.right && hand.y + 8 > pb.top && hand.y - 8 < pb.bottom) this.gs.hitPlayer(tgt, o.x);
      }
    } else {
      // the ball and chain has a mind of its own: it drifts and looks about when you're far
      // away; close up it stalks you with chattering teeth, then LUNGES and snaps its jaws
      const near = alive && Math.abs(dx) < 200 && Math.abs(dy) < 130;
      const ball = this.ball!;
      if (this.bx === null) {
        this.bx = hand.x - 30;
        this.by = hand.y + 10;
      }
      let tx: number;
      let ty: number;
      let follow = 7;
      let frame: 'open' | 'shut' = Math.floor(this.t * 2.5) % 3 === 0 ? 'open' : 'shut';
      if (!near || !tgt) {
        this.bitePhase = 'stalk';
        this.biteT = 0.6;
        this.angle += dt * 1.8 * -f;
        tx = hand.x + Math.cos(this.angle) * 34;
        ty = hand.y + 6 + Math.sin(this.angle) * 22;
      } else {
        const px = tgt.x;
        const py = tgt.body.center.y;
        const ang = Math.atan2(py - hand.y, px - hand.x);
        const dist = Math.hypot(px - hand.x, py - hand.y);
        this.biteT -= dt;
        if (this.bitePhase === 'stalk') {
          // sizing you up: hovering, swaying, teeth chattering
          tx = hand.x + Math.cos(ang) * 40 + Math.sin(this.t * 5) * 6;
          ty = hand.y + Math.sin(ang) * 40 + Math.cos(this.t * 7) * 5 - 6;
          frame = Math.floor(this.t * 14) % 2 ? 'open' : 'shut';
          if (this.biteT <= 0) {
            this.bitePhase = 'lunge';
            this.biteT = 0.24;
            sfx.whoosh();
          }
        } else if (this.bitePhase === 'lunge') {
          // GO: jaws wide open, straight at you
          const reach = Math.min(dist, 92);
          tx = hand.x + Math.cos(ang) * reach;
          ty = hand.y + Math.sin(ang) * reach;
          follow = 20;
          frame = 'open';
          if (this.biteT <= 0) {
            this.bitePhase = 'snap';
            this.biteT = 0.18;
            sfx.chomp();
          }
        } else if (this.bitePhase === 'snap') {
          // CHOMP — jaws slam shut with a little shudder
          tx = this.bx! + Math.sin(this.t * 70) * 1.5;
          ty = this.by!;
          follow = 30;
          frame = 'shut';
          if (this.biteT <= 0) {
            this.bitePhase = 'back';
            this.biteT = 0.35;
          }
        } else {
          // pulls back for another go
          tx = hand.x + Math.cos(ang) * 26;
          ty = hand.y + Math.sin(ang) * 26 - 4;
          follow = 6;
          frame = 'shut';
          if (this.biteT <= 0) {
            this.bitePhase = 'stalk';
            this.biteT = 0.45 + Math.random() * 0.5;
          }
        }
      }
      const kf = 1 - Math.exp(-dt * follow);
      this.bx! += (tx - this.bx!) * kf;
      this.by! += (ty - this.by!) * kf;
      const bx = this.bx!;
      const by = this.by!;
      // it always faces you (or wherever it's looking)
      const lookX = near && tgt ? tgt.x : bx + Math.cos(this.angle) * 10;
      ball.setPosition(bx, by).setFlipX(lookX > bx).setRotation(Math.sin(this.t * 3) * 0.15).setFrame(frame);
      const g = this.chain!;
      g.clear();
      const len = Math.hypot(bx - hand.x, by - hand.y);
      const n = Math.max(4, Math.round(len / 7));
      for (let i = 1; i < n; i++) {
        const u = i / n;
        const cx = hand.x + (bx - hand.x) * u;
        const cy = hand.y + (by - hand.y) * u + Math.sin(u * Math.PI) * Math.max(0, 10 - len * 0.08);
        g.fillStyle(0x3a3844, 1).fillCircle(cx, cy, 2.6);
        g.fillStyle(0x9a98a2, 1).fillCircle(cx, cy, 1.6);
      }
      if (tgt && tgt.alive && active) {
        const pb = tgt.body;
        const r = 12 * this.k;
        if (bx + r > pb.left && bx - r < pb.right && by + r > pb.top && by - r < pb.bottom) this.gs.hitPlayer(tgt, bx);
      }
    }
  }

  /** RAAH! The spinning chainsaw is hurled at you in an arc; he fights on bare-handed. */
  private throwSaw() {
    const o = this.owner;
    const f = this.facing;
    const hand = this.hand;
    const tgt = this.gs.nearestPlayer(o.x, o.y);
    const tx = tgt ? tgt.x : hand.x + f * 250;
    const ty = tgt ? tgt.body.center.y : hand.y;
    const G = 700;
    const dist = Math.abs(tx - hand.x);
    const T = Phaser.Math.Clamp(dist / 420, 0.35, 0.85);
    let vx = (tx - hand.x) / T;
    if (Math.abs(vx) < 120) vx = (Math.sign(tx - hand.x) || f) * 120;
    const vy = (ty - hand.y - 0.5 * G * T * T) / T;
    new ThrownSaw(this.gs, hand.x + f * 20, hand.y, vx, vy, G, this.k);
    this.gs.fx.popText(o.x, o.body.top - 18, 'RAAH!', '#ff5a3c', 22);
    sfx.saw();
    sfx.whoosh();
    this.busy = false;
    this.charge = 0;
    this.img.destroy();
    o.weapon = null;
  }

  /** Fire a fuzzy pom-pom from the muzzle. */
  private fire() {
    const f = this.facing;
    const hand = this.hand;
    const mx = hand.x + f * (BLASTER.gx - BLASTER.muzzleX) * this.k;
    const my = hand.y + (BLASTER.muzzleY - BLASTER.gy) * this.k;
    new PomPom(this.gs, mx, my, f * (this.size === 'small' ? 280 : 330));
    this.recoil = 5;
    sfx.pew();
    const flash = this.gs.add.image(mx, my, 'flash').setScale(0.55 / ART_RES).setFlipX(f < 0).setDepth(this.owner.depth + 0.3);
    this.gs.tweens.add({ targets: flash, alpha: 0, scale: 0.8 / ART_RES, duration: 120, onComplete: () => flash.destroy() });
  }

  /** The owner is gone: the weapon clatters to the ground and fades. */
  drop() {
    const parts = [this.img, this.ball].filter((p): p is Phaser.GameObjects.Image => !!p && p.visible);
    this.chain?.destroy();
    for (const p of parts)
      this.gs.tweens.add({
        targets: p,
        y: p.y + 30,
        angle: p.angle + (Math.random() < 0.5 ? -90 : 90),
        alpha: 0,
        duration: 600,
        ease: 'Quad.easeIn',
        onComplete: () => p.destroy(),
      });
    if (!this.img.visible) this.img.destroy();
  }
}

/** A fuzzy pom-pom bullet: flies straight, spins, poofs on walls or on you. */
class PomPom {
  private img: Phaser.GameObjects.Image;
  private life = 2.6;
  private readonly onUpdate: (time: number, delta: number) => void;

  constructor(
    private gs: GameScene,
    x: number,
    y: number,
    private vx: number,
  ) {
    this.img = gs.add.image(x, y, 'w-bullet').setScale(1 / W_RES).setDepth(25);
    this.onUpdate = (_t, delta) => this.step(Math.min(delta / 1000, 0.05));
    gs.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    gs.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.gone());
  }

  private step(dt: number) {
    const img = this.img;
    if (!img.scene) return this.gone();
    this.life -= dt;
    img.x += this.vx * dt;
    img.rotation += dt * 12 * Math.sign(this.vx);
    if (Math.random() < 0.3) this.gs.fx.trail(img.x - Math.sign(this.vx) * 6, img.y);
    for (const p of this.gs.players) {
      if (!p.alive) continue;
      const pb = p.body;
      if (img.x + 6 < pb.left || img.x - 6 > pb.right || img.y + 6 < pb.top || img.y - 6 > pb.bottom) continue;
      this.gs.hitPlayer(p, img.x - Math.sign(this.vx) * 20);
      return this.poof();
    }
    if (this.gs.level.isSolidAt(img.x, img.y) || this.life <= 0) this.poof();
  }

  private poof() {
    this.gs.fx.dust(this.img.x, this.img.y + 4, 5);
    this.gone();
  }

  private gone() {
    this.gs.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    if (this.img.scene) this.img.destroy();
  }
}

/** A thrown chainsaw: spins through the air buzzing, hurts on contact, sticks in the ground. */
class ThrownSaw {
  private img: Phaser.GameObjects.Image;
  private t = 0;
  private stuck = 0;
  private readonly onUpdate: (time: number, delta: number) => void;

  constructor(
    private gs: GameScene,
    x: number,
    y: number,
    private vx: number,
    private vy: number,
    private g: number,
    k: number,
  ) {
    this.img = gs.add.image(x, y, 'w-saw', 's0').setScale(k / W_RES).setDepth(26).setFlipX(vx > 0);
    this.onUpdate = (_t, delta) => this.step(Math.min(delta / 1000, 0.05));
    gs.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    gs.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.gone());
  }

  private step(dt: number) {
    const img = this.img;
    if (!img.scene) return this.gone();
    this.t += dt;
    img.setFrame(Math.floor(this.t * 30) % 2 ? 's0' : 's1');
    if (this.stuck > 0) {
      // buzzing away, stuck in the ground, then it fades
      this.stuck -= dt;
      img.x += Math.sin(this.t * 90) * 0.4;
      if (this.stuck < 0.6) img.setAlpha(Math.max(0, this.stuck / 0.6));
      if (this.stuck <= 0) this.gone();
      return;
    }
    this.vy += this.g * dt;
    img.x += this.vx * dt;
    img.y += this.vy * dt;
    img.rotation += dt * 16 * Math.sign(this.vx);
    if (Math.random() < 0.5) this.gs.fx.sparkle(img.x, img.y, 1);
    for (const p of this.gs.players) {
      if (!p.alive) continue;
      const pb = p.body;
      if (img.x + 16 < pb.left || img.x - 16 > pb.right || img.y + 12 < pb.top || img.y - 12 > pb.bottom) continue;
      this.gs.hitPlayer(p, img.x - Math.sign(this.vx) * 30);
    }
    if (this.gs.level.isSolidAt(img.x, img.y + 8)) {
      // THUNK — it bites into the ground, blade first
      this.stuck = 1.6;
      img.setRotation(Math.sign(this.vx) * 1.2);
      this.gs.fx.dust(img.x, img.y + 8, 8);
      this.gs.cameras.main.shake(90, 0.004);
      sfx.thud();
    } else if (this.t > 3 || img.y > this.gs.level.heightPx + 50) this.gone();
  }

  private gone() {
    this.gs.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    if (this.img.scene) this.img.destroy();
  }
}
