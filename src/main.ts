import Phaser from 'phaser';
import { installInput } from './input/devices';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { HoopsScene } from './scenes/HoopsScene';
import { BattleScene } from './scenes/BattleScene';
import { WrestleScene } from './scenes/WrestleScene';
import { FishingScene } from './scenes/FishingScene';
import { UI } from './ui/ui';
// (offline play: set up once the start screen is up)
import './core/offline';
import { LIGHT, LIGHT_AUTO, LIGHT_KEY, LIGHT_SLOW } from './core/light';
import { diag, showDiag } from './core/diag';
import { savedResCap, saveResCap } from './core/res';
import { trackBossArt } from './gfx/textures';
import { refreshMs } from './core/refresh';
import { trimRenderTargets } from './core/renderTargets';

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
 * screens we measure the refresh rate first (core/refresh) and draw on every 2nd refresh,
 * so motion stays perfectly even (and saves battery).
 */
/** Phaser draws once the frame times it has added up reach 1000 / limit ms. */
function fpsLimitFor(refreshMs: number) {
  const hz = 1000 / refreshMs;
  const every = Math.max(1, Math.round(hz / 60 - 0.1)); // 60Hz → 1, 120Hz → 2, 90Hz → 1 (can't divide evenly)
  // trigger half a refresh early so timing jitter never makes us skip an extra frame
  return every > 1 ? 1000 / ((every - 0.5) * refreshMs) : 0;
}

/**
 * The WebGL context, made here rather than by Phaser: its settings, but no depth or stencil buffer.
 * Phaser asks for both; nothing here uses them (no depth testing in 2D, and the stencil is only for
 * geometry masks: there are none), and the screen-sized buffer they share — four samples a pixel
 * with antialiasing, ~21 MB at 2x on a phone — was kept and cleared every frame for nothing.
 * Null where WebGL can't be had: Phaser then picks its canvas renderer as before.
 */
function makeGl(): { canvas: HTMLCanvasElement; context: WebGLRenderingContext } | null {
  try {
    const canvas = document.createElement('canvas');
    const attrs: WebGLContextAttributes = {
      alpha: false,
      desynchronized: false,
      depth: false,
      stencil: false,
      antialias: true,
      premultipliedAlpha: true,
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    };
    const context = (canvas.getContext('webgl', attrs) ?? canvas.getContext('experimental-webgl', attrs)) as WebGLRenderingContext | null;
    return context && !context.isContextLost() ? { canvas, context } : null;
  } catch {
    return null;
  }
}

