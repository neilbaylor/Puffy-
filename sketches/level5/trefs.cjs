// The two referees in the game: the crab umpire on the tennis court (Part 5) and the volleyball referee (Part 3).
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const shoot = async (lvl, place, name) => {
    const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); });
    const p = await ctx.newPage();
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.evaluate((l) => { const b = document.querySelector(`.lvl[data-lvl="${l}"]`); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); }, lvl);
    await p.waitForTimeout(1500);
    await p.click('[data-act=play]');
    await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
    await p.evaluate(() => window.game.events.emit('skip-intro'));
    await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 60000 });
    await p.waitForTimeout(3500);
    await p.evaluate(() => document.querySelector('.ctl-tip')?.remove());
    // put the hero just short of the court (out of sight of the players), camera there
    const pos = await p.evaluate((place) => {
      const g = window.game.scene.getScene('Game');
      const m = (g.tennis?.length ? g.tennis : g.volleys)[0];
      const pl = g.players[0];
      pl.invulnUntil = 1e12;
      pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: false, run: false, fire: false, jump: pl.swimming && pl.body.velocity.y > 40 && Math.random() < 0.3 }) };
      const x = (m.netX ?? m.left) - place;
      pl.body.reset(x, (m.ground ?? 0) - 120);
      return { x };
    }, place);
    await p.waitForTimeout(2500);
    // the referee on screen, close up
    const box = await p.evaluate(() => {
      const g = window.game.scene.getScene('Game');
      const m = (g.tennis?.length ? g.tennis : g.volleys)[0];
      const r = m.ump ?? m.ref;
      const cam = g.cameras.main;
      const k = 844 / window.game.scale.width;
      return { x: (r.x - cam.worldView.x) * cam.zoom * k, y: (r.y - cam.worldView.y) * cam.zoom * k };
    });
    await p.screenshot({ path: `shots/l5/${name}-scene.png` });
    await p.screenshot({ path: `shots/l5/${name}-close.png`, clip: { x: Math.max(0, box.x - 90), y: Math.max(0, box.y - 110), width: 180, height: 150 } });
    await ctx.close();
  };
  await shoot(5, 330, 'umpire');
  await shoot(3, 360, 'vref');
  await br.close();
})();
