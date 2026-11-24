// A phone's buttons held up S seconds then arriving all at once (a network stall), through a copy of the
// server's input handling (MAX_WAIT / CUSHION / MAX_OWED / compactQueue, and LET_GO): how far the server's
// hero ends up from where the phone had it (what the phone then has to correct), and shots it never made.
// npx esbuild sketches/battle/net/stall.ts --bundle --platform=node --outfile=/tmp/stall.js && node /tmp/stall.js
import { BattleSim, BTN } from '../../../src/shared/battle/sim';
import { buildArena } from '../../../src/shared/battle/arena';
import { compactQueue } from '../../../server/inputQueue';

const MAX_QUEUE = 6, MAX_WAIT = 4, CUSHION = 1, MAX_OWED = 8;
function run(pattern: (t: number) => number, stallAt: number, stallTicks: number, letGo: number, seed: number) {
  const sim = new BattleSim(buildArena());
  const z = sim as any;
  z.enemyIn = z.hazardIn = z.dropIn = 1e9;
  z.chairAt = [];
  const p = sim.add('a', 'puffy', 0);
  p.invuln = 0;
  // the phone's picture: the same match with every button on time
  const ref = new BattleSim(buildArena());
  const zr = ref as any;
  zr.enemyIn = zr.hazardIn = zr.dropIn = 1e9;
  zr.chairAt = [];
  const me = ref.add('a', 'puffy', 0);
  Object.assign(me, { x: p.x, y: p.y, invuln: 0 });
  const c = { queue: [] as [number, number][], lastBtn: 0, owed: 0, waited: 0 };
  const arrive: [number, number, number][] = []; // [tick it arrives, seq, buttons]
  const N = stallAt + stallTicks + 90;
  for (let s = 1; s <= N; s++) arrive.push([s >= stallAt && s < stallAt + stallTicks ? stallAt + stallTicks : s, s, pattern(s + seed)]);
  let phoneShots = 0, serverShots = 0, soon = 0;
  for (let t = 1; t <= N + 30; t++) {
    for (const a of arrive) if (a[0] === t) c.queue.push([a[1], a[2]]);
    if (t <= N) phoneShots += ref.step(new Map([['a', pattern(t + seed)]])).filter((e) => e.k === 'fire').length;
    else ref.step(new Map());
    if (c.queue.length > MAX_QUEUE) compactQueue(c.queue, c.lastBtn, 2, MAX_QUEUE, MAX_QUEUE * 2, BTN.jump);
    const steps: number[] = [];
    const take = () => {
      const [, b] = c.queue.shift()!;
      c.lastBtn = b;
      steps.push(b);
    };
    if (c.queue.length) {
      c.waited = 0;
      take();
      if (c.owed > 0 && c.queue.length > CUSHION) (take(), c.owed--);
    } else if (c.waited < MAX_WAIT) {
      c.waited++;
      c.owed = Math.min(MAX_OWED, c.owed + 1);
    } else {
      if (++c.waited >= letGo) c.lastBtn = 0;
      steps.push(c.lastBtn);
    }
    const ev = sim.step(new Map([['a', steps]]));
    serverShots += ev.filter((e) => e.k === 'fire').length;
    // (just after the late buttons have been played: what the phone has to correct then)
    if (t === stallAt + stallTicks + 12) soon = Math.hypot(p.x - me.x, p.y - me.y);
  }
  // (the phone stopped pressing at N: compare once both have stood still a second)
  return { off: soon, shots: phoneShots - serverShots };
}
const patterns: Record<string, (t: number) => number> = {
  'hold right+fire': (t) => BTN.right | BTN.run | BTN.fire,
  'walk, turn every 2 s (no fire)': (t) => (Math.floor(t / 60) % 2 ? BTN.left : BTN.right),
  'run, turn every 1 s, hop, fire': (t) => (Math.floor(t / 30) % 2 ? BTN.left : BTN.right) | (t % 20 < 4 ? BTN.jump : 0) | (t % 9 < 2 ? BTN.fire : 0),
  'tap about (0.4 s each way)': (t) => (Math.floor(t / 12) % 3 === 0 ? BTN.left : Math.floor(t / 12) % 3 === 1 ? BTN.right : 0) | (t % 15 < 3 ? BTN.jump : 0),
};
const lets = [Infinity, 15, 30, 45, 60];
console.log('stall s | ' + lets.map((l) => (l === Infinity ? 'never (old)' : `LET_GO ${l}`).padEnd(16)).join(' | '));
for (const [name, f] of Object.entries(patterns)) {
  console.log('-- ' + name + ' (mean px off 0.4 s after the late buttons came; shots shown that never happened)');
  for (const st of [0.3, 0.6, 1, 1.5, 2, 3]) {
    const cells = lets.map((l) => {
      let off = 0, sh = 0;
      const n = 12;
      for (let k = 0; k < n; k++) {
        const r = run(f, 40 + k * 7, Math.round(st * 30), l, k * 13);
        off += r.off;
        sh += r.shots;
      }
      return `${(off / n).toFixed(0).padStart(4)} px ${(sh / n).toFixed(1).padStart(4)} sh`.padEnd(16);
    });
    console.log(`${String(st).padStart(7)} | ${cells.join(' | ')}`);
  }
}
