import { BattleSim } from '/workspace/Puffy-/src/shared/battle/sim';
import { buildArena } from '/workspace/Puffy-/src/shared/battle/arena';
import { packPlayer } from '/workspace/Puffy-/src/shared/battle/protocol';
const sim = new BattleSim(buildArena());
for (let i = 0; i < 4; i++) sim.add('p' + i, ['puffy', 'scruffy', 'muscles', 'puffy'][i], i);
const t0 = performance.now(); let bytes = 0;
for (let k = 0; k < 4500; k++) { // a whole 150 s match
  const inp = new Map<string, number[]>(); for (let i = 0; i < 4; i++) inp.set('p' + i, [(k >> 3) % 2 ? 2 | 8 : 1 | 4]);
  const ev = sim.step(inp);
  bytes += JSON.stringify({ p: [...sim.players.values()].map((p) => packPlayer(p, k)), r: sim.rockets, n: sim.enemies, h: sim.hazards, e: ev }).length;
}
const ms = performance.now() - t0;
console.log(`4-player match, 4500 ticks: ${(ms / 4500 * 1000).toFixed(0)} µs/tick (budget 33,333 µs), avg snapshot ${(bytes / 4500).toFixed(0)} B`);
