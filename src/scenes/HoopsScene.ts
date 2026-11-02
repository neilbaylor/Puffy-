import Phaser from 'phaser';
import { characterById } from '../data/characters';
import type { Session } from '../core/session';
import { fadeOutMusic, playHoops } from '../core/music';
import { sfx } from '../core/sfx';
import { ART_RES, canvas } from '../gfx/draw';
import {
  ARENA_H,
  ARENA_W,
  CROWD_H,
  FRONT_H,
  HOOP,
  JUMBO,
  KING_FRAMES,
  KING_H,
  KING_W,
  SPOTS,
  STAGE_OX,
  STAGE_OY,
  drawArena,
  drawArenaFront,
  drawBackboard,
  drawCameraFlash,
  drawBall,
  drawCrowd,
  drawKing,
  drawRimBack,
  drawRimFrontTube,
  drawSoftShadow,
  drawSpotBrush,
  drawSpotlight,
  drawJumboScreen,
  type JumboContent,
} from '../gfx/hoops';
import { stingerReveal, stingerTitle } from '../ui/stinger';
import { addCanvas, hires } from '../gfx/textures';
import { gamepadSources } from '../input/gamepad';
import { isKeyDown } from '../input/keyboard';
import type { GameData, GameOverState, ResultState } from './GameScene';
import { loseLife } from '../core/lives';
import { NetSim } from './hoopsNet';

export interface HoopsData {
  session: Session;
  charId: string;
  /** Checkpoint to restart from if the King wins. */
  checkpoint: number;
  /** Which level this palace ends (1-based). */
  level?: number;
  /** Level stats so far (shown on the results screen if you win). */
  result: ResultState;
}

type Outcome = 'swish' | 'rimIn' | 'rimOut' | 'short' | 'long' | 'wide';

/** King Puff Ball makes about this share of his shots. */
const KING_MAKE = 0.45;
const REGULATION = 5;

