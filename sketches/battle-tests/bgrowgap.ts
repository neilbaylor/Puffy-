// Battle: grown heroes under the islands (a 3-tile gap over the floor): can they walk under, and out, and jump?
import { BattleSim, BTN, POWER, TILE_PX, sizeOf } from '../wt-battle/src/shared/battle/sim';
import { ARENA_SECTION, buildArena } from '../wt-battle/src/shared/battle/arena';
import { CHARACTERS } from '../wt-battle/src/data/characters';
const ARENA = buildArena();
// the hill's left island: tiles S+1..S+5 at h7 (its belly over S+2..S+4 at h6): 3 tiles over the floor
const under = (ARENA_SECTION + 3) * TILE_PX;
for (const hero of ['puffy', 'scruffy', 'muscles']) {
  const c = CHARACTERS.find((q) => q.id === hero)!;
  for (const how of ['grown under it', 'grown, then walks under']) {
    const sim: any = new BattleSim(ARENA);
    sim.add('a', hero, 0);
    sim.add('b', 'scruffy', 1);
    sim.timeLeft = 140; sim.chairAt = []; sim.prizes = []; sim.hazards = []; sim.enemies = []; sim.spawnEnemy = () => {}; sim.hazardIn = 1e9;
    const p = sim.players.get('a');
    const idle = new Map([['a', 0], ['b', 0]]);
    for (let i = 0; i < 30; i++) sim.step(idle);
    p.x = how === 'grown under it' ? under : under - 6 * TILE_PX; p.y = 15 * TILE_PX; p.vy = 0;
    for (let i = 0; i < 10; i++) sim.step(idle);
    // grab a grow prize where you stand
    sim.prizes.push({ id: 99, kind: 'grow', x: p.x, y: p.y - 10, vy: 0, landed: true, age: 0 });
    for (let i = 0; i < 3; i++) sim.step(idle);
    const grown = p.power === POWER.grow;
    const x0 = p.x;
    // walk right for 1.5 s (out from under it / in under it and on), then jump
    let maxX = p.x;
    for (let f = 0; f < 45; f++) { sim.step(new Map([['a', BTN.right], ['b', 0]])); maxX = Math.max(maxX, p.x); }
    const y0 = p.y;
    let minY = p.y;
    for (let f = 0; f < 30; f++) { sim.step(new Map([['a', f < 16 ? BTN.jump : 0], ['b', 0]])); minY = Math.min(minY, p.y); }
    console.log(`${hero.padEnd(8)} ${how.padEnd(24)} grown ${grown} height ${Math.round((c.hitH ?? 34) * sizeOf(p))}px · walked ${Math.round((maxX - x0) / TILE_PX * 10) / 10} tiles · jumped ${Math.round(y0 - minY)}px`);
  }
}
