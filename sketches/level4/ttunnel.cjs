// the tunnel the Plop King walks out of: a close look (with him, and without)
const { chromium } = require('playwright');
const tag = process.argv[2] || 'a';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '3'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  await p.click('[data-boss="4"]');
  await p.waitForFunction(() => window.game.scene.isActive('Wrestle') && window.game.scene.getScene('Wrestle').queen, null, { timeout: 120000 });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `shots/tun-${tag}-with.png` });
  await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.queen.spr.setAlpha(0); });
  await p.waitForTimeout(100);
  await p.screenshot({ path: `shots/tun-${tag}-without.png` });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
