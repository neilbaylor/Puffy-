import type Phaser from 'phaser';
import { VERSION } from '../version';
import { isTesterName } from '../shared/testers';
import { account } from './account';
import { apiBase } from './native';
import { LIGHT } from './light';
import { G12 } from './screen';

/**
 * A hidden recorder of how a level, a boss or a battle plays, for the testers' own devices only (an
 * account in shared/testers, signed in). Nothing on screen, nothing for anyone else.
 *
 * Levels: from the end of the fly-over to leaving (the goal, the pause menu's quit, game over — a
 * faint's restart at a checkpoint carries on — or the page hidden; cutscenes and the pause menu don't
 * count). Bosses and battles: the scene's whole run, while it isn't paused.
 *
 * What's recorded:
 * - each game frame's real time (the clock from one game frame's start to the next — not Phaser's
 *   smoothed delta, which spreads a stutter over the frames after it);
 * - where each frame's time went, on every device: each scene's game logic, the engine around it
 *   (physics, tweens, timers), each scene's drawing, the renderer's start and finish, pictures sent to
 *   the graphics chip (count, time, size) and draw calls;
 * - the slowest frames, each with what took its time;
 * - where the browser has a sampling profiler (Chrome — Android, computers; not Safari): which
 *   functions the time went to, over the whole run and in the slow frames alone. The page needs a
 *   header for it, which the server sends only to a device a tester's signed in on (a cookie, see
 *   markTester and server.mjs).
 *
 * At the end a summary goes to the server with the device checks (server/users: bench_reports,
 * `feel: 'play'`) and shows in `?bench=list`. A copy's kept on the device while it plays, so one a
 * closing page cut off is sent the next time the game or the list opens; and the list says what this
 * device last recorded.
 */

/** A frame slower than this counts as a stutter (two 60 Hz frames). */
const SLOW_MS = 33.4;
/** How many of the slowest frames are kept with their breakdown. */
const WORST = 8;

let game: Phaser.Game | null = null;
let on = false;
let what = '';
let sceneKey = '';
/** A level: only frames GameScene says are play count (see playFrame). */
let levelRun = false;
let started = 0;
let faints = 0;
let rid = '';

let gaps: number[] = [];
/** When this game frame began (its pre-step), and whether it counts. */
let frameStart = 0;
let counted = false;

type Sec = { ms: number; n: number; max: number };
let secs = new Map<string, Sec>();
/** This frame's own parts: added to the totals once the frame's over, if it counts. */
let cur = new Map<string, { ms: number; n: number }>();
let gl = { uploads: 0, uploadMs: 0, uploadPx: 0, draws: 0 };
let glCur = { uploads: 0, uploadMs: 0, uploadPx: 0, draws: 0 };
type Worst = { ms: number; at: number; top: [string, number][]; uploads: number; uploadMs: number; draws: number };
let worst: Worst[] = [];
/** The slow frames' time spans, for the profiler's samples. */
let slowSpans: [number, number][] = [];

const PENDING = 'puffy.playlog';
const LAST = 'puffy.playlog.last';

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

const tester = () => !!account.user && isTesterName(account.user.name);

const keep = (key: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* (private mode etc.) */
  }
};
const read = (key: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
};

/**
 * A tester's signed in on this device (or not): a cookie tells the server to let the page use the
 * browser's profiler (from the next time it opens). Regular players never get it.
 */
export function markTester(isTester: boolean | null = tester() || null) {
  // (null: not known yet — say, the account's still being restored — so left as it is)
  if (isTester === null) return;
  try {
    document.cookie = isTester ? 'puffy_prof=1; path=/; max-age=31536000; SameSite=Lax' : 'puffy_prof=; path=/; max-age=0; SameSite=Lax';
  } catch {
    /* (no cookies) */
  }
}

// ── timing the frame's parts ──

function add(label: string, ms: number) {
  const c = cur.get(label);
  if (c) c.ms += ms, c.n++;
  else cur.set(label, { ms, n: 1 });
}

