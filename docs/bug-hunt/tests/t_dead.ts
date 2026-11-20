import { BattleSim } from '/workspace/Puffy-/src/shared/battle/sim';
import { buildArena } from '/workspace/Puffy-/src/shared/battle/arena';
const sim = new BattleSim(buildArena()) as any;
sim.add('a', 'puffy', 0);
sim.enemyIn = sim.dropIn = sim.hazardIn = 1e9;
const y = 15 * 32;
sim.enemies.push({ id: 50, kind: 'small', race: 'puff', weapon: null, x: 1500, y, vx: 0, vy: 0, dir: 1, hp: 1, onGround: true, armed: false, chute: false, fireCd: 99, jumpCd: 99, hop: 0, hurtT: 0 });
sim.hazards.push({ id: 60, kind: 'rock', big: false, x: 1500, y: y - 25, vx: 0, vy: 0, warn: 0, rolling: 0 });
for (let i = 0; i < 40; i++) {
  const ev = sim.step(new Map([['a', 0]]));
  if (ev.some((e: any) => e.k === 'edie')) { console.log(`tick ${i}: edie event; enemies still in sim.enemies (sent in this snapshot):`, sim.enemies.map((e: any) => `id${e.id} hp${e.hp}`)); break; }
}
