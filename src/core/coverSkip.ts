import type Phaser from 'phaser';

/**
 * While a page wholly hides the game (opaque, the whole screen — the Shop once it's slid all the way
 * up), the game goes on as ever (everything moves on, the start screen's quiet jobs run) but isn't
 * drawn: every frame of the fly-over drawn under the Shop was a whole frame's work for the graphics
 * chip that nobody saw, on a slow tablet most of each frame, the Shop's own scrolling and buttons
 * waiting on it. Drawing starts again the frame it's uncovered.
 *
 * (localStorage `puffy.drawUnder` = '1' keeps drawing: for side-by-side measurements.)
 */
let covers = 0;
let hooked: Phaser.Game | null = null;

export function coverGame(game: Phaser.Game, on: boolean) {
  covers = Math.max(0, covers + (on ? 1 : -1));
  if (hooked === game) return;
  try {
    if (localStorage.getItem('puffy.drawUnder') === '1') return;
  } catch {
    /* private mode: as usual */
  }
  hooked = game;
  const loop = game.loop as unknown as { callback: (time: number, delta: number) => void };
  const step = loop.callback;
  const g = game as unknown as { headlessStep: (time: number, delta: number) => void };
  // (headlessStep: Phaser's own step without the drawing — the same updates, input and timers)
  loop.callback = (time, delta) => (covers > 0 ? g.headlessStep.call(game, time, delta) : step(time, delta));
}
