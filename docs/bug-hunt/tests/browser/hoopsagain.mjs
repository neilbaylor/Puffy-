// usage: node hoopsagain.mjs <port> [boss=1] -> Bosses menu: King Puff Ball's basketball, perfect shots to the end, then "Play again": which frames does the King show in the new intro?
import { chromium } from 'playwright';
const [port, boss = '1'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1'); });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:' + port + '/');
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
await p.evaluate(() => document.querySelector('[data-act=bosses]').click());
await p.waitForFunction(() => !!document.querySelector('[data-boss]'));
await p.evaluate((l) => document.querySelector('[data-boss="' + l + '"]').click(), boss);
await p.waitForFunction(() => window.game.scene.isActive('Hoops'), null, { timeout: 300000 });
const watchIntro = async (label) => {
  // the King's frames through the first 7 s of the intro (the spotlights find him, he hops and speaks)
  await p.evaluate(() => {
    const sc = window.game.scene.getScene('Hoops');
    window.__frames = [];
    const f = () => {
      if (sc.clock > 7000) return sc.events.off('postupdate', f);
      const fr = sc.king.frame.name;
      if (window.__frames.at(-1)?.[1] !== fr) window.__frames.push([Math.round(sc.clock), fr]);
    };
    sc.events.on('postupdate', f);
  });
  await p.waitForFunction(() => window.game.scene.getScene('Hoops').clock > 4300, null, { timeout: 120000, polling: 50 });
  await p.screenshot({ path: (process.env.SHOT || '/tmp/hunt/hoops_') + label + '.png' });
  await p.waitForFunction(() => window.game.scene.getScene('Hoops').clock > 7000, null, { timeout: 120000 });
  const fr = await p.evaluate(() => window.__frames);
  const names = [...new Set(fr.map((x) => x[1]))];
  console.log(label, 'intro: King frames seen in the first 7 s:', JSON.stringify(names), ' first few:', JSON.stringify(fr.slice(0, 8)));
};
await watchIntro('first');
// every shot dead centre of the green, and the intro skipped
await p.evaluate(() => {
  const sc = window.game.scene.getScene('Hoops');
  const f = () => {
    const m = sc.meter;
    if (m) { const c = (m.zone[0] + m.zone[1]) / 2, w = (m.zone[1] - m.zone[0]) * 0.3; if (Math.abs(m.pos - c) < w) sc.tapped = true; }
  };
  window.__perfect = f;
  sc.events.on('postupdate', f);
});
const t0 = Date.now();
let title = null;
while (Date.now() - t0 < 270000) {
  title = await p.evaluate(() => document.querySelector('#ui .screen [data-act=again]') ? document.querySelector('#ui .screen h2')?.textContent : null);
  if (title) break;
  await p.evaluate(() => { const s = document.querySelector('.hoops-skip'); if (s && !s.hidden) s.click(); });
  await p.waitForTimeout(500);
}
console.log('result:', title, 'score:', JSON.stringify(await p.evaluate(() => window.game.scene.getScene('Hoops').score)), 'kingAnim at the end:', JSON.stringify(await p.evaluate(() => window.game.scene.getScene('Hoops').kingAnim)));
await p.evaluate(() => window.game.scene.getScene('Hoops').events.off('postupdate', window.__perfect));
await p.evaluate(() => document.querySelector('[data-act=again]').click());
await p.waitForFunction(() => window.game.scene.isActive('Hoops') && window.game.scene.getScene('Hoops').clock < 2000, null, { timeout: 300000 });
await watchIntro('again');
console.log('errors:', JSON.stringify(errs.slice(0, 3)));
await b.close();
