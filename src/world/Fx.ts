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
  private fluffE: Emitter;
  private auraE: Emitter;
  private burnE: Emitter;
  private emberE: Emitter;
  private ashE: Emitter;

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
    // the Giant's rolling flames: flickers of fire, glowing embers and dark smoke
    this.burnE = mk('puff', {
      speedX: { min: -30, max: 30 },
      speedY: { min: -90, max: -40 },
      lifespan: { min: 200, max: 380 },
      scale: { start: 0.55, end: 0.05 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xffe14d, 0xff9a2e, 0xff5a1f],
      blendMode: Phaser.BlendModes.ADD,
    }, DEPTH.players + 1);
    this.emberE = mk('spark', {
      speedX: { min: -40, max: 40 },
      speedY: { min: -170, max: -70 },
      lifespan: { min: 450, max: 900 },
      scale: { start: 0.45, end: 0 },
      tint: [0xffe14d, 0xffb627, 0xff6a2a],
      gravityY: 60,
      blendMode: Phaser.BlendModes.ADD,
    }, DEPTH.players + 1);
    this.ashE = mk('puff', {
      speedX: { min: -20, max: 20 },
      speedY: { min: -60, max: -25 },
      lifespan: { min: 800, max: 1400 },
      scale: { start: 0.35, end: 1.2 },
      alpha: { start: 0.55, end: 0 },
      tint: [0x4a4250, 0x5e5662, 0x3a3440],
    }, DEPTH.players - 2);
    this.sparkE = mk('spark', {
      speed: { min: 120, max: 380 },
      lifespan: { min: 250, max: 500 },
      scale: { start: 0.9, end: 0 },
      tint: [0xffffff, 0xffe14d, 0xffb627],
      gravityY: 600,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.debrisE = mk('chip', {
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
    this.fluffE = mk('puff', {
      speed: { min: 60, max: 220 },
      lifespan: { min: 400, max: 750 },
      scale: { start: 0.7, end: 0.15 },
      alpha: { start: 1, end: 0 },
      tint: [0xf0c58f, 0xffe6c4, 0xf0812c, 0xffffff],
      gravityY: 200,
    });
    this.auraE = mk('spark', {
      speed: { min: 40, max: 160 },
      lifespan: { min: 300, max: 600 },
      scale: { start: 1.1, end: 0 },
      tint: [0x6ff0d8, 0xe6fffa, 0x9ffbe8],
      blendMode: Phaser.BlendModes.ADD,
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
    this.debrisE.explode(5, x, y);
  }

  /** Bits of fluff when a bad guy pops. */
  fluffBurst(x: number, y: number, k = 1) {
    this.fluffE.explode(Math.round(10 * k + 4), x, y);
  }

  auraSparkle(x: number, y: number, n = 8) {
    this.auraE.explode(n, x, y);
  }

  /** Bazooka muzzle flash + smoke out of the back of the tube. */
  muzzle(x: number, y: number, dir: 1 | -1, backX: number) {
    const f = this.scene.add.image(x + dir * 6, y, 'flash').setScale(1 / 3).setFlipX(dir < 0).setDepth(DEPTH.projectiles + 1);
    this.scene.tweens.add({ targets: f, scale: 0.55, alpha: 0, duration: 110, onComplete: () => f.destroy() });
    this.dustE.explode(4, backX, y);
    this.smokeE.explode(2, backX, y);
  }

  /** A little ring of air under the feet for the mid-air second jump. */
  airPuff(x: number, y: number) {
    const ring = this.scene.add.image(x, y + 2, 'ring').setDepth(DEPTH.fx).setTint(0xffffff).setAlpha(0.85).setScale(0.12, 0.04);
    this.scene.tweens.add({ targets: ring, scaleX: 0.42, scaleY: 0.12, y: y + 10, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    this.dustE.explode(5, x, y + 2);
  }

  /** Fire, embers and smoke left behind by a rolling flame (x, ground y, moving dir). */
  flameTrail(x: number, y: number, dir: number, vigor = 1) {
    // a dying flame gives fewer flickers and more smoke
    if (Math.random() < 0.7 * vigor) this.burnE.emitParticleAt(x - dir * (6 + Math.random() * 14), y - 4 - Math.random() * 10 * vigor);
    if (Math.random() < 0.35 * vigor + 0.05) this.emberE.emitParticleAt(x - dir * Math.random() * 10, y - 10 - Math.random() * 26 * vigor);
    if (Math.random() < 0.45 + 0.35 * (1 - vigor)) this.ashE.emitParticleAt(x - dir * (10 + Math.random() * 14 * vigor), y - 10 - Math.random() * 22 * vigor);
  }

  /** A flame going out: a rising curl of smoke and a few last embers. */
  flameDie(x: number, y: number) {
    for (let i = 0; i < 12; i++) this.scene.time.delayedCall(i * 55, () => this.ashE.emitParticleAt(x + (Math.random() - 0.5) * 14, y - 6 - Math.random() * 10));
    for (let i = 0; i < 5; i++) this.emberE.emitParticleAt(x + (Math.random() - 0.5) * 12, y - 8);
  }

  /** A whoomph of fire where a flame wave starts. */
  flameBurst(x: number, y: number) {
    for (let i = 0; i < 10; i++) this.burnE.emitParticleAt(x + (Math.random() - 0.5) * 30, y - Math.random() * 14);
    for (let i = 0; i < 8; i++) this.ashE.emitParticleAt(x + (Math.random() - 0.5) * 30, y - 10 - Math.random() * 20);
    for (let i = 0; i < 6; i++) this.emberE.emitParticleAt(x + (Math.random() - 0.5) * 20, y - 10);
  }

  /** Ground shockwave ring (giant slam). */
  shockwave(x: number, y: number, r: number) {
    const ring = this.scene.add.image(x, y, 'ring').setDepth(DEPTH.fx).setTint(0xffffff).setAlpha(0.9).setScale(0.1, 0.03);
    this.scene.tweens.add({ targets: ring, scaleX: (r * 2.4) / 128, scaleY: (r * 0.5) / 128, alpha: 0, duration: 360, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    this.dustE.explode(12, x - r * 0.6, y);
    this.dustE.explode(12, x + r * 0.6, y);
  }

  /** Little stars circling a fainted hero's head. */
  dizzy(target: Phaser.GameObjects.Sprite, ms: number) {
    const stars = [0, 1, 2].map(() => this.scene.add.image(target.x, target.y, 'star').setScale(0.45).setDepth(DEPTH.fx));
    const start = this.scene.time.now;
    const ev = this.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const t = (this.scene.time.now - start) / 1000;
        stars.forEach((s, i) => {
          const a = t * 5 + (i * Math.PI * 2) / 3;
          s.setPosition(target.x + Math.cos(a) * 16, target.y - 34 + Math.sin(a) * 5);
        });
        if (t * 1000 > ms) {
          ev.remove();
          stars.forEach((s) => s.destroy());
        }
      },
    });
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
