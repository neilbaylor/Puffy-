import Phaser from 'phaser';
import { DEPTH, VIEW_H } from '../config';
import { sfx } from '../core/sfx';
import { characterById } from '../data/characters';
import { ART_RES, WALK_FRAMES } from '../gfx/draw';
import { recolorForSlot } from '../gfx/recolor';
import { addCanvas, hires } from '../gfx/textures';
import { drawBombBall, drawChute, drawPrize } from '../gfx/prizes';
import { drawAnvil, drawPellet, drawRock } from '../gfx/hazards';
import { W_RES } from '../gfx/weapons';
import { soloSource } from '../input/devices';
import type { BattleNet, Snapshot } from '../net/battleNet';
import { buildArena } from '../shared/battle/arena';
import { SLOT_COLORS, type SnapEnemy, type SnapHazard, type SnapPlayer } from '../shared/battle/protocol';
import { ArenaMap, BTN, DT, ENEMY_BOX, HEARTS, POWER, sizeOf, stepMove, type BEvent, type BPlayer, type EnemyKind, type PrizeKind } from '../shared/battle/sim';
import { Background } from '../world/Background';
import { Fx } from '../world/Fx';
import { LevelView } from '../world/LevelView';
import { mixTint, themeClock, themeMix } from '../world/theme';

/** How far behind the newest snapshot the other players are shown (ticks): smooth, ~100 ms. */
const INTERP_TICKS = 3;

interface HeroView {
  sprite: Phaser.GameObjects.Sprite;
  tag: Phaser.GameObjects.Text;
  hearts: Phaser.GameObjects.Graphics;
  anim: number;
  tilt: number;
  slot: number;
  hero: string;
  /** Drawn size (eases to big when they grow). */
  size: number;
  sparkT: number;
}

const PRIZE_TEXT: Record<PrizeKind, [string, string]> = {
  bomb: ['BOMBS!', '#ff8a3d'],
  star: ['INVINCIBLE!', '#ffd23f'],
  grow: ['GROW!', '#c39bff'],
  rapid: ['RAPID FIRE!', '#ff6b6b'],
  heart: ['+1 HEART', '#ff7eb6'],
};
const PRIZE_KINDS: PrizeKind[] = ['bomb', 'star', 'grow', 'rapid', 'heart'];

/** How each kind of bad guy is drawn: texture, scale, feet origin, gun size. */
const ENEMY_ART: Record<EnemyKind, { tex: string; scale: number; ox: number; oy: number; gun: number }> = {
  small: { tex: 'puffball', scale: 1 / ART_RES, ox: 0.5, oy: 46 / 48, gun: 0.55 },
  medium: { tex: 'bigpuff', scale: 1 / ART_RES, ox: 0.5, oy: 86 / 88, gun: 0.8 },
  big: { tex: 'giant', scale: 1 / 2.5, ox: 88 / 172, oy: 200 / 204, gun: 1 },
};

interface EnemyView {
  spr: Phaser.GameObjects.Sprite;
  gun: Phaser.GameObjects.Image | null;
  chute: Phaser.GameObjects.Image;
  anim: number;
  lastX: number;
}

export interface BattleHud {
  timeLeft: number;
  players: { id: string; kos: number; hp: number; slot: number; down: boolean }[];
}

/**
 * The online battle: an arena where up to 4 heroes blast each other. The
 * server runs the real match; this scene moves your own hero straight away
 * with the same rules (then quietly corrects to what the server says), shows
 * everyone else smoothly a moment behind, and plays all the effects.
 */
export class BattleScene extends Phaser.Scene {
  private net!: BattleNet;
  private map!: ArenaMap;
  private level!: LevelView;
  private bg!: Background;
  fx!: Fx;
  private views = new Map<string, HeroView>();
  private rocketViews = new Map<number, Phaser.GameObjects.Image>();
  private prizeViews = new Map<number, { img: Phaser.GameObjects.Image; chute: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; lastY: number; falling: number }>();
  private snaps: Snapshot[] = [];
  private me: BPlayer | null = null;
  private pending: [number, number][] = [];
  private seq = 0;
  private acc = 0;
  /** Visual-only correction for your hero, faded out over a few frames. */
  private fix = { x: 0, y: 0 };
  private names = new Map<string, string>();
  private hudT = 0;
  private enemyViews = new Map<number, EnemyView>();
  private hazardViews = new Map<number, { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; landY: number }>();
  /** Just watching (joined mid-battle): no hero of your own, shown in a little window. */
  private spectate = false;
  private preview: { x: number; y: number; w: number; h: number } | null = null;

