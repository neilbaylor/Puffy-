import Phaser from 'phaser';
import { DEPTH, GRAVITY, MAX_FALL_SPEED, MIN_VIEW_W, TILE, VIEW_H } from '../config';
import { PROP_RES, addCanvas, ensureLevelLooks, freeLooksExcept, hires } from '../gfx/textures';
import { PALETTES } from '../gfx/world';
import { drawRock } from '../gfx/hazards';
import { POO, POO_DARK } from '../gfx/plopworld';
import { characterById } from '../data/characters';
import type { Session } from '../core/session';
import { lives, loseLife, resetLives } from '../core/lives';
import { sfx } from '../core/sfx';
import type { Enemy } from '../entities/enemies/Enemy';
import { createBadGuy } from '../entities/enemies/Plops';
import { Aura, Checkpoint, Goal, RootBeer } from '../entities/Pickups';
import { Player } from '../entities/Player';
import { Rocket } from '../entities/Rocket';
import { SoccerMatch } from '../entities/Soccer';
import { HockeyMatch } from '../entities/Hockey';
import { VolleyMatch } from '../entities/Volley';
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
/** '#rrggbb' → 0xrrggbb */
const hexOf = (h: string) => parseInt(h.slice(1, 7), 16);
/** Display scale of the Big Plops' poo waves (art is drawn at 3x). */
const POO_S = 1.2 / 3;
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
  private volleys: VolleyMatch[] = [];
  /** Bad guys waiting to drop in by parachute (they fall when you get near), and the ones in the air. */
  private paraWaiting: { kind: EnemyKind; x: number }[] = [];
  private paras: { e: Enemy; chute: Phaser.GameObjects.Image; t: number }[] = [];
  private enemies: Enemy[] = [];
  private rockets: Rocket[] = [];
  private auras: Aura[] = [];
  private rootbeers: RootBeer[] = [];
  private pendingAura: { at: number; p: Player }[] = [];
  private waves: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; dir: number; speed: number; life: number; y: number; t: number; vy: number; poo?: boolean }[] = [];
  private gRootbeer!: Group;
  private checkpoints: Checkpoint[] = [];
  private goal?: Goal;
  /** Plop Invasion: where poo drips from (edges of the poo-covered ground, undersides of islands), and the drops falling. */
  private dripFrom: { x: number; y: number }[] = [];
  private drops: { img: Phaser.GameObjects.Image; vy: number; grow: number }[] = [];
  private dripT = 0;
  /** Puddles of poo (quicksand): their extent, surface, and the picture. */
  private puddles: { x0: number; x1: number; y: number; g: Phaser.GameObjects.Graphics; t: number }[] = [];
  /** Boulder chases: where they start and end, how fast; and the rock while it's rolling. */
  private chases: { x0: number; x1: number; speed: number; started: boolean }[] = [];
  private rock: null | {
    img: Phaser.GameObjects.Image;
    x: number;
    y: number;
    v: number;
    target: number;
    vy: number;
    r: number;
    x1: number;
    falling: boolean;
    rumble: number;
    /** Once it's going over the edge: the middle of the hole it drops into, and the poo puddle there (if any). */
    holeX?: number;
    pool?: { x0: number; x1: number; y: number } | null;
    sinking?: boolean;
  } = null;

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
    this.volleys = [];
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
    this.puddles = [];
    this.dripFrom = [];
    this.drops = [];
    this.chases = [];
    this.rock = null;
    // every level (and every restart at a checkpoint) starts you with one nuggie
    this.aura = 1;
    this.ended = false;
    this.cineZoom = 1;
    this.lastHud = '';
  }

  create() {
    this.levelId = this.data0.level ?? 1;
    const data = (levelInfo(this.levelId).build ?? buildLevel1)();
    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.TILE_BIAS = 24;
    // only the terrain where the camera starts is drawn now (the end of the level, where the
    // fly-over begins, or the checkpoint on a retry); the rest a chunk per frame as it plays,
    // so the level starts without a long pause
    const cpsAt = data.spawns.filter((sp) => sp.type === 'checkpoint').sort((a, b) => a.x - b.x);
    const spawnAt = data.spawns.find((sp) => sp.type === 'player');
    const startCol = this.startCheckpoint >= 0 && cpsAt[this.startCheckpoint] ? cpsAt[this.startCheckpoint].x : (spawnAt?.x ?? 0);
    const firstX = this.retry ? startCol * TILE : data.width * TILE - 300;
    this.level = new LevelView(this, data, { lazyNear: firstX - 500, free: true });
    const { widthPx, heightPx } = this.level;
    this.physics.world.setBounds(0, -400, widthPx, heightPx + 800, true, true, false, false);
    // this level's looks (drawn now if the start screen didn't already); the others are freed
    // when nothing else is showing them
    ensureLevelLooks(this, this.levelId);
    if (!this.scene.isActive('Menu') && !this.scene.isActive('Battle')) freeLooksExcept(this, themesFor(this.levelId));
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
        case 'puddle': {
          const x0 = s.x * TILE;
          const x1 = (s.x + Number(s.opts?.w ?? 4)) * TILE;
          const g = this.add.graphics().setDepth(DEPTH.players + 0.6);
          this.puddles.push({ x0, x1, y: s.y * TILE + 10, g, t: Math.random() * 10 });
          break;
        }
        case 'volley':
          this.volleys.push(new VolleyMatch(this, cx, surface(s.y), Number(s.opts?.w ?? 14)));
          break;
        case 'chase':
          this.chases.push({ x0: s.x * TILE, x1: Number(s.opts?.to ?? s.x + 40) * TILE, speed: Number(s.opts?.speed ?? 1.1), started: false });
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
          this.addEnemy(createBadGuy(this, s.type as EnemyKind, cx, surface(s.y) - 40), surface(s.y));
      }
    }

    // ── Plop Invasion: poo drips off the edges of the ground and the undersides of islands ──
    if (data.pal && PALETTES[data.pal]?.poo) {
      const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < data.width && y < data.height && data.cells[y][x] === 'ground';
      for (let y = 1; y < data.height - 1; y++)
        for (let x = 0; x < data.width; x++) {
          if (!solid(x, y)) continue;
          const top = !solid(x, y - 1);
          if (top && !solid(x + 1, y)) this.dripFrom.push({ x: (x + 1) * TILE - 3, y: y * TILE + 8 });
          if (top && !solid(x - 1, y)) this.dripFrom.push({ x: x * TILE + 3, y: y * TILE + 8 });
          // (the underside of a floating island)
          if (!solid(x, y + 1) && y + 1 < data.height - 1) this.dripFrom.push({ x: x * TILE + 16, y: (y + 1) * TILE + 2 });
        }
      if (!this.textures.exists('pdrop'))
        addCanvas(this, 'pdrop', hires(8, 12, 3, (ctx) => {
          ctx.fillStyle = POO.shade;
          ctx.beginPath();
          ctx.moveTo(4, 0.5);
          ctx.quadraticCurveTo(7.6, 7, 4, 11.5);
          ctx.quadraticCurveTo(0.4, 7, 4, 0.5);
          ctx.fill();
          ctx.fillStyle = POO.base;
          ctx.beginPath();
          ctx.moveTo(4, 1.5);
          ctx.quadraticCurveTo(6.6, 7, 4, 10.5);
          ctx.quadraticCurveTo(1.4, 7, 4, 1.5);
          ctx.fill();
          ctx.fillStyle = '#ffffffaa';
          ctx.beginPath();
          ctx.ellipse(3.2, 7.4, 0.8, 1.4, 0, 0, Math.PI * 2);
          ctx.fill();
        }));
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
    for (const v of this.volleys)
      this.physics.add.overlap(this.gRockets, v.ball, (r) => {
        (r as Rocket).explode();
        v.popBall();
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
      const e = createBadGuy(this, w.kind, w.x, this.view.top - 70);
      this.enemies.push(e);
      this.gEnemies.add(e);
      e.wake();
      e.body.setMaxVelocityY(75);
      const big = w.kind !== 'puffball' && w.kind !== 'plop';
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
    const e = createBadGuy(this, kind, x, groundY - 40);
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

    this.updatePuddles(dt);
    this.updateDrips(dt);
    for (const p of this.players) {
      p.update(dt);
      if (p.alive && p.body.top > this.level.heightPx + 40) p.faint(true);
    }
    // (the rock moves on the same clock as the heroes' physics, even on a slow device)
    this.updateChase(Math.min(deltaMs / 1000, 0.1));

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
    for (const v of this.volleys) v.update(dt);
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
    this.game.events.emit('level-intro', { world: info.world, title: info.title, part: info.part });
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
    const line = levelInfo(this.levelId).speech;
    if (line && this.players[0]) this.time.delayedCall(350, () => this.say(this.players[0], line));
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
    // aim for where the follow camera will actually sit — near the start of a
    // level that's held off the edge, so aiming at the hero itself would slam
    // into the edge mid-flight instead of gliding to a stop
    const vwEnd = this.scale.width / base;
    const endX = Phaser.Math.Clamp(this.players[0]?.x ?? I.x1, vwEnd / 2, Math.max(vwEnd / 2, widthPx - vwEnd / 2));
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
    // a boulder run: the camera eases out so you can see the rock behind you AND the jump
    // at the bottom coming; it eases back in once the rock has gone into the hole
    const chaseTarget = this.rock ? 0.78 : 1;
    this.chaseZoom = snap ? chaseTarget : this.chaseZoom + (chaseTarget - this.chaseZoom) * (1 - Math.exp(-dt * 1.6));
    const zoom = Math.min(this.scale.height / VIEW_H, this.scale.width / MIN_VIEW_W) * this.cineZoom * this.chaseZoom;
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
      // look ahead in the direction of travel, so you can see what's coming; with a boulder
      // rolling after you, look back a bit instead and up the hill, so you can see it coming
      const R = this.rock && !this.rock.falling ? this.rock : null;
      const lookTarget = R ? -vw * 0.08 : tracked.length === 1 ? Phaser.Math.Clamp(sumVx / 3, -90, 90) : 0;
      this.lookAhead += (lookTarget - this.lookAhead) * (snap ? 1 : 1 - Math.exp(-dt * 2.5));
      const tx = (minX + maxX) / 2 + this.lookAhead;
      // keep the hero's feet ~62% down the screen: above the touch controls
      const feet = sumBottom / tracked.length;
      let tTop = feet - vh * 0.62;
      // (the run goes downhill: the jump at the bottom is ahead and below you, so you stay
      // well up the screen; the rock's top is shown if there's room)
      if (R) tTop = Math.max(Math.min(feet - vh * 0.55, R.y - R.r - 30), feet - vh * 0.66);
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
    // (Plop Invasion runs downhill: a gentle lean the other way)
    return this.levelId === 2 ? UPHILL_TILT : this.levelId === 3 ? -UPHILL_TILT * 0.5 : 0;
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
  /**
   * Shake the camera for something heavy happening at (x, y): full strength
   * when it's right there on screen, weaker the further it is from you, and
   * hardly at all once it's well off screen.
   */
  shakeFrom(x: number, y: number, ms: number, intensity: number) {
    const p = this.players.find((q) => q.alive) ?? this.players[0];
    const view = this.cameras.main.worldView;
    const onScreen = x > view.x - 20 && x < view.right + 20 && y > view.y - 40 && y < view.bottom + 60;
    const d = p ? Math.hypot(p.x - x, (p.y - y) * 0.7) : 0;
    // full strength anywhere near you (most of the screen), fading gently further out
    let k = d < 400 ? 1 : Phaser.Math.Clamp(1 - (d - 400) / 1100, 0.3, 1);
    if (!onScreen) k *= 0.35;
    if (k < 0.1) return;
    this.cameras.main.shake(ms * (0.6 + 0.4 * k), intensity * k);
  }

  spawnShockwave(x: number, groundY: number, dir: number, speed: number) {
    groundY = this.surfaceAt(x, groundY);
    // a rolling wall of fire (flickering hand-drawn flames over an orange glow)
    const glow = this.add.image(x, groundY - 16, 'glow').setTint(0xff7a2a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.75).setScale(1.6, 1.1).setDepth(DEPTH_WAVE - 0.1);
    const img = this.add.image(x, groundY + 3, 'flame', 'f0').setOrigin(0.5, 1).setScale(0.1 * FLAME_S, FLAME_S).setFlipX(dir < 0).setDepth(DEPTH_WAVE);
    this.tweens.add({ targets: img, scaleX: FLAME_S, duration: 140, ease: 'Back.easeOut' });
    this.fx.flameBurst(x, groundY);
    this.waves.push({ img, glow, dir, speed, life: 1.5 + FLAME_FADE * 0.85, y: groundY, t: Math.random(), vy: 0 });
  }

  /** A Big Plop's wave of poo: rolls along the ground like the Giants' fire (jump it!), then slumps into a splat. */
  /** The top of the ground at x near groundY (if groundY is inside a hill, the surface above it). */
  private surfaceAt(x: number, groundY: number) {
    let y = groundY;
    for (let i = 0; i < 6 && this.level.isSolidAt(x, y - 4); i++) y -= TILE;
    return y;
  }

  spawnPooWave(x: number, groundY: number, dir: number, speed: number) {
    groundY = this.surfaceAt(x, groundY);
    const glow = this.add.image(x, groundY - 4, 'glow').setTint(0x3a1e0c).setAlpha(0.3).setScale(1.3, 0.35).setDepth(DEPTH_WAVE - 0.1);
    const img = this.add.image(x, groundY + 3, 'poowave', 'w0').setOrigin(0.5, 34 / 36).setScale(0.1 * POO_S, POO_S).setFlipX(dir < 0).setDepth(DEPTH_WAVE);
    this.tweens.add({ targets: img, scaleX: POO_S, duration: 160, ease: 'Back.easeOut' });
    this.fx.pooSplat(x, groundY - 6, 10);
    this.waves.push({ img, glow, dir, speed, life: 1.5 + FLAME_FADE * 0.85, y: groundY, t: Math.random(), vy: 0, poo: true });
  }

  private updateWaves(dt: number) {
    this.waves = this.waves.filter((w) => {
      if (w.poo) return this.updatePooWave(w, dt);
      w.life -= dt;
      w.t += dt;
      // the last stretch of a flame's life: it shrinks, slows, sputters and smokes
      const vigor = Phaser.Math.Clamp(w.life / FLAME_FADE, 0, 1);
      // it rolls along the ground, and falls (with gravity) off ledges and into holes
      const grounded = w.vy === 0 && this.level.isSolidAt(w.img.x, w.y + 6);
      w.img.x += w.dir * w.speed * dt * (0.35 + 0.65 * vigor) * (grounded ? 1 : 0.75);
      if (!grounded) {
        w.vy = Math.min(900, w.vy + 1600 * dt);
        const ny = w.y + w.vy * dt;
        const landY = Math.floor(ny / TILE) * TILE;
        if (this.level.isSolidAt(w.img.x, ny) && !this.level.isSolidAt(w.img.x, landY - 4)) {
          w.y = landY;
          w.vy = 0;
          this.fx.flameBurst(w.img.x, w.y);
        } else w.y = ny;
        if (w.y > this.level.heightPx + 60) {
          w.img.destroy();
          w.glow.destroy();
          return false;
        }
      }
      w.img.y = w.y + 3;
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
      this.fx.flameTrail(w.img.x, w.y, w.dir, vigor);
      // ran into a wall: it burns out there
      if (this.level.isSolidAt(front, w.y - 8)) {
        w.speed = 0;
        if (w.life > FLAME_FADE) w.life = FLAME_FADE;
      }
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

  private updatePooWave(w: (typeof this.waves)[number], dt: number) {
    w.life -= dt;
    w.t += dt;
    const vigor = Phaser.Math.Clamp(w.life / FLAME_FADE, 0, 1);
    const grounded = w.vy === 0 && this.level.isSolidAt(w.img.x, w.y + 6);
    w.img.x += w.dir * w.speed * dt * (0.4 + 0.6 * vigor) * (grounded ? 1 : 0.75);
    if (!grounded) {
      w.vy = Math.min(900, w.vy + 1600 * dt);
      const ny = w.y + w.vy * dt;
      const landY = Math.floor(ny / TILE) * TILE;
      if (this.level.isSolidAt(w.img.x, ny) && !this.level.isSolidAt(w.img.x, landY - 4)) {
        w.y = landY;
        w.vy = 0;
        this.fx.pooSplat(w.img.x, w.y - 4, 8);
      } else w.y = ny;
      if (w.y > this.level.heightPx + 60) {
        w.img.destroy();
        w.glow.destroy();
        return false;
      }
    }
    w.img.y = w.y + 3;
    w.img.setFrame(`w${Math.floor(w.t * 9) % 4}`);
    // it slumps lower as it runs out of push
    w.img.scaleY = POO_S * (0.55 + 0.45 * vigor) * (1 + Math.sin(w.t * 13) * 0.04);
    w.img.scaleX = POO_S * (0.85 + 0.15 * vigor);
    w.glow.setPosition(w.img.x, w.y - 3).setAlpha(0.3 * vigor);
    if (Math.random() < 0.35 * vigor) this.fx.pooSplat(w.img.x - w.dir * 18, w.y - 8, 1);
    const front = w.img.x + w.dir * 22;
    // (a step up stops it dead: it slumps there instead of sliding on into the hill)
    if (this.level.isSolidAt(front, w.y - 8)) {
      w.speed = 0;
      if (w.life > FLAME_FADE) w.life = FLAME_FADE;
    }
    if (w.life <= 0) {
      // it slumps into a flat splat that fades away
      this.fx.pooSplat(w.img.x, w.y - 4, 6);
      const mark = this.add.image(w.img.x, w.y + 2, 'poopile', 'p3').setOrigin(0.5, 1).setScale(1.6 / PROP_RES, 1.2 / PROP_RES).setDepth(DEPTH.tiles + 0.55);
      this.tweens.add({ targets: mark, alpha: 0, delay: 1800, duration: 2200, onComplete: () => mark.destroy() });
      this.tweens.add({ targets: w.img, scaleY: 0.02, alpha: 0, duration: 500, ease: 'Sine.easeIn', onComplete: () => w.img.destroy() });
      this.tweens.add({ targets: w.glow, alpha: 0, duration: 400, onComplete: () => w.glow.destroy() });
      return false;
    }
    if (vigor > 0.35)
      for (const p of this.players) {
        if (!p.alive || p.invulnerable) continue;
        const onWaveLevel = p.bottom > w.y - 20 && p.bottom < w.y + 6;
        if (onWaveLevel && Math.abs(p.x - w.img.x) < 18 + p.body.width / 2) this.hitPlayer(p, w.img.x - w.dir * 30);
      }
    return true;
  }

  // ─────────────────────────────────────────── Plop Invasion: poo puddles, boulder chases ──

  /**
   * Puddles of poo, like quicksand: you sink slowly while you're in one (the
   * picture covers you as you go down), every jump pops you up and on, and if
   * you go right under, that's a life gone.
   */
  private updatePuddles(dt: number) {
    for (const p of this.players) {
      let goo = 0;
      if (p.alive)
        for (const pd of this.puddles) {
          if (p.x < pd.x0 || p.x > pd.x1 || p.bottom <= pd.y) continue;
          goo = p.bottom - pd.y;
          if (p.body.top > pd.y + 3) {
            // sank right under
            this.fx.pooSplat(p.x, pd.y, 18);
            this.fx.popText(p.x, pd.y - 30, 'BLUB!', '#c99064', 20);
            sfx.dribble(1);
            p.faint(true);
            goo = 0;
          }
          break;
        }
      p.goo = goo;
    }
    const left = this.view.left - 40;
    const right = this.view.left + this.view.width + 40;
    for (const pd of this.puddles) {
      pd.t += dt;
      const g = pd.g;
      g.clear();
      if (pd.x1 < left || pd.x0 > right) continue;
      const y = pd.y;
      const bottom = this.level.heightPx + 40;
      // the body of the puddle, all the way down (whatever sinks in it, disappears)
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let x = pd.x0 - 2; x <= pd.x1 + 2; x += 6) pts.push({ x, y: y + Math.sin(x * 0.07 + pd.t * 2.2) * 1.8 + Math.sin(x * 0.19 - pd.t * 3.1) * 0.9 });
      const w = pd.x1 - pd.x0 + 4;
      // deeper = darker, in soft bands (it's thick and glossy, not a slab)
      g.fillStyle(hexOf(POO_DARK.base), 1).fillRect(pd.x0 - 2, y + 8, w, bottom - y);
      g.fillStyle(hexOf(POO.base), 1);
      g.beginPath();
      g.moveTo(pd.x0 - 2, y + 92);
      for (const q of pts) g.lineTo(q.x, q.y);
      g.lineTo(pd.x1 + 2, y + 92);
      g.closePath();
      g.fillPath();
      for (let k = 0; k < 14; k++) g.fillStyle(hexOf(POO_DARK.base), 0.07 + k * 0.066).fillRect(pd.x0 - 2, y + 22 + k * 5, w, 5);
      // slow swirls stirring in it
      for (let i = 0; i < Math.max(2, Math.round(w / 60)); i++) {
        const sx = pd.x0 + ((i + 0.5) / Math.max(2, Math.round(w / 60))) * w + Math.sin(pd.t * 0.5 + i * 2) * 8;
        const sy = y + 20 + ((i * 17) % 3) * 9 + Math.sin(pd.t * 0.8 + i) * 2;
        const a = pd.t * (i % 2 ? 0.9 : -0.9) + i;
        g.lineStyle(2, hexOf(POO.light), 0.32);
        g.beginPath();
        for (let k = 0; k <= 18; k++) {
          const ang = a + k * 0.55;
          const rr = 1.5 + k * 0.45;
          const px = sx + Math.cos(ang) * rr * 1.5;
          const py = sy + Math.sin(ang) * rr * 0.55;
          if (k) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        g.strokePath();
      }
      // glossy streaks just under the surface, drifting
      for (let i = 0; i < Math.max(1, Math.round(w / 90)); i++) {
        const lx = pd.x0 + (((i * 0.43 + pd.t * 0.03) % 1) * (w - 30)) + 6;
        g.fillStyle(0xffffff, 0.16).fillRoundedRect(lx, y + 6 + (i % 2) * 3, 18 + (i % 3) * 6, 2.5, 1.2);
      }
      g.lineStyle(2, 0x3a2418, 1).strokePoints(pts);
      g.lineStyle(1.5, hexOf(POO.light), 0.9);
      g.beginPath();
      pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y + 3) : g.moveTo(q.x, q.y + 3)));
      g.strokePath();
      // bubbles swelling and popping on the surface
      for (let i = 0; i < 4; i++) {
        const ph = (pd.t * 0.6 + i * 0.27) % 1;
        const bx = pd.x0 + ((i * 0.31 + Math.floor(pd.t * 0.6 + i * 0.27) * 0.53) % 1) * (pd.x1 - pd.x0);
        const br = 1.5 + ph * 4;
        g.fillStyle(hexOf(POO.light), 0.9 * (1 - ph * ph)).fillCircle(bx, y + 2 - br * 0.4, br);
        g.lineStyle(1, 0x3a2418, 0.7 * (1 - ph * ph)).strokeCircle(bx, y + 2 - br * 0.4, br);
      }
      // a ring rippling round anyone wading in it
      for (const p of this.players)
        if (p.goo > 0) g.lineStyle(1.5, hexOf(POO.light), 0.7).strokeEllipse(p.x, y + 2, 26 + Math.sin(pd.t * 6) * 4, 5);
    }
  }

  /** Now and then a drop of poo swells at an edge, stretches, falls and splats. */
  private updateDrips(dt: number) {
    if (!this.dripFrom.length) return;
    this.dripT -= dt;
    if (this.dripT <= 0 && this.drops.length < 12) {
      this.dripT = 0.12 + Math.random() * 0.2;
      const v = this.view;
      const near = this.dripFrom.filter((d) => d.x > v.left && d.x < v.left + v.width && d.y > v.top && d.y < v.top + v.height);
      if (near.length) {
        const d = near[Math.floor(Math.random() * near.length)];
        const img = this.add.image(d.x, d.y, 'pdrop').setOrigin(0.5, 0.1).setScale(0.5 / 3, 0.2 / 3).setDepth(DEPTH.tiles + 0.6);
        this.drops.push({ img, vy: 0, grow: 0.5 + Math.random() * 0.6 });
      }
    }
    this.drops = this.drops.filter((d) => {
      if (d.grow > 0) {
        // swelling, stretching...
        d.grow -= dt;
        d.img.setScale(0.6 / 3, Math.min(1, d.img.scaleY * 3 + dt * 1.6) / 3);
        return true;
      }
      // ...then off it goes
      d.vy = Math.min(700, d.vy + 1400 * dt);
      d.img.y += d.vy * dt;
      d.img.setScale(0.55 / 3, 1.1 / 3);
      const hit = this.level.isSolidAt(d.img.x, d.img.y + 4);
      if (hit || d.img.y > this.view.top + this.view.height + 40) {
        if (hit) this.fx.pooSplat(d.img.x, d.img.y, 3);
        d.img.destroy();
        return false;
      }
      return true;
    });
  }

  /** The first solid ground at or below (x, fromY), or null (a pit). */
  private groundUnder(x: number, fromY: number) {
    for (let y = Math.max(0, fromY); y < this.level.heightPx + 16; y += 6) if (this.level.isSolidAt(x, y)) return Math.floor(y / TILE) * TILE;
    return null;
  }

  /**
   * Boulder chases (Plop Invasion): past the marker, a giant rock comes rolling
   * down the hill after you, squashing any Plops in its way. Keep running (you
   * don't tire while it's after you) and jump the chasm at the end: the rock
   * tumbles in.
   */
  private updateChase(dt: number) {
    const hero = this.players.find((p) => p.alive);
    if (!this.rock && hero)
      for (const c of this.chases)
        if (!c.started && hero.x > c.x0) {
          c.started = true;
          this.startChase(c, hero);
          break;
        }
    const R = this.rock;
    for (const p of this.players) p.freeRun = !!R && !R.falling;
    if (!R) return;
    // it hangs right behind you: if you've got well ahead it rolls faster (a bit faster than a run)
    // to stay close; at its own pace it's faster than walking, so keep running!
    if (R.falling) {
      this.updateRockFall(R, dt);
      if (!this.rock) return;
    } else {
      const lead = hero ? hero.x - (R.x + R.r) : 0;
      const want = hero && lead > 70 ? Math.max(R.target, Math.min(Math.abs(hero.body.velocity.x) + 170, hero.char.runSpeed * 1.4)) : R.target;
      R.v += (want - R.v) * (1 - Math.exp(-dt * 1.5));
      R.x += R.v * dt;
      R.img.rotation += (R.v * dt) / R.r;
      const ground = this.groundUnder(R.x, R.y);
      if (ground === null && R.x > R.x1 - R.r * 0.4) {
        // over the edge: it drops straight down the middle of the hole (or into the poo)
        R.falling = true;
        let right = R.x1;
        while (right < R.x1 + 30 * TILE && this.groundUnder(right, R.y - R.r) === null) right += 8;
        R.holeX = (R.x1 + right) / 2;
        R.pool = this.puddles.find((pd) => R.holeX! > pd.x0 && R.holeX! < pd.x1) ?? null;
        sfx.whoosh();
        this.fx.popText(R.x, R.y - R.r - 10, R.pool ? 'SPLOOSH!' : 'BYE ROCK!', '#ffffff', 20);
      } else if (ground === null || ground > R.y + R.r + 2 || R.vy < 0) {
        // in the air: off a step (it bounces down the hill)
        R.vy = Math.min(1400, R.vy + 1600 * dt);
        R.y += R.vy * dt;
        if (ground !== null && R.y + R.r >= ground && R.vy > 0) {
          R.y = ground - R.r;
          if (R.vy > 260) {
            this.shakeFrom(R.x, ground, 180, 0.008);
            this.fx.dust(R.x - R.r * 0.5, ground, 8);
            this.fx.dust(R.x + R.r * 0.5, ground, 8);
            sfx.thud();
            R.vy = -R.vy * 0.25; // a little bounce
          } else R.vy = 0;
        }
      } else {
        R.y = ground - R.r;
        if (Math.random() < 0.5) this.fx.dust(R.x - R.r * 0.7, ground, 1);
      }
    }
    R.img.setPosition(R.x, R.y);
    R.rumble -= dt;
    if (R.rumble <= 0 && !R.falling) {
      R.rumble = 0.22;
      this.shakeFrom(R.x, R.y + R.r, 200, 0.0028);
    }
    // anyone in the way gets flattened (you: knocked on ahead of it, and it costs your aura)
    const hits = (b: Phaser.Physics.Arcade.Body, k = 0.9) => {
      const cx = Phaser.Math.Clamp(R.x, b.left, b.right);
      const cy = Phaser.Math.Clamp(R.y, b.top, b.bottom);
      return Math.hypot(cx - R.x, cy - R.y) < R.r * k;
    };
    if (R.falling) return;
    for (const p of this.players) if (p.alive && !p.invulnerable && hits(p.body)) this.hitPlayer(p, R.x - R.r);
    for (const e of this.enemies)
      if (e.active && !e.dead && hits(e.body, 1)) {
        this.fx.popText(e.x, e.body.top - 10, 'SQUISH!', '#ffffff', 15);
        e.damage(99, 'stomp', null);
      }
  }

  /** The rock going into the hole at the bottom of the run: down the middle, or slowly under the poo. */
  private updateRockFall(R: NonNullable<GameScene['rock']>, dt: number) {
    R.x += (R.holeX! - R.x) * Math.min(1, dt * 7);
    R.v *= Math.exp(-dt * 3);
    R.img.rotation += (R.v * dt) / R.r;
    const pool = R.pool;
    if (pool && R.y + R.r * 0.15 > pool.y) {
      if (!R.sinking) {
        // SPLOOSH: into the poo (under the puddle's picture), sinking slowly out of sight
        R.sinking = true;
        R.img.setDepth(DEPTH.players + 0.5);
        for (let i = -2; i <= 2; i++) this.fx.pooSplat(R.x + i * R.r * 0.4, pool.y, 14);
        this.shakeFrom(R.x, pool.y, 300, 0.01);
        sfx.thud();
        sfx.dribble(1);
      }
      R.vy += (70 - R.vy) * Math.min(1, dt * 5);
      if (Math.random() < 0.2) this.fx.pooSplat(R.x + (Math.random() - 0.5) * R.r * 1.6, pool.y, 4);
    } else R.vy = Math.min(1400, R.vy + 1600 * dt);
    R.y += R.vy * dt;
    R.img.setPosition(R.x, R.y);
    const gone = pool ? R.y - R.r > pool.y + 16 : R.y - R.r > this.level.heightPx + 40;
    if (gone) {
      if (!pool)
        this.time.delayedCall(250, () => {
          sfx.thud();
          this.cameras.main.shake(260, 0.008);
        });
      R.img.destroy();
      this.rock = null;
    }
  }

  private startChase(c: { x0: number; x1: number; speed: number }, hero: Player) {
    if (!this.textures.exists('bigrock'))
      addCanvas(
        this,
        'bigrock',
        hires(42, 42, 12, (ctx) => {
          drawRock(ctx);
          // smeared with poo, like everything else round here
          ctx.fillStyle = POO.base;
          for (const [x, y, rx, ry] of [[14, 12, 5, 3], [29, 27, 6, 3.4], [21, 32, 3.4, 2.2], [32, 13, 2.6, 2]] as const) {
            ctx.beginPath();
            ctx.ellipse(x, y, rx, ry, 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }),
      );
    // (too tall to jump over, even with a double jump; the holes at the bottom are cut to fit it)
    const r = 115;
    // (it bursts in from the edge of the screen, half in view)
    const x = this.view.left - r * 0.5;
    const gy = this.groundUnder(x, this.view.top) ?? hero.bottom;
    const target = Math.min(hero.char.walkSpeed * c.speed, hero.char.runSpeed * 0.95);
    const img = this.add.image(x, gy - r, 'bigrock').setScale((2 * r) / 42 / 12).setDepth(DEPTH.enemies + 2);
    this.rock = { img, x, y: gy - r, v: hero.char.runSpeed, target, vy: 0, r, x1: c.x1, falling: false, rumble: 0 };
    sfx.roar();
    this.cameras.main.shake(400, 0.008);
    this.fx.popText(hero.x, hero.body.top - 36, 'RUN!', '#ffd23f', 30);
  }

  /** A speech bubble over a hero's head for a few seconds. */
  private say(p: Player, text: string) {
    const t = this.add
      .text(0, 0, text, { fontFamily: 'Nunito, sans-serif', fontSize: '12px', fontStyle: '900', color: '#3a2418', align: 'center', wordWrap: { width: 168 } })
      .setOrigin(0.5)
      .setResolution(3);
    const w = t.width + 22;
    const h = t.height + 14;
    const g = this.add.graphics();
    g.fillStyle(0x3a2418, 1).fillRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 12);
    g.fillTriangle(-9, h / 2 - 2, 7, h / 2 - 2, -8, h / 2 + 13);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.fillTriangle(-6.5, h / 2 - 3, 4.5, h / 2 - 3, -6.5, h / 2 + 8.5);
    const c = this.add.container(p.x, p.body.top - 20 - h / 2, [g, t]).setDepth(DEPTH.text + 3).setScale(0.2).setAlpha(0);
    const follow = () => {
      if (!c.active) return;
      const x = Phaser.Math.Clamp(p.x + 6, this.view.left + w / 2 + 8, this.view.left + this.view.width - w / 2 - 8);
      c.setPosition(x, p.body.top - 22 - h / 2);
    };
    follow();
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
    sfx.bump();
    p.squash = { x: 0.8, y: 1.25 };
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: c,
      alpha: 0,
      scale: 0.9,
      delay: 3900,
      duration: 300,
      onComplete: () => {
        this.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
        c.destroy();
      },
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
    const giant = e.kind === 'giant' || e.kind === 'giantplop';
    if (giant) run.giants++;
    else run.popped++;
    const plop = e.kind === 'plop' || e.kind === 'bigplop';
    this.fx.popText(e.x, e.y - e.displayHeight / 2 - 6, e.kind === 'giantplop' ? 'BIG PLOP DOWN!' : giant ? 'GIANT DOWN!' : plop ? 'SPLAT!' : 'POP!', '#ffffff', giant ? 22 : 15);
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

  /**
   * The blast doesn't go through solid ground: a rocket that hits the step under a
   * bad guy shouldn't knock them out. Walk from the bad guy's nearest point back to
   * the blast and stop at the first solid tile (one-way platforms don't block).
   */
  private blastReaches(x: number, y: number, eb: Phaser.Physics.Arcade.Body) {
    const layer = this.level.layer;
    const tx = Phaser.Math.Clamp(x, eb.left + 3, eb.right - 3);
    const ty = Phaser.Math.Clamp(y, eb.top + 3, eb.bottom - 3);
    const d = Math.hypot(x - tx, y - ty);
    const n = Math.ceil(d / 6);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const px = tx + (x - tx) * k;
      const py = ty + (y - ty) * k;
      if (Math.hypot(px - x, py - y) < 6) break; // (the blast point itself sits against the wall it hit)
      const t = layer.getTileAtWorldXY(px, py);
      if (t && t.collideLeft && t.collideRight) return false;
    }
    return true;
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
      if (dx * dx + dy * dy < r * r && this.blastReaches(x, y, eb)) {
        // Big Muscles' first rocket on a tough enemy counts double
        const heavy = owner.char.heavyHitter && e.hp >= 3 && !e.heavyHit;
        if (heavy) e.heavyHit = true;
        e.damage(owner.char.damage + (heavy ? 1 : 0), 'blast', owner);
      }
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
    // no basketball at the end of this one (yet): the level's done at the gate
    if (!levelInfo(this.levelId).hoops) {
      this.time.delayedCall(2200, () => this.game.events.emit('level-complete', { ...res, level: this.levelId } satisfies ResultState));
      return;
    }
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
  /** Eased out during a boulder run (see updateCamera). */
  private chaseZoom = 1;

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
