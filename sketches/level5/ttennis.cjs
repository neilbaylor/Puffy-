// Crab tennis: watch the rally from afar, then swim in: they smash the clam at you; shoot the clam on court 2.
const { chromium } = require('playwright');
const HERO = process.argv[2] || 'puffy';
const OUT = 'shots/l5';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((h) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', h); } }, HERO);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2000);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  const res = p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    pl.invulnUntil = 1e12;
    g.aura = 3;
    let hits = 0;
    const orig = g.hitPlayer.bind(g);
    g.hitPlayer = (q, fx) => { hits++; orig(q, fx); };
    // hold just outside the first court for a few seconds (watch them rally), then swim in slowly at mid height
    pl.body.reset(93 * 32, g.level.heightPx - 8 * 32);
    const btn = { left: false, right: false, jump: false, fire: false, run: false };
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...btn }) };
    let f = 0, smashes = 0, lastText = 0, popped = false;
    const m2 = g.tennis[1];
    const step = () => {
      f++;
      const h = (g.level.heightPx - pl.bottom) / 32;
      btn.jump = h < 7 && f % 14 < 2;
      if (f > 200) btn.right = f % 3 !== 0;
      for (const o of g.children.list) if (o.type === 'Text' && o.text === 'SMASH!' && !o.__seen) { o.__seen = 1; smashes++; }
      if (f === 120) window.__s = 1;
      if (smashes === 1 && !window.__s2) window.__s2 = f;
      if (window.__s2 && f === window.__s2 + 8) window.__s = 2;
      // on court 2: aim at the clam
      if (pl.x > 122 * 32 && m2.ball.active) { pl.facing = Math.sign(m2.ball.x - pl.x) || 1; btn.fire = f % 20 < 2; }
      if (!m2.ball.active || m2.ball.frame.name === 'open') popped = true;
      if (pl.x > 142 * 32 || f > 60 * 70) {
        g.events.off('preupdate', step);
        done({ frames: f, hits, smashes, popped, crabsLeft: g.enemies.filter((e) => e.kind === 'crab' && !e.dead).length, x: Math.round(pl.x / 32) });
      }
    };
    g.events.on('preupdate', step);
  }));
  await p.waitForFunction(() => window.__s === 1, null, { timeout: 60000 }).catch(() => {});
  await p.screenshot({ path: `${OUT}/tennis-rally.png` });
  await p.waitForFunction(() => window.__s === 2, null, { timeout: 90000 }).catch(() => {});
  await p.screenshot({ path: `${OUT}/tennis-smash.png` });
  console.log(HERO, JSON.stringify(await res));
  await p.screenshot({ path: `${OUT}/tennis-end.png` });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
