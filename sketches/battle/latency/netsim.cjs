// Network timing simulations (no drawing, no CPU noise): the server's wait for each player's buttons
// (old: carry on with the last buttons, then play the late ones too; new: wait, then catch up), and the
// game's clock for drawing the others (old: 3 ticks + extra; new: adaptive + carrying on).
// node netsim.cjs <oneWayMs> <jitterMs> <spikeChance> <spikeMs> [seconds] [frameMs]
const [LAG, JIT, SPIKE, SPIKE_MS, SECS = 120, FRAME = 16.667] = process.argv.slice(2).map(Number);
const DT = 1000 / 30;
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const q = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
// in-order delivery with jitter and spikes (TCP: nothing overtakes)
function lane() {
  let last = 0;
  return (t) => (last = Math.max(last, t + Math.max(0, LAG + (rnd() * 2 - 1) * JIT + (rnd() < SPIKE ? SPIKE_MS : 0))));
}
// a phone's frames: mostly FRAME ms, now and then a hiccup
function frames(until) {
  const f = [];
  let t = 0;
  while (t < until) {
    t += FRAME * (rnd() < 0.01 ? 4 + rnd() * 4 : 1) + (rnd() - 0.5) * 1.5;
    f.push(t);
  }
  return f;
}

// ── 1. the server's wait for a player's buttons ──
function serverQueue(mode) {
  seed = 777;
  const T = SECS * 1000;
  const up = lane();
  // the game: a tick (its buttons sent) whenever its accumulated frame time passes a tick; old capped
  // each frame at 0.1 s (losing time after a hiccup), new at 0.25 s
  const sends = [];
  let acc = 0;
  let prev = 0;
  let seq = 0;
  for (const f of frames(T)) {
    acc += Math.min(f - prev, mode === 'old' ? 100 : 250);
    prev = f;
    while (acc >= DT) {
      acc -= DT;
      seq++;
      sends.push({ seq, sent: f, arrive: up(f) });
    }
  }
  const queue = [];
  let i = 0;
  let owed = 0;
  let waited = 0;
  let cushion = 1;
  let lastWait = -1e9;
  let lastRaise = 0;
  const cush = [];
  const waits = [];
  let fillers = 0;
  let drops = 0;
  let freezes = 0;
  let doubles = 0;
  const ages = [];
  for (let tick = 1; tick * DT < T; tick++) {
    const now = tick * DT + 3; // (the first tick a little after the game starts sending)
    while (i < sends.length && sends[i].arrive <= now) queue.push(sends[i++]);
    if (queue.length > 6) {
      // (compactQueue: in a steady stream with no presses, repeats — dropping down to 2)
      while (queue.length > 2) {
        queue.shift();
        drops++;
      }
    }
    const take = () => {
      const s = queue.shift();
      ages.push(now - s.sent);
      waits.push(now - s.arrive);
    };
    cush.push(cushion);
    if (mode === 'old') {
      if (queue.length) take();
      else fillers++;
    } else {
      // (adaptive cushion: two waits within ~2 s → one more tick of cushion; 6 s without → one less)
      if (mode === 'adapt') {
        if (tick - lastRaise > 180 && cushion > 1 && tick - lastWait > 180) {
          cushion--;
          lastRaise = tick;
        }
      }
      if (queue.length) {
        waited = 0;
        take();
        if (owed > 0 && queue.length > cushion) {
          take();
          owed--;
          doubles++;
        }
      } else if (waited < 4) {
        waited++;
        owed = Math.min(8, owed + 1);
        freezes++;
        if (mode === 'adapt') {
          if (tick - lastWait < 60 && cushion < 3 && waited === 1) {
            cushion++;
            lastRaise = tick;
          }
          lastWait = tick;
        }
      } else fillers++;
    }
  }
  const s = SECS;
  return `${mode}: buttons reach the game ${Math.round(mean(ages))} ms after pressed (median ${Math.round(q(ages, 0.5))}, p95 ${Math.round(q(ages, 0.95))}); waiting in the queue ${Math.round(mean(waits))} ms; corrections on your screen (guessed ticks + dropped) ${((fillers + drops) / s).toFixed(2)}/s; ticks you stood still for others ${(freezes / s).toFixed(2)}/s, catch-up ${(doubles / s).toFixed(2)}/s${mode === 'adapt' ? `, cushion mean ${mean(cush).toFixed(2)}` : ''}`;
}

