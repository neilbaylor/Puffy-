import type Phaser from 'phaser';

/**
 * How often the game runs a frame. It's made for 60 a second: on a 120 / 144 Hz screen it runs
 * every other screen frame (90 Hz can't divide evenly: every frame), and light mode's battle
 * watching runs about 40 a second (see setSlowFrames).
 *
 * A game frame runs once at least `gap` ms have passed since the last one: a whole number of screen
 * frames, less half of one (so timing jitter never skips an extra one). Its time is simply the time
 * since the last game frame.
 *
 * (Not Phaser's own fps limit: it hands a frame its time and keeps the leftover for the next one as
 * well — at 120 Hz the game ran about 17% fast, in uneven steps: the hero ran too quickly on a 120 Hz
 * desktop.)
 */
let refresh = 1000 / 60;
let slow = false;
let gap = 0;

/** The gap for about `fps` game frames a second: a whole number of screen frames (0: every frame). */
const gapFor = (fps: number) => {
  const every = Math.max(1, Math.round(1000 / fps / refresh - 0.1));
  return every > 1 ? (every - 0.5) * refresh : 0;
};
const update = () => {
  gap = gapFor(slow ? 40 : 60);
};

/** Put the gate on the game's loop (once, at start). */
export function gateFrames(game: Phaser.Game, refreshMs: number) {
  refresh = refreshMs;
  update();
  const loop = game.loop as unknown as { step(t: number): void };
  const step = loop.step.bind(loop);
  let last = -Infinity;
  loop.step = (t: number) => {
    if (gap && t - last < gap) return;
    last = t;
    step(t);
  };
}

/** About 40 game frames a second (light mode, watching a battle from the lobby), or back to 60. */
export function setSlowFrames(on: boolean) {
  slow = on;
  update();
}
