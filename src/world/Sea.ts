import Phaser from 'phaser';
import { DEPTH } from '../config';
import { SURFACE_LINE } from '../gfx/sea';

interface View {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Drifter {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  /** Parallax: how much it moves with the camera (0 = stuck to the screen, 1 = with the world). */
  k: number;
  kind: 'jelly' | 'fish' | 'turtle' | 'octo';
}

interface Crab {
  img: Phaser.GameObjects.Image;
  x: number;
  vx: number;
  t: number;
  pause: number;
}

/**
 * Under the sea's life and light (visual only), for a level with `water` (see LevelData.water):
 *  - the sky over the water and the shimmering surface line (you only see it near the top),
 *  - soft beams of light slanting down from the surface,
 *  - jellyfish pulsing slowly upward far off, little schools of fish and the odd sea turtle
 *    swimming across behind the reef,
 *  - crabs scuttling about on the sand near you,
 *  - splashes and bursts of bubbles for the game (a dive, a popped fish).
 */
export class SeaLife {
  private t = 0;
  private sky: Phaser.GameObjects.Image[] = [];
  private skyTop: Phaser.GameObjects.Rectangle;
  private surface: Phaser.GameObjects.Image[] = [];
  private rays: { img: Phaser.GameObjects.Image; x: number; ph: number; a: number }[] = [];
  private drifters: Drifter[] = [];
  private crabs: Crab[] = [];
  private nextSchool = 3;
  private nextTurtle = 14;
  /** The turtle and the octopus take turns. */
  private octoNext = true;
  private bubbleE: Phaser.GameObjects.Particles.ParticleEmitter;
  private darkImg: Phaser.GameObjects.Image | null = null;
  /** How dark it is now, 0…1. */
  private darkK = 0;
  private splashE: Phaser.GameObjects.Particles.ParticleEmitter;
  private columnE: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private scene: Phaser.Scene,
    /** The surface's world y. */
    readonly surfaceY: number,
    private widthPx: number,
    private groundBelow: (x: number, y: number, max: number) => number | null,
    /** Down a trench it gets dark: from this world y (none) to this one (as dark as it gets). */
    private dark?: [number, number],
  ) {
    if (dark) this.darkImg = scene.add.image(0, 0, 'sea-dark').setDepth(DEPTH.fx + 2).setVisible(false);
    // the sky over the water (a row of the same picture across the level), a plain colour above it
    for (let x = -512; x < widthPx + 1024; x += 1024) this.sky.push(scene.add.image(x, surfaceY + 6, 'sea-sky').setOrigin(0, 1).setDisplaySize(1024, 160).setDepth(DEPTH.near + 4));
    this.skyTop = scene.add.rectangle(-600, surfaceY - 160 * 1 + 8, widthPx + 1800, 2000, 0x5fc0f6).setOrigin(0, 1).setDepth(DEPTH.near + 4);
    // light beams
    for (let i = 0; i < 5; i++) {
      const img = scene.add.image(0, surfaceY, 'sea-ray').setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.near + 3);
      this.rays.push({ img, x: i / 5 + Math.random() * 0.1, ph: Math.random() * 6, a: 0.16 + Math.random() * 0.12 });
    }
    // a few jellyfish far off
    for (let i = 0; i < 3; i++) this.addJelly(Math.random(), 0.2 + Math.random() * 0.6);
    this.bubbleE = scene.add
      .particles(0, 0, 'sea-bubble', {
        emitting: false,
        speedX: { min: -30, max: 30 },
        speedY: { min: -120, max: -50 },
        lifespan: { min: 700, max: 1300 },
        scale: { start: 0.35, end: 0.7 },
        alpha: { start: 0.95, end: 0 },
        gravityY: -60,
      })
      .setDepth(DEPTH.fx);
    this.splashE = scene.add
      .particles(0, 0, 'puff', {
        emitting: false,
        speedX: { min: -140, max: 140 },
        speedY: { min: -360, max: -150 },
        lifespan: { min: 420, max: 700 },
        scale: { start: 0.42, end: 0.1 },
        alpha: { start: 1, end: 0 },
        tint: [0xffffff, 0xd8f6ff, 0xaee8ff],
        gravityY: 1100,
      })
      .setDepth(DEPTH.players + 2);
    this.columnE = scene.add
      .particles(0, 0, 'puff', {
        emitting: false,
        speedX: { min: -30, max: 30 },
        speedY: { min: -520, max: -300 },
        lifespan: { min: 500, max: 800 },
        scale: { start: 0.55, end: 0.15 },
        alpha: { start: 1, end: 0 },
        tint: [0xffffff, 0xe6faff],
        gravityY: 1100,
      })
      .setDepth(DEPTH.players + 2);
  }

  private addJelly(x: number, y: number) {
    const img = this.scene.add.image(0, 0, 'sea-jelly', 'j0').setDepth(DEPTH.hills + 2).setAlpha(0.75).setTint([0xffd6ec, 0xe6dcff, 0xffffff][this.drifters.length % 3]);
    const k = 0.3 + Math.random() * 0.2;
    img.setScale(0.5 * k + 0.25);
    this.drifters.push({ img, x, y, vx: (Math.random() - 0.5) * 6, vy: -8, ph: Math.random() * 6, k, kind: 'jelly' });
  }

  /** A splash where something goes into the water at x (a dive). */
  splash(x: number, n = 18) {
    this.splashE.explode(n, x, this.surfaceY + 2);
    // (and a tall column of spray straight up)
    this.columnE.explode(14, x, this.surfaceY);
    this.bubbles(x, this.surfaceY + 24, 10);
    // a ring of ripples spreading on the surface
    const g = this.scene.add.graphics().setDepth(DEPTH.players + 1);
    const st = { r: 6, a: 0.9 };
    this.scene.tweens.add({
      targets: st,
      r: 70,
      a: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        g.clear();
        g.lineStyle(2.5, 0xffffff, st.a).strokeEllipse(x, this.surfaceY + 2, st.r * 2, st.r * 0.4);
      },
      onComplete: () => g.destroy(),
    });
  }

  /** A burst of bubbles at (x, y). */
  bubbles(x: number, y: number, n = 8) {
    this.bubbleE.explode(n, x, Math.max(y, this.surfaceY + 8));
  }

  update(view: View, dt: number, focus: { x: number; y: number } | null = null) {
    this.t += dt;
    const t = this.t;
    // ── down a trench: darker the deeper you go, a pool of light round you ──
    if (this.dark && this.darkImg) {
      const fx = focus?.x ?? view.left + view.width / 2;
      const fy = focus?.y ?? view.top + view.height / 2;
      const [d0, d1] = this.dark;
      const k = Phaser.Math.Clamp((fy - d0) / (d1 - d0), 0, 1);
      this.darkK = k * k * (3 - 2 * k);
      const size = Math.max(view.width, view.height) * 2.3;
      this.darkImg.setVisible(this.darkK > 0.01).setPosition(fx, fy).setDisplaySize(size, size).setAlpha(this.darkK * 0.96);
    }
    // ── the surface: a row of the waterline, rocking gently ──
    const sw = 512;
    const drift = t * 14 + Math.sin(t * 0.8) * 10;
    const x0 = view.left - (((view.left * 1 + drift) % sw) + sw) % sw - 2;
    const n = Math.ceil((view.width + sw + 8) / sw) + 1;
    while (this.surface.length < n) this.surface.push(this.scene.add.image(0, 0, 'sea-surface').setOrigin(0, 0).setScale(1 / 2).setDepth(DEPTH.players + 1));
    const showTop = view.top < this.surfaceY + 30;
    this.surface.forEach((img, i) => img.setVisible(showTop && i < n).setPosition(x0 + i * sw - i * 0.3, this.surfaceY - SURFACE_LINE + Math.sin(t * 1.3) * 1.2));
    for (const s of this.sky) s.setVisible(showTop);
    this.skyTop.setVisible(showTop);
    // ── light beams from the surface, slowly breathing ──
    for (const r of this.rays) {
      const x = view.left + ((r.x * view.width * 1.4 - view.left * 0.15 + t * 3) % (view.width * 1.4)) - view.width * 0.2;
      const len = view.top + view.height - this.surfaceY;
      r.img
        .setPosition(x, this.surfaceY)
        .setScale(3.2 + Math.sin(t * 0.3 + r.ph) * 0.6, Math.max(64, len) / 128)
        .setRotation(0.22 + Math.sin(t * 0.2 + r.ph) * 0.04)
        .setAlpha(r.a * (0.6 + 0.4 * Math.sin(t * 0.7 + r.ph)) * (1 - this.darkK));
    }
    // ── jellyfish, schools of fish, the odd turtle ──
    this.nextSchool -= dt;
    if (this.nextSchool <= 0) {
      this.nextSchool = 6 + Math.random() * 7;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const y = 0.25 + Math.random() * 0.4;
      const tint = [0xffd27a, 0xbfe8ff, 0xffb0c8, 0xd8ffd0][Math.floor(Math.random() * 4)];
      const k = 0.15 + Math.random() * 0.2;
      const count = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        const img = this.scene.add.image(0, 0, 'sea-school', 's0').setDepth(DEPTH.far + 2).setTint(tint).setAlpha(0.55).setScale(0.45 + k).setFlipX(dir < 0);
        const fx = dir > 0 ? -0.1 - (i % 4) * 0.025 : 1.1 + (i % 4) * 0.025;
        this.drifters.push({ img, x: view.left * k + fx * view.width, y: y + Math.floor(i / 4) * 0.03 + (i % 2) * 0.02, vx: dir * (40 + k * 30), vy: 0, ph: Math.random() * 6, k, kind: 'fish' });
      }
    }
    this.nextTurtle -= dt;
    if (this.nextTurtle <= 0 && this.octoNext) {
      // (an octopus, far off: drifting along, pulsing, its arms trailing)
      this.octoNext = false;
      this.nextTurtle = 22 + Math.random() * 16;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const img = this.scene.add.image(0, 0, 'sea-octo', 'o0').setDepth(DEPTH.far + 3).setAlpha(0.5).setTint(0xb8d0f0).setScale(0.42).setFlipX(dir < 0);
      const k = 0.18;
      this.drifters.push({ img, x: view.left * k + (dir > 0 ? -0.1 : 1.1) * view.width, y: 0.2 + Math.random() * 0.3, vx: dir * 14, vy: 0, ph: 0, k, kind: 'octo' });
    } else if (this.nextTurtle <= 0) {
      this.octoNext = true;
      this.nextTurtle = 22 + Math.random() * 16;
      const dir = Math.random() < 0.5 ? 1 : -1;
      // (far off behind the reef: small, hazy with the water between, drifting slowly by)
      const img = this.scene.add.image(0, 0, 'sea-turtle', 't0').setDepth(DEPTH.far + 3).setAlpha(0.5).setTint(0xa8d4ee).setScale(0.3).setFlipX(dir < 0);
      const k = 0.2;
      this.drifters.push({ img, x: view.left * k + (dir > 0 ? -0.1 : 1.1) * view.width, y: 0.25 + Math.random() * 0.2, vx: dir * 18, vy: 0, ph: 0, k, kind: 'turtle' });
    }
    this.drifters = this.drifters.filter((d) => {
      d.ph += dt;
      if (d.kind === 'jelly') {
        // (a squeeze and a little push up, then drifting slowly down again)
        const beat = (d.ph * 0.9) % 1;
        d.y += (beat < 0.25 ? -0.06 : 0.012) * dt;
        d.x += d.vx * dt * 0.002;
        if (d.y < 0.05) d.y = 0.95;
        if (d.y > 1) d.y = 0.1;
        d.img.setFrame(beat < 0.08 ? 'j1' : beat < 0.2 ? 'j2' : beat < 0.3 ? 'j3' : 'j0');
      } else {
        // (in the distance: they swim at their own pace, and the view slides past them slowly)
        d.x += d.vx * dt;
        if (d.kind === 'fish') d.img.setFrame(Math.floor(d.ph * 8) % 2 ? 's0' : 's1');
        else if (d.kind === 'octo') {
          // (each squeeze of its mantle pushes it up a little; it sinks back between)
          d.img.setFrame(`o${Math.floor(d.ph * 2.2) % 4}`);
          d.y += (Math.floor(d.ph * 2.2) % 4 === 1 ? -0.02 : 0.006) * dt;
        } else d.img.setFrame(Math.floor(d.ph * 1.6) % 2 ? 't0' : 't1');
      }
      // (on screen, sliding by a little with the camera)
      const px = view.left + (((d.x * view.width - view.left * d.k * 0.1) % (view.width * 1.6)) + view.width * 1.6) % (view.width * 1.6) - view.width * 0.3;
      const sx = d.kind === 'jelly' ? px : view.left + (d.x - view.left * d.k);
      d.img.setPosition(sx, Math.max(this.surfaceY + 40, view.top + d.y * view.height) + Math.sin(d.ph * 1.3) * 4);
      const off = sx - view.left;
      const gone = d.kind !== 'jelly' && ((d.vx > 0 && off > view.width + 200) || (d.vx < 0 && off < -200) || off < -view.width || off > view.width * 2);
      if (gone) d.img.destroy();
      return !gone;
    });
    // ── crabs on the sand near you ──
    if (this.crabs.length < 2 && Math.random() < dt * 0.4) {
      const x = view.left + view.width * (Math.random() < 0.5 ? 0.05 : 0.95);
      const gy = this.groundBelow(x, view.top + 20, view.height + 200);
      if (gy !== null) {
        const img = this.scene.add.image(x, gy + 2, 'sea-crab', 'c0').setOrigin(0.5, 1).setScale(0.3).setDepth(DEPTH.decor + 1).setAlpha(0);
        this.crabs.push({ img, x, vx: (x < view.left + view.width / 2 ? 1 : -1) * (28 + Math.random() * 20), t: 0, pause: 0 });
      }
    }
    this.crabs = this.crabs.filter((c) => {
      c.t += dt;
      if (c.pause > 0) c.pause -= dt;
      else {
        c.x += c.vx * dt;
        if (Math.random() < dt * 0.5) c.pause = 0.4 + Math.random() * 0.8;
      }
      const gy = this.groundBelow(c.x, c.img.y - 40, 120);
      if (gy !== null) c.img.y += (gy + 2 - c.img.y) * Math.min(1, dt * 10);
      c.img.setX(c.x).setFrame(c.pause > 0 ? 'c0' : Math.floor(c.t * 10) % 2 ? 'c0' : 'c1').setAlpha(Math.min(1, c.t * 2));
      const gone = c.x < view.left - 80 || c.x > view.left + view.width + 80 || gy === null || c.x < 0 || c.x > this.widthPx;
      if (gone) c.img.destroy();
      return !gone;
    });
  }
}
