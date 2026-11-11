// A tour of level 5: put the hero at a few spots (hovering) and take a screenshot at each.
const { chromium } = require('playwright');
const SPOTS = [[30, 10, 'deep-shelf'], [41, 16, 'gap'], [66, 11, 'slope'], [76, 15, 'tennis1'], [99, 15, 'tennis2'], [128, 6, 'cave'], [165, 9, 'deep2']];
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'muscles'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'shots/l5/tour-menu.png' });
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  await p.evaluate(() => { document.querySelector('.ctl-tip')?.remove(); const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.invulnUntil = 1e12; window.__h = 10; pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: false, run: false, fire: false, jump: (g.level.heightPx - pl.bottom) / 32 < window.__h && Math.random() < 0.15 }) }; });
  for (const [x, h, name] of SPOTS) {
    await p.evaluate(([x, h]) => { const g = window.game.scene.getScene('Game'); window.__h = h; g.players[0].body.reset(x * 32, g.level.heightPx - h * 32); }, [x, h]);
    await p.waitForTimeout(2600);
    await p.screenshot({ path: `shots/l5/tour-${name}.png` });
  }
  // can you get to the surface in the gap, and not under the shelf?
  const top = await p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    const res = {};
    const tryAt = (x, name, next) => {
      pl.body.reset(x * 32, g.level.heightPx - 10 * 32);
      pl.input = { ...pl.input, poll: () => ({ left: false, right: false, run: false, fire: false, jump: Math.random() < 0.3 }) };
      let minY = 1e9, f = 0;
      const step = () => { f++; minY = Math.min(minY, pl.body.top); if (f > 240) { g.events.off('preupdate', step); res[name] = Math.round(minY); next(); } };
      g.events.on('preupdate', step);
    };
    tryAt(30, 'underShelf', () => tryAt(42, 'inGap', () => done({ ...res, surface: g.level.data.water })));
  }));
  console.log(JSON.stringify(top));
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
