// usage: node fishtrail.mjs <port> -> King Bob's contest from the Bosses menu: pause during the hero's cast, Home screen, start it again: is the old cast's rod-tip streak still there?
import { chromium } from 'playwright';
const [port] = process.argv.slice(2);
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
// pause the moment the hero's cast leaves a streak (the same as the Pause button, or the app going to the background)
await p.evaluate(() => {
  const sc = window.game.scene.getScene('Fishing');
  const f = () => {
    if (sc.tipTrail.length >= 3 && document.querySelector('.hud-pause') && !document.querySelector('.hud').hidden) {
      sc.events.off('postupdate', f);
      document.querySelector('.hud-pause').click();
      window.__paused = { len: sc.tipTrail.length, clock: Math.round(sc.clock), lastT: Math.round(sc.tipTrail.at(-1).t) };
    }
  };
  sc.events.on('postupdate', f);
});
// skip the intro along the way
for (let i = 0; i < 400; i++) {
  if (await p.evaluate(() => !!window.__paused)) break;
  await p.evaluate(() => document.querySelector('.fsh-skip, .wr-skip, [data-act=skip]')?.click());
  await p.waitForTimeout(250);
}
const paused = await p.evaluate(() => window.__paused);
console.log('paused during the cast:', JSON.stringify(paused), 'menu:', await p.evaluate(() => document.querySelector('#ui .screen h2')?.textContent));
await p.evaluate(() => document.querySelector('[data-act=hero]').click());
await p.waitForFunction(() => !window.game.scene.isActive('Fishing') && !!document.querySelector('[data-act=bosses]'), null, { timeout: 60000 });
await openBoss();
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(2500);
  const st = await p.evaluate(() => {
    const sc = window.game.scene.getScene('Fishing');
    const ks = sc.tipTrail.map((q) => 1 - (sc.clock - q.t) / 240);
    return { clock: Math.round(sc.clock), trail: sc.tipTrail.length, firstT: sc.tipTrail[0] && Math.round(sc.tipTrail[0].t), maxLineWidth: ks.length ? Math.round(9 * Math.max(...ks)) : 0 };
  });
  if (!st.trail) { console.log('trail gone at', JSON.stringify(st)); break; }
  // freeze it, picture with the streak, then the same frame with the streak taken away
  await p.evaluate(() => window.game.scene.pause('Fishing'));
  await p.waitForTimeout(150);
  await p.screenshot({ path: (process.env.SHOT || '/tmp/hunt/ft_') + i + 'a.png' });
  await p.evaluate(() => { const sc = window.game.scene.getScene('Fishing'); window.__keep = sc.tipTrail; sc.tipTrail = []; sc.drawRods(); });
  await p.waitForTimeout(150);
  await p.screenshot({ path: (process.env.SHOT || '/tmp/hunt/ft_') + i + 'b.png' });
  await p.evaluate(() => { const sc = window.game.scene.getScene('Fishing'); sc.tipTrail = window.__keep; window.game.scene.resume('Fishing'); });
  console.log('new contest:', i, JSON.stringify(st));
}
console.log('errors:', JSON.stringify(errs.slice(0, 3)));
await b.close();
