import Phaser from 'phaser';
import { DEPTH, TILE } from '../../config';
import { sfx } from '../../core/sfx';
import { PLOP_PAD, PLOP_RES, PLOP_TOP } from '../../gfx/textures';
import { PLOP_H } from '../../gfx/plops';
import type { EnemyKind } from '../../level/builder';
import type { GameScene } from '../../scenes/GameScene';
import type { WeaponKind } from './Weapons';
import { BadFish } from './Fish';
import { BigPuff, Giant, Glob, Goat, Puffball, colHash, createEnemy, type DeathKind, type Enemy } from './Enemy';

/**
 * The Plops (World 2: Plop Invasion) — they've taken over Puff Ball Planet.
 * They move like the Puff Balls they replaced:
 *   Plop      (small)  waddles about; 1 in 3 carry a blaster, the rest stop,
 *                      shout and lob a lump of poo at you
 *   Big Plop  (medium) a hunter like the Big Puff Ball: chases, hops gaps,
 *                      pounces; 1 in 3 armed, the rest throw poo from a distance
 *   Giant Plop (big)   the boss at each checkpoint, like the Giant, but every
 *                      landing sends a wave of poo rolling along the ground, and
 *                      he hurls big lumps of poo that roll on at you where they land
 * Stink lines waft off them; the giant ones have flies buzzing round their heads.
 */

type Body = Phaser.Physics.Arcade.Body;
type Size = 'small' | 'medium' | 'large';

/** How big each Plop is shown (× its art) and its body (world px). */
const SIZE: Record<Size, { k: number; w: number; h: number }> = {
  small: { k: 0.42, w: 22, h: 30 },
  medium: { k: 0.74, w: 36, h: 60 },
  large: { k: 1.55, w: 100, h: 148 },
};

/** Show a Plop at its size, with its body standing on its feet. */
function plopBody(e: Phaser.Physics.Arcade.Sprite, size: Size) {
  const { k, w, h } = SIZE[size];
  const s = k / PLOP_RES;
  e.setScale(s);
  const cx = (50 + PLOP_PAD) * PLOP_RES;
  const feet = (100 + PLOP_TOP) * PLOP_RES;
  // (the sprite's anchor stays at the middle of the art, as before the headroom was added)
  e.setOrigin(0.5, (52 + PLOP_TOP) / (PLOP_H + PLOP_TOP));
  const bw = w / s;
  const bh = h / s;
  (e.body as Body).setSize(bw, bh, false).setOffset(cx - bw / 2, feet - bh);
}

/**
 * The Puff Balls' behaviour asks for their frames by name (w0/w1 walking, m0/m1
 * mad, crouch, air, slam, flat): a Plop shows its own instead — the four-step
 * walk while it's moving, shouting when it stops, and so on.
 */
/** Each Plop's little moments while it stands about (a blink, a glance, a grin), and when the next is due. */
const moods = new WeakMap<object, { next: number; until: number; face: string }>();

/**
 * Standing about: it breathes (a slow in and out), blinks every few seconds, and now and
 * then glances back over its shoulder or grins to itself.
 */
function idleFace(e: Phaser.Physics.Arcade.Sprite, t: number): string {
  let m = moods.get(e);
  if (!m) moods.set(e, (m = { next: t + 0.5 + Math.random() * 3, until: 0, face: 'idle' }));
  if (t >= m.until && t >= m.next) {
    const r = Math.random();
    m.face = r < 0.6 ? 'blink' : r < 0.82 ? 'look' : 'grin';
    m.until = t + (m.face === 'blink' ? 0.13 : 0.7 + Math.random() * 0.6);
    m.next = m.until + 1.4 + Math.random() * 3;
  }
  if (t < m.until) return m.face;
  // (each one breathes at its own moment)
  return Math.floor(t * 1.5 + ((e.x * 0.37) % 1)) % 2 ? 'idle1' : 'idle';
}

function plopFrame(e: Phaser.Physics.Arcade.Sprite, f: string, rate: number): string {
  const b = e.body as Body | undefined;
  const moving = !!b && b.enable && Math.abs(b.velocity.x) > 8 && b.blocked.down;
  const t = e.scene ? e.scene.time.now / 1000 : 0;
  const walk = `walk${Math.floor(t * rate) % 4}`;
  // just been hit: "ow!"
  const hurtAt = (e as unknown as { hurtAt?: number }).hurtAt ?? -1e9;
  if (e.scene && e.scene.time.now - hurtAt < 320) return 'hurt';
  switch (f) {
    case 'w0':
    case 'w1':
      return moving ? walk : idleFace(e, t);
    case 'm0':
    case 'm1':
      return moving ? walk : f === 'm0' ? 'yell0' : 'yell1';
    case 'crouch':
      return 'yell1';
    case 'air':
      return 'walk3';
    case 'slam':
      return 'yell0';
    case 'idle':
      return idleFace(e, t);
    case 'yell0':
    case 'yell1':
    case 'walk0':
    case 'walk1':
    case 'walk2':
    case 'walk3':
    case 'idle1':
    case 'blink':
    case 'look':
    case 'grin':
    case 'hurt':
      return f;
    default:
      return 'idle';
  }
}

