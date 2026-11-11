import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { rng } from '../gfx/draw';
import type { Pt } from '../gfx/handdrawn';
import { PROP_RES, TERRAIN_RES, addCanvas, ensureSeaArt, hires } from '../gfx/textures';
import { GRASS_FILLS, KELP_H, SEA_PROPS, SWAY_N, drawPier } from '../gfx/sea';
import { DEFAULT_PALETTE, PALETTES, drawCloudPlatform, drawPuffTree, drawTerrainPiece, roundPoly, traceCells, type TerrainKind, type WorldPalette } from '../gfx/world';
import { drawPine } from '../gfx/mountain';
import type { Cell, LevelData } from '../level/builder';
import { ONE_WAY_TILES, SOLID_TILES } from '../level/tiles';

const PAD = 34; // room around each terrain piece for grass blades / roots
/** Terrain pieces are cut into chunks no wider than this (world px), to stay under mobile texture limits. */
const CHUNK = 800;
/** …and no taller than this (tall levels: a cliff wall would otherwise make one picture thousands of px tall). */
const CHUNK_V = 1024;
/** Colour of the deep rock under each terrain chunk (sampled once, when the chunk is drawn). */
const DEEP_FILL = new Map<string, number>();
/** Each level's terrain pieces (outline + bounds), worked out once (see LevelView.pieces). */
const PIECES = new Map<string, { outline: Pt[]; x0: number; y0: number; x1: number; y1: number }[]>();

/** Highest point (smallest y) of a closed outline within the column range x0..x1. */
function localTop(outline: Pt[], x0: number, x1: number) {
  let top = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const [ax, ay] = outline[i];
    const [bx, by] = outline[(i + 1) % outline.length];
    if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1) continue;
    top = Math.min(top, ay, by);
  }
  return top;
}

/**
 * A level's pieces of one kind of terrain (outline + bounds), worked out once and kept (see
 * LevelView.pieces). The loading screen works them out as a step of its own.
 */
export function levelPieces(d: LevelData, kind: TerrainKind): { outline: Pt[]; x0: number; y0: number; x1: number; y1: number }[] {
  const cell = (x: number, y: number): Cell => d.cells[y]?.[x] ?? null;
  const ck = `${d.name}|${kind}|${d.width}x${d.height}`;
  const have = PIECES.get(ck);
  if (have) return have;
  const out: { outline: Pt[]; x0: number; y0: number; x1: number; y1: number }[] = [];
  const seen = new Set<string>();
  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      if (cell(x, y) !== kind || seen.has(`${x},${y}`)) continue;
      // flood fill one piece
      const cells = new Set<string>();
      const stack: Pt[] = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        const k = `${cx},${cy}`;
        if (seen.has(k) || cell(cx, cy) !== kind) continue;
        seen.add(k);
        cells.add(k);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      // extend pieces past the level edges so no outline shows at the screen bottom/sides
      for (const k of [...cells]) {
        const [cx, cy] = k.split(',').map(Number);
        if (cy === d.height - 1) for (let e = 1; e <= 3; e++) cells.add(`${cx},${cy + e}`);
        if (cx === 0) for (let e = 1; e <= 3; e++) cells.add(`${-e},${cy}`);
        if (cx === d.width - 1) for (let e = 1; e <= 3; e++) cells.add(`${cx + e},${cy}`);
      }
      for (const k of [...cells]) {
        const [cx, cy] = k.split(',').map(Number);
        if (cx < 0 && cy === d.height - 1) for (let e = 1; e <= 3; e++) cells.add(`${cx},${cy + e}`);
        if (cx >= d.width && cy === d.height - 1) for (let e = 1; e <= 3; e++) cells.add(`${cx},${cy + e}`);
      }
      const loops = traceCells(cells);
      const outline = roundPoly(loops[0].map(([px, py]) => [px * TILE, py * TILE] as Pt), kind === 'ground' ? 12 : 7);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [px, py] of outline) {
        x0 = Math.min(x0, px);
        y0 = Math.min(y0, py);
        x1 = Math.max(x1, px);
        y1 = Math.max(y1, py);
      }
      out.push({ outline, x0, y0, x1, y1 });
    }
  PIECES.set(ck, out);
  return out;
}

