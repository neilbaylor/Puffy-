const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  br.on('disconnected', () => console.log('BROWSER DISCONNECTED'));
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  p.on('crash', () => console.log('PAGE CRASHED')); p.on('close', () => console.log('PAGE CLOSED'));
  p.on('pageerror', (e) => console.log('ERR', e.message)); p.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 200)));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  await p.click('[data-boss="5"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { const f = window.__fishing; f.score = { hero: [true, true, true], king: [false] }; f.youWin(); });
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(1000); const st = await p.evaluate(() => ({ active: window.__fishing.scene.isActive(), modal: !!document.querySelector('.screen'), txt: document.querySelector('.screen h2')?.textContent })).catch((e) => 'ERR ' + e.message.slice(0, 80)); console.log(i, JSON.stringify(st)); }
  await p.screenshot({ path: 'shots/fishing/win-end.png' });
  await br.close();
})();
