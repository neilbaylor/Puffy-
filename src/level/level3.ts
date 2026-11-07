import { LevelBuilder, type LevelData } from './builder';

/**
 * World 2 · "Plop Invasion" Part 1: Puff Ball Planet, taken over by the Plops
 * and covered in poo. It runs very slightly downhill (with the odd little rise),
 * except the two boulder runs, which are STEEP: a giant rock comes rolling down
 * after you, so keep running, dodge the Plops, and jump the chasm at the
 * bottom — the rock tumbles in (on the second run it sinks in a poo puddle).
 * Puddles of poo are like quicksand: you sink slowly, so keep hopping to get
 * across. Mid-level the Plops are playing beach volleyball, and they spike the
 * ball at you. Two jumping sections: pillars standing in poo (miss and you can
 * still hop back out), and later pillars over bottomless pits.
 * Heights are tiles from the bottom (the level is 52 tall).
 *
 *   0-28    Poo-covered meadow (a little rise), first Plops
 *   29-33   Poo puddle #1 (small: learn to hop out)
 *   34-46   GIANT PLOP on the meadow, a poo goat
 *   47-58   A Big Plop, a floating island with root beer (off the ledge)
 *   59-80   GIANT PLOP #1 · checkpoint 1
 *   81-130  BOULDER RUN #1 (easier): a long steep slope, three Plops, an 8-wide chasm
 *   131-151 Poo puddle #2 (wide)
 *   152-177 POO PITS: 3-wide pillars standing in poo, 4-tile gaps (semi-difficult)
 *   178-195 BEACH VOLLEYBALL: they spike the ball at you
 *   196-216 A rise with a poo goat, GIANT PLOP #2 · checkpoint 2
 *   217-263 BOULDER RUN #2 (harder: faster rock, a Big Plop, a Plop parachuting in, the rock sinks in a poo puddle)
 *   264-284 Poo puddle #3, checkpoint 3
 *   285-313 THE PITS: pillars and an island over bottomless pits, 4–5 tile gaps (difficult)
 *   314-327 GIANT PLOP #3 · checkpoint 4
 *   328-358 A last rise with a poo goat, the last Plops, a GIANT PLOP guarding the gate
 */