/**
 * A level's ground pictures not drawn yet, as jobs (drawn ahead, behind a loading card, so its
 * opening fly-over doesn't have to): a view of the level is made only to work them out.
 */
export function groundPaintJobs(scene: Phaser.Scene, data: LevelData): (() => string | null)[] {
  const before = new Set(scene.children.list);
  const view = new LevelView(scene, data, { lazyNear: -1e9, lazySpan: [0, 0], ahead: false });
  for (const o of scene.children.list.filter((c) => !before.has(c))) o.destroy();
  return view.paintJobs();
}

/**
 * Builds the level: an invisible tilemap for collision, plus the hand-drawn
 * world on top (organic terrain pieces, clouds, boulders, brambles, trees,
 * flowers). Shared by the menu backdrop and the game.
 */
export class LevelView {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly layer: Phaser.Tilemaps.TilemapLayer;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Boulder sprites by "x,y" tile key, so blasting a boulder removes its picture too. */
  readonly boulderSprites = new Map<string, Phaser.GameObjects.Image>();

  /** Terrain chunks not drawn yet (lazy mode): drawn when the view gets near, or one per frame. */
  private pending: { x0: number; x1: number; make: () => void }[] = [];
  private readonly lazy: boolean;
  private readonly lazyNear: number;
  private readonly lazySpan: [number, number];
  /** Lazy: also draw the terrain coming up, a chunk per frame (the game); off on the start screen, whose slow glide only needs what's about to come into view. */
  private readonly ahead: boolean;

  constructor(
    private scene: Phaser.Scene,
    readonly data: LevelData,
    /** Lazy: only draw the terrain near `nearX` now, the rest bit by bit (the start screen). */
    /** keep: leave other levels' terrain alone (a battle watched while the start screen still shows). */
    /** free: free other levels' terrain (the game; default when not lazy). */
    /** lazySpan: how far before / after `lazyNear` the terrain is drawn straight away (default 900 / 1800). */
    opts?: { lazyNear?: number; keep?: boolean; free?: boolean; lazySpan?: [number, number]; ahead?: boolean },
  ) {
    this.ahead = opts?.ahead ?? true;
    this.lazy = opts?.lazyNear !== undefined;
    this.lazyNear = opts?.lazyNear ?? 0;
    this.lazySpan = opts?.lazySpan ?? [900, 1800];
    // only one level's terrain lives in memory at a time in the game (phones run out
    // otherwise); the start screen's lazy views keep theirs (they only draw a little)
    if ((opts?.free ?? opts?.lazyNear === undefined) && !opts?.keep)
      for (const k of scene.textures.getTextureKeys())
      if (k.startsWith('terrain-') && !k.startsWith(`terrain-${data.name}-`)) scene.textures.remove(k);
    this.map = scene.make.tilemap({ data: data.tiles.map((r) => [...r]), tileWidth: TILE, tileHeight: TILE });
    const tileset = this.map.addTilesetImage('tiles', 'tiles', TILE, TILE, 1, 2)!;
    this.layer = this.map.createLayer(0, tileset, 0, 0)!.setVisible(false);
    this.layer.setCollision(SOLID_TILES);
    this.layer.forEachTile((t) => {
      if (ONE_WAY_TILES.includes(t.index)) t.setCollision(false, false, true, false, false);
    });
    this.layer.calculateFacesWithin(0, 0, this.map.width, this.map.height);
    this.widthPx = data.width * TILE;
    this.heightPx = data.height * TILE;

    const first = scene.children.list.length;
    if (data.water !== undefined) ensureSeaArt(scene);
    this.drawTerrain('ground');
    this.drawTerrain('rock');
    this.placeClouds();
    this.placeBlocks();
    this.placeDecor();
    this.scenery = scene.children.list.slice(first).filter((o): o is Phaser.GameObjects.Image => o instanceof Phaser.GameObjects.Image);
  }

