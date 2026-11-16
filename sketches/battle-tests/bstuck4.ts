// Every place a hero can stand in the arena (every 8 px along every floor/cloud/ramp top): grow there, then
// try to get away (walk left, walk right, jump left, jump right, 1.2 s each, from a fresh copy each time).
// Stuck = none of them gets 1 tile away. Also counts spots where the grown box starts inside a wall. Args: hero
import { BattleSim, BTN, POWER, TILE_PX, sizeOf, boxW, boxH } from '../wt-battle/src/shared/battle/sim';
import { buildArena } from '../wt-battle/src/shared/battle/arena';
import { CHARACTERS } from '../wt-battle/src/data/characters';
const ARENA = buildArena();
const hero = process.argv[2] || 'muscles';
const c = CHARACTERS.find((q) => q.id === hero)!;
const T = TILE_PX;
const mk = () => {
  const sim: any = new BattleSim(ARENA);
  sim.add('a', hero, 0); sim.add('b', 'scruffy', 1);
  sim.timeLeft = 1e9; sim.chairAt = []; sim.prizes = []; sim.hazards = []; sim.enemies = []; sim.spawnEnemy = () => {}; sim.hazardIn = 1e9;
  const b = sim.players.get('b'); b.x = -9999; b.y = 0;
  return sim;
};
const base = mk(); const m = base.map;
const spots: [number, number][] = [];
for (let px = T; px < m.widthPx - T; px += 8) {
  const tx = Math.floor(px / T);
  for (let ty = 1; ty < m.h; ty++) if ((m.solid(tx, ty) || m.oneWay(tx, ty)) && !m.solid(tx, ty - 1)) spots.push([px, ty * T]);
}
let stuck: string[] = [], inWall = 0;
for (const [x, y] of spots) {
  const run = (btn: (f: number) => number) => {
    const sim = mk(); const p = sim.players.get('a'); const b = sim.players.get('b');
    p.x = x; p.y = y; p.vy = 0; p.onGround = true; p.invuln = 99;
    sim.step(new Map([['a', 0], ['b', 0]]));
    sim.prizes.push({ id: 99, kind: 'grow', x: p.x, y: p.y - 10, vy: 0, landed: true, age: 0 }); for (let i = 0; i < 2; i++) sim.step(new Map([['a', 0], ['b', 0]])); if (p.power !== POWER.grow) { p.power = POWER.grow; p.powerT = 30; } p.powerT = 30;
    const k = sizeOf(p), w = boxW(c, k), h = boxH(c, k);
    let emb = false;
    for (let yy = p.y - h + 2; yy <= p.y - 2; yy += 6) for (const xx of [p.x - w / 2 + 2, p.x + w / 2 - 2]) if (m.solidAt(xx, yy)) emb = true;
    const x0 = p.x, y0 = p.y; let far = 0;
    for (let f = 0; f < 36; f++) { b.x = -9999; sim.step(new Map([['a', btn(f)], ['b', 0]])); far = Math.max(far, Math.hypot(p.x - x0, p.y - y0)); }
    return { far, emb };
  };
  const tries = [(f: number) => BTN.left, (f: number) => BTN.right, (f: number) => BTN.left | (f < 12 ? BTN.jump : 0), (f: number) => BTN.right | (f < 12 ? BTN.jump : 0)];
  let best = 0, emb = false;
  for (const t of tries) { const r = run(t); best = Math.max(best, r.far); emb ||= r.emb; }
  if (emb) inWall++;
  if (best < T) stuck.push(`(${(x / T).toFixed(2)},${y / T}) best ${best.toFixed(0)}px${emb ? ' inwall' : ''}`);
}
console.log(`${hero}: ${spots.length} spots, grown box inside a wall at ${inWall}, stuck at ${stuck.length}`);
for (const s of stuck.slice(0, 30)) console.log('  ', s);
