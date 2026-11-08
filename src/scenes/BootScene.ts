import Phaser from 'phaser';
import { preloadMenuMusic, primeMusic } from '../core/music';
import { textureSteps } from '../gfx/textures';
import { latestLevel, levelInfo } from '../level/levels';
import { buildLevel1 } from '../level/level1';
import { levelPieces } from '../world/LevelView';

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
 * Under the loading screen nothing has to look smooth (only the bar, which moves in steps anyway),
 * so several small steps share a frame, up to about this much work each (ms): every frame in
 * between costs a whole render of the fly-over behind the loading screen, for nothing.
 */
const BUDGET = 45;

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
    let slice = performance.now();
    /** Yield a frame only once this frame's share of the work is used up. */
    const breathe = async () => {
      if (performance.now() - slice < BUDGET) return;
      await nextFrame();
      slice = performance.now();
    };
    for (const step of steps) {
      const s0 = performance.now();
      step.run();
      times.push([`draw ${step.name}`, Math.round(performance.now() - s0)]);
      setProgress((++done / total) * PHASE1);
      await breathe();
    }
    mark('art (incl. frames between steps)');
    // the level's terrain shapes worked out first, on their own (the slow part of putting the fly-over up)
    {
      const data = (levelInfo(level).build ?? buildLevel1)();
      levelPieces(data, 'ground');
      await nextFrame();
      levelPieces(data, 'rock');
      await nextFrame();
      slice = performance.now();
    }
    mark('terrain shapes');
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
    // (the start screen's song keeps downloading and decoding meanwhile: it's waited for at the end)
    setProgress((++done / total) * PHASE1);
    // the fly-over isn't drawn while the loading screen covers it (every frame of it was a whole
    // render for nothing, on slow tablets the biggest part of each frame): it's put back for the
    // warm-up frames at the end
    this.scene.setVisible(false, 'Menu');
    this.scene.pause('Menu');
    slice = performance.now();
    // Only what the start screen itself shows is drawn here (the other heroes' card poses too).
    // The game's own art (the heroes' game frames, the bad guys) is drawn when a game starts,
    // behind a little loading card; the other Parts' scenery, this Part's song and the rest of its
    // ground in quiet moments on the start screen. (Doing it all here was too much at once for
    // older devices: the loading screen crashed half way through.)
    const rest = [{ name: 'other hero cards', run: () => this.game.events.emit('warm-cards') }, ...later];
    const quiet: (() => void)[] = [];
    let k = 0;
    const n2 = rest.length + quiet.length;
    const step2 = () => setProgress(PHASE1 + (1 - PHASE1) * (++k / Math.max(1, n2)) * 0.97);
    for (const step of rest) {
      const s0 = performance.now();
      step.run();
      times.push([`draw ${step.name}`, Math.round(performance.now() - s0)]);
      step2();
      await breathe();
    }
    mark('the rest of the art');
    for (const job of quiet) {
      job();
      step2();
      await breathe();
    }
    mark('start screen jobs (other Parts, song)');
    // and the fly-over run for a moment behind the loading screen (everything's pictures on the
    // graphics chip, and the game's code warmed up), so it's smooth from the first moment
    this.scene.resume('Menu');
    this.scene.setVisible(true, 'Menu');
    for (let i = 0; i < 8; i++) await nextFrame();
    mark('warm-up frames');
    // the start screen's song (fetched and decoded alongside all of the above; usually ready by now)
    await Promise.race([song, new Promise((r) => setTimeout(r, 800))]);
    mark('song decode (waiting)');
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
    this.registry.set('ready', true);
    this.game.events.emit('assets-ready');
    this.scene.stop();
  }
}
