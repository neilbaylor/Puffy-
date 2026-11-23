// Part 6 → Boss 6: the level's goal starts King Bob's rematch (level 6); then a win (results: Part 6 clear,
// no Next) or a loss (a life lost, back to Part 6's checkpoint). args: port light win|lose
const { chromium } = require('playwright');
const [port, light, mode] = [process.argv[2] || '8411', process.argv[3] || '0', process.argv[4] || 'win'];
const DIR = `shots/boss6/part6-${mode}-L${light}`;
require('fs').mkdirSync(DIR, { recursive: true });
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((lt) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '5'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); localStorage.setItem('puffy.light', lt); } }, light);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  p.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver/.test(t)) errs.push(m.type() + ': ' + t.slice(0, 200)); });
  await p.goto(`http://localhost:${port}/`);
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(1000);
  await p.evaluate(() => { const b = document.querySelector('.lvl[data-lvl="6"]'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });
  await p.waitForTimeout(3000);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && !!window.game.scene.getScene('Game')?.players?.[0]?.body, null, { timeout: 180000 });
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForTimeout(2500);
  console.log('in Part 6:', await p.evaluate(() => window.game.scene.getScene('Game').levelId));
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); g.reachGoal(g.players[0]); });
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.() && window.__fishing.fd?.level === 6, null, { timeout: 60000 });
  console.log('boss 6 started from Part 6:', await p.evaluate(() => ({ v6: window.__fishing.v6, level: window.__fishing.fd.level, practice: !!window.__fishing.fd.result.practice })));
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${DIR}/intro.png` });
  await p.evaluate(() => (window.__fishing.skipping = true));
  await p.waitForFunction(() => !window.__fishing.inIntro, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.evaluate((m) => { const f = window.__fishing; f.score = m === 'win' ? { hero: [true, true, true, true], king: [false, true, false] } : { hero: [false, false], king: [true, true, true] }; f.waits = []; f.renderBoard(4); m === 'win' ? f.youWin6() : f.kingWins(); }, mode);
  if (mode === 'win') {
    await p.waitForSelector('.screen h2', { timeout: 120000 });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${DIR}/results.png` });
    console.log('results:', await p.evaluate(() => ({ h2: document.querySelector('.screen h2').textContent, eyebrow: document.querySelector('.screen .eyebrow')?.textContent, next: !!document.querySelector('[data-act=next]'), beaten: localStorage.getItem('puffy.beaten') })));
    await p.click('[data-act=home]');
    await p.waitForTimeout(4000);
    console.log('home:', await p.evaluate(() => window.game.scene.isActive('Menu') && !window.game.scene.isActive('Fishing')));
    await p.screenshot({ path: `${DIR}/home.png` });
  } else {
    await p.waitForFunction(() => window.game.scene.isActive('Game'), null, { timeout: 60000 });
    await p.waitForTimeout(3000);
    console.log('after loss:', await p.evaluate(() => ({ game: window.game.scene.isActive('Game'), level: window.game.scene.getScene('Game').levelId, fishing: window.game.scene.isActive('Fishing'), lives: document.querySelector('.hud')?.textContent?.replace(/\s+/g, ' ').slice(0, 40) })));
    await p.screenshot({ path: `${DIR}/back-in-part6.png` });
  }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
