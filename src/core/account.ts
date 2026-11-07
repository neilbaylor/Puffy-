import { latestLevel, progress } from '../level/levels';
import { bank } from './bank';

/**
 * An optional account (you can always play without one): sign in with a name and a
 * password, and your root beer, nuggies and the level you're on are kept on the server
 * too, so they follow you to another phone or tablet (and how many bad guys you've
 * defeated). Signing in merges what this browser has with what the account has (the
 * bigger of each); after that it's saved at the end of each level, in the background.
 */
export interface AccountUser {
  name: string;
  rootbeer: number;
  nuggies: number;
  kills: number;
  level: number;
}

const TOKEN_KEY = 'puffy.token';
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
const local = () => ({ rootbeer: bank.rootbeer, nuggies: bank.nuggies, kills: bank.kills, level: latestLevel() });

/** Take the bigger of each (this browser vs. the account), then save that to the account. */
async function merge(u: AccountUser) {
  bank.setAtLeast(u.rootbeer, u.nuggies, u.kills);
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
  /** On start-up: still signed in from last time? Pick the account back up. */
  async restore() {
    if (!token) return;
    const r = await api('GET', '/api/me');
    if (r.ok) await merge(r.data.user as AccountUser);
    else if (r.status === 401) signedOut();
  },
  /**
   * Sign in (or, with `create`, make a new player). `unknown`: there's no player by that
   * name yet (the game then offers to make one).
   */
  async signIn(name: string, password: string, create: boolean): Promise<{ error: string | null; unknown?: boolean }> {
    const r = await api('POST', create ? '/api/register' : '/api/login', { name: name.trim(), password });
    if (!r.ok) return { error: String(r.data.error ?? 'Something went wrong.'), unknown: !!r.data.unknown };
    saveToken(String(r.data.token));
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
    signedOut();
  },
};
