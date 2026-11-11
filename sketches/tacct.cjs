// The player (account) card: sign in (a new name makes an account), then the card. Phone and tablet.
const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  for (const [w, h, tag] of [[844, 390, 'phone'], [1180, 820, 'tablet']]) {
    const ctx = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.goto('http://localhost:8091/');
    await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
    await p.waitForTimeout(600);
    await p.click('[data-act=account]');
    await p.waitForTimeout(400);
    await p.fill('input[name=name]', 'tst' + tag.slice(0, 2) + (Date.now() % 1000));
    await p.fill('input[name=pw]', 'pw12345');
    await p.click('[data-act=in]');
    await p.waitForTimeout(700);
    if (await p.isVisible('[data-act=ok]')) await p.click('[data-act=ok]');
    await p.waitForTimeout(1500);
    await p.click('[data-act=account]');
    await p.waitForTimeout(900);
    await p.screenshot({ path: `shots/acct-${tag}.png` });
    await ctx.close();
  }
  await br.close();
})();
