// Which of Boss 6's storm layers cost what: frame gaps at 4x with groups of them hidden. args: port light
const { chromium } = require('playwright');
require('fs').mkdirSync('shots/boss6', { recursive: true });
const [port, light] = [process.argv[2] || '8411', process.argv[3] || '0'];
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--disable-gpu-vsync'] });
  const ctx = await br.newContext({ viewport: { width: 1024, height: 600 }, deviceScaleFactor: 1, hasTouch: true });
  const p = await ctx.newPage();
  await p.addInitScript((lt) => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.dev', '1'); localStorage.setItem('puffy.light', lt); }, light);
  await p.goto(`http://localhost:${port}/`);
  await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 300000 });
  await p.click('[data-act=bosses]'); await p.waitForTimeout(800); await p.click('[data-boss="6"]');
  await p.waitForFunction(() => window.__fishing?.scene?.isActive?.(), null, { timeout: 120000 });
  await p.waitForTimeout(2000);
  await p.evaluate(() => (window.__fishing.skipping = true));
  await p.waitForFunction(() => !window.__fishing.inIntro, null, { timeout: 60000 });
  // hold a line shot: freeze the contest (its waits never come due) and put the camera out over the water
  await p.evaluate((shot) => {
    const f = window.__fishing; f.waits = []; f.boltAt = Infinity; f.cam = shot === 'boat' ? { x: 1074 + 140, y: 520 - 210, zoom: 1.12 } : { x: 1900, y: 400, zoom: 0.8 }; f.camK = 30;
    const g = window.game; const L = g.loop; const orig = L.callback; window.__gap = []; let last = 0;
    L.callback = (t, d) => { const a = performance.now(); orig(t, d); if (last) window.__gap.push(a - last); last = a; };
  }, process.env.SHOT || '');
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const st = await p.evaluate(() => window.__fishing.storm);
  void st;
  const sets = {
    all: () => {},
    noRain: (s) => s.rain.forEach((r) => (r.ts.visible = false)),
    noClouds: (s) => s.bands.forEach((b) => (b.ts.visible = false)),
    noSwells: (s) => s.swells.forEach((b) => (b.ts.visible = false)),
    noSky: (s) => (s.sky.visible = false),
    noRain3img: (s) => { s.rain.forEach((r) => (r.ts.visible = false)); if (!window.__imgs) { const sc = window.__fishing; window.__imgs = [0, 1, 2].map(() => sc.add.image(0, 0, 'f6-rain-mid').setOrigin(0, 0).setScrollFactor(0).setDepth(7.7)); } const v = window.__fishing.cameras.main; window.__imgs.forEach((im) => im.setVisible(true).setDisplaySize(2000, 1400).setPosition(-400, -300)); },
    rain1ts: (s) => { window.__imgs?.forEach((im) => im.setVisible(false)); s.rain.forEach((r, i) => (r.ts.visible = i === 0)); },
  };
  for (const [name, fn] of Object.entries(sets).filter(([n]) => !process.env.ONLY || process.env.ONLY.split(',').includes(n))) {
    for (let rep = 0; rep < 2; rep++) {
      const r = await p.evaluate((src) => {
        const s = window.__fishing.storm;
        // (re-shown each time; then this set's hidden — and kept hidden each frame: the storm re-shows the rain)
        const hide = eval(src);
        window.__hide = () => hide(s);
        const up = s.update.bind(s); if (!s.__orig) { s.__orig = up; s.update = (dt) => { s.__orig(dt); window.__hide?.(); }; }
        s.rain.forEach((x) => (x.ts.visible = true)); s.bands.forEach((x) => (x.ts.visible = true)); s.swells.forEach((x) => (x.ts.visible = true)); s.sky.visible = true; window.__fishing.boat.visible = true; window.__fishing.waves.forEach((w) => (w.visible = true));
        return new Promise((res) => setTimeout(() => { window.__gap = []; setTimeout(() => { const a = [...window.__gap].sort((x, y) => x - y); res({ n: a.length, med: a[Math.floor(a.length / 2)], p90: a[Math.floor(a.length * 0.9)] }); }, 5000); }, 1500));
      }, fn.toString());
      console.log(`L${light} ${name.padEnd(9)} frames ${r.n} gap med ${r.med.toFixed(1)} p90 ${r.p90.toFixed(1)}`);
    }
  }
  await p.screenshot({ path: `shots/boss6/probe-L${light}.png` });
  await br.close();
})();
