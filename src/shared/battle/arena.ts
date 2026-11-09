import { LevelBuilder, type LevelData } from '../../level/builder';

/** One stretch of arena (four of them side by side; the camera shows a little more than one). */
export const ARENA_SECTION = 28;
/** How much of the arena the camera shows across (tiles). */
export const ARENA_VIEW = 32;
/** The battle arena: four stretches side by side, so everyone starts far apart. 112 × 17 tiles. */
export const ARENA_W = ARENA_SECTION * 4;
export const ARENA_H = 17;

/**
 * Each stretch has its own shape, so the arena doesn't just repeat (x in tiles from the stretch's
 * left edge, heights in tiles above the bottom; the floor is height 2):
 *  1. the meadow: two low walls, a floating island, clouds on three levels;
 *  2. the hill: a grassy mound with a tree on top, a small island either side, clouds above;
 *  3. the steps: three islands like a staircase up and down, a wall at each end;
 *  4. the cliffs: a tall rock and a short one, a long island, high clouds, then the end rise.
 */
export function buildArena(): LevelData {
  const b = new LevelBuilder('arena', 'Battle', ARENA_W, ARENA_H);
  const S = ARENA_SECTION;
  // the floor, with a little rise at each end of the whole arena
  b.ground(0, ARENA_W - 1, 2);
  b.ground(0, 2, 3);
  b.ground(ARENA_W - 3, ARENA_W - 1, 3);
  b.spawn('tree', 1.2, 3);
  b.spawn('tree', ARENA_W - 1.6, 3);

  // 1. the meadow
  let o = 0;
  b.rock(o + 8, o + 8, 3, 4);
  b.rock(o + 19, o + 19, 3, 4);
  b.cloud(o + 4, 5, 6);
  b.cloud(o + 20, 5, 6);
  b.cloud(o + 2, 4, 10);
  b.cloud(o + 23, 4, 10);
  b.cloud(o + 11, 6, 12);
  b.island(o + 10, o + 17, 8, 1);
  b.spawn('tree', o + 13.5, 8);

  // 2. the hill
  o = S;
  b.ground(o + 8, o + 19, 3);
  b.ground(o + 11, o + 16, 4);
  b.spawn('tree', o + 13.5, 4, { h: 78 });
  b.island(o + 1, o + 5, 7, 1);
  b.island(o + 22, o + 26, 7, 1);
  b.cloud(o + 6, 4, 10);
  b.cloud(o + 18, 4, 10);
  b.cloud(o + 11, 6, 13);

  // 3. the steps
  o = S * 2;
  b.rock(o + 2, o + 2, 3, 4);
  b.rock(o + 25, o + 25, 3, 4);
  b.island(o + 4, o + 8, 7, 1);
  b.island(o + 11, o + 16, 10, 1);
  b.island(o + 19, o + 23, 7, 1);
  b.spawn('tree', o + 6, 7, { h: 50 });
  b.cloud(o + 1, 4, 11);
  b.cloud(o + 23, 4, 11);
  b.cloud(o + 12, 4, 13);

  // 4. the cliffs
  o = S * 3;
  b.rock(o + 5, o + 5, 3, 4);
  b.rock(o + 17, o + 18, 3, 6);
  b.island(o + 7, o + 14, 8, 1);
  b.spawn('tree', o + 9, 8, { h: 70 });
  b.cloud(o + 1, 4, 6);
  b.cloud(o + 19, 5, 9);
  b.cloud(o + 2, 4, 11);
  b.cloud(o + 9, 5, 12);
  b.cloud(o + 21, 4, 12);
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
export const ARENA_SPAWNS: [number, number][] = [
  // the meadow
  [4, 2], [24, 2], [13, 8], [3, 10], [25, 10],
  // the hill
  [ARENA_SECTION + 13, 4], [ARENA_SECTION + 3, 7], [ARENA_SECTION + 24, 7], [ARENA_SECTION + 7, 10], [ARENA_SECTION + 20, 10],
  // the steps
  [ARENA_SECTION * 2 + 5, 2], [ARENA_SECTION * 2 + 22, 2], [ARENA_SECTION * 2 + 13, 10], [ARENA_SECTION * 2 + 6, 7], [ARENA_SECTION * 2 + 21, 7],
  // the cliffs
  [ARENA_SECTION * 3 + 3, 2], [ARENA_SECTION * 3 + 22, 2], [ARENA_SECTION * 3 + 11, 8], [ARENA_SECTION * 3 + 17, 6], [ARENA_SECTION * 3 + 3, 11],
];

/** Where the heroes start (by slot): a stretch each, as far apart as the arena allows. */
export const ARENA_STARTS: [number, number][] = [
  [4, 2],
  [ARENA_W - 5, 2],
  [ARENA_SECTION + 13, 4],
  [ARENA_SECTION * 2 + 13, 2],
];
