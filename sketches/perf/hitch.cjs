// Hitch harness: walks through the game's one-off moments at 4x CPU and reports, per moment, the
// longest and p99 frame gap, frames over 50/100 ms, long tasks, shader compiles (with names),
// texture uploads (count, MB, biggest), draw calls per frame, 2D canvas time, live GPU textures.
// args: port light(0|1) session(main|boss|battle|mem) tag [throttle]
// out: $OUT or sketches/perf/runs/<tag>-<session>-L<light>.json (+ a table on stdout)
// HV=1: also each frame over 100 ms in each moment — when (s), how long, upload ms/MB in it, its
// biggest upload, 2D canvas ms, shader ms, and whether a loading bar/card was up. Serve a build first
// (PORT=… node ./server.mjs); sessions run in fresh browsers, seeded Math.random.
const { chromium } = require('playwright');
const fs = require('fs');
const [port, light, session, tag, thrArg] = process.argv.slice(2);
const THR = Number(thrArg || 4);
const INST = fs.readFileSync(`${__dirname}/inst.js`, 'utf8');
const OUTD = process.env.OUT || `${__dirname}/runs`; fs.mkdirSync(OUTD, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(br, name, lt, throttle) {
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: false });
  await ctx.addInitScript(([lt, n]) => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.light', lt); localStorage.setItem('puffy.hero', 'puffy'); localStorage.setItem('puffy.name', n); }, [lt, name]);
  await ctx.addInitScript(INST);
  const p = await ctx.newPage();
  if (!global.FIRST) global.FIRST = p;
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  if (throttle > 1) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  return p;
}
const seg = (p, n) => p.evaluate((n) => window.__seg(n), n);
const evAfter = (p, name, t0, timeout = 180000) => p.waitForFunction(([n, t]) => window.__H.ev.some((e) => e[0] === n && e[1] >= t), [name, t0], { timeout, polling: 100 });
const pnow = (p) => p.evaluate(() => performance.now());
const tap = (p, sel) => p.evaluate((s) => { const b = document.querySelector(s); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); }, sel);

async function boot(p) {
  await seg(p, 'boot');
  await p.goto(`http://localhost:${port}/`);
  await p.waitForFunction(() => window.game?.registry?.get('ready') && !document.body.classList.contains('booting'), null, { timeout: 300000, polling: 100 });
}
async function quitToHome(p) {
  // (the pause menu's Home screen; or, if the run ended — game over, results — that screen's Home)
  await p.keyboard.press('Escape'); await sleep(400);
  if (await p.$('.paused [data-act=hero]')) return p.click('.paused [data-act=hero]');
  await p.click('.hud-pause', { timeout: 1500 }).catch(() => {}); await sleep(400);
  if (await p.$('.paused [data-act=hero]')) return p.click('.paused [data-act=hero]');
  // (out of lives: its card's Pick player)
  const b = await p.waitForSelector('[data-act=home], .screen button:has-text("Pick player")', { timeout: 30000 });
  await b.click();
}
// a simple seeded bot: run right, fire, jump now and then
async function botLevel(p, ms) {
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const end = Date.now() + ms;
  await p.keyboard.down('ArrowRight');
  while (Date.now() < end) {
    await p.keyboard.press('Space');
    if (rnd() < 0.5) { await p.keyboard.down('ArrowUp'); await sleep(250 + rnd() * 300); await p.keyboard.up('ArrowUp'); } else await sleep(300);
    if (rnd() < 0.08) { await p.keyboard.up('ArrowRight'); await p.keyboard.down('ArrowLeft'); await sleep(500); await p.keyboard.up('ArrowLeft'); await p.keyboard.down('ArrowRight'); }
  }
  await p.keyboard.up('ArrowRight');
}

