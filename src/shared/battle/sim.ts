/**
 * The battle rules, shared by the server (which runs the real match) and the
 * game (which runs the same movement code to move your own hero instantly,
 * then corrects to what the server says). Plain TypeScript: no Phaser, no DOM.
 *
 * Fixed 30 ticks a second. Coordinates are world pixels; a player's (x, y) is
 * the middle of their feet.
 */
import { CHARACTERS, type CharacterDef } from '../../data/characters';
import type { LevelData } from '../../level/builder';
import { ONE_WAY_TILES, SOLID_TILES } from '../../level/tiles';
import { ARENA_RAMPS, ARENA_SECTION, ARENA_SPAWNS, ARENA_STARTS, type Ramp } from './arena';

export const TICK_HZ = 30;
export const DT = 1 / TICK_HZ;
export const TILE_PX = 32;
export const HEARTS = 3;
/** 2½ minutes (the battle song is cued to end exactly on 0). */
export const MATCH_SECS = 150;
export const WIN_KOS = 5;
export const RESPAWN_SECS = 2.4;
/** A respawn spot is safe with no bad guy (their shots, falling rocks) nearer than this (px; ~12 tiles). */
const SAFE_SPAWN = 380;
/** How fast two bad guys standing in each other are eased apart (px/s). */
const APART_SPEED = 90;

const GRAVITY = 1600;
const MAX_FALL = 900;
const COYOTE = 0.1;
const JUMP_BUFFER = 0.12;
const AIR_JUMP = 0.72;
const HIT_STUN = 0.35;
const HIT_INVULN = 1.0;
const SPAWN_INVULN = 1.6;
const EXHAUSTED_UNTIL = 0.3;
const ROCKET_LIFE = 1.4;

/** Prizes that drop into the arena (a race to grab each one). */
export type PrizeKind = 'bomb' | 'star' | 'grow' | 'rapid' | 'heart' | 'ice' | 'fire';
/** How often each kind turns up (out of the total). */
const PRIZE_ODDS: [PrizeKind, number][] = [
  ['bomb', 34],
  ['rapid', 18],
  ['heart', 18],
  ['grow', 16],
  ['star', 14],
];
/** Timed powers: 0 none, 1 star (invincible), 2 grow (big & strong), 3 rapid fire, 4 fireballs. */
export const POWER = { none: 0, star: 1, grow: 2, rapid: 3, fire: 4 } as const;
/** How long each power lasts (s): the star's invincibility is kept short, it's strong. */
const POWER_SECS: Record<number, number> = { 1: 8, 2: 12, 3: 7, 4: 8 };
/** Grabbing ice freezes everyone else this long. */
export const FREEZE_SECS = 2;
/** Landing on someone's head: a hit, and you bounce off. */
const STOMP_BOUNCE = 560;
/** How much bigger "grow" makes you. */
export const GROW = 1.8;
const BOMBS_PER_PRIZE = 3;
const MAX_PRIZES = 3;
/** Once it has landed, a prize waits this long (blinking at the end), then it's gone. */
export const PRIZE_LIFE = 7;
/** Folding chairs: this many fall into each battle (at random times and places). Grab one, and FIRE
 * swings it instead of shooting: each hit takes 1 heart, and it's done after this many hits. */
export const CHAIRS_PER_BATTLE = 0;
export const CHAIR_USES = 2;
/** A chair lying about unclaimed goes after this long (s). */
export const CHAIR_LIFE = 24;
/** A swing: how long it takes (s), and how far in front of you it reaches (px, at normal size). */
export const CHAIR_SWING = 0.3;
const CHAIR_REACH = 64;

/** Bad guys' collision boxes [w, h] (feet at y), matching their art in the levels. */
export const ENEMY_BOX: Record<EnemyKind, [number, number]> = { small: [22, 30], medium: [36, 68], big: [104, 176] };

/** Buttons, as bits (what the game sends the server each tick). */
export const BTN = { left: 1, right: 2, jump: 4, fire: 8, run: 16, bomb: 32 } as const;

export interface BPlayer {
  id: string;
  hero: string;
  slot: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  airJumps: number;
  coyote: number;
  jumpBuf: number;
  jumping: boolean;
  prevBtn: number;
  fireCd: number;
  stamina: number;
  exhausted: boolean;
  running: boolean;
  stun: number;
  invuln: number;
  /** Seconds since the last shot (for the recoil pose). */
  shotAgo: number;
  hp: number;
  /** > 0 while knocked out: seconds until respawn. */
  respawn: number;
  kos: number;
  deaths: number;
  lastHitBy: string | null;
  /** Bombs to throw (each shot throws one instead of a rocket). */
  bombs: number;
  /** POWER.* and the seconds it has left. */
  power: number;
  powerT: number;
  /** > 0: frozen solid (someone grabbed the ice): seconds left. */
  frozen: number;
}

export interface BRocket {
  id: number;
  owner: string;
  /** (pellets, poo and thrown chainsaws are the bad guys'; fire is the fireball power) */
  kind: RocketKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  age: number;
  speed: number;
  radius: number;
  /** Hearts it takes off. */
  damage: number;
}

export type RocketKind = 'rocket' | 'bomb' | 'pellet' | 'fire' | 'poo' | 'saw';

/** Bad guys who drop in to cause trouble for everyone: Puff Balls and Plops, in three sizes. */
export type EnemyKind = 'small' | 'medium' | 'big';
export type EnemyRace = 'puff' | 'plop';
/** What an armed bad guy carries (like in the levels). */
export type EnemyWeapon = 'gun' | 'saw' | 'flail';
export interface BEnemy {
  id: number;
  kind: EnemyKind;
  race: EnemyRace;
  weapon: EnemyWeapon | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  hp: number;
  onGround: boolean;
  armed: boolean;
  /** Floating down under a parachute. */
  chute: boolean;
  fireCd: number;
  jumpCd: number;
  /** A second hop in the air (to climb up to someone on a higher level). */
  hop: number;
  /** Seconds left of the white "ouch" flash. */
  hurtT: number;
}

/** Things that fall out of the sky: a shadow first (warn), then down it comes. */
export interface BHazard {
  id: number;
  kind: 'rock' | 'anvil';
  /** 1 in 3 is a big one (bigger, and hits harder). */
  big: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** > 0: still just a shadow on the ground, seconds until it drops. */
  warn: number;
  /** A big boulder that landed on the ramp rolls down it (and on along the floor a bit): seconds rolling. */
  rolling: number;
}

export interface BPrize {
  id: number;
  kind: PrizeKind;
  x: number;
  /** The bottom of the bubble. */
  y: number;
  vy: number;
  landed: boolean;
  age: number;
}

export interface BChair {
  id: number;
  x: number;
  /** The bottom of it (where it lies). */
  y: number;
  vy: number;
  landed: boolean;
  /** Seconds since it landed (or was dropped). */
  age: number;
  /** Who's holding it (null: falling or lying about). */
  holder: string | null;
  /** Hits left in it. */
  uses: number;
  /** > 0: mid-swing (seconds left). */
  swing: number;
}

export type BEvent =
  | { k: 'fire'; id: string; x: number; y: number; dir: 1 | -1; bomb?: boolean }
  | { k: 'jump'; id: string; air: boolean }
  | { k: 'boom'; x: number; y: number; r: number }
  | { k: 'hit'; id: string; by: string }
  | { k: 'ko'; id: string; by: string | null; gift?: boolean }
  | { k: 'spawn'; id: string }
  | { k: 'drop'; x: number; kind: PrizeKind }
  | { k: 'prize'; id: string; kind: PrizeKind; x: number; y: number }
  | { k: 'bounce'; x: number; y: number }
  | { k: 'espawn'; kind: EnemyKind; x: number; chute: boolean }
  | { k: 'ehit'; id: number }
  | { k: 'edie'; kind: EnemyKind; x: number; y: number }
  | { k: 'eshot'; x: number; y: number; dir: 1 | -1 }
  | { k: 'throw'; x: number; y: number; kind: 'poo' | 'saw' }
  | { k: 'stomp'; id: string; on: string | number; x: number; y: number }
  | { k: 'freeze'; by: string }
  | { k: 'crash'; kind: 'rock' | 'anvil'; x: number; y: number; big?: boolean; roll?: boolean }
  | { k: 'chair'; x: number }
  | { k: 'chairland'; x: number; y: number }
  | { k: 'chairgrab'; id: string }
  | { k: 'chairswing'; id: string }
  | { k: 'chairhit'; id: string; x: number; y: number; broke: boolean };

