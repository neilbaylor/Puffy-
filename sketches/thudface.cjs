// The in-game HUD hero's face: play Part 1 for 60 s and count how often its portrait is drawn from scratch
// (a cache miss) vs. reused, and how long each fresh draw takes. Optional 4x CPU slowdown: arg "slow".
const { chromium } = require('playwright');
const SLOW = process.argv[2] === 'slow';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '5'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="1"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(1500);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForTimeout(2000);
  await p.waitForTimeout(Number(process.env.WARM || 0));
  if (SLOW) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  // count big canvas draws: a fresh portrait is a drawImage from a large (4x) canvas into a small one
  const res = await p.evaluate(() => new Promise((done) => {
    let fresh = 0, reuse = 0; const ms = [];
    const orig = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
      const big = img && img.width > 300 && this.canvas.width < 300;
      const t0 = performance.now();
      const r = orig.call(this, img, ...a);
      if (big) { fresh++; ms.push(performance.now() - t0); }
      else if (img && img.width === this.canvas.width && this.canvas.width < 300 && this.canvas.closest?.('.hud, #ui')) reuse++;
      return r;
    };
    setTimeout(() => { CanvasRenderingContext2D.prototype.drawImage = orig; ms.sort((x, y) => x - y); done({ fresh, reuse, medianShrinkMs: ms.length ? +ms[ms.length >> 1].toFixed(1) : 0 }); }, 60000);
  }));
  console.log(SLOW ? '4x CPU' : 'full speed', JSON.stringify(res), errs.join(' | ') || 'no errors');
  await br.close();
})();
