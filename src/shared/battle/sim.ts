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
import { ARENA_SPAWNS } from './arena';

export const TICK_HZ = 30;
export const DT = 1 / TICK_HZ;
export const TILE_PX = 32;
export const HEARTS = 3;
export const MATCH_SECS = 120;
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

/** Buttons, as bits (what the game sends the server each tick). */
export const BTN = { left: 1, right: 2, jump: 4, fire: 8, run: 16 } as const;

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
}

export interface BRocket {
  id: number;
  owner: string;
  x: number;
  y: number;
  vx: number;
  dir: 1 | -1;
  age: number;
  speed: number;
  radius: number;
}

export type BEvent =
  | { k: 'fire'; id: string; x: number; y: number; dir: 1 | -1 }
  | { k: 'jump'; id: string; air: boolean }
  | { k: 'boom'; x: number; y: number; r: number }
  | { k: 'hit'; id: string; by: string }
  | { k: 'ko'; id: string; by: string | null }
  | { k: 'spawn'; id: string };

const charOf = (hero: string): CharacterDef => CHARACTERS.find((c) => c.id === hero) ?? CHARACTERS[0];
const boxW = (c: CharacterDef) => c.hitW ?? 22;
const boxH = (c: CharacterDef) => c.hitH ?? 34;

function approach(v: number, target: number, step: number) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

/** Collision against the arena's tiles. */
export class ArenaMap {
  readonly w: number;
  readonly h: number;
  readonly widthPx: number;
  readonly heightPx: number;
  constructor(readonly data: LevelData) {
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
}

export function newPlayer(id: string, hero: string, slot: number): BPlayer {
  return {
    id, hero, slot, x: 0, y: 0, vx: 0, vy: 0, facing: 1, onGround: false, airJumps: 1, coyote: 0, jumpBuf: 0,
    jumping: false, prevBtn: 0, fireCd: 0, stamina: 1, exhausted: false, running: false, stun: 0, invuln: 0,
    shotAgo: 9, hp: HEARTS, respawn: 0, kos: 0, deaths: 0, lastHitBy: null,
  };
}

/**
 * Move one hero one tick with these buttons (no other players involved), so
 * the game can run exactly this for its own hero ahead of the server.
 * Returns true when it wants to fire (the caller makes the rocket).
 */
export function stepMove(p: BPlayer, btn: number, map: ArenaMap, ev?: BEvent[], canFire: () => boolean = () => true): boolean {
  const c = charOf(p.hero);
  const dt = DT;
  if (p.respawn > 0) {
    p.prevBtn = btn;
    return false;
  }
  const jumpHeld = (btn & BTN.jump) !== 0;
  const jumpPressed = jumpHeld && !(p.prevBtn & BTN.jump);
  p.stun = Math.max(0, p.stun - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.shotAgo += dt;
  const ctl = p.stun <= 0;
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
  let fire = false;
  if (ctl && (btn & BTN.fire) && p.fireCd <= 0 && canFire()) {
    p.fireCd = c.fireRate;
    fire = true;
    p.vx -= p.facing * 80; // recoil push
    p.shotAgo = 0;
  }
  p.prevBtn = btn;
  return fire;
}

function moveAndCollide(p: BPlayer, c: CharacterDef, map: ArenaMap) {
  const w = boxW(c);
  const h = boxH(c);
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
  // fell out of the arena (shouldn't happen: there are no pits) — put back on top
  if (p.y > map.heightPx + 200) {
    p.y = 0;
    p.vy = 0;
  }
}

/** The whole match (server side). */
export class BattleSim {
  readonly map: ArenaMap;
  players = new Map<string, BPlayer>();
  rockets: BRocket[] = [];
  tick = 0;
  timeLeft = MATCH_SECS;
  private nextRocket = 1;

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
      const fire = stepMove(p, inputs.get(p.id) ?? 0, this.map, ev, () => this.rocketsOf(p.id) < c.maxRockets);
      if (fire) {
        const s = c.scale;
        const rx = p.x + p.facing * 18 * s;
        const ry = p.y - (c.muzzleY ?? 18);
        this.rockets.push({ id: this.nextRocket++, owner: p.id, x: rx, y: ry, vx: p.facing * c.rocketSpeed * 0.45, dir: p.facing, age: 0, speed: c.rocketSpeed, radius: c.blastRadius });
        ev.push({ k: 'fire', id: p.id, x: rx, y: ry, dir: p.facing });
      }
    }
    // rockets: speed up, fly straight, blow up on walls, heroes or old age
    for (const r of this.rockets) {
      r.age += DT;
      r.vx += (r.dir * r.speed - r.vx) * Math.min(1, DT * 7);
      r.x += r.vx * DT;
      let boom = r.age > ROCKET_LIFE || r.x < -40 || r.x > this.map.widthPx + 40 || this.map.solidAt(r.x + r.dir * 6, r.y);
      if (!boom)
        for (const p of this.players.values()) {
          if (p.id === r.owner || p.respawn > 0) continue;
          const c = charOf(p.hero);
          if (Math.abs(r.x - p.x) < boxW(c) / 2 + 6 && r.y > p.y - boxH(c) - 3 && r.y < p.y + 3) {
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
    const bx = r.x + r.dir * 6;
    ev.push({ k: 'boom', x: bx, y: r.y, r: r.radius });
    for (const p of this.players.values()) {
      if (p.id === r.owner || p.respawn > 0 || p.invuln > 0) continue;
      const c = charOf(p.hero);
      const cy = p.y - boxH(c) / 2;
      const d = Math.hypot(p.x - bx, cy - r.y);
      if (d > r.radius + Math.max(boxW(c), boxH(c)) / 2) continue;
      p.hp -= 1;
      p.lastHitBy = r.owner;
      const away = Math.sign(p.x - bx) || r.dir;
      p.vx = away * 280;
      p.vy = -400;
      p.onGround = false;
      p.stun = HIT_STUN;
      p.invuln = HIT_INVULN;
      ev.push({ k: 'hit', id: p.id, by: r.owner });
      if (p.hp <= 0) {
        p.respawn = RESPAWN_SECS;
        p.deaths++;
        const by = this.players.get(r.owner);
        if (by) by.kos++;
        ev.push({ k: 'ko', id: p.id, by: r.owner });
      }
    }
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
