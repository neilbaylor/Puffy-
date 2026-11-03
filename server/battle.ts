/**
 * The battle server: one room (for now) for up to 4 friends.
 *
 * It runs on the same Railway service as the game (server.mjs hands it the
 * HTTP server; it listens for WebSockets at /battle). It runs the real match
 * with the shared battle rules, 30 ticks a second: each game sends its
 * buttons every tick, the server moves everyone, decides hits and knock-outs,
 * and sends everyone the result.
 */
import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { CHARACTERS } from '../src/data/characters';
import { buildArena } from '../src/shared/battle/arena';
import { BattleSim, DT, TICK_HZ } from '../src/shared/battle/sim';
import { MAX_BATTLERS, WEAPON_CODE, packPlayer, type ClientMsg, type Phase, type RoomPlayer, type RoomState, type ServerMsg, type SnapEnemy, type SnapHazard, type SnapPrize } from '../src/shared/battle/protocol';

/** (BATTLE_COUNTDOWN lengthens it, for taking screenshots) */
/** Once two or more friends are in, the next battle counts down from this on its own. */
const AUTO_COUNTDOWN_SECS = Number(process.env.BATTLE_COUNTDOWN) > 0 ? Number(process.env.BATTLE_COUNTDOWN) : 25;
const RESULTS_SECS = 8;
/** A dropped player keeps their place this long (phones drop the connection when backgrounded). */
const REJOIN_SECS = 30;
/** …but in the lobby a dropped player's square empties sooner. */
const LOBBY_REJOIN_SECS = 8;
/** Don't let a player's queued inputs pile up (a laggy phone catching up). */
const MAX_QUEUE = 6;

interface Client {
  id: string;
  token: string;
  ws: WebSocket | null;
  name: string;
  hero: string;
  slot: number;
  playing: boolean;
  /** Buttons waiting to be used, one per tick: [seq, buttons]. */
  queue: [number, number][];
  lastSeq: number;
  lastBtn: number;
  kos: number;
  deaths: number;
  droppedAt: number;
}

