// Turns a meas.cjs result into numbers.
const fs = require('fs');
const R = JSON.parse(fs.readFileSync(process.argv[2]));
const q = (a, p) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : '-');
const out = {};
out.cfg = `lag ${R.cfg.LAG}±${R.cfg.JIT} each way, spikes ${R.cfg.SPIKE}×${R.cfg.SPIKE_MS}ms, bots ${R.cfg.BOTS}`;
// 1. press → seen
for (const k of ['right', 'left', 'jump']) {
  const a = R.probes[k].filter((x) => x >= 0);
  out['probe_' + k] = `n=${a.length} median ${f1(q(a, 0.5))} mean ${f1(mean(a))} p90 ${f1(q(a, 0.9))} ms (misses ${R.probes[k].length - a.length})`;
}
const A = R.A;
const B = R.B;
const aId = A.myId;
const bId = B.myId;
// frame pacing
const dts = [];
for (let i = 1; i < A.frames.length; i++) dts.push(A.frames[i][0] - A.frames[i - 1][0]);
out.frame_ms = `median ${f1(q(dts, 0.5))} p95 ${f1(q(dts, 0.95))}`;
// 2. corrections
for (const [name, M] of [['A', A], ['B', B]]) {
  const span = (M.frames[M.frames.length - 1][0] - M.frames[0][0]) / 1000;
  const c = M.corr.map((r) => Math.hypot(r[1], r[2]));
  const big = c.filter((v) => v > 0.5);
  out['corr_' + name] = `${M.corr.length} reconciles; non-zero(>0.5px) ${big.length} (${f1(big.length / span)}/s) median ${f1(q(big, 0.5))} p95 ${f1(q(big, 0.95))} max ${f1(Math.max(0, ...c))}px; >4px ${c.filter((v) => v > 4).length}, >16px ${c.filter((v) => v > 16).length}; pending median ${q(M.corr.map((r) => r[3]), 0.5)} rtt ${q(M.corr.map((r) => r[4]), 0.5)}`;
  const fl = M.frames.map((r) => r[5]);
  out['fixvis_' + name] = `frames with visible offset >1px ${f1((100 * fl.filter((v) => v > 1).length) / fl.length)}%, >3px ${f1((100 * fl.filter((v) => v > 3).length) / fl.length)}%, p99 ${f1(q(fl, 0.99))}px`;
}
// own hero judder: while running steadily, frames where the drawn hero didn't move
{
  let still = 0;
  let n = 0;
  const F = A.frames;
  for (let i = 2; i < F.length; i++) {
    const [t, sx, sy, mx] = F[i];
    const [t0, sx0, , mx0] = F[i - 2];
    const [, sx1] = F[i - 1];
    if (sx === null || sx0 === null || mx === null || mx0 === null) continue;
    const v = Math.abs(mx - mx0) / ((t - t0) / 1000);
    if (v < 120 || v > 600 || F[i][7] > 0) continue;
    n++;
    if (Math.abs(sx - sx1) < 0.05 * v * ((t - F[i - 1][0]) / 1000)) still++;
  }
  out.own_judder = `while moving: ${f1((100 * still) / Math.max(1, n))}% of frames the hero didn't move on screen (n=${n})`;
}
// 3. how far behind the others are drawn: A's picture of B against B's own (and the other way)
function lagOf(V, S, otherId) {
  // V: viewer frames (o[otherId] = drawn), S: subject frames (own me.x,y)
  const st = S.frames.filter((r) => r[3] !== null && r[7] <= 0).map((r) => [r[0], r[3], r[4]]);
  const sAt = (t) => {
    let lo = 0;
    let hi = st.length - 1;
    if (t < st[0][0] || t > st[hi][0]) return null;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (st[m][0] <= t) lo = m;
      else hi = m;
    }
    const a = st[lo];
    const b = st[hi];
    if (b[0] - a[0] > 100) return null;
    const k = (t - a[0]) / (b[0] - a[0] || 1);
    return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
  const vw = V.frames.filter((r) => r[6][otherId] && r[6][otherId][2]).map((r) => [r[0], r[6][otherId][0], r[6][otherId][1] - 2]);
  let best = null;
  for (let tau = 0; tau <= 700; tau += 2) {
    let e = 0;
    let n = 0;
    for (const [t, x, y] of vw) {
      const p = sAt(t - tau);
      if (!p) continue;
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d > 150) continue; // a respawn
      e += d;
      n++;
    }
    if (n > 100 && (!best || e / n < best.err)) best = { tau, err: e / n, n };
  }
  // and how far off they are drawn from where they really are now (px)
  const now = [];
  for (const [t, x, y] of vw) {
    const p = sAt(t);
    if (p && Math.hypot(p[0] - x, p[1] - y) < 150) now.push(Math.hypot(p[0] - x, p[1] - y));
  }
  // stalls: frames where the subject moved but the drawing didn't
  let stall = 0;
  let mv = 0;
  for (let i = 1; i < vw.length; i++) {
    const p0 = sAt(vw[i - 1][0] - (best?.tau ?? 0));
    const p1 = sAt(vw[i][0] - (best?.tau ?? 0));
    if (!p0 || !p1) continue;
    const real = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (real < 2) continue;
    mv++;
    if (Math.hypot(vw[i][1] - vw[i - 1][1], vw[i][2] - vw[i - 1][2]) < 0.05) stall++;
  }
  return best ? `behind by ${best.tau} ms (fit error ${f1(best.err)}px, n=${best.n}); drawn vs real-now median ${f1(q(now, 0.5))} p95 ${f1(q(now, 0.95))}px; frozen frames while moving ${f1((100 * stall) / Math.max(1, mv))}%` : 'n/a';
}
out.others_A_sees_B = lagOf(A, B, bId);
out.others_B_sees_A = lagOf(B, A, aId);
out.interp_A = `ticks mean ${f1(mean(A.frames.map((r) => r[8])))} max ${f1(Math.max(...A.frames.map((r) => r[8])))}`;
// 4. hits: A's shots stopping on A's screen → the server's blast / hit
{
  const fightFrom = R.tFight;
  const shots = A.shots.filter((s) => s[0] >= fightFrom - 50);
  const booms = A.ev.filter((e) => e[1] === 'boom');
  const hitsB = A.ev.filter((e) => e[1] === 'hit' && e[2] === bId && e[3] === aId);
  // where B was drawn on A's screen at a time
  const bAt = (t) => {
    let best = null;
    for (const f of A.frames) if (Math.abs(f[0] - t) < 20 && f[6][bId]) best = f[6][bId];
    return best;
  };
  const dB = [];
  const dH = [];
  let onB = 0;
  let onBconf = 0;
  for (const [t, x, y] of shots) {
    const bm = booms.find((e) => e[0] >= t - 5 && e[0] < t + 1500 && Math.abs(e[4] - x) < 80 && Math.abs(e[5] - y) < 80);
    if (bm) dB.push(bm[0] - t);
    const bp = bAt(t);
    if (bp && Math.abs(bp[0] - x) < 40 && y < bp[1] + 5 && y > bp[1] - 70) {
      onB++;
      const h = hitsB.find((e) => e[0] >= t - 5 && e[0] < t + 1500);
      if (h) {
        onBconf++;
        dH.push(h[0] - t);
      }
    }
  }
  // hits on B the server gave A that A's screen didn't show coming (no shot of A's stopped on B within 300 ms before)
  out.hits = `A's shots stopped on screen: ${shots.length}; server blast followed ${dB.length} (delay median ${f1(q(dB, 0.5))} p90 ${f1(q(dB, 0.9))} ms); stopped on B: ${onB}, server said hit ${onBconf}${onB ? ` (${f1((100 * onBconf) / onB)}%)` : ''} delay median ${f1(q(dH, 0.5))} ms; server hits on B by A: ${hitsB.filter((e) => e[0] >= fightFrom).length}`;
  // the blast's first frame: was it played on the rocket? (time from the local stop to the blast)
}
// B getting hit by A: how far off (on B's screen) A's rocket still was when the hit came in
{
  const hitsOnB = B.ev.filter((e) => e[1] === 'hit' && e[2] === bId && e[0] >= R.tFight);
  const gaps = [];
  for (const h of hitsOnB) {
    // the frame just before the hit
    let f = null;
    for (const fr of B.frames) if (fr[0] <= h[0]) f = fr;
    if (f && f[13]) gaps.push(Math.abs(f[13][0]));
  }
  out.hit_on_B = `hits ${hitsOnB.length}; A's rocket still this far from B on B's screen when the hit came: ${gaps.map((g) => Math.round(g)).join(',')} px (median ${f1(q(gaps, 0.5))})`;
  // phantoms: my shots the server never made
}
// 5. bandwidth
for (const c of R.stats) out['net_' + c.who] = `down ${f1(c.downBytes / R.netDur / 1024)} KB/s (${f1(c.downMsgs / R.netDur)} msg/s, ${Math.round(c.downBytes / Math.max(1, c.downMsgs))} B/msg) up ${f1(c.upBytes / R.netDur / 1024)} KB/s (${f1(c.upMsgs / R.netDur)} msg/s)`;
{
  const local = A.shotN - A.shotN0;
  const server = A.ev.filter((e) => e[1] === 'fire' && e[2] === aId).length;
  out.shots_misc = `A fired ${local} on its screen, the server made ${server} (${local - server} shown that never happened); stopped-on-someone then flew on: ${A.released ?? '-'}`;
}
if (A.grabs) {
  const prizeEv = A.ev.filter((e) => e[1] === 'prize' && e[2] === aId);
  const d = [];
  for (const g of A.grabs) {
    const e = prizeEv.find((x) => x[0] >= g[0] - 5 && x[0] < g[0] + 2000 && Math.abs(x[4] - g[3]) < 48);
    if (e) d.push(e[0] - g[0]);
  }
  out.prizes = `A grabbed ${A.grabs.length} on its screen; the server agreed for ${d.length} (its word came ${f1(q(d, 0.5))} ms later, median; p90 ${f1(q(d, 0.9))}); put back ${A.ungrab}; server pickups by A in all ${prizeEv.length}`;
}
out.errors = R.errs.length ? R.errs.join(' | ') : 'none';
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(18), v);
