// A connection that goes dead without closing (a phone moving from wifi to mobile data: the old
// connection just stops; nothing gets through and nobody's told), mid-battle and in the lobby.
// Runs the delay proxy itself (proxy.mjs, next to this file) in front of the server.
// node tdead.cjs <server port> <proxy port> [deadMs]   (server: BATTLE_COUNTDOWN=600 BATTLE_SECS=90)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const PORT = Number(process.argv[2] || 8391);
const PROXY = Number(process.argv[3] || 8396);
const DEAD = Number(process.argv[4] || 25000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const px = spawn('node', [path.join(__dirname, 'proxy.mjs'), String(PROXY), String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, WS_FROM: process.env.WS_FROM || path.join(process.cwd(), 'x.js') } });
  await new Promise((ok) => px.stdout.on('data', (d) => /proxy/.test(String(d)) && ok()));
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const errs = [];
  const room = 'dd' + Math.floor(Math.random() * 1e6);
  const mk = async (name) => {
    const ctx = await br.newContext({ viewport: { width: 640, height: 300 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.addInitScript(([n]) => (localStorage.setItem('puffy.name', n), localStorage.setItem('puffy.light', '1'), localStorage.setItem('puffy.lightRetried', '1')), [name]);
    const ws = `ws://localhost:${PROXY}/battle?lag=20&who=${name}`;
    await p.goto(`http://localhost:${PORT}/?server=${encodeURIComponent(ws)}`);
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]');
    await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 60000 });
    await p.evaluate(() => {
      const log = (window.__log = []);
      setInterval(() => {
        const lost = document.querySelector('.bhud-lost');
        const lobby = document.querySelector('.battle-lobby');
        const net = window.__battle.net;
        const st = [
          lost && !lost.hidden ? 'lost' : '',
          lobby ? (lobby.classList.contains('loading') ? 'lobby-loading' : 'lobby') : '',
          window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').sys.isVisible() ? 'battle' : '',
          net ? net.status : '',
        ].filter(Boolean).join('+');
        if (!log.length || log[log.length - 1][1] !== st) log.push([Math.round(performance.now()), st]);
      }, 100);
    });
    return p;
  };
  const A = await mk('Alpha');
  const B = await mk('Bravo');
  const hole = (who) => fetch(`http://localhost:${PROXY}/hole?who=${who}&ms=${DEAD}`).then((r) => r.text());
  const show = async (p, t0, what) => {
    const log = await p.evaluate(() => window.__log);
    console.log(what + ': ' + log.filter((e) => e[0] >= t0 - 200).map(([t, s]) => `${((t - t0) / 1000).toFixed(1)}s ${s}`).join(' → '));
  };
  // in the lobby
  {
    const t0 = await A.evaluate(() => performance.now());
    await hole('Alpha');
    await sleep(14000);
    await show(A, t0, `lobby, A's connection dead for ${DEAD / 1000} s (shown 14 s)`);
    // (the dead spell over, whatever happened)
    await sleep(Math.max(0, DEAD - 14000 + 1500));
  }
  await A.evaluate(() => document.querySelector('.bl-startnow')?.click());
  await Promise.all([A, B].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  await sleep(2000);
  {
    const t0 = await A.evaluate(() => performance.now());
    await hole('Alpha');
    await sleep(16000);
    await show(A, t0, `battle, A's connection dead for ${DEAD / 1000} s (shown 16 s)`);
    const st = await A.evaluate(() => ({ status: window.__battle.net.status, inBattle: window.__battle.inBattle, snapAgo: Math.round(performance.now() - window.__battle.net.lastSnapAt) }));
    console.log('  now', JSON.stringify(st));
  }
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await br.close();
  px.kill();
  process.exit(0);
})();
