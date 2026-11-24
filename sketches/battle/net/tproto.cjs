// Battle server edge cases at the message level (no browser): node tproto.cjs <port> [test,...]
// Server: BATTLE_COUNTDOWN=600 (bots press Start now), BATTLE_SECS long enough (60).
const WebSocket = require('ws');
const PORT = Number(process.argv[2] || 8391);
const ONLY = (process.argv[3] || '').split(',').filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (room) => `ws://localhost:${PORT}/battle?room=${room}`;
const room = () => 'tp' + Math.floor(Math.random() * 1e6);

/** A bare client: records what it gets; `send(obj)`. */
function client(code, name, opts = {}) {
  const ws = new WebSocket(url(code), { perMessageDeflate: false });
  const c = { ws, name, id: null, room: null, snaps: [], welcomes: 0, closed: false, closeCode: 0, token: opts.token ?? name + Math.random() };
  c.send = (m) => ws.readyState === 1 && ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  c.open = new Promise((r) => ws.on('open', r));
  ws.on('open', () => opts.hello !== false && c.send({ t: 'hello', name, hero: opts.hero || 'puffy', token: c.token, ...(opts.ready ? { ready: true } : {}) }));
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'welcome') (c.id = m.id), c.welcomes++;
    if (m.t === 'room') c.room = m.room;
    if (m.t === 'snap') {
      m.at = Date.now();
      c.snaps.push(m);
      if (c.snaps.length > 600) c.snaps.shift();
    }
    c.onmsg?.(m);
  });
  ws.on('close', (code) => ((c.closed = true), (c.closeCode = code), c.onclose?.(code)));
  ws.on('error', () => {});
  return c;
}
const until = async (f, ms = 10000) => {
  const t = Date.now();
  while (!f()) {
    if (Date.now() - t > ms) return false;
    await sleep(20);
  }
  return true;
};
/** Two (or more) players in a fresh room, the battle started. */
async function battle(n = 2) {
  const code = room();
  const cs = [];
  for (let i = 0; i < n; i++) {
    cs.push(client(code, 'P' + i));
    await until(() => cs[i].id);
  }
  await until(() => cs[0].room?.phase === 'countdown');
  cs[0].send({ t: 'start' });
  await until(() => cs[0].room?.phase === 'battle', 8000);
  await until(() => cs[0].snaps.length > 0);
  return { code, cs };
}
/** Sends buttons every tick from `c` (b() gives them) until stopped. */
function driver(c, b, from = 0) {
  let seq = from;
  const t0 = Date.now();
  const iv = setInterval(() => {
    const due = from + Math.floor((Date.now() - t0) / (1000 / 30));
    while (seq < due) c.send({ t: 'in', s: ++seq, b: b(seq) });
  }, 8);
  return { stop: () => clearInterval(iv), get seq() { return seq; } };
}
const pos = (c, id) => {
  const s = c.snaps[c.snaps.length - 1];
  const p = s?.p.find((q) => q[0] === id);
  return p ? { x: p[2], y: p[3], ack: p[2 + 19], tick: s.k } : null;
};
const results = [];
const report = (name, ok, msg) => {
  results.push([name, ok]);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${msg}`);
};
const close = (cs) => cs.forEach((c) => c.ws.close());

/** Players (opts each) in a fresh room, in the countdown; logs every room state each gets (with the time). */
async function countdown(optsList) {
  const code = room();
  const cs = [];
  for (let i = 0; i < optsList.length; i++) {
    const c = client(code, 'R' + i, optsList[i]);
    c.rooms = [];
    c.onmsg = (m) => m.t === 'room' && c.rooms.push({ at: Date.now(), ...m.room });
    cs.push(c);
    await until(() => c.id);
  }
  await until(() => cs.every((c) => c.room?.phase === 'countdown'));
  return { code, cs };
}
/** `c` says it's ready (for the room as it last saw it), once, or every time `prep` changes. */
const sayReady = (c) => c.room && c.room.prep !== undefined && c.send({ t: 'ready', r: c.room.prep });
const autoReady = (c, delayMs = 0) => {
  let said = -1;
  const iv = setInterval(() => {
    if (c.room && c.room.prep !== said && c.room.phase === 'countdown') setTimeout(() => sayReady(c), delayMs), (said = c.room.prep);
  }, 20);
  return () => clearInterval(iv);
};
const heldMs = (c) => {
  const w = c.rooms.filter((r) => r.waiting > 0);
  return w.length ? { first: w[0].at, n: Math.max(...w.map((r) => r.waiting)) } : null;
};

const TESTS = {
  // ready: two games that say when they're ready — Start now waits (the room says how many it's waiting
  // for) until both have, then the last seconds run as usual
  async ready() {
    const { cs } = await countdown([{ ready: true }, { ready: true }]);
    const [a, b] = cs;
    const t0 = Date.now();
    a.send({ t: 'start' });
    const held = await until(() => a.room?.waiting === 2, 3000);
    await sleep(1500);
    const stillCounting = a.room.phase === 'countdown' && a.room.timer === 4;
    sayReady(a);
    await until(() => a.room?.waiting === 1, 2000);
    const one = a.room.waiting;
    const t1 = Date.now();
    sayReady(b);
    await until(() => a.room?.phase === 'battle', 8000);
    const after = Date.now() - t1;
    report('ready', held && stillCounting && one === 1 && a.room.phase === 'battle' && after > 3000 && after < 4500 && !('waiting' in a.room),
      `held for 2 (${held}), clock stood at ${a.room ? 4 : '?'} while held (${stillCounting}), then 1 after A said ready (${one}); battle ${after} ms after the last said ready (3.5 s expected); ${Date.now() - t0} ms in all`);
    close(cs);
  },
  // an older game (no ready in its hello) is never waited for; the new one beside it is
  async readyold() {
    {
      const { cs } = await countdown([{}, {}]);
      const t0 = Date.now();
      cs[0].send({ t: 'start' });
      await until(() => cs[0].room?.phase === 'battle', 8000);
      const ms = Date.now() - t0;
      report('readyold', cs[0].room.phase === 'battle' && ms < 4500 && !cs.some((c) => heldMs(c)), `two older games: battle ${ms} ms after Start now, never held (${!cs.some((c) => heldMs(c))})`);
      close(cs);
    }
    {
      const { cs } = await countdown([{}, { ready: true }]);
      const stop = autoReady(cs[1], 1000);
      const t0 = Date.now();
      cs[0].send({ t: 'start' });
      await until(() => cs[0].room?.phase === 'battle', 10000);
      const ms = Date.now() - t0;
      const h = heldMs(cs[0]);
      report('readyold-mixed', cs[0].room.phase === 'battle' && h && h.n === 1 && ms > 4300 && ms < 6000, `an older game and a new one (ready 1 s in): held for ${h ? h.n : 0}; battle ${ms} ms after Start now`);
      stop();
      close(cs);
    }
  },
  // a game that never says it's ready: held at most ~7 s, then the battle starts anyway
  async readycap() {
    const { cs } = await countdown([{ ready: true }, { ready: true }]);
    const stop = autoReady(cs[0]);
    const t0 = Date.now();
    cs[0].send({ t: 'start' });
    await until(() => cs[0].room?.phase === 'battle', 15000);
    const ms = Date.now() - t0;
    const h = heldMs(cs[0]);
    const ws = [...new Set(cs[0].rooms.filter((r) => r.waiting).map((r) => r.waiting))];
    const freed = cs[0].rooms.find((r) => r.phase === 'countdown' && !r.waiting && h && r.at > h.first);
    report('readycap', cs[0].room.phase === 'battle' && h && h.n >= 1 && ms > 10000 && ms < 11800 && !!freed, `held for ${h ? h.n : 0} (one never ready; waiting max); battle ${ms} ms after Start now (7 s cap + 3.5 s); the hold lifted for everyone (${!!freed}); waiting went ${ws.join(',')}`);
    stop();
    close(cs);
  },
  // a new player mid-countdown: everyone has a new hero to draw, so says ready again; one that drops
  // while it's waited for isn't waited for any more
  async readyprep() {
    const { code, cs } = await countdown([{ ready: true }, { ready: true }]);
    const stops = cs.map((c) => autoReady(c));
    await sleep(300);
    const p0 = cs[0].room.prep;
    const c = client(code, 'Late', { ready: true });
    await until(() => c.id && cs[0].room.prep !== p0, 3000);
    const bumped = cs[0].room.prep !== p0;
    cs[0].send({ t: 'start' });
    await until(() => cs[0].room?.waiting === 1, 3000);
    const waitingLate = cs[0].room.waiting === 1;
    const t1 = Date.now();
    c.ws.terminate();
    await until(() => cs[0].room?.phase === 'battle', 8000);
    const ms = Date.now() - t1;
    report('readyprep', bumped && waitingLate && cs[0].room.phase === 'battle' && ms < 4500, `prep ${p0} -> ${cs[0].room.prep} when a player came in (${bumped}); held for the newcomer (${waitingLate}); it dropped: battle ${ms} ms later`);
    stops.forEach((s) => s());
    close(cs);
  },
  // a player whose buttons stop coming (a tab put away, a phone frozen) but whose connection stays open
  async silent() {
    const { cs } = await battle(2);
    const [a, b] = cs;
    // running and firing, then their buttons stop (the connection stays open)
    const d = driver(a, () => 2 | 16 | 8);
    const db = driver(b, () => 0);
    await sleep(400);
    d.stop();
    await sleep(300);
    const from = b.snaps.length;
    await sleep(2000);
    const later = b.snaps.slice(from);
    const fired = later.reduce((n, s) => n + s.e.filter((e) => e.k === 'fire' && e.id === a.id).length, 0);
    const held = later[later.length - 1].p.find((q) => q[0] === a.id)[2 + 8];
    report('silent', !fired && !held, `in the 2 s after their buttons stopped (0.3 s on): still holding buttons ${held}, shots fired ${fired}`);
    db.stop();
    close(cs);
  },
  // after a reconnect (same page, same token), the first snapshots' ack for me
  async rejoin() {
    const { code, cs } = await battle(2);
    const [a, b] = cs;
    const d = driver(a, (s) => (s % 60 < 30 ? 2 : 1));
    const db = driver(b, () => 0);
    await sleep(800);
    const before = pos(b, a.id).ack;
    a.ws.terminate();
    d.stop();
    await sleep(300);
    // the same page coming back: its count of buttons goes on
    const a2 = client(code, 'P0', { token: a.token });
    await until(() => a2.id);
    const d2 = driver(a2, (s) => (s % 60 < 30 ? 2 : 1), d.seq);
    await sleep(600);
    const acks = a2.snaps.slice(0, 12).map((s) => s.p.find((q) => q[0] === a2.id)[2 + 19]);
    const zero = acks.filter((x) => x < before).length;
    report('rejoin', zero === 0, `ack before the drop ${before}; first acks after: ${acks.join(',')}`);
    d2.stop();
    db.stop();
    close([a2, b]);
  },
  // two tabs with the same ticket (a duplicated tab copies it): each knocks the other out, and both
  // reconnect as the game does
  async dupe() {
    const code = room();
    const token = 'dupe' + Math.random();
    const counts = { a: 0, b: 0 };
    const mk = (k) => {
      // (as the game does: reconnect; told its place was taken (4000), with a ticket of its own)
      let tok = token;
      const go = () => {
        const c = client(code, 'Twin', { token: tok });
        c.onmsg = (m) => m.t === 'welcome' && counts[k]++;
        c.onclose = (code) => {
          if (code === 4000) tok = 'own' + Math.random();
          if (!stop) setTimeout(go, 400);
        };
        all.push(c);
      };
      go();
    };
    const all = [];
    let stop = false;
    mk('a');
    await sleep(300);
    mk('b');
    await sleep(5000);
    stop = true;
    const live = all.filter((c) => !c.closed);
    const players = live[0]?.room?.players.length;
    report('dupe', counts.a + counts.b <= 3, `welcomes in 5 s: ${counts.a} + ${counts.b}; players in the room: ${players}`);
    close(all);
  },
  // nonsense from a client mid-battle
  async junk() {
    const { cs } = await battle(2);
    const [a, b] = cs;
    const db = driver(b, () => 0);
    const msgs = ['', 'null', '[]', '1', '"x"', '{', '{"t":"in"}', '{"t":"in","s":"5","b":2}', '{"t":"in","s":1e400,"b":2}', '{"t":"in","s":-5,"b":1e300}',
      '{"t":"hello"}', '{"t":"hello","name":{"a":1},"hero":[1],"token":{}}', '{"t":"hero","hero":null}', '{"t":"hero"}', '{"t":"name","name":null}',
      '{"t":"name","name":{"toString":1}}', '{"t":"ping"}', '{"t":"ping","c":{"a":[1,2,3]}}', '{"t":"start"}', '{"t":"__proto__"}', '{"__proto__":{"t":"in"}}', '{"t":"constructor"}', '{"t":"leave","x":1}'];
    for (const m of msgs) a.send(m);
    a.ws.send(Buffer.from([0, 1, 2, 255]));
    a.send('x'.repeat(5000)); // over maxPayload: closes that socket
    await sleep(800);
    const t0 = b.snaps[b.snaps.length - 1].k;
    await sleep(500);
    const t1 = b.snaps[b.snaps.length - 1].k;
    report('junk', t1 > t0 + 10 && b.room.phase === 'battle', `battle still ticking (${t0} → ${t1}), phase ${b.room.phase}`);
    db.stop();
    close(cs);
  },
  // a flood of buttons in one go (a phone's network coming back after 10 s: its buttons all arrive at once — or worse)
  async flood() {
    const { cs } = await battle(2);
    const [a, b] = cs;
    const db = driver(b, () => 0);
    await sleep(500);
    let s0 = 0;
    for (const [n, same] of [[300, 0], [5000, 0], [40000, 0], [5000, 1], [40000, 1]]) {
      const before = b.snaps.length;
      const t = Date.now();
      for (let i = 1; i <= n; i++) a.send({ t: 'in', s: ++s0, b: same ? 2 : i % 7 === 0 ? 4 : i % 3 });
      await sleep(1500);
      const s = b.snaps.slice(before);
      let gap = 0;
      for (let i = 1; i < s.length; i++) gap = Math.max(gap, s[i].at - s[i - 1].at);
      report('flood' + n + (same ? 'same' : ''), gap < 150, `${n} buttons at once: longest gap between snapshots ${gap} ms (sent in ${Date.now() - t - 1500 > 0 ? Date.now() - t - 1500 : 0} ms)`);
    }
    db.stop();
    close(cs);
  },
  // connecting and going again, very fast, as a broken page might
  async storm() {
    const code = room();
    const watcher = client(code, 'W');
    await until(() => watcher.id);
    const t = Date.now();
    for (let i = 0; i < 300; i++) {
      const c = client(code, 'S' + i, { token: 'storm' + (i % 5) });
      if (i % 2) setTimeout(() => c.ws.terminate(), 5);
      else c.open.then(() => c.ws.close());
      if (i % 20 === 0) await sleep(10);
    }
    await sleep(2000);
    const n = watcher.room.players.length;
    await sleep(9000);
    const n2 = watcher.room.players.length;
    report('storm', n2 <= 1 && !watcher.closed, `300 quick connections in ${Date.now() - t - 11000} ms: players listed after 2 s ${n}, after 11 s ${n2}; watcher still connected ${!watcher.closed}`);
    close([watcher]);
  },
};

(async () => {
  for (const [k, f] of Object.entries(TESTS)) {
    if (ONLY.length && !ONLY.includes(k)) continue;
    try {
      await f();
    } catch (e) {
      report(k, false, 'threw ' + e.stack);
    }
  }
  console.log(results.every((r) => r[1]) ? 'ALL OK' : 'SOME FAILED');
  process.exit(0);
})();
