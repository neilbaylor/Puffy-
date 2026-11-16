import { LevelBuilder, type LevelData } from './builder';

/**
 * World 3 · "The Rise of King Bob" Part 2: THE CHASE (testers only for now).
 *
 * You start on a pier over the water: "Now for a nice relaxing dive" — a swan dive in. Then a
 * rumble from behind… the camera swings back to King Bob's gang (Stone, Slinger, Kai and Zippy):
 * "Let's get him!" — and back to you, just ahead. From there it's a chase the whole way: they follow
 * your trail through the water, taking turns in the lead; if the lead fish gets you, you lose your
 * nuggies and get shoved ahead (with none, you faint). A few bad guy fish are about, and three times
 * the Fat Fish comes falling out of the sky (a warning goes up a few seconds before).
 *
 * The water's shallower than Part 5's (the surface and the sea bed both mostly in view: you can see
 * the Fat Fish coming), and the way through flows — rocks to swim over and under, never a dead end.
 * Heights are tiles from the bottom: the sea bed around 3, the surface at 17.
 *
 *   0-25    Open water behind you (where the gang comes from)
 *   26-33   The pier you dive off
 *   34-74   The kelp meadow: a gentle start, low rocks, a floating slab (Fat Fish #1)
 *   75-116  The slabs: rock slabs floating in the water, over or under them; bad guy fish (checkpoint)
 *   117-162 The reef narrows: a shelf hangs under the surface, low rocks below (checkpoint, Fat Fish #2)
 *   163-208 The open blue: wide water, the last bad guys (checkpoint, Fat Fish #3)
 *   209-249 The sprint home: up the slope to the gate
 */
export function buildLevel6(): LevelData {
  const W = 250;
  const H = 22;
  const SURF = 17;
  const L = new LevelBuilder('The Rise of King Bob · Part 2', 'World 3', W, H);
  L.pal = 'sea';
  L.water(SURF);
  // the fly-over: from the gate, back along the level just under the surface, to the pier
  L.flyPath = [
    [244, 11],
    [130, 11],
    [30, 12],
  ];
  /** A shelf of reef hanging from the surface over x0..x1, its ragged underside at about height h. */
  const shelf = (x0: number, x1: number, h: number) => {
    const under = [0, -1, 0, 1, 0, -1, -1, 0, 1, 0];
    for (let x = x0, i = 0; x <= x1; x += 2, i++) L.rock(x, Math.min(x + 1, x1), h + under[i % under.length], SURF);
  };
  /** A slab of rock floating in the water (swim over it or under it), x0..x1 at heights h0..h1. */
  const slab = (x0: number, x1: number, h0: number, h1: number) => L.rock(x0, x1, h0, h1);

  // ── Open water behind; the pier ──────────────────────────────
  L.ground(0, 25, 2);
  L.spawn('tree', 6, 2, { h: 200 });
  L.spawn('tree', 13, 2, { h: 160 });
  L.spawn('tree', 20, 2, { h: 230 });
  L.pack(17, 10);
  L.ground(26, 33, 3);
  L.pier(26, 32, SURF + 1);
  L.spawn('player', 29, SURF + 1);
  L.auraArc(34, 4, 12, 1.5, true);

  // ── The kelp meadow: a gentle start, low rocks ───────────────
  L.ground(34, 74, 3);
  L.spawn('tree', 37, 3, { h: 230 });
  L.spawn('tree', 44, 3, { h: 190 });
  L.rock(47, 49, 4, 5);
  L.auraArc(46.8, 3, 8, 1, true);
  L.spawn('tree', 53, 3, { h: 250 });
  slab(57, 61, 9, 10);
  L.auraArc(57.6, 4, 7, 0.3, true);
  L.rootbeer(59, 12.5);
  L.spawn('tree', 65, 3, { h: 200 });
  L.auraArc(64, 3, 12, 1.2);
  L.spawn('fish', 70, 9);
  L.fatDrop(58);
  L.aura(72, 6, true);

  // ── The slabs: rocks floating in the water, over or under ────
  L.ground(75, 116, 3);
  slab(79, 84, 8, 9);
  L.auraArc(79.6, 4, 6, 0.4, true);
  L.aura(81.5, 11.5, true);
  L.spawn('checkpoint', 88, 3);
  L.spawn('tree', 91, 3, { h: 220 });
  slab(95, 102, 11, 12);
  L.rock(97, 99, 4, 5);
  L.auraArc(95.6, 5, 8, 0.6);
  L.aura(98.5, 14.5, true);
  L.spawn('fish', 99, 15);
  L.spawn('bigfish', 110, 8);
  L.rock(108, 109, 4, 5);
  L.rootbeer(113, 13);
  L.aura(114, 7);

  // ── The reef narrows: a shelf under the surface, low rocks below ─
  L.ground(117, 162, 3);
  shelf(118, 141, 13);
  L.rock(122, 124, 4, 5);
  L.rock(130, 131, 4, 6);
  L.rock(136, 138, 4, 5);
  L.auraArc(124.8, 4, 9.5, 0.6, true);
  L.aura(133, 9, true);
  L.spawn('fish', 128, 10);
  L.spawn('fish', 140, 8);
  L.spawn('tree', 127, 3, { h: 160 });
  L.spawn('tree', 134, 3, { h: 140 });
  // out from under it: open water up to the light again
  L.spawn('checkpoint', 145, 3);
  L.auraArc(148, 4, 12, 1.5, true);
  L.fatDrop(150);
  L.spawn('tree', 154, 3, { h: 240 });
  slab(157, 160, 8, 8);
  L.rootbeer(158.5, 11);

  // ── The open blue ────────────────────────────────────────────
  L.ground(163, 208, 2);
  L.spawn('bigfish', 170, 11);
  L.auraArc(172, 3, 8, 1, true);
  L.spawn('tree', 176, 2, { h: 260 });
  L.rock(179, 182, 3, 4);
  L.spawn('checkpoint', 185, 2);
  L.auraArc(188, 4, 11, 1.4, true);
  L.fatDrop(190);
  L.spawn('fish', 198, 13);
  L.spawn('tree', 201, 2, { h: 210 });
  slab(203, 206, 10, 10);
  L.aura(204.5, 7, true);

  // ── The sprint home: up the slope to the gate ────────────────
  L.ground(209, 214, 4);
  L.ground(215, 221, 6);
  L.ground(222, 249, 8);
  L.auraArc(211, 3, 9, 1, true);
  L.rootbeer(218, 12);
  L.spawn('tree', 225, 8, { h: 180 });
  L.spawn('fish', 232, 13);
  L.aura(236, 12, true);
  L.spawn('goal', 244, 8);
  return L.build();
}
