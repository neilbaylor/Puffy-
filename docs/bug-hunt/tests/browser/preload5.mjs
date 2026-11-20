// usage: node preload5.mjs <port> -> Part 5: the hero moved past two-thirds of the level; is the boss song (King Bob's contest's) decoded ahead?
import { chromium } from 'playwright';
const [port] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.light', '1'); });
const p = await ctx.newPage();
await p.goto(`http://localhost:${port}/`);
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
await p.mouse.click(10, 10); // (the first tap: audio allowed)
await p.evaluate(() => { const el = document.querySelector('.lvl[data-lvl="5"]'); el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el?.click(); });
await p.waitForTimeout(1500);
await p.evaluate(() => document.querySelector('[data-act=play]').click());
await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 300000 });
await p.evaluate(() => window.game.events.emit('skip-intro'));
await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 120000 });
await p.waitForTimeout(3000);
const before = await p.evaluate(() => window.__music().decoded);
await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.invulnUntil = 1e15; pl.body.reset(g.level.widthPx * 0.7, pl.body.y); });
await p.waitForTimeout(6000);
const after = await p.evaluate(() => ({ decoded: window.__music().decoded, x: Math.round(window.game.scene.getScene('Game').players[0].x), w: window.game.scene.getScene('Game').level.widthPx }));
console.log(JSON.stringify({ before, after }));
await b.close();
