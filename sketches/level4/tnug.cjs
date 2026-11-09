const { chromium } = require('playwright');
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
  const res = await p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    const d = g.chuteDrops[0];
    g.chuteDrops.forEach((q) => (q.n = 0)); // (no Plops: just the nuggies)
    pl.body.reset(d.x0 + 600, d.top - 30);
    pl.body.reset(d.x0 + 600, d.top + 40);
    const btn = { left: false, right: false, jump: false, fire: false, run: false };
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...btn }) };
    let f = 0, hitAt = -1, shot = false;
    const step = () => {
      f++;
      if (pl.chute && pl.chute.t > 2 && hitAt < 0) { g.aura = 5; g.hitPlayer(pl, pl.x + 30); hitAt = f; }
      if (hitAt > 0) {
        const near = g.auras.filter((a) => a.scattered && a.active).sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y))[0];
        btn.left = !!near && near.x < pl.x - 6; btn.right = !!near && near.x > pl.x + 6;
        if ((f - hitAt) % 15 === 1) (window.__tr ||= []).push([f - hitAt, g.aura, Math.round(pl.body.velocity.y), g.auras.filter((a) => a.scattered && a.active).map((a) => [Math.round(a.x - pl.x), Math.round(a.y - pl.y), Math.round(a.body.velocity.y), +a.alpha.toFixed(1)])]);
      }
      if (hitAt > 0 && (f > hitAt + 300 || !pl.chute)) {
        g.events.off('preupdate', step);
        const left = g.auras.filter((a) => a.scattered && a.active).map((a) => [Math.round(a.x - pl.x), Math.round(a.y - pl.y)]);
        done({ tr: window.__tr.slice(0, 14), regained: g.aura, stillFloating: left, chute: !!pl.chute });
      }
    };
    g.events.on('preupdate', step);
  }));
  console.log(JSON.stringify(res));
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
