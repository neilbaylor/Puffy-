import Phaser from 'phaser';
import { DEPTH } from '../config';
import { FERRIS, FERRIS_SIZE, FERRIS_STAND, GONDOLA, GONDOLAS, GONDOLA_FRAMES } from '../gfx/ferris';

/** One turn takes this long (s): slow and stately. */
const TURN_SECS = 48;

/**
 * The Ferris wheel on Part 6's pier (behind it, over the deck): the wheel turns slowly, the
 * gondolas hang level from its rim. A picture for the stand, one for the wheel (just turned), and
 * twelve little gondolas moved round each frame — and nothing at all while it's off the screen.
 */
export class FerrisWheel {
  private wheel: Phaser.GameObjects.Image;
  private stand: Phaser.GameObjects.Image;
  private cars: Phaser.GameObjects.Image[] = [];
  private cx: number;
  private cy: number;
  private a = 0;

  /** `x`: the hub's x; `deckY`: the top of the deck the stand stands on. */
  constructor(
    scene: Phaser.Scene,
    x: number,
    deckY: number,
  ) {
    // (the picture's own size: its canvas is let go once it's uploaded)
    const res = scene.textures.getFrame('ferris-wheel').width / FERRIS_SIZE;
    this.cx = x;
    this.cy = deckY - FERRIS_STAND.h + 8;
    const d = DEPTH.decor - 2;
    this.stand = scene.add.image(x, deckY, 'ferris-stand').setOrigin(0.5, 1).setScale(1 / res).setDepth(d + 0.2);
    this.wheel = scene.add.image(x, this.cy, 'ferris-wheel').setScale(1 / res).setDepth(d);
    for (let i = 0; i < GONDOLAS; i++)
      this.cars.push(scene.add.image(0, 0, 'ferris-car', GONDOLA_FRAMES[i % GONDOLA_FRAMES.length]).setOrigin(0.5, 1.5 / GONDOLA.h).setScale(1 / res).setDepth(d + 0.1));
    this.place();
  }

  update(dt: number, view: { left: number; top: number; width: number; height: number }) {
    // (off the screen: nothing to do)
    const r = FERRIS.R + GONDOLA.h;
    const on = this.cx + r > view.left && this.cx - r < view.left + view.width && this.cy + r > view.top && this.cy - r < view.top + view.height;
    if (!on) return;
    this.a += (dt / TURN_SECS) * Math.PI * 2;
    this.place();
  }

  private place() {
    this.wheel.setRotation(this.a);
    const R = FERRIS.R - 1;
    this.cars.forEach((c, i) => {
      const t = this.a + (i / GONDOLAS) * Math.PI * 2;
      // (hanging from the rim: a gentle sway as it goes round)
      c.setPosition(this.cx + Math.cos(t) * R, this.cy + Math.sin(t) * R).setRotation(Math.sin(t * 2 + i) * 0.05);
    });
  }

  destroy() {
    this.wheel.destroy();
    this.stand.destroy();
    for (const c of this.cars) c.destroy();
  }
}
