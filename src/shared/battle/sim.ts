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
import { ARENA_RAMPS, ARENA_SPAWNS, type Ramp } from './arena';

export const TICK_HZ = 30;
export const DT = 1 / TICK_HZ;
export const TILE_PX = 32;
export const HEARTS = 3;
/** 2½ minutes (the battle song is cued to end exactly on 0). */
export const MATCH_SECS = 150;
export const WIN_KOS = 5;
export const RESPAWN_SECS = 2.4;

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
  ['bomb', 24],
  ['rapid', 22],
  ['grow', 20],
  ['star', 16],
  ['heart', 18],
];
/** Timed powers: 0 none, 1 star (invincible), 2 grow (big & strong), 3 rapid fire, 4 fireballs. */
export const POWER = { none: 0, star: 1, grow: 2, rapid: 3, fire: 4 } as const;
const POWER_SECS: Record<number, number> = { 1: 14, 2: 8, 3: 7, 4: 8 };
/** Grabbing ice freezes everyone else this long. */
export const FREEZE_SECS = 2;
/** Landing on someone's head: a hit, and you bounce off. */
const STOMP_BOUNCE = 560;
/** How much bigger "grow" makes you. */
export const GROW = 1.8;
const BOMBS_PER_PRIZE = 3;
const MAX_PRIZES = 2;
/** Once it has landed, a prize waits this long (blinking at the end), then it's gone. */
export const PRIZE_LIFE = 7;

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

export type BEvent =
  | { k: 'fire'; id: string; x: number; y: number; dir: 1 | -1; bomb?: boolean }
  | { k: 'jump'; id: string; air: boolean }
  | { k: 'boom'; x: number; y: number; r: number }
  | { k: 'hit'; id: string; by: string }
  | { k: 'ko'; id: string; by: string | null }
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
  | { k: 'crash'; kind: 'rock' | 'anvil'; x: number; y: number; big?: boolean; roll?: boolean };

