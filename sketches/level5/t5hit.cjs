// Level 5: hold still near a bad guy fish until its bubble hits you; the nuggies drift slowly; then faint + restart in the water.
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
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/menu-${HERO}.png` });
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/inwater-${HERO}.png` });
  // move next to the fish at x 31 (h 12) and wait
  const r = await p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    g.aura = 5;
    pl.body.reset(36 * 32, g.level.heightPx - 11 * 32);
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: false, jump: false, fire: false, run: false }) };
    let f = 0, hitAt = -1;
    const step = () => {
      f++;
      if (hitAt < 0 && g.aura === 0) { hitAt = f; window.__hit = 1; }
      if (hitAt > 0 && f === hitAt + 50) window.__hit = 2;
      if ((hitAt > 0 && f > hitAt + 100) || f > 60 * 20) {
        g.events.off('preupdate', step);
        const sc = g.auras.filter((a) => a.scattered && a.active);
        done({ hitAfter: hitAt, scatteredLeft: sc.length, vys: sc.map((a) => Math.round(a.body.velocity.y)) });
      }
    };
    g.events.on('preupdate', step);
  }));
  console.log(JSON.stringify(r));
  await p.waitForFunction(() => window.__hit === 2, null, { timeout: 2000 }).catch(() => {});
  await p.screenshot({ path: `${OUT}/hit-${HERO}.png` });
  // faint (no nuggies) → restart at the start (no checkpoint): fly-over skipped on retry
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); g.aura = 0; g.hitPlayer(g.players[0], 0); });
  await p.waitForTimeout(4500);
  const after = await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; return { alive: pl.alive, swimming: pl.swimming, x: +(pl.x / 32).toFixed(1), y: Math.round(pl.y), key: pl.view.texture.key }; });
  console.log('after faint', JSON.stringify(after));
  await p.screenshot({ path: `${OUT}/retry-${HERO}.png` });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
