/**
 * The hidden device-check page: `?bench` in the address (never linked from the game). For working
 * out which devices should play in light mode: run it on each device, say how the game plays there,
 * and send the report; `?bench=list` (testers' accounts only) shows every report side by side.
 *
 * A run (about half a minute):
 * 1. the quick check, then the full one (core/bench), on a calm page: the same numbers both ways,
 *    to see whether the quick one (short enough to run behind the loading screen) tells devices
 *    apart as well as the full one;
 * 2. the game itself, started as normal in this device's mode, its start screen timed for 10 s once
 *    it's settled (nothing on this page changes the device's mode: see BENCH in core/light);
 * 3. the start screen's three background layers drawn by the game's own drawing code, timed.
 *
 * Loaded only for `?bench` (see entry.ts); the game's code comes in only at step 2 (from main.ts,
 * which hands over what this page reads), so nothing here is in the game's own files.
 */
import { fullBench, quickBench, timeLayers, type BenchScores } from '../core/bench';
import { refreshMs } from '../core/refresh';

type Main = typeof import('../main');
type GameLike = {
  registry: { get(k: string): unknown };
  scene: { isActive(k: string): boolean; getScene(k: string): unknown };
  events: { on(e: string, fn: () => void): void; off(e: string, fn: () => void): void };
  loop: { sleep(): void };
};

const LIST = new URLSearchParams(location.search).get('bench') === 'list';
const FEELS = { great: 'Plays great', ok: 'Plays OK', struggles: 'Struggles' } as const;
type Feel = keyof typeof FEELS;

// ─────────────────────────────────────────────────────────── the page ──

const css = `
html.benching, html.benching body { touch-action: auto; user-select: text; -webkit-user-select: text; -webkit-touch-callout: default; }
#bench { position: fixed; inset: 0; z-index: 1000; overflow: auto; -webkit-overflow-scrolling: touch; touch-action: pan-x pan-y;
  background: var(--paper); color: var(--ink); font: 600 15px/1.4 var(--body);
  padding: calc(16px + var(--safe-t)) calc(16px + var(--safe-r)) calc(24px + var(--safe-b)) calc(16px + var(--safe-l)); }
#bench .in { max-width: 760px; margin: 0 auto; }
#bench.wide .in { max-width: none; }
#bench h1 { font: 400 30px/1.1 var(--display); margin: 0 0 6px; }
#bench h2 { font: 400 20px/1.2 var(--display); margin: 22px 0 6px; }
#bench p { margin: 6px 0; }
#bench .soft { color: var(--ink-soft); font-weight: 600; font-size: 13px; }
#bench table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
#bench th, #bench td { text-align: left; vertical-align: top; padding: 5px 8px; border-bottom: 1px solid #3a241822; }
#bench th { font-weight: 800; }
#bench td.n, #bench th.n { text-align: right; white-space: nowrap; }
#bench .kv th { width: 38%; font-weight: 700; color: var(--ink-soft); }
#bench .kv td { word-break: break-word; }
#bench .scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 2px solid var(--ink); border-radius: 12px; background: #fff; }
#bench .scroll table { width: auto; min-width: 100%; }
#bench .scroll th { position: sticky; top: 0; background: #fff3d6; white-space: nowrap; }
#bench .scroll td { white-space: nowrap; }
#bench .scroll td.long { max-width: 220px; overflow: hidden; text-overflow: ellipsis; font-size: 13px; color: var(--ink-soft); }
#bench .scroll td.dev, #bench .scroll th:first-child { position: sticky; left: 0; z-index: 1; background: #fff; font-weight: 800; box-shadow: 1px 0 0 #3a241822; }
#bench .scroll th:first-child { z-index: 2; background: #fff3d6; }
#bench button { font: 400 19px/1 var(--display); color: var(--ink); background: var(--gold); border: 3px solid var(--ink); border-radius: 14px;
  box-shadow: 0 3px 0 var(--ink); padding: 11px 20px; margin: 4px 8px 4px 0; cursor: pointer; }
#bench button.alt { background: #fff; }
#bench button:disabled { opacity: 0.5; cursor: default; }
#bench input[type=text] { font: 700 16px var(--body); color: var(--ink); width: 100%; max-width: 420px; padding: 10px 12px; border: 2px solid var(--ink); border-radius: 10px; background: #fff; }
#bench .feel { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 4px; }
#bench .feel label { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border: 2px solid var(--ink); border-radius: 10px; background: #fff; cursor: pointer; }
#bench .feel input { width: 18px; height: 18px; margin: 0; }
#bench .msg { font-weight: 800; min-height: 1.4em; }
#bench .bad { color: #b0412f; }
#bench .good { color: #2f7d1f; }
#bench .chip { display: inline-block; padding: 1px 8px; border-radius: 8px; font-weight: 800; }
#bench .chip.great { background: #c9f2b8; } #bench .chip.ok { background: #ffe9a6; } #bench .chip.struggles { background: #ffc4bd; }
#bench .bar { height: 10px; border: 2px solid var(--ink); border-radius: 6px; background: #fff; overflow: hidden; max-width: 420px; margin: 8px 0; }
#bench .bar i { display: block; height: 100%; width: 0; background: var(--gold); }
#bench-note { position: fixed; z-index: 1001; left: 50%; top: calc(10px + var(--safe-t)); transform: translateX(-50%); pointer-events: none;
  font: 700 14px/1.3 var(--body); color: #fff; background: #000a; border-radius: 10px; padding: 6px 12px; text-align: center; max-width: 90vw; }
`;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const na = (v: unknown, unit = '') => (v === null || v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v)) ? 'n/a' : `${v}${unit}`);
const ms = (v: number | null | undefined) => (v === null || v === undefined ? 'n/a' : `${v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v)} ms`);

