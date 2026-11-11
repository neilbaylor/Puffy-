import { LevelBuilder, type LevelData } from './builder';

/**
 * World 3 · "The Rise of King Bob" Part 1: under the sea (a test level for now).
 * You start on a pier over the water, say "Here goes nothing!" and swan-dive in; from then on you
 * swim: every jump is a stroke up, and you slowly sink back towards the sea bed. Bad guy fish
 * swim about and shoot bubbles at you from their tails (touching them hurts too); a rocket pops
 * them. The sea goes deep and shallow: over the deep parts a rocky reef shelf hangs under the
 * surface, so you can't swim up to the top there — only in the shallows and where the shelf has a gap.
 * Heights are tiles from the bottom (the level is 24 tall; the surface is 4 rows down, at h 20).
 *
 *   0-12    The pier (dive off its end), open water
 *   13-38   Deep, a reef shelf overhead: the first bad guy fish, a coral pillar
 *   39-45   A gap in the shelf (up to the light: nuggies near the surface)
 *   46-62   Deep again, a reef wall; checkpoint
 *   63-70   Up the slope to the shallows
 *   71-114  THE SHALLOWS: crab tennis, two courts in a row — they smash the clam at you
 *   115-140 Down into the deep: the cave (a rock roof, a way under it and a way over it)
 *   141-150 A gap in the shelf, a big bad guy fish
 *   151-172 Deep, fish
 *   173-190 Shallower water to the gate
 */
export function buildLevel5(): LevelData {
  const H = 24;
  const L = new LevelBuilder('The Rise of King Bob · Part 1', 'World 3', 191, H);
  L.pal = 'sea';
  L.water(20);
  /** A reef shelf from the surface down over x0..x1, its underside ragged (no way up to the top here). */
  const shelf = (x0: number, x1: number) => {
    const under = [17, 16, 17, 18, 17, 16, 16, 17, 18, 17];
    for (let x = x0, i = x0; x <= x1; x += 2, i++) L.rock(x, Math.min(x + 1, x1), under[i % under.length], 20);
  };

  // ── The pier, open water ─────────────────────────────────────
  L.ground(0, 12, 4);
  L.pier(0, 7, 21);
  L.spawn('player', 4, 21);
  L.spawn('tree', 10, 4, { h: 220 });
  L.auraArc(9, 3, 13, 1.5);

  // ── Deep, a shelf overhead: the first fish, a coral pillar ───
  L.ground(13, 45, 2);
  shelf(13, 38);
  L.rock(24, 26, 3, 7);
  L.aura(25, 10);
  L.spawn('fish', 18, 11);
  L.spawn('fish', 33, 13);
  L.spawn('tree', 15, 2, { h: 210 });
  L.spawn('tree', 30, 2, { h: 240 });
  L.auraArc(28, 3, 6, 1);

  // ── A gap in the shelf: up to the light ──────────────────────
  L.auraArc(40, 4, 17, 1);
  L.spawn('tree', 43, 2, { h: 200 });

  // ── Deep again, a reef wall; checkpoint ──────────────────────
  L.ground(46, 62, 3);
  shelf(46, 62);
  L.rock(50, 52, 4, 11);
  L.auraArc(49, 4, 13, 0.6);
  L.spawn('fish', 56, 9);
  L.spawn('checkpoint', 59, 3);
  L.spawn('tree', 55, 3, { h: 180 });

  // ── Up the slope to the shallows ─────────────────────────────
  L.ground(63, 66, 6);
  L.ground(67, 70, 9);
  L.spawn('tree', 64, 6, { h: 150 });
  L.auraArc(64, 4, 13, 1);

  // ── THE SHALLOWS: crab tennis, two courts in a row ───────────
  L.ground(71, 114, 12);
  L.spawn('tennis', 81, 12, { w: 18 });
  L.aura(81, 18);
  L.spawn('tennis', 103, 12, { w: 18 });
  L.auraArc(91, 3, 16, 1);
  L.rootbeer(103, 18.5);

  // ── Down into the deep: the cave ─────────────────────────────
  L.ground(115, 118, 8);
  L.ground(119, 140, 2);
  L.spawn('tree', 117, 8, { h: 140 });
  shelf(121, 140);
  L.rock(126, 138, 9, 11);
  L.auraArc(127, 8, 4, 1.2);
  L.spawn('fish', 132, 6);
  L.spawn('fish', 130, 14);
  L.aura(137, 14);

  // ── A gap in the shelf, a big one ────────────────────────────
  L.ground(141, 172, 3);
  L.spawn('bigfish', 146, 13);
  L.auraArc(142, 4, 17, 0.8);
  L.spawn('tree', 149, 3, { h: 230 });

  // ── Deep, fish ───────────────────────────────────────────────
  shelf(151, 172);
  L.rock(158, 159, 4, 7);
  L.spawn('fish', 155, 9);
  L.spawn('bigfish', 165, 12);
  L.spawn('fish', 170, 7);
  L.auraArc(161, 4, 10, 2);
  L.spawn('tree', 162, 3, { h: 200 });

  // ── Shallower water to the gate ──────────────────────────────
  L.ground(173, 190, 6);
  L.spawn('tree', 175, 6, { h: 170 });
  L.spawn('fish', 180, 14);
  L.auraArc(177, 3, 10, 1);
  L.spawn('goal', 185, 6);
  return L.build();
}
