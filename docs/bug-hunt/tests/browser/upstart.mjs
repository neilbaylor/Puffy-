// usage: node upstart.mjs <port> <part>  -> every texture upload from Play to the level being ready (and the next 5 s of play): count, pixels, duplicates per texture
import { chromium } from 'playwright';
const [port, part = '2'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1'); });
const p = await ctx.newPage();
await p.goto(`http://localhost:${port}/`);
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
await p.evaluate((n) => { const el = document.querySelector(`.lvl[data-lvl="${n}"]`); el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el?.click(); }, part);
await p.waitForTimeout(4000);
await p.evaluate(() => {
  const gl = window.game.renderer.gl;
  window.__ups = []; Error.stackTraceLimit = 60;
  // which texture key each GL texture belongs to (Phaser's texture manager)
  const keyOf = (src) => { for (const [k, t] of Object.entries(window.game.textures.list)) for (const s of t.source) if (s.image === src || s.source === src) return k; return '?'; };
  const fn = gl.texImage2D.bind(gl);
  gl.texImage2D = (...a) => { const src = a[a.length - 1]; if (src && src.width) { const k = keyOf(src); window.__ups.push([k, src.width, src.height, performance.now()]); if (src.width === 3520) { const st = new Error().stack.split('\n').slice(13, 19).map((l) => l.trim().replace(/^at /, '').replace(/ \(.*\/(.*?):(\d+):\d+\)/, '@$2')).join(' < '); (window.__sts ??= {})[st] = ((window.__sts ??= {})[st] || 0) + 1; } } return fn(...a); };
});
const t0 = await p.evaluate(() => performance.now());
await p.click('[data-act=play]');
await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 300000, polling: 50 });
const tReady = await p.evaluate(() => performance.now());
await p.waitForTimeout(5000);
const ups = await p.evaluate(() => window.__ups); console.log(await p.evaluate(() => (window.__st || '').split('\n').slice(10, 30).map((l) => l.trim()).join('\n')));
const before = ups.filter((u) => u[3] <= tReady);
const per = new Map();
for (const [k, w, h] of before) { const e = per.get(k) || { n: 0, px: 0, w, h }; e.n++; e.px += w * h; per.set(k, e); }
const dups = [...per.entries()].filter(([, e]) => e.n > 1).sort((a, b) => b[1].px - a[1].px);
console.log(JSON.stringify({ part, startMs: Math.round(tReady - t0), uploads: before.length, mpix: +(before.reduce((a, u) => a + u[1] * u[2], 0) / 1e6).toFixed(1), textures: per.size, dupTextures: dups.length, dupMpix: +(dups.reduce((a, [, e]) => a + (e.px * (e.n - 1)) / e.n, 0) / 1e6).toFixed(1), after5s: ups.length - before.length }));
console.log('biggest:', [...per.entries()].sort((a, b) => b[1].px - a[1].px).slice(0, 12).map(([k, e]) => `${k} ${e.w}x${e.h}×${e.n}`).join(' | '));
console.log('uploaded more than once:', dups.slice(0, 12).map(([k, e]) => `${k} ${e.w}x${e.h}×${e.n}`).join(' | '));
console.log(await p.evaluate(() => { const ks = Object.keys(window.game.textures.list).filter((k) => /^char-|hero|face/.test(k)); return ks.length + ' hero-ish textures: ' + ks.slice(0, 60).join(' '); }));
console.log(JSON.stringify(await p.evaluate(() => window.__sts ?? null), null, 1));
await b.close();