const panel = document.createElement('div');
panel.id = 'bench';
const inner = document.createElement('div');
inner.className = 'in';
panel.appendChild(inner);
// (the game's keys — space, the arrows — aren't the game's while typing here)
for (const ev of ['keydown', 'keyup']) panel.addEventListener(ev, (e) => e.stopPropagation());

function showPanel(on: boolean) {
  panel.hidden = !on;
  document.documentElement.classList.toggle('benching', on);
  const boot = document.getElementById('boot');
  if (boot) boot.style.display = on ? 'none' : '';
}

function mount() {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.appendChild(panel);
  document.title = LIST ? 'Puffy: device reports' : 'Puffy: device check';
  showPanel(true);
}

// ───────────────────────────────────────────────────── what the device says ──

interface Specs {
  ua: string;
  model: string | null;
  platform: string | null;
  platformVersion: string | null;
  architecture: string | null;
  browsers: string | null;
  mobile: boolean | null;
  cores: number | null;
  memoryGB: number | null;
  touchPoints: number | null;
  screen: string;
  window: string;
  dpr: number;
  /** The refresh rate measured here (1 s of frames), and the one the game measured at start-up (Hz). */
  refreshHz: number | null;
  gameRefreshHz: number | null;
  gl: { renderer: string | null; vendor: string | null; maxTexture: number | null; maxUnits: number | null; webgl2: boolean; parallelCompile: boolean };
}

type UAData = { mobile?: boolean; platform?: string; getHighEntropyValues(h: string[]): Promise<Record<string, unknown>> };

async function readSpecs(): Promise<Specs> {
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: UAData };
  // (Chrome on Android and computers: the model and versions, if asked for; Safari and Firefox: none of it)
  let hi: Record<string, unknown> = {};
  try {
    if (nav.userAgentData?.getHighEntropyValues)
      hi = await Promise.race([nav.userAgentData.getHighEntropyValues(['model', 'platformVersion', 'architecture', 'fullVersionList']), new Promise<Record<string, unknown>>((r) => setTimeout(() => r({}), 1500))]);
  } catch {
    /* not allowed */
  }
  const list = Array.isArray(hi.fullVersionList) ? (hi.fullVersionList as { brand: string; version: string }[]).filter((b) => !/not.?a.?brand/i.test(b.brand)).map((b) => `${b.brand} ${b.version}`).join(', ') : null;
  return {
    ua: navigator.userAgent,
    model: typeof hi.model === 'string' && hi.model ? hi.model : null,
    platform: nav.userAgentData?.platform || null,
    platformVersion: typeof hi.platformVersion === 'string' && hi.platformVersion ? hi.platformVersion : null,
    architecture: typeof hi.architecture === 'string' && hi.architecture ? hi.architecture : null,
    browsers: list || null,
    mobile: nav.userAgentData ? !!nav.userAgentData.mobile : null,
    cores: navigator.hardwareConcurrency || null,
    memoryGB: nav.deviceMemory ?? null,
    touchPoints: navigator.maxTouchPoints ?? null,
    screen: `${screen.width}×${screen.height}`,
    window: `${innerWidth}×${innerHeight}`,
    dpr: Math.round(devicePixelRatio * 1000) / 1000,
    refreshHz: await measureHz(),
    gameRefreshHz: Math.round(1000 / (await refreshMs)),
    gl: glInfo(),
  };
}

