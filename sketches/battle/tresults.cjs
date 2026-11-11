// Every end-of-battle card: you win, someone else wins, a tie on KOs (broken by fewest knock-outs),
// a draw, a two-player battle. On a phone and a tablet. Usage: node tresults.cjs <out prefix>
const { chromium } = require('playwright');
const PRE = process.argv[2] || 'shots/battle/res';
const P = (id, name, hero, slot, kos, deaths, wear = '') => ({ id, name, hero, slot, kos, deaths, wear, connected: true, playing: true });
const CASES = {
  win: { winner: 'me', players: [P('me', 'Neil', 'puffy', 0, 6, 1, 'frogskins'), P('b', 'Henry', 'scruffy', 1, 4, 3), P('c', 'Founder', 'muscles', 2, 2, 4), P('d', 'Player 4', 'puffy', 3, 0, 5)] },
  lose: { winner: 'b', players: [P('me', 'Neil', 'puffy', 0, 3, 2), P('b', 'Henry', 'scruffy', 1, 7, 1, 'party'), P('c', 'Founder', 'muscles', 2, 1, 5)] },
  tie: { winner: 'c', players: [P('me', 'Neil', 'puffy', 0, 4, 3), P('b', 'Henry', 'scruffy', 1, 2, 4), P('c', 'Founder', 'muscles', 2, 4, 1)] },
  draw: { winner: null, players: [P('me', 'Neil', 'puffy', 0, 0, 0), P('b', 'Henry', 'scruffy', 1, 0, 0)] },
  duel: { winner: 'me', players: [P('me', 'Neil', 'muscles', 0, 3, 2), P('b', 'Henry', 'puffy', 1, 2, 3)] },
};
(async () => {
  require('fs').mkdirSync(require('path').dirname(PRE), { recursive: true });
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const [dev, vp] of [['phone', { width: 844, height: 390 }], ['tablet', { width: 1180, height: 820 }]]) {
    const ctx = await br.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => localStorage.setItem('puffy.beaten', '1'));
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.click('[data-act=battle]');
    await p.waitForFunction(() => window.__battle, null, { timeout: 20000 });
    for (const [name, c] of Object.entries(CASES)) {
      await p.evaluate((c) => {
        const b = window.__battle;
        b.net = { myId: 'me', room: null, close() {} };
        b.inBattle = false;
        b.showResults({ phase: 'results', players: c.players, timer: 8, winner: c.winner });
      }, c);
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${PRE}-${dev}-${name}.png` });
    }
    console.log(dev, errs.join(' | ') || 'no errors');
    await ctx.close();
  }
  await br.close();
})();
