// Battle latency measurements: 2 games in Chromium (A measured, B the other player) + optional
// headless bots, all through the delay proxy.
// node meas.cjs --port 8094 --proxy 8095 --lag 50 --jit 15 --spike 0.02 --spikeMs 60 --bots 0 --fight 25 --out res.json
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { bot } = require('./bot.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', 8094));
const PROXY = Number(arg('proxy', 8095));
const LAG = Number(arg('lag', 0));
const JIT = Number(arg('jit', 0));
const SPIKE = Number(arg('spike', 0));
const SPIKE_MS = Number(arg('spikeMs', 0));
const BOTS = Number(arg('bots', 0));
const FIGHT = Number(arg('fight', 25));
const PROBES = Number(arg('probes', 12));
const OUT = arg('out', null);
const proxied = (who) => `ws://localhost:${PROXY}/battle?lag=${LAG}&jit=${JIT}&spike=${SPIKE}&spikeMs=${SPIKE_MS}&who=${who}`;

// ── what each page records ──
const INSTRUMENT = () => {
  const s = window.game.scene.getScene('Battle');
  const now = () => performance.timeOrigin + performance.now();
  const m = (window.__m = { frames: [], corr: [], ev: [], shots: [], probes: [], snaps: [], myId: s.net.myId });
  window.__btn = 0;
  window.__mode = 'still';
  s.buttons = () => window.__btnFn ? window.__btnFn() : window.__btn;
  // what my phone had me at after each tick (by seq), to compare with the server's word
  const hist = new Map();
  m.div = [];
  const lt = s.localTick.bind(s);
  s.localTick = (...a) => {
    lt(...a);
    if (s.me) hist.set(s.seq, [s.me.x, s.me.y]);
    if (hist.size > 300) hist.delete(hist.keys().next().value);
  };
  const rec = s.reconcile.bind(s);
  s.reconcile = (snap) => {
    const b = s.me && s.me.respawn <= 0 ? { x: s.me.x, y: s.me.y } : null;
    const mine = snap.players.find((p) => p.id === s.net.myId);
    if (mine && hist.has(mine.ack) && mine.respawn <= 0) {
      const h = hist.get(mine.ack);
      const d = Math.hypot(h[0] - mine.x, h[1] - mine.y);
      if (d > 0.5) m.div.push([now(), snap.tick, mine.ack, Math.round((h[0] - mine.x) * 100) / 100, Math.round((h[1] - mine.y) * 100) / 100, s.seq]);
    }
    rec(snap);
    if (b && s.me && s.me.respawn <= 0) m.corr.push([now(), Math.round((b.x - s.me.x) * 100) / 100, Math.round((b.y - s.me.y) * 100) / 100, s.pending.length, Math.round(s.net.rtt)]);
  };
  const pe = s.playEvents.bind(s);
  s.playEvents = (evs, ...rest) => {
    const t = now();
    for (const e of evs) if (['hit', 'boom', 'ko', 'prize', 'stomp', 'fire', 'spawn'].includes(e.k)) m.ev.push([t, e.k, e.id ?? null, e.by ?? null, e.x ?? null, e.y ?? null]);
    return pe(evs, ...rest);
  };
  const fs0 = s.flyShots.bind(s);
  s.flyShots = (...a) => {
    const open = s.shots.filter((q) => q.hit === null);
    const r = fs0(...a);
    for (const q of open) if (q.hit !== null) m.shots.push([now(), Math.round(q.r.x), Math.round(q.r.y), q.r.kind, q.n]);
    return r;
  };
  m.shotN0 = s.shotN;
  m.grabs = [];
  if (s.grabPrizes) {
  const gp = s.grabPrizes.bind(s);
  s.grabPrizes = (me) => {
    const before = new Set(s.myGrabs.keys());
    gp(me);
    for (const [pid, g] of s.myGrabs) if (!before.has(pid)) m.grabs.push([now(), pid, g.kind, Math.round(g.x), Math.round(g.y)]);
  };
  m.ungrab = 0;
  const cg = s.checkGrabs.bind(s);
  s.checkGrabs = () => {
    const before = new Set(s.grabbed);
    cg();
    for (const pid of before) if (!s.grabbed.has(pid)) m.ungrab++;
  };
  }
  const nl = s.noteLateness.bind(s);
  s.noteLateness = (snap) => {
    m.snaps.push([Math.round((snap.at - snap.tick * 1000 / 30) * 10) / 10, snap.tick]);
    return nl(snap);
  };
  m.phantom = 0;
  m.released = 0;
  const ts0 = s.tieShots.bind(s);
  s.tieShots = (...a) => {
    const before = s.shots.filter((q) => q.sid === null);
    const stopped = new Set(s.shots.filter((q) => q.onHero).map((q) => q.n));
    ts0(...a);
    for (const q of before) if (!s.shots.includes(q) && q.sid === null) m.phantom++;
    for (const q of s.shots) if (stopped.has(q.n) && !q.onHero) m.released++;
  };
  // snapshot arrivals
  const origPush = s.net.inbox.push;
  let lastLen = 0;
  s.events.on('postupdate', () => {
    const me = s.me;
    const v = s.views.get(s.net.myId);
    const o = {};
    for (const [id, w] of s.views) if (id !== s.net.myId) o[id] = [Math.round(w.sprite.x * 10) / 10, Math.round(w.sprite.y * 10) / 10, w.sprite.visible ? 1 : 0];
    m.frames.push([
      now(),
      v ? Math.round(v.sprite.x * 10) / 10 : null,
      v ? Math.round(v.sprite.y * 10) / 10 : null,
      me ? Math.round(me.x * 10) / 10 : null,
      me ? Math.round(me.y * 10) / 10 : null,
      Math.round(Math.hypot(s.fix.x, s.fix.y) * 10) / 10,
      o,
      me ? me.respawn : 0,
      Math.round((s.interp ?? (3 + (s.extraDelay ?? 0))) * 100) / 100,
      s.snaps.length ? s.snaps[s.snaps.length - 1].tick : 0,
      s.otherClock ? Math.round(s.otherClock.tick * 100) / 100 : null,
      v ? (v.sprite.visible ? 1 : 0) : 0,
      me ? (me.onGround ? 1 : 0) : 0,
      (() => {
        // the nearest rocket of someone else's, ahead of my hero on screen (dx, dy)
        if (!v) return null;
        let best = null;
        for (const [id, img] of s.rocketViews) {
          if (id < 0) continue;
          const dx = img.x - v.sprite.x;
          const dy = img.y - (v.sprite.y - 20);
          if (Math.abs(dy) > 40) continue;
          if (!best || Math.abs(dx) < Math.abs(best[0])) best = [Math.round(dx), Math.round(dy)];
        }
        return best;
      })(),
    ]);
  });
};

