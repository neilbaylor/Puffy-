// Play Boss 6 through in full: win (hit every BITE!) or lose (never). args: port light win|lose tag [account]
// account: sign in as this name first (a tester: founder / neil) and start from the Bosses menu without puffy.dev.
const { chromium } = require('playwright');
const [port, light, mode, tag, acct] = [process.argv[2] || '8411', process.argv[3] || '0', process.argv[4] || 'win', process.argv[5] || 'p', process.argv[6] || ''];
const DIR = `shots/boss6/${tag}`;
require('fs').mkdirSync(DIR, { recursive: true });
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: false });
  await ctx.addInitScript(([lt, a]) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.clear(); localStorage.setItem('puffy.beaten', a ? '0' : '6'); if (!a) localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.hero', 'puffy'); localStorage.setItem('puffy.light', lt); } }, [light, acct]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  p.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|GL Driver/.test(t)) errs.push(m.type() + ': ' + t.slice(0, 200)); });
  await p.goto(`http://localhost:${port}/`);
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.waitForTimeout(800);
  if (acct) {
    await p.click('[data-act=account]');
    await p.fill('input[name=name]', acct);
    await p.fill('input[name=pw]', 'testpass1');
    await p.click('[data-act=in]');
    await p.waitForTimeout(1500);
    if (await p.isVisible('.acct-confirm')) { await p.click('[data-act=ok]'); await p.waitForTimeout(1500); }
    const done = await p.$('.acct-card [data-act=done], .acct-done-row button');
    if (done) await done.click().catch(() => {});
    await p.waitForTimeout(1500);
    console.log('signed in as', acct, '| parts:', await p.evaluate(() => [...document.querySelectorAll('.lvl[data-lvl]')].map((b) => b.textContent.trim()).join(', ')));
  }
  await p.click('[data-act=bosses]');
  await p.waitForTimeout(600);
  console.log('bosses:', await p.evaluate(() => [...document.querySelectorAll('[data-boss]')].map((b) => b.dataset.boss + ' ' + b.querySelector('b').textContent).join(' | ')));
  await p.screenshot({ path: `${DIR}/menu.png` });
  await p.click('[data-boss="6"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  const t0 = Date.now();
  // the player: taps each BITE! a moment after it shows (win), or never (lose)
  await p.evaluate((m) => {
    window.__bites = { up: 0, hit: 0 };
    let seen = null;
    setInterval(() => {
      const b = window.__fishing?.dom?.querySelector('.fsh-bite');
      if (!b || b.hidden) { seen = null; return; }
      if (seen === b.style.left + b.style.top) return;
      seen = b.style.left + b.style.top;
      window.__bites.up++;
      if (m !== 'win') return;
      setTimeout(() => {
        const r = b.getBoundingClientRect();
        b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: 'touch' }));
        window.__bites.hit++;
      }, 180);
    }, 20);
  }, mode);
  let i = 0;
  let ended = false;
  let last = 0;
  let shotLightning = false;
  while (Date.now() - t0 < 600000) {
    const st = await p.evaluate(() => ({
      callout: document.querySelector('.fsh-callout.show')?.textContent ?? '',
      modal: document.querySelector('.screen h2')?.textContent ?? '',
      score: window.__fishing?.score ? `${window.__fishing.score.hero.filter(Boolean).length}-${window.__fishing.score.king.filter(Boolean).length} (${window.__fishing.score.hero.length}/${window.__fishing.score.king.length})` : '',
      bite: !window.__fishing?.dom?.querySelector('.fsh-bite')?.hidden,
      flashing: !!window.__fishing?.storm?.flashing,
      biteSoon: !!window.__fishing?.biteSoon,
    })).catch(() => null);
    if (!st) break;
    if (st.flashing && st.bite) console.log('!! FLASH DURING BITE');
    if (st.flashing && !shotLightning) { shotLightning = true; await p.screenshot({ path: `${DIR}/lightning.png` }); }
    if (/YOU WIN|KING BOB WINS/.test(st.callout) && !ended) { ended = true; console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', st.callout, st.score); }
    if (st.modal) { console.log('result card:', st.modal); await p.waitForTimeout(800); await p.screenshot({ path: `${DIR}/zz-results.png` }); break; }
    const gap = ended ? 300 : 2500;
    if (Date.now() - last > gap) { last = Date.now(); await p.screenshot({ path: `${DIR}/${ended ? 'e' : 'c'}-${String(i++).padStart(3, '0')}.png` }); }
    await p.waitForTimeout(40);
  }
  console.log('bites', JSON.stringify(await p.evaluate(() => window.__bites).catch(() => null)), 'total', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  // back home
  const home = await p.$('[data-act=home]');
  if (home) { await home.click(); await p.waitForTimeout(3000); await p.screenshot({ path: `${DIR}/zz-home.png` }); console.log('home:', await p.evaluate(() => window.game.scene.isActive('Menu'))); }
  console.log(errs.join('\n') || 'no errors');
  await br.close();
})();
