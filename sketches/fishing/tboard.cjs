// The fishing scoreboard deep into sudden death (nine rounds), phone and tablet.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const [w, h, tag] of [[844, 390, 'phone'], [1180, 820, 'tablet']]) {
    const ctx = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'muscles'); } });
    const p = await ctx.newPage();
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.waitForTimeout(600);
    await p.click('[data-act=bosses]');
    await p.waitForTimeout(500);
    await p.click('[data-boss="5"]');
    await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
    await p.waitForTimeout(2500);
    await p.evaluate(() => (window.__fishing.skipping = true));
    await p.waitForFunction(() => !window.__fishing.inIntro && window.__fishing.dom.querySelector('.tv-old').hidden, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const f = window.__fishing; f.score = { hero: [true, false, true, true, false, true, true, false, true], king: [false, true, true, true, true, false, true, false] }; f.best = { who: 'king', name: 'Fat Fish', lb: 14.6 }; f.renderBoard(9); });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `shots/fishing/board-${tag}.png`, clip: { x: 0, y: 0, width: w * 0.5, height: h * 0.4 } });
    await ctx.close();
  }
  await br.close();
})();
