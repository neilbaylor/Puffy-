// Gameplay GPU work in a level (hero running right): draw calls per frame, texture uploads per second and
// who makes them, and the JS functions taking the most time. Arg: level (1-5).
const { chromium } = require('playwright');
const LVL = process.argv[2] || '1';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '5'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate((l) => { const b = document.querySelector(`.lvl[data-lvl="${l}"]`); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); }, LVL);
  await p.waitForTimeout(2000);
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForTimeout(2500);
  await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.invulnUntil = 1e12; pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: true, run: false, fire: Math.random() < 0.2, jump: Math.random() < 0.05 }) }; });
  await p.waitForTimeout(1500);
  const gl = await p.evaluate(() => new Promise((done) => {
    const g = window.game.renderer.gl;
    let draws = 0, ups = 0; const who = new Map();
    const wrap = (name, count) => { const f = g[name].bind(g); g[name] = (...x) => { count(new Error().stack); return f(...x); }; };
    wrap('drawElements', () => draws++); wrap('drawArrays', () => draws++);
    const up = (st) => { ups++; const k = st.split('\n').slice(5, 10).map((l) => l.trim().replace(/^at /, '').replace(/\(.*\/(.*?):(\d+):\d+\)/, '').trim()).join(' < '); who.set(k, (who.get(k) || 0) + 1); };
    wrap('texImage2D', up); wrap('texSubImage2D', up);
    const f0 = window.game.loop.frame;
    setTimeout(() => done({ frames: window.game.loop.frame - f0, drawsPerFrame: Math.round(draws / Math.max(1, window.game.loop.frame - f0)), uploadsPerSec: (ups / 4).toFixed(1), from: [...who.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5) }), 4000);
  }));
  // every vector-shape object in the scene that's drawn: how many drawing commands it holds (each redrawn
  // every frame), by what it belongs to
  const gfx = await p.evaluate(() => {
    const g = window.game.scene.getScene('Game');
    const out = [];
    const walk = (list, path) => { for (const o of list) { if (o.type === 'Graphics' && o.visible && o.alpha > 0 && o.commandBuffer.length) out.push({ n: o.commandBuffer.length, depth: o.depth, name: o.name || '' }); if (o.list) walk(o.list, path); } };
    walk(g.children.list, '');
    return out.sort((a, b) => b.n - a.n).slice(0, 12);
  });
  console.log('  graphics drawn each frame (commands, depth):', gfx.map((o) => `${o.n}@${o.depth.toFixed(2)}`).join(' '));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await p.waitForTimeout(5000);
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  for (const s of profile.samples) { const cf = byId.get(s).callFrame; if (cf.functionName === '(program)' || cf.functionName === '(idle)') continue; const k = `${cf.functionName || '(anon)'}:${cf.lineNumber}`; self.set(k, (self.get(k) || 0) + 1); }
  const js = [...self.values()].reduce((a, b) => a + b, 0);
  console.log('level', LVL, JSON.stringify({ ...gl, from: undefined }));
  for (const [k, n] of gl.from) console.log('   ', n, 'uploads:', k);
  console.log('  JS share of samples:', ((100 * js) / profile.samples.length).toFixed(1) + '%; top:', [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ${((100 * n) / js).toFixed(0)}%`).join(', '));
  console.log('  errors:', errs.join(' | ') || 'none');
  await br.close();
})();
