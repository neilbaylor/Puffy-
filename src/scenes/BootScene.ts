import Phaser from 'phaser';
import { textureSteps } from '../gfx/textures';

/** Resolves on the next animation frame (or soon after, if frames are paused). */
const nextFrame = () => new Promise<void>((r) => {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    r();
  };
  requestAnimationFrame(go);
  setTimeout(go, 50);
});

/**
 * Boot: put the start screen up straight away, then draw all the game art in
 * small steps (one per frame) behind it. The level fly-over starts as soon as
 * its pieces exist; Play waits for 'assets-ready' if someone is very quick.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    // the display font is needed for the start screen and the art
    try {
      await Promise.race([document.fonts.load('22px "Lilita One"'), new Promise((r) => setTimeout(r, 900))]);
    } catch {
      /* fall back to a system font */
    }
    document.getElementById('boot')?.remove();
    this.game.events.emit('menu');
    await nextFrame();
    const steps = textureSteps(this);
    for (const step of steps) {
      step.run();
      if (step.name === 'bg-puff') {
        // everything the fly-over needs exists now
        await nextFrame();
        this.scene.launch('Menu', { silent: true });
      }
      await nextFrame();
    }
    this.registry.set('ready', true);
    this.game.events.emit('assets-ready');
    this.scene.stop();
  }
}
