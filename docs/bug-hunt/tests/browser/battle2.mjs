// usage: node battle2.mjs <port> [players] -> a whole battle (BATTLE_SECS on the server) with N players running, jumping, shooting
// and throwing bombs; one player reloads the page mid-battle. Page errors, and what each sees at the end.
import { chromium } from 'playwright';
const [port, n = '3'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const room = 'b' + Math.floor(Math.random() * 1e6);
const errs = [];
const pages = [];
for (let i = 0; i < Number(n); i++) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((nm) => { localStorage.setItem('puffy.name', nm); localStorage.setItem('puffy.light', '1'); }, 'P' + i);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`P${i}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && errs.push(`P${i} console: ${m.text()}`));
  await p.goto(`http://localhost:${port}/`);
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => document.querySelector('[data-act=battle]').click());
  await p.waitForFunction(() => !!document.querySelector('.bc-box input'));
  await p.fill('.bc-box input', room);
  await p.evaluate(() => document.querySelector('.battle-code [data-act=go]').click());
  pages.push(p);
}
const bot = (p, k) => p.evaluate((k) => { let t = 0; window.__bot = setInterval(() => { t++; const key = (c, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, bubbles: true })); const right = Math.floor((t + k * 17) / 40) % 2 === 0; key('ArrowRight', right); key('ArrowLeft', !right); key('ArrowUp', (t + k) % 9 < 2); key('KeyX', (t + k) % 4 < 2); key('KeyB', (t + k) % 50 === 0); }, 50); }, k);
await Promise.all(pages.map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 120000 })));
await Promise.all(pages.map((p, k) => bot(p, k)));
await pages[0].waitForTimeout(12000);
// one player reloads mid-battle (same tab: their place back)
await pages[1].reload();
await pages[1].waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
await pages[1].evaluate(() => document.querySelector('[data-act=battle]').click());
await pages[1].waitForFunction(() => !!document.querySelector('.bc-box input'));
await pages[1].fill('.bc-box input', room);
await pages[1].evaluate(() => document.querySelector('.battle-code [data-act=go]').click());
const back = await pages[1].waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 60000 }).then(() => true).catch(() => false);
if (back) await bot(pages[1], 1);
const x0 = back ? await pages[1].evaluate(() => window.game.scene.getScene('Battle').me?.x) : null;
await pages[0].waitForTimeout(5000);
const x1 = back ? await pages[1].evaluate(() => window.game.scene.getScene('Battle').me?.x) : null;
await Promise.all(pages.map((p) => p.waitForFunction(() => document.querySelector('.battle-results'), null, { timeout: 90000 }).catch(() => null)));
const ends = await Promise.all(pages.map((p) => p.evaluate(() => ({ title: document.querySelector('.battle-results h2')?.textContent ?? null, rows: [...document.querySelectorAll('.br-list li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()) }))));
console.log(JSON.stringify({ rejoined: back, movedAfterRejoin: x0 !== null && x1 !== null ? Math.round(x1 - x0) : null, ends, errs: errs.slice(0, 8) }, null, 1));
await b.close();
