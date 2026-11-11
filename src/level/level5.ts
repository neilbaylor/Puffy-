import { LevelBuilder, type LevelData } from './builder';

/**
 * World 3 · "The Rise of King Bob" Part 1: under the sea (a test level for now).
 * You start on a pier over the water, say "Here goes nothing!" and swan-dive in; from then on you
 * swim: every jump is a stroke up, and you slowly sink back towards the sea bed. Bad guy fish
 * (as many little ones as medium ones) swim about and shoot bubbles from their tails; touching them
 * hurts too; a rocket pops them. Over the deep parts a rocky reef shelf hangs under the surface, so
 * you can't swim up to the top there — only in the shallows and where the shelf has a gap.
 *
 * Under the main sea bed there's a deep trench: a wall blocks the way on, so down you go — a long
 * sink (about 20 seconds), darker and darker, a pool of light round you — under the wall at the
 * bottom, and back up the other side.
 *
 * Heights are tiles from the bottom: the level is 86 tall; the main sea bed is B (62) up, the
 * surface at B + 20. (`b(h)`: a height on the main sea bed, as the earlier layout had it.)
 *
 *   0-12    The pier (dive off its end), open water
 *   13-38   Deep, a reef shelf overhead: the first fish, a coral pillar
 *   39-45   A gap in the shelf (up to the light)
 *   46-62   A reef wall; checkpoint
 *   63-92   THE BLOCK FIELD: rocks to swim in and out of, fish among them
 *   93-111  THE TRENCH: a wall from the surface right down; sink down the left side in the dark,
 *           under the wall at the very bottom (checkpoint), climb back up the right (ledges, fish)
 *   112-129 Out at the top (checkpoint), a short way, up the slope
 *   130-173 THE SHALLOWS: crab tennis, two courts in a row
 *   174-190 Down a step to the gate
 */
export function buildLevel5(): LevelData {
  const B = 62;
  const H = B + 24;
  const b = (h: number) => h + B;
  const L = new LevelBuilder('The Rise of King Bob · Part 1', 'World 3', 191, H);
  L.pal = 'sea';
  L.water(b(20));
  // (the backgrounds sit as if the level ended just under the main sea bed; down the trench it gets dark)
  L.bgBottom(b(-1));
  L.darkness(b(2), 16);
  /** A reef shelf from the surface down over x0..x1, its underside ragged (no way up to the top here). */
  const shelf = (x0: number, x1: number) => {
    const under = [17, 16, 17, 18, 17, 16, 16, 17, 18, 17];
    for (let x = x0, i = x0; x <= x1; x += 2, i++) L.rock(x, Math.min(x + 1, x1), b(under[i % under.length]), b(20));
  };

  // ── The pier, open water ─────────────────────────────────────
  L.ground(0, 12, b(4));
  L.pier(0, 7, b(21));
  L.spawn('player', 4, b(21));
  L.spawn('tree', 10, b(4), { h: 220 });
  L.auraArc(9, 3, b(13), 1.5);

  // ── Deep, a shelf overhead: the first fish, a coral pillar ───
  L.ground(13, 45, b(2));
  shelf(13, 38);
  L.rock(24, 26, b(3), b(7));
  L.aura(25, b(10));
  L.spawn('fish', 18, b(11));
  L.spawn('bigfish', 33, b(12));
  L.spawn('tree', 15, b(2), { h: 210 });
  L.spawn('tree', 30, b(2), { h: 240 });
  L.auraArc(28, 3, b(6), 1);

  // ── A gap in the shelf: up to the light ──────────────────────
  L.auraArc(40, 4, b(17), 1);
  L.spawn('tree', 43, b(2), { h: 200 });

  // ── A reef wall; checkpoint ──────────────────────────────────
  L.ground(46, 62, b(3));
  shelf(46, 62);
  L.rock(50, 52, b(4), b(11));
  L.auraArc(49, 4, b(13), 0.6);
  L.spawn('fish', 56, b(9));
  L.spawn('checkpoint', 59, b(3));
  L.spawn('tree', 55, b(3), { h: 180 });

  // ── THE BLOCK FIELD: rocks to swim in and out of ─────────────
  L.ground(63, 92, b(3));
  shelf(63, 92);
  for (const [x0, x1, h0, h1] of [
    [65, 66, 4, 6],
    [65, 66, 11, 13],
    [69, 71, 8, 9],
    [73, 74, 4, 6],
    [73, 74, 12, 14],
    [77, 79, 9, 10],
    [81, 82, 4, 7],
    [81, 82, 13, 14],
    [85, 87, 7, 8],
    [89, 90, 11, 13],
    [89, 90, 4, 5],
  ] as const)
    L.rock(x0, x1, b(h0), b(h1));
  L.spawn('fish', 71, b(12));
  L.spawn('bigfish', 76, b(5));
  L.spawn('fish', 84, b(10));
  L.spawn('bigfish', 87, b(11));
  L.auraArc(67, 3, b(9), 0.5);
  L.aura(75, b(10));
  L.auraArc(83, 3, b(10), 0.6);

  // ── THE TRENCH: down the left, under the wall, up the right ──
  L.pit(93, 111);
  L.ground(93, 111, 2);
  // the wall, from the surface down to a gap over the trench floor
  L.rock(101, 103, 7, b(20));
  shelf(93, 100);
  shelf(104, 111);
  // going down (it gets dark): a couple of fish, nuggies
  L.spawn('bigfish', 96, 40);
  L.spawn('fish', 98, 22);
  L.aura(97, 52);
  L.aura(96, 30);
  L.aura(98, 10);
  // the bottom: under the wall; a checkpoint on the far side
  L.spawn('checkpoint', 106, 2);
  // back up the right side: ledges to rest on, fish on the way
  L.rock(110, 111, 14, 14);
  L.rock(104, 105, 26, 26);
  L.rock(110, 111, 38, 38);
  L.rock(104, 105, 50, 50);
  L.spawn('fish', 107, 20);
  L.spawn('bigfish', 108, 33);
  L.spawn('bigfish', 106, 46);
  L.aura(107, 30);
  L.aura(108, 44);
  L.aura(107, 56);

  // ── Out at the top, a short way, up the slope ────────────────
  L.ground(112, 121, b(3));
  L.spawn('checkpoint', 114, b(3));
  shelf(116, 121);
  L.spawn('tree', 118, b(3), { h: 200 });
  L.auraArc(115, 3, b(8), 1);
  L.ground(122, 125, b(6));
  L.ground(126, 129, b(9));
  L.spawn('tree', 124, b(6), { h: 150 });

  // ── THE SHALLOWS: crab tennis, two courts in a row ───────────
  L.ground(130, 173, b(12));
  L.spawn('tennis', 140, b(12), { w: 18 });
  L.aura(140, b(18));
  L.spawn('tennis', 162, b(12), { w: 18 });
  L.auraArc(150, 3, b(16), 1);
  L.rootbeer(162, b(18.5));

  // ── Down a step to the gate ──────────────────────────────────
  L.ground(174, 177, b(8));
  L.ground(178, 190, b(5));
  L.spawn('tree', 176, b(8), { h: 160 });
  L.spawn('fish', 181, b(13));
  L.spawn('bigfish', 185, b(11));
  L.spawn('goal', 187, b(5));
  return L.build();
}
