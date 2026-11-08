import { VERSION } from '../version';

/**
 * A lower drawing resolution for gameplay, found when the device couldn't keep up (see watchSpeed
 * in main.ts). Remembered for the version it was measured on only: each new version (usually
 * smoother) gets a fresh look. Stored as "<cap>@<version>".
 */
const RES_KEY = 'puffy.res';

/** The remembered gameplay cap (e.g. 1.25), or 0 for none. */
export function savedResCap(): number {
  try {
    const [cap, ver] = (localStorage.getItem(RES_KEY) ?? '').split('@');
    if (Number(cap) && ver === VERSION) return Number(cap);
  } catch {
    /* private mode */
  }
  return 0;
}

export function saveResCap(cap: number) {
  try {
    localStorage.setItem(RES_KEY, `${cap}@${VERSION}`);
  } catch {
    /* private mode */
  }
}
