import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { sfx } from '../core/sfx';
import { FISH_SCALE, FISH_SIZE, type FishKind } from '../gfx/fish';
import { COLUMN, STREAKS, TARGET } from '../gfx/chase';
import { PACK_KINDS } from '../gfx/textures';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/enemies/Enemy';
import type { Rocket } from '../entities/Rocket';
import type { Fx } from './Fx';
import type { SeaLife } from './Sea';

/** What the chase needs from the game scene. */
export interface ChaseHost extends Phaser.Scene {
  players: Player[];
  fx: Fx;
  readonly liveRockets: Rocket[];
  readonly badGuys: Enemy[];
  readonly viewRect: { left: number; top: number; width: number; height: number };
  readonly sea: SeaLife | null | undefined;
  hitPlayer(p: Player, fromX: number): void;
  shakeFrom(x: number, y: number, ms: number, intensity: number): void;
  sayAt(where: () => [number, number], text: string, ms?: number): void;
  groundUnder(x: number, fromY: number): number | null;
  isSolidAt(x: number, y: number): boolean;
  /** Where the camera should look instead of the hero (the opening's look back at the gang), or null. */
  camLook: { x: number; y: number } | null;
}

/** How far behind each other the gang swim, along your trail (px). */
const GAP = 74;
/** Never further behind you than this along your trail (they catch up, just off the edge of the screen). */
const MAX_LEAD = 600;
/** Close enough for the lead fish to lunge. */
const LUNGE_AT = 170;
/** How long each fish leads before the next one takes over (s). */
const LEAD_SECS: [number, number] = [6.5, 9];
/** How big the gang are here (a bit under their size in the drawings' scale: they're four, and the screen's small). */
const PACK_K = 0.82;
/** The Fat Fish as it falls (× its drawings' scale). */
const FAT_K = 0.8;
/** The warning sign's size on screen (its picture's drawn at 3×: half its units' size again). */
const SIGN_SCALE = 1.5 / 3;
/** The warning before the Fat Fish comes down (s). */
const WARN_SECS = 3.2;

const NAMES: Record<string, string> = { stone: 'Stone', slinger: 'Slinger', kai: 'Kai', zippy: 'Zippy' };

interface PackFish {
  kind: (typeof PACK_KINDS)[number];
  img: Phaser.GameObjects.Sprite;
  wake: Phaser.GameObjects.Image;
  /** Its place along the trail behind the leader (px, eased towards its slot's). */
  back: number;
  /** A little up-and-down of its own, so they don't swim in a line. */
  lane: number;
  ph: number;
  /** Bonked by a rocket: dazed for a moment, drops back. */
  stun: number;
  x: number;
  y: number;
  /** Half its size for touching (px). */
  rx: number;
  ry: number;
}

interface Fall {
  x: number;
  /** 'warn' (the sign's up), 'drop' (falling), 'sink' (down through the water), 'daze' (on the sea bed), 'off' (swimming away). */
  phase: 'warn' | 'drop' | 'sink' | 'daze' | 'off';
  t: number;
  sign: Phaser.GameObjects.Image;
  target: Phaser.GameObjects.Image;
  col: Phaser.GameObjects.TileSprite;
  fish?: Phaser.GameObjects.Sprite;
  streaks?: Phaser.GameObjects.Image;
  y: number;
  vy: number;
  bed: number;
  hitDone: boolean;
}

/**
 * Part 6: King Bob's gang chase you the whole way. They swim along your own trail (round the rocks
 * the way you went), four in a line, taking turns in the lead (every few seconds the leader drops to
 * the back). They're a little slower than you at an easy swim, but they never let you get far ahead,
 * and when the leader's close it lunges: lose your nuggies and get shoved on ahead (with none, you
 * faint). A rocket bonks one for a moment. Three times, the Fat Fish falls out of the sky.
 */
