// a real 2-player battle: does it keep going, do chairs and bad guys turn up?
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const errs = [];
  const room = 'frz' + Math.floor(Math.random() * 1e5);
  const mk = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text().slice(0, 200)); });
    await p.addInitScript(([n]) => localStorage.setItem('puffy.name', n), [name]);
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]'); await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 30000 });
    return p;
  };
  const a = await mk('Neil');
  const c = await mk('Henry');
  await c.evaluate(() => document.querySelector('.bl-start')?.click());
  await Promise.all([a, c].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  const st = (p) => p.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    const last = s.snaps.at(-1);
    return { t: last?.t ?? last?.tick, snaps: s.snaps.length, frame: window.game.loop.frame, keys: last ? Object.keys(last).join(',') : '', enemies: (last?.enemies ?? last?.e ?? []).length, chairs: (last?.chairs ?? last?.c ?? []).length, drops: (last?.drops ?? last?.hazards ?? []).length, timeLeft: last?.left ?? last?.timeLeft };
  });
  for (let i = 0; i < 16; i++) {
    // keep them moving a bit
    await a.keyboard.down(i % 2 ? 'ArrowLeft' : 'ArrowRight'); await c.keyboard.down(i % 2 ? 'ArrowRight' : 'ArrowLeft');
    await a.waitForTimeout(2500);
    await a.keyboard.up(i % 2 ? 'ArrowLeft' : 'ArrowRight'); await c.keyboard.up(i % 2 ? 'ArrowRight' : 'ArrowLeft');
    await a.keyboard.press('KeyX');
    await a.waitForTimeout(2500);
    console.log((i + 1) * 5 + 's', 'A', JSON.stringify(await st(a)), 'C', JSON.stringify(await st(c)));
    if (i === 6) await a.screenshot({ path: 'shots/battle-35s.png' });
  }
  await a.screenshot({ path: 'shots/battle-80s.png' });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
