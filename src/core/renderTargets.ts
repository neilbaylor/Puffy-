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
  // (and no depth buffer: drawing into a RenderTexture never depth-tests, nor uses the stencil
  // without a mask; it's re-made without one from here on)
  (cap as { hasDepthBuffer: boolean }).hasDepthBuffer = false;
  cap.resize(1, 1);
}

/**
 * A RenderTexture's own surface without its depth buffer (Phaser gives every surface one, as big as
 * the picture; drawing into it never uses one here: no masks).
 */
export function dropDepthBuffer(game: Phaser.Game, rt: Phaser.Renderer.WebGL.RenderTarget | null | undefined) {
  const r = game.renderer;
  const fb = rt?.framebuffer;
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer) || !rt || !fb?.webGLFramebuffer) return;
  const gl = r.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb.webGLFramebuffer);
  const ds = gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME) as WebGLRenderbuffer | null;
  if (ds) {
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, null);
    gl.deleteRenderbuffer(ds);
  }
  // (back to whatever Phaser has bound)
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.currentFramebuffer?.webGLFramebuffer ?? null);
  (rt as { hasDepthBuffer: boolean }).hasDepthBuffer = false;
  (fb as unknown as { addDepthStencilBuffer: boolean }).addDepthStencilBuffer = false;
}

/** The capture target back to a pixel (a scene that drew into a RenderTexture is gone). */
export function shrinkCaptureTarget(game: Phaser.Game) {
  const r = game.renderer;
  if (r instanceof Phaser.Renderer.WebGL.WebGLRenderer) r.renderTarget.resize(1, 1);
}
