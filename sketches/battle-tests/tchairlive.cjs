// a real battle: wait for the first chair to fall, walk over to it (jumping if it's up on something), and pick it up; then swing at bad guys
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const errs = [];
  const room = 'ch' + Math.floor(Math.random() * 1e5);
  const mk = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.addInitScript(([n]) => localStorage.setItem('puffy.name', n), [name]);
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 180000 });
    await p.click('[data-act=battle]'); await p.waitForSelector('.battle-code');
    await p.fill('.bc-box input', room);
    await p.click('.battle-code [data-act=go]');
    await p.waitForSelector('.bl-title', { timeout: 30000 });
    return p;
  };
  const a = await mk('Neil');
  const c = await mk('Henry');
  await Promise.all([a, c].map((p) => p.waitForFunction(() => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').me, null, { timeout: 90000 })));
  const state = () => a.evaluate(() => { const s = window.game.scene.getScene('Battle'); const last = s.snaps.at(-1); const me = last.players.find((q) => q.id === s.net.myId); return { me: [Math.round(me.x), Math.round(me.y)], chairs: last.chairs.map((t) => ({ x: Math.round(t[1]), y: Math.round(t[2]), holder: t[3] ? (t[3] === s.net.myId ? 'me' : 'other') : '', age: t[6] })), enemies: last.enemies.map((e) => ({ id: e[0], kind: e[1], x: Math.round(e[2]), y: Math.round(e[3]) })), tl: last.timeLeft }; });
  // wait for a chair to land
  let st;
  for (let i = 0; i < 120; i++) { st = await state(); if (st.chairs.some((t) => t.age >= 0)) break; await a.waitForTimeout(1000); }
  console.log('chair down:', JSON.stringify(st.chairs), 'me', st.me, 'time left', st.tl);
  // walk to it
  let got = false;
  for (let i = 0; i < 60 && !got; i++) {
    st = await state();
    const ch = st.chairs.find((t) => t.age >= 0 || t.holder === 'me');
    if (!ch) break;
    if (ch.holder === 'me') { got = true; break; }
    const dx = ch.x - st.me[0];
    const up = st.me[1] - ch.y > 20;
    const key = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    await a.keyboard.down('ShiftLeft');
    await a.keyboard.down(key);
    // (hop along: over the little posts)
    if ((up && Math.abs(dx) < 140) || Math.abs(dx) > 60) { await a.keyboard.down('ArrowUp'); setTimeout(() => a.keyboard.up('ArrowUp').catch(() => {}), 250); }
    await a.waitForTimeout(Math.min(1500, Math.abs(dx) * 2.2 + 60));
    await a.keyboard.up(key); await a.keyboard.up('ArrowUp'); await a.keyboard.up('ShiftLeft');
    await a.waitForTimeout(150);
  }
  st = await state();
  console.log('picked up?', got, JSON.stringify(st.chairs), 'me', st.me);
  await a.screenshot({ path: 'shots/live-chair.png' });
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