/** The screen's refresh rate: the median gap between frames over about a second. */
function measureHz(): Promise<number | null> {
  return new Promise((resolve) => {
    const gaps: number[] = [];
    let last = 0;
    const stop = setTimeout(() => resolve(null), 3000);
    const tick = (t: number) => {
      if (last && t - last < 100) gaps.push(t - last);
      last = t;
      if (gaps.length < 60) return void requestAnimationFrame(tick);
      clearTimeout(stop);
      gaps.sort((a, b) => a - b);
      resolve(Math.round(1000 / gaps[gaps.length >> 1]));
    };
    requestAnimationFrame(tick);
  });
}

function glInfo(): Specs['gl'] {
  const out: Specs['gl'] = { renderer: null, vendor: null, maxTexture: null, maxUnits: null, webgl2: false, parallelCompile: false };
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl) {
      // (the chip's real name where the browser gives it: Chrome and Firefox do, Safari says "Apple GPU")
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      out.renderer = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '') || null;
      out.vendor = String(gl.getParameter(dbg ? dbg.UNMASKED_VENDOR_WEBGL : gl.VENDOR) ?? '') || null;
      out.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      out.maxUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) as number;
      out.parallelCompile = !!gl.getSupportedExtensions()?.includes('KHR_parallel_shader_compile');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    /* no WebGL */
  }
  try {
    const gl2 = document.createElement('canvas').getContext('webgl2');
    out.webgl2 = !!gl2;
    if (gl2) {
      out.parallelCompile ||= !!gl2.getSupportedExtensions()?.includes('KHR_parallel_shader_compile');
      gl2.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    /* no WebGL 2 */
  }
  return out;
}

// ─────────────────────────────────────────────────── the game's own start screen ──

interface StartScreen {
  /** Seconds timed, frames seen, the median and 90th-percentile gap between frames (ms). */
  seconds: number;
  frames: number;
  medianMs: number;
  p90Ms: number;
  fps: number;
  /** Frames over 40 ms (a visible stutter), as a percentage. */
  longPct: number;
  /** How long the game took from starting to its start screen being up and settled (s). */
  loadS: number;
  /** The resolution it drew at (see main.ts's __res). */
  res: unknown;
}

interface GameState {
  version: string;
  mode: 'light' | 'full';
  /** Why, from what this device has stored (`puffy.light`, see core/light). */
  why: string;
  /** What was stored when the page opened, and once the game had started (it clears an old version's). */
  saved: string;
  savedNow: string;
  seenAs: string;
  smooth: string;
}

/** What's stored for light mode on this device (see core/light): the value, or (none). */
function savedLight() {
  try {
    return localStorage.getItem('puffy.light') ?? '(none)';
  } catch {
    return '(no storage)';
  }
}
/** (read before the game starts: it can clear an old version's value) */
const savedAtOpen = savedLight();

