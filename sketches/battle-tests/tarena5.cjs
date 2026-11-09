const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const errs = [];
  const room = 'arena' + Date.now() % 100000;
  const mk = async (name, scale = 1) => {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: scale });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ' ' + e.message));
    await p.addInitScript(([n]) => localStorage.setItem('puffy.name', n), [name]);
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]'); await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 30000 });
    return p;
  };
  const a = await mk('Neil', 2);
  const c = await mk('Henry');
  await c.evaluate(() => document.querySelector('.bl-start')?.click());
  await Promise.all([a, c].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  await a.waitForTimeout(3000);
  for (let k = 0; k < 4; k++) {
    await a.evaluate((k) => { const s = window.game.scene.getScene('Battle'); s.followCamera = () => { const cam = s.cameras.main; cam.setZoom(s.fitZoom * 0.92); cam.centerOn((k * 28 + 14) * 32, (s.map.heightPx + 56) / 2 - 10); }; }, k);
    await a.waitForTimeout(1200);
    await a.screenshot({ path: `shots/arena5-${k + 1}.png` });
  }
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
