// Tiny static server for the built game (dist/), plus the online battle server.
// Used by Railway: `npm start`. Gzips text files once and caches them in memory.
//
// Caching: every file has an ETag (a fingerprint of its contents, worked out once when it's read into
// memory). The page, the app manifest, the icons and the offline helper (sw.js) are "no-cache":
// the browser asks every time, sending the fingerprint it has (If-None-Match), and gets a tiny
// "304 Not Modified" when nothing changed, or the new file when it did. So a new version shows on
// the very next load. The game's code, styles and music (under /assets/) have the fingerprint in
// their name and never change: the browser keeps those for a year without asking.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { brotliCompress, constants as zlibConst, gzipSync } from 'node:zlib';

// (Node's built-in SQLite, used for player accounts, is still labelled "experimental" and says so
// at start-up; it works fine, so that one warning is skipped to keep the logs clean)
const emitWarning = process.emitWarning;
process.emitWarning = (w, ...rest) => (/SQLite/.test(String(w?.message ?? w)) ? undefined : emitWarning.call(process, w, ...rest));

const ROOT = resolve('dist');
/**
 * The Phaser 4 trial: the game built on Phaser 4 (branch claude/phaser4-trial, `npm run build:p4`),
 * committed in trials/p4 and served at /p4/ beside the real game. Its songs and fonts are the very
 * same files as the real game's (same names), so any it hasn't got come from dist/assets.
 */
const TRIAL = resolve('trials/p4');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
};
const COMPRESS = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg']);
const cache = new Map();

async function load(path) {
  if (cache.has(path)) return cache.get(path);
  const body = await readFile(path);
  const ext = extname(path);
  // (one fingerprint of the file; each encoding gets its own ETag from it — "…", "…-gz", "…-br" —
  // since gzip and brotli are different bytes, as strong ETags must be)
  const hash = createHash('sha256').update(body).digest('base64url').slice(0, 27);
  const entry = { body, hash, gz: COMPRESS.has(ext) ? gzipSync(body) : null, br: null, type: TYPES[ext] ?? 'application/octet-stream' };
  cache.set(path, entry);
  // brotli as well (about a fifth smaller than gzip for the game's code: a quicker first load on
  // phones), made in the background at its best setting; gzip is served until it's ready
  if (entry.gz)
    brotliCompress(body, { params: { [zlibConst.BROTLI_PARAM_QUALITY]: 11, [zlibConst.BROTLI_PARAM_SIZE_HINT]: body.length } }, (err, out) => {
      if (!err) entry.br = out;
    });
  return entry;
}

// the user accounts API (/api/...), built from server/users.ts; its database is created on start-up if needed
let userApi = null;
try {
  const { createUserApi } = await import('./dist-server/users.mjs');
  userApi = await createUserApi();
} catch (e) {
  console.warn('User accounts not available:', e.message);
}

// the game's own files compressed straight away at start-up (not on the first visit)
try {
  const { readdir } = await import('node:fs/promises');
  for (const f of await readdir(join(ROOT, 'assets'))) if (COMPRESS.has(extname(f))) await load(join(ROOT, 'assets', f));
  await load(join(ROOT, 'index.html'));
} catch {
  /* (no build yet) */
}

/**
 * The ETag (of any encoding of this file) that the browser already has, from If-None-Match: it's
 * sent back with the 304, so the copy it keeps stays labelled as it was. Null: it has none of them.
 */
