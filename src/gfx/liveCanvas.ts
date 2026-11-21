import Phaser from 'phaser';
import { upright } from '../core/uprightUploads';

/**
 * A picture that's redrawn now and then (a cloud, a jumbotron): Phaser's CanvasTexture, less the
 * copy of all its pixels Phaser reads back when it's made. That copy is only for getPixel (and
 * its like), which nothing here uses, and it goes stale at the first redraw anyway.
 */
export function liveCanvas(textures: Phaser.Textures.TextureManager, key: string, w: number, h: number): Phaser.Textures.CanvasTexture {
  if (textures.exists(key)) return textures.get(key) as Phaser.Textures.CanvasTexture;
  // (our own canvas, not one from Phaser's pool, so it can go to the graphics chip the right way up: see uprightUploads)
  const c = upright(document.createElement('canvas'));
  c.width = w;
  c.height = h;
  const t = textures.addCanvas(key, c)!;
  const copy = t as unknown as { imageData: ImageData | null; data: Uint8ClampedArray | null; pixels: Uint32Array | null; buffer: ArrayBuffer | null };
  copy.imageData = null;
  copy.data = null;
  copy.pixels = null;
  copy.buffer = null;
  return t;
}