  /** Under the sea: plants that sway by bending (their sway frames, a frame at a time, and a touch of tilt between). */
  private waving: { img: Phaser.GameObjects.Image; pre: string; speed: number; ph: number }[] = [];

  /** Trees, flowers and grass that sway in the breeze. */
  private sway: { img: Phaser.GameObjects.Image; amp: number; speed: number; ph: number }[] = [];

  /** The plain deep rock under every terrain chunk (one shape for the whole level). */
  private deepG: Phaser.GameObjects.Graphics | null = null;

  /** Every terrain chunk's picture, drawn or not (see `paintJobs`). */
  private paints: { key: string; paint: () => boolean }[] = [];

  /**
   * One job per terrain picture of this level not drawn yet: the start screen runs them in
   * quiet moments, so the level's fly-over (which sweeps the whole level in seconds) only
   * has to put the pictures up, not draw them. Each job returns its texture key if it drew one.
   */
  paintJobs(): (() => string | null)[] {
    return this.paints.filter((p) => !this.scene.textures.exists(p.key)).map((p) => () => (p.paint() ? p.key : null));
  }

  /** Lazy views: never draw the terrain past `maxX` (the start-screen fly-over only loops over part of the level). */
  trimPending(maxX: number) {
    this.pending = this.pending.filter((p) => p.x0 < maxX);
  }

  /** Lazy views: the chunks not drawn yet overlapping a..b, each as a job (drawn and put up when run). */
  pendingJobs(a: number, b: number): (() => void)[] {
    return this.pending
      .filter((p) => p.x1 > a && p.x0 < b)
      .map((p) => () => {
        if (!this.pending.includes(p)) return;
        p.make();
        this.pending = this.pending.filter((q) => q !== p);
      });
  }

  /** Sway the plants on screen; gusts come and go. `t` in seconds. */
  animate(t: number, left: number, right: number) {
    // lazy terrain: anything the view is about to reach right away, otherwise one chunk per frame
    if (this.pending.length) {
      // the fly-over only ever moves forward slowly: draw what it's about to reach, nothing more
      const near = this.pending.filter((p) => p.x1 > left - 400 && p.x0 < right + 400);
      for (const p of near) p.make();
      this.pending = this.pending.filter((p) => !near.includes(p));
      // (the nearest to the view first, either way: the level's fly-over runs right to left)
      const mid = (left + right) / 2;
      const dist = (p: { x0: number; x1: number }) => Math.max(0, p.x0 - mid, mid - p.x1);
      const ahead = this.ahead ? this.pending.filter((p) => p.x0 < right + 2200 && p.x1 > left - 2200) : [];
      ahead.sort((a, b) => dist(a) - dist(b));
      if (ahead[0]) {
        ahead[0].make();
        this.pending = this.pending.filter((p) => p !== ahead[0]);
      }
    }
    const gust = 0.55 + 0.45 * Math.sin(t * 0.33) * Math.sin(t * 0.21 + 1);
    for (const w of this.waving) {
      if (w.img.x < left - 80 || w.img.x > right + 80) continue;
      const c = (t * w.speed + w.ph) * SWAY_N;
      const i = ((Math.floor(c) % SWAY_N) + SWAY_N) % SWAY_N;
      w.img.setFrame(w.pre + i);
      // (a hair of tilt following the same sway smooths the step from frame to frame)
      w.img.setRotation(Math.sin((c / SWAY_N) * Math.PI * 2) * 0.03 * (w.img.flipX ? -1 : 1));
    }
    for (const s of this.sway) {
      if (s.img.x < left - 80 || s.img.x > right + 80) continue;
      // a wave of wind rolls across the level (phase follows x)
      s.img.setAngle(s.amp * gust * Math.sin(t * s.speed - s.img.x * 0.004 + s.ph));
    }
  }

  /** Terrain, clouds, blocks and decor (for the colour grade as the look drifts). */
  private scenery: Phaser.GameObjects.Image[] = [];
  private tint = 0xffffff;

  /** Colour-grade the foreground scenery to match the current look. */
  setTint(color: number) {
    if (color === this.tint) return;
    this.tint = color;
    for (const o of this.scenery) if (o.active) o.setTint(color);
  }

