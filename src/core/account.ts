import { latestLevel, progress } from '../level/levels';
import { bank } from './bank';
import { wardrobe } from './wardrobe';

/**
 * An optional account (you can always play without one): sign in with a name and a
 * password, and your root beer, nuggies and the level you're on are kept on the server
 * too, so they follow you to another phone or tablet (and how many bad guys you've
 * defeated). Signing in merges what this browser has with what the account has (the
 * bigger of each); after that it's saved at the end of each level, in the background.
 * The name and password are kept on this device, so it signs you back in by itself.
 */
export interface AccountUser {
  name: string;
  rootbeer: number;
  nuggies: number;
  kills: number;
  level: number;
  /** Root beer spent in the Shop; what you own there (ids, comma separated); what you've on ('' never chosen, 'none' nothing). */
  spent?: number;
  items?: string;
  wear?: string;
}

const TOKEN_KEY = 'puffy.token';
/** The name and password last signed in with (kept on this device, to sign straight back in). */
const CREDS_KEY = 'puffy.account';
function savedCreds(): { name: string; password: string } | null {
  try {
    const v = JSON.parse(localStorage.getItem(CREDS_KEY) ?? 'null');
    return v && typeof v.name === 'string' && typeof v.password === 'string' ? v : null;
  } catch {
    return null;
  }
}
function saveCreds(c: { name: string; password: string } | null) {
  try {
    if (c) localStorage.setItem(CREDS_KEY, JSON.stringify(c));
    else localStorage.removeItem(CREDS_KEY);
  } catch {
    /* private mode */
  }
}
let token: string | null = (() => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
})();
let user: AccountUser | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function saveToken(t: string | null) {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode */
  }
}

async function api(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const r = await fetch(path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = r.status === 204 ? {} : ((await r.json().catch(() => ({}))) as Record<string, unknown>);
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Can’t reach the server.' } };
  }
}

/** This browser's progress, as the account keeps it. */
const local = () => ({ rootbeer: bank.rootbeer, nuggies: bank.nuggies, kills: bank.kills, level: latestLevel(), spent: bank.spent, items: wardrobe.owned.join(','), wear: wardrobe.wearChoice });

/** Take the bigger of each (this browser vs. the account), then save that to the account. */
async function merge(u: AccountUser) {
  bank.setAtLeast(u.rootbeer, u.nuggies, u.kills, u.spent ?? 0);
  wardrobe.merge(u.items ?? '', u.wear ?? '');
  if (u.level - 1 > progress.beaten) progress.markBeaten(u.level - 1);
  user = u;
  await push();
}

async function push() {
  if (!token) return;
  const r = await api('PUT', '/api/progress', local());
  if (r.ok) user = r.data.user as AccountUser;
  else if (r.status === 401) signedOut();
  emit();
}

function signedOut() {
  saveToken(null);
  user = null;
  emit();
}

export const account = {
  get user() {
    return user;
  },
  get signedIn() {
    return !!token && !!user;
  },
  /** Something about the account changed (signed in or out, progress saved). */
  onChange(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /**
   * On start-up: signed in before? Sign straight back in — with the session from last time,
   * or else with the name and password kept on this device (and if that player isn't on
   * the server any more, it's made again with them).
   */
  async restore() {
    if (token) {
      const r = await api('GET', '/api/me');
      if (r.ok) return merge(r.data.user as AccountUser);
      if (r.status !== 401) return; // (offline: try again next time)
      saveToken(null);
    }
    const c = savedCreds();
    if (!c) return;
    let r = await api('POST', '/api/login', c);
    if (!r.ok && r.data.unknown) r = await api('POST', '/api/register', c);
    if (!r.ok) {
      if (r.status === 401) saveCreds(null); // (the password changed somewhere else)
      emit();
      return;
    }
    saveToken(String(r.data.token));
    await merge(r.data.user as AccountUser);
  },
  /**
   * Sign in (or, with `create`, make a new player). `unknown`: there's no player by that
   * name yet (the game then offers to make one).
   */
  async signIn(name: string, password: string, create: boolean): Promise<{ error: string | null; unknown?: boolean }> {
    const r = await api('POST', create ? '/api/register' : '/api/login', { name: name.trim(), password });
    if (!r.ok) return { error: String(r.data.error ?? 'Something went wrong.'), unknown: !!r.data.unknown };
    saveToken(String(r.data.token));
    saveCreds({ name: name.trim(), password });
    await merge(r.data.user as AccountUser);
    return { error: null };
  },
  /**
   * Save this browser's progress to the account (at the end of a level, while the results
   * are up): in the background, never holding anything up, and any error is ignored.
   */
  save() {
    if (!token) return;
    push().catch(() => {});
  },
  async signOut() {
    if (token) await api('POST', '/api/logout');
    saveCreds(null);
    signedOut();
  },
};
