// The tall kelp bending (one picture on a rope): a strip of frames near the start, and the fly-over's length.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2000);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').intro, null, { timeout: 120000 });
  const t0 = Date.now();
  const gt0 = await p.evaluate(() => window.game.scene.getScene('Game').time.now);
  await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 120000 });
  const gt1 = await p.evaluate(() => window.game.scene.getScene('Game').time.now);
  console.log('fly-over game ms', Math.round(gt1 - gt0), 'wall ms', Date.now() - t0);
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  await p.evaluate(() => { document.querySelector('.ctl-tip')?.remove(); const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.body.reset(14 * 32, g.level.heightPx - 72 * 32); pl.body.moves = false; });
  await p.waitForTimeout(2000);
  const n = await p.evaluate(() => window.game.scene.getScene('Game').level.view?.ropes?.length ?? window.game.scene.getScene('Game').children.list.filter((c) => c.type === 'Rope').length);
  console.log('ropes', n);
  for (let i = 0; i < 4; i++) { await p.screenshot({ path: `shots/l5/kelp-${i}.png` }); await p.waitForTimeout(350); }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
