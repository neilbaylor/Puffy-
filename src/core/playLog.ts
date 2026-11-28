import { VERSION } from '../version';
import { isTesterName } from '../shared/testers';
import { account } from './account';
import { apiBase } from './native';
import { LIGHT } from './light';
import { G12 } from './screen';

/**
 * A hidden recorder of how smoothly a level plays, for the testers' own devices only (an account in
 * shared/testers, signed in): from the end of a level's fly-over to leaving it (the goal, the pause menu's
 * quit, game over — a faint's restart at a checkpoint carries on the same recording — or the page
 * hidden), each game frame's time; at the end a short summary is sent to the server with the device
 * checks (see server/users: bench_reports, `feel: 'play'`) and shows in `?bench=list`. A copy's kept on
 * the device while it plays, so one that a page leaving cut off (iPhone Safari) is sent the next time
 * the game or the list opens; and the list says what this device last recorded. Nothing on screen,
 * nothing for anyone else. Made to compare perf round G12's switch (core/screen) on and off on a real
 * device.
 */
let gaps: number[] = [];
let part = 0;
let on = false;
let started = 0;
let faints = 0;
/** This recording's id (a copy sent twice shows once in the list). */
let rid = '';

const PENDING = 'puffy.playlog';
const LAST = 'puffy.playlog.last';

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

/** A level's play begins (its fly-over over). */
export function playStart(levelId: number) {
  if (on) playEnd('left');
  on = tester();
  if (!on) keep(LAST, { at: Date.now(), part: levelId, frames: 0, why: '', sent: account.user ? `not recorded: ${account.user.name} isn't a tester` : 'not recorded: not signed in' });
  gaps = [];
  part = levelId;
  faints = 0;
  rid = Math.random().toString(36).slice(2, 10);
  started = performance.now();
}

/** Back at a checkpoint after a faint: the same visit's recording goes on. */
export function playRetry(levelId: number) {
  if (on && part === levelId) faints++;
  else playStart(levelId);
}

/** One game frame's time (ms). */
export function playFrame(ms: number) {
  // (a long gap is the page away or paused, not a frame; and a few minutes is plenty)
  if (!on || ms > 500 || gaps.length > 20000) return;
  gaps.push(ms);
  // (every 5 s or so: the summary so far, kept in case the page goes without a word)
  if (gaps.length % 300 === 0) keep(PENDING, summary('cut off'));
}

// (the page put away — a tab switched, the app closed, another address: what's recorded is sent now,
// while it still can be; coming back starts a fresh recording of the same Part)
let away: number | null = null;
const hide = () => {
  if (on) (away = part), playEnd('hidden');
};
addEventListener('pagehide', hide);
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') hide();
  else if (away !== null) {
    playStart(away);
    away = null;
  }
});

/** The level's left: send the summary (5 s of play at least). */
export function playEnd(why: string) {
  away = null;
  if (!on) return;
  on = false;
  if (gaps.length < 300) {
    keep(PENDING, null);
    return void keep(LAST, { at: Date.now(), part, frames: gaps.length, why, sent: 'too short to send (5 s of play at least)' });
  }
  const r = summary(why);
  // (the copy stays until the server has it: a send a closing page cuts off goes again next time)
  keep(PENDING, r);
  void send(r);
}

/** A recording the page didn't get to send last time: send it now (the game's start, the list page). */
export async function playFlush() {
  const p = read(PENDING);
  if (!p || on) return;
  await send(p);
}

/** What this device last recorded, for the list page (null if nothing yet). */
export function playLast(): { at: number; part: number; frames: number; why: string; sent: string } | null {
  return read(LAST) as never;
}

/** Send a summary; how it went is noted on the device (see playLast). */
function send(report: Record<string, unknown>) {
  keep(LAST, { at: Date.now(), part: report.part, frames: report.frames, why: report.why, sent: 'sending…' });
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
  const q = (p: number) => Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10;
  const pct = (over: number) => Math.round((s.filter((g) => g > over).length / s.length) * 1000) / 10;
  return {
    kind: 'play',
    rid,
    name: `Part ${part} · ${LIGHT ? 'light' : 'full'} · g12 ${G12 ? 'on' : 'off'}`,
    feel: 'play',
    v: VERSION,
    part,
    mode: LIGHT ? 'light' : 'full',
    g12: G12,
    why,
    faints,
    frames: s.length,
    secs: Math.round((performance.now() - started) / 100) / 10,
    median: q(0.5),
    p90: q(0.9),
    p99: q(0.99),
    over33: pct(33.4),
    over50: pct(50),
    window: `${innerWidth}×${innerHeight}`,
    dpr: devicePixelRatio,
    hz: (window as unknown as { refreshHz?: number }).refreshHz ?? null,
  };
}
