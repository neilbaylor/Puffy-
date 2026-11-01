import Phaser from 'phaser';
import { DEPTH } from '../config';

/** Floating coin. Spins by cycling frames. */
export class Coin extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  taken = false;
  private phase: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'coin', 'c0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.pickups);
    this.body.setAllowGravity(false);
    this.body.setSize(18, 20);
    this.phase = (x / 32) * 0.7;
  }

  tick(time: number) {
    if (this.taken) return;
    const f = Math.floor(time / 110 + this.phase * 3) % 4;
    this.setFrame(`c${f}`);
  }
}

/** Heart that pops out of a ? block and slides along the ground. */
export class Heart extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  taken = false;
  private dir = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'heart');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.pickups);
    this.body.setSize(20, 18);
    this.body.setVelocity(60, -380);
    this.body.setBounce(0.3, 0.2);
  }

  tick() {
    if (this.taken) return;
    if (this.body.blocked.left) this.dir = 1;
    if (this.body.blocked.right) this.dir = -1;
    this.body.setVelocityX(this.dir * 70);
  }
}

export class Checkpoint extends Phaser.GameObjects.Image {
  reached = false;
  readonly zone: Phaser.GameObjects.Zone;
  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    super(scene, x, groundY, 'checkpoint', 'off');
    scene.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(DEPTH.decor + 1);
    this.zone = scene.add.zone(x, groundY - 56, 40, 112);
    scene.physics.add.existing(this.zone, true);
  }
  activate() {
    this.reached = true;
    this.setFrame('on');
  }
}

export class Goal {
  readonly zone: Phaser.GameObjects.Zone;
  readonly post: Phaser.GameObjects.Image;
  readonly sign: Phaser.GameObjects.Image;
  reached = false;

  constructor(
    private scene: Phaser.Scene,
    x: number,
    groundY: number,
  ) {
    this.post = scene.add.image(x, groundY + 2, 'goal-post').setOrigin(0.5, 1).setDepth(DEPTH.decor + 1);
    this.sign = scene.add.image(x, groundY - 132, 'goal-sign').setDepth(DEPTH.decor + 2);
    this.zone = scene.add.zone(x, groundY - 80, 48, 160);
    scene.physics.add.existing(this.zone, true);
    scene.tweens.add({ targets: this.sign, y: this.sign.y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  celebrate() {
    this.reached = true;
    this.scene.tweens.add({
      targets: this.sign,
      scaleX: { from: 1, to: -1 },
      duration: 140,
      yoyo: true,
      repeat: 6,
    });
  }
}
