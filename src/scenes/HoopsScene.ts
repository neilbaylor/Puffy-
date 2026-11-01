import Phaser from 'phaser';
import { characterById } from '../data/characters';
import type { Session } from '../core/session';
import { fadeOutMusic, playHoops } from '../core/music';
import { sfx } from '../core/sfx';
import { ART_RES, canvas } from '../gfx/draw';
import {
  ARENA_H,
  ARENA_W,
  HOOP,
  KING_FRAMES,
  KING_H,
  KING_W,
  SPOTS,
  STAGE_OX,
  STAGE_OY,
  drawArena,
  drawBackboard,
  drawBall,
  drawKing,
  drawRimBack,
  drawRimFront,
  drawSpotlight,
} from '../gfx/hoops';
import { addCanvas, hires } from '../gfx/textures';
import { gamepadSources } from '../input/gamepad';
import { isKeyDown } from '../input/keyboard';
import type { GameData, ResultState } from './GameScene';

export interface HoopsData {
  session: Session;
  charId: string;
  /** Checkpoint to restart from if the King wins. */
  checkpoint: number;
  /** Level stats so far (shown on the results screen if you win). */
  result: ResultState;
}

type Outcome = 'swish' | 'rimIn' | 'rimOut' | 'short' | 'long' | 'wide';

/** King Puff Ball makes about this share of his shots. */
const KING_MAKE = 0.35;
const REGULATION = 5;

const ARENA_RES = 1.25;
const KING_RES = 2.5;
/** Stage (1280 × 720) → arena texture coordinates. */
const A = (x: number, y: number) => ({ x: x + STAGE_OX, y: y + STAGE_OY });

/**
 * The finale: a free-throw contest against King Puff Ball in his palace.
 * Pseudo-3D: the court is drawn in perspective and the ball shrinks as it
 * flies away from the camera toward the hoop.
 */
export class HoopsScene extends Phaser.Scene {
  private hd!: HoopsData;
  private hero!: Phaser.GameObjects.Sprite;
  private king!: Phaser.GameObjects.Sprite;
  private ball!: Phaser.GameObjects.Image;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private net!: Phaser.GameObjects.Image;
  private heroScale = 1;
  private clock = 0;
  private waits: { at: number; res: () => void }[] = [];
  private flight: null | { t: number; dur: number; p0: Phaser.Math.Vector2; p1: Phaser.Math.Vector2; p2: Phaser.Math.Vector2; s0: number; s1: number; f0: number; f1: number; res: () => void } = null;
  private spin = 0;
  private kingAnim: { frames: string[]; fps: number } = { frames: ['idle0', 'idle1'], fps: 2.5 };
  private heroAnim: { frames: string[]; fps: number } = { frames: ['idle0', 'idle1'], fps: 2 };
  private dom!: HTMLElement;
  private meter: null | { phase: 'power' | 'aim'; pos: number; dir: number; speed: number; zone: [number, number]; el: HTMLElement } = null;
  private tapListener = (e: Event) => {
    e.preventDefault();
    this.tapped = true;
  };
  private tapped = false;
  private score = { you: [] as boolean[], king: [] as boolean[] };
  private baseZoom = 1;
  private camFocus = { x: 800, y: 450, zoom: 1 };

  constructor() {
    super('Hoops');
  }

  init(data: HoopsData) {
    this.hd = data;
    this.clock = 0;
    this.waits = [];
    this.flight = null;
    this.meter = null;
    this.score = { you: [], king: [] };
    this.tapped = false;
    this.prevKey = true;
  }

  // ───────────────────────────────────────────── setup ──

