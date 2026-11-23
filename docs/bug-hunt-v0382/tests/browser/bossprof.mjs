// usage: node bossprof.mjs <port> <boss> [secs] [throttle] -> a boss from the Bosses menu (dev device), intro skipped: frame times and the top self-time functions while it plays
import { chromium } from 'playwright';
const [port, boss = '6', secs = '12', thr = '4'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript((l) => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.light', l); localStorage.setItem('puffy.lightRetried', '1'); }, process.env.LIGHT ? '1' : '0');
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const cdp = await ctx.newCDPSession(p);
await p.goto('http://localhost:' + port + '/');
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
await p.evaluate(() => document.querySelector('[data-act=bosses]').click());
await p.waitForFunction(() => !!document.querySelector('[data-boss]'));
await p.evaluate((n) => document.querySelector('[data-boss="' + n + '"]').click(), boss);
const scene = Number(boss) <= 2 ? 'Hoops' : Number(boss) <= 4 ? 'Wrestle' : 'Fishing';
await p.waitForFunction((s) => window.game.scene.isActive(s), scene, { timeout: 300000 });
// skip the intro
for (let i = 0; i < 60; i++) { await p.evaluate(() => { const s = document.querySelector('.hoops-skip, .wr-skip'); if (s && !s.hidden) { s.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); s.click(); } }); await p.waitForTimeout(500); }
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(thr) });
await p.evaluate(() => { window.__ft = []; let l = performance.now(); const tick = () => { const n = performance.now(); window.__ft.push(n - l); l = n; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
await cdp.send('Profiler.start');
await p.waitForTimeout(Number(secs) * 1000);
const { profile } = await cdp.send('Profiler.stop');
const st = await p.evaluate(() => { const f = window.__ft.slice(10).sort((x, y) => x - y); return { frames: f.length, median: +f[f.length >> 1].toFixed(1), p90: +f[Math.floor(f.length * 0.9)].toFixed(1) }; });
const self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
let total = 0;
profile.samples.forEach((s, i) => { const cf = byId.get(s).callFrame; const key = (cf.functionName || '(anon)') + ' ' + (cf.url.split('/').pop() || '').slice(0, 24) + ':' + cf.lineNumber; self.set(key, (self.get(key) || 0) + profile.timeDeltas[i]); total += profile.timeDeltas[i]; });
console.log(JSON.stringify({ boss, throttle: thr, light: !!process.env.LIGHT, ...st, errs: errs.slice(0, 3) }));
console.log([...self.entries()].sort((x, y) => y[1] - x[1]).slice(0, Number(process.env.TOP || 22)).map(([k, v]) => ((100 * v) / total).toFixed(1).padStart(5) + '%  ' + k).join('\n'));
await b.close();
