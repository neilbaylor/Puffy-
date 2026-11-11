// The level's opening fly-over: frames along its path (it dips into the trenches), grabbed in the page.
const { chromium } = require('playwright');
(async () => {
  require('fs').mkdirSync('shots/l5/fly', { recursive: true });
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: 'shots/l5/fly/menu.png' });
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').intro, null, { timeout: 120000 });
  const n = await p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const out = [];
    let last = -1;
    const grab = () => {
      if (!g.intro) { g.events.off('postupdate', grab); return done(out); }
      const u = g.intro.u;
      const step = Math.floor(u * 12);
      if (step !== last) { last = step; window.game.renderer.snapshot((img) => out.push(img.src)); }
    };
    g.events.on('postupdate', grab);
  }));
  n.forEach((d, i) => require('fs').writeFileSync(`shots/l5/fly/${String(i).padStart(2, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')));
  console.log('frames', n.length, errs.join('\n') || 'no errors');
  await br.close();
})();
