// A whole battle, end to end, through the delay proxy: 4 players (2 games + 2 bots), a third game
// joining mid-battle and watching from the lobby window, a bot leaving mid-battle and another joining,
// then the results. Checks: no page errors, everyone drawn, the watcher's window running, the
// results card. (Server started with BATTLE_SECS short.)
// node tfunc.cjs --port 8094 --proxy 8095 --lag 50 --jit 15
const { chromium } = require('playwright');
const { bot } = require('./bot.cjs');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', 8094));
const PROXY = Number(arg('proxy', 8095));
const LAG = Number(arg('lag', 50));
const JIT = Number(arg('jit', 15));
const url = (who) => `ws://localhost:${PROXY}/battle?lag=${LAG}&jit=${JIT}&spike=0.02&spikeMs=60&who=${who}`;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const errs = [];
  const room = 'fn' + Math.floor(Math.random() * 1e6);
  const mk = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 640, height: 300 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    p.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errs.push(name + ' console: ' + m.text()));
    await p.addInitScript(([n]) => (localStorage.setItem('puffy.name', n), localStorage.setItem('puffy.light', '1')), [name]);
    await p.goto(`http://localhost:${PORT}/?server=${encodeURIComponent(url(name))}`);
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]');
    await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 30000 });
    return p;
  };
  const A = await mk('Alpha');
  const B = await mk('Bravo');
  const bots = [bot(url('bot0') + `&room=${room}`, 'Bot0'), bot(url('bot1') + `&room=${room}`, 'Bot1')];
  await A.waitForTimeout(1500);
  await A.evaluate(() => document.querySelector('.bl-startnow')?.click());
  await Promise.all([A, B].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  const t0 = Date.now();
  // the two games wander about and fire
  for (const p of [A, B])
    await p.evaluate(() => {
      const s = window.game.scene.getScene('Battle');
      let dir = 1;
      let next = 0;
      s.buttons = () => {
        const t = performance.now() / 1000;
        if (t > next) {
          next = t + 0.4 + Math.random();
          dir = -dir;
        }
        return (dir > 0 ? 2 : 1) | (t % 1.2 < 0.25 ? 4 : 0) | (t % 0.9 < 0.3 ? 8 : 0) | (t % 5 < 0.1 ? 32 : 0);
      };
    });
  await A.waitForTimeout(4000);
  const count = (p) => p.evaluate(() => { const s = window.game.scene.getScene('Battle'); return [...s.views.values()].filter((v) => v.sprite.visible).length + '/' + s.views.size; });
  console.log('4 players: A draws', await count(A), 'B draws', await count(B));
  // a third game comes along mid-battle: it watches in the lobby's window
  const C = await mk('Charlie');
  await C.waitForTimeout(3000);
  const cState = await C.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    return { battle: window.game.scene.isActive('Battle'), spectate: s.spectate, views: s.views.size, preview: !document.querySelector('.bl-preview')?.hidden, snaps: s.snaps.length, players: [...s.views.values()].map((v) => Math.round(v.sprite.x)) };
  });
  console.log('watcher:', JSON.stringify(cState));
  const cx0 = cState.players;
  await C.waitForTimeout(1500);
  console.log('watcher, 1.5 s on (they move):', JSON.stringify(await C.evaluate(() => [...window.game.scene.getScene('Battle').views.values()].map((v) => Math.round(v.sprite.x)))), 'was', JSON.stringify(cx0));
  // a bot leaves mid-battle, another comes (and waits for the next battle)
  bots[1].leave();
  await A.waitForTimeout(1500);
  console.log('a bot left: A draws', await count(A));
  bots.push(bot(url('bot2') + `&room=${room}`, 'Bot2'));
  await A.waitForTimeout(1500);
  console.log('late bot sees phase', bots[2].phase, 'snaps', bots[2].snaps);
  // to the end
  await A.waitForSelector('.battle-results', { timeout: 120000 });
  console.log('results after', Math.round((Date.now() - t0) / 1000), 's; A card:', (await A.textContent('.battle-results')).replace(/\s+/g, ' ').slice(0, 140));
  console.log('B card shown:', !!(await B.$('.battle-results')));
  await A.screenshot({ path: 'func-results.png' });
  // back to the lobby, and the next battle's countdown
  await A.waitForFunction(() => !document.querySelector('.battle-results') && !!document.querySelector('.bl-title'), null, { timeout: 30000 }).catch(() => console.log('(still on results)'));
  console.log('back in the lobby:', !!(await A.$('.bl-title')));
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
  for (const x of bots) x.leave();
  await b.close();
  process.exit(0);
})();