/**
 * Battle's own tweaks to a hero (the main game's numbers otherwise): Scruffy's still the quickest,
 * but not by so much (walk 180 → 172, run 375 → 356; Puffy 165 / 345).
 */
const BATTLE_TWEAK: Record<string, Partial<CharacterDef>> = { scruffy: { walkSpeed: 172, runSpeed: 356 } };
const BATTLE_CHARS = new Map(CHARACTERS.map((c) => [c.id, { ...c, ...BATTLE_TWEAK[c.id] } as CharacterDef]));
const charOf = (hero: string): CharacterDef => BATTLE_CHARS.get(hero) ?? BATTLE_CHARS.get(CHARACTERS[0].id)!;
/** Grown, no hero gets taller than this (world px): it still fits under the islands (3 tiles up). */
export const GROW_MAX_H = 88;
/**
 * How big this hero is right now ("grow" makes you bigger: GROW times, but never taller than
 * GROW_MAX_H, so Big Muscles grows a bit less and can still get under things).
 */
export const sizeOf = (p: { power: number; hero: string }) => (p.power === POWER.grow ? Math.min(GROW, GROW_MAX_H / (charOf(p.hero).hitH ?? 34)) : 1);
export const boxW = (c: CharacterDef, k = 1) => (c.hitW ?? 22) * k;
export const boxH = (c: CharacterDef, k = 1) => (c.hitH ?? 34) * k;

function approach(v: number, target: number, step: number) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

/** Collision against the arena's tiles. */
export class ArenaMap {
  readonly w: number;
  readonly h: number;
  readonly widthPx: number;
  readonly heightPx: number;
  constructor(
    readonly data: LevelData,
    readonly ramps: Ramp[] = ARENA_RAMPS,
  ) {
    this.w = data.width;
    this.h = data.height;
    this.widthPx = this.w * TILE_PX;
    this.heightPx = this.h * TILE_PX;
  }
  private tile(tx: number, ty: number) {
    if (tx < 0 || tx >= this.w) return SOLID_TILES[0]; // walls at the sides
    if (ty < 0 || ty >= this.h) return -1;
    return this.data.tiles[ty][tx];
  }
  solid(tx: number, ty: number) {
    return SOLID_TILES.includes(this.tile(tx, ty));
  }
  oneWay(tx: number, ty: number) {
    return ONE_WAY_TILES.includes(this.tile(tx, ty));
  }
  solidAt(px: number, py: number) {
    return this.solid(Math.floor(px / TILE_PX), Math.floor(py / TILE_PX));
  }
  /** The ramp's walking surface at x (world px), or null if there's no ramp there. */
  rampY(x: number): number | null {
    for (const r of this.ramps) {
      if (x >= r.x0 && x <= r.x1) return r.y0 + ((r.y1 - r.y0) * (x - r.x0)) / (r.x1 - r.x0);
      if (x > r.x1 && x <= r.x1 + r.flat) return r.y1;
    }
    return null;
  }
  /**
   * Standing on (or landing on) a ramp: the surface to put your feet on, or null.
   * Coming down onto it from above lands; walking along it sticks to it (up or
   * down a bit each tick); from underneath you go straight through.
   */
  rampLand(x: number, prevY: number, y: number, vy: number, wasGround: boolean): number | null {
    if (vy < 0) return null;
    const ry = this.rampY(x);
    if (ry === null) return null;
    const stick = wasGround ? 14 : 0;
    return prevY <= ry + 1 + stick && y >= ry - stick ? ry : null;
  }
}

export function newPlayer(id: string, hero: string, slot: number): BPlayer {
  return {
    id, hero, slot, x: 0, y: 0, vx: 0, vy: 0, facing: 1, onGround: false, airJumps: 1, coyote: 0, jumpBuf: 0,
    jumping: false, prevBtn: 0, fireCd: 0, stamina: 1, exhausted: false, running: false, stun: 0, invuln: 0,
    shotAgo: 9, hp: HEARTS, respawn: 0, kos: 0, deaths: 0, lastHitBy: null, bombs: 0, power: 0, powerT: 0, frozen: 0,
  };
}

/**
 * Move one hero one tick with these buttons (no other players involved), so
 * the game can run exactly this for its own hero ahead of the server.
 * Returns true when it wants to fire (the caller makes the rocket).
 */
