const { chromium } = require('playwright');
const { execSync, spawn } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const errs = [];
  const room = 'p' + Math.floor(Math.random() * 1e5);
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
  await a.waitForTimeout(2000);
  // the pause button and its menu
  console.log('button:', await a.textContent('.bhud-leave'));
  await a.click('.bhud-leave');
  await a.waitForTimeout(500);
  await a.screenshot({ path: 'shots/battle-pause.png' });
  console.log('menu:', await a.evaluate(() => [...document.querySelectorAll('.screen.modal .btn')].map((x) => x.textContent).join(' / ')));
  await a.click('[data-act=resume]');
  await a.waitForTimeout(500);
  console.log('after Keep playing: menu gone?', await a.evaluate(() => !document.querySelector('.screen.modal')), 'battle on?', await a.evaluate(() => window.game.scene.isActive('Battle')));
  // the server goes away mid-battle
  execSync('pkill -f "[s]erver.mjs"');
  await a.waitForTimeout(4500);
  console.log('server gone: lost card shown?', await a.evaluate(() => !document.querySelector('.bhud-lost')?.hidden));
  await a.screenshot({ path: 'shots/battle-lost.png' });
  // and comes back
  spawn('sh', ['-c', 'cd wt-battle && PORT=8091 DB_PATH=../apidb10/puffy.db nohup node server.mjs > ../server.log 2>&1 &'], { detached: true, stdio: 'ignore' }).unref();
  await a.waitForFunction(() => !!document.querySelector('.bl-title') && !window.game.scene.isActive('Battle'), null, { timeout: 60000 }).catch(() => {});
  console.log('server back: in the lobby?', await a.evaluate(() => !!document.querySelector('.bl-title')), 'battle scene stopped?', await a.evaluate(() => !window.game.scene.isActive('Battle')));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
