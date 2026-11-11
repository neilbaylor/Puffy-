// Part 5's gate leads to King Bob's fishing contest: the hero put by the gate, then wait for the Fishing scene.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'scruffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2000);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.invulnUntil = 1e12; pl.body.reset(250 * 32, g.level.heightPx - 72 * 32); pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: true, run: false, fire: false, jump: Math.random() < 0.08 }) }; });
  const t0 = Date.now();
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(2500);
    console.log(JSON.stringify(await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g?.players?.[0]; return { game: window.game.scene.isActive('Game'), fishing: window.game.scene.isActive('Fishing'), x: pl && Math.round(pl.x / 32), h: pl && Math.round((g.level.heightPx - pl.bottom) / 32), ended: g?.ended, goal: g?.goal && Math.round(g.goal.zone.x / 32) }; })));
  }
  await p.waitForFunction(() => window.game.scene.isActive('Fishing'), null, { timeout: 90000 });
  console.log('Fishing started after', ((Date.now() - t0) / 1000).toFixed(1), 's');
  await p.waitForTimeout(6000);
  await p.screenshot({ path: 'shots/fishing/gate-in.png' });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