function alreadyHas(inm, hash) {
  if (!inm) return null;
  for (const raw of inm.split(',')) {
    const tag = raw.trim();
    if (tag === '*') return `"${hash}"`;
    // (If-None-Match compares weakly: a W/ prefix doesn't matter)
    if (tag.replace(/^W\//, '').replace(/-(?:gz|br)"$/, '"') === `"${hash}"`) return tag;
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    if (userApi && (await userApi(req, res))) return;
    const url = new URL(req.url ?? '/', 'http://x');
    let decoded;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      return void res.writeHead(400).end('Bad request');
    }
    if (decoded === '/p4') return void res.writeHead(301, { Location: '/p4/' }).end();
    let base = ROOT;
    let sub = decoded;
    if (decoded.startsWith('/p4/')) {
      sub = decoded.slice(3);
      const t = normalize(join(TRIAL, sub));
      // (its own files; any other address there is its page; a file it hasn't got, the real game's)
      if (t.startsWith(TRIAL + sep) && (await stat(t).catch(() => null))?.isFile()) base = TRIAL;
      else if (!extname(sub) && (await stat(join(TRIAL, 'index.html')).catch(() => null))) {
        base = TRIAL;
        sub = '/index.html';
      }
    }
    let path = normalize(join(base, sub));
    // (inside dist itself: a plain prefix check let ..%2f reach dist-server/ and the like)
    if (path !== base && !path.startsWith(base + sep)) return void res.writeHead(403).end();
    const info = await stat(path).catch(() => null);
    // a missing file (it has a file extension: an old build's /assets/ file, say) is a 404, not the
    // page in its place (a page labelled as a script or a song would break whatever asked for it,
    // and the offline helper would keep it); any other address is the game's page
    if (!info && extname(url.pathname)) return void res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-cache' }).end('Not found');
    if (!info || info.isDirectory()) path = join(info ? path : ROOT, 'index.html');
    const f = await load(path);
    const headers = {
      // hashed build assets can be cached forever; everything else (the page above all) is checked
      // with the server on every use: a 304 when it hasn't changed
      'Cache-Control': path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      // (gzip, brotli or neither, depending on what the browser takes)
      ...(f.gz ? { Vary: 'Accept-Encoding' } : {}),
    };
    const has = alreadyHas(req.headers['if-none-match'], f.hash);
    if (has) return void res.writeHead(304, { ...headers, ETag: has }).end();
    headers['Content-Type'] = f.type;
    const range = req.headers.range;
    const ifRange = req.headers['if-range'];
    if (range && f.type.startsWith('audio/') && (!ifRange || ifRange === `"${f.hash}"`)) {
      // audio seeking on iOS needs byte ranges ("bytes=a-b", "bytes=a-" or the last n: "bytes=-n")
      const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      const len = f.body.length;
      if (m && (m[1] || m[2])) {
        const start = m[1] ? Number(m[1]) : Math.max(0, len - Number(m[2]));
        const end = m[1] && m[2] ? Math.min(Number(m[2]), len - 1) : len - 1;
        if (start > end || start >= len) return void res.writeHead(416, { ...headers, 'Content-Range': `bytes */${len}` }).end();
        res.writeHead(206, { ...headers, ETag: `"${f.hash}"`, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${len}`, 'Content-Length': end - start + 1 });
        return void res.end(f.body.subarray(start, end + 1));
      }
    }
    const accept = req.headers['accept-encoding'] ?? '';
    if (f.br && /\bbr\b/.test(accept)) {
      res.writeHead(200, { ...headers, ETag: `"${f.hash}-br"`, 'Content-Encoding': 'br' });
      return void res.end(f.br);
    }
    if (f.gz && /\bgzip\b/.test(accept)) {
      res.writeHead(200, { ...headers, ETag: `"${f.hash}-gz"`, 'Content-Encoding': 'gzip' });
      return void res.end(f.gz);
    }
    res.writeHead(200, { ...headers, ETag: `"${f.hash}"`, 'Accept-Ranges': 'bytes' });
    res.end(f.body);
  } catch (e) {
    res.writeHead(500).end('Server error');
    console.error(e);
  }
});

// the online battle server (WebSockets at /battle), built from server/battle.ts
try {
  const { attachBattle } = await import('./dist-server/battle.mjs');
  attachBattle(server);
} catch (e) {
  console.warn('Battle server not available:', e.message);
}

server.listen(PORT, '0.0.0.0', () => console.log(`Puffy is being served on port ${PORT}`));

// (anything that slips through: log it and keep serving — a crash would freeze every battle)
process.on('uncaughtException', (e) => console.error('Uncaught:', e));
process.on('unhandledRejection', (e) => console.error('Unhandled:', e));

// Railway stops the old copy with SIGTERM on every deploy: finish cleanly (a plain exit, not a
// "command failed" in the logs)
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig}: shutting down`);
    server.close();
    process.exit(0);
  });
}
