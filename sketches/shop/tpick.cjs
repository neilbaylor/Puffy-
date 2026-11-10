const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.items', 'party,frogskins,board'); localStorage.setItem('puffy.wear', 'party,frogskins,board'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(1500);
  for (const [i, n] of [[2, 'muscles'], [1, 'scruffy']]) {
    await p.click(`.card[data-i="${i}"]`);
    await p.waitForTimeout(100); console.log('sparks', await p.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 380; } return document.querySelectorAll('.gear-spark').length; })); await p.screenshot({ path: `shots/pick-${n}-a.png` });
    await p.waitForTimeout(160); await p.screenshot({ path: `shots/pick-${n}-b.png` });
    await p.waitForTimeout(900); await p.screenshot({ path: `shots/pick-${n}-c.png` });
  }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
