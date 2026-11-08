import Phaser from 'phaser';
import './ui/style.css';
import { installInput } from './input/devices';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { HoopsScene } from './scenes/HoopsScene';
import { BattleScene } from './scenes/BattleScene';
import { WrestleScene } from './scenes/WrestleScene';
import { UI } from './ui/ui';
import { LIGHT, LIGHT_KEY } from './core/light';

installInput();

/**
 * The canvas is sized to the window in *device* pixels (capped at 2x) and
 * shown at CSS size via `zoom`, so everything stays sharp on phones.
 * Each scene then zooms its camera so exactly VIEW_H world pixels are visible
 * vertically; the visible width follows the screen's aspect ratio.
 */
// Cap the render resolution: full 2x on phones, 1.75x on big tablet screens (keeps Android tablets smooth).
// A device found to be slow (see watchSpeed) is capped lower still, and remembers it.
const RES_KEY = 'puffy.res';
let resCap = (() => {
  try {
    const saved = Number(localStorage.getItem(RES_KEY)) || 0;
    if (saved) return saved;
  } catch {
    /* private mode */
  }
  // light mode (older devices: see core/light) draws at 1x from the start
  return LIGHT ? 1 : 0;
})();

/**
 * If something goes wrong while loading, say so on the loading screen (instead of it just
 * stopping), with the browser's message: something to go on when it happens on a device we
 * can't test on.
 */
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
  const r = Math.min(window.devicePixelRatio || 1, big ? 1.75 : 2);
  return resCap ? Math.min(r, resCap) : r;
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
    scene: [BootScene, MenuScene, GameScene, HoopsScene, BattleScene, WrestleScene],
  });

  const resize = () => {
    const s = size();
    game.scale.resize(s.w, s.h);
    game.scale.setZoom(1 / dpr());
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  /**
   * Older tablets (an old iPad, say) can't keep up drawing this many pixels. Once
   * everything is loaded, watch the start screen for a few seconds: if it's running
   * under ~47 fps, draw at a lower resolution (a little softer, much smoother), and
   * check again (at most twice). The device remembers it for next time.
   */
  const watchSpeed = (rounds: number) => {
    const deltas: number[] = [];
    let since = 0;
    let last = 0;
    const onStep = () => {
      // (real time between frames: the frame time Phaser reports is smoothed and capped)
      const t = performance.now();
      const delta = last ? t - last : 0;
      last = t;
      if (!delta || delta > 1000 || document.hidden || !game.scene.isActive('Menu')) return;
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
        try {
          localStorage.setItem(RES_KEY, String(resCap));
        } catch {
          /* private mode */
        }
        resize();
        setTimeout(() => watchSpeed(rounds - 1), 1500);
      }
    };
    game.events.on('step', onStep);
  };
  game.events.once('assets-ready', () => setTimeout(() => watchSpeed(2), 1000));
  (window as unknown as { __res: () => unknown }).__res = () => ({ dpr: dpr(), cap: resCap, renderer: game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas' });

  new UI(game);
  // the graphics chip gave up (out of memory, usually): say so rather than freeze
  game.canvas.addEventListener('webglcontextlost', () => {
    const note = document.createElement('div');
    note.className = 'gl-lost';
    if (!LIGHT) {
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
    bootTrouble('the graphics ran out of memory (WebGL context lost)');
    note.textContent = 'The graphics ran out of memory. Close other tabs and apps, then reload the page.';
    document.body.appendChild(note);
  });

  // handy for debugging from the console
  (window as unknown as { game: Phaser.Game; refreshHz: number }).game = game;
  (window as unknown as { refreshHz: number }).refreshHz = Math.round(1000 / refreshMs);
}

void measureRefreshMs().then(start);