/** Why the game is in the mode it's in, from what was stored (core/light's rules, in words). */
function lightWhy(saved: string, light: boolean) {
  if (saved === '1') return 'picked by hand (?lite)';
  if (saved === '0') return 'picked by hand (?full)';
  if (saved === 'slow') return 'switched on by the old speed check (before v0.372)';
  if (saved.startsWith('bench:')) return `measured by the device check (v${saved.split(':')[1]}): ${saved.endsWith(':1') ? 'light' : 'full'}`;
  if (saved.startsWith('auto:')) return light ? `the graphics ran out of memory in v${saved.slice(5)}` : `an older version's memory switch (v${saved.slice(5)}), cleared`;
  if (saved === '(no storage)') return "can't store a choice here (private browsing?)";
  return light ? 'light (nothing stored)' : 'the default: nothing picked or switched';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The game started as normal and its start screen timed (see the top of this file). */
async function runGame(note: (s: string) => void): Promise<{ m: Main; game: GameLike | null; start: StartScreen | null; why?: string }> {
  const t0 = performance.now();
  note('Starting the game…');
  const m = await import('../main');
  const w = window as unknown as { game?: GameLike; __res?: () => unknown };
  // ready (its loading screen gone)…
  while (!w.game?.registry.get('ready')) {
    if (performance.now() - t0 > 120000) return { m, game: w.game ?? null, start: null, why: 'the game took over 2 minutes to load' };
    await sleep(100);
  }
  const game = w.game;
  // …and settled: the start screen up, nothing being drawn ahead (as the game's own check waits for)
  const up = performance.now();
  for (;;) {
    const menu = game.scene.getScene('Menu') as { quietLeft?: number } | null;
    const shown = !document.hidden && game.scene.isActive('Menu') && !document.querySelector('.art-loader') && !document.body.classList.contains('booting');
    if (shown && (!(menu?.quietLeft ?? 0) || performance.now() - up > 15000)) break;
    note(`Waiting for the start screen to settle… ${menu?.quietLeft ?? 0} drawing jobs left`);
    if (performance.now() - up > 60000) return { m, game, start: null, why: 'the start screen never settled' };
    await sleep(200);
  }
  const loadS = Math.round((performance.now() - t0) / 100) / 10;
  await sleep(1000);
  // the real time between frames the game draws (as its own check measures: its 'step' each frame)
  const SECS = 10;
  const gaps: number[] = [];
  let last = 0;
  const onStep = () => {
    const t = performance.now();
    if (last && t - last < 1000) gaps.push(t - last);
    last = t;
  };
  game.events.on('step', onStep);
  const until = performance.now() + SECS * 1000;
  while (performance.now() < until) {
    note(`Timing the game's start screen… ${Math.ceil((until - performance.now()) / 1000)} s (hands off)`);
    await sleep(250);
  }
  game.events.off('step', onStep);
  if (gaps.length < 10) return { m, game, start: null, why: 'too few frames (was the page in the background?)' };
  const s = [...gaps].sort((a, b) => a - b);
  const med = s[s.length >> 1];
  const p90 = s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
  return {
    m,
    game,
    start: {
      seconds: SECS,
      frames: gaps.length,
      medianMs: Math.round(med * 10) / 10,
      p90Ms: Math.round(p90 * 10) / 10,
      fps: Math.round(1000 / med),
      longPct: Math.round((gaps.filter((g) => g > 40).length / gaps.length) * 1000) / 10,
      loadS,
      res: w.__res?.() ?? null,
    },
  };
}

function gameState(m: Main): GameState {
  return { version: m.VERSION, mode: m.LIGHT ? 'light' : 'full', why: lightWhy(savedAtOpen, m.LIGHT), saved: savedAtOpen, savedNow: savedLight(), seenAs: m.diag.seenAs, smooth: m.diag.smooth };
}

/** The start screen's three background layers (far, hills, near), as the game draws them, finished. */
function layerDrawer(m: Main) {
  const L = m.BG_LAYERS;
  const pal = m.DEFAULT_PALETTE;
  const one = (w: number, h: number, fn: (ctx: CanvasRenderingContext2D) => void) => {
    // (as the game's own: 2 clear rows above and below, at its background resolution, 1)
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h + 4;
    const ctx = c.getContext('2d')!;
    ctx.translate(0, 2);
    fn(ctx);
    // (reading a pixel back waits for the drawing to be done: some browsers only do it then)
    ctx.getImageData(0, 0, 1, 1);
  };
  return () => {
    one(L.far.w, L.far.h, (ctx) => m.drawFarLayer(ctx, L.far.w, L.far.h, pal));
    one(L.hills.w, L.hills.h, (ctx) => m.drawHillsLayer(ctx, L.hills.w, L.hills.h, pal));
    one(L.near.w, L.near.h, (ctx) => m.drawNearLayer(ctx, L.near.w, L.near.h, pal));
  };
}

// ─────────────────────────────────────────────────────────────── the report ──

interface Report {
  v: 1;
  name: string;
  feel: Feel | '';
  at: string;
  specs: Specs;
  game: GameState | null;
  quick: BenchScores;
  full: BenchScores;
  start: StartScreen | null;
  startNote?: string;
}

function rows(r: Report): [string, string, string][] {
  const s = r.specs;
  const g = r.game;
  const st = r.start;
  return [
    ['Device', 'Model', na(s.model)],
    ['Device', 'Platform', na([s.platform, s.platformVersion, s.architecture].filter(Boolean).join(' '))],
    ['Device', 'Browser', na(s.browsers)],
    ['Device', 'User agent', s.ua],
    ['Device', 'CPU cores', na(s.cores)],
    ['Device', 'Memory', na(s.memoryGB, ' GB')],
    ['Device', 'Touch points', na(s.touchPoints)],
    ['Screen', 'Screen', s.screen],
    ['Screen', 'Window', `${s.window} @ ${s.dpr}x`],
    ['Screen', 'Refresh rate', `${na(s.refreshHz, ' Hz')} (the game measured ${na(s.gameRefreshHz, ' Hz')})`],
    ['Graphics', 'Chip', na(s.gl.renderer)],
    ['Graphics', 'Vendor', na(s.gl.vendor)],
    ['Graphics', 'Biggest picture', na(s.gl.maxTexture, ' px')],
    ['Graphics', 'Pictures at once', na(s.gl.maxUnits)],
    ['Graphics', 'WebGL 2', s.gl.webgl2 ? 'yes' : 'no'],
    ['Graphics', 'Parallel shader compile', s.gl.parallelCompile ? 'yes' : 'no'],
    ['Game', 'Version', na(g?.version)],
    ['Game', 'Mode now', g ? `${g.mode} (${g.why})` : 'n/a'],
    ['Game', 'Stored (puffy.light)', g ? (g.saved === g.savedNow ? g.saved : `${g.saved} (now ${g.savedNow})`) : 'n/a'],
    ['Game', 'Seen as', na(g?.seenAs)],
    ['Start screen', 'Frame gap (median / p90)', st ? `${st.medianMs} / ${st.p90Ms} ms (${st.fps} fps)` : `n/a${r.startNote ? ` (${r.startNote})` : ''}`],
    ['Start screen', 'Long frames (over 40 ms)', st ? `${st.longPct}%` : 'n/a'],
    ['Start screen', 'Load time', st ? `${st.loadS} s` : 'n/a'],
  ];
}

const SCORE_ROWS: [string, keyof BenchScores, string][] = [
  ['CPU (game-like update)', 'cpuMs', 'ms a round'],
  ['GPU fill', 'fillMs', 'ms a screenful'],
  ['Upload 1024×512', 'uploadMs', 'ms a picture'],
  ['Canvas 2D layers', 'layerMs', 'ms for three'],
  ['GPU setup', 'setupMs', 'ms, once'],
];

function asText(r: Report) {
  const out = [`Puffy device check: ${r.name || '(no name)'} · ${r.feel ? FEELS[r.feel] : '(not said)'} · ${r.at}`];
  let group = '';
  for (const [g, k, v] of rows(r)) {
    if (g !== group) out.push('', `[${(group = g)}]`);
    out.push(`${k}: ${v}`);
  }
  out.push('', `[Scores: quick / full]  (game size ${r.full.fillW}×${r.full.fillH})`);
  for (const [label, key] of SCORE_ROWS) out.push(`${label}: ${ms(r.quick[key] as number | null)} / ${ms(r.full[key] as number | null)}`);
  out.push(`Took: ${r.quick.tookMs} / ${r.full.tookMs} ms (longest step ${r.quick.longestStepMs} / ${r.full.longestStepMs} ms)`);
  const notes = [...r.quick.notes.map((n) => `quick: ${n}`), ...r.full.notes.map((n) => `full: ${n}`)];
  if (notes.length) out.push(`Notes: ${notes.join('; ')}`);
  return out.join('\n');
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // (older browsers, or not allowed: the old way, from a hidden text box)
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    panel.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      /* no copying here */
    }
    ta.remove();
    return ok;
  }
}

