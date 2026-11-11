// The KO badges along the bottom during a battle, on a phone and a tablet (the scoreboard drawn over the start screen).
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const [dev, vp] of [['phone', { width: 844, height: 390 }], ['tablet', { width: 1180, height: 820 }], ['desktop', { width: 1440, height: 860 }]]) {
    const ctx = await br.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => localStorage.setItem('puffy.beaten', '1'));
    const p = await ctx.newPage();
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.click('[data-act=battle]');
    await p.waitForFunction(() => window.__battle, null, { timeout: 20000 });
    await p.evaluate(() => {
      const b = window.__battle;
      document.querySelectorAll('.screen').forEach((e) => e.remove());
      const players = [['me', 'Neil', 0, 3], ['b', 'Henry', 1, 5], ['c', 'Founder', 2, 1], ['d', 'Player 4', 3, 0]];
      b.net = { myId: 'me', room: { players: players.map(([id, name, slot]) => ({ id, name, slot })) }, close() {} };
      const hud = document.createElement('div');
      hud.className = 'bhud';
      hud.innerHTML = '<div class="bhud-time">1:35</div><div class="bhud-bombs" hidden></div><div class="bhud-chips"></div>';
      (document.querySelector('.ui') ?? document.body).appendChild(hud);
      b.hud = hud;
      b.renderHud({ timeLeft: 95, bombs: 0, players: players.map(([id, , slot, kos]) => ({ id, slot, kos, down: id === 'd' })) });
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `shots/battle/chips-${dev}.png` });
    await ctx.close();
  }
  await br.close();
})();
