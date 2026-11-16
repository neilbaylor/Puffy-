import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { sfx } from '../core/sfx';
import { FISH_SCALE, FISH_SIZE, type FishKind } from '../gfx/fish';
import { BADGE, COLUMN, EDGE, SHADOW, STREAKS, TARGET } from '../gfx/chase';
import { PACK_KINDS } from '../gfx/textures';
import { SWIM_RUN, SWIM_WALK, type Player } from '../entities/Player';
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
  /** Extra sky shown over the surface (for the Fat Fish coming down), px. */
  camSky: number;
}

/** How far behind each other the gang swim, along your trail (px). */
const GAP = 74;
/** Never further behind you than this along your trail (on the screen, or only just off it). */
const MAX_LEAD = 560;
/** Where they like to be along your trail behind you (px): right on your tail. The further ahead you get, the harder they swim. */
const TAIL = 240;
/** How much harder they swim for each px you're ahead of TAIL (px/s per px). */
const PULL = 1.1;
/** Close enough for the lead fish to lunge (a wind-up, then a dash). */
const LUNGE_AT = 270;
/** The lunge: the wind-up (it draws back, a "!"), then the dash at this × their pace. */
const WINDUP = 0.42;
const DASH_SECS = 0.55;
const DASH_K = 2.4;
/** Time between lunges (s). */
const LUNGE_EVERY: [number, number] = [3.2, 5.0];
/** Just after you've been hit they hang back this much further. */
const WARY = 130;
/** How long each fish leads before the next one takes over (s). */
const LEAD_SECS: [number, number] = [6.5, 9];
/** How big the gang are here (a bit under their size in the drawings' scale: they're four, and the screen's small). */
const PACK_K = 0.82;
/** The Fat Fish as it falls (× its drawings' scale). */
const FAT_K = 0.8;
/** The warning sign's size on screen (its picture's drawn at 3×: half its units' size again). */
const SIGN_SCALE = 1.5 / 3;
/** The warning before the Fat Fish comes down (s). */
const WARN_SECS = 4.6;
/** While the warning's up (and it hangs in the sky) the spot follows you — aiming where you're going — at up to this speed (px/s); it locks once it drops. */
const AIM_V = 260;
/** The camera tips up to show this much sky over the spot as it comes (px), from this long before it appears (s). */
const SKY = 180;
const SKY_LEAD = 1.3;
/** It hangs at the top of the screen this long before it drops (s). */
const HANG_SECS = 0.5;
/** Its fall: gravity and top speed (px/s², px/s) — slow enough to watch it come. */
const DROP_G = 700;
const DROP_MAX = 640;
/** Down through the water, at about this speed (px/s). */
const SINK_V = 270;
/** Swimming away once it's shaken off the landing (px/s, top speed). */
const OFF_V = 300;

/**
 * Which look the Fat Fish warning and the "they're behind you" marker have, while we try a few (a dev
 * device can pick another: localStorage puffy.chase6 = "<warning><marker>", each a, b or c — e.g. "cb").
 *   warning  a: the sign under the surface, the danger column, the target ring
 *            b: + a countdown ring round the sign (3, 2, 1), kept on the screen
 *            c: the sign up at the top of the screen with a bouncing arrow, the Fat Fish's shadow
 *               growing on the sea bed under the spot, a softer column
 *   marker   a: a red ball with an arrow and a "!"
 *            b: a badge with the lead fish's own face in it (whoever's leading), pulsing faster the closer they are
 *            c: the left edge of the screen glowing red, the lead fish peeking in at it
 */
const STYLE = (() => {
  let v = 'bb';
  try {
    const q = localStorage.getItem('puffy.chase6');
    if (q && /^[abc][abc]$/.test(q)) v = q;
  } catch {
    // (no storage: the default)
  }
  return { warn: v[0], mark: v[1] };
})();

