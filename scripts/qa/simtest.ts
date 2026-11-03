import { BattleSim, BTN, DT, POWER, stepMove } from '../../src/shared/battle/sim';
import { buildArena } from '../../src/shared/battle/arena';
const out: string[] = [];
const ok = (name: string, cond: boolean, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`);
const sim = () => { const s = new BattleSim(buildArena()); (s as any).enemyIn = 1e9; (s as any).hazardIn = 1e9; (s as any).dropIn = 1e9; return s; };

// 1. stomp
{ const s = sim(); const a = s.add('a', 'puffy', 0); const b = s.add('b', 'scruffy', 1);
  a.invuln = b.invuln = 0; b.x = 500; b.y = 480; b.onGround = true; a.x = 500; a.y = 400; a.vy = 300; a.onGround = false;
  let stomped = false; for (let i = 0; i < 20; i++) { const ev = s.step(new Map()); if (ev.some((e) => e.k === 'stomp')) { stomped = true; break; } }
  ok('stomp hurts the one underneath', stomped && b.hp === 2, `b.hp=${b.hp} a.vy=${a.vy.toFixed(0)}`); }
// 2. bonuses: star lasts 14 s, grow is 1.8x
{ const s = sim(); const a = s.add('a', 'puffy', 0);
  (s as any).grant(a, 'star', []); ok('invincible lasts 14 s', a.power === POWER.star && Math.abs(a.powerT - 14) < 0.01, `powerT=${a.powerT}`);
  const b = s.add('b', 'scruffy', 1); (s as any).grant(b, 'grow', []); out.push(`  grow: power=${b.power} t=${b.powerT}`); }
// 3. fire power
{ const s = sim(); const a = s.add('a', 'puffy', 0); a.x = 200; a.y = 480; a.onGround = true; a.facing = 1; a.power = POWER.fire; a.powerT = 8;
  s.step(new Map([['a', BTN.fire]])); const r = s.rockets[0];
  ok('fire power shoots a fireball', !!r && r.kind === 'fire'); let booms = 0, t = 0;
  for (let i = 0; i < 90 && s.rockets.length; i++) { const ev = s.step(new Map()); booms += ev.filter((e) => e.k === 'boom').length; t++; }
  ok('fireball lands and bursts', booms === 1, `after ${t} ticks`); }
// 4. losing a point to a bad guy (never below 0)
{ const s = sim(); const a = s.add('a', 'puffy', 0); a.invuln = 0; a.kos = 1; a.hp = 1;
  (s as any).hurt(a, 'enemy', a.x + 10, 1, 1, []); ok('KO by a bad guy costs a point', a.kos === 0 && a.respawn > 0);
  a.respawn = 0; a.hp = 1; a.invuln = 0; (s as any).hurt(a, 'e5', a.x + 10, 1, 1, []); ok('…but never below 0', a.kos === 0);
  const b = s.add('b', 'scruffy', 1); b.invuln = 0; b.hp = 1; (s as any).hurt(b, 'a', b.x - 10, 1, 1, []); ok('KO by a friend scores for them', a.kos === 1); }
// 5. a prize floats down, lands, stays 7 s, then it's gone
{ const s = sim(); s.prizes.push({ id: 1, kind: 'heart', x: 300, y: -24, vy: 40, landed: false, age: 0 } as any);
  let landT = -1, goneT = -1;
  for (let i = 0; i < 30 * 30; i++) { s.step(new Map()); const z = s.prizes[0]; if (z && z.landed && landT < 0) landT = i; if (!z) { goneT = i; break; } }
  ok('prize gone 7 s after it lands', landT > 0 && goneT > 0 && Math.abs((goneT - landT) / 30 - 7) < 0.1, `fell ${(landT / 30).toFixed(1)} s, gone after ${((goneT - landT) / 30).toFixed(2)} s`); }
// 5b. no ramp any more
{ const s = sim(); ok('no ramp', ((s as any).map.ramps ?? []).length === 0); }
// 6. a long match full of bad guys and things from the sky
{ const s = new BattleSim(buildArena()); for (let i = 0; i < 4; i++) s.add('p' + i, ['puffy', 'scruffy', 'muscles', 'puffy'][i], i);
  const kinds: Record<string, number> = {}; let maxE = 0, plops = 0, armed = 0, pr = 0, hz = 0, maxP = 0, hzN = 0; const pk = new Set<string>(), hk = new Set<string>(); const seenE = new Set<number>();
  for (let i = 0; i < 150 * 30 + 5; i++) {
    const inp = new Map<string, number>(); for (let k = 0; k < 4; k++) inp.set('p' + k, (i + k * 7) % 40 < 20 ? BTN.right | BTN.fire : BTN.left | BTN.jump);
    const ev = s.step(inp); for (const e of ev) kinds[e.k] = (kinds[e.k] ?? 0) + 1;
    maxE = Math.max(maxE, s.enemies.length);
    for (const e of s.enemies) if (!seenE.has(e.id)) { seenE.add(e.id); if (e.race === 'plop') plops++; if (e.weapon) armed++; }
    for (const r of s.rockets) if (r.kind === 'poo') pr++;
    if (s.enemies.filter((e) => e.kind === 'big').length > 1) hz++;
    maxP = Math.max(maxP, s.prizes.length); for (const z of s.prizes) pk.add(z.kind); hzN = Math.max(hzN, s.hazards.length);
    for (const z of s.hazards) hk.add(z.kind);
  }
  ok('only 5 bonus kinds, at most 2 at once', [...pk].every((k) => ['heart', 'bomb', 'star', 'rapid', 'grow'].includes(k)) && maxP <= 2, `kinds ${[...pk]} max ${maxP}`);
  ok('rocks and anvils still fall', hk.has('rock') && hk.has('anvil'), `${[...hk]}`);
  ok('2½ minute match runs', s.timeLeft === 0 || s.over);
  ok('never more than 3 bad guys, at most 1 big', maxE <= 3 && hz === 0, `max=${maxE}`);
  out.push(`  bad guys: ${seenE.size} (Plops ${plops}, armed ${armed}); events: ${JSON.stringify(kinds)}`);
  out.push(`  scores: ${[...s.players.values()].map((p) => `${p.id} ${p.kos} KOs / ${p.deaths} deaths`).join(', ')}`); }
console.log(out.join('\n'));
