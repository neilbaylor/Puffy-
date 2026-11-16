// Shooting through walls: A fires at B with a wall between them (the 1-tile pillar at x 57, 2 tiles tall, and
// the step at x 40-47), at a few distances; does B get hurt? Also A standing right up against the wall, and grown.
import { BattleSim, BTN, POWER, TILE_PX } from '../wt-battle/src/shared/battle/sim';
import { buildArena } from '../wt-battle/src/shared/battle/arena';
const T = TILE_PX;
const out: string[] = [];
for (const hero of ['puffy', 'scruffy', 'muscles'])
  for (const grown of [false, true])
    for (const [ax, bx, label] of [[55.5, 58.5, 'pillar, both 1.5 tiles off'], [56.4, 57.9, 'pillar, A against it'], [56.4, 59.5, 'pillar, B 2.5 off'], [55.0, 60.5, 'pillar, far']] as [number, number, string][]) {
      const sim: any = new BattleSim(buildArena());
      sim.add('a', hero, 0); sim.add('b', 'puffy', 1);
      sim.timeLeft = 100; sim.chairAt = []; sim.prizes = []; sim.hazards = []; sim.enemies = []; sim.spawnEnemy = () => {}; sim.hazardIn = 1e9;
      const a = sim.players.get('a'), b = sim.players.get('b');
      for (const [p, x] of [[a, ax], [b, bx]] as const) { p.x = x * T; p.y = 15 * T; p.vy = 0; p.vx = 0; p.invuln = 0; p.facing = 1; }
      if (grown) { a.power = POWER.grow; a.powerT = 10; }
      for (let i = 0; i < 3; i++) sim.step(new Map([['a', 0], ['b', 0]]));
      b.invuln = 0; const hp0 = b.hp;
      sim.step(new Map([['a', BTN.fire | BTN.right], ['b', 0]]));
      for (let i = 0; i < 60; i++) { b.x = bx * T; sim.step(new Map([['a', 0], ['b', 0]])); }
      out.push(`${hero.padEnd(8)} ${grown ? 'grown' : 'small'} ${label.padEnd(28)} B hurt: ${b.hp < hp0 ? 'YES' : 'no'}`);
    }
console.log(out.join('\n'));