type TrailPt = { x: number; y: number; s: number };

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
  /** 'warn' (the sign's up), 'hang' (it appears at the top of the screen, a moment in the air), 'drop' (falling), 'sink' (down through the water), 'daze' (on the sea bed), 'off' (swimming away). */
  phase: 'warn' | 'hang' | 'drop' | 'sink' | 'daze' | 'off';
  t: number;
  sign: Phaser.GameObjects.Image;
  target: Phaser.GameObjects.Image;
  /** (warning b) the countdown ring round the sign. */
  ring?: Phaser.GameObjects.Graphics;
  /** (warning c) the arrow under the sign, and the shadow growing on the sea bed. */
  down?: Phaser.GameObjects.Text;
  shadow?: Phaser.GameObjects.Image;
  /** The countdown so far (3, 2, 1). */
  count: number;
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
  /** Your trail through the water: points every few px, with the distance along it (their way round rocks). */
  private trail: TrailPt[] = [];
  /**
   * Where the chase is (the leader's nose): it heads straight for you whenever nothing's in the
   * way — your ups and downs don't throw it off — and otherwise for the furthest point of your
   * trail it can see, round the rocks the way you went. `ti`: how far along your trail it's got.
   */
  private head = { x: 0, y: 0, ti: 0 };
  /** The head's own path: the gang follow it in a line, each a gap further back. */
  private path: TrailPt[] = [];
  /** The head's place along its path (the end of it). */
  private sPack = 0;
  /** Which point of your trail the head is making for (worked out every other frame). */
  private aim = 0;
  private aimT = 0;
  /** After a bite: the head holds still this long (you get away a little). */
  private stall = 0;
  private v = 0;
  /** The lunge: >0 while dashing (s left). */
  private lunge = 0;
  /** >0 while winding up for one (s left). */
  private windup = 0;
  private lungeCool = 0;
  /** After you've been hit (and are flashing), and a moment more: they hold back. */
  private calm = 0;
  private swapIn = 8;
  private drops: { x: number; done: boolean }[];
  private fall: Fall | null = null;
  private warned = false;
  private arrow: Phaser.GameObjects.Container;
  /** (marker b) the lead fish's face in the badge; (marker c) the edge glow and the fish peeking in. */
  private face: Phaser.GameObjects.Sprite | null = null;
  private edge: Phaser.GameObjects.Image | null = null;
  /** How close behind they are, for the marker (0 far … 1 right there), eased. */
  private near = 0;
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
    // the "they're right behind you" marker, at the left edge of the screen when the leader's off it
    if (STYLE.mark === 'b') {
      const badge = gs.add.image(0, 0, 'chase-badge').setOrigin(46 / BADGE.w, 0.5).setScale(0.5);
      this.face = gs.add.sprite(0, 0, 'fish6-stone', 'an0');
      this.arrow = gs.add.container(0, 0, [badge, this.face]).setDepth(DEPTH.text + 1).setVisible(false);
    } else if (STYLE.mark === 'c') {
      this.edge = gs.add.image(0, 0, 'chase-edge').setOrigin(0, 0).setDepth(DEPTH.text).setAlpha(0).setVisible(false);
      this.face = gs.add.sprite(0, 0, 'fish6-stone', 'an0');
      this.arrow = gs.add.container(0, 0, [this.face]).setDepth(DEPTH.text + 1).setVisible(false);
    } else {
      const g = gs.add.graphics();
      g.fillStyle(0x3a2418, 1).fillCircle(0, 0, 15).fillTriangle(-24, 0, -10, -11, -10, 11);
      g.fillStyle(0xe8463f, 1).fillCircle(0, 0, 12.5).fillTriangle(-20, 0, -9, -8.5, -9, 8.5);
      const ex = gs.add.text(0, 0, '!', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5, 0.52);
      this.arrow = gs.add.container(0, 0, [g, ex]).setDepth(DEPTH.text + 1).setVisible(false);
    }
    // (coming back to a checkpoint: no opening; they turn up behind you after a moment)
    if (opts.retry) gs.time.delayedCall(900, () => this.heroSplashed());
  }

  private get hero() {
    return this.gs.players.find((p) => p.alive) ?? null;
  }

  /** The Fat Fish is up there over you or on its way down. */
  get falling() {
    const ph = this.fall?.phase;
    return ph === 'hang' || ph === 'drop' || ph === 'sink';
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
    const back = Math.min(p.x - 120, p.x - this.gs.viewRect.width * 0.85);
    for (const f of this.fish) f.img.setVisible(true).setAlpha(1);
    this.begin(p, back, p.y);
    // (a little longer to get going again before the first lunge)
    this.lungeCool = 4;
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
    this.head = { x: fromX, y: fromY, ti: 0 };
    this.path = [{ x: fromX - 1, y: fromY, s: 0 }, { x: fromX, y: fromY, s: 1 }];
    this.sPack = 1;
    this.aim = this.trail.length - 1;
    this.stall = 0;
    // (a moment before the first lunge: you've only just got going)
    this.lungeCool = 2.5;
    this.v = this.baseSpeed(p);
    this.swapIn = LEAD_SECS[0] + Math.random() * (LEAD_SECS[1] - LEAD_SECS[0]);
    this.phase = 'chase';
  }

  /** The gang's own pace: just under yours at an easy swim. */
  private baseSpeed(p: Player) {
    return p.char.walkSpeed * SWIM_WALK * 0.96;
  }
  /** Your pace swimming flat out. */
  private runSpeed(p: Player) {
    return p.char.runSpeed * SWIM_RUN;
  }

  /**
   * The furthest point of your trail the head can see from where it is (you, mostly): a clear line
   * through the water, wide enough for a fish.
   */
  private seeFurthest() {
    const tr = this.trail;
    const H = this.head;
    const last = tr.length - 1;
    if (this.clear(H.x, H.y, tr[last].x, tr[last].y)) return last;
    // (back along your trail a bit at a time, to where they've got to)
    for (let i = last - 4; i > H.ti; i -= 4) if (this.clear(H.x, H.y, tr[i].x, tr[i].y)) return i;
    return Math.min(last, H.ti + 1);
  }

  /** Nothing solid on the way from a to b, along the line and a little either side of it. */
  private clear(ax: number, ay: number, bx: number, by: number) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.ceil(d / 14);
    const nx = d ? -(by - ay) / d : 0;
    const ny = d ? (bx - ax) / d : 1;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (this.gs.isSolidAt(x, y) || this.gs.isSolidAt(x + nx * 14, y + ny * 14) || this.gs.isSolidAt(x - nx * 14, y - ny * 14)) return false;
    }
    return true;
  }

  /** The index of the point of your trail at distance s along it. */
  private trailIndex(s: number) {
    const tr = this.trail;
    let lo = 0;
    let hi = tr.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (tr[m].s <= s) lo = m;
      else hi = m;
    }
    return lo;
  }

  /** Where along your trail distance s is (before its start: on back the way the trail began). */
  private at(s: number, tr: TrailPt[] = this.trail): { x: number; y: number; dx: number; dy: number } {
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
    this.edge?.setVisible(false);
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
    if (this.trail.length > 4000) {
      this.trail.splice(0, 1000);
      this.head.ti = Math.max(0, this.head.ti - 1000);
      this.aim = Math.max(0, this.aim - 1000);
    }
    const sHero = this.trail[this.trail.length - 1].s;
    // where they're making for: you, if nothing's in the way; else the furthest bit of your trail they can see
    const H = this.head;
    this.aimT -= dt;
    if (this.aimT <= 0) {
      this.aimT = 1 / 30;
      this.aim = this.seeFurthest();
    }
    const tgt = this.trail[this.aim];
    const toT = Math.hypot(tgt.x - H.x, tgt.y - H.y);
    // their pace: they keep right on your tail — the further ahead you get, the harder they swim
    // (so running only buys you a little room) — and every few seconds the leader winds up and lunges
    const base = this.baseSpeed(p);
    const lead = toT + (sHero - tgt.s);
    this.lungeCool = Math.max(0, this.lungeCool - dt);
    const leader = this.fish[0];
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) {
        this.lunge = DASH_SECS;
        sfx.chomp();
      }
    } else if (this.lunge > 0) this.lunge -= dt;
    // (just after you've been hit by anything: they hang back a moment, no lunging, so you can get going again)
    if (p.invulnerable) this.calm = 0.9;
    else this.calm = Math.max(0, this.calm - dt);
    const wary = this.calm > 0;
    if (this.windup > 0 || this.lunge > 0) {
      // (mid-lunge: carry on)
    } else if (!wary && lead < LUNGE_AT && this.lungeCool <= 0 && leader.stun <= 0 && p.alive && !p.invulnerable) {
      this.windup = WINDUP;
      this.lungeCool = LUNGE_EVERY[0] + Math.random() * (LUNGE_EVERY[1] - LUNGE_EVERY[0]);
      if (leader.img.visible && this.onScreen(leader.x, leader.y)) this.gs.fx.popText(leader.x, leader.y - leader.ry * 1.7, '!', '#ff5a4a', 24);
    }
    const chase = Phaser.Math.Clamp(base + (lead - TAIL - (wary ? WARY : 0)) * PULL, base * 0.7, this.runSpeed(p) * 1.15);
    const want = this.lunge > 0 ? Math.max(chase, base) * DASH_K : this.windup > 0 ? base * 0.45 : chase;
    this.v += (want - this.v) * (1 - Math.exp(-dt * (this.lunge > 0 || this.windup > 0 ? 10 : 3)));
    // the head swims for it (holding still a moment after a bite)
    this.stall = Math.max(0, this.stall - dt);
    const step = this.stall > 0 ? 0 : this.v * dt;
    if (toT > 4) {
      const k = Math.min(1, step / toT);
      H.x += (tgt.x - H.x) * k;
      H.y += (tgt.y - H.y) * k;
    }
    if (toT - step < 14 && this.aim > H.ti) H.ti = this.aim;
    // (never too far behind: caught up along your trail, just off the screen)
    if (lead > MAX_LEAD) {
      const q = this.at(sHero - MAX_LEAD);
      H.x = q.x;
      H.y = q.y;
      H.ti = this.trailIndex(sHero - MAX_LEAD);
    }
    // (its path, for the line behind it)
    const lp = this.path[this.path.length - 1];
    const ld = Math.hypot(H.x - lp.x, H.y - lp.y);
    if (ld > 5) {
      this.path.push({ x: H.x, y: H.y, s: lp.s + ld });
      if (this.path.length > 3000) this.path.splice(0, 1000);
    }
    this.sPack = lp.s + ld;
    // taking turns: the leader drops to the back, the others move up
    this.swapIn -= dt;
    if (this.swapIn <= 0 && this.lunge <= 0 && this.windup <= 0) {
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
        this.stall = 0.8;
        this.lunge = 0;
        this.windup = 0;
        this.lungeCool = 2.4;
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
        if (f === this.fish[0]) this.lunge = this.windup = 0;
        break;
      }
    }
    this.marker(dt, leader);
  }

  /** The "they're behind you" marker: at the left edge of the screen while the leader's off it (see STYLE). */
  private marker(dt: number, leader: PackFish) {
    const v = this.gs.viewRect;
    // (shown once it's mostly off the screen, not over the fish itself)
    const off = leader.x + leader.rx * 0.3 < v.left && leader.img.visible;
    // (how close: right at the edge 1, well back 0)
    const want = off ? Phaser.Math.Clamp(1 - (v.left - leader.x) / 320, 0.15, 1) : 0;
    this.near += (want - this.near) * Math.min(1, dt * 6);
    const t = this.gs.time.now / 1000;
    const y = Phaser.Math.Clamp(leader.y, v.top + 90, v.top + v.height - 140);
    if (STYLE.mark === 'c' && this.edge && this.face) {
      // the edge glows (stronger, faster the closer they are); the leader's nose peeks in
      const glow = this.near > 0.02;
      this.edge.setVisible(glow);
      if (glow) {
        const pulse = 0.7 + 0.3 * Math.sin(t * (5 + this.near * 9));
        this.edge.setPosition(v.left, v.top).setDisplaySize(EDGE.w * (1.4 + this.near * 0.8), v.height).setAlpha(Math.min(1, 0.35 + this.near) * pulse);
      }
      this.arrow.setVisible(off);
      if (off) {
        this.syncFace(leader, 0.7);
        // (its nose in at the edge: further in the closer it is)
        const fw = this.face.displayWidth;
        this.arrow.setPosition(v.left - fw * (0.32 - 0.22 * this.near), y + Math.sin(t * 3) * 5);
      }
      return;
    }
    this.arrow.setVisible(off);
    if (!off) return;
    if (STYLE.mark === 'b' && this.face) {
      this.syncFace(leader, 0, true);
      this.arrow.setPosition(v.left + 74, y);
      this.arrow.setScale(1 + Math.max(0, Math.sin(t * (4 + this.near * 10))) * (0.06 + this.near * 0.1));
      return;
    }
    this.arrow.setPosition(v.left + 86, y);
    this.arrow.setScale(1 + Math.sin(t * 8.3) * 0.08);
  }

  /**
   * The marker's fish: whoever's leading, as they are right now, `k` × their size — or (`portrait`)
   * just its face, cropped and sized to fill the badge.
   */
  private syncFace(leader: PackFish, k: number, portrait = false) {
    const f = this.face!;
    const key = `fish6-${leader.kind}`;
    if (f.texture.key !== key || f.frame.name !== leader.img.frame.name) f.setTexture(key, leader.img.frame.name);
    f.setFlipX(false);
    if (!portrait) {
      f.setScale(leader.img.scaleX * k);
      return;
    }
    // (the front of the fish, facing right: its eye and mouth; the badge's disc is 19.5 across at half size)
    const fw = f.frame.width;
    const fh = f.frame.height;
    const cw = Math.min(fw * 0.5, fh * 1.05);
    f.setCrop(fw - cw, 0, cw, fh);
    const sc = 17.5 / Math.max(cw, fh) * 2;
    f.setScale(sc);
    // (centred on the disc: the crop's middle, not the frame's)
    f.setPosition(-(fw / 2 - cw / 2) * sc, 0);
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
        const q = this.at(this.sPack - f.back, this.path);
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
    // (the view tips up to the sky over the spot just before it comes, and back down once it's in the water)
    this.gs.camSky = (F.phase === 'warn' && F.t > WARN_SECS - SKY_LEAD) || F.phase === 'hang' || F.phase === 'drop' ? SKY : 0;
    // (it's aiming for you: where you'll be when it gets down to you, if you keep going as you are)
    if ((F.phase === 'warn' || F.phase === 'hang') && p) this.aimFall(F, p, dt, water);
    switch (F.phase) {
      case 'warn': {
        // the sign bobs over the spot; the column and the target pulse
        const k = F.t / WARN_SECS;
        F.col.setAlpha(0.5 + 0.35 * Math.abs(Math.sin(F.t * (5 + k * 6))));
        this.warnLook(F, water, k);
        F.col.tilePositionY -= dt * 60;
        F.target.setAlpha(0.7 + 0.3 * Math.sin(F.t * 8)).setScale(this.targetScale() * (1 + Math.sin(F.t * 8) * 0.05));
        if (Math.floor((F.t - dt) * 2.5) !== Math.floor(F.t * 2.5)) sfx.tick();
        if (F.t >= WARN_SECS) this.appear(F, water);
        break;
      }
      case 'hang':
        // (a cartoon moment up there: it's spotted the drop, wiggles — and down it comes)
        if (F.fish) F.fish.setRotation(Math.PI / 2 - 0.12 + Math.sin(F.t * 30) * 0.1);
        if (F.t >= HANG_SECS) {
          F.phase = 'drop';
          F.t = 0;
          F.vy = 90;
          this.fitColumn(F, water);
          sfx.whoosh();
          this.gs.tweens.add({ targets: F.streaks, alpha: 1, duration: 200 });
        }
        break;
      case 'drop': {
        F.vy = Math.min(DROP_MAX, F.vy + DROP_G * dt);
        F.y += F.vy * dt;
        if (F.fish) F.fish.setRotation(Math.PI / 2 - 0.12 + Math.sin(F.t * 14) * 0.05);
        if (F.y + this.fatHalfH() * 0.5 >= water) {
          // SPLASH
          F.phase = 'sink';
          this.gs.sea?.splash(F.x, 34);
          this.gs.sea?.bubbles(F.x, water + 60, 18);
          this.gs.shakeFrom(F.x, water, 320, 0.012);
          sfx.splash();
          sfx.thud();
          this.gs.tweens.add({ targets: [F.sign, F.target], alpha: 0, scale: 0.2, duration: 220, onComplete: () => { F.sign.destroy(); F.target.destroy(); } });
          F.ring?.destroy();
          F.down?.destroy();
          this.gs.tweens.add({ targets: F.streaks, alpha: 0, duration: 200 });
        }
        break;
      }
      case 'sink': {
        // through the water, slowing: down to the sea bed
        F.vy += (SINK_V - F.vy) * Math.min(1, dt * 3);
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
          this.gs.tweens.add({ targets: [F.col, F.shadow].filter(Boolean), alpha: 0, duration: 400 });
        }
        break;
      }
      case 'daze':
        if (F.fish) F.fish.setRotation(Math.PI / 2 + Math.sin(F.t * 9) * 0.08);
        if (F.t > 1.1) {
          // it shakes itself off, turns level and swims away (back the way you came), off the screen
          F.phase = 'off';
          F.t = 0;
          F.vy = 0;
          F.fish?.setFlipX(true);
          if (F.fish) this.gs.tweens.add({ targets: F.fish, rotation: -0.12, duration: 500, ease: 'Sine.easeOut' });
          this.gs.fx.popText(F.x, F.y - this.fatHalfH(), 'hmph!', '#ffffff', 14);
        }
        break;
      case 'off': {
        // (picking up speed, rising a little off the bottom as it goes)
        F.vy = Math.min(OFF_V, F.vy + OFF_V * 1.4 * dt);
        F.x -= F.vy * dt;
        F.y -= Math.max(0, 40 - F.t * 18) * dt;
        if (F.fish && F.t > 0.5) F.fish.setRotation(-0.12 + Math.sin(F.t * 7) * 0.05);
        if (Math.random() < dt * 6) this.gs.sea?.bubbles(F.x + this.fatHalfH() * 0.8, F.y, 1);
        const v = this.gs.viewRect;
        // (gone once it's well off the screen, or after a while whatever happens)
        if (F.x + this.fatHalfH() * 1.2 < v.left || F.x - this.fatHalfH() * 1.2 > v.left + v.width || F.t > 8) {
          F.fish?.destroy();
          F.streaks?.destroy();
          F.col.destroy();
          F.shadow?.destroy();
          this.fall = null;
          return;
        }
        break;
      }
    }
    if (F.fish) {
      F.fish.setPosition(F.x, F.y);
      F.fish.setFrame(['sw0', 'sw2', 'sw4'][Math.floor(this.gs.time.now / (F.phase === 'daze' ? 260 : 90)) % 3]);
      F.streaks?.setPosition(F.x, F.y - this.fatHalfH() * 0.6);
    }
    // in its way: you (lose your nuggies), and any bad guy fish (squashed)
    if (F.fish && (F.phase === 'drop' || F.phase === 'sink' || (F.phase === 'daze' && F.t < 0.25))) {
      const hw = this.fatHalfW() * 0.95;
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
    // (to start with, a little way ahead of you: it follows you from there)
    let x = p.x + 240;
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
    this.fall = { x, phase: 'warn', t: 0, sign, target, col, y: 0, vy: 0, bed, hitDone: false, count: 0 };
    if (STYLE.warn === 'b') this.fall.ring = gs.add.graphics().setDepth(DEPTH.text - 0.1);
    if (STYLE.warn === 'c') {
      this.fall.down = gs.add.text(x, 0, '▼', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '26px', color: '#ff5a4a', stroke: '#3a2418', strokeThickness: 5 }).setOrigin(0.5).setDepth(DEPTH.text);
      this.fall.shadow = gs.add.image(x, bed - 2, 'chase-shadow').setDepth(DEPTH.enemies - 0.4).setAlpha(0).setScale(0.3);
    }
  }

  /** The warning while it's up (see STYLE): `k` how far through it (0…1). */
  private warnLook(F: Fall, water: number, k: number) {
    const v = this.gs.viewRect;
    const bob = Math.sin(F.t * 7) * 4;
    const scale = SIGN_SCALE * (1 + Math.sin(F.t * 9) * 0.05);
    if (STYLE.warn === 'b' && F.ring) {
      // kept on the screen; a ring round it running down, and 3, 2, 1
      const sy = Math.max(water + 52, v.top + 58) + bob;
      F.sign.setPosition(F.x, sy).setScale(scale);
      const r = SIGN_SCALE * 3 * 34;
      F.ring.clear();
      F.ring.lineStyle(6, 0x3a2418, 0.55).strokeCircle(F.x, sy + 2, r);
      F.ring.lineStyle(4, 0xffd23f, 1).beginPath().arc(F.x, sy + 2, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k), false).strokePath();
      const n = 3 - Math.floor(F.t / (WARN_SECS / 3));
      if (n !== F.count && n >= 1) {
        F.count = n;
        this.gs.fx.popText(F.x + r + 18, sy - 10, String(n), '#ffd23f', 32);
      }
      return;
    }
    if (STYLE.warn === 'c' && F.down && F.shadow) {
      // up at the top of the screen, an arrow bouncing under it; its shadow on the sea bed grows
      const sy = v.top + 46 + bob;
      F.sign.setPosition(F.x, sy).setScale(scale);
      F.down.setPosition(F.x, sy + 44 + Math.abs(Math.sin(F.t * 6)) * 10);
      const w = this.fatHalfW() * 2.4;
      F.shadow.setScale((w / SHADOW.w) * (0.35 + 0.65 * k), (w / SHADOW.w) * (0.35 + 0.65 * k)).setAlpha(0.25 + 0.65 * k);
      F.col.setAlpha(0.25 + 0.2 * Math.abs(Math.sin(F.t * (5 + k * 6))));
      return;
    }
    F.sign.setPosition(F.x, water + 52 + bob).setScale(scale);
  }

  /**
   * The spot follows you while the warning's up: where you'll be when it gets down to you if you
   * keep on as you are (so to dodge it, change your pace — speed up or hold back — at the right
   * moment). Not over a rock.
   */
  private aimFall(F: Fall, p: Player, dt: number, water: number) {
    const left = (F.phase === 'warn' ? WARN_SECS - F.t : 0) + (F.phase === 'hang' ? HANG_SECS - F.t : HANG_SECS);
    // (time to it: what's left of the warning and the hang, the fall and the sink down to you)
    const toYou = Math.min(1.8, left + 0.6 + Math.max(0, p.y - water) / SINK_V);
    const want = p.x + p.body.velocity.x * toYou;
    const dx = Phaser.Math.Clamp(want - F.x, -AIM_V * dt, AIM_V * dt);
    const nx = F.x + dx;
    if (this.gs.isSolidAt(nx, water + 12)) return;
    F.x = nx;
    F.col.x = nx;
    F.target.x = nx;
    F.fish?.setX(nx);
    if (F.shadow) F.shadow.x = nx;
    // (the column down to the sea bed under it, as the bed rises and falls)
    if (Math.abs(dx) > 0.5) this.fitColumn(F, water);
  }

  /** The column down to the sea bed under the spot (and where it lands): as the spot moves, and once it drops and the spot is fixed. */
  private fitColumn(F: Fall, water: number) {
    F.bed = this.gs.groundUnder(F.x, water + 8) ?? water + 14 * TILE;
    F.col.setDisplaySize(this.fatHalfW() * 2, F.bed - water);
    if (F.shadow) F.shadow.setPosition(F.x, F.bed - 2);
  }

  /** The target on the surface: a bit wider than the falling fish (its picture's drawn at 2×). */
  private targetScale() {
    return (this.fatHalfW() * 2.3) / (TARGET.w * 2);
  }

  /** The warning's up: the Fat Fish turns up at the top of the screen over the spot, hangs there a moment… */
  private appear(F: Fall, water: number) {
    const gs = this.gs;
    F.phase = 'hang';
    F.t = 0;
    const v = gs.viewRect;
    // (up in the sky over the spot, in view: the camera's tipped up to show it)
    F.y = Math.min(v.top + this.fatHalfH() + 14, water - this.fatHalfH() * 0.9);
    F.vy = 0;
    const fw = FISH_SIZE.fat.w * FISH_SCALE.fat * FAT_K;
    const fish = gs.add.sprite(F.x, F.y, 'fish6-fat', 'sw0').setDepth(DEPTH.enemies + 2).setRotation(Math.PI / 2 - 0.12);
    fish.setScale(fw / fish.frame.width);
    F.fish = fish;
    F.streaks = gs.add.image(F.x, F.y, 'chase-streaks').setOrigin(0.5, 1).setDepth(DEPTH.enemies + 1.9).setScale((this.fatHalfW() * 2) / (STREAKS.w * 1.5)).setAlpha(0);
    gs.fx.popText(F.x + this.fatHalfW() + 10, F.y, 'uh oh', '#ffffff', 14);
    // (the sign up top would sit on it: it's done its job)
    if (STYLE.warn === 'c') gs.tweens.add({ targets: [F.sign, F.down].filter(Boolean), alpha: 0, duration: 200 });
  }

  destroy() {
    for (const f of this.fish) {
      f.img.destroy();
      f.wake.destroy();
    }
    this.arrow.destroy();
    this.edge?.destroy();
  }
}