/** Wafting stink lines, now and then (only while on screen). */
function stink(gs: GameScene, e: Enemy, st: { t: number }, dt: number, k: number) {
  st.t -= dt;
  if (st.t > 0 || !e.awake || e.dead) return;
  st.t = 0.7 + Math.random() * 0.9;
  const b = e.body;
  const x = e.x + (Math.random() - 0.5) * b.width * 0.8;
  const img = gs.add.image(x, b.top + b.height * 0.2, 'stink').setScale(0.5 * k).setDepth(e.depth - 0.2).setAlpha(0);
  gs.tweens.add({
    targets: img,
    y: img.y - 26 * k - 10,
    x: x + (Math.random() - 0.5) * 10,
    alpha: { from: 0.9, to: 0 },
    scaleX: 0.7 * k,
    duration: 1300,
    ease: 'Sine.easeOut',
    onComplete: () => img.destroy(),
  });
}

/** A squashed Plop: flattens with a splat, then fades. */
function squashed(gs: GameScene, e: Enemy) {
  gs.fx.stars(e.x, e.y, 5);
  gs.fx.pooSplat(e.x, e.body.bottom - 4, 10);
  gs.tweens.add({
    targets: e,
    scaleY: e.scaleY * 0.25,
    scaleX: e.scaleX * 1.35,
    y: e.y + e.displayHeight * 0.35,
    duration: 90,
    onComplete: () => gs.tweens.add({ targets: e, alpha: 0, delay: 300, duration: 220, onComplete: () => e.destroy() }),
  });
}

/** Unarmed Plops throw poo: a quick wind-up ('!' shout, a shiver), then a lump of it lobbed right at you. */
interface Thrower {
  cd: number;
  windup: number;
  dir: number;
}
/**
 * Now and then, while just patrolling, a Plop stops to stand about for a moment (and
 * breathes, blinks, glances round or grins to itself: see idleFace). Not with you right
 * next to it, and not in the middle of anything.
 */
function loiter(gs: GameScene, e: Enemy, st: { t: number; pause: number }, dt: number, keepAway: number): boolean {
  const b = e.body;
  if (st.pause > 0) {
    st.pause -= dt;
    b.setVelocityX(0);
    e.setFrame('w0');
    return true;
  }
  st.t -= dt;
  const tgt = gs.nearestPlayer(e.x, e.y);
  const near = !!tgt && tgt.alive && Math.abs(tgt.x - e.x) < keepAway;
  if (st.t <= 0 && b.blocked.down && !near && !e.weapon?.busy) {
    st.pause = 1 + Math.random() * 1.5;
    st.t = 3 + Math.random() * 4;
  }
  return false;
}

function throwPoo(gs: GameScene, e: Enemy, th: Thrower, dt: number, o: { min: number; max: number; cd: [number, number]; size: number }): boolean {
  const b = e.body;
  th.cd -= dt;
  const tgt = gs.nearestPlayer(e.x, e.y);
  if (th.windup > 0) {
    th.windup -= dt;
    b.setVelocityX(0);
    e.setFlipX(th.dir > 0);
    e.setFrame('m0');
    e.setX(e.x + Math.sin(gs.time.now / 14) * 0.35);
    if (th.windup <= 0) {
      th.cd = o.cd[0] + Math.random() * (o.cd[1] - o.cd[0]);
      if (tgt && tgt.alive) {
        const sx = e.x + th.dir * b.width * 0.45;
        const sy = b.top + b.height * 0.3;
        const tx = tgt.x;
        const ty = tgt.body.center.y;
        const G = 760;
        const T = Phaser.Math.Clamp(Math.abs(tx - sx) / 300, 0.42, 1);
        let vx = (tx - sx) / T;
        if (Math.sign(vx) !== th.dir) vx = th.dir * 60;
        const vy = (ty - sy - 0.5 * G * T * T) / T;
        new Glob(gs, sx, sy, vx, vy, G, { tex: 'poo', scale: o.size, spin: 9, poo: true, r: 5 + o.size * 2 });
        sfx.spit();
        gs.fx.pooSplat(sx, sy, 3);
      }
    }
    return true;
  }
  if (!tgt || !tgt.alive || !b.blocked.down || th.cd > 0) return false;
  const dx = tgt.x - e.x;
  const dy = tgt.bottom - b.bottom;
  if (Math.abs(dx) < o.min || Math.abs(dx) > o.max || dy < -170 || dy > 150) return false;
  th.dir = Math.sign(dx) || 1;
  th.windup = 0.42;
  gs.fx.popText(e.x, b.top - 12, '!', '#c99064', 20);
  sfx.bump();
  return true;
}

