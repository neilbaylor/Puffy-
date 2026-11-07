import Phaser from 'phaser';
import { preloadMenuMusic, primeMusic } from '../core/music';
import { textureSteps } from '../gfx/textures';
import { latestLevel } from '../level/levels';

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
/** (the first part of the loading fills the bar this far; the second part, the rest) */
const PHASE1 = 0.45;
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
    // (how long each part of the loading takes: window.__boot in the console)
    const times: [string, number][] = [];
    (window as unknown as { __boot: typeof times }).__boot = times;
    let t0 = performance.now();
    const mark = (name: string) => {
      const t = performance.now();
      times.push([name, Math.round(t - t0)]);
      t0 = t;
    };
    // the display font is needed for the start screen and the art
    try {
      await Promise.race([document.fonts.load('22px "Lilita One"'), new Promise((r) => setTimeout(r, 900))]);
    } catch {
      /* fall back to a system font */
    }
    // (the start screen's song: fetched and decoded meanwhile)
    const song = preloadMenuMusic();
    mark('fonts');
    setProgress(0.04);
    await nextFrame();
    const level = latestLevel();
    const { now: steps, later } = textureSteps(this, level);
    const total = steps.length + 4;
    let done = 0;
    mark('(start)');
    for (const step of steps) {
      const s0 = performance.now();
      step.run();
      times.push([`draw ${step.name}`, Math.round(performance.now() - s0)]);
      setProgress((++done / total) * PHASE1);
      await nextFrame();
    }
    mark('art (incl. frames between steps)');
    // the fly-over behind the start screen
    this.scene.launch('Menu', { silent: true, level });
    await nextFrame();
    mark('fly-over scene');
    setProgress((++done / total) * PHASE1);
    await nextFrame();
    // the start screen, built under the loading screen, its hero poses drawn
    this.game.events.emit('menu');
    await nextFrame();
    this.game.events.emit('warm-start');
    mark('start screen + hero poses');
    setProgress((++done / total) * PHASE1);
    await Promise.race([song, new Promise((r) => setTimeout(r, 2500))]);
    mark('song decode (waiting)');
    setProgress((++done / total) * PHASE1);
    // Everything else, now, while the loading bar is up (it used to be done after the start
    // screen showed, in quiet moments: on slower tablets that made the first few seconds
    // sluggish): the rest of the art, then the start screen's own jobs (the Parts next to this
    // one, this Part's whole ground for its fly-over, its song, its other looks)
    const menu = this.scene.get('Menu') as unknown as { takeQuietJobs?: () => (() => void)[] };
    const rest = [{ name: 'other hero cards', run: () => this.game.events.emit('warm-cards') }, ...later];
    const quiet = menu.takeQuietJobs?.() ?? [];
    let k = 0;
    const n2 = rest.length + quiet.length;
    const step2 = () => setProgress(PHASE1 + (1 - PHASE1) * (++k / Math.max(1, n2)) * 0.97);
    for (const step of rest) {
      const s0 = performance.now();
      step.run();
      times.push([`draw ${step.name}`, Math.round(performance.now() - s0)]);
      step2();
      await nextFrame();
    }
    mark('the rest of the art');
    for (const job of quiet) {
      job();
      step2();
      await nextFrame();
    }
    mark('start screen jobs (other Parts, ground, looks)');
    // and the fly-over run for a moment behind the loading screen (everything's pictures on the
    // graphics chip, and the game's code warmed up), so it's smooth from the first moment
    for (let i = 0; i < 24; i++) await nextFrame();
    mark('warm-up frames');
    setProgress(1);
    // the start screen's song: browsers that allow it (e.g. the game installed as an app on
    // Android, or a site you play often on a computer) start it now, without a tap; the
    // others start it on the first tap
    primeMusic();
    const boot = document.getElementById('boot');
    document.body.classList.remove('booting');
    if (boot) {
      boot.classList.add('out');
      setTimeout(() => boot.remove(), 350);
    }
    await this.drawTheRest([], times);
    this.registry.set('ready', true);
    this.game.events.emit('assets-ready');
    this.scene.stop();
  }

  /**
   * The rest of the art (the heroes' game frames, the bad guys, the level's other looks),
   * a piece at a time while the start screen is up, only in quiet moments (nobody has
   * touched anything for a little while), so taps stay instant. Pressing Play or Battle
   * early ('need-assets') draws whatever is left straight away.
   */
  private async drawTheRest(later: { name: string; run: () => void }[], times: [string, number][]) {
    let lastInput = performance.now();
    const onInput = () => (lastInput = performance.now());
    window.addEventListener('pointerdown', onInput, true);
    window.addEventListener('keydown', onInput, true);
    let hurry = false;
    const onNeed = () => (hurry = true);
    this.game.events.on('need-assets', onNeed);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await wait(400); // (let the fade-in finish first)
    for (const step of later) {
      while (!hurry && (performance.now() - lastInput < 900 || document.hidden)) await wait(150);
      const s0 = performance.now();
      step.run();
      times.push([`later: ${step.name}`, Math.round(performance.now() - s0)]);
      if (hurry) await nextFrame();
      else await wait(160);
    }
    window.removeEventListener('pointerdown', onInput, true);
    window.removeEventListener('keydown', onInput, true);
    this.game.events.off('need-assets', onNeed);
  }
}
