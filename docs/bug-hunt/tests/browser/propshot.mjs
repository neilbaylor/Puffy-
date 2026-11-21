// usage: node propshot.mjs <port> -> every picture whose canvas is now released, drawn by the game (WebGL) over a black cover; a hash of the screenshot
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
const [port] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const ctx = await b.newContext({ viewport: { width: 900, height: 500 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1'); });
const p = await ctx.newPage();
await p.goto(`http://localhost:${port}/`);
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
// (the bad guys' weapons, the spit, the chase signs etc. are made for a game: draw them now as a game would)
const keys = ['poo', 'stink', 'volleyball', 'volleynet', 'aura', 'soccerball', 'soccerball-big', 'wave', 'scorch', 'chute', 'hstick', 'puck', 'hockeynet', 'nuggie', 'rootbeer', 'rocket', 'flash', 'boulder', 'boulder2', 'bramble', 'bramble2', 'gate', 'gate-swirl', 'tuft', 'puff', 'glow', 'disc', 'ring', 'spark', 'star', 'chip', 'sea-bubble', 'sea-dark'];
const r = await p.evaluate((keys) => {
  document.getElementById('ui').style.display = 'none';
  const sc = window.game.scene.getScene('Menu');
  sc.scene.pause();
  const cam = sc.cameras.main;
  cam.setZoom(1).setRotation(0).setScroll(0, 0);
  sc.add.rectangle(0, 0, 4000, 4000, 0x000000).setOrigin(0).setScrollFactor(0).setDepth(1e6);
  const have = keys.filter((k) => window.game.textures.exists(k));
  have.forEach((k, i) => sc.add.image(30 + (i % 9) * 95, 30 + Math.floor(i / 9) * 110, k).setOrigin(0).setScrollFactor(0).setDepth(1e6 + 1).setScale(0.5));
  return { have: have.length, missing: keys.filter((k) => !window.game.textures.exists(k)) };
}, keys);
await p.evaluate(() => new Promise((res) => { const sc = window.game.scene.getScene('Menu'); sc.scene.resume(); requestAnimationFrame(() => requestAnimationFrame(() => { sc.scene.pause(); res(); })); }));
await p.waitForTimeout(300);
const png = await p.screenshot({ clip: { x: 0, y: 0, width: 900, height: 480 } });
console.log(JSON.stringify({ ...r, hash: createHash('sha256').update(png).digest('hex').slice(0, 16) }));
await b.close();
