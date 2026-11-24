/**
 * Messages between the game and the battle server (JSON over a WebSocket at /battle).
 */
import type { BEvent, BPlayer, EnemyKind, PrizeKind, RocketKind } from './sim';

export const MAX_BATTLERS = 4;
/** "Start now" in the countdown skips to this many seconds left: the rumble, 3-2-1, then the curtain. */
export const START_NOW_SECS = 3.5;

/** Each player slot's colour: 1 the normal orange, 2 purple, 3 red, 4 green. */
export const SLOT_COLORS = ['#f28a2e', '#9b6bdf', '#e8484a', '#4cc25e'] as const;
export const SLOT_NAMES = ['Orange', 'Purple', 'Red', 'Green'] as const;

export type Phase = 'lobby' | 'countdown' | 'battle' | 'results';

// ── game → server ──
export type ClientMsg =
  /** `ready`: this game says when it has its battle pictures drawn (see `ready` below); one that doesn't is never waited for. */
  | { t: 'hello'; name: string; hero: string; token: string; wear?: string; ready?: boolean }
  | { t: 'hero'; hero: string }
  | { t: 'name'; name: string }
  /** Buttons for one tick (seq counts up by one per tick). */
  | { t: 'in'; s: number; b: number }
  | { t: 'start' }
  /** Everything for the next battle is drawn, for the players as the room's `prep` numbered them. */
  | { t: 'ready'; r: number }
  /** Leaving on purpose (Back, or closing the page): free my spot now. */
  | { t: 'leave' }
  | { t: 'ping'; c: number };

export interface RoomPlayer {
  id: string;
  name: string;
  hero: string;
  /** What they've got on from the Shop (ids, comma separated; '' nothing). */
  wear: string;
  slot: number;
  connected: boolean;
  /** In the current battle (people who join mid-battle wait for the next one). */
  playing: boolean;
  kos: number;
  deaths: number;
}

export interface RoomState {
  phase: Phase;
  players: RoomPlayer[];
  /** Countdown seconds left (countdown) or seconds until back to the lobby (results). */
  timer: number;
  /** Results: the winner's id (null for a draw). */
  winner: string | null;
  /** Counts up each time the players' pictures change (who's in, their hero, what they've got on): see `ready`. */
  prep?: number;
  /** The countdown's held before its last seconds: this many players' games are still drawing the battle's pictures. */
  waiting?: number;
}

/** A player in a snapshot: their full movement state (so the game can pick up from it exactly). */
export type SnapPlayer = Omit<BPlayer, 'lastHitBy'> & { ack: number };

export interface SnapRocket {
  id: number;
  owner: string;
  kind: RocketKind;
  x: number;
  y: number;
  dir: 1 | -1;
}

/**
 * A bad guy: [id, kind, x, y (feet), dir, flags: 1 on ground · 2 armed · 4 parachute · 8 just hurt,
 * race (0 Puff Ball, 1 Plop), weapon (0 none, 1 blaster, 2 chainsaw, 3 ball and chain),
 * where the ball and chain's ball is (angle)].
 */
export type SnapEnemy = [number, EnemyKind, number, number, 1 | -1, number, number, number, number];
export const WEAPON_CODE = { gun: 1, saw: 2, flail: 3 } as const;
/** Something falling from the sky: [id, kind, x, y, seconds of warning left (> 0: just a shadow), flags: 1 big · 2 rolling]. */
export type SnapHazard = [number, 'rock' | 'anvil', number, number, number, number];

/** A prize in the arena: [id, kind, x, y (bottom), seconds it has been there]. */
export type SnapPrize = [number, PrizeKind, number, number, number];

/** A folding chair: [id, x, y (bottom), who's holding it ('' nobody), hits left, seconds of swing left, seconds lying there (-1 falling)]. */
export type SnapChair = [number, number, number, string, number, number, number];

// ── server → game ──
export type ServerMsg =
  | { t: 'welcome'; id: string }
  | { t: 'full' }
  | { t: 'room'; room: RoomState }
  | { t: 'snap'; k: number; tl: number; p: PackedPlayer[]; r: SnapRocket[]; z: SnapPrize[]; n: SnapEnemy[]; h: SnapHazard[]; c?: SnapChair[]; e: BEvent[] }
  | { t: 'pong'; c: number };

// ── compact player encoding (a snapshot goes out 30 times a second) ──
const NUM_FIELDS = ['x', 'y', 'vx', 'vy', 'facing', 'airJumps', 'coyote', 'jumpBuf', 'prevBtn', 'fireCd', 'stamina', 'stun', 'invuln', 'shotAgo', 'hp', 'respawn', 'kos', 'deaths', 'slot', 'ack', 'bombs', 'power', 'powerT', 'frozen'] as const;
const BOOL_FIELDS = ['onGround', 'jumping', 'exhausted', 'running'] as const;
export type PackedPlayer = [string, string, ...number[]];

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * (straight from the sim's player, with its `ack`: no copies of the player made first — a snapshot goes
 * out 30 times a second per room, and copying each player twice was most of what a tick allocated)
 */
export function packPlayer(p: Omit<SnapPlayer, 'ack'>, ack: number): PackedPlayer {
  let bits = 0;
  for (let i = 0; i < BOOL_FIELDS.length; i++) if (p[BOOL_FIELDS[i]]) bits |= 1 << i;
  // (made at its full length: grown a field at a time, it was copied over and over)
  const out = new Array(NUM_FIELDS.length + 3) as PackedPlayer;
  out[0] = p.id;
  out[1] = p.hero;
  for (let i = 0; i < NUM_FIELDS.length; i++) {
    const f = NUM_FIELDS[i];
    out[2 + i] = r3(f === 'ack' ? ack : (p[f] as number));
  }
  out[2 + NUM_FIELDS.length] = bits;
  return out;
}

export function unpackPlayer(a: PackedPlayer): SnapPlayer {
  const o: Record<string, unknown> = { id: a[0], hero: a[1] };
  NUM_FIELDS.forEach((f, i) => (o[f] = a[2 + i]));
  const bits = a[2 + NUM_FIELDS.length] as number;
  BOOL_FIELDS.forEach((f, i) => (o[f] = (bits & (1 << i)) !== 0));
  return o as unknown as SnapPlayer;
}
