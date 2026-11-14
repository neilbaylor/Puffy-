// Real touch taps at set distances from a live BITE!'s centre (and at set times after it shows); logs hit/miss.
const { chromium } = require('playwright');
const W = Number(process.argv[2] || 844), H = Number(process.argv[3] || 390);
// [distance px from centre, delay ms after it shows]
const PLAN = [[0, 250], [52, 40], [52, 450], [66, 300], [0, 540], [90, 250], [66, 60], [45, 500], [120, 250], [0, 250], [60, 200], [0, 250]];
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.tap('[data-act=bosses]'); await p.waitForTimeout(500); await p.tap('[data-boss="5"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  // (skip the intro)
  await p.waitForTimeout(1500); await p.evaluate(() => (window.__fishing.skipping = true));
  let i = 0; const t0 = Date.now();
  while (i < PLAN.length && Date.now() - t0 < 400000) {
    const up = await p.evaluate(() => !window.__fishing.dom.querySelector('.fsh-bite').hidden);
    if (!up) { await p.waitForTimeout(10); continue; }
    const [d, ms] = PLAN[i++];
    await p.waitForTimeout(ms);
    const c = await p.evaluate(() => { const b = window.__fishing.dom.querySelector('.fsh-bite'); if (b.hidden) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: b.offsetWidth }; });
    if (!c) { console.log(`#${i} d=${d} t=${ms}: gone before the tap`); continue; }
    const ang = Math.random() * Math.PI * 2;
    const x = Math.max(1, Math.min(W - 1, c.x + Math.cos(ang) * d)), y = Math.max(1, Math.min(H - 1, c.y + Math.sin(ang) * d));
    await p.touchscreen.tap(x, y);
    await p.waitForFunction(() => /GOT IT|MISSED|TOO SLOW/.test(window.__fishing.dom.querySelector('.fsh-callout').textContent) && window.__fishing.dom.querySelector('.fsh-callout').classList.contains('show'), null, { timeout: 3000 }).catch(() => {});
    const co = await p.evaluate(() => window.__fishing.dom.querySelector('.fsh-callout').textContent);
    console.log(`#${i} button ${c.s}px (edge ${c.s / 2}, reach ${c.s / 2 + 30}) tap ${d}px out at ${ms}ms → ${co}`);
    await p.waitForFunction(() => window.__fishing.dom.querySelector('.fsh-bite').hidden, null, { timeout: 3000 }).catch(() => {});
  }
  await br.close();
})();
