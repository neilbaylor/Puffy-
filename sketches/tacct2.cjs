// The player card's greeting vs Sign out: the gap between them (px), for a short, a typical and the widest name, phone and tablet.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const [w, h, tag] of [[844, 390, 'phone'], [1180, 820, 'tablet'], [1366, 1024, 'ipad']]) {
    for (const name of ['Bo', 'tst' + (Date.now() % 100000), 'WWWWWWWWWW'.slice(0, 7) + (Date.now() % 1000)]) {
      const ctx = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      await p.goto('http://localhost:8091/');
      await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
      await p.waitForTimeout(500);
      await p.click('[data-act=account]');
      await p.waitForTimeout(300);
      const nm = name === 'Bo' ? 'Bo' + (Date.now() % 1000) : name;
      await p.fill('input[name=name]', nm.slice(0, 10));
      await p.fill('input[name=pw]', 'pw12345');
      await p.click('[data-act=in]');
      await p.waitForTimeout(700);
      if (await p.isVisible('[data-act=ok]')) await p.click('[data-act=ok]');
      await p.waitForTimeout(1200);
      await p.click('[data-act=account]');
      await p.waitForTimeout(800);
      const m = await p.evaluate(() => {
        const h2 = document.querySelector('.acct-card h2');
        const r = document.createRange();
        r.selectNodeContents(h2);
        const rects = [...r.getClientRects()];
        const textRight = Math.max(...rects.map((q) => q.right));
        const btn = document.querySelector('.acct-out').getBoundingClientRect();
        return { text: h2.textContent, lines: new Set(rects.map((q) => Math.round(q.top))).size, gap: Math.round(btn.left - textRight) };
      });
      console.log(tag, JSON.stringify(m));
      await p.screenshot({ path: `shots/acct2-${tag}-${nm.length}.png` });
      await ctx.close();
    }
  }
  await br.close();
})();
