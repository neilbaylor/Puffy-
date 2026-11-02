import Phaser from 'phaser';
import { DEPTH, GRAVITY, MAX_FALL_SPEED, MIN_VIEW_W, TILE, VIEW_H } from '../config';
import { PROP_RES } from '../gfx/textures';
import { characterById } from '../data/characters';
import type { Session } from '../core/session';
import { lives, loseLife, resetLives } from '../core/lives';
import { sfx } from '../core/sfx';
import { createEnemy, type Enemy } from '../entities/enemies/Enemy';
import { Aura, Checkpoint, Goal, RootBeer } from '../entities/Pickups';
import { Player } from '../entities/Player';
import { Rocket } from '../entities/Rocket';
import { SoccerMatch } from '../entities/Soccer';
import { HockeyMatch } from '../entities/Hockey';
import { soloSource, sourceById } from '../input/devices';
import type { EnemyKind } from '../level/builder';
import { levelInfo } from '../level/levels';
import { buildLevel1 } from '../level/level1';
import { T } from '../level/tiles';
import { Background, type View } from '../world/Background';
import { Ambience } from '../world/Ambience';
import type { HoopsData } from './HoopsScene';
import { Fx } from '../world/Fx';
import { stingerCover } from '../ui/stinger';
import { mixTint, themeClock, themeMix, themesFor } from '../world/theme';
import { LevelView } from '../world/LevelView';

export interface GameData {
  session: Session;
  /** Index of the checkpoint to start from (-1 / undefined = level start). */
  checkpoint?: number;
  /** Which level (1-based; default 1). */
  level?: number;
  /** Restarting after a faint (keeps lives and run stats); otherwise it's a brand-new run. */
  retry?: boolean;
}

export interface HudState {
  charId: string;
  name: string;
  aura: number;
  rootbeer: number;
  stamina: number;
  exhausted: boolean;
  running: boolean;
  /** Spare lives left (3 → 0). */
  lives: number;
}

export interface GameOverState {
  charId: string;
  name: string;
  checkpoint: number;
}

export interface ResultState {
  charId: string;
  name: string;
  aura: number;
  rootbeer: number;
  rootbeerTotal: number;
  popped: number;
  giants: number;
  faints: number;
  lives: number;
  seconds: number;
  /** Which level was cleared (1-based). */
  level?: number;
  /** Final free-throw score vs King Puff Ball, e.g. "4 – 2". */
  hoops?: string;
}

/** Chance that each aura spot in the level actually has aura this time. */
const AURA_CHANCE = 0.6;
const DEPTH_WAVE = 12;
/** Display scale of the Giant's rolling flames (art is drawn at 3x). */
const FLAME_S = 1.25 / 3;
/** A flame spends its last this-many seconds dying down. */
const FLAME_FADE = 1.6; // the burn-out takes its time
/** Max wisps that scatter when you get hit while carrying aura. */
const SCATTER_MAX = 10;

/** Stats that survive restarting at a checkpoint (reset when a new run starts). */
const run = { startedAt: 0, faints: 0, popped: 0, giants: 0, bestAura: 0, rootbeer: new Set<string>() };

/** Root beer is banked across plays (it'll buy things later). */
export const bank = {
  get rootbeer() {
    try {
      return Number(localStorage.getItem('puffy.rootbeer') ?? 0) || 0;
    } catch {
      return 0;
    }
  },
  addRootbeer(n = 1) {
    try {
      localStorage.setItem('puffy.rootbeer', String(this.rootbeer + n));
    } catch {
      /* private mode */
    }
  },
};

type Group = Phaser.GameObjects.Group;

/**
 * Where the flyover is along its path (0…1) for flight time u (0…1). The
 * speed eases up quickly, then slows down over a long, gentle tail (it keeps
 * gliding and settles, rather than braking at the end).
 */
const INTRO_TABLE = (() => {
  const N = 256;
  const v: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const up = Math.min(1, u / 0.18);
    v.push(up * up * (3 - 2 * up) * Math.pow(1 - u, 1.9));
  }
  const p = [0];
  for (let i = 1; i <= N; i++) p.push(p[i - 1] + (v[i - 1] + v[i]) / 2);
  return p.map((x) => x / p[N]);
})();
function introGlide(u: number) {
  const f = Math.max(0, Math.min(1, u)) * (INTRO_TABLE.length - 1);
  const i = Math.floor(f);
  return i >= INTRO_TABLE.length - 1 ? 1 : INTRO_TABLE[i] + (INTRO_TABLE[i + 1] - INTRO_TABLE[i]) * (f - i);
}

/** Camera roll for the mountain climb (radians; the view leans so the ground rises to the right). */
const UPHILL_TILT = -0.06;

export class GameScene extends Phaser.Scene {
  session!: Session;
  level!: LevelView;
  fx!: Fx;
  private bg!: Background;
  private amb!: Ambience;

