import Phaser from 'phaser';
import { addCanvas } from './textures';

/**
 * Little pictures for things that used to be drawn as shapes every frame (a Giant's health pips, the
 * stamina meter, a puddle's bubbles): a shape is cut into triangles all over again each frame it's
 * drawn; a picture is just shown. Made once (w × h world px, at `res` × for the zoomed-in camera).
 */
export function smallTex(scene: Phaser.Scene, key: string, w: number, h: number, res: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return key;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * res);
  cv.height = Math.ceil(h * res);
  const ctx = cv.getContext('2d')!;
  ctx.scale(res, res);
  draw(ctx);
  addCanvas(scene, key, cv);
  return key;
}

/** A rounded rectangle path (r: corner radius). */
export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export const hexCss = (n: number, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
