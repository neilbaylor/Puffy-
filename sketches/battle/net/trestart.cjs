// The server restarting in the middle of a battle (a Railway deploy): what the two players see, and
// where they end up. The test runs the server itself (so it can stop it):
// node trestart.cjs <dir with server.mjs and dist> <port> [downMs]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const DIR = process.argv[2];
const PORT = Number(process.argv[3] || 8395);
const DOWN = Number(process.argv[4] || 2000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let srv = null;
const start = () =>
  new Promise((ok) => {
    srv = spawn('node', ['server.mjs'], { cwd: DIR, env: { ...process.env, PORT: String(PORT), BATTLE_COUNTDOWN: '600', BATTLE_SECS: '90', DB_PATH: DIR + '/trestart.sqlite' }, stdio: ['ignore', 'pipe', 'inherit'] });
    srv.stdout.on('data', (d) => /being served/.test(String(d)) && ok());
  });
(async () => {
  await start();
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const errs = [];
  const room = 'rs' + Math.floor(Math.random() * 1e6);
  const mk = async (name) => {
    const ctx = await br.newContext({ viewport: { width: 640, height: 300 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.addInitScript(([n]) => (localStorage.setItem('puffy.name', n), localStorage.setItem('puffy.light', '1'), localStorage.setItem('puffy.lightRetried', '1')), [name]);
    await p.goto(`http://localhost:${PORT}/`);
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]');
    await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 60000 });
    // what the page shows, every 100 ms: lost card, lobby, loading card, battle scene
    await p.evaluate(() => {
      const log = (window.__log = []);
      const t0 = performance.now();
      setInterval(() => {
        const lost = document.querySelector('.bhud-lost');
        const lobby = document.querySelector('.battle-lobby');
        const st = [
          lost && !lost.hidden ? 'lost' : '',
          lobby ? (lobby.classList.contains('loading') ? 'lobby-loading' : 'lobby') : '',
          window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').sys.isVisible() ? 'battle' : '',
          document.querySelector('.br-stage') ? 'results' : '',
        ].filter(Boolean).join('+') || 'none';
        if (!log.length || log[log.length - 1][1] !== st) log.push([Math.round(performance.now()), st]);
      }, 100);
    });
    return p;
  };
  const A = await mk('Alpha');
  const B = await mk('Bravo');
  await A.evaluate(() => document.querySelector('.bl-startnow')?.click());
  await Promise.all([A, B].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  await sleep(3000);
  // (each page's own clock)
  const now = () => Promise.all([A, B].map((p) => p.evaluate(() => performance.now())));
  const tKill = await now();
  srv.kill('SIGTERM');
  await sleep(DOWN);
  await start();
  const tUp = await now();
  await sleep(9000);
  for (const [i, n, p] of [[0, 'A', A], [1, 'B', B]]) {
    const log = await p.evaluate(() => window.__log);
    const after = log.filter((e) => e[0] >= tKill[i] - 200).map(([t, s]) => `${((t - tKill[i]) / 1000).toFixed(1)}s ${s}`);
    const st = await p.evaluate(() => ({ status: window.__battle.net?.status, phase: window.__battle.net?.room?.phase, players: window.__battle.net?.room?.players.length }));
    console.log(`${n}: server down at 0 s, up at ${((tUp[i] - tKill[i]) / 1000).toFixed(1)} s → ${after.join(' → ')}; now ${JSON.stringify(st)}`);
  }
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await br.close();
  srv.kill();
  process.exit(0);
})();
