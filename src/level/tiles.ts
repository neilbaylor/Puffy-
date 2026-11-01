/** Collision tile ids. The tilemap is invisible: the visible world is drawn by gfx/world.ts. */
export const T = {
  EMPTY: -1,
  GROUND: 0,
  ROCK: 1,
  BOULDER: 2,
  BRAMBLE: 3,
  CLOUD: 4,
} as const;

export const TILE_COUNT = 5;

/** Tiles that block from every side. */
export const SOLID_TILES: number[] = [T.GROUND, T.ROCK, T.BOULDER, T.BRAMBLE];

/** Jump-through cloud platforms: only collide from above. */
export const ONE_WAY_TILES: number[] = [T.CLOUD];
