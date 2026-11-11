const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  await p.click('[data-boss="5"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  for (let i = 0; i < 14; i++) {
    await p.waitForTimeout(500);
    const info = await p.evaluate(() => { const c = window.__fishing.cameras.main; const els = document.elementsFromPoint(400, 8).map((e) => e.className && typeof e.className === 'string' ? e.tagName + '.' + e.className.split(' ')[0] : e.tagName).slice(0, 4).join(' > '); return { top: Math.round(c.worldView.y), zoom: c.zoom.toFixed(2), els }; });
    console.log(i, JSON.stringify(info));
    if (i % 3 === 0) await p.screenshot({ path: `shots/fishing/band-${i}.png`, clip: { x: 0, y: 0, width: 844, height: 60 } });
  }
  await br.close();
})();
