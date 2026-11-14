// Battle results card: a tap on Leave right as it shows is ignored (mashed shoot taps); one after 1.5 s leaves.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('puffy.beaten', '1'));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.click('[data-act=battle]');
  await p.waitForFunction(() => window.__battle, null, { timeout: 20000 });
  const show = () => p.evaluate(() => {
    const b = window.__battle;
    window.__left = 0;
    b.leave = () => { window.__left++; };
    b.net = { myId: 'me', room: null, close() {} };
    b.inBattle = false;
    const P = (id, name, hero, slot, kos, deaths) => ({ id, name, hero, slot, kos, deaths, wear: '', connected: true, playing: true });
    b.showResults({ phase: 'results', players: [P('me', 'Neil', 'puffy', 0, 3, 1), P('b', 'Henry', 'scruffy', 1, 2, 3)], timer: 8, winner: 'me' });
  });
  await show();
  await p.waitForTimeout(150);
  await p.screenshot({ path: 'shots/battle/guard-early.png' });
  await p.click('.br-foot [data-act=leave]', { force: true });
  await p.waitForTimeout(200);
  const early = await p.evaluate(() => window.__left);
  await p.waitForTimeout(1600);
  await p.screenshot({ path: 'shots/battle/guard-live.png' });
  await p.click('.br-foot [data-act=leave]');
  await p.waitForTimeout(200);
  const late = await p.evaluate(() => window.__left);
  console.log('tap at 0.15 s left the room:', early > 0, '| tap after 1.7 s left the room:', late > 0, '|', errs.join(' | ') || 'no errors');
  await br.close();
})();
