const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  await p.click('[data-boss="5"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  await p.evaluate(() => { window.__fishOdds = 1; window.__fishing.skipping = true; });
  for (let i = 0; i < 8; i++) {
    await p.waitForTimeout(2000);
    console.log(JSON.stringify(await p.evaluate(() => { const f = window.__fishing; return { intro: f.inIntro, skip: f.skipping, meter: !!f.meter, ph: f.meter?.el.dataset.m, pos: f.meter?.pos?.toFixed(2), clock: Math.round(f.clock), co: f.dom.querySelector('.fsh-callout').textContent, tv: f.dom.querySelector('.tv-old').hidden }; })));
  }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
