// A phone that hitches now and then (its buttons held up H ms, then sent together, as the game catches
// up its missed ticks): does the server end up keeping a standing queue of its buttons (extra delay
// for good)? Reports the server tick minus that player's ack (how many ticks behind its buttons are
// played) before and after the hitches. node tqueue.cjs <port> [hitchMs] [hitches]
const WebSocket = require('ws');
const PORT = Number(process.argv[2] || 8391);
const H = Number(process.argv[3] || 300);
const N = Number(process.argv[4] || 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const code = 'tq' + Math.floor(Math.random() * 1e6);
const mk = (name) => {
  const ws = new WebSocket(`ws://localhost:${PORT}/battle?room=${code}`);
  const c = { ws, snaps: [] };
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', name, hero: 'puffy', token: name + Math.random() })));
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'welcome') c.id = m.id;
    if (m.t === 'room') c.room = m.room;
    if (m.t === 'snap') c.snaps.push(m);
  });
  return c;
};
(async () => {
  const a = mk('A');
  const b = mk('B');
  while (a.room?.phase !== 'countdown') await sleep(20);
  a.ws.send(JSON.stringify({ t: 'start' }));
  while (!a.snaps.length) await sleep(20);
  // A: a tick's buttons every 33.3 ms by the real clock (like the game); held back during a hitch
  let seq = 0;
  let held = false;
  const out = [];
  const t0 = performance.now();
  const iv = setInterval(() => {
    const due = Math.floor((performance.now() - t0) / (1000 / 30));
    while (seq < due) out.push(JSON.stringify({ t: 'in', s: ++seq, b: process.env.BUSY ? (seq % 4 < 2 ? 2 : 1) | (seq % 3 === 0 ? 8 : 0) : seq % 60 < 30 ? 2 : 1 }));
    if (!held) for (const m of out.splice(0)) a.ws.send(m);
  }, 4);
  const lag = () => {
    const s = a.snaps.slice(-30);
    const v = s.map((x) => x.k - x.p.find((q) => q[0] === a.id)[21]);
    return (v.reduce((x, y) => x + y, 0) / v.length).toFixed(1);
  };
  await sleep(2000);
  const rows = [`before: server tick − A's ack ${lag()}`];
  for (let i = 0; i < N; i++) {
    held = true;
    await sleep(H);
    held = false;
    await sleep(2500);
    rows.push(`after hitch ${i + 1} (${H} ms): ${lag()}`);
  }
  console.log(rows.join('; '));
  clearInterval(iv);
  a.ws.close();
  b.ws.close();
  process.exit(0);
})();
