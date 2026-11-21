// In the browser: the heavy hand-drawn art drawn onto real canvases (every hero pose and face onto a hero
// sheet, every Part's ground and rock pieces, the background layers in each palette). For each: the time
// (median of 5) and a hash of the pixels, to compare two copies of the code (imports via "@src").
import { CHARACTERS } from '@src/data/characters';
import { drawCharacter, POSES } from '@src/gfx/draw';
import { FACE_FRAMES, faceFromKey } from '@src/gfx/face';
import { drawTerrainPiece, drawFarLayer, drawHillsLayer, drawNearLayer, drawCloudLayer, PALETTES } from '@src/gfx/world';
import { levelPieces } from '@src/world/LevelView';
import { buildLevel1 } from '@src/level/level1';
import { buildLevel2 } from '@src/level/level2';
import { buildLevel3 } from '@src/level/level3';
import { buildLevel4 } from '@src/level/level4';
import { buildLevel5 } from '@src/level/level5';
import { buildLevel6 } from '@src/level/level6';

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d', { willReadFrequently: false })!;
};
const hashOf = (ctx: CanvasRenderingContext2D) => {
  const d = new Uint32Array(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data.buffer);
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619);
  return (h >>> 0).toString(16);
};
const levels = [buildLevel1, buildLevel2, buildLevel3, buildLevel4, buildLevel5, buildLevel6].map((b) => b());
const pal0 = PALETTES[Object.keys(PALETTES)[0]];
const work: Record<string, () => CanvasRenderingContext2D[]> = {
  heroes: () =>
    CHARACTERS.map((ch) => {
      const ctx = mk(2600, 2 * 72 * 2.5);
      ctx.scale(2.5, 2.5);
      [...POSES.map((p) => [p, undefined] as const), ...FACE_FRAMES.map((f) => ['idle0', faceFromKey(f)] as const)].forEach(([pose, f], i) => {
        ctx.save();
        ctx.translate((i % 28) * 37, Math.floor(i / 28) * 72);
        drawCharacter(ctx, 8, 0, ch, pose as never, f, '');
        ctx.restore();
      });
      return ctx;
    }),
  terrain: () =>
    levels.map((d) => {
      const ctx = mk(2048, 1024);
      ctx.scale(2048 / (d.width * 32), 1024 / (d.height * 32));
      let i = 0;
      for (const kind of ['ground', 'rock'] as const) for (const p of levelPieces(d, kind)) drawTerrainPiece(ctx, { kind, outline: p.outline, pal: pal0, seed: 1000 + i++, floorY: d.height * 32 });
      return ctx;
    }),
  layers: () =>
    Object.values(PALETTES).flatMap((pal) =>
      [drawFarLayer, drawCloudLayer, drawHillsLayer, drawNearLayer].map((f) => {
        const ctx = mk(1024, 512);
        try {
          f(ctx as never, 1024, 512, pal);
        } catch {
          /* (a palette without that layer) */
        }
        return ctx;
      }),
    ),
};
(window as unknown as { __bench: () => Record<string, string> }).__bench = () => {
  const out: Record<string, string> = {};
  for (const [name, f] of Object.entries(work)) {
    let ctxs: CanvasRenderingContext2D[] = [];
    const ts: number[] = [];
    for (let k = 0; k < 5; k++) {
      const t0 = performance.now();
      ctxs = f();
      // (drawn for real: a pixel read waits for every canvas to finish)
      for (const c of ctxs) c.getImageData(0, 0, 1, 1);
      ts.push(performance.now() - t0);
    }
    ts.sort((a, b) => a - b);
    out[name] = `${ts[2].toFixed(0)} ms, pixels ${ctxs.map(hashOf).join('')}`.slice(0, 60);
  }
  return out;
};