// ─────────────────────────────────────────────────────────── the check itself ──

async function checkPage() {
  inner.innerHTML = `
    <h1>Puffy device check</h1>
    <p>Times this device at what the game spends its time on, to help choose light mode automatically.
    It takes about half a minute: two checks, then the game's own start screen for 10 seconds.</p>
    <p class="soft">Keep the screen on and don't touch it while it runs. Nothing is sent until you press Send.</p>
    <p><button data-act="run">Run</button></p>
    <div class="bar" hidden><i></i></div>
    <p class="msg" data-el="progress"></p>
    <div data-el="out"></div>`;
  const runBtn = inner.querySelector<HTMLButtonElement>('[data-act=run]')!;
  const bar = inner.querySelector<HTMLElement>('.bar')!;
  const fillBar = bar.querySelector('i')!;
  const progress = inner.querySelector<HTMLElement>('[data-el=progress]')!;
  const say = (s: string, frac?: number) => {
    progress.textContent = s;
    if (frac !== undefined) fillBar.style.width = `${Math.round(frac * 100)}%`;
  };
  const specsP = readSpecs();
  runBtn.onclick = async () => {
    runBtn.disabled = true;
    bar.hidden = false;
    say('Getting ready…', 0);
    const specs = await specsP;
    // (each part's share of the bar, roughly by how long it takes)
    say('Quick check…', 0.02);
    const quick = await quickBench();
    const full = await fullBench({ onProgress: (what, done) => say(`Full check: ${what}…`, 0.05 + done * 0.3) });
    // the game, its start screen timed: the page steps aside (its loading screen shows as normal)
    say('Starting the game…', 0.4);
    const note = document.createElement('div');
    note.id = 'bench-note';
    document.body.appendChild(note);
    showPanel(false);
    let game: Awaited<ReturnType<typeof runGame>>;
    try {
      game = await runGame((s) => (note.textContent = s));
    } catch (e) {
      note.remove();
      showPanel(true);
      say(`The game didn't start: ${(e as Error).message}`);
      return;
    }
    // (the game put to sleep, and its music off: the rest is this page's)
    game.m.stopMusic();
    game.game?.loop.sleep();
    note.remove();
    showPanel(true);
    say('Drawing the start screen layers…', 0.9);
    const layers = await timeLayers(layerDrawer(game.m), 5);
    full.layerMs = layers.ms;
    full.samples.layer = layers.samples;
    full.notes.push(...layers.notes);
    say('Done.', 1);
    bar.hidden = true;
    const report: Report = { v: 1, name: '', feel: '', at: new Date().toISOString(), specs, game: gameState(game.m), quick, full, start: game.start, ...(game.why ? { startNote: game.why } : {}) };
    showResults(report);
    runBtn.textContent = 'Run again';
    runBtn.disabled = false;
    // (the game is loaded now: a fresh page for a fair second run)
    runBtn.onclick = () => location.reload();
  };
}

