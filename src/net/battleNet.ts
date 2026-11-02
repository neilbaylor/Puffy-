/**
 * The game's connection to the battle server (a WebSocket at /battle on the
 * same site). Joins the room, keeps the room/lobby state, receives match
 * snapshots, sends your buttons every tick, and reconnects if the phone drops
 * the connection (same place in the room for 30 s).
 */
import { unpackPlayer, type ClientMsg, type RoomState, type ServerMsg, type SnapPlayer, type SnapPrize, type SnapRocket } from '../shared/battle/protocol';
import type { BEvent } from '../shared/battle/sim';

export interface Snapshot {
  tick: number;
  timeLeft: number;
  players: SnapPlayer[];
  rockets: SnapRocket[];
  prizes: SnapPrize[];
  events: BEvent[];
  /** When it arrived (performance.now()). */
  at: number;
}

export type NetStatus = 'connecting' | 'online' | 'full' | 'offline';

/** Where the battle server is: the same site, or ?server=wss://… to point somewhere else. */
export function battleUrl() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  if (import.meta.env.DEV) return `ws://${location.hostname}:8080/battle`;
  if (!/^https?:$/.test(location.protocol)) return null; // a saved file: no server
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/battle`;
}

/** This browser tab's ticket back into the room after a dropped connection. */
function token() {
  try {
    let t = sessionStorage.getItem('puffy.battle.token');
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
  private pingTimer = 0;

  constructor(
    private url: string,
    public name: string,
    public hero: string,
  ) {
    this.connect();
  }

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
    ws.onopen = () => {
      this.retry = 0;
      this.send({ t: 'hello', name: this.name, hero: this.hero, token: token() });
      clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
    };
    ws.onmessage = (e) => {
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
          this.inbox.push({ tick: m.k, timeLeft: m.tl, players: m.p.map(unpackPlayer), rockets: m.r, prizes: m.z ?? [], events: m.e, at: performance.now() });
          if (this.inbox.length > 60) this.inbox.splice(0, this.inbox.length - 60);
          return;
        case 'pong': {
          const rtt = performance.now() - m.c;
          this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt;
          return;
        }
      }
    };
    ws.onclose = () => {
      if (this.ws === ws) this.lost();
    };
    ws.onerror = () => {};
  }

  /** Connection dropped: try again (quickly at first, then backing off). */
  private lost() {
    clearInterval(this.pingTimer);
    this.ws = null;
    if (this.closed) return;
    this.setStatus('offline');
    const wait = Math.min(5000, 400 * 2 ** this.retry++);
    window.setTimeout(() => this.connect(), wait);
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
    this.closed = true;
    clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }
}
