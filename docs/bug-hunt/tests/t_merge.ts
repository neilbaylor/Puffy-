import { levelPieces as newLP } from '/workspace/Puffy-/src/world/LevelView';
import { levelPieces as oldLP } from '/tmp/hunt/orig/src/world/LevelView';
import { buildLevel1 } from '/workspace/Puffy-/src/level/level1';
import { buildLevel2 } from '/workspace/Puffy-/src/level/level2';
import { buildLevel3 } from '/workspace/Puffy-/src/level/level3';
import { buildLevel4 } from '/workspace/Puffy-/src/level/level4';
import { buildLevel5 } from '/workspace/Puffy-/src/level/level5';
import { buildLevel6 } from '/workspace/Puffy-/src/level/level6';
import { buildArena } from '/workspace/Puffy-/src/shared/battle/arena';
const med = (f: () => void) => { const t: number[] = []; for (let i = 0; i < 15; i++) { const s = performance.now(); f(); t.push(performance.now() - s); } t.sort((a, b) => a - b); return t[7]; };
let allSame = true, totO = 0, totN = 0;
for (const [n, b] of [['Part 1', buildLevel1], ['Part 2', buildLevel2], ['Part 3', buildLevel3], ['Part 4', buildLevel4], ['Part 5', buildLevel5], ['Part 6', buildLevel6], ['arena', buildArena]] as const) {
  for (const k of ['ground', 'rock'] as const) if (JSON.stringify(oldLP(b(), k)) !== JSON.stringify(newLP(b(), k))) { allSame = false; console.log('DIFF', n, k); }
  let r = 0; const lv = b();
  const o = med(() => { const d = { ...lv, name: lv.name + 'o' + r++ }; oldLP(d, 'ground'); oldLP(d, 'rock'); });
  const nn = med(() => { const d = { ...lv, name: lv.name + 'n' + r++ }; newLP(d, 'ground'); newLP(d, 'rock'); });
  totO += o; totN += nn;
  console.log(`${n.padEnd(7)} before ${o.toFixed(1).padStart(5)} ms  after ${nn.toFixed(1).padStart(5)} ms  (${(o / nn).toFixed(1)}x)`);
}
console.log(`total   before ${totO.toFixed(1)} ms  after ${totN.toFixed(1)} ms; outputs identical: ${allSame}`);
