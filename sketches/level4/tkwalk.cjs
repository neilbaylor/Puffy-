// the Plop King's walk to the ring: a burst of shots while he walks (where he is, stage units)
const { chromium } = require('playwright');
const tag = process.argv[2] || 'a';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '3'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  await p.click('[data-boss="4"]');
  await p.waitForFunction(() => window.game.scene.isActive('Wrestle'), null, { timeout: 120000 });
  // wait for the walk (the lower third with his name)
  await p.waitForFunction(() => [...document.querySelectorAll('*')].some((e) => e.children.length === 0 && /Ruler of the Plops/.test(e.textContent) && e.offsetParent), null, { timeout: 60000 });
  const t0 = Date.now();
  for (let i = 0; i < 14; i++) {
    const at = await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); const q = s.queen.spr; return [Math.round(q.x / 0.62 - 0), Math.round(q.y / 0.62), q.frame.name]; });
    await p.screenshot({ path: `shots/kw-${tag}-${String(i).padStart(2, '0')}.png` });
    console.log(i, ((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(at));
    await p.waitForTimeout(+(process.argv[3] || 250));
  }
  await p.waitForFunction(() => window.game.scene.getScene('Wrestle').fighting, null, { timeout: 60000 });
  console.log('fight after', ((Date.now() - t0) / 1000).toFixed(1), 's');
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
