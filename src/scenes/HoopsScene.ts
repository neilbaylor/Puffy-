import Phaser from 'phaser';
import { characterById } from '../data/characters';
import type { Session } from '../core/session';
import { fadeOutMusic, playHoops, setMusicRate } from '../core/music';
import { sfx } from '../core/sfx';
import { ART_RES, CHAR_H, canvas } from '../gfx/draw';
import {
  ARENA_H,
  ARENA_W,
  CROWD_H,
  FRONT_H,
  HOOP,
  JUMBO,
  RIBBON,
  drawRibbonScreen,
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
  drawKingCrown,
  kingCrownAt,
  kingHandAt,
  drawRimBack,
  drawRimFrontTube,
  drawSoftShadow,
  PALACE,
  SUMMIT,
  setArenaStyle,
  type ArenaStyle,
  drawSpotBrush,
  drawSpotlight,
  drawJumboScreen,
  type JumboContent,
} from '../gfx/hoops';
import { stingerReveal, stingerTitle } from '../ui/stinger';
import { addCanvas, hires } from '../gfx/textures';
import { BOOM_FRAMES, BOOM_SIZE, drawBoomFrame } from '../gfx/boom';
import { gamepadSources } from '../input/gamepad';
import { isKeyDown } from '../input/keyboard';
import { usingTouch } from '../input/touch';
import type { GameData, GameOverState, ResultState } from './GameScene';
import { loseLife } from '../core/lives';
import { NetSim } from './hoopsNet';
import { SimpleConfetti } from '../world/SimpleConfetti';
import { PLOP_FRAMES, PLOP_H, PLOP_KINDS, PLOP_SCALE, PLOP_W, drawPlop, type PlopKind } from '../gfx/plops';
import { STYLES } from '../gfx/handdrawn';

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
/** Part 2's rematch is a little harder: the King shoots better, the meters move a bit faster. */
const HARDER = { kingMake: 0.52, speed: 1.08, zone: 0.012 };
const REGULATION = 5;

/** Where each player shoots from (stage coords, feet): they walk to a new one before every shot. */
const HERO_SPOTS = [
  { x: 180, y: 640 },
  { x: 300, y: 588 },
  { x: 80, y: 700 },
  { x: 370, y: 676 },
  { x: 235, y: 560 },
  { x: 125, y: 612 },
];
// (kept inside what a 4:3 iPad screen shows, so the King never walks off the edge)
const KING_SPOTS = [
  { x: 790, y: 650 },
  { x: 780, y: 598 },
  { x: 710, y: 702 },
  { x: 748, y: 565 },
  { x: 798, y: 694 },
  { x: 728, y: 626 },
];
/** Perspective: how big someone standing at stage height y looks, relative to `baseY`. */
const depthK = (y: number, baseY: number) => (y - 120) / (baseY - 120);

const ARENA_RES = 1.25;
const KING_RES = 2.5;
/** Stage (1280 × 720) → arena texture coordinates. */
/** The screen's safe-area insets (notch, rounded corners) in CSS px (re-read on resize). */
const readSafe = () => {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(d);
  const cs = getComputedStyle(d);
  const r = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
  d.remove();
  return r;
};
let SAFE = readSafe();
window.addEventListener('resize', () => setTimeout(() => (SAFE = readSafe()), 120));
const A = (x: number, y: number) => ({ x: x + STAGE_OX, y: y + STAGE_OY });

/**
 * The finale: a free-throw contest against King Puff Ball in his palace.
 * Pseudo-3D: the court is drawn in perspective and the ball shrinks as it
 * flies away from the camera toward the hoop.
 */
export class HoopsScene extends Phaser.Scene {
  /** The last big shout on a swish (so it changes each time). */
  private lastShout = '';
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
  private crown!: Phaser.GameObjects.Image;
  private crownState!: { mode: 'on' | 'loose' | 'back' | 'gone'; x: number; y: number; vx: number; vy: number; rot: number; vr: number; tilt: number; bounces: number; falls: number };
  private kingHop = { h: 0 };
  private nextHop = 3000;
  private kingTalkUntil = 0;
  private confettiFx!: SimpleConfetti;
  private heroCrowned = false;
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
  // the LED ribbon marquee between the decks
  private ribbonTex!: Phaser.Textures.CanvasTexture;
  private ribbonMsg: { text: string; color: string; bg: string; t0: number } | null = null;
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

  /** Part 1 plays in the Palace, Part 2 in the Summit Dome. */
  private get style(): ArenaStyle {
    return (this.hd.level ?? 1) === 2 ? SUMMIT : PALACE;
  }
  private get hard() {
    return (this.hd.level ?? 1) === 2;
  }
  private k(key: string) {
    return `${key}:${this.style.id}`;
  }