type Fn = ((...a: unknown[]) => unknown) & { __pl?: true };
/** Time a method that's called by name each frame (so swapping it is safe: nothing holds the old one). */
function wrap(obj: Record<string, unknown> | null | undefined, key: string, label: string) {
  const f = obj?.[key] as Fn | undefined;
  if (!obj || typeof f !== 'function' || f.__pl) return;
  const w: Fn = function (this: unknown, ...a: unknown[]) {
    if (!on) return f.apply(this, a);
    const t = performance.now();
    try {
      return f.apply(this, a);
    } finally {
      add(label, performance.now() - t);
    }
  };
  w.__pl = true;
  obj[key] = w;
}

/** The graphics chip's calls: pictures sent (time, pixels) and draw calls (a count). */
function wrapGl(g: WebGLRenderingContext & Record<string, unknown>) {
  for (const k of ['texImage2D', 'texSubImage2D', 'compressedTexImage2D', 'compressedTexSubImage2D']) {
    const f = g[k] as Fn | undefined;
    if (typeof f !== 'function' || f.__pl) continue;
    const w: Fn = function (this: unknown, ...a: unknown[]) {
      if (!on) return f.apply(this, a);
      const t = performance.now();
      try {
        return f.apply(this, a);
      } finally {
        const ms = performance.now() - t;
        glCur.uploads++;
        glCur.uploadMs += ms;
        // (the picture's size: a canvas or image last, or width and height given)
        const src = a[a.length - 1] as { width?: number; height?: number } | null;
        glCur.uploadPx += src && typeof src === 'object' && src.width ? src.width * (src.height ?? 0) : typeof a[3] === 'number' && typeof a[4] === 'number' ? (a[3] as number) * (a[4] as number) : 0;
      }
    };
    w.__pl = true;
    g[k] = w;
  }
  for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
    const f = g[k] as Fn | undefined;
    if (typeof f !== 'function' || f.__pl) continue;
    const w: Fn = function (this: unknown, ...a: unknown[]) {
      if (on) glCur.draws++;
      return f.apply(this, a);
    };
    w.__pl = true;
    g[k] = w;
  }
}

/** The scenes running now: their update, logic and drawing timed (re-done each frame: a scene's restart sets its logic afresh). */
function wrapScenes() {
  if (!game) return;
  for (const sc of game.scene.getScenes(true)) {
    const sys = sc.sys as unknown as Record<string, unknown>;
    const k = sc.sys.settings.key;
    wrap(sys, 'step', `${k}: update`);
    wrap(sys, 'sceneUpdate', `${k}: logic`);
    wrap(sys, 'render', `${k}: draw`);
  }
}

/** The boss scenes and the battle: a recording each run. */
const NAMES: Record<string, string> = { Hoops: 'Boss: basketball', Wrestle: 'Boss: wrestling', Fishing: 'Boss: fishing', Battle: 'Battle' };
const BOSSES = Object.keys(NAMES);
const hooked = new Set<string>();
/** (the scenes are made once the game's ready, after this is installed: hooked as they turn up) */
function hookScenes() {
  for (const key of BOSSES) {
    const sc = hooked.has(key) ? null : game?.scene.getScene(key);
    if (!sc) continue;
    hooked.add(key);
    sc.sys.events.on('create', () => {
      const lv = (sc.sys.settings.data as { level?: number } | undefined)?.level;
      begin(lv ? `${NAMES[key]} (Part ${lv})` : NAMES[key], key, false);
    });
    sc.sys.events.on('shutdown', () => {
      if (on && sceneKey === key) void playEnd('left');
    });
  }
}

/** Once, at the start: the game's own steps; then, each frame, the frame just gone closed. */
export function installPlayLog(g: Phaser.Game) {
  game = g;
  g.events.on('prestep', () => {
    const now = performance.now();
    if (hooked.size < BOSSES.length) hookScenes();
    if (on) {
      closeFrame(now);
      wrapScenes();
      // a boss or a battle: every frame its scene's running counts
      if (!levelRun && g.scene.getScene(sceneKey)?.sys.isActive()) counted = true;
    }
    frameStart = now;
  });
  setTimeout(markTester, 8000);
}

