import Phaser from 'phaser';
import { GRAVITY, MIN_VIEW_W, TILE, VIEW_H } from '../config';
import { characterById } from '../data/characters';
import type { Session } from '../core/session';
import { sfx } from '../core/sfx';
import { createEnemy, type Enemy } from '../entities/enemies/Enemy';
import { Aura, Checkpoint, Goal } from '../entities/Pickups';
import { Player } from '../entities/Player';
import { Rocket } from '../entities/Rocket';
import { soloSource, sourceById } from '../input/devices';
import type { EnemyKind } from '../level/builder';
import { buildLevel1 } from '../level/level1';
import { T } from '../level/tiles';
import { Background, type View } from '../world/Background';
import { Fx } from '../world/Fx';
import { LevelView } from '../world/LevelView';

export interface GameData {
  session: Session;
  /** Index of the checkpoint to start from (-1 / undefined = level start). */
  checkpoint?: number;
}

export interface HudState {
  charId: string;
  name: string;
  aura: number;
  stamina: number;
  exhausted: boolean;
  running: boolean;
}

export interface ResultState {
  charId: string;
  name: string;
  aura: number;
  popped: number;
  giants: number;
  faints: number;
  seconds: number;
}

/** Chance that each aura spot in the level actually has aura this time. */
const AURA_CHANCE = 0.65;
/** Max wisps that scatter when you get hit while carrying aura. */
const SCATTER_MAX = 10;

/** Stats that survive restarting at a checkpoint (reset when a new run starts). */
const run = { startedAt: 0, faints: 0, popped: 0, giants: 0, bestAura: 0 };

type Group = Phaser.GameObjects.Group;

export class GameScene extends Phaser.Scene {
  session!: Session;
  level!: LevelView;
  fx!: Fx;
  private bg!: Background;

  players: Player[] = [];
  private enemies: Enemy[] = [];
  private rockets: Rocket[] = [];
  private auras: Aura[] = [];
  private checkpoints: Checkpoint[] = [];
  private goal?: Goal;

  private gPlayers!: Group;
  private gEnemies!: Group;
  private gRockets!: Group;
  private gAuras!: Group;

  aura = 0;
  private startCheckpoint = -1;
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
    this.session = data.session;
    this.startCheckpoint = data.checkpoint ?? -1;
    this.lastCheckpoint = this.startCheckpoint;
    if (this.startCheckpoint < 0) {
      run.startedAt = Date.now();
      run.faints = 0;
      run.popped = 0;
      run.giants = 0;
      run.bestAura = 0;
    }
    this.players = [];
    this.enemies = [];
    this.rockets = [];
    this.auras = [];
    this.checkpoints = [];
    this.goal = undefined;
    this.aura = 0;
    this.ended = false;
    this.lastHud = '';
  }

  create() {
    const data = buildLevel1();
    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.TILE_BIAS = 24;
    this.level = new LevelView(this, data);
    const { widthPx, heightPx } = this.level;
    this.physics.world.setBounds(0, -400, widthPx, heightPx + 800, true, true, false, false);
    this.bg = new Background(this, heightPx - VIEW_H);
    this.fx = new Fx(this);

    this.gPlayers = this.add.group();
    this.gEnemies = this.add.group();
    this.gRockets = this.add.group();
    this.gAuras = this.add.group();

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
        default: {
          const kind = s.type as EnemyKind;
          const e = createEnemy(this, kind, cx, surface(s.y) - 40);
          // stand the body exactly on the ground, whatever the sprite's size/scale
          e.body.updateFromGameObject();
          e.y += surface(s.y) - e.body.bottom;
          e.syncBody();
          this.enemies.push(e);
          this.gEnemies.add(e);
        }
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
    this.physics.add.overlap(this.gPlayers, this.gAuras, (h, a) => this.collectAura(this.playerOf(h), a as Aura));
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
    this.cameras.main.fadeIn(this.startCheckpoint < 0 ? 400 : 250, 255, 248, 236);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.players.forEach((p) => p.destroy()));
    this.game.events.emit('game-start', this, { fresh: this.startCheckpoint < 0, level: data.name, world: data.world });
    this.emitHud(true);
  }

  private addAura(a: Aura) {
    this.auras.push(a);
    this.gAuras.add(a);
  }

  private playerOf(h: unknown): Player {
    return (h as Phaser.GameObjects.GameObject).getData('player') as Player;
  }

  // ───────────────────────────────────────────── frame loop ──

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 30);

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

    this.bg.update(this.view, dt);
    this.emitHud();
  }

  private updateCamera(dt: number, snap = false) {
    const cam = this.cameras.main;
    // Fit VIEW_H world px vertically, but always show at least MIN_VIEW_W across
    // (so 4:3 iPads and 16:10 Android tablets see enough of the level ahead).
    const zoom = Math.min(this.scale.height / VIEW_H, this.scale.width / MIN_VIEW_W);
    cam.setZoom(zoom);
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
    this.view = { left, top, width: vw, height: vh };
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
      for (let i = 0; i < n; i++) this.addAura(new Aura(this, p.x, p.y - 10, true));
      this.aura = 0;
      p.knockBack(fromX);
      this.fx.auraSparkle(p.x, p.y, 14);
    } else {
      p.faint(false);
    }
  }

  private collectAura(p: Player, a: Aura) {
    if (!p.alive || a.taken) return;
    // freshly scattered wisps can't be grabbed for a split second
    if (this.time.now < a.collectableAt) return;
    this.aura++;
    run.bestAura = Math.max(run.bestAura, this.aura);
    this.fx.auraSparkle(a.x, a.y, 8);
    sfx.aura();
    a.vanish();
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
    const x = p.x + p.facing * 24;
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
    this.time.delayedCall(fell ? 700 : 1500, () => {
      this.cameras.main.fadeOut(300, 255, 248, 236);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
        this.scene.restart({ session: this.session, checkpoint: this.lastCheckpoint } satisfies GameData),
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
    for (const e of this.enemies) if (!e.dead && e.awake) e.damage(99, 'blast', null);
    const res: ResultState = {
      charId: p.char.id,
      name: p.char.name,
      aura: this.aura,
      popped: run.popped,
      giants: run.giants,
      faints: run.faints,
      seconds: Math.round((Date.now() - run.startedAt) / 1000),
    };
    this.time.delayedCall(1800, () => this.game.events.emit('level-complete', res));
  }

  private emitHud(force = false) {
    const p = this.players[0];
    if (!p) return;
    const s: HudState = {
      charId: p.char.id,
      name: p.char.name,
      aura: this.aura,
      stamina: Math.round(p.stamina * 100) / 100,
      exhausted: p.exhausted,
      running: p.running,
    };
    const key = `${s.aura}|${s.stamina}|${s.exhausted}|${s.running}`;
    if (!force && key === this.lastHud) return;
    this.lastHud = key;
    this.game.events.emit('hud', s);
  }
}
