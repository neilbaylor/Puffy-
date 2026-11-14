// A 2-player battle on the local server, both moving and shooting: a CPU profile of player A's page for
// 8 s mid-battle (top functions by self time), its frame times, and how big the server's messages are.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const room = 'prof' + Math.floor(Math.random() * 1e5);
  const mk = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.addInitScript(([n]) => {
      localStorage.setItem('puffy.name', n);
      window.__bytes = 0; window.__msgs = 0;
      const WS = window.WebSocket;
      window.WebSocket = function (...a) { const ws = new WS(...a); ws.addEventListener('message', (e) => { window.__msgs++; window.__bytes += typeof e.data === 'string' ? e.data.length : e.data.byteLength || e.data.size || 0; }); return ws; };
      window.WebSocket.prototype = WS.prototype; Object.assign(window.WebSocket, { OPEN: 1, CLOSED: 3, CONNECTING: 0, CLOSING: 2 });
    }, [name]);
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]'); await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 30000 });
    return p;
  };
  const a = await mk('Neil');
  const c = await mk('Henry');
  await c.evaluate(() => document.querySelector('.bl-start')?.click());
  await Promise.all([a, c].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  // keep both busy: running about, jumping, shooting
  const busy = (p, dir) => p.evaluate((dir) => { let t = 0; setInterval(() => { t++; const k = (c, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, bubbles: true })); k(t % 60 < 30 ? 'ArrowRight' : 'ArrowLeft', true); k(t % 60 < 30 ? 'ArrowLeft' : 'ArrowRight', false); k('ArrowUp', t % 9 < 2); k('KeyX', t % 4 < 2); }, 50); }, dir);
  await busy(a); await busy(c);
  await a.waitForTimeout(20000); // (let bad guys and drops arrive)
  // GPU work per second: draw calls, and texture uploads with who made them
  const gl = await a.evaluate(() => new Promise((done) => {
    const g = window.game.renderer.gl;
    let draws = 0, ups = 0; const who = new Map();
    const wrap = (name, count) => { const f = g[name].bind(g); g[name] = (...x) => { count(new Error().stack); return f(...x); }; };
    wrap('drawElements', () => draws++); wrap('drawArrays', () => draws++);
    const up = (st) => { ups++; const k = st.split('\n').slice(5, 12).map((l) => l.trim().replace(/\(.*\/(.*?):(\d+):\d+\)/, '$1:$2')).join(' < '); who.set(k, (who.get(k) || 0) + 1); };
    wrap('texImage2D', up); wrap('texSubImage2D', up);
    const f0 = window.game.loop.frame;
    setTimeout(() => done({ framesIn3s: window.game.loop.frame - f0, drawsPerFrame: Math.round(draws / Math.max(1, window.game.loop.frame - f0)), uploadsPerSec: (ups / 3).toFixed(1), from: [...who.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6) }), 3000);
  }));
  console.log(JSON.stringify(gl, null, 1));
  const cdp = await a.context().newCDPSession(a);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await a.evaluate(() => { window.__ft = []; window.__bytes = 0; window.__msgs = 0; let l = performance.now(); const f = () => { const n = performance.now(); window.__ft.push(n - l); l = n; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await cdp.send('Profiler.start');
  await a.waitForTimeout(8000);
  const { profile } = await cdp.send('Profiler.stop');
  const st = await a.evaluate(() => { const f = window.__ft.slice(5).sort((x, y) => x - y); const s = window.game.scene.getScene('Battle'); const last = s.snaps.at(-1); return { frames: f.length, median: f[f.length >> 1].toFixed(1), p95: f[Math.floor(f.length * 0.95)].toFixed(1), msgs: window.__msgs, kbPerSec: (window.__bytes / 1024 / 8).toFixed(1), enemies: last.enemies.length, rockets: last.rockets.length, objects: s.children.list.length }; });
  // self time per function
  const self = new Map();
  const total = profile.samples.length;
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const counts = new Map();
  for (const s of profile.samples) counts.set(s, (counts.get(s) || 0) + 1);
  for (const [id, n] of counts) { const nd = byId.get(id); const cf = nd.callFrame; const key = `${cf.functionName || '(anon)'} ${(cf.url.split('/').pop() || '').slice(0, 30)}:${cf.lineNumber}`; self.set(key, (self.get(key) || 0) + n); }
  const top = [...self.entries()].sort((x, y) => y[1] - x[1]).slice(0, 25).map(([k, n]) => `${(100 * n / total).toFixed(1).padStart(5)}%  ${k}`);
  await a.screenshot({ path: 'shots/bprof.png' });
  console.log(JSON.stringify(st));
  console.log(top.join('\n'));
  await b.close();
})();
