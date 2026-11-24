import type Phaser from 'phaser';

/**
 * How often the game runs a frame. It's made for 60 a second: on a 120 / 144 Hz screen it runs
 * every other screen frame (90 Hz can't divide evenly: every frame). Fewer where that's plenty:
 * - the start screen in full mode: 30 (its scenery glides slowly; see setHomeFrames) — but full
 *   speed for a moment after a tap, and while a Part's scenery is put up (setHomeBusy: switching
 *   Parts mustn't get slower),
 * - behind the battle lobby: 30 in full mode, 9 in light (its scenery stands still; setLobbyFrames),
 * - light mode's battle watching: 40 (setSlowFrames),
 * and full speed again whenever something there has to move smoothly (setFullSpeed: watching a
 * battle, the countdown's rumble, the curtain).
 *
 * A game frame runs once at least `gap` ms have passed since the last one: a whole number of screen
 * frames, less half of one (so timing jitter never skips an extra one). Its time is simply the time
 * since the last game frame. The page's own parts (buttons, the lobby's squares, its clock) aren't
 * game frames: they always run at the screen's speed.
 *
 * (Not Phaser's own fps limit: it hands a frame its time and keeps the leftover for the next one as
 * well — at 120 Hz the game ran about 17% fast, in uneven steps: the hero ran too quickly on a 120 Hz
 * desktop.)
 */
let refresh = 1000 / 60;
let slow = false;
let home = 0;
let lobby = 0;
let full = false;
let homeBusy = false;
let gap = 0;

/** The gap for about `fps` game frames a second: a whole number of screen frames (0: every frame). */
const gapFor = (fps: number) => {
  const every = Math.max(1, Math.round(1000 / fps / refresh - 0.1));
  return every > 1 ? (every - 0.5) * refresh : 0;
};
const update = () => {
  const normal = slow ? 40 : 60;
  gap = gapFor(full ? normal : lobby || (homeBusy ? 0 : home) || normal);
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

/** The start screen's game frames a second while it's up (0: normal). */
export function setHomeFrames(fps: number) {
  home = fps;
  update();
}

/** The battle lobby's game frames a second behind it (0: not in the lobby). */
export function setLobbyFrames(fps: number) {
  lobby = fps;
  update();
}

/** Something behind the lobby or on the start screen moves for real now: normal speed (or not). */
export function setFullSpeed(on: boolean) {
  full = on;
  update();
}

/** The start screen's busy (just tapped, or a Part's scenery being put up): its normal speed. */
export function setHomeBusy(on: boolean) {
  if (homeBusy === on) return;
  homeBusy = on;
  update();
}
