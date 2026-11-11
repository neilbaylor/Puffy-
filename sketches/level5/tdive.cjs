// The swan dive: frames of the opening dive (skip the fly-over, then grab the screen every ~90 ms).
const { chromium } = require('playwright');
const HERO = process.argv[2] || 'puffy';
(async () => {
  require('fs').mkdirSync('shots/l5/dive', { recursive: true });
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((h) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', h); } }, HERO);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2000);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 60000 });
  await p.evaluate(() => { document.querySelector('.ctl-tip')?.remove(); });
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swan, null, { timeout: 8000 });
  // grab the canvas every 2nd frame from inside the page (screenshots are too slow to keep up)
  const shots = await p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const out = [];
    let n = 0;
    const grab = () => {
      n++;
      if (n % 2 === 0) {
        // (a box round the hero, in the canvas's own pixels)
        const cam = g.cameras.main;
        const pl = g.players[0];
        const k = window.game.canvas.width / window.game.scale.width;
        const sx = (pl.x - cam.worldView.x) * cam.zoom * k;
        const sy = (pl.y - cam.worldView.y) * cam.zoom * k;
        const W = 520 * k, H = 360 * k;
        const x = Math.max(0, Math.min(window.game.canvas.width - W, sx - W * 0.45));
        const y = Math.max(0, Math.min(window.game.canvas.height - H, sy - H * 0.5));
        window.game.renderer.snapshotArea(Math.round(x), Math.round(y), Math.round(W), Math.round(H), (img) => out.push(img.src));
      }
      if (n > 130) { g.events.off('postupdate', grab); setTimeout(() => done(out), 300); }
    };
    g.events.on('postupdate', grab);
  }));
  shots.forEach((d, i) => require('fs').writeFileSync(`shots/l5/dive/${String(i).padStart(2, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')));
  console.log('frames', shots.length);
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
