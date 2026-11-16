// Part 6's underwater football: starts at the checkpoint just before the field (dev device), a bot swims
// over it; a log line and a screenshot every so often, or (MOMENTS=1) shots of a wind-up, a throw coming
// at the hero, the scrimmage and a catch. Args: <tag> [secs] [light 0/1] [hero] [bot 0/1] [shotEvery ms]; PORT (default 8091).
const { chromium } = require('playwright');
const TAG = process.argv[2] || 'fb';
const SECS = Number(process.argv[3] || 20);
const LIGHTM = process.argv[4] === '1';
const HERO = process.argv[5] || 'puffy';
const BOT = process.argv[6] !== '0';
const EVERY = Number(process.argv[7] || 700);
const bot = `(g, pl, runK) => { let st = 5, f = 0; const rnd = () => ((st = (st * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); const water = g.level.data.water; let runT = 0, detour = 0, goUp = false; pl.input = { ...pl.input, id: 'bot', poll: () => { f++; if (pl.body.blocked.right && !detour) { detour = 50; goUp = pl.y > water + 32 * 7; } if (detour) detour--; const want = detour ? (goUp ? water + 40 : water + 32 * 13) : water + 32 * 6 + Math.sin(f / 90) * 70; const blocked = pl.body.blocked.down; const c = g.fishChase; const F = c && c.fall; const near = !!F && ((F.phase === 'warn' && F.t > 3.6) || F.phase === 'hang' || F.phase === 'drop' || F.phase === 'sink') && Math.abs(F.x - pl.x) < 170; const rush = near && pl.x >= F.x - 10; const wait = near && !rush; const lunging = !!c && (c.windup > 0 || c.lunge > 0); if (f % 30 === 0) runT = rnd() < runK ? 30 : 0; return { left: false, right: !wait, run: runT > 0 || rush || lunging, fire: rnd() < 0.03, jump: (pl.y > want || blocked) && f % 6 < 2 }; } }; }`;
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([l, h]) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', h); localStorage.setItem('puffy.light', l ? '1' : '0'); } }, [LIGHTM, HERO]);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | '))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  console.log('start'); await p.goto('http://localhost:' + (process.env.PORT || 8091) + '/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="6"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2500);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => !!window.game.scene.getScene('Game')?.players?.[0]?.body && window.game.scene.isActive('Game'), null, { timeout: 120000 });
  await p.waitForTimeout(1000);
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  console.log('in game');
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); g.scene.restart({ session: g.session, checkpoint: 3, retry: true, level: g.levelId }); });
  await p.waitForFunction(() => { const g = window.game.scene.getScene('Game'); return g?.scene.isActive() && g.players?.[0]?.body && g.fishChase?.phase === 'chase'; }, null, { timeout: 60000, polling: 300 });
  console.log('restarted'); if (BOT) await p.evaluate(([b]) => { window.__mkBot = eval(b); const g = window.game.scene.getScene('Game'); window.__mkBot(g, g.players[0], 0.4); }, [bot]);
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const orig = g.hitPlayer.bind(g); g.hitPlayer = (q, fx) => { const f = g.football?.[0]; const c = g.fishChase; const by = f && f.balls.some((b) => b.mode === 'throw' && Math.abs(b.x - q.x) < 60) ? 'football' : f && f.players.some((pp) => Math.abs(pp.x - fx) < 1) ? 'tackle' : c && c.fish.some((ff) => Math.abs(ff.x - 40 - fx) < 1) ? 'gang' : c?.fall?.fish && Math.abs(fx - c.fall.x) < 1 ? 'fatfish' : 'other'; console.log('HIT by ' + by + ' at ' + Math.round(q.x / 32) + ' aura ' + g.aura + (q.invulnerable ? ' (invulnerable)' : '')); return orig(q, fx); }; setInterval(() => { const gg = window.game.scene.getScene('Game'); const pl = gg?.players?.[0]; if (pl && pl.input.id !== 'bot' && window.__mkBot) window.__mkBot(gg, pl, 0.4); }, 200); });
  p.on('console', (m) => { if (m.text().startsWith('HIT')) console.log('  ' + m.text()); });
  await p.addStyleTag({ content: '.ctl-tip{display:none!important}' });
  const MOMENTS = process.env.MOMENTS === '1';
  const t0 = Date.now(); let i = 0;
  if (MOMENTS) {
    // a throw coming at the hero (the ball in the air, close), the wind-up, the scrimmage
    const want = [
      ['windup', 'f.throwers.some((t) => t.wind > 0 && t.wind < 0.3)'],
      ['throw', "f.balls.some((b) => b.mode === 'throw' && Math.abs(b.x - g.players[0].x) < 170 && Math.abs(b.x - g.players[0].x) > 50)"],
      ['scrimmage', "f.phase === 'play' && f.t > 0.4 && f.t < 1"],
      ['throw2', "f.balls.some((b) => b.mode === 'throw' && Math.abs(b.x - g.players[0].x) < 120)"],
      ['catch', "f.phase === 'live'"],
    ];
    for (const [name, cond] of want) {
      const ok = await p.waitForFunction(new Function('const g = window.game.scene.getScene("Game"); const f = g.football?.[0]; return !!f && (' + cond + ');'), null, { timeout: 40000, polling: 'raf' }).then(() => true, () => false);
      if (ok) { await p.screenshot({ path: `shots/level6/${TAG}-${name}.png` }); console.log('shot', name); } else console.log('missed', name);
    }
  }
  while (!MOMENTS && Date.now() - t0 < SECS * 1000) {
    const s = await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const f = g.football?.[0]; const pl = g.players[0]; if (pl && pl.input.id !== 'bot' && window.__mkBot) window.__mkBot(g, pl, 0.4); return { x: (pl.x / 32).toFixed(1), y: Math.round(pl.y), alive: pl.alive, aura: g.aura, ph: f?.phase, los: f && f.los.toFixed(0), balls: f?.balls.map((b) => b.mode[0]).join(''), shown: f?.shown, th: f?.throwers.map((t) => t.p.role + Math.round(t.p.x / 32) + ':' + t.wind.toFixed(1) + '/' + t.next.toFixed(1)).join(' '), gap: f?.gap.toFixed(1), fat: g.fatFishFalling, cam: Math.round(g.cameras.main.worldView.x / 32) + '-' + Math.round(g.cameras.main.worldView.right / 32), score: f?.score.join('-'), fps: Math.round(window.game.loop.actualFps) }; }).catch((e) => ({ err: e.message }));
    console.log(((Date.now() - t0) / 1000).toFixed(1), JSON.stringify(s));
    await p.screenshot({ path: `shots/level6/${TAG}-${String(i++).padStart(2, '0')}.png` });
    await p.waitForTimeout(EVERY);
  }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
