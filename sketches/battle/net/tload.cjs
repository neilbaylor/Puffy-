// Many battles at once on one server: R rooms of 4 headless players (bots, as in latency/bot.cjs).
// Measures, over S seconds of battle: the gaps between snapshots as one player in each room gets them,
// bytes per player per second, snapshot sizes, and the server's CPU use.
// node tload.cjs <port> <rooms> <seconds> [serverPid]   (server: BATTLE_COUNTDOWN=600, BATTLE_SECS long)
const WebSocket = require('ws');
const fs = require('fs');
const PORT = Number(process.argv[2] || 8391);
const R = Number(process.argv[3] || 10);
const SECS = Number(process.argv[4] || 20);
const PID = process.argv[5];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
function bot(code, name, first) {
  const ws = new WebSocket(`ws://localhost:${PORT}/battle?room=${code}`, { perMessageDeflate: false });
  const st = { ws, gaps: [], last: 0, bytes: 0, snapBytes: [], phase: '', measuring: false };
  let seq = 0;
  let timer = null;
  let dir = 1;
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', name, hero: ['puffy', 'scruffy', 'muscles'][name.length % 3], token: name + Math.random() })));
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (st.measuring) st.bytes += d.length;
    if (m.t === 'room') {
      st.phase = m.room.phase;
      if (first && m.room.phase === 'countdown' && m.room.players.length >= 4 && m.room.timer > 4) ws.send(JSON.stringify({ t: 'start' }));
      if (m.room.phase === 'battle' && !timer) {
        const t0 = Date.now();
        timer = setInterval(() => {
          const due = Math.floor((Date.now() - t0) / (1000 / 30));
          while (seq < due) {
            seq++;
            if (Math.random() < 0.02) dir = -dir;
            ws.send(JSON.stringify({ t: 'in', s: seq, b: (dir > 0 ? 2 : 1) | (seq % 40 < 6 ? 4 : 0) | (seq % 25 < 2 ? 8 : 0) | (seq % 300 === 0 ? 32 : 0) }));
          }
        }, 8);
      }
    }
    if (m.t === 'snap' && st.measuring) {
      const t = performance.now();
      if (st.last) st.gaps.push(t - st.last);
      st.last = t;
      st.snapBytes.push(d.length);
    }
  });
  ws.on('error', () => {});
  st.stop = () => (clearInterval(timer), ws.close());
  return st;
}
const cpu = () => {
  if (!PID) return null;
  const f = fs.readFileSync(`/proc/${PID}/stat`, 'utf8').split(') ')[1].split(' ');
  return (Number(f[11]) + Number(f[12])) / 100; // utime + stime, seconds (100 Hz clock)
};
(async () => {
  const all = [];
  for (let r = 0; r < R; r++) {
    const code = 'ld' + r + 'x' + Math.floor(Math.random() * 1e5);
    for (let i = 0; i < 4; i++) {
      all.push(bot(code, `B${r}_${i}`, i === 0));
      await sleep(5);
    }
  }
  const t = Date.now();
  while (all.some((b) => b.phase !== 'battle') && Date.now() - t < 20000) await sleep(100);
  await sleep(1500);
  for (const b of all) b.measuring = true;
  const c0 = cpu();
  const t0 = Date.now();
  await sleep(SECS * 1000);
  const c1 = cpu();
  for (const b of all) b.measuring = false;
  const secs = (Date.now() - t0) / 1000;
  const gaps = all.filter((_, i) => i % 4 === 0).flatMap((b) => b.gaps);
  const sizes = all.flatMap((b) => b.snapBytes);
  const kbs = all.map((b) => b.bytes / secs / 1024);
  console.log(`${R} rooms × 4: snapshot gaps p50 ${q(gaps, 0.5).toFixed(1)} p95 ${q(gaps, 0.95).toFixed(1)} p99 ${q(gaps, 0.99).toFixed(1)} max ${Math.max(...gaps).toFixed(1)} ms; snapshot ${q(sizes, 0.5)} B median, ${Math.max(...sizes)} max; per player ${q(kbs, 0.5).toFixed(1)} KB/s down; server CPU ${c0 === null ? '-' : ((100 * (c1 - c0)) / secs).toFixed(1) + '%'}`);
  for (const b of all) b.stop();
  await sleep(300);
  process.exit(0);
})();
