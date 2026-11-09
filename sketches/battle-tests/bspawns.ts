import { ARENA_SPAWNS, ARENA_STARTS, buildArena } from '../wt-battle/src/shared/battle/arena';
import { BattleSim } from '../wt-battle/src/shared/battle/sim';
const sim: any = new BattleSim(buildArena());
const m = sim.map;
let bad = 0;
for (const [x, h] of [...ARENA_SPAWNS, ...ARENA_STARTS]) {
  const row = m.h - h;
  const ok = (m.solid(x, row) || m.oneWay(x, row)) && [1, 2].every((d) => !m.solid(x, row - d));
  if (!ok) { bad++; console.log('bad spawn', x, h); }
}
console.log('spawns checked', ARENA_SPAWNS.length + ARENA_STARTS.length, 'bad', bad);
