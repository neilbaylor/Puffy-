// Kai v2: he dodges rockets and charges. Hero fires at him every so often; count rockets, dodges, charges, hits on Kai and on you; shots mid-dodge and mid-charge.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="5"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2000);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => window.game.scene.getScene('Game').players[0].swimming, null, { timeout: 20000 });
  await p.evaluate(() => document.querySelector('.ctl-tip')?.remove());
  await p.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    const T = 32, H = g.level.heightPx;
    pl.body.reset(72 * T, H - 46 * T);
    window.__k = { rockets: 0, dodges: 0, charges: 0, kaiHits: 0, youHit: 0, shotsIn: 0, gone: false };
    const kai = g.enemies.find((e) => e.kind === 'kai' && e.x < 100 * T);
    window.__kai = kai;
    const hit0 = g.hitPlayer.bind(g);
    g.hitPlayer = (q, fx) => { if (!q.invulnerable) window.__k.youHit++; q.invulnUntil = g.time.now + 1500; };
    let fireT = 0, f = 0, lastHp = kai.hp, wasDodge = false, wasCharge = false;
    const btn = { left: false, right: false, jump: false, fire: false, run: false };
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...btn }) };
    g.events.on('preupdate', () => {
      f++;
      if (!kai.scene || kai.dead) { window.__k.gone = true; return; }
      // stay level with Kai, a little way off, facing him; fire about once a second
      btn.jump = pl.y > kai.y + 10 && Math.random() < 0.35;
      btn.left = kai.x < pl.x - 30 && Math.abs(kai.x - pl.x) > 200;
      btn.right = kai.x > pl.x + 30 && Math.abs(kai.x - pl.x) > 200;
      pl.facing = kai.x > pl.x ? 1 : -1;
      fireT--;
      btn.fire = false;
      if (fireT <= 0 && Math.abs(kai.y - pl.y) < 40) { btn.fire = true; fireT = 55; window.__k.rockets++; }
      if (kai.dodgeT > 0 && !wasDodge) window.__k.dodges++;
      wasDodge = kai.dodgeT > 0;
      if (kai.chargeT >= 0 && !wasCharge) window.__k.charges++;
      wasCharge = kai.chargeT >= 0;
      if (kai.hp < lastHp) { window.__k.kaiHits++; lastHp = kai.hp; }
    });
  });
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(4000);
    if (i === 1) await p.screenshot({ path: 'shots/l5/kai2-a.png' });
    console.log(JSON.stringify(await p.evaluate(() => ({ ...window.__k, hp: window.__kai.hp }))));
  }
  await p.screenshot({ path: 'shots/l5/kai2-b.png' });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
