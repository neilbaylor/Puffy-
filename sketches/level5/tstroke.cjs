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
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  const r = await p.evaluate((x0) => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0]; pl.invulnUntil = 1e12;
    const T = 32, H = g.level.heightPx;
    pl.body.reset(+x0 * T, H - 36 * T);
    const btn = { left: false, right: false, jump: false, fire: false, run: false };
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...btn }) };
    let f = 0; const out = [];
    const step = () => { f++; btn.jump = f % 10 < 2; if (f % 20 === 0) out.push(((H - pl.bottom) / T).toFixed(1) + (pl.swimming ? '' : '!') + ' vy' + Math.round(pl.body.velocity.y)); if (f > 300) { g.events.off('preupdate', step); done({ out, fs: g.physics.world._frameTime, ts: g.physics.world.timeScale, slow: g.slowMo, wy: g.physics.world.gravity.y }); } };
    g.events.on('preupdate', step);
  }), process.argv[2] || '75');
  console.log(JSON.stringify(r));
  await br.close();
})();
