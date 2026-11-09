// Fuzz the battle sim: many random battles (2-4 heroes, random buttons, some leaving mid-battle) — any throw?
import { BattleSim, BTN, DT } from '../../src/shared/battle/sim';
import { buildArena } from '../../src/shared/battle/arena';
const ARENA = buildArena();
const HEROES = ['puffy', 'scruffy', 'muscles'];
let seed = Number(process.argv[2] ?? 1);
const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const N = Number(process.argv[3] ?? 300);
let errors = 0;
const kinds = new Map<string, number>();
for (let g = 0; g < N; g++) {
  const sim = new BattleSim(ARENA);
  const n = 2 + Math.floor(r() * 3);
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    ids.push('p' + i);
    sim.add('p' + i, HEROES[Math.floor(r() * 3)], i);
  }
  const btn = new Map<string, number>();
  let t = 0;
  try {
    while (!sim.over && t < 150 / DT + 10) {
      t++;
      // change buttons now and then (mash fire a lot: chairs and rockets)
      for (const id of ids) if (r() < 0.08) btn.set(id, Math.floor(r() * 64));
      // someone leaves mid-battle (sometimes while holding a chair)
      if (r() < 0.0008 && ids.length > 1) {
        const k = Math.floor(r() * ids.length);
        sim.remove(ids[k]);
        ids.splice(k, 1);
      }
      const inputs = new Map<string, number>();
      for (const id of ids) inputs.set(id, btn.get(id) ?? 0);
      const ev = sim.step(inputs);
      for (const e of ev) kinds.set(e.k, (kinds.get(e.k) ?? 0) + 1);
    }
  } catch (e) {
    errors++;
    if (errors <= 3) console.log('THROW in game', g, 'tick', t, (e as Error).stack?.split('\n').slice(0, 6).join('\n'));
  }
}
console.log('games', N, 'throws', errors);
console.log('events:', [...kinds.entries()].filter(([k]) => /chair|enemy|spawn|ko/i.test(k)).map(([k, v]) => k + ' ' + v).join(', '));
