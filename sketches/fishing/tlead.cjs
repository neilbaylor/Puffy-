// Part 5's gate → the fishing contest, timed: when the purple stinger sweeps off, and when the host starts talking.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'scruffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2000);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.invulnUntil = 1e12; pl.body.reset(250 * 32, g.level.heightPx - 72 * 32); pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: true, run: false, fire: false, jump: Math.random() < 0.08 }) }; });
  await p.waitForFunction(() => window.game.scene.isActive('Fishing'), null, { timeout: 90000, polling: 50 });
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < 7000) {
    const [st, cc] = await p.evaluate(() => { const e = document.querySelector('.stinger'); return [e ? (e.classList.contains('out') ? 'sweeping off' : 'covering') : 'gone', (document.querySelector('.tvo-cc')?.textContent || '').slice(0, 20)]; });
    const now = `stinger ${st} | captions "${cc}"`;
    if (now !== last) { console.log(((Date.now() - t0) / 1000).toFixed(2) + 's', now); last = now; }
    if (st !== 'gone' || cc.length < 3) await p.screenshot({ path: `shots/fishing/lead-${((Date.now() - t0) / 100).toFixed(0).padStart(3, '0')}.png` });
    await p.waitForTimeout(100);
  }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
