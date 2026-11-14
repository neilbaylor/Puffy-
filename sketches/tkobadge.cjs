// The battle lobby after a battle: each player's square with its "N KOs" badge (the winner's gold with a cup). Phone + tablet.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const [w, h, tag] of [[844, 390, 'phone'], [1180, 820, 'tablet']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem('puffy.name', 'Neil'));
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]'); await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', 'ko' + Math.floor(Math.random() * 1e5));
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-slot canvas', { timeout: 30000 });
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const s = document.querySelectorAll('.bl-slot');
      s[0].insertAdjacentHTML('beforeend', '<span class="bl-last won" title="Last battle">🏆 5 KOs</span>');
      s[1].insertAdjacentHTML('beforeend', '<span class="bl-last" title="Last battle">2 KOs</span>');
    });
    await p.screenshot({ path: `shots/kobadge-${tag}.png` });
    await ctx.close();
  }
  await b.close();
})();
