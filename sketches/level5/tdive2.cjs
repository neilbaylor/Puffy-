// The swan dive: the hero's on-screen position every frame from the hop to the splash. Frames where the hero doesn't move at all (a stutter) are counted.
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
  const r = await p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    const ys = [];
    let on = false;
    g.events.on('postupdate', () => {
      if (pl.swan) on = true;
      if (!on) return;
      ys.push([pl.view.x, pl.view.y, g.slowMo ?? 1]);
      if (pl.swimming && ys.length > 5) { done(ys); }
    });
  }));
  let still = 0, slowF = 0;
  for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    if (r[i][2] > 1.5) slowF++;
    if (d < 0.01) still++;
  }
  console.log('frames', r.length, 'slow-mo frames', slowF, 'frames without movement', still);
  console.log(r.slice(0, 80).map((q) => q[1].toFixed(1)).join(' '));
  await br.close();
})();