const charOf = (hero: string): CharacterDef => CHARACTERS.find((c) => c.id === hero) ?? CHARACTERS[0];
/** How big this hero is right now ("grow" makes you bigger). */
export const sizeOf = (p: { power: number }) => (p.power === POWER.grow ? GROW : 1);
const boxW = (c: CharacterDef, k = 1) => (c.hitW ?? 22) * k;
const boxH = (c: CharacterDef, k = 1) => (c.hitH ?? 34) * k;

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
export class BattleSim {
  readonly map: ArenaMap;
  players = new Map<string, BPlayer>();
  rockets: BRocket[] = [];
  prizes: BPrize[] = [];
  enemies: BEnemy[] = [];
  hazards: BHazard[] = [];
  tick = 0;
  timeLeft = MATCH_SECS;
  private nextRocket = 1;
  private nextPrize = 1;
  private dropIn = 3;
  private nextThing = 1;
  private enemyIn = 7;
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
    this.players.delete(id);
  }

  /** Put a hero at a spawn point: the given one, or the one farthest from everyone else. */
  private spawn(p: BPlayer, index?: number) {
    let best = ARENA_SPAWNS[0];
    if (index !== undefined) best = ARENA_SPAWNS[index % ARENA_SPAWNS.length];
    else {
      let bestD = -1;
      for (const s of ARENA_SPAWNS) {
        const sx = (s[0] + 0.5) * TILE_PX;
        const sy = (this.map.h - s[1]) * TILE_PX;
        let d = Infinity;
        for (const o of this.players.values()) if (o !== p && o.respawn <= 0) d = Math.min(d, Math.hypot(o.x - sx, o.y - sy));
        if (d > bestD) {
          bestD = d;
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
      const c = charOf(p.hero);
      const fire = stepMove(p, inputs.get(p.id) ?? 0, this.map, ev, () => this.rocketsOf(p.id) < this.maxShots(p));
      if (fire) {
        const k = sizeOf(p);
        const s = c.scale * k;
        const rx = p.x + p.facing * 18 * s;
        const ry = p.y - (c.muzzleY ?? 18) * k;
        const big = p.power === POWER.grow;
        if (fire === 2) {
          // a lobbed bomb: bounces about, then a big blast
          p.bombs--;
          this.rockets.push({ id: this.nextRocket++, owner: p.id, kind: 'bomb', x: rx, y: ry, vx: p.facing * 300 + p.vx * 0.35, vy: -430, dir: p.facing, age: 0, speed: 0, radius: 118 * (big ? 1.25 : 1), damage: 2 });
          ev.push({ k: 'fire', id: p.id, x: rx, y: ry, dir: p.facing, bomb: true });
        } else if (p.power === POWER.fire) {
          // a fireball: lobbed forward, it arcs down and bursts into flames
          this.rockets.push({ id: this.nextRocket++, owner: p.id, kind: 'fire', x: rx, y: ry, vx: p.facing * 430 + p.vx * 0.3, vy: -300, dir: p.facing, age: 0, speed: 0, radius: 58, damage: 1 });
          ev.push({ k: 'fire', id: p.id, x: rx, y: ry, dir: p.facing });
        } else {
          this.rockets.push({ id: this.nextRocket++, owner: p.id, kind: 'rocket', x: rx, y: ry, vx: p.facing * c.rocketSpeed * 0.45, vy: 0, dir: p.facing, age: 0, speed: c.rocketSpeed, radius: c.blastRadius * (big ? 1.4 : 1), damage: big ? 2 : 1 });
          ev.push({ k: 'fire', id: p.id, x: rx, y: ry, dir: p.facing });
        }
      }
    }
    this.stomps(ev);
    this.stepPrizes(ev);
    this.starContacts(ev);
    this.stepEnemies(ev);
    this.stepHazards(ev);
    // rockets: speed up, fly straight, blow up on walls, heroes or old age;
    // bombs: arc and bounce, and go off when the fuse runs out (or they hit someone)
    for (const r of this.rockets) {
      r.age += DT;
      let boom = false;
      if (r.kind === 'bomb') {
        r.vy = Math.min(MAX_FALL, r.vy + GRAVITY * DT);
        const nx = r.x + r.vx * DT;
        if (this.map.solidAt(nx + Math.sign(r.vx) * 7, r.y)) r.vx *= -0.5;
        else r.x = nx;
        const prevY = r.y;
        r.y += r.vy * DT;
        const ty = Math.floor((r.y + 7) / TILE_PX);
        const tx = Math.floor(r.x / TILE_PX);
        if (r.vy > 0 && (this.map.solid(tx, ty) || (this.map.oneWay(tx, ty) && prevY + 7 <= ty * TILE_PX + 0.5))) {
          r.y = ty * TILE_PX - 7;
          if (r.vy > 160) ev.push({ k: 'bounce', x: r.x, y: r.y });
          r.vy = r.vy > 160 ? -r.vy * 0.45 : 0;
          r.vx *= 0.72;
        }
        boom = r.age > 1.6 || r.y > this.map.heightPx + 60;
      } else if (r.kind === 'fire' || r.kind === 'poo' || r.kind === 'saw') {
        // lobbed things: an arc, and they burst (or splat) on whatever they land on
        r.vy = Math.min(MAX_FALL, r.vy + (r.kind === 'saw' ? 900 : 1150) * DT);
        const prevY = r.y;
        r.x += r.vx * DT;
        r.y += r.vy * DT;
        const tx = Math.floor(r.x / TILE_PX);
        const ty = Math.floor(r.y / TILE_PX);
        const landed = r.vy > 0 && this.map.oneWay(tx, ty) && prevY <= ty * TILE_PX + 0.5;
        boom = r.age > 2.4 || r.x < -40 || r.x > this.map.widthPx + 40 || r.y > this.map.heightPx + 40 || this.map.solidAt(r.x, r.y) || landed;
      } else {
        if (r.kind === 'rocket') r.vx += (r.dir * r.speed - r.vx) * Math.min(1, DT * 7);
        r.x += r.vx * DT;
        boom = r.age > ROCKET_LIFE * (r.kind === 'pellet' ? 1.6 : 1) || r.x < -40 || r.x > this.map.widthPx + 40 || this.map.solidAt(r.x + r.dir * 6, r.y);
      }
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
  private hurt(p: BPlayer, by: string, fromX: number, damage: number, knock: number, ev: BEvent[]) {
    if (p.respawn > 0 || p.invuln > 0 || p.power === POWER.star) return;
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
      const killer = this.players.get(by);
      if (killer) killer.kos++;
      // knocked out by a bad guy or something from the sky (not a friend): you lose a point (never below 0)
      else p.kos = Math.max(0, p.kos - 1);
      ev.push({ k: 'ko', id: p.id, by });
    }
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
      this.dropIn = 7 + Math.random() * 5;
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
          x = (2 + Math.floor(Math.random() * (this.map.w - 4)) + 0.5) * TILE_PX;
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
        break;
      case 'rapid':
        p.power = POWER.rapid;
        p.powerT = POWER_SECS[POWER.rapid];
        break;
    }
  }

  // ── bad guys ──

  /** Room for one more? Up to three at once, at most one of them big. */
  private enemyBudget(): EnemyKind | null {
    if (this.enemies.length >= 3) return null;
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
      // floats down somewhere over the arena
      x = (3 + Math.random() * (this.map.w - 6)) * T;
      y = -20;
    } else {
      // walks in from one side, on the raised ends of the floor
      const left = Math.random() < 0.5;
      x = left ? 1.5 * T : this.map.widthPx - 1.5 * T;
      y = (this.map.h - 3) * T;
    }
    // 1 in 3 (not the big ones) carry a weapon: Puff Balls a blaster, chainsaw or ball and chain
    // (small ones just the blaster); Plops any of the three. Armed ones take one more hit.
    let weapon: EnemyWeapon | null = null;
    if (kind !== 'big' && Math.random() < 1 / 3) {
      const opts: EnemyWeapon[] = kind === 'small' && race === 'puff' ? ['gun'] : ['gun', 'saw', 'flail'];
      weapon = opts[Math.floor(Math.random() * opts.length)];
    }
    const hp = (kind === 'big' ? 5 : kind === 'medium' ? 2 : 1) + (weapon ? 1 : 0);
    const dir: 1 | -1 = x < this.map.widthPx / 2 ? 1 : -1;
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
      this.enemyIn = 4.5 + Math.random() * 4.5;
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
    this.enemies = this.enemies.filter((e) => e.hp > 0);
  }

  // ── rocks and anvils from the sky ──

  private stepHazards(ev: BEvent[]) {
    this.hazardIn -= DT;
    if (this.hazardIn <= 0) {
      this.hazardIn = 2.2 + Math.random() * 2.3;
      // now and then a shower of two or three
      const n = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let i = 0; i < n; i++) {
        const x = (2 + Math.random() * (this.map.w - 4)) * TILE_PX;
        this.hazards.push({ id: this.nextThing++, kind: Math.random() < 0.35 ? 'anvil' : 'rock', big: Math.random() < 1 / 3, x, y: -40, vx: 0, vy: 0, warn: 1.1 + i * 0.35, rolling: 0 });
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
