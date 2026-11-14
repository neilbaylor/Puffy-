// At a live BITE!, which points over the drawn button (disc, rim, ring, the shadow lip) actually land on it?
const { chromium } = require('playwright');
const W = Number(process.argv[2] || 844), H = Number(process.argv[3] || 390), N = Number(process.argv[4] || 3);
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.click('[data-act=bosses]'); await p.waitForTimeout(500); await p.click('[data-boss="5"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  let n = 0; const t0 = Date.now();
  while (n < N && Date.now() - t0 < 300000) {
    const up = await p.evaluate(() => !window.__fishing.dom.querySelector('.fsh-bite').hidden);
    if (!up) { await p.waitForTimeout(20); continue; }
    for (const ms of [40, 200, 450]) {
      await p.waitForTimeout(ms === 40 ? 40 : ms - (ms === 200 ? 40 : 200));
      const r = await p.evaluate(() => {
        const b = window.__fishing.dom.querySelector('.fsh-bite');
        if (b.hidden) return null;
        const box = b.getBoundingClientRect();
        const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
        const s = b.offsetWidth; // layout size (unscaled)
        const out = {}; const blockers = {};
        // radius as a fraction of the drawn button's radius (s/2); 1.0 = the navy rim's edge; ring ≈ 1 + 20/(s/2)
        for (const f of [0.3, 0.6, 0.85, 0.95, 1.05, 1.15, 1.3]) {
          let hit = 0, tot = 0;
          for (let a = 0; a < 24; a++) {
            const ang = (a / 24) * Math.PI * 2;
            const x = cx + Math.cos(ang) * f * s / 2, y = cy + Math.sin(ang) * f * s / 2;
            const el = document.elementFromPoint(x, y); tot++;
            if (el && el.closest('.fsh-bite')) hit++; else { const k = el ? (el.className?.baseVal ?? el.className) || el.tagName : 'none'; blockers[k] = (blockers[k] || 0) + 1; }
          }
          out[f] = Math.round((hit / tot) * 100) + '%';
        }
        // the 3D lip under it (box-shadow 7px down)
        let lip = 0; for (let dx = -10; dx <= 10; dx += 5) { const el = document.elementFromPoint(cx + dx, cy + s / 2 + 6); if (el && el.closest('.fsh-bite')) lip++; }
        return { size: s, drawn: Math.round(box.width), out, lip: lip + '/5', blockers, anim: getComputedStyle(b).transform };
      });
      console.log(`bite ${n + 1} @${ms}ms`, JSON.stringify(r));
    }
    n++;
    await p.waitForFunction(() => window.__fishing.dom.querySelector('.fsh-bite').hidden, null, { timeout: 5000 }).catch(() => {});
  }
  await br.close();
})();
