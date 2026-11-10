// the Shop: 25 root beer, buy the party hat, wear it; the start screen and a level with it on
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.beaten', '1'); localStorage.setItem('puffy.rootbeer', '25'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.click('[data-act=shop]');
  await p.waitForSelector('.shop-panel');
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'shots/shop-1.png' });
  console.log('before:', await p.evaluate(() => document.querySelector('.shop-rb').textContent.trim()), '|', await p.evaluate(() => document.querySelector('.shop-info .btn').textContent.trim()));
  await p.click('[data-buy=party]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'shots/shop-2.png' });
  console.log('after:', await p.evaluate(() => document.querySelector('.shop-rb').textContent.trim()), '|', await p.evaluate(() => document.querySelector('.shop-info .btn').textContent.trim()), '| stored', await p.evaluate(() => [localStorage.getItem('puffy.spent'), localStorage.getItem('puffy.items'), localStorage.getItem('puffy.hat')].join(' ')));
  await p.click('[data-act=back]');
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'shots/shop-start.png' });
  // into level 1
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => { const g = window.game.scene.getScene('Game'); return !g.intro && !g.cutscene; }, null, { timeout: 60000 });
  await p.waitForTimeout(800);
  const info = await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const v = g.players[0].view; return { tex: v.texture.key, fh: v.frame.realHeight, hud: document.querySelector('.hud')?.textContent?.replace(/\s+/g, ' ').slice(0, 80) }; });
  console.log('in game', JSON.stringify(info));
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); g.cameras.main.setZoom(3); g.cameras.main.startFollow(g.players[0].view); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'shots/shop-game.png' });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
