// The Bosses menu for an ordinary player (not a tester) who's beaten Part 1: King Bob Fishing is there (for testing), and it starts.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.beaten', '1'); localStorage.setItem('puffy.hero', 'scruffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(600);
  console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.boss-btn')].map((b) => b.textContent))));
  await p.screenshot({ path: 'shots/fishing/bossmenu.png' });
  await p.click('[data-boss="5"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: 'shots/fishing/bossmenu-in.png' });
  console.log('fishing started;', errs.join('\n') || 'no errors');
  await br.close();
})();
