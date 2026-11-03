// A bot joins room birchcliff, you join from Chromium, then screenshots: start buttons, room pill, battle (camera follow).
// Needs: npm run build && PORT=8091 BATTLE_DEMO=prizes node server.mjs   (screenshots go to /tmp)
const { chromium } = require('playwright');
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8091/battle?room=birchcliff'); let seq = 0, phase = '';
ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', name: 'Bot', hero: 'muscles', token: 't15' + Date.now() })));
ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'room') phase = m.room.phase; });
setInterval(() => { if (phase === 'battle' && ws.readyState === 1) ws.send(JSON.stringify({ t: 'in', s: ++seq, b: 0 })); }, 33);
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const p = await (await br.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2, hasTouch: false })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('puffy.name', 'Neil'); });
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/t15-start.png', clip: { x: 932 - 300, y: 0, width: 300, height: 90 } });
  await p.click('[data-act=battle]'); await p.waitForSelector('.battle-code'); await p.click('.battle-code [data-act=go]');
  await p.waitForSelector('.battle-lobby .bl-roomtag'); await p.waitForTimeout(1500);
  await p.screenshot({ path: '/tmp/t15-pill.png', clip: { x: 932 - 220, y: 0, width: 220, height: 60 } });
  await p.waitForFunction(() => window.game.scene.isActive('Battle') && !document.querySelector('.battle-lobby') && !document.querySelector('.bl-curtain'), null, { timeout: 120000 });
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/t15-b1.png' });
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(1600); await p.keyboard.up('ArrowRight');
  await p.screenshot({ path: '/tmp/t15-b2.png' });
  const info = await p.evaluate(() => { const s = window.game.scene.getScene('Battle'); return { me: s.me && [Math.round(s.me.x), Math.round(s.me.y)], cam: [Math.round(s.cameras.main.midPoint.x), Math.round(s.cameras.main.midPoint.y), s.cameras.main.zoom.toFixed(3)], prizes: [...s.prizeViews.keys()] }; });
  console.log(JSON.stringify(info));
  await p.keyboard.down('ArrowLeft'); await p.waitForTimeout(2500); await p.keyboard.up('ArrowLeft');
  await p.screenshot({ path: '/tmp/t15-b3.png' });
  console.log('errors', errs);
  await br.close(); process.exit(0);
})();
