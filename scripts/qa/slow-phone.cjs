// Needs: npm run build && PORT=8091 node server.mjs
// slow-phone check: CPU throttled 4x; how long until the start screen is usable, how janky the
// first seconds after it appears are, and how long a first tap on a hero takes to show
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true });
  });
  const t0 = Date.now();
  await p.goto('http://localhost:8091/');
  // the start screen is visible (no loading screen over it)
  await p.waitForFunction(() => document.querySelector('.screen.start .card') && !document.getElementById('boot'), null, { timeout: 300000 });
  const shownAt = await p.evaluate(() => performance.now());
  console.log(`start screen visible after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await p.waitForTimeout(1000);
  // first tap on a hero: time until the next frame after the click handler
  const tap = await p.evaluate(() => new Promise((res) => {
    const card = document.querySelectorAll('.card')[1];
    const t = performance.now();
    card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    card.click();
    requestAnimationFrame(() => requestAnimationFrame(() => res(Math.round(performance.now() - t))));
  }));
  console.log(`first hero tap → next frame: ${tap} ms`);
  await p.waitForTimeout(5000);
  const long = await p.evaluate((s) => window.__long.filter(([st]) => st >= s), shownAt);
  console.log(`long tasks in the first 6 s after it appeared: ${long.length}, total ${long.reduce((a, [, d]) => a + d, 0)} ms, worst ${Math.max(0, ...long.map(([, d]) => d))} ms`);
  await p.waitForTimeout(6000);
  const late = await p.evaluate((s) => window.__long.filter(([st]) => st >= s + 6000), shownAt);
  console.log(`long tasks 6-12 s after it appeared (steady state): ${late.length}, total ${late.reduce((a, [, d]) => a + d, 0)} ms, worst ${Math.max(0, ...late.map(([, d]) => d))} ms`);
  console.log(await p.evaluate(() => window.__long.slice(-40).map(([a, b]) => a + ':' + b).join(' ')));
  await br.close();
})();
