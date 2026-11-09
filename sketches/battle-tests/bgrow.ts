// Grown heroes: bad guys, their shots and rocks can't hurt you; another hero can
import { BattleSim, POWER, TILE_PX } from '../wt-battle/src/shared/battle/sim';
import { buildArena } from '../wt-battle/src/shared/battle/arena';
const ARENA = buildArena();
const idle = new Map([['a', 0], ['b', 0]]);
function setup(grown: boolean) {
  const sim: any = new BattleSim(ARENA);
  sim.add('a', 'puffy', 0); sim.add('b', 'scruffy', 1);
  sim.timeLeft = 140; sim.chairAt = []; sim.prizes = []; sim.hazards = []; sim.enemies = [];
  sim.spawnEnemy = () => {}; sim.spawnHazards = () => {};
  for (let i = 0; i < 40; i++) sim.step(idle);
  const p = sim.players.get('a');
  // (out in the open: nothing overhead)
  for (let x = 6 * TILE_PX; x < sim.map.widthPx; x += TILE_PX) { const tx = Math.floor(x / TILE_PX); let clear = true; for (let ty = 0; ty < sim.map.h - 2; ty++) for (const d of [0]) if (sim.map.solid(tx + d, ty) || sim.map.oneWay(tx + d, ty)) clear = false; if (clear) { p.x = x; break; } }
  for (let i = 0; i < 20; i++) sim.step(idle);
  if (grown) { p.power = POWER.grow; p.powerT = 12; }
  p.invuln = 0;
  return { sim, p };
}
for (const grown of [false, true]) {
  // a bad guy walking into you
  let { sim, p } = setup(grown);
  sim.enemies.push({ id: 1, kind: 'medium', race: 'plop', weapon: null, x: p.x + 10, y: p.y, vx: 0, vy: 0, dir: -1, hp: 9, onGround: true, armed: false, chute: false, fireCd: 9, jumpCd: 9, hop: 9, hurtT: 0 });
  let hp = p.hp; for (let i = 0; i < 10; i++) sim.step(idle);
  const r1 = hp - p.hp;
  // a rock on your head
  ({ sim, p } = setup(grown));
  sim.hazards.push({ id: 1, kind: 'rock', big: true, x: p.x, y: p.y - 200, vx: 0, vy: 300, warn: 0, rolling: 0 });
  hp = p.hp; for (let i = 0; i < 30; i++) sim.step(idle);
  const r2 = hp - p.hp;
  // a bad guy's shot
  ({ sim, p } = setup(grown));
  sim.rockets.push({ id: 99, owner: 'e5', kind: 'poo', x: p.x + 40, y: p.y - 20, vx: -400, vy: 0, dir: -1, age: 0, speed: 0, radius: 22, damage: 1 });
  hp = p.hp; for (let i = 0; i < 20; i++) sim.step(idle);
  const r3 = hp - p.hp;
  // another hero's rocket
  ({ sim, p } = setup(grown));
  sim.rockets.push({ id: 98, owner: 'b', kind: 'rocket', x: p.x + 60, y: p.y - 30, vx: -500, vy: 0, dir: -1, age: 0, speed: 500, radius: 60, damage: 1 });
  hp = p.hp; for (let i = 0; i < 20; i++) sim.step(idle);
  const r4 = hp - p.hp;
  console.log(grown ? 'GROWN ' : 'normal', 'hearts lost — bad guy:', r1, ' rock:', r2, ' bad guy shot:', r3, ' hero rocket:', r4);
}
