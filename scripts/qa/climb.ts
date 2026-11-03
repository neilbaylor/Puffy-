import { BattleSim } from '../../src/shared/battle/sim';
import { buildArena } from '../../src/shared/battle/arena';
const spots: [string, number, number][] = [['island (middle)', 15.5, 8], ['top cloud', 15.5, 12], ['left high cloud', 3, 10], ['right high cloud', 28, 10], ['left low cloud', 6, 6]];
for (const kind of ['small', 'medium', 'big'] as const)
  for (const [label, tx, h] of spots) {
    const s = new BattleSim(buildArena()); (s as any).enemyIn = 1e9; (s as any).hazardIn = 1e9; (s as any).dropIn = 1e9;
    const p = s.add('p', 'puffy', 0); const py = (17 - h) * 32;
    let reached = -1;
    for (let start of [2, 29]) {}
    s.enemies.push({ id: 1, kind, race: 'puff', weapon: null, x: 10 * 32, y: 15 * 32, vx: 0, vy: 0, dir: 1, hp: 99, onGround: true, armed: false, chute: false, fireCd: 99, jumpCd: 0, hop: 1, hurtT: 0 } as any);
    for (let i = 0; i < 30 * 20; i++) {
      p.x = (tx + 0.5) * 32; p.y = py; p.vy = 0; p.onGround = true; p.invuln = 99; p.hp = 3; p.respawn = 0;
      s.step(new Map());
      const e = s.enemies[0];
      if (e && Math.abs(e.y - py) < 4 && e.onGround) { reached = i / 30; break; }
    }
    console.log(`${kind.padEnd(7)} → ${label.padEnd(17)} ${reached >= 0 ? `reached in ${reached.toFixed(1)} s` : 'NOT reached in 20 s'}`);
  }
