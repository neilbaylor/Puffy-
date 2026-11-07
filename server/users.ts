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
 *   POST /api/login     { name, password }            → { token, user }
 *   GET  /api/me        (Authorization: Bearer token) → { user }
 *   PUT  /api/progress  (Bearer) { rootbeer, nuggies, kills, level } → { user }
 *   POST /api/logout    (Bearer)                      → 204
 * where user = { name, rootbeer, nuggies, kills, level }.
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
  setProgress(id: number, p: Omit<PublicUser, 'name'>): void;
  byId(id: number): UserRow | undefined;
  addSession(tokenHash: string, userId: number): void;
  session(tokenHash: string): number | undefined;
  dropSession(tokenHash: string): void;
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  const q = {
    byName: db.prepare('SELECT id, name, hash, salt, rootbeer, nuggies, kills, level FROM users WHERE name = ? COLLATE NOCASE'),
    byId: db.prepare('SELECT id, name, hash, salt, rootbeer, nuggies, kills, level FROM users WHERE id = ?'),
    create: db.prepare('INSERT INTO users (name, hash, salt) VALUES (?, ?, ?)'),
    progress: db.prepare("UPDATE users SET rootbeer = ?, nuggies = ?, kills = ?, level = ?, updated_at = datetime('now') WHERE id = ?"),
    addSession: db.prepare('INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)'),
    session: db.prepare('SELECT user_id FROM sessions WHERE token_hash = ?'),
    dropSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  };
  const row = (r: unknown) => (r ? ({ ...(r as UserRow) } as UserRow) : undefined);
  return {
    kind: `SQLite (${file})`,
    byName: (name) => row(q.byName.get(name)),
    byId: (id) => row(q.byId.get(id)),
    create: (name, hash, salt) => {
      const r = q.create.run(name, hash, salt);
      return row(q.byId.get(Number(r.lastInsertRowid)))!;
    },
    setProgress: (id, p) => void q.progress.run(p.rootbeer, p.nuggies, p.kills, p.level, id),
    addSession: (t, id) => void q.addSession.run(t, id),
    session: (t) => (q.session.get(t) as { user_id: number } | undefined)?.user_id,
    dropSession: (t) => void q.dropSession.run(t),
  };
}

/** The fallback: everything in one small JSON file, written (atomically) on every change. */
function openJson(file: string): Store {
  type Data = { next: number; users: UserRow[]; sessions: Record<string, number> };
  let data: Data = { next: 1, users: [], sessions: {} };
  if (existsSync(file)) data = JSON.parse(readFileSync(file, 'utf8')) as Data;
  for (const u of data.users) u.kills ??= 0;
  const save = () => {
    writeFileSync(file + '.tmp', JSON.stringify(data));
    renameSync(file + '.tmp', file);
  };
  save();
  return {
    kind: `JSON file (${file})`,
    byName: (name) => data.users.find((u) => u.name.toLowerCase() === name.toLowerCase()),
    byId: (id) => data.users.find((u) => u.id === id),
    create: (name, hash, salt) => {
      const u: UserRow = { id: data.next++, name, hash, salt, rootbeer: 0, nuggies: 0, kills: 0, level: 1 };
      data.users.push(u);
      save();
      return u;
    },
    setProgress: (id, p) => {
      const u = data.users.find((x) => x.id === id);
      if (u) Object.assign(u, p);
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

const NAME_RE = /^[A-Za-z0-9 _-]{2,16}$/;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const pub = (u: UserRow): PublicUser => ({ name: u.name, rootbeer: u.rootbeer, nuggies: u.nuggies, kills: u.kills, level: u.level });
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
        if (!NAME_RE.test(name)) return void send(res, 400, { error: 'Names are 2–16 letters, numbers, spaces, - or _.' }), true;
        if (password.length < 4 || password.length > 64) return void send(res, 400, { error: 'Passwords are 4–64 characters.' }), true;
        if (route === 'POST /api/register') {
          if (store.byName(name)) return void send(res, 409, { error: 'That name is taken.' }), true;
          const salt = randomBytes(16);
          const u = store.create(name, await hashPassword(password, salt), salt.toString('hex'));
          return void send(res, 201, { token: newSession(u), user: pub(u) }), true;
        }
        const u = store.byName(name);
        // (the same amount of work whether or not the name exists)
        const salt = u ? Buffer.from(u.salt, 'hex') : randomBytes(16);
        const hash = Buffer.from(await hashPassword(password, salt), 'hex');
        if (!u || !timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) return void send(res, 401, { error: 'Wrong name or password.' }), true;
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
        const p = { rootbeer: int(body.rootbeer, 0, 1_000_000), nuggies: int(body.nuggies, 0, 10_000_000), kills: int(body.kills, 0, 10_000_000), level: int(body.level, 1, 99) };
        store.setProgress(u.id, p);
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