function showResults(r: Report) {
  const out = inner.querySelector<HTMLElement>('[data-el=out]')!;
  const scoreRows = SCORE_ROWS.map(([label, key, unit]) => `<tr><th>${label}</th><td class="n">${ms(r.quick[key] as number | null)}</td><td class="n">${ms(r.full[key] as number | null)}</td><td class="soft">${unit}</td></tr>`).join('');
  let group = '';
  const kv = rows(r)
    .map(([g, k, v]) => {
      const head = g !== group ? `<tr><td colspan="2"><h2>${esc((group = g))}</h2></td></tr>` : '';
      return `${head}<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
    })
    .join('');
  const notes = [...r.quick.notes.map((n) => `quick: ${n}`), ...r.full.notes.map((n) => `full: ${n}`)];
  out.innerHTML = `
    <h2>Send this report</h2>
    <p><input type="text" data-el="name" maxlength="60" placeholder="Name this device, e.g. Slow tablet" autocomplete="off"></p>
    <p style="margin-top:12px">How does Puffy play on this device?</p>
    <div class="feel">${Object.entries(FEELS).map(([k, v]) => `<label><input type="radio" name="feel" value="${k}"> ${v}</label>`).join('')}</div>
    <p><button data-act="send">Send</button><button class="alt" data-act="copy">Copy</button></p>
    <p class="msg" data-el="sent"></p>
    <h2>Scores</h2>
    <table><tr><th></th><th class="n">Quick</th><th class="n">Full</th><th></th></tr>${scoreRows}
      <tr><th>Took</th><td class="n">${r.quick.tookMs} ms</td><td class="n">${r.full.tookMs} ms</td><td class="soft">in all</td></tr>
      <tr><th>Longest step</th><td class="n">${r.quick.longestStepMs} ms</td><td class="n">${r.full.longestStepMs} ms</td><td class="soft">page held up</td></tr></table>
    <p class="soft">Lower is faster. GPU fill is at the size the game draws at in full mode here: ${r.full.fillW}×${r.full.fillH} pixels.${notes.length ? ` Notes: ${esc(notes.join('; '))}` : ''}</p>
    <table class="kv">${kv}</table>`;
  const name = out.querySelector<HTMLInputElement>('[data-el=name]')!;
  const sent = out.querySelector<HTMLElement>('[data-el=sent]')!;
  const sendBtn = out.querySelector<HTMLButtonElement>('[data-act=send]')!;
  const fill = () => {
    r.name = name.value.replace(/\s+/g, ' ').trim().slice(0, 60);
    r.feel = (out.querySelector<HTMLInputElement>('input[name=feel]:checked')?.value ?? '') as Feel | '';
  };
  const tell = (s: string, ok: boolean) => {
    sent.textContent = s;
    sent.className = `msg ${ok ? 'good' : 'bad'}`;
  };
  sendBtn.onclick = async () => {
    fill();
    if (!r.name) return void (tell('Give the device a name first.', false), name.focus());
    if (!r.feel) return void tell('Pick how Puffy plays on this device first.', false);
    sendBtn.disabled = true;
    tell('Sending…', true);
    try {
      const res = await fetch('/api/bench', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report: r }) });
      const data = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `the server said ${res.status}`);
      tell(`Sent, thank you! (report #${data.id})`, true);
    } catch (e) {
      sendBtn.disabled = false;
      tell(`Couldn't send: ${(e as Error).message} Try Copy instead.`, false);
    }
  };
  out.querySelector<HTMLButtonElement>('[data-act=copy]')!.onclick = async () => {
    fill();
    tell((await copyText(asText(r))) ? 'Copied: paste it into a message.' : "Couldn't copy here: select the text below instead.", true);
  };
}

// ──────────────────────────────────────────────────────────── the list ──

interface Stored {
  id: number;
  at: string;
  ua: string;
  name: string;
  feel: string;
  report: Partial<Report>;
}

/** A signed-in session for this device's account (as the game keeps it), signing in again if needed. */
async function authed(path: string): Promise<Response> {
  const get = (t: string | null) => fetch(path, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  let token: string | null = null;
  try {
    token = localStorage.getItem('puffy.token');
  } catch {
    /* private mode */
  }
  let res = await get(token);
  if (res.status !== 401) return res;
  // (the session's gone: sign in again with the name and password the game keeps on this device)
  try {
    const creds = JSON.parse(localStorage.getItem('puffy.account') ?? 'null') as { name?: string; password?: string } | null;
    if (!creds?.name || !creds.password) return res;
    const login = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: creds.name, password: creds.password }) });
    if (!login.ok) return res;
    const t = String(((await login.json()) as { token?: string }).token ?? '');
    localStorage.setItem('puffy.token', t);
    res = await get(t);
  } catch {
    /* no saved account */
  }
  return res;
}

