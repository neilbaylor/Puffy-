// usage: node bosses.mjs <port> [secs] -> each boss from the Bosses menu, tapped and keyed through for a while: page errors, and where it got to
import { chromium } from 'playwright';
const [port, secs = '25'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
for (const lvl of (process.env.BOSSES || '1,2,3,4,5').split(',').map(Number)) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1'); });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  await p.goto(`http://localhost:${port}/`);
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
  await p.evaluate(() => document.querySelector('[data-act=bosses]').click());
  await p.waitForFunction(() => !!document.querySelector('[data-boss]'));
  await p.evaluate((l) => document.querySelector(`[data-boss="${l}"]`).click(), lvl);
  await p.evaluate(() => { window.__ev = []; const em = window.game.events.emit.bind(window.game.events); window.game.events.emit = (n, ...a) => { if (!['hud', 'step', 'prestep', 'poststep', 'prerender', 'postrender', 'battle-hud'].includes(n)) window.__ev.push([Math.round(performance.now() / 1000), n]); return em(n, ...a); }; new MutationObserver(() => { const h = document.querySelector('#ui .screen h2, #ui .screen h1'); const t = h?.textContent ?? '-'; if (window.__ev.at(-1)?.[1] !== 'screen:' + t) window.__ev.push([Math.round(performance.now() / 1000), 'screen:' + t]); }).observe(document.getElementById('ui'), { childList: true, subtree: false }); });
  const scene = lvl <= 2 ? 'Hoops' : lvl <= 4 ? 'Wrestle' : 'Fishing';
  await p.waitForFunction((s) => window.game.scene.isActive(s), scene, { timeout: 300000 });
  const t0 = Date.now();
  let k = 0;
  while (Date.now() - t0 < Number(secs) * 1000) {
    // taps in the middle and keys: skip, shots, BITE!, jumps and fire in the ring
    await p.mouse.click(422 + ((k * 37) % 200) - 100, 195 + ((k * 23) % 120) - 60);
    for (const key of ['Space', 'Enter', 'ArrowUp', 'KeyX']) await p.keyboard.press(key);
    if (k % 3 === 0) { await p.keyboard.down('ArrowRight'); await p.waitForTimeout(200); await p.keyboard.up('ArrowRight'); }
    k++;
    await p.waitForTimeout(250);
  }
  const st = await p.evaluate((s) => ({ active: window.game.scene.isActive(s), screen: document.querySelector('#ui .screen h2')?.textContent ?? null, result: document.querySelector('#ui .screen dd')?.textContent ?? null }), scene);
  console.log(JSON.stringify({ boss: lvl, scene, ...st, errs: errs.slice(0, 4), ev: await p.evaluate(() => window.__ev.slice(0, 30)) }));
  await ctx.close();
}
await b.close();
