import { isSliceJob, type Step } from '../gfx/textures';

/** Resolves on the next animation frame (or soon after, if frames are paused). */
const nextFrame = () =>
  new Promise<void>((r) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      r();
    };
    requestAnimationFrame(go);
    setTimeout(go, 50);
  });

let busy: Promise<void> | null = null;

/**
 * Draw a game's art (only what isn't drawn yet) behind a small loading card: a few steps per
 * frame, the bar moving between them. Nothing to draw: no card at all.
 */
/**
 * One drawing step, and on with the rest if it fails: a step that threw used to stop the loading
 * card where it was, for good — and with it every Play after, waiting on it. (A picture that
 * couldn't be drawn shows as Phaser's "missing" one; the game goes on.)
 */
function runSafely(step: () => void) {
  try {
    step();
  } catch (e) {
    console.error('A drawing step failed:', e);
  }
}

export function loadArt(steps: Step[], label = 'Loading…'): Promise<void> {
  if (!steps.length) return busy ?? Promise.resolve();
  const run = async () => {
    if (busy) await busy;
    const el = document.createElement('div');
    el.className = 'art-loader';
    el.innerHTML = `<div class="al-card"><p>${label}</p><div class="boot-bar"></div></div>`;
    document.getElementById('ui')?.appendChild(el);
    const bar = el.querySelector<HTMLElement>('.boot-bar')!;
    // (shown first, before any drawing starts)
    await nextFrame();
    await nextFrame();
    try {
      let slice = performance.now();
      for (let i = 0; i < steps.length; i++) {
        runSafely(steps[i].run);
        bar.style.setProperty('--p', String((i + 1) / steps.length));
        // (a step that wants a frame of its own: the browser paints its drawing at the frame's end)
        if (steps[i].own || performance.now() - slice > 40) {
          await nextFrame();
          slice = performance.now();
        }
      }
      // (a couple of frames with everything drawn on show behind the card: the new pictures are on
      // the graphics chip before the level starts)
      await nextFrame();
      await nextFrame();
    } finally {
      el.remove();
    }
  };
  const p = run().finally(() => {
    if (busy === p) busy = null;
  });
  busy = p;
  return p;
}

/**
 * The same small loading card, for a queue of drawing jobs that can grow as it goes (each job may
 * put more in line): `take` gives the next one (null: all done), `left` how many are waiting.
 */
export function loadArtQueue(take: () => (() => void) | null, left: () => number, label = 'Loading…', ownFrames = false): Promise<void> {
  const run = async () => {
    if (busy) await busy;
    const el = document.createElement('div');
    el.className = 'art-loader';
    el.innerHTML = `<div class="al-card"><p>${label}</p><div class="boot-bar"></div></div>`;
    document.getElementById('ui')?.appendChild(el);
    const bar = el.querySelector<HTMLElement>('.boot-bar')!;
    await nextFrame();
    await nextFrame();
    let done = 0;
    let slice = performance.now();
    for (let job = take(); job; job = take()) {
      runSafely(job);
      done++;
      // (never backwards: a job that adds more only slows the bar down)
      const p = done / (done + left());
      bar.style.setProperty('--p', String(Math.max(Number(bar.style.getPropertyValue('--p') || 0), p)));
      // (`ownFrames`: a job whose drawing the browser paints at the end of its frame has that frame to
      // itself — see ownFrame)
      if (performance.now() - slice > 40 || (ownFrames && isSliceJob(job))) {
        await nextFrame();
        slice = performance.now();
      }
    }
    bar.style.setProperty('--p', '1');
    await nextFrame();
    await nextFrame();
    el.remove();
  };
  const p = run().finally(() => {
    if (busy === p) busy = null;
  });
  busy = p;
  return p;
}
