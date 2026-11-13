// Part 5 for everyone: a normal player (no dev, not signed in) with <beaten> Parts beaten — which Parts and bosses they get.
const { chromium } = require('playwright');
const BEATEN = process.argv[2] || '4';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((b) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.beaten', b); localStorage.setItem('puffy.hero', 'puffy'); } }, BEATEN);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(1500);
  console.log('beaten', BEATEN, '| Parts:', JSON.stringify(await p.$$eval('.lvl', (bs) => bs.map((b) => b.textContent.trim()))));
  await p.screenshot({ path: `shots/fishing/public-${BEATEN}.png` });
  await p.click('[data-act=bosses]').catch(() => console.log('no Bosses button'));
  await p.waitForTimeout(500);
  console.log('Bosses:', JSON.stringify(await p.$$eval('.boss-btn', (bs) => bs.map((b) => b.textContent.trim()))));
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
