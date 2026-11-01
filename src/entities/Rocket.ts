import Phaser from 'phaser';
import { DEPTH } from '../config';
import type { GameScene } from '../scenes/GameScene';
import type { Player } from './Player';

const LIFETIME = 1.4;

/** Bazooka rocket: launches slow, accelerates, explodes on anything it touches. */
export class Rocket extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  private age = 0;
  private trailT = 0;
  exploded = false;

  constructor(
    private gs: GameScene,
    readonly owner: Player,
    x: number,
    y: number,
    readonly dir: 1 | -1,
  ) {
    super(gs, x, y, 'rocket');
    gs.add.existing(this);
    gs.physics.add.existing(this);
    this.setDepth(DEPTH.projectiles).setFlipX(dir < 0);
    this.body.setAllowGravity(false);
    this.body.setSize(16, 8, true);
    this.body.setVelocityX(dir * owner.char.rocketSpeed * 0.45);
    owner.rocketsInFlight++;
  }

  tick(dt: number) {
    if (this.exploded) return;
    this.age += dt;
    const target = this.dir * this.owner.char.rocketSpeed;
    const vx = this.body.velocity.x;
    this.body.setVelocityX(vx + (target - vx) * Math.min(1, dt * 7));
    // tiny wobble for life
    this.setRotation(Math.sin(this.age * 40) * 0.04);
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.025;
      this.gs.fx.trail(this.x - this.dir * 12, this.y + (Math.random() - 0.5) * 3);
    }
    if (this.age > LIFETIME) this.explode();
  }

  explode() {
    if (this.exploded) return;
    this.exploded = true;
    this.owner.rocketsInFlight = Math.max(0, this.owner.rocketsInFlight - 1);
    this.gs.explode(this.x + this.dir * 6, this.y, this.owner);
    this.destroy();
  }
}

/** Slow glowing orb fired by turrets. Can be dodged, or shot down with a rocket. */
export class EnemyBullet extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  private age = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, vx: number, vy: number) {
    super(scene, x, y, 'bullet');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.projectiles);
    this.body.setAllowGravity(false);
    this.body.setCircle(5, 5, 5);
    this.body.setVelocity(vx, vy);
  }

  tick(dt: number) {
    this.age += dt;
    this.setAlpha(0.8 + Math.sin(this.age * 20) * 0.2);
    if (this.age > 5) this.destroy();
  }
}
