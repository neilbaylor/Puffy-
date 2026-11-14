// The Boss Battles window next to the start screen's yellow buttons (Bosses, Battle): same yellow?
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.beaten', '5'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: 'shots/bossbtn-start.png' });
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(700);
  await p.screenshot({ path: 'shots/bossbtn-modal.png' });
  const bg = await p.evaluate(() => ({ boss: getComputedStyle(document.querySelector('.boss-btn')).backgroundImage + ' / ' + getComputedStyle(document.querySelector('.boss-btn')).backgroundColor }));
  console.log(JSON.stringify(bg));
  await br.close();
})();
