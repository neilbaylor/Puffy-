// Level data check: in Parts 1-6, is any nuggie spot or root beer inside rock or ground, and does every bad guy,
// checkpoint, gate, tree and player start stand on something (ground or a cloud) without being inside a wall?
// Also flags a nuggie or root beer whose picture's corner (+-12 px) overlaps solid ground.

import { buildLevel1 } from '/workspace/Puffy-/src/level/level1';
import { buildLevel2 } from '/workspace/Puffy-/src/level/level2';
import { buildLevel3 } from '/workspace/Puffy-/src/level/level3';
import { buildLevel4 } from '/workspace/Puffy-/src/level/level4';
import { buildLevel5 } from '/workspace/Puffy-/src/level/level5';
import { buildLevel6 } from '/workspace/Puffy-/src/level/level6';
const TILE = 32;
const SOLID = new Set(['ground','rock','boulder','bramble']);
const builders = [buildLevel1, buildLevel2, buildLevel3, buildLevel4, buildLevel5, buildLevel6];
builders.forEach((b, i) => {
  const d = b();
  const cell = (x, y) => (x < 0 || y < 0 || x >= d.width || y >= d.height) ? 'OUT' : d.cells[y][x];
  const out = [];
  const seen = new Map();
  for (const s of d.spawns) {
    const cx = s.x * TILE + TILE / 2;
    const col = Math.floor(cx / TILE);
    if (s.type === 'aura' || s.type === 'rootbeer') {
      const py = s.y * TILE + TILE / 2;
      const row = Math.floor(py / TILE);
      const c = cell(col, row);
      if (SOLID.has(c) || c === 'OUT') out.push(`${s.type} at x=${s.x} y=${s.y} (col ${col}, row ${row}) is inside ${c}`);
      // also check box +-12 px
      for (const [dx, dy] of [[-12,-12],[12,-12],[-12,12],[12,12]]) {
        const c2 = cell(Math.floor((cx+dx)/TILE), Math.floor((py+dy)/TILE));
        if (SOLID.has(c2)) { out.push(`  (${s.type} ${s.x},${s.y} corner ${dx},${dy} overlaps ${c2})`); break; }
      }
      const k = s.type + ':' + s.x + ',' + s.y;
      if (seen.has(k)) out.push('DUP ' + k); seen.set(k, 1);
      continue;
    }
    if (['player','checkpoint','goal','puffball','bigpuff','giant','goat','plop','bigplop','giantplop','poogoat','crab','king','soccer','hockey','volley','tennis','baseball','football','tree'].includes(s.type)) {
      const here = cell(col, s.y);
      const under = cell(col, s.y + 1);
      const flags = [];
      if (SOLID.has(here)) flags.push('inside ' + here);
      if (!(SOLID.has(under) || under === 'cloud')) flags.push('nothing under (' + under + ')');
      if (flags.length) out.push(`${s.type} at x=${s.x} y=${s.y} (col ${col}): ${flags.join(', ')}`);
    }
  }
  console.log('Level', i + 1, d.name, d.width + 'x' + d.height, 'spawns', d.spawns.length, 'water', d.water);
  for (const o of out) console.log('  ' + o);
});
