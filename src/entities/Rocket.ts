import Phaser from 'phaser';
import { DEPTH } from '../config';
import { ART_RES } from '../gfx/draw';
import type { Fx } from '../world/Fx';
import type { Player } from './Player';

/** What a rocket needs from its scene. */
export interface RocketHost extends Phaser.Scene {
  fx: Fx;
  explode(x: number, y: number, owner: Player): void;
}

const LIFETIME = 1.4;

/** Bazooka rocket: launches slow, accelerates, explodes on anything it touches. */
export class Rocket extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  private age = 0;
  private trailT = 0;
  exploded = false;

  constructor(
    private gs: RocketHost,
    readonly owner: Player,
    x: number,
    y: number,
    readonly dir: 1 | -1,
  ) {
    super(gs, x, y, 'rocket');
    gs.add.existing(this);
    gs.physics.add.existing(this);
    this.setScale(1 / ART_RES).setDepth(DEPTH.projectiles).setFlipX(dir < 0);
    this.body.setAllowGravity(false);
    this.body.setSize(18 * ART_RES, 8 * ART_RES, true);
    this.body.setVelocityX(dir * owner.char.rocketSpeed * 0.45);
    owner.rocketsInFlight++;
  }

  tick(dt: number) {
    if (this.exploded) return;
    this.age += dt;
    const target = this.dir * this.owner.char.rocketSpeed;
    const vx = this.body.velocity.x;
    this.body.setVelocityX(vx + (target - vx) * Math.min(1, dt * 7));
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

  /** Leave quietly (off-screen). */
  fizzle() {
    if (this.exploded) return;
    this.exploded = true;
    this.owner.rocketsInFlight = Math.max(0, this.owner.rocketsInFlight - 1);
    this.destroy();
  }
}
