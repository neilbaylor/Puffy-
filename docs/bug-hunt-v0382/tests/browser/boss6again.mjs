// usage: node boss6again.mjs <port> [startBoss=6] [againBoss=6] -> Bosses menu (dev device: Boss 6 there): win King Bob's rematch (a perfect tap on every BITE!), see its ending, then
// "Play again" (or Home, then another fishing boss): is the hero on the boat, are the rods drawn?
import { chromium } from 'playwright';
const [port, first = '6', again = '6'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1'); });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:' + port + '/');
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
const openBoss = async (n) => {
  await p.evaluate(() => document.querySelector('[data-act=bosses]').click());
  await p.waitForFunction(() => !!document.querySelector('[data-boss]'));
  await p.evaluate((n) => document.querySelector('[data-boss="' + n + '"]').click(), n);
  await p.waitForFunction(() => window.game.scene.isActive('Fishing') && window.game.scene.getScene('Fishing').clock < 3000, null, { timeout: 300000 });
};
const state = () => p.evaluate(() => { const sc = window.game.scene.getScene('Fishing'); return { level: sc.fd.level, clock: Math.round(sc.clock), heroFree: sc.heroFree, rodsDown: sc.rodsDown, freeCam: sc.freeCam, hero: { x: Math.round(sc.hero.x), y: Math.round(sc.hero.y), visible: sc.hero.visible }, score: sc.score }; });
await openBoss(first);
await p.evaluate(() => {
  const sc = window.game.scene.getScene('Fishing');
  window.__perfect = () => { const bt = document.querySelector('.fsh-bite'); if (bt && !bt.hidden && !sc.biteHit) sc.biteHit = true; };
  sc.events.on('postupdate', window.__perfect);
});
const t0 = Date.now();
let title = null;
while (Date.now() - t0 < 900000) {
  title = await p.evaluate(() => (document.querySelector('#ui .screen [data-act=again]') ? document.querySelector('#ui .screen h2')?.textContent : null));
  if (title) break;
  await p.evaluate(() => { const s = document.querySelector('.hoops-skip'); if (s && !s.hidden) s.click(); });
  await p.waitForTimeout(1000);
}
console.log('contest 1 (boss ' + first + '):', title, '| left behind:', JSON.stringify(await state()));
await p.evaluate(() => window.game.scene.getScene('Fishing').events.off('postupdate', window.__perfect));
if (again === first) await p.evaluate(() => document.querySelector('[data-act=again]').click());
else { await p.evaluate(() => document.querySelector('[data-act=home]').click()); await p.waitForFunction(() => !!document.querySelector('[data-act=bosses]'), null, { timeout: 120000 }); }
if (again === first) await p.waitForFunction(() => window.game.scene.isActive('Fishing') && window.game.scene.getScene('Fishing').clock < 3000, null, { timeout: 300000 });
else await openBoss(again);
// on to the hero's first turn
await p.waitForFunction(() => { const sc = window.game.scene.getScene('Fishing'); return sc.lures?.hero?.mode === 'float' || sc.clock > 60000; }, null, { timeout: 300000, polling: 200 });
const st = await state();
console.log('contest 2 (boss ' + again + '), hero\'s first cast out:', JSON.stringify(st));
await p.screenshot({ path: (process.env.SHOT || '/tmp/hunt/b6again_') + again + '.png' });
console.log('errors:', JSON.stringify(errs.slice(0, 3)));
await b.close();
