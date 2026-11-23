import { VERSION } from '../version';
import { quickBench, type BenchScores } from './bench';

/**
 * Light mode chosen by how quick the device is, measured: once per version, on its first start,
 * behind the loading screen, before the game's code runs (so the game starts in the right mode
 * straight away — no switching, no reload). About half a second, a second at most on a slow device.
 *
 * The line comes from the owner's own devices (the ?bench page, v0.373): a slow Android tablet
 * (Adreno 619) struggles and an old iPad is on the edge — both light; a mid Android tablet
 * (Mali-G615), a recent iPhone and a computer play well — full. The quick check's CPU and GPU-fill
 * timings, each as a share of a reference (CPU_REF, FILL_REF: about where the slow tablet sits),
 * averaged: a device at LIGHT_AT or more is light. Theirs: slow tablet 1.2, old iPad 0.83, mid
 * tablet 0.58, iPhone and computer under 0.2. (Two numbers averaged, so one noisy timing alone
 * doesn't flip a device.)
 *
 * The choice is stored as `puffy.light = 'bench:<version>:<0|1>'` (see core/light), with the scores
 * in `puffy.bench` (for ?diag). A hand pick ('1' / '0', the ?lite / ?full links) is never measured
 * over; nor a graphics-memory switch this version ('auto:<version>'). The old speed check's 'slow',
 * another version's 'auto:' and another version's 'bench:' are measured afresh.
 */
const CPU_REF = 3; // ms a batch (quickBench's CPU)
const FILL_REF = 0.65; // ms a screenful at the game's full-mode size (quickBench's GPU fill)
export const LIGHT_AT = 0.7;
const KEY = 'puffy.light';
const SCORES = 'puffy.bench';
/** Longer than this (the page in the background, say): give up, full mode this time, measure next start. */
const GIVE_UP_MS = 3000;

/** The quick check's scores as one number (see above); null if it couldn't time the graphics at all. */
export function lightScore(s: Pick<BenchScores, 'cpuMs' | 'fillMs'>): number | null {
  if (s.fillMs == null) return null;
  const parts = [s.fillMs / FILL_REF];
  if (s.cpuMs != null) parts.push(s.cpuMs / CPU_REF);
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/** Whether this start needs the check (nothing picked by hand, nothing measured for this version). */
function needed(): boolean {
  if (navigator.webdriver) return false; // (test browsers say which mode they want)
  if (/[?&](lite|full)(?:[=&]|$)/.test(location.search)) return false; // (picked by hand right now: core/light)
  let v: string | null;
  try {
    v = localStorage.getItem(KEY);
  } catch {
    return false; // (nowhere to keep the answer: full mode, unmeasured)
  }
  if (v === '0') return false;
  // ('1' is a hand pick — or, before v0.332, a graphics loss that core/light lets go once: measured then)
  if (v === '1') return !localStorage.getItem('puffy.lightRetried');
  if (v === `auto:${VERSION}`) return false;
  if (v?.startsWith(`bench:${VERSION}:`)) return false;
  return true;
}

/** Measure and store, if this start needs it (see above). Resolves once the game can start. */
export async function pickLight(): Promise<void> {
  if (!needed() || document.hidden) return;
  const scores = await Promise.race([quickBench(), new Promise<null>((r) => setTimeout(() => r(null), GIVE_UP_MS))]);
  if (!scores) return;
  const score = lightScore(scores);
  // (no WebGL to time: the game falls back to drawing without the graphics chip — light mode)
  const light = score == null || score >= LIGHT_AT;
  try {
    localStorage.setItem(KEY, `bench:${VERSION}:${light ? 1 : 0}`);
    localStorage.setItem(SCORES, JSON.stringify({ v: VERSION, cpu: scores.cpuMs, fill: scores.fillMs, upload: scores.uploadMs, score: score == null ? null : Math.round(score * 100) / 100, took: Math.round(scores.tookMs) }));
  } catch {
    /* private mode: full this time */
  }
}
