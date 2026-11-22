import Phaser from 'phaser';

/**
 * Phaser 4 makes a drawing surface's picture (a DynamicTexture: the basketball arena's darkness,
 * 1600 × 900; the jumbotrons' rays; …) on the graphics chip twice: first an empty one the size of
 * it, as for any picture, then the one it really draws into — and swaps the first out without
 * letting it go. So every one made left its own size behind on the graphics chip for good: each
 * boss visit ~7 MB more, round and round (Part 1 → boss → Part 3 → boss → start screen, three
 * times: 304 → 307 → 310 textures, every one a leftover).
 *
 * Here the first one is let go as soon as it's been swapped out (the swap happens straight after,
 * in the same step: by the next moment the surface's picture is the real one).
 */
export function freeSwappedRenderTextures() {
  type Source = { isRenderTexture: boolean; glTexture: unknown; renderer: { gl?: unknown; deleteTexture?(t: unknown): void } | null; init(game: Phaser.Game): void };
  const S = Phaser.Textures.TextureSource.prototype as unknown as Source & { __freeSwapped?: boolean };
  if (S.__freeSwapped) return;
  S.__freeSwapped = true;
  const init = S.init;
  S.init = function (this: Source, game: Phaser.Game) {
    const r = init.call(this, game);
    const renderer = this.renderer;
    if (this.isRenderTexture && renderer?.gl && this.glTexture) {
      const first = this.glTexture;
      queueMicrotask(() => {
        // (still the one in use — a surface that kept it — it stays)
        if (this.glTexture !== first) renderer.deleteTexture?.(first);
      });
    }
    return r;
  };
}
