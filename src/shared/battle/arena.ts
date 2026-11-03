import { LevelBuilder, type LevelData } from '../../level/builder';

/** The battle arena: one screen, everyone always in view. 32 × 17 tiles. */
export const ARENA_W = 32;
export const ARENA_H = 17;

export function buildArena(): LevelData {
  const b = new LevelBuilder('arena', 'Battle', ARENA_W, ARENA_H);
  // the floor, with a little rise at each end
  b.ground(0, ARENA_W - 1, 2);
  b.ground(0, 2, 3);
  b.ground(ARENA_W - 3, ARENA_W - 1, 3);
  // two low rock walls to hide behind
  b.rock(9, 9, 3, 4);
  b.rock(22, 22, 3, 4);
  // jump-through clouds on three levels (the left low one made way for the ramp)
  b.cloud(23, 5, 6);
  b.cloud(2, 4, 10);
  b.cloud(26, 4, 10);
  b.cloud(13, 6, 12);
  // a floating island in the middle
  b.island(12, 19, 8, 1);
  // a few trees for decoration
  b.spawn('tree', 1.2, 3);
  b.spawn('tree', 30.4, 3);
  b.spawn('tree', 15.5, 8);
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
export const ARENA_RAMPS: Ramp[] = [{ x0: 3.5 * 32, y0: (ARENA_H - 2) * 32, x1: 11 * 32, y1: (ARENA_H - 8) * 32, flat: 40 }];

/** Where heroes (re)appear: [tile x, standing on height h]. */
export const ARENA_SPAWNS: [number, number][] = [
  [4, 2],
  [27, 2],
  [17, 8],
  [25, 6],
  [15, 8],
  [3, 10],
  [28, 10],
];
