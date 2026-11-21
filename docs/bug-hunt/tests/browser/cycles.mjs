// usage: node cycles.mjs <port> [cycles] [part] -> after each round trip start screen -> a Part -> home: DOM nodes, listeners, JS heap, textures
import { chromium } from 'playwright';
const [port, cycles = '5', part = '1'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas', '--js-flags=--expose-gc'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1'); });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Performance.enable');
await p.goto(`http://localhost:${port}/`);
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
const measure = async (label) => {
  await p.evaluate(() => window.gc?.());
  await p.waitForTimeout(500);
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  const tex = await p.evaluate(() => Object.keys(window.game.textures.list).length);
  console.log(`${label.padEnd(9)} nodes ${String(m.Nodes).padStart(6)}  listeners ${String(m.JSEventListeners).padStart(5)}  heap ${(m.JSHeapUsedSize / 1e6).toFixed(1).padStart(6)} MB  textures ${tex}`);
};
await measure('start');
for (let i = 1; i <= Number(cycles); i++) {
  await p.evaluate((n) => { const el = document.querySelector(`.lvl[data-lvl="${n}"]`); el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el?.click(); }, part);
  await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('[data-act=play]').click());
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 300000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 120000 });
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.invulnUntil = 1e15; let f = 0; pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: true, jump: f++ % 50 < 12, fire: f % 20 < 3, run: true, bomb: false }) }; });
  await p.waitForTimeout(6000);
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !!document.querySelector('[data-act=hero]'));
  await p.evaluate(() => document.querySelector('[data-act=hero]').click());
  await p.waitForFunction(() => !!document.querySelector('[data-act=play]'));
  await p.waitForTimeout(1500);
  await measure(`cycle ${i}`);
}
if (process.env.DETACHED) {
  await cdp.send('DOM.enable');
  const r = await cdp.send('DOM.getDetachedDomNodes').catch((e) => ({ err: String(e) }));
  if (r.err) console.log(r.err);
  else {
    const roots = new Map();
    for (const d of r.detachedNodes) { const n = d.treeNode; const k = `${n.nodeName.toLowerCase()}${(n.attributes || []).reduce((a, v, i, arr) => (v === 'class' ? a + '.' + arr[i + 1].split(' ').join('.') : a), '')}`; roots.set(k, (roots.get(k) || 0) + 1); }
    console.log('detached trees:', r.detachedNodes.length, [...roots.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12));
  }
}
await b.close();
