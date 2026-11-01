import Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { rng } from '../gfx/draw';
import type { LevelData } from '../level/builder';
import { ONE_WAY_TILES, SOLID_TILES, T } from '../level/tiles';

/**
 * Builds the visual + collision tilemap for a level, plus non-interactive
 * scenery. Shared by the menu (as an animated backdrop) and the game.
 */
export class LevelView {
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly layer: Phaser.Tilemaps.TilemapLayer;
  readonly widthPx: number;
  readonly heightPx: number;

  constructor(
    private scene: Phaser.Scene,
    readonly data: LevelData,
  ) {
    this.map = scene.make.tilemap({
      data: data.tiles.map((r) => [...r]),
      tileWidth: TILE,
      tileHeight: TILE,
    });
    const tileset = this.map.addTilesetImage('tiles', 'tiles', TILE, TILE, 1, 2)!;
    this.layer = this.map.createLayer(0, tileset, 0, 0)!.setDepth(DEPTH.tiles);
    this.layer.setCollision(SOLID_TILES);
    this.layer.forEachTile((t) => {
      if (ONE_WAY_TILES.includes(t.index)) t.setCollision(false, false, true, false, false);
    });
    this.layer.calculateFacesWithin(0, 0, this.map.width, this.map.height);
    this.widthPx = data.width * TILE;
    this.heightPx = data.height * TILE;
    this.placeDecor();
  }

  isSolidAt(worldX: number, worldY: number): boolean {
    const t = this.layer.getTileAtWorldXY(worldX, worldY);
    return !!t && (SOLID_TILES.includes(t.index) || ONE_WAY_TILES.includes(t.index));
  }

  /** Scatter bushes, flowers, palms and tufts on open grass, deterministically. */
  private placeDecor() {
    const r = rng(1234);
    const d = this.data;
    const isGrass = (i: number) => i >= T.GRASS && i <= T.GRASS_LR;
    const occupied = new Set<number>();
    for (const s of d.spawns) occupied.add(s.x);

    let lastBig = -10;
    for (let x = 1; x < d.width - 1; x++) {
      // find the top grass tile in this column
      let y = -1;
      for (let yy = 0; yy < d.height; yy++)
        if (isGrass(d.tiles[yy][x])) {
          y = yy;
          break;
        }
      if (y < 1) continue;
      if (d.tiles[y - 1][x] !== T.EMPTY) continue;
      const wx = x * TILE + TILE / 2;
      const wy = y * TILE + 2;
      const roll = r();
      const flatRun =
        isGrass(d.tiles[y][x - 1]) && isGrass(d.tiles[y][x + 1]) && d.tiles[y - 1][x - 1] === T.EMPTY && d.tiles[y - 1][x + 1] === T.EMPTY;
      if (flatRun && roll < 0.07 && x - lastBig > 8 && !occupied.has(x)) {
        this.scene.add.image(wx, wy + 2, 'palm').setOrigin(0.5, 1).setDepth(DEPTH.decor);
        lastBig = x;
      } else if (flatRun && roll < 0.2 && x - lastBig > 4) {
        this.scene.add.image(wx, wy + 2, 'bush').setOrigin(0.5, 1).setDepth(DEPTH.decor);
        lastBig = x;
      } else if (roll < 0.42) {
        this.scene.add
          .image(wx + (r() - 0.5) * 16, wy + 2, 'flower', r() > 0.5 ? 'f0' : 'f1')
          .setOrigin(0.5, 1)
          .setDepth(DEPTH.decor);
      } else if (roll < 0.7) {
        this.scene.add.image(wx + (r() - 0.5) * 16, wy + 1, 'tuft').setOrigin(0.5, 1).setDepth(DEPTH.decor);
      }
    }
    // a signpost near the start
    const spawn = d.spawns.find((s) => s.type === 'player');
    if (spawn) {
      this.scene.add
        .image((spawn.x + 4) * TILE, (spawn.y + 1) * TILE + 2, 'sign')
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.decor);
    }
  }
}
