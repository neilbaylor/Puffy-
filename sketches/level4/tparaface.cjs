// a medium Plop with a gun, falling (as on a parachute): does it face you on either side?
const { chromium } = require('playwright');
const SIDES = [+(process.argv[2] || 1)];
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '3'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="4"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(1500);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => { const g = window.game.scene.getScene('Game'); return !g.intro && !g.cutscene; }, null, { timeout: 60000 });
  const res = await p.evaluate((SIDES) => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: false, jump: false, fire: false, run: false }) };
    pl.invulnUntil = 1e12;
    const out = [];
    // high up in drop 1's air: the Plop above, the hero beside it (one side, then the other)
    const d = g.chuteDrops[0];
    for (const side of SIDES) {
      const e = g.spawnEnemy('bigplop', d.x0 + 700, d.top + 400);
      e.arm('gun', 'big');
      e.wake();
      e.body.setAllowGravity(false);
      e.body.setVelocity(0, 0);
      e.y -= 200; e.syncBody();
      pl.body.reset(e.x + side * 160, e.y + 10);
      pl.body.setAllowGravity(false);
      out.push({ side, e });
    }
    let f = 0;
    const step = () => {
      f++;
      for (const o of out) { o.e.body.setVelocity(0, 30); pl.body.reset(o.e.x + o.side * 160, o.e.y + 10); }
      if (f === 40) {
        const r = out.map((o) => ({ heroSide: o.side > 0 ? 'right' : 'left', facing: o.e.flipX ? 'right' : 'left', onGround: o.e.body.blocked.down }));
        g.events.off('preupdate', step);
        done(r);
      }
    };
    g.events.on('preupdate', step);
  }), SIDES);
  console.log(JSON.stringify(res));
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
