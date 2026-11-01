import Phaser from 'phaser';
import { DEPTH } from '../config';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** Particle + juice effects. One emitter per effect type, fired with explode(). */
export class Fx {
  private dustE: Emitter;
  private smokeE: Emitter;
  private fireE: Emitter;
  private sparkE: Emitter;
  private debrisE: Emitter;
  private starE: Emitter;
  private trailE: Emitter;

  constructor(private scene: Phaser.Scene) {
    const mk = (tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth: number = DEPTH.fx) =>
      scene.add.particles(0, 0, tex, { emitting: false, ...cfg }).setDepth(depth);

    this.dustE = mk('puff', {
      speed: { min: 20, max: 70 },
      angle: { min: 200, max: 340 },
      lifespan: 380,
      scale: { start: 0.45, end: 0.1 },
      alpha: { start: 0.8, end: 0 },
      tint: 0xf3e6cf,
      gravityY: -40,
    }, DEPTH.players - 1);
    this.smokeE = mk('puff', {
      speed: { min: 30, max: 140 },
      lifespan: { min: 500, max: 900 },
      scale: { start: 0.9, end: 1.8 },
      alpha: { start: 0.7, end: 0 },
      tint: [0x9a9aa8, 0x7a7a88, 0xbdbdc8],
      gravityY: -60,
    });
    this.fireE = mk('puff', {
      speed: { min: 60, max: 260 },
      lifespan: { min: 220, max: 420 },
      scale: { start: 1.1, end: 0.2 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe14d, 0xff9a2e, 0xff5a3c, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.sparkE = mk('spark', {
      speed: { min: 120, max: 380 },
      lifespan: { min: 250, max: 500 },
      scale: { start: 0.9, end: 0 },
      tint: [0xffffff, 0xffe14d, 0xffb627],
      gravityY: 600,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.debrisE = mk('debris', {
      speedX: { min: -180, max: 180 },
      speedY: { min: -460, max: -200 },
      lifespan: 1200,
      scale: { start: 1, end: 0.6 },
      rotate: { start: 0, end: 720 },
      gravityY: 1500,
    });
    this.starE = mk('star', {
      speed: { min: 80, max: 180 },
      lifespan: 500,
      scale: { start: 0.9, end: 0 },
      rotate: { start: 0, end: 360 },
    });
    this.trailE = mk('puff', {
      speed: { min: 5, max: 25 },
      lifespan: 360,
      scale: { start: 0.35, end: 0.9 },
      alpha: { start: 0.55, end: 0 },
      tint: [0xdedee6, 0xc4c4cc],
    }, DEPTH.projectiles - 1);
  }

  dust(x: number, y: number, n = 6) {
    this.dustE.explode(n, x, y);
  }

  trail(x: number, y: number) {
    this.trailE.explode(1, x, y);
  }

  sparkle(x: number, y: number, n = 8) {
    this.sparkE.explode(n, x, y);
  }

  stars(x: number, y: number, n = 6) {
    this.starE.explode(n, x, y);
  }

  debris(x: number, y: number) {
    this.debrisE.explode(4, x, y);
  }

  explosion(x: number, y: number, radius: number) {
    const s = this.scene;
    const k = radius / 56;
    // flash core
    const core = s.add.image(x, y, 'disc').setDepth(DEPTH.fx + 1).setTint(0xfff3b0).setBlendMode(Phaser.BlendModes.ADD);
    core.setScale(0.2 * k);
    s.tweens.add({ targets: core, scale: 1.6 * k, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => core.destroy() });
    // shockwave ring
    const ring = s.add.image(x, y, 'ring').setDepth(DEPTH.fx + 1).setTint(0xffffff).setAlpha(0.9);
    ring.setScale(0.1);
    s.tweens.add({ targets: ring, scale: (radius * 2.2) / 128, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    this.fireE.explode(Math.round(18 * k), x, y);
    this.smokeE.explode(Math.round(10 * k), x, y);
    this.sparkE.explode(Math.round(12 * k), x, y);
  }

  popText(x: number, y: number, text: string, color = '#ffffff', size = 18) {
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: '"Lilita One", "Arial Black", sans-serif',
        fontSize: `${size}px`,
        color,
        stroke: '#2a1e2e',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.text);
    this.scene.tweens.add({
      targets: t,
      y: y - 36,
      alpha: { from: 1, to: 0 },
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}
