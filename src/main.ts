import Phaser from 'phaser';
import './ui/style.css';
import { installInput } from './input/devices';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { UI } from './ui/ui';

installInput();

/**
 * The canvas is sized to the window in *device* pixels (capped at 2x) and
 * shown at CSS size via `zoom`, so everything stays sharp on phones.
 * Each scene then zooms its camera so exactly VIEW_H world pixels are visible
 * vertically; the visible width follows the screen's aspect ratio.
 */
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const size = () => ({ w: Math.max(1, Math.round(window.innerWidth * dpr())), h: Math.max(1, Math.round(window.innerHeight * dpr())) });

const { w, h } = size();
const game = new Phaser.Game({
  type: Phaser.AUTO, // WebGL, with Canvas fallback
  parent: 'game',
  backgroundColor: '#3fb4ff',
  width: w,
  height: h,
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr() },
  render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
  input: { activePointers: 4 },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1600 }, debug: false } },
  fps: { target: 60, smoothStep: true },
  scene: [BootScene, MenuScene, GameScene],
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
(window as unknown as { game: Phaser.Game }).game = game;
