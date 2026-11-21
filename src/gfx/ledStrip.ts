import Phaser from 'phaser';
import { addCanvas, hires, MAX_TEX } from './textures';
import type { Ctx } from './draw';
import { RIBBON, paintRibbonGrid, paintRibbonPanels, paintRibbonSweep, ribbonLoop, ribbonPanelsAt, ribbonSig, ribbonSweepAt } from './hoops';

/**
 * A loop of an LED screen's moving content (a ticker's crawl, the ribbon's sponsor panels), drawn
 * once and slid along by the graphics chip: copies of it side by side, each cropped to the screen's
 * window. Nothing is redrawn or sent to the graphics chip again as it moves — only when what it says
 * changes. (The screens used to be redrawn and re-uploaded whole, up to every frame: in the wrestling
 * ring that was the biggest single cost of a frame.)
 */
export class LedStrip {
  private imgs: Phaser.GameObjects.Image[] = [];
  private loop = 1;
  private res = 2;
  private sig: string | null = null;
  private shown = true;

  /** The window: top-left (x, y) in the world, w × h in screen units, k world px per unit. */
  constructor(
    private scene: Phaser.Scene,
    private key: string,
    private x: number,
    private y: number,
    private w: number,
    private h: number,
    private k: number,
    private depth: number,
  ) {}

  /** (Re)draw the loop, `width()` units long — only when `sig` (what it says) has changed. */
  paint(sig: string, width: () => number, draw: (ctx: Ctx) => void) {
    if (sig === this.sig && this.scene.textures.exists(this.key)) return;
    this.sig = sig;
    this.loop = Math.max(1, width());
    this.res = Math.min(2, Math.floor((MAX_TEX / this.loop) * 100) / 100);
    addCanvas(this.scene, this.key, hires(this.loop, this.h, this.res, draw), undefined, { release: true });
    const n = Math.ceil(this.w / this.loop) + 1;
    while (this.imgs.length < n) this.imgs.push(this.scene.add.image(0, 0, this.key).setOrigin(0, 0).setDepth(this.depth));
    for (const im of this.imgs) im.setTexture(this.key).setScale(this.k / this.res);
  }

  get loopWidth() {
    return this.loop;
  }

  /** Where the loop starts, in units from the window's left (it repeats every loop). */
  place(offset: number) {
    let o = offset % this.loop;
    if (o > 0) o -= this.loop;
    this.imgs.forEach((im, i) => {
      const lx = o + i * this.loop;
      const a = Math.max(0, -lx);
      const b = Math.min(this.loop, this.w - lx);
      if (!this.shown || b <= a) {
        im.setVisible(false);
        return;
      }
      im.setVisible(true)
        .setPosition(this.x + lx * this.k, this.y)
        .setCrop(a * this.res, 0, (b - a) * this.res, Math.ceil(this.h * this.res));
    });
  }

  setVisible(on: boolean) {
    this.shown = on;
    if (!on) for (const im of this.imgs) im.setVisible(false);
  }
}

/** A still picture for an LED screen's fixed layer (its pixel grid, a glow), drawn once. */
export function ledStill(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void, res = 2) {
  if (!scene.textures.exists(key)) addCanvas(scene, key, hires(w, h, res, draw), undefined, { release: true });
  return { key, res };
}

/**
 * The LED ribbon between the decks, in layers: its dark backing, the sponsor panels gliding by (a
 * LedStrip), the light sweep running along it, and the pixel grid over all. Big moments ("KOBE!",
 * "CHAIR! CHAIR!") still take the whole ribbon as a drawn screen (the scene's own canvas, shown
 * over these while one is on).
 */
export class LedRibbon {
  private back: Phaser.GameObjects.Rectangle;
  private panels: LedStrip;
  private sweep: Phaser.GameObjects.Image;
  private grid: Phaser.GameObjects.Image;
  private sweepRes: number;

  /** (x, y): the ribbon's top-left in the world; k world px per ribbon unit (its sponsors: the arena's look as set). */
  constructor(
    scene: Phaser.Scene,
    private x: number,
    y: number,
    private k: number,
    depth: number,
  ) {
    const { w, h } = RIBBON;
    this.back = scene.add.rectangle(x, y, w * k, h * k, 0x060509).setOrigin(0, 0).setDepth(depth);
    const sig = ribbonSig();
    let hash = 0;
    for (let i = 0; i < sig.length; i++) hash = (hash * 31 + sig.charCodeAt(i)) | 0;
    this.panels = new LedStrip(scene, `led-panels-${(hash >>> 0).toString(36)}`, x, y, w, h, k, depth + 0.001);
    this.panels.paint(sig, ribbonLoop, (ctx) => paintRibbonPanels(ctx));
    const sw = ledStill(scene, 'led-sweep', 120, h, (ctx) => paintRibbonSweep(ctx));
    this.sweepRes = sw.res;
    this.sweep = scene.add.image(x, y, sw.key).setOrigin(0, 0).setScale(k / sw.res).setDepth(depth + 0.002);
    const g = ledStill(scene, 'led-ribgrid', w, h, (ctx) => paintRibbonGrid(ctx));
    this.grid = scene.add.image(x, y, g.key).setOrigin(0, 0).setScale(k / g.res).setDepth(depth + 0.003);
  }

  /** The layers moved to time t; hidden while a big moment has the ribbon (`takeover`). */
  update(t: number, takeover: boolean) {
    const on = !takeover;
    this.back.setVisible(on);
    this.grid.setVisible(on);
    this.panels.setVisible(on);
    if (!on) {
      this.sweep.setVisible(false);
      return;
    }
    this.panels.place(ribbonPanelsAt(t));
    const sx = ribbonSweepAt(t);
    const a = Math.max(0, -sx);
    const b = Math.min(120, RIBBON.w - sx);
    if (b <= a) this.sweep.setVisible(false);
    else this.sweep.setVisible(true).setPosition(this.x + sx * this.k, this.sweep.y).setCrop(a * this.sweepRes, 0, (b - a) * this.sweepRes, Math.ceil(RIBBON.h * this.sweepRes));
  }
}