/** The frame that began at frameStart is over: its time, and its breakdown if it's one of the slowest. */
function closeFrame(now: number) {
  // (a long gap is the page away or paused, not a frame; and a few minutes is plenty)
  if (counted && frameStart && now - frameStart <= 500 && gaps.length < 20000) {
    const g = now - frameStart;
    gaps.push(g);
    for (const [k, c] of cur) {
      let s = secs.get(k);
      if (!s) secs.set(k, (s = { ms: 0, n: 0, max: 0 }));
      s.ms += c.ms;
      s.n += c.n;
      if (c.ms > s.max) s.max = c.ms;
    }
    gl.uploads += glCur.uploads;
    gl.uploadMs += glCur.uploadMs;
    gl.uploadPx += glCur.uploadPx;
    gl.draws += glCur.draws;
    if (g > SLOW_MS && slowSpans.length < 400) slowSpans.push([frameStart, now]);
    if (worst.length < WORST || g > worst[worst.length - 1].ms) {
      const top = [...cur.entries()]
        .sort((a, b) => b[1].ms - a[1].ms)
        .slice(0, 5)
        .map(([k, v]) => [k, r1(v.ms)] as [string, number]);
      worst.push({ ms: r1(g), at: r1((now - started) / 1000), top, uploads: glCur.uploads, uploadMs: r1(glCur.uploadMs), draws: glCur.draws });
      worst.sort((a, b) => b.ms - a.ms);
      if (worst.length > WORST) worst.length = WORST;
    }
    // (every 10 s or so: the summary so far, kept in case the page goes without a word — made when
    // the device is idle between frames, not inside one: it sorts every frame time so far)
    if (gaps.length % 600 === 0) whenIdle(() => on && keep(PENDING, summary('cut off')));
  }
  counted = false;
  cur = new Map();
  glCur = { uploads: 0, uploadMs: 0, uploadPx: 0, draws: 0 };
}

/** Run soon, in a gap between frames where the browser has one (Safari hasn't: a short wait instead). */
const whenIdle = (fn: () => void) => {
  const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 3000 });
  else setTimeout(fn, 50);
};

// ── the browser's profiler (Chrome) ──

type Trace = {
  resources: string[];
  frames: { name: string; resourceId?: number; line?: number; column?: number }[];
  stacks: { parentId?: number; frameId: number }[];
  samples: { timestamp: number; stackId?: number }[];
};
type Prof = { stop(): Promise<Trace> };
let prof: Prof | null = null;
/** Why there's no profile (shown in the list). */
let profWhy = '';

function startProfiler() {
  prof = null;
  const P = (window as unknown as { Profiler?: new (o: { sampleInterval: number; maxBufferSize: number }) => Prof }).Profiler;
  if (!P) return void (profWhy = 'no profiler in this browser');
  try {
    prof = new P({ sampleInterval: 10, maxBufferSize: 60000 });
    profWhy = '';
  } catch {
    profWhy = 'profiler not allowed yet (open the game again)';
  }
}

