/**
 * What a player keeps between plays (in this browser): root beer bottles banked, every
 * nuggie ever eaten and every bad guy ever defeated. A signed-in player's account keeps them too (see account.ts).
 */
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
  /** Every root beer bottle ever found (it only goes up: what's spent is counted separately). */
  get rootbeer() {
    return num('puffy.rootbeer');
  },
  /** Root beer spent in the Shop, ever (also only goes up). */
  get spent() {
    return num('puffy.spent');
  },
  /** Root beer you have to spend: found, less spent. */
  get rootbeerLeft() {
    return Math.max(0, this.rootbeer - this.spent);
  },
  /** Spend root beer (false if there isn't enough). */
  spend(n: number) {
    if (n > this.rootbeerLeft) return false;
    put('puffy.spent', this.spent + n);
    return true;
  },
  addRootbeer(n = 1) {
    put('puffy.rootbeer', this.rootbeer + n);
  },
  /** Every nuggie eaten, ever. */
  get nuggies() {
    return num('puffy.nuggies');
  },
  addNuggie(n = 1) {
    put('puffy.nuggies', this.nuggies + n);
  },
  /** Every bad guy defeated, ever. */
  get kills() {
    return num('puffy.kills');
  },
  addKill(n = 1) {
    put('puffy.kills', this.kills + n);
  },
  /** (from the account, when it has more than this browser) */
  setAtLeast(rootbeer: number, nuggies: number, kills: number, spent = 0) {
    if (rootbeer > this.rootbeer) put('puffy.rootbeer', rootbeer);
    if (spent > this.spent) put('puffy.spent', spent);
    if (nuggies > this.nuggies) put('puffy.nuggies', nuggies);
    if (kills > this.kills) put('puffy.kills', kills);
  },
};
