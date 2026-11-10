/**
 * A very small user database: optional accounts (you can always play without one).
 * Each user has a name and a password, plus the progress the game keeps for them:
 * root beer bottles, nuggies eaten, bad guys defeated and the level they're on.
 *
 * Storage is SQLite (Node's built-in `node:sqlite`, nothing to compile), in a file that
 * is created on start-up if it isn't there yet. If that module isn't available (an older
 * Node), it falls back to a JSON file in the same folder. On Railway, put the file on a
 * volume (DB_PATH, or the volume's mount path) or it is wiped by each deploy.
 *
 * HTTP API (JSON), all under /api:
 *   POST /api/register  { name, password }            → 201 { token, user }
 *   POST /api/login     { name, password }            → { token, user } (404 { unknown: true } if no such player)
 *   GET  /api/me        (Authorization: Bearer token) → { user }
 *   PUT  /api/progress  (Bearer) { rootbeer, nuggies, kills, level, spent?, items?, wear? } → { user }
 *   POST /api/logout    (Bearer)                      → 204
 * where user = { name, rootbeer, nuggies, kills, level, spent, items, wear } (root beer is every bottle
 * ever found, spent what the Shop has had; items the Shop ids owned and wear the ones on, comma
 * separated — 'none' when everything's off, '' never chosen).
 *
 * What's been bought is a row each in user_items (user, item, equipped: whether it's on), so a
 * player keeps it whatever browser they play on. Things are never taken away once bought.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export interface PublicUser {
  name: string;
  rootbeer: number;
  nuggies: number;
  kills: number;
  level: number;
  /** Root beer spent in the Shop, what's been bought there (ids, comma separated), what's on ('none' nothing, '' never chosen). */
  spent: number;
  items: string;
  wear: string;
}

interface UserRow extends PublicUser {
  id: number;
  hash: string;
  salt: string;
}

/** Where the database lives: DB_PATH, else on a Railway volume if there is one, else ./data. */
export function dbPath() {
  if (process.env.DB_PATH) return resolve(process.env.DB_PATH);
  const vol = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  return resolve(vol ? join(vol, 'puffy.db') : join('data', 'puffy.db'));
}

/** The storage behind the API (SQLite, or the JSON-file fallback). */
interface Store {
  kind: string;
  byName(name: string): UserRow | undefined;
  create(name: string, hash: string, salt: string): UserRow;
  setProgress(id: number, p: Omit<PublicUser, 'name' | 'items' | 'wear'>): void;
  /** Add what's been bought (never removes any); `wear` (ids on, or none of them) sets each one's equipped flag, null leaves them. */
  setItems(id: number, items: string[], wear: string[] | null): void;
  byId(id: number): UserRow | undefined;
  addSession(tokenHash: string, userId: number): void;
  session(tokenHash: string): number | undefined;
  dropSession(tokenHash: string): void;
}

/** What's on, from each thing's equipped flag: the ids, 'none' if everything's off, '' if there's nothing. */
function wearOf(gear: { item: string; equipped: number | boolean }[]) {
  if (!gear.length) return '';
  return gear.filter((g) => g.equipped).map((g) => g.item).join(',') || 'none';
}

