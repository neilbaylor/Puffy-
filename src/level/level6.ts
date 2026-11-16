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
 *   0-7     The (modern) pier you dive off, at the very start; the gang come in from off the left
 *   8-33    Open water ahead
 *   34-74   The kelp meadow: a gentle start, low rocks, a floating slab (Fat Fish #1)
 *   75-116  The slabs: rock slabs floating in the water, over or under them; bad guy fish (checkpoint)
 *   117-162 The reef narrows: a shelf hangs under the surface, low rocks below (checkpoint)
 *   163-208 The open blue: wide water, bad guys (checkpoint, Fat Fish #2)
 *   209-262 The kelp weave: rock slabs high and low by turns — up, down, up (checkpoint)
 *   263-290 The narrows: a tunnel under the reef, the gang squeezing in after you
 *   291-320 The deep blue: out into open water again (checkpoint, Fat Fish #3)
 *   321-359 The sprint home: up the slope to the gate
 */
export function buildLevel6(): LevelData {
  const W = 360;
  const H = 22;
  const SURF = 17;
  const L = new LevelBuilder('The Rise of King Bob · Part 2', 'World 3', W, H);
  L.pal = 'sea';
  L.water(SURF);
  // the fly-over: from the gate, back along the level under the surface (down past the reef, up
  // over the slabs), coming in on the pier from out over the meadow — a bit slower than Part 5's,
  // there's more to see. (Its last point well clear of the pier: right beside the hero, the
  // flight's curve swung on past him and back.)
  L.flyPath = [
    [354, 11],
    [305, 10],
    [276, 8.5],
    [235, 9],
    [170, 10],
    [110, 9.5],
    [52, 13],
  ];
  L.flyMs = 10000;
  /** A shelf of reef hanging from the surface over x0..x1, its ragged underside at about height h. */
  const shelf = (x0: number, x1: number, h: number) => {
    const under = [0, -1, 0, 1, 0, -1, -1, 0, 1, 0];
    for (let x = x0, i = 0; x <= x1; x += 2, i++) L.rock(x, Math.min(x + 1, x1), h + under[i % under.length], SURF);
  };
  /** A slab of rock floating in the water (swim over it or under it), x0..x1 at heights h0..h1. */
  const slab = (x0: number, x1: number, h0: number, h1: number) => L.rock(x0, x1, h0, h1);

  // ── The pier (a modern one), at the very start like Part 5's: nothing behind it but the edge ──
  // (the gang come in from off the left, under the pier, just behind you)
  L.pierStyle = 'modern';
  L.ground(0, 33, 3);
  L.pier(0, 7, SURF + 1);
  L.spawn('player', 4, SURF + 1);
  // (a Ferris wheel on the pier behind you, seaside style)
  L.spawn('ferris', 3.2, SURF + 1);
  L.pack(5, 10);
  L.spawn('tree', 14, 3, { h: 210 });
  L.spawn('tree', 23, 3, { h: 170 });
  L.auraArc(13, 4, 12, 1.5, true);
  L.auraArc(26, 4, 9, 1.2, true);
  L.spawn('tree', 31, 3, { h: 240 });

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

  // ── The kelp weave: slabs high and low by turns ──────────────
  L.ground(209, 262, 3);
  L.spawn('checkpoint', 210, 3);
  slab(214, 218, 10, 13);
  L.auraArc(214.6, 4, 7, 0.5, true);
  L.spawn('tree', 220, 3, { h: 230 });
  slab(223, 227, 4, 7);
  L.auraArc(223.6, 4, 11, 0.5, true);
  slab(232, 236, 10, 13);
  L.auraArc(232.6, 4, 7, 0.5);
  L.spawn('fish', 238, 9);
  slab(241, 245, 4, 7);
  L.auraArc(241.6, 4, 11, 0.5, true);
  L.rootbeer(243, 14);
  slab(250, 254, 10, 13);
  L.spawn('tree', 257, 3, { h: 200 });
  L.aura(259, 9, true);

  // ── The narrows: a tunnel under the reef ─────────────────────
  L.ground(263, 290, 5);
  shelf(264, 289, 12);
  L.auraArc(266, 6, 8.5, 0.6, true);
  L.rock(272, 273, 6, 6);
  L.spawn('fish', 278, 9);
  L.auraArc(280, 5, 8.5, 0.6, true);
  L.rock(285, 286, 11, 11);
  L.aura(288, 8, true);

  // ── The deep blue: open water again ──────────────────────────
  L.ground(291, 320, 2);
  L.spawn('checkpoint', 294, 2);
  L.auraArc(297, 4, 10, 1.4, true);
  L.fatDrop(300);
  L.spawn('bigfish', 306, 10);
  L.spawn('tree', 309, 2, { h: 250 });
  L.rock(312, 314, 3, 4);
  L.auraArc(315, 3, 12, 1, true);
  L.spawn('fish', 318, 7);

  // ── The sprint home: up the slope to the gate ────────────────
  L.ground(321, 326, 4);
  L.ground(327, 333, 6);
  L.ground(334, 359, 8);
  L.auraArc(323, 3, 9, 1, true);
  L.rootbeer(330, 12);
  L.spawn('tree', 337, 8, { h: 180 });
  L.spawn('fish', 344, 13);
  L.aura(348, 12, true);
  L.spawn('goal', 354, 8);
  return L.build();
}
