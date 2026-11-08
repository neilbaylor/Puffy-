import { LevelBuilder, type LevelData } from './builder';

/** (for checking the layout: every climb's ledges, bottom to top) */
export const LEDGES: { x0: number; x1: number; h: number }[][] = [];

/**
 * World 2 · Plop Invasion · Part 2 — mostly climbing UP (a rough first sketch: the layout and the
 * climbing, to try the camera and the feel; the parachute drops and the baseball game come next).
 *
 * Heights are in tiles from the bottom of the level. A jump clears ~3.5 tiles (~5 with the
 * second jump), so the ledges go up 3 at a time.
 *
 *    0- 41  CLIMB 1: ledges zig-zagging up (and drifting right) from the floor to ~91; a plateau,
 *           checkpoint, a poo goat; then the edge
 *   42- 93  DROP 1 by parachute (a wall at 94-95 keeps you out of climb 2: you land at the bottom),
 *           a short walk right, the ballpark (flat, for now), quicksand poo
 *   96-133  CLIMB 2 (longer): up to ~127, a plateau, checkpoint; the edge
 *  134-147  DROP 2 by parachute (longer, harder: a narrow shaft, more Plops; its far wall rises above
 *           the plateau, so there's no steering over to climb 3 or the gate)
 *  150-179  CLIMB 3 up to the gate
 */
