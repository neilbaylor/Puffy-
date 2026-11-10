// Part 5 only for the account 'neil' (any case): not for other names, not for nobody, not for the other tester.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const name of ['Neil', 'bob', null]) {
    const ctx = await br.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.addInitScript((n) => { localStorage.setItem('puffy.beaten', '4'); localStorage.removeItem('puffy.dev'); if (n) localStorage.setItem('puffy.account', JSON.stringify({ name: n, password: 'secret123' })); }, name);
    const p = await ctx.newPage();
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.waitForTimeout(2500);
    const parts = await p.evaluate(() => [...document.querySelectorAll('.lvl[data-lvl]')].map((b) => b.dataset.lvl).join(','));
    console.log(String(name), '->', parts);
    await ctx.close();
  }
  await br.close();
})();
