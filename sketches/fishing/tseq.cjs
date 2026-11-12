// One hero turn, frame by frame: the cast (every ~90 ms after the aim locks) and a catch (odds 1: the first bite hit),
// the fight and the heave (every ~180 ms). Two contact sheets.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  await p.click('[data-boss="5"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  await p.evaluate(() => { window.__fishOdds = 1; window.__fishing.skipping = true; });
  // the two meters, stopped in the green
  for (let k = 0; k < 2; ) {
    const st = await p.evaluate(() => { const m = window.__fishing.meter; return m ? { ph: m.el.dataset.m, ok: m.pos > m.zone[0] + 0.01 && m.pos < m.zone[1] - 0.01 } : null; });
    if (st && st.ph === (k ? 'aim' : 'power') && st.ok) { await p.mouse.click(250, 200); k++; console.log('locked', k); await p.waitForTimeout(300); }
    else await p.waitForTimeout(15);
  }
  let i = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 4200) { await p.screenshot({ path: `shots/fishing/seqc-${String(i++).padStart(2, '0')}.png` }); }
  console.log('cast frames', i);
  await p.waitForFunction(() => !window.__fishing.dom.querySelector('.fsh-bite').hidden, null, { timeout: 60000, polling: 20 });
  await p.screenshot({ path: 'shots/fishing/seq-bite.png' });
  await p.locator('.fsh-bite').click({ force: true, timeout: 500 }).catch(() => {});
  i = 0;
  const t1 = Date.now();
  while (Date.now() - t1 < 9000) { await p.screenshot({ path: `shots/fishing/seqf-${String(i++).padStart(2, '0')}.png` }); await p.waitForTimeout(60); }
  console.log('fight frames', i);
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