/** The profile, boiled down: the functions with the most time of their own, and with what they call. */
function boil(t: Trace, frames: number, ms: number) {
  const name = (id: number) => {
    const f = t.frames[id];
    const res = f.resourceId !== undefined ? (t.resources[f.resourceId] ?? '').split('/').pop()!.split('?')[0] : '';
    return `${f.name || '(anonymous)'}${res ? ` ${res}:${f.line ?? 0}:${f.column ?? 0}` : ''}`.slice(0, 90);
  };
  const tally = (samples: Trace['samples'], k: number, withTotal: boolean, perFrames: number) => {
    const self = new Map<number, number>();
    const all = new Map<number, number>();
    let busy = 0;
    for (const s of samples) {
      if (s.stackId === undefined) continue;
      busy++;
      let st: number | undefined = s.stackId;
      const top = t.stacks[st].frameId;
      self.set(top, (self.get(top) ?? 0) + 1);
      const seen = new Set<number>();
      while (st !== undefined) {
        const f = t.stacks[st].frameId;
        if (!seen.has(f)) seen.add(f), all.set(f, (all.get(f) ?? 0) + 1);
        st = t.stacks[st].parentId;
      }
    }
    const n = samples.length || 1;
    // (a sample's worth of time: the run's length over its samples; then per frame)
    const per = (t.samples.length ? ms / t.samples.length : 10) / Math.max(1, perFrames);
    const list = (m: Map<number, number>) =>
      [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, k)
        .map(([f, c]) => ({ fn: name(f), pct: r1((c / n) * 100), msf: r2(c * per) }));
    return { samples: samples.length, busyPct: r1((busy / n) * 100), self: list(self), total: withTotal ? list(all) : [] };
  };
  const inSlow = t.samples.filter((s) => slowSpans.some(([a, b]) => s.timestamp >= a && s.timestamp <= b));
  return { whole: tally(t.samples, 25, true, frames), slow: inSlow.length ? tally(inSlow, 15, false, slowSpans.length) : null };
}

// ── a recording ──

function begin(label: string, key: string, level: boolean) {
  if (on) void playEnd('left');
  // (by now the account's known: a tester's device or not)
  markTester(tester());
  on = tester();
  if (!on) return void keep(LAST, { at: Date.now(), what: label, frames: 0, why: '', sent: account.user ? `not recorded: ${account.user.name} isn't a tester` : 'not recorded: not signed in' });
  what = label;
  sceneKey = key;
  levelRun = level;
  gaps = [];
  secs = new Map();
  cur = new Map();
  gl = { uploads: 0, uploadMs: 0, uploadPx: 0, draws: 0 };
  glCur = { uploads: 0, uploadMs: 0, uploadPx: 0, draws: 0 };
  worst = [];
  slowSpans = [];
  counted = false;
  faints = 0;
  rid = Math.random().toString(36).slice(2, 10);
  started = performance.now();
  wrapGame();
  wrapScenes();
  startProfiler();
}

/** The renderer and the graphics chip's calls timed — only once a tester's recording (everyone else's game is as it was). */
function wrapGame() {
  const r = game?.renderer as unknown as (Record<string, unknown> & { gl?: WebGLRenderingContext }) | undefined;
  if (!r) return;
  wrap(r, 'preRender', 'draw: start');
  wrap(r, 'postRender', 'draw: finish');
  if (r.gl) wrapGl(r.gl as WebGLRenderingContext & Record<string, unknown>);
}

/** A level's play begins (its fly-over over). */
export function playStart(levelId: number) {
  begin(`Part ${levelId}`, 'Game', true);
}

/** Back at a checkpoint after a faint: the same visit's recording goes on. */
export function playRetry(levelId: number) {
  if (on && what === `Part ${levelId}`) faints++;
  else playStart(levelId);
}

/** This game frame counts (a level's play: GameScene, outside its cutscenes). */
export function playFrame() {
  if (on) counted = true;
}

// (the page put away — a tab switched, the app closed, another address: what's recorded is sent now,
// while it still can be; coming back to the same run starts a fresh recording of it)
let away: { what: string; key: string; level: boolean } | null = null;
const hide = () => {
  if (!on) return;
  const was = { what, key: sceneKey, level: levelRun };
  void playEnd('hidden');
  away = was;
};
addEventListener('pagehide', hide);
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') hide();
  else if (away) {
    const a = away;
    away = null;
    if (game?.scene.getScene(a.key)?.sys.isActive()) begin(a.what, a.key, a.level);
  }
});

