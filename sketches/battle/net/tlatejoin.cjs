// Joining a room in the countdown's very last second (two bots there, Start now pressed): the game
// should go straight into the battle as a player, with every picture there and no errors.
// node tlatejoin.cjs <port> [delayMs after Start now]   (server: BATTLE_COUNTDOWN=600)
const { chromium } = require('playwright');
const WebSocket = require('ws');
const PORT = Number(process.argv[2] || 8391);
const DELAY = Number(process.argv[3] || 2600);
const FULL = process.env.FULL === '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function bot(code, name) {
  const ws = new WebSocket(`ws://localhost:${PORT}/battle?room=${code}`);
  const b = { ws, phase: '' };
  let seq = 0;
  let iv = null;
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', name, hero: 'scruffy', token: name + Math.random() })));
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'room') {
      b.phase = m.room.phase;
      b.room = m.room;
      if (m.room.phase === 'battle' && !iv) iv = setInterval(() => ws.send(JSON.stringify({ t: 'in', s: ++seq, b: seq % 60 < 30 ? 2 : 1 })), 33);
    }
  });
  b.stop = () => (clearInterval(iv), ws.close());
  return b;
}
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const errs = [];
  const room = 'lj' + Math.floor(Math.random() * 1e6);
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(([full]) => (localStorage.setItem('puffy.name', 'Late'), localStorage.setItem('puffy.light', full ? '0' : '1'), localStorage.setItem('puffy.lightRetried', '1')), [FULL]);
  await p.goto(`http://localhost:${PORT}/`);
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
  await p.click('[data-act=battle]');
  await p.waitForSelector('.battle-code');
  await p.fill('.bc-box input', room);
  const a = bot(room, 'BotA');
  const b = bot(room, 'BotB');
  while (a.phase !== 'countdown') await sleep(50);
  a.ws.send(JSON.stringify({ t: 'start' }));
  const t0 = Date.now();
  await sleep(DELAY);
  await p.click('.battle-code [data-act=go]');
  const tGo = Date.now() - t0;
  const ok = await p
    .waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me && window.game.scene.getScene('Battle').views.size >= 3, null, { timeout: 60000 })
    .then(() => true, () => false);
  await sleep(4000);
  const st = await p.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    const missing = [];
    const walk = (l) => {
      for (const o of l) {
        if (o.texture?.key === '__MISSING' && o.visible) missing.push(o.type);
        if (o.list) walk(o.list);
      }
    };
    for (const sc of window.game.scene.getScenes(true)) walk(sc.children.list);
    return { spectate: s.spectate, views: s.views.size, me: !!s.me, missing, phase: window.__battle.net.room.phase, hud: !!document.querySelector('.bhud') };
  });
  // (the game loads the battle's pictures before it connects: clicked too late, it got there after the
  // start and watches — that's right too, as long as it's one or the other)
  const late = a.room.players.find((q) => q.name === 'Late');
  const playing = !!late?.playing;
  const good = playing ? ok && !st.spectate && st.me : st.spectate && st.views >= 2;
  console.log(`${good && !st.missing.length && !errs.length ? 'ok  ' : 'FAIL'} late join: clicked ${tGo} ms after Start now (3.5 s countdown): ${playing ? 'got in before the start: playing' : 'got there after the start: watching'}; ${JSON.stringify(st)}; errors: ${errs.join(' | ') || 'none'}`);
  a.stop();
  b.stop();
  await br.close();
  process.exit(0);
})();