export class Plop extends Puffball {
  readonly kind: EnemyKind = 'plop';
  private th: Thrower = { cd: 1 + Math.random() * 1.5, windup: 0, dir: -1 };
  private st = { t: Math.random() };
  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'gplop-small');
    plopBody(this, 'small');
    // (a Plop holds it out at the end of its arm, low, clear of its face)
    this.handAt = { x: -24, y: 9 };
    this.weaponK = 0.82;
  }
  setFrame(frame: string | number, updateSize?: boolean, updateOrigin?: boolean) {
    return super.setFrame(plopFrame(this, String(frame), 10), updateSize, updateOrigin);
  }
  private lazy = { t: 1 + Math.random() * 4, pause: 0 };
  tick(dt = 1 / 60) {
    if (!this.weapon && throwPoo(this.gs, this, this.th, dt, { min: 50, max: 300, cd: [2.4, 3.6], size: 1.05 })) return;
    if (loiter(this.gs, this, this.lazy, dt, 120)) return;
    super.tick(dt);
  }
  update(dt: number) {
    super.update(dt);
    stink(this.gs, this, this.st, dt, 0.7);
  }
  protected onStompDeath() {
    squashed(this.gs, this);
  }
  kill(how: DeathKind) {
    if (!this.dead && how === 'blast') this.gs.fx.pooSplat(this.x, this.y, 12);
    super.kill(how);
  }
}

export class BigPlop extends BigPuff {
  readonly kind: EnemyKind = 'bigplop';
  private th: Thrower = { cd: 1.2 + Math.random(), windup: 0, dir: -1 };
  private st = { t: Math.random() };
  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'gplop-medium');
    plopBody(this, 'medium');
    this.handAt = { x: -38, y: 14 };
    this.weaponK = 0.9;
  }
  setFrame(frame: string | number, updateSize?: boolean, updateOrigin?: boolean) {
    return super.setFrame(plopFrame(this, String(frame), 8), updateSize, updateOrigin);
  }
  private lazy = { t: 1 + Math.random() * 4, pause: 0 };
  tick(dt = 1 / 60) {
    // (up close he pounces, like the Big Puff Ball; from further off, unarmed, he throws poo)
    if (!this.weapon && throwPoo(this.gs, this, this.th, dt, { min: 150, max: 340, cd: [2, 3], size: 1.4 })) return;
    // (only while he hasn't spotted you: then it's all business)
    if (loiter(this.gs, this, this.lazy, dt, 360)) return;
    super.tick(dt);
  }
  update(dt: number) {
    super.update(dt);
    stink(this.gs, this, this.st, dt, 1);
  }
  protected onStompDeath() {
    squashed(this.gs, this);
  }
  kill(how: DeathKind) {
    if (!this.dead && how === 'blast') this.gs.fx.pooSplat(this.x, this.y, 16);
    super.kill(how);
  }
}

