import { bank } from './bank';

/**
 * The Shop's things (bought with root beer) and what your hero is wearing. Whatever you own,
 * any hero can wear: it's yours, not one hero's. Kept in this browser, and on your account
 * when you're signed in (see account.ts): what you own is merged, the hat you last put on wins.
 */
export interface ShopItem {
  id: string;
  kind: 'hat';
  name: string;
  /** In root beer. */
  price: number;
  blurb: string;
}

export const SHOP: ShopItem[] = [{ id: 'party', kind: 'hat', name: 'Party Hat', price: 10, blurb: 'A stripy birthday-party hat with a fluffy pom-pom on top.' }];

const known = (id: string) => SHOP.some((i) => i.id === id);
const OWNED = 'puffy.items';
const HAT = 'puffy.hat';
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

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const wardrobe = {
  /** What you own (item ids). */
  get owned(): string[] {
    return read(OWNED)
      .split(',')
      .filter((id) => id && known(id));
  },
  owns(id: string) {
    return this.owned.includes(id);
  },
  /** The hat your hero's wearing (null: none). */
  get hat(): string | null {
    const h = read(HAT);
    return h && h !== 'none' && this.owns(h) ? h : null;
  },
  /** What's stored for the hat ('' never chosen, 'none' taken off, else an id): what the account keeps. */
  get hatChoice() {
    return read(HAT);
  },
  /** Buy it (if you've the root beer). */
  buy(id: string): boolean {
    const item = SHOP.find((i) => i.id === id);
    if (!item || this.owns(id) || !bank.spend(item.price)) return false;
    write(OWNED, [...this.owned, id].join(','));
    emit();
    return true;
  },
  /** Put a hat on (or take it off: null). */
  wear(id: string | null) {
    if (id !== null && !this.owns(id)) return;
    if ((this.hat ?? null) === id) return;
    write(HAT, id ?? 'none');
    emit();
  },
  /** (from the account) add what it owns; take its hat if you're not wearing one */
  merge(items: string, hat: string) {
    const all = new Set([...this.owned, ...items.split(',').filter((id) => id && known(id))]);
    const before = this.owned.join(',') + '|' + (this.hat ?? '');
    write(OWNED, [...all].join(','));
    if (!read(HAT) && (hat === 'none' || (known(hat) && all.has(hat)))) write(HAT, hat);
    if (this.owned.join(',') + '|' + (this.hat ?? '') !== before) emit();
  },
  /** What you're wearing or own changed. */
  onChange(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
