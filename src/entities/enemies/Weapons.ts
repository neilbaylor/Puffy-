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
  private reach = 34;
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
    this.k = kind === 'gun' ? (size === 'small' ? 0.52 : 0.8) : kind === 'saw' ? 0.82 : 0.9;
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
    const h = HAND[this.size];
    return { x: this.owner.x + h.x * -this.facing, y: this.owner.y + h.y };
  }

  update(dt: number, active: boolean) {
    this.t += dt;
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
      // the flail: swung round and round, wider when you're close
      const near = alive && Math.abs(dx) < 190 && Math.abs(dy) < 120;
      this.reach += ((near ? 66 : 36) - this.reach) * Math.min(1, dt * 3);
      this.angle += dt * (near ? 6.2 : 4.2) * -f;
      const bx = hand.x + Math.cos(this.angle) * this.reach;
      const by = hand.y - 4 + Math.sin(this.angle) * this.reach * 0.75;
      this.ball!.setPosition(bx, by).setRotation(this.angle * 0.5).setFrame(Math.floor(this.t * 7) % 2 ? 'open' : 'shut');
      const g = this.chain!;
      g.clear();
      const n = Math.max(4, Math.round(this.reach / 7));
      for (let i = 1; i < n; i++) {
        const u = i / n;
        const cx = hand.x + (bx - hand.x) * u;
        const cy = hand.y + (by - hand.y) * u + Math.sin(u * Math.PI) * 3;
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
