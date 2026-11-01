import Phaser from 'phaser';
import { DEPTH } from '../config';
import { ART_RES } from '../gfx/draw';
import { PROP_RES } from '../gfx/textures';

/**
 * Aura: glowing wisps that float around the level. Carrying aura protects you:
 * get hit and you lose your aura instead of fainting (it scatters, and you can
 * snatch some back for a moment).
 */
export class Aura extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  taken = false;
  private glow: Phaser.GameObjects.Image;
  private baseX: number;
  private baseY: number;
  private phase: number;
  /** Scattered aura (after a hit) bounces around and fades away. */
  private life = -1;
  /** Scene time after which it can be picked up. */
  readonly collectableAt: number;

  constructor(scene: Phaser.Scene, x: number, y: number, scattered = false) {
    super(scene, x, y, 'aura');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(1 / ART_RES).setDepth(DEPTH.pickups);
    this.body.setSize(24 * ART_RES, 28 * ART_RES, true);
    this.glow = scene.add.image(x, y, 'glow').setTint(0x9ffbe8).setAlpha(0.6).setScale(1.05).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.pickups - 1);
    this.baseX = x;
    this.baseY = y;
    this.phase = Math.random() * 10;
    this.collectableAt = scattered ? scene.time.now + 450 : 0;
    if (scattered) {
      this.life = 2.6;
      this.body.setAllowGravity(true);
      this.body.setBounce(0.6, 0.6);
      this.body.setVelocity((Math.random() - 0.5) * 360, -220 - Math.random() * 220);
    } else {
      this.body.setAllowGravity(false);
    }
  }

  /** Returns false when it has faded out. */
  tick(time: number, dt: number): boolean {
    if (this.taken) return false;
    const t = time / 1000 + this.phase;
    if (this.life >= 0) {
      this.life -= dt;
      this.setAlpha(this.life < 1 ? (Math.floor(time / 80) % 2 ? 0.3 : 0.9) : 1);
      if (this.life <= 0) {
        this.vanish();
        return false;
      }
    } else {
      // drift lazily around its spot
      this.setPosition(this.baseX + Math.sin(t * 0.9) * 4, this.baseY + Math.sin(t * 2.1) * 5);
    }
    this.setRotation(Math.sin(t * 2.6) * 0.15);
    this.glow.setPosition(this.x, this.y).setScale(1 + Math.sin(t * 4) * 0.1);
    return true;
  }

  get scattered() {
    return this.life >= 0;
  }

  vanish() {
    this.taken = true;
    this.glow.destroy();
    this.destroy();
  }
}

/** Checkpoint: a puff-bloom bud that opens into a glowing flower when you reach it. */
export class Checkpoint extends Phaser.GameObjects.Image {
  reached = false;
  readonly zone: Phaser.GameObjects.Zone;
  constructor(
    scene: Phaser.Scene,
    x: number,
    groundY: number,
    readonly index: number,
  ) {
    super(scene, x, groundY + 2, 'bloom', 'off');
    scene.add.existing(this);
    this.setOrigin(0.5, 1).setScale(1 / PROP_RES).setDepth(DEPTH.decor + 1);
    this.zone = scene.add.zone(x, groundY - 50, 48, 100);
    scene.physics.add.existing(this.zone, true);
  }
  activate(quiet = false) {
    this.reached = true;
    this.setFrame('on');
    if (!quiet) this.scene.tweens.add({ targets: this, scaleX: { from: 0.3 / PROP_RES, to: 1 / PROP_RES }, duration: 380, ease: 'Back.easeOut' });
  }
}

/** Goal: the Puff Gate with a spinning aura swirl. */
export class Goal {
  readonly zone: Phaser.GameObjects.Zone;
  readonly gate: Phaser.GameObjects.Image;
  readonly swirl: Phaser.GameObjects.Image;
  reached = false;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    groundY: number,
  ) {
    this.swirl = scene.add.image(x, groundY - 62, 'gate-swirl').setScale(1 / PROP_RES).setDepth(DEPTH.decor + 1).setAlpha(0.9);
    this.gate = scene.add.image(x, groundY + 4, 'gate').setOrigin(0.5, 1).setScale(1 / PROP_RES).setDepth(DEPTH.decor + 2);
    this.zone = scene.add.zone(x, groundY - 50, 40, 100);
    scene.physics.add.existing(this.zone, true);
    scene.tweens.add({ targets: this.swirl, angle: 360, duration: 3200, repeat: -1 });
  }

  celebrate() {
    this.reached = true;
    this.scene.tweens.add({ targets: this.swirl, scale: { from: 1 / PROP_RES, to: 1.6 / PROP_RES }, yoyo: true, repeat: 3, duration: 220 });
  }
}
