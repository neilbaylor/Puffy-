// Battle with hats: Neil wears the party hat, Henry doesn't; the lobby squares and the battle show it
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const errs = [];
  const room = 'hat' + (Date.now() % 100000);
  const mk = async (name, hat, scale = 1) => {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: scale });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ' ' + e.message));
    await p.addInitScript(([n, hat]) => { localStorage.setItem('puffy.name', n); localStorage.setItem('puffy.items', 'party'); localStorage.setItem('puffy.hat', hat || 'none'); }, [name, hat]);
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]'); await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 30000 });
    return p;
  };
  const a = await mk('Neil', 'party', 2);
  const c = await mk('Henry', '');
  await a.waitForTimeout(1500);
  await a.screenshot({ path: 'shots/bhat-lobby.png' });
  console.log('room hats', JSON.stringify(await a.evaluate(() => window.game.scene.getScene('Battle')?.net?.room?.players?.map((p) => [p.name, p.hat]) ?? null)));
  await c.evaluate(() => document.querySelector('.bl-start')?.click());
  await Promise.all([a, c].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  await a.waitForTimeout(2500);
  // bring them together, then look
  await c.keyboard.down('ArrowLeft'); await a.keyboard.down('ArrowRight');
  await a.waitForTimeout(3000);
  await c.keyboard.up('ArrowLeft'); await a.keyboard.up('ArrowRight');
  await a.waitForTimeout(500);
  console.log('views', JSON.stringify(await a.evaluate(() => [...window.game.scene.getScene('Battle').views.entries()].map(([id, v]) => [id, v.hat, v.sprite.texture.key, v.sprite.frame.realHeight]))));
  await a.screenshot({ path: 'shots/bhat-battle.png' });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
