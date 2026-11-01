import Phaser from 'phaser';
import { DEPTH } from '../config';
import { BG_LAYERS, BG_RES } from '../gfx/textures';
import { DEFAULT_PALETTE, seaColor } from '../gfx/world';

export interface View {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Layer {
  sprite: Phaser.GameObjects.TileSprite;
  /** Horizontal parallax factor: 0 = fixed to screen, 1 = moves with the world. */
  fx: number;
  /** Vertical parallax factor. */
  fy: number;
  /** Where the layer's top sits on screen (fraction of view height) when the camera is at its lowest. */
  anchor: number;
  /** Ambient horizontal drift, world px/s (clouds). */
  drift: number;
  offset: number;
  h: number;
}

/**
 * Hand-drawn parallax background for Puff Ball Planet: sky, far floating
 * islands, puffy clouds, rolling hills, and a sea of clouds far below. Layers are TileSprites
 * re-positioned every frame to cover the camera view at any zoom.
 */
export class Background {
  private sky: Phaser.GameObjects.Image;
  private layers: Layer[] = [];
  private fill: Phaser.GameObjects.Rectangle;

  constructor(
    private scene: Phaser.Scene,
    private lowestViewTop: number,
  ) {
    this.sky = scene.add.image(0, 0, 'bg-sky').setOrigin(0, 0).setDepth(DEPTH.sky);
    this.add('bg-far', BG_LAYERS.far.h, 0.08, 0.04, 0.3, 0, DEPTH.far);
    this.add('bg-clouds', BG_LAYERS.clouds.h, 0.16, 0.08, 0.02, 5, DEPTH.clouds);
    this.add('bg-hills', BG_LAYERS.hills.h, 0.32, 0.16, 0.42, 0, DEPTH.hills);
    this.add('bg-near', BG_LAYERS.near.h, 0.58, 0.32, 0.68, 0, DEPTH.near);
    this.fill = scene.add
      .rectangle(0, 0, 10, 10, Phaser.Display.Color.HexStringToColor(seaColor(DEFAULT_PALETTE)).color)
      .setOrigin(0, 0)
      .setDepth(DEPTH.near);
  }

  private add(key: string, h: number, fx: number, fy: number, anchor: number, drift: number, depth: number) {
    const sprite = this.scene.add.tileSprite(0, 0, 100, h + 4 / BG_RES, key).setOrigin(0, 0).setDepth(depth);
    sprite.setTileScale(1 / BG_RES, 1 / BG_RES);
    this.layers.push({ sprite, fx, fy, anchor, drift, offset: 0, h: h + 4 / BG_RES });
  }

  update(view: View, dt: number) {
    this.sky.setPosition(view.left - 2, view.top - 2).setDisplaySize(view.width + 4, view.height + 4);
    const camUp = this.lowestViewTop - view.top; // how far the camera is above its lowest point
    for (const l of this.layers) {
      l.offset += l.drift * dt;
      const screenY = view.height * l.anchor + camUp * l.fy;
      l.sprite.setPosition(view.left - 2, view.top + screenY);
      l.sprite.width = view.width + 4;
      l.sprite.tilePositionX = (view.left * l.fx + l.offset) * BG_RES;
    }
    // solid fill under the nearest layer so the bottom of the screen is always covered
    const near = this.layers[this.layers.length - 1];
    const fillTop = near.sprite.y + near.h - 2;
    this.fill.setPosition(view.left - 2, fillTop);
    this.fill.setSize(view.width + 4, Math.max(0, view.top + view.height - fillTop + 4));
  }
}