  /** The terrain palette at world x (Part 2's zones; Part 1 is all Puff Ball Planet). */
  paletteAt(worldX: number): WorldPalette {
    const z = this.data.zones?.find((zz) => worldX >= zz.x0 * TILE && worldX < (zz.x1 + 1) * TILE);
    return (z && PALETTES[z.pal]) || (this.data.pal && PALETTES[this.data.pal]) || DEFAULT_PALETTE;
  }

  /** Top of the ground in column at world x (for framing the camera), or the level bottom. */

  /** The lowest ground surface (largest y) between two x positions, ignoring pits. */
  private deepestSurface(xa: number, xb: number) {
    let deep = 0;
    for (let x = Math.max(0, xa); x <= Math.min(this.widthPx - 1, xb); x += TILE) {
      const y = this.surfaceY(x);
      if (y < this.heightPx) deep = Math.max(deep, y);
    }
    return deep || this.heightPx;
  }

  /**
   * Under the sea: the sea bed under the water at world x — past any reef shelf hanging at the
   * surface, and no deeper than the main sea bed (bgBottom), so a trench doesn't count.
   */
  seaFloorY(worldX: number): number {
    const x = Math.floor(worldX / TILE);
    const H = this.data.height;
    let y = Math.ceil((this.data.water ?? 0) / TILE);
    while (y < H && this.solid(x, y)) y++;
    while (y < H && !this.solid(x, y)) y++;
    return Math.min(y * TILE, this.data.bgBottom ?? this.heightPx);
  }

  surfaceY(worldX: number): number {
    const x = Math.floor(worldX / TILE);
    for (let y = 0; y < this.data.height; y++) {
      const c = this.cell(x, y);
      if (c === 'ground' || c === 'rock') return y * TILE;
    }
    return this.heightPx;
  }

  isSolidAt(worldX: number, worldY: number): boolean {
    const t = this.layer.getTileAtWorldXY(worldX, worldY);
    return !!t && (SOLID_TILES.includes(t.index) || ONE_WAY_TILES.includes(t.index));
  }

  private solid(x: number, y: number) {
    const c = this.cell(x, y);
    return c === 'ground' || c === 'rock';
  }

  /**
   * The deep rock under the sea, tile column by tile column (a trench cuts down through it, so a
   * plain block won't do): each run of `kind` tiles below `top`, filled; a lighter rim and an
   * inked edge along each face onto open water. All shapes (no pictures: no extra memory).
   */
  private deepRuns(g: Phaser.GameObjects.Graphics, kind: TerrainKind, col: number, gx0: number, gx1: number, top: number) {
    const H = this.data.height;
    const rim = Phaser.Display.Color.IntegerToColor(col).lighten(14).color;
    const ink = 0x3a2a3a;
    const c0 = Math.floor(gx0 / TILE);
    const c1 = Math.ceil(gx1 / TILE) - 1;
    const r0 = Math.max(0, Math.floor(top / TILE));
    for (let c = c0; c <= c1; c++) {
      const xa = Math.max(gx0, c * TILE);
      const xb = Math.min(gx1, (c + 1) * TILE);
      if (xb <= xa) continue;
      for (let r = r0; r < H; ) {
        if (this.cell(c, r) !== kind) {
          r++;
          continue;
        }
        let e = r;
        while (e + 1 < H && this.cell(c, e + 1) === kind) e++;
        const ya = Math.max(top, r * TILE);
        const yb = (e + 1) * TILE + (e + 1 >= H ? 200 : 0);
        g.fillStyle(col, 1).fillRect(xa, ya, xb - xa, yb - ya);
        for (let k = r; k <= e; k++) {
          const y = Math.max(top, k * TILE);
          const h = (k + 1) * TILE - y;
          if (h <= 0) continue;
          if (xa === c * TILE && !this.solid(c - 1, k)) {
            g.fillStyle(rim, 1).fillRect(xa + 2.5, y, 5, h);
            g.fillStyle(ink, 1).fillRect(xa, y, 2.5, h);
            this.wallDecor(xa, y + h / 2, -1, c, k);
          }
          if (xb === (c + 1) * TILE && !this.solid(c + 1, k)) {
            g.fillStyle(rim, 1).fillRect(xb - 7.5, y, 5, h);
            g.fillStyle(ink, 1).fillRect(xb - 2.5, y, 2.5, h);
            this.wallDecor(xb, y + h / 2, 1, c, k);
          }
        }
        if (r * TILE > top && !this.solid(c, r - 1)) {
          g.fillStyle(rim, 1).fillRect(xa, r * TILE + 2.5, xb - xa, 5);
          g.fillStyle(ink, 1).fillRect(xa, r * TILE, xb - xa, 2.5);
        }
        if (e + 1 < H && !this.solid(c, e + 1)) g.fillStyle(ink, 1).fillRect(xa, (e + 1) * TILE - 2.5, xb - xa, 2.5);
        r = e + 1;
      }
    }
  }

