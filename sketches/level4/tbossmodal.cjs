const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const [w, h, name] of [[568, 320, 'se1'], [844, 390, 'iphone14']]) {
    const ctx = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.beaten', '4'); } });
    const p = await ctx.newPage();
    await p.goto('http://localhost:8091/?nodev');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.click('[data-act=bosses]');
    await p.waitForTimeout(600);
    const fit = await p.evaluate(() => { const r = document.querySelector('.boss-panel').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, scroll: document.querySelector('.boss-panel').scrollHeight > document.querySelector('.boss-panel').clientHeight + 1 }; });
    console.log(name, JSON.stringify(fit));
    await p.screenshot({ path: `shots/bossmodal-${name}.png` });
    await ctx.close();
  }
  await br.close();
})();
