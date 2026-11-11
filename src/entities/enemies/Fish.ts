import Phaser from 'phaser';
import { DEPTH } from '../../config';
import { sfx } from '../../core/sfx';
import { ART_RES } from '../../gfx/draw';
import { BUBBLE_SIZE, FISH_SCALE, FISH_SIZE, blinkFor } from '../../gfx/fish';
import type { GameScene } from '../../scenes/GameScene';
import { Enemy, type DeathKind } from './Enemy';

const SHOT_LIFE = 4.5;

export type FishBaddie = 'fish' | 'bigfish' | 'kai';
/**
 * Each kind: its art, hits to pop, swimming speed, how far off it notices you (across, up and down),
 * how often it fires (s), its bubbles' speed and size, how close it likes to stay to you (min, max).
 */
const STATS: Record<FishBaddie, { art: 'badguy' | 'badguybig' | 'kai'; hp: number; speed: number; see: [number, number]; every: [number, number]; shot: number; size: number[]; keep: [number, number] }> = {
  fish: { art: 'badguy', hp: 1, speed: 55, see: [360, 230], every: [2.4, 3.6], shot: 135, size: [1.4], keep: [120, 260] },
  bigfish: { art: 'badguybig', hp: 3, speed: 42, see: [360, 230], every: [1.9, 2.8], shot: 135, size: [1.7, 1.7, 1.7], keep: [120, 260] },
  // Kai: rare and quick — he comes right at you and fires often; two hits, and he gets away
  kai: { art: 'kai', hp: 2, speed: 110, see: [460, 280], every: [1.2, 1.9], shot: 185, size: [1.45], keep: [70, 170] },
};

/**
 * The bad guy fish (World 3, under the sea): little orange ones, and bigger red ones that take three
 * hits. They swim to and fro about their spot, bobbing; once they see you they drift up or down to
 * your height and every few seconds turn their TAIL to you — a wind-up, a flick — and a bubble comes
 * floating at you (the big ones fire a little spread of three). Touching one hurts too (you can't jump
 * on a fish); a rocket pops it.
 */
export class BadFish extends Enemy {
  readonly kind: FishBaddie;
  private art: 'badguy' | 'badguybig' | 'kai';
  private stats: (typeof STATS)[FishBaddie];
  private homeX: number;
  private homeY = 0;
  private dir: 1 | -1;
  private fireT: number;
  /** Firing: time into the shot (−1 = not firing). */
  private shotT = -1;
  private fired = false;
  private swimT = Math.random() * 6;
  /** Till the next blink, and how long the eyes stay shut (s). */
  private blinkIn = 1 + Math.random() * 3;
  private blinkFor = 0;

  constructor(gs: GameScene, x: number, y: number, kind: FishBaddie = 'fish') {
    const st = STATS[kind];
    const art = st.art;
    super(gs, x, y, `fish-${art}`, 'sw0');
    this.kind = kind;
    this.stats = st;
    this.art = art;
    this.stompable = false;
    this.hp = st.hp;
    const { w, h } = FISH_SIZE[art];
    this.setScale(FISH_SCALE[art] / ART_RES);
    this.body.setSize(w * ART_RES * 0.62, h * ART_RES * 0.6, true);
    this.body.setAllowGravity(false);
    this.homeX = x;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.fireT = 1 + Math.random() * 1.5;
    this.setDepth(DEPTH.enemies);
  }

  wake() {
    super.wake();
    this.homeY = this.y;
  }

  /** Facing: the art faces right; flipped it faces left. */
  private face(d: 1 | -1) {
    this.dir = d;
    this.setFlipX(d < 0);
  }

