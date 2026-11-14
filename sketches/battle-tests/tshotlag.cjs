// How long from pressing fire to seeing your shot leave the bazooka (2-player battle, local server):
// for each press, the time until a rocket of yours is drawn, and how far it is from you then.
// Arg: extra one-way delay (ms) added to everything the server sends this player (a slower network).
const { chromium } = require('playwright');
const LAG = Number(process.argv[2] || 0);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const room = 'shot' + Math.floor(Math.random() * 1e5);
  const mk = async (name, lag) => {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.addInitScript(([n, lag]) => {
      localStorage.setItem('puffy.name', n);
      if (lag) {
        // (a slow network: every message from the server reaches this page `lag` ms late)
        const WS = window.WebSocket;
        window.WebSocket = function (...a) {
          const ws = new WS(...a);
          const add = ws.addEventListener.bind(ws);
          ws.addEventListener = (t, f, o) => add(t, t === 'message' ? (e) => setTimeout(() => f(e), lag) : f, o);
          Object.defineProperty(ws, 'onmessage', { set(f) { add('message', (e) => setTimeout(() => f(e), lag)); } });
          return ws;
        };
        window.WebSocket.prototype = WS.prototype;
        Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
      }
    }, [name, lag]);
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]'); await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 30000 });
    return p;
  };
  const a = await mk('Neil', LAG);
  const c = await mk('Henry', 0);
  await c.evaluate(() => document.querySelector('.bl-start')?.click());
  await Promise.all([a, c].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  await a.waitForTimeout(1500);
  const res = [];
  for (let i = 0; i < 6; i++) {
    const r = await a.evaluate(() => new Promise((done) => {
      const s = window.game.scene.getScene('Battle');
      const before = new Set(s.rocketViews.keys());
      const t0 = performance.now();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', key: 'x', bubbles: true }));
      const tick = () => {
        const fresh = [...s.rocketViews.entries()].find(([id]) => !before.has(id));
        if (fresh) {
          const me = s.views.get(s.net.myId)?.sprite;
          window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', key: 'x', bubbles: true }));
          return done({ ms: Math.round(performance.now() - t0), from: me ? Math.round(Math.abs(fresh[1].x - me.x)) : -1 });
        }
        if (performance.now() - t0 > 2000) return done({ ms: -1 });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    res.push(r);
    await a.waitForTimeout(900);
  }
  console.log('lag', LAG, 'ms → press to shot drawn:', res.map((r) => `${r.ms} ms (${r.from}px out)`).join(', '));
  await b.close();
})();