/** Returns 0, or 1 if a rocket went off, or 2 if a bomb was thrown (its own button). */
export function stepMove(p: BPlayer, btn: number, map: ArenaMap, ev?: BEvent[], canFire: () => boolean = () => true): 0 | 1 | 2 {
  const c = charOf(p.hero);
  const dt = DT;
  if (p.respawn > 0) {
    p.prevBtn = btn;
    return 0;
  }
  const jumpHeld = (btn & BTN.jump) !== 0;
  const jumpPressed = jumpHeld && !(p.prevBtn & BTN.jump);
  p.stun = Math.max(0, p.stun - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.frozen = Math.max(0, p.frozen - dt);
  p.shotAgo += dt;
  if (p.power) {
    p.powerT -= dt;
    if (p.powerT <= 0) {
      p.power = 0;
      p.powerT = 0;
    }
  }
  const ctl = p.stun <= 0 && p.frozen <= 0;
  const dir = ctl ? ((btn & BTN.right) ? 1 : 0) - ((btn & BTN.left) ? 1 : 0) : 0;

  // stamina: running drains it, it refills when you stop
  const wantsRun = (btn & BTN.run) !== 0 && dir !== 0;
  p.running = wantsRun && !p.exhausted && p.stamina > 0;
  if (p.running && p.onGround) {
    p.stamina -= dt / c.staminaSecs;
    if (p.stamina <= 0) {
      p.stamina = 0;
      p.exhausted = true;
      p.running = false;
    }
  } else if (!p.running) {
    p.stamina = Math.min(1, p.stamina + dt / c.refillSecs);
    if (p.exhausted && p.stamina >= EXHAUSTED_UNTIL) p.exhausted = false;
  }

  // run / walk
  const maxSpeed = p.running ? c.runSpeed : c.walkSpeed;
  let vx = p.vx;
  if (dir !== 0) {
    let accel = p.onGround ? c.accel : c.airAccel;
    if (p.running) accel *= 1.25;
    if (Math.sign(vx) !== dir && Math.abs(vx) > 20) accel *= p.onGround ? 2.4 : 1.4;
    if (Math.abs(vx) > maxSpeed && Math.sign(vx) === dir) accel = c.accel * 0.5;
    vx = approach(vx, dir * maxSpeed, accel * dt);
    p.facing = dir as 1 | -1;
  } else if (ctl) {
    vx = approach(vx, 0, (p.onGround ? c.accel * 1.4 : c.airAccel * 0.3) * dt);
  } else if (p.frozen > 0) {
    vx = approach(vx, 0, 900 * dt); // a block of ice just slides to a stop
  }
  p.vx = vx;

  // jumps: coyote time, input buffer, a smaller second jump in the air
  p.coyote = p.onGround ? COYOTE : p.coyote - dt;
  p.jumpBuf = jumpPressed ? JUMP_BUFFER : p.jumpBuf - dt;
  let jumped = false;
  if (ctl && p.jumpBuf > 0 && p.coyote > 0) {
    jumped = true;
    p.vy = -(c.jump + Math.abs(vx) * 0.1);
    p.jumpBuf = 0;
    p.coyote = 0;
    p.jumping = true;
    p.onGround = false;
    ev?.push({ k: 'jump', id: p.id, air: false });
  }
  if (p.onGround) p.airJumps = 1;
  else if (ctl && jumpPressed && !jumped && p.coyote <= 0 && p.airJumps > 0) {
    p.airJumps--;
    p.vy = Math.min(p.vy, -c.jump * AIR_JUMP);
    p.jumpBuf = 0;
    p.jumping = true;
    ev?.push({ k: 'jump', id: p.id, air: true });
  }
  if (p.jumping && (!jumpHeld || p.vy >= 0)) {
    if (p.vy < 0) p.vy *= 0.45;
    p.jumping = false;
  }

  // gravity and moving through the arena
  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
  moveAndCollide(p, c, map);

  // fire?
  p.fireCd -= dt;
  let fire: 0 | 1 | 2 = 0;
  if (ctl && (btn & BTN.bomb) && !(p.prevBtn & BTN.bomb) && p.bombs > 0) {
    // a bomb: one per press of the bomb button
    fire = 2;
    p.vx -= p.facing * 40;
    p.shotAgo = 0;
  } else if (ctl && (btn & BTN.fire) && p.fireCd <= 0 && canFire()) {
    p.fireCd = c.fireRate * (p.power === POWER.rapid ? 0.4 : 1);
    fire = 1;
    p.vx -= p.facing * 80; // recoil push
    p.shotAgo = 0;
  }
  p.prevBtn = btn;
  return fire;
}

function moveAndCollide(p: BPlayer, c: CharacterDef, map: ArenaMap) {
  const wasGround = p.onGround;
  const w = boxW(c, sizeOf(p));
  const h = boxH(c, sizeOf(p));
  const T = TILE_PX;
  // horizontal
  p.x += p.vx * DT;
  {
    const top = p.y - h + 1;
    const bot = p.y - 1;
    const ty0 = Math.floor(top / T);
    const ty1 = Math.floor(bot / T);
    if (p.vx > 0) {
      const tx = Math.floor((p.x + w / 2) / T);
      for (let ty = ty0; ty <= ty1; ty++)
        if (map.solid(tx, ty)) {
          p.x = tx * T - w / 2 - 0.01;
          p.vx = 0;
          break;
        }
    } else if (p.vx < 0) {
      const tx = Math.floor((p.x - w / 2) / T);
      for (let ty = ty0; ty <= ty1; ty++)
        if (map.solid(tx, ty)) {
          p.x = (tx + 1) * T + w / 2 + 0.01;
          p.vx = 0;
          break;
        }
    }
  }
  // vertical
  const prevY = p.y;
  p.y += p.vy * DT;
  const movedY = p.y;
  const movedVy = p.vy;
  p.onGround = false;
  const tx0 = Math.floor((p.x - w / 2 + 1) / T);
  const tx1 = Math.floor((p.x + w / 2 - 1) / T);
  if (p.vy >= 0) {
    // landing: solid tiles, or a cloud we were above last tick
    const ty = Math.floor(p.y / T);
    for (let tx = tx0; tx <= tx1; tx++) {
      const top = ty * T;
      if (map.solid(tx, ty) || (map.oneWay(tx, ty) && prevY <= top + 0.5)) {
        p.y = top;
        p.vy = 0;
        p.onGround = true;
        break;
      }
    }
  } else {
    const ty = Math.floor((p.y - h) / T);
    for (let tx = tx0; tx <= tx1; tx++)
      if (map.solid(tx, ty)) {
        p.y = (ty + 1) * T + h;
        p.vy = 0;
        p.jumping = false;
        break;
      }
  }
  // the ramp (it wins over the floor where it's the higher of the two: walking onto it)
  {
    const ry = map.rampLand(p.x, prevY, movedY, movedVy, wasGround);
    if (ry !== null && (!p.onGround || ry < p.y)) {
      p.y = ry;
      p.vy = 0;
      p.onGround = true;
    }
  }
  // fell out of the arena (shouldn't happen: there are no pits) — put back on top
  if (p.y > map.heightPx + 200) {
    p.y = 0;
    p.vy = 0;
  }
}

/** How big a falling rock / anvil is (half its width, world px). */
export const hazardR = (z: { kind: 'rock' | 'anvil'; big: boolean }) => (z.kind === 'anvil' ? 28 : 23) * (z.big ? 1.55 : 1);

/** Where something dropped at x first lands: the ramp, or the first ground or cloud below the sky. */
export function landingY(map: ArenaMap, x: number) {
  const tx = Math.floor(x / TILE_PX);
  let y = map.heightPx;
  for (let ty = 0; ty < map.h; ty++)
    if (map.solid(tx, ty) || map.oneWay(tx, ty)) {
      y = ty * TILE_PX;
      break;
    }
  const ry = map.rampY(x);
  return ry !== null && ry < y ? ry : y;
}

/** The whole match (server side). */
/**
 * A hero's shot, just fired (fire: 1 = their weapon, 2 = a bomb): a rocket, or a fireball with the
 * fire power, or a lobbed bomb. The server makes it; your own phone makes the same one at once, so
 * your shots go off the moment you press (rather than when the server's word comes back).
 */
export function heroShot(p: BPlayer, fire: 1 | 2): Omit<BRocket, 'id'> {
  const c = charOf(p.hero);
  const k = sizeOf(p);
  const s = c.scale * k;
  const x = p.x + p.facing * 18 * s;
  const y = p.y - (c.muzzleY ?? 18) * k;
  const big = p.power === POWER.grow;
  // a lobbed bomb: bounces about, then a big blast
  if (fire === 2) return { owner: p.id, kind: 'bomb', x, y, vx: p.facing * 300 + p.vx * 0.35, vy: -430, dir: p.facing, age: 0, speed: 0, radius: 118 * (big ? 1.25 : 1), damage: 2 };
  // a fireball: lobbed forward, it arcs down and bursts into flames
  if (p.power === POWER.fire) return { owner: p.id, kind: 'fire', x, y, vx: p.facing * 430 + p.vx * 0.3, vy: -300, dir: p.facing, age: 0, speed: 0, radius: 58, damage: 1 };
  return { owner: p.id, kind: 'rocket', x, y, vx: p.facing * c.rocketSpeed * 0.45, vy: 0, dir: p.facing, age: 0, speed: c.rocketSpeed, radius: c.blastRadius * (big ? 1.4 : 1), damage: big ? 2 : 1 };
}

/**
 * One tick of a shot's flight (rockets speed up and fly straight; bombs arc and bounce; lobbed
 * things arc). True if it's done — into a wall, landed, out of the arena, or old (what it hits is
 * the sim's business).
 */
export function moveShot(r: Omit<BRocket, 'id'>, map: ArenaMap, ev?: BEvent[]): boolean {
  r.age += DT;
  if (r.kind === 'bomb') {
    r.vy = Math.min(MAX_FALL, r.vy + GRAVITY * DT);
    const nx = r.x + r.vx * DT;
    if (map.solidAt(nx + Math.sign(r.vx) * 7, r.y)) r.vx *= -0.5;
    else r.x = nx;
    const prevY = r.y;
    r.y += r.vy * DT;
    const ty = Math.floor((r.y + 7) / TILE_PX);
    const tx = Math.floor(r.x / TILE_PX);
    if (r.vy > 0 && (map.solid(tx, ty) || (map.oneWay(tx, ty) && prevY + 7 <= ty * TILE_PX + 0.5))) {
      r.y = ty * TILE_PX - 7;
      if (r.vy > 160) ev?.push({ k: 'bounce', x: r.x, y: r.y });
      r.vy = r.vy > 160 ? -r.vy * 0.45 : 0;
      r.vx *= 0.72;
    }
    return r.age > 1.6 || r.y > map.heightPx + 60;
  }
  if (r.kind === 'fire' || r.kind === 'poo' || r.kind === 'saw') {
    // lobbed things: an arc, and they burst (or splat) on whatever they land on
    r.vy = Math.min(MAX_FALL, r.vy + (r.kind === 'saw' ? 900 : 1150) * DT);
    const prevY = r.y;
    r.x += r.vx * DT;
    r.y += r.vy * DT;
    const tx = Math.floor(r.x / TILE_PX);
    const ty = Math.floor(r.y / TILE_PX);
    const landed = r.vy > 0 && map.oneWay(tx, ty) && prevY <= ty * TILE_PX + 0.5;
    return r.age > 2.4 || r.x < -40 || r.x > map.widthPx + 40 || r.y > map.heightPx + 40 || map.solidAt(r.x, r.y) || landed;
  }
  if (r.kind === 'rocket') r.vx += (r.dir * r.speed - r.vx) * Math.min(1, DT * 7);
  r.x += r.vx * DT;
  return r.age > ROCKET_LIFE * (r.kind === 'pellet' ? 1.6 : 1) || r.x < -40 || r.x > map.widthPx + 40 || map.solidAt(r.x + r.dir * 6, r.y);
}

export class BattleSim {
  readonly map: ArenaMap;
  players = new Map<string, BPlayer>();
  rockets: BRocket[] = [];
  prizes: BPrize[] = [];
  enemies: BEnemy[] = [];
  hazards: BHazard[] = [];
  chairs: BChair[] = [];
  tick = 0;
  /** When the chairs fall (seconds left on the clock): one in each half or so, at random. */
  private chairAt: number[] = Array.from({ length: CHAIRS_PER_BATTLE }, (_, i) => MATCH_SECS - 14 - i * ((MATCH_SECS - 34) / Math.max(1, CHAIRS_PER_BATTLE - 1)) - Math.random() * 10);
  private nextChair = 1;
  timeLeft = MATCH_SECS;
  private nextRocket = 1;
  private nextPrize = 1;
  private dropIn = 5;
  private nextThing = 1;
  private enemyIn = 12;
  private hazardIn = 5;

  constructor(data: LevelData) {
    this.map = new ArenaMap(data);
  }

  add(id: string, hero: string, slot: number) {
    const p = newPlayer(id, hero, slot);
    this.players.set(id, p);
    this.spawn(p, slot);
    p.invuln = SPAWN_INVULN;
    return p;
  }

  remove(id: string) {
    this.dropChairOf(id);
    this.players.delete(id);
  }

  /** The chair this hero is holding, if any. */
  chairOf(id: string) {
    return this.chairs.find((c) => c.holder === id) ?? null;
  }

  /** They let go of it (knocked out, or gone): it falls where they were, hits and all. */
  private dropChairOf(id: string) {
    const c = this.chairOf(id);
    if (!c) return;
    c.holder = null;
    c.landed = false;
    c.vy = -120;
    c.swing = 0;
    c.age = 0;
  }

  /**
   * How close the nearest danger is to a spot (px): bad guys (the big ones' reach counted, ones still
   * parachuting in too), their shots, and rocks or anvils coming down near it.
   */
  private dangerAt(sx: number, sy: number) {
    let d = Infinity;
    for (const e of this.enemies) d = Math.min(d, Math.hypot(e.x - sx, e.y - sy) - (e.kind === 'big' ? 110 : e.kind === 'medium' ? 30 : 0));
    for (const r of this.rockets) if (r.kind === 'pellet' || r.kind === 'poo' || r.kind === 'saw') d = Math.min(d, Math.hypot(r.x - sx, r.y - sy));
    for (const z of this.hazards) if (z.y < sy + 40) d = Math.min(d, Math.abs(z.x - sx) * 1.5);
    return d;
  }

  /**
   * Put a hero at a spawn point: the given one (the start), or a safe one — no bad guys (or their
   * shots, or falling rocks) close — as far from everyone else as can be. If nowhere is safe, the
   * one farthest from trouble.
   */
  private spawn(p: BPlayer, index?: number) {
    let best = ARENA_SPAWNS[0];
    if (index !== undefined) best = ARENA_STARTS[index % ARENA_STARTS.length];
    else {
      let bestScore = -Infinity;
      for (const s of ARENA_SPAWNS) {
        const sx = (s[0] + 0.5) * TILE_PX;
        const sy = (this.map.h - s[1]) * TILE_PX;
        let d = Infinity;
        for (const o of this.players.values()) if (o !== p && o.respawn <= 0) d = Math.min(d, Math.hypot(o.x - sx, o.y - sy));
        const danger = this.dangerAt(sx, sy);
        // (safe spots always beat unsafe ones; among the safe, the farthest from the others)
        const score = danger >= SAFE_SPAWN ? 1e7 + Math.min(d, 1e6) : danger;
        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }
    }
    p.x = (best[0] + 0.5) * TILE_PX;
    p.y = (this.map.h - best[1]) * TILE_PX;
    p.vx = 0;
    p.vy = 0;
    p.hp = HEARTS;
    p.facing = p.x < this.map.widthPx / 2 ? 1 : -1;
    p.stamina = 1;
    p.exhausted = false;
    p.stun = 0;
    p.onGround = true;
    p.bombs = 0;
    p.power = 0;
    p.powerT = 0;
    p.frozen = 0;
  }

  /** Most shots in the air at once (rapid fire allows more). */
  private maxShots(p: BPlayer) {
    return charOf(p.hero).maxRockets + (p.power === POWER.rapid ? 3 : 0);
  }

  /** One tick. `inputs` = buttons per player id. Returns what happened (for sounds and effects). */
  step(inputs: Map<string, number>): BEvent[] {
    const ev: BEvent[] = [];
    this.tick++;
    this.timeLeft = Math.max(0, this.timeLeft - DT);
    for (const p of this.players.values()) {
      if (p.respawn > 0) {
        p.respawn -= DT;
        if (p.respawn <= 0) {
          p.respawn = 0;
          this.spawn(p);
          p.invuln = SPAWN_INVULN;
          ev.push({ k: 'spawn', id: p.id });
        }
        continue;
      }
      const btn = inputs.get(p.id) ?? 0;
      // holding a chair: FIRE swings it (no rockets)
      const chair = this.chairOf(p.id);
      const swingPress = !!chair && (btn & BTN.fire) !== 0 && !(p.prevBtn & BTN.fire) && p.stun <= 0 && p.frozen <= 0;
      const fire = stepMove(p, btn, this.map, ev, () => !chair && this.rocketsOf(p.id) < this.maxShots(p));
      if (swingPress && chair && chair.swing <= 0) this.swingChair(p, chair, ev);
      if (fire) {
        if (fire === 2) p.bombs--;
        const shot = heroShot(p, fire);
        this.rockets.push({ id: this.nextRocket++, ...shot });
        ev.push({ k: 'fire', id: p.id, x: shot.x, y: shot.y, dir: p.facing, ...(fire === 2 ? { bomb: true } : {}) });
      }
    }
    this.stomps(ev);
    this.stepPrizes(ev);
    this.stepChairs(ev);
    this.starContacts(ev);
    this.stepEnemies(ev);
    this.stepHazards(ev);
    // rockets: speed up, fly straight, blow up on walls, heroes or old age;
    // bombs: arc and bounce, and go off when the fuse runs out (or they hit someone)
    for (const r of this.rockets) {
      let boom = moveShot(r, this.map, ev);
      const enemyShot = r.kind === 'pellet' || r.kind === 'poo' || r.kind === 'saw';
      if (!boom && !enemyShot)
        for (const e of this.enemies) {
          const [w, h] = ENEMY_BOX[e.kind];
          if (Math.abs(r.x - e.x) < w / 2 + 6 && r.y > e.y - h - 3 && r.y < e.y + 3) {
            boom = true;
            break;
          }
        }
      if (!boom && (r.kind === 'rocket' || r.kind === 'fire' || enemyShot || r.age > 0.2))
        for (const p of this.players.values()) {
          if (p.id === r.owner || p.respawn > 0) continue;
          const c = charOf(p.hero);
          const k = sizeOf(p);
          if (Math.abs(r.x - p.x) < boxW(c, k) / 2 + 6 && r.y > p.y - boxH(c, k) - 3 && r.y < p.y + 3) {
            boom = true;
            break;
          }
        }
      if (boom) {
        r.age = -1; // mark
        this.explode(r, ev);
      }
    }
    this.rockets = this.rockets.filter((r) => r.age >= 0);
    return ev;
  }

  private explode(r: BRocket, ev: BEvent[]) {
    const bx = r.x + (r.kind === 'rocket' ? r.dir * 6 : 0);
    ev.push({ k: 'boom', x: bx, y: r.y, r: r.radius });
    // heroes' blasts pop the bad guys too
    if (r.kind !== 'pellet' && r.kind !== 'poo' && r.kind !== 'saw')
      for (const e of this.enemies) {
        const [w, h] = ENEMY_BOX[e.kind];
        const d = Math.hypot(e.x - bx, e.y - h / 2 - r.y);
        if (d < r.radius + Math.max(w, h) / 2) this.hurtEnemy(e, r.damage, ev);
      }
    for (const p of this.players.values()) {
      if (p.id === r.owner || p.respawn > 0) continue;
      const c = charOf(p.hero);
      const k = sizeOf(p);
      const cy = p.y - boxH(c, k) / 2;
      const d = Math.hypot(p.x - bx, cy - r.y);
      if (d > r.radius + Math.max(boxW(c, k), boxH(c, k)) / 2) continue;
      this.hurt(p, r.owner, bx, r.damage, r.damage > 1 ? 1.3 : 1, ev);
    }
  }

  /** Take hearts off a hero (unless they can't be hurt right now) and knock them back. */
  private hurt(p: BPlayer, by: string, fromX: number, damage: number, knock: number, ev: BEvent[]): boolean {
    if (p.respawn > 0 || p.invuln > 0 || p.power === POWER.star) return false;
    // grown: bad guys and things from the sky can't hurt you, only another hero can
    if (p.power === POWER.grow && !this.players.has(by)) return false;
    p.hp -= damage;
    p.lastHitBy = by;
    const away = Math.sign(p.x - fromX) || 1;
    // big heroes are harder to push about (grown, or Big Muscles)
    const heavy = (p.power === POWER.grow ? 0.6 : 1) * (charOf(p.hero).knockback ?? 1);
    p.vx = away * 280 * knock * heavy;
    p.vy = -400 * knock * heavy;
    p.onGround = false;
    p.stun = HIT_STUN;
    p.invuln = HIT_INVULN;
    ev.push({ k: 'hit', id: p.id, by });
    if (p.hp <= 0) {
      p.hp = 0;
      p.respawn = RESPAWN_SECS;
      p.deaths++;
      this.dropChairOf(p.id);
      const killer = this.players.get(by);
      let gift = false;
      if (killer) killer.kos++;
      // knocked out by a bad guy or something from the sky (not a friend): you lose a point; with
      // none to lose, everyone else gets one instead
      else if (p.kos > 0) p.kos--;
      else {
        gift = true;
        for (const q of this.players.values()) if (q !== p) q.kos++;
      }
      ev.push({ k: 'ko', id: p.id, by, gift });
    }
    return true;
  }

  /** Swing the chair: everyone (and every bad guy) just in front gets it — 1 heart each. */
  /** Just grown: if there's no room for the bigger you here (a low ceiling), step aside to where there is. */
  private makeRoom(p: BPlayer) {
    const c = charOf(p.hero);
    const k = sizeOf(p);
    const w = boxW(c, k);
    const h = boxH(c, k);
    const fits = (x: number) => {
      for (let y = p.y - h + 1; y < p.y - 1; y += 8) for (const dx of [-w / 2 + 1, 0, w / 2 - 1]) if (this.map.solidAt(x + dx, y)) return false;
      return this.map.solidAt(x - w / 2 + 1, p.y - h + 1) === false && this.map.solidAt(x + w / 2 - 1, p.y - h + 1) === false;
    };
    if (fits(p.x)) return;
    for (let d = 8; d <= TILE_PX * 6; d += 8)
      for (const s of [1, -1]) {
        const x = p.x + s * d;
        if (fits(x)) {
          p.x = x;
          return;
        }
      }
  }

  private swingChair(p: BPlayer, chair: BChair, ev: BEvent[]) {
    chair.swing = CHAIR_SWING;
    ev.push({ k: 'chairswing', id: p.id });
    const k = sizeOf(p);
    const reach = CHAIR_REACH * k;
    const my = p.y - boxH(charOf(p.hero), k) / 2;
    let hit = false;
    let hx = p.x + p.facing * reach * 0.6;
    let hy = my;
    for (const o of this.players.values()) {
      if (o === p || o.respawn > 0) continue;
      const oc = charOf(o.hero);
      const ok = sizeOf(o);
      const dx = (o.x - p.x) * p.facing;
      const oy = o.y - boxH(oc, ok) / 2;
      if (dx < -8 || dx > reach + boxW(oc, ok) / 2 || Math.abs(oy - my) > 30 * k + boxH(oc, ok) / 2) continue;
      if (this.hurt(o, p.id, p.x, 1, 1.2, ev)) {
        hit = true;
        hx = o.x;
        hy = oy;
      }
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const [w, h] = ENEMY_BOX[e.kind];
      const dx = (e.x - p.x) * p.facing;
      // (bad guys: as far as the chair reaches on screen, and one right up against you counts;
      // one still floating down on its parachute, up over your head too: the chair comes over the top)
      const dy = e.y - h / 2 - my;
      const band = 34 * k + h / 2;
      if (dx < -18 || dx > reach * 1.35 + w / 2 || dy > band || dy < -band - (e.chute ? 60 * k : 0)) continue;
      this.hurtEnemy(e, 1, ev);
      hit = true;
      hx = e.x;
      hy = e.y - h / 2;
    }
    if (!hit) return;
    chair.uses--;
    const broke = chair.uses <= 0;
    ev.push({ k: 'chairhit', id: p.id, x: hx, y: hy, broke });
    if (broke) this.chairs = this.chairs.filter((c) => c !== chair);
  }

  /** The chairs: fall in at their times, lie about till someone grabs one, go along with whoever holds it. */
  private stepChairs(ev: BEvent[]) {
    if (this.chairAt.length && this.timeLeft <= this.chairAt[0]) {
      this.chairAt.shift();
      // anywhere along the arena (not just near someone: worth running for), clear of the walls — and
      // only where it comes down on the floor itself (not on an island, a little wall or the rises at the ends)
      let tx = 3;
      for (let tries = 0; tries < 60; tries++) {
        tx = Math.floor(3 + Math.random() * (this.map.widthPx / TILE_PX - 6));
        let high = false;
        for (let ty = 0; ty < this.map.h - 2; ty++) if (this.map.solid(tx, ty)) high = true;
        if (!high) break;
      }
      const x = (tx + 0.5) * TILE_PX;
      this.chairs.push({ id: this.nextChair++, x, y: -40, vy: 120, landed: false, age: 0, holder: null, uses: CHAIR_USES, swing: 0 });
      ev.push({ k: 'chair', x });
    }
    for (const ch of this.chairs) {
      ch.swing = Math.max(0, ch.swing - DT);
      if (ch.holder) {
        const p = this.players.get(ch.holder);
        if (!p || p.respawn > 0) {
          this.dropChairOf(ch.holder);
          continue;
        }
        ch.x = p.x;
        ch.y = p.y;
        continue;
      }
      ch.age += DT;
      if (!ch.landed) {
        ch.vy = Math.min(MAX_FALL, ch.vy + GRAVITY * 0.7 * DT);
        const prevY = ch.y;
        ch.y += ch.vy * DT;
        const tx = Math.floor(ch.x / TILE_PX);
        const ty = Math.floor(ch.y / TILE_PX);
        const ry = this.map.rampLand(ch.x, prevY, ch.y, ch.vy, false);
        if (ry !== null) {
          ch.y = ry;
          ch.landed = true;
        } else if (ch.vy > 0 && ty >= 0 && this.map.solid(tx, ty)) {
          // (through the clouds: they'd leave it up out of reach)
          ch.y = ty * TILE_PX;
          ch.landed = true;
        }
        if (ch.landed) {
          ch.age = 0;
          ch.vy = 0;
          ev.push({ k: 'chairland', x: ch.x, y: ch.y });
        }
        if (ch.y > this.map.heightPx + 60) ch.age = 1e9;
        continue;
      }
      // lying there: the first hero to touch it (with their hands free) picks it up
      for (const p of this.players.values()) {
        if (p.respawn > 0 || p.frozen > 0 || this.chairOf(p.id)) continue;
        const c = charOf(p.hero);
        const k = sizeOf(p);
        if (Math.abs(p.x - ch.x) < boxW(c, k) / 2 + 24 && ch.y > p.y - boxH(c, k) - 10 && ch.y - 30 < p.y) {
          ch.holder = p.id;
          ev.push({ k: 'chairgrab', id: p.id });
          break;
        }
      }
    }
    this.chairs = this.chairs.filter((ch) => ch.holder || ch.age < (ch.landed ? CHAIR_LIFE : 40));
  }

  /** Coming down on someone's head (a hero or a bad guy): that's a hit, and you bounce off. */
  private stomps(ev: BEvent[]) {
    for (const a of this.players.values()) {
      if (a.respawn > 0 || a.vy < 60 || a.onGround) continue;
      const ca = charOf(a.hero);
      const ka = sizeOf(a);
      const half = boxW(ca, ka) / 2;
      let bounced = false;
      for (const b of this.players.values()) {
        if (b === a || b.respawn > 0) continue;
        const cb = charOf(b.hero);
        const kb = sizeOf(b);
        const top = b.y - boxH(cb, kb);
        if (Math.abs(a.x - b.x) < half + boxW(cb, kb) / 2 - 2 && a.y >= top - 2 && a.y <= top + 16) {
          ev.push({ k: 'stomp', id: a.id, on: b.id, x: b.x, y: top });
          this.hurt(b, a.id, a.x, 1, 0.5, ev);
          bounced = true;
          break;
        }
      }
      if (!bounced)
        for (const e of this.enemies) {
          if (e.chute) continue;
          const [w, h] = ENEMY_BOX[e.kind];
          const top = e.y - h;
          if (Math.abs(a.x - e.x) < half + w / 2 - 2 && a.y >= top - 2 && a.y <= top + 18) {
            ev.push({ k: 'stomp', id: a.id, on: e.id, x: e.x, y: top });
            this.hurtEnemy(e, a.power === POWER.grow ? 2 : 1, ev);
            bounced = true;
            break;
          }
        }
      if (bounced) {
        a.vy = -STOMP_BOUNCE;
        a.airJumps = 1;
        a.y -= 2;
        a.invuln = Math.max(a.invuln, 0.25); // (no getting hurt by the one you just landed on)
      }
    }
  }

  /** Ice: everyone else freezes solid for a moment (unless they're invincible). */
  private freezeOthers(by: BPlayer, ev: BEvent[]) {
    for (const p of this.players.values()) {
      if (p === by || p.respawn > 0 || p.power === POWER.star) continue;
      p.frozen = FREEZE_SECS;
      p.vy = Math.max(p.vy, 0);
    }
    ev.push({ k: 'freeze', by: by.id });
  }

  /** Running into someone while invincible knocks them flying. */
  private starContacts(ev: BEvent[]) {
    for (const a of this.players.values()) {
      if (a.power !== POWER.star || a.respawn > 0) continue;
      const ca = charOf(a.hero);
      for (const b of this.players.values()) {
        if (b === a || b.respawn > 0 || b.invuln > 0 || b.power === POWER.star) continue;
        const cb = charOf(b.hero);
        const kb = sizeOf(b);
        const overlapX = Math.abs(a.x - b.x) < (boxW(ca) + boxW(cb, kb)) / 2;
        const overlapY = a.y - boxH(ca) < b.y && b.y - boxH(cb, kb) < a.y;
        if (overlapX && overlapY) this.hurt(b, a.id, a.x, 1, 1.4, ev);
      }
    }
  }

  /** Prizes float down now and then; whoever gets there first gets it. */
  private stepPrizes(ev: BEvent[]) {
    this.dropIn -= DT;
    if (this.dropIn <= 0) {
      // (still worth fighting over; 15% more often than the old 8–13 s)
      this.dropIn = (8 + Math.random() * 5) / 1.15;
      if (this.prizes.length < MAX_PRIZES) {
        let roll = Math.random() * PRIZE_ODDS.reduce((t, [, w]) => t + w, 0);
        let kind: PrizeKind = 'bomb';
        for (const [k, w] of PRIZE_ODDS) {
          roll -= w;
          if (roll <= 0) {
            kind = k;
            break;
          }
        }
        // somewhere it can land, not right on top of another prize, and only now and
        // then up on the high cloud (never two up there at once)
        let x = 0;
        const high = (px: number) => landingY(this.map, px) < 7 * TILE_PX;
        for (let tries = 0; tries < 16; tries++) {
          x = (Math.floor(this.nearSomeone(ARENA_SECTION * 0.45) / TILE_PX) + 0.5) * TILE_PX;
          if (this.prizes.some((q) => Math.abs(q.x - x) < 90)) continue;
          if (high(x) && (Math.random() < 0.75 || this.prizes.some((q) => high(q.x)))) continue;
          break;
        }
        this.prizes.push({ id: this.nextPrize++, kind, x, y: -24, vy: 40, landed: false, age: 0 });
        ev.push({ k: 'drop', x, kind });
      }
    }
    for (const z of this.prizes) {
      z.age += DT;
      if (!z.landed) {
        // a slow, gentle float down under its parachute (so everyone can race for it)
        z.vy = Math.min(92, z.vy + 180 * DT);
        const prevY = z.y;
        z.y += z.vy * DT;
        const tx = Math.floor(z.x / TILE_PX);
        const ty = Math.floor(z.y / TILE_PX);
        const ry = this.map.rampLand(z.x, prevY, z.y, z.vy, false);
        if (ry !== null) {
          z.y = ry;
          z.landed = true;
          z.age = 0;
        } else if (ty >= 0 && (this.map.solid(tx, ty) || (this.map.oneWay(tx, ty) && prevY <= ty * TILE_PX + 0.5))) {
          z.y = ty * TILE_PX;
          z.landed = true;
          z.age = 0;
        }
      }
      // grabbed?
      for (const p of this.players.values()) {
        if (p.respawn > 0) continue;
        const c = charOf(p.hero);
        const k = sizeOf(p);
        if (Math.abs(p.x - z.x) < boxW(c, k) / 2 + 22 && z.y > p.y - boxH(c, k) - 10 && z.y - 44 < p.y) {
          this.grant(p, z.kind, ev);
          ev.push({ k: 'prize', id: p.id, kind: z.kind, x: z.x, y: z.y });
          z.age = 1e9;
          break;
        }
      }
    }
    // (age counts from when it landed)
    this.prizes = this.prizes.filter((z) => (z.landed ? z.age < PRIZE_LIFE : z.age < 40));
  }

  private grant(p: BPlayer, kind: PrizeKind, ev: BEvent[]) {
    switch (kind) {
      case 'ice':
        this.freezeOthers(p, ev);
        break;
      case 'fire':
        p.power = POWER.fire;
        p.powerT = POWER_SECS[POWER.fire];
        break;
      case 'bomb':
        p.bombs = Math.min(6, p.bombs + BOMBS_PER_PRIZE);
        break;
      case 'heart':
        p.hp = Math.min(HEARTS, p.hp + 1);
        break;
      case 'star':
        p.power = POWER.star;
        p.powerT = POWER_SECS[POWER.star];
        break;
      case 'grow':
        p.power = POWER.grow;
        p.powerT = POWER_SECS[POWER.grow];
        this.makeRoom(p);
        break;
      case 'rapid':
        p.power = POWER.rapid;
        p.powerT = POWER_SECS[POWER.rapid];
        break;
    }
  }

  /**
   * Somewhere near one of the heroes (the arena is four screens wide: things turn up where people
   * are, not off in an empty corner), within `span` tiles either side, clear of the walls (world px).
   */
  private nearSomeone(span: number, margin = 2) {
    const heroes = [...this.players.values()].filter((p) => p.respawn <= 0);
    const T = TILE_PX;
    const lo = margin * T;
    const hi = this.map.widthPx - margin * T;
    if (!heroes.length) return lo + Math.random() * (hi - lo);
    const p = heroes[Math.floor(Math.random() * heroes.length)];
    return Math.max(lo, Math.min(hi, p.x + (Math.random() * 2 - 1) * span * T));
  }

  // ── bad guys ──

  /** Room for one more? Two at once (three with 3+ players), at most one of them big. */
  private enemyBudget(): EnemyKind | null {
    // (the arena's four screens wide: a few more about, so there's some near everyone)
    if (this.enemies.length >= Math.min(3, Math.max(2, this.players.size))) return null;
    const hasBig = this.enemies.some((e) => e.kind === 'big');
    const r = Math.random();
    if (!hasBig && r < 0.32) return 'big';
    return Math.random() < 0.55 ? 'small' : 'medium';
  }

  private spawnEnemy(ev: BEvent[]) {
    const kind = this.enemyBudget();
    if (!kind) return;
    const race: EnemyRace = Math.random() < 0.45 ? 'plop' : 'puff';
    const chute = kind !== 'big' && Math.random() < 0.5;
    const T = TILE_PX;
    let x: number;
    let y: number;
    if (chute) {
      // floats down somewhere near someone
      x = this.nearSomeone(ARENA_SECTION * 0.4, 3);
      y = -20;
    } else {
      // walks in on the floor from just off someone's screen (or from an end of the arena, if that's nearer)
      const heroes = [...this.players.values()].filter((p) => p.respawn <= 0);
      const h = heroes[Math.floor(Math.random() * heroes.length)];
      const side = Math.random() < 0.5 ? -1 : 1;
      x = h ? h.x + side * ARENA_SECTION * 0.6 * T : side < 0 ? 1.5 * T : this.map.widthPx - 1.5 * T;
      x = Math.max(1.5 * T, Math.min(this.map.widthPx - 1.5 * T, x));
      // (standing on whatever's under it: the floor, or a rise)
      let ty = 0;
      const tx = Math.floor(x / T);
      while (ty < this.map.h && !this.map.solid(tx, ty)) ty++;
      y = ty * T;
    }
    // 1 in 3 (not the big ones) carry a weapon: Puff Balls a blaster, chainsaw or ball and chain
    // (small ones just the blaster); Plops any of the three. Armed ones take one more hit.
    let weapon: EnemyWeapon | null = null;
    if (kind !== 'big' && Math.random() < 1 / 3) {
      const opts: EnemyWeapon[] = kind === 'small' && race === 'puff' ? ['gun'] : ['gun', 'saw', 'flail'];
      weapon = opts[Math.floor(Math.random() * opts.length)];
    }
    const hp = (kind === 'big' ? 5 : kind === 'medium' ? 2 : 1) + (weapon ? 1 : 0);
    // (heading towards the nearest hero)
    let near: BPlayer | null = null;
    for (const p of this.players.values()) if (p.respawn <= 0 && (!near || Math.abs(p.x - x) < Math.abs(near.x - x))) near = p;
    const dir: 1 | -1 = near ? (near.x >= x ? 1 : -1) : x < this.map.widthPx / 2 ? 1 : -1;
    this.enemies.push({ id: this.nextThing++, kind, race, weapon, x, y, vx: 0, vy: 0, dir, hp, onGround: !chute, armed: !!weapon, chute, fireCd: 1.5 + Math.random(), jumpCd: 1, hop: 1, hurtT: 0 });
    ev.push({ k: 'espawn', kind, x, chute });
  }

  private hurtEnemy(e: BEnemy, n: number, ev: BEvent[]) {
    if (e.hp <= 0) return;
    e.hp -= n;
    e.hurtT = 0.12;
    if (e.hp <= 0) ev.push({ k: 'edie', kind: e.kind, x: e.x, y: e.y - ENEMY_BOX[e.kind][1] / 2 });
    else ev.push({ k: 'ehit', id: e.id });
  }

  private nearest(x: number, y: number) {
    let best: BPlayer | null = null;
    let bd = Infinity;
    for (const p of this.players.values()) {
      if (p.respawn > 0) continue;
      const d = Math.hypot(p.x - x, (p.y - y) * 1.4);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /** Where a ball-and-chain's ball is right now (it swings round the bad guy's hand). */
  flailBall(e: BEnemy) {
    const [, h] = ENEMY_BOX[e.kind];
    const a = this.tick * 0.16 + e.id * 1.7;
    const R = e.kind === 'small' ? 34 : 46;
    return { x: e.x + Math.cos(a) * R, y: e.y - h * 0.55 + Math.sin(a) * R * 0.8, a };
  }

  /** Lob something at (tx, ty) from (x, y): poo, or a thrown chainsaw. */
  private lob(e: BEnemy, kind: 'poo' | 'saw', x: number, y: number, tx: number, ty: number, ev: BEvent[]) {
    const tFlight = 0.85;
    const g = kind === 'saw' ? 900 : 1150;
    const vx = Math.max(-420, Math.min(420, (tx - x) / tFlight));
    const vy = Math.max(-720, Math.min(-260, (ty - 20 - y) / tFlight - 0.5 * g * tFlight));
    const big = e.kind === 'big';
    this.rockets.push({ id: this.nextRocket++, owner: `e${e.id}`, kind, x, y, vx, vy, dir: vx >= 0 ? 1 : -1, age: 0, speed: 0, radius: kind === 'saw' ? 26 : big ? 34 : 22, damage: 1 });
    ev.push({ k: 'throw', x, y, kind });
  }

  private stepEnemies(ev: BEvent[]) {
    this.enemyIn -= DT;
    if (this.enemyIn <= 0) {
      this.enemyIn = 13 + Math.random() * 10; // (every 18 s on average, was 13.5)
      this.spawnEnemy(ev);
    }
    const T = TILE_PX;
    for (const e of this.enemies) {
      const [w, h] = ENEMY_BOX[e.kind];
      e.hurtT = Math.max(0, e.hurtT - DT);
      e.jumpCd -= DT;
      e.fireCd -= DT;
      const tgt = this.nearest(e.x, e.y);
      if (e.chute) {
        // drifting down, swaying a little
        e.vy = 55;
        e.vx = Math.sin((this.tick + e.id * 17) * 0.06) * 30;
      } else {
        const dx = tgt ? tgt.x - e.x : 0;
        const dy = tgt ? tgt.y - e.y : 0;
        if (tgt && Math.abs(dx) > 8) e.dir = dx > 0 ? 1 : -1;
        let speed = e.kind === 'big' ? 55 : e.kind === 'medium' ? 82 : 70;
        if (e.weapon === 'saw') speed *= 1.35; // chainsaw ones chase harder
        // hurt twice, a chainsaw one loses its temper and THROWS the chainsaw at you
        if (e.weapon === 'saw' && e.hp <= 1 && tgt) {
          e.weapon = null;
          this.lob(e, 'saw', e.x + e.dir * w * 0.5, e.y - h * 0.5, tgt.x, tgt.y - 16, ev);
        }
        // a blaster: plant your feet and shoot when there's a clear line
        const aiming = e.weapon === 'gun' && tgt && Math.abs(dy) < 70 && Math.abs(dx) < 360;
        // a Plop (no weapon) throws poo, in an arc
        const throwing = e.race === 'plop' && !e.weapon && tgt && Math.abs(dx) < 430 && Math.abs(dx) > 40 && dy > -220;
        if (e.onGround) e.vx = (aiming || throwing) && e.fireCd < 0.4 ? 0 : e.dir * speed;
        if (aiming && e.fireCd <= 0) {
          e.fireCd = 2.4 + Math.random() * 0.8;
          const mx = e.x + e.dir * w * 0.7;
          const my = e.y - h * 0.5;
          this.rockets.push({ id: this.nextRocket++, owner: `e${e.id}`, kind: 'pellet', x: mx, y: my, vx: e.dir * 300, vy: 0, dir: e.dir, age: 0, speed: 300, radius: 14, damage: 1 });
          ev.push({ k: 'eshot', x: mx, y: my, dir: e.dir });
        }
        if (throwing && e.fireCd <= 0 && e.onGround) {
          e.fireCd = (e.kind === 'big' ? 1.8 : 2.3) + Math.random() * 1;
          this.lob(e, 'poo', e.x + e.dir * w * 0.3, e.y - h * 0.8, tgt.x, tgt.y, ev);
        }
        // hop up steps, over gaps and up to you: if you're on a higher level they jump
        // for it (up through clouds and the island from underneath), with a second
        // hop near the top of the jump if you're still above them
        const ahead = e.x + e.dir * (w / 2 + 4);
        const wall = this.map.solidAt(ahead, e.y - 4);
        const higher = tgt ? tgt.y < e.y - 40 && Math.abs(dx) < 260 : false;
        if (e.onGround && e.jumpCd <= 0 && (wall || higher || (e.kind === 'big' && Math.random() < 0.01))) {
          e.vy = e.kind === 'big' ? -730 : -710;
          e.onGround = false;
          e.hop = 1;
          e.jumpCd = e.kind === 'big' ? 1.8 : 0.8;
        } else if (!e.onGround && e.hop > 0 && e.vy > -120 && tgt && tgt.y < e.y - 30) {
          e.vy = e.kind === 'big' ? -620 : -560;
          e.hop = 0;
        }
      }
      // move and land (on solid ground and clouds)
      if (!e.chute) e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * DT);
      const nx = e.x + e.vx * DT;
      if (!this.map.solidAt(nx + Math.sign(e.vx) * (w / 2), e.y - 4) && !this.map.solidAt(nx + Math.sign(e.vx) * (w / 2), e.y - h + 4)) e.x = nx;
      else e.vx = 0;
      e.x = Math.max(w / 2 + 2, Math.min(this.map.widthPx - w / 2 - 2, e.x));
      const prevY = e.y;
      e.y += e.vy * DT;
      const wasAir = !e.onGround;
      e.onGround = false;
      const onRamp = this.map.rampLand(e.x, prevY, e.y, e.vy, !wasAir);
      if (onRamp !== null) {
        e.y = onRamp;
        e.vy = 0;
        e.onGround = true;
        if (e.chute) e.chute = false;
      }
      if (e.vy >= 0 && !e.onGround) {
        const ty = Math.floor(e.y / T);
        for (const tx of [Math.floor((e.x - w / 2 + 2) / T), Math.floor((e.x + w / 2 - 2) / T)])
          if ((this.map.solid(tx, ty) || this.map.oneWay(tx, ty)) && prevY <= ty * T + 0.5) {
            e.y = ty * T;
            e.vy = 0;
            e.onGround = true;
            if (e.chute) e.chute = false;
            // a big one lands with a thump that hurts anyone standing close by
            if (wasAir && e.kind === 'big') {
              ev.push({ k: 'boom', x: e.x, y: e.y - 6, r: 60 });
              for (const p of this.players.values())
                if (p.onGround && Math.abs(p.x - e.x) < 90 && Math.abs(p.y - e.y) < 20) this.hurt(p, 'enemy', e.x, 1, 1, ev);
            }
            break;
          }
      }
      if (e.y > this.map.heightPx + 100) e.hp = 0;
      // bumping into a bad guy hurts (a chainsaw reaches further in front; a ball and chain swings round)
      const ball = e.weapon === 'flail' && !e.chute ? this.flailBall(e) : null;
      for (const p of this.players.values()) {
        if (p.respawn > 0) continue;
        const c = charOf(p.hero);
        const k = sizeOf(p);
        const pw = boxW(c, k);
        const ph = boxH(c, k);
        const reachF = e.weapon === 'saw' ? 22 : 0;
        const front = (p.x - e.x) * e.dir > 0;
        const touch = Math.abs(p.x - e.x) < (pw + w) / 2 - 4 + (front ? reachF : 0) && p.y - ph < e.y - 4 && e.y - h < p.y - 4;
        const ballHit = !!ball && Math.abs(p.x - ball.x) < pw / 2 + 12 && ball.y > p.y - ph - 12 && ball.y < p.y + 6;
        if (touch || ballHit) {
          if (p.power === POWER.star) this.hurtEnemy(e, 5, ev);
          else this.hurt(p, 'enemy', ballHit ? ball!.x : e.x, 1, 1, ev);
        }
      }
    }
    this.keepApart();
    this.enemies = this.enemies.filter((e) => e.hp > 0);
  }

  /**
   * Bad guys don't stand in each other: two chasing the same hero used to slide into the very same
   * spot and go about as one lump (looking stuck together). Ones on about the same level that
   * overlap get eased apart, a bit each tick (not into walls), so they come along side by side.
   */
  private keepApart() {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.chute || a.hp <= 0) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.chute || b.hp <= 0) continue;
        const [aw, ah] = ENEMY_BOX[a.kind];
        const [bw, bh] = ENEMY_BOX[b.kind];
        // (only when they're on about the same level: one hopping over another is fine)
        if (Math.abs(a.y - b.y) > Math.min(ah, bh) * 0.6) continue;
        const want = (aw + bw) / 2 * 0.8;
        let dx = b.x - a.x;
        if (Math.abs(dx) >= want) continue;
        if (dx === 0) dx = a.id < b.id ? 1 : -1;
        const push = Math.min((want - Math.abs(dx)) / 2, APART_SPEED * DT) * Math.sign(dx);
        this.nudge(a, -push);
        this.nudge(b, push);
      }
    }
  }

  /** Move a bad guy sideways by dx, unless that's into a wall (or off the arena). */
  private nudge(e: BEnemy, dx: number) {
    const [w, h] = ENEMY_BOX[e.kind];
    const nx = Math.max(w / 2 + 2, Math.min(this.map.widthPx - w / 2 - 2, e.x + dx));
    const edge = nx + Math.sign(dx) * (w / 2);
    if (!this.map.solidAt(edge, e.y - 4) && !this.map.solidAt(edge, e.y - h + 4)) e.x = nx;
  }

  // ── rocks from the sky ──

  private stepHazards(ev: BEvent[]) {
    this.hazardIn -= DT;
    if (this.hazardIn <= 0) {
      // (half as often as they were: 2.2–4.5 s → 4.4–9 s)
      this.hazardIn = 4.4 + Math.random() * 4.6;
      // now and then a shower of two or three
      const n = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let i = 0; i < n; i++) {
        const x = this.nearSomeone(ARENA_SECTION * 0.45);
        // (rocks only: no more anvils)
        this.hazards.push({ id: this.nextThing++, kind: 'rock', big: Math.random() < 1 / 3, x, y: -40, vx: 0, vy: 0, warn: 1.1 + i * 0.35, rolling: 0 });
      }
    }
    const T = TILE_PX;
    for (const z of this.hazards) {
      if (z.warn > 0) {
        z.warn -= DT;
        continue;
      }
      const r = hazardR(z);
      const dmg = z.kind === 'anvil' || z.big ? 2 : 1;
      if (z.rolling > 0) {
        // a big boulder rolling down the ramp, then along the floor until it stops and crumbles
        z.rolling += DT;
        const ry = this.map.rampY(z.x);
        if (ry !== null) {
          z.vx = Math.max(-360, Math.min(360, z.vx + this.rampDownhill(z.x) * 380 * DT));
          z.x += z.vx * DT;
          z.y = this.map.rampY(z.x) ?? z.y;
        } else {
          z.vx *= Math.pow(0.35, DT); // slows on the flat
          const nx = z.x + z.vx * DT;
          if (this.map.solidAt(nx + Math.sign(z.vx) * r * 0.8, z.y - 6)) z.vx = 0; // (stops against a wall or step)
          else z.x = nx;
          z.y = landingY(this.map, z.x);
        }
        // anyone in its way gets bowled over
        for (const p of this.players.values()) {
          if (p.respawn > 0) continue;
          const c = charOf(p.hero);
          const k = sizeOf(p);
          if (Math.abs(p.x - z.x) < boxW(c, k) / 2 + r && p.y > z.y - r * 2 && p.y - boxH(c, k) < z.y) this.hurt(p, 'sky', z.x - Math.sign(z.vx) * 20, 1, 1.1, ev);
        }
        for (const e of this.enemies) {
          const [w, h] = ENEMY_BOX[e.kind];
          if (Math.abs(e.x - z.x) < w / 2 + r && e.y > z.y - r * 2 && e.y - h < z.y) this.hurtEnemy(e, 1, ev);
        }
        if (Math.abs(z.vx) < 25 || z.rolling > 6) {
          ev.push({ k: 'crash', kind: z.kind, x: z.x, y: z.y, big: true });
          z.warn = -99;
        }
        continue;
      }
      // (a touch slower than everything else falls: time to get out of the way)
      z.vy = Math.min(340, z.vy + 420 * DT);
      const prevY = z.y;
      z.y += z.vy * DT;
      // anyone underneath gets bonked (anvils and big ones hurt more)
      for (const p of this.players.values()) {
        if (p.respawn > 0) continue;
        const c = charOf(p.hero);
        const k = sizeOf(p);
        if (Math.abs(p.x - z.x) < boxW(c, k) / 2 + r && z.y > p.y - boxH(c, k) && z.y - r * 2 < p.y) this.hurt(p, 'sky', z.x, dmg, 0.8, ev);
      }
      for (const e of this.enemies) {
        const [w, h] = ENEMY_BOX[e.kind];
        if (Math.abs(e.x - z.x) < w / 2 + r && z.y > e.y - h && z.y - r * 2 < e.y) this.hurtEnemy(e, z.kind === 'anvil' ? 3 : dmg, ev);
      }
      const ty = Math.floor(z.y / T);
      const tx = Math.floor(z.x / T);
      const ry = this.map.rampLand(z.x, prevY, z.y, z.vy, false);
      if (ry !== null) {
        if (z.kind === 'rock' && z.big) {
          // a big boulder on the ramp: it rolls down
          z.y = ry;
          z.vy = 0;
          z.vx = this.rampDownhill(z.x) * 60;
          z.rolling = DT;
          ev.push({ k: 'crash', kind: z.kind, x: z.x, y: ry, big: true, roll: true });
        } else {
          ev.push({ k: 'crash', kind: z.kind, x: z.x, y: ry, big: z.big });
          z.warn = -99;
        }
      } else if (z.y > 0 && (this.map.solid(tx, ty) || (this.map.oneWay(tx, ty) && prevY <= ty * T + 0.5))) {
        ev.push({ k: 'crash', kind: z.kind, x: z.x, y: ty * T, big: z.big });
        z.warn = -99; // done
      }
    }
    this.hazards = this.hazards.filter((z) => z.warn > -50);
  }

  /** Which way is downhill on the ramp at x (-1 left, 1 right). */
  private rampDownhill(x: number) {
    const r = this.map.ramps.find((q) => x >= q.x0 && x <= q.x1 + q.flat);
    if (!r) return 0;
    return r.y0 > r.y1 ? -1 : 1;
  }

  /** Where something dropped at x first lands (top of the first ground or cloud below the sky). */
  landingY(x: number) {
    return landingY(this.map, x);
  }

  rocketsOf(id: string) {
    let n = 0;
    for (const r of this.rockets) if (r.owner === id) n++;
    return n;
  }

  /** Someone reached the winning number of knock-outs, or time is up. */
  get over() {
    if (this.timeLeft <= 0) return true;
    for (const p of this.players.values()) if (p.kos >= WIN_KOS) return true;
    return false;
  }
}
