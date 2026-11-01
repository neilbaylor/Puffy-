import { T } from './tiles';

/**
 * A tiny level-authoring DSL. Coordinates are in tiles; `y` counts rows from
 * the TOP of the level (row 0) like the tilemap does, but most helpers take a
 * ground height measured from the bottom because that's how you think about
 * platformer terrain.
 *
 * Later this can be swapped for levels exported from the Tiled editor
 * without touching the game code: the output is just a grid + spawn list.
 */

export type Cell = 'ground' | 'brick' | 'q' | 'stone' | 'plat' | 'spike' | null;

export type EnemyKind = 'walker' | 'spiker' | 'hopper' | 'flyer' | 'turret';

export interface Spawn {
  type: EnemyKind | 'coin' | 'checkpoint' | 'goal' | 'player' | 'decor';
  x: number; // tile column
  y: number; // tile row (the tile the thing stands in)
  opts?: Record<string, number | string | boolean>;
}

export type QContent = 'coin' | 'heart' | 'coins';

export interface LevelData {
  name: string;
  width: number;
  height: number;
  tiles: number[][];
  spawns: Spawn[];
  qContents: Map<string, QContent>;
}

export class LevelBuilder {
  readonly cells: Cell[][];
  readonly spawns: Spawn[] = [];
  readonly qContents = new Map<string, QContent>();

  constructor(
    readonly name: string,
    readonly width: number,
    readonly height: number,
  ) {
    this.cells = Array.from({ length: height }, () => Array<Cell>(width).fill(null));
  }

  /** Row index of the top surface for a given ground height (in tiles from the bottom). */
  top(h: number) {
    return this.height - h;
  }

  set(x: number, y: number, c: Cell) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return this;
    this.cells[y][x] = c;
    return this;
  }

  get(x: number, y: number): Cell {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.cells[y][x];
  }

  /** Solid ground from column x0 to x1 (inclusive), `h` tiles tall. */
  ground(x0: number, x1: number, h: number) {
    for (let x = x0; x <= x1; x++)
      for (let y = this.top(h); y < this.height; y++) this.set(x, y, 'ground');
    return this;
  }

  /** Clear a pit (removes everything in those columns). */
  pit(x0: number, x1: number) {
    for (let x = x0; x <= x1; x++) for (let y = 0; y < this.height; y++) this.set(x, y, null);
    return this;
  }

  /** A run of cells at height `h` above the bottom (h = row's distance from bottom, 1 = bottom row). */
  row(x0: number, len: number, h: number, c: Cell) {
    for (let i = 0; i < len; i++) this.set(x0 + i, this.top(h), c);
    return this;
  }

  /** Blocks pattern string, e.g. "B?B?B" where B=brick, ?=question, S=stone, -=gap. */
  blocks(x0: number, h: number, pattern: string, contents: QContent[] = []) {
    let qi = 0;
    [...pattern].forEach((ch, i) => {
      const x = x0 + i;
      const y = this.top(h);
      if (ch === 'B') this.set(x, y, 'brick');
      else if (ch === 'S') this.set(x, y, 'stone');
      else if (ch === '?') {
        this.set(x, y, 'q');
        this.qContents.set(`${x},${y}`, contents[qi++] ?? 'coin');
      }
    });
    return this;
  }

  /** One-way platform `len` tiles wide, at height `h`. */
  platform(x0: number, len: number, h: number) {
    return this.row(x0, len, h, 'plat');
  }

  /** Solid rectangle of a given cell type. x0..x1 inclusive, from height h0 to h1 inclusive. */
  rect(x0: number, x1: number, h0: number, h1: number, c: Cell) {
    for (let x = x0; x <= x1; x++) for (let h = h0; h <= h1; h++) this.set(x, this.top(h), c);
    return this;
  }

  /** Staircase of stone going up (dir=1) or down (dir=-1). */
  stairs(x0: number, steps: number, baseH: number, dir: 1 | -1 = 1) {
    for (let i = 0; i < steps; i++) {
      const x = x0 + i;
      const hgt = dir === 1 ? i + 1 : steps - i;
      this.rect(x, x, baseH + 1, baseH + hgt, 'stone');
    }
    return this;
  }

  /** Spikes on top of ground of height h. */
  spikes(x0: number, len: number, h: number) {
    return this.row(x0, len, h + 1, 'spike');
  }

  /** Line of coins at height h (the coin sits in that row). */
  coins(x0: number, len: number, h: number, step = 1) {
    for (let i = 0; i < len; i += step) this.spawns.push({ type: 'coin', x: x0 + i, y: this.top(h) });
    return this;
  }

  /** Arc of coins, nice over gaps. */
  coinArc(x0: number, len: number, h: number, rise = 2) {
    for (let i = 0; i < len; i++) {
      const t = len === 1 ? 0.5 : i / (len - 1);
      const lift = Math.round(Math.sin(t * Math.PI) * rise);
      this.spawns.push({ type: 'coin', x: x0 + i, y: this.top(h + lift) });
    }
    return this;
  }

  /** Enemy (or other entity) standing on ground of height h. */
  spawn(type: Spawn['type'], x: number, h: number, opts?: Spawn['opts']) {
    this.spawns.push({ type, x, y: this.top(h + 1), opts });
    return this;
  }

  /** Convert logical cells into auto-tiled tileset indices. */
  build(): LevelData {
    const solidish = (c: Cell) => c === 'ground';
    const tiles: number[][] = this.cells.map((row, y) =>
      row.map((c, x) => {
        switch (c) {
          case null:
            return T.EMPTY;
          case 'brick':
            return T.BRICK;
          case 'q':
            return T.QBLOCK;
          case 'stone':
            return T.STONE;
          case 'spike':
            return T.SPIKES;
          case 'plat': {
            const l = this.get(x - 1, y) === 'plat';
            const r = this.get(x + 1, y) === 'plat';
            return !l ? T.PLAT_L : !r ? T.PLAT_R : T.PLAT_M;
          }
          case 'ground': {
            const above = this.get(x, y - 1);
            const exposedTop = !solidish(above);
            const openL = !solidish(this.get(x - 1, y)) && x > 0;
            const openR = !solidish(this.get(x + 1, y)) && x < this.width - 1;
            if (exposedTop) {
              if (openL && openR) return T.GRASS_LR;
              if (openL) return T.GRASS_L;
              if (openR) return T.GRASS_R;
              return T.GRASS;
            }
            if (openL && openR) return T.DIRT_LR;
            if (openL) return T.DIRT_L;
            if (openR) return T.DIRT_R;
            return T.DIRT;
          }
        }
      }),
    );
    return {
      name: this.name,
      width: this.width,
      height: this.height,
      tiles,
      spawns: this.spawns,
      qContents: this.qContents,
    };
  }
}
