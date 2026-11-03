import type { LevelData } from './builder';
import { buildLevel1 } from './level1';
import { buildLevel2 } from './level2';

export interface LevelInfo {
  /** 1-based level number. */
  id: number;
  /** Which world it's in ("World 1"; World 2 — Plop Invasion — is coming). */
  world: string;
  title: string;
  part: string;
  /** null = not built yet ("coming soon"). */
  build: (() => LevelData) | null;
}

export const LEVELS: LevelInfo[] = [
  { id: 1, world: 'World 1', title: 'Puff Ball Planet', part: 'Part 1', build: buildLevel1 },
  { id: 2, world: 'World 1', title: 'Puff Ball Planet', part: 'Part 2', build: buildLevel2 },
];

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
