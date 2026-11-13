// Each Kai in Part 5 and the nuggies that are always by him: hero parked a few tiles to the left, one shot each.
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
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  const spots = await p.evaluate(() => {
    document.querySelector('.ctl-tip')?.remove();
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    pl.invulnUntil = 1e12;
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: false, run: false, fire: false, jump: false }) };
    return g.level.data.spawns.filter((q) => q.type === 'kai').map((q) => [q.x, q.y]);
  });
  let i = 0;
  for (const [x, y] of spots) {
    await p.evaluate(([x, y]) => {
      const g = window.game.scene.getScene('Game');
      const pl = g.players[0];
      pl.body.reset(x * 32 - 160, y * 32 + 40);
      pl.body.setAllowGravity(false);
      pl.body.moves = false;
    }, [x, y]);
    await p.waitForTimeout(1800);
    await p.screenshot({ path: `shots/l5/kainug-${String(i++).padStart(2, '0')}-${Math.round(x)}.png` });
  }
  console.log(spots.length, 'spots;', errs.join('\n') || 'no errors');
  await br.close();
})();