  /**
   * Something growing on a trench wall now and then (a face onto the water at wall x, height y,
   * `out` the way it faces: −1 left, 1 right): coral or sea grass sticking out, or a starfish.
   */
  private wallDecor(x: number, y: number, out: number, c: number, k: number) {
    const h = Math.imul(c * 73856093 + k * 19349663, 2654435761) >>> 0;
    if (h % 7 > 1) return;
    const pick = (h >>> 8) % 6;
    const img =
      pick < 3
        ? this.scene.add.image(x, y, 'sea-grass', `g${(h >>> 12) % 4}_${(h >>> 16) % 8}`).setOrigin(0.5, 54 / 56).setRotation((out * Math.PI) / 2).setScale(0.7 / PROP_RES)
        : pick < 5
          ? this.scene.add.image(x, y, 'sea-props', SEA_PROPS[(h >>> 12) % 5]).setOrigin(0.5, 46 / 48).setRotation((out * Math.PI) / 2).setScale(0.8 / PROP_RES)
          : this.scene.add.image(x + out * 4, y, 'sea-props', (h >>> 12) % 2 ? 'star0' : 'star1').setRotation((h % 628) / 100).setScale(0.9 / PROP_RES);
    img.setDepth(DEPTH.tiles + 0.5);
    this.scenery?.push(img);
    if (this.tint !== 0xffffff) img.setTint(this.tint);
  }

  private cell(x: number, y: number): Cell {
    return this.data.cells[y]?.[x] ?? null;
  }

  /**
   * A level's pieces of one kind of terrain: each one's rounded outline and bounds. Working them out
   * (a flood fill and trace over the whole level) is the slow part of putting a level up, and the
   * shapes never change, so it's done once per level and kept (switching Parts on the start screen,
   * and starting a level, then only have to put the pictures up).
   */
  private pieces(kind: TerrainKind) {
    return levelPieces(this.data, kind);
  }

