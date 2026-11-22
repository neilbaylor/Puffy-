import Phaser from 'phaser';

/**
 * Phaser 4 makes each of its shaders the first time something needs it, and making one stops the
 * game until the graphics chip has it ready: a hitch, on a phone tens of ms each.
 *
 * Since every run of pictures uses one texture (main.ts, oneTexturePerBatch), the game only ever
 * draws with five shaders: pictures, shapes and strips, all three made in the loading screen's
 * first frames anyway, and two kinds of repeating picture (a TileSprite) that were only made on
 * first use — mid-game: one when the first level's ground or the start screen's next Part came up
 * (tiles cut to their frame), the other when the fishing contest started (its waves, wrapping).
 * Those two are made here, as the game starts, behind the loading screen.
 *
 * Where the chip can get shaders ready in the background (KHR_parallel_shader_compile) they're
 * handed to it without waiting, and each is picked up the first time it's needed (by then long
 * ready); elsewhere they're made on the spot — two shaders, a few ms, while the loading bar is up.
 * (Before, all 16 texture-count versions of the picture shader were warmed here, but only on chips
 * with background compiling: with one texture a run, only the first of them is ever used, and the
 * two used mid-game weren't among them.)
 */
export function warmBatchShaders(game: Phaser.Game) {
  // (it leans on Phaser's insides: should they change, the game just starts without it)
  try {
    warm(game);
  } catch {
    /* nothing warmed */
  }
}

type Addition = { name: string; disable?: boolean };
type Config = { base: unknown; additions: Addition[]; features: unknown };
type Program = { compiling: boolean; __warm?: boolean; _completeProgram(): void; checkParallelCompile(): void };
type Handler = { finalizeTextureCount(n: number): void; programManager: { currentConfig: Config } };
type Renderer = { gl?: WebGLRenderingContext; renderNodes?: { getNode(name: string): Handler | undefined }; shaderProgramFactory?: { getShaderProgram(base: unknown, additions: unknown, features: unknown): Program } };

/** The shader variants the game draws with: a batch handler, and which of its optional parts are on. */
const VARIANTS: { node: string; on: string[]; off: string[] }[] = [
  // pictures (images, sprites — nearly everything)
  { node: 'BatchHandlerQuad', on: [], off: [] },
  // a TileSprite (the fishing contest's waves): its picture repeats across it
  { node: 'BatchHandlerTileSprite', on: ['TexCoordFrameWrap'], off: ['TexCoordFrameClamp', 'GetTexRes'] },
  // a tile of a tile layer: kept inside its own frame
  { node: 'BatchHandlerTileSprite', on: ['TexCoordFrameClamp', 'GetTexRes'], off: ['TexCoordFrameWrap'] },
];

function warm(game: Phaser.Game) {
  const r = game.renderer as unknown as Renderer;
  const factory = r.shaderProgramFactory;
  if (!r.gl || !factory || !r.renderNodes) return;
  const parallel = !!r.gl.getExtension('KHR_parallel_shader_compile');
  if (parallel) {
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
  }
  const config = game.config as unknown as { skipUnreadyShaders: boolean };
  const skip = config.skipUnreadyShaders;
  // (while this is set, Phaser hands a shader over without waiting for it)
  if (parallel) config.skipUnreadyShaders = true;
  try {
    for (const v of VARIANTS) {
      const handler = r.renderNodes.getNode(v.node);
      if (!handler?.finalizeTextureCount) continue;
      handler.finalizeTextureCount(1);
      const c = handler.programManager.currentConfig;
      // (the optional parts switched as a draw would switch them, and put back as they were)
      const was = c.additions.map((a) => a.disable);
      try {
        for (const a of c.additions) {
          if (v.on.includes(a.name)) a.disable = false;
          else if (v.off.includes(a.name)) a.disable = true;
        }
        const program = factory.getShaderProgram(c.base, c.additions, c.features);
        if (program.compiling) program.__warm = true;
      } finally {
        c.additions.forEach((a, i) => (a.disable = was[i]));
      }
    }
  } finally {
    config.skipUnreadyShaders = skip;
  }
}
