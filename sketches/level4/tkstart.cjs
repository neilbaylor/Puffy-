// the first moments of the Plop King fight: what's on screen frame by frame
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
  // record what the camera and the King are doing every frame from the moment the scene starts
  await p.evaluate(() => {
    window.__log = [];
    const g = window.game;
    const t0 = { v: 0 };
    g.events.on('poststep', () => {
      const s = g.scene.getScene('Wrestle');
      if (!s || !s.sys.isActive() || !s.queen) return;
      if (!t0.v) t0.v = performance.now();
      const c = s.cameras.main;
      const q = s.queen.spr;
      if (window.__log.length < 400) window.__log.push([Math.round(performance.now() - t0.v), Math.round(c.midPoint.x), Math.round(c.midPoint.y), +c.zoom.toFixed(2), q.visible && q.alpha > 0 ? Math.round(q.x) + ',' + Math.round(q.y) : '-', s.jumbo?.kind || '']);
    });
  });
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  await p.click('[data-boss="4"]');
  await p.waitForFunction(() => window.game.scene.isActive('Wrestle'), null, { timeout: 120000 });
  for (let i = 0; i < 14; i++) { await p.screenshot({ path: `shots/ks-${tag}-${i}.png` }); await p.waitForTimeout(200); }
  await p.waitForTimeout(1500);
  const log = await p.evaluate(() => window.__log);
  let last = '';
  for (const r of log) { const k = r.slice(1).join(' '); if (k !== last) { console.log(r.join(' ')); last = k; } }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
