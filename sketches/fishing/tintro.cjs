// King Bob's contest opening: the host on the dock (old telly), then over to the boat. A frame every 1.6 s, as a sheet.
const { chromium } = require('playwright');
const W = Number(process.argv[2] || 844), H = Number(process.argv[3] || 390);
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  await p.click('[data-boss="5"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  for (let i = 0; i < 22; i++) {
    await p.waitForTimeout(1000);
    await p.screenshot({ path: `shots/fishing/intro-${String(i).padStart(2, '0')}.png` });
  }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
