import { buildLevel4 } from '../../src/level/level4';
const d = buildLevel4();
// every standable spot (a solid cell with the cell above empty) needs 2 empty cells above it to fit a hero
let bad = 0;
for (let y = 2; y < d.height; y++) for (let x = 0; x < d.width; x++) {
  const c = d.cells[y][x]; if (!c) continue;
  if (d.cells[y - 1][x]) continue;
  if (d.cells[y - 2][x]) { bad++; if (bad < 6) console.log('tight spot at', x, d.height - y); }
}
console.log('tight standing spots:', bad, 'size', d.width, 'x', d.height);