const ARENA = buildArena();
/** (BATTLE_LAG_MS adds this much delay each way, to test how it plays on a slow connection) */
const LAG = Math.max(0, Number(process.env.BATTLE_LAG_MS) || 0);
const later = (fn: () => void) => (LAG ? setTimeout(fn, LAG) : fn());
const heroOk = (h: string) => (CHARACTERS.some((c) => c.id === h) ? h : 'puffy');
const cleanName = (n: unknown, slot: number) => {
  const s = String(n ?? '').replace(/[^\p{L}\p{N} _'!.-]/gu, '').trim().slice(0, 10);
  return s || (slot >= 0 ? `Player ${slot + 1}` : 'Fan');
};
/** When the arena's full, this many more can watch (they get the next free spot). */
const MAX_WATCHERS = 8;

function demo(sim: BattleSim) {
  const s = sim as unknown as { spawnEnemy: (ev: unknown[]) => void; enemies: { race: string; weapon: string | null; kind: string; hp: number; armed: boolean; x: number; chute: boolean; y: number; onGround: boolean }[]; enemyIn: number; grant: (p: unknown, k: string, ev: unknown[]) => void };
  s.enemyIn = 1e9;
  const looks: [string, string | null, string, number][] = [['plop', 'saw', 'medium', 600], ['plop', 'flail', 'medium', 820], ['plop', null, 'small', 700], ['puff', 'gun', 'small', 900]];
  for (const [race, weapon, kind, x] of looks) {
    s.spawnEnemy([]);
    const e = s.enemies[s.enemies.length - 1];
    if (!e) continue;
    Object.assign(e, { race, weapon, armed: !!weapon, kind, hp: 9, x, y: 15 * 32, chute: false, onGround: true });
  }
  const ps = [...sim.players.values()];
  if (process.env.BATTLE_DEMO === 'buttons') {
    // the first player is carrying bombs and has fireballs (to see the buttons)
    if (ps[0]) {
      s.grant(ps[0], 'fire', []);
      ps[0].bombs = 3;
    }
    return;
  }
  if (process.env.BATTLE_DEMO === 'prizes') {
    // every bonus sitting in a row, two floating down, a big boulder and a big anvil
    const z = sim as unknown as { prizes: unknown[]; hazards: unknown[]; dropIn: number; hazardIn: number };
    z.dropIn = 1e9;
    z.hazardIn = 1e9;
    (['bomb', 'star', 'grow', 'rapid', 'heart'] as const).forEach((kind, i) =>
      z.prizes.push({ id: 900 + i, kind, x: (13.6 + i * 1.2) * 32, y: 9 * 32, vy: 0, landed: true, age: 0 }),
    );
    // two more on their way down
    z.prizes.push({ id: 910, kind: 'star', x: 7 * 32, y: -24, vy: 40, landed: false, age: 0 });
    z.prizes.push({ id: 911, kind: 'rapid', x: 25 * 32, y: 60, vy: 40, landed: false, age: 0 });
    z.hazards.push({ id: 990, kind: 'rock', big: true, x: 300, y: -60, vx: 0, vy: 0, warn: 4.5, rolling: 0 });
    z.hazards.push({ id: 991, kind: 'anvil', big: true, x: 24 * 32, y: -60, vx: 0, vy: 0, warn: 9, rolling: 0 });
    return;
  }
  if (ps[0]) s.grant(ps[0], 'fire', []);
}

class Room {
  clients = new Map<string, Client>();
  phase: Phase = 'lobby';
  timer = 0;
  winner: string | null = null;
  sim: BattleSim | null = null;
  private nextId = 1;
  private lastCountdownSecond = -1;

  // ── people coming and going ──

  hello(ws: WebSocket, msg: Extract<ClientMsg, { t: 'hello' }>) {
    // rejoining (same tab, same token): take your place back
    for (const c of this.clients.values())
      if (c.token && c.token === msg.token) {
        c.ws?.close();
        c.ws = ws;
        c.droppedAt = 0;
        this.send(c, { t: 'welcome', id: c.id });
        this.broadcastRoom();
        return c;
      }
    if (this.clients.size >= MAX_BATTLERS + MAX_WATCHERS) {
      ws.send(JSON.stringify({ t: 'full' } satisfies ServerMsg));
      ws.close();
      return null;
    }
    // the arena's full: watch (slot -1) until a spot opens
    const slot = this.freeSlot();
    const c: Client = {
      id: `p${this.nextId++}`,
      token: String(msg.token ?? '').slice(0, 64),
      ws,
      name: cleanName(msg.name, slot),
      hero: heroOk(msg.hero),
      slot,
      playing: false,
      queue: [],
      lastSeq: 0,
      lastBtn: 0,
      kos: 0,
      deaths: 0,
      droppedAt: 0,
    };
    this.clients.set(c.id, c);
    this.send(c, { t: 'welcome', id: c.id });
    this.broadcastRoom();
    return c;
  }

  /** The lowest free player spot, or -1 if all four are taken. */
  private freeSlot() {
    const used = new Set([...this.clients.values()].map((c) => c.slot));
    for (let s = 0; s < MAX_BATTLERS; s++) if (!used.has(s)) return s;
    return -1;
  }

  /** Between battles: watchers (oldest first) take any spots that have opened up. */
  private promoteWatchers() {
    let changed = false;
    for (const c of this.clients.values()) {
      if (c.slot >= 0 || !c.ws) continue;
      const s = this.freeSlot();
      if (s < 0) break;
      c.slot = s;
      // no name of their own: "Player N" for the square they've got
      if (c.name === cleanName('', -1)) c.name = cleanName('', s);
      changed = true;
    }
    if (changed) this.broadcastRoom();
  }

  dropped(c: Client) {
    // only watching (not in this battle): nothing to come back to, free the spot now
    if (this.phase === 'battle' && !c.playing) return this.remove(c);
    c.ws = null;
    c.droppedAt = Date.now();
    c.queue = [];
    c.lastBtn = 0;
    this.broadcastRoom();
  }

  private remove(c: Client) {
    this.clients.delete(c.id);
    this.sim?.remove(c.id);
    this.broadcastRoom();
  }

  message(c: Client, msg: ClientMsg) {
    switch (msg.t) {
      case 'in':
        if (this.phase !== 'battle' || !c.playing) return;
        if (typeof msg.s !== 'number' || typeof msg.b !== 'number' || msg.s <= c.lastSeq) return;
        c.queue.push([msg.s, msg.b & 63]);
        return;
      case 'hero':
        if (this.phase === 'battle' && c.playing) return;
        c.hero = heroOk(msg.hero);
        this.broadcastRoom();
        return;
      case 'name':
        c.name = cleanName(msg.name, c.slot);
        this.broadcastRoom();
        return;
      case 'leave':
        // left on purpose: the square empties now (no waiting for a rejoin)
        {
          const ws = c.ws;
          c.ws = null; // (so the socket closing isn't taken for a dropped connection)
          this.remove(c);
          ws?.close();
        }
        return;
      case 'start':
        // (no "start now": a battle starts by itself when the countdown runs out)
        return;
      case 'ping':
        this.send(c, { t: 'pong', c: msg.c });
        return;
    }
  }

  // ── the match ──

  private startBattle() {
    // anyone still without a name plays as "Player N" (their square's number)
    for (const c of this.clients.values()) if (c.slot >= 0 && !String(c.name).trim()) c.name = cleanName('', c.slot);
    this.sim = new BattleSim(ARENA);
    // (BATTLE_SECS shortens matches for testing)
    if (Number(process.env.BATTLE_SECS) > 0) this.sim.timeLeft = Number(process.env.BATTLE_SECS);
    this.winner = null;
    for (const c of this.clients.values()) {
      c.playing = !!c.ws && c.slot >= 0;
      c.queue = [];
      c.lastSeq = 0;
      c.lastBtn = 0;
      c.kos = 0;
      c.deaths = 0;
      if (c.playing) this.sim.add(c.id, c.hero, c.slot);
    }
    this.phase = 'battle';
    this.broadcastRoom();
    // (testing only: BATTLE_DEMO=1 sets up one of everything, to look at)
    if (process.env.BATTLE_DEMO) demo(this.sim);
  }

  private endBattle() {
    const sim = this.sim!;
    let best = -1;
    let winners: string[] = [];
    for (const p of sim.players.values()) {
      const c = this.clients.get(p.id);
      if (c) {
        c.kos = p.kos;
        c.deaths = p.deaths;
      }
      if (p.kos > best) {
        best = p.kos;
        winners = [p.id];
      } else if (p.kos === best) winners.push(p.id);
    }
    // a tie on knock-outs goes to whoever was knocked out least
    if (winners.length > 1) {
      const fewest = Math.min(...winners.map((id) => sim.players.get(id)!.deaths));
      winners = winners.filter((id) => sim.players.get(id)!.deaths === fewest);
    }
    this.winner = winners.length === 1 ? winners[0] : null;
    this.phase = 'results';
    this.timer = RESULTS_SECS;
    this.broadcastRoom();
  }

  tick() {
    const now = Date.now();
    const hold = (this.phase === 'battle' ? REJOIN_SECS : LOBBY_REJOIN_SECS) * 1000;
    for (const c of [...this.clients.values()]) if (!c.ws && c.droppedAt && now - c.droppedAt > hold) this.remove(c);
    if (this.phase === 'lobby' || this.phase === 'countdown') this.promoteWatchers();
    const ready = [...this.clients.values()].filter((c) => c.ws && c.slot >= 0).length;
    switch (this.phase) {
      case 'lobby':
        // two or more friends here: the countdown starts by itself
        if (ready >= 2) {
          this.phase = 'countdown';
          this.timer = AUTO_COUNTDOWN_SECS;
          this.lastCountdownSecond = -1;
          this.broadcastRoom();
        }
        break;
      case 'countdown': {
        // someone left and it's just one again: back to waiting
        if (ready < 2) {
          this.phase = 'lobby';
          this.broadcastRoom();
          break;
        }
        this.timer -= DT;
        const sec = Math.ceil(this.timer);
        if (sec !== this.lastCountdownSecond) {
          this.lastCountdownSecond = sec;
          this.broadcastRoom();
        }
        if (this.timer <= 0) this.startBattle();
        break;
      }
      case 'battle': {
        const sim = this.sim!;
        const inputs = new Map<string, number>();
        for (const c of this.clients.values()) {
          if (!c.playing) continue;
          if (c.queue.length > MAX_QUEUE) c.queue.splice(0, c.queue.length - 2);
          const next = c.queue.shift();
          if (next) {
            c.lastSeq = next[0];
            c.lastBtn = next[1];
          }
          inputs.set(c.id, c.ws ? c.lastBtn : 0);
        }
        const events = sim.step(inputs);
        const players = [...sim.players.values()].map((p) => {
          const { lastHitBy: _, ...rest } = p;
          return packPlayer({ ...rest, ack: this.clients.get(p.id)?.lastSeq ?? 0 });
        });
        const r1 = (v: number) => Math.round(v * 10) / 10;
        const rockets = sim.rockets.map((r) => ({ id: r.id, owner: r.owner, kind: r.kind, x: r1(r.x), y: r1(r.y), dir: r.dir }));
        const prizes = sim.prizes.map((z): SnapPrize => [z.id, z.kind, r1(z.x), r1(z.y), z.landed ? r1(z.age) : -1]);
        const enemies = sim.enemies.map((e): SnapEnemy => [
          e.id, e.kind, r1(e.x), r1(e.y), e.dir,
          (e.onGround ? 1 : 0) | (e.weapon ? 2 : 0) | (e.chute ? 4 : 0) | (e.hurtT > 0 ? 8 : 0),
          e.race === 'plop' ? 1 : 0,
          e.weapon ? WEAPON_CODE[e.weapon] : 0,
          e.weapon === 'flail' ? Math.round(sim.flailBall(e).a * 100) / 100 : 0,
        ]);
        const hazards = sim.hazards.map((z): SnapHazard => [z.id, z.kind, r1(z.x), r1(z.y), r1(z.warn), (z.big ? 1 : 0) | (z.rolling > 0 ? 2 : 0)]);
        this.broadcast({ t: 'snap', k: sim.tick, tl: r1(sim.timeLeft), p: players, r: rockets, z: prizes, n: enemies, h: hazards, e: events });
        const anyone = [...this.clients.values()].some((c) => c.playing && c.ws);
        if (sim.over || !anyone) this.endBattle();
        break;
      }
      case 'results':
        this.timer -= DT;
        if (this.timer <= 0) {
          this.phase = 'lobby';
          this.sim = null;
          for (const c of this.clients.values()) c.playing = false;
          this.broadcastRoom();
        }
        break;
    }
  }

  // ── sending ──

  roomState(): RoomState {
    const players: RoomPlayer[] = [...this.clients.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((c) => ({ id: c.id, name: c.name, hero: c.hero, slot: c.slot, connected: !!c.ws, playing: c.playing, kos: c.kos, deaths: c.deaths }));
    return { phase: this.phase, players, timer: Math.max(0, Math.ceil(this.timer)), winner: this.winner };
  }

  broadcastRoom() {
    this.broadcast({ t: 'room', room: this.roomState() });
  }

  private broadcast(msg: ServerMsg) {
    const data = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      const ws = c.ws;
      if (ws && ws.readyState === ws.OPEN) later(() => ws.readyState === ws.OPEN && ws.send(data));
    }
  }

  send(c: Client, msg: ServerMsg) {
    const ws = c.ws;
    if (ws && ws.readyState === ws.OPEN) {
      const data = JSON.stringify(msg);
      later(() => ws.readyState === ws.OPEN && ws.send(data));
    }
  }
}

/**
 * Rooms by code (e.g. "birchcliff"): anyone who comes with the same code is in
 * the same room. They live in memory only (no database): a room is made when the
 * first person arrives and dropped a minute after the last one has gone.
 */
const rooms = new Map<string, { room: Room; emptySince: number }>();
const MAX_ROOMS = 200;
export const cleanCode = (c: unknown) =>
  String(c ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 12) || 'birchcliff';

function roomFor(code: string) {
  let r = rooms.get(code);
  if (!r) {
    if (rooms.size >= MAX_ROOMS) return null;
    r = { room: new Room(), emptySince: 0 };
    rooms.set(code, r);
  }
  return r.room;
}

/** Start the battle server on this HTTP server (WebSockets at /battle?room=code). */
export function attachBattle(server: Server) {
  const wss = new WebSocketServer({ server, path: '/battle', maxPayload: 4096 });
  wss.on('connection', (ws, req) => {
    const code = cleanCode(new URL(req.url ?? '/', 'http://x').searchParams.get('room'));
    const room = roomFor(code);
    if (!room) {
      ws.send(JSON.stringify({ t: 'full' } satisfies ServerMsg));
      ws.close();
      return;
    }
    let me: Client | null = null;
    ws.on('message', (raw) => later(() => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') {
        if (!me) me = room.hello(ws, msg);
        return;
      }
      if (me && me.ws === ws) room.message(me, msg);
    }));
    ws.on('close', () => {
      if (me && me.ws === ws) room.dropped(me);
    });
    ws.on('error', () => {});
  });
  // a steady 30 ticks a second (catching up if the timer runs late)
  let last = performance.now();
  let acc = 0;
  setInterval(() => {
    const now = performance.now();
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= DT) {
      acc -= DT;
      for (const r of rooms.values()) r.room.tick();
    }
    // empty rooms go after a minute
    const t = Date.now();
    for (const [code, r] of rooms) {
      if (r.room.clients.size > 0) r.emptySince = 0;
      else if (!r.emptySince) r.emptySince = t;
      else if (t - r.emptySince > 60000) rooms.delete(code);
    }
  }, 1000 / TICK_HZ / 2);
  console.log('Battle server ready at /battle');
}
