// a bot plays level 4's climbs like a player (no teleporting): run to the edge, jump, second jump, land
const { chromium } = require('playwright');
const HERO = process.argv[2] || 'puffy';
const CLIMB = +(process.argv[3] || 0);
const MAXMIN = +(process.argv[4] || 2);
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((h) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '3'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', h); } }, HERO);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="4"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(1500);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForSelector('.lvl-intro', { state: 'detached', timeout: 60000 }).catch(() => {});
  // (and the King's little scene at the start)
  await p.waitForFunction(() => { const g = window.game.scene.getScene('Game'); return !g.intro && !g.cutscene; }, null, { timeout: 60000 });
  await p.waitForTimeout(500);
  await p.evaluate((m) => (window.__maxMin = m), MAXMIN);
  const res = await p.evaluate((CLIMB) => new Promise((done) => {
    const g = window.game.scene.getScene('Game');
    const pl = g.players[0];
    const T = 32;
    const H = g.level.data.height;
    const ledges = window.__ledges[CLIMB];
    // (climb 1 starts from the ground at the bottom; the others from where the climb starts — put the hero there once)
    const start = CLIMB === 0 ? null : ledges[0];
    if (start) { pl.body.reset(((start.x0 + start.x1 + 1) / 2) * T, (H - start.h) * T - 30); }
    const btn = { left: false, right: false, jump: false, fire: false, run: false };
    pl.input = { ...pl.input, id: 'bot', poll: () => ({ ...btn }) };
    pl.invulnUntil = 1e12;
    let i = CLIMB === 0 ? -1 : 0; // -1: on the ground, heading for ledge 0
    let skips = 0, phase = 'walk', t = 0, tries = 0, fails = [], airT = 0, used2 = false, frames = 0, camLog = [], camStart = 0;
    const W = 11;
    const yOf = (l) => (H - l.h) * T;
    const step = () => {
      frames++;
      if (frames > 60 * 60 * (window.__maxMin || 2)) return finish('timeout');
      if (frames % 300 === 0) (window.__stk ||= []).push({ i, phase, airT, used2, tries, intro: !!g.intro, cut: g.cutscene, paused: g.physics.world.isPaused, alive: pl.alive, chute: !!pl.chute, grav: pl.body.allowGravity, goo: pl.goo, vy: Math.round(pl.body.velocity.y), grounded: pl.body.blocked.down, x: Math.round(pl.x), bottom: Math.round(pl.bottom), vx: Math.round(pl.body.velocity.x), blocked: JSON.stringify(pl.body.blocked), btn: JSON.stringify(btn) });
      const b = ledges[i + 1];
      if (!b) return finish('done');
      const a = i >= 0 ? ledges[i] : { x0: 0, x1: 16, h: 4 };
      const cloud = g.level.data.cells[H - b.h]?.[b.x0] === 'cloud';
      // the next one's right above: a jump-through cloud (straight up through it); or solid ground right
      // over us (the first ledge, from the ground): jump at it from beside it
      const overlap = cloud && b.x0 <= a.x1 && b.x1 >= a.x0;
      const besideSolid = !cloud && b.x0 <= a.x1 && b.x1 >= a.x0;
      const bc = ((b.x0 + b.x1 + 1) / 2) * T;
      const dir = bc > pl.x ? 1 : -1;
      const grounded = pl.body.blocked.down;
      btn.left = btn.right = false;
      if (phase === 'walk') {
        // to the edge of this ledge facing the next one (or under the middle of a cloud above)
        const M = W + 10; // (well back from the very edge: quick heroes slide a bit when they stop)
        const tx = overlap ? Math.max(a.x0 * T + M, Math.min((a.x1 + 1) * T - M, bc)) : besideSolid ? (b.x0 * T - M > a.x0 * T ? b.x0 * T - M : (b.x1 + 1) * T + M) : dir > 0 ? (a.x1 + 1) * T - M : a.x0 * T + M;
        const dx = tx - pl.x;
        // walked off this ledge: back onto it (counts as a try)
        if (i >= 0 && grounded && pl.bottom > yOf(a) + 4) { tries++; pl.body.reset(((a.x0 + a.x1 + 1) / 2) * T, yOf(a) - 30); return; }
        if (Math.abs(dx) > 12) { btn[dx > 0 ? 'right' : 'left'] = true; btn.jump = false; }
        else if (grounded && Math.abs(pl.body.velocity.x) < 30) { phase = 'jump'; airT = 0; used2 = false; camStart = g.camTop; }
      } else if (phase === 'jump') {
        airT++;
        if (airT === 1) (window.__tr = { from: Math.round(pl.x), peak: 1e9, up: 0, tl: [] });
        window.__tr.peak = Math.min(window.__tr.peak, Math.round(pl.bottom));
        if (pl.body.blocked.up) window.__tr.up++;
        if (airT % 4 === 0 && window.__tr.tl.length < 40) window.__tr.tl.push([Math.round(pl.x), Math.round(pl.bottom), Math.round(pl.body.velocity.x), Math.round(pl.body.velocity.y), btn.jump ? 1 : 0]);
        if (airT > 600) { tries++; airT = 0; pl.body.reset(((a.x0 + a.x1 + 1) / 2) * T, yOf(a) - 30); phase = 'walk'; return; } // (stuck in the air somehow: back on the ledge)
        btn.jump = !(airT > 2 && pl.body.velocity.y > -90 && !used2 && airT < 4) && !(used2 === 'release');
        // second jump near the top of the first: let go a frame, then press again
        if (!used2 && airT > 3 && pl.body.velocity.y > -90) { used2 = 'release'; btn.jump = false; }
        else if (used2 === 'release') { used2 = true; btn.jump = true; }
        // steer over to the next ledge (not under it: only once we're up level with it), stop once over it
        // (like a player: head for the middle of it, and steer back against the drift so as not to sail past)
        const above = pl.bottom < yOf(b) + 4;
        if (!overlap && (above || pl.body.velocity.y < -200)) {
          const want = Math.max(-400, Math.min(400, (bc - pl.x) * 5));
          const vx = pl.body.velocity.x;
          if (vx < want - 25) btn.right = true;
          else if (vx > want + 25) btn.left = true;
        }
        if (tries >= 2) btn.run = true;
        if (airT > 6 && grounded) {
          const landedOn = Math.abs(pl.bottom - yOf(b)) < 4 && pl.x > b.x0 * T - 4 && pl.x < (b.x1 + 1) * T + 4;
          btn.jump = false; btn.run = false;
          camLog.push(Math.abs(g.camTop - camStart));
          // (or one further up: a high second jump can skip one — fine, that's progress)
          const on = (l) => Math.abs(pl.bottom - yOf(l)) < 4 && pl.x > l.x0 * T - 4 && pl.x < (l.x1 + 1) * T + 4;
          let k = -1;
          for (let j = ledges.length - 1; j > i + 1; j--) if (on(ledges[j])) { k = j; break; }
          if (k > 0) { skips++; i = k; tries = 0; phase = 'walk'; }
          else if (landedOn) { i++; tries = 0; phase = 'walk'; }
          else {
            if (!window.__miss) window.__miss = [];
            if (window.__miss.length < 3) window.__miss.push({ i: i + 1, a, b, land: [Math.round(pl.x), Math.round(pl.bottom)], tr: window.__tr, bTop: yOf(b) });
            tries++;
            if (tries > 4) { fails.push(i + 1); i++; tries = 0; pl.body.reset(bc, yOf(b) - 30); }
            else if (Math.abs(pl.bottom - yOf(a)) > 4) { pl.body.reset(((a.x0 + a.x1 + 1) / 2) * T, yOf(a) - 30); } // (fell off: back on the ledge)
            phase = 'walk';
          }
        }
      }
    };
    const finish = (why) => { g.events.off('preupdate', step); done({ why, skips, miss: window.__miss, stuck: why === 'timeout' ? (window.__stk || []).slice(-6) : undefined, a: ledges[i], b: ledges[i + 1], reached: i + 1, of: ledges.length, fails, frames, camMaxDuringHops: Math.round(Math.max(...camLog.slice(0, 40))), jumps: camLog.length }); };
    g.events.on('preupdate', step);
  }), CLIMB);
  console.log(HERO, 'climb', CLIMB + 1, JSON.stringify(res));
  await p.screenshot({ path: `/tmp/l4bot-${HERO}-${CLIMB + 1}.png` });
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
