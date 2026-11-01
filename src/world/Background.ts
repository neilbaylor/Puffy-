import Phaser from 'phaser';
import { DEPTH } from '../config';
import { BG_LAYERS, BG_RES, bgKey } from '../gfx/textures';
import { mixSea, type ThemeId, type ThemeMix } from './theme';

export interface View {
  left: number;
  top: number;
  width: number;
  height: number;
}

type LayerId = 'far' | 'clouds' | 'hills' | 'near';

interface Layer {
  id: LayerId;
  /** The current look, and the next look fading in on top of it. */
  a: Phaser.GameObjects.TileSprite;
  b: Phaser.GameObjects.TileSprite;
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
 *
 * Every layer exists twice: the current look and the next one, laid on top
 * and faded in, so the scenery drifts organically from one look to the next.
 */
export class Background {
  private skyA: Phaser.GameObjects.Image;
  private skyB: Phaser.GameObjects.Image;
  private layers: Layer[] = [];
  private fill: Phaser.GameObjects.Rectangle;
  private themeA: ThemeId = 'puff';
  private themeB: ThemeId = 'puff';

  constructor(
    private scene: Phaser.Scene,
    private lowestViewTop: number,
  ) {
    this.skyA = scene.add.image(0, 0, bgKey('sky', 'puff')).setOrigin(0, 0).setDepth(DEPTH.sky);
    this.skyB = scene.add.image(0, 0, bgKey('sky', 'puff')).setOrigin(0, 0).setDepth(DEPTH.sky).setVisible(false);
    this.add('far', BG_LAYERS.far.h, 0.08, 0.04, 0.3, 0, DEPTH.far);
    this.add('clouds', BG_LAYERS.clouds.h, 0.16, 0.08, 0.02, 5, DEPTH.clouds);
    this.add('hills', BG_LAYERS.hills.h, 0.32, 0.16, 0.42, 0, DEPTH.hills);
    this.add('near', BG_LAYERS.near.h, 0.58, 0.32, 0.68, 0, DEPTH.near);
    this.fill = scene.add.rectangle(0, 0, 10, 10, 0xffffff).setOrigin(0, 0).setDepth(DEPTH.near);
    this.setTheme({ a: 'puff', b: 'puff', w: 0 });
  }

  private add(id: LayerId, h: number, fx: number, fy: number, anchor: number, drift: number, depth: number) {
    const mk = () => {
      const s = this.scene.add.tileSprite(0, 0, 100, h + 4 / BG_RES, bgKey(id, 'puff')).setOrigin(0, 0).setDepth(depth);
      s.setTileScale(1 / BG_RES, 1 / BG_RES);
      return s;
    };
    const a = mk();
    const b = mk().setVisible(false);
    this.layers.push({ id, a, b, fx, fy, anchor, drift, offset: 0, h: h + 4 / BG_RES });
  }

  /** Show look `a`, with look `b` faded in on top by `w`. */
  setTheme(m: ThemeMix) {
    if (m.a !== this.themeA) {
      this.themeA = m.a;
      this.skyA.setTexture(bgKey('sky', m.a));
      for (const l of this.layers) l.a.setTexture(bgKey(l.id, m.a));
    }
    const showB = m.w > 0.001 && m.b !== m.a;
    if (showB && m.b !== this.themeB) {
      this.themeB = m.b;
      this.skyB.setTexture(bgKey('sky', m.b));
      for (const l of this.layers) l.b.setTexture(bgKey(l.id, m.b));
    }
    this.skyB.setVisible(showB).setAlpha(m.w);
    for (const l of this.layers) l.b.setVisible(showB).setAlpha(m.w);
    this.fill.setFillStyle(mixSea(m));
  }

  update(view: View, dt: number) {
    for (const sky of [this.skyA, this.skyB]) sky.setPosition(view.left - 2, view.top - 2).setDisplaySize(view.width + 4, view.height + 4);
    const camUp = this.lowestViewTop - view.top; // how far the camera is above its lowest point
    for (const l of this.layers) {
      l.offset += l.drift * dt;
      const screenY = view.height * l.anchor + camUp * l.fy;
      for (const s of [l.a, l.b]) {
        s.setPosition(view.left - 2, view.top + screenY);
        s.width = view.width + 4;
        s.tilePositionX = (view.left * l.fx + l.offset) * BG_RES;
      }
    }
    // solid fill under the nearest layer so the bottom of the screen is always covered
    const near = this.layers[this.layers.length - 1];
    const fillTop = near.a.y + near.h - 2;
    this.fill.setPosition(view.left - 2, fillTop);
    this.fill.setSize(view.width + 4, Math.max(0, view.top + view.height - fillTop + 4));
  }
}
