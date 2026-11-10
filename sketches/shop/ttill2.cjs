const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.rootbeer', '95'); localStorage.setItem('puffy.items', 'party'); localStorage.setItem('puffy.wear', 'none'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.click('[data-act=shop]'); await p.waitForTimeout(900);
  await p.screenshot({ path: 'wt-battle/shots/wearit.png' });
  for (const id of ['frogskins', 'board']) {
    await p.evaluate(() => {
      window.__log = []; window.__frames = [];
      const t0 = performance.now();
      new MutationObserver(() => window.__log.push([Math.round(performance.now() - t0), document.querySelector('.shop-count')?.textContent])).observe(document.querySelector('.shop-rb'), { subtree: true, childList: true, characterData: true });
      let last = performance.now();
      const f = (now) => { window.__frames.push(now - last); last = now; if (now - t0 < 3000) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
    await p.click(`[data-buy=${id}]`);
    await p.waitForTimeout(3200);
    const r = await p.evaluate(() => ({ log: window.__log, long: window.__frames.filter((d) => d > 40).map(Math.round) }));
    const nums = r.log.filter((x) => /^\d+$/.test(x[1] || ''));
    console.log(id, 'steps', nums.length, 'first', nums[0], 'last', nums[nums.length - 1], 'long frames', JSON.stringify(r.long));
  }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