  constructor() {
    super('Battle');
  }

  create(data: { net: BattleNet; spectate?: boolean }) {
    this.net = data.net;
    this.spectate = !!data.spectate;
    this.preview = null;
    this.enemyViews.clear();
    this.hazardViews.clear();
    const arena = buildArena();
    this.map = new ArenaMap(arena);
    this.level = new LevelView(this, arena, { keep: this.spectate });
    this.bg = new Background(this, this.level.heightPx - VIEW_H);
    this.fx = new Fx(this);
    this.views.clear();
    this.rocketViews.clear();
    this.prizeViews.clear();
    this.makePrizeTextures();
    this.snaps = [];
    this.me = null;
    this.pending = [];
    this.seq = 0;
    this.acc = 0;
    this.net.inbox = [];
    const m = themeMix(themeClock.t);
    this.bg.setTheme(m);
    this.level.setTint(mixTint(m));
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.fitCamera, this));
  }

  private makePrizeTextures() {
    const R = ART_RES;
    for (const k of PRIZE_KINDS) if (!this.textures.exists(`prize-${k}`)) addCanvas(this, `prize-${k}`, hires(30, 30, R, (ctx) => drawPrize(ctx, k)));
    if (!this.textures.exists('prize-chute')) addCanvas(this, 'prize-chute', hires(30, 22, R, (ctx) => drawChute(ctx)));
    if (!this.textures.exists('bbomb')) addCanvas(this, 'bbomb', hires(24, 24, R, (ctx) => drawBombBall(ctx, 11, 13, 7)));
    if (!this.textures.exists('brock')) addCanvas(this, 'brock', hires(42, 42, R, (ctx) => drawRock(ctx)));
    if (!this.textures.exists('banvil')) addCanvas(this, 'banvil', hires(42, 40, R, (ctx) => drawAnvil(ctx)));
    if (!this.textures.exists('bpellet')) addCanvas(this, 'bpellet', hires(16, 16, R, (ctx) => drawPellet(ctx)));
  }

  /** Watch the battle in a little window (a box on the lobby screen, in CSS px), or full screen (null). */
  setPreview(rect: { x: number; y: number; w: number; h: number } | null) {
    this.preview = rect;
    this.fitCamera();
  }

  /** The whole arena is always in view. */
  private fitCamera() {
    const cam = this.cameras.main;
    // the canvas is drawn at device pixels; the lobby box is in CSS pixels
    const k = this.scale.width / window.innerWidth;
    const r = this.preview;
    if (r) cam.setViewport(Math.round(r.x * k), Math.round(r.y * k), Math.round(r.w * k), Math.round(r.h * k));
    else cam.setViewport(0, 0, this.scale.width, this.scale.height);
    const W = r ? r.w * k : this.scale.width;
    const H = r ? r.h * k : this.scale.height;
    // (the empty sky above the highest cloud is trimmed off, so the heroes are bigger)
    const SKY = 56;
    const zoom = Math.min(W / this.map.widthPx, H / (this.map.heightPx - SKY));
    cam.setZoom(zoom);
    cam.centerOn(this.map.widthPx / 2, (this.map.heightPx + SKY) / 2);
  }

  /** The hero's picture in this player's colour (made once per hero + colour). */
  private textureFor(hero: string, slot: number) {
    if (slot === 0) return `char-${hero}`;
    const key = `bchar-${hero}-${slot}`;
    if (!this.textures.exists(key)) {
      const src = this.textures.get(`char-${hero}`);
      const canvas = recolorForSlot(src.getSourceImage() as HTMLCanvasElement, slot);
      addCanvas(this, key, canvas, (t) => {
        for (const name of src.getFrameNames()) {
          const f = src.get(name);
          t.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
        }
      });
    }
    return key;
  }

  private viewFor(p: SnapPlayer): HeroView {
    let v = this.views.get(p.id);
    if (v && (v.hero !== p.hero || v.slot !== p.slot)) {
      v.sprite.destroy();
      v.tag.destroy();
      v.hearts.destroy();
      v = undefined;
    }
    if (!v) {
      const c = characterById(p.hero);
      const col = SLOT_COLORS[p.slot % SLOT_COLORS.length];
      const sprite = this.add.sprite(p.x, p.y, this.textureFor(p.hero, p.slot), 'idle0').setOrigin(0.5, 1).setScale(c.scale / ART_RES).setDepth(DEPTH.players);
      const tag = this.add
        .text(p.x, p.y, this.names.get(p.id) ?? '', { fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontStyle: '900', color: '#ffffff', stroke: col, strokeThickness: 4 })
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.text)
        .setResolution(2);
      const hearts = this.add.graphics().setDepth(DEPTH.text);
      v = { sprite, tag, hearts, anim: 0, tilt: 0, slot: p.slot, hero: p.hero, size: 1, sparkT: 0 };
      this.views.set(p.id, v);
    }
    return v;
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    // names from the room list
    for (const rp of this.net.room?.players ?? []) this.names.set(rp.id, rp.id === this.net.myId ? `${rp.name} (you)` : rp.name);

    // ── new snapshots from the server ──
    if (this.net.inbox.length) {
      const fresh = this.net.inbox.splice(0);
      for (const s of fresh) {
        this.playEvents(s.events);
        this.snaps.push(s);
      }
      if (this.snaps.length > 40) this.snaps.splice(0, this.snaps.length - 40);
      if (!this.spectate) this.reconcile(fresh[fresh.length - 1]);
    }

    // ── your hero: one step per tick with your buttons, sent to the server too ──
    this.acc += dt;
    while (this.acc >= DT) {
      this.acc -= DT;
      if (!this.spectate) this.localTick();
    }

    this.render(dt);
  }

  private buttons() {
    const i = soloSource.poll();
    return (i.left ? BTN.left : 0) | (i.right ? BTN.right : 0) | (i.jump ? BTN.jump : 0) | (i.fire ? BTN.fire : 0) | (i.run ? BTN.run : 0);
  }

  private myRockets() {
    const last = this.snaps[this.snaps.length - 1];
    return last ? last.rockets.filter((r) => r.owner === this.net.myId).length : 0;
  }

  private localTick() {
    const b = this.buttons();
    this.seq++;
    this.net.input(this.seq, b);
    const me = this.me;
    if (!me) return;
    this.pending.push([this.seq, b]);
    if (this.pending.length > 90) this.pending.splice(0, this.pending.length - 90);
    if (me.respawn > 0) return;
    const ev: BEvent[] = [];
    const max = characterById(me.hero).maxRockets + (me.power === POWER.rapid ? 3 : 0);
    const fired = stepMove(me, b, this.map, ev, () => me.bombs > 0 || this.myRockets() < max);
    for (const e of ev) if (e.k === 'jump') this.jumpFx(me.x, me.y, e.air, true);
    if (fired) {
      const c = characterById(me.hero);
      const k = sizeOf(me);
      if (me.bombs > 0) {
        me.bombs--;
        sfx.whoosh();
      } else {
        sfx.shoot();
        this.fx.muzzle(me.x + me.facing * 24 * c.scale * k, me.y - (c.muzzleY ?? 18) * k, me.facing, me.x - me.facing * 14 * c.scale * k);
      }
    }
  }

  /** Take the server's word for your hero, then replay the buttons it hasn't seen yet. */
  private reconcile(s: Snapshot) {
    const mine = s.players.find((p) => p.id === this.net.myId);
    if (!mine) {
      this.me = null;
      return;
    }
    const before = this.me ? { x: this.me.x, y: this.me.y } : null;
    const me: BPlayer = { ...mine, lastHitBy: null };
    this.pending = this.pending.filter(([q]) => q > mine.ack);
    const max = characterById(me.hero).maxRockets + (me.power === POWER.rapid ? 3 : 0);
    const mineInFlight = s.rockets.filter((r) => r.owner === me.id).length;
    for (const [, b] of this.pending)
      if (me.respawn <= 0 && stepMove(me, b, this.map, undefined, () => me.bombs > 0 || mineInFlight < max) && me.bombs > 0) me.bombs--;
    if (before && me.respawn <= 0) {
      this.fix.x += before.x - me.x;
      this.fix.y += before.y - me.y;
      if (Math.hypot(this.fix.x, this.fix.y) > 90) this.fix = { x: 0, y: 0 }; // too far off: just jump there
    }
    this.me = me;
  }

  /** Where everyone else is right now: a smooth blend between two snapshots, a moment ago. */
  private othersAt(): {
    players: Map<string, SnapPlayer>;
    rockets: Map<number, { x: number; y: number; dir: 1 | -1; kind: 'rocket' | 'bomb' | 'pellet' }>;
    prizes: [number, PrizeKind, number, number, number][];
    enemies: SnapEnemy[];
    hazards: SnapHazard[];
    timeLeft: number;
  } | null {
    const n = this.snaps.length;
    if (!n) return null;
    const last = this.snaps[n - 1];
    const nowTick = last.tick + ((performance.now() - last.at) / 1000) * (1 / DT);
    const rt = Math.min(last.tick, nowTick - INTERP_TICKS);
    let a = this.snaps[0];
    let b = last;
    for (let i = n - 1; i > 0; i--)
      if (this.snaps[i - 1].tick <= rt) {
        a = this.snaps[i - 1];
        b = this.snaps[i];
        break;
      }
    const k = b.tick === a.tick ? 1 : Phaser.Math.Clamp((rt - a.tick) / (b.tick - a.tick), 0, 1);
    const players = new Map<string, SnapPlayer>();
    for (const pb of b.players) {
      const pa = a.players.find((p) => p.id === pb.id);
      // no blending across a respawn (they'd slide across the arena)
      if (!pa || pa.respawn > 0 !== pb.respawn > 0 || Math.abs(pa.x - pb.x) > 120) players.set(pb.id, pb);
      else players.set(pb.id, { ...(k < 0.5 ? pa : pb), x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k, vx: pa.vx + (pb.vx - pa.vx) * k, vy: pa.vy + (pb.vy - pa.vy) * k });
    }
    const rockets = new Map<number, { x: number; y: number; dir: 1 | -1; kind: 'rocket' | 'bomb' | 'pellet' }>();
    for (const rb of b.rockets) {
      const ra = a.rockets.find((r) => r.id === rb.id);
      rockets.set(rb.id, ra ? { x: ra.x + (rb.x - ra.x) * k, y: ra.y + (rb.y - ra.y) * k, dir: rb.dir, kind: rb.kind } : rb);
    }
    const prizes = b.prizes.map(([id, kind, x, y, age]) => {
      const pa = a.prizes.find((z) => z[0] === id);
      return [id, kind, x, pa ? pa[3] + (y - pa[3]) * k : y, age] as [number, PrizeKind, number, number, number];
    });
    const enemies = b.enemies.map((eb): SnapEnemy => {
      const ea = a.enemies.find((e) => e[0] === eb[0]);
      return ea ? [eb[0], eb[1], ea[2] + (eb[2] - ea[2]) * k, ea[3] + (eb[3] - ea[3]) * k, eb[4], eb[5]] : eb;
    });
    const hazards = b.hazards.map((hb): SnapHazard => {
      const ha = a.hazards.find((h) => h[0] === hb[0]);
      return ha && hb[4] <= 0 ? [hb[0], hb[1], hb[2], ha[3] + (hb[3] - ha[3]) * k, hb[4]] : hb;
    });
    return { players, rockets, prizes, enemies, hazards, timeLeft: last.timeLeft };
  }

  private render(dt: number) {
    const cur = this.othersAt();
    if (!cur) return;
    const k = 1 - Math.exp(-dt * 14);
    this.fix.x -= this.fix.x * k;
    this.fix.y -= this.fix.y * k;
    const seen = new Set<string>();
    for (const [id, p0] of cur.players) {
      seen.add(id);
      const isMe = id === this.net.myId && this.me;
      const p: SnapPlayer | BPlayer = isMe ? this.me! : p0;
      const v = this.viewFor(p0);
      const down = p.respawn > 0;
      const x = p.x + (isMe ? this.fix.x : 0);
      const y = p.y + (isMe ? this.fix.y : 0);
      v.sprite.setVisible(!down);
      v.tag.setVisible(!down);
      v.hearts.setVisible(!down);
      if (down) continue;
      const c = characterById(p.hero);
      // pose, like the hero in the levels
      let frame: string;
      const speed = Math.abs(p.vx);
      if (p.stun > 0) frame = 'hurt';
      else if (p.shotAgo < 0.16) frame = 'shoot';
      else if (!p.onGround) frame = p.vy < 0 ? 'jump' : 'fall';
      else if (speed > 15) {
        v.anim += dt * (8 + speed / 11);
        frame = `walk${Math.floor(v.anim) % WALK_FRAMES}`;
      } else {
        v.anim += dt * 1.6;
        frame = `idle${Math.floor(v.anim) % 2}`;
      }
      const targetTilt = (p.vx / c.runSpeed) * (p.onGround ? 0.14 : 0.06);
      v.tilt += (targetTilt - v.tilt) * Math.min(1, dt * 12);
      // growing / shrinking back eases in, with a little wobble
      const size = sizeOf(p);
      v.size += (size - v.size) * Math.min(1, dt * 9);
      const wob = Math.abs(v.size - size) > 0.02 ? 1 + Math.sin(this.time.now / 30) * 0.04 : 1;
      const star = p.power === POWER.star;
      v.sprite
        .setFrame(frame)
        .setPosition(x, y + 2)
        .setFlipX(p.facing < 0)
        .setRotation(v.tilt)
        .setScale((c.scale / ART_RES) * v.size * wob, (c.scale / ART_RES) * v.size / wob)
        .setAlpha(p.invuln > 0 && !star ? (Math.floor(this.time.now / 70) % 2 ? 0.45 : 1) : 1);
      // invincible: rainbow shimmer and sparkles; rapid fire: sparks off the bazooka
      v.sparkT -= dt;
      if (star) {
        const hue = ((this.time.now / 4) % 360) / 360;
        v.sprite.setTint(Phaser.Display.Color.HSVToRGB(hue, 0.45, 1).color);
        if (v.sparkT <= 0) {
          v.sparkT = 0.06;
          this.fx.sparkle(x + (Math.random() - 0.5) * 30 * v.size, y - Math.random() * 40 * v.size, 1);
        }
      } else if (v.sprite.isTinted && v.sprite.tintFill === false) v.sprite.clearTint();
      if (p.power === POWER.rapid && v.sparkT <= 0) {
        v.sparkT = 0.09;
        this.fx.flameTrail(x + p.facing * 22 * c.scale, y - (c.muzzleY ?? 18), p.facing, 0.5);
      }
      const top = y - (c.hitH ?? 34) * v.size - 10;
      v.tag.setText(this.names.get(id) ?? '').setPosition(x, top - 9);
      this.drawHearts(v.hearts, x, top, p.hp, p.bombs);
    }
    for (const [id, v] of this.views)
      if (!seen.has(id)) {
        v.sprite.destroy();
        v.tag.destroy();
        v.hearts.destroy();
        this.views.delete(id);
      }
    this.renderEnemies(cur.enemies, dt);
    this.renderHazards(cur.hazards);
    // rockets
    for (const [id, r] of cur.rockets) {
      let img = this.rocketViews.get(id);
      if (!img) {
        img = this.add.image(r.x, r.y, r.kind === 'bomb' ? 'bbomb' : r.kind === 'pellet' ? 'bpellet' : 'rocket').setScale(1 / ART_RES).setDepth(DEPTH.projectiles).setFlipX(r.dir < 0);
        this.rocketViews.set(id, img);
      }
      if (r.kind === 'pellet') {
        img.setPosition(r.x, r.y);
        if (Math.random() < 0.4) this.fx.trail(r.x - r.dir * 6, r.y);
      } else if (r.kind === 'bomb') {
        img.setPosition(r.x, r.y).setRotation(img.rotation + r.dir * dt * 7);
        if (Math.random() < 0.5) this.fx.sparkle(r.x + 6, r.y - 8, 1);
      } else {
        img.setPosition(r.x, r.y).setRotation(Math.sin(this.time.now / 25 + id) * 0.04);
        if (Math.random() < 0.6) this.fx.trail(r.x - r.dir * 12, r.y + (Math.random() - 0.5) * 3);
      }
    }
    for (const [id, img] of this.rocketViews)
      if (!cur.rockets.has(id)) {
        img.destroy();
        this.rocketViews.delete(id);
      }
    // prizes: float down under a little parachute, bob about once they land, blink before they go
    const live = new Set<number>();
    for (const [pid, kind, px, py, age] of cur.prizes) {
      live.add(pid);
      let pv = this.prizeViews.get(pid);
      if (!pv) {
        const glow = this.add.image(px, py, 'glow').setTint(0xfff3b0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6).setDepth(DEPTH.pickups - 0.1).setScale(0.55);
        const chute = this.add.image(px, py, 'prize-chute').setScale(1 / ART_RES).setOrigin(0.5, 1).setDepth(DEPTH.pickups);
        const img = this.add.image(px, py, `prize-${kind}`).setScale(1 / ART_RES).setOrigin(0.5, 1).setDepth(DEPTH.pickups + 0.1);
        pv = { img, chute, glow, lastY: py, falling: 1 };
        this.prizeViews.set(pid, pv);
      }
      const falling = py > pv.lastY + 0.01;
      pv.falling += ((falling ? 1 : 0) - pv.falling) * Math.min(1, dt * 6);
      pv.lastY = py;
      const t = this.time.now / 1000 + pid;
      const bob = falling ? Math.sin(t * 3) * 1.5 : -3 - Math.abs(Math.sin(t * 2.6)) * 4;
      const sway = falling ? Math.sin(t * 2) * 0.12 : 0;
      pv.img.setPosition(px, py + bob).setRotation(sway);
      pv.chute.setPosition(px, py + bob - 26).setRotation(sway).setAlpha(pv.falling).setVisible(pv.falling > 0.05);
      pv.glow.setPosition(px, py + bob - 15).setAlpha(0.45 + Math.sin(t * 5) * 0.15);
      const blink = age > 12 && Math.floor(this.time.now / 110) % 2 === 0;
      pv.img.setVisible(!blink);
      pv.glow.setVisible(!blink);
    }
    for (const [pid, pv] of this.prizeViews)
      if (!live.has(pid)) {
        pv.img.destroy();
        pv.chute.destroy();
        pv.glow.destroy();
        this.prizeViews.delete(pid);
      }
    // scenery + HUD (the looks drift slowly, like in the levels)
    themeClock.t += dt;
    const look = themeMix(themeClock.t);
    this.bg.setTheme(look);
    this.level.setTint(mixTint(look));
    const cam = this.cameras.main;
    const wv = cam.worldView;
    this.bg.update({ left: wv.x - 40, top: wv.y - 40, width: wv.width + 80, height: wv.height + 80 }, dt);
    this.level.animate(this.time.now / 1000, wv.x, wv.right);
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.2;
      const hud: BattleHud = {
        timeLeft: cur.timeLeft,
        players: [...cur.players.values()].map((p) => ({ id: p.id, kos: p.kos, hp: p.id === this.net.myId && this.me ? this.me.hp : p.hp, slot: p.slot, down: p.respawn > 0 })),
      };
      this.game.events.emit('battle-hud', hud);
    }
  }

  /** The bad guys: walking (or floating down under a parachute), some carrying a blaster. */
  private renderEnemies(list: SnapEnemy[], dt: number) {
    const seen = new Set<number>();
    for (const [id, kind, x, y, dir, flags] of list) {
      seen.add(id);
      const art = ENEMY_ART[kind];
      let v = this.enemyViews.get(id);
      if (!v) {
        const spr = this.add.sprite(x, y, art.tex, 'w0').setOrigin(art.ox, art.oy).setScale(art.scale).setDepth(DEPTH.enemies);
        const gun = flags & 2 ? this.add.image(x, y, 'w-blaster').setScale(art.gun / W_RES).setDepth(DEPTH.enemies + 0.1) : null;
        const chute = this.add.image(x, y, 'chute').setOrigin(0.5, 1).setScale(1 / ART_RES).setDepth(DEPTH.enemies - 0.1);
        v = { spr, gun, chute, anim: Math.random() * 4, lastX: x };
        this.enemyViews.set(id, v);
      }
      const onGround = (flags & 1) !== 0;
      const chute = (flags & 4) !== 0;
      const moving = Math.abs(x - v.lastX) > 0.2;
      v.lastX = x;
      v.anim += dt * (moving ? 7 : 2);
      const [, h] = ENEMY_BOX[kind];
      const frame = kind === 'big' && !onGround && !chute ? 'air' : Math.floor(v.anim) % 2 ? 'w1' : 'w0';
      v.spr.setFrame(frame).setPosition(x, y + 2).setFlipX(dir > 0);
      if (flags & 8) v.spr.setTintFill(0xffffff);
      else v.spr.clearTint();
      v.chute.setVisible(chute).setPosition(x, y - h + 4).setRotation(Math.sin(this.time.now / 400 + id) * 0.12);
      if (v.gun) v.gun.setPosition(x + dir * ENEMY_BOX[kind][0] * 0.55, y - h * 0.42).setFlipX(dir > 0);
    }
    for (const [id, v] of this.enemyViews)
      if (!seen.has(id)) {
        v.spr.destroy();
        v.gun?.destroy();
        v.chute.destroy();
        this.enemyViews.delete(id);
      }
  }

  /** Rocks and anvils: a growing shadow where it'll land, then down it comes. */
  private renderHazards(list: SnapHazard[]) {
    const seen = new Set<number>();
    for (const [id, kind, x, y, warn] of list) {
      seen.add(id);
      let v = this.hazardViews.get(id);
      if (!v) {
        // where it lands: the first ground or cloud below the sky
        const tx = Math.floor(x / 32);
        let landY = this.map.heightPx;
        for (let ty = 0; ty < this.map.h; ty++)
          if (this.map.solid(tx, ty) || this.map.oneWay(tx, ty)) {
            landY = ty * 32;
            break;
          }
        const shadow = this.add.ellipse(x, landY, 40, 10, 0x2b1a12, 0.35).setDepth(DEPTH.pickups - 0.2);
        const img = this.add.image(x, y, kind === 'anvil' ? 'banvil' : 'brock').setOrigin(0.5, 1).setScale(1 / ART_RES).setDepth(DEPTH.projectiles + 0.5);
        v = { img, shadow, landY };
        this.hazardViews.set(id, v);
        sfx.whoosh();
      }
      // the shadow darkens and tightens as it gets closer
      const near = warn > 0 ? 1 - Math.min(1, warn / 1.1) : 1 - Math.min(1, (v.landY - y) / 500);
      v.shadow.setAlpha(0.15 + 0.35 * near).setScale(1.4 - 0.5 * near, 1);
      v.img.setVisible(warn <= 0).setPosition(x, y).setRotation(kind === 'rock' ? y * 0.02 : 0);
      if (warn > 0 && Math.floor(this.time.now / 140) % 2) v.shadow.setAlpha(0.6);
    }
    for (const [id, v] of this.hazardViews)
      if (!seen.has(id)) {
        v.img.destroy();
        v.shadow.destroy();
        this.hazardViews.delete(id);
      }
  }

  private drawHearts(g: Phaser.GameObjects.Graphics, x: number, y: number, hp: number, bombs = 0) {
    g.clear();
    const w = 9;
    const x0 = x - (HEARTS * w) / 2 + w / 2 - (bombs ? 5 : 0);
    // bombs to throw: little black dots after the hearts
    for (let i = 0; i < Math.min(bombs, 6); i++) {
      const bx = x0 + HEARTS * w + 2 + (i % 3) * 6;
      const by = y + 1 - Math.floor(i / 3) * 6;
      g.fillStyle(0x2b1a12, 1).fillCircle(bx, by, 3).fillStyle(0xffd23f, 1).fillCircle(bx + 2, by - 2.6, 1.1);
    }
    for (let i = 0; i < HEARTS; i++) {
      const cx = x0 + i * w;
      const full = i < hp;
      g.fillStyle(0x2b1a12, 0.85).fillCircle(cx - 1.8, y - 1, 3.4).fillCircle(cx + 1.8, y - 1, 3.4).fillTriangle(cx - 5, y, cx + 5, y, cx, y + 5.4);
      g.fillStyle(full ? 0xff5d7a : 0x6b5a5a, 1).fillCircle(cx - 1.7, y - 1, 2.3).fillCircle(cx + 1.7, y - 1, 2.3).fillTriangle(cx - 3.8, y - 0.4, cx + 3.8, y - 0.4, cx, y + 3.8);
    }
  }

  private jumpFx(x: number, y: number, air: boolean, mine: boolean) {
    if (air) this.fx.airPuff(x, y);
    else this.fx.dust(x, y, 5);
    if (mine) (air ? sfx.jump2 : sfx.jump)();
  }

  /** Sounds and effects for what just happened in the match. */
  private playEvents(events: BEvent[]) {
    const myId = this.net.myId;
    for (const e of events) {
      switch (e.k) {
        case 'jump':
          if (e.id !== myId) {
            const v = this.views.get(e.id);
            if (v) this.jumpFx(v.sprite.x, v.sprite.y - 2, e.air, false);
          }
          break;
        case 'fire':
          if (e.id !== myId) {
            sfx.shoot();
            this.fx.muzzle(e.x, e.y, e.dir, e.x - e.dir * 30);
          }
          break;
        case 'boom': {
          this.fx.explosion(e.x, e.y, e.r);
          sfx.explode();
          const me = this.me;
          const near = me ? Math.hypot(me.x - e.x, me.y - e.y) : 999;
          this.cameras.main.shake(140, 0.004 * Math.max(0.3, 1 - near / 500) * (e.r / 56));
          break;
        }
        case 'hit': {
          const v = this.views.get(e.id);
          if (v) {
            v.sprite.setTintFill(0xffffff);
            this.time.delayedCall(90, () => v.sprite.active && v.sprite.clearTint());
            this.fx.stars(v.sprite.x, v.sprite.y - 30, 5);
          }
          if (e.id === myId) {
            sfx.hurt();
            this.cameras.main.shake(160, 0.008);
          }
          break;
        }
        case 'ko': {
          const v = this.views.get(e.id);
          const by = e.by ? this.views.get(e.by) : null;
          if (v) {
            this.fx.explosion(v.sprite.x, v.sprite.y - 20, 70);
            this.fx.stars(v.sprite.x, v.sprite.y - 30, 14);
            const col = by ? SLOT_COLORS[by.slot % SLOT_COLORS.length] : '#ffffff';
            this.fx.popText(v.sprite.x, v.sprite.y - 70, 'KO!', col, 30);
          }
          sfx.die();
          if (e.by === myId) sfx.cheer();
          break;
        }
        case 'drop': {
          // a prize is coming: a "!" where it'll come down
          this.fx.popText(e.x, 70, '!', '#ffd23f', 34);
          sfx.whoosh();
          break;
        }
        case 'prize': {
          const [text, col] = PRIZE_TEXT[e.kind];
          const v = this.views.get(e.id);
          this.fx.popText(e.x, e.y - 40, text, col, 18);
          this.fx.sparkle(e.x, e.y - 14, 12);
          if (v && e.kind === 'grow') this.cameras.main.shake(180, 0.006);
          (e.kind === 'heart' ? sfx.rootbeer : sfx.aura)();
          break;
        }
        case 'bounce':
          sfx.bump();
          this.fx.dust(e.x, e.y + 7, 3);
          break;
        case 'espawn':
          sfx.whoosh();
          if (!e.chute) this.fx.dust(e.x, (this.map.h - 3) * 32, 8);
          break;
        case 'ehit':
          sfx.bump();
          break;
        case 'edie':
          this.fx.explosion(e.x, e.y, e.kind === 'big' ? 110 : 60);
          this.fx.stars(e.x, e.y - 10, e.kind === 'big' ? 18 : 8);
          sfx.pop();
          if (e.kind === 'big') this.cameras.main.shake(260, 0.01);
          break;
        case 'eshot':
          sfx.pew();
          this.fx.muzzle(e.x, e.y, e.dir, e.x - e.dir * 10);
          break;
        case 'crash':
          this.fx.dust(e.x, e.y, e.kind === 'anvil' ? 16 : 10);
          this.fx.debris(e.x, e.y - 8);
          (e.kind === 'anvil' ? sfx.thud : sfx.stomp)();
          this.cameras.main.shake(e.kind === 'anvil' ? 200 : 110, e.kind === 'anvil' ? 0.008 : 0.004);
          break;
        case 'spawn': {
          const v = this.views.get(e.id);
          if (v) this.fx.fluffBurst(v.sprite.x, v.sprite.y - 20, 1);
          sfx.pop();
          break;
        }
      }
    }
  }
}