  private makeTextures() {
    if (!this.textures.exists('arena')) addCanvas(this, 'arena', hires(ARENA_W, ARENA_H, ARENA_RES, (ctx) => drawArena(ctx)));
    if (!this.textures.exists('king')) {
      const { c, ctx } = canvas(Math.ceil(KING_W * KING_FRAMES.length * KING_RES), Math.ceil(KING_H * KING_RES));
      ctx.scale(KING_RES, KING_RES);
      KING_FRAMES.forEach((f, i) => {
        ctx.save();
        ctx.translate(i * KING_W, 0);
        drawKing(ctx, 0, 0, f);
        ctx.restore();
      });
      addCanvas(this, 'king', c, (t) => KING_FRAMES.forEach((f, i) => t.add(f, 0, Math.round(i * KING_W * KING_RES), 0, Math.round(KING_W * KING_RES), Math.round(KING_H * KING_RES))));
    }
    if (!this.textures.exists('hball')) addCanvas(this, 'hball', hires(52, 52, 3, (ctx) => drawBall(ctx, 26, 26, 24)));
    if (!this.textures.exists('backboard')) {
      // drawn in stage coordinates around the hoop, then cropped
      addCanvas(this, 'backboard', hires(320, 420, 2, (ctx) => {
        ctx.translate(160 - HOOP.rimX, 220 - HOOP.rimY);
        drawBackboard(ctx);
        drawRimBack(ctx);
      }));
    }
    if (!this.textures.exists('netf')) {
      const { c, ctx } = canvas(2 * 140 * 2, 100 * 2);
      ctx.scale(2, 2);
      drawRimFront(ctx, 70, 16, 0);
      drawRimFront(ctx, 210, 16, 1);
      addCanvas(this, 'netf', c, (t) => {
        t.add('n0', 0, 0, 0, 280, 200);
        t.add('n1', 0, 280, 0, 280, 200);
      });
    }
    if (!this.textures.exists('spot')) addCanvas(this, 'spot', hires(300, 700, 1, (ctx) => drawSpotlight(ctx, 300, 700)));
  }

  create() {
    this.makeTextures();
    const ch = characterById(this.hd.charId);
    this.cameras.main.setBackgroundColor('#140a26');

    this.add.image(0, 0, 'arena').setOrigin(0, 0).setScale(1 / ARENA_RES).setDepth(0);

    const bb = A(HOOP.rimX, HOOP.rimY);
    this.add.image(bb.x, bb.y, 'backboard').setOrigin(0.5, 220 / 420).setScale(0.5).setDepth(5);

    // spotlights
    for (const sp of [SPOTS.hero, SPOTS.king]) {
      const p = A(sp.x, sp.y);
      const l = this.add.image(p.x, p.y + 20, 'spot').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setDepth(3);
      this.tweens.add({ targets: l, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 2200, ease: 'Sine.easeInOut' });
    }

    // characters, with floor shadows
    const hp = A(SPOTS.hero.x, SPOTS.hero.y);
    const kp = A(SPOTS.king.x, SPOTS.king.y);
    this.add.ellipse(hp.x, hp.y + 2, 120 * ch.scale, 22, 0x000000, 0.25).setDepth(6);
    this.add.ellipse(kp.x, kp.y + 2, 170, 28, 0x000000, 0.25).setDepth(6);
    this.heroScale = (2.6 / ART_RES) * ch.scale;
    this.hero = this.add.sprite(hp.x, hp.y + 4, `char-${ch.id}`, 'idle0').setOrigin(0.5, 1).setScale(this.heroScale).setDepth(8);
    this.king = this.add.sprite(kp.x, kp.y + 6, 'king', 'idle0').setOrigin(0.5, 1).setScale(1.45 / KING_RES).setDepth(8);

    // ball + its shadow on the floor
    this.ballShadow = this.add.ellipse(0, 0, 40, 10, 0x000000, 0.28).setDepth(6).setVisible(false);
    this.ball = this.add.image(0, 0, 'hball').setScale(1 / 3).setDepth(9).setVisible(false);
    this.net = this.add.image(bb.x, bb.y, 'netf', 'n0').setOrigin(0.25, 16 / 100).setScale(0.5).setDepth(10);

    this.dom = document.createElement('div');
    this.dom.className = 'hoops';
    this.dom.innerHTML = `
      <div class="hoops-score"></div>
      <div class="hoops-meters" hidden>
        <div class="hm" data-m="power"><b>Power</b><div class="hm-bar"><i class="hm-zone"></i><i class="hm-mark"></i></div></div>
        <div class="hm" data-m="aim"><b>Aim</b><div class="hm-bar"><i class="hm-zone"></i><i class="hm-mark"></i></div></div>
        <p class="hm-hint">Tap to stop the marker in the green!</p>
      </div>
      <div class="hoops-callout"></div>
      <div class="hoops-curtain"></div>`;
    document.getElementById('ui')!.appendChild(this.dom);
    window.addEventListener('pointerdown', this.tapListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('pointerdown', this.tapListener);
      this.dom.remove();
    });

