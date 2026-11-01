import Phaser from 'phaser';
import { GRAVITY, TEAM_LIVES, TILE, VIEW_H } from '../config';
import { characterById } from '../data/characters';
import { SLOT_COLORS, type Session } from '../core/session';
import { sfx } from '../core/sfx';
import { createEnemy, type Enemy } from '../entities/enemies/Enemy';
import { Checkpoint, Coin, Goal, Heart } from '../entities/Pickups';
import { Player } from '../entities/Player';
import { EnemyBullet, Rocket } from '../entities/Rocket';
import { sourceById } from '../input/devices';
import { touchSource } from '../input/touch';
import type { EnemyKind } from '../level/builder';
import { buildLevel1 } from '../level/level1';
import { SOLID_TILES, T } from '../level/tiles';
import { Background, type View } from '../world/Background';
import { Fx } from '../world/Fx';
import { LevelView } from '../world/LevelView';

export interface HudState {
  players: { slot: number; name: string; charId: string; color: string; hp: number; maxHp: number; state: string }[];
  lives: number;
  score: number;
  coins: number;
}

export interface ResultState {
  won: boolean;
  score: number;
  coins: number;
  players: { slot: number; name: string; charId: string; color: string; score: number; coins: number; kills: number; deaths: number }[];
}

type Group = Phaser.GameObjects.Group;

export class GameScene extends Phaser.Scene {
  session!: Session;
  level!: LevelView;
  fx!: Fx;
  private bg!: Background;

  players: Player[] = [];
  private enemies: Enemy[] = [];
  private rockets: Rocket[] = [];
  private bullets: EnemyBullet[] = [];
  private coins: Coin[] = [];
  private hearts: Heart[] = [];
  private checkpoints: Checkpoint[] = [];
  private goal?: Goal;

  private gPlayers!: Group;
  private gEnemies!: Group;
  private gRockets!: Group;
  private gBullets!: Group;
  private gCoins!: Group;
  private gHearts!: Group;

  lives = TEAM_LIVES;
  score = 0;
  coinCount = 0;
  private respawnPoint = { x: 0, y: 0 };
  private qHits = new Map<string, number>();
  private ended = false;
  private hudDirty = true;

  private view: View = { left: 0, top: 0, width: 800, height: VIEW_H };
  private camX = 0;
  private camTop = 0;
  private lookAhead = 0;

  constructor() {
    super('Game');
  }

