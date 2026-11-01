import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { rng } from '../gfx/draw';
import type { Pt } from '../gfx/handdrawn';
import { PROP_RES, addCanvas, hires } from '../gfx/textures';
import { DEFAULT_PALETTE, drawCloudPlatform, drawPuffTree, drawTerrainPiece, roundPoly, traceCells, type TerrainKind } from '../gfx/world';
import type { Cell, LevelData } from '../level/builder';
import { ONE_WAY_TILES, SOLID_TILES } from '../level/tiles';

const PAD = 34; // room around each terrain piece for grass blades / roots

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

  constructor(
    private scene: Phaser.Scene,
    readonly data: LevelData,
  ) {
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

    this.drawTerrain('ground');
    this.drawTerrain('rock');
    this.placeClouds();
    this.placeBlocks();
    this.placeDecor();
  }

  isSolidAt(worldX: number, worldY: number): boolean {
    const t = this.layer.getTileAtWorldXY(worldX, worldY);
    return !!t && (SOLID_TILES.includes(t.index) || ONE_WAY_TILES.includes(t.index));
  }

  private cell(x: number, y: number): Cell {
    return this.data.cells[y]?.[x] ?? null;
  }

  /** Connected pieces of one kind → one hand-drawn texture each (cached across restarts). */
  private drawTerrain(kind: TerrainKind) {
    const d = this.data;
    const seen = new Set<string>();
    let piece = 0;
    for (let y = 0; y < d.height; y++)
      for (let x = 0; x < d.width; x++) {
        if (this.cell(x, y) !== kind || seen.has(`${x},${y}`)) continue;
        // flood fill one piece
        const cells = new Set<string>();
        const stack: Pt[] = [[x, y]];
        while (stack.length) {
          const [cx, cy] = stack.pop()!;
          const k = `${cx},${cy}`;
          if (seen.has(k) || this.cell(cx, cy) !== kind) continue;
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
        const key = `terrain-${d.name}-${kind}-${piece++}`;
        const w = x1 - x0 + PAD * 2;
        const h = y1 - y0 + PAD * 2;
        if (!this.scene.textures.exists(key)) {
          const c = hires(w, h, PROP_RES, (ctx) => {
            ctx.translate(PAD - x0, PAD - y0);
            drawTerrainPiece(ctx, { kind, outline, pal: DEFAULT_PALETTE, seed: Math.round(x0 + y0), floorY: this.heightPx });
          });
          addCanvas(this.scene, key, c);
        }
        this.scene.add
          .image(x0 - PAD, y0 - PAD, key)
          .setOrigin(0, 0)
          .setScale(1 / PROP_RES)
          .setDepth(DEPTH.tiles);
      }
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
        if (!this.scene.textures.exists(key))
          addCanvas(this.scene, key, hires(96, h + 50, PROP_RES, (ctx) => drawPuffTree(ctx, 48, h + 46, h, DEFAULT_PALETTE, 100 + i * 13)));
        this.scene.add
          .image(s.x * TILE + TILE / 2, (s.y + 1) * TILE + 4, key)
          .setOrigin(0.5, 1)
          .setScale(1 / PROP_RES)
          .setDepth(DEPTH.decor);
      });
    const r = rng(1234);
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
      if (roll < 0.28) this.scene.add.image(wx, wy, 'flower', `f${Math.floor(r() * 4)}`).setOrigin(0.5, 1).setScale(1 / PROP_RES).setDepth(DEPTH.decor);
      else if (roll < 0.55) this.scene.add.image(wx, wy + 1, 'tuft').setOrigin(0.5, 1).setScale(1 / PROP_RES).setDepth(DEPTH.decor);
    }
  }
}
