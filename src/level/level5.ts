import { LevelBuilder, type LevelData } from './builder';

/**
 * World 3 · "The Rise of King Bob" Part 1: under the sea (a small test level for now).
 * You start on a pier over the water, say "Here goes nothing!" and dive in; from then on you
 * swim: every jump is a stroke up, and you slowly sink back towards the sea bed. Bad guy fish
 * swim about and shoot bubbles at you from their tails (touching them hurts too); a rocket pops
 * them. The water drifts between its looks like the other levels' skies.
 * Heights are tiles from the bottom (the level is 19 tall; the surface is 4 rows down).
 *
 *   0-7     The pier (you dive off its end)
 *   8-35    Kelp and coral, the first bad guy fish, a coral pillar
 *   36-56   A reef wall to swim over, a rock ledge out in the water
 *   57-72   Checkpoint; a big bad guy fish
 *   73-92   The cave: a rock roof with a way under it and a way over it
 *   93-140  CRAB TENNIS: two courts in a row; spot them and they smash the clam at you
 *   141-180 Open water, more fish, the gate on the sea bed
 */
export function buildLevel5(): LevelData {
  const H = 19;
  const L = new LevelBuilder('The Rise of King Bob · Part 1', 'World 3', 181, H);
  L.pal = 'sea';
  L.water(15);

  // ── The pier ─────────────────────────────────────────────────
  L.ground(0, 20, 2);
  L.pier(0, 7, 16);
  L.spawn('player', 4, 16);
  L.spawn('tree', 11, 2, { h: 210 });
  L.spawn('tree', 15, 2, { h: 160 });
  L.auraArc(10, 3, 12, 1.5);

  // ── Kelp and coral, the first fish ───────────────────────────
  L.ground(21, 35, 3);
  L.rock(25, 27, 4, 8); // a coral pillar
  L.aura(26, 11);
  L.spawn('fish', 19, 9);
  L.spawn('fish', 31, 12);
  L.spawn('tree', 22, 3, { h: 180 });
  L.spawn('tree', 33, 3, { h: 230 });
  L.auraArc(29, 3, 6, 1);

  // ── A reef wall to swim over, a ledge out in the water ───────
  L.ground(36, 56, 2);
  L.rock(38, 40, 3, 10);
  L.auraArc(37, 3, 13, 0.8);
  L.rock(46, 51, 9, 9);
  L.rootbeer(48.5, 11);
  L.spawn('fish', 44, 6);
  L.spawn('fish', 53, 12);
  L.spawn('tree', 43, 2, { h: 200 });
  L.spawn('tree', 55, 2, { h: 170 });
  L.auraArc(45, 4, 5, 0.6);

  // ── Checkpoint, a big one ────────────────────────────────────
  L.ground(57, 72, 3);
  L.spawn('checkpoint', 59, 3);
  L.spawn('bigfish', 67, 9);
  L.spawn('tree', 63, 3, { h: 190 });
  L.auraArc(64, 3, 13, 1);

  // ── The cave: a rock roof, a way under and a way over ────────
  L.ground(73, 92, 2);
  L.rock(76, 90, 8, 10);
  L.auraArc(78, 8, 4, 1.2);
  L.spawn('fish', 84, 5);
  L.spawn('fish', 82, 13);
  L.aura(88, 13);

  // ── Crab tennis: two courts in a row (they smash the clam at you) ──
  L.ground(93, 160, 3);
  L.spawn('tree', 95, 3, { h: 200 });
  L.spawn('fish', 99, 12);
  L.spawn('tennis', 107, 3, { w: 18 });
  L.auraArc(103, 3, 10, 1);
  L.spawn('tennis', 129, 3, { w: 18 });
  L.auraArc(117, 3, 9, 2);
  L.aura(129, 13);
  L.spawn('tree', 141, 3, { h: 180 });

  // ── Open water to the gate ───────────────────────────────────
  L.rock(146, 147, 4, 6);
  L.spawn('tree', 144, 3, { h: 220 });
  L.spawn('bigfish', 152, 12);
  L.spawn('fish', 158, 7);
  L.auraArc(150, 4, 9, 2);
  L.ground(161, 180, 3);
  L.spawn('tree', 163, 3, { h: 200 });
  L.spawn('fish', 168, 11);
  L.spawn('tree', 171, 3, { h: 170 });
  L.auraArc(165, 3, 6, 1);
  L.spawn('goal', 176, 3);
  return L.build();
}
