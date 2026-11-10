const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.rootbeer', '95'); } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  const y = () => p.evaluate(() => { const e = document.querySelector('.shop-page'); return e ? Math.round(e.getBoundingClientRect().top) : 'gone'; });
  await p.click('[data-act=shop]');
  const a = []; for (let i = 0; i < 8; i++) { a.push(await y()); await p.waitForTimeout(80); }
  console.log('opening', a.join(' '));
  await p.click('[data-buy=party]'); await p.waitForTimeout(900);
  await p.click('.shop-x');
  const b = []; for (let i = 0; i < 9; i++) { b.push(await y()); await p.waitForTimeout(80); }
  console.log('closing', b.join(' '));
  await br.close();
})();