export class FishChase {
  phase: 'wait' | 'intro' | 'chase' | 'done' = 'wait';
  private fish: PackFish[] = [];
  /** Your trail through the water: points every few px, with the distance along it. */
  private trail: { x: number; y: number; s: number }[] = [];
  /** The leader's place along your trail. */
  private sPack = 0;
  private v = 0;
  private lunge = 0;
  private lungeCool = 0;
  private swapIn = 8;
  private drops: { x: number; done: boolean }[];
  private fall: Fall | null = null;
  private warned = false;
  private arrow: Phaser.GameObjects.Container;
  private rumbleT = 0;

  constructor(
    private gs: ChaseHost,
    private home: { x: number; y: number },
    drops: number[],
    private opts: { retry: boolean; startX: number },
  ) {
    this.drops = drops.sort((a, b) => a - b).map((x) => ({ x, done: x * TILE < opts.startX + 4 * TILE }));
    PACK_KINDS.forEach((kind, i) => {
      const { w, h } = FISH_SIZE[kind as FishKind];
      const k = FISH_SCALE[kind as FishKind] * PACK_K;
      const img = gs.add.sprite(home.x - i * GAP, home.y, `fish6-${kind}`, 'an0').setDepth(DEPTH.enemies + 1).setVisible(false);
      // (the sheet's drawn at its own resolution: scale it to the size we want)
      const frameW = img.frame.width;
      img.setScale((w * k) / frameW);
      const wake = gs.add.image(0, 0, 'chase-wake').setOrigin(1, 0.5).setDepth(DEPTH.enemies + 0.9).setAlpha(0).setScale((w * k * 0.9) / 180);
      this.fish.push({ kind, img, wake, back: i * GAP, lane: [0, -26, 22, -10][i], ph: i * 1.7, stun: 0, x: img.x, y: img.y, rx: w * k * 0.36, ry: h * k * 0.32 });
    });
    // the "they're right behind you" arrow, at the left edge of the screen when the leader's off it
    const g = gs.add.graphics();
    g.fillStyle(0x3a2418, 1).fillCircle(0, 0, 15).fillTriangle(-24, 0, -10, -11, -10, 11);
    g.fillStyle(0xe8463f, 1).fillCircle(0, 0, 12.5).fillTriangle(-20, 0, -9, -8.5, -9, 8.5);
    const ex = gs.add.text(0, 0, '!', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5, 0.52);
    this.arrow = gs.add.container(0, 0, [g, ex]).setDepth(DEPTH.text + 1).setVisible(false);
    // (coming back to a checkpoint: no opening; they turn up behind you after a moment)
    if (opts.retry) gs.time.delayedCall(900, () => this.heroSplashed());
  }

  private get hero() {
    return this.gs.players.find((p) => p.alive) ?? null;
  }

  /** The hero's in the water (the dive's splash, or back at a checkpoint): the gang turns up. */
  heroSplashed() {
    if (this.phase !== 'wait') return;
    const p = this.hero;
    if (!p) return;
    if (!p.swimming) {
      // (not in yet: try again in a moment)
      this.gs.time.delayedCall(300, () => this.heroSplashed());
      return;
    }
    if (this.opts.retry) this.comeAgain(p);
    else this.opening(p);
  }

  /**
   * The opening: a rumble from behind; the camera swings back to the gang, who swim up out of the
   * gloom — "Let's get him!" — then back to you, just ahead, and the chase is on.
   */
  private opening(p: Player) {
    this.phase = 'intro';
    const gs = this.gs;
    gs.time.delayedCall(700, () => {
      p.held = true;
      sfx.roar();
      gs.cameras.main.shake(900, 0.006);
      this.rumbleT = 1.2;
      p.squash = { x: 0.8, y: 1.25 };
      gs.fx.popText(p.x, p.body.top - 14, '?', '#ffffff', 22);
    });
    gs.time.delayedCall(1500, () => {
      // the gang swim in from out of sight behind
      const { x, y } = this.home;
      this.fish.forEach((f, i) => {
        f.img.setVisible(true).setAlpha(0).setFlipX(false);
        const tx = x - i * GAP * 0.8;
        const ty = y + f.lane;
        f.x = tx - 320;
        f.y = ty;
        gs.tweens.add({ targets: f, x: tx, duration: 1300, ease: 'Sine.easeOut', delay: i * 90 });
        gs.tweens.add({ targets: f.img, alpha: 1, duration: 500, delay: i * 90 });
      });
      gs.camLook = { x: x - GAP, y };
    });
    gs.time.delayedCall(3100, () => {
      const lead = this.fish[0];
      sfx.chomp();
      gs.sayAt(() => [lead.x + 20, lead.y - lead.ry * 1.6], "Let's get him!", 1500);
      // (all of them nose forward, ready)
      for (const f of this.fish) gs.tweens.add({ targets: f, x: f.x + 26, yoyo: true, duration: 260, ease: 'Sine.easeOut' });
    });
    gs.time.delayedCall(5000, () => {
      // back to the hero, just ahead
      gs.camLook = null;
      p.held = false;
    });
    gs.time.delayedCall(5600, () => {
      this.begin(p, this.fish[0].x, this.fish[0].y);
      gs.fx.popText(p.x, p.body.top - 26, 'SWIM!', '#ffd23f', 28);
    });
  }

