// From each ground spot, jump (straight, drifting left, drifting right; single and double jump): which
// platform tops can small vs grown reach? Lists ground spots where small reaches higher than grown.
import { BattleSim, BTN, POWER, TILE_PX } from '../wt-battle/src/shared/battle/sim';
import { buildArena } from '../wt-battle/src/shared/battle/arena';
const hero = process.argv[2] || 'muscles';
const ARENA = buildArena(); const T = TILE_PX;
const best = (x: number, grown: boolean) => {
  let top = 99;
  for (const drift of [0, BTN.left, BTN.right]) for (const dbl of [false, true]) for (const lateDrift of [0, 8]) {
    const sim: any = new BattleSim(ARENA);
    sim.add('a', hero, 0); sim.add('b', 'scruffy', 1);
    sim.timeLeft = 1e9; sim.chairAt = []; sim.prizes = []; sim.hazards = []; sim.enemies = []; sim.spawnEnemy = () => {}; sim.hazardIn = 1e9;
    const p = sim.players.get('a'), b = sim.players.get('b');
    p.x = x; p.y = 15 * T; p.vy = 0; p.onGround = true;
    if (grown) { p.power = POWER.grow; p.powerT = 30; }
    sim.step(new Map([['a', 0], ['b', 0]]));
    for (let f = 0; f < 50; f++) {
      b.x = -9999;
      let btn = (f < 14 ? BTN.jump : 0) | (f >= lateDrift ? drift : 0);
      if (dbl && f >= 16 && f < 26) btn |= BTN.jump;
      sim.step(new Map([['a', btn], ['b', 0]]));
      if (p.onGround) top = Math.min(top, Math.round(p.y / T));
    }
  }
  return top;
};
const out: string[] = [];
for (let tx = 1; tx < 111; tx++) {
  const x = tx * T + 16;
  const s = best(x, false), g = best(x, true);
  if (s < g) out.push(`x ${tx}: small reaches row ${s}, grown only row ${g}`);
}
console.log(out.join('\n') || 'no difference');
