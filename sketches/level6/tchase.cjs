// Part 6 (the chase): plays it from the start (dev device: the level's open), shooting the opening —
// the dive, the rumble, the look back at the gang ("Let's get him!"), back to the hero — then a bot
// swims right (strokes now and then, rockets now and then) and shots of the chase and each Fat Fish.
// Logs the gang's lead, hits, faints and the fall phases. Args: <tag> [w h] [secs] [run share 0..1]
const { chromium } = require('playwright');
const TAG = process.argv[2] || 'a';
const W = Number(process.argv[3] || 844), H = Number(process.argv[4] || 390);
const SECS = Number(process.argv[5] || 120);
// the bot: right all the way (waiting short of a Fat Fish's danger column till it's come down), strokes to stay about mid-water (and when it bumps into something), a
// rocket now and then; runs `runK` of the time
const bot = `(g, pl, runK) => { let st = 5, f = 0; const rnd = () => ((st = (st * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); const water = g.level.data.water; let runT = 0, detour = 0, goUp = false; pl.input = { ...pl.input, id: 'bot', poll: () => { f++; if (pl.body.blocked.right && !detour) { detour = 50; goUp = pl.y > water + 32 * 7; } if (detour) detour--; const want = detour ? (goUp ? water + 40 : water + 32 * 13) : water + 32 * 6 + Math.sin(f / 90) * 70; const blocked = pl.body.blocked.down; const c = g.fishChase; const F = c && c.fall; const near = !!F && ((F.phase === 'warn' && F.t > 3.6) || F.phase === 'hang' || F.phase === 'drop' || F.phase === 'sink') && Math.abs(F.x - pl.x) < 170; const rush = near && pl.x >= F.x - 10; const wait = near && !rush; const lunging = !!c && (c.windup > 0 || c.lunge > 0); if (f % 30 === 0) runT = rnd() < runK ? 30 : 0; return { left: false, right: !wait, run: runT > 0 || rush || lunging, fire: rnd() < 0.03, jump: (pl.y > want || blocked) && f % 6 < 2 }; } }; }`;
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '5'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | '))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); else if (m.text().startsWith('  HIT')) console.log(m.text()); });
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="6"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `shots/level6/${TAG}-menu.png` });
  await p.click('[data-act=play]');
  await p.waitForFunction(() => !!window.game.scene.getScene('Game')?.players?.[0]?.body && window.game.scene.isActive('Game'), null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `shots/level6/${TAG}-fly.png` });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  const t0 = Date.now();
  const shot = async (n) => { await p.screenshot({ path: `shots/level6/${TAG}-${n}.png` }); console.log('shot', n, ((Date.now() - t0) / 1000).toFixed(1)); };
  // the opening: a frame every ~0.7 s till the chase starts
  let i = 0;
  while (Date.now() - t0 < 30000) {
    const s = await p.evaluate(() => { const g = window.game.scene.getScene('Game'); return { phase: g.fishChase?.phase, look: !!g.camLook, swim: g.players[0].swimming }; });
    if (s.phase === 'chase') break;
    await shot('open' + String(i++).padStart(2, '0'));
    await p.waitForTimeout(500);
  }
  await shot('chase-start');
  // the bot: swim right, a stroke now and then, a rocket now and then
  const RUNK = Number(process.argv[6] ?? 0.5);
  await p.evaluate((k) => (window.__runK = k), RUNK);
  await p.evaluate(([b, k]) => { window.__mkBot = eval(b); const g = window.game.scene.getScene('Game'); window.__mkBot(g, g.players[0], k); }, [bot, RUNK]);
  let lastPhase = '', faints = 0, lastAlive = true, hits = 0, lastAura = -1, fallShots = 0, n = 0;
  const tc = Date.now();
  while (Date.now() - tc < SECS * 1000) {
    const s = await p.evaluate(() => {
      const g = window.game.scene.getScene('Game');
      if (!g || !g.scene.isActive()) return { gone: true };
      const c = g.fishChase; const pl = g.players[0];
      const tr = c?.trail; const lead = c?.head && tr?.length ? Math.round(Math.hypot(tr[tr.length - 1].x - c.head.x, tr[tr.length - 1].y - c.head.y)) : null;
      // (the bot: re-attach after a restart)
      if (pl && pl.input.id !== 'bot') window.__mkBot(g, pl, window.__runK);
      // (each hit: what did it — the gang mid-lunge, the gang, the Fat Fish, or something else)
      if (!g.__hitLog) { g.__hitLog = true; const orig = g.hitPlayer.bind(g); g.hitPlayer = (q, fx) => { const cc = g.fishChase; const F = cc?.fall; const by = F && F.fish && Math.abs(fx - F.x) < 1 ? 'fatfish' : cc && cc.fish.some((f) => Math.abs(f.x - 40 - fx) < 1) ? (cc.lunge > 0 ? 'gang-lunge' : 'gang') : 'other'; console.log('  HIT by ' + by + ' at x ' + Math.round(q.x / 32) + ' aura ' + g.aura); return orig(q, fx); }; }
      return { x: Math.round(pl.x / 32), alive: pl.alive, aura: g.aura, phase: c?.phase, lead, fall: c?.fall?.phase ?? '', leader: c?.fish?.[0]?.kind, ended: pl.state === 'finished' };
    }).catch(() => ({ gone: true }));
    if (s.gone) { await p.waitForTimeout(500); continue; }
    if (s.fall && s.fall !== lastPhase) { console.log('  fall', s.fall, 'at x', s.x); if (fallShots < 9) { await shot('fall' + fallShots++); } }
    lastPhase = s.fall;
    if (lastAlive && !s.alive) { faints++; console.log('  FAINT at x', s.x); }
    lastAlive = s.alive;
    if (lastAura > 0 && s.aura === 0 && s.alive) { hits++; }
    lastAura = s.aura;
    if (n % 25 === 0) { console.log(`  t ${((Date.now() - tc) / 1000).toFixed(0)}s x ${s.x} aura ${s.aura} lead ${s.lead} leader ${s.leader} phase ${s.phase}`); }
    if (n % 60 === 30) await shot('chase' + String(n / 30 | 0).padStart(2, '0'));
    if (s.ended) { console.log('  GOAL at', ((Date.now() - tc) / 1000).toFixed(0), 's'); await p.waitForTimeout(2500); await shot('goal'); break; }
    n++;
    await p.waitForTimeout(100);
  }
  console.log('faints', faints, 'nuggie losses', hits);
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
