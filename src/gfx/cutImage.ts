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
