import type { Step } from '../gfx/textures';

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
    let slice = performance.now();
    for (let i = 0; i < steps.length; i++) {
      steps[i].run();
      bar.style.setProperty('--p', String((i + 1) / steps.length));
      if (performance.now() - slice > 40) {
        await nextFrame();
        slice = performance.now();
      }
    }
    await nextFrame();
    el.remove();
  };
  const p = run().finally(() => {
    if (busy === p) busy = null;
  });
  busy = p;
  return p;
}
