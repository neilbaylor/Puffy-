// King Bob's line and his flip out of the bowl and back (the end of the opening): frames as fast as they come.
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
  // wait for the King's line in the opening, then grab frames through the flip
  await p.waitForFunction(() => [...document.querySelectorAll('canvas')].length && window.__fishing.kingFree === false && window.__fishing.hostPoint === false && window.__fishing.inIntro && window.__fishing.camK === 2.5, null, { timeout: 120000, polling: 50 });
  for (let i = 0; i < 16; i++) { await p.screenshot({ path: `shots/fishing/flip-${String(i).padStart(2, '0')}.png` }); await p.waitForTimeout(150); }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
