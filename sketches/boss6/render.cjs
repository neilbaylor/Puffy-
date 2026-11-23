// Renders the Boss 6 concept sheets to PNGs: bundles main.ts, opens it in Chromium (no server),
// saves each sheet's canvas. Usage: node sketches/boss6/render.cjs <out dir> [sheet ...]
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const out = path.resolve(process.argv[2] || 'boss6-out');
const only = process.argv.slice(3);
const root = path.resolve(__dirname, '../..');
fs.mkdirSync(out, { recursive: true });
const js = path.join(out, 'boss6.js');
execFileSync(path.join(root, 'node_modules/.bin/esbuild'), [path.join(__dirname, 'main.ts'), '--bundle', '--format=iife', `--outfile=${js}`, '--log-level=warning'], { stdio: 'inherit' });
const html = path.join(out, 'boss6.html');
const font = (f) => 'file://' + path.join(root, 'src/assets/fonts', f);
fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: 'Lilita One'; src: url('${font('lilita-one-latin.woff2')}') format('woff2'); }
@font-face { font-family: 'Nunito'; font-weight: 200 1000; src: url('${font('nunito-latin.woff2')}') format('woff2'); }
body { margin: 0; background: #241a17; }</style><body><script src="boss6.js"></script>`);
(async () => {
  const br = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  try {
    for (const name of only.length ? only : ['boats', 'rain', 'announcer', 'kingbob-intro', 'ending']) {
      const p = await br.newPage({ viewport: { width: 1000, height: 800 } });
      p.on('pageerror', (e) => console.error('page error', e.message));
      await p.goto('file://' + html + '#' + name);
      await p.waitForFunction(() => window.sheets, null, { timeout: 60000 });
      const data = await p.evaluate((n) => window.sheets[n], name);
      fs.writeFileSync(path.join(out, `boss6-${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
      console.log('wrote', `boss6-${name}.png`);
      await p.close();
    }
  } finally {
    await br.close();
  }
})();
