/**
 * The app's self-update, the deciding part (no device needed: see core/appUpdate for the rest).
 *
 * Every website build writes app/latest.json (scripts/app-update.mjs): the game's version, the
 * oldest app shell it runs in, and each of its files with a fingerprint (sha256). The app takes a
 * newer version only; only files it hasn't got (by fingerprint) are downloaded, each one checked.
 */

/**
 * The oldest app shell (its NATIVE_VERSION: android/app/build.gradle) this game build runs in.
 * Raise it, and the NATIVE_VERSION, when the game starts needing something only a new app has (a
 * new plugin, say): app shells older than that keep the game they have until they're updated.
 */
export const NEEDS_NATIVE = 1;

export interface UpdateFile {
  path: string;
  sha256: string;
  size: number;
}
export interface UpdateManifest {
  version: string;
  minNative: number;
  files: UpdateFile[];
}

/** Is version `a` newer than `b`? (The game's versions are decimals: 0.391, 0.392, … 0.4 is newer than 0.391.) */
export function newer(a: string, b: string) {
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) && x > y;
}

const SHA = /^[0-9a-f]{64}$/;
/** A safe file path inside the bundle (no way out of it, nothing odd). */
const PATH = /^(?!.*\.\.)[\w.-]+(\/[\w.-]+)*$/;

/**
 * Whether to take this update: a well-formed manifest (with the page itself in it), a newer game
 * than the one running, one this app shell can run (`native`: its NATIVE_VERSION), and not the
 * version last tried (one that failed to start is not tried over and over).
 */
export function worthTaking(m: unknown, running: string, native: number, tried: string | null): m is UpdateManifest {
  if (!m || typeof m !== 'object') return false;
  const { version, minNative, files } = m as Partial<UpdateManifest>;
  if (typeof version !== 'string' || !Array.isArray(files)) return false;
  if (!files.every((f) => f && typeof f.path === 'string' && PATH.test(f.path) && typeof f.sha256 === 'string' && SHA.test(f.sha256))) return false;
  if (!files.some((f) => f.path === 'index.html')) return false;
  if (!newer(version, running) || version === tried) return false;
  return (Number(minNative) || 1) <= native;
}
