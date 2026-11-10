// Battle: can each hero get over the tall rock in the cliffs (one jump; one jump + the air jump)?
import { BattleSim, BTN, TILE_PX } from '../wt-battle/src/shared/battle/sim';
import { ARENA_SECTION, buildArena } from '../wt-battle/src/shared/battle/arena';
const ARENA = buildArena();
const rockX = (ARENA_SECTION * 3 + 17) * TILE_PX;
for (const hero of ['puffy', 'scruffy', 'muscles'])
  for (const air of [false, true]) {
    const sim: any = new BattleSim(ARENA);
    sim.add('a', hero, 0);
    sim.add('b', 'scruffy', 1);
    sim.timeLeft = 140; sim.chairAt = []; sim.prizes = []; sim.hazards = []; sim.enemies = []; sim.spawnEnemy = () => {}; sim.hazardIn = 1e9;
    const p = sim.players.get('a');
    for (let i = 0; i < 30; i++) sim.step(new Map([['a', 0], ['b', 0]]));
    p.x = rockX - 70; p.y = 15 * TILE_PX; p.vy = 0;
    for (let i = 0; i < 20; i++) sim.step(new Map([['a', 0], ['b', 0]]));
    let past = false;
    for (let f = 0; f < 120; f++) {
      // run right; jump at the rock's foot, and (air) jump again at the top of the first
      let b = BTN.right;
      // (held, like a player does: a tap is a short hop)
      if (f >= 6 && f < 22) b |= BTN.jump;
      if (air && f >= 24 && f < 40) b |= BTN.jump;
      sim.step(new Map([['a', b], ['b', 0]]));
      if (p.x > rockX + 2 * TILE_PX + 20) { past = true; break; }
    }
    console.log(`${hero.padEnd(8)} ${air ? 'jump + air jump' : 'one jump       '}: ${past ? 'over' : 'stuck'}`);
  }
