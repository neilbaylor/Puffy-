import Phaser from 'phaser';
import './ui/style.css';
import { installInput } from './input/devices';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { HoopsScene } from './scenes/HoopsScene';
import { BattleScene } from './scenes/BattleScene';
import { WrestleScene } from './scenes/WrestleScene';
import { FishingScene } from './scenes/FishingScene';
import { UI } from './ui/ui';
import { LIGHT, LIGHT_KEY } from './core/light';
import { savedResCap, saveResCap } from './core/res';

installInput();

/**
 * The canvas is sized to the window in *device* pixels (capped at 2x) and
 * shown at CSS size via `zoom`, so everything stays sharp on phones.
 * Each scene then zooms its camera so exactly VIEW_H world pixels are visible
 * vertically; the visible width follows the screen's aspect ratio.
 */
// Cap the render resolution: full 2x on phones, 1.75x on big tablet screens (keeps Android tablets smooth).
// A device found to be slow in play (see watchSpeed) is capped lower still for gameplay, and remembers
// it; light mode (older devices: see core/light) draws at 1x everywhere.
let resCap = LIGHT ? 1 : savedResCap();
// The start screen always draws at no more than 1.25x: its scenery is soft (a little less sharpness
// doesn't show; the title and buttons are page elements, always sharp) and it keeps Part switching
// smooth on every device. Gameplay draws at full sharpness again.
const HOME_RES = 1.25;
let home = true;

/**
 * If something goes wrong while loading, say so on the loading screen (instead of it just
 * stopping), with the browser's message: something to go on when it happens on a device we
 * can't test on.
 */
// (light mode: the page knows too, for its still titles — see style.css)
if (LIGHT) document.documentElement.classList.add('light');

function bootTrouble(msg: string) {
  const boot = document.getElementById('boot');
  if (!boot) return;
  let el = boot.querySelector<HTMLElement>('.boot-error');
  if (!el) {
    el = document.createElement('div');
    el.className = 'boot-error';
    boot.querySelector('.boot-in')?.appendChild(el);
  }
  el.textContent = `Oops, loading hit a problem: ${msg}`.slice(0, 300);
}
window.addEventListener('error', (e) => bootTrouble(e.message || String(e.error)));
window.addEventListener('unhandledrejection', (e) => bootTrouble(String((e.reason as Error)?.message ?? e.reason)));
const dpr = () => {
  const big = Math.min(window.innerWidth, window.innerHeight) >= 700;
  let r = Math.min(window.devicePixelRatio || 1, big ? 1.75 : 2);
  if (resCap) r = Math.min(r, resCap);
  return home ? Math.min(r, HOME_RES) : r;
};
const size = () => ({ w: Math.max(1, Math.round(window.innerWidth * dpr())), h: Math.max(1, Math.round(window.innerHeight * dpr())) });

/**
 * Frame rate: everything runs at 60 fps, the rate the game is tuned for and
 * the rate physics steps at. Most phones refresh at 60Hz anyway; on 120Hz
 * screens we measure the refresh rate first and draw on every 2nd refresh,
 * so motion stays perfectly even (and saves battery).
 */
function measureRefreshMs(): Promise<number> {
  return new Promise((resolve) => {
    const gaps: number[] = [];
    let last = 0;
    const done = () => {
      gaps.sort((a, b) => a - b);
      resolve(gaps.length >= 6 ? gaps[Math.floor(gaps.length / 2)] : 1000 / 60);
    };
    const timeout = setTimeout(done, 700); // e.g. opened in a background tab
    const tick = (t: number) => {
      if (last) gaps.push(t - last);
      last = t;
      if (gaps.length < 12) requestAnimationFrame(tick);
      else {
        clearTimeout(timeout);
        done();
      }
    };
    requestAnimationFrame(tick);
  });
}

/** Phaser draws once the frame times it has added up reach 1000 / limit ms. */
function fpsLimitFor(refreshMs: number) {
  const hz = 1000 / refreshMs;
  const every = Math.max(1, Math.round(hz / 60 - 0.1)); // 60Hz → 1, 120Hz → 2, 90Hz → 1 (can't divide evenly)
  // trigger half a refresh early so timing jitter never makes us skip an extra frame
  return every > 1 ? 1000 / ((every - 0.5) * refreshMs) : 0;
}

