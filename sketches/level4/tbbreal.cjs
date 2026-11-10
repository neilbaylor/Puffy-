// Plop Park for real: a bot walks right, firing, jumping line drives; how far does it get, how many hits
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript((HERO) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '3'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', HERO); } }, process.argv[2] || 'puffy');
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="4"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(1500);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => { const g = window.game.scene.getScene('Game'); return !g.intro && !g.cutscene; }, null, { timeout: 60000 });
  const res = await p.evaluate(() => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    g.chuteDrops.forEach((q) => (q.n = 0));
    const bg = g.ballgames[0];
    pl.body.reset(53 * 32, bg.ground - 30);
    g.aura = 5;
    const btn = { left: false, right: true, jump: false, fire: false, run: false };
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...btn }) };
    let f = 0, hits = 0, drives = 0, jumpsOver = 0;
    const hp = g.hitPlayer.bind(g);
    g.hitPlayer = (q, fx) => { if (q.alive && !q.invulnerable) hits++; return hp(q, fx); };
    const ld = bg.lineDrive.bind(bg);
    bg.lineDrive = (a, b) => { drives++; return ld(a, b); };
    const step = () => {
      f++;
      // jump a line drive coming in; shoot ahead now and then; walk right
      const near = bg.drives.some((d) => d.live && d.img.x > pl.x && d.img.x - pl.x < 120);
      btn.jump = near && pl.body.blocked.down ? true : near ? btn.jump : false;
      if (near && pl.body.blocked.down) jumpsOver++;
      btn.fire = f % 30 < 2;
      const fainted = !pl.alive;
      if (f > 60 * 60 || pl.x > bg.batter.x + 60 || fainted) {
        g.events.off('preupdate', step);
        done({ frames: f, x: Math.round(pl.x / 32), past: pl.x > bg.batter.x, hits, drives, jumpsOver, aura: g.aura, alive: pl.alive, beaten: bg.players.filter((e) => e.dead).length, over: bg.over });
      }
    };
    g.events.on('preupdate', step);
  }));
  console.log(JSON.stringify(res));
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