async function openSqlite(file: string): Promise<Store> {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(file);
  // the database is set up the first time (and on every start, harmlessly, if it already is)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      rootbeer INTEGER NOT NULL DEFAULT 0,
      nuggies INTEGER NOT NULL DEFAULT 0,
      kills INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      spent INTEGER NOT NULL DEFAULT 0,
      items TEXT NOT NULL DEFAULT '',
      hat TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_items (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item TEXT NOT NULL,
      equipped INTEGER NOT NULL DEFAULT 0,
      bought_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, item)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // (a database made before a column existed gets it added)
  const cols = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('kills')) db.exec('ALTER TABLE users ADD COLUMN kills INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('spent')) db.exec('ALTER TABLE users ADD COLUMN spent INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('items')) db.exec("ALTER TABLE users ADD COLUMN items TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('hat')) db.exec("ALTER TABLE users ADD COLUMN hat TEXT NOT NULL DEFAULT ''");
  // (v0.220 kept them as a list on the user, and the hat worn: moved into user_items once)
  if ((db.prepare('SELECT COUNT(*) AS n FROM user_items').get() as { n: number }).n === 0) {
    const add = db.prepare('INSERT OR IGNORE INTO user_items (user_id, item, equipped) VALUES (?, ?, ?)');
    for (const u of db.prepare("SELECT id, items, hat FROM users WHERE items != ''").all() as { id: number; items: string; hat: string }[])
      for (const it of u.items.split(',').filter(Boolean)) add.run(u.id, it, u.hat.split(',').includes(it) ? 1 : 0);
  }
  const q = {
    byName: db.prepare('SELECT id, name, hash, salt, rootbeer, nuggies, kills, level, spent FROM users WHERE name = ? COLLATE NOCASE'),
    byId: db.prepare('SELECT id, name, hash, salt, rootbeer, nuggies, kills, level, spent FROM users WHERE id = ?'),
    items: db.prepare('SELECT item, equipped FROM user_items WHERE user_id = ? ORDER BY bought_at, item'),
    addItem: db.prepare('INSERT OR IGNORE INTO user_items (user_id, item) VALUES (?, ?)'),
    equip: db.prepare('UPDATE user_items SET equipped = ? WHERE user_id = ? AND item = ?'),
    create: db.prepare('INSERT INTO users (name, hash, salt) VALUES (?, ?, ?)'),
    progress: db.prepare("UPDATE users SET rootbeer = ?, nuggies = ?, kills = ?, level = ?, spent = ?, updated_at = datetime('now') WHERE id = ?"),
    addSession: db.prepare('INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)'),
    session: db.prepare('SELECT user_id FROM sessions WHERE token_hash = ?'),
    dropSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  };
  const row = (r: unknown) => {
    if (!r) return undefined;
    const u = { ...(r as UserRow) };
    const its = q.items.all(u.id) as { item: string; equipped: number }[];
    u.items = its.map((i) => i.item).join(',');
    u.wear = wearOf(its);
    return u;
  };
  return {
    kind: `SQLite (${file})`,
    byName: (name) => row(q.byName.get(name)),
    byId: (id) => row(q.byId.get(id)),
    create: (name, hash, salt) => {
      const r = q.create.run(name, hash, salt);
      return row(q.byId.get(Number(r.lastInsertRowid)))!;
    },
    setProgress: (id, p) => void q.progress.run(p.rootbeer, p.nuggies, p.kills, p.level, p.spent, id),
    setItems: (id, items, wear) => {
      for (const it of items) q.addItem.run(id, it);
      if (wear) for (const { item } of q.items.all(id) as { item: string }[]) q.equip.run(wear.includes(item) ? 1 : 0, id, item);
    },
    addSession: (t, id) => void q.addSession.run(t, id),
    session: (t) => (q.session.get(t) as { user_id: number } | undefined)?.user_id,
    dropSession: (t) => void q.dropSession.run(t),
  };
}

/** The fallback: everything in one small JSON file, written (atomically) on every change. */
function openJson(file: string): Store {
  type Row = Omit<UserRow, 'items' | 'wear'> & { gear?: { item: string; equipped: boolean }[]; items?: string; hat?: string };
  type Data = { next: number; users: Row[]; sessions: Record<string, number> };
  let data: Data = { next: 1, users: [], sessions: {} };
  if (existsSync(file)) data = JSON.parse(readFileSync(file, 'utf8')) as Data;
  for (const u of data.users) {
    u.kills ??= 0;
    u.spent ??= 0;
    // (v0.220: a list, and the hat worn)
    if (!u.gear) u.gear = (u.items ?? '').split(',').filter(Boolean).map((item) => ({ item, equipped: (u.hat ?? '').split(',').includes(item) }));
    delete u.items;
    delete u.hat;
  }
  const out = (u: Row | undefined): UserRow | undefined => {
    if (!u) return undefined;
    const { gear = [], ...rest } = u;
    return { ...rest, items: gear.map((g) => g.item).join(','), wear: wearOf(gear) };
  };
  const save = () => {
    writeFileSync(file + '.tmp', JSON.stringify(data));
    renameSync(file + '.tmp', file);
  };
  save();
  return {
    kind: `JSON file (${file})`,
    byName: (name) => out(data.users.find((u) => u.name.toLowerCase() === name.toLowerCase())),
    byId: (id) => out(data.users.find((u) => u.id === id)),
    create: (name, hash, salt) => {
      const u: Row = { id: data.next++, name, hash, salt, rootbeer: 0, nuggies: 0, kills: 0, level: 1, spent: 0, gear: [] };
      data.users.push(u);
      save();
      return out(u)!;
    },
    setProgress: (id, p) => {
      const u = data.users.find((x) => x.id === id);
      if (u) Object.assign(u, p);
      save();
    },
    setItems: (id, items, wear) => {
      const u = data.users.find((x) => x.id === id);
      if (!u) return;
      const gear = (u.gear ??= []);
      for (const item of items) if (!gear.some((g) => g.item === item)) gear.push({ item, equipped: false });
      if (wear) for (const g of gear) g.equipped = wear.includes(g.item);
      save();
    },
    addSession: (t, id) => {
      data.sessions[t] = id;
      save();
    },
    session: (t) => data.sessions[t],
    dropSession: (t) => {
      delete data.sessions[t];
      save();
    },
  };
}

export async function openStore(file = dbPath()): Promise<Store> {
  mkdirSync(dirname(file), { recursive: true });
  try {
    return await openSqlite(file);
  } catch (e) {
    console.warn('SQLite not available, using a JSON file for users:', (e as Error).message);
    return openJson(file.replace(/\.db$/, '') + '.json');
  }
}

// ───────────────────────────────────────────── the API ──

