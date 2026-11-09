const { chromium, devices } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const sizes = [[568, 320, 'se1'], [667, 375, 'se'], [740, 360, 'android'], [844, 390, 'iphone14'], [932, 430, 'promax']];
  for (const [w, h, name] of sizes) {
    const ctx = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.beaten', '4'); } });
    const p = await ctx.newPage();
    await p.goto('http://localhost:8091/?nodev');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.waitForTimeout(800);
    const m = await p.evaluate(() => {
      const row = document.querySelector('.levels');
      const r = row.getBoundingClientRect();
      const btns = [...row.querySelectorAll('button')].map((b) => { const q = b.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.right), Math.round(q.top), Math.round(q.bottom)]; });
      const play = document.querySelector('[data-act=play]')?.getBoundingClientRect();
      const cards = document.querySelector('.cards')?.getBoundingClientRect();
      return { vw: innerWidth, row: [Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom)], btns, overflowX: row.scrollWidth > row.clientWidth + 1, play: play && [Math.round(play.top), Math.round(play.bottom)], cards: cards && [Math.round(cards.top), Math.round(cards.bottom)] };
    });
    console.log(name, JSON.stringify(m));
    await p.screenshot({ path: `shots/phone4-${name}.png` });
    await ctx.close();
  }
  await br.close();
})();