  tick(dt: number) {
    const b = this.body;
    const st = this.stats;
    const p = this.gs.players.find((pl) => pl.alive);
    const dx = p ? p.x - this.x : 1e9;
    const dy = p ? p.y - this.y : 0;
    const sees = !!p && Math.abs(dx) < st.see[0] && Math.abs(dy) < st.see[1] && p.swimming;
    this.swimT += dt;
    // (the first Kai you see: "Kai Fish! Those are rare")
    if (this.kind === 'kai' && sees) this.gs.spottedKai();

    // ── firing: tail to you, wind up, flick, settle ──
    if (this.shotT >= 0) {
      this.shotT += dt;
      b.setVelocity(b.velocity.x * Math.exp(-dt * 6), b.velocity.y * Math.exp(-dt * 6));
      const t = this.shotT;
      this.setFrame(t < 0.42 ? 'fire0' : t < 0.6 ? 'fire1' : t < 0.85 ? 'fire2' : 'sw0');
      if (t >= 0.42 && !this.fired) {
        this.fired = true;
        this.shoot(p ? p.x : this.x - this.dir * 100, p ? p.y : this.y);
      }
      if (t >= 0.85) {
        this.shotT = -1;
        const [a, z] = st.every;
        this.fireT = a + Math.random() * (z - a);
      }
      return;
    }

    // ── swimming about ──
    const speed = st.speed;
    const range = this.kind === 'bigfish' ? 70 : 100;
    if (sees) {
      // (keeps near you, at your height, a little way off)
      this.fireT -= dt;
      const reach = this.kind === 'kai' ? 260 : 140;
      const vmax = this.kind === 'kai' ? 95 : 45;
      const want = Phaser.Math.Clamp(p!.y, this.homeY - reach, this.homeY + reach);
      b.setVelocityY(Phaser.Math.Clamp((want - this.y) * 1.4, -vmax, vmax) + Math.sin(this.swimT * 2) * 10);
      const away = Math.abs(dx) < st.keep[0] ? -Math.sign(dx) : Math.abs(dx) > st.keep[1] ? Math.sign(dx) : 0;
      if (away) this.face(away as 1 | -1);
      b.setVelocityX(away ? away * speed : b.velocity.x * Math.exp(-dt * 2));
      if (!away && Math.abs(b.velocity.x) < 10) this.face((dx < 0 ? 1 : -1) as 1 | -1); // (its back to you)
      if (this.fireT <= 0) {
        // turn tail to you and fire
        this.face((dx < 0 ? 1 : -1) as 1 | -1);
        this.shotT = 0;
        this.fired = false;
        return;
      }
    } else {
      if (this.x > this.homeX + range) this.face(-1);
      else if (this.x < this.homeX - range) this.face(1);
      b.setVelocityX(this.dir * speed);
      b.setVelocityY((this.homeY - this.y) * 0.8 + Math.sin(this.swimT * 1.8) * 14);
    }
    // (turn round at rock, and never out of the water)
    const ahead = this.x + this.dir * (this.displayWidth * 0.5 + 6);
    if (this.gs.level.isSolidAt(ahead, this.y)) {
      this.face((-this.dir) as 1 | -1);
      b.setVelocityX(this.dir * speed);
    }
    const water = this.gs.level.data.water ?? -1e9;
    if (this.y < water + this.displayHeight * 0.6 && b.velocity.y < 0) b.setVelocityY(20);
    if (this.gs.level.isSolidAt(this.x, this.y + this.displayHeight * 0.5 + 4) && b.velocity.y > 0) b.setVelocityY(-20);
    if (this.gs.level.isSolidAt(this.x, this.y - this.displayHeight * 0.5 - 4) && b.velocity.y < 0) b.setVelocityY(20);
    // tail sweep: quicker when it's going places
    const rate = 9 + Math.abs(b.velocity.x) / 8;
    const fi = Math.floor(this.swimT * rate) % 6;
    // (a blink now and then: now and again a double one)
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkFor = 0.13;
      this.blinkIn = Math.random() < 0.2 ? 0.3 : 1.6 + Math.random() * 3.2;
    }
    this.blinkFor -= dt;
    this.setFrame(this.blinkFor > 0 ? blinkFor(fi) : `sw${fi}`);
    this.setRotation(Phaser.Math.Clamp(b.velocity.y / 300, -0.25, 0.25) * this.dir);
  }

  /** A bubble (the big ones: three) flicked from the tail at (tx, ty). */
  private shoot(tx: number, ty: number) {
    const { w } = FISH_SIZE[this.art];
    const k = FISH_SCALE[this.art];
    // (the tail's at the back: opposite the way it faces)
    const sx = this.x - this.dir * (w * 0.5 - 6) * k;
    const sy = this.y + 2 * k;
    const a = Math.atan2(ty - sy, tx - sx);
    const sizes = this.stats.size;
    const spread = sizes.length === 3 ? [-0.28, 0, 0.28] : [0];
    const v = this.stats.shot;
    spread.forEach((da, i) => new FishBubble(this.gs, sx, sy, Math.cos(a + da) * v, Math.sin(a + da) * v, sizes[i]));
    sfx.bloop();
    this.gs.amb.sea?.bubbles(sx, sy, 4);
  }

  /**
   * Kai, beaten: he doesn't pop — he turns and shoots off up the level, faster than you can follow,
   * in a stream of bubbles (you'll meet him again further on).
   */
  private flee() {
    this.dead = true;
    this.body.enable = false;
    sfx.whoosh();
    this.gs.fx.popText(this.x, this.y - 30, 'ZOOM!', '#7cf0ff', 16);
    this.setFlipX(false).setRotation(-0.1);
    let t = 0;
    const trail = this.gs.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        if (!this.scene) return trail.remove();
        this.setFrame(`sw${t++ % 6}`);
        this.gs.amb.sea?.bubbles(this.x - 30, this.y, 1);
      },
    });
    this.gs.tweens.add({
      targets: this,
      x: this.x + 1500,
      y: this.y - 60,
      alpha: { from: 1, to: 0, ease: 'Quad.easeIn' } as unknown as number,
      duration: 1300,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        trail.remove();
        this.destroy();
      },
    });
  }

  /** Popped: a burst of bubbles, then it floats belly-up off towards the surface, fading. (Kai: he's off.) */
  kill(how: DeathKind) {
    if (this.dead) return;
    if (how === 'fall') return super.kill(how);
    if (this.kind === 'kai') return this.flee();
    this.dead = true;
    this.body.enable = false;
    this.clearTint();
    sfx.pop();
    this.gs.amb.sea?.bubbles(this.x, this.y, 14);
    this.gs.fx.stars(this.x, this.y, 4);
    this.setFlipY(true).setFrame('sw0').setDepth(DEPTH.fx - 1);
    this.gs.tweens.add({ targets: this, angle: this.dir * 20, duration: 300, ease: 'Sine.easeOut' });
    this.gs.tweens.add({
      targets: this,
      y: this.y - 160,
      alpha: 0,
      delay: 150,
      duration: 1500,
      ease: 'Sine.easeIn',
      onComplete: () => this.destroy(),
    });
  }
}

