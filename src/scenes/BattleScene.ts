import Phaser from 'phaser';
import { DEPTH, VIEW_H } from '../config';
import { sfx } from '../core/sfx';
import { characterById } from '../data/characters';
import { ART_RES, WALK_FRAMES } from '../gfx/draw';
import { recolorForSlot } from '../gfx/recolor';
import { addCanvas } from '../gfx/textures';
import { soloSource } from '../input/devices';
import type { BattleNet, Snapshot } from '../net/battleNet';
import { buildArena } from '../shared/battle/arena';
import { SLOT_COLORS, type SnapPlayer } from '../shared/battle/protocol';
import { ArenaMap, BTN, DT, HEARTS, stepMove, type BEvent, type BPlayer } from '../shared/battle/sim';
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
  private snaps: Snapshot[] = [];
  private me: BPlayer | null = null;
  private pending: [number, number][] = [];
  private seq = 0;
  private acc = 0;
  /** Visual-only correction for your hero, faded out over a few frames. */
  private fix = { x: 0, y: 0 };
  private names = new Map<string, string>();
  private hudT = 0;

  constructor() {
    super('Battle');
  }

  create(data: { net: BattleNet }) {
    this.net = data.net;
    const arena = buildArena();
    this.map = new ArenaMap(arena);
    this.level = new LevelView(this, arena);
    this.bg = new Background(this, this.level.heightPx - VIEW_H);
    this.fx = new Fx(this);
    this.views.clear();
    this.rocketViews.clear();
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

  /** The whole arena is always in view. */
  private fitCamera() {
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.width / this.map.widthPx, this.scale.height / (this.map.heightPx + 24));
    cam.setZoom(zoom);
    cam.centerOn(this.map.widthPx / 2, this.map.heightPx / 2 - 8);
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
      v = { sprite, tag, hearts, anim: 0, tilt: 0, slot: p.slot, hero: p.hero };
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
      this.reconcile(fresh[fresh.length - 1]);
    }

    // ── your hero: one step per tick with your buttons, sent to the server too ──
    this.acc += dt;
    while (this.acc >= DT) {
      this.acc -= DT;
      this.localTick();
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
    const max = characterById(me.hero).maxRockets;
    const fired = stepMove(me, b, this.map, ev, () => this.myRockets() < max);
    for (const e of ev) if (e.k === 'jump') this.jumpFx(me.x, me.y, e.air, true);
    if (fired) {
      sfx.shoot();
      const c = characterById(me.hero);
      this.fx.muzzle(me.x + me.facing * 24 * c.scale, me.y - (c.muzzleY ?? 18), me.facing, me.x - me.facing * 14 * c.scale);
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
    const max = characterById(me.hero).maxRockets;
    const mineInFlight = s.rockets.filter((r) => r.owner === me.id).length;
    for (const [, b] of this.pending) if (me.respawn <= 0) stepMove(me, b, this.map, undefined, () => mineInFlight < max);
    if (before && me.respawn <= 0) {
      this.fix.x += before.x - me.x;
      this.fix.y += before.y - me.y;
      if (Math.hypot(this.fix.x, this.fix.y) > 90) this.fix = { x: 0, y: 0 }; // too far off: just jump there
    }
    this.me = me;
  }

  /** Where everyone else is right now: a smooth blend between two snapshots, a moment ago. */
  private othersAt(): { players: Map<string, SnapPlayer>; rockets: Map<number, { x: number; y: number; dir: 1 | -1 }>; timeLeft: number } | null {
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
    const rockets = new Map<number, { x: number; y: number; dir: 1 | -1 }>();
    for (const rb of b.rockets) {
      const ra = a.rockets.find((r) => r.id === rb.id);
      rockets.set(rb.id, ra ? { x: ra.x + (rb.x - ra.x) * k, y: ra.y + (rb.y - ra.y) * k, dir: rb.dir } : rb);
    }
    return { players, rockets, timeLeft: last.timeLeft };
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
      v.sprite
        .setFrame(frame)
        .setPosition(x, y + 2)
        .setFlipX(p.facing < 0)
        .setRotation(v.tilt)
        .setAlpha(p.invuln > 0 ? (Math.floor(this.time.now / 70) % 2 ? 0.45 : 1) : 1);
      const top = y - (c.hitH ?? 34) - 10;
      v.tag.setText(this.names.get(id) ?? '').setPosition(x, top - 9);
      this.drawHearts(v.hearts, x, top, p.hp);
    }
    for (const [id, v] of this.views)
      if (!seen.has(id)) {
        v.sprite.destroy();
        v.tag.destroy();
        v.hearts.destroy();
        this.views.delete(id);
      }
    // rockets
    for (const [id, r] of cur.rockets) {
      let img = this.rocketViews.get(id);
      if (!img) {
        img = this.add.image(r.x, r.y, 'rocket').setScale(1 / ART_RES).setDepth(DEPTH.projectiles).setFlipX(r.dir < 0);
        this.rocketViews.set(id, img);
      }
      img.setPosition(r.x, r.y).setRotation(Math.sin(this.time.now / 25 + id) * 0.04);
      if (Math.random() < 0.6) this.fx.trail(r.x - r.dir * 12, r.y + (Math.random() - 0.5) * 3);
    }
    for (const [id, img] of this.rocketViews)
      if (!cur.rockets.has(id)) {
        img.destroy();
        this.rocketViews.delete(id);
      }
    // scenery + HUD
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

  private drawHearts(g: Phaser.GameObjects.Graphics, x: number, y: number, hp: number) {
    g.clear();
    const w = 9;
    const x0 = x - (HEARTS * w) / 2 + w / 2;
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

