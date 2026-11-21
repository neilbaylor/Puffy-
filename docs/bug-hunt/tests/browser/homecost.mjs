// usage: node homecost.mjs <port> [throttle] -> Part 2 played a moment, then Home: GPU MB during the level, and on the way home:
// how long until the start screen is up and every Part's fly-over is ready again (no loading card, nothing left to draw)
import { chromium } from 'playwright';
const [port, thr = '4'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1'); });
const p = await ctx.newPage();
await p.goto(`http://localhost:${port}/`);
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
// (the start screen finishes building the other Parts ahead first)
await p.waitForFunction(() => window.game.scene.getScene('Menu').quietLeft === 0, null, { timeout: 120000, polling: 250 });
const gpu = () => p.evaluate(() => { let g = 0; for (const [k, t] of Object.entries(window.game.textures.list)) if (!k.startsWith('__')) for (const s of t.source) g += s.width * s.height * 4; return +(g / 1e6).toFixed(1); });
const home0 = await gpu();
await p.evaluate(() => { const el = document.querySelector('.lvl[data-lvl="2"]'); el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el?.click(); });
await p.waitForTimeout(2000);
await p.waitForFunction(() => window.game.scene.getScene('Menu').quietLeft === 0, null, { timeout: 120000, polling: 250 });
await p.evaluate(() => document.querySelector('[data-act=play]').click());
await p.waitForFunction(() => window.game.scene.isActive('Game') && !!window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 300000 });
await p.evaluate(() => window.game.events.emit('skip-intro'));
await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 120000 });
await p.waitForTimeout(4000);
const inLevel = await gpu();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(thr) });
await p.keyboard.press('Escape');
await p.waitForFunction(() => !!document.querySelector('[data-act=hero]'));
const t0 = Date.now();
await p.evaluate(() => document.querySelector('[data-act=hero]').click());
await p.waitForFunction(() => window.game.scene.isActive('Menu') && !!document.querySelector('.screen.start'), null, { timeout: 120000, polling: 50 });
const tStart = Date.now() - t0;
const sawCard = await p.evaluate(() => !!document.querySelector('.art-loader'));
await p.waitForFunction(() => !document.querySelector('.art-loader') && window.game.scene.getScene('Menu').quietLeft === 0, null, { timeout: 300000, polling: 50 });
const tReady = Date.now() - t0;
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
console.log(JSON.stringify({ gpuMB: { startScreen: home0, inPart2: inLevel, backHome: await gpu() }, home: { startScreenUpMs: tStart, loadingCard: sawCard, allPartsReadyMs: tReady } }));
await b.close();
