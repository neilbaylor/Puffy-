import { LevelBuilder, type LevelData } from './builder';
import { TILE } from '../config';

/**
 * World 3 · "The Rise of King Bob" Part 1: under the sea (a test level for now).
 * You start on a pier over the water, say "Here goes nothing!" and swan-dive in; from then on you
 * swim: every jump is a stroke up, and you slowly sink back towards the sea bed. Bad guy fish
 * (as many little ones as medium ones) swim about and shoot bubbles from their tails; touching them
 * hurts too; a rocket pops them. Over the deep parts a rocky reef shelf hangs under the surface, so
 * you can't swim up to the top there — only in the shallows and where the shelf has a gap.
 *
 * Two descents: at each a wall from the surface right down blocks the way, so down you sink (it gets
 * darker), under the wall at the bottom, and back up the other side. The first is shorter; the second
 * is the long one (about 15 seconds of sinking). Kai fish turns up three times, spread through the
 * level (rare, quick, fierce: three hits, then he zooms off).
 *
 * Heights are tiles from the bottom: the level is 86 tall; the main sea bed is B (62) up, the
 * surface at B + 20. (`b(h)`: a height on the main sea bed.)
 *
 *   0-12    The pier (dive off its end), open water
 *   13-38   Deep, a reef shelf overhead: the first fish, a coral pillar
 *   39-45   A gap in the shelf (up to the light)
 *   46-84   DESCENT 1 (shorter): down the left side, under the wall, up the right (Kai)
 *   85-101  A reef wall; checkpoint
 *   102-131 THE BLOCK FIELD: rocks to swim in and out of, fish among them
 *   132-178 DESCENT 2 (the long one): down, under the wall at the very bottom (checkpoint), back
 *           up (ledges, fish, Kai on the way down)
 *   179-196 Out at the top (checkpoint), Kai once more, nuggies, up the slope
 *   197-240 THE SHALLOWS: crab tennis, two courts in a row
 *   241-257 Down a step to the gate
 */
