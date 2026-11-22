import Phaser from 'phaser';

/**
 * A camera's fade (or flash) is a colour laid over the whole screen. Phaser keeps drawing a fade
 * once it's over — so that a fade *out* stays dark — but it does that after a fade *in* too, when
 * the colour is wholly see-through: a screenful of nothing, blended into every pixel, every frame,
 * for as long as the scene runs. Every level starts with a fade in (and the start screen does one
 * on each switch of Part), so that was an extra whole screen for the graphics chip all game long.
 *
 * Here a fade or flash isn't drawn while it's too faint to change a pixel: the colour's
 * see-through-ness is handed to the graphics chip as a whole number out of 255, and below 1 that's
 * 0 — nothing to see. A fade out, or one part-way, is drawn as before.
 */
export function skipClearCameraFills() {
  type Effect = { alpha: number; postRenderWebGL(): boolean; __clearSkip?: boolean };
  const E = Phaser.Cameras.Scene2D.Effects;
  for (const C of [E.Fade, E.Flash]) {
    const P = C.prototype as unknown as Effect;
    if (P.__clearSkip) continue;
    P.__clearSkip = true;
    const draws = P.postRenderWebGL;
    P.postRenderWebGL = function (this: Effect) {
      return draws.call(this) && this.alpha * 255 >= 1;
    };
  }
}
