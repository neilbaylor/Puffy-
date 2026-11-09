// the chair against the Plop King's Plops while they're still on their parachutes
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
  await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.player.invulnUntil = 1e12; window.__fire = false; s.rawInput = { poll: () => ({ fire: window.__fire }) }; s.chairIn = 0; });
  await p.waitForFunction(() => window.game.scene.getScene('Wrestle').chair?.state === 'lie', null, { timeout: 30000 });
  await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.player.body.reset(s.chair.img.x, s.player.bottom - 30); });
  await p.waitForFunction(() => window.game.scene.getScene('Wrestle').chair?.state === 'held', null, { timeout: 10000 });
  // four hits: off he goes, and his Plops come down
  await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); for (let i = 0; i < 4; i++) { s.queen.invulnUntil = 0; s.hitQueen(1, 'stomp', s.player.x); } });
  await p.waitForFunction(() => window.game.scene.getScene('Wrestle').minions.length >= 3, null, { timeout: 20000 });
  const out = [];
  for (let k = 0; k < 3; k++) {
    // wait till one of them, still on its parachute, is coming down to about head height; stand beside it; swing
    const ok = await p.waitForFunction(() => {
      const s = window.game.scene.getScene('Wrestle');
      const pl = s.player;
      return s.minions.some((m) => !m.dead && m.chute && m.spr.body.bottom > pl.body.top - 50 && m.spr.body.bottom < pl.body.top - 4);
    }, null, { timeout: 20000 }).then(() => true).catch(() => false);
    if (!ok) break;
    const before = await p.evaluate(() => {
      const s = window.game.scene.getScene('Wrestle');
      const pl = s.player;
      const m = s.minions.find((q) => !q.dead && q.chute && q.spr.body.bottom > pl.body.top - 50 && q.spr.body.bottom < pl.body.top - 4);
      pl.body.reset(m.spr.x - 30, pl.bottom - 30);
      pl.facing = 1;
      window.__m = m;
      return { kind: m.kind, hp: m.hp, chute: !!m.chute, above: Math.round(pl.body.top - m.spr.body.bottom) };
    });
    await p.evaluate(() => (window.__fire = true));
    await p.waitForTimeout(120);
    await p.evaluate(() => (window.__fire = false));
    await p.waitForTimeout(500);
    const after = await p.evaluate(() => { const m = window.__m; return { dead: m.dead, hp: m.hp, chute: !!m.chute }; });
    out.push({ before, after });
    if (k === 0) await p.screenshot({ path: 'shots/chair-chute.png' });
  }
  console.log(JSON.stringify(out));
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