export function buildLevel5(): LevelData {
  const B = 62;
  const H = B + 24;
  const b = (h: number) => h + B;
  const L = new LevelBuilder('The Rise of King Bob · Part 1', 'World 3', 258, H);
  L.pal = 'sea';
  L.water(b(20));
  // (the backgrounds sit as if the level ended just under the main sea bed; down the trenches it gets darker)
  L.bgBottom(b(-1));
  L.darkness(b(2), 16);
  /** A reef shelf from the surface down over x0..x1, its underside ragged (no way up to the top here). */
  const shelf = (x0: number, x1: number) => {
    const under = [17, 16, 17, 18, 17, 16, 16, 17, 18, 17];
    for (let x = x0, i = x0; x <= x1; x += 2, i++) L.rock(x, Math.min(x + 1, x1), b(under[i % under.length]), b(20));
  };
  /**
   * A descent: a shaft down the left (x0..x0+w-1), a wall from the surface down to just over the
   * bottom (3 wide), a shaft back up on the right; the bottom at height `floor`; shelves over both.
   * Returns the wall's first column and the right shaft's first column.
   */
  const descent = (x0: number, w: number, floor: number) => {
    const wall = x0 + w;
    const right = wall + 3;
    const x1 = right + w - 1;
    L.pit(x0, x1);
    L.ground(x0, x1, floor);
    L.rock(wall, wall + 2, floor + 5, b(20));
    shelf(x0, wall - 1);
    shelf(right, x1);
    L.descents.push({ x0: x0 * TILE, wall: wall * TILE, x1: (x1 + 1) * TILE });
    return { wall, right, x1 };
  };

  // the fly-over (from the gate back to the pier): one smooth glide along the level at a single depth in
  // open water (the surface just in view above, the sea bed below), then up to the hero on the pier
  L.flyPath = [
    [252, b(11.5)],
    [137, b(11.5)],
    [22, b(11.5)],
  ];

  // ── The pier, open water ─────────────────────────────────────
  L.ground(0, 12, b(4));
  L.pier(0, 7, b(21));
  L.spawn('player', 4, b(21));
  L.spawn('tree', 10, b(4), { h: 220 });
  L.auraArc(9, 3, b(13), 1.5);
  L.rootbeer(11.5, b(7));

  // ── Deep, a shelf overhead: the first fish, a coral pillar ───
  L.ground(13, 45, b(2));
  shelf(13, 38);
  L.rock(24, 26, b(3), b(7));
  L.aura(25, b(10));
  L.spawn('fish', 18, b(11));
  L.spawn('bigfish', 33, b(12));
  L.spawn('tree', 15, b(2), { h: 210 });
  L.spawn('tree', 30, b(2), { h: 240 });
  L.aura(29, b(6));
  L.rootbeer(34, b(7.5));

  // ── A gap in the shelf: up to the light ──────────────────────
  L.auraArc(40.5, 3, b(17), 1);
  L.rootbeer(42.5, b(18.5));
  L.spawn('tree', 43, b(2), { h: 200 });

  // ── DESCENT 1 (shorter): 30 tiles down ───────────────────────
  descent(46, 18, 34);
  // going down
  L.spawn('fish', 50, 58);
  L.spawn('bigfish', 59, 47);
  L.spawn('fish', 54, 40);
  L.aura(52, 52);
  L.aura(57, 42);
  L.rootbeer(60, 36.5);
  // the bottom, under the wall: a checkpoint on the far side
  L.spawn('checkpoint', 69, 34);
  // back up: ledges, fish, Kai
  L.rock(79, 84, 44, 44);
  L.rock(67, 72, 54, 54);
  L.spawn('bigfish', 78, 57);
  L.spawn('fish', 73, 46);
  L.spawn('bigfish', 70, 39);
  L.spawn('kai', 76, 51);
  // (wherever Kai is, nuggies are too: always there, not left to chance)
  L.auraArc(74.6, 3, 48, 0.8, true);
  L.aura(75, 42);

  // ── A reef wall; checkpoint ──────────────────────────────────
  L.ground(85, 101, b(3));
  shelf(85, 101);
  L.rock(89, 91, b(4), b(11));
  L.auraArc(88, 3, b(13), 0.6);
  L.rootbeer(94.5, b(14.5));
  L.spawn('fish', 95, b(9));
  L.spawn('checkpoint', 98, b(3));
  L.spawn('tree', 94, b(3), { h: 180 });

  // ── THE BLOCK FIELD: rocks to swim in and out of ─────────────
  L.ground(102, 131, b(3));
  shelf(102, 131);
  for (const [x0, x1, h0, h1] of [
    [104, 105, 4, 6],
    [104, 105, 11, 13],
    [108, 110, 8, 9],
    [112, 113, 4, 6],
    [112, 113, 12, 14],
    [116, 118, 9, 10],
    [120, 121, 4, 7],
    [120, 121, 13, 14],
    [124, 126, 7, 8],
    [128, 129, 11, 13],
    [128, 129, 4, 5],
  ] as const)
    L.rock(x0, x1, b(h0), b(h1));
  L.spawn('fish', 110, b(12));
  L.spawn('bigfish', 115, b(5));
  L.spawn('fish', 123, b(10));
  L.spawn('bigfish', 126, b(11));
  L.aura(102.5, b(9));
  L.aura(114, b(10));
  L.rootbeer(118.5, b(12.5));
  L.aura(122.5, b(10.5));

  // ── DESCENT 2 (the long one): right down to the very bottom ──
  // (each side 22 tiles across: room to dodge, the walls just in view either side)
  descent(132, 22, 2);
  // going down (it gets darker): fish, nuggies, Kai
  L.spawn('bigfish', 139, 40);
  L.spawn('fish', 147, 22);
  L.spawn('fish', 143, 55);
  L.spawn('bigfish', 150, 30);
  L.spawn('kai', 141, 47);
  L.auraArc(139.6, 3, 49.5, 0.8, true);
  L.aura(143, 52);
  L.aura(138, 30);
  L.aura(149, 10);
  L.rootbeer(145, 4.5);
  // the bottom: under the wall; a checkpoint on the far side
  L.spawn('checkpoint', 160, 2);
  // back up the right side: ledges to rest on, fish on the way
  L.rock(173, 178, 14, 14);
  L.rock(157, 162, 26, 26);
  L.rock(173, 178, 38, 38);
  L.rock(157, 162, 50, 50);
  L.spawn('fish', 163, 20);
  L.spawn('bigfish', 170, 33);
  L.spawn('bigfish', 161, 46);
  L.spawn('fish', 168, 56);
  L.spawn('fish', 165, 9);
  L.spawn('bigfish', 176, 22);
  L.aura(167, 30);
  L.rootbeer(171, 47);
  L.aura(166, 56);

  // ── Out at the top: Kai once more, nuggies, up the slope ─────
  L.ground(179, 188, b(3));
  L.spawn('checkpoint', 181, b(3));
  shelf(183, 188);
  L.spawn('tree', 185, b(3), { h: 200 });
  L.spawn('kai', 187, b(9));
  L.auraArc(184.6, 2, b(7.5), 0.4, true);
  // (nuggies between Kai and the tennis: get some back before the crabs)
  L.auraArc(189, 3, b(10.5), 1, true);
  L.auraArc(194, 3, b(14), 0.8);
  L.ground(189, 192, b(6));
  L.ground(193, 196, b(9));
  L.spawn('bigfish', 186, b(13));
  L.spawn('tree', 191, b(6), { h: 150 });

  // ── THE SHALLOWS: crab tennis, two courts in a row ───────────
  L.ground(197, 240, b(12));
  L.spawn('tennis', 207, b(12), { w: 18 });
  L.aura(207, b(18));
  L.spawn('tennis', 229, b(12), { w: 18 });
  L.aura(218, b(16));
  L.rootbeer(238, b(15.5));
  L.rootbeer(229, b(18.5));

  // ── Down a step to the gate ──────────────────────────────────
  L.ground(241, 244, b(8));
  L.ground(245, 257, b(5));
  L.spawn('tree', 243, b(8), { h: 160 });
  L.spawn('fish', 248, b(13));
  L.spawn('bigfish', 252, b(11));
  L.rootbeer(250.5, b(9));
  L.spawn('goal', 254, b(5));
  return L.build();
}
