// The battle only ends when time runs out: 10 KOs doesn't end it; time 0 does.
import { BattleSim } from '../wt-battle/src/shared/battle/sim';
import { buildArena } from '../wt-battle/src/shared/battle/arena';
const sim: any = new BattleSim(buildArena());
sim.add('a', 'puffy', 0); sim.add('b', 'scruffy', 1);
sim.players.get('a').kos = 10;
const a = sim.over; sim.timeLeft = 0; const b = sim.over;
console.log(`10 KOs, time left: over=${a} (want false) · time up: over=${b} (want true)`);
