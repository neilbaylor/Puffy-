/**
 * The game's connection to the battle server (a WebSocket at /battle on the
 * same site). Joins the room, keeps the room/lobby state, receives match
 * snapshots, sends your buttons every tick, and reconnects if the phone drops
 * the connection (same place in the room for 30 s).
 */
import { unpackPlayer, type ClientMsg, type RoomState, type ServerMsg, type SnapChair, type SnapEnemy, type SnapHazard, type SnapPlayer, type SnapPrize, type SnapRocket } from '../shared/battle/protocol';
import { wardrobe } from '../core/wardrobe';
import type { BEvent } from '../shared/battle/sim';

export interface Snapshot {
  tick: number;
  timeLeft: number;
  players: SnapPlayer[];
  rockets: SnapRocket[];
  prizes: SnapPrize[];
  enemies: SnapEnemy[];
  hazards: SnapHazard[];
  chairs: SnapChair[];
  events: BEvent[];
  /** When it arrived (performance.now()). */
  at: number;
}

export type NetStatus = 'connecting' | 'online' | 'full' | 'offline';

/** The server closes a connection with this when another one came in with its ticket (see token). */
const TAKEN = 4000;
/**
 * Nothing at all from the server for this long (ms) — not even the answer to a ping, sent every 2 s —
 * though the connection says it's open (or still opening): it's gone without saying so, and is made
 * again (see check).
 */
const SILENT_MS = 6000;
/** Trying again after a dropped connection: quickly at first, then every this-many ms at most. */
const RETRY_MAX = 2000;

/** Where the battle server is: the same site, or ?server=wss://… to point somewhere else. */
export function battleUrl() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  if (import.meta.env.DEV) return `ws://${location.hostname}:8080/battle`;
  if (!/^https?:$/.test(location.protocol)) return null; // a saved file: no server
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/battle`;
}

/** This browser tab's ticket back into the room after a dropped connection (`fresh`: a new one). */
function token(fresh = false) {
  try {
    let t = fresh ? null : sessionStorage.getItem('puffy.battle.token');
    if (!t) {
      t = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('puffy.battle.token', t);
    }
    return t;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export class BattleNet {
  status: NetStatus = 'connecting';
  myId: string | null = null;
  room: RoomState | null = null;
  /** Snapshots not yet handed to the battle scene. */
  inbox: Snapshot[] = [];
  /** Round-trip time to the server (ms, smoothed). */
  rtt = 0;
  onRoom: (r: RoomState) => void = () => {};
  onStatus: (s: NetStatus) => void = () => {};

  private ws: WebSocket | null = null;
  private closed = false;
  private retry = 0;
  private retryT = 0;
  private pingTimer = 0;
  /** When the server was last heard from (or the connection was begun). */
  private heardAt = 0;
  private checkT = 0;
  private lastCheck = 0;

  constructor(
    private url: string,
    public name: string,
    public hero: string,
  ) {
    this.connect();
    this.lastCheck = performance.now();
    this.checkT = window.setInterval(() => this.check(), 1000);
    window.addEventListener('online', this.wake);
    document.addEventListener('visibilitychange', this.wake);
  }

  /**
   * Once a second: is the connection still really there? A phone that changed networks (wifi to mobile
   * data), or a connection that died while the phone was asleep, can look open for minutes while nothing
   * gets through either way: the battle showed 'Lost the connection — reconnecting…' and never did.
   */
  private check() {
    const now = performance.now();
    // (the page was asleep — put away, frozen, its timers slowed right down: the connection gets a fresh
    // few seconds to show it's there, rather than being judged on time it couldn't have answered in)
    const asleep = now - this.lastCheck > 4000;
    this.lastCheck = now;
    if (asleep) this.heardAt = now;
    const ws = this.ws;
    if (!ws || this.closed || now - this.heardAt < SILENT_MS) return;
    this.ws = null;
    ws.close();
    this.lost();
  }

  /** Back online, or back from the background, and waiting to try again: try now. */
  private wake = () => {
    if (this.closed || this.ws || document.hidden) return;
    clearTimeout(this.retryT);
    this.connect();
  };

  private setStatus(s: NetStatus) {
    this.status = s;
    this.onStatus(s);
  }

  private connect() {
    if (this.closed) return;
    this.setStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      return this.lost();
    }
    this.ws = ws;
    this.heardAt = performance.now();
    ws.onopen = () => {
      this.retry = 0;
      this.send({ t: 'hello', name: this.name, hero: this.hero, token: token(), wear: wardrobe.wearKey });
      clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
    };
    ws.onmessage = (e) => {
      this.heardAt = performance.now();
      let m: ServerMsg;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (m.t) {
        case 'welcome':
          this.myId = m.id;
          this.setStatus('online');
          return;
        case 'full':
          this.closed = true;
          this.setStatus('full');
          return;
        case 'room':
          this.room = m.room;
          this.onRoom(m.room);
          return;
        case 'snap':
          this.lastSnapAt = performance.now();
          this.inbox.push({ tick: m.k, timeLeft: m.tl, players: m.p.map(unpackPlayer), rockets: m.r, prizes: m.z ?? [], enemies: m.n ?? [], hazards: m.h ?? [], chairs: m.c ?? [], events: m.e, at: performance.now() });
          if (this.inbox.length > 60) this.inbox.splice(0, this.inbox.length - 60);
          return;
        case 'pong': {
          const rtt = performance.now() - m.c;
          this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt;
          return;
        }
      }
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      // another tab came in with this tab's ticket and took our place (a duplicated tab copies it): this
      // tab gets a ticket of its own and comes back as someone new (with the same ticket, the two tabs
      // took the place from each other, over and over)
      if (e.code === TAKEN) token(true);
      this.lost();
    };
    ws.onerror = () => {};
  }

  /** When the last snapshot of the battle came in (performance.now()): none for a while and it's stuck. */
  lastSnapAt = 0;

  /** Connection dropped: try again (quickly at first, then backing off a little). */
  private lost() {
    clearInterval(this.pingTimer);
    this.ws = null;
    if (this.closed) return;
    this.setStatus('offline');
    // (at most every 2 s: waiting up to 5 s, a server back after a restart, or a phone back in signal, sat
    // there 'reconnecting' for up to 5 s more)
    const wait = Math.min(RETRY_MAX, 400 * 2 ** this.retry++);
    clearTimeout(this.retryT);
    this.retryT = window.setTimeout(() => this.connect(), wait);
  }

  send(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  input(seq: number, buttons: number) {
    this.send({ t: 'in', s: seq, b: buttons });
  }

  setHero(hero: string) {
    this.hero = hero;
    this.send({ t: 'hero', hero });
  }

  setName(name: string) {
    this.name = name;
    this.send({ t: 'name', name });
  }

  start() {
    this.send({ t: 'start' });
  }

  close() {
    // (tell the server we're going, so our square empties straight away)
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'leave' }));
    this.closed = true;
    clearInterval(this.pingTimer);
    clearInterval(this.checkT);
    clearTimeout(this.retryT);
    window.removeEventListener('online', this.wake);
    document.removeEventListener('visibilitychange', this.wake);
    this.ws?.close();
    this.ws = null;
  }
}
