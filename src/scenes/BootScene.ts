import Phaser from 'phaser';
import { preloadMenuMusic } from '../core/music';
import { textureSteps } from '../gfx/textures';
import type { MenuScene } from './MenuScene';

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

/** Fills the loading bar (0..1). */
const setProgress = (p: number) => document.querySelector<HTMLElement>('#boot .boot-bar')?.style.setProperty('--p', String(Math.min(1, p)));

/**
 * Boot: a short loading screen while all the game art is drawn, then everything
 * the start screen will do first is done once, out of sight (the fly-over's
 * first frames and the other level's scenery, the heroes' card poses, the
 * start screen's song decoded), and only then the start screen fades in, so
 * it's smooth from the very first moment and the first taps are instant.
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
    // (the start screen's song: fetched and decoded meanwhile)
    const song = preloadMenuMusic();
    setProgress(0.04);
    await nextFrame();
    const steps = textureSteps(this);
    const total = steps.length + 4;
    let done = 0;
    for (const step of steps) {
      step.run();
      setProgress(++done / total);
      await nextFrame();
    }
    // the fly-over behind the start screen, and the other level's opening scenery
    this.scene.launch('Menu', { silent: true });
    await nextFrame();
    (this.scene.get('Menu') as MenuScene).prewarmOther();
    setProgress(++done / total);
    await nextFrame();
    this.registry.set('ready', true);
    this.game.events.emit('assets-ready');
    // the start screen, built under the loading screen, its hero poses drawn
    this.game.events.emit('menu');
    await nextFrame();
    this.game.events.emit('warm-start');
    setProgress(++done / total);
    await Promise.race([song, new Promise((r) => setTimeout(r, 2500))]);
    setProgress(++done / total);
    // a few frames of the fly-over drawn (its pictures sent to the graphics chip) before it's seen
    for (let i = 0; i < 4; i++) await nextFrame();
    setProgress(1);
    const boot = document.getElementById('boot');
    if (boot) {
      boot.classList.add('out');
      setTimeout(() => boot.remove(), 350);
    }
    this.scene.stop();
  }
}