/** The list's columns: the scores first (the device's name stays in view as the table scrolls sideways). */
const COLUMNS: [string, (s: Stored) => string, boolean?][] = [
  ['Device', (s) => s.name],
  ['Plays', (s) => s.feel],
  ['Mode', (s) => na(s.report.game?.mode)],
  ['CPU q', (s) => ms(s.report.quick?.cpuMs), true],
  ['CPU f', (s) => ms(s.report.full?.cpuMs), true],
  ['Fill q', (s) => ms(s.report.quick?.fillMs), true],
  ['Fill f', (s) => ms(s.report.full?.fillMs), true],
  ['Upload q', (s) => ms(s.report.quick?.uploadMs), true],
  ['Upload f', (s) => ms(s.report.full?.uploadMs), true],
  ['Layers', (s) => ms(s.report.full?.layerMs), true],
  ['Start median', (s) => (s.report.start ? `${s.report.start.medianMs} ms` : 'n/a'), true],
  ['Start p90', (s) => (s.report.start ? `${s.report.start.p90Ms} ms` : 'n/a'), true],
  ['Long %', (s) => (s.report.start ? `${s.report.start.longPct}%` : 'n/a'), true],
  ['Load', (s) => (s.report.start ? `${s.report.start.loadS} s` : 'n/a'), true],
  ['Fill size', (s) => (s.report.full ? `${s.report.full.fillW}×${s.report.full.fillH}` : 'n/a')],
  ['Window', (s) => (s.report.specs ? `${s.report.specs.window} @${s.report.specs.dpr}` : 'n/a')],
  ['Hz', (s) => na(s.report.specs?.refreshHz), true],
  ['Cores', (s) => na(s.report.specs?.cores), true],
  ['GB', (s) => na(s.report.specs?.memoryGB), true],
  ['Max pic', (s) => na(s.report.specs?.gl?.maxTexture), true],
  ['Model', (s) => na(s.report.specs?.model)],
  ['Chip', (s) => na(s.report.specs?.gl?.renderer)],
  ['Setup q', (s) => ms(s.report.quick?.setupMs), true],
  ['Quick took', (s) => (s.report.quick ? `${s.report.quick.tookMs} ms` : 'n/a'), true],
  ['Quick step', (s) => (s.report.quick?.longestStepMs !== undefined ? `${s.report.quick.longestStepMs} ms` : 'n/a'), true],
  ['Why this mode', (s) => na(s.report.game?.why)],
  ['Stored', (s) => na(s.report.game?.saved)],
  ['Version', (s) => na(s.report.game?.version)],
  ['When', (s) => new Date(s.at).toLocaleString([], { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })],
  ['#', (s) => String(s.id), true],
  ['User agent', (s) => s.ua],
];
/** Long text: cut short in the table (all of it shows on hover, and in the CSV). */
const LONG = new Set(['Chip', 'Why this mode', 'User agent']);

