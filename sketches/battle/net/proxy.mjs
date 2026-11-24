// A WebSocket proxy for the battle server that adds network delay and jitter, each way.
// Usage: node proxy.mjs <listenPort> <upstreamPort>
// Clients connect to ws://localhost:<listenPort>/battle?lag=50&jit=15&spike=0.02&spikeMs=80&room=...
//   lag: one-way base delay (ms), jit: ± uniform jitter (ms), spike: chance per message of an extra
//   spikeMs (a wifi hiccup). Delivery stays in order (it's TCP: a late message holds up the ones after).
// GET /stats → bytes and messages each way, per connection.
// GET /hole?who=Alpha&ms=20000 → that player's connections (open now) go dead for ms: nothing gets through
//   either way, closes included — as when a phone changes networks and its old connection just stops.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
const require = createRequire(process.env.WS_FROM || import.meta.url);
const { WebSocketServer, WebSocket } = require('ws');

const [LISTEN, UP] = process.argv.slice(2).map(Number);
const conns = [];
const http = createServer((req, res) => {
  if (req.url.startsWith('/stats')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(conns.map((c) => c.stats)));
  }
  if (req.url.startsWith('/hole')) {
    const q = new URL(req.url, 'http://x').searchParams;
    const until = Date.now() + Number(q.get('ms') || 10000);
    let n = 0;
    for (const c of conns) if (c.stats.who === q.get('who')) (c.hole = until), n++;
    return res.end(String(n));
  }
  if (req.url.startsWith('/reset')) {
    for (const c of conns) Object.assign(c.stats, { downBytes: 0, downMsgs: 0, upBytes: 0, upMsgs: 0, since: Date.now() });
    return res.end('ok');
  }
  res.writeHead(404).end();
});
const wss = new WebSocketServer({ server: http, path: '/battle', perMessageDeflate: false });

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

wss.on('connection', (client, req) => {
  const u = new URL(req.url, 'http://x');
  const lag = Number(u.searchParams.get('lag') || 0);
  const jit = Number(u.searchParams.get('jit') || 0);
  const spike = Number(u.searchParams.get('spike') || 0);
  const spikeMs = Number(u.searchParams.get('spikeMs') || 0);
  const name = u.searchParams.get('who') || '?';
  for (const k of ['lag', 'jit', 'spike', 'spikeMs', 'who']) u.searchParams.delete(k);
  const up = new WebSocket(`ws://127.0.0.1:${UP}/battle?${u.searchParams}`, { perMessageDeflate: false });
  const stats = { who: name, lag, jit, downBytes: 0, downMsgs: 0, upBytes: 0, upMsgs: 0, since: Date.now(), snapGapMax: 0 };
  const conn = { stats, hole: 0 };
  conns.push(conn);
  const dead = () => Date.now() < conn.hole;
  const seed = Math.floor(Math.random() * 1e9);
  // (a queue per direction, sent strictly in order: nothing overtakes, as on TCP)
  const mkLane = (r) => {
    let last = 0;
    const q = [];
    let timer = null;
    const pump = () => {
      timer = null;
      const now = performance.now();
      while (q.length && q[0].at <= now + 0.5) q.shift().send();
      if (q.length) timer = setTimeout(pump, Math.max(0, q[0].at - now));
    };
    return (send) => {
      const now = performance.now();
      const d = lag + (jit ? (r() * 2 - 1) * jit : 0) + (spike && r() < spike ? spikeMs : 0);
      const at = Math.max(last, now + Math.max(0, d));
      last = at;
      q.push({ at, send });
      if (!timer) pump();
    };
  };
  const down = mkLane(rng(seed));
  const upl = mkLane(rng(seed + 7));
  const pendingUp = [];
  up.on('open', () => {
    for (const m of pendingUp.splice(0)) up.send(m);
  });
  up.on('message', (data, isBinary) => {
    stats.downBytes += data.length;
    stats.downMsgs++;
    const m = isBinary ? data : data.toString();
    if (dead()) return;
    down(() => client.readyState === 1 && client.send(m));
  });
  client.on('message', (data, isBinary) => {
    stats.upBytes += data.length;
    stats.upMsgs++;
    const m = isBinary ? data : data.toString();
    if (dead()) return;
    upl(() => {
      if (up.readyState === 1) up.send(m);
      else if (up.readyState === 0) pendingUp.push(m);
    });
  });
  const close = () => {
    try { client.close(); } catch {}
    try { up.close(); } catch {}
  };
  // (closes go after the queued messages, like a FIN would)
  up.on('close', () => !dead() && down(close));
  client.on('close', () => !dead() && upl(close));
  up.on('error', () => {});
  client.on('error', () => {});
});
http.listen(LISTEN, () => console.log(`proxy :${LISTEN} → :${UP}`));
