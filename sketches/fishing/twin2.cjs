// The win: celebration on the hero, the shocked host, King Bob's "I'll get you next time!", his leap and swim off.
// Started straight away (the contest waiting at its first cast). A frame every ~1.2 s; a contact sheet of them.
const { chromium } = require('playwright');
const W = Number(process.argv[2] || 844), H = Number(process.argv[3] || 390);
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'scruffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  await p.click('[data-boss="5"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  await p.evaluate(() => (window.__fishing.skipping = true));
  await p.waitForFunction(() => window.__fishing.meter, null, { timeout: 60000 });
  await p.evaluate(() => { const f = window.__fishing; f.score = { hero: [true, true, false, true, true], king: [false, true, false, true, false] }; f.renderBoard(5); f.youWin(); });
  for (let i = 0; i < 24; i++) {
    await p.waitForTimeout(1000);
    await p.screenshot({ path: `shots/fishing/win-${String(i).padStart(2, '0')}.png` });
    if (await p.evaluate(() => !!document.querySelector('.screen .results'))) { console.log('results at frame', i); break; }
  }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
