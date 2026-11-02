import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { sfx } from '../core/sfx';
import { ART_RES } from '../gfx/draw';
import { RINK, drawRinkBack, drawRinkIce } from '../gfx/rink';
import { addCanvas, hires } from '../gfx/textures';
import type { GameScene } from '../scenes/GameScene';
import type { Player } from './Player';
import { SoccerBig, SoccerPuff, type Coach, type SoccerMember } from './Soccer';

const PUCK_R = 7;
const SPOT_DIST = 230;

interface Puck {
  img: Phaser.Physics.Arcade.Image;
  dangerous: boolean;
  life: number;
}

/**
 * Puffballs playing hockey on the frozen pond. They pass the puck around
 * until they spot you — whistle, "!" — then they take turns slapping pucks at
 * you, low and fast across the ice: jump them (or shoot them). Then they charge.
 */
export class HockeyMatch implements Coach {
  private players: SoccerMember[] = [];
  private sticks = new Map<SoccerMember, Phaser.GameObjects.Image>();
  private pucks: Puck[] = [];
  private state: 'idle' | 'play' | 'alert' | 'volley' | 'done' = 'idle';
  private receiver: SoccerMember | null = null;
  private shooter: SoccerMember | null = null;
  private timer = 0;
  private shots = 0;
  private kickCooldown = 0.5;
  private readonly left: number;
  private readonly right: number;
  private readonly ground: number;
  readonly jog = 80;

  constructor(
    private gs: GameScene,
    cx: number,
    ground: number,
    widthTiles: number,
    team: string,
  ) {
    const half = (widthTiles * TILE) / 2;
    this.left = cx - half;
    this.right = cx + half;
    this.ground = ground;
    // the mini arena: grandstand, glass, boards and lights behind; the marked ice sheet in front
    const rinkW = half * 2;
    const W = rinkW + RINK.END * 2;
    const back = `rink-back-${rinkW}`;
    const ice = `rink-ice-${rinkW}`;
    if (!gs.textures.exists(back)) addCanvas(gs, back, hires(W, RINK.ABOVE + RINK.BELOW, 2, (ctx) => drawRinkBack(ctx, rinkW)));
    if (!gs.textures.exists(ice)) addCanvas(gs, ice, hires(W, RINK.ICE_UP + RINK.ICE_DOWN, 2, (ctx) => drawRinkIce(ctx, rinkW)));
    gs.add.image(this.left - RINK.END, ground, back).setOrigin(0, RINK.ABOVE / (RINK.ABOVE + RINK.BELOW)).setScale(1 / 2).setDepth(DEPTH.decor - 1);
    gs.add.image(this.left - RINK.END, ground, ice).setOrigin(0, RINK.ICE_UP / (RINK.ICE_UP + RINK.ICE_DOWN)).setScale(1 / 2).setDepth(DEPTH.tiles + 0.5);
    gs.add.image(this.left - 4, ground + 1, 'hockeynet').setOrigin(4 / 64, 40 / 44).setScale(1 / 2).setDepth(DEPTH.decor);
    gs.add.image(this.right + 4, ground + 1, 'hockeynet').setOrigin(4 / 64, 40 / 44).setScale(-1 / 2, 1 / 2).setDepth(DEPTH.decor);

    const n = team.length;
    [...team].forEach((kind, i) => {
      const x = cx + half * (n === 1 ? 0 : -0.62 + (1.24 * i) / (n - 1));
      const e: SoccerMember = kind === 'b' ? new SoccerBig(gs, x, ground - 60, this) : new SoccerPuff(gs, x, ground - 40, this);
      gs.addEnemy(e, ground);
      this.players.push(e);
      this.sticks.set(e, gs.add.image(x, ground, 'hstick').setOrigin(30 / 40, 6 / 40).setScale(kind === 'b' ? 1.25 / 3 : 0.95 / 3).setDepth(DEPTH.enemies + 1));
    });
    this.receiver = this.players[0];
    this.pucks.push(this.makePuck(this.players[0].x + 22, false));
  }

  get centerX() {
    return (this.left + this.right) / 2;
  }

  /** Puck pops if a rocket hits it. */
  allPucks() {
    return this.pucks.map((p) => p.img);
  }

  popPuck(img: Phaser.Physics.Arcade.Image) {
    const p = this.pucks.find((q) => q.img === img);
    if (!p || !img.active) return;
    this.gs.fx.debris(img.x, img.y);
    img.destroy();
  }

  private makePuck(x: number, dangerous: boolean): Puck {
    const img = this.gs.physics.add.image(x, this.ground - PUCK_R, 'puck').setScale(1 / ART_RES).setDepth(DEPTH.enemies + 2);
    const b = img.body as Phaser.Physics.Arcade.Body;
    b.setSize(PUCK_R * 2 * ART_RES, PUCK_R * 1.2 * ART_RES).setOffset(2 * ART_RES, 3 * ART_RES);
    b.setBounce(0.6, 0);
    this.gs.physics.add.collider(img, this.gs.level.layer);
    return { img, dangerous, life: dangerous ? 3.2 : Infinity };
  }

  private get alive() {
    return this.players.filter((p) => !p.dead);
  }

  private get gamePuck() {
    return this.pucks.find((p) => !p.dangerous && p.img.active)?.img ?? null;
  }

  targetFor(p: SoccerMember): number | null {
    const puck = this.gamePuck;
    if (this.state === 'play' && puck) {
      if (p === this.receiver) return puck.x + (p.x < puck.x ? -(p.body.width / 2 + 10) : p.body.width / 2 + 10);
      return p.home;
    }
    return null;
  }

