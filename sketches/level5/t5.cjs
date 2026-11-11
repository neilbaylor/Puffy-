// Level 5 (under the sea): start screen, the dive intro, swimming along, the fish firing.
const { chromium } = require('playwright');
const HERO = process.argv[2] || 'puffy';
const OUT = 'shots/l5';
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((h) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', h); } }, HERO);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${OUT}/menu.png` });
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/flyover.png` });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => { const g = window.game.scene.getScene('Game'); return !g.intro; }, null, { timeout: 60000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/speech.png` });
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].body.velocity.y < 0, null, { timeout: 8000 }).catch(() => console.log('no dive'));
  await p.waitForTimeout(250);
  await p.screenshot({ path: `${OUT}/dive.png` });
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 8000 }).catch(() => console.log('never swam'));
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${OUT}/splash.png` });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/inwater.png` });
  // swim right: stroke now and then, firing
  const res = await p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    pl.invulnUntil = 1e12;
    const btn = { left: false, right: true, jump: false, fire: false, run: false };
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...btn }) };
    let f = 0, minY = 1e9, maxY = 0, shots = 0, strokes = 0, maxVy = -1e9;
    const seenB = new Set();
    g.events.on('hero-stroke', () => strokes++);
    const step = () => {
      f++;
      // keep at mid-water: stroke when below ~ 9 tiles from the bottom
      const h = (g.level.heightPx - pl.bottom) / 32;
      // (the sea bed's height a little ahead: count solid tiles up from the bottom)
      const floorAt = (x) => { let k = 0; while (k < 30 && g.level.isSolidAt(x, g.level.heightPx - k * 32 - 16)) k++; return k; };
      const want = Math.max(floorAt(pl.x + 40), floorAt(pl.x + 110)) + 3.5;
      btn.jump = (h < want || pl.body.blocked.right) && f % 12 < 2;
      btn.fire = f % 50 < 2;
      minY = Math.min(minY, pl.body.center.y); maxY = Math.max(maxY, pl.body.center.y);
      if (!pl.onGround) maxVy = Math.max(maxVy, pl.body.velocity.y);
      for (const o of g.children.list) if (o.texture?.key === 'fish-bubble' && !seenB.has(o)) { seenB.add(o); shots++; }
      if (f === 400) window.__shot = 1;
      if (f === 900) window.__shot = 2;
      if (pl.x > 183 * 32 || f > 60 * 90) {
        g.events.off('preupdate', step);
        done({ frames: f, x: +(pl.x / 32).toFixed(1), surface: g.level.data.water, minY: Math.round(minY), maxY: Math.round(maxY), maxSinkVy: Math.round(maxVy), strokes, bubblesSeen: shots, fishLeft: g.enemies.filter((e) => !e.dead).length, popped: window.__popped, swimming: pl.swimming, fps: Math.round(window.game.loop.actualFps) });
      }
    };
    g.events.on('preupdate', step);
  }));
  const shotsP = (async () => {
    await p.waitForFunction(() => window.__shot === 1, null, { timeout: 60000 }).catch(() => {});
    await p.screenshot({ path: `${OUT}/swim1.png` });
    await p.waitForFunction(() => window.__shot === 2, null, { timeout: 60000 }).catch(() => {});
    await p.screenshot({ path: `${OUT}/swim2.png` });
  })();
  console.log(HERO, JSON.stringify(await res));
  await shotsP;
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
