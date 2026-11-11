// The trench: from the block field, sink down the left side (timed), under the wall, climb back up the right.
const { chromium } = require('playwright');
const HERO = process.argv[2] || 'muscles';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((h) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', h); } }, HERO);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'shots/l5/trench-menu.png' });
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  await p.evaluate(() => document.querySelector('.ctl-tip')?.remove());
  const res = p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    pl.invulnUntil = 1e12;
    const T = 32, H = g.level.heightPx;
    pl.body.reset(64 * T, H - (62 + 9) * T);
    const btn = { left: false, right: true, jump: false, fire: false, run: false };
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...btn }) };
    let f = 0, phase = 'field', sinkStart = 0, bottomAt = 0, topAt = 0, shot = 0;
    const log = [];
    const floorAt = (x) => { let k = 0; while (k < 90 && g.level.isSolidAt(x, H - k * T - 16)) k++; return k; };
    const step = () => {
      f++;
      const hx = pl.x / T, h = (H - pl.bottom) / T;
      if (phase === 'field') {
        // weave: keep ~2 tiles over whatever's below or ahead
        const want = Math.max(floorAt(pl.x + 40), floorAt(pl.x + 100)) + 2.5;
        btn.jump = (h < Math.min(want, 62 + 13) || pl.body.blocked.right) && f % 12 < 2;
        if (hx > 94.5) { phase = 'sink'; sinkStart = f; btn.right = false; btn.jump = false; log.push(['sink from h', h.toFixed(1)]); }
      } else if (phase === 'sink') {
        btn.right = hx < 96.5; btn.left = hx > 98;
        if (h < 3.4) { phase = 'under'; bottomAt = f; log.push(['bottom after s', ((f - sinkStart) / 60).toFixed(1)]); }
      } else if (phase === 'under') {
        btn.left = false; btn.right = true; btn.jump = false;
        if (hx > 106.5) { phase = 'climb'; btn.right = false; }
      } else if (phase === 'climb') {
        btn.jump = f % 16 < 2;
        btn.right = hx < 107; btn.left = hx > 108.5;
        if (h > 62 + 4.5) { btn.right = true; btn.left = false; }
        if (hx > 113) { phase = 'out'; topAt = f; log.push(['climb s', ((f - bottomAt) / 60).toFixed(1)]); }
      }
      if (phase === 'sink' && f - sinkStart === 90) window.__s = 1;
      if (phase === 'sink' && f - sinkStart === 240) window.__s = 2;
      if (phase === 'under' && f - bottomAt === 40) window.__s = 3;
      if (phase === 'climb' && f - bottomAt === 500) window.__s = 4;
      if (phase === 'out' || f > 60 * 120) {
        g.events.off('preupdate', step);
        done({ phase, log, x: hx.toFixed(1), h: h.toFixed(1), fps: Math.round(window.game.loop.actualFps), cps: g.checkpoints.filter((c) => c.reached).length });
      }
    };
    g.events.on('preupdate', step);
  }));
  for (let i = 1; i <= 4; i++) {
    await p.waitForFunction((i) => window.__s === i, i, { timeout: 120000 }).catch(() => {});
    await p.screenshot({ path: `shots/l5/trench-${i}.png` });
  }
  console.log(HERO, JSON.stringify(await res));
  await p.screenshot({ path: 'shots/l5/trench-out.png' });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
