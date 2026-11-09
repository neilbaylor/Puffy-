// the chair against the Plop King's small Plops: stand by one, swing, see it go
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '3'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(400);
  await p.click('[data-boss="4"]');
  await p.waitForFunction(() => window.game.scene.isActive('Wrestle'), null, { timeout: 120000 });
  await p.waitForTimeout(2000);
  await p.click('.wr-skip').catch(() => {});
  await p.waitForFunction(() => window.game.scene.getScene('Wrestle').fighting, null, { timeout: 60000 });
  await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.player.invulnUntil = 1e12; window.__fire = false; s.rawInput = { poll: () => ({ fire: window.__fire }) }; for (let i = 0; i < 3; i++) { s.queen.invulnUntil = 0; s.hitQueen(1, 'stomp', s.player.x); } });
  await p.waitForFunction(() => { const s = window.game.scene.getScene('Wrestle'); return s.minions.length === 3 && s.minions.every((m) => !m.chute); }, null, { timeout: 60000 });
  // a chair, and pick it up
  await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.chairIn = 0; });
  await p.waitForFunction(() => window.game.scene.getScene('Wrestle').chair?.state === 'lie', null, { timeout: 30000 });
  await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.player.body.reset(s.chair.img.x, s.player.bottom - 30); });
  await p.waitForFunction(() => window.game.scene.getScene('Wrestle').chair?.state === 'held', null, { timeout: 10000 });
  await p.waitForTimeout(500);
  const out = [];
  for (let k = 0; k < 3; k++) {
    // stand just beside the next small Plop (facing it, or facing away for the last one), and swing
    const r = await p.evaluate((k) => {
      const s = window.game.scene.getScene('Wrestle');
      const m = s.minions.find((q) => !q.dead);
      if (!m) return null;
      const pl = s.player;
      const side = k === 2 ? 1 : -1; // (last one: you're facing away from it — the swing should turn you)
      pl.body.reset(m.spr.x + side * 34, pl.bottom - 30);
      pl.facing = k === 2 ? 1 : 1;
      m.spr.body.setVelocity(0, 0);
      return { hp: m.hp };
    }, k);
    if (!r) break;
    await p.waitForTimeout(150);
    await p.evaluate(() => (window.__fire = true));
    await p.waitForTimeout(120);
    await p.evaluate(() => (window.__fire = false));
    await p.waitForTimeout(700);
    out.push(await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); return { left: s.minions.filter((m) => !m.dead).length, chair: s.chair?.state ?? null }; }));
    if (k === 0) await p.screenshot({ path: 'shots/chair-plop.png' });
  }
  console.log(JSON.stringify(out));
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
