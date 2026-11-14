// After visiting bosses, do levels and battle still have every picture? Watches for objects drawn with
// Phaser's missing-texture stand-in ('__MISSING') or a texture that no longer exists, at each step.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.beaten', '5'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => /missing|not found|Texture/i.test(m.text()) && errs.push('console: ' + m.text().slice(0, 160)));
  await p.goto('http://localhost:8091/');
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.evaluate(() => {
    window.__bad = new Set();
    setInterval(() => {
      const tm = window.game.textures;
      const walk = (list, sc) => { for (const o of list) { const t = o.texture; if (t && (t.key === '__MISSING' || !tm.exists(t.key))) window.__bad.add(sc + ':' + (o.type) + ':' + t.key); if (o.list) walk(o.list, sc); } };
      for (const sc of window.game.scene.getScenes(true)) walk(sc.children.list, sc.sys.settings.key);
    }, 250);
  });
  const boss = async (n, ms) => {
    await p.click('[data-act=bosses]'); await p.waitForTimeout(500);
    await p.click(`[data-boss="${n}"]`);
    await p.waitForFunction(() => ['Hoops', 'Wrestle', 'Fishing'].some((k) => window.game.scene.isActive(k)), null, { timeout: 120000 });
    await p.waitForTimeout(ms);
    // back to the start screen the way the pause menu does
    await toHome();
  };
  const level = async (l, ms) => {
    await p.evaluate((l) => { const b = document.querySelector(`.lvl[data-lvl="${l}"]`); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); }, l);
    await p.waitForTimeout(1500);
    await p.click('[data-act=play]');
    await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 120000 });
    await p.evaluate(() => window.game.events.emit('skip-intro'));
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const g = window.game.scene.getScene('Game'); const pl = g.players[0]; pl.invulnUntil = 1e12; pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: true, run: Math.random() < 0.5, fire: Math.random() < 0.3, jump: Math.random() < 0.06 }) }; });
    await p.waitForTimeout(ms);
    await toHome();
  };
  // pause (once any intro's over: it can't be paused during one) and go back to the start screen
  async function toHome() {
    for (let i = 0; i < 40; i++) {
      if (await p.$('[data-act=hero]')) break;
      await p.keyboard.press('Escape'); await p.waitForTimeout(700);
    }
    await p.click('[data-act=hero]');
    await p.waitForSelector('[data-act=play]', { timeout: 60000 }); await p.waitForTimeout(1500);
  }
  const report = async (step) => { const bad = await p.evaluate(() => { const b = [...window.__bad]; window.__bad.clear(); return b; }); console.log(step.padEnd(28), bad.length ? 'MISSING: ' + bad.slice(0, 6).join(' | ') : 'all pictures present'); };
  await boss(1, 9000); await report('Hoops 1');
  await level(1, 12000); await report('Part 1 after Hoops 1');
  await boss(3, 9000); await report('Queen Plop');
  await level(3, 12000); await report('Part 3 after Queen');
  await boss(5, 9000); await report('Fishing');
  await boss(2, 9000); await report('Hoops 2');
  await level(4, 12000); await report('Part 4 after Hoops 2');
  await level(2, 10000); await report('Part 2');
  console.log(errs.join('\n') || 'no page errors');
  await br.close();
})();