  lookX(p: SoccerMember): number {
    if (this.state === 'alert' || this.state === 'volley') return this.gs.nearestPlayer(p.x, p.y)?.x ?? p.x - 1;
    return this.gamePuck?.x ?? p.x - 1;
  }

  update(dt: number) {
    const alive = this.alive;
    // sticks follow their players (and swing when they shoot)
    for (const [p, s] of this.sticks) {
      if (p.dead || !p.active) {
        if (s.visible) this.gs.tweens.add({ targets: s, alpha: 0, angle: 120, y: s.y + 20, duration: 400, onComplete: () => s.setVisible(false) });
        continue;
      }
      const face = p.flipX ? 1 : -1;
      s.setPosition(p.x + face * p.body.width * 0.35, p.body.top + p.body.height * 0.45).setFlipX(face > 0);
    }
    if (this.state === 'idle') {
      if (!this.players.some((p) => p.awake)) return;
      this.state = 'play';
    }
    // pucks slide on the ice
    this.pucks = this.pucks.filter((pk) => {
      if (!pk.img.active) return false;
      const b = pk.img.body as Phaser.Physics.Arcade.Body;
      pk.life -= dt;
      if (b.blocked.down) b.velocity.x *= Math.pow(pk.dangerous ? 0.85 : 0.5, dt);
      if (pk.img.y > this.gs.level.heightPx + 60 || pk.life <= 0) {
        this.gs.tweens.add({ targets: pk.img, alpha: 0, duration: 250, onComplete: () => pk.img.destroy() });
        return false;
      }
      if (pk.dangerous && Math.abs(b.velocity.x) < 60) pk.dangerous = false;
      if (pk.dangerous) this.checkHit(pk);
      return true;
    });
    const hero = this.gs.nearestPlayer(this.centerX, this.ground);
    switch (this.state) {
      case 'play': {
        if (alive.length < this.players.length || (hero && alive.some((q) => Math.abs(q.x - hero.x) < SPOT_DIST))) return this.startAlert();
        this.kickCooldown -= dt;
        const puck = this.gamePuck;
        const r = this.receiver && !this.receiver.dead ? this.receiver : alive[0];
        this.receiver = r ?? null;
        if (puck && r && this.kickCooldown <= 0 && Math.abs(r.x - puck.x) < r.body.width / 2 + 16) {
          const others = alive.filter((o) => o !== r);
          const to = others[Math.floor(Math.random() * others.length)];
          if (to) {
            (puck.body as Phaser.Physics.Arcade.Body).setVelocityX(Phaser.Math.Clamp((to.x - puck.x) * 1.3, -320, 320));
            this.receiver = to;
            this.swing(r);
            this.kickCooldown = 0.4;
            sfx.kick(0.4);
          }
        }
        if (puck) {
          const b = puck.body as Phaser.Physics.Arcade.Body;
          if (puck.x < this.left + 10 && b.velocity.x < 0) b.velocity.x = Math.abs(b.velocity.x) * 0.6;
          if (puck.x > this.right - 10 && b.velocity.x > 0) b.velocity.x = -Math.abs(b.velocity.x) * 0.6;
        }
        break;
      }
      case 'alert':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'volley';
          this.shots = Math.min(4, alive.length + 1);
          this.timer = 0;
        }
        break;
      case 'volley': {
        this.timer -= dt;
        if (!alive.length) return this.finish();
        if (this.timer <= 0) {
          if (this.shots <= 0) return this.finish();
          this.shots--;
          // the next player in line slaps a puck at you
          const sh = alive.reduce((a, c) => (hero && Math.abs(c.x - hero.x) < Math.abs(a.x - hero.x) ? c : a));
          this.shooter = alive[(alive.indexOf(sh) + this.shots) % alive.length];
          this.slapShot(this.shooter, hero);
          this.timer = 0.75;
        }
        break;
      }
    }
  }

  private startAlert() {
    if (this.state !== 'play') return;
    this.state = 'alert';
    this.timer = 0.85;
    sfx.whistle();
    const hero = this.gs.nearestPlayer(this.centerX, this.ground);
    for (const p of this.alive) p.alert(hero);
  }

  private swing(p: SoccerMember) {
    const s = this.sticks.get(p);
    if (!s) return;
    const face = p.flipX ? 1 : -1;
    this.gs.tweens.add({ targets: s, angle: -face * 55, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  private slapShot(p: SoccerMember, hero: Player | null) {
    if (!hero) return;
    const dir = Math.sign(hero.x - p.x) || -1;
    const pk = this.makePuck(p.x + dir * (p.body.width / 2 + 10), true);
    (pk.img.body as Phaser.Physics.Arcade.Body).setVelocityX(dir * (400 + Math.random() * 70));
    this.pucks.push(pk);
    this.swing(p);
    sfx.kick(1);
    this.gs.cameras.main.shake(60, 0.002);
    this.gs.fx.dust(pk.img.x, this.ground, 4);
  }

  /** A puck hits a hero below the knees. */
  private checkHit(pk: Puck) {
    for (const p of this.gs.players) {
      if (!p.alive) continue;
      const pb = p.body;
      const x = pk.img.x;
      const y = pk.img.y;
      if (x + PUCK_R < pb.left || x - PUCK_R > pb.right || y + 3 < pb.top || y - 3 > pb.bottom) continue;
      pk.dangerous = false;
      this.gs.hitPlayer(p, x);
      const b = pk.img.body as Phaser.Physics.Arcade.Body;
      b.setVelocityX(-b.velocity.x * 0.3);
      return;
    }
  }

  private finish() {
    this.state = 'done';
    const hero = this.gs.nearestPlayer(this.centerX, this.ground);
    for (const p of this.alive) p.chase(hero);
  }
}