  init(data: Session) {
    this.session = data;
    this.players = [];
    this.enemies = [];
    this.rockets = [];
    this.bullets = [];
    this.coins = [];
    this.hearts = [];
    this.checkpoints = [];
    this.goal = undefined;
    this.lives = TEAM_LIVES;
    this.score = 0;
    this.coinCount = 0;
    this.qHits.clear();
    this.ended = false;
    this.hudDirty = true;
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
    this.gBullets = this.add.group();
    this.gCoins = this.add.group();
    this.gHearts = this.add.group();

    // ── Spawns ──
    const surface = (row: number) => (row + 1) * TILE; // y of the ground top under an entity standing in `row`
    for (const s of data.spawns) {
      const cx = s.x * TILE + TILE / 2;
      switch (s.type) {
        case 'player':
          this.respawnPoint = { x: cx, y: surface(s.y) - 20 };
          break;
        case 'coin': {
          const c = new Coin(this, cx, s.y * TILE + TILE / 2);
          this.coins.push(c);
          this.gCoins.add(c);
          break;
        }
        case 'checkpoint':
          this.checkpoints.push(new Checkpoint(this, cx, surface(s.y)));
          break;
        case 'goal':
          this.goal = new Goal(this, cx, surface(s.y));
          break;
        case 'decor':
          break;
        default: {
          const kind = s.type as EnemyKind;
          const ex = kind === 'turret' ? (s.x + 1) * TILE : cx;
          const e = createEnemy(this, kind, ex, 0);
          if (kind === 'flyer') e.y = s.y * TILE + TILE / 2;
          else {
            // stand the body exactly on the ground, whatever the sprite's size/scale
            e.body.updateFromGameObject();
            e.y += surface(s.y) - e.body.bottom;
          }
          e.syncBody();
          this.enemies.push(e);
          this.gEnemies.add(e);
        }
      }
    }

    // ── Players ──
    const specs = this.session.players.length
      ? this.session.players
      : [{ slot: 0, characterId: 'puffy', inputId: 'kb1' }];
    specs.forEach((spec, i) => {
      const input = sourceById(spec.inputId) ?? touchSource;
      const p = new Player(
        this,
        spec.slot,
        characterById(spec.characterId),
        input,
        this.respawnPoint.x - i * 28,
        this.respawnPoint.y,
        SLOT_COLORS[spec.slot],
      );
      this.players.push(p);
      this.gPlayers.add(p.hitbox);
    });
    this.lastSafe = new Map(this.players.map((p) => [p, { x: p.x, y: p.y }]));

    // ── Collisions ──
    const layer = this.level.layer;
    this.physics.add.collider(this.gPlayers, layer, (h, t) => this.onPlayerTile(h as never, t as Phaser.Tilemaps.Tile));
    this.physics.add.collider(this.gEnemies, layer);
    this.physics.add.collider(this.gHearts, layer);
    this.physics.add.collider(this.gRockets, layer, (r) => (r as Rocket).explode());
    this.physics.add.collider(this.gBullets, layer, (b) => b.destroy());
    this.physics.add.overlap(this.gPlayers, this.gEnemies, (h, e) => this.onPlayerEnemy(h as never, e as Enemy));
    this.physics.add.overlap(this.gRockets, this.gEnemies, (r) => (r as Rocket).explode());
    this.physics.add.overlap(this.gRockets, this.gBullets, (r, b) => {
      b.destroy();
      (r as Rocket).explode();
    });
    this.physics.add.overlap(this.gPlayers, this.gBullets, (h, b) => {
      const p = this.playerOf(h);
      if (!p.alive || p.invulnerable) return;
      p.hurt((b as EnemyBullet).x);
      b.destroy();
    });
    this.physics.add.overlap(this.gPlayers, this.gCoins, (h, c) => this.collectCoin(this.playerOf(h), c as Coin));
    this.physics.add.overlap(this.gPlayers, this.gHearts, (h, ht) => this.collectHeart(this.playerOf(h), ht as Heart));
    for (const cp of this.checkpoints)
      this.physics.add.overlap(this.gPlayers, cp.zone, () => {
        if (cp.reached) return;
        cp.activate();
        this.respawnPoint = { x: cp.x, y: cp.y - 20 };
        sfx.checkpoint();
        this.fx.stars(cp.x, cp.y - 100, 10);
        this.fx.popText(cp.x, cp.y - 120, 'CHECKPOINT', '#3ddc84', 16);
      });
    if (this.goal) this.physics.add.overlap(this.gPlayers, this.goal.zone, (h) => this.reachGoal(this.playerOf(h)));

    // ── Camera ──
    const cam = this.cameras.main;
    cam.setRoundPixels(false);
    this.camX = this.respawnPoint.x;
    this.camTop = heightPx - VIEW_H;
    this.updateCamera(0, true);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.players.forEach((p) => p.destroy());
    });
    this.game.events.emit('game-start', this);
    this.emitHud();
  }

  private lastSafe = new Map<Player, { x: number; y: number }>();

  private playerOf(h: unknown): Player {
    return (h as Phaser.GameObjects.GameObject).getData('player') as Player;
  }

  // ───────────────────────────────────────────── frame loop ──

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 1 / 30);

    for (const p of this.players) {
      p.update(dt);
      if (p.alive && p.body.top > this.level.heightPx + 40) p.die(true);
      if (p.alive && p.onGround) {
        const under = this.level.layer.getTileAtWorldXY(p.x, p.bottom + 4);
        if (under && under.index !== T.SPIKES) this.lastSafe.set(p, { x: p.x, y: p.y });
      }
    }

    this.updateCamera(dt);

    if (this.players.length > 1)
      for (const p of this.players) p.clampTo(this.view.left + 4, this.view.left + this.view.width - 4);

    for (const p of this.players) p.sync(dt);

    // wake enemies that come into view
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
      // fizzle quietly once well off-screen
      if (r.active && (r.x < this.view.left - 40 || r.x > this.view.left + this.view.width + 40)) {
        r.owner.rocketsInFlight = Math.max(0, r.owner.rocketsInFlight - 1);
        r.exploded = true;
        r.destroy();
      }
    }
    this.bullets = this.bullets.filter((b) => b.active);
    for (const b of this.bullets) b.tick(dt);
    this.hearts = this.hearts.filter((h) => h.active);
    for (const h of this.hearts) {
      h.tick();
      if (h.y > this.level.heightPx + 64) h.destroy();
    }
    const now = this.time.now;
    for (const c of this.coins) c.tick(now);

    this.bg.update(this.view, dt);
    if (this.hudDirty) this.emitHud();
  }

  private updateCamera(dt: number, snap = false) {
    const cam = this.cameras.main;
    const zoom = this.scale.height / VIEW_H;
    cam.setZoom(zoom);
    const vw = this.scale.width / zoom;
    const vh = VIEW_H;
    const { widthPx, heightPx } = this.level;

    const tracked = this.players.filter((p) => p.state === 'alive' || p.state === 'finished');
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
      // look ahead in the direction of travel (solo only, co-op stays centred on the group)
      const lookTarget = tracked.length === 1 ? Phaser.Math.Clamp(sumVx / 3, -70, 70) : 0;
      this.lookAhead += (lookTarget - this.lookAhead) * (snap ? 1 : 1 - Math.exp(-dt * 2.5));
      const tx = (minX + maxX) / 2 + this.lookAhead;
      const tTop = sumBottom / tracked.length - vh * 0.68;
      const kx = snap ? 1 : 1 - Math.exp(-dt * 7);
      const ky = snap ? 1 : 1 - Math.exp(-dt * 4);
      this.camX += (tx - this.camX) * kx;
      this.camTop += (tTop - this.camTop) * ky;
    }
    this.camX = Phaser.Math.Clamp(this.camX, vw / 2, Math.max(vw / 2, widthPx - vw / 2));
    this.camTop = Phaser.Math.Clamp(this.camTop, 0, heightPx - vh);

    // snap to whole screen pixels to avoid shimmering
    const left = Math.round((this.camX - vw / 2) * zoom) / zoom;
    const top = Math.round(this.camTop * zoom) / zoom;
    cam.centerOn(left + vw / 2, top + vh / 2);
    this.view = { left, top, width: vw, height: vh };
  }

  // ─────────────────────────────────────────── interactions ──

  private onPlayerTile(hitbox: Phaser.GameObjects.GameObject, tile: Phaser.Tilemaps.Tile) {
    const p = this.playerOf(hitbox);
    if (!p.alive) return;
    const b = p.body;
    // spikes hurt from above
    if (tile.index === T.SPIKES && b.blocked.down && tile.pixelY >= b.bottom - 4) {
      if (!p.invulnerable) {
        p.hurt(p.x);
        if (p.alive) b.setVelocityY(-520);
      }
      return;
    }
    // head-bump blocks from below
    if (b.blocked.up && !p.bumpedThisFrame && tile.pixelY + TILE <= b.top + 6) {
      const center = this.level.layer.getTileAt(Math.floor(p.x / TILE), tile.y);
      const target = center && SOLID_TILES.includes(center.index) ? center : tile;
      p.bumpedThisFrame = true;
      this.bumpBlock(target, p);
    }
  }

  private bumpBlock(tile: Phaser.Tilemaps.Tile, p: Player) {
    if (tile.index === T.QBLOCK) this.activateQ(tile, p);
    else if (tile.index === T.BRICK) {
      this.animateBump(tile);
      sfx.bump();
    } else sfx.bump();
    // knock out enemies standing on the bumped block
    for (const e of this.enemies) {
      if (e.dead || !e.awake) continue;
      const eb = e.body;
      if (Math.abs(eb.bottom - tile.pixelY) < 6 && eb.right > tile.pixelX - 4 && eb.left < tile.pixelX + TILE + 4)
        e.damage(99, 'blast', p);
    }
  }

  private animateBump(tile: Phaser.Tilemaps.Tile) {
    const idx = tile.index;
    tile.setVisible(false);
    const img = this.add.image(tile.pixelX + TILE / 2, tile.pixelY + TILE / 2, 'tiles', `t${idx}`).setDepth(1);
    this.tweens.add({
      targets: img,
      y: img.y - 10,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        img.destroy();
        const t = this.level.layer.getTileAt(tile.x, tile.y);
        if (t) t.setVisible(true);
      },
    });
  }

  private activateQ(tile: Phaser.Tilemaps.Tile, p: Player | null) {
    const key = `${tile.x},${tile.y}`;
    const content = this.level.data.qContents.get(key) ?? 'coin';
    const cx = tile.pixelX + TILE / 2;
    const cy = tile.pixelY;
    let usedUp = true;
    if (content === 'heart') {
      const h = new Heart(this, cx, cy - 12);
      this.hearts.push(h);
      this.gHearts.add(h);
      sfx.powerup();
    } else {
      this.popCoin(cx, cy, p);
      if (content === 'coins') {
        const n = (this.qHits.get(key) ?? 0) + 1;
        this.qHits.set(key, n);
        usedUp = n >= 6;
      }
    }
    if (usedUp) {
      const t = this.level.layer.putTileAt(T.USED, tile.x, tile.y);
      this.animateBump(t);
    } else this.animateBump(tile);
  }

  private popCoin(x: number, y: number, p: Player | null) {
    const c = this.add.sprite(x, y - 8, 'coin', 'c0').setDepth(1);
    c.play({ key: 'coin-spin', repeat: -1 });
    this.tweens.add({
      targets: c,
      y: y - 72,
      duration: 260,
      ease: 'Quad.easeOut',
      yoyo: true,
      hold: 40,
      onComplete: () => {
        this.fx.sparkle(c.x, c.y, 6);
        c.destroy();
      },
    });
    sfx.coin();
    this.coinCount++;
    if (p) p.stats.coins++;
    this.addScore(p, 10, x, y - 60, false);
  }

  private collectCoin(p: Player, c: Coin) {
    if (!p.alive || c.taken) return;
    c.taken = true;
    this.fx.sparkle(c.x, c.y, 6);
    c.destroy();
    sfx.coin();
    this.coinCount++;
    p.stats.coins++;
    this.addScore(p, 10, c.x, c.y, false);
    if (this.coinCount % 100 === 0) {
      this.lives++;
      this.fx.popText(p.x, p.y - 40, '1UP', '#3ddc84', 22);
      sfx.powerup();
    }
  }

  private collectHeart(p: Player, h: Heart) {
    if (!p.alive || h.taken) return;
    h.taken = true;
    if (p.hp >= p.char.maxHp) this.addScore(p, 500, h.x, h.y);
    else {
      p.heal(1);
      this.fx.popText(h.x, h.y - 10, '+1 ♥', '#ff4d6d', 18);
    }
    this.fx.stars(h.x, h.y, 6);
    sfx.powerup();
    h.destroy();
    this.hudDirty = true;
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
    if (fromAbove) {
      if (e.stompable) {
        e.damage(1, 'stomp', p);
        e.touchGraceUntil = this.time.now + 250;
        p.bounce();
        pb.y = eb.top - pb.height; // don't sink into the enemy
      } else {
        p.hurt(e.x);
        if (p.alive) p.bounce();
      }
      return;
    }
    if (!p.invulnerable) e.touchPlayer(p);
  }

  // ─────────────────────────────────────────── bazooka ──

  fireRocket(p: Player) {
    const x = p.x + p.facing * 24;
    const y = p.bottom - (p.char.muzzleY ?? 18);
    sfx.shoot();
    this.fx.dust(x, y, 3);
    this.fx.sparkle(x, y, 3);
    this.fx.dust(p.x - p.facing * 20, y, 3); // backblast
    if (this.level.isSolidAt(x, y) && !this.isOneWayAt(x, y)) {
      // muzzle is inside a wall: explode right there
      this.explode(x, y, p);
      return;
    }
    const r = new Rocket(this, p, x, y, p.facing);
    this.rockets.push(r);
    this.gRockets.add(r);
  }

  private isOneWayAt(x: number, y: number) {
    const t = this.level.layer.getTileAtWorldXY(x, y);
    return !!t && t.index >= T.PLAT_L && t.index <= T.PLAT_R;
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
    for (const b of this.bullets) if (b.active && Phaser.Math.Distance.Between(x, y, b.x, b.y) < r) b.destroy();

    // destroy bricks / pop ? blocks
    const layer = this.level.layer;
    const br = r * 0.72;
    const tx0 = Math.floor((x - br) / TILE);
    const tx1 = Math.floor((x + br) / TILE);
    const ty0 = Math.floor((y - br) / TILE);
    const ty1 = Math.floor((y + br) / TILE);
    let broke = false;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = layer.getTileAt(tx, ty);
        if (!t) continue;
        const dx = Math.max(t.pixelX - x, 0, x - (t.pixelX + TILE));
        const dy = Math.max(t.pixelY - y, 0, y - (t.pixelY + TILE));
        if (dx * dx + dy * dy >= br * br) continue;
        if (t.index === T.BRICK) {
          layer.removeTileAt(tx, ty);
          this.fx.debris(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
          this.addScore(owner, 50, tx * TILE + TILE / 2, ty * TILE, false);
          broke = true;
        } else if (t.index === T.QBLOCK) this.activateQ(t, owner);
      }
    if (broke) sfx.brick();
  }

  spawnBullet(x: number, y: number, vx: number, vy: number) {
    const b = new EnemyBullet(this, x, y, vx, vy);
    this.bullets.push(b);
    this.gBullets.add(b);
    sfx.enemyShot();
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

  addScore(p: Player | null, n: number, x: number, y: number, pop = true) {
    this.score += n;
    if (p) p.stats.score += n;
    if (pop) this.fx.popText(x, y, `${n}`, '#ffffff', 16);
    this.hudDirty = true;
  }

  // ─────────────────────────────────────────── life & death ──

  onPlayerHurt(_p: Player) {
    this.hudDirty = true;
  }

  onPlayerDied(p: Player) {
    this.hudDirty = true;
    this.time.delayedCall(1700, () => this.tryRespawn(p));
  }

  private tryRespawn(p: Player) {
    if (this.ended || p.state !== 'dead') return;
    if (this.lives <= 0) {
      p.setWaiting();
      this.hudDirty = true;
      this.checkGameOver();
      return;
    }
    this.lives--;
    const buddy = this.players.find((o) => o !== p && o.alive);
    if (buddy) {
      const safe = this.lastSafe.get(buddy) ?? { x: buddy.x, y: buddy.y };
      p.respawn(safe.x, safe.y - 30);
    } else {
      p.respawn(this.respawnPoint.x, this.respawnPoint.y);
      // bring any other dead players back with them
      this.camX = this.respawnPoint.x;
    }
    this.lastSafe.set(p, { x: p.x, y: p.y });
    this.hudDirty = true;
  }

  private checkGameOver() {
    if (this.players.some((p) => p.alive || p.state === 'dead')) return;
    this.ended = true;
    this.time.delayedCall(800, () => this.game.events.emit('game-over', this.results(false)));
  }

  private reachGoal(p: Player) {
    if (this.ended || !p.alive || !this.goal) return;
    this.ended = true;
    this.goal.celebrate();
    sfx.goal();
    this.addScore(p, 1000, this.goal.sign.x, this.goal.sign.y - 40);
    this.fx.stars(this.goal.sign.x, this.goal.sign.y, 16);
    for (const q of this.players) if (q.alive) q.finish();
    for (const e of this.enemies) if (!e.dead && e.awake) e.damage(99, 'blast', null);
    this.time.delayedCall(2600, () => this.game.events.emit('level-complete', this.results(true)));
  }

  private results(won: boolean): ResultState {
    return {
      won,
      score: this.score,
      coins: this.coinCount,
      players: this.players.map((p) => ({
        slot: p.slot,
        name: p.char.name,
        charId: p.char.id,
        color: SLOT_COLORS[p.slot],
        ...p.stats,
      })),
    };
  }

  private emitHud() {
    this.hudDirty = false;
    const s: HudState = {
      players: this.players.map((p) => ({
        slot: p.slot,
        name: p.char.name,
        charId: p.char.id,
        color: SLOT_COLORS[p.slot],
        hp: p.hp,
        maxHp: p.char.maxHp,
        state: p.state,
      })),
      lives: this.lives,
      score: this.score,
      coins: this.coinCount,
    };
    this.game.events.emit('hud', s);
  }
}
