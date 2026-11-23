// Boss 6's ending straight away (the contest skipped: a made-up 4–2 win), a frame every ~300 ms. args: port light tag [lose]
const { chromium } = require('playwright');
const [port, light, tag, lose] = [process.argv[2] || '8411', process.argv[3] || '0', process.argv[4] || 'end', process.argv[5] === 'lose'];
const DIR = `shots/boss6/${tag}`;
require('fs').mkdirSync(DIR, { recursive: true });
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((lt) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); localStorage.setItem('puffy.light', lt); } }, light);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  p.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver/.test(t)) errs.push(m.type() + ': ' + t.slice(0, 200)); });
  await p.goto(`http://localhost:${port}/`);
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  await p.click('[data-boss="6"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => (window.__fishing.skipping = true));
  await p.waitForFunction(() => !window.__fishing.inIntro, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.evaluate((lose) => { const f = window.__fishing; f.score = lose ? { hero: [false, false], king: [true, true, true] } : { hero: [true, true, true, true], king: [true, false, true] }; f.waits = []; f.renderBoard(4); lose ? f.kingWins() : f.youWin6(); }, lose);
  let i = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    const modal = await p.evaluate(() => document.querySelector('.screen h2')?.textContent ?? '').catch(() => 'gone');
    await p.screenshot({ path: `${DIR}/e-${String(i++).padStart(3, '0')}.png` });
    if (modal) { console.log('result card:', modal); break; }
    await p.waitForTimeout(250);
  }
  console.log('frames', i, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