  /** Back at a checkpoint: a rumble, and they come again from behind (off the screen). */
  private comeAgain(p: Player) {
    sfx.roar();
    this.gs.cameras.main.shake(500, 0.004);
    this.gs.sayAt(() => [p.x, p.body.top], 'Here they come!', 1600);
    const back = Math.min(p.x - 120, p.x - this.gs.viewRect.width * 0.6);
    for (const f of this.fish) f.img.setVisible(true).setAlpha(1);
    this.begin(p, back, p.y);
  }

  /** The chase starts: your trail from where the leader is to you. */
  private begin(p: Player, fromX: number, fromY: number) {
    this.trail = [];
    const n = Math.max(2, Math.ceil(Math.hypot(p.x - fromX, p.y - fromY) / 8));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = fromX + (p.x - fromX) * t;
      const y = fromY + (p.y - fromY) * t;
      const last = this.trail[this.trail.length - 1];
      this.trail.push({ x, y, s: last ? last.s + Math.hypot(x - last.x, y - last.y) : 0 });
    }
    this.sPack = 0;
    this.v = this.baseSpeed(p);
    this.swapIn = LEAD_SECS[0] + Math.random() * (LEAD_SECS[1] - LEAD_SECS[0]);
    this.phase = 'chase';
  }

  /** The gang's own pace: a little under yours at an easy swim. */
  private baseSpeed(p: Player) {
    return p.char.walkSpeed * 0.95 * 0.9;
  }

  /** Where along your trail distance s is (before its start: on back the way the trail began). */
  private at(s: number): { x: number; y: number; dx: number; dy: number } {
    const tr = this.trail;
    if (s <= 0 || tr.length < 2) {
      const a = tr[0];
      const b = tr[Math.min(1, tr.length - 1)];
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: a.x + ((b.x - a.x) / d) * s, y: a.y + ((b.y - a.y) / d) * s, dx: (b.x - a.x) / d, dy: (b.y - a.y) / d };
    }
    let lo = 0;
    let hi = tr.length - 1;
    if (s >= tr[hi].s) {
      const a = tr[hi - 1];
      const b = tr[hi];
      const d = b.s - a.s || 1;
      return { x: b.x, y: b.y, dx: (b.x - a.x) / d, dy: (b.y - a.y) / d };
    }
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (tr[m].s <= s) lo = m;
      else hi = m;
    }
    const a = tr[lo];
    const b = tr[hi];
    const d = b.s - a.s || 1;
    const t = (s - a.s) / d;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: (b.x - a.x) / d, dy: (b.y - a.y) / d };
  }

  /** You reached the gate: they give up and turn back. */
  giveUp() {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.arrow.setVisible(false);
    const lead = this.fish[0];
    if (lead.img.visible) this.gs.sayAt(() => [lead.x, lead.y - lead.ry * 1.6], 'Grr… next time!', 1800);
    for (const f of this.fish) {
      f.img.setFlipX(true);
      this.gs.tweens.add({ targets: f, x: f.x - 700, duration: 2600, delay: 600, ease: 'Sine.easeIn' });
      this.gs.tweens.add({ targets: [f.img, f.wake], alpha: 0, duration: 900, delay: 2200 });
    }
  }

  update(dt: number) {
    const p = this.hero;
    // (held still for the look back at the gang: hanging in the water, not sinking to the bottom)
    if (p?.held && p.swimming) {
      // (a few tiles under the surface, treading water)
      const want = this.waterY() + 150 - p.y;
      p.body.setVelocity(p.body.velocity.x * Math.exp(-dt * 4), Phaser.Math.Clamp(want * 2.2, -160, 160) + Math.sin(this.gs.time.now / 300) * 12);
    }
    if (this.rumbleT > 0) {
      this.rumbleT -= dt;
      if (Math.random() < 0.3) this.gs.sea?.bubbles(this.home.x + (Math.random() - 0.5) * 300, this.home.y + 60, 1);
    }
    if (this.phase === 'chase' && p) this.chase(dt, p);
    this.place(dt);
    this.updateDrops(dt, p);
  }

  private chase(dt: number, p: Player) {
    // your trail: a point every few px
    const last = this.trail[this.trail.length - 1];
    const d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d > 6) this.trail.push({ x: p.x, y: p.y, s: last.s + d });
    if (this.trail.length > 4000) this.trail.splice(0, 1000);
    const sHero = this.trail[this.trail.length - 1].s;
    // their pace: their own, a surge if you've got well ahead, a lunge when the leader's close
    const base = this.baseSpeed(p);
    const lead = sHero - this.sPack;
    this.lungeCool = Math.max(0, this.lungeCool - dt);
    const leader = this.fish[0];
    if (this.lunge > 0) this.lunge -= dt;
    else if (lead < LUNGE_AT && this.lungeCool <= 0 && leader.stun <= 0 && p.alive && !p.invulnerable) {
      this.lunge = 0.55;
      this.lungeCool = 1.6;
      sfx.chomp();
    }
    const want = this.lunge > 0 ? base * 2.6 : lead > 380 ? base * 1.45 : base;
    this.v += (want - this.v) * (1 - Math.exp(-dt * (this.lunge > 0 ? 9 : 2.5)));
    this.sPack = Math.min(sHero - 4, this.sPack + this.v * dt);
    if (lead > MAX_LEAD) this.sPack = sHero - MAX_LEAD;
    // taking turns: the leader drops to the back, the others move up
    this.swapIn -= dt;
    if (this.swapIn <= 0 && this.lunge <= 0) {
      this.swapIn = LEAD_SECS[0] + Math.random() * (LEAD_SECS[1] - LEAD_SECS[0]);
      const old = this.fish.shift()!;
      this.fish.push(old);
      const now = this.fish[0];
      if (now.img.visible && this.onScreen(now.x, now.y)) this.gs.fx.popText(now.x, now.y - now.ry * 1.8, `${NAMES[now.kind]}!`, '#ffd23f', 15);
    }
    // touching you
    for (const f of this.fish) {
      if (!f.img.visible || f.stun > 0) continue;
      const b = p.body;
      const cx = Phaser.Math.Clamp(f.x, b.left, b.right);
      const cy = Phaser.Math.Clamp(f.y, b.top, b.bottom);
      if (((cx - f.x) / f.rx) ** 2 + ((cy - f.y) / f.ry) ** 2 > 1) continue;
      if (!p.alive || p.invulnerable) break;
      this.gs.hitPlayer(p, f.x - 40);
      if (p.alive) {
        // shoved on ahead (and up a little), and they fall back a bit
        p.body.setVelocity(Math.max(p.body.velocity.x, 0) + 380, -140);
        this.gs.fx.popText(f.x + f.rx, f.y - f.ry, 'CHOMP!', '#ffffff', 16);
        this.sPack -= 240;
        this.lunge = 0;
        this.lungeCool = 1.8;
      }
      break;
    }
    // rockets: a bonk on the head (dazed for a moment, they drop back)
    for (const r of this.gs.liveRockets) {
      if (!r.active || r.exploded) continue;
      for (const f of this.fish) {
        if (!f.img.visible || f.stun > 0) continue;
        if (((r.x - f.x) / (f.rx + 6)) ** 2 + ((r.y - f.y) / (f.ry + 6)) ** 2 > 1) continue;
        r.explode();
        f.stun = 1.1;
        this.gs.fx.popText(f.x, f.y - f.ry * 1.4, 'BONK!', '#ffffff', 15);
        this.gs.fx.stars(f.x, f.y - f.ry, 6);
        if (f === this.fish[0]) this.lunge = 0;
        break;
      }
    }
    // the arrow: the leader's off the left of the screen
    const v = this.gs.viewRect;
    const off = leader.x < v.left + 60 && leader.img.visible;
    this.arrow.setVisible(off);
    if (off) {
      this.arrow.setPosition(v.left + 86, Phaser.Math.Clamp(leader.y, v.top + 90, v.top + v.height - 140));
      this.arrow.setScale(1 + Math.sin(this.gs.time.now / 120) * 0.08);
    }
  }

  private onScreen(x: number, y: number) {
    const v = this.gs.viewRect;
    return x > v.left && x < v.left + v.width && y > v.top && y < v.top + v.height;
  }

  /** Where each of the gang is and how they look (in the chase: along your trail, each in its place). */
  private place(dt: number) {
    const t = this.gs.time.now / 1000;
    this.fish.forEach((f, i) => {
      f.stun = Math.max(0, f.stun - dt);
      f.ph += dt;
      if (this.phase === 'chase') {
        // (eased to its slot: moving up when the leader drops to the back; a dazed one drops back too)
        const want = i * GAP + (f.stun > 0 ? 150 : 0);
        f.back += (want - f.back) * (1 - Math.exp(-dt * (f.back > want ? 1.6 : 1.1)));
        const q = this.at(this.sPack - f.back);
        const bob = Math.sin(f.ph * 2.2) * 5;
        // (their own lane across the trail: never quite in a line)
        f.x = q.x - q.dy * f.lane * 0.5;
        f.y = q.y + q.dx * f.lane + bob;
        const ang = Math.atan2(q.dy, Math.abs(q.dx) + 0.001);
        f.img.setFlipX(q.dx < -0.2).setRotation(Phaser.Math.Clamp(q.dx < -0.2 ? -ang : ang, -0.55, 0.55));
      } else if (this.phase === 'intro') {
        f.y += Math.sin(t * 2 + f.ph) * 0.2;
      }
      f.img.setPosition(f.x, f.y);
      const fast = this.phase === 'chase' && i === 0 && this.lunge > 0;
      f.img.setFrame(`an${Math.floor(t * (fast ? 26 : f.stun > 0 ? 6 : 14) + i * 2) % 6}`);
      // dazed: a little wobble
      if (f.stun > 0) f.img.setRotation(Math.sin(t * 30) * 0.15);
      // the wake behind each (stronger on the leader, and in a lunge)
      const dir = f.img.flipX ? -1 : 1;
      f.wake.setPosition(f.x - dir * f.rx * 1.1, f.y).setFlipX(dir < 0).setRotation(f.img.rotation);
      const wa = !f.img.visible || this.phase === 'done' ? 0 : this.phase === 'chase' ? (i === 0 ? (fast ? 0.9 : 0.55) : 0.35) : 0.25;
      f.wake.setAlpha(f.wake.alpha + (wa - f.wake.alpha) * Math.min(1, dt * 6));
      if (this.phase === 'chase' && Math.random() < dt * 4) this.gs.sea?.bubbles(f.x - dir * f.rx, f.y, 1);
    });
  }

  // ── The Fat Fish, falling out of the sky ──

  private updateDrops(dt: number, p: Player | null) {
    const F = this.fall;
    if (!F) {
      if (!p || this.phase !== 'chase' || !p.swimming) return;
      const d = this.drops.find((q) => !q.done && p.x > q.x * TILE);
      if (d) {
        d.done = true;
        this.startFall(p);
      }
      return;
    }
    F.t += dt;
    const water = this.gs.sea ? this.waterY() : 0;
    switch (F.phase) {
      case 'warn': {
        // the sign bobs over the spot; the column and the target pulse
        const k = F.t / WARN_SECS;
        F.sign.setPosition(F.x, water + 52 + Math.sin(F.t * 7) * 4).setScale(SIGN_SCALE * (1 + Math.sin(F.t * 9) * 0.05));
        F.col.setAlpha(0.5 + 0.35 * Math.abs(Math.sin(F.t * (5 + k * 6))));
        F.col.tilePositionY -= dt * 60;
        F.target.setAlpha(0.7 + 0.3 * Math.sin(F.t * 8)).setScale(this.targetScale() * (1 + Math.sin(F.t * 8) * 0.05));
        if (Math.floor((F.t - dt) * 2.5) !== Math.floor(F.t * 2.5)) sfx.tick();
        if (F.t >= WARN_SECS) this.drop(F, water);
        break;
      }
      case 'drop': {
        F.vy = Math.min(1500, F.vy + 1800 * dt);
        F.y += F.vy * dt;
        if (F.y + this.fatHalfH() * 0.5 >= water) {
          // SPLASH
          F.phase = 'sink';
          this.gs.sea?.splash(F.x, 34);
          this.gs.sea?.bubbles(F.x, water + 60, 18);
          this.gs.shakeFrom(F.x, water, 320, 0.012);
          sfx.splash();
          sfx.thud();
          this.gs.tweens.add({ targets: [F.sign, F.target], alpha: 0, scale: 0.2, duration: 220, onComplete: () => { F.sign.destroy(); F.target.destroy(); } });
          this.gs.tweens.add({ targets: F.streaks, alpha: 0, duration: 200 });
        }
        break;
      }
      case 'sink': {
        // through the water, slowing: down to the sea bed
        F.vy += (430 - F.vy) * Math.min(1, dt * 3);
        F.y += F.vy * dt;
        if (Math.random() < 0.5) this.gs.sea?.bubbles(F.x + (Math.random() - 0.5) * 60, F.y - this.fatHalfH(), 1);
        if (F.y + this.fatHalfH() >= F.bed) {
          F.y = F.bed - this.fatHalfH();
          F.phase = 'daze';
          F.t = 0;
          this.gs.shakeFrom(F.x, F.bed, 260, 0.01);
          sfx.thud();
          this.gs.fx.dust(F.x - 40, F.bed, 8);
          this.gs.fx.dust(F.x + 40, F.bed, 8);
          this.gs.fx.stars(F.x, F.y - this.fatHalfH() * 0.6, 8);
          this.gs.tweens.add({ targets: F.col, alpha: 0, duration: 400 });
        }
        break;
      }
      case 'daze':
        if (F.fish) F.fish.setRotation(Math.PI / 2 + Math.sin(F.t * 9) * 0.08);
        if (F.t > 1.1) {
          // it rights itself and swims off, back the way you came, sinking out of sight
          F.phase = 'off';
          F.t = 0;
          F.fish?.setFlipX(true);
          if (F.fish) this.gs.tweens.add({ targets: F.fish, rotation: 0.15, duration: 400, ease: 'Sine.easeOut' });
        }
        break;
      case 'off':
        F.x -= 160 * dt;
        F.y -= 30 * dt;
        F.fish?.setAlpha(Math.max(0, 1 - F.t / 1.6));
        if (F.t > 1.6) {
          F.fish?.destroy();
          F.streaks?.destroy();
          F.col.destroy();
          this.fall = null;
          return;
        }
        break;
    }
    if (F.fish) {
      F.fish.setPosition(F.x, F.y);
      F.fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.gs.time.now / (F.phase === 'daze' ? 260 : 90)) % 3]);
      F.streaks?.setPosition(F.x, F.y - this.fatHalfH() * 0.6);
    }
    // in its way: you (lose your nuggies), and any bad guy fish (squashed)
    if (F.fish && (F.phase === 'drop' || F.phase === 'sink' || (F.phase === 'daze' && F.t < 0.25))) {
      const hw = this.fatHalfW() * 0.8;
      const hh = this.fatHalfH() * 0.9;
      for (const q of this.gs.players)
        if (q.alive && !q.invulnerable && q.body.right > F.x - hw && q.body.left < F.x + hw && q.body.bottom > F.y - hh && q.body.top < F.y + hh) {
          this.gs.hitPlayer(q, F.x);
          if (q.alive) q.body.setVelocityX((q.x < F.x ? -1 : 1) * 320);
        }
      for (const e of this.gs.badGuys)
        if (e.active && !e.dead && Math.abs(e.x - F.x) < hw && Math.abs(e.y - F.y) < hh) {
          this.gs.fx.popText(e.x, e.body.top - 10, 'SQUISH!', '#ffffff', 15);
          e.damage(99, 'stomp', null);
        }
    }
  }

  private waterY() {
    return (this.gs as unknown as { level: { data: { water?: number } } }).level.data.water ?? 0;
  }
  private fatHalfW() {
    return (FISH_SIZE.fat.h * FISH_SCALE.fat * FAT_K) / 2;
  }
  private fatHalfH() {
    return (FISH_SIZE.fat.w * FISH_SCALE.fat * FAT_K) / 2;
  }

  /** The warning goes up: a sign over the spot just ahead of you, the target on the surface, the column down through the water. */
  private startFall(p: Player) {
    const gs = this.gs;
    const water = this.waterY();
    // just ahead of you (where you'll be in a moment), over open water
    const speed = Phaser.Math.Clamp(Math.abs(p.body.velocity.x), 110, 230);
    let x = p.x + speed * WARN_SECS * 0.75 + 60;
    for (let i = 0; i < 20 && gs.isSolidAt(x, water + 12); i++) x += 40;
    const bed = gs.groundUnder(x, water + 8) ?? water + 14 * TILE;
    const colW = this.fatHalfW() * 2;
    const col = gs.add
      .tileSprite(x, water, COLUMN.w, Math.max(COLUMN.h, bed - water), 'chase-col')
      .setOrigin(0.5, 0)
      .setDisplaySize(colW, bed - water)
      .setDepth(DEPTH.enemies - 0.5)
      .setAlpha(0);
    const target = gs.add.image(x, water, 'chase-target').setDepth(DEPTH.near + 5).setScale(this.targetScale()).setAlpha(0);
    const sign = gs.add.image(x, water + 52, 'chase-sign').setDepth(DEPTH.text).setScale(SIGN_SCALE * 0.3).setAlpha(0);
    gs.tweens.add({ targets: [col, target], alpha: 0.8, duration: 300 });
    gs.tweens.add({ targets: sign, alpha: 1, scale: SIGN_SCALE, duration: 380, ease: 'Back.easeOut' });
    sfx.whistle();
    if (!this.warned) {
      this.warned = true;
      gs.fx.popText(Math.min(x, p.x + 260), water + 40, 'LOOK OUT ABOVE!', '#ffd23f', 22);
    } else gs.fx.popText(Math.min(x, p.x + 260), water + 40, 'FAT FISH!', '#ffd23f', 20);
    this.fall = { x, phase: 'warn', t: 0, sign, target, col, y: 0, vy: 0, bed, hitDone: false };
  }

  /** The target on the surface: a bit wider than the falling fish (its picture's drawn at 2×). */
  private targetScale() {
    return (this.fatHalfW() * 2.3) / (TARGET.w * 2);
  }

  private drop(F: Fall, water: number) {
    const gs = this.gs;
    F.phase = 'drop';
    F.t = 0;
    const v = gs.viewRect;
    F.y = Math.min(v.top, water - 200) - this.fatHalfH();
    F.vy = 700;
    const fw = FISH_SIZE.fat.w * FISH_SCALE.fat * FAT_K;
    const fish = gs.add.sprite(F.x, F.y, 'fish6-fat', 'sw0').setDepth(DEPTH.enemies + 2).setRotation(Math.PI / 2 - 0.12);
    fish.setScale(fw / fish.frame.width);
    F.fish = fish;
    F.streaks = gs.add.image(F.x, F.y, 'chase-streaks').setOrigin(0.5, 1).setDepth(DEPTH.enemies + 1.9).setScale((this.fatHalfW() * 2) / (STREAKS.w * 1.5));
    sfx.whoosh();
  }

  destroy() {
    for (const f of this.fish) {
      f.img.destroy();
      f.wake.destroy();
    }
    this.arrow.destroy();
  }
}
