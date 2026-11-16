// Where can a hero get to, starting on the ground in the middle? Many random runs, small vs grown; prints the
// map with feet positions reached: '*' both, 's' only small, 'g' only grown. Args: hero runs secs x0
import { BattleSim, BTN, POWER, TILE_PX } from '../wt-battle/src/shared/battle/sim';
import { buildArena } from '../wt-battle/src/shared/battle/arena';
const hero = process.argv[2] || 'muscles', RUNS = Number(process.argv[3] || 150), SECS = Number(process.argv[4] || 12), X0 = Number(process.argv[5] || 56);
const ARENA = buildArena();
const T = TILE_PX;
let st = 11; const rnd = () => ((st = (st * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const reach = (grown: boolean) => {
  const seen = new Set<string>();
  for (let r = 0; r < RUNS; r++) {
    const sim: any = new BattleSim(ARENA);
    sim.add('a', hero, 0); sim.add('b', 'scruffy', 1);
    sim.timeLeft = 1e9; sim.chairAt = []; sim.prizes = []; sim.hazards = []; sim.enemies = []; sim.spawnEnemy = () => {}; sim.hazardIn = 1e9;
    const p = sim.players.get('a'); const b = sim.players.get('b');
    p.x = X0 * T + 16; p.y = 15 * T; p.vy = 0; p.onGround = true;
    let btn = 0, hold = 0;
    for (let f = 0; f < SECS * 30; f++) {
      b.x = -9999; p.hp = 3; p.respawn = 0;
      if (grown) { p.power = POWER.grow; p.powerT = 10; } else { p.power = 0; }
      if (--hold <= 0) { hold = 5 + Math.floor(rnd() * 30); const d = rnd(); btn = (d < 0.4 ? BTN.right : d < 0.8 ? BTN.left : 0) | (rnd() < 0.5 ? BTN.jump : 0) | (rnd() < 0.4 ? BTN.run : 0); }
      sim.step(new Map([['a', btn & (f % 20 < 12 ? ~0 : ~BTN.jump)], ['b', 0]]));
      if (p.onGround) seen.add(`${Math.floor(p.x / T)},${Math.round(p.y / T)}`);
    }
  }
  return seen;
};
const s = reach(false), g = reach(true);
const m = new BattleSim(ARENA).map as any;
let hdr = '    '; for (let x = 0; x < m.w; x++) hdr += String(x % 10); console.log(hdr);
for (let y = 0; y < m.h; y++) {
  let row = String(y).padStart(3) + ' ';
  for (let x = 0; x < m.w; x++) {
    const k = `${x},${y}`; const a = s.has(k), bb = g.has(k);
    row += a && bb ? '*' : a ? 's' : bb ? 'g' : m.solid(x, y) ? '#' : m.oneWay(x, y) ? '=' : '.';
  }
  console.log(row);
}