  /** Connected pieces of one kind → one hand-drawn texture each (cached across restarts). */
  private drawTerrain(kind: TerrainKind) {
    const d = this.data;
    this.pieces(kind).forEach(({ outline, x0, y0, x1, y1 }, pieceId) => {
      {
        const pal = this.paletteAt((x0 + x1) / 2);
        // the whole piece is drawn into each chunk (clipped by the chunk's canvas), so the
        // chunks join seamlessly; each one stays small enough for phones and tablets
        for (let cx0 = x0, ci = 0; cx0 < x1; cx0 += CHUNK, ci++) {
          const cw = Math.min(CHUNK, x1 - cx0);
          // each chunk only as tall as the terrain inside it (a mountain is low at one
          // end and high at the other: no point keeping all that empty sky in memory)
          const top = Math.max(y0, localTop(outline, cx0 - PAD, cx0 + cw + PAD) - 24);
          // …and it stops a little below the lowest ground anyone can see from nearby:
          // the deep rock underneath is just a plain block of colour (saves lots of memory)
          const deep = this.deepestSurface(cx0 - 500, cx0 + cw + 500);
          const cut = Math.min(y1 + PAD, Math.max(top + 200, deep + 240));
          // (cut into tiles no taller than CHUNK_V: tall levels have cliff walls hundreds of tiles high)
          for (let cy0 = top, vi = 0; cy0 < cut; cy0 += CHUNK_V, vi++) {
          const first = vi === 0;
          const last = cy0 + CHUNK_V >= cut;
          const cyEnd = last ? cut : cy0 + CHUNK_V;
          // (the first tile has room above for grass blades; the rest overlap the one above by a pixel)
          const ty0 = first ? cy0 - PAD : cy0 - 1;
          const ch = cyEnd - ty0 + (last ? 0 : 1);
          const key = vi === 0 ? `terrain-${d.name}-${kind}-${pieceId}-${ci}` : `terrain-${d.name}-${kind}-${pieceId}-${ci}-${vi}`;
          /** Just the picture (the start screen draws a level's in quiet moments, ahead of Play). */
          const paint = () => {
          if (!this.scene.textures.exists(key)) {
            const c = hires(cw + PAD * 2, ch, TERRAIN_RES, (ctx) => {
              ctx.translate(PAD - cx0, -ty0);
              drawTerrainPiece(ctx, { kind, outline, pal, seed: Math.round(x0 + y0), floorY: this.heightPx, clip: { x0: cx0 - PAD, x1: cx0 + cw + PAD, y0: ty0, y1: cyEnd + (last ? PAD : 1) } });
            });
            if (last && cut < y1 + PAD) {
              // the deep rock is the palette's deep soil colour (no pixel read-back: that stalls the GPU);
              // fade the bottom of the chunk into it so the plain block below is seamless
              const hex = kind === 'ground' ? (pal.sea ? '#a5825c' : pal.soilDeep) : pal.rock.shade;
              const fillCol = Phaser.Display.Color.HexStringToColor(hex).color;
              DEEP_FILL.set(key, fillCol);
              const cctx = c.getContext('2d')!;
              const fadeH = Math.round(90 * TERRAIN_RES);
              const g2 = cctx.createLinearGradient(0, c.height - fadeH, 0, c.height);
              g2.addColorStop(0, hex + '00');
              g2.addColorStop(0.75, hex + 'ff');
              g2.addColorStop(1, hex + 'ff');
              cctx.save();
              cctx.setTransform(1, 0, 0, 1, 0, 0);
              cctx.globalCompositeOperation = 'source-atop';
              cctx.fillStyle = g2;
              cctx.fillRect(0, c.height - fadeH, c.width, fadeH);
              cctx.restore();
            }
            addCanvas(this.scene, key, c, undefined, { release: true });
            return true;
          }
          return false;
          };
          this.paints.push({ key, paint });
          const make = () => {
          paint();
          const fillCol = last ? DEEP_FILL.get(key) : undefined;
          const chunk = this.scene.add
            .image(cx0 - PAD, ty0, key)
            .setOrigin(0, 0)
            .setScale(1 / TERRAIN_RES)
            .setDepth(DEPTH.tiles);
          // (drawn later, in lazy mode: it joins the colour grade too)
          if (this.scenery) {
            this.scenery.push(chunk);
            if (this.tint !== 0xffffff) chunk.setTint(this.tint);
          }
          if (last && cut < y1 + PAD && fillCol !== undefined) {
            // the deep rock: from just above the cut down to the bottom of the level, with
            // the piece's outline continuing down its sides
            // (all of them in one shape: dozens of separate ones cost more to draw every frame)
            this.deepG ??= this.scene.add.graphics().setDepth(DEPTH.tiles - 0.01);
            const g = this.deepG;
            const gx0 = Math.max(cx0, x0 + 3);
            const gx1 = Math.min(cx0 + cw, x1 - 3);
            // (under the sea, with a trench going down through the deep rock: only the solid tiles,
            // an inked edge and a lighter rim along every face onto the water)
            if (this.data.water !== undefined) {
              this.deepRuns(g, kind, fillCol, gx0, gx1, cut - 6);
              return;
            }
            g.fillStyle(fillCol, 1).fillRect(gx0, cut - 6, gx1 - gx0, this.heightPx + 200 - cut);
            g.fillStyle(0x3a2a3a, 1);
            if (gx0 === x0 + 3) g.fillRect(x0 + 1, cut - 6, 2.5, this.heightPx + 200 - cut);
            if (gx1 === x1 - 3) g.fillRect(x1 - 3.5, cut - 6, 2.5, this.heightPx + 200 - cut);
          }
          };
          if (this.lazy && (cx0 + cw < this.lazyNear - this.lazySpan[0] || cx0 > this.lazyNear + this.lazySpan[1])) this.pending.push({ x0: cx0, x1: cx0 + cw, make });
          else make();
          }
        }
      }
    });
  }

