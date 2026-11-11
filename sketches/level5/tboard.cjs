// With the skateboard (and hat) on: what shows in Part 5 — the pier, swimming, the HUD.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); localStorage.setItem('puffy.items', 'party,frogskins,board'); localStorage.setItem('puffy.wear', 'board,frogskins,party'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 60000 }).catch(async (e) => { console.log('ERRS', errs); await p.screenshot({ path: 'shots/l5/board-boot.png' }); throw e; });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2000);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 60000 });
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'shots/l5/board-pier.png' });
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'shots/l5/board-swim.png' });
  console.log(await p.evaluate(() => { const pl = window.game.scene.getScene('Game').players[0]; return pl.view.texture.key + ' ' + pl.view.frame.name; }));
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