/** Where each player shoots from (stage coords, feet): they walk to a new one before every shot. */
const HERO_SPOTS = [
  { x: 400, y: 640 },
  { x: 520, y: 588 },
  { x: 300, y: 700 },
  { x: 590, y: 676 },
  { x: 455, y: 560 },
  { x: 345, y: 612 },
];
// (kept inside what a 4:3 iPad screen shows, so the King never walks off the edge)
const KING_SPOTS = [
  { x: 1010, y: 650 },
  { x: 1000, y: 598 },
  { x: 930, y: 702 },
  { x: 968, y: 565 },
  { x: 1018, y: 694 },
  { x: 948, y: 626 },
];
/** Perspective: how big someone standing at stage height y looks, relative to `baseY`. */
const depthK = (y: number, baseY: number) => (y - 120) / (baseY - 120);

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
  private ballShadow!: Phaser.GameObjects.Image;
  // the hoop: a simulated net between the back and front of the rim
  private netSim!: NetSim;
  private netBack!: Phaser.GameObjects.Graphics;
  private netFront!: Phaser.GameObjects.Graphics;
  private rimFront!: Phaser.GameObjects.Image;
  private board!: Phaser.GameObjects.Image;
  private prevBallY = 0;
  /** A loose ball bouncing on the floor after a shot. */
  private loose: null | { vx: number; vy: number; floorY: number; t: number; res: () => void } = null;
  private heroScale = 1;
  private kingScale = 1;
  private heroShadow!: Phaser.GameObjects.Image;
  private kingShadow!: Phaser.GameObjects.Image;
  /** Index of the spot each player is standing on. */
  private heroSpot = 0;
  private kingSpot = 0;
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
  private crowd!: Phaser.GameObjects.Image;
  private camFocus = { x: 800, y: 450, zoom: 1 };
  private heroRefl!: Phaser.GameObjects.Sprite;
  // lighting: the arena can go dark, with spotlights cut out of the darkness
  private darkRT!: Phaser.GameObjects.RenderTexture;
  private brush!: Phaser.GameObjects.Image;
  private dark = { level: 0 };
  private spots: { x: number; y: number; sx: number; sy: number; on: boolean; src: { x: number; y: number }; beam: Phaser.GameObjects.Image }[] = [];
  // the live jumbotron
  private jumboTex!: Phaser.Textures.CanvasTexture;
  private jumbo: JumboContent = { kind: 'title' };
  private jumboUntil = 0;
  private jumboNext = 0;
  // ball motion trail
  private ghosts: Phaser.GameObjects.Image[] = [];
  private trail: { x: number; y: number; s: number }[] = [];
  // the intro can be skipped with a tap
  private inIntro = false;
  private skipping = false;
  private calloutToken = 0;
  private kingRefl!: Phaser.GameObjects.Sprite;
  /** Countdown (ms) to the next camera flash in the crowd. */
  private flashIn = 300;
  /** The crowd is on its feet until this clock time. */
  private excitedUntil = 0;

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
    this.dark = { level: 0 };
    this.spots = [];
    this.ghosts = [];
    this.trail = [];
    this.jumbo = { kind: 'title' };
    this.jumboUntil = 0;
    this.jumboNext = 0;
    this.inIntro = false;
    this.skipping = false;
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
    if (!this.textures.exists('crowd')) addCanvas(this, 'crowd', hires(ARENA_W, CROWD_H, ARENA_RES, (ctx) => drawCrowd(ctx, false)));
    if (!this.textures.exists('crowd2')) addCanvas(this, 'crowd2', hires(ARENA_W, CROWD_H, ARENA_RES, (ctx) => drawCrowd(ctx, true)));
    if (!this.textures.exists('arenafront')) addCanvas(this, 'arenafront', hires(ARENA_W, FRONT_H, ARENA_RES, (ctx) => drawArenaFront(ctx)));
    if (!this.textures.exists('camflash')) addCanvas(this, 'camflash', hires(48, 48, 1, (ctx) => drawCameraFlash(ctx, 24)));
    if (!this.textures.exists('hball')) addCanvas(this, 'hball', hires(52, 52, 3, (ctx) => drawBall(ctx, 26, 26, 24)));
    if (!this.textures.exists('backboard')) {
      // drawn in stage coordinates around the hoop, then cropped
      addCanvas(this, 'backboard', hires(320, 420, 3, (ctx) => {
        ctx.translate(160 - HOOP.rimX, 220 - HOOP.rimY);
        drawBackboard(ctx);
        drawRimBack(ctx, false);
      }));
    }
    if (!this.textures.exists('rimf')) addCanvas(this, 'rimf', hires(140, 40, 3, (ctx) => drawRimFrontTube(ctx, 70, 16)));
    if (!this.textures.exists('spot')) addCanvas(this, 'spot', hires(300, 700, 1, (ctx) => drawSpotlight(ctx, 300, 700)));
    if (!this.textures.exists('softshadow')) addCanvas(this, 'softshadow', hires(128, 40, 1, (ctx) => drawSoftShadow(ctx, 128, 40)));
    if (!this.textures.exists('spotbrush')) addCanvas(this, 'spotbrush', hires(256, 256, 1, (ctx) => drawSpotBrush(ctx, 256)));
  }

  create() {
    this.makeTextures();
    const ch = characterById(this.hd.charId);
    this.cameras.main.setBackgroundColor('#140a26');

    this.add.image(0, 0, 'arena').setOrigin(0, 0).setScale(1 / ARENA_RES).setDepth(0);
    this.crowd = this.add.image(0, 0, 'crowd').setOrigin(0, 0).setScale(1 / ARENA_RES).setDepth(1);
    this.add.image(0, 0, 'arenafront').setOrigin(0, 0).setScale(1 / ARENA_RES).setDepth(2);
    // the crowd sways a little all the time
    this.tweens.add({ targets: this.crowd, y: 1.2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.flashIn = 300;
    this.excitedUntil = 0;

    const bb = A(HOOP.rimX, HOOP.rimY);
    this.board = this.add.image(bb.x, bb.y, 'backboard').setOrigin(0.5, 220 / 420).setScale(1 / 3).setDepth(5);

    // spotlights
    for (const sp of [SPOTS.hero, SPOTS.king]) {
      const p = A(sp.x, sp.y);
      const l = this.add.image(p.x, p.y + 20, 'spot').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setDepth(3);
      this.tweens.add({ targets: l, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 2200, ease: 'Sine.easeInOut' });
    }

    // characters, with floor shadows
    const hp = A(SPOTS.hero.x, SPOTS.hero.y);
    const kp = A(SPOTS.king.x, SPOTS.king.y);
    this.heroShadow = this.add.image(hp.x, hp.y + 2, 'softshadow').setDisplaySize(150 * ch.scale, 30).setDepth(6);
    this.kingShadow = this.add.image(kp.x, kp.y + 3, 'softshadow').setDisplaySize(210, 40).setDepth(6);
    this.heroScale = (2.6 / ART_RES) * ch.scale;
    this.kingScale = 1.45 / KING_RES;
    this.heroSpot = 0;
    this.kingSpot = 0;
    this.hero = this.add.sprite(hp.x, hp.y + 4, `char-${ch.id}`, 'idle0').setOrigin(0.5, 1).setScale(this.heroScale).setDepth(8);
    this.king = this.add.sprite(kp.x, kp.y + 6, 'king', 'idle0').setOrigin(0.5, 1).setScale(this.kingScale).setDepth(8);
    // faint mirror images in the glossy floor
    this.heroRefl = this.add.sprite(0, 0, `char-${ch.id}`, 'idle0').setOrigin(0.5, 1).setFlipY(true).setAlpha(0.16).setDepth(4);
    this.kingRefl = this.add.sprite(0, 0, 'king', 'idle0').setOrigin(0.5, 1).setFlipY(true).setAlpha(0.16).setDepth(4);

    // ball + its shadow on the floor
    this.ballShadow = this.add.image(0, 0, 'softshadow').setDisplaySize(48, 14).setDepth(6).setVisible(false);
    for (let i = 0; i < 4; i++) this.ghosts.push(this.add.image(0, 0, 'hball').setDepth(8.9).setVisible(false).setAlpha(0.3 - i * 0.07));
    this.ball = this.add.image(0, 0, 'hball').setScale(1 / 3).setDepth(9).setVisible(false);
    this.netSim = new NetSim(HOOP.rimRX, HOOP.rimRY);
    this.netBack = this.add.graphics().setDepth(8.7);
    this.netFront = this.add.graphics().setDepth(10);
    this.rimFront = this.add.image(bb.x, bb.y, 'rimf').setOrigin(0.5, 16 / 40).setScale(1 / 3).setDepth(10.5);
    this.loose = null;

    // darkness with spotlights cut out of it, plus the visible beams from the rafters
    this.darkRT = this.add.renderTexture(0, 0, ARENA_W, ARENA_H).setOrigin(0, 0).setDepth(11).setVisible(false);
    this.brush = this.make.image({ key: 'spotbrush', add: false }).setOrigin(0.5);
    for (const src of [A(230, -90), A(1330, -90)]) {
      const beam = this.add.image(src.x, src.y, 'spot').setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(11.4).setVisible(false);
      this.spots.push({ x: src.x, y: 500, sx: 1, sy: 1, on: false, src, beam });
    }

    // the live jumbotron screen (glows even when the lights are down)
    const JR = 2;
    this.jumboTex = (this.textures.exists('jumbo') ? this.textures.get('jumbo') : this.textures.createCanvas('jumbo', JUMBO.w * JR, JUMBO.h * JR)) as Phaser.Textures.CanvasTexture;
    const jp = A(JUMBO.x, JUMBO.y);
    this.add.image(jp.x, jp.y, 'jumbo').setOrigin(0, 0).setScale(1 / JR).setDepth(11.6);
    this.drawJumbo();

    this.dom = document.createElement('div');
    this.dom.className = 'hoops';
    this.dom.innerHTML = `
      <div class="hoops-score"></div>
      <div class="hoops-meters" hidden>
        <div class="hm" data-m="power"><b>Power</b><div class="hm-bar"><i class="hm-zone"></i><i class="hm-mark"></i></div></div>
        <div class="hm" data-m="aim"><b>Aim</b><div class="hm-bar"><i class="hm-zone"></i><i class="hm-mark"></i></div></div>
        <p class="hm-hint">Tap to stop the marker in the green!</p>
      </div>
      <div class="hoops-lb"><i></i><i></i></div>
      <div class="hoops-l3"><b></b><span></span></div>
      <button class="hoops-skip" hidden>Skip ›</button>
      <div class="hoops-callout"></div>`;
    document.getElementById('ui')!.appendChild(this.dom);
    window.addEventListener('pointerdown', this.tapListener);
    const skipBtn = this.dom.querySelector<HTMLButtonElement>('.hoops-skip')!;
    skipBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.inIntro) this.skipping = true;
    });
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
    // during the contest the wide shot is alive: a slow drift and breathing zoom like a
    // broadcast camera, leaning toward the ball while it's in the air (not in cutscene shots)
    let fx = this.camFocus.x;
    let fy = this.camFocus.y;
    let fz = this.camFocus.zoom;
    if (!this.inIntro && fz <= 1.05) {
      const t = this.clock / 1000;
      fx += Math.sin(t * 0.23) * 30 + Math.sin(t * 0.57 + 1) * 8;
      fy += Math.sin(t * 0.17 + 2) * 14;
      fz *= 1.01 + 0.02 * Math.sin(t * 0.29);
      if (this.flight || this.loose) {
        fx += (this.ball.x - fx) * 0.18;
        fy += (this.ball.y - fy) * 0.08;
        fz *= 1.03;
      }
    }
    const z = this.baseZoom * fz;
    const target = snap ? z : cam.zoom + (z - cam.zoom) * 0.06;
    cam.setZoom(target);
    const vw = this.scale.width / target;
    const vh = this.scale.height / target;
    const x = Phaser.Math.Clamp(fx, vw / 2, ARENA_W - vw / 2);
    const y = Phaser.Math.Clamp(fy, vh / 2, ARENA_H - vh / 2);
    if (snap) cam.centerOn(x, y);
    else {
      const cx = cam.midPoint.x + (x - cam.midPoint.x) * 0.06;
      const cy = cam.midPoint.y + (y - cam.midPoint.y) * 0.06;
      cam.centerOn(cx, cy);
    }
  }

  /** A hard camera cut (with a white flash). */
  private cut(x: number, y: number, zoom: number, flash = true) {
    this.tweens.killTweensOf(this.camFocus);
    this.camFocus = { x, y, zoom };
    this.fitCamera(true);
    if (flash) this.cameras.main.flash(110, 255, 255, 255);
  }

  private callout(text: string, cls = '', ms = 1100) {
    const el = this.dom.querySelector<HTMLElement>('.hoops-callout')!;
    el.className = `hoops-callout show ${cls}`;
    el.innerHTML = text;
    void el.offsetWidth;
    const token = ++this.calloutToken;
    return this.wait(ms).then(() => {
      if (token === this.calloutToken) el.className = 'hoops-callout';
    });
  }

  private renderScore() {
    if (this.jumbo.kind !== 'big') this.jumbo = this.scoreJumbo();
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
    this.mirror(this.heroRefl, this.hero);
    this.mirror(this.kingRefl, this.king);
    const hk = this.hero.scaleY / this.heroScale;
    const kk = this.king.scaleY / this.kingScale;
    this.heroShadow.setPosition(this.hero.x, this.hero.y - 2).setDisplaySize(150 * characterById(this.hd.charId).scale * hk, 30 * hk);
    this.kingShadow.setPosition(this.king.x, this.king.y - 3).setDisplaySize(210 * kk, 40 * kk);

    // the crowd: on its feet after a basket, and camera flashes popping all the time
    const excited = this.clock < this.excitedUntil;
    const want = excited && Math.floor(this.clock / 170) % 3 !== 2 ? 'crowd2' : 'crowd';
    if (this.crowd.texture.key !== want) this.crowd.setTexture(want);
    this.flashIn -= dt;
    if (this.flashIn <= 0) {
      this.flashIn = excited ? 25 + Math.random() * 60 : 140 + Math.random() * 420;
      this.cameraFlash();
    }

    this.updateLighting();
    this.updateLooseBall(dt / 1000);
    this.updateNet(dt / 1000);
    if (this.clock >= this.jumboNext) {
      this.jumboNext = this.clock + 70;
      if (this.jumbo.kind === 'big' && this.clock > this.jumboUntil) this.jumbo = this.scoreJumbo();
      this.drawJumbo();
    }
    if (this.inIntro) {
      // touches during the intro don't skip it (fingers are often still on the controls when you
      // reach the gate): only the Skip button, or Enter / Esc on a keyboard, once the title is done
      this.tapped = false;
      const canSkip = this.clock > 2600;
      this.dom.querySelector<HTMLElement>('.hoops-skip')!.hidden = !canSkip || this.skipping;
      if (canSkip && !this.skipping && (isKeyDown('Enter') || isKeyDown('Escape'))) this.skipping = true;
    }

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
      this.ballShadow.setPosition(x, fy).setDisplaySize(48 * s, 14 * s).setAlpha(0.8 * (1 - Math.min(1, (fy - y) / 500)));
      // motion trail
      this.trail.unshift({ x, y, s });
      this.trail.length = Math.min(this.trail.length, 13);
      this.ghosts.forEach((g, i) => {
        const tp = this.trail[(i + 1) * 3];
        g.setVisible(!!tp);
        if (tp) g.setPosition(tp.x, tp.y).setScale((tp.s / 3) * (1 - i * 0.06)).setRotation(this.spin - (i + 1) * 0.2);
      });
      if (t >= 1) {
        this.flight = null;
        this.trail = [];
        this.ghosts.forEach((g) => g.setVisible(false));
        f.res();
      }
    }
  }

  // ───────────────────────────────────────────── lighting, jumbotron, broadcast bits ──

  /** Draw the darkness with spotlight pools cut out of it, and aim the beams. */
  private updateLighting() {
    const lv = this.dark.level;
    const on = lv > 0.01;
    this.darkRT.setVisible(on);
    if (on) {
      this.darkRT.clear();
      this.darkRT.fill(0x05030b, lv);
      for (const sp of this.spots) {
        if (!sp.on) continue;
        this.brush.setScale(sp.sx, sp.sy);
        this.darkRT.erase(this.brush, sp.x, sp.y);
      }
    }
    for (const sp of this.spots) {
      const show = on && sp.on;
      sp.beam.setVisible(show);
      if (!show) continue;
      const dx = sp.x - sp.src.x;
      const dy = sp.y - sp.src.y;
      sp.beam.setRotation(Math.atan2(-dx, dy));
      sp.beam.setScale(0.45 + 0.3 * sp.sx, Math.hypot(dx, dy) / 700);
      sp.beam.setAlpha(0.5 * Math.min(1, lv * 1.3));
    }
  }

  /** Swing a spotlight to (x, y) (arena coords) with a pool size. */
  private aimSpot(i: number, x: number, y: number, sx: number, sy: number, ms: number, ease = 'Cubic.easeInOut') {
    const sp = this.spots[i];
    sp.on = true;
    if (ms <= 0) Object.assign(sp, { x, y, sx, sy });
    else this.tweens.add({ targets: sp, x, y, sx, sy, duration: ms, ease });
  }

  private setDark(level: number, ms: number) {
    this.tweens.killTweensOf(this.dark);
    if (ms <= 0) this.dark.level = level;
    else this.tweens.add({ targets: this.dark, level, duration: ms, ease: 'Sine.easeInOut' });
  }

  private scoreJumbo(): JumboContent {
    return { kind: 'score', you: this.total('you'), king: this.total('king'), name: characterById(this.hd.charId).name, sudden: this.score.you.length > REGULATION };
  }

  /** Show something on the jumbotron (for `ms`, then back to the score). */
  private jumboShow(c: JumboContent, ms = 1500) {
    this.jumbo = c;
    this.jumboUntil = this.clock + ms;
    this.drawJumbo();
  }

  private drawJumbo() {
    const ctx = this.jumboTex.getContext();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawJumboScreen(ctx, this.jumbo, this.clock / 1000);
    this.jumboTex.refresh();
  }

  private letterbox(on: boolean) {
    this.dom.querySelector('.hoops-lb')!.classList.toggle('on', on);
  }

  /** TV-style name caption in the corner (null hides it). */
  private lowerThird(name: string | null, sub = '') {
    const el = this.dom.querySelector<HTMLElement>('.hoops-l3')!;
    if (!name) return el.classList.remove('show');
    el.querySelector('b')!.textContent = name;
    el.querySelector('span')!.textContent = sub;
    el.classList.add('show');
  }

  /** A wait that ends early if the player taps to skip the intro. */
  private async iwait(ms: number) {
    const end = this.clock + ms;
    while (this.clock < end && !this.skipping) await this.wait(Math.min(50, end - this.clock));
  }

  /** Arena lights slam on: boom, flash, roar, a storm of camera flashes. */
  private lightsOn() {
    sfx.drum();
    sfx.cheer();
    this.cameras.main.flash(260, 255, 250, 235);
    this.setDark(0, 220);
    this.excitedUntil = this.clock + 2200;
    this.flashIn = 0;
  }

  /** Paper confetti: flips, flutters and drifts down in front of everything. */
  private confetti(n: number) {
    const cols = [0xffd23f, 0x7a2ec2, 0xffffff, 0xe8463f, 0x2fd0c0, 0xff8fb3];
    const view = this.cameras.main.worldView;
    for (let i = 0; i < n; i++) {
      const x = view.x + Math.random() * view.width;
      const c = this.add.rectangle(x, view.y - 20 - Math.random() * 200, 5 + Math.random() * 3, 9 + Math.random() * 4, cols[i % cols.length]).setDepth(12).setAngle(Math.random() * 360);
      const fall = 2400 + Math.random() * 2200;
      this.tweens.add({ targets: c, y: view.y + view.height + 40, duration: fall, ease: 'Linear', onComplete: () => c.destroy() });
      this.tweens.add({ targets: c, x: x + (Math.random() - 0.5) * 120, duration: 600 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: c, scaleX: -1, duration: 160 + Math.random() * 260, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: c, angle: c.angle + (Math.random() < 0.5 ? -360 : 360), duration: 900 + Math.random() * 900, repeat: -1 });
    }
  }

  // ───────────────────────────────────────────── the show ──

  private async run() {
    const kp = A(SPOTS.king.x, SPOTS.king.y);
    const hp = A(SPOTS.hero.x, SPOTS.hero.y);
    const rim = A(HOOP.rimX, HOOP.rimY);
    playHoops();

    await this.intro(kp, hp, rim);

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

  /**
   * The broadcast-style intro. The stinger is already covering the screen:
   * title card, then the arena in darkness with spotlights sweeping the crowd,
   * both spots land on the King, LIGHTS ON, the hoop, our hero. Tap to skip.
   */
  private async intro(kp: { x: number; y: number }, hp: { x: number; y: number }, rim: { x: number; y: number }) {
    const ch = characterById(this.hd.charId);
    this.inIntro = true;
    stingerTitle(`<div><div class="crown"></div><small>KING PUFF BALL'S</small><strong>BASKETBALL<br>PALACE</strong><em>FREE THROW SHOWDOWN</em></div>`);
    sfx.drum();
    // lights down; two spotlights hunt through the crowd
    this.setDark(0.9, 0);
    this.aimSpot(0, A(200, 90).x, A(200, 90).y, 0.9, 0.7, 0);
    this.aimSpot(1, A(1180, 40).x, A(1180, 40).y, 0.9, 0.7, 0);
    this.letterbox(true);
    this.camFocus = { x: 800, y: 420, zoom: 1.1 };
    this.fitCamera(true);
    await this.iwait(1300);
    void stingerReveal();
    this.aimSpot(0, A(1050, 150).x, A(1050, 150).y, 0.9, 0.7, 1500, 'Sine.easeInOut');
    this.aimSpot(1, A(260, 200).x, A(260, 200).y, 0.9, 0.7, 1500, 'Sine.easeInOut');
    this.tweens.add({ targets: this.camFocus, zoom: 1.28, duration: 2600, ease: 'Sine.easeInOut' });
    await this.iwait(1500);
    // both spots land on the King
    this.aimSpot(0, kp.x - 20, kp.y - 70, 1.25, 1.35, 600);
    this.aimSpot(1, kp.x + 10, kp.y - 90, 1.1, 1.2, 700);
    await this.iwait(650);
    if (!this.skipping) {
      this.cut(kp.x - 10, kp.y - 150, 2.5, false);
      this.lowerThird('KING PUFF BALL', 'Palace champion · unbeaten at home');
      this.kingAnim = { frames: ['laugh0', 'laugh1'], fps: 6 };
      sfx.laugh();
      void this.callout('“Think you can beat<br><b>THE KING</b>?”', 'speech', 1700);
      await this.iwait(1700);
      this.lowerThird(null);
      this.kingAnim = { frames: ['idle0', 'idle1'], fps: 2.5 };
    }
    // LIGHTS ON
    this.lightsOn();
    this.spots.forEach((sp) => (sp.on = false));
    this.jumboShow({ kind: 'title' }, 4000);
    if (!this.skipping) {
      this.cut(800, 430, 1.08);
      await this.iwait(1100);
      // the hoop, slow push-in
      this.cut(rim.x, rim.y + 20, 2.0);
      this.camFocus.zoom = 2.4;
      sfx.drum();
      await this.iwait(1000);
      // our hero
      this.cut(hp.x, hp.y - 90, 2.3);
      this.lowerThird(ch.name.toUpperCase(), 'The challenger');
      this.heroAnim = { frames: ['jump', 'idle0'], fps: 4 };
      await this.iwait(1300);
    }
    // back to the game: everything in its final state (also after a skip)
    this.inIntro = false;
    this.dom.querySelector<HTMLElement>('.hoops-skip')!.hidden = true;
    this.skipping = false;
    this.tapped = false;
    this.setDark(0, 0);
    this.spots.forEach((sp) => (sp.on = false));
    this.lowerThird(null);
    this.letterbox(false);
    this.kingAnim = { frames: ['idle0', 'idle1'], fps: 2.5 };
    this.heroAnim = { frames: ['idle0', 'idle1'], fps: 2 };
    this.camFocus = { x: 800, y: 450, zoom: 1 };
    this.renderScore();
    this.jumboShow(this.scoreJumbo(), 0);
    await this.callout('FREE THROW<br>SHOWDOWN!<small>5 shots each · most baskets wins</small>', 'title', 1800);
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
    const w = Math.max(0.11, 0.17 - Math.min(this.score.you.length, REGULATION - 1) * 0.01);
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
    this.renderScore();
    this.camFocus = { x: 800, y: 450, zoom: 1 };
    if (this.score.you.length > 0) await this.walkToSpot('hero');
    const hk = this.hero.scaleY / this.heroScale;
    const hp = { x: this.hero.x, y: this.hero.y - 4 };
    const n = this.score.you.length;
    await this.callout(n >= REGULATION ? 'Your shot!<small>Sudden death</small>' : `Your shot!<small>${n + 1} of ${REGULATION}</small>`, 'turn', 900);
    const speed = 1.15 + Math.min(n, REGULATION - 1) * 0.12; // sudden death doesn't speed up further
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
    const mx = hp.x + 62 * ch.scale * hk;
    const my = hp.y - ((ch.muzzleY ?? 18) * 2.6 + 6) * hk;
    sfx.shoot();
    const flash = this.add.image(mx + 8, my - 4, 'flash').setScale(0.9).setRotation(-0.5).setDepth(11);
    this.tweens.add({ targets: flash, scale: 1.4, alpha: 0, duration: 140, onComplete: () => flash.destroy() });
    this.tweens.add({ targets: this.hero, x: this.hero.x - 10, yoyo: true, duration: 90 });
    await this.shootBall(mx, my, hp.y, o, Math.sign(a) || (Math.random() < 0.5 ? -1 : 1), hk);
    this.hero.setRotation(0);
    const made = o === 'swish' || o === 'rimIn';
    this.score.you.push(made);
    this.renderScore();
    if (made) {
      this.heroAnim = { frames: ['jump', 'idle0'], fps: 5 };
      this.kingAnim = { frames: ['sad', 'idle0'], fps: 3 };
      this.cheer();
      this.jumboShow({ kind: 'big', text: o === 'swish' ? 'SWISH!' : 'BUCKET!', sub: `${this.total('you')} – ${this.total('king')}`, color: '#8fff8a', bg: '#0b5e2a' });
      await this.callout(o === 'swish' ? 'SWISH!' : 'IN!', 'good', 1000);
    } else {
      this.heroAnim = { frames: ['hurt'], fps: 1 };
      this.kingAnim = { frames: ['laugh0', 'laugh1'], fps: 6 };
      sfx.groan();
      this.jumboShow({ kind: 'big', text: o === 'rimOut' ? 'RIMMED OUT' : o === 'wide' || o === 'short' ? 'AIR BALL!' : 'BRICK!', color: '#ff8a80', bg: '#5a0b14' }, 1300);
      await this.callout(o === 'short' ? 'Too short!' : o === 'long' ? 'Too long!' : o === 'wide' ? 'Wide!' : 'Rimmed out!', 'bad', 1000);
    }
    this.heroAnim = { frames: ['idle0', 'idle1'], fps: 2 };
    this.kingAnim = { frames: ['idle0', 'idle1'], fps: 2.5 };
  }

  // ── King's shot: out of his mouth, ~35% ──

  private async kingShot() {
    this.renderScore();
    this.camFocus = { x: 800, y: 450, zoom: 1 };
    if (this.score.king.length > 0) await this.walkToSpot('king');
    const kk = this.king.scaleY / this.kingScale;
    const kp = { x: this.king.x, y: this.king.y - 6 };
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
    const mouth = { x: kp.x - 18 * kk, y: kp.y - 110 * kk };
    await this.shootBall(mouth.x, mouth.y, kp.y, o, Math.random() < 0.5 ? -1 : 1, kk);
    const made = o === 'swish' || o === 'rimIn';
    this.score.king.push(made);
    this.renderScore();
    if (made) {
      this.kingAnim = { frames: ['laugh0', 'laugh1'], fps: 6 };
      this.heroAnim = { frames: ['hurt'], fps: 1 };
      sfx.groan();
      this.jumboShow({ kind: 'big', text: 'KING SCORES', sub: `${this.total('you')} – ${this.total('king')}`, color: '#ffd23f', bg: '#4a2a00' });
      await this.callout('The King scores!', 'bad', 1000);
    } else {
      this.kingAnim = { frames: ['sad'], fps: 1 };
      this.heroAnim = { frames: ['jump', 'idle0'], fps: 5 };
      this.cheer(0.5);
      this.jumboShow({ kind: 'big', text: 'NO GOOD!', sub: 'The King misses', color: '#8fe8ff', bg: '#0b2a5e' }, 1300);
      await this.callout('The King misses!', 'good', 1000);
    }
    this.heroAnim = { frames: ['idle0', 'idle1'], fps: 2 };
    this.kingAnim = { frames: ['idle0', 'idle1'], fps: 2.5 };
  }

  /** Fly the ball from (x, y) toward the hoop and play out the outcome. */
  private async shootBall(x: number, y: number, floorY: number, o: Outcome, side: number, k = 1) {
    const rim = A(HOOP.rimX, HOOP.rimY);
    const base = A(HOOP.rimX, HOOP.baseY);
    // a bigger ball: radius ~31 in the hand, ~19 at the hoop (the rim is 88 across)
    const s0 = 1.3 * k;
    // misses must never look like they went in: short shots drop well in front of
    // the rim (on the shooter's side), long ones hit the glass and fly off sideways
    const toShooter = Math.sign(x - rim.x) || -1;
    const s1 = o === 'short' ? 0.95 : 0.8;
    let end = { x: rim.x, y: rim.y - 14 };
    if (o === 'rimIn' || o === 'rimOut') end = { x: rim.x + side * HOOP.rimRX * 0.8, y: rim.y - 12 };
    if (o === 'short') end = { x: rim.x + toShooter * 92, y: rim.y + 118 };
    if (o === 'long') end = { x: rim.x + side * 24, y: rim.y - 78 };
    if (o === 'wide') end = { x: rim.x + side * 125, y: rim.y + 6 };
    const p0 = new Phaser.Math.Vector2(x, y);
    const p2 = new Phaser.Math.Vector2(end.x, end.y);
    const p1 = new Phaser.Math.Vector2((x + end.x) / 2, Math.min(y, end.y) - 270);
    this.ball.setVisible(true).setDepth(o === 'short' ? 11 : 9).setAlpha(1);
    this.ballShadow.setVisible(true).setAlpha(0.25);
    this.prevBallY = y;
    await new Promise<void>((res) => {
      this.flight = { t: 0, dur: 1050, p0, p1, p2, s0, s1, f0: floorY, f1: base.y, res };
    });

    if (o === 'swish' || o === 'rimIn') {
      if (o === 'rimIn') {
        // rattles on the rim, then drops
        this.clank(1);
        this.cameras.main.shake(90, 0.003);
        await this.tween({ targets: this.ball, x: rim.x - side * 6, y: rim.y - 34, duration: 210, ease: 'Quad.easeOut' });
        await this.tween({ targets: this.ball, x: rim.x + side * 14, y: rim.y - 14, duration: 170, ease: 'Quad.easeIn' });
        this.clank(0.6);
        await this.tween({ targets: this.ball, x: rim.x + side * 4, y: rim.y - 22, duration: 120, ease: 'Quad.easeOut' });
      }
      // through the net (the simulated net bulges and swishes around the ball)
      sfx.swish();
      await this.tween({ targets: this.ball, x: rim.x, y: rim.y + 66, duration: 300, ease: 'Sine.easeIn' });
      this.ball.setDepth(11);
      await this.looseBall(side * 35, 240, base.y + 12);
    } else if (o === 'rimOut') {
      this.clank(1.2);
      this.cameras.main.shake(90, 0.004);
      await this.tween({ targets: this.ball, x: rim.x + side * 82, y: rim.y - 46, duration: 260, ease: 'Quad.easeOut' });
      this.ball.setDepth(11);
      await this.looseBall(side * 150, -60, base.y + 34);
    } else if (o === 'long') {
      // off the glass and away to the side
      this.clank(0.5);
      this.cameras.main.shake(70, 0.003);
      await this.tween({ targets: this.ball, x: rim.x + side * 100, y: rim.y - 36, duration: 250, ease: 'Quad.easeOut' });
      this.ball.setDepth(11);
      await this.looseBall(side * 160, -40, base.y + 34);
    } else if (o === 'short') {
      await this.looseBall(toShooter * 70, 200, base.y + 52);
    } else {
      this.ball.setDepth(11);
      await this.looseBall(side * 110, 80, base.y + 80);
    }
    this.ball.setVisible(false).setAlpha(1);
    this.ballShadow.setVisible(false).setAlpha(1);
  }

  /** Walk a player to a new shooting spot (scaled for depth on the court), then face the hoop. */
  private async walkToSpot(who: 'hero' | 'king') {
    const isHero = who === 'hero';
    const spots = isHero ? HERO_SPOTS : KING_SPOTS;
    const cur = isHero ? this.heroSpot : this.kingSpot;
    let next = cur;
    while (next === cur) next = Math.floor(Math.random() * spots.length);
    if (isHero) this.heroSpot = next;
    else this.kingSpot = next;
    const spr = isHero ? this.hero : this.king;
    const base = isHero ? this.heroScale : this.kingScale;
    const baseY = isHero ? HERO_SPOTS[0].y : KING_SPOTS[0].y;
    const to = A(spots[next].x, spots[next].y);
    const lift = isHero ? 4 : 6;
    const dist = Math.hypot(to.x - spr.x, to.y + lift - spr.y);
    // art: heroes face right, the King faces left
    const goingRight = to.x > spr.x;
    spr.setFlipX(isHero ? !goingRight : goingRight);
    if (isHero) this.heroAnim = { frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 10 };
    else this.kingAnim = { frames: ['run0', 'run1'], fps: 6 };
    await this.tween({
      targets: spr,
      x: to.x,
      y: to.y + lift,
      duration: Math.max(450, dist * 4.2),
      ease: 'Sine.easeInOut',
      onUpdate: () => spr.setScale(base * depthK(spr.y - lift - STAGE_OY, baseY)),
    });
    spr.setFlipX(false);
    if (isHero) this.heroAnim = { frames: ['idle0', 'idle1'], fps: 2 };
    else this.kingAnim = { frames: ['idle0', 'idle1'], fps: 2.5 };
  }

  /** Step and draw the net; the ball pushes through it when it's in the hoop. */
  private updateNet(dt: number) {
    const rim = A(HOOP.rimX, HOOP.rimY);
    let ball: { x: number; y: number; r: number; vy: number } | null = null;
    if (this.ball.visible && dt > 0) {
      const r = 72 * this.ball.scaleX;
      const bx = this.ball.x - rim.x;
      const by = this.ball.y - rim.y;
      const vy = (this.ball.y - this.prevBallY) / dt;
      if (Math.abs(bx) < HOOP.rimRX + r && by > -r && by < 80) ball = { x: bx, y: by, r, vy };
    }
    this.prevBallY = this.ball.y;
    this.netSim.step(dt, ball);
    this.netSim.draw(this.netBack, this.netFront, rim.x, rim.y);
  }

  /** A clank on the rim: the hoop shivers and the net jumps. */
  private clank(k = 1) {
    sfx.clank();
    this.netSim.impulse(k);
    this.tweens.add({ targets: [this.rimFront, this.board], y: '+=2', duration: 50, yoyo: true, repeat: 1 });
  }

  /** Let the ball go: gravity, bounces that get lower each time, a roll, then it fades. */
  private looseBall(vx: number, vy: number, floorY: number) {
    return new Promise<void>((res) => (this.loose = { vx, vy, floorY, t: 0, res }));
  }

  private updateLooseBall(dt: number) {
    const L = this.loose;
    if (!L) return;
    L.t += dt;
    const r = 72 * this.ball.scaleY;
    L.vy += 1500 * dt;
    this.ball.x += L.vx * dt;
    this.ball.y += L.vy * dt;
    this.ball.rotation += (L.vx * dt) / Math.max(4, r);
    if (this.ball.y > L.floorY - r) {
      this.ball.y = L.floorY - r;
      if (L.vy > 140) {
        sfx.dribble(Math.min(1, L.vy / 700));
        L.vy = -L.vy * 0.58;
        L.vx *= 0.86;
        // squash on impact
        const sx = this.ball.scaleX;
        this.tweens.add({ targets: this.ball, scaleY: sx * 0.84, scaleX: sx * 1.1, duration: 50, yoyo: true });
      } else {
        L.vy = 0;
        L.vx *= Math.pow(0.25, dt); // rolling to a stop
      }
    }
    const height = L.floorY - r - this.ball.y;
    this.ballShadow.setPosition(this.ball.x, L.floorY + 2).setAlpha(0.75 * (1 - Math.min(1, height / 260)));
    if (L.t > 1.7 || (L.vy === 0 && Math.abs(L.vx) < 12)) {
      this.loose = null;
      this.tweens.add({ targets: [this.ball, this.ballShadow], alpha: 0, duration: 260, onComplete: () => L.res() });
    }
  }

  /** Keep a floor reflection in step with its sprite. */
  private mirror(r: Phaser.GameObjects.Sprite, src: Phaser.GameObjects.Sprite) {
    r.setVisible(src.visible);
    r.setFrame(src.frame.name);
    r.setScale(src.scaleX, src.scaleY * 0.8);
    r.setFlipX(src.flipX);
    r.setPosition(src.x, src.y - 2);
    r.setOrigin(0.5, 0);
    r.setRotation(-src.rotation);
  }

  /** A camera flash somewhere in the stands. */
  private cameraFlash() {
    const lower = Math.random() < 0.55;
    const x = Math.random() * ARENA_W;
    const y = lower ? 250 + Math.random() * 130 : 50 + Math.random() * 150;
    const f = this.add
      .image(x, y, 'camflash')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale((lower ? 0.55 : 0.32) * (0.7 + Math.random() * 0.6))
      .setDepth(this.dark.level > 0.1 ? 11.5 : 1.5);
    this.tweens.add({ targets: f, alpha: 0, duration: 110 + Math.random() * 90, ease: 'Quad.easeIn', onComplete: () => f.destroy() });
  }

  private cheer(k = 1) {
    sfx.cheer();
    this.excitedUntil = this.clock + 1700 * k;
    // the whole crowd jumps
    this.tweens.add({ targets: this.crowd, y: -4 * k, duration: 150, yoyo: true, repeat: Math.round(3 * k), ease: 'Quad.easeOut' });
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
    const kp = { x: this.king.x, y: this.king.y - 6 };
    this.cut(kp.x - 40, kp.y - 120, 1.9);
    this.kingAnim = { frames: ['sad'], fps: 1 };
    await this.callout('“NOOOO!”', 'speech', 1100);
    // the King runs out of the arena
    this.kingAnim = { frames: ['run0', 'run1'], fps: 10 };
    this.camFocus = { x: 800, y: 450, zoom: 1 };
    this.king.setFlipX(true);
    this.cheer(1.5);
    this.jumboShow({ kind: 'big', text: 'NEW CHAMP!', sub: `${characterById(this.hd.charId).name} beats the King ${this.total('you')} – ${this.total('king')}`, color: '#ffd23f', bg: '#3d1478' }, 1e9);
    await this.tween({ targets: this.king, x: ARENA_W + 220, duration: 1500, ease: 'Quad.easeIn' });
    // the house lights dip and a spotlight finds the champion; confetti everywhere
    const hpw = { x: this.hero.x, y: this.hero.y - 4 };
    this.setDark(0.45, 400);
    this.aimSpot(0, hpw.x, hpw.y - 60, 1.2, 1.4, 0);
    this.aimSpot(1, hpw.x + 10, hpw.y - 80, 1.0, 1.2, 500);
    this.confetti(160);
    this.excitedUntil = this.clock + 4000;
    this.heroAnim = { frames: ['jump', 'idle0'], fps: 5 };
    await this.callout(`YOU BEAT<br>KING PUFF BALL!<small>${this.total('you')} – ${this.total('king')}</small>`, 'title', 2200);
    fadeOutMusic(500);
    const result: ResultState = { ...this.hd.result, hoops: `${this.total('you')} – ${this.total('king')}`, level: this.hd.level ?? 1 };
    this.game.events.emit('level-complete', result);
  }

  private async kingWins() {
    const kp = { x: this.king.x, y: this.king.y - 6 };
    this.cut(kp.x - 10, kp.y - 140, 2.3);
    this.kingAnim = { frames: ['laugh0', 'laugh1'], fps: 7 };
    sfx.laugh();
    this.jumboShow({ kind: 'big', text: 'KING WINS', sub: `${this.total('king')} – ${this.total('you')}`, color: '#ffd23f', bg: '#5a0b0b' }, 1e9);
    // lights down, one spotlight on the gloating King
    this.setDark(0.6, 500);
    this.aimSpot(0, kp.x, kp.y - 80, 1.3, 1.4, 0);
    await this.callout('“HA HA HA HA!”', 'speech', 1600);
    sfx.laugh();
    this.camFocus = { x: 800, y: 450, zoom: 1 };
    const hadLife = loseLife();
    const next = hadLife ? 'back to your last checkpoint' : 'no lives left';
    await this.callout(`KING PUFF BALL WINS<small>${this.total('king')} – ${this.total('you')} · ${next}</small>`, 'title bad', 2400);
    fadeOutMusic(500);
    if (!hadLife) {
      const ch = characterById(this.hd.charId);
      this.game.events.emit('game-over', { charId: ch.id, name: ch.name, checkpoint: this.hd.checkpoint } satisfies GameOverState);
      return;
    }
    this.cameras.main.fadeOut(400, 20, 10, 38);
    await this.wait(450);
    this.scene.start('Game', { session: this.hd.session, checkpoint: this.hd.checkpoint, retry: true, level: this.hd.level ?? 1 } satisfies GameData);
  }
}