  private placeClouds() {
    const d = this.data;
    let n = 0;
    for (let y = 0; y < d.height; y++)
      for (let x = 0; x < d.width; x++) {
        if (this.cell(x, y) !== 'cloud' || this.cell(x - 1, y) === 'cloud') continue;
        let len = 1;
        while (this.cell(x + len, y) === 'cloud') len++;
        const key = `cloud-${d.name}-${n++}`;
        const w = len * TILE;
        if (this.paletteAt(x * TILE).sea) {
          // (under the sea: a wooden pier, its posts down to the sea bed)
          let down = TILE * 2;
          while (y * TILE + down < this.heightPx && !this.isSolidAt(x * TILE + w - 8, y * TILE + down)) down += 8;
          if (!this.scene.textures.exists(key)) addCanvas(this.scene, key, hires(w, down + 14, PROP_RES, (ctx) => drawPier(ctx, w, down + 8)));
          this.scene.add
            .image(x * TILE, y * TILE - 6, key)
            .setOrigin(0, 0)
            .setScale(1 / PROP_RES)
            .setDepth(DEPTH.tiles + 1);
          continue;
        }
        if (!this.scene.textures.exists(key))
          addCanvas(this.scene, key, hires(w + 24, 34, PROP_RES, (ctx) => drawCloudPlatform(ctx, 12, 8, w, DEFAULT_PALETTE, x * 7 + y)));
        this.scene.add
          .image(x * TILE - 12, y * TILE - 8, key)
          .setOrigin(0, 0)
          .setScale(1 / PROP_RES)
          .setDepth(DEPTH.tiles + 1);
      }
  }

  private placeBlocks() {
    const d = this.data;
    for (let y = 0; y < d.height; y++)
      for (let x = 0; x < d.width; x++) {
        const c = this.cell(x, y);
        if (c === 'boulder') {
          const img = this.scene.add
            .image(x * TILE - 2, y * TILE - 2, (x + y) % 2 ? 'boulder' : 'boulder2')
            .setOrigin(0, 0)
            .setScale(1 / PROP_RES)
            .setDepth(DEPTH.tiles + 2);
          this.boulderSprites.set(`${x},${y}`, img);
        } else if (c === 'bramble') {
          this.scene.add
            .image(x * TILE - 2, y * TILE, x % 2 ? 'bramble' : 'bramble2')
            .setOrigin(0, 0)
            .setScale(1 / PROP_RES)
            .setDepth(DEPTH.tiles + 2);
        }
      }
  }

