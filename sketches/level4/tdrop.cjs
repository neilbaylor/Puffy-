// parachute drops: walk off each plateau's edge holding right (or left), time the drop, count the Plops, check the landing
const { chromium } = require('playwright');
const HERO = process.argv[2] || 'puffy';
const HOLD = process.argv[3] || 'right';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((h) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '3'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', h); } }, HERO);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="4"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(1500);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForSelector('.lvl-intro', { state: 'detached', timeout: 60000 }).catch(() => {});
  await p.waitForFunction(() => { const g = window.game.scene.getScene('Game'); return !g.intro && !g.cutscene; }, null, { timeout: 60000 });
  await p.waitForTimeout(500);
  for (const [di, label] of [[0, 'drop1'], [1, 'drop2']]) {
    const resP = p.evaluate(([di, HOLD]) => new Promise((done) => {
      const g = window.game.scene.getScene('Game');
      const pl = g.players[0];
      const d = g.chuteDrops[di];
      pl.invulnUntil = 1e12;
      // stand on the plateau a few tiles from its edge, then walk off
      pl.body.reset(d.x0 - 64, d.top - 30);
      const btn = { left: false, right: true, jump: false, fire: false, run: false };
      pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...btn }) };
      let frames = 0, chuteAt = -1, maxPlops = 0, spawned = 0, shots = [];
      const seen = new Set();
      const step = () => {
        frames++;
        if (pl.chute && chuteAt < 0) chuteAt = frames;
        if (chuteAt > 0) { btn.right = HOLD === 'right'; btn.left = HOLD === 'left'; btn.fire = frames % 40 < 2; }
        for (const q of g.dropPlops) if (!seen.has(q.e)) { seen.add(q.e); spawned++; }
        maxPlops = Math.max(maxPlops, g.dropPlops.length);
        const nb = g.children.list.filter((o) => o.texture?.key === 'w-bullet').length;
        if (nb > (window.__nb || 0)) shots.push(frames);
        window.__nb = nb;
        if (frames === chuteAt + 240) window.__shotNow = true;
        if (!pl.alive || (chuteAt > 0 && !pl.chute && pl.onGround) || frames > 60 * 45) {
          g.events.off('preupdate', step);
          const cp = g.checkpoints.filter((c) => c.reached).map((c) => Math.round(c.x / 32));
          done({ why: !pl.alive ? 'fainted' : frames > 60 * 45 ? 'timeout' : 'landed', secs: +((frames - chuteAt) / 60).toFixed(1), landX: +(pl.x / 32).toFixed(1), landH: g.level.data.height - Math.round(pl.bottom / 32), zone: [d.x0 / 32, d.x1 / 32], spawned, maxPlops, shotsFired: shots.length, alive: pl.alive, checkpointsReached: cp, state: { x: +(pl.x / 32).toFixed(1), h: +((g.level.data.height * 32 - pl.bottom) / 32).toFixed(1), chute: !!pl.chute, ground: pl.onGround, goo: pl.goo, vy: Math.round(pl.body.velocity.y), chuteAt }, fps: Math.round(window.game.loop.actualFps) });
        }
      };
      g.events.on('preupdate', step);
    }), [di, HOLD]);
    await p.waitForFunction(() => window.__shotNow, null, { timeout: 120000 }).catch(() => {});
    await p.evaluate(() => (window.__shotNow = false));
    await p.screenshot({ path: `shots/drop-mid-${label}.png` });
    const res = await resP;
    console.log(HERO, HOLD, label, JSON.stringify(res));
    await p.screenshot({ path: `shots/drop-${label}.png` });
  }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