export function buildLevel4(): LevelData {
  LEDGES.length = 0;
  const W = 180;
  const H = 140;
  const L = new LevelBuilder('Plop Invasion · Part 2', 'World 2', W, H);
  L.pal = 'poo';
  L.vertical = true;
  let seed = 4;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  /**
   * A climb: ledges from height h0+3 up to h1, 3 tiles apart, in a zig-zag staircase — three steps
   * up and across one way (a 1–2 tile gap between them: an easy jump), then three back the other
   * way — drifting right by `drift` tiles over the climb. Nothing is ever right over the ledge
   * you're on (no bonking your head on the second jump). Every fifth ledge is a wide one (a
   * breather: nuggies, sometimes a bad guy or a poo goat). Returns the top ledge.
   */
  const climb = (x0: number, x1: number, h0: number, h1: number, drift: number, plops: number[] = [], goats: number[] = []) => {
    const list: { x0: number; x1: number; h: number }[] = [];
    LEDGES.push(list);
    let top = { x0: x0, x1: x0 + 3, h: h0 };
    let dir = 1;
    let run = 0;
    let lastCloud = false;
    for (let h = h0 + 3, i = 0; h <= h1; h += 3, i++) {
      const k = (h - h0) / Math.max(1, h1 - h0);
      const lo = Math.round(x0 + drift * k);
      const hi = Math.round(x1 + drift * k);
      const wide = i % 5 === 4;
      const w = wide ? 6 : 3 + Math.floor(r() * 2);
      const gap = 1 + Math.floor(r() * 2);
      // turn round after three steps, or at the side of the climb: the turn is a jump-through cloud
      // straight above the ledge you're on (up through it, then on the other way)
      // (never two turns in a row: a ladder of clouds is no fun to climb)
      if (!lastCloud && (run >= 3 || (dir > 0 && top.x1 + gap + w > hi) || (dir < 0 && top.x0 - gap - w < lo))) {
        dir = -dir as 1 | -1;
        run = 0;
        lastCloud = true;
        const ca = dir > 0 ? top.x0 + 1 : top.x0 - 1;
        const cw = top.x1 - top.x0 + 1;
        L.cloud(ca, cw, h);
        top = { x0: ca, x1: ca + cw - 1, h };
        list.push(top);
        if (r() < 0.4) L.aura(ca + cw / 2, h + 3);
        continue;
      }
      run++;
      lastCloud = false;
      const a = dir > 0 ? top.x1 + 1 + gap : top.x0 - gap - w;
      const b = a + w - 1;
      if (wide) L.island(a, b, h, 1, false);
      else L.rock(a, b, h, h);
      top = { x0: a, x1: b, h };
      list.push(top);
      if (wide) {
        L.auraArc(a + 1, 3, h + 3, 1);
        if (plops.includes(i)) L.spawn(i % 3 === 0 ? 'bigplop' : 'plop', a + Math.floor(w / 2), h);
        if (goats.includes(i)) L.spawn('poogoat', b - 1, h);
      } else if (r() < 0.25) L.aura((a + b) / 2, h + 3);
    }
    return top;
  };

  /** Where a plateau starts: clear of the last few ledges below it (a big hero's head would hit its underside). */
  const plateauX = (top: { x1: number }) => Math.max(top.x1, ...LEDGES[LEDGES.length - 1].slice(-4).map((l) => l.x1)) + 2;
  /** A plateau (solid, 3 deep) at height h from x0 on; if that leaves a long jump from the top ledge, a jump-through cloud lip reaches back over to it. */
  const plateau = (top: { x1: number; h: number }, x1: number, list: { x0: number; x1: number; h: number }[]) => {
    const x0 = plateauX(top);
    const h = top.h + 3;
    L.island(x0, x1, h, 3, false);
    if (x0 - top.x1 - 1 > 2) {
      L.cloud(top.x1 + 2, x0 - top.x1 - 2, h);
      list.push({ x0: top.x1 + 2, x1: x0 - 1, h });
    } else list.push({ x0, x1: x0 + 5, h }); // (the tests climb onto the plateau too)
    return { x0, h };
  };

  // ── The bottom of the first climb ───────────────────────────
  // (a floor under the whole climb: a slip sends you back down, not out of the level)
  L.ground(0, 41, 4);
  L.spawn('player', 4, 4);
  L.spawn('tree', 1.5, 4, { h: 58 });
  // the Plop King, waiting for you at the bottom: he laughs, then blasts off up the climb by jetpack
  L.spawn('king', 11, 4);
  L.spawn('plop', 18, 4);

  // ── CLIMB 1 ─────────────────────────────────────────────────
  const t1 = climb(2, 22, 4, 89, 8, [4, 14, 24], [9, 19]);
  // Plops parachuting in now and then on the way up
  for (const [x, h, k] of [[10, 26, 'plop'], [16, 44, 'plop'], [12, 62, 'bigplop'], [22, 80, 'plop']] as const) L.spawn('para', x, h, { kind: k });

  // ── The top: a plateau to the edge of the first drop ────────
  // (each plateau starts just beside the top ledge, a jump up from it: nothing under it to get stuck in)
  const p1 = plateau(t1, 41, LEDGES[0]);
  L.spawn('checkpoint', p1.x0 + 4, p1.h);
  L.spawn('poogoat', 36, p1.h);
  L.auraArc(p1.x0 + 6, 4, p1.h + 3, 1);
  L.rock(40, 41, 5, p1.h); // (a cliff from the floor up to the plateau's end: no walking round the climb)

  // ── DROP 1 (by parachute), the bottom, a short walk right, the ballpark (flat for now) ──
  // the drop: from the plateau's edge down to the floor, x 42..93 (a wall on the far side keeps you
  // out of climb 2 on the way down: you land at the bottom)
  L.spawn('drop', 42, p1.h, { w: 52, speed: 135, n: 11 });
  L.rock(94, 95, 16, p1.h + 6);
  L.ground(42, 133, 4); // (on under climb 2 too)
  L.auraArc(55, 3, 7, 1);
  // quicksand poo on the flat stretches at the bottom (never right under a climb: a missed jump
  // shouldn't land you in it)
  L.puddle(47, 50, 4);
  L.spawn('checkpoint', 60, 4);
  L.spawn('plop', 70, 4);
  L.puddle(74, 77, 4);
  L.spawn('bigplop', 80, 4);
  L.puddle(87, 90, 4);
  L.spawn('plop', 92, 4);

  // ── CLIMB 2 (longer) ────────────────────────────────────────
  const t2 = climb(97, 119, 4, 125, 8, [4, 9, 19, 29, 34], [14, 24, 39]);
  for (const [x, h, k] of [[106, 20, 'plop'], [114, 38, 'plop'], [108, 55, 'bigplop'], [118, 72, 'plop'], [110, 90, 'plop'], [120, 108, 'bigplop']] as const)
    L.spawn('para', x, h, { kind: k });
  const p2 = plateau(t2, 133, LEDGES[1]);
  L.spawn('checkpoint', p2.x0 + 3, p2.h);
  L.spawn('poogoat', 130, p2.h);
  L.rock(132, 133, 5, p2.h);

  // ── DROP 2 (longer, harder: a narrow shaft, more Plops), then CLIMB 3 to the gate ──
  // (the shaft's far wall reaches well above the plateau: no steering over to climb 3 or the gate)
  L.spawn('drop', 134, p2.h, { w: 14, speed: 150, n: 17, hard: 1 });
  L.rock(148, 149, 18, p2.h + 6);
  L.ground(134, W - 1, 10);
  L.puddle(137, 140, 10);
  L.spawn('checkpoint', 144, 10);
  const t3 = climb(152, 170, 10, 64, 2, [4, 9, 14], [9]);
  for (const [x, h, k] of [[158, 26, 'plop'], [166, 42, 'bigplop'], [160, 56, 'plop']] as const) L.spawn('para', x, h, { kind: k });
  const p3 = plateau(t3, W - 1, LEDGES[2]);
  L.spawn('goal', W - 4, p3.h);
  // the fly-over: from the gate, up over the top of climb 2 (the highest point), straight down it
  // to the ballpark, then on along the bottom past drop 1 to the foot of climb 1
  L.flyPath = [
    [W - 6, p3.h + 4],
    [p2.x0 + 2, p2.h + 2],
    [112, 60],
    [100, 12],
    [62, 10],
  ];
  // (for the tests: the ledges, in order)
  (globalThis as unknown as { __ledges?: unknown }).__ledges = LEDGES.slice(-3);
  return L.build();
}
