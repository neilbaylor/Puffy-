/**
 * The three playable characters. Puffy is drawn from the original sketches; Bolt and
 * Boom are still placeholders. The stats give each one a distinct feel.
 */
export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  /** Placeholder body colors (main, shade, highlight). */
  colors: { main: string; shade: string; light: string; accent: string };
  maxHp: number;
  walkSpeed: number;
  runSpeed: number;
  /** Ground acceleration, px/s². */
  accel: number;
  airAccel: number;
  /** Initial jump velocity, px/s. */
  jump: number;
  /** Seconds between bazooka shots. */
  fireRate: number;
  /** Max rockets this player can have in flight. */
  maxRockets: number;
  rocketSpeed: number;
  blastRadius: number;
  /** Hits dealt per rocket. Kept at 1 for everyone so "takes 2 shots" means the same for every hero. */
  damage: number;
  /** Collision box height (px). Taller characters get a taller box. */
  hitH?: number;
  /** 0-5 bars shown in character select. */
  bars: { speed: number; jump: number; power: number };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'puffy',
    name: 'Puffy',
    tagline: 'The hero',
    colors: { main: '#f2892e', shade: '#d06a1a', light: '#ffc58a', accent: '#8fc48a' },
    maxHp: 3,
    hitH: 40,
    walkSpeed: 165,
    runSpeed: 270,
    accel: 1300,
    airAccel: 950,
    jump: 600,
    fireRate: 0.42,
    maxRockets: 2,
    rocketSpeed: 620,
    blastRadius: 56,
    damage: 1,
    bars: { speed: 3, jump: 3, power: 3 },
  },
  {
    id: 'bolt',
    name: 'Bolt',
    tagline: 'Fast & floaty',
    colors: { main: '#3fa7ff', shade: '#1f6fc4', light: '#9fd3ff', accent: '#f1f5ff' },
    maxHp: 3,
    walkSpeed: 180,
    runSpeed: 305,
    accel: 1600,
    airAccel: 1150,
    jump: 630,
    fireRate: 0.28,
    maxRockets: 3,
    rocketSpeed: 700,
    blastRadius: 44,
    damage: 1,
    bars: { speed: 5, jump: 4, power: 2 },
  },
  {
    id: 'boom',
    name: 'Boom',
    tagline: 'Heavy hitter',
    colors: { main: '#a77bf3', shade: '#7a4fd0', light: '#d6c2ff', accent: '#ffd23f' },
    maxHp: 4,
    walkSpeed: 150,
    runSpeed: 245,
    accel: 1100,
    airAccel: 800,
    jump: 570,
    fireRate: 0.65,
    maxRockets: 1,
    rocketSpeed: 540,
    blastRadius: 84,
    damage: 1,
    bars: { speed: 2, jump: 2, power: 5 },
  },
];

export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
