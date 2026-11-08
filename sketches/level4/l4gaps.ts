import { buildLevel4, LEDGES } from '../../src/level/level4';
buildLevel4();
LEDGES.forEach((list, ci) => {
  let worst = 0;
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    const gap = Math.max(0, b.x0 - a.x1 - 1, a.x0 - b.x1 - 1);
    worst = Math.max(worst, gap);
  }
  console.log(`climb ${ci + 1}: ${list.length} ledges, widest sideways gap ${worst} tiles (up 3 each)`);
});
