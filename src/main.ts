import Phaser from 'phaser';
import './ui/style.css';
import { installInput } from './input/devices';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { HoopsScene } from './scenes/HoopsScene';
import { BattleScene } from './scenes/BattleScene';
import { UI } from './ui/ui';

installInput();

/**
 * The canvas is sized to the window in *device* pixels (capped at 2x) and
 * shown at CSS size via `zoom`, so everything stays sharp on phones.
 * Each scene then zooms its camera so exactly VIEW_H world pixels are visible
 * vertically; the visible width follows the screen's aspect ratio.
 */
// Cap the render resolution: full 2x on phones, 1.75x on big tablet screens (keeps Android tablets smooth).
const dpr = () => {
  const big = Math.min(window.innerWidth, window.innerHeight) >= 700;
  return Math.min(window.devicePixelRatio || 1, big ? 1.75 : 2);
};
// (v0.87 lowered the resolution on devices it found slow; that's gone: forget any saved setting)
try {
  localStorage.removeItem('puffy.res');
} catch {
  /* private mode */
}
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
    scene: [BootScene, MenuScene, GameScene, HoopsScene, BattleScene],
  });

  const resize = () => {
    const s = size();
    game.scale.resize(s.w, s.h);
    game.scale.setZoom(1 / dpr());
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));


  new UI(game);

  // handy for debugging from the console
  (window as unknown as { game: Phaser.Game; refreshHz: number }).game = game;
  (window as unknown as { refreshHz: number }).refreshHz = Math.round(1000 / refreshMs);
}

void measureRefreshMs().then(start);
