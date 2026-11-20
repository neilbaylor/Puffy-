// usage: node drop.mjs <port>  -> Part 4: the hero dropped in at the top of the longer parachute drop; after it floats
// down, how many blasters are left showing with no Plop holding them (frozen in the air)?
import { chromium } from 'playwright';
const [port] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1'); });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`http://localhost:${port}/`);
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
await p.evaluate(() => { const el = document.querySelector('.lvl[data-lvl="4"]'); el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el?.click(); });
await p.waitForTimeout(1500);
await p.evaluate(() => document.querySelector('[data-act=play]').click());
await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 300000 });
await p.evaluate(() => window.game.events.emit('skip-intro'));
await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 120000 });
const drop = await p.evaluate(() => {
  const g = window.game.scene.getScene('Game');
  const d = [...g.chuteDrops].sort((a, b) => b.floor - b.top - (a.floor - a.top))[0];
  const pl = g.players[0];
  pl.invulnUntil = 1e15;
  pl.input = { ...pl.input, id: 'bot', poll: () => ({ left: false, right: false, jump: false, fire: false, run: false, bomb: false }) };
  pl.body.reset((d.x0 + d.x1) / 2, d.top + 40);
  pl.body.setVelocity(0, 200);
  return { x0: d.x0, x1: d.x1, top: d.top, floor: d.floor, n: d.n };
});
await p.waitForTimeout(30000);
const r = await p.evaluate(() => {
  const g = window.game.scene.getScene('Game');
  const held = new Set();
  for (const e of g.enemies) if (e.active && e.weapon) held.add(e.weapon.img);
  const loose = g.children.list.filter((o) => o.texture?.key === 'w-blaster' && o.visible && o.alpha > 0.05 && !held.has(o) && !g.tweens.isTweening(o));
  const pl = g.players[0];
  return { heroY: Math.round(pl.y), landed: !pl.chute, plopsPassed: g.dropPlops.length, blastersNobodyHolds: loose.length, at: loose.slice(0, 4).map((o) => [Math.round(o.x), Math.round(o.y)]) };
});
console.log(JSON.stringify({ drop, ...r, errs }));
await b.close();