async function main(br) {
  const p = await page(br, 'Ann', light, THR);
  await boot(p);
  await seg(p, 'home-settle'); await sleep(8000);
  for (const n of [3, 5, 6, 1]) { await seg(p, `switch-${n}`); await tap(p, `.lvl[data-lvl="${n}"]`); await sleep(5000); }
  await seg(p, 'play-to-run');
  let t0 = await pnow(p);
  await p.click('[data-act=play]');
  await evAfter(p, 'level-intro-end', t0);
  await seg(p, 'level-minute'); await botLevel(p, 50000);
  await seg(p, 'level-to-home'); await quitToHome(p); await sleep(8000);
  return p;
}
async function boss(br) {
  const p = await page(br, 'Ann', light, THR);
  await boot(p);
  await sleep(3000);
  const enter = async (b, ev) => {
    await seg(p, `boss${b}-enter`);
    const t0 = await pnow(p);
    await p.click('[data-act=bosses]'); await sleep(600); await p.click(`[data-boss="${b}"]`);
    // (the intro's Skip, once it shows)
    const skipper = (async () => { for (let i = 0; i < 200; i++) { const sk = await p.$('text=Skip'); if (sk) { await sk.click().catch(() => {}); return; } await sleep(300); } })();
    await evAfter(p, ev, t0);
    await skipper.catch(() => {});
  };
  // Hoops: the intro, then a few rounds of shots (Space shoots when the meter's up)
  await enter(1, 'hoops-play');
  await seg(p, 'boss1-shots');
  for (let i = 0; i < 30; i++) { await p.keyboard.press('Space'); await sleep(900); }
  await seg(p, 'boss1-home'); await quitToHome(p); await sleep(6000);
  // Plop King: the fight a moment, then his last hit (straight to the win: the flood)
  await enter(4, 'wrestle-fight');
  await seg(p, 'boss4-fight');
  await p.keyboard.down('ArrowRight');
  for (let i = 0; i < 12; i++) { await p.keyboard.press('Space'); await sleep(500); }
  await p.keyboard.up('ArrowRight');
  await seg(p, 'boss4-flood');
  let t0 = await pnow(p);
  await p.evaluate(() => { const s = window.game.scene.getScene('Wrestle'); s.queen.hp = 0; void s.winKing(); });
  await evAfter(p, 'level-complete', t0, 120000);
  await seg(p, 'boss4-home'); await sleep(1500); await p.click('[data-act=home]'); await sleep(6000);
  // Fishing: a catch (every bite hit, catch forced)
  await enter(5, 'fishing-play');
  await seg(p, 'boss5-catch');
  await p.evaluate(() => { window.__fishOdds = 1; });
  const end = Date.now() + 120000; let hooked = false;
  while (Date.now() < end) {
    const s = await p.evaluate(() => { const f = window.__fishing; return { bite: !f.dom.querySelector('.fsh-bite').hidden, mode: f.lures.hero.mode }; });
    if (s.bite) { await p.locator('.fsh-bite').click({ force: true, timeout: 500 }).catch(() => {}); continue; }
    if (s.mode === 'hooked') hooked = true;
    if (hooked && s.mode === 'held') break;
    await sleep(100);
  }
  await sleep(3000);
  await seg(p, 'boss5-home'); await quitToHome(p); await sleep(6000);
  return p;
}
async function battle(br) {
  const room = 'g4' + Math.floor(Math.random() * 1e6);
  const p = await page(br, 'Ann', light, THR);
  const q = await page(br, 'Bo', light, 1);
  await boot(p);
  await q.goto(`http://localhost:${port}/`); await q.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await sleep(3000);
  const join = async (x) => { await x.click('[data-act=battle]'); await x.waitForSelector('.battle-code'); await x.fill('.bc-box input', room); await x.click('.battle-code [data-act=go]'); await x.waitForSelector('.bl-title', { timeout: 60000 }); };
  await seg(p, 'battle-lobby'); await join(p); await join(q); await sleep(4000);
  await seg(p, 'battle-start');
  await p.click('[data-act=startnow]');
  await p.waitForFunction(() => window.game.scene.isActive('Battle') && !!window.game.scene.getScene('Battle').me, null, { timeout: 120000, polling: 100 });
  await sleep(1000);
  await seg(p, 'battle-play');
  await p.keyboard.down('ArrowRight');
  for (let i = 0; i < 16; i++) { await p.keyboard.press('Space'); await sleep(500); }
  await p.keyboard.up('ArrowRight');
  await q.context().close();
  return p;
}
// memory: Part 1 → boss 1 → home → Part 3 → boss 3 → home, three times: texture count/bytes after each
async function mem(br) {
  const p = await page(br, 'Ann', light, 1);
  await boot(p); await sleep(3000);
  for (let r = 1; r <= 3; r++) {
    for (const [kind, n] of [['part', 1], ['boss', 1], ['part', 3], ['boss', 3]]) {
      await seg(p, `r${r}-${kind}${n}`);
      if (kind === 'part') {
        await tap(p, `.lvl[data-lvl="${n}"]`); await sleep(2000);
        const t0 = await pnow(p); await p.click('[data-act=play]'); await evAfter(p, 'game-start', t0); await sleep(3000);
        await p.evaluate(() => window.game.events.emit('skip-intro')); await sleep(3000);
      } else {
        const t0 = await pnow(p);
        await p.click('[data-act=bosses]'); await sleep(600); await p.click(`[data-boss="${n}"]`);
        await evAfter(p, n === 1 ? 'hoops-start' : 'wrestle-start', t0); await sleep(6000);
      }
      await quitToHome(p); await sleep(6000);
    }
  }
  return p;
}