export function buildLevel3(): LevelData {
  const L = new LevelBuilder('Plop Invasion · Part 1', 'World 2', 360, 52);
  L.pal = 'poo';

  // ── Poo-covered meadow ───────────────────────────────────────
  L.ground(0, 19, 40);
  L.spawn('player', 4, 40);
  L.spawn('tree', 1.5, 40, { h: 62 });
  L.spawn('tree', 10, 40, { h: 54 });
  L.auraArc(12, 2, 43, 0);
  L.spawn('plop', 17, 40);
  L.ground(20, 24, 41); // a little rise
  L.spawn('plop', 22, 41);
  L.ground(25, 28, 40);
  L.spawn('tree', 27, 40, { h: 58 });

  // ── Poo puddle #1: small (a run-jump clears it; walk in and you'll have to hop out) ──
  L.puddle(29, 33, 40);
  L.aura(31, 43);
  // (the far side as high as the poo, so you have to get out of it)
  L.ground(34, 46, 40);
  L.spawn('giantplop', 40, 40);
  L.spawn('poogoat', 45, 40);

  // ── A Big Plop, and a floating island off the ledge ──────────
  L.ground(47, 52, 41);
  L.spawn('bigplop', 50, 41);
  // the island hangs over the lower ground, 3 tiles above the ledge: a running jump off the
  // ledge lands on it with any hero (Big Muscles too), and there's room to walk under it
  L.island(53, 58, 44, 1, false);
  L.rootbeer(55.5, 47);
  L.aura(55.5, 46);
  L.ground(53, 58, 39);
  L.spawn('plop', 56, 39);
  L.spawn('tree', 47.5, 41, { h: 56 });

  // ── GIANT PLOP #1 · checkpoint 1 ────────────────────────────
  L.ground(59, 80, 38);
  L.spawn('tree', 60, 38, { h: 66 });
  L.spawn('plop', 63, 38);
  L.spawn('giantplop', 70, 38);
  L.aura(74, 41);
  L.spawn('checkpoint', 78, 38);

  // ── BOULDER RUN #1 (easier): steep steps down, 1 tile every 3 ──
  for (let i = 0; i < 14; i++) L.ground(81 + i * 3, 83 + i * 3, 38 - i);
  L.chase(84, 123, 1.45);
  L.spawn('plop', 93, 34);
  L.spawn('plop', 104, 31);
  L.spawn('plop', 115, 27);
  L.aura(99, 36);
  L.aura(111, 32);
  // the chasm at the bottom (run and jump!), cut wide enough for the rock to drop in
  L.pit(123, 130);
  L.ground(131, 139, 24);
  L.auraArc(132, 3, 27, 1);

  // ── Poo puddle #2 (wide: hop, hop, hop) ─────────────────────
  L.puddle(140, 147, 24);
  L.aura(143.5, 27);
  L.ground(148, 153, 24);
  L.spawn('tree', 149.5, 24, { h: 52 });

  // ── POO PITS: 3-wide pillars standing in poo, 4 tiles apart (semi-difficult) ──
  // a running jump (or a jump and a double jump) gets you from one to the next; fall
  // short and you're in the poo: hop, double jump, and you're back on a pillar (every puddle has a
  // side no more than 2 tiles above the poo, so you can always climb out)
  L.puddle(154, 157, 22);
  L.ground(158, 160, 24);
  L.puddle(161, 164, 22);
  L.ground(165, 167, 25);
  L.puddle(168, 171, 22);
  L.ground(172, 174, 24);
  L.puddle(175, 176, 22);
  L.ground(177, 177, 23);
  L.auraArc(155.5, 2, 28, 1);
  L.aura(166, 29);
  L.auraArc(169, 2, 29, 1);
  L.spawn('para', 169, 31, { kind: 'plop' });

  // ── BEACH VOLLEYBALL ─────────────────────────────────────────
  L.ground(178, 195, 23);
  L.spawn('volley', 187, 23, { w: 15 });
  L.rootbeer(187, 28); // right over the net

  // ── A rise with a poo goat, GIANT PLOP #2 · checkpoint 2 ────
  L.ground(196, 202, 24);
  L.spawn('poogoat', 200, 24);
  L.ground(203, 216, 23);
  L.spawn('giantplop', 208, 23);
  L.spawn('tree', 205, 23, { h: 60 });
  L.aura(212, 26);
  L.spawn('checkpoint', 215, 23);

  // ── BOULDER RUN #2 (harder): faster rock, more in the way ───
  for (let i = 0; i < 13; i++) L.ground(217 + i * 3, 219 + i * 3, 23 - i);
  L.chase(220, 256, 1.7);
  L.spawn('bigplop', 227, 20);
  L.spawn('plop', 234, 18);
  L.spawn('para', 240, 16, { kind: 'plop' });
  L.spawn('plop', 245, 14);
  L.spawn('plop', 251, 12);
  L.aura(231, 22);
  L.aura(242, 19);
  // at the bottom, a big poo puddle: jump it (or hop through it), and the rock sinks in it
  L.puddle(256, 263, 10);
  L.ground(264, 273, 10);
  L.auraArc(265, 3, 13, 1);

  // ── Poo puddle #3, checkpoint 3 ─────────────────────────────
  L.puddle(274, 280, 10);
  L.rootbeer(277, 14); // over the puddle: a jump from the edge
  L.ground(281, 286, 10);
  L.spawn('checkpoint', 283, 10);

  // ── THE PITS: pillars and an island over bottomless pits (difficult) ──
  // 4–5 tiles between them, some a step up: run, and keep your double jump for when you need it
  L.ground(291, 292, 12);
  L.ground(297, 298, 13);
  L.island(304, 306, 12, 1, false);
  L.ground(309, 311, 10);
  L.auraArc(289, 2, 15, 1);
  L.aura(297.5, 16);
  L.auraArc(301, 2, 17, 2);
  L.aura(310, 13);
  L.spawn('para', 300, 18, { kind: 'plop' });

  // ── GIANT PLOP #3 · checkpoint 4 ────────────────────────────
  L.ground(314, 327, 11);
  L.spawn('tree', 316, 11, { h: 58 });
  L.spawn('giantplop', 320, 11);
  L.aura(323, 14);
  L.spawn('checkpoint', 325, 11);

  // ── A last rise, the last Plops, a GIANT PLOP guarding the gate ──
  L.ground(328, 335, 9);
  L.spawn('plop', 331, 9);
  L.ground(336, 341, 10);
  L.spawn('poogoat', 339, 10);
  L.ground(342, 359, 9);
  L.spawn('tree', 344, 9, { h: 58 });
  L.spawn('giantplop', 347, 9);
  L.auraArc(349, 3, 12, 1);
  L.spawn('plop', 351, 9);
  L.spawn('tree', 353, 9, { h: 64 });
  L.spawn('goal', 356, 9);
  return L.build();
}
