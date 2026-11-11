// Kai fish: the first sighting line, two hits, he zooms away; then a look down the wider trench and the HUD portrait.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); localStorage.setItem('puffy.items', 'party,frogskins,board'); localStorage.setItem('puffy.wear', 'board,frogskins,party'); } });
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
  await p.evaluate(() => document.querySelector('.ctl-tip')?.remove());
  const r = await p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    pl.invulnUntil = 1e12;
    const T = 32, H = g.level.heightPx;
    pl.body.reset(70 * T, H - (62 + 12) * T);
    const btn = { left: false, right: false, jump: false, fire: false, run: false };
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...btn }) };
    let f = 0, said = null, fleeAt = -1, hits = 0;
    const kai = g.enemies.find((e) => e.kind === 'kai' && e.x < 100 * T);
    const hp0 = kai.hp;
    const step = () => {
      f++;
      for (const o of g.children.list) if (o.type === 'Container') for (const c of o.list ?? []) if (c.type === 'Text' && /Kai/.test(c.text)) said = c.text;
      // keep level with him and fire at him
      btn.jump = pl.y > kai.y + 10 && f % 10 < 2;
      pl.facing = Math.sign(kai.x - pl.x) || 1;
      btn.fire = f % 25 < 2 && Math.abs(kai.y - pl.y) < 30;
      if (f === 90) window.__k = 1;
      if (kai.dead && fleeAt < 0) { fleeAt = f; window.__k = 2; }
      if ((fleeAt > 0 && f > fleeAt + 30) || f > 60 * 40) {
        g.events.off('preupdate', step);
        done({ said, hp0, kaiDead: kai.dead, fleeFrames: fleeAt, kaiX: Math.round(kai.x / T), alpha: kai.alpha });
      }
    };
    g.events.on('preupdate', step);
  }));
  console.log('kai', JSON.stringify(r));
  await p.screenshot({ path: 'shots/l5/kai-flee.png' });
  // the trench: hover in the middle of the left side, half way down; then at the bottom
  for (const [x, h, name] of [[104, 40, 'trench-mid'], [104, 6, 'trench-low']]) {
    await p.evaluate(([x, h]) => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.body.reset(x * 32, g.level.heightPx - h * 32); pl.input = { ...pl.input, poll: () => ({ left: false, right: false, run: false, fire: false, jump: (g.level.heightPx - pl.bottom) / 32 < h && Math.random() < 0.2 }) }; }, [x, h]);
    await p.waitForTimeout(2200);
    await p.screenshot({ path: `shots/l5/${name}.png` });
  }
  await p.screenshot({ path: 'shots/l5/hud.png', clip: { x: 0, y: 0, width: 240, height: 60 } });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
