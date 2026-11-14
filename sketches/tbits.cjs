// Close-ups of the things now drawn as pictures: a poo puddle (bubbles, gloss streaks), a Giant's health
// pips, and the stamina meter over the hero (normal, then worn out). Level 3, phone size, 2× pixels.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '5'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="3"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2000);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForTimeout(2500);
  const still = () => p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.invulnUntil = 1e12; pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: false, run: false, fire: false, jump: false }) }; });
  await still();
  await p.evaluate(() => document.querySelector('.ctl-tip')?.remove());
  // a puddle
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pd = g.puddles[0]; window.__pd = [pd.x0, pd.x1, pd.y]; g.players[0].body.reset(pd.x0 - 60, pd.y - 60); });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'shots/bits-puddle.png' });
  console.log('puddle', await p.evaluate(() => window.__pd));
  // a giant: put the hero by the first one, wake it, knock 2 pips off
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const gi = g.enemies?.find?.((e) => e.pips) ?? [...(g.gEnemies?.getChildren?.() ?? [])].find((e) => e.pips); window.__gi = !!gi; if (gi) { g.players[0].body.reset(gi.x - 260, gi.y - 30); gi.hp = Math.max(1, gi.maxHp - 2); } });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'shots/bits-giant.png' });
  console.log('giant found:', await p.evaluate(() => window.__gi));
  // stamina meter: half full, then worn out
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.body.reset(pl.x - 400, pl.y - 20); pl.stamina = 0.55; });
  await p.waitForTimeout(700);
  await p.evaluate(() => { window.game.scene.getScene('Game').players[0].stamina = 0.55; });
  await p.screenshot({ path: 'shots/bits-meter.png' });
  await p.evaluate(() => { const pl = window.game.scene.getScene('Game').players[0]; pl.stamina = 0.12; pl.exhausted = true; });
  await p.waitForTimeout(150);
  await p.screenshot({ path: 'shots/bits-meter2.png' });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
