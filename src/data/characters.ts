/**
 * The three playable heroes, all drawn from the original sketches:
 * Puffy (all-rounder), Scruffy (small & speedy), Big Muscles (big blasts).
 *
 * There are no hearts: one hit makes you faint (unless you're carrying aura).
 * Running is fast but uses stamina, which drains quickly and refills as soon
 * as you stop running.
 */
export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  /** Body colors (main, shade, highlight, accent), used for menus and HUD. */
  colors: { main: string; shade: string; light: string; accent: string };
  walkSpeed: number;
  /** Top speed while running (uses stamina). */
  runSpeed: number;
  /** Ground acceleration, px/s². */
  accel: number;
  airAccel: number;
  /** Initial jump velocity, px/s. */
  jump: number;
  /** Seconds of continuous running from a full stamina meter. */
  staminaSecs: number;
  /** Seconds to refill an empty meter once you stop running. */
  refillSecs: number;
  /** Seconds between bazooka shots. */
  fireRate: number;
  /** Max rockets this player can have in flight. */
  maxRockets: number;
  rocketSpeed: number;
  blastRadius: number;
  /** Hits dealt per rocket (1 for everyone, so "takes 2 shots" means the same for all heroes). */
  damage: number;
  /** Drawing scale (Scruffy is small, Big Muscles is big). */
  scale: number;
  /** Collision box size (px). Defaults 22 × 34. */
  hitW?: number;
  hitH?: number;
  /** Height of the bazooka muzzle above the feet (px). Default 18. */
  muzzleY?: number;
  /** 1-5 bars shown in character select. */
  bars: { speed: number; jump: number; stamina: number; blast: number };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'puffy',
    name: 'Puffy',
    tagline: 'The hero',
    colors: { main: '#f28a2e', shade: '#c9611a', light: '#ffc27a', accent: '#8fc48a' },
    scale: 1,
    hitH: 40,
    walkSpeed: 165,
    runSpeed: 345,
    accel: 1400,
    airAccel: 1000,
    jump: 600,
    staminaSecs: 2.75,
    refillSecs: 2.0,
    fireRate: 0.42,
    maxRockets: 2,
    rocketSpeed: 620,
    blastRadius: 56,
    damage: 1,
    bars: { speed: 3, jump: 3, stamina: 3, blast: 3 },
  },
  {
    id: 'scruffy',
    name: 'Scruffy',
    tagline: 'Small & speedy',
    colors: { main: '#f7953a', shade: '#cf6b1c', light: '#ffc98a', accent: '#fff3e2' },
    scale: 0.78,
    hitW: 16,
    hitH: 22,
    muzzleY: 8,
    walkSpeed: 180,
    runSpeed: 375,
    accel: 1650,
    airAccel: 1150,
    jump: 630,
    staminaSecs: 3.4,
    refillSecs: 1.7,
    fireRate: 0.28,
    maxRockets: 3,
    rocketSpeed: 700,
    blastRadius: 44,
    damage: 1,
    bars: { speed: 5, jump: 4, stamina: 4, blast: 2 },
  },
  {
    id: 'muscles',
    name: 'Big Muscles',
    tagline: 'Big blasts',
    colors: { main: '#ec7b2b', shade: '#c0561a', light: '#ffb06a', accent: '#fffaf0' },
    scale: 1.32,
    hitW: 32,
    hitH: 58,
    muzzleY: 23,
    walkSpeed: 150,
    runSpeed: 315,
    accel: 1150,
    airAccel: 850,
    jump: 585,
    staminaSecs: 2.4,
    refillSecs: 2.2,
    fireRate: 0.6,
    maxRockets: 1,
    rocketSpeed: 560,
    blastRadius: 86,
    damage: 1,
    bars: { speed: 2, jump: 2, stamina: 2, blast: 5 },
  },
];

export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
