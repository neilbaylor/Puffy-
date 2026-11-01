import Phaser from 'phaser';
import { DEPTH } from '../config';
import { THEME } from '../gfx/textures';

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
  /** Where the layer's top sits on screen (fraction of view height) when the camera is at the bottom of the level. */
  anchor: number;
  /** Ambient horizontal drift, px/s (clouds). */
  drift: number;
  offset: number;
}

/**
 * Parallax background. Layers are TileSprites re-positioned every frame to
 * cover the camera view, which works with any camera zoom.
 */
export class Background {
  private sky: Phaser.GameObjects.Image;
  private layers: Layer[] = [];
  private fill: Phaser.GameObjects.Rectangle;

  constructor(
    private scene: Phaser.Scene,
    private levelBottomViewTop: number,
  ) {
    this.sky = scene.add.image(0, 0, 'bg-sky').setOrigin(0, 0).setDepth(DEPTH.sky);
    this.add('bg-far', 0.1, 0.05, 0.3, 0, DEPTH.far);
    this.add('bg-clouds', 0.18, 0.08, 0.02, 6, DEPTH.clouds);
    this.add('bg-hills', 0.35, 0.18, 0.42, 0, DEPTH.hills);
    this.add('bg-near', 0.6, 0.35, 0.66, 0, DEPTH.near);
    this.fill = scene.add
      .rectangle(0, 0, 10, 10, Phaser.Display.Color.HexStringToColor(THEME.nearB).color)
      .setOrigin(0, 0)
      .setDepth(DEPTH.near);
  }

  private add(key: string, fx: number, fy: number, anchor: number, drift: number, depth: number) {
    const src = this.scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
    const sprite = this.scene.add.tileSprite(0, 0, 100, src.height, key).setOrigin(0, 0).setDepth(depth);
    this.layers.push({ sprite, fx, fy, anchor, drift, offset: 0 });
  }

  update(view: View, dt: number) {
    this.sky.setPosition(view.left - 2, view.top - 2).setDisplaySize(view.width + 4, view.height + 4);
    const camDown = this.levelBottomViewTop - view.top; // how far the camera is above its lowest point
    for (const l of this.layers) {
      l.offset += l.drift * dt;
      const screenY = view.height * l.anchor + camDown * l.fy;
      l.sprite.setPosition(view.left - 2, view.top + screenY);
      l.sprite.width = view.width + 4;
      l.sprite.tilePositionX = view.left * l.fx + l.offset;
    }
    // solid fill under the nearest layer so the bottom of the screen is always covered
    const near = this.layers[this.layers.length - 1].sprite;
    const fillTop = near.y + near.height - 2;
    this.fill.setPosition(view.left - 2, fillTop);
    this.fill.setSize(view.width + 4, Math.max(0, view.top + view.height - fillTop + 4));
  }
}
