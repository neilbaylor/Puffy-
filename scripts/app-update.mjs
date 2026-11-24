// The app's self-update (src/core/appUpdate.ts): after every website build (`npm run build`, as
// Railway runs on each deploy), writes dist/app/latest.json: this game's version, the oldest app
// shell it runs in (NEEDS_NATIVE, src/core/updatePick.ts) and each of its files with a fingerprint
// (sha256) and size. The files themselves are the website's own, served as they always are; the app
// downloads only the ones it hasn't got (the songs, ~10 MB, hardly ever change).
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const version = /VERSION\s*=\s*'([^']+)'/.exec(readFileSync('src/version.ts', 'utf8'))?.[1];
const minNative = Number(/NEEDS_NATIVE\s*=\s*(\d+)/.exec(readFileSync('src/core/updatePick.ts', 'utf8'))?.[1]);
if (!version || !minNative) throw new Error('app-update: VERSION or NEEDS_NATIVE not found');

const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(relative(DIST, p).split(sep).join('/'));
  }
};
walk(DIST);
// (not the website's offline helper, which the app doesn't use; nor this file's own folder)
const list = files
  .filter((f) => f !== 'sw.js' && !f.startsWith('app/') && !f.endsWith('.map'))
  .sort()
  .map((path) => {
    const body = readFileSync(join(DIST, path));
    return { path, sha256: createHash('sha256').update(body).digest('hex'), size: body.length };
  });
mkdirSync(join(DIST, 'app'), { recursive: true });
writeFileSync(join(DIST, 'app', 'latest.json'), JSON.stringify({ version, minNative, files: list }));
const mb = (n) => (n / 1e6).toFixed(1);
console.log(`app update: v${version}, ${list.length} files, ${mb(list.reduce((n, f) => n + f.size, 0))} MB in all -> dist/app/latest.json`);