export class GiantPlop extends Giant {
  readonly kind: EnemyKind = 'giantplop';
  private st = { t: Math.random() };
  /** (now and then, not all the time: he hops, charges and slams just like a Giant Puff Ball) */
  private lobCd = 6 + Math.random() * 2;
  private lobWind = 0;
  private lobDir = -1;
  private flies: Phaser.GameObjects.Image[] = [];
  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'gplop-large');
    plopBody(this, 'large');
    // flies buzzing round his head
    for (let i = 0; i < 3; i++) this.flies.push(gs.add.image(x, y, 'amb-fly', 'open').setScale(0.13).setTint(0x2e2a30).setDepth(DEPTH.enemies + 2));
  }
  setFrame(frame: string | number, updateSize?: boolean, updateOrigin?: boolean) {
    return super.setFrame(plopFrame(this, String(frame), 5), updateSize, updateOrigin);
  }

  /** His landings send poo rolling along the ground both ways (jump it!). */
  protected sendWaves(left: number, right: number, groundY: number, speed: number) {
    this.gs.spawnPooWave(left, groundY, -1, speed);
    this.gs.spawnPooWave(right, groundY, 1, speed);
  }

  tick(dt: number) {
    const b = this.body;
    // a big lump of poo, hurled at you from a distance: where it lands, it rolls on at you
    if (this.lobWind > 0) {
      this.lobWind -= dt;
      b.setVelocityX(0);
      this.setFrame('slam');
      this.setFlipX(this.lobDir > 0);
      this.setX(this.x + Math.sin(this.gs.time.now / 12) * 0.6);
      if (this.lobWind <= 0) this.lob();
      return;
    }
    this.lobCd -= dt;
    const tgt = this.gs.nearestPlayer(this.x, this.y);
    if (this.mode === 'walk' && b.blocked.down && this.lobCd <= 0 && tgt && tgt.alive) {
      const dx = tgt.x - this.x;
      if (Math.abs(dx) > 170 && Math.abs(dx) < 460 && Math.abs(tgt.bottom - b.bottom) < 160) {
        this.lobDir = Math.sign(dx) || -1;
        this.dir = this.lobDir;
        this.lobWind = 0.45;
        this.gs.fx.popText(this.x, b.top - 26, 'HNNG!', '#c99064', 22);
        sfx.roar();
        return;
      }
    }
    super.tick(dt);
  }

  private lob() {
    this.lobCd = 7 + Math.random() * 3;
    const b = this.body;
    const tgt = this.gs.nearestPlayer(this.x, this.y);
    const sx = this.x + this.lobDir * 40;
    const sy = b.top + 20;
    const tx = tgt ? tgt.x : sx + this.lobDir * 260;
    const G = 900;
    const T = Phaser.Math.Clamp(Math.abs(tx - sx) / 330, 0.6, 1.25);
    const vx = (tx - sx) / T;
    const vy = (b.bottom - 10 - sy - 0.5 * G * T * T) / T;
    const dir = this.lobDir;
    new Glob(this.gs, sx, sy, vx, vy, G, {
      tex: 'poo',
      scale: 2.6,
      spin: 6,
      poo: true,
      r: 14,
      onLand: (x, y) => {
        const groundY = Math.floor((y + 4) / TILE) * TILE;
        this.gs.shakeFrom(x, groundY, 160, 0.006);
        this.gs.spawnPooWave(x, groundY, dir, 210);
      },
    });
    sfx.spit();
  }

  update(dt: number) {
    super.update(dt);
    if (this.dead) return;
    stink(this.gs, this, this.st, dt, 1.8);
    const t = this.gs.time.now / 1000;
    const b = this.body;
    this.flies.forEach((f, i) => {
      const a = t * (5 + i) + i * 2.1;
      f.setPosition(this.x + Math.cos(a) * (34 + i * 6), b.top + 8 + Math.sin(a * 1.7) * 12).setFrame(Math.floor(t * 30 + i) % 2 ? 'open' : 'shut');
    });
  }

  kill(how: DeathKind) {
    if (!this.dead && how !== 'fall') this.gs.fx.pooSplat(this.x, this.y, 30);
    this.flies.forEach((f) => f.destroy());
    this.flies = [];
    super.kill(how);
  }

  destroy(fromScene?: boolean) {
    this.flies.forEach((f) => f.destroy());
    this.flies = [];
    super.destroy(fromScene);
  }
}

/** A mountain goat in Plop Invasion: covered in poo, and it spits poo. */
export class PooGoat extends Goat {
  readonly kind: EnemyKind = 'poogoat';
  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y, 'goat-poo');
    this.spitStyle = { tex: 'poo', scale: 0.9, spin: 10, poo: true, r: 6 };
  }
}

/** Any bad guy by kind: the Plops here, the Puff Balls and the rest in Enemy.ts. */
export function createBadGuy(gs: GameScene, kind: EnemyKind, x: number, y: number, weapon?: WeaponKind): Enemy {
  const h = colHash(x);
  if (weapon && (kind === 'plop' || kind === 'bigplop')) {
    // (the level asks for this one to carry a particular weapon)
    const e = kind === 'plop' ? new Plop(gs, x, y) : new BigPlop(gs, x, y);
    e.arm(weapon, kind === 'plop' ? 'small' : 'big');
    if (kind === 'bigplop') e.hp = 3;
    return e;
  }
  if (kind === 'plop') {
    // 1 in 3 small Plops carry a blaster; the rest throw poo
    const e = new Plop(gs, x, y);
    if (h % 3 === 0) e.arm('gun', 'small');
    return e;
  }
  if (kind === 'bigplop') {
    // 1 in 3 medium Plops are armed (and take three hits); the rest throw poo
    const e = new BigPlop(gs, x, y);
    if (h % 3 === 0) {
      // (no ball and chain on a climb: swung at you on a narrow ledge, it's too much)
      const kinds = gs.level.data.vertical ? (['gun', 'saw'] as const) : (['flail', 'gun', 'saw'] as const);
      e.arm(kinds[(h >>> 7) % kinds.length], 'big');
      e.hp = 3;
    }
    return e;
  }
  if (kind === 'giantplop') return new GiantPlop(gs, x, y);
  if (kind === 'fish' || kind === 'bigfish' || kind === 'kai') return new BadFish(gs, x, y, kind);
  if (kind === 'poogoat') return new PooGoat(gs, x, y);
  return createEnemy(gs, kind, x, y);
}
