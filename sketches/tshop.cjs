const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.rootbeer', '37'); });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(800);
  await p.click('[data-act=shop]');
  await p.waitForTimeout(1200);
  await p.screenshot({ path: process.argv[2] + '-shop.png', clip: { x: 222, y: 0, width: 400, height: 140 } });
  await br.close();
})();
