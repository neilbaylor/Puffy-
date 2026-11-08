import type { LevelData } from './builder';
import { buildLevel1 } from './level1';
import { buildLevel2 } from './level2';
import { buildLevel3 } from './level3';
import { buildLevel4 } from './level4';

export interface LevelInfo {
  /** 1-based level number. */
  id: number;
  /** Which world it's in ("World 1"; World 2 — Plop Invasion — is coming). */
  world: string;
  title: string;
  part: string;
  /** null = not built yet ("coming soon"). */
  build: (() => LevelData) | null;
  /** Ends with a basketball game against King Puff Ball (otherwise the gate ends the level). */
  hoops?: boolean;
  /** Ends with a wrestling match against Queen Plop in the Poo Palace. */
  wrestle?: boolean;
  /** What the hero says when the level starts (after the fly-over). */
  speech?: string;
  /** The label on its Part button on the start screen (default: `part`). */
  button?: string;
  /** Work in progress: only for testers, and open to them straight away (not unlocked by beating the one before). */
  wip?: boolean;
}

export const LEVELS: LevelInfo[] = [
  { id: 1, world: 'World 1', title: 'Puff Ball Planet', part: 'Part 1', build: buildLevel1, hoops: true },
  { id: 2, world: 'World 1', title: 'Puff Ball Planet', part: 'Part 2', build: buildLevel2, hoops: true },
  {
    id: 3,
    world: 'World 2',
    title: 'Plop Invasion',
    part: 'Part 1',
    button: 'Part 3',
    build: buildLevel3,
    speech: 'Oh no, the Plops have taken over Puff Ball Planet!',
    wrestle: true,
  },
];

/**
 * Work in progress, only on devices switched to it (localStorage puffy.dev = 1, or ?dev in the
 * address), or for the testers' accounts (TESTERS): Plop Invasion · Part 2. Everyone else never sees it.
 */
export const DEV = (() => {
  try {
    // (opening the game once with ?dev switches this device on for good — the home-screen app too;
    // ?nodev switches it off again)
    if (/[?&]nodev\b/.test(location.search)) localStorage.removeItem('puffy.dev');
    else if (/[?&]dev\b/.test(location.search)) localStorage.setItem('puffy.dev', '1');
    return localStorage.getItem('puffy.dev') === '1';
  } catch {
    return /[?&]dev\b/.test(location.search);
  }
})();
/** Accounts that get the work-in-progress levels (names, any case). */
const TESTERS = ['neil', 'founder'];
const WIP: LevelInfo[] = [
  {
    id: 4,
    world: 'World 2',
    title: 'Plop Invasion',
    part: 'Part 2',
    button: 'Part 4',
    build: buildLevel4,
    speech: 'Up we go!',
    wip: true,
  },
];
/**
 * Show the work-in-progress levels or not (dev devices always; otherwise whether a tester is signed
 * in — called on sign-in and sign-out). True if that changed the list.
 */
export function setTester(name: string | null | undefined): boolean {
  const on = DEV || TESTERS.includes((name ?? '').trim().toLowerCase());
  const has = LEVELS.some((l) => l.wip);
  if (on === has) return false;
  if (on) LEVELS.push(...WIP);
  else LEVELS.splice(0, LEVELS.length, ...LEVELS.filter((l) => !l.wip));
  return true;
}
// (straight away: the tester signed in on this device last time — before the account answers)
try {
  setTester(JSON.parse(localStorage.getItem('puffy.account') ?? 'null')?.name);
} catch {
  setTester(null);
}

/** The Parts you can pick on the start screen: the ones you've unlocked (and, for testers, the work in progress). */
export const pickableLevels = () => LEVELS.filter((l) => l.id <= progress.beaten + 1 || l.wip);
/** Whether the start screen offers a choice of Parts at all. */
export const canPickLevel = () => progress.beaten >= 1 || LEVELS.some((l) => l.wip);

export const levelInfo = (id: number) => LEVELS.find((l) => l.id === id) ?? LEVELS[0];
export const levelName = (id: number) => `${levelInfo(id).title} · ${levelInfo(id).part}`;

const KEY = 'puffy.beaten';

/**
 * The level the start screen picks when the game opens: the furthest one you've
 * unlocked (beaten Part 1 → Part 2; beaten Part 2 → Part 3 once it exists).
 */
export function latestLevel(): number {
  const built = LEVELS.filter((l) => l.build).map((l) => l.id);
  const unlocked = built.filter((id) => id <= progress.beaten + 1);
  return unlocked.length ? Math.max(...unlocked) : 1;
}

/** Which levels you've beaten (unlocks picking where to start). */
export const progress = {
  get beaten(): number {
    try {
      return Number(localStorage.getItem(KEY) ?? 0) || 0;
    } catch {
      return 0;
    }
  },
  markBeaten(id: number) {
    try {
      if (id > this.beaten) localStorage.setItem(KEY, String(id));
    } catch {
      /* private mode etc. */
    }
  },
};
