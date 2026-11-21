import Phaser from 'phaser';

/**
 * Phaser 4 sends every picture to the graphics chip upside down (WebGL's "flip Y" upload: the
 * chip's own drawing surfaces are bottom-up, so Phaser keeps everything that way) and works out
 * which corner is which accordingly. For a picture drawn here — all the game's art is drawn into
 * canvases — being turned over on the way costs about as much again as sending it (measured
 * ~2.2× for a jumbotron-sized canvas; start-up spent 3.7 s of 10.5 s sending pictures at 4× slow
 * CPU). Canvases marked with `upright` go up as they are, and their frames' corners are read the
 * other way up to match. Everything else (Phaser's own Text canvases, render textures) is as before.
 */
const marked = new WeakSet<HTMLCanvasElement>();

/** Send this canvas to the graphics chip as it is (see above). Call before it's made a texture. */
export function upright<C extends HTMLCanvasElement>(c: C): C {
  marked.add(c);
  return c;
}

export function installUprightUploads() {
  type Source = { isCanvas: boolean; image: unknown; flipY: boolean; init(game: Phaser.Game): void };
  type Frame = { source: Source; v0: number; v1: number };
  type Crop = { v0: number; v1: number };
  const S = Phaser.Textures.TextureSource.prototype as unknown as Source & { __upright?: boolean };
  if (S.__upright) return;
  S.__upright = true;
  // (the source is told before its first upload: it uploads in init, and again on each refresh with the same setting)
  const init = S.init;
  S.init = function (this: Source, game: Phaser.Game) {
    if (this.isCanvas && marked.has(this.image as HTMLCanvasElement)) this.flipY = false;
    return init.call(this, game);
  };
  // A frame's top and bottom (v) are worked out as for an upside-down picture; for an upright one
  // they're the other way round. Phaser's own code everywhere else goes from a frame's v0 (its top)
  // towards v1 (its bottom), so that's all that needs to change.
  const F = Phaser.Textures.Frame.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const name of ['updateUVs', 'updateUVsInverted']) {
    const o = F[name];
    F[name] = function (this: Frame, ...a: unknown[]) {
      const r = o.apply(this, a);
      if (this.source && !this.source.flipY) {
        this.v0 = 1 - this.v0;
        this.v1 = 1 - this.v1;
      }
      return r;
    };
  }
  const crop = F.setCropUVs;
  F.setCropUVs = function (this: Frame, c: unknown, ...a: unknown[]) {
    const r = crop.call(this, c, ...a);
    if (this.source && !this.source.flipY) {
      const cr = c as Crop;
      cr.v0 = 1 - cr.v0;
      cr.v1 = 1 - cr.v1;
    }
    return r;
  };
}