/** The run's over: send the summary (5 s of play at least). */
export async function playEnd(why: string) {
  away = null;
  if (!on) return;
  on = false;
  const p = prof;
  prof = null;
  if (gaps.length < 300) {
    keep(PENDING, null);
    void p?.stop().catch(() => {});
    return void keep(LAST, { at: Date.now(), what, frames: gaps.length, why, sent: 'too short to send (5 s of play at least)' });
  }
  const r = summary(why);
  if (!p) {
    keep(PENDING, { ...r, profWhy });
    return void send({ ...r, profWhy });
  }
  // (kept now without the profile, in case the page goes while it's read; then sent with it)
  keep(PENDING, r);
  let profile: ReturnType<typeof boil> | null = null;
  try {
    profile = boil(await p.stop(), gaps.length, performance.now() - started);
  } catch {
    profWhy = 'the profile was lost';
  }
  const full = { ...r, profile, profWhy: profile ? '' : profWhy };
  keep(PENDING, full);
  void send(full);
}

/** A recording the page didn't get to send last time: send it now (the game's start, the list page). */
export async function playFlush() {
  const p = read(PENDING);
  if (!p || on) return;
  await send(p);
}

/** What this device last recorded, for the list page (null if nothing yet). */
export function playLast(): { at: number; what?: string; part?: number; frames: number; why: string; sent: string } | null {
  return read(LAST) as never;
}

/** Send a summary; how it went is noted on the device (see playLast). */
function send(report: Record<string, unknown>) {
  keep(LAST, { at: Date.now(), what: report.what, frames: report.frames, why: report.why, sent: 'sending…' });
  return fetch(apiBase() + '/api/bench', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report }), keepalive: true })
    .then((r) => {
      keep(LAST, { ...read(LAST), sent: r.ok ? 'sent' : `the server refused it (${r.status})` });
      // (sent, or refused for good: the kept copy's done with — unless a newer one's taken its place)
      if ((r.ok || r.status === 400 || r.status === 413) && read(PENDING)?.rid === report.rid) keep(PENDING, null);
    })
    .catch(() => keep(LAST, { ...read(LAST), sent: "couldn't reach the server" }));
}

function summary(why: string): Record<string, unknown> {
  const s = [...gaps].sort((a, b) => a - b);
  const n = s.length || 1;
  const q = (p: number) => r1(s[Math.min(s.length - 1, Math.floor(p * s.length))]);
  const pct = (over: number) => r1((s.filter((g) => g > over).length / n) * 100);
  // each part's time a frame (on average), its calls a frame and its slowest single call
  const parts = [...secs.entries()].sort((a, b) => b[1].ms - a[1].ms).map(([k, v]) => ({ part: k, msPerFrame: r2(v.ms / n), callsPerFrame: r1(v.n / n), maxMs: r1(v.max) }));
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return {
    kind: 'play',
    rid,
    name: `${what} · ${LIGHT ? 'light' : 'full'} · g12 ${G12 ? 'on' : 'off'}`,
    feel: 'play',
    v: VERSION,
    what,
    part: what.startsWith('Part ') ? Number(what.slice(5)) : undefined,
    mode: LIGHT ? 'light' : 'full',
    g12: G12,
    why,
    faints,
    frames: s.length,
    secs: r1((performance.now() - started) / 1000),
    median: q(0.5),
    p90: q(0.9),
    p99: q(0.99),
    worstMs: r1(s[s.length - 1] ?? 0),
    over33: pct(SLOW_MS),
    over50: pct(50),
    parts,
    gpu: { uploads: gl.uploads, uploadMs: r1(gl.uploadMs), uploadMpx: r1(gl.uploadPx / 1e6), drawsPerFrame: r1(gl.draws / n) },
    worst,
    window: `${innerWidth}×${innerHeight}`,
    dpr: devicePixelRatio,
    hz: (window as unknown as { refreshHz?: number }).refreshHz ?? null,
    heapMb: mem ? r1(mem.usedJSHeapSize / 1e6) : null,
  };
}
