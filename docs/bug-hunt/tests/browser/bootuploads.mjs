// usage: node bootuploads.mjs <port> -> every texture upload while the game loads: how many, how many pixels, and any canvas uploaded more than once (with where from)
import { chromium } from 'playwright';
const [port] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1');
  window.__ups = [];
  const seen = new WeakMap();
  let n = 0;
  for (const P of [WebGLRenderingContext.prototype, window.WebGL2RenderingContext?.prototype].filter(Boolean)) {
    for (const fn of ['texImage2D', 'texSubImage2D']) {
      const orig = P[fn];
      P[fn] = function (...a) {
        const src = a.find((x) => x && typeof x === 'object' && 'width' in x && 'height' in x && !(ArrayBuffer.isView(x)));
        if (src) {
          let id = seen.get(src);
          if (id === undefined) { id = n++; seen.set(src, id); }
          const st = (new Error().stack || '').split('\n').slice(2, 12).map((s) => s.trim().replace(/^at /, '').replace(/\s*\(?http[^)]*\/([^/]+):(\d+):\d+\)?/, '@$2')).join(' < ');
          window.__ups.push({ fn, id, w: src.width, h: src.height, t: Math.round(performance.now()), st });
        }
        return orig.apply(this, a);
      };
    }
  }
});
const p = await ctx.newPage();
await p.goto('http://localhost:' + port + '/');
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
await p.waitForTimeout(1500);
const ups = await p.evaluate(() => window.__ups);
const px = ups.reduce((s, u) => s + u.w * u.h, 0);
console.log('uploads:', ups.length, 'pixels (M):', (px / 1e6).toFixed(1));
const by = new Map();
for (const u of ups) { const a = by.get(u.id) || []; a.push(u); by.set(u.id, a); }
const dup = [...by.values()].filter((a) => a.length > 1 && a[0].w * a[0].h > 64 * 64);
const dupPx = dup.reduce((s, a) => s + (a.length - 1) * a[0].w * a[0].h, 0);
console.log('canvases uploaded more than once:', dup.length, 'extra pixels (M):', (dupPx / 1e6).toFixed(1));
for (const a of dup.sort((x, y) => (y.length - 1) * y[0].w * y[0].h - (x.length - 1) * x[0].w * x[0].h).slice(0, 12)) {
  console.log(a.length + 'x ' + a[0].w + 'x' + a[0].h);
  for (const u of a.slice(0, 3)) console.log('   ' + u.fn + ' t=' + u.t + ' ' + u.st.slice(0, 600));
}
await b.close();
