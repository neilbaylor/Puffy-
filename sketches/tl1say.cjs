// Part 1: the opening line after the fly-over; "Wow!" at the Giant once, and not again after fainting back to a checkpoint.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { localStorage.setItem('puffy.hero', 'puffy'); });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(800);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); window.__said = []; const s = g.say.bind(g); g.say = (pl, t, ms) => { window.__said.push(t); return s(pl, t, ms); }; g.events.emit; window.game.events.emit('skip-intro'); });
  await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'shots/l1-say.png' });
  const toGiant = () => p.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    const gi = g.enemies.find((e) => e.kind === 'giant' && !e.dead);
    const pl = g.players[0];
    pl.invulnUntil = g.time.now + 3000;
    pl.body.reset(gi.x - 260, gi.y - 60);
    return Math.round(gi.x / 32);
  });
  console.log('giant at', await toGiant());
  await p.waitForTimeout(2500);
  console.log('said', JSON.stringify(await p.evaluate(() => window.__said)));
  // faint: back to a checkpoint
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); g.players[0].invulnUntil = 0; g.players[0].faint(false); });
  await p.waitForFunction(() => { const g = window.game.scene.getScene('Game'); return g.players?.[0]?.alive && g.time.now > 500; }, null, { timeout: 30000 });
  await p.waitForTimeout(3000);
  console.log('retry saidWow', await p.evaluate(() => window.game.scene.getScene('Game').saidWow));
  await toGiant();
  await p.waitForTimeout(2500);
  console.log('said after retry', JSON.stringify(await p.evaluate(() => window.__said)));
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