function start(refreshMs: number) {
  const { w, h } = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO, // WebGL, with Canvas fallback
    parent: 'game',
    backgroundColor: '#8fd3ff',
    width: w,
    height: h,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr() },
    render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
    input: { activePointers: 4 },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1600 }, debug: false } },
    fps: { target: 60, limit: fpsLimitFor(refreshMs), smoothStep: true },
    scene: [BootScene, MenuScene, GameScene, HoopsScene, BattleScene, WrestleScene, FishingScene],
  });

  const resize = () => {
    const s = size();
    game.scale.resize(s.w, s.h);
    game.scale.setZoom(1 / dpr());
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  // start screen on → its lower resolution; off (Play, a boss, Battle) → gameplay's. (Clicking
  // Play stops the start screen straight away, before the next scene is built, so the switch costs
  // nothing extra on screen.)
  const setHome = (on: boolean) => {
    if (home === on) return;
    home = on;
    resize();
  };
  game.events.once(Phaser.Core.Events.READY, () => {
    const ev = game.scene.getScene('Menu').events;
    ev.on(Phaser.Scenes.Events.START, () => setHome(true));
    ev.on(Phaser.Scenes.Events.SHUTDOWN, () => setHome(false));
  });

  /**
   * Some devices (an old iPad, say) can't keep up drawing gameplay at full sharpness. Watch the
   * first few seconds of real play: if it's running under ~47 fps, draw gameplay at a lower
   * resolution (a little softer, much smoother), and check again (at most twice). Remembered for
   * this version (see core/res).
   */
  const PLAY = ['Game', 'Hoops', 'Wrestle', 'Battle', 'Fishing'];
  const watchSpeed = (rounds: number) => {
    const deltas: number[] = [];
    let since = 0;
    let last = 0;
    let playing = 0; // when this stretch of play began
    const onStep = () => {
      // (real time between frames: the frame time Phaser reports is smoothed and capped)
      const t = performance.now();
      const delta = last ? t - last : 0;
      last = t;
      const inPlay = !home && !document.hidden && PLAY.some((k) => game.scene.isActive(k));
      if (!inPlay) {
        playing = 0;
        return;
      }
      if (!playing) playing = t;
      // (skip the first 2 seconds of each stretch: building the scene and its first pictures
      // are slow on purpose, and aren't the device being slow)
      if (!delta || delta > 1000 || t - playing < 2000) return;
      deltas.push(delta);
      since += delta;
      // (about 4 seconds' worth, however fast or slow the frames are)
      if (since < 4000 || deltas.length < 20) return;
      game.events.off('step', onStep);
      deltas.sort((a, b) => a - b);
      const median = deltas[deltas.length >> 1];
      // (a steady 30 fps is a cap, e.g. an iPhone in Low Power Mode, not a struggling device)
      const capped30 = deltas.filter((d) => d > 30.5 && d < 36.5).length > deltas.length * 0.8;
      const now = dpr();
      if (median > 21 && !capped30 && now > 1.05 && rounds > 0) {
        resCap = now > 1.4 ? 1.25 : 1;
        saveResCap(resCap);
        resize();
        setTimeout(() => watchSpeed(rounds - 1), 1500);
      }
    };
    game.events.on('step', onStep);
  };
  if (!LIGHT) watchSpeed(2);
  (window as unknown as { __res: () => unknown }).__res = () => ({ dpr: dpr(), cap: resCap, home, renderer: game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas' });

  new UI(game);
  // the graphics chip gave up (out of memory, usually): switch this device to light mode
  game.canvas.addEventListener('webglcontextlost', () => {
    if (!LIGHT) {
      const note = document.createElement('div');
      note.className = 'gl-lost';
      // the first time: switch this device to light mode (remembered) and start again
      try {
        localStorage.setItem(LIGHT_KEY, '1');
      } catch {
        /* private mode */
      }
      note.textContent = 'Switching to light mode for this device…';
      document.body.appendChild(note);
      setTimeout(() => location.reload(), 900);
      return;
    }
    // (already in light mode: nothing more to try, and no message — whatever the browser does)
  });

  // handy for debugging from the console
  (window as unknown as { game: Phaser.Game; refreshHz: number }).game = game;
  (window as unknown as { refreshHz: number }).refreshHz = Math.round(1000 / refreshMs);
}

void measureRefreshMs().then(start);
