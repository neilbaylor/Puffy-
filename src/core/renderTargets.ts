import Phaser from 'phaser';

/**
 * Phaser keeps a handful of screen-sized drawing surfaces on the graphics chip, each a picture the
 * size of the screen plus a depth buffer just as big, re-made at every resize: about 10 MB apiece
 * when playing at 2x on a phone. The game never draws into most of them:
 * - the bitmap masks' two (no bitmap masks anywhere),
 * - the utility pipeline's four "frames" (only post effects like bloom and blur use them: none here).
 * (The pre-effects' ones are never made: `disablePreFX` in the game's config.) Those are shrunk to a
 * pixel and left so. The renderer's own capture target is only used to draw into a RenderTexture
 * (Hoops' lights-out): it's sized when that happens (Phaser sizes it to the texture then anyway),
 * not with the screen.
 */
export function trimRenderTargets(game: Phaser.Game) {
  const r = game.renderer;
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  const unused = [r.maskTarget, r.maskSource, ...(r.pipelines.UTILITY_PIPELINE?.renderTargets ?? [])];
  for (const rt of unused) {
    if (!rt) continue;
    rt.setAutoResize(true);
    rt.resize(1, 1);
    rt.setAutoResize(false);
  }
  // (still `autoResize`, so binding it at a size sizes it — beginCapture does — but no longer
  // following the screen)
  const cap = r.renderTarget;
  r.off('resize', cap.resize, cap);
  cap.resize(1, 1);
}

/** The capture target back to a pixel (a scene that drew into a RenderTexture is gone). */
export function shrinkCaptureTarget(game: Phaser.Game) {
  const r = game.renderer;
  if (r instanceof Phaser.Renderer.WebGL.WebGLRenderer) r.renderTarget.resize(1, 1);
}