async function listPage() {
  panel.classList.add('wide');
  inner.innerHTML = `<h1>Puffy device reports</h1><p class="msg" data-el="msg">Loading…</p><div data-el="out"></div>`;
  const msg = inner.querySelector<HTMLElement>('[data-el=msg]')!;
  let res: Response;
  try {
    res = await authed('/api/bench');
  } catch {
    msg.textContent = "Can't reach the server.";
    return;
  }
  if (res.status === 401 || res.status === 403) {
    msg.innerHTML = 'Testers only. Sign in to the game with a tester’s account on this device (Sign in, on the start screen), then open this page again.';
    msg.className = 'msg bad';
    return;
  }
  if (!res.ok) {
    msg.textContent = `The server said ${res.status}.`;
    return;
  }
  const { reports } = (await res.json()) as { reports: Stored[] };
  msg.className = 'msg soft';
  msg.textContent = `${reports.length} report${reports.length === 1 ? '' : 's'}, newest first. Times in ms: lower is faster (q: the quick check, f: the full one).`;
  const out = inner.querySelector<HTMLElement>('[data-el=out]')!;
  const head = COLUMNS.map(([h, , n]) => `<th${n ? ' class="n"' : ''}>${esc(h)}</th>`).join('');
  const body = reports
    .map(
      (s) =>
        `<tr>${COLUMNS.map(([h, f, n]) => {
          const v = f(s);
          if (h === 'Plays') return `<td><span class="chip ${esc(v)}">${esc(FEELS[v as Feel] ?? v)}</span></td>`;
          if (LONG.has(h)) return `<td class="long" title="${esc(v)}">${esc(v)}</td>`;
          return `<td${n ? ' class="n"' : h === 'Device' ? ' class="dev"' : ''}>${esc(v)}</td>`;
        }).join('')}</tr>`,
    )
    .join('');
  out.innerHTML = `<p><button class="alt" data-act="csv">Copy all (CSV)</button></p><div class="scroll"><table><tr>${head}</tr>${body}</table></div>`;
  out.querySelector<HTMLButtonElement>('[data-act=csv]')!.onclick = async () => {
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [COLUMNS.map(([h]) => cell(h)).join(','), ...reports.map((s) => COLUMNS.map(([, f]) => cell(f(s))).join(','))].join('\n');
    msg.textContent = (await copyText(csv)) ? 'Copied as CSV.' : "Couldn't copy here.";
  };
}

// (for testing, from the console or a test browser: the two runs on their own)
(window as unknown as { __bench: unknown }).__bench = { quickBench, fullBench };

mount();
void (LIST ? listPage() : checkPage());
