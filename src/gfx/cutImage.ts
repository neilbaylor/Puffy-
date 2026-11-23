import Phaser from 'phaser';

/**
 * One picture, shown as a strip of triangles round just its outline instead of its whole box: the
 * same picture in the same place, but the graphics chip only works through the outline, not the
 * see-through rest of the box. `rows`: the outline as [y, x0, x1] (picture px, top to bottom, one
 * row per bend in it); `ox`, `oy`: the origin, a share of the picture's width and height, as an
 * image's. It turns, sizes and fades like an image (it's a Rope with its corners set by hand).
 *
 * Each triangle shares its edges exactly with the next (no cracks, nothing drawn twice: a picture
 * that's added on would show a seam), and maps the picture onto the screen just as the whole box
 * did. The outline must hold every pixel with anything in it, plus a couple round them (the chip
 * blends each pixel on screen from its neighbours in the picture), and stay inside the box.
 */
export function outlineImage(scene: Phaser.Scene, x: number, y: number, key: string, rows: readonly (readonly [number, number, number])[], ox: number, oy: number): Phaser.GameObjects.Rope {
  const fr = scene.textures.getFrame(key);
  const W = fr.realWidth;
  const H = fr.realHeight;
  const rope = scene.add.rope(x, y, key, undefined, rows.map(([ry]) => new Phaser.Math.Vector2(0, ry)), false);
  const v = rope.vertices;
  const uv = rope.uv;
  // (the frame's own corners in the texture: an upright canvas's run bottom to top, see uprightUploads)
  const U = (px: number) => fr.u0 + ((fr.u1 - fr.u0) * px) / W;
  const V = (py: number) => fr.v0 + ((fr.v1 - fr.v0) * py) / H;
  rows.forEach(([ry, x0, x1], i) => {
    v[i * 4] = x0 - ox * W;
    v[i * 4 + 1] = ry - oy * H;
    v[i * 4 + 2] = x1 - ox * W;
    v[i * 4 + 3] = ry - oy * H;
    uv[i * 4] = U(x0);
    uv[i * 4 + 1] = V(ry);
    uv[i * 4 + 2] = U(x1);
    uv[i * 4 + 3] = V(ry);
  });
  rope.dirty = false;
  return rope;
}

/** A box of a picture, [x0, y0, x1, y1] (picture px). */
export type Hole = readonly [number, number, number, number];

/**
 * A big still picture (top-left origin) that other pictures drawn over it always hide in places
 * (solid, never see-through, never moved, faded or hidden), shown as the cells of a grid cut along
 * the edges of those places (`holes`), without the cells inside them: the graphics chip used to work
 * through every pixel of it only to have them painted over.
 *
 * A grid, all the way across and down, so that every cell shares whole edges with its neighbours:
 * cells that met partway along an edge could leave a pixel uncovered between them now and then as
 * the camera turns. Each hole is shrunk to whole pixels inside it (a little more is drawn, never
 * less); the holes must be inside what hides them by a pixel or two (the graphics chip blends each
 * pixel on screen from its neighbours in the picture, so the edge of something solid isn't quite).
 */
export function holedImage(scene: Phaser.Scene, x: number, y: number, key: string, holes: readonly Hole[]): Phaser.GameObjects.Image[] {
  const fr = scene.textures.getFrame(key);
  const W = fr.realWidth;
  const H = fr.realHeight;
  const hs = holes
    .map(([x0, y0, x1, y1]) => [Math.max(0, Math.ceil(x0)), Math.max(0, Math.ceil(y0)), Math.min(W, Math.floor(x1)), Math.min(H, Math.floor(y1))] as const)
    .filter(([x0, y0, x1, y1]) => x1 > x0 && y1 > y0);
  const cuts = (n: number, i: 0 | 1) => [...new Set([0, n, ...hs.flatMap((h) => [h[i], h[i + 2]])])].sort((a, b) => a - b);
  const xs = cuts(W, 0);
  const ys = cuts(H, 1);
  const out: Phaser.GameObjects.Image[] = [];
  for (let r = 0; r + 1 < ys.length; r++)
    for (let c = 0; c + 1 < xs.length; c++) {
      const [cx0, cx1, cy0, cy1] = [xs[c], xs[c + 1], ys[r], ys[r + 1]];
      if (hs.some(([x0, y0, x1, y1]) => cx0 >= x0 && cx1 <= x1 && cy0 >= y0 && cy1 <= y1)) continue;
      out.push(scene.add.image(x, y, key).setOrigin(0, 0).setCrop(cx0, cy0, cx1 - cx0, cy1 - cy0));
    }
  return out;
}
