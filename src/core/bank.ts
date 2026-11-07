/**
 * What a player keeps between plays (in this browser): root beer bottles banked, and every
 * nuggie ever eaten. A signed-in player's account keeps them too (see account.ts).
 */
const listeners = new Set<() => void>();
/** Something the account should save changed (root beer, nuggies, a level beaten). */
export function onProgress(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notifyProgress() {
  for (const fn of listeners) fn();
}

const num = (k: string) => {
  try {
    return Number(localStorage.getItem(k) ?? 0) || 0;
  } catch {
    return 0;
  }
};
const put = (k: string, v: number) => {
  try {
    localStorage.setItem(k, String(v));
  } catch {
    /* private mode */
  }
};

export const bank = {
  get rootbeer() {
    return num('puffy.rootbeer');
  },
  addRootbeer(n = 1) {
    put('puffy.rootbeer', this.rootbeer + n);
    notifyProgress();
  },
  /** Every nuggie eaten, ever. */
  get nuggies() {
    return num('puffy.nuggies');
  },
  addNuggie(n = 1) {
    put('puffy.nuggies', this.nuggies + n);
    notifyProgress();
  },
  /** (from the account, when it has more than this browser) */
  setAtLeast(rootbeer: number, nuggies: number) {
    if (rootbeer > this.rootbeer) put('puffy.rootbeer', rootbeer);
    if (nuggies > this.nuggies) put('puffy.nuggies', nuggies);
  },
};
