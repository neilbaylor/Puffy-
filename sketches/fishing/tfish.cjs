// King Bob's fishing contest, played by a bot: stops the cast meter in the green, hits BITE! when it shows.
// Screenshots each stage once (meter, cast in the air, bite button, fish on, the leap, the catch card, King Bob's turn, the end).
// Args: <tag> <odds (chance a hit bite is a catch; default the game's)> <width> <height> [off: tap off the BITE! button instead of on it]
const { chromium } = require('playwright');
const TAG = process.argv[2] || 'a';
const ODDS = process.argv[3] ? Number(process.argv[3]) : null;
const W = Number(process.argv[4] || 844), H = Number(process.argv[5] || 390);
const OFF = process.argv[6] === 'off';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '4'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  p.on('crash', () => console.log('PAGE CRASHED')); p.on('close', () => console.log('PAGE CLOSED'));
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(500);
  await p.click('[data-boss="5"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  if (ODDS !== null) await p.evaluate((o) => (window.__fishOdds = o), ODDS);
  const shots = new Set();
  const shot = async (name) => { if (shots.has(name)) return; shots.add(name); await p.screenshot({ path: `shots/fishing/${TAG}-${name}.png` }); console.log('shot', name, ((Date.now() - t0) / 1000).toFixed(1)); };
  const t0 = Date.now();
  await p.waitForTimeout(1200);
  await shot('intro');
  let last = '';
  let nco = 0;
  let prevH = '', prevK = '';
  while (Date.now() - t0 < 600000) {
    const s = await p.evaluate(() => {
      const f = window.__fishing;
      if (!f || !f.scene.isActive() || document.querySelector('.screen .results')) return { done: true };
      const d = f.dom;
      const m = f.meter;
      return {
        meter: !!m, phase: m ? m.el.dataset.m : '', inZone: m ? m.pos > m.zone[0] + 0.01 && m.pos < m.zone[1] - 0.01 : false,
        bite: !d.querySelector('.fsh-bite').hidden,
        hero: f.lures.hero.mode, king: f.lures.king.mode, lx: Math.round(f.lures.hero.x - f.hero.x), kx: Math.round(f.lures.king.x - f.hero.x),
        card: d.querySelector('.fsh-catch').classList.contains('show'),
        callout: d.querySelector('.fsh-callout').classList.contains('show') ? d.querySelector('.fsh-callout').textContent : '',
        score: f.score, intro: f.inIntro,
      };
    });
    if (s.done) { await p.waitForTimeout(1500); await shot('end'); break; }
    if (prevH === 'fly' && s.hero === 'float') console.log('  hero cast landed', s.lx, 'px past the hero');
    if (prevK === 'fly' && s.king === 'float') console.log('  king cast landed', s.kx, 'px past the hero');
    prevH = s.hero; prevK = s.king;
    if (s.callout && s.callout !== last) { last = s.callout; console.log('  callout:', s.callout, JSON.stringify(s.score)); await p.waitForTimeout(700); await shot('co' + String(++nco).padStart(2, '0')); }
    if (s.callout.startsWith('ROUND 1')) await shot('round');
    if (s.meter) { await shot(s.phase === 'aim' ? 'meter2' : 'meter'); if (s.inZone) { await p.mouse.click(W * 0.3, H * 0.5); await p.waitForTimeout(150); } continue; }
    if (s.hero === 'fly') await shot('cast');
    if (s.bite) { await shot('bite'); if (OFF) await p.mouse.click(W * 0.06, H * 0.92); else await p.locator('.fsh-bite').click({ force: true, timeout: 500 }).catch(() => {}); continue; }
    if (s.hero === 'hooked') await shot('fishon');
    if (s.card) await shot('catch');
    if (s.king === 'fly') await shot('kingcast');
    if (s.king === 'hooked') await shot('kinghooked');
    if (s.callout.includes('YOU WIN') || s.callout.includes('KING BOB WINS')) await shot('result');
    await p.waitForTimeout(40);
  }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
