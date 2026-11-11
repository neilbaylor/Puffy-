// Crab tennis close up: hover by court 1 and watch (screenshots every second), then shoot the clam on court 2.
const { chromium } = require('playwright');
const OUT = 'shots/l5';
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
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  await p.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    pl.invulnUntil = 1e12;
    window.__hits = 0;
    const orig = g.hitPlayer.bind(g);
    g.hitPlayer = (q, fx) => { if (!q.invulnerable || window.__count) window.__hits++; orig(q, fx); };
    // a little way out from court 1 (still out of their sight), hovering at mid height
    pl.body.reset(90 * 32, g.level.heightPx - 7 * 32);
    window.__btn = { left: false, right: false, jump: false, fire: false, run: false };
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...window.__btn }) };
    g.events.on('preupdate', () => { const h = (g.level.heightPx - pl.bottom) / 32; window.__btn.jump = h < 6.5 && !window.__btn.jump; });
  });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/tennis-watch.png` });
  // swim in a little: they spot you
  await p.evaluate(() => { window.__btn.right = true; });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { window.__btn.right = false; });
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/tennis-${i}.png` });
  }
  const st1 = await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const m = g.tennis[0]; return { state: m.state, hot: m.hot, x: Math.round(g.players[0].x / 32) }; });
  console.log('court1', JSON.stringify(st1));
  // court 2: wait till a crab is holding the clam up, then shoot it from beside it
  const pop = await p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    const m = g.tennis[1];
    pl.body.reset(118 * 32, g.level.heightPx - 6 * 32);
    let f = 0;
    const step = () => {
      f++;
      if (m.state === 'hold' && m.receiver && !window.__shot) {
        window.__shot = 1;
        pl.body.reset(m.ball.x - 90, m.ball.y - 4);
        pl.body.setVelocity(0, 0);
        pl.facing = 1;
        g.fireRocket(pl);
      }
      if (!m.ball.active || m.ball.frame.name === 'open' || f > 60 * 25) {
        g.events.off('preupdate', step);
        setTimeout(() => done({ popped: !m.ball.active || m.ball.frame.name === 'open', state: m.state, f, crabsChasing: g.enemies.filter((e) => e.kind === 'crab' && e.mode === 'chase').length }), 900);
      }
    };
    g.events.on('preupdate', step);
  }));
  console.log('court2', JSON.stringify(pop));
  await p.screenshot({ path: `${OUT}/tennis-pop.png` });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
