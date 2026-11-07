// Tiny static server for the built game (dist/), plus the online battle server.
// Used by Railway: `npm start`. Gzips text files once and caches them in memory.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = resolve('dist');
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
  const entry = { body, gz: COMPRESS.has(ext) ? gzipSync(body) : null, type: TYPES[ext] ?? 'application/octet-stream' };
  cache.set(path, entry);
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

const server = createServer(async (req, res) => {
  try {
    if (userApi && (await userApi(req, res))) return;
    const url = new URL(req.url ?? '/', 'http://x');
    let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!path.startsWith(ROOT)) return void res.writeHead(403).end();
    const info = await stat(path).catch(() => null);
    if (!info || info.isDirectory()) path = join(info ? path : ROOT, 'index.html');
    const f = await load(path);
    const headers = {
      'Content-Type': f.type,
      // hashed build assets can be cached forever; the page itself should always be fresh
      'Cache-Control': path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    const range = req.headers.range;
    if (range && f.type.startsWith('audio/')) {
      // audio seeking on iOS needs byte ranges
      const [a, b] = range.replace('bytes=', '').split('-');
      const start = Number(a) || 0;
      const end = b ? Number(b) : f.body.length - 1;
      res.writeHead(206, { ...headers, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${f.body.length}`, 'Content-Length': end - start + 1 });
      return void res.end(f.body.subarray(start, end + 1));
    }
    if (f.gz && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      return void res.end(f.gz);
    }
    res.writeHead(200, { ...headers, 'Accept-Ranges': 'bytes' });
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
