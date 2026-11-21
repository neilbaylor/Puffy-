// usage: node memcensus.mjs <port> <where: start|part:N|boss:N> [light 0|1]
// -> textures on the graphics chip (MB) by family, canvases still holding their pixels after upload, decoded songs, JS heap
import { chromium } from 'playwright';
const [port, where = 'start', light = '0'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas', '--js-flags=--expose-gc', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: Number(process.env.DPR || 2) });
await ctx.addInitScript((l) => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.light', l); localStorage.setItem('puffy.lightRetried', '1'); }, light);
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Performance.enable');
await p.goto(`http://localhost:${port}/`);
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
await p.mouse.click(5, 5);
const [kind, n] = where.split(':');
if (kind === 'part') {
  await p.evaluate((n) => { const el = document.querySelector(`.lvl[data-lvl="${n}"]`); el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el?.click(); }, n);
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('[data-act=play]').click());
  await p.waitForFunction(() => window.game.scene.isActive('Game') && !!window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 300000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 120000 });
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.invulnUntil = 1e15; let f = 0; pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: true, jump: f++ % 50 < 12, fire: false, run: true, bomb: false }) }; });
  await p.waitForTimeout(Number(process.env.PLAY || 12000));
} else if (kind === 'boss') {
  await p.evaluate(() => document.querySelector('[data-act=bosses]').click());
  await p.waitForFunction(() => !!document.querySelector('[data-boss]'));
  await p.evaluate((n) => document.querySelector(`[data-boss="${n}"]`).click(), n);
  await p.waitForTimeout(20000);
} else await p.waitForTimeout(6000);
await p.evaluate(() => window.gc?.());
const r = await p.evaluate(() => {
  const fam = (k) => k.replace(/^([a-z]+(?:-[a-z]+)?).*$/, '$1').replace(/^[0-9a-f]{8}$/, 'text');
  const by = new Map();
  let gpu = 0, cpu = 0;
  const kept = [];
  for (const [k, t] of Object.entries(window.game.textures.list)) {
    if (k.startsWith('__')) continue;
    for (const s of t.source) {
      const g = s.width * s.height * 4;
      const img = s.image ?? s.source;
      const c = img && img.width ? img.width * img.height * 4 : 0;
      gpu += g;
      const isCanvas = img instanceof HTMLCanvasElement;
      if (isCanvas && c > 4) { cpu += c; kept.push([k, Math.round(c / 1e4) / 100]); }
      const f = /^[0-9a-f-]{36}$/.test(k) ? 'text' : fam(k);
      const e = by.get(f) || { n: 0, mb: 0 };
      e.n++; e.mb += g / 1e6; by.set(f, e);
    }
  }
  const terr = new Map();
  const cam = window.game.scene.getScenes(true).map((sc) => sc.cameras?.main).filter(Boolean);
  const shown = new Set();
  for (const sc of window.game.scene.getScenes(true)) for (const o of sc.children.list) if (o.texture && o.visible !== false) shown.add(o.texture.key);
  for (const [k, t] of Object.entries(window.game.textures.list)) if (/^terrain/.test(k)) { const g = k.replace(/-(ground|rock)-.*$/, '-$1'); const s = t.source[0]; const e = terr.get(g) || { n: 0, mb: 0, used: 0 }; e.n++; e.mb += s.width * s.height * 4 / 1e6; if (shown.has(k)) e.used++; terr.set(g, e); }
  window.__terr = [...terr.entries()].map(([g, e]) => `${g}: ${e.mb.toFixed(1)}MB ×${e.n} (${e.used} on show)`);
  const songs = window.__music?.();
  return { textures: Object.keys(window.game.textures.list).length, gpuMB: +(gpu / 1e6).toFixed(1), keptCanvasMB: +(cpu / 1e6).toFixed(1), byFamily: [...by.entries()].sort((a, b) => b[1].mb - a[1].mb).slice(0, 14).map(([f, e]) => `${f} ${e.mb.toFixed(1)}MB×${e.n}`), keptCanvases: kept.sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, mb]) => `${k} ${mb}MB`), songs: songs?.decoded };
});
const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
if (process.env.TERR) console.log((await p.evaluate(() => window.__terr)).join('\n'));
console.log(JSON.stringify({ where, light, heapMB: +(m.JSHeapUsedSize / 1e6).toFixed(1), ...r }, null, 1));
await b.close();
