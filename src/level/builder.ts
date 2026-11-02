import { T } from './tiles';

/**
 * A tiny level-authoring DSL. Coordinates are in tiles; heights are counted
 * from the bottom of the level (h = 3 means the top 3 rows of ground).
 * Output is a collision grid + the logical cells (for drawing) + spawns.
 */

export type Cell = 'ground' | 'rock' | 'boulder' | 'bramble' | 'cloud' | null;

export type EnemyKind = 'puffball' | 'bigpuff' | 'giant' | 'goat';

export interface Spawn {
  type: EnemyKind | 'aura' | 'rootbeer' | 'checkpoint' | 'goal' | 'player' | 'tree' | 'soccer' | 'hockey' | 'para';
  x: number; // tile column (may be fractional for aura / trees)
  y: number; // tile row the thing occupies
  opts?: Record<string, number | string | boolean>;
}

export interface LevelData {
  name: string;
  world: string;
  /** Terrain looks by column range (Part 2: snowy rock, green valley, frozen pond). */
  zones?: { x0: number; x1: number; pal: string }[];
  width: number;
  height: number;
  tiles: number[][];
  cells: Cell[][];
  spawns: Spawn[];
}

export class LevelBuilder {
  readonly cells: Cell[][];
  readonly spawns: Spawn[] = [];
  readonly zones: { x0: number; x1: number; pal: string }[] = [];

  /** Columns x0..x1 use terrain palette `pal` (by piece centre). */
  zone(x0: number, x1: number, pal: string) {
    this.zones.push({ x0, x1, pal });
    return this;
  }

  constructor(
    readonly name: string,
    readonly world: string,
    readonly width: number,
    readonly height: number,
  ) {
    this.cells = Array.from({ length: height }, () => Array<Cell>(width).fill(null));
  }

  /** Row index of the top surface for ground height h. */
  top(h: number) {
    return this.height - h;
  }

  set(x: number, y: number, c: Cell) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return this;
    this.cells[y][x] = c;
    return this;
  }

  /** Solid ground from column x0 to x1 (inclusive), h tiles tall. */
  ground(x0: number, x1: number, h: number) {
    for (let x = x0; x <= x1; x++) for (let y = this.top(h); y < this.height; y++) this.set(x, y, 'ground');
    return this;
  }

  /** Clear whole columns (a bottomless pit). */
  pit(x0: number, x1: number) {
    for (let x = x0; x <= x1; x++) for (let y = 0; y < this.height; y++) this.set(x, y, null);
    return this;
  }

  /** Floating grassy island: top surface at height h, `thick` tiles deep. */
  island(x0: number, x1: number, h: number, thick = 2) {
    for (let x = x0; x <= x1; x++) for (let k = 0; k < thick; k++) this.set(x, this.top(h) + k, 'ground');
    // a rounder belly: one extra row under the middle
    if (x1 - x0 >= 3) for (let x = x0 + 1; x <= x1 - 1; x++) this.set(x, this.top(h) + thick, 'ground');
    return this;
  }

  /** Rock (ledge / pillar) from height h0 to h1 inclusive. */
  rock(x0: number, x1: number, h0: number, h1: number) {
    for (let x = x0; x <= x1; x++) for (let h = h0; h <= h1; h++) this.set(x, this.top(h), 'rock');
    return this;
  }

  /** Wall of blastable puff boulders. */
  boulders(x0: number, x1: number, h0: number, h1: number) {
    for (let x = x0; x <= x1; x++) for (let h = h0; h <= h1; h++) this.set(x, this.top(h), 'boulder');
    return this;
  }

  /** Thorny brambles sitting on ground of height h. */
  brambles(x0: number, len: number, h: number) {
    for (let i = 0; i < len; i++) this.set(x0 + i, this.top(h + 1), 'bramble');
    return this;
  }

  /** Jump-through cloud platform `len` tiles wide at height h. */
  cloud(x0: number, len: number, h: number) {
    for (let i = 0; i < len; i++) this.set(x0 + i, this.top(h), 'cloud');
    return this;
  }

  /** Something standing on ground of height h. */
  spawn(type: Spawn['type'], x: number, h: number, opts?: Spawn['opts']) {
    this.spawns.push({ type, x, y: this.top(h + 1), opts });
    return this;
  }

  /** A possible aura spot floating at height h (each play, only some spots get aura). */
  aura(x: number, h: number) {
    this.spawns.push({ type: 'aura', x, y: this.top(h) });
    return this;
  }

  /** A (rare) root beer bottle floating at height h. */
  rootbeer(x: number, h: number) {
    this.spawns.push({ type: 'rootbeer', x, y: this.top(h) });
    return this;
  }

  /** A gentle arc of aura spots. */
  auraArc(x0: number, n: number, h: number, rise = 2) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      this.aura(x0 + i * 1.2, h + Math.sin(t * Math.PI) * rise);
    }
    return this;
  }

  build(): LevelData {
    const idx: Record<Exclude<Cell, null>, number> = {
      ground: T.GROUND,
      rock: T.ROCK,
      boulder: T.BOULDER,
      bramble: T.BRAMBLE,
      cloud: T.CLOUD,
    };
    return {
      name: this.name,
      world: this.world,
      zones: this.zones.length ? this.zones : undefined,
      width: this.width,
      height: this.height,
      tiles: this.cells.map((row) => row.map((c) => (c ? idx[c] : T.EMPTY))),
      cells: this.cells.map((r) => [...r]),
      spawns: this.spawns,
    };
  }
}
