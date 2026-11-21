// usage: node fishdangle.mjs <port> <who: king|hero> -> King Bob's contest: pause while a fish hangs on <who>'s line, Home screen, start again: is the old line still drawn?
import { chromium } from 'playwright';
const [port, who = 'king'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1'); });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:' + port + '/');
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
const openBoss = async () => {
  await p.evaluate(() => document.querySelector('[data-act=bosses]').click());
  await p.waitForFunction(() => !!document.querySelector('[data-boss]'));
  await p.evaluate(() => document.querySelector('[data-boss="5"]').click());
  await p.waitForFunction(() => window.game.scene.isActive('Fishing'), null, { timeout: 300000 });
};
await openBoss();
await p.evaluate((h) => { window.__hold = h; }, Number(process.env.HOLD ?? 400));
await p.evaluate((who) => {
  const sc = window.game.scene.getScene('Fishing');
  const f = () => {
    // (a perfect tap on every BITE!)
    const bt = document.querySelector('.fsh-bite');
    if (bt && !bt.hidden && !sc.biteHit) sc.biteHit = true;
    if (sc.dangle[who] && sc.clock > (window.__seen ??= sc.clock) + Number(window.__hold ?? 400) && !document.querySelector('.hud').hidden) {
      sc.events.off('postupdate', f);
      document.querySelector('.hud-pause').click();
      window.__paused = { clock: Math.round(sc.clock), dangle: sc.dangle[who] };
    }
    if (!sc.dangle[who]) window.__seen = undefined;
  };
  sc.events.on('postupdate', f);
}, who);
for (let i = 0; i < 600; i++) {
  if (await p.evaluate(() => !!window.__paused)) break;
  if (i % 40 === 0) console.log('waiting', i, JSON.stringify(await p.evaluate(() => { const sc = window.game.scene.getScene('Fishing'); return { active: window.game.scene.isActive('Fishing'), clock: Math.round(sc.clock), score: sc.score, screen: document.querySelector('#ui .screen h2')?.textContent ?? null }; })));
  await p.waitForTimeout(250);
}
console.log('paused with a fish on the line:', JSON.stringify(await p.evaluate(() => window.__paused)), 'menu:', await p.evaluate(() => document.querySelector('#ui .screen h2')?.textContent));
await p.evaluate(() => document.querySelector('[data-act=hero]').click());
await p.waitForFunction(() => !window.game.scene.isActive('Fishing') && !!document.querySelector('[data-act=bosses]'), null, { timeout: 60000 });
await openBoss();
for (let i = 0; i < 14; i++) {
  await p.waitForTimeout(2500);
  const st = await p.evaluate((who) => { const sc = window.game.scene.getScene('Fishing'); return { clock: Math.round(sc.clock), dangle: sc.dangle[who], lure: sc.lures[who].mode }; }, who);
  console.log('new contest:', i, JSON.stringify(st));
  if (!st.dangle) break;
  await p.evaluate(() => window.game.scene.pause('Fishing'));
  await p.waitForTimeout(150);
  await p.screenshot({ path: (process.env.SHOT || '/tmp/hunt/fd_') + who + i + 'a.png' });
  await p.evaluate((who) => { const sc = window.game.scene.getScene('Fishing'); window.__keep = sc.dangle[who]; sc.dangle[who] = null; sc.drawRods(); }, who);
  await p.waitForTimeout(150);
  await p.screenshot({ path: (process.env.SHOT || '/tmp/hunt/fd_') + who + i + 'b.png' });
  await p.evaluate((who) => { const sc = window.game.scene.getScene('Fishing'); sc.dangle[who] = window.__keep; window.game.scene.resume('Fishing'); }, who);
}
console.log('errors:', JSON.stringify(errs.slice(0, 3)));
await b.close();
