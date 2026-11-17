/**
 * The screen's refresh rate (ms between frames): the median of a dozen frame gaps. Started by the
 * page's first script (see entry.ts), so it's measured while the game's code is still on its way
 * (a fresh visit) instead of after it, when the game would otherwise sit waiting for it.
 *
 * Gives up (60 Hz) only when no frames come while the page is free to draw them, e.g. opened in a
 * background tab: a frame held up by the game's own code starting is just one slow gap.
 */
export const refreshMs: Promise<number> = new Promise((resolve) => {
  const gaps: number[] = [];
  let last = 0;
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    gaps.sort((a, b) => a - b);
    resolve(gaps.length >= 6 ? gaps[Math.floor(gaps.length / 2)] : 1000 / 60);
  };
  const WAIT = 700;
  let tries = 0;
  const arm = () => {
    const at = performance.now();
    return setTimeout(() => {
      // (late: the page was busy, not missing frames — e.g. the game's code starting; wait on)
      if (performance.now() - at > WAIT + 100 && !document.hidden && ++tries < 8) timeout = arm();
      else done();
    }, WAIT);
  };
  let timeout = arm();
  // (the first frames, the loading screen's first paint, aren't counted: they can run long; nor is
  // a gap over 100 ms — no screen is that slow: that's the page busy, e.g. the game's code starting)
  let skip = 2;
  const tick = (t: number) => {
    if (skip > 0) skip--;
    else if (last && t - last <= 100) gaps.push(t - last);
    last = t;
    if (gaps.length < 12) requestAnimationFrame(tick);
    else {
      clearTimeout(timeout);
      done();
    }
  };
  requestAnimationFrame(tick);
});
