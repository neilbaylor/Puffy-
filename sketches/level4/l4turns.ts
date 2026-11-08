import { buildLevel4 } from '../../src/level/level4';
const d = buildLevel4();
const cl = (globalThis as any).__ledges as { x0: number; x1: number; h: number }[][];
cl.forEach((list, ci) => {
  let clouds = 0, runs = 0, maxRun = 0;
  for (const l of list) { const c = d.cells[d.height - l.h][l.x0] === 'cloud'; if (c) { clouds++; runs++; maxRun = Math.max(maxRun, runs); } else runs = 0; }
  console.log(`climb ${ci + 1}: ${list.length} ledges, ${clouds} turn clouds, most clouds in a row: ${maxRun}, x ${Math.min(...list.map((l) => l.x0))}..${Math.max(...list.map((l) => l.x1))}`);
});
