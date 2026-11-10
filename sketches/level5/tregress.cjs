// Other Parts still fine after the sea work: play a few seconds of Parts 1, 3 and 4 (gravity, hero sheet, no errors).
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const lvl of [1, 3, 4]) {
    const ctx = await br.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.evaluate((l) => { const b = document.querySelector(`.lvl[data-lvl="${l}"]`); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); }, lvl);
    await p.waitForTimeout(1500);
    await p.click('[data-act=play]');
    await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
    await p.evaluate(() => window.game.events.emit('skip-intro'));
    await p.waitForTimeout(5000);
    const r = await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; return { g: g.physics.world.gravity.y, key: pl.view.texture.key, ground: pl.onGround, water: pl.water }; });
    console.log(lvl, JSON.stringify(r), errs.join(' | ') || 'no errors');
    await ctx.close();
  }
  await br.close();
})();
