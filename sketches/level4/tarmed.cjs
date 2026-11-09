const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/?nodev');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.click('[data-act=bosses]'); await p.waitForTimeout(400); await p.click('[data-boss="4"]');
  await p.waitForFunction(() => window.game.scene.isActive('Wrestle'), null, { timeout: 120000 });
  await p.waitForTimeout(2000); await p.click('.wr-skip').catch(() => {});
  await p.waitForFunction(() => window.game.scene.getScene('Wrestle').fighting, null, { timeout: 60000 });
  for (const wave of [2, 3]) {
    await p.evaluate((wave) => {
      const s = window.game.scene.getScene('Wrestle');
      s.awayCount = wave - 1;
      s.queen.hp = s.queen.maxHits - wave * 3 + 1;
      s.queen.invulnUntil = 0;
      s.player.invulnUntil = 0;
      window.__shots = 0; window.__hurt = 0;
      const f = s.minionFire.bind(s); s.minionFire = (...a) => { window.__shots++; return f(...a); };
      const h = s.hurtPlayer.bind(s); s.hurtPlayer = (x) => { window.__hurt++; s.hearts = 6; s.player.invulnUntil = 0; return h(x); };
      s.hitQueen(1, 'stomp', s.player.x);
    }, wave);
    await p.waitForFunction(() => { const s = window.game.scene.getScene('Wrestle'); return s.minions.length && s.minions.every((m) => !m.chute); }, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `shots/armed-wave${wave}.png` });
    await p.waitForTimeout(6000);
    console.log('wave', wave, await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); return JSON.stringify({ armed: s.minions.map((m) => m.kind + ':' + (m.weapon?.kind ?? '-')), shotsFired: window.__shots, timesHurt: window.__hurt }); }));
    await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.player.invulnUntil = 1e12; for (const m of s.minions) { m.hp = 1; m.hurtUntil = 0; s.hitMinion(m, 1); } });
    await p.waitForFunction(() => window.game.scene.getScene('Wrestle').queen.mode !== 'away', null, { timeout: 30000 });
  }
  // the ending's water
  await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.queen.hp = 1; s.queen.invulnUntil = 0; s.hitQueen(1, 'stomp', s.player.x); });
  await p.waitForFunction(() => window.game.scene.getScene('Wrestle').flood, null, { timeout: 60000 });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: 'shots/flood-rising.png' });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: 'shots/flood-full.png' });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
