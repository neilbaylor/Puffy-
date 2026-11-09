// Battle: a chair swing at a bad guy still floating down on its parachute, at heights above your head
import { BattleSim, BTN } from '../wt-battle/src/shared/battle/sim';
import { buildArena } from '../wt-battle/src/shared/battle/arena';
const ARENA = buildArena();
for (const chute of [true, false])
  for (const above of [0, 30, 60, 90, 120]) {
    const sim: any = new BattleSim(ARENA);
    sim.add('a', 'puffy', 0);
    sim.add('b', 'scruffy', 1);
    const p = sim.players.get('a');
    sim.timeLeft = 140; sim.chairAt = []; sim.prizes = []; sim.hazards = []; sim.enemies = [];
    sim.spawnEnemy = () => {};
    for (let i = 0; i < 40; i++) sim.step(new Map([['a', 0], ['b', 0]]));
    sim.chairs.push({ id: 900, x: p.x, y: p.y, vy: 0, landed: true, age: 0, holder: 'a', uses: 2, swing: 0 });
    p.facing = 1;
    // (its feet `above` px over the hero's feet, just in front)
    sim.enemies.push({ id: 1, kind: 'small', race: 'plop', weapon: null, x: p.x + 40, y: p.y - above, vx: 0, vy: 0, dir: -1, hp: 9, onGround: !chute, armed: false, chute, fireCd: 9, jumpCd: 9, hop: 9, hurtT: 0 });
    const e = sim.enemies[0];
    const before = e.hp;
    sim.step(new Map([['a', BTN.fire], ['b', 0]]));
    sim.step(new Map([['a', 0], ['b', 0]]));
    console.log(`${chute ? 'on its parachute' : 'no parachute    '}, feet ${String(above).padStart(3)} px above yours: ${before - e.hp ? 'HIT' : 'miss'}`);
  }