// ── 2. the game's clock for the others ──
function othersClock(mode) {
  seed = 999;
  const T = SECS * 1000;
  const down = lane();
  const snaps = [];
  for (let k = 1; k * DT < T; k++) snaps.push({ tick: k, at: down(k * DT + rnd() * 1.5) });
  let si = 0;
  const have = [];
  let lateBase = null;
  const lateness = [];
  const ideals = [];
  let extra = 0;
  let interp = 3;
  let oc = null;
  const behind = [];
  let frozen = 0;
  let carry = 0;
  let n = 0;
  for (const f of frames(T)) {
    while (si < snaps.length && snaps[si].at <= f) {
      const s = snaps[si++];
      have.push(s);
      const ideal = s.at - s.tick * DT;
      if (mode === 'old') {
        lateBase = lateBase === null ? ideal : Math.min(lateBase + 0.02, ideal);
        lateness.push((ideal - lateBase) / DT);
      } else {
        ideals.push(ideal);
        if (ideals.length > 90) ideals.shift();
        lateBase = Math.min(...ideals);
        lateness.length = 0;
        for (const v of ideals) lateness.push((v - lateBase) / DT);
      }
      if (mode === 'old') {
        if (lateness.length > 60) lateness.shift();
        const sorted = [...lateness].sort((a, b) => a - b);
        const want = Math.min(3, Math.max(0, sorted[Math.floor(sorted.length * 0.95)] - 2.5));
        extra += (want - extra) * (want > extra ? 0.3 : 0.02);
      } else {
        const sorted = [...lateness].sort((a, b) => a - b);
        const want = Math.min(7, Math.max(1.3, 0.8 + sorted[Math.floor(sorted.length * 0.9)]));
        interp += (want - interp) * (want > interp ? 0.3 : 0.02);
      }
    }
    if (!have.length) continue;
    const last = have[have.length - 1];
    let want;
    if (mode === 'old') want = last.tick + (f - last.at) / DT - 3 - extra;
    else want = (f - lateBase) / DT - interp;
    let clock = want;
    const tol = mode === 'old' ? 3 : 4;
    if (oc && Math.abs(want - oc.tick) <= tol) {
      const sec = (f - oc.at) / 1000;
      clock = oc.tick + sec / (DT / 1000);
      clock = Math.max(oc.tick, clock + (want - clock) * (1 - Math.exp(-sec * 6)));
    }
    oc = { tick: clock, at: f };
    if (f < 3000) continue; // (settled)
    n++;
    let shown = Math.min(last.tick, clock);
    if (mode === 'new' && clock > last.tick) {
      carry++;
      shown = Math.min(clock, last.tick + 3);
      if (clock > last.tick + 3) frozen++;
    } else if (clock > last.tick) frozen++;
    // how far behind the server's own clock right now
    behind.push(f - shown * DT);
  }
  return `${mode}: the others drawn ${Math.round(mean(behind))} ms behind the server's now (p95 ${Math.round(q(behind, 0.95))}); frames stuck waiting for a snapshot ${((100 * frozen) / n).toFixed(1)}%${mode === 'new' ? `, carrying on past the newest ${((100 * carry) / n).toFixed(1)}%` : ''}`;
}

console.log(`one way ${LAG}±${JIT} ms, spikes ${SPIKE}×${SPIKE_MS} ms, frames ${FRAME} ms`);
for (const m of ['old', 'new', 'adapt']) console.log('  input  ', serverQueue(m));
for (const m of ['old', 'new']) console.log('  others ', othersClock(m));