  private makeTextures() {
    setArenaStyle(this.style);
    if (!this.textures.exists(this.k('arena'))) addCanvas(this, this.k('arena'), hires(ARENA_W, ARENA_H, ARENA_RES, (ctx) => drawArena(ctx)), undefined, { release: true });
    if (!this.textures.exists('king')) {
      const { c, ctx } = canvas(Math.ceil(KING_W * KING_FRAMES.length * KING_RES), Math.ceil(KING_H * KING_RES));
      ctx.scale(KING_RES, KING_RES);
      KING_FRAMES.forEach((f, i) => {
        ctx.save();
        ctx.translate(i * KING_W, 0);
        drawKing(ctx, 0, 0, f, false);
        ctx.restore();
      });
      addCanvas(this, 'king', c, (t) => KING_FRAMES.forEach((f, i) => t.add(f, 0, Math.round(i * KING_W * KING_RES), 0, Math.round(KING_W * KING_RES), Math.round(KING_H * KING_RES))));
    }
    for (const kind of PLOP_KINDS) {
      const key = `plop-${kind}`;
      if (!this.textures.exists(key)) {
        const R = 2.5;
        const pw = Math.round(PLOP_W * R) + 4;
        const { c, ctx } = canvas(pw * PLOP_FRAMES.length, Math.round(PLOP_H * R));
        PLOP_FRAMES.forEach((f, i) => {
          ctx.save();
          ctx.translate(i * pw, 0);
          ctx.scale(R, R);
          drawPlop(ctx, 0, 0, f, STYLES.polished, kind);
          ctx.restore();
        });
        addCanvas(this, key, c, (t) => PLOP_FRAMES.forEach((f, i) => t.add(f, 0, i * pw, 0, Math.round(PLOP_W * R), Math.round(PLOP_H * R))));
      }
    }
    if (!this.textures.exists('kingcrown')) addCanvas(this, 'kingcrown', hires(64, 44, KING_RES, (ctx) => drawKingCrown(ctx, 32, 40)));
    if (!this.textures.exists(this.k('crowd'))) addCanvas(this, this.k('crowd'), hires(ARENA_W, CROWD_H, ARENA_RES, (ctx) => drawCrowd(ctx, false)), undefined, { release: true });
    if (!this.textures.exists(this.k('crowd2'))) addCanvas(this, this.k('crowd2'), hires(ARENA_W, CROWD_H, ARENA_RES, (ctx) => drawCrowd(ctx, true)), undefined, { release: true });
    if (!this.textures.exists(this.k('arenafront'))) addCanvas(this, this.k('arenafront'), hires(ARENA_W, FRONT_H, ARENA_RES, (ctx) => drawArenaFront(ctx)), undefined, { release: true });
    if (!this.textures.exists('camflash')) addCanvas(this, 'camflash', hires(48, 48, 1, (ctx) => drawCameraFlash(ctx, 24)));
    if (!this.textures.exists('hball')) addCanvas(this, 'hball', hires(52, 52, 3, (ctx) => drawBall(ctx, 26, 26, 24)));
    if (!this.textures.exists(this.k('backboard'))) {
      // drawn in stage coordinates around the hoop, then cropped
      addCanvas(this, this.k('backboard'), hires(320, 420, 3, (ctx) => {
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

    this.add.image(0, 0, this.k('arena')).setOrigin(0, 0).setScale(1 / ARENA_RES).setDepth(0);
    this.crowd = this.add.image(0, 0, this.k('crowd')).setOrigin(0, 0).setScale(1 / ARENA_RES).setDepth(1);
    this.add.image(0, 0, this.k('arenafront')).setOrigin(0, 0).setScale(1 / ARENA_RES).setDepth(2);
    // the crowd sways a little all the time
    this.tweens.add({ targets: this.crowd, y: 1.2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.flashIn = 300;
    this.excitedUntil = 0;

    const bb = A(HOOP.rimX, HOOP.rimY);
    this.board = this.add.image(bb.x, bb.y, this.k('backboard')).setOrigin(0.5, 220 / 420).setScale(1 / 3).setDepth(5);

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
    // his crown is its own sprite: it rides on his head, and now and then it falls off
    this.crown = this.add.image(0, 0, 'kingcrown').setOrigin(0.5, 40 / 44).setScale(this.kingScale).setDepth(8.05);
    this.crownState = { mode: 'on', x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, tilt: 0, bounces: 0, falls: 0 };
    this.kingHop = { h: 0 };
    this.nextHop = 2500 + Math.random() * 2000;
    this.kingTalkUntil = 0;
    this.heroCrowned = false;
    this.crownBusy = false;
    this.heroHop = { h: 0 };
    this.nextHeroHop = 2500;
    this.confettiFx = new SimpleConfetti(this, 12);
    // faint mirror images in the glossy floor
    this.heroRefl = this.add.sprite(0, 0, `char-${ch.id}`, 'idle0').setOrigin(0.5, 1).setFlipY(true).setAlpha(0.16).setDepth(4);
    this.kingRefl = this.add.sprite(0, 0, 'king', 'idle0').setOrigin(0.5, 1).setFlipY(true).setAlpha(0.16).setDepth(4);

    // ball + its shadow on the floor
    this.ballShadow = this.add.image(0, 0, 'softshadow').setDisplaySize(48, 14).setDepth(6).setVisible(false);
    for (let i = 0; i < 4; i++) this.ghosts.push(this.add.image(0, 0, 'hball').setDepth(8.9).setVisible(false).setAlpha(0.3 - i * 0.07));
    this.ball = this.add.image(0, 0, 'hball').setScale(1 / 3).setDepth(9).setVisible(false);
    this.netSim = new NetSim(HOOP.rimRX, HOOP.rimRY, 46, this.style.net);
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
    this.add.image(jp.x, jp.y, 'jumbo').setOrigin(0, 0).setScale(JUMBO.s / JR).setDepth(11.6);
    this.ribbonTex = (this.textures.exists('ribbon') ? this.textures.get('ribbon') : this.textures.createCanvas('ribbon', RIBBON.w * JR, RIBBON.h * JR)) as Phaser.Textures.CanvasTexture;
    const rp = A(RIBBON.x, RIBBON.y);
    this.add.image(rp.x, rp.y, 'ribbon').setOrigin(0, 0).setScale(1 / JR).setDepth(2.05);
    this.ribbonMsg = null;
    this.drawJumbo();

    this.dom = document.createElement('div');
    this.dom.className = 'hoops';
    this.dom.innerHTML = `
      <div class="hoops-meters" hidden>
        <div class="hm" data-m="power"><b>Power</b><div class="hm-bar"><i class="hm-zone"></i><i class="hm-mark"></i></div></div>
        <div class="hm" data-m="aim"><b>Aim</b><div class="hm-bar"><i class="hm-zone"></i><i class="hm-mark"></i></div></div>
        <p class="hm-hint">${usingTouch() ? 'Tap' : 'Press Space or click'} to stop the marker in the green!</p>
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
    let fx = this.camFocus.x;
    let fy = this.camFocus.y;
    let fz = this.camFocus.zoom;
    // how "wide" the shot is: 1 for the full-arena shot, 0 for close-ups, blended in
    // between (so gliding from a close-up out to the arena never jumps or jerks)
    const wk = Phaser.Math.Clamp((1.3 - fz) / 0.25, 0, 1);
    const ease = wk * wk * (3 - 2 * wk);
    // each arena's broadcast camera sits in its own spot
    const lc = this.style.layout.cam;
    // the wide shot centres on the hoop (the scoreboard hangs right above it)
    fx += (A(HOOP.rimX, 0).x - 800) * ease;
    fx += lc.dx * ease;
    fy += lc.dy * ease;
    fz *= 1 + (lc.zoom - 1) * ease;
    cam.setRotation(lc.rot * (0.4 + 0.6 * ease));
    // during the contest the wide shot is alive: a slow drift and breathing zoom like a
    // broadcast camera, leaning toward the ball while it's in the air
    if (!this.inIntro && ease > 0) {
      const t = this.clock / 1000;
      fx += (Math.sin(t * 0.23) * 30 + Math.sin(t * 0.57 + 1) * 8) * ease;
      fy += Math.sin(t * 0.17 + 2) * 14 * ease;
      fz *= 1 + (0.01 + 0.02 * Math.sin(t * 0.29)) * ease;
      if (this.flight || this.loose) {
        fx += (this.ball.x - fx) * 0.18 * ease;
        fy += (this.ball.y - fy) * 0.08 * ease;
        fz *= 1 + 0.03 * ease;
      }
    }
    let z = this.baseZoom * fz;
    // the wide shot always keeps the whole jumbotron (and everyone's feet) in view:
    // on long phone screens that means pulling back a little and framing a touch higher
    const jTop = A(0, JUMBO.y).y - 16;
    // (wherever they're standing now: they shoot from different spots)
    const feet = Math.max(A(0, Math.max(SPOTS.hero.y, SPOTS.king.y)).y, this.hero?.y ?? 0, this.king?.y ?? 0) + 30;
    const zWide = Math.min(z, this.scale.height / (feet - jTop), Math.max(this.scale.width / ARENA_W, this.scale.height / ARENA_H));
    z += (zWide - z) * ease;
    // in cutscenes the camera follows the (already eased) glide exactly; in the
    // contest it drifts softly toward its target
    const follow = snap || this.inIntro;
    // (time-based, so it settles at the same speed at any frame rate)
    const k = 1 - Math.exp(-Math.min(0.1, this.game.loop.delta / 1000) * 3.7);
    const target = follow ? z : cam.zoom + (z - cam.zoom) * k;
    cam.setZoom(target);
    const vw = this.scale.width / target;
    const vh = this.scale.height / target;
    let x = Phaser.Math.Clamp(fx, vw / 2, ARENA_W - vw / 2);
    let y = Phaser.Math.Clamp(fy, vh / 2, ARENA_H - vh / 2);
    if (ease > 0) {
      // (kept clear of the phone's notch / rounded corners too)
      const jx0 = A(JUMBO.x, 0).x - 12 - SAFE.l / target;
      const jx1 = A(JUMBO.x + JUMBO.w * JUMBO.s, 0).x + 12 + SAFE.r / target;
      const yw = Phaser.Math.Clamp(Phaser.Math.Clamp(y, Math.min(feet - vh / 2, jTop + vh / 2), jTop + vh / 2), vh / 2, ARENA_H - vh / 2);
      // …but never so far that a shooter on the edge of the court is cut off
      const left = Math.min(this.hero?.x ?? A(SPOTS.hero.x, 0).x, A(SPOTS.hero.x, 0).x) - 70;
      const right = Math.max(this.king?.x ?? A(SPOTS.king.x, 0).x, A(SPOTS.king.x, 0).x) + 130;
      const xs = Phaser.Math.Clamp(x, right - vw / 2, Math.max(right - vw / 2, left + vw / 2));
      // (the arena's painted edge stops a little short of its very edge)
      const xw = Phaser.Math.Clamp(Phaser.Math.Clamp(xs, jx1 - vw / 2, jx0 + vw / 2), vw / 2 + 90, Math.max(vw / 2 + 90, ARENA_W - 90 - vw / 2));
      x += (xw - x) * ease;
      y += (yw - y) * ease;
    }
    if (follow) cam.centerOn(x, y);
    else {
      const cx = cam.midPoint.x + (x - cam.midPoint.x) * k;
      const cy = cam.midPoint.y + (y - cam.midPoint.y) * k;
      cam.centerOn(cx, cy);
    }
  }

  /** A smooth camera move (no cut) to a new framing; resolves when it arrives. */
  private glide(x: number, y: number, zoom: number, ms: number) {
    this.tweens.killTweensOf(this.camFocus);
    return this.tween({ targets: this.camFocus, x, y, zoom, duration: this.skipping ? 1 : ms, ease: 'Sine.easeInOut' });
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
    if (cls.includes('speech')) this.kingTalkUntil = this.clock + Math.min(ms, 1500);
    el.innerHTML = text;
    void el.offsetWidth;
    const token = ++this.calloutToken;
    return this.wait(ms).then(() => {
      if (token === this.calloutToken) el.className = 'hoops-callout';
    });
  }

  /** The jumbotron is the scoreboard: it shows the score between the big moments. */
  private renderScore() {
    if (this.jumbo.kind !== 'big') this.jumbo = this.scoreJumbo();
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
    let kf = k.frames[Math.floor((this.clock / 1000) * k.fps) % k.frames.length];
    // talking: his mouth flaps while he speaks (unless he's laughing or sulking)
    if (this.clock < this.kingTalkUntil && (kf === 'idle0' || kf === 'idle1')) kf = Math.floor(this.clock / 110) % 2 ? 'talk' : 'idle0';
    this.king.setFrame(kf);
    this.updateKingLife(dt);
    this.updateHeroLife();
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
    const want = this.k(excited && Math.floor(this.clock / 170) % 3 !== 2 ? 'crowd2' : 'crowd');
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
  /** The King can't keep still: little hops, and his crown keeps slipping off. */
  private updateKingLife(dt: number) {
    const k = this.king;
    const idle = this.kingAnim.frames[0] === 'idle0' && this.king.visible;
    if (idle && this.clock > this.nextHop && this.kingHop.h === 0 && !this.tweens.isTweening(this.kingHop)) {
      this.nextHop = this.clock + 1500 + Math.random() * 2200;
      const big = Math.random() < 0.45;
      // now and then he spins round mid-hop to wave at his fans
      if (big && Math.random() < 0.35) {
        this.time.delayedCall(110, () => this.king.setFlipX(!this.king.flipX));
        this.time.delayedCall(330, () => this.king.setFlipX(!this.king.flipX));
      }
      this.tweens.add({
        targets: this.kingHop,
        h: big ? 34 : 16,
        duration: big ? 230 : 160,
        yoyo: true,
        repeat: big ? 0 : 1,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.kingHop.h = 0;
          sfx.bump();
          // a big landing can knock his crown off (not every time, and not too often)
          if (big && this.crownState.mode === 'on' && this.crownState.falls < 2 && Math.random() < 0.6) this.crownFall();
        },
      });
    }
    // the hop lifts the picture, not the King's real position (walks and tweens own that)
    const hopPx = this.kingHop.h;
    k.setOrigin(0.5, 1 + hopPx / (KING_H * KING_RES));
    // the crown
    const c = this.crown;
    const cs = this.crownState;
    const at = kingCrownAt(k.frame.name);
    const flip = k.flipX ? -1 : 1;
    const headX = k.x + (at.x - KING_W / 2) * KING_RES * k.scaleX * flip;
    const headY = k.y + (at.y - KING_H) * KING_RES * k.scaleY - hopPx * k.scaleY * KING_RES;
    c.setVisible(k.visible || cs.mode === 'loose' || cs.mode === 'gone');
    if (!this.heroCrowned && cs.mode !== 'gone') c.setScale(Math.abs(k.scaleX), k.scaleY);
    if (this.heroCrowned && !this.tweens.isTweening(c)) {
      // the champion wears it now
      const h = this.hero;
      c.setPosition(h.x + (h.flipX ? -2 : 2), h.y - h.displayHeight * 0.9 + 12).setAngle(h.flipX ? 12 : -12);
    } else if (cs.mode === 'on') {
      cs.tilt *= Math.exp(-dt / 1000 * 3);
      c.setPosition(headX, headY).setRotation(k.rotation + cs.tilt).setFlipX(k.flipX);
    } else if (cs.mode === 'loose') {
      const t = dt / 1000;
      cs.vy += 1500 * t;
      cs.x += cs.vx * t;
      cs.y += cs.vy * t;
      cs.rot += cs.vr * t;
      const floor = k.y + 4;
      if (cs.y > floor && cs.vy > 0) {
        cs.y = floor;
        cs.vy *= -0.38;
        cs.vx *= 0.6;
        cs.vr *= 0.5;
        cs.bounces++;
        sfx.bump();
        if (cs.bounces > 2) {
          cs.vy = 0;
          cs.vx = 0;
          cs.vr = 0;
        }
      }
      c.setPosition(cs.x, cs.y).setRotation(cs.rot);
    }
  }

  /**
   * Oops — the crown slips off and bounces on the floor. He looks down at it,
   * hops over, bends down and grabs it, holds it up high, plonks it back on
   * with both hands (crooked), wiggles it straight — *ahem* — and hops back.
   */
  private crownBusy = false;
  private crownFall() {
    const cs = this.crownState;
    if (cs.mode !== 'on' || !this.king.visible || this.crownBusy) return;
    this.crownBusy = true;
    cs.mode = 'loose';
    cs.falls++;
    cs.x = this.crown.x;
    cs.y = this.crown.y;
    const side = Math.random() < 0.5 ? -1 : 1;
    cs.vx = side * (80 + Math.random() * 60);
    cs.vy = -380;
    cs.rot = this.crown.rotation;
    cs.vr = side * 9;
    cs.bounces = 0;
    sfx.whoosh();
    this.kingTalkUntil = 0;
    void this.crownPickup();
  }

  private async crownPickup() {
    const k = this.king;
    const cs = this.crownState;
    const home = { x: k.x, flip: k.flipX };
    const anim = (frames: string[], fps = 1) => (this.kingAnim = { frames, fps });
    anim(['sad']);
    await this.wait(900); // watches it bounce away
    if (!k.visible) return void (this.crownBusy = false);
    // face it and hop over so his hand lands right on it
    const faceRight = cs.x > k.x;
    k.setFlipX(faceRight);
    const hand = kingHandAt('bend');
    const reach = (hand.x - KING_W / 2) * KING_RES * k.scaleX * (faceRight ? -1 : 1);
    anim(['run0', 'run1'], 9);
    await this.tween({ targets: k, x: cs.x - reach, duration: 420, ease: 'Sine.easeInOut' });
    // bend down and grab it
    anim(['bend']);
    await this.wait(260);
    cs.mode = 'on';
    cs.tilt = -0.5;
    sfx.bump();
    await this.wait(260);
    // hold it up high (it glints)
    anim(['hold']);
    cs.tilt = 0.2;
    await this.wait(120);
    this.confettiFx.burst(this.crown.x, this.crown.y - 20, 8, { power: 220, glitter: 1, colors: [0xffd23f, 0xffffff] });
    await this.wait(380);
    // both hands: plonk it on (crooked), wiggle it straight
    anim(['adjust0', 'adjust1'], 8);
    cs.tilt = 0.45 * (Math.random() < 0.5 ? -1 : 1);
    this.tweens.add({ targets: cs, tilt: 0, duration: 650, ease: 'Elastic.easeOut' });
    await this.wait(650);
    anim(['idle0', 'idle1'], 2.5);
    const t = this.add.text(this.crown.x, this.crown.y - 60, '*ahem*', { fontFamily: '"Lilita One", sans-serif', fontSize: '26px', color: '#ffe58a', stroke: '#2a1030', strokeThickness: 6 }).setOrigin(0.5).setDepth(12);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, delay: 500, duration: 700, onComplete: () => t.destroy() });
    // back to his spot
    if (Math.abs(k.x - home.x) > 4) {
      k.setFlipX(home.x > k.x);
      anim(['run0', 'run1'], 9);
      await this.tween({ targets: k, x: home.x, duration: 420, ease: 'Sine.easeInOut' });
    }
    k.setFlipX(home.flip);
    anim(['idle0', 'idle1'], 2.5);
    this.crownBusy = false;
  }

  /** The hero can't keep still either: little hops while waiting. */
  private heroHop = { h: 0 };
  private nextHeroHop = 2000;
  private updateHeroLife() {
    const h = this.hero;
    const idle = this.heroAnim.frames[0] === 'idle0' && !this.meter && !this.flight && !this.inIntro;
    if (idle && this.clock > this.nextHeroHop && !this.tweens.isTweening(this.heroHop)) {
      this.nextHeroHop = this.clock + 1800 + Math.random() * 2600;
      const two = Math.random() < 0.4;
      this.tweens.add({ targets: this.heroHop, h: two ? 14 : 22, duration: two ? 130 : 180, yoyo: true, repeat: two ? 1 : 0, ease: 'Quad.easeOut', onComplete: () => (this.heroHop.h = 0) });
    }
    h.setOrigin(0.5, 1 + this.heroHop.h / (CHAR_H * ART_RES));
  }

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
    return {
      kind: 'score',
      you: this.total('you'),
      king: this.total('king'),
      name: characterById(this.hd.charId).name,
      sudden: this.score.you.length > REGULATION,
      youShots: [...this.score.you],
      kingShots: [...this.score.king],
      regulation: REGULATION,
    };
  }

  /** Show something on the jumbotron (for `ms`, then back to the score). */
  private jumboShow(c: JumboContent, ms = 1500) {
    this.jumbo = c;
    if (c.kind === 'big') this.ribbonMsg = { text: c.text, color: c.color, bg: c.bg, t0: this.clock / 1000 };
    this.jumboUntil = this.clock + ms;
    this.drawJumbo();
  }

  private drawJumbo() {
    const ctx = this.jumboTex.getContext();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawJumboScreen(ctx, this.jumbo, this.clock / 1000);
    this.jumboTex.refresh();
    const rctx = this.ribbonTex.getContext();
    rctx.setTransform(2, 0, 0, 2, 0, 0);
    drawRibbonScreen(rctx, this.clock / 1000, this.ribbonMsg);
    this.ribbonTex.refresh();
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

  /**
   * Part 2's ending: the King EXPLODES. A white-hot flash and a moment of slow
   * motion, a shockwave ring, a fireball glow and smoke, then a huge blast of
   * confetti, streamers and glitter (with a few secondary pops), cannons from
   * both sides — and his crown spins up into the rafters and lands on you.
   */
  private burstKing() {
    const k = this.king;
    const cx = k.x;
    const cy = k.y - k.displayHeight * 0.5;
    const cam = this.cameras.main;
    sfx.explode();
    sfx.drum();
    cam.flash(420, 255, 250, 235);
    cam.shake(700, 0.022);
    k.setVisible(false);
    this.kingRefl.setVisible(false);
    this.kingShadow.setVisible(false);
    // slow motion for a beat, easing back to full speed
    this.confettiFx.timeScale = 0.25;
    this.tweens.add({ targets: this.confettiFx, timeScale: 1, delay: 380, duration: 900, ease: 'Sine.easeIn' });
    // the big cartoon BOOM (hand-drawn frames, made the first time it's needed)
    if (!this.textures.exists('kingboom')) {
      const R = 1.5;
      const c = document.createElement('canvas');
      const fw = Math.round(BOOM_SIZE * R);
      c.width = fw * BOOM_FRAMES.length;
      c.height = fw;
      const ctx = c.getContext('2d')!;
      BOOM_FRAMES.forEach((_, i) => {
        ctx.save();
        ctx.translate(i * fw, 0);
        ctx.scale(R, R);
        drawBoomFrame(ctx, i);
        ctx.restore();
      });
      addCanvas(this, 'kingboom', c, (t) => BOOM_FRAMES.forEach((f, i) => t.add(f, 0, i * fw, 0, fw, fw)));
    }
    const boom = this.add.image(cx, cy, 'kingboom', 'b0').setDepth(12.25).setScale(1.5 / 1.5);
    BOOM_FRAMES.forEach((f, i) => this.time.delayedCall(i * 70, () => boom.setFrame(f)));
    this.tweens.add({ targets: boom, scale: 1.9 / 1.5, duration: BOOM_FRAMES.length * 70, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: boom, alpha: 0, delay: BOOM_FRAMES.length * 70 - 120, duration: 260, onComplete: () => boom.destroy() });
    // fireball glow
    const glow = this.add.image(cx, cy, 'spot').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd27a).setDepth(12.2).setScale(0.2).setAlpha(1);
    this.tweens.add({ targets: glow, scale: 3.2, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => glow.destroy() });
    // shockwave rings
    for (const [delay, col, w] of [[0, 0xffffff, 14], [90, 0xffd23f, 8], [180, 0xff8fb3, 5]] as const) {
      const ring = this.add.graphics().setDepth(12.3).setBlendMode(Phaser.BlendModes.ADD);
      const st = { r: 20, a: 1 };
      this.tweens.add({
        targets: st,
        r: 760,
        a: 0,
        delay,
        duration: 900,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          ring.clear();
          ring.lineStyle(w * st.a + 1, col, st.a).strokeEllipse(cx, cy, st.r * 2, st.r * 1.3);
        },
        onComplete: () => ring.destroy(),
      });
    }
    // smoke puffs rolling out
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const p = this.add.image(cx, cy, 'softshadow').setTint(0xffffff).setAlpha(0.5).setDepth(11.9).setDisplaySize(90, 70);
      this.tweens.add({ targets: p, x: cx + Math.cos(a) * 260, y: cy + Math.sin(a) * 170, displayWidth: 260, displayHeight: 200, alpha: 0, duration: 1400 + Math.random() * 500, ease: 'Cubic.easeOut', onComplete: () => p.destroy() });
    }
    // THE blast
    // the biggest confetti blast in the game, by a lot
    this.confettiFx.burst(cx, cy, 1300, { power: 2800, spread: Math.PI, streamers: 0.12, sequins: 0.14, glitter: 0.14, scale: 1.3 });
    this.confettiFx.burst(cx, cy, 380, { power: 1700, spread: 0.9, angle: -Math.PI / 2, streamers: 0.25, scale: 1.45 });
    this.time.delayedCall(90, () => this.confettiFx.burst(cx, cy, 500, { power: 3600, spread: Math.PI, glitter: 0.25, scale: 1.1 }));
    // and it keeps erupting from where he stood
    this.confettiFx.fountain(cx, cy + 30, 600, 1800, { scale: 1.2 });
    // secondary pops, like fireworks
    for (let i = 0; i < 12; i++)
      this.time.delayedCall(260 + i * (120 + Math.random() * 160), () => {
        const px = cx + (Math.random() - 0.5) * 1100;
        const py = cy - 120 - Math.random() * 260;
        sfx.pop();
        const f = this.add.image(px, py, 'spot').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff).setDepth(12.2).setScale(0.1);
        this.tweens.add({ targets: f, scale: 1.1, alpha: 0, duration: 450, onComplete: () => f.destroy() });
        this.confettiFx.pop(px, py, 140 + Math.round(Math.random() * 90), 1100 + Math.random() * 600);
      });
    // cannons from both sides of the court
    this.time.delayedCall(700, () => this.confetti(420));
    // his crown spins up into the rafters… and lands on the champion
    const cs = this.crownState;
    cs.mode = 'gone';
    this.tweens.killTweensOf(this.crown);
    this.crown.setVisible(true).setPosition(cx, cy - 60).setDepth(12.5);
    this.tweens.add({ targets: this.crown, y: cy - 520, angle: 900, duration: 1100, ease: 'Quad.easeOut' });
    this.time.delayedCall(1100, () => {
      const h = this.hero;
      const top = h.y - h.displayHeight * 0.9;
      this.crown.setDepth(8.06);
      this.tweens.add({
        targets: this.crown,
        x: h.x,
        y: top + 12,
        angle: 1080 + (h.flipX ? 12 : -12),
        scale: this.kingScale * 0.42,
        duration: 1200,
        ease: 'Quad.easeIn',
        onComplete: () => {
          sfx.bump();
          this.tweens.add({ targets: this.crown, y: top + 6, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
          this.heroCrowned = true;
        },
      });
    });
  }

  /** A celebration: cannons from both sides, then confetti raining down for a while. */
  private confetti(n: number) {
    const view = this.cameras.main.worldView;
    const L = A(-60, 360);
    const R = A(1340, 360);
    for (let i = 0; i < 5; i++)
      this.time.delayedCall(i * 380, () => {
        this.confettiFx.cannon(L.x, L.y, -1.1 + Math.random() * 0.35, Math.round(n * 0.3), { power: 1500 + Math.random() * 600 });
        this.confettiFx.cannon(R.x, R.y, -Math.PI + 1.1 - Math.random() * 0.35, Math.round(n * 0.3), { power: 1500 + Math.random() * 600 });
        sfx.pop();
      });
    // random explosions all over the arena
    for (let i = 0; i < 9; i++)
      this.time.delayedCall(200 + i * (180 + Math.random() * 260), () => {
        this.confettiFx.pop(view.x + view.width * (0.1 + Math.random() * 0.8), view.y + view.height * (0.08 + Math.random() * 0.35), Math.round(n * (0.35 + Math.random() * 0.4)), 800 + Math.random() * 700);
        sfx.pop();
      });
    this.confettiFx.rain(new Phaser.Geom.Rectangle(view.x, view.y, view.width, view.height), n * 0.6, 5500);
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
        setMusicRate(1.5); // the band plays faster: sudden death!
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
    stingerTitle(
      this.hard
        ? `<div><div class="crown"></div><small>KING PUFF BALL'S</small><strong>SUMMIT<br>DOME</strong><em>THE REMATCH</em></div>`
        : `<div><div class="crown"></div><small>KING PUFF BALL'S</small><strong>BASKETBALL<br>PALACE</strong><em>FREE THROW SHOWDOWN</em></div>`,
    );
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
    // both spots land on the King, and the camera glides in to him
    this.aimSpot(0, kp.x - 20, kp.y - 70, 1.25, 1.35, 600);
    this.aimSpot(1, kp.x + 10, kp.y - 90, 1.1, 1.2, 700);
    await this.glide(kp.x - 10, kp.y - 150, 2.3, 950);
    if (!this.skipping) {
      // a little hop… then he speaks: two lines, mouth moving, his name banner in between
      this.tweens.add({ targets: this.kingHop, h: 26, duration: 200, yoyo: true, ease: 'Quad.easeOut', onComplete: () => (this.kingHop.h = 0) });
      sfx.bump();
      await this.iwait(450);
      void this.callout(this.hard ? '“YOU again?!”' : '“Welcome to MY palace!”', 'speech', 1500);
      await this.iwait(1500);
      this.lowerThird('KING PUFF BALL', this.hard ? 'Summit champion · back for revenge' : 'Palace champion · unbeaten at home');
      void this.callout(this.hard ? '“This time<br><b>I WIN</b>!”' : '“Think you can beat<br><b>THE KING</b>?”', 'speech', 1700);
      await this.iwait(1700);
      this.kingAnim = { frames: ['laugh0', 'laugh1'], fps: 7 };
      sfx.laugh();
      await this.iwait(800);
      this.lowerThird(null);
      this.kingAnim = { frames: ['idle0', 'idle1'], fps: 2.5 };
    }
    // LIGHTS ON — and the camera pulls back to take in the whole arena
    this.lightsOn();
    this.spots.forEach((sp) => (sp.on = false));
    this.jumboShow({ kind: 'title' }, 4000);
    if (!this.skipping) {
      await this.glide(800, 430, 1.05, 800);
      await this.iwait(600);
      // over to the hoop…
      sfx.drum();
      await this.glide(rim.x, rim.y + 30, 1.9, 900);
      await this.iwait(400);
      // …and across to our hero, who hops for joy
      this.lowerThird(ch.name.toUpperCase(), 'The challenger');
      this.heroAnim = { frames: ['jump', 'idle0'], fps: 4 };
      this.tweens.add({ targets: this.heroHop, h: 24, duration: 170, yoyo: true, repeat: 2, ease: 'Quad.easeOut', onComplete: () => (this.heroHop.h = 0) });
      await this.glide(hp.x, hp.y - 90, 2.1, 900);
      await this.iwait(900);
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
    await this.callout(this.hard ? 'THE<br>REMATCH!<small>5 shots each · the King is sharper this time</small>' : 'FREE THROW<br>SHOWDOWN!<small>5 shots each · most baskets wins</small>', 'title', 1800);
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
    const w = Math.max(0.1, 0.17 - Math.min(this.score.you.length, REGULATION - 1) * 0.01 - (this.hard ? HARDER.zone : 0));
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
    const speed = (1.15 + Math.min(n, REGULATION - 1) * 0.12) * (this.hard ? HARDER.speed : 1); // sudden death doesn't speed up further
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
      // a swish gets a big shout — mixed up, never the same one twice in a row
      let shout = 'IN!';
      if (o === 'swish') {
        const shouts = ['KOBE!', 'GREAT SHOT!', 'BOOM!'].filter((t) => t !== this.lastShout);
        shout = shouts[Math.floor(Math.random() * shouts.length)];
        this.lastShout = shout;
      }
      this.jumboShow({ kind: 'big', text: o === 'swish' ? shout : 'BUCKET!', sub: `${this.total('you')} – ${this.total('king')}`, color: '#8fff8a', bg: '#0b5e2a' });
      await this.callout(shout, 'good', 1000);
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
    while (this.crownBusy) await this.wait(100);
    await this.callout('King Puff Ball shoots…', 'turn king', 900);
    this.kingAnim = { frames: ['idle0', 'idle1'], fps: 5 };
    await this.wait(500);
    const r = Math.random();
    let o: Outcome;
    if (r < (this.hard ? HARDER.kingMake : KING_MAKE)) o = Math.random() < 0.5 ? 'swish' : 'rimIn';
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
      // he stamps in a huff — sometimes his crown flies off
      if (this.crownState.falls < 2 && Math.random() < 0.4) this.time.delayedCall(250, () => this.crownFall());
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
    if (isHero) this.heroAnim = { frames: ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6', 'walk7'], fps: 18 };
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
    // confetti cannons pop from both sides of the court
    const n = Math.round(75 * k);
    this.confettiFx.cannon(A(-40, 330).x, A(-40, 330).y, -0.95 + (Math.random() - 0.5) * 0.3, n, { power: 1250 + Math.random() * 500 });
    this.confettiFx.cannon(A(1320, 330).x, A(1320, 330).y, -Math.PI + 0.95 + (Math.random() - 0.5) * 0.3, n, { power: 1250 + Math.random() * 500 });
    // and a couple of random pops up in the air
    const pops = Math.round(1 + k * 2 + Math.random() * 2);
    for (let i = 0; i < pops; i++)
      this.time.delayedCall(150 + i * (120 + Math.random() * 200), () => {
        this.confettiFx.pop(A(200 + Math.random() * 880, 0).x, A(0, 40 + Math.random() * 180).y, Math.round(45 * k + Math.random() * 40));
        sfx.pop();
      });
  }

  // ── endings ──

  private async youWin() {
    const kp = { x: this.king.x, y: this.king.y - 6 };
    this.cut(kp.x - 40, kp.y - 120, 1.9);
    this.kingAnim = { frames: ['sad'], fps: 1 };
    await this.callout('“NOOOO!”', 'speech', 1100);
    const name = characterById(this.hd.charId).name;
    this.jumboShow({ kind: 'big', text: this.hard ? 'KING DESTROYED!' : 'NEW CHAMP!', sub: this.hard ? `${name} destroyed the King ${this.total('you')} – ${this.total('king')}` : `${name} beats the King ${this.total('you')} – ${this.total('king')}`, color: '#ffd23f', bg: this.hard ? '#0b2a44' : '#3d1478' }, 1e9);
    if (this.hard) {
      // the King swells up, shakes… and BURSTS into confetti
      this.kingAnim = { frames: ['sad', 'laugh1'], fps: 14 };
      sfx.drum();
      await this.tween({ targets: this.king, scaleX: this.king.scaleX * 1.35, scaleY: this.king.scaleY * 1.25, duration: 700, ease: 'Quad.easeIn', onUpdate: () => this.king.setX(kp.x + (Math.random() - 0.5) * 8) });
      this.burstKing();
      this.camFocus = { x: 800, y: 450, zoom: 1 };
      this.cheer(1.6);
      await this.wait(900);
    } else {
      // the King runs off… stops at the edge of the court, turns, and gets the last word
      this.kingAnim = { frames: ['run0', 'run1'], fps: 10 };
      this.camFocus = { x: 800, y: 450, zoom: 1 };
      this.king.setFlipX(true);
      this.cheer(1.5);
      await this.tween({ targets: this.king, x: Math.min(ARENA_W - 260, this.king.x + 260), duration: 700, ease: 'Quad.easeOut' });
      this.king.setFlipX(false);
      this.kingAnim = { frames: ['idle0', 'idle1'], fps: 2.5 };
      this.cut(this.king.x - 30, this.king.y - 130, 1.7);
      await this.callout('“Hmm… nice shooting.”', 'speech', 1700);
      this.kingAnim = { frames: ['laugh0', 'laugh1'], fps: 7 };
      sfx.laugh();
      await this.callout('“Let’s see how you are at<br><b>MOUNTAIN CLIMBING</b>…<br>HA HA HA HA!”', 'speech', 2600);
      this.camFocus = { x: 800, y: 450, zoom: 1 };
      this.king.setFlipX(true);
      this.kingAnim = { frames: ['run0', 'run1'], fps: 10 };
      await this.tween({ targets: this.king, x: ARENA_W + 260, duration: 1100, ease: 'Quad.easeIn' });
    }
    // the house lights dip and a spotlight finds the champion; confetti everywhere
    const hpw = { x: this.hero.x, y: this.hero.y - 4 };
    this.setDark(0.45, 400);
    this.aimSpot(0, hpw.x, hpw.y - 60, 1.2, 1.4, 0);
    this.aimSpot(1, hpw.x + 10, hpw.y - 80, 1.0, 1.2, 500);
    this.confetti(160);
    this.excitedUntil = this.clock + 4000;
    this.heroAnim = { frames: ['jump', 'idle0'], fps: 5 };
    await this.callout(`${this.hard ? 'YOU DESTROYED' : 'YOU BEAT'}<br>KING PUFF BALL!<small>${this.total('you')} – ${this.total('king')}</small>`, 'title', 2200);
    if (this.hard) await this.plopInvasion();
    fadeOutMusic(500);
    const result: ResultState = { ...this.hd.result, hoops: `${this.total('you')} – ${this.total('king')}`, level: this.hd.level ?? 1 };
    this.game.events.emit('level-complete', result);
  }

  /**
   * …but who's this? After the King is destroyed, a gang of Plops (World 2's
   * bad guys) come charging onto the court, yell "POOPA!" at you, and run off.
   */
  private async plopInvasion() {
    const floorY = this.hero.y + 10;
    // the whole family: small, medium and large Plops, and their King in the middle
    const line: PlopKind[] = ['small', 'medium', 'king', 'large', 'small', 'medium'];
    const plops = line.map((kind, i) => {
      const p = this.add.sprite(ARENA_W + 120 + i * 110, floorY - (i % 2) * 26, `plop-${kind}`, 'run0').setOrigin(0.5, 1).setScale((PLOP_SCALE[kind] * 1.15) / 2.5).setDepth(8.5 - (i % 2) * 0.2);
      return p;
    });
    const shadows = plops.map((p) => this.add.image(p.x, p.y, 'softshadow').setDisplaySize(110 * p.scaleX * 2.5, 22).setDepth(6));
    this.cameras.main.shake(300, 0.004);
    sfx.drum();
    let t0 = this.clock;
    const anim = (frames: string[], fps: number) => {
      t0 = this.clock;
      plops.forEach((p, i) => p.setData('anim', { frames, fps, off: i * 0.13 }));
    };
    const ev = this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        plops.forEach((p, i) => {
          const a = p.getData('anim') as { frames: string[]; fps: number; off: number };
          if (a) p.setFrame(a.frames[Math.floor(((this.clock - t0) / 1000 + a.off) * a.fps) % a.frames.length]);
          shadows[i].setPosition(p.x, p.y - 2);
        });
      },
    });
    anim(['run0', 'run1'], 9);
    // they charge in from the right and skid to a stop in a ragged line
    const stopX = [580, 700, 840, 990, 1110, 1220];
    await Promise.all(plops.map((p, i) => this.tween({ targets: p, x: stopX[i], duration: 1000 + i * 120, ease: 'Quad.easeOut' })));
    // POOPA! POOPA! (with angry little hops)
    anim(['yell0', 'yell1'], 7);
    const t = this.add.text(1130, floorY - 330, 'POOPA!', { fontFamily: '"Lilita One", sans-serif', fontSize: '84px', color: '#ffe0a8', stroke: '#4a2716', strokeThickness: 14 }).setOrigin(0.5).setDepth(12.6).setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, angle: { from: -6, to: 6 }, yoyo: true, repeat: 6, duration: 160 });
    for (let r = 0; r < 3; r++) {
      plops.forEach((p, i) => {
        this.time.delayedCall(i * 70, () => {
          sfx.poopa(0.85 + i * 0.12);
          this.tweens.add({ targets: p, y: p.y - 26, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
          const b = this.add.text(p.x, p.y - p.displayHeight - 10, 'POOPA!', { fontFamily: '"Lilita One", sans-serif', fontSize: '30px', color: '#fff6e0', stroke: '#4a2716', strokeThickness: 7 }).setOrigin(0.5).setDepth(12.6).setAngle((Math.random() - 0.5) * 20);
          this.tweens.add({ targets: b, y: b.y - 50, alpha: 0, scale: 1.3, duration: 700, ease: 'Quad.easeOut', onComplete: () => b.destroy() });
        });
      });
      await this.wait(620);
    }
    this.tweens.add({ targets: t, alpha: 0, scale: 1.3, duration: 300, onComplete: () => t.destroy() });
    // …and off they run, waving their little arms
    anim(['run0', 'run1'], 11);
    plops.forEach((p) => p.setFlipX(true));
    await Promise.all(plops.map((p, i) => this.tween({ targets: p, x: ARENA_W + 160 + i * 60, duration: 800 + i * 90, delay: i * 60, ease: 'Quad.easeIn' })));
    ev.remove();
    plops.forEach((p) => p.destroy());
    shadows.forEach((s2) => s2.destroy());
    await this.callout('WORLD 2<br>PLOP INVASION<small>coming soon…</small>', 'title', 2400);
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
