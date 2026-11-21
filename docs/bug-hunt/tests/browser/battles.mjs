// usage: node battles.mjs <port> [battles] -> two players play several short battles back to back (the room loops: results, then the next countdown):
// textures, JS heap and DOM nodes on player A after each one
import { chromium } from 'playwright';
const [port, nb = '5'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas', '--js-flags=--expose-gc'] });
const room = 'm' + Math.floor(Math.random() * 1e6);
const pages = [];
for (const nm of ['Amy', 'Cal']) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((n) => { localStorage.setItem('puffy.name', n); localStorage.setItem('puffy.light', '1'); }, nm);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${port}/`);
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => document.querySelector('[data-act=battle]').click());
  await p.waitForFunction(() => !!document.querySelector('.bc-box input'));
  await p.fill('.bc-box input', room);
  await p.evaluate(() => document.querySelector('.battle-code [data-act=go]').click());
  pages.push(p);
}
const a = pages[0];
const cdp = await a.context().newCDPSession(a);
await cdp.send('Performance.enable');
for (let i = 1; i <= Number(nb); i++) {
  await Promise.all(pages.map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && !!window.game.scene.getScene('Battle').me, null, { timeout: 120000 })));
  await Promise.all(pages.map((p) => p.evaluate(() => { let t = 0; clearInterval(window.__bot); window.__bot = setInterval(() => { t++; const k = (c, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, bubbles: true })); k('ArrowRight', t % 60 < 30); k('ArrowLeft', t % 60 >= 30); k('ArrowUp', t % 9 < 2); k('KeyX', t % 4 < 2); }, 50); })));
  await a.waitForFunction(() => !!document.querySelector('.battle-results'), null, { timeout: 90000 });
  await a.evaluate(() => window.gc?.());
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  const keys = await a.evaluate(() => Object.keys(window.game.textures.list));
  const tex = keys.length;
  if (i === 1) globalThis.__k1 = new Set(keys);
  if (i > 1) console.log('   new since battle 1:', keys.filter((k) => !globalThis.__k1.has(k)).join(' ').slice(0, 300));
  console.log(`battle ${i}: textures ${tex}  heap ${(m.JSHeapUsedSize / 1e6).toFixed(1)} MB  nodes ${m.Nodes}  listeners ${m.JSEventListeners}`);
  await a.waitForFunction(() => !document.querySelector('.battle-results'), null, { timeout: 60000 });
}
await cdp.send('DOM.enable');
const r = await cdp.send('DOM.getDetachedDomNodes');
const roots = new Map();
for (const d of r.detachedNodes) { const nd = d.treeNode; const cls = (nd.attributes || []).reduce((a, v, i, arr) => (v === 'class' ? a + '.' + arr[i + 1].split(' ').join('.') : a), ''); const k = nd.nodeName.toLowerCase() + cls; roots.set(k, (roots.get(k) || 0) + 1); }
console.log('detached:', JSON.stringify([...roots.entries()].filter(([k]) => k !== 'canvas').sort((x, y) => y[1] - x[1]).slice(0, 12)));
await b.close();
