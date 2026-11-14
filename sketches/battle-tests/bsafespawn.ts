// Battle respawns: with bad guys crowding most of the spawn spots, a knocked-out hero comes back
// somewhere none are close (and with them everywhere, at the one farthest from them).
import { BattleSim, TILE_PX } from '../wt-battle/src/shared/battle/sim';
import { ARENA_SPAWNS, buildArena } from '../wt-battle/src/shared/battle/arena';
const ARENA = buildArena();
const run = (crowd: number) => {
  const sim: any = new BattleSim(ARENA);
  sim.add('a', 'puffy', 0);
  sim.add('b', 'scruffy', 1);
  sim.hazardIn = 1e9; sim.enemyIn = 1e9;
  const H = sim.map.h;
  // a medium bad guy standing on each of the first `crowd` spawn spots
  sim.enemies = ARENA_SPAWNS.slice(0, crowd).map(([tx, h]: [number, number], i: number) => ({ id: 1000 + i, kind: 'medium', race: 'puff', weapon: null, x: (tx + 0.5) * TILE_PX, y: (H - h) * TILE_PX, vx: 0, vy: 0, dir: 1, hp: 3, onGround: true, armed: false, chute: false, fireCd: 99, jumpCd: 99, hop: 1, hurtT: 0 }));
  const p = sim.players.get('a');
  const res: number[] = [];
  for (let k = 0; k < 6; k++) {
    p.respawn = 0.01; p.hp = 0;
    sim.step(new Map([['a', 0], ['b', 0]]));
    const near = Math.min(...sim.enemies.map((e: any) => Math.hypot(e.x - p.x, e.y - p.y)));
    res.push(Math.round(near));
  }
  return res;
};
console.log('bad guys on 15 of', ARENA_SPAWNS.length, 'spots → nearest bad guy after each respawn (px):', run(15).join(', '));
console.log('bad guys on all', ARENA_SPAWNS.length, 'spots → nearest bad guy (px):', run(ARENA_SPAWNS.length).join(', '));
