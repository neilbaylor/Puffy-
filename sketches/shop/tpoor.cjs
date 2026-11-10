const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const [w, h, n] of [[844, 390, 'phone'], [1180, 820, 'tablet']]) {
    const ctx = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.rootbeer', '22'); } });
    const p = await ctx.newPage();
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.click('[data-act=shop]'); await p.waitForTimeout(900);
    console.log(n, JSON.stringify(await p.evaluate(() => ['.shop-title', '.shop-rb', '.shop-list'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [q, Math.round(r.top), Math.round(r.bottom)]; }))), await p.evaluate(() => { const e = document.querySelector('.shop-page'); return e.scrollHeight > e.clientHeight ? 'SCROLLS' : 'fits'; }));
    await p.screenshot({ path: `wt-battle/shots/poor-${n}.png` });
    await ctx.close();
  }
  await br.close();
})();
