// Battle chairs: (1) a swing at a bad guy in front of you, at different distances; (2) picking a chair up where it lands, all along the arena
import { BattleSim, BTN, TILE_PX } from '../../src/shared/battle/sim';
import { buildArena } from '../../src/shared/battle/arena';
const ARENA = buildArena();
const groundY = (sim: any, x: number) => { const tx = Math.floor(x / TILE_PX); let ty = 0; while (ty < sim.map.h && !sim.map.solid(tx, ty)) ty++; return ty * TILE_PX; };
for (const kind of ['small', 'medium', 'big'] as const)
  for (const race of ['puff', 'plop'] as const)
    for (const gap of [10, 30, 50, 70, 90]) {
      const sim: any = new BattleSim(ARENA);
      sim.add('a', 'puffy', 0);
      sim.add('b', 'scruffy', 1);
      const p = sim.players.get('a');
      sim.timeLeft = 140; sim.chairAt = []; sim.prizes = []; sim.hazards = [];
      // (stand on the floor at x, a chair in your hands, facing right)
      for (let i = 0; i < 40; i++) sim.step(new Map([['a', 0], ['b', 0]]));
      const x0 = p.x;
      sim.chairs.push({ id: 900, x: p.x, y: p.y, vy: 0, landed: true, age: 0, holder: 'a', uses: 2, swing: 0 });
      p.facing = 1;
      sim.enemies = [];
      const ex = x0 + gap + 11;
      sim.enemies.push({ id: 1, kind, race, weapon: null, x: ex, y: groundY(sim, ex), vx: 0, vy: 0, dir: -1, hp: 9, onGround: true, armed: false, chute: false, fireCd: 9, jumpCd: 9, hop: 9, hurtT: 0 });
      sim.spawnEnemy = () => {};
      const before = sim.enemies[0].hp;
      sim.step(new Map([['a', BTN.fire], ['b', 0]]));
      sim.step(new Map([['a', 0], ['b', 0]]));
      const e = sim.enemies[0];
      console.log(`${kind}/${race} ${gap}px in front: hp ${before} → ${e?.hp ?? 'gone'}  (hero y ${Math.round(p.y)}, bad guy y ${Math.round(e?.y)}, stun ${p.stun?.toFixed?.(2)}, chair ${sim.chairs[0]?.holder ?? 'none'})`);
    }
// pick-ups along the arena
let ok = 0, bad: string[] = [];
for (let tx = 2; tx < ARENA.width - 2; tx += 3) {
  const sim: any = new BattleSim(ARENA);
  sim.add('a', 'puffy', 0);
  sim.add('b', 'scruffy', 1);
  sim.chairAt = [];
  for (let i = 0; i < 30; i++) sim.step(new Map([['a', 0], ['b', 0]]));
  const x = (tx + 0.5) * TILE_PX;
  sim.chairs = [{ id: 901, x, y: -40, vy: 120, landed: false, age: 0, holder: null, uses: 2, swing: 0 }];
  for (let i = 0; i < 120 && !sim.chairs[0]?.landed; i++) sim.step(new Map([['a', 0], ['b', 0]]));
  const ch = sim.chairs[0];
  if (!ch) { bad.push(`x${tx}: chair gone`); continue; }
  // put the hero right on it
  const p = sim.players.get('a');
  p.x = ch.x - 20; p.y = ch.y - 1; p.vx = 0; p.vy = 0;
  for (let i = 0; i < 30 && !ch.holder; i++) sim.step(new Map([['a', BTN.right], ['b', 0]]));
  if (ch.holder === 'a') ok++;
  else bad.push(`x${tx}: chair at y ${Math.round(ch.y)} landed ${ch.landed}, hero at ${Math.round(p.x)},${Math.round(p.y)}`);
}
console.log('pick-ups ok', ok, 'failed', bad.length);
for (const b of bad.slice(0, 12)) console.log('  ', b);
// where 300 chairs come down
{
  const ys = new Map<number, number>();
  for (let n = 0; n < 300; n++) {
    const sim: any = new BattleSim(ARENA);
    sim.add('a', 'puffy', 0);
    sim.add('b', 'scruffy', 1);
    sim.chairAt = [sim.timeLeft + 1];
    for (let i = 0; i < 200 && !(sim.chairs[0]?.landed); i++) sim.step(new Map([['a', 0], ['b', 0]]));
    const ch = sim.chairs.find((c: any) => !c.holder);
    const y = ch ? Math.round(ch.y) : -1;
    ys.set(y, (ys.get(y) ?? 0) + 1);
  }
  console.log('chairs landed at heights (y: count):', [...ys.entries()].sort((a, b) => a[0] - b[0]).map(([y, c]) => `${y}: ${c}`).join(', '), '(floor 480, post tops 416, corner 448)');
}
