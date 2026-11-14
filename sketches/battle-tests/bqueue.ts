// A jump, then a double jump, from a phone whose connection hiccups for 0.4 s in the middle:
// what the phone shows (its own prediction) vs. what the server does, old queue trim vs. new.
import { ArenaMap, BTN, stepMove, newPlayer, type BPlayer } from '../wt-battle/src/shared/battle/sim';
import { buildArena } from '../wt-battle/src/shared/battle/arena';
import { compactQueue } from '../wt-battle/server/inputQueue';

const map = new ArenaMap(buildArena());
const fresh = () => {
  const p = newPlayer('a', 'puffy', 0);
  p.x = 14 * 32 * 2; p.y = 0; p.invuln = 99;
  for (let i = 0; i < 120; i++) stepMove(p, 0, map); // fall and settle
  return p;
};
const J = BTN.jump;
// tick-by-tick buttons: jump held 5, let go 3, jump again (in the air) held 4, then nothing
const seq = [J, J, J, J, J, 0, 0, 0, J, J, J, J, ...Array(28).fill(0)];
const peak = (p: BPlayer, ys: number[]) => Math.round(ys[0] - Math.min(...ys));

function client() {
  const p = fresh(); const ys = [p.y]; let airs = 0;
  for (const b of seq) { const ev: any[] = []; stepMove(p, b, map, ev); airs += ev.filter((e) => e.k === 'jump' && e.air).length; ys.push(p.y); }
  return { rise: peak(p, ys), airJumps: airs };
}
function server(mode: 'old' | 'new') {
  const p = fresh(); const ys = [p.y]; let airs = 0;
  const q: [number, number][] = []; let last = 0;
  // inputs 2..13 are held up and land all at once on tick 13 (0.4 s)
  for (let t = 0; t < seq.length + 10; t++) {
    if (t < seq.length && (t < 2 || t > 13)) q.push([t + 1, seq[t]]);
    if (t === 13) for (let k = 2; k <= 13; k++) q.push([k + 1, seq[k]]);
    q.sort((a, b) => a[0] - b[0]);
    if (q.length > 6) { if (mode === 'old') q.splice(0, q.length - 2); else compactQueue(q, last, 2, 6, 12, J); }
    const n = q.shift(); if (n) last = n[1];
    const ev: any[] = []; stepMove(p, last, map, ev); airs += ev.filter((e) => e.k === 'jump' && e.air).length; ys.push(p.y);
  }
  return { rise: peak(p, ys), airJumps: airs };
}
console.log('phone shows      ', client());
console.log('server, old trim ', server('old'));
console.log('server, new trim ', server('new'));
const q: [number, number][] = [[1, 0], [2, 0], [3, J], [4, J], [5, 0], [6, 0], [7, J], [8, 0], [9, 0], [10, 0]];
compactQueue(q, 0, 2, 6, 12, J);
console.log('compacted', JSON.stringify(q));
