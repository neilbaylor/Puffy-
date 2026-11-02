import type { LevelData } from './builder';
import { buildLevel1 } from './level1';

export interface LevelInfo {
  /** 1-based level number. */
  id: number;
  title: string;
  part: string;
  /** null = not built yet ("coming soon"). */
  build: (() => LevelData) | null;
}

export const LEVELS: LevelInfo[] = [
  { id: 1, title: 'Puff Ball Planet', part: 'Part 1', build: buildLevel1 },
  { id: 2, title: 'Puff Ball Planet', part: 'Part 2', build: null },
];

export const levelInfo = (id: number) => LEVELS.find((l) => l.id === id) ?? LEVELS[0];
export const levelName = (id: number) => `${levelInfo(id).title} · ${levelInfo(id).part}`;

const KEY = 'puffy.beaten';

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
