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
 * hidden), each game frame's time; at the end a short summary is sent to the server with the
 * device checks (see server/users: bench_reports, `feel: 'play'`) and shows in `?bench=list`. Nothing
 * on screen, nothing for anyone else. Made to compare perf round G12's switch (core/screen) on and off
 * on a real device.
 */
let gaps: number[] = [];
let part = 0;
let on = false;
let started = 0;
let faints = 0;

const tester = () => !!account.user && isTesterName(account.user.name);

/** A level's play begins (its fly-over over). */
export function playStart(levelId: number) {
  if (on) playEnd('left');
  on = tester();
  gaps = [];
  part = levelId;
  faints = 0;
  started = performance.now();
}

/** Back at a checkpoint after a faint: the same visit's recording goes on. */
export function playRetry(levelId: number) {
  if (on && part === levelId) faints++;
  else playStart(levelId);
}

// (the page put away — a tab switched, the app closed: what's recorded is sent now, while it still can be;
// coming back starts a fresh recording of the same Part)
let away: number | null = null;
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (on) (away = part), playEnd('hidden');
  } else if (away !== null) {
    playStart(away);
    away = null;
  }
});

/** One game frame's time (ms). */
export function playFrame(ms: number) {
  // (a long gap is the page away or paused, not a frame; and a few minutes is plenty)
  if (!on || ms > 500 || gaps.length > 20000) return;
  gaps.push(ms);
}

/** The level's left: send the summary (5 s of play at least). */
export function playEnd(why: string) {
  away = null;
  if (!on) return;
  on = false;
  if (gaps.length < 300) return;
  const s = [...gaps].sort((a, b) => a - b);
  const q = (p: number) => Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10;
  const pct = (over: number) => Math.round((s.filter((g) => g > over).length / s.length) * 1000) / 10;
  const report = {
    kind: 'play',
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
  void fetch(apiBase() + '/api/bench', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report }), keepalive: true }).catch(() => {});
}
