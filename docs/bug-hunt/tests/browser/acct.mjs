// usage: node acct.mjs <port> -> end to end with the real server: device A (all 5 Parts beaten, 50 root beer, the party hat)
// makes an account; device B, fresh, signs in. What does B get?
import { chromium } from 'playwright';
const [port] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const name = 'amy' + Math.floor(Math.random() * 1e4);
const signIn = async (p) => {
  await p.evaluate(() => document.querySelector('[data-act=account]').click());
  await p.waitForFunction(() => !!document.querySelector('.acct input[name=name]'));
  await p.fill('.acct input[name=name]', name);
  await p.fill('.acct input[name=pw]', 'secret1');
  await p.evaluate(() => document.querySelector('.acct [data-act=in]').click());
  // (no such player yet: OK makes one)

  await p.waitForFunction(() => !document.querySelector('.acct-confirm')?.hidden || !document.querySelector('.acct'), null, { timeout: 20000 });
  await p.evaluate(() => { const ok = document.querySelector('.acct-confirm:not([hidden]) [data-act=ok]'); if (ok) ok.click(); });

  await p.waitForFunction(() => !!localStorage.getItem('puffy.token') && !document.querySelector('.acct'), null, { timeout: 20000 });
  await p.waitForTimeout(1500);
};
const device = async (seed) => {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('puffy.light', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } }, seed);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${port}/`);
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  return p;
};
const A = await device({ 'puffy.beaten': '5', 'puffy.rootbeer': '50', 'puffy.spent': '20', 'puffy.items': 'party', 'puffy.wear': 'party' });
await signIn(A);
const B = await device({});
await signIn(B);
const got = await B.evaluate(() => ({ beaten: localStorage.getItem('puffy.beaten'), rootbeer: localStorage.getItem('puffy.rootbeer'), spent: localStorage.getItem('puffy.spent'), items: localStorage.getItem('puffy.items') }));
await B.evaluate(() => document.querySelector('.acct [data-act=back]')?.click());
await B.waitForTimeout(500);
await B.evaluate(() => document.querySelector('[data-act=bosses]')?.click());
await B.waitForTimeout(800);
const bosses = await B.evaluate(() => [...document.querySelectorAll('[data-boss]')].map((x) => x.querySelector('b').textContent));
console.log(JSON.stringify({ deviceB: got, bossesOnB: bosses }));
await b.close();