  /** Puff trees from the level file, plus flowers and grass tufts scattered on open grass. */
  private placeDecor() {
    const d = this.data;
    d.spawns
      .filter((s) => s.type === 'tree')
      .forEach((s, i) => {
        const h = Number(s.opts?.h ?? 60);
        const key = `tree-${d.name}-${i}`;
        if (this.paletteAt(s.x * TILE).sea) {
          // (under the sea: a tall strand of kelp, bending to and fro in the current)
          const k = h / KELP_H;
          const img = this.scene.add
            .image(s.x * TILE + TILE / 2, (s.y + 1) * TILE + 4, 'sea-kelp', 'k0')
            .setOrigin(0.5, (KELP_H + 20) / (KELP_H + 24))
            .setScale((0.85 + 0.15 * k) / PROP_RES, k / PROP_RES)
            .setFlipX(i % 2 === 1)
            .setDepth(DEPTH.decor - 0.5);
          this.waving.push({ img, pre: 'k', speed: 0.42 + (i % 3) * 0.06, ph: i * 0.37 });
          return;
        }
        if (!this.scene.textures.exists(key))
          addCanvas(
            this.scene,
            key,
            hires(96, h + 50, PROP_RES, (ctx) =>
              s.opts?.pine ? drawPine(ctx, 48, h + 46, h, this.paletteAt(s.x * TILE), '#ffffff', 100 + i * 13) : drawPuffTree(ctx, 48, h + 46, h, this.paletteAt(s.x * TILE), 100 + i * 13),
            ),
          );
        const img = this.scene.add
          .image(s.x * TILE + TILE / 2, (s.y + 1) * TILE + 4, key)
          .setOrigin(0.5, 1)
          .setScale(1 / PROP_RES)
          .setDepth(DEPTH.decor);
        this.sway.push({ img, amp: 1.3, speed: 0.8 + (i % 3) * 0.12, ph: i * 1.7 });
      });
    const r = rng(1234);
    // (no plants on a court: the crabs' tennis courts keep their ground clear)
    const courts = d.spawns.filter((sp) => sp.type === 'tennis').map((sp) => [sp.x - Number(sp.opts?.w ?? 18) / 2 - 3, sp.x + Number(sp.opts?.w ?? 18) / 2 + 3]);
    for (let x = 1; x < d.width - 1; x++) {
      let y = -1;
      for (let yy = 1; yy < d.height; yy++)
        if (this.cell(x, yy) === 'ground' && !this.cell(x, yy - 1)) {
          y = yy;
          break;
        }
      if (y < 0) continue;
      const wx = x * TILE + TILE / 2 + (r() - 0.5) * 16;
      const wy = y * TILE + 3;
      const roll = r();
      if (this.paletteAt(wx).sea) {
        if (courts.some(([a, b]) => x >= a && x <= b)) continue;
        // under the sea: seaweed that sways, coral, starfish and shells on the sand
        if (roll < 0.17) {
          // sea grass, swaying (each clump a little behind the one before: a wave of current)
          const kind = Math.floor(r() * GRASS_FILLS.length);
          const img = this.scene.add.image(wx, wy + 5, 'sea-grass', `g${kind}_0`).setOrigin(0.5, 54 / 56).setScale((0.75 + r() * 0.45) / PROP_RES).setFlipX(r() < 0.5).setDepth(DEPTH.decor);
          this.waving.push({ img, pre: `g${kind}_`, speed: 0.5 + r() * 0.12, ph: -wx * 0.0011 });
        } else if (roll < 0.29) {
          const f = SEA_PROPS[Math.floor(r() * SEA_PROPS.length)];
          this.scene.add.image(wx, wy + 4, 'sea-props', f).setOrigin(0.5, 46 / 48).setScale((0.75 + r() * 0.35) / PROP_RES).setDepth(DEPTH.decor);
        }
        continue;
      }
      if (this.paletteAt(wx).poo) {
        // Plop Invasion: little poo piles where the flowers were
        if (roll < 0.34) this.scene.add.image(wx, wy + 1, 'poopile', `p${Math.floor(r() * 4)}`).setOrigin(0.5, 1).setScale(1 / PROP_RES).setDepth(DEPTH.decor);
        continue;
      }
      if (this.paletteAt(wx).flowers.length < 2) continue; // no flowers in the snow or on the ice
      if (roll < 0.28) {
        const img = this.scene.add.image(wx, wy, 'flower', `f${Math.floor(r() * 4)}`).setOrigin(0.5, 1).setScale(1 / PROP_RES).setDepth(DEPTH.decor);
        this.sway.push({ img, amp: 7, speed: 1.6 + r() * 0.6, ph: wx * 0.013 });
      } else if (roll < 0.55) {
        const img = this.scene.add.image(wx, wy + 1, 'tuft').setOrigin(0.5, 1).setScale(1 / PROP_RES).setDepth(DEPTH.decor);
        this.sway.push({ img, amp: 6, speed: 2 + r() * 0.6, ph: wx * 0.013 });
      }
    }
  }
}
