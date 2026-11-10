import { bank } from './bank';

/**
 * The Shop's things (bought with root beer) and what your hero has on. Whatever you own, any hero
 * can wear: it's yours, not one hero's. Each thing goes in a slot — on your head, over your eyes, or
 * under your feet — and you can have one on in each, all at once. Kept in this browser, and on your
 * account when you're signed in (see account.ts): what you own is merged, what's on follows your
 * last choice.
 */
export type GearSlot = 'head' | 'eyes' | 'ride';
export interface ShopItem {
  id: string;
  slot: GearSlot;
  name: string;
  /** In root beer. */
  price: number;
  blurb: string;
}

export const SHOP: ShopItem[] = [
  { id: 'party', slot: 'head', name: 'Party Hat', price: 10, blurb: 'A stripy birthday-party hat with a fluffy pom-pom on top.' },
  { id: 'frogskins', slot: 'eyes', name: 'Sunglasses', price: 8, blurb: 'Chunky black frames with orange lenses. Very cool.' },
  { id: 'board', slot: 'ride', name: 'Skateboard', price: 15, blurb: 'Ride everywhere on it — and every jump’s an ollie.' },
];

const item = (id: string) => SHOP.find((i) => i.id === id);

/** What a set of things on ('party,board', '' for nothing) puts where. */
export function gearOf(wear: string | null | undefined): Partial<Record<GearSlot, string>> {
  const out: Partial<Record<GearSlot, string>> = {};
  for (const id of (wear ?? '').split(',')) {
    const it = item(id);
    if (it && !out[it.slot]) out[it.slot] = it.id;
  }
  return out;
}

const OWNED = 'puffy.items';
const WEAR = 'puffy.wear';
const read = (k: string) => {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};
// (v0.220 kept just a hat: carry it over)
try {
  const old = localStorage.getItem('puffy.hat');
  if (old !== null && localStorage.getItem(WEAR) === null) localStorage.setItem(WEAR, old);
  if (old !== null) localStorage.removeItem('puffy.hat');
} catch {
  /* private mode */
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const wardrobe = {
  /** What you own (item ids). */
  get owned(): string[] {
    return read(OWNED)
      .split(',')
      .filter((id) => id && item(id));
  },
  owns(id: string) {
    return this.owned.includes(id);
  },
  /** What's on (ids you own; one per slot). */
  get equipped(): string[] {
    const owned = this.owned;
    return Object.values(gearOf(read(WEAR).split(',').filter((id) => owned.includes(id)).join(',')));
  },
  /** Is it on? */
  isOn(id: string) {
    return this.equipped.includes(id);
  },
  /** What's on, as one string ('' nothing): how a hero's pictures are told what to draw. */
  get wearKey() {
    return [...this.equipped].sort().join(',');
  },
  /** What's stored ('' never chosen, 'none' everything off, else ids): what the account keeps. */
  get wearChoice() {
    return read(WEAR);
  },
  /** Buy it (if you've the root beer). */
  buy(id: string): boolean {
    const it = item(id);
    if (!it || this.owns(id) || !bank.spend(it.price)) return false;
    write(OWNED, [...this.owned, id].join(','));
    emit();
    return true;
  },
  /** Put it on (taking off whatever else was in its slot) or take it off. */
  wear(id: string, on: boolean) {
    const it = item(id);
    if (!it || !this.owns(id) || this.isOn(id) === on) return;
    const rest = this.equipped.filter((x) => item(x)?.slot !== it.slot);
    const next = on ? [...rest, id] : rest;
    write(WEAR, next.length ? next.join(',') : 'none');
    emit();
  },
  /** (from the account) add what it owns; take what it has on if nothing's been chosen here */
  merge(items: string, wear: string) {
    const before = this.owned.join(',') + '|' + this.wearKey;
    const all = new Set([...this.owned, ...items.split(',').filter((id) => item(id))]);
    write(OWNED, [...all].join(','));
    if (!read(WEAR) && wear) write(WEAR, wear);
    if (this.owned.join(',') + '|' + this.wearKey !== before) emit();
  },
  /** What you own or have on changed. */
  onChange(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
