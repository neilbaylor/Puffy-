// Battle with gear: Neil has everything on, Henry the sunglasses and skateboard; the lobby squares and the battle show it (orange lenses in every colour)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const errs = [];
  const room = 'hat' + (Date.now() % 100000);
  const mk = async (name, hat, scale = 1) => {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: scale });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ' ' + e.message));
    await p.addInitScript(([n, hat]) => { localStorage.setItem('puffy.name', n); localStorage.setItem('puffy.items', 'party,frogskins,board'); localStorage.setItem('puffy.wear', hat || 'none'); }, [name, hat]);
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]'); await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 30000 });
    return p;
  };
  const a = await mk('Neil', 'party,frogskins,board', 2);
  const c = await mk('Henry', 'frogskins,board');
  await a.waitForTimeout(1500);
  await a.screenshot({ path: 'shots/bgear-lobby.png' });
  console.log('room hats', JSON.stringify(await a.evaluate(() => window.game.scene.getScene('Battle')?.net?.room?.players?.map((p) => [p.name, p.wear]) ?? null)));
  await c.evaluate(() => document.querySelector('.bl-start')?.click());
  await Promise.all([a, c].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  await a.waitForTimeout(2500);
  // bring them together, then look
  await c.keyboard.down('ArrowLeft'); await a.keyboard.down('ArrowRight');
  await a.waitForTimeout(3000);
  await c.keyboard.up('ArrowLeft'); await a.keyboard.up('ArrowRight');
  await a.waitForTimeout(500);
  console.log('views', JSON.stringify(await a.evaluate(() => [...window.game.scene.getScene('Battle').views.entries()].map(([id, v]) => [id, v.wear, v.sprite.texture.key, v.sprite.frame.realHeight]))));
  await a.screenshot({ path: 'shots/bgear-battle.png' });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
