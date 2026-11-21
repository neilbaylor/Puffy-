import Phaser from 'phaser';
import type { Ctx } from './draw';
import { addCanvas, hires } from './textures';
import { liveCanvas } from './liveCanvas';
import { ledStill } from './ledStrip';
import {
  JUMBO,
  JUMBO_DOT_BOX,
  SCORE_MOVING,
  drawJumboScreen,
  jumboFrontTop,
  jumboGlassLayer,
  jumboLiveDot,
  jumboPulse,
  jumboRays,
  jumboWords,
  jumboWordsAt,
  jumboWordsBox,
  scoreMoving,
  type JumboContent,
} from './hoops';

/** The screen's pictures are drawn at this many px per unit (as the whole screen was). */
const R = 2;
type Box = { x: number; y: number; w: number; h: number };

/**
 * A jumbotron screen (the basketball arena's, the wrestling ring's) as layers the graphics chip
 * puts together, so that what moves doesn't mean drawing and sending the whole screen again:
 *
 * - what stays put under the moving parts (its background; the scoreboard bar its blinks and glows)
 *   and over them (a big call's second line, the ticker band): drawn once each time what the screen
 *   says changes;
 * - the turning rays (one picture of a ray, turned and tinted on the chip) and a big call's pulsing
 *   words (drawn once, sized on the chip), put together on the chip in a surface the screen's size
 *   (which also trims the rays at its edges);
 * - the little things that change on their own (the LIVE dot, the scoreboard's blinking header, the
 *   leader's glowing digits, the possession arrow): each a small picture of its own, redrawn as it changes;
 * - the LED glass over it all, drawn once.
 *
 * It looks the same as drawJumboScreen's whole screen, at the same moments (the scene calls `show`
 * as often as it used to redraw it). Before, the whole screen went to the graphics chip 14–20 times a
 * second: in the wrestling ring at 4× slow CPU that was ~15 ms each time, ~180 ms of every second.
 */
export class JumboScreen {
  private sig: string | null = null;
  private back: Phaser.GameObjects.Image;
  private front: Phaser.GameObjects.Image;
  private raysImg: Phaser.GameObjects.Image;
  private rays: Phaser.Textures.DynamicTexture;
  private words: { key: string; ox: number; oy: number } | null = null;
  private bits: Record<'header' | 'you' | 'king' | 'arrow' | 'dot', Bit>;

  /** (x, y): the screen's top-left in the world; k world px per unit; `overGlass` drawn over the glass (the ring's crawl bar). */
  constructor(
    private scene: Phaser.Scene,
    private key: string,
    private x: number,
    private y: number,
    private k: number,
    depth: number,
    grid: 'full' | 'top',
    overGlass?: (ctx: Ctx) => void,
  ) {
    const { w, h } = JUMBO;
    const T = scene.textures;
    // (an empty picture to start with: each is drawn on the first show)
    this.back = scene.add.image(x, y, '__WHITE').setOrigin(0, 0).setScale(k / R).setDepth(depth).setVisible(false);
    const rk = `${key}-rays`;
    this.rays = (T.exists(rk) ? T.get(rk) : T.addDynamicTexture(rk, w * R, h * R)) as Phaser.Textures.DynamicTexture;
    this.raysImg = scene.add.image(x, y, rk).setOrigin(0, 0).setScale(k / R).setDepth(depth + 0.0001).setVisible(false);
    const at = { x, y, k };
    this.bits = {
      header: new Bit(scene, `${key}-b-head`, SCORE_MOVING.header, at, depth + 0.0002),
      you: new Bit(scene, `${key}-b-you`, SCORE_MOVING.you, at, depth + 0.0002),
      king: new Bit(scene, `${key}-b-king`, SCORE_MOVING.king, at, depth + 0.0002),
      arrow: new Bit(scene, `${key}-b-arrow`, SCORE_MOVING.arrow, at, depth + 0.0002),
      dot: new Bit(scene, `${key}-b-dot`, JUMBO_DOT_BOX, at, depth + 0.0004),
    };
    this.front = scene.add.image(x, y, '__WHITE').setOrigin(0, 0).setScale(k / R).setDepth(depth + 0.0003).setVisible(false);
    const glass = ledStill(scene, `${key}-glass`, w, h, (ctx) => {
      jumboGlassLayer(ctx, grid);
      overGlass?.(ctx);
    }, R);
    scene.add.image(x, y, glass.key).setOrigin(0, 0).setScale(k / glass.res).setDepth(depth + 0.0005);
  }

