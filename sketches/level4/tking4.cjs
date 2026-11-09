// the Plop King fight: intro shots, his flights off with each wave of Plops, his return, and the ending
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '3'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  console.log('bosses:', await p.evaluate(() => [...document.querySelectorAll('[data-boss]')].map((b) => b.textContent.trim()).join(' / ')));
  await p.click('[data-boss="4"]');
  await p.waitForFunction(() => window.game.scene.isActive('Wrestle'), null, { timeout: 120000 });
  const shots = [[2500, 'jumbo'], [5900, 'aisle-far'], [7200, 'aisle-back'], [8400, 'aisle-side'], [9500, 'aisle-front'], [11200, 'robe'], [13000, 'says']];
  let t = 0;
  for (const [at, name] of shots) { await p.waitForTimeout(at - t); t = at; await p.screenshot({ path: `shots/k4-${name}.png` }); }
  await p.waitForFunction(() => window.game.scene.getScene('Wrestle').fighting, null, { timeout: 60000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'shots/k4-fight.png' });
  const S = () => p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.player.invulnUntil = 1e12; return { hp: s.queen.hp, mode: s.queen.mode, vis: s.queen.spr.visible, minions: s.minions.map((m) => m.kind + (m.chute ? '/chute' : '')).join(','), away: s.awayCount }; });
  for (let wave = 1; wave <= 3; wave++) {
    // four hits: off he goes
    for (let i = 0; i < 4; i++) await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.queen.invulnUntil = 0; s.hitQueen(1, 'stomp', s.player.x); });
    await p.waitForTimeout(1200);
    if (wave === 1) await p.screenshot({ path: 'shots/k4-blastoff.png' });
    if (wave === 1) { await p.waitForTimeout(500); await p.screenshot({ path: 'shots/k4-chutes.png' }); console.log('  depths', JSON.stringify(await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); return s.minions.map((m) => [Math.round(m.spr.y), m.spr.depth, !!m.chute]); }))); }
    await p.waitForTimeout(2200);
    console.log('wave', wave, JSON.stringify(await S()));
    if (wave === 3) { const h = await S(); if (h.hp !== 4) console.log('!! expected 4 hits left for the last round, got', h.hp); }
    await p.screenshot({ path: `shots/k4-wave${wave}.png` });
    await p.waitForTimeout(2500);
    console.log('  landed', JSON.stringify(await S()));
    // pop them all
    await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); for (const m of s.minions) { m.hp = 1; m.hurtUntil = 0; s.hitMinion(m, 1); } });
    await p.waitForTimeout(2500);
    console.log('  back?', JSON.stringify(await S()));
    if (wave === 1) await p.screenshot({ path: 'shots/k4-back.png' });
  }
  // the last four
  for (let i = 0; i < 4; i++) await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.queen.invulnUntil = 0; s.hitQueen(1, 'stomp', s.player.x); });
  console.log('final', JSON.stringify(await S()));
  const end = [[1600, 'steps'], [2600, 'boom'], [6200, 'jumbo-champ'], [7600, 'jumbo-flood'], [9800, 'flooding-a'], [11500, 'flooding'], [15500, 'kingbob']];
  t = 0;
  for (const [at, name] of end) { await p.waitForTimeout(at - t); t = at; await p.screenshot({ path: `shots/k4-${name}.png` }); }
  await p.waitForTimeout(4000);
  console.log('after:', await p.evaluate(() => document.querySelector('.screen h2')?.textContent || '(no screen)'));
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