(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--disable-gpu-vsync'] });
  let p;
  try {
    p = await { main, boss, battle, mem }[session](br);
  } catch (e) {
    console.log('FAILED', e.message.split('\n')[0]);
    if (global.FIRST) await global.FIRST.screenshot({ path: `${OUTD}/${tag}-${session}-L${light}-fail.png` }).catch(() => {});
  }
  const ctxs = br.contexts();
  const pg = p || global.FIRST;
  const sum = pg ? await pg.evaluate(() => window.__sum()).catch(() => []) : [];
  const kpsc = pg ? await pg.evaluate(() => window.__H.kpsc).catch(() => null) : null;
  const errs = pg ? pg.errs : [];
  fs.writeFileSync(`${OUTD}/${tag}-${session}-L${light}.json`, JSON.stringify({ tag, session, light, kpsc, errs, sum }, null, 1));
  console.log(`${tag} ${session} light=${light} parallel-compile=${kpsc} errors=${errs.length ? errs.slice(0, 3).join(' | ') : 'none'}`);
  for (const s of sum) console.log(`  ${s.name.padEnd(14)} ${String(s.secs).padStart(5)}s f${String(s.frames).padStart(4)} gap max ${String(s.gapMax).padStart(4)} p99 ${String(s.gapP99).padStart(4)} med ${String(s.gapMed).padStart(5)} >50:${s.over50} >100:${s.over100} | LT ${s.lt} max ${s.ltMax} | sh ${s.comp}/${s.link} ${s.shMs}ms | up ${s.up} ${s.upMB}MB sub ${s.sub} ${s.upMs}ms max ${s.upMax} (${s.upMaxWhat}) | draws ${s.drawsMed}/${s.drawsMax} | cv ${s.cvMs}ms | tex ${s.texN} ${s.texMB}MB ${s.link ? '| ' + [...new Set(s.names)].join(',') : ''}`);
  if (process.env.HV) for (const s of sum) { console.log(`  ${s.name} events: ${s.evs.join(' ')}`); for (const h of s.hitches.filter((h) => h[1] > 100)) console.log(`     @${h[0]}s ${h[1]}ms up ${h[2]}ms/${h[3]}MB ${h[4]} cv ${h[5]} sh ${h[6]} ${h[7]}`); }
  await br.close();
})();