  /** The screen as it is at time t (s) saying `c`. */
  show(c: JumboContent, t: number) {
    const sig = JSON.stringify(c);
    if (sig !== this.sig) {
      this.sig = sig;
      this.paint(c, t);
    }
    const rays = jumboRays(c);
    this.raysImg.setVisible(!!rays);
    if (rays) {
      const ray = this.ray(rays.r, rays.span);
      const tint = Phaser.Display.Color.HexStringToColor(rays.color).color;
      const rt = this.rays.clear();
      for (let i = 0; i < rays.n; i++)
        rt.stamp(ray.key, undefined, rays.x * R, rays.y * R, { originX: ray.ox, originY: ray.oy, rotation: (i / rays.n) * Math.PI * 2 + t * rays.speed, tint, alpha: rays.alpha });
      if (c.kind === 'big' && this.words) {
        const at = jumboWordsAt(c);
        rt.stamp(this.words.key, undefined, at.x * R, at.y * R, { originX: this.words.ox, originY: this.words.oy, scale: jumboPulse(t) });
      }
      rt.render();
    }
    const sc = c.kind === 'score' ? c : null;
    const moving = (ctx: Ctx) => scoreMoving(ctx, sc!, t);
    this.bits.header.set(sc?.sudden ? String(Math.floor(t * 3) % 2) : null, moving);
    this.bits.you.set(sc && sc.you > sc.king ? `${sig}|${t}` : null, moving);
    this.bits.king.set(sc && sc.king > sc.you ? `${sig}|${t}` : null, moving);
    this.bits.arrow.set(sc ? `${sig}|${t}` : null, moving);
    this.bits.dot.set(String(Math.floor(t * 2) % 2), (ctx) => jumboLiveDot(ctx, t));
  }

  /** What stays put, for this content: the back, the front, a big call's words. */
  private paint(c: JumboContent, t: number) {
    const { w, h } = JUMBO;
    const bk = `${this.key}-back`;
    addCanvas(this.scene, bk, hires(w, h, R, (ctx) => drawJumboScreen(ctx, c, t, { crawl: false, part: 'back' })), undefined, { release: true });
    this.back.setTexture(bk).setVisible(true);
    const top = jumboFrontTop(c);
    const fk = `${this.key}-front`;
    addCanvas(this.scene, fk, hires(w, h - top, R, (ctx) => {
      ctx.translate(0, -top);
      drawJumboScreen(ctx, c, t, { crawl: false, part: 'front' });
    }), undefined, { release: true });
    this.front.setTexture(fk).setPosition(this.x, this.y + top * this.k).setVisible(true);
    this.words = null;
    if (c.kind === 'big') {
      const b = jumboWordsBox(c);
      const at = jumboWordsAt(c);
      const wk = `${this.key}-words`;
      addCanvas(this.scene, wk, hires(b.x1 - b.x0, b.y1 - b.y0, R, (ctx) => {
        ctx.translate(at.x - b.x0, at.y - b.y0);
        jumboWords(ctx, c);
      }), undefined, { release: true });
      this.words = { key: wk, ox: (at.x - b.x0) / (b.x1 - b.x0), oy: (at.y - b.y0) / (b.y1 - b.y0) };
    }
  }

  /** One ray (r long, `span` wide), pointing right from its tip, drawn once: the chip turns and tints it. */
  private ray(r: number, span: number) {
    const key = `${this.key}-ray-${r}`;
    const pad = 2;
    const w = r + pad * 2;
    const h = r * Math.sin(span) + pad * 2;
    if (!this.scene.textures.exists(key))
      addCanvas(this.scene, key, hires(w, h, R, (ctx) => {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(pad, pad);
        ctx.lineTo(pad + r, pad);
        ctx.lineTo(pad + Math.cos(span) * r, pad + Math.sin(span) * r);
        ctx.closePath();
        ctx.fill();
      }), undefined, { release: true });
    // (the tip, as a fraction of the picture: hires rounds its size up to whole pixels)
    return { key, ox: (pad * R) / Math.ceil(w * R), oy: (pad * R) / Math.ceil(h * R) };
  }
}

/** A small part of a screen that changes on its own: a little picture of its own, redrawn only when it changes. */
class Bit {
  private tex: Phaser.Textures.CanvasTexture;
  private img: Phaser.GameObjects.Image;
  private sig: string | null = null;

  constructor(scene: Phaser.Scene, key: string, private box: Box, at: { x: number; y: number; k: number }, depth: number) {
    this.tex = liveCanvas(scene.textures, key, box.w * R, box.h * R);
    this.img = scene.add.image(at.x + box.x * at.k, at.y + box.y * at.k, key).setOrigin(0, 0).setScale(at.k / R).setDepth(depth).setVisible(false);
  }

  /** Shown as `draw` draws it (in screen units: only its box shows), redrawn when `sig` changes; null hides it. */
  set(sig: string | null, draw: (ctx: Ctx) => void) {
    if (sig === null) {
      this.img.setVisible(false);
      this.sig = null;
      return;
    }
    this.img.setVisible(true);
    if (sig === this.sig) return;
    this.sig = sig;
    const ctx = this.tex.getContext();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.tex.width, this.tex.height);
    ctx.save();
    ctx.setTransform(R, 0, 0, R, -this.box.x * R, -this.box.y * R);
    draw(ctx);
    ctx.restore();
    this.tex.refresh();
  }
}

