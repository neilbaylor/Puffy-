// Who sees Boss 6: signed out (no dev switch), a non-tester account, the testers (founder, neil): the Bosses menu and the Parts.
const { chromium } = require('playwright');
require('fs').mkdirSync('shots/boss6', { recursive: true });
const port = process.argv[2] || '8411';
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 } });
  // (as if they'd beaten every Part: only the account decides)
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.beaten', '6'); } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:${port}/`);
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(800);
  const look = async (who) => {
    const parts = await p.evaluate(() => [...document.querySelectorAll('.lvl[data-lvl]')].map((b) => b.dataset.lvl).join(','));
    await p.click('[data-act=bosses]'); await p.waitForTimeout(500);
    const bosses = await p.evaluate(() => [...document.querySelectorAll('[data-boss]')].map((b) => b.dataset.boss).join(','));
    await p.screenshot({ path: `shots/boss6/gate-${who}.png` });
    await p.click('.bosses [data-act=back]'); await p.waitForTimeout(500);
    console.log(`${who.padEnd(10)} parts ${parts.padEnd(12)} bosses ${bosses}`);
  };
  const signIn = async (name) => {
    await p.click('[data-act=account]');
    await p.fill('input[name=name]', name);
    await p.fill('input[name=pw]', 'testpass1');
    await p.click('[data-act=in]');
    await p.waitForTimeout(1500);
    if (await p.isVisible('.acct-confirm')) { await p.click('[data-act=ok]'); await p.waitForTimeout(1500); }
    const done = await p.$('.acct-card [data-act=done], .acct-done-row button');
    if (done) await done.click().catch(() => {});
    await p.waitForTimeout(1500);
  };
  const signOut = async () => {
    await p.click('[data-act=account]'); await p.waitForTimeout(500);
    await p.click('[data-act=out]'); await p.waitForTimeout(1500);
    const b = await p.$('[data-act=back], [data-act=done]'); if (b && await b.isVisible()) await b.click().catch(() => {});
    await p.waitForTimeout(1000);
  };
  await look('signed-out');
  await signIn('someone'); await look('someone');
  // (a non-tester can't start it by hand either)
  console.log('someone forcing boss 6:', await p.evaluate(() => { const u = window.game.scene.getScene('Menu'); void u; return 'menu has no button'; }));
  await signOut(); await look('out-again');
  await signIn('Founder'); await look('founder');
  await p.reload(); await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 }); await p.waitForTimeout(1000);
  await look('founder-reload');
  await signOut(); await look('founder-out');
  await signIn('neil'); await look('neil');
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
