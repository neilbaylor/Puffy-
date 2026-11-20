// The hand-drawn art's JavaScript: every hero in every pose and face, every Part's ground and rock pieces,
// the background layers in every palette — drawn onto (1) a canvas that records every call and argument
// (a hash: is the drawing exactly the same?) and (2) a canvas that does nothing (how long the code itself takes).
// Imports go through "@src" (esbuild alias), so the same file measures two copies of the code.
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

// (a recording 2D context: every method call and property set, with its arguments, folded into a hash)
let h1 = 0x811c9dc5 | 0;
let calls = 0;
const mix = (s: string) => {
  for (let i = 0; i < s.length; i++) h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619);
};
const arg = (a: unknown): string => (typeof a === 'number' ? a.toPrecision(15) : typeof a === 'string' ? a : a && typeof a === 'object' && 'kind' in (a as object) ? (a as { kind: string }).kind : Array.isArray(a) ? `[${a.map(arg).join(',')}]` : String(typeof a));
const grad = () => ({ kind: 'grad', addColorStop: (o: number, c: string) => { calls++; mix(`stop${arg(o)}${c}`); } });
const rec: any = new Proxy({}, {
  get: (_t, k: string) => {
    if (k === 'canvas') return { width: 4096, height: 4096 };
    if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return (...a: unknown[]) => { calls++; mix(k + a.map(arg).join(',')); return grad(); };
    if (k === 'measureText') return (t: string) => ({ width: t.length * 7 });
    if (k === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    if (k === 'getImageData') return (_x: number, _y: number, w: number, hh: number) => ({ data: new Uint8ClampedArray(w * hh * 4), width: w, height: hh });
    return (...a: unknown[]) => { calls++; mix(k + '(' + a.map(arg).join(',') + ')'); };
  },
  set: (_t, k: string, v: unknown) => { calls++; mix(k + '=' + arg(v)); return true; },
});
// (a context that does nothing: what's left is the art code's own time)
const noop: any = new Proxy({}, {
  get: (_t, k: string) => (k === 'canvas' ? { width: 4096, height: 4096 } : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop() {} }) : k === 'measureText' ? (t: string) => ({ width: t.length * 7 }) : k === 'getTransform' ? () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) : k === 'getImageData' ? (_x: number, _y: number, w: number, hh: number) => ({ data: new Uint8ClampedArray(w * hh * 4) }) : () => {}),
  set: () => true,
});

const levels = [buildLevel1, buildLevel2, buildLevel3, buildLevel4, buildLevel5, buildLevel6].map((b) => b());
const pieces = levels.flatMap((d) => (['ground', 'rock'] as const).flatMap((kind) => levelPieces(d, kind).map((p) => ({ kind, p, pal: PALETTES[Object.keys(PALETTES)[0]], floorY: d.height * 32 }))));
const work = {
  heroes: (ctx: any) => { for (const ch of CHARACTERS) { for (const pose of POSES) drawCharacter(ctx, 8, 0, ch, pose, undefined, ''); for (const f of FACE_FRAMES) drawCharacter(ctx, 8, 0, ch, 'idle0', faceFromKey(f), ''); } },
  terrain: (ctx: any) => { pieces.forEach(({ kind, p, pal, floorY }, i) => drawTerrainPiece(ctx, { kind, outline: p.outline, pal, seed: 1000 + i, floorY })); },
  layers: (ctx: any) => { for (const pal of Object.values(PALETTES)) for (const f of [drawFarLayer, drawCloudLayer, drawHillsLayer, drawNearLayer]) try { f(ctx, 1024, 512, pal); } catch { /* (a palette without that layer) */ } },
};
const out: Record<string, string> = {};
for (const [name, f] of Object.entries(work)) {
  h1 = 0x811c9dc5 | 0;
  calls = 0;
  f(rec);
  const hash = (h1 >>> 0).toString(16);
  const ts: number[] = [];
  for (let k = 0; k < 7; k++) {
    const t0 = performance.now();
    f(noop);
    ts.push(performance.now() - t0);
  }
  ts.sort((a, b) => a - b);
  out[name] = `${calls} calls, hash ${hash}, JS ${ts[3].toFixed(1)} ms`;
}
console.log(JSON.stringify(out));
