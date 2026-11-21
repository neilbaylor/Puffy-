import { BattleSim } from '/workspace/Puffy-/src/shared/battle/sim';
import { buildArena } from '/workspace/Puffy-/src/shared/battle/arena';
// Hero A's rocket blows up a 1-hp bad guy with a blaster, standing next to hero B. The bad guy was just
// about to shoot. In the tick after it dies, does it still shoot, or hurt B by touching?
const sim = new BattleSim(buildArena()) as any;
sim.add('a', 'puffy', 0);
sim.add('b', 'puffy', 1);
sim.enemyIn = sim.dropIn = sim.hazardIn = 1e9;
const a = sim.players.get('a');
const b = sim.players.get('b');
const y = 15 * 32;
a.x = 180; a.y = y; a.invuln = 0; a.facing = 1;
b.x = 375; b.y = y; b.invuln = 0;
sim.enemies.push({ id: 50, kind: 'small', race: 'puff', weapon: 'gun', x: 370, y, vx: 0, vy: 0, dir: -1, hp: 1, onGround: true, armed: true, chute: false, fireCd: 0.05, jumpCd: 99, hop: 0, hurtT: 0 });
sim.rockets.push({ id: 900, owner: 'a', kind: 'rocket', x: 358, y: y - 14, vx: 400, vy: 0, dir: 1, age: 0.5, speed: 400, radius: 10, damage: 1 });
b.invuln = 99; // (B can't be hurt by A's blast itself)
for (let t = 0; t < 3; t++) {
  if (t === 1) b.invuln = 0; // the blast is over; from here B can be hurt again
  const ev = sim.step(new Map([['a', 0], ['b', 0]]));
  const pick = ev.filter((e: any) => ['edie', 'eshot', 'hit'].includes(e.k)).map((e: any) => e.k + (e.id ? ' ' + e.id : '') + (e.by ? ' by ' + e.by : ''));
  console.log(`tick ${t}: ${pick.join(', ') || '-'} | enemies listed: ${sim.enemies.map((e: any) => `id${e.id} hp${e.hp}`).join(' ') || 'none'} | B hp ${b.hp}`);
}
