// Phone-life in a battle, two games (A and B) in Chromium: A's tab put away and back, A's page frozen
// (as iOS does to a backgrounded Safari) and back, A's connection dropped, and a duplicated tab of A's
// in the lobby. Checks what B sees of A meanwhile and how A's own hero looks after.
// node tphone.cjs <port> [hide,freeze,drop,dupe]   (server: BATTLE_COUNTDOWN=600 BATTLE_SECS=90; light mode)
const { chromium } = require('playwright');
const PORT = Number(process.argv[2] || 8391);
const ONLY = (process.argv[3] || 'hide,freeze,drop,dupe').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
const report = (name, ok, msg) => {
  out.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${msg}`);
};

// what a page records each frame: its own hero as drawn, the others as drawn, and the server's word for each
const INSTRUMENT = () => {
  const s = window.game.scene.getScene('Battle');
  const m = (window.__m = { frames: [], ev: [], fx: 0, snd: 0, lost: [], welcomes: 0 });
  window.__btn = 0;
  s.buttons = () => window.__btn;
  const pe = s.playEvents.bind(s);
  // (events shown and heard, per frame: not those caught up quietly)
  let loud = 0;
  s.playEvents = (evs, ...r) => {
    for (const e of evs) m.ev.push([performance.now(), e.k, e.id ?? null]);
    if (!r[0]) loud += evs.filter((e) => e.k !== 'jump').length;
    return pe(evs, ...r);
  };
  // (effects started, per frame)
  let nfx = 0;
  for (const k of ['explosion', 'popText', 'stars', 'muzzle', 'dust', 'fluffBurst', 'sparkle', 'debris']) {
    const f = s.fx[k].bind(s.fx);
    s.fx[k] = (...a) => (nfx++, k === 'explosion' && m.fx++, f(...a));
  }
  s.events.on('postupdate', () => {
    const v = s.views.get(s.net.myId);
    const o = {};
    for (const [id, w] of s.views) if (id !== s.net.myId) o[id] = [Math.round(w.sprite.x), Math.round(w.sprite.y), w.sprite.visible ? 1 : 0];
    const lost = document.querySelector('.bhud-lost');
    m.frames.push([performance.now(), v ? Math.round(v.sprite.x * 10) / 10 : null, v ? Math.round(v.sprite.y * 10) / 10 : null, o, s.me ? s.me.respawn : 0, lost && !lost.hidden ? 1 : 0, Math.round(Math.hypot(s.fix.x, s.fix.y)), nfx, loud]);
    nfx = loud = 0;
    if (m.frames.length > 4000) m.frames.splice(0, 1000);
  });
};

(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const errs = [];
  const room = 'ph' + Math.floor(Math.random() * 1e6);
  const mk = async (name, ctx) => {
    ctx ??= await br.newContext({ viewport: { width: 640, height: 300 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.addInitScript(([n]) => (localStorage.setItem('puffy.name', n), localStorage.setItem('puffy.light', '1'), localStorage.setItem('puffy.lightRetried', '1')), [name]);
    await p.goto(`http://localhost:${PORT}/`);
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    return p;
  };
  const join = async (p) => {
    await p.click('[data-act=battle]');
    await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 60000 });
  };
  const A = await mk('Alpha');
  const B = await mk('Bravo');
  await join(A);
  await join(B);

  if (ONLY.includes('dupe')) {
    // A's tab duplicated in the lobby: the copy has A's ticket (sessionStorage is copied)
    const tok = await A.evaluate(() => sessionStorage.getItem('puffy.battle.token'));
    const C = await mk('Alpha', A.context());
    await C.evaluate((t) => sessionStorage.setItem('puffy.battle.token', t), tok);
    const count = () => {
      // (each time the game was let in again)
      const n = window.__battle?.net;
      if (!n || n.__w !== undefined) return;
      n.__w = 0;
      const os = n.onStatus;
      n.onStatus = (st) => {
        if (st === 'online') n.__w++;
        os(st);
      };
    };
    await A.evaluate(count);
    await join(C);
    await C.evaluate(count);
    await sleep(5000);
    const a = await A.evaluate(() => ({ id: window.__battle.net.myId, n: window.__battle.net.__w, players: window.__battle.net.room?.players.map((p) => p.id + ':' + p.name + (p.connected ? '' : '(off)')) }));
    const c = await C.evaluate(() => ({ id: window.__battle.net.myId, n: window.__battle.net.__w, status: window.__battle.net.status }));
    report('dupe', a.n + c.n <= 2 && a.id !== c.id, `in 5 s A was let in again ${a.n}×, the copy ${c.n}× (A ${a.id}, copy ${c.id} ${c.status}); room: ${a.players.join(', ')}`);
    await C.evaluate(() => window.__battle.leave());
    await C.close();
    await sleep(500);
  }

  await A.evaluate(() => document.querySelector('.bl-startnow')?.click());
  await Promise.all([A, B].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  await sleep(1500);
  await A.evaluate(INSTRUMENT);
  await B.evaluate(INSTRUMENT);
  const aId = await A.evaluate(() => window.game.scene.getScene('Battle').net.myId);
  // B stands still; A runs to and fro, firing
  await A.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    let dir = 2;
    setInterval(() => {
      if (s.me && s.me.x < 300) dir = 2;
      if (s.me && s.me.x > s.map.widthPx - 300) dir = 1;
      if (s.me && Math.abs(s.me.vx) < 5 && s.me.onGround && Math.random() < 0.3) dir = 3 - dir;
      window.__btn = dir | 16 | 8 | (performance.now() % 1000 < 150 ? 4 : 0);
    }, 50);
  });
  // what B sees A doing in a window of time (moved px, A's shots)
  const bSees = (t0, t1) =>
    B.evaluate(([id, t0, t1]) => {
      const m = window.__m;
      let moved = 0;
      let last = null;
      for (const f of m.frames) {
        if (f[0] < t0 || f[0] > t1 || !f[3][id]) continue;
        if (last && f[4] <= 0) moved += Math.hypot(f[3][id][0] - last[0], f[3][id][1] - last[1]);
        last = f[3][id];
      }
      const shots = m.ev.filter((e) => e[0] >= t0 && e[0] <= t1 && e[1] === 'fire' && e[2] === id).length;
      return { moved: Math.round(moved), shots };
    }, [aId, t0, t1]);
  // A's own hero as drawn, from a moment: the biggest jump between two frames, and corrections
  const aAfter = (t0, ms) =>
    A.evaluate(([t0, ms]) => {
      const m = window.__m;
      const fr = m.frames.filter((f) => f[0] >= t0 && f[0] <= t0 + ms && f[1] !== null && f[4] <= 0);
      let jump = 0;
      for (let i = 1; i < fr.length; i++) jump = Math.max(jump, Math.hypot(fr[i][1] - fr[i - 1][1], fr[i][2] - fr[i - 1][2]));
      const lost = m.frames.filter((f) => f[0] >= t0 && f[0] <= t0 + ms && f[5]).length;
      const all = m.frames.filter((f) => f[0] >= t0 && f[0] <= t0 + ms);
      return { frames: fr.length, jump: Math.round(jump), fix: Math.max(0, ...fr.map((f) => f[6])), lost, fx: m.fx, fxMax: Math.max(0, ...all.map((f) => f[7])), loudMax: Math.max(0, ...all.map((f) => f[8])) };
    }, [t0, ms]);
  const bNow = () => B.evaluate(() => performance.now());
  const aNow = () => A.evaluate(() => performance.now());
  await sleep(2000);

  if (ONLY.includes('hide')) {
    // a desktop tab put away (Phaser stops its loop: no buttons sent), connection open
    const fx0 = await A.evaluate(() => window.__m.fx);
    await A.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      // (a hidden tab gets no animation frames: the game's loop stops)
      window.game.loop.sleep();
    });
    const t0 = await bNow();
    await sleep(4000);
    const t1 = await bNow();
    const away = await bSees(t0 + 700, t1);
    const ta = await aNow();
    await A.evaluate(() => {
      window.game.loop.wake();
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await sleep(2500);
    const back = await aAfter(ta, 2500);
    report('hide', away.moved < 150 && away.shots === 0, `tab away 4 s: B saw A move ${away.moved} px and fire ${away.shots} shots (from 0.7 s on); back: A's own hero fix max ${back.fix} px, explosions in 2.5 s ${back.fx - fx0}, most effects in one frame ${back.fxMax}, most events shown in one frame ${back.loudMax}, lost-card frames ${back.lost}`);
  }

  if (ONLY.includes('freeze')) {
    // iOS-style: the page frozen (no script at all), the connection left open
    // (Chromium won't freeze a page in the foreground: the game's loop is stopped and the messages the
    // connection brings are held back, then all handed over at once, as a woken page gets them)
    const fx0 = await A.evaluate(() => window.__m.fx);
    await A.evaluate(() => {
      window.game.loop.sleep();
      const ws = window.game.scene.getScene('Battle').net.ws;
      const held = (window.__held = []);
      window.__om = ws.onmessage;
      ws.onmessage = (e) => held.push(e);
    });
    const t0 = await bNow();
    await sleep(5000);
    const t1 = await bNow();
    const away = await bSees(t0 + 700, t1);
    const ta = await aNow();
    const nHeld = await A.evaluate(() => {
      const ws = window.game.scene.getScene('Battle').net.ws;
      ws.onmessage = window.__om;
      for (const e of window.__held) window.__om(e);
      window.game.loop.wake();
      return window.__held.length;
    });
    console.log('  (' + nHeld + ' messages handed over at once on waking)');
    await sleep(3000);
    const back = await aAfter(ta, 3000);
    report('freeze', away.moved < 150 && away.shots === 0, `page frozen 5 s: B saw A move ${away.moved} px and fire ${away.shots} shots; back: A's hero fix max ${back.fix} px, explosions in 3 s ${back.fx - fx0}, most effects in one frame ${back.fxMax}, most events shown in one frame ${back.loudMax}, lost-card frames ${back.lost}`);
  }

  if (ONLY.includes('drop')) {
    // the connection drops (a lift, a tunnel): the game reconnects with its ticket and plays on
    const ta = await aNow();
    await A.evaluate(() => window.game.scene.getScene('Battle').net.ws.close());
    await sleep(3000);
    const back = await aAfter(ta, 3000);
    const st = await A.evaluate(() => ({ status: window.game.scene.getScene('Battle').net.status, inBattle: window.__battle.inBattle, me: !!window.game.scene.getScene('Battle').me }));
    const gaps = await A.evaluate((ta) => {
      const f = window.__m.frames.filter((x) => x[0] >= ta && x[1] !== null);
      return f.length;
    }, ta);
    report('drop', st.status === 'online' && st.inBattle, `after a dropped connection: ${st.status}, still in the battle ${st.inBattle}; A's hero fix max ${back.fix} px, biggest jump between frames ${back.jump} px, lost-card frames ${back.lost}, frames ${gaps}`);
  }
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  console.log(out.every(Boolean) && !errs.length ? 'ALL OK' : 'SOME FAILED');
  await br.close();
  process.exit(0);
})();