/** Names: 2–16 letters, numbers, spaces, - or _ (the game itself caps them at 10). */
const NAME_RE = /^[A-Za-z0-9 _-]{2,16}$/;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const pub = (u: UserRow): PublicUser => ({ name: u.name, rootbeer: u.rootbeer, nuggies: u.nuggies, kills: u.kills, level: u.level, spent: u.spent ?? 0, items: u.items ?? '', wear: u.wear ?? '' });
/** Shop ids (lower case, digits, dashes), comma separated: anything else is dropped. */
const ids = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .split(',')
        .filter((x) => /^[a-z0-9-]{1,20}$/.test(x))
        .slice(0, max)
        .join(',')
    : '';
const int = (v: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

async function hashPassword(pw: string, salt: Buffer) {
  return (await scryptAsync(pw, salt, 32)).toString('hex');
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((ok, fail) => {
    let size = 0;
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 4096) {
        fail(new Error('too big'));
        req.destroy();
      } else parts.push(c);
    });
    req.on('end', () => {
      try {
        const v = JSON.parse(Buffer.concat(parts).toString('utf8') || '{}');
        ok(v && typeof v === 'object' ? v : {});
      } catch {
        fail(new Error('bad json'));
      }
    });
    req.on('error', fail);
  });
}

/** A few tries a minute per address at signing in (stops someone guessing passwords). */
const attempts = new Map<string, { n: number; at: number }>();
function tooMany(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now - a.at > 60_000) {
    attempts.set(ip, { n: 1, at: now });
    return false;
  }
  a.n++;
  return a.n > 12;
}

/** Make the /api handler (returns true if it handled the request). */
export async function createUserApi() {
  const store = await openStore();
  console.log(`User database: ${store.kind}`);

  const userFrom = (req: IncomingMessage) => {
    const m = /^Bearer ([A-Za-z0-9_-]{20,})$/.exec(req.headers.authorization ?? '');
    if (!m) return undefined;
    const id = store.session(sha(m[1]));
    return id === undefined ? undefined : store.byId(id);
  };
  const newSession = (u: UserRow) => {
    const token = randomBytes(32).toString('base64url');
    store.addSession(sha(token), u.id);
    return token;
  };

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/api/')) return false;
    const route = `${req.method} ${url.pathname}`;
    try {
      if (route === 'POST /api/register' || route === 'POST /api/login') {
        const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
        if (tooMany(ip)) return void send(res, 429, { error: 'Too many tries. Wait a minute.' }), true;
        const body = await readBody(req);
        const name = String(body.name ?? '').trim();
        const password = String(body.password ?? '');
        if (!NAME_RE.test(name)) return void send(res, 400, { error: 'Names are letters, numbers, spaces, - or _.' }), true;
        if (password.length < 4 || password.length > 64) return void send(res, 400, { error: 'Passwords are 4–64 characters.' }), true;
        if (route === 'POST /api/register') {
          if (store.byName(name)) return void send(res, 409, { error: 'That name is taken.' }), true;
          const salt = randomBytes(16);
          const u = store.create(name, await hashPassword(password, salt), salt.toString('hex'));
          return void send(res, 201, { token: newSession(u), user: pub(u) }), true;
        }
        const u = store.byName(name);
        // (no player by that name: the game offers to make one)
        if (!u) return void send(res, 404, { error: 'No player with that name yet.', unknown: true }), true;
        const hash = Buffer.from(await hashPassword(password, Buffer.from(u.salt, 'hex')), 'hex');
        if (!timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) return void send(res, 401, { error: 'Wrong password.' }), true;
        return void send(res, 200, { token: newSession(u), user: pub(u) }), true;
      }
      if (route === 'GET /api/me') {
        const u = userFrom(req);
        return void (u ? send(res, 200, { user: pub(u) }) : send(res, 401, { error: 'Not signed in.' })), true;
      }
      if (route === 'PUT /api/progress') {
        const u = userFrom(req);
        if (!u) return void send(res, 401, { error: 'Not signed in.' }), true;
        const body = await readBody(req);
        const p = {
          rootbeer: int(body.rootbeer, 0, 1_000_000),
          nuggies: int(body.nuggies, 0, 10_000_000),
          kills: int(body.kills, 0, 10_000_000),
          level: int(body.level, 1, 99),
          // (an older game that doesn't send these keeps what the account has)
          spent: body.spent === undefined ? (u.spent ?? 0) : int(body.spent, 0, 1_000_000),
        };
        store.setProgress(u.id, p);
        // what's been bought, and what's on ('' not chosen yet: leave it; v0.220 sent just a hat)
        const wear = body.wear !== undefined ? String(body.wear) : body.hat !== undefined ? String(body.hat) : '';
        store.setItems(u.id, ids(body.items, 50).split(',').filter(Boolean), wear ? ids(wear, 10).split(',').filter((x) => x && x !== 'none') : null);
        return void send(res, 200, { user: pub(store.byId(u.id)!) }), true;
      }
      if (route === 'POST /api/logout') {
        const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
        if (m) store.dropSession(sha(m[1]));
        return void send(res, 204), true;
      }
      send(res, 404, { error: 'Not found.' });
      return true;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'too big' || msg === 'bad json') send(res, 400, { error: 'Bad request.' });
      else {
        console.error(e);
        send(res, 500, { error: 'Server error.' });
      }
      return true;
    }
  };
}