  players: Player[] = [];
  private matches: SoccerMatch[] = [];
  private hockey: HockeyMatch[] = [];
  /** Bad guys waiting to drop in by parachute (they fall when you get near), and the ones in the air. */
  private paraWaiting: { kind: EnemyKind; x: number }[] = [];
  private paras: { e: Enemy; chute: Phaser.GameObjects.Image; t: number }[] = [];
  private enemies: Enemy[] = [];
  private rockets: Rocket[] = [];
  private auras: Aura[] = [];
  private rootbeers: RootBeer[] = [];
  private pendingAura: { at: number; p: Player }[] = [];
  private waves: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; dir: number; speed: number; life: number; y: number; t: number }[] = [];
  private gRootbeer!: Group;
  private checkpoints: Checkpoint[] = [];
  private goal?: Goal;

  private gPlayers!: Group;
  private gEnemies!: Group;
  private gRockets!: Group;
  private gAuras!: Group;

  aura = 0;
  private startCheckpoint = -1;
  private retry = false;
  /** Which level is being played (1-based). */
  levelId = 1;
  private data0: GameData = { session: { players: [] } };
  private lastCheckpoint = -1;
  private ended = false;
  private lastHud = '';

  private view: View = { left: 0, top: 0, width: 800, height: VIEW_H };
  private camX = 0;
  private camTop = 0;
  private lookAhead = 0;

  constructor() {
    super('Game');
  }

  init(data: GameData) {
    this.data0 = data;
    this.session = data.session;
    this.startCheckpoint = data.checkpoint ?? -1;
    this.lastCheckpoint = this.startCheckpoint;
    this.retry = !!data.retry;
    if (!this.retry) {
      run.startedAt = Date.now();
      run.faints = 0;
      run.popped = 0;
      run.giants = 0;
      run.bestAura = 0;
      run.rootbeer = new Set();
      resetLives();
    }
    this.players = [];
    this.matches = [];
    this.hockey = [];
    this.paraWaiting = [];
    this.paras = [];
    this.enemies = [];
    this.rockets = [];
    this.auras = [];
    this.rootbeers = [];
    this.pendingAura = [];
    this.waves = [];
    this.checkpoints = [];
    this.goal = undefined;
    // restarting at a checkpoint gives you one nuggie to start with
    this.aura = this.retry ? 1 : 0;
    this.ended = false;
    this.cineZoom = 1;
    this.lastHud = '';
  }

  create() {
    this.levelId = this.data0.level ?? 1;
    const data = (levelInfo(this.levelId).build ?? buildLevel1)();
    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.TILE_BIAS = 24;
    this.level = new LevelView(this, data);
    const { widthPx, heightPx } = this.level;
    this.physics.world.setBounds(0, -400, widthPx, heightPx + 800, true, true, false, false);
    this.bg = new Background(this, heightPx - VIEW_H);
    this.amb = new Ambience(this, this.levelId, (x, y, max) => {
      for (let d = 0; d <= max; d += 6) if (this.level.isSolidAt(x, y + d)) return Math.floor((y + d) / TILE) * TILE;
      return null;
    });
    this.applyTheme();
    this.fx = new Fx(this);

    this.gPlayers = this.add.group();
    this.gEnemies = this.add.group();
    this.gRockets = this.add.group();
    this.gAuras = this.add.group();
    this.gRootbeer = this.add.group();

    // ── Spawns ──
    const surface = (row: number) => (row + 1) * TILE; // ground top under something standing in `row`
    let start = { x: 0, y: 0 };
    const cps = data.spawns.filter((s) => s.type === 'checkpoint').sort((a, b) => a.x - b.x);
    for (const s of data.spawns) {
      const cx = s.x * TILE + TILE / 2;
      switch (s.type) {
        case 'player':
          start = { x: cx, y: surface(s.y) - 24 };
          break;
        case 'aura':
          if (Math.random() < AURA_CHANCE) this.addAura(new Aura(this, cx, s.y * TILE + TILE / 2));
          break;
        case 'rootbeer': {
          const id = `${s.x},${s.y}`;
          if (run.rootbeer.has(id)) break; // already grabbed this run
          const rb = new RootBeer(this, cx, s.y * TILE + TILE / 2, id);
          this.rootbeers.push(rb);
          this.gRootbeer.add(rb);
          break;
        }
        case 'checkpoint': {
          const idx = cps.indexOf(s);
          const cp = new Checkpoint(this, cx, surface(s.y), idx);
          if (idx <= this.startCheckpoint) {
            cp.activate(true);
            if (idx === this.startCheckpoint) start = { x: cx + 24, y: surface(s.y) - 24 };
          }
          this.checkpoints.push(cp);
          break;
        }
        case 'goal':
          this.goal = new Goal(this, cx, surface(s.y));
          break;
        case 'tree':
          break;
        case 'hockey':
          this.hockey.push(new HockeyMatch(this, cx, surface(s.y), Number(s.opts?.w ?? 16), String(s.opts?.team ?? 'pppb')));
          break;
        case 'para':
          this.paraWaiting.push({ kind: (s.opts?.kind as EnemyKind) ?? 'puffball', x: cx });
          break;
        case 'soccer':
          this.matches.push(
            new SoccerMatch(this, cx, surface(s.y), Number(s.opts?.w ?? 10), {
              team: String(s.opts?.team ?? 'ppp'),
              big: !!s.opts?.big,
              goals: s.opts?.goals !== false,
              wait: Number(s.opts?.wait ?? 0),
            }),
          );
          break;
        default:
          this.addEnemy(createEnemy(this, s.type as EnemyKind, cx, surface(s.y) - 40), surface(s.y));
      }
    }

    // ── The hero (single player for now; the code supports more later) ──
    const specs = this.session.players.length ? this.session.players : [{ slot: 0, characterId: 'puffy', inputId: 'solo' }];
    specs.forEach((spec, i) => {
      const p = new Player(this, characterById(spec.characterId), sourceById(spec.inputId) ?? soloSource, start.x - i * 28, start.y);
      p.spawnProtection();
      this.players.push(p);
      this.gPlayers.add(p.hitbox);
    });

    // ── Collisions ──
    const layer = this.level.layer;
    this.physics.add.collider(this.gPlayers, layer, (h, t) => this.onPlayerTile(h as Phaser.GameObjects.GameObject, t as Phaser.Tilemaps.Tile));
    this.physics.add.collider(this.gEnemies, layer);
    this.physics.add.collider(this.gAuras, layer);
    this.physics.add.collider(this.gRockets, layer, (r) => (r as Rocket).explode());
    this.physics.add.overlap(this.gPlayers, this.gEnemies, (h, e) => this.onPlayerEnemy(h as Phaser.GameObjects.GameObject, e as Enemy));
    this.physics.add.overlap(this.gRockets, this.gEnemies, (r) => (r as Rocket).explode());
    // games sharing a pitch spot you together
    for (const m of this.matches) for (const o of this.matches) if (o !== m && Math.abs(o.centerX - m.centerX) < 1) m.partners.push(o);
    for (const m of this.matches)
      this.physics.add.overlap(this.gRockets, m.ball, (r) => {
        (r as Rocket).explode();
        m.popBall();
      });
    this.physics.add.overlap(this.gPlayers, this.gAuras, (h, a) => this.collectAura(this.playerOf(h), a as Aura));
    this.physics.add.overlap(this.gPlayers, this.gRootbeer, (h, r) => this.collectRootbeer(this.playerOf(h), r as RootBeer));
    for (const cp of this.checkpoints)
      this.physics.add.overlap(this.gPlayers, cp.zone, () => {
        if (cp.reached) return;
        cp.activate();
        this.lastCheckpoint = Math.max(this.lastCheckpoint, cp.index);
        sfx.checkpoint();
        this.fx.auraSparkle(cp.x, cp.y - 60, 16);
        this.fx.popText(cp.x, cp.y - 112, 'CHECKPOINT', '#3ddc84', 16);
      });
    if (this.goal) this.physics.add.overlap(this.gPlayers, this.goal.zone, (h) => this.reachGoal(this.playerOf(h)));

    // ── Camera ──
    this.camX = start.x;
    this.camTop = heightPx - VIEW_H;
    this.updateCamera(0, true);
    this.intro = null;
    this.introTop = null;
    if (!this.retry) this.startIntro(start.x);
    this.cameras.main.fadeIn(this.retry ? 250 : 400, 255, 248, 236);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.players.forEach((p) => p.destroy()));
    this.game.events.emit('game-start', this, { fresh: !this.retry, atStart: this.startCheckpoint < 0, level: data.name, world: data.world });
    this.emitHud(true);
  }

  private addAura(a: Aura) {
    this.auras.push(a);
    this.gAuras.add(a);
  }

  /** Drop bad guys in by parachute as you approach, and float them down. */
  private updateParachutes(dt: number) {
    const right = this.view.left + this.view.width;
    this.paraWaiting = this.paraWaiting.filter((w) => {
      if (right < w.x - 60) return true;
      const e = createEnemy(this, w.kind, w.x, this.view.top - 70);
      this.enemies.push(e);
      this.gEnemies.add(e);
      e.wake();
      e.body.setMaxVelocityY(75);
      const big = w.kind !== 'puffball';
      const chute = this.add.image(e.x, e.body.top, 'chute').setOrigin(0.5, 58 / 60).setScale((big ? 1.5 : 1.05) / 3).setDepth(e.depth - 0.5);
      this.paras.push({ e, chute, t: Math.random() * 6 });
      return false;
    });
    this.paras = this.paras.filter((p) => {
      p.t += dt;
      const landed = !p.e.active || p.e.dead || p.e.body.blocked.down;
      if (landed) {
        // let go: the chute floats off and fades
        if (p.e.active) {
          p.e.body.setMaxVelocityY(MAX_FALL_SPEED);
          p.e.setRotation(0);
        }
        this.tweens.add({ targets: p.chute, y: p.chute.y - 60, x: p.chute.x + 30, angle: 40, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => p.chute.destroy() });
        return false;
      }
      const sway = Math.sin(p.t * 2.2);
      p.chute.setPosition(p.e.x, p.e.body.top + 2).setRotation(sway * 0.12);
      p.e.setRotation(sway * 0.08);
      return true;
    });
  }

  /** Spawn an enemy standing on the ground at `groundY` (used by level spawns and for testing). */
  spawnEnemy(kind: EnemyKind, x: number, groundY: number) {
    const e = createEnemy(this, kind, x, groundY - 40);
    this.addEnemy(e, groundY);
    return e;
  }

  /** Add an enemy standing on the ground at `groundY` (whatever its sprite's size/scale). */
  addEnemy(e: Enemy, groundY: number) {
    e.body.updateFromGameObject();
    e.y += groundY - e.body.bottom;
    e.syncBody();
    this.enemies.push(e);
    this.gEnemies.add(e);
  }

  private playerOf(h: unknown): Player {
    return (h as Phaser.GameObjects.GameObject).getData('player') as Player;
  }

  // ───────────────────────────────────────────── frame loop ──

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    if (this.intro) return this.updateIntro(dt);

    for (const p of this.players) {
      p.update(dt);
      if (p.alive && p.body.top > this.level.heightPx + 40) p.faint(true);
    }

    this.updateCamera(dt);
    if (this.players.length > 1)
      for (const p of this.players) p.clampTo(this.view.left + 4, this.view.left + this.view.width - 4);
    for (const p of this.players) p.sync(dt);

    // wake enemies as they come into view
    const wakeR = this.view.left + this.view.width + 48;
    const wakeL = this.view.left - 48;
    this.enemies = this.enemies.filter((e) => e.active);
    for (const e of this.enemies) {
      if (!e.awake && !e.dead && e.body.left < wakeR && e.body.right > wakeL) e.wake();
      e.update(dt);
    }

    this.rockets = this.rockets.filter((r) => r.active);
    for (const r of this.rockets) {
      r.tick(dt);
      if (r.active && (r.x < this.view.left - 40 || r.x > this.view.left + this.view.width + 40)) r.fizzle();
    }

    const now = this.time.now;
    this.auras = this.auras.filter((a) => a.tick(now, dt));
    this.rootbeers = this.rootbeers.filter((r) => r.tick(now));
    this.settleAura();
    this.updateWaves(dt);
    for (const m of this.matches) m.update(dt);
    for (const h of this.hockey) h.update(dt);
    this.updateParachutes(dt);

    themeClock.t += dt;
    this.applyTheme();
    this.level.animate(this.time.now / 1000, this.view.left, this.view.left + this.view.width);
    this.bg.update(this.view, dt);
    this.updateAmbience(dt);
    this.emitHud();
  }

  /** Shadows, critters and sunlight (visual only). */
  private updateAmbience(dt: number) {
    const targets: { obj: Phaser.GameObjects.GameObject; x: number; bottom: number; w: number; alive: boolean }[] = [];
    for (const p of this.players) {
      this.amb.shadowFor(p.view);
      targets.push({ obj: p.view, x: p.x, bottom: p.bottom, w: p.body.width * 1.3, alive: p.state !== 'fainted' });
    }
    for (const e of this.enemies) {
      if (!e.active) continue;
      this.amb.shadowFor(e);
      targets.push({ obj: e, x: e.x, bottom: e.body.bottom, w: e.body.width * 1.15, alive: !e.dead && e.awake });
    }
    this.amb.update(this.view, dt, targets);
  }

  // ─────────────────────────────────────────── level intro flyover ──

  /** The flyover camera: x centre, zoom (× normal), rotation and how far above the ground it rides. */
  private intro: null | { u: number; x0: number; x1: number; phase: 'fly' | 'done' } = null;

  /**
   * A cinematic at the start of a level, like a camera drone: it starts close in
   * over the goal at the far end, then flies back along the whole level while
   * slowly pulling out, drifting up and down and banking a little — and it
   * arrives on the hero at exactly the normal framing (zoom 1, no tilt, no
   * motion left), so the game simply starts from there.
   */
  private startIntro(startX: number) {
    const { widthPx } = this.level;
    this.physics.world.pause();
    this.intro = { u: 0, x0: widthPx - 300, x1: startX, phase: 'fly' };
    this.introU = 0;
    const info = levelInfo(this.levelId);
    this.game.events.emit('level-intro', { world: 'World 1', title: info.title, part: info.part });
    const tw = this.tweens.add({ targets: this.intro, u: 1, duration: 6400, ease: 'Linear', onComplete: () => this.endIntro() });
    // skipping just fast-forwards the same flight (still lands smoothly)
    this.introSkip = () => tw.setTimeScale(5);
    this.game.events.once('skip-intro', this.introSkip);
  }

  private introSkip: (() => void) | null = null;
  private introTop: number | null = null;
  private introU = 0;

  private endIntro() {
    if (!this.intro) return;
    if (this.introSkip) this.game.events.off('skip-intro', this.introSkip);
    this.intro = null;
    this.cameras.main.setRotation(this.uphill);
    this.physics.world.resume();
    // no snap: the normal follow camera picks up exactly where the flight left off
    this.updateCamera(0);
    for (const p of this.players) p.spawnProtection();
    this.game.events.emit('level-intro-end');
  }

  private updateIntro(dt: number) {
    const I = this.intro!;
    const u = I.u;
    const cam = this.cameras.main;
    const smooth = (a: number, b: number, t: number) => {
      const k = Phaser.Math.Clamp((t - a) / (b - a), 0, 1);
      return k * k * k * (k * (k * 6 - 15) + 10);
    };
    // pull out from close-in to the normal zoom, easing to a stop at the end
    const zoomK = 1 + 0.42 * Math.pow(1 - u, 3);
    // banking: a couple of slow swings that fade out completely before the end
    const fade = 1 - smooth(0.5, 0.96, u);
    const rot = (0.045 * Math.sin(u * Math.PI * 2.2 + 0.5) + 0.018 * Math.sin(u * Math.PI * 5.3)) * fade;
    // height above the ground: rises like a drone, dips, settles
    const lift = (55 * Math.sin(Math.min(1, u * 1.25) * Math.PI) + 18 * Math.sin(u * Math.PI * 3.1)) * fade;
    const base = Math.min(this.scale.height / VIEW_H, this.scale.width / MIN_VIEW_W);
    const zoom = base * zoomK;
    const vw = this.scale.width / zoom;
    const vh = this.scale.height / zoom;
    const { widthPx, heightPx } = this.level;
    const endX = this.players[0]?.x ?? I.x1;
    const rawX = I.x0 + (endX - I.x0) * introGlide(u);
    const x = Phaser.Math.Clamp(rawX, vw / 2, Math.max(vw / 2, widthPx - vw / 2));
    const clampTop = (t: number) => Phaser.Math.Clamp(t, Math.min(0, heightPx - vh), heightPx - vh);
    // ride above the terrain (it climbs on the mountain), then blend onto the hero's framing
    // spatially smoothed ground height under the view (smooth because x moves smoothly),
    // so the camera keeps up with steep slopes without lagging behind them
    let surf = 0;
    let wsum = 0;
    for (let k = -4; k <= 4; k++) {
      const sy = this.level.surfaceY(Phaser.Math.Clamp(x + k * vw * 0.12, 0, widthPx - 1));
      if (sy >= heightPx) continue; // a pit: no ground to frame
      const w = 5 - Math.abs(k);
      surf += w * sy;
      wsum += w;
    }
    surf = wsum ? surf / wsum : heightPx - TILE * 3;
    const terrainTop = clampTop(surf - vh * 0.58);
    // smoothing tied to how far the flight has progressed (not to the frame rate)
    const du = Math.max(0, u - this.introU);
    this.introU = u;
    this.introTop = this.introTop === null ? terrainTop : this.introTop + (terrainTop - this.introTop) * (1 - Math.exp(-du * 60));
    const p = this.players[0];
    const heroTop = clampTop(p ? p.bottom - vh * 0.62 : heightPx - vh);
    const land = smooth(0.62, 1, u);
    const top = this.introTop + (heroTop - this.introTop) * land - lift;
    cam.setZoom(zoom);
    cam.setRotation(rot + this.uphill * smooth(0.35, 1, u));
    cam.centerOn(x, top + vh / 2);
    this.camX = x;
    this.camTop = top;
    // the background is drawn a bit oversize so the tilt never shows an edge
    this.view = { left: x - vw / 2 - 60, top: top - 60, width: vw + 120, height: vh + 120 };
    for (const pl of this.players) pl.sync(dt);
    themeClock.t += dt;
    this.applyTheme();
    this.level.animate(this.time.now / 1000, this.view.left, this.view.left + this.view.width);
    this.bg.update(this.view, dt);
    this.updateAmbience(dt);
  }

  private updateCamera(dt: number, snap = false) {
    const cam = this.cameras.main;
    // Fit VIEW_H world px vertically, but always show at least MIN_VIEW_W across
    // (so 4:3 iPads and 16:10 Android tablets see enough of the level ahead).
    const zoom = Math.min(this.scale.height / VIEW_H, this.scale.width / MIN_VIEW_W) * this.cineZoom;
    cam.setZoom(zoom);
    cam.setRotation(this.uphill);
    const vw = this.scale.width / zoom;
    const vh = this.scale.height / zoom;
    const { widthPx, heightPx } = this.level;

    const tracked = this.players.filter((p) => p.state !== 'fainted');
    if (tracked.length) {
      let minX = Infinity;
      let maxX = -Infinity;
      let sumBottom = 0;
      let sumVx = 0;
      for (const p of tracked) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        sumBottom += p.bottom;
        sumVx += p.body.velocity.x;
      }
      // look ahead in the direction of travel, so you can see what's coming
      const lookTarget = tracked.length === 1 ? Phaser.Math.Clamp(sumVx / 3, -90, 90) : 0;
      this.lookAhead += (lookTarget - this.lookAhead) * (snap ? 1 : 1 - Math.exp(-dt * 2.5));
      const tx = (minX + maxX) / 2 + this.lookAhead;
      // keep the hero's feet ~62% down the screen: above the touch controls
      const tTop = sumBottom / tracked.length - vh * 0.62;
      this.camX += (tx - this.camX) * (snap ? 1 : 1 - Math.exp(-dt * 7));
      this.camTop += (tTop - this.camTop) * (snap ? 1 : 1 - Math.exp(-dt * 4));
    }
    this.camX = Phaser.Math.Clamp(this.camX, vw / 2, Math.max(vw / 2, widthPx - vw / 2));
    this.camTop = Phaser.Math.Clamp(this.camTop, Math.min(0, heightPx - vh), heightPx - vh);

    const left = Math.round((this.camX - vw / 2) * zoom) / zoom;
    const top = Math.round(this.camTop * zoom) / zoom;
    cam.centerOn(left + vw / 2, top + vh / 2);
    // a tilted view shows a little past each edge: draw the scenery a bit wider
    const m = this.uphill ? Math.abs(this.uphill) * Math.max(vw, vh) * 0.6 : 0;
    this.view = { left: left - m, top: top - m, width: vw + m * 2, height: vh + m * 2 };
  }

  /** Part 2 is a climb: the whole view leans uphill a touch, so it always feels like going up. */
  private get uphill() {
    return this.levelId === 2 ? UPHILL_TILT : 0;
  }

  // ─────────────────────────────────────────── interactions ──

  private onPlayerTile(hitbox: Phaser.GameObjects.GameObject, tile: Phaser.Tilemaps.Tile) {
    const p = this.playerOf(hitbox);
    if (!p.alive) return;
    // thorny brambles hurt when you touch them
    if (tile.index === T.BRAMBLE) {
      const wasDown = p.body.blocked.down;
      this.hitPlayer(p, p.x - p.facing * 10);
      if (p.alive && wasDown) p.body.setVelocityY(-480);
    }
  }

  /** Something hurt the player: lose your aura if you have any, otherwise faint. */
  hitPlayer(p: Player, fromX: number) {
    if (!p.alive || p.invulnerable) return;
    if (this.aura > 0) {
      const n = Math.min(this.aura, SCATTER_MAX);
      for (let i = 0; i < n; i++) this.addAura(new Aura(this, p.x, p.y - 10, true)); // nuggies scatter (grab some back!)
      this.aura = 0;
      p.knockBack(fromX);
      this.fx.auraSparkle(p.x, p.y, 14);
    } else {
      p.faint(false);
    }
  }

  /** Grab a nuggie: it flies into the hero's mouth, they munch it, then aura goes up. */
  private collectAura(p: Player, a: Aura) {
    if (!p.alive || a.taken) return;
    // freshly scattered nuggies can't be grabbed for a split second
    if (this.time.now < a.collectableAt) return;
    const nug = this.add.image(a.x, a.y, 'nuggie').setScale(1 / 3).setDepth(p.view.depth + 1);
    a.vanish();
    this.fx.sparkle(a.x, a.y, 5);
    // pop! (it jumps up, bigger) then arcs into the mouth, spinning and shrinking
    this.tweens.add({ targets: nug, scale: 0.5, y: a.y - 10, duration: 90, ease: 'Back.easeOut' });
    const from = { x: a.x, y: a.y - 10 };
    const fly = { t: 0 };
    this.tweens.add({
      targets: fly,
      t: 1,
      delay: 90,
      duration: 190,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        const m = p.mouth;
        const t = fly.t;
        nug.setPosition(from.x + (m.x - from.x) * t, from.y + (m.y - from.y) * t - Math.sin(t * Math.PI) * 22);
        nug.setScale(0.5 - 0.36 * t).setAngle(t * 300 * (p.facing || 1));
      },
      onComplete: () => {
        nug.destroy();
        sfx.chomp();
        p.eat();
        this.fx.popText(p.mouth.x + p.facing * 6, p.mouth.y - 14, 'NOM!', '#ffd27a', 13);
        this.pendingAura.push({ at: this.time.now + 470, p });
      },
    });
  }

  /** A giant's landing shockwave: rolls along the ground; jump over it. */
  spawnShockwave(x: number, groundY: number, dir: number, speed: number) {
    // a rolling wall of fire (flickering hand-drawn flames over an orange glow)
    const glow = this.add.image(x, groundY - 16, 'glow').setTint(0xff7a2a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.75).setScale(1.6, 1.1).setDepth(DEPTH_WAVE - 0.1);
    const img = this.add.image(x, groundY + 3, 'flame', 'f0').setOrigin(0.5, 1).setScale(0.1 * FLAME_S, FLAME_S).setFlipX(dir < 0).setDepth(DEPTH_WAVE);
    this.tweens.add({ targets: img, scaleX: FLAME_S, duration: 140, ease: 'Back.easeOut' });
    this.fx.flameBurst(x, groundY);
    this.waves.push({ img, glow, dir, speed, life: 1.5 + FLAME_FADE * 0.85, y: groundY, t: Math.random() });
  }

  private updateWaves(dt: number) {
    this.waves = this.waves.filter((w) => {
      w.life -= dt;
      w.t += dt;
      // the last stretch of a flame's life: it shrinks, slows, sputters and smokes
      const vigor = Phaser.Math.Clamp(w.life / FLAME_FADE, 0, 1);
      w.img.x += w.dir * w.speed * dt * (0.35 + 0.65 * vigor);
      // full flames loop through 8 frames; as it burns out it breaks up into small
      // sputtering flickers over glowing coals
      const dying = vigor < 0.42;
      w.img.setFrame(dying ? `d${Math.floor(w.t * 9) % 4}` : `f${Math.floor(w.t * (14 + 8 * vigor)) % 8}`);
      const sputter = vigor < 1 ? (Math.random() < 0.2 ? 0.82 : 1) : 1;
      w.img.scaleY = FLAME_S * (dying ? 0.85 + 0.5 * vigor : 0.7 + 0.3 * vigor) * (1 + Math.sin(w.t * 23) * 0.05) * sputter;
      w.img.scaleX = FLAME_S * (dying ? 0.95 : 0.8 + 0.2 * vigor);
      w.img.setAlpha(dying ? 0.7 + 0.3 * (vigor / 0.42) : 1);
      w.glow.setPosition(w.img.x, w.y - 16).setAlpha((0.6 + Math.sin(w.t * 31) * 0.15) * vigor).setScale(1.6 * (0.5 + 0.5 * vigor), 1.1 * (0.5 + 0.5 * vigor));
      const front = w.img.x + w.dir * 20;
      const groundAhead = this.level.isSolidAt(front, w.y + 6) && !this.level.isSolidAt(front, w.y - 8);
      this.fx.flameTrail(w.img.x, w.y, w.dir, vigor);
      if (!groundAhead && w.life > FLAME_FADE) w.life = FLAME_FADE; // reached an edge: start dying there
      if (w.life <= 0) {
        // the last flicker sinks into a curl of smoke and a few embers, leaving a scorch mark
        this.fx.flameDie(w.img.x, w.y);
        const mark = this.add.image(w.img.x, w.y + 1, 'scorch').setScale(1 / PROP_RES).setDepth(DEPTH.tiles + 0.55).setAlpha(0.9);
        this.tweens.add({ targets: mark, alpha: 0, delay: 1500, duration: 2500, onComplete: () => mark.destroy() });
        this.tweens.add({ targets: w.img, scaleY: 0.02, scaleX: FLAME_S * 0.4, alpha: 0, duration: 1400, ease: 'Sine.easeIn', onComplete: () => w.img.destroy() });
        this.tweens.add({ targets: w.glow, alpha: 0, duration: 600, onComplete: () => w.glow.destroy() });
        return false;
      }
      if (vigor > 0.4)
        for (const p of this.players) {
          if (!p.alive || p.invulnerable) continue;
          const onWaveLevel = p.bottom > w.y - 18 && p.bottom < w.y + 6;
          if (onWaveLevel && Math.abs(p.x - w.img.x) < 16 + p.body.width / 2) this.hitPlayer(p, w.img.x - w.dir * 30);
        }
      return true;
    });
  }

  /** A glowing ring that swells out from the hero when the aura goes up. */
  private auraRing(p: Player) {
    const ring = this.add.graphics().setDepth(p.view.depth - 1).setBlendMode(Phaser.BlendModes.ADD);
    const st = { r: 8, a: 0.9 };
    this.tweens.add({
      targets: st,
      r: 46,
      a: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(4, 0x6ff0d8, st.a).strokeCircle(p.x, p.y - 4, st.r);
        ring.lineStyle(2, 0xe6fffa, st.a * 0.8).strokeCircle(p.x, p.y - 4, st.r * 0.7);
      },
      onComplete: () => ring.destroy(),
    });
    p.squash = { x: 0.9, y: 1.14 };
  }

  /** Aura goes up once the munch animation has played. */
  private settleAura() {
    const now = this.time.now;
    this.pendingAura = this.pendingAura.filter(({ at, p }) => {
      if (now < at) return true;
      if (p.state === 'fainted') return false;
      this.aura++;
      run.bestAura = Math.max(run.bestAura, this.aura);
      this.fx.auraSparkle(p.x, p.y - 6, 16);
      this.auraRing(p);
      this.fx.popText(p.x, p.body.top - 18, '+1 AURA', '#6ff0d8', 17);
      sfx.aura();
      return false;
    });
  }

  private collectRootbeer(p: Player, r: RootBeer) {
    if (!p.alive || r.taken) return;
    run.rootbeer.add(r.id);
    bank.addRootbeer(1);
    this.fx.sparkle(r.x, r.y, 10);
    this.fx.popText(r.x, r.y - 18, '+1 ROOT BEER', '#ffc58a', 14);
    sfx.rootbeer();
    // fly up to the HUD counter
    const fly = this.add.image(r.x, r.y, 'rootbeer').setScale(1 / 3).setDepth(1000);
    r.vanish();
    this.tweens.add({ targets: fly, y: fly.y - 60, alpha: 0, scale: 0.5, duration: 420, ease: 'Quad.easeOut', onComplete: () => fly.destroy() });
    this.lastHud = '';
  }

  private onPlayerEnemy(hitbox: Phaser.GameObjects.GameObject, e: Enemy) {
    const p = this.playerOf(hitbox);
    if (!p.alive || e.dead || this.time.now < e.touchGraceUntil) return;
    const pb = p.body;
    const eb = e.body;
    const prevBottom = pb.prev.y + pb.height;
    const fromAbove = pb.velocity.y > 0 && prevBottom <= eb.top + 8;
    if (fromAbove && e.bouncyTop) {
      p.bounce();
      pb.y = eb.top - pb.height;
      return;
    }
    if (fromAbove && e.stompable) {
      e.damage(1, 'stomp', p);
      e.touchGraceUntil = this.time.now + 250;
      p.bounce();
      pb.y = eb.top - pb.height;
      return;
    }
    this.hitPlayer(p, e.x);
  }

  onEnemyDefeated(e: Enemy, by: Player | null) {
    if (!by) return;
    if (e.kind === 'giant') run.giants++;
    else run.popped++;
    this.fx.popText(e.x, e.y - e.displayHeight / 2 - 6, e.kind === 'giant' ? 'GIANT DOWN!' : 'POP!', '#ffffff', e.kind === 'giant' ? 22 : 15);
  }

  // ─────────────────────────────────────────── bazooka ──

  fireRocket(p: Player) {
    const x = p.x + p.facing * 24 * p.char.scale;
    const y = p.bottom - (p.char.muzzleY ?? 18);
    sfx.shoot();
    this.fx.muzzle(x, y, p.facing, p.x - p.facing * 18);
    if (this.level.isSolidAt(x, y) && this.level.layer.getTileAtWorldXY(x, y)?.index !== T.CLOUD) {
      this.explode(x, y, p); // muzzle is inside a wall: explode right there
      return;
    }
    const r = new Rocket(this, p, x, y, p.facing);
    this.rockets.push(r);
    this.gRockets.add(r);
  }

  explode(x: number, y: number, owner: Player) {
    const r = owner.char.blastRadius;
    this.fx.explosion(x, y, r);
    sfx.explode();
    this.cameras.main.shake(140, 0.005 * (r / 56));

    for (const e of this.enemies) {
      if (e.dead) continue;
      const eb = e.body;
      const dx = Math.max(eb.left - x, 0, x - eb.right);
      const dy = Math.max(eb.top - y, 0, y - eb.bottom);
      if (dx * dx + dy * dy < r * r) e.damage(owner.char.damage, 'blast', owner);
    }

    // blast puff boulders
    const layer = this.level.layer;
    const br = r * 0.72;
    let broke = false;
    for (let ty = Math.floor((y - br) / TILE); ty <= Math.floor((y + br) / TILE); ty++)
      for (let tx = Math.floor((x - br) / TILE); tx <= Math.floor((x + br) / TILE); tx++) {
        const t = layer.getTileAt(tx, ty);
        if (!t || t.index !== T.BOULDER) continue;
        const dx = Math.max(t.pixelX - x, 0, x - (t.pixelX + TILE));
        const dy = Math.max(t.pixelY - y, 0, y - (t.pixelY + TILE));
        if (dx * dx + dy * dy >= br * br) continue;
        layer.removeTileAt(tx, ty);
        const key = `${tx},${ty}`;
        this.level.boulderSprites.get(key)?.destroy();
        this.level.boulderSprites.delete(key);
        this.fx.debris(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
        broke = true;
      }
    if (broke) {
      sfx.crumble();
      this.collapseBoulders();
    }
  }

  /** Boulders with nothing under them tumble down (so a blasted wall never floats). */
  private collapseBoulders() {
    const layer = this.level.layer;
    let changed = true;
    let wave = 0;
    while (changed) {
      changed = false;
      wave++;
      for (const [key, img] of [...this.level.boulderSprites]) {
        const [tx, ty] = key.split(',').map(Number);
        const below = layer.getTileAt(tx, ty + 1);
        if (below && below.index !== T.EMPTY) continue;
        layer.removeTileAt(tx, ty);
        this.level.boulderSprites.delete(key);
        changed = true;
        this.tweens.add({
          targets: img,
          y: img.y + 40,
          angle: Phaser.Math.Between(-40, 40),
          alpha: 0,
          delay: wave * 60,
          duration: 260,
          ease: 'Quad.easeIn',
          onComplete: () => {
            this.fx.debris(img.x + 16, img.y + 16);
            img.destroy();
          },
        });
      }
    }
  }

  nearestPlayer(x: number, y: number): Player | null {
    let best: Player | null = null;
    let bd = Infinity;
    for (const p of this.players) {
      if (!p.alive) continue;
      const d = Phaser.Math.Distance.Squared(x, y, p.x, p.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  // ─────────────────────────────────────────── faint, restart, goal ──

  onPlayerFainted(p: Player) {
    run.faints++;
    this.aura = 0;
    const fell = !p.view.visible;
    const hadLife = loseLife();
    this.emitHud(true);
    this.time.delayedCall(fell ? 700 : 1500, () => {
      if (!hadLife) {
        // out of lives: game over
        this.ended = true;
        this.game.events.emit('game-over', { charId: p.char.id, name: p.char.name, checkpoint: this.lastCheckpoint } satisfies GameOverState);
        return;
      }
      this.cameras.main.fadeOut(300, 255, 248, 236);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
        this.scene.restart({ session: this.session, checkpoint: this.lastCheckpoint, retry: true, level: this.levelId } satisfies GameData),
      );
    });
  }

  private reachGoal(p: Player) {
    if (this.ended || !p.alive || !this.goal) return;
    this.ended = true;
    this.goal.celebrate();
    sfx.goal();
    this.fx.auraSparkle(this.goal.swirl.x, this.goal.swirl.y, 30);
    for (const q of this.players) if (q.alive) q.finish();
    for (const e of this.enemies) if (e.active && !e.dead && e.awake) e.damage(99, 'blast', null);
    const res: ResultState = {
      charId: p.char.id,
      name: p.char.name,
      aura: this.aura,
      rootbeer: run.rootbeer.size,
      rootbeerTotal: bank.rootbeer,
      popped: run.popped,
      giants: run.giants,
      faints: run.faints,
      lives: lives.left,
      seconds: Math.round((Date.now() - run.startedAt) / 1000),
    };
    // ── transition to King Puff Ball's Basketball Palace ──
    // the world rumbles, the camera pushes in on the hero, a flash, then the palace
    this.tweens.add({
      targets: this,
      cineZoom: 2.3,
      delay: 700,
      duration: 1300,
      ease: 'Cubic.easeIn',
      onStart: () => {
        sfx.drum();
        this.cameras.main.shake(1300, 0.006);
      },
      onComplete: () => {
        // broadcast stinger: bars sweep across, the palace is revealed underneath
        this.cameras.main.flash(200, 255, 240, 200);
        sfx.whoosh();
        void stingerCover().then(() =>
          this.scene.start('Hoops', { session: this.session, charId: p.char.id, checkpoint: this.lastCheckpoint, level: this.levelId, result: res } satisfies HoopsData),
        );
      },
    });
  }

  /** The look clock (exposed for testing). */
  readonly themeClock = themeClock;

  /** The scenery drifts slowly between looks while you play. */
  private applyTheme() {
    const m = themeMix(themeClock.t, themesFor(this.levelId));
    this.bg.setTheme(m);
    this.level.setTint(mixTint(m));
  }

  /** Extra camera zoom for cinematic moments. */
  cineZoom = 1;

  private emitHud(force = false) {
    const p = this.players[0];
    if (!p) return;
    const s: HudState = {
      charId: p.char.id,
      name: p.char.name,
      aura: this.aura,
      rootbeer: bank.rootbeer,
      stamina: Math.round(p.stamina * 100) / 100,
      exhausted: p.exhausted,
      running: p.running,
      lives: lives.left,
    };
    const key = `${s.lives}|${s.aura}|${s.rootbeer}|${s.stamina}|${s.exhausted}|${s.running}`;
    if (!force && key === this.lastHud) return;
    this.lastHud = key;
    this.game.events.emit('hud', s);
  }
}