function start(refreshMs: number) {
  const { w, h } = size();
  const gl = makeGl();
  const game = new Phaser.Game({
    // WebGL (on our own context), with Canvas fallback
    // (Phaser types `context` as a 2D one; it takes a WebGL one for the WebGL renderer)
    ...(gl ? { type: Phaser.WEBGL, canvas: gl.canvas, context: gl.context as unknown as CanvasRenderingContext2D } : { type: Phaser.AUTO }),
    parent: 'game',
    backgroundColor: '#8fd3ff',
    width: w,
    height: h,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr() },
    render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
    // (no pre-effects — glow, shadow… on a sprite — anywhere: without them Phaser doesn't keep their
    // dozens of drawing surfaces on the graphics chip; see also trimRenderTargets)
    disablePreFX: true,
    input: { activePointers: 4 },
    // (no tree of moving bodies: Phaser rebuilt it from every body on every physics step, a few
    // times a frame on a slow phone, to speed up checks among a few dozen bodies that mostly sit
    // still — nuggies, sleeping bad guys. Checking each one directly finds the same overlaps,
    // for a fraction of the cost. Nothing here searches the tree: no overlapRect / overlapCirc.)
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1600 }, debug: false, useTree: false } },
    fps: { target: 60, limit: fpsLimitFor(refreshMs), smoothStep: true },
    // (Phaser's own sound system isn't used: the music and sound effects have their own audio
    // context, see core/sfx. Without this it made a second one at start-up, for nothing.)
    audio: { noAudio: true },
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
    trimRenderTargets(game);
    trackBossArt(game);
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
  /**
   * Too slow for full mode even so (the start screen, or play at the lowest resolution, under ~35
   * fps): light mode for this device, for good. On the start screen it starts again in light mode
   * straight away (a moment's note); during play, from the next start (nothing lost mid-level).
   * Not where full mode was picked by hand ('0'), nor in test browsers.
   */
  const canGoLight = (() => {
    try {
      return !LIGHT && !navigator.webdriver && localStorage.getItem(LIGHT_KEY) !== '0';
    } catch {
      return false;
    }
  })();
  let wentLight = false;
  const goLight = (now: boolean) => {
    if (wentLight || !canGoLight) return;
    wentLight = true;
    try {
      localStorage.setItem(LIGHT_KEY, LIGHT_SLOW);
    } catch {
      return; // (private mode: can't remember it)
    }
    if (!now) return;
    const note = document.createElement('div');
    note.className = 'gl-lost';
    note.textContent = 'Switching to light mode for this device…';
    document.body.appendChild(note);
    setTimeout(() => location.reload(), 900);
  };
  const slowDeltas = (deltas: number[]) => {
    deltas.sort((a, b) => a - b);
    const median = deltas[deltas.length >> 1];
    // (a 30 fps cap — an iPhone in Low Power Mode — shows in the refresh rate measured at the start:
    // frames come every 33 ms however little there is to draw. A struggling device on a 60 Hz screen
    // also lands on 33 ms frames, but its refresh rate measured 60: that one IS slow)
    const capped30 = refreshMs > 28;
    return { median, capped30 };
  };
  /**
   * The start screen, a few seconds after it's settled (nothing loading, nothing being drawn ahead),
   * timed for 5 seconds once: under ~35 fps, light mode (see goLight).
   */
  const watchHome = () => {
    const deltas: number[] = [];
    let since = 0;
    let last = 0;
    let calm = 0; // when the start screen last became settled
    let up = 0; // when the start screen was first up (drawing ahead that never ends doesn't hold the check off for good)
    const onStep = () => {
      const t = performance.now();
      const delta = last ? t - last : 0;
      last = t;
      const menu = game.scene.getScene('Menu') as unknown as { quietLeft?: number } | null;
      const shown = home && !document.hidden && game.scene.isActive('Menu') && !document.querySelector('.art-loader') && !document.body.classList.contains('booting');
      if (shown && !up) up = t;
      const settled = shown && (!(menu?.quietLeft ?? 0) || t - up > 15000);
      if (!settled) {
        calm = 0;
        diag.home = !shown ? 'waiting for the start screen' : `waiting: ${menu?.quietLeft ?? 0} drawing jobs left`;
        return;
      }
      if (!calm) calm = t;
      diag.home = 'measuring…';
      if (!delta || delta > 1000 || t - calm < 3000) return;
      deltas.push(delta);
      since += delta;
      if (since < 5000 || deltas.length < 20) return;
      game.events.off('step', onStep);
      const long = deltas.filter((d) => d > 40).length / deltas.length;
      const { median, capped30 } = slowDeltas(deltas);
      // (slow on the whole — under ~50 fps — or stuttering: one frame in ten a long one)
      const slow = (median > 20 && !capped30) || long > 0.1;
      diag.home = `${Math.round(1000 / median)} fps, ${Math.round(long * 100)}% long frames → ${slow ? 'light mode' : 'stays full'}`;
      if (slow) goLight(true);
    };
    game.events.on('step', onStep);
  };
  diag.check = LIGHT ? 'off (already light mode)' : canGoLight ? 'on' : 'off (full mode picked by hand, or a test browser)';
  diag.refresh = `${Math.round(1000 / refreshMs)} Hz${refreshMs > 28 ? ' (30 fps cap)' : ''}`;
  if (canGoLight) watchHome();
  showDiag();
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
      // (a 30 fps cap — Low Power Mode — measured as such at the start; see slowDeltas)
      const capped30 = refreshMs > 28;
      const now = dpr();
      if (median > 21 && !capped30 && now > 1.05 && rounds > 0) {
        resCap = now > 1.4 ? 1.25 : 1;
        saveResCap(resCap);
        resize();
        setTimeout(() => watchSpeed(rounds - 1), 1500);
      } else if (median > 20 && !capped30) goLight(false); // (as low as it goes and still slow)
    };
    game.events.on('step', onStep);
  };
  if (!LIGHT) watchSpeed(2);
  (window as unknown as { __res: () => unknown }).__res = () => ({ dpr: dpr(), cap: resCap, home, renderer: game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas' });

  new UI(game);
  // the graphics chip gave up (out of memory, usually): switch this device to light mode (until the
  // next version). But not when it happened in the background: phones and tablets take the graphics
  // away from an app that's been put aside for a while, memory or not — then the game just starts
  // again, as it was, once it's back on screen.
  let shownAt = document.hidden ? 0 : performance.now();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) shownAt = performance.now();
  });
  game.canvas.addEventListener('webglcontextlost', () => {
    // (in the background, or within a moment of coming back: the loss belongs to the background)
    const background = document.hidden || performance.now() - shownAt < 2000;
    if (background) {
      const again = () => {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', again);
        location.reload();
      };
      document.addEventListener('visibilitychange', again);
      again();
      return;
    }
    if (!LIGHT) {
      const note = document.createElement('div');
      note.className = 'gl-lost';
      // the first time: switch this device to light mode (until the next version) and start again
      try {
        localStorage.setItem(LIGHT_KEY, LIGHT_AUTO);
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

void refreshMs.then(start);
