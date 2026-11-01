/** Tile frame indices inside the generated tileset texture. */
export const T = {
  EMPTY: -1,
  GRASS: 0,
  GRASS_L: 1,
  GRASS_R: 2,
  GRASS_LR: 3,
  DIRT: 4,
  DIRT_L: 5,
  DIRT_R: 6,
  DIRT_LR: 7,
  BRICK: 8,
  QBLOCK: 9,
  USED: 10,
  STONE: 11,
  PLAT_L: 12,
  PLAT_M: 13,
  PLAT_R: 14,
  SPIKES: 15,
} as const;

export const TILE_COUNT = 16;
export const TILESET_COLS = 8;

/** Tiles that block from every side. */
export const SOLID_TILES: number[] = [
  T.GRASS, T.GRASS_L, T.GRASS_R, T.GRASS_LR,
  T.DIRT, T.DIRT_L, T.DIRT_R, T.DIRT_LR,
  T.BRICK, T.QBLOCK, T.USED, T.STONE, T.SPIKES,
];

/** Jump-through platforms: only collide from above. */
export const ONE_WAY_TILES: number[] = [T.PLAT_L, T.PLAT_M, T.PLAT_R];
