// Boss 6's intro, a frame a second (args: port light out-prefix [seconds])
const { chromium } = require('playwright');
require('fs').mkdirSync('shots/boss6', { recursive: true });
const [port, light, out, secs] = [process.argv[2] || '8411', process.argv[3] || '0', process.argv[4] || 'intro', Number(process.argv[5] || 34)];
const DIR = `shots/boss6`;
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
  await p.waitForTimeout(800);
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${DIR}/${out}-menu.png` });
  await p.click('[data-boss="6"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  for (let i = 0; i < secs; i++) {
    await p.screenshot({ path: `${DIR}/${out}-${String(i).padStart(2, '0')}.png` });
    await p.waitForTimeout(1000);
  }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
