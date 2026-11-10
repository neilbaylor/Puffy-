// the till: buy the skateboard (95 → 45): the count clicks down, "−50" drops off, ka-ching; light mode: straight to 45
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const light of [false, true]) {
    const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
    await ctx.addInitScript((light) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.rootbeer', '95'); localStorage.setItem('puffy.light', light ? '1' : '0'); } }, light);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.click('[data-act=shop]'); await p.waitForTimeout(800);
    if (!light) await p.screenshot({ path: 'shots/till-0.png' });
    await p.click('[data-buy=board]');
    const seen = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 1500) { seen.push(await p.evaluate(() => document.querySelector('.shop-count')?.textContent)); await p.waitForTimeout(30); }
    console.log(light ? 'light:' : 'full:', [...new Set(seen)].join(' '));
    if (!light) {
      await p.click('[data-off=board]'); await p.waitForTimeout(300);
      await p.click('[data-buy=frogskins]'); await p.waitForTimeout(250);
      await p.evaluate(() => { for (const a of document.getAnimations()) a.pause(); });
      await p.screenshot({ path: 'shots/till-1.png' });
    }
    console.log(errs.join('\n') || 'no errors');
    await ctx.close();
  }
  await br.close();
})();
