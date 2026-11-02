import Phaser from 'phaser';

/**
 * Simple, fast confetti: plain paper pieces from Phaser's built-in particles
 * (all drawn in one batch), with a flutter and a fade. Same calls as the old
 * fancy confetti (burst, pop, cannon, fountain, rain) but a fraction of the
 * pieces, so phones keep a steady frame rate.
 */
export interface BurstOpts {
  power?: number;
  spread?: number;
  angle?: number;
  colors?: number[];
  scale?: number;
  // (accepted for compatibility; the simple confetti ignores them)
  streamers?: number;
  sequins?: number;
  glitter?: number;
}

const COLORS = [0xffd23f, 0x7a2ec2, 0xffffff, 0xe8463f, 0x2fd0c0, 0xff8fb3, 0x4c8dff];
/** Fewer pieces than asked for: the old confetti spawned thousands. */
const DENSITY = 0.22;
/** Most pieces alive at once. */
const MAX_ALIVE = 420;

export class SimpleConfetti {
  private burstE: Phaser.GameObjects.Particles.ParticleEmitter;
  private rainE: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private scene: Phaser.Scene,
    depth: number,
  ) {
    if (!scene.textures.exists('cfs-paper')) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillRect(0, 0, 8, 13);
      g.fillStyle(0x000000, 0.12).fillRect(0, 9, 8, 4);
      g.generateTexture('cfs-paper', 8, 13);
      g.destroy();
    }
    const flutter = (p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => Math.cos(t * 18 + p.x * 0.07);
    this.burstE = scene.add
      .particles(0, 0, 'cfs-paper', {
        emitting: false,
        lifespan: { min: 1800, max: 3200 },
        speed: { min: 200, max: 600 },
        angle: { min: 0, max: 360 },
        gravityY: 520,
        rotate: { onEmit: () => Math.random() * 360, onUpdate: (p: Phaser.GameObjects.Particles.Particle, _k: string, t: number) => (p.x * 2 + t * 700) % 360 },
        scaleX: { onUpdate: flutter },
        scaleY: { min: 0.7, max: 1.1 },
        alpha: { start: 1, end: 0, ease: 'Quint.easeIn' },
        tint: COLORS,
        maxAliveParticles: MAX_ALIVE,
      })
      .setDepth(depth);
    this.rainE = scene.add
      .particles(0, 0, 'cfs-paper', {
        emitting: false,
        lifespan: 5200,
        speedX: { min: -30, max: 30 },
        speedY: { min: 70, max: 150 },
        gravityY: 25,
        rotate: { min: 0, max: 360 },
        scaleX: { onUpdate: flutter },
        scaleY: { min: 0.7, max: 1.1 },
        alpha: { start: 1, end: 0, ease: 'Quint.easeIn' },
        tint: COLORS,
        maxAliveParticles: 220,
      })
      .setDepth(depth);
  }

  get timeScale() {
    return this.burstE.timeScale;
  }
  set timeScale(v: number) {
    this.burstE.timeScale = v;
    this.rainE.timeScale = v;
  }

  private shoot(x: number, y: number, n: number, angle: number, spread: number, power: number, o: BurstOpts) {
    const count = Math.max(1, Math.round(n * DENSITY));
    const deg = Phaser.Math.RadToDeg(angle);
    const half = Phaser.Math.RadToDeg(spread);
    // (the old confetti's "power" was much stronger; scaled to this one's slower pieces)
    const sp = Math.min(900, power * 0.32);
    this.burstE.setEmitterAngle({ min: deg - half, max: deg + half });
    this.burstE.setParticleSpeed(sp * 0.35, sp);
    this.burstE.setParticleScale(o.scale ?? 1);
    if (o.colors) this.burstE.particleTint = o.colors[0];
    this.burstE.explode(count, x, y);
    if (o.colors) this.burstE.particleTint = 0xffffff;
  }

  /** A burst all around (or in a cone: angle ± spread). */
  burst(x: number, y: number, n: number, o: BurstOpts = {}) {
    this.shoot(x, y, n, o.angle ?? 0, o.spread ?? Math.PI, o.power ?? 900, o);
  }

  /** A firework-style pop in the air. */
  pop(x: number, y: number, n: number, power = 900) {
    this.shoot(x, y, n, 0, Math.PI, power, {});
  }

  /** A cannon shot in one direction. */
  cannon(x: number, y: number, angle: number, n: number, o: BurstOpts = {}) {
    this.shoot(x, y, n, angle, 0.22, o.power ?? 1500, o);
  }

  /** Keeps erupting upward from one spot for a while. */
  fountain(x: number, y: number, perSecond: number, ms: number, o: BurstOpts = {}) {
    const ticks = Math.ceil(ms / 150);
    for (let i = 0; i < ticks; i++)
      this.scene.time.delayedCall(i * 150, () => this.shoot(x, y, perSecond * 0.15, -Math.PI / 2, 0.5, o.power ?? 1600, o));
  }

  /** Confetti drifting down over an area for a while. */
  rain(view: Phaser.Geom.Rectangle, perSecond: number, ms: number) {
    const per = Math.max(1, Math.round(perSecond * DENSITY * 0.1));
    const ticks = Math.ceil(ms / 100);
    for (let i = 0; i < ticks; i++)
      this.scene.time.delayedCall(i * 100, () => {
        for (let k = 0; k < per; k++) this.rainE.emitParticleAt(view.x + Math.random() * view.width, view.y - 20);
      });
  }
}
