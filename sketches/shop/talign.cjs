const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const [w, h, n] of [[1180, 820, 'tablet'], [1440, 900, 'desktop'], [1024, 768, 'ipad'], [820, 1180, 'tabletp'], [1920, 1080, 'big']]) {
    const ctx = await br.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.rootbeer', '30'); } });
    const p = await ctx.newPage();
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.waitForTimeout(600);
    const st = await p.evaluate(() => { const r = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; }; return { h2: r('.start h2'), cards: r('.cards'), card: r('.card') }; });
    await p.click('[data-act=shop]'); await p.waitForTimeout(900);
    const sh = await p.evaluate(() => { const r = (q) => { const b = document.querySelector(q).getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; }; return { welcome: r('.shop-welcome'), list: r('.shop-list'), tile: r('.shop-item') }; });
    console.log(n, JSON.stringify(st), JSON.stringify(sh));
    await ctx.close();
  }
  await br.close();
})();
