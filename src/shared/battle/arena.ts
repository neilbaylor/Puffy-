import { LevelBuilder, type LevelData } from '../../level/builder';

/** One stretch of arena (four of them side by side; the camera shows a little more than one). */
export const ARENA_SECTION = 28;
/** How much of the arena the camera shows across (tiles). */
export const ARENA_VIEW = 32;
/** Where things go in a stretch, laid out for a 32-tile one and squeezed to fit. */
const P = (x: number) => Math.round((x * ARENA_SECTION) / 32);
/** The battle arena: four stretches side by side, so everyone starts far apart. 112 × 17 tiles (was 128). */
export const ARENA_W = ARENA_SECTION * 4;
export const ARENA_H = 17;

export function buildArena(): LevelData {
  const b = new LevelBuilder('arena', 'Battle', ARENA_W, ARENA_H);
  const S = ARENA_SECTION;
  // the floor, with a little rise at each end of the whole arena
  b.ground(0, ARENA_W - 1, 2);
  b.ground(0, 2, 3);
  b.ground(ARENA_W - 3, ARENA_W - 1, 3);
  // each screen: the old arena's pieces, mirrored or shifted a little so they don't all look alike
  for (let k = 0; k < 4; k++) {
    const o = k * S;
    const flip = k % 2 === 1;
    const X = (x: number, w = 1) => (flip ? o + S - x - w : o + x);
    // two low rock walls to hide behind
    b.rock(X(P(9)), X(P(9)), 3, 4);
    b.rock(X(P(22)), X(P(22)), 3, 4);
    // jump-through clouds on three levels
    b.cloud(X(P(4), 5), 5, 6);
    b.cloud(X(P(23), 5), 5, 6);
    b.cloud(X(P(2), 4), 4, 10);
    b.cloud(X(P(26), 4), 4, 10);
    b.cloud(X(P(13), 6), 6, 12);
    // a floating island in the middle of each screen (lower on alternate ones)
    b.island(X(P(12), 8), X(P(12), 8) + 7, k === 1 || k === 2 ? 7 : 8, 1);
    // a few trees for decoration
    b.spawn('tree', X(1.2), 3);
    b.spawn('tree', X(P(15.5)), k === 1 || k === 2 ? 7 : 8);
  }
  b.spawn('tree', ARENA_W - 1.6, 3);
  return b.build();
}

/**
 * A wooden ramp you can run up, from the floor to the floating island in the
 * middle (world px: where the walking surface starts and ends, then a short
 * flat bit onto the island). You can jump up through it from below.
 */
export interface Ramp {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Flat run past the top end (onto the island). */
  flat: number;
}
// (no ramp for now: the bad guys climb up by jumping, like everyone else)
export const ARENA_RAMPS: Ramp[] = [];

/** Where heroes reappear: [tile x, standing on height h] (the one farthest from everyone is used). */
export const ARENA_SPAWNS: [number, number][] = [0, 1, 2, 3].flatMap((k) => {
  const o = k * ARENA_SECTION;
  const flip = k % 2 === 1;
  const X = (x: number) => (flip ? o + ARENA_SECTION - 1 - x : o + x);
  const mid = k === 1 || k === 2 ? 7 : 8;
  return [
    [X(P(4)), 2],
    [X(P(27)), 2],
    [X(P(16)), mid],
    [X(P(3)), 10],
    [X(P(28)), 10],
  ] as [number, number][];
});

/** Where the heroes start (by slot): a screen each, as far apart as the arena allows. */
export const ARENA_STARTS: [number, number][] = [
  [4, 2],
  [ARENA_W - 5, 2],
  [ARENA_SECTION + P(16), 2],
  [ARENA_SECTION * 3 - P(16), 2],
];