// A presses a button from standing still and waits for the hero to move on screen.
const PROBE = (kind) =>
  new Promise((done) => {
    const s = window.game.scene.getScene('Battle');
    const v = s.views.get(s.net.myId);
    const me = s.me;
    if (!v || !me || me.respawn > 0 || !me.onGround || me.stun > 0 || Math.abs(me.vx) > 1) return done(null);
    const x0 = v.sprite.x;
    const y0 = v.sprite.y;
    const dirBit = kind === 'right' ? 2 : kind === 'left' ? 1 : 4;
    // a random moment between frames
    setTimeout(() => {
      const t0 = performance.now();
      window.__btn = dirBit;
      const f = () => {
        const dx = v.sprite.x - x0;
        const dy = v.sprite.y - y0;
        const moved = kind === 'right' ? dx > 0.5 : kind === 'left' ? dx < -0.5 : dy < -1;
        if (moved || performance.now() - t0 > 500) {
          s.events.off('postupdate', f);
          const ms = performance.now() - t0;
          setTimeout(() => {
            window.__btn = 0;
            done(moved ? ms : -1);
          }, kind === 'jump' ? 120 : 160);
        }
      };
      s.events.on('postupdate', f);
    }, Math.random() * 40);
  });

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const errs = [];
  const room = 'lat' + Math.floor(Math.random() * 1e6);
  const mk = async (name) => {
    const ctx = await b.newContext({ viewport: { width: Number(arg('vw', 480)), height: Number(arg('vh', 240)) }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.addInitScript(([n]) => (localStorage.setItem('puffy.name', n), localStorage.setItem('puffy.light', '1')), [name]);
    await p.goto(`http://localhost:${PORT}/?server=${encodeURIComponent(proxied(name))}`);
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]');
    await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 30000 });
    return p;
  };
  const A = await mk('Alpha');
  const B = await mk('Bravo');
  const bots = [];
  for (let i = 0; i < BOTS; i++) bots.push(bot(proxied('bot' + i) + `&room=${room}`, 'Bot' + i));
  await new Promise((r) => setTimeout(r, 800));
  await A.evaluate(() => document.querySelector('.bl-startnow')?.click());
  await Promise.all([A, B].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  await A.waitForTimeout(1200);
  await A.evaluate(INSTRUMENT);
  await B.evaluate(INSTRUMENT);
  await fetch(`http://localhost:${PROXY}/reset`).catch(() => {});
  const tReset = Date.now();
  // B wanders: runs one way then the other, jumps now and then
  await B.evaluate(() => {
    let dir = 1;
    let next = 0;
    let run = 0;
    window.__btnFn = () => {
      const t = performance.now() / 1000;
      if (t > next) {
        next = t + 0.45 + Math.random() * 1.1;
        dir = Math.random() < 0.65 ? -dir : dir;
        run = Math.random() < 0.4 ? 16 : 0;
      }
      const s = window.game.scene.getScene('Battle');
      // turn round at the arena's ends
      if (s.me && s.me.x < 200) dir = 1;
      if (s.me && s.me.x > s.map.widthPx - 200) dir = -1;
      return (dir > 0 ? 2 : 1) | run | (t % 1.3 < 0.25 ? 4 : 0);
    };
  });
  // ── phase 1: A presses from standing still ──
  const probes = { right: [], left: [], jump: [] };
  const t1 = Date.now();
  for (let i = 0; i < PROBES * 3 && Date.now() - t1 < 40000; i++) {
    const kind = ['right', 'left', 'jump'][i % 3];
    await A.waitForTimeout(450 + Math.random() * 200);
    const r = await A.evaluate(PROBE, kind);
    if (r !== null) probes[kind].push(Math.round(r * 10) / 10);
    await A.waitForTimeout(kind === 'jump' ? 900 : 250);
  }
  // ── phase 2: A goes after B: runs at them, turns to face them, fires ── (or, --prizes, after the prizes)
  if (arg('prizes', '0') === '1') await A.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    window.__btnFn = () => {
      const me = s.me;
      const zs = (s.snaps.length ? s.snaps[s.snaps.length - 1].prizes : []).filter((z) => !s.grabbed.has(z[0]));
      if (!me || !zs.length) return 0;
      let z = zs[0];
      for (const q of zs) if (Math.abs(q[2] - me.x) + Math.abs(q[3] - me.y) < Math.abs(z[2] - me.x) + Math.abs(z[3] - me.y)) z = q;
      const dx = z[2] - me.x;
      const dy = z[3] - me.y;
      const tt = performance.now() / 1000;
      const hop = ((Math.abs(me.vx) < 30 && Math.abs(dx) > 20) || dy < -40 || !me.onGround) && tt % 0.45 < 0.22 ? 4 : 0;
      return (Math.abs(dx) < 6 ? 0 : dx > 0 ? 2 : 1) | 16 | hop;
    };
  });
  else await A.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    window.__btnFn = () => {
      const me = s.me;
      const o = [...s.views.entries()].find(([id, w]) => id !== s.net.myId && w.sprite.visible);
      if (!me || !o) return 0;
      const ox = o[1].sprite.x;
      const oy = o[1].sprite.y;
      const dx = ox - me.x;
      const dy = oy - me.y;
      const toward = dx > 0 ? 2 : 1;
      const tt = performance.now() / 1000;
      const hop = (Math.abs(me.vx) < 30 || !me.onGround) && tt % 0.45 < 0.22 ? 4 : 0;
      if (Math.abs(dy) < 40) {
        if (Math.abs(dx) > 330) return toward | 16 | hop;
        if (Math.sign(dx) !== me.facing) return toward;
        return 8; // fire (held)
      }
      return toward | hop | (performance.now() % 900 < 200 ? 4 : 0);
    };
  });
  // B: comes within range of A and dodges about there (walks to and fro, no jumping unless A's above or below)
  await B.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    let flip = 0;
    let dir = 1;
    window.__btnFn = () => {
      const me = s.me;
      const o = [...s.views.entries()].find(([id, w]) => id !== s.net.myId && w.sprite.visible);
      if (!me || !o) return 0;
      const dx = o[1].sprite.x - me.x;
      const dy = o[1].sprite.y - me.y;
      const t = performance.now() / 1000;
      const hop = (Math.abs(me.vx) < 30 || !me.onGround) && t % 0.45 < 0.22 ? 4 : 0;
      if (Math.abs(dx) > 300) return (dx > 0 ? 2 : 1) | hop | (Math.abs(dy) > 40 && t % 1.1 < 0.3 ? 4 : 0);
      if (t > flip) {
        flip = t + 0.35 + Math.random() * 0.6;
        dir = Math.random() < 0.5 ? 1 : -1;
      }
      if (Math.abs(dx) < 140) dir = dx > 0 ? -1 : 1;
      return (dir > 0 ? 2 : 1) | (Math.abs(dy) > 40 && t % 1.1 < 0.3 ? 4 : 0);
    };
  });
  const tf = Date.now();
  const cpu0 = process.cpuUsage();
  await A.waitForTimeout(FIGHT * 1000);
  const dur = (Date.now() - tf) / 1000;
  await A.evaluate(() => (window.__btnFn = null));
  await B.evaluate(() => (window.__btnFn = null));
  const stats = await (await fetch(`http://localhost:${PROXY}/stats`)).json().catch(() => []);
  const netDur = (Date.now() - tReset) / 1000;
  const grab = () => {
    const s = window.game.scene.getScene('Battle');
    window.__m.shotN = s.shotN;
    return window.__m;
  };
  const mA = await A.evaluate(grab);
  const mB = await B.evaluate(grab);
  const res = { cfg: { PORT, LAG, JIT, SPIKE, SPIKE_MS, BOTS, FIGHT }, probes, A: mA, B: mB, stats: stats.filter((c) => /Alpha|Bravo|bot/.test(c.who)).slice(-2 - BOTS), errs, tStart: t1, tFight: tf, dur, netDur };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res));
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  for (const x of bots) x.leave();
  await b.close();
  process.exit(0);
})();
