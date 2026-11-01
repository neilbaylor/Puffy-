/**
 * The three playable heroes, all drawn from the original sketches:
 * Puffy (all-rounder), Scruffy (small & speedy), Big Muscles (heavy hitter).
 */
export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  /** Body colors (main, shade, highlight, accent), used for menus and HUD. */
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
  /** Collision box size (px). Defaults 22 × 34. */
  hitW?: number;
  hitH?: number;
  /** Height of the bazooka muzzle above the feet (px). Default 18. */
  muzzleY?: number;
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
    id: 'scruffy',
    name: 'Scruffy',
    tagline: 'Small & speedy',
    colors: { main: '#f7953a', shade: '#cf6b1c', light: '#ffc98a', accent: '#fff3e2' },
    maxHp: 3,
    hitW: 20,
    hitH: 28,
    muzzleY: 11,
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
    id: 'muscles',
    name: 'Big Muscles',
    tagline: 'Heavy hitter',
    colors: { main: '#ec7b2b', shade: '#c0561a', light: '#ffb06a', accent: '#fffaf0' },
    maxHp: 4,
    hitW: 24,
    hitH: 44,
    muzzleY: 19,
    walkSpeed: 150,
    runSpeed: 245,
    accel: 1100,
    airAccel: 800,
    jump: 580,
    fireRate: 0.65,
    maxRockets: 1,
    rocketSpeed: 540,
    blastRadius: 84,
    damage: 1,
    bars: { speed: 2, jump: 2, power: 5 },
  },
];

export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
