import Phaser from 'phaser';

/**
 * Phaser 4 draws a run of pictures with a shader made for exactly the number of textures in that
 * run (one shader for 3, another for 4, … up to the graphics chip's limit, 16 on most), and makes
 * each the first time a run needs it. So new ones were being made mid-game — 6 while a level loads,
 * 1–3 more once you're playing (a new effect on screen, a bad guy coming into view) — and making
 * one stops the game until the graphics chip has it ready: a hitch, on a phone tens of ms each.
 *
 * Here, as the game starts, all of them are handed to the graphics chip at once without waiting for
 * any: it gets them ready in its own time, while the start screen's art is being drawn. Each one is
 * then picked up the first time it's needed (by then long ready). Only the shader for pictures
 * (images, sprites — nearly everything) is done; the others are seldom needed with many textures.
 */
export function warmBatchShaders(game: Phaser.Game) {
  // (it leans on Phaser's insides: should they change, the game just starts without it)
  try {
    warm(game);
  } catch {
    /* nothing warmed */
  }
}

function warm(game: Phaser.Game) {
  type Program = { compiling: boolean; __warm?: boolean; _completeProgram(): void; checkParallelCompile(): void };
  type Handler = { maxTexturesPerBatch: number; finalizeTextureCount(n: number): void; programManager: { currentConfig: { base: unknown; additions: unknown; features: unknown } } };
  type Renderer = { gl?: WebGLRenderingContext; renderNodes?: { getNode(name: string): Handler | undefined }; shaderProgramFactory?: { getShaderProgram(base: unknown, additions: unknown, features: unknown): Program } };
  const r = game.renderer as unknown as Renderer;
  const factory = r.shaderProgramFactory;
  const handler = r.renderNodes?.getNode('BatchHandlerQuad');
  if (!r.gl || !factory || !handler?.finalizeTextureCount) return;
  // (only where the chip can get shaders ready in the background: elsewhere each would be made on
  // the spot, all 16 at once — a longer start, mostly for counts the game never draws with)
  if (!r.gl.getExtension('KHR_parallel_shader_compile')) return;
  const P = (Phaser.Renderer.WebGL.Wrappers.WebGLProgramWrapper.prototype as unknown) as Program & { __warmPatched?: boolean };
  if (!P.__warmPatched) {
    P.__warmPatched = true;
    // (Phaser would skip drawing with a shader it's told is still being made: one of these is
    // finished on the spot instead — waiting for the chip only if it isn't ready yet)
    const check = P.checkParallelCompile;
    P.checkParallelCompile = function (this: Program) {
      if (this.__warm && this.compiling) this._completeProgram();
      else check.call(this);
    };
  }
  const config = game.config as unknown as { skipUnreadyShaders: boolean };
  const skip = config.skipUnreadyShaders;
  // (while this is set, Phaser hands a shader over without waiting for it)
  config.skipUnreadyShaders = true;
  try {
    for (let n = 1; n <= handler.maxTexturesPerBatch; n++) {
      handler.finalizeTextureCount(n);
      const c = handler.programManager.currentConfig;
      const program = factory.getShaderProgram(c.base, c.additions, c.features);
      if (program.compiling) program.__warm = true;
    }
  } finally {
    config.skipUnreadyShaders = skip;
  }
}
