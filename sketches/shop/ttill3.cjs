const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.rootbeer', '95'); } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.click('[data-act=shop]'); await p.waitForTimeout(900);
  for (const [id, to] of [['frogskins', '70'], ['board', '20']]) {
    const t0 = Date.now();
    await p.click(`[data-buy=${id}]`);
    const tap = Date.now() - t0;
    await p.waitForFunction((to) => document.querySelector('.shop-count')?.textContent === to, to, { polling: 10, timeout: 5000 });
    console.log(id, 'tap took', tap, 'ms; counted down by', Date.now() - t0, 'ms');
    await p.waitForTimeout(800);
  }
  await br.close();
})();
