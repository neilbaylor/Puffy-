/** Global tuning constants. Gameplay numbers that are per-character live in data/characters.ts. */

export const TILE = 32;

/** How many world pixels are visible vertically. Width adapts to the screen's aspect ratio. */
export const VIEW_H = 416;

export const GRAVITY = 1600;
export const MAX_FALL_SPEED = 900;

export const MAX_PLAYERS = 3;
export const TEAM_LIVES = 5;

/** Render ordering. */
export const DEPTH = {
  sky: -100,
  far: -90,
  clouds: -80,
  hills: -70,
  near: -60,
  decor: -10,
  tiles: 0,
  pickups: 5,
  enemies: 10,
  players: 20,
  projectiles: 25,
  fx: 30,
  text: 40,
} as const;
