// usage: node playuploads.mjs <port> <part> [secs] [throttle]  -> perf.mjs, plus every texture upload while a bot runs through the Part (count, size and where from)
import { chromium } from 'playwright';
const [port, part = '1', secs = '10', thr = '4'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...(process.env.CPU2D ? ['--disable-accelerated-2d-canvas'] : [])] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1'); });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(thr) });
const t0 = Date.now();
await p.goto(`http://localhost:${port}/`);
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
const bootMs = Date.now() - t0;
const boot = await p.evaluate(() => window.__boot);
await p.evaluate((n) => { const el = document.querySelector(`.lvl[data-lvl="${n}"]`); el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el?.click(); }, part);
await p.waitForTimeout(1500);
const t1 = Date.now();
await p.click('[data-act=play]');
await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 300000 });
const startMs = Date.now() - t1;
await p.evaluate(() => window.game.events.emit('skip-intro'));
await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 120000 });
await p.waitForTimeout(1000);
await p.evaluate(() => {
  const g = window.game.scene.getScene('Game');
  const pl = g.players[0];
  pl.invulnUntil = 1e15;
  let f = 0;
  pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: true, jump: f++ % 50 < 12, fire: f % 20 < 3, run: true, bomb: false }) };
  window.__ft = [];
  let l = performance.now();
  const tick = () => { const n = performance.now(); window.__ft.push(n - l); l = n; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await p.evaluate(() => {
  window.__up = new Map();
  for (const P of [WebGLRenderingContext.prototype, window.WebGL2RenderingContext?.prototype].filter(Boolean)) {
    for (const fn of ['texImage2D', 'texSubImage2D']) {
      const orig = P[fn];
      P[fn] = function (...a) {
        const src = a.find((x) => x && typeof x === 'object' && 'width' in x && !(x instanceof ArrayBuffer));
        const st = (new Error().stack || '').split('\n').slice(2, 9).map((s) => s.trim().replace(/^at /, '').replace(/\(?http[^)]*\/([^/]+):(\d+):\d+\)?/, '@$2')).join(' < ');
        const key = fn + ' ' + (src ? src.constructor.name + ' ' + src.width + 'x' + src.height : 'data ' + a[3] + 'x' + a[4]) + ' | ' + st;
        window.__up.set(key, (window.__up.get(key) || 0) + 1);
        return orig.apply(this, a);
      };
    }
  }
});
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
await cdp.send('Profiler.start');
await p.waitForTimeout(Number(secs) * 1000);
const { profile } = await cdp.send('Profiler.stop');
const st = await p.evaluate(() => { const f = window.__ft.slice(10).sort((x, y) => x - y); const g = window.game.scene.getScene('Game'); return { frames: f.length, median: +f[f.length >> 1].toFixed(1), p90: +f[Math.floor(f.length * 0.9)].toFixed(1), x: Math.round(g.players[0].x), objects: g.children.list.length }; });
const self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dts = profile.timeDeltas;
let total = 0;
profile.samples.forEach((s, i) => {
  const cf = byId.get(s).callFrame;
  const key = `${cf.functionName || '(anon)'} ${(cf.url.split('/').pop() || '').slice(0, 24)}:${cf.lineNumber}:${cf.columnNumber}`;
  self.set(key, (self.get(key) || 0) + dts[i]);
  total += dts[i];
});
const top = [...self.entries()].sort((x, y) => y[1] - x[1]).slice(0, Number(process.env.TOP || 22)).map(([k, v]) => `${((100 * v) / total).toFixed(1).padStart(5)}%  ${k}`);
console.log(JSON.stringify({ part, throttle: thr, bootMs, startMs, ...st, errs: errs.slice(0, 3) }));
if (process.env.BOOT) console.log(JSON.stringify(boot));
console.log(top.join('\n'));
console.log('UPLOADS during the run:');
console.log((await p.evaluate(() => [...window.__up.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => v + '  ' + k))).join('\n'));
await b.close();
