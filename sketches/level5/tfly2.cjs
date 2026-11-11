// The Part 5 fly-over: 8 frames along it (by its progress u), as a contact sheet.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2000);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').intro, null, { timeout: 120000 });
  // slow the flight right down so each frame can be caught
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); g.tweens.getTweensOf(g.intro).forEach((t) => t.setTimeScale(0.12)); });
  for (const u of [0.05, 0.18, 0.3, 0.42, 0.55, 0.68, 0.8, 0.93]) {
    await p.waitForFunction((u) => { const i = window.game.scene.getScene('Game').intro; return !i || i.u >= u; }, u, { timeout: 120000 });
    await p.screenshot({ path: `shots/l5/fly-${Math.round(u * 100)}.png` });
  }
  await br.close();
})();
