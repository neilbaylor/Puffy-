import { LevelBuilder, type LevelData } from '../../level/builder';

/** One screen's worth of arena (the camera shows about this much, following your hero). */
export const ARENA_SECTION = 32;
/** The battle arena: four screens side by side, so everyone starts far apart. 128 × 17 tiles. */
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
    b.rock(X(9), X(9), 3, 4);
    b.rock(X(22), X(22), 3, 4);
    // jump-through clouds on three levels
    b.cloud(X(4, 5), 5, 6);
    b.cloud(X(23, 5), 5, 6);
    b.cloud(X(2, 4), 4, 10);
    b.cloud(X(26, 4), 4, 10);
    b.cloud(X(13, 6), 6, 12);
    // a floating island in the middle of each screen (lower on alternate ones)
    b.island(X(12, 8), X(12, 8) + 7, k === 1 || k === 2 ? 7 : 8, 1);
    // a few trees for decoration
    b.spawn('tree', X(1.2), 3);
    b.spawn('tree', X(15.5), k === 1 || k === 2 ? 7 : 8);
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
    [X(4), 2],
    [X(27), 2],
    [X(16), mid],
    [X(3), 10],
    [X(28), 10],
  ] as [number, number][];
});

/** Where the heroes start (by slot): a screen each, as far apart as the arena allows. */
export const ARENA_STARTS: [number, number][] = [
  [4, 2],
  [ARENA_W - 5, 2],
  [ARENA_SECTION + 16, 2],
  [ARENA_SECTION * 3 - 16, 2],
];
