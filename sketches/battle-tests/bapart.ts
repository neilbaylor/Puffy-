// Battle: three Plops chasing the same hero, starting in one spot — do they stay in one lump, or spread out?
import { BattleSim, TILE_PX } from '../wt-battle/src/shared/battle/sim';
import { buildArena } from '../wt-battle/src/shared/battle/arena';
const run = (apart: boolean) => {
  let seed = 7; Math.random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const sim: any = new BattleSim(buildArena());
  sim.add('a', 'puffy', 0); sim.add('b', 'scruffy', 1);
  sim.hazardIn = 1e9; sim.enemyIn = 1e9;
  if (!apart) sim.keepApart = () => {};
  const H = sim.map.h;
  const p = sim.players.get('a'); p.invuln = 1e9;
  sim.players.get('b').x = sim.map.widthPx - 100; sim.players.get('b').invuln = 1e9;
  sim.enemies = [0, 1, 2].map((i) => ({ id: 500 + i, kind: i === 2 ? 'small' : 'medium', race: 'plop', weapon: null, x: p.x + 400 + i * 2, y: (H - 2) * TILE_PX, vx: 0, vy: 0, dir: -1, hp: 99, onGround: true, armed: false, chute: false, fireCd: 99, jumpCd: 1, hop: 1, hurtT: 0 }));
  let lumped = 0, ticks = 0;
  for (let t = 0; t < 300; t++) {
    sim.step(new Map([['a', 0], ['b', 0]]));
    if (t < 60) continue;
    ticks++;
    const es = sim.enemies;
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) if (Math.abs(es[i].x - es[j].x) < 8 && Math.abs(es[i].y - es[j].y) < 20) { lumped++; i = es.length; break; }
  }
  return `${Math.round((100 * lumped) / ticks)}% of the time two are in one lump; at the end x = ${sim.enemies.map((e: any) => Math.round(e.x)).join(', ')}`;
};
console.log('before:', run(false));
console.log('after: ', run(true));
