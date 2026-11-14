// One catch of a chosen fish, filmed: the bot hits every bite (catch forced), then a frame every ~230 ms
// from FISH ON! until the bobber's back on the rod. Args: <kind> [w h]. Frames: shots/fishing/catch-<kind>-NN.png
const { chromium } = require('playwright');
const KIND = process.argv[2] || 'fat';
const W = Number(process.argv[3] || 844), H = Number(process.argv[4] || 390);
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.click('[data-act=bosses]'); await p.waitForTimeout(500); await p.click('[data-boss="5"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  await p.evaluate((k) => { window.__fishOdds = 1; window.__fishKind = k; }, KIND);
  await p.waitForTimeout(1500); await p.evaluate(() => (window.__fishing.skipping = true));
  const t0 = Date.now();
  let n = 0, filming = false, shadowShot = false;
  while (Date.now() - t0 < 400000) {
    const s = await p.evaluate(() => { const f = window.__fishing; return { bite: !f.dom.querySelector('.fsh-bite').hidden, mode: f.lures.hero.mode }; });
    if (s.bite) {
      if (!shadowShot) { shadowShot = true; await p.screenshot({ path: `shots/fishing/catch-${KIND}-shadow.png` }); }
      await p.locator('.fsh-bite').click({ force: true, timeout: 500 }).catch(() => {});
      continue;
    }
    if (s.mode === 'hooked') filming = true;
    if (filming) {
      await p.screenshot({ path: `shots/fishing/catch-${KIND}-${String(n++).padStart(2, '0')}.png` });
      if (s.mode === 'held' && n > 10) break;
      await p.waitForTimeout(20);
      continue;
    }
    await p.waitForTimeout(30);
  }
  console.log(KIND, 'frames', n, errs.join('\n') || 'no errors');
  await br.close();
})();