    this.game.events.emit('hoops-start');
    this.fitCamera(true);
    void this.run();
  }

  // ───────────────────────────────────────────── helpers ──

  private wait(ms: number) {
    return new Promise<void>((res) => this.waits.push({ at: this.clock + ms, res }));
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((res) => this.tweens.add({ ...cfg, onComplete: () => res() }));
  }

  /** Cover-fit the 1280×720 stage, then apply the current shot (focus point + zoom). */
  private fitCamera(snap = false) {
    const cam = this.cameras.main;
    this.baseZoom = Math.max(this.scale.width / 1280, this.scale.height / 720);
    const z = this.baseZoom * this.camFocus.zoom;
    const target = snap ? z : cam.zoom + (z - cam.zoom) * 0.12;
    cam.setZoom(target);
    const vw = this.scale.width / target;
    const vh = this.scale.height / target;
    const x = Phaser.Math.Clamp(this.camFocus.x, vw / 2, ARENA_W - vw / 2);
    const y = Phaser.Math.Clamp(this.camFocus.y, vh / 2, ARENA_H - vh / 2);
    if (snap) cam.centerOn(x, y);
    else {
      const cx = cam.midPoint.x + (x - cam.midPoint.x) * 0.12;
      const cy = cam.midPoint.y + (y - cam.midPoint.y) * 0.12;
      cam.centerOn(cx, cy);
    }
  }

  /** A hard camera cut (with a white flash). */
  private cut(x: number, y: number, zoom: number) {
    this.camFocus = { x, y, zoom };
    this.fitCamera(true);
    this.cameras.main.flash(160, 255, 255, 255);
  }

  private callout(text: string, cls = '', ms = 1100) {
    const el = this.dom.querySelector<HTMLElement>('.hoops-callout')!;
    el.className = `hoops-callout show ${cls}`;
    el.innerHTML = text;
    void el.offsetWidth;
    return this.wait(ms).then(() => {
      el.className = 'hoops-callout';
    });
  }

  private renderScore() {
    const n = Math.max(REGULATION, this.score.you.length, this.score.king.length);
    const dots = (arr: boolean[]) =>
      Array.from({ length: n }, (_, i) => `<i class="${i < arr.length ? (arr[i] ? 'in' : 'out') : ''}"></i>`).join('');
    const sum = (a: boolean[]) => a.filter(Boolean).length;
    const sudden = n > REGULATION ? '<span class="sd">SUDDEN DEATH</span>' : '';
    this.dom.querySelector('.hoops-score')!.innerHTML = `
      <div class="hs-row you"><b>${characterById(this.hd.charId).name}</b><span class="dots">${dots(this.score.you)}</span><em>${sum(this.score.you)}</em></div>
      <div class="hs-row king"><b>King Puff Ball</b><span class="dots">${dots(this.score.king)}</span><em>${sum(this.score.king)}</em></div>${sudden}`;
  }

  private prevKey = true;

  /** A fresh tap, click, key press or gamepad press since last check. */
  private tapPressed() {
    let key = isKeyDown('Space') || isKeyDown('Enter') || isKeyDown('KeyF') || isKeyDown('KeyJ') || isKeyDown('ArrowUp') || isKeyDown('KeyW');
    for (const g of gamepadSources) if (g.connected()) key ||= g.poll().jump || g.poll().fire;
    const pressed = this.tapped || (key && !this.prevKey);
    this.prevKey = key;
    this.tapped = false;
    return pressed;
  }

  // ───────────────────────────────────────────── frame loop ──

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50);
    this.clock += dt;
    const due = this.waits.filter((w) => w.at <= this.clock);
    this.waits = this.waits.filter((w) => w.at > this.clock);
    due.forEach((w) => w.res());

    this.fitCamera();

    // idle animation loops
    const k = this.kingAnim;
    this.king.setFrame(k.frames[Math.floor((this.clock / 1000) * k.fps) % k.frames.length]);
    const h = this.heroAnim;
    this.hero.setFrame(h.frames[Math.floor((this.clock / 1000) * h.fps) % h.frames.length]);

    // meters
    if (this.meter) {
      const m = this.meter;
      m.pos += m.dir * m.speed * (dt / 1000);
      if (m.pos > 1) {
        m.pos = 2 - m.pos;
        m.dir = -1;
      } else if (m.pos < 0) {
        m.pos = -m.pos;
        m.dir = 1;
      }
      m.el.querySelector<HTMLElement>('.hm-mark')!.style.left = `${m.pos * 100}%`;
    }

    // ball flight (quadratic bezier in screen space + depth scaling = pseudo-3D)
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.dur);
      const t = f.t;
      const u = 1 - t;
      const x = u * u * f.p0.x + 2 * u * t * f.p1.x + t * t * f.p2.x;
      const y = u * u * f.p0.y + 2 * u * t * f.p1.y + t * t * f.p2.y;
      const s = f.s0 + (f.s1 - f.s0) * t;
      this.spin += dt * 0.012;
      this.ball.setPosition(x, y).setScale(s / 3).setRotation(this.spin);
      const fy = f.f0 + (f.f1 - f.f0) * t;
      this.ballShadow.setPosition(x, fy).setSize(40 * s, 10 * s).setAlpha(0.25 * (1 - Math.min(1, (fy - y) / 500)));
      if (t >= 1) {
        this.flight = null;
        f.res();
      }
    }
  }

  // ───────────────────────────────────────────── the show ──

  private async run() {
    const kp = A(SPOTS.king.x, SPOTS.king.y);
    const hp = A(SPOTS.hero.x, SPOTS.hero.y);
    const rim = A(HOOP.rimX, HOOP.rimY);
    playHoops();

    // Title card over a curtain, then the camera cuts
    const curtain = this.dom.querySelector<HTMLElement>('.hoops-curtain')!;
    curtain.innerHTML = `<div><small>Suddenly…</small>King Puff Ball's<br>Basketball Palace</div>`;
    curtain.classList.add('show');
    sfx.drum();
    await this.wait(1500);
    curtain.classList.add('open');

    // Cut 1: tight on the King
    this.cut(kp.x - 10, kp.y - 150, 2.5);
    this.kingAnim = { frames: ['laugh0', 'laugh1'], fps: 6 };
    await this.wait(300);
    curtain.classList.remove('show', 'open');
    await this.callout('“Think you can beat<br><b>THE KING</b>?”', 'speech', 1500);
    this.kingAnim = { frames: ['idle0', 'idle1'], fps: 2.5 };

    // Cut 2: the hoop, slow push-in
    this.cut(rim.x, rim.y + 20, 2.0);
    this.camFocus.zoom = 2.4;
    sfx.drum();
    await this.wait(900);

    // Cut 3: on our hero, then pull out wide
    this.cut(hp.x, hp.y - 90, 2.3);
    this.heroAnim = { frames: ['jump', 'idle0'], fps: 4 };
    await this.wait(700);
    this.heroAnim = { frames: ['idle0', 'idle1'], fps: 2 };
    this.camFocus = { x: 800, y: 450, zoom: 1 };
    this.renderScore();
    await this.callout('FREE THROW<br>SHOWDOWN!<small>5 shots each · most baskets wins</small>', 'title', 1800);

    // The contest
    let round = 0;
    for (;;) {
      round++;
      await this.playerShot();
      if (this.decided(round, 'you')) break;
      await this.kingShot();
      if (this.decided(round, 'king')) break;
      if (round === REGULATION && this.total('you') === this.total('king')) {
        this.renderScore();
        await this.callout('TIED!<small>Sudden death</small>', 'title', 1400);
      }
    }
    const won = this.total('you') > this.total('king');
    if (won) await this.youWin();
    else await this.kingWins();
  }

  private total(who: 'you' | 'king') {
    return this.score[who].filter(Boolean).length;
  }

  /** Has the contest been decided after `who` just shot in `round`? */
  private decided(round: number, who: 'you' | 'king') {
    const y = this.total('you');
    const k = this.total('king');
    if (round <= REGULATION) {
      const yLeft = REGULATION - this.score.you.length;
      const kLeft = REGULATION - this.score.king.length;
      if (y > k + kLeft || k > y + yLeft) return true;
      return false;
    }
    // sudden death: decided once both have shot in the round and the scores differ
    return who === 'king' && y !== k;
  }

  // ── player's shot: power + aim meters ──

  private async lockMeter(phase: 'power' | 'aim', speed: number): Promise<number> {
    const box = this.dom.querySelector<HTMLElement>('.hoops-meters')!;
    box.hidden = false;
    const el = box.querySelector<HTMLElement>(`[data-m=${phase}]`)!;
    el.classList.add('active');
    el.classList.remove('locked');
    // a fresh green zone each time (narrower as the contest goes on)
    const w = Math.max(0.11, 0.17 - this.score.you.length * 0.01);
    const c = 0.2 + Math.random() * 0.6;
    const zone: [number, number] = [c - w / 2, c + w / 2];
    const z = el.querySelector<HTMLElement>('.hm-zone')!;
    z.style.left = `${zone[0] * 100}%`;
    z.style.width = `${w * 100}%`;
    this.meter = { phase, pos: Math.random() * 0.2, dir: 1, speed, zone, el };
    await this.wait(250); // ignore the tap that started this
    this.tapped = false;
    for (;;) {
      await this.wait(16);
      if (this.tapPressed()) break;
    }
    const m = this.meter!;
    this.meter = null;
    el.classList.remove('active');
    el.classList.add('locked');
    sfx.select();
    // distance outside the green zone (0 = inside)
    const off = m.pos < zone[0] ? m.pos - zone[0] : m.pos > zone[1] ? m.pos - zone[1] : 0;
    return off;
  }

  private async playerShot() {
    const hp = A(SPOTS.hero.x, SPOTS.hero.y);
    this.renderScore();
    this.camFocus = { x: 800, y: 450, zoom: 1 };
    const n = this.score.you.length;
    await this.callout(n >= REGULATION ? 'Your shot!<small>Sudden death</small>' : `Your shot!<small>${n + 1} of ${REGULATION}</small>`, 'turn', 900);
    const speed = 1.15 + n * 0.12;
    const p = await this.lockMeter('power', speed);
    const a = await this.lockMeter('aim', speed * 1.1);
    await this.wait(250);
    this.dom.querySelector<HTMLElement>('.hoops-meters')!.hidden = true;
    this.dom.querySelectorAll('.hm').forEach((e) => e.classList.remove('locked', 'active'));

    // judge the shot
    const NEAR = 0.07;
    const inP = p === 0;
    const inA = a === 0;
    const nearP = Math.abs(p) <= NEAR;
    const nearA = Math.abs(a) <= NEAR;
    let o: Outcome;
    if (inP && inA) o = 'swish';
    else if ((inP && nearA) || (inA && nearP)) o = Math.random() < 0.55 ? 'rimIn' : 'rimOut';
    else if (nearP && nearA) o = Math.random() < 0.3 ? 'rimIn' : 'rimOut';
    else if (!nearP) o = p < 0 ? 'short' : 'long';
    else o = 'wide';

    // fire! (from the bazooka, with recoil)
    this.heroAnim = { frames: ['shoot'], fps: 1 };
    this.hero.setRotation(-0.28);
    const ch = characterById(this.hd.charId);
    const mx = hp.x + 62 * ch.scale;
    const my = hp.y - (ch.muzzleY ?? 18) * 2.6 - 6;
    sfx.shoot();
    const flash = this.add.image(mx + 8, my - 4, 'flash').setScale(0.9).setRotation(-0.5).setDepth(11);
    this.tweens.add({ targets: flash, scale: 1.4, alpha: 0, duration: 140, onComplete: () => flash.destroy() });
    this.tweens.add({ targets: this.hero, x: this.hero.x - 10, yoyo: true, duration: 90 });
    await this.shootBall(mx, my, hp.y, o, Math.sign(a) || (Math.random() < 0.5 ? -1 : 1));
    this.hero.setRotation(0);
    const made = o === 'swish' || o === 'rimIn';
    this.score.you.push(made);
    this.renderScore();
    if (made) {
      this.heroAnim = { frames: ['jump', 'idle0'], fps: 5 };
      this.kingAnim = { frames: ['sad', 'idle0'], fps: 3 };
      this.cheer();
      await this.callout(o === 'swish' ? 'SWISH!' : 'IN!', 'good', 1000);
    } else {
      this.heroAnim = { frames: ['hurt'], fps: 1 };
      this.kingAnim = { frames: ['laugh0', 'laugh1'], fps: 6 };
      sfx.groan();
      await this.callout(o === 'short' ? 'Too short!' : o === 'long' ? 'Too long!' : o === 'wide' ? 'Wide!' : 'Rimmed out!', 'bad', 1000);
    }
    this.heroAnim = { frames: ['idle0', 'idle1'], fps: 2 };
    this.kingAnim = { frames: ['idle0', 'idle1'], fps: 2.5 };
  }

  // ── King's shot: out of his mouth, ~35% ──

  private async kingShot() {
    const kp = A(SPOTS.king.x, SPOTS.king.y);
    this.renderScore();
    this.camFocus = { x: 800, y: 450, zoom: 1 };
    await this.callout('King Puff Ball shoots…', 'turn king', 900);
    this.kingAnim = { frames: ['idle0', 'idle1'], fps: 5 };
    await this.wait(500);
    const r = Math.random();
    let o: Outcome;
    if (r < KING_MAKE) o = Math.random() < 0.5 ? 'swish' : 'rimIn';
    else {
      const misses: Outcome[] = ['rimOut', 'rimOut', 'short', 'long', 'wide'];
      o = misses[Math.floor(Math.random() * misses.length)];
    }
    this.kingAnim = { frames: ['shoot'], fps: 1 };
    sfx.spit();
    const mouth = { x: kp.x - 18, y: kp.y - 110 };
    await this.shootBall(mouth.x, mouth.y, kp.y, o, Math.random() < 0.5 ? -1 : 1);
    const made = o === 'swish' || o === 'rimIn';
    this.score.king.push(made);
    this.renderScore();
    if (made) {
      this.kingAnim = { frames: ['laugh0', 'laugh1'], fps: 6 };
      this.heroAnim = { frames: ['hurt'], fps: 1 };
      sfx.groan();
      await this.callout('The King scores!', 'bad', 1000);
    } else {
      this.kingAnim = { frames: ['sad'], fps: 1 };
      this.heroAnim = { frames: ['jump', 'idle0'], fps: 5 };
      this.cheer(0.5);
      await this.callout('The King misses!', 'good', 1000);
    }
    this.heroAnim = { frames: ['idle0', 'idle1'], fps: 2 };
    this.kingAnim = { frames: ['idle0', 'idle1'], fps: 2.5 };
  }

  /** Fly the ball from (x, y) toward the hoop and play out the outcome. */
  private async shootBall(x: number, y: number, floorY: number, o: Outcome, side: number) {
    const rim = A(HOOP.rimX, HOOP.rimY);
    const base = A(HOOP.rimX, HOOP.baseY);
    const s0 = 1;
    const s1 = 0.55;
    let end = { x: rim.x, y: rim.y - 8 };
    if (o === 'rimIn' || o === 'rimOut') end = { x: rim.x + side * HOOP.rimRX * 0.75, y: rim.y - 6 };
    if (o === 'short') end = { x: rim.x + side * 10, y: rim.y + 70 };
    if (o === 'long') end = { x: rim.x + side * 12, y: rim.y - 80 };
    if (o === 'wide') end = { x: rim.x + side * 110, y: rim.y + 10 };
    const p0 = new Phaser.Math.Vector2(x, y);
    const p2 = new Phaser.Math.Vector2(end.x, end.y);
    const p1 = new Phaser.Math.Vector2((x + end.x) / 2, Math.min(y, end.y) - 260);
    this.ball.setVisible(true).setDepth(9).setAlpha(1);
    this.ballShadow.setVisible(true).setAlpha(0.25);
    await new Promise<void>((res) => {
      this.flight = { t: 0, dur: 1050, p0, p1, p2, s0, s1, f0: floorY, f1: base.y, res };
    });

    const bounceToFloor = async (dx: number, dy: number, ms: number) => {
      await this.tween({ targets: this.ball, x: this.ball.x + dx, y: this.ball.y + dy, rotation: this.spin + 3, duration: ms, ease: 'Quad.easeIn' });
      this.ballShadow.setPosition(this.ball.x, this.ball.y + 4);
      await this.tween({ targets: this.ball, y: this.ball.y - 30, duration: 180, yoyo: true, ease: 'Quad.easeOut' });
      await this.tween({ targets: [this.ball, this.ballShadow], alpha: 0, duration: 250 });
    };

    if (o === 'swish' || o === 'rimIn') {
      if (o === 'rimIn') {
        sfx.clank();
        this.cameras.main.shake(90, 0.003);
        await this.tween({ targets: this.ball, x: rim.x, y: rim.y - 22, duration: 220, ease: 'Quad.easeOut' });
        await this.tween({ targets: this.ball, y: rim.y - 6, duration: 160, ease: 'Quad.easeIn' });
      }
      // through the net
      sfx.swish();
      this.net.setFrame('n1');
      await this.tween({ targets: this.ball, x: rim.x, y: rim.y + 46, duration: 260, ease: 'Sine.easeIn' });
      this.net.setFrame('n0');
      this.ball.setDepth(11);
      await bounceToFloor(side * 20, base.y - this.ball.y - 10, 300);
    } else if (o === 'rimOut') {
      sfx.clank();
      this.cameras.main.shake(90, 0.004);
      await this.tween({ targets: this.ball, x: rim.x + side * 70, y: rim.y - 40, duration: 260, ease: 'Quad.easeOut' });
      await bounceToFloor(side * 50, base.y - this.ball.y + 30, 380);
    } else if (o === 'long') {
      sfx.clank();
      await this.tween({ targets: this.ball, y: this.ball.y - 10, duration: 80 });
      await bounceToFloor(-side * 30, base.y - this.ball.y + 60, 420);
    } else {
      await bounceToFloor(side * 30, base.y - this.ball.y + 80, 380);
    }
    this.ball.setVisible(false);
    this.ballShadow.setVisible(false);
  }

  private cheer(k = 1) {
    sfx.cheer();
    const cam = this.cameras.main;
    cam.shake(150 * k, 0.003 * k);
    // confetti
    for (let i = 0; i < 40 * k; i++) {
      const x = 300 + Math.random() * 1000;
      const c = this.add.rectangle(x, 60, 6, 10, Phaser.Display.Color.HSVToRGB(Math.random(), 0.7, 1).color).setDepth(12);
      this.tweens.add({
        targets: c,
        y: 700 + Math.random() * 200,
        x: x + (Math.random() - 0.5) * 200,
        angle: Math.random() * 720,
        duration: 1400 + Math.random() * 900,
        ease: 'Sine.easeIn',
        onComplete: () => c.destroy(),
      });
    }
  }

  // ── endings ──

  private async youWin() {
    const kp = A(SPOTS.king.x, SPOTS.king.y);
    this.cut(kp.x - 40, kp.y - 120, 1.9);
    this.kingAnim = { frames: ['sad'], fps: 1 };
    await this.callout('“NOOOO!”', 'speech', 1100);
    // the King runs out of the arena
    this.kingAnim = { frames: ['run0', 'run1'], fps: 10 };
    this.camFocus = { x: 800, y: 450, zoom: 1 };
    this.king.setFlipX(true);
    this.cheer(1.5);
    await this.tween({ targets: this.king, x: ARENA_W + 220, duration: 1500, ease: 'Quad.easeIn' });
    this.heroAnim = { frames: ['jump', 'idle0'], fps: 5 };
    await this.callout(`YOU BEAT<br>KING PUFF BALL!<small>${this.total('you')} – ${this.total('king')}</small>`, 'title', 2200);
    fadeOutMusic(500);
    const result: ResultState = { ...this.hd.result, hoops: `${this.total('you')} – ${this.total('king')}` };
    this.game.events.emit('level-complete', result);
  }

  private async kingWins() {
    const kp = A(SPOTS.king.x, SPOTS.king.y);
    this.cut(kp.x - 10, kp.y - 140, 2.3);
    this.kingAnim = { frames: ['laugh0', 'laugh1'], fps: 7 };
    sfx.laugh();
    await this.callout('“HA HA HA HA!”', 'speech', 1600);
    sfx.laugh();
    this.camFocus = { x: 800, y: 450, zoom: 1 };
    await this.callout(`KING PUFF BALL WINS<small>${this.total('king')} – ${this.total('you')} · back to your last checkpoint</small>`, 'title bad', 2400);
    fadeOutMusic(500);
    this.cameras.main.fadeOut(400, 20, 10, 38);
    await this.wait(450);
    this.scene.start('Game', { session: this.hd.session, checkpoint: this.hd.checkpoint } satisfies GameData);
  }
}
