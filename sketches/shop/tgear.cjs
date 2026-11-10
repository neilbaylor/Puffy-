// the Shop with three things: 33 root beer, buy and wear all three; the start screen and level 1 with them on
const { chromium } = require('playwright');
const hero = process.argv[2] || 'puffy';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((hero) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.rootbeer', '33'); localStorage.setItem('puffy.hero', hero); localStorage.setItem('puffy.hat', 'party'); } }, hero);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  console.log('migrated hat:', await p.evaluate(() => [localStorage.getItem('puffy.hat'), localStorage.getItem('puffy.wear')].join(' / ')));
  await p.click('[data-act=shop]');
  await p.waitForSelector('.shop-panel');
  await p.screenshot({ path: `shots/gear-shop0-${hero}.png` });
  for (const id of ['party', 'frogskins', 'board']) { await p.click(`[data-buy=${id}]`); await p.waitForTimeout(250); }
  const st = () => p.evaluate(() => [document.querySelector('.shop-rb').textContent.trim(), [...document.querySelectorAll('.shop-info .btn')].map((b) => b.textContent.trim()).join(','), localStorage.getItem('puffy.items'), localStorage.getItem('puffy.wear')].join(' | '));
  console.log('bought:', await st());
  await p.screenshot({ path: `shots/gear-shop1-${hero}.png` });
  await p.click('[data-off=party]'); await p.waitForTimeout(250);
  console.log('hat off:', await st());
  await p.click('[data-wear=party]'); await p.waitForTimeout(250);
  console.log('hat on:', await st());
  await p.click('[data-act=back]');
  await p.waitForTimeout(600);
  await p.screenshot({ path: `shots/gear-start-${hero}.png` });
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => { const g = window.game.scene.getScene('Game'); return !g.intro && !g.cutscene; }, null, { timeout: 60000 });
  await p.waitForTimeout(800);
  const info = await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const v = g.players[0].view; return { tex: v.texture.key, fh: v.frame.realHeight }; });
  console.log('in game', JSON.stringify(info));
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); g.cameras.main.setZoom(2.5); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `shots/gear-game-${hero}.png` });
  // walk right, jump (the ollie)
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(500);
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(220);
  await p.screenshot({ path: `shots/gear-ollie-${hero}.png` });
  await p.keyboard.up('ArrowUp');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/gear-fall-${hero}.png` });
  await p.keyboard.up('ArrowRight');
  // to the first Giant Puff: put the hero near it and see "Wow!"
  const gx = await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const e = g.enemies.filter((e) => e.kind === 'giant').sort((a, b) => a.x - b.x)[0]; return e ? e.x : null; });
  console.log('first giant at', gx);
  await p.evaluate((gx) => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.body.reset(gx - 330, pl.body.y - 60); g.cameras.main.setZoom(1); }, gx);
  const said = await p.waitForFunction(() => window.game.scene.getScene('Game').saidWow, null, { timeout: 8000 }).then(() => true, () => false);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `shots/gear-wow-${hero}.png` });
  console.log('wow said:', said);
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