/**
 * A bad guy fish's shot: a wobbly bubble drifting at you in a straight line. It hurts if it reaches
 * you; it pops on rock, after a few seconds, or when a rocket hits it.
 */
export class FishBubble {
  private img: Phaser.GameObjects.Image;
  private life = SHOT_LIFE;
  private readonly onUpdate: (time: number, delta: number) => void;

  constructor(
    private gs: GameScene,
    x: number,
    y: number,
    private vx: number,
    private vy: number,
    private size: number,
  ) {
    this.img = gs.add.image(x, y, 'fish-bubble', 'b0').setScale((size * 0.3) / ART_RES).setDepth(DEPTH.projectiles);
    this.onUpdate = (_t, delta) => this.step(Math.min(delta / 1000, 0.05));
    gs.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    gs.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.gone());
    // (blown out of the tail: it swells to full size)
    gs.tweens.add({ targets: this.img, scale: size / ART_RES, duration: 220, ease: 'Back.easeOut' });
  }

  private step(dt: number) {
    const img = this.img;
    if (!img.scene) return this.gone();
    if (this.gs.cutsceneOn) return;
    this.life -= dt;
    img.x += this.vx * dt;
    img.y += this.vy * dt + Math.sin(this.life * 6) * 12 * dt;
    img.setFrame(Math.floor(this.life * 5) % 2 ? 'b0' : 'b1');
    const r = (BUBBLE_SIZE / 2) * this.size * 0.8;
    // hit a hero?
    for (const p of this.gs.players) {
      if (!p.alive) continue;
      const pb = p.body;
      if (img.x + r < pb.left || img.x - r > pb.right || img.y + r < pb.top || img.y - r > pb.bottom) continue;
      this.gs.hitPlayer(p, img.x - Math.sign(this.vx) * 20);
      return this.pop();
    }
    // a rocket?
    for (const rk of this.gs.liveRockets) if (Math.abs(rk.x - img.x) < r + 10 && Math.abs(rk.y - img.y) < r + 6) {
      rk.explode();
      return this.pop();
    }
    const water = this.gs.level.data.water ?? -1e9;
    if (this.gs.level.isSolidAt(img.x, img.y) || this.life <= 0 || img.y < water + 4) this.pop();
  }

  private pop() {
    const { x, y } = this.img;
    this.gs.amb.sea?.bubbles(x, y, 5);
    sfx.bloop();
    const ring = this.gs.add.image(x, y, 'fish-bubble', 'b0').setScale(this.img.scale).setDepth(DEPTH.projectiles).setAlpha(0.8);
    this.gs.tweens.add({ targets: ring, scale: this.img.scale * 1.6, alpha: 0, duration: 180, onComplete: () => ring.destroy() });
    this.gone();
  }

  private gone() {
    this.gs.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    if (this.img.scene) this.img.destroy();
  }
}
