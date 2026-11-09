// Plop Park (level 4): the Plops playing baseball, then spotting you and hitting line drives at you
const { chromium } = require('playwright');
const tag = process.argv[2] || 'a';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '3'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  p.on('console', (m) => { if (m.type() === 'error' || /Frame missing|frame/i.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="4"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(1500);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => { const g = window.game.scene.getScene('Game'); return !g.intro && !g.cutscene; }, null, { timeout: 60000 });
  // stand just outside the outfield and watch them play
  await p.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    g.chuteDrops.forEach((q) => (q.n = 0));
    const bg = g.ballgames[0];
    window.__bg = bg;
    pl.body.reset(bg.x0 - 3 * 32, bg.ground - 30);
    window.__btn = { left: false, right: false, jump: false, fire: false, run: false };
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...window.__btn }) };
    window.__hits = 0;
    const hp = g.hitPlayer.bind(g);
    g.hitPlayer = (q, fx) => { window.__hits++; if (!window.__god) return hp(q, fx); };
    window.__drives = 0;
    const ld = bg.lineDrive.bind(bg);
    bg.lineDrive = (a, b) => { window.__drives++; return ld(a, b); };
    g.aura = 99;
  });
  const S = () => p.evaluate(() => { const bg = window.__bg; const g = window.game.scene.getScene('Game'); return { hot: bg.hot, over: bg.over, ready: bg.ready, flight: !!bg.flight, drives: bg.drives.length, players: bg.players.map((e) => `${e.bb.role}:${e.bb.mode}${e.dead ? '†' : ''}@${Math.round(e.x / 32)}:${e.frame.name}`).join(' '), hero: Math.round(g.players[0].x / 32), hits: window.__hits, aura: g.aura }; });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(900); console.log('idle', JSON.stringify(await S())); if (i === 2) await p.screenshot({ path: `shots/bb-${tag}-idle.png` }); }
  // walk in, slowly (a step, a pause), untouchable (hits are only counted)
  await p.evaluate(() => (window.__god = true));
  for (let i = 0; i < 16; i++) {
    await p.evaluate(() => (window.__btn.right = true));
    await p.waitForTimeout(450);
    await p.evaluate(() => (window.__btn.right = false));
    await p.waitForTimeout(700);
    const st = await S();
    console.log('hot', JSON.stringify({ ...st, drivesHit: await p.evaluate(() => window.__drives) }));
    if (i === 6 || i === 10) await p.screenshot({ path: `shots/bb-${tag}-hot${i}.png` });
    if (st.over) break;
  }
  console.log(errs.slice(0, 8).join('\n') || 'no errors');
  await br.close();
})();
