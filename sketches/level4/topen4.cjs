// Part 4 for everyone: the Parts row and the Bosses menu for ordinary players at each stage, and a tester
const { chromium } = require('playwright');
const parts = (p) => p.evaluate(() => [...document.querySelectorAll('.lvl[data-lvl]')].map((b) => b.textContent.trim()).join(', '));
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const [beaten, dev, label] of [[2, false, 'player, beat Part 2'], [3, false, 'player, beat Part 3'], [4, false, 'player, beat Part 4'], [1, true, 'tester (dev), beat Part 1']]) {
    const ctx = await br.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.addInitScript(([b, d]) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.beaten', String(b)); if (d) localStorage.setItem('puffy.dev', '1'); } }, [beaten, dev]);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8091/' + (dev ? '' : '?nodev'));
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    const row = await parts(p);
    const world = (await p.textContent('.world-name')).trim();
    await p.click('[data-act=bosses]');
    await p.waitForTimeout(400);
    const bosses = await p.evaluate(() => [...document.querySelectorAll('[data-boss] b')].map((b) => b.textContent).join(' / '));
    console.log(`${label}: parts [${row}] · opens on "${world}" · bosses [${bosses}]` + (errs.length ? ' ERR ' + errs.join(';') : ''));
    await ctx.close();
  }
  await br.close();
})();
