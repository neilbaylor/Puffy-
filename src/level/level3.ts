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
 *   47-58   A Big Plop, a floating island with root beer (off the ledge), a Plop parachuting in
 *   59-80   GIANT PLOP #1 · checkpoint 1
 *   81-130  BOULDER RUN #1 (easier): a long steep slope, three Plops, an 8-wide chasm
 *   131-151 Poo puddle #2 (wide)
 *   152-177 POO PITS: 3-wide pillars standing in poo, 4-tile gaps (semi-difficult)
 *   178-213 BEACH VOLLEYBALL: two games in a row; they spike the ball at you
 *   214-234 A rise with a poo goat, GIANT PLOP #2 · checkpoint 2
 *   235-281 BOULDER RUN #2 (harder: faster rock, a Big Plop, two Plops parachuting in, the rock sinks in a poo puddle)
 *   (Plops parachute in at 56, 63, 104, 169, 258, 263 and 318: the same number of Plops, more of them from the sky)
 *   282-302 Poo puddle #3, checkpoint 3
 *   303-331 THE PITS: pillars and an island over bottomless pits, 4–5 tile gaps (difficult)
 *   332-345 GIANT PLOP #3 · checkpoint 4
 *   346-376 A last rise with a poo goat, the last Plops, a GIANT PLOP guarding the gate
 */
export function buildLevel3(): LevelData {
  const L = new LevelBuilder('Plop Invasion · Part 1', 'World 2', 378, 52);
  L.pal = 'poo';

  // ── Poo-covered meadow ───────────────────────────────────────
  L.ground(0, 19, 40);
  L.spawn('player', 4, 40);
  L.spawn('tree', 1.5, 40, { h: 62 });
  L.spawn('tree', 10, 40, { h: 54 });
  L.auraArc(12, 2, 43, 0);
  L.auraArc(22, 2, 45, 1);
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
  L.spawn('bigplop', 50, 41, { weapon: 'flail' }); // a ball and chain (one of each weapon in the level)
  // the island hangs over the lower ground, 3 tiles above the ledge: a running jump off the
  // ledge lands on it with any hero (Big Muscles too), and there's room to walk under it
  // (it starts four tiles past the ledge (a Giant Plop is three wide), high enough for a Giant Plop to walk under once he's stepped
  // down; one row thick, so still in reach of a running jump + double jump off the ledge)
  L.island(57, 62, 45, 1, false);
  L.rootbeer(59.5, 48);
  L.aura(59.5, 47);
  L.ground(53, 58, 39);
  L.spawn('para', 56, 39, { kind: 'plop' }); // (the first one to drop in by parachute)
  L.spawn('tree', 47.5, 41, { h: 56 });

  // ── GIANT PLOP #1 · checkpoint 1 ────────────────────────────
  L.ground(59, 80, 38);
  L.spawn('tree', 60, 38, { h: 66 });
  L.spawn('para', 63, 38, { kind: 'plop' });
  L.spawn('giantplop', 70, 38);
  L.aura(64, 42);
  L.aura(74, 41);
  L.spawn('checkpoint', 78, 38);

  // ── BOULDER RUN #1 (easier): steep steps down, 1 tile every 3 ──
  for (let i = 0; i < 14; i++) L.ground(81 + i * 3, 83 + i * 3, 38 - i);
  L.chase(84, 123, 1.53);
  L.spawn('plop', 93, 34);
  L.spawn('para', 104, 31, { kind: 'plop' });
  L.spawn('plop', 115, 27);
  L.aura(89, 39);
  L.aura(99, 36);
  L.aura(106, 35);
  L.aura(111, 32);
  // the chasm at the bottom (run and jump!), cut wide enough for the rock to drop in
  L.pit(123, 130);
  L.ground(131, 139, 24);
  L.auraArc(132, 3, 27, 1);
  L.spawn('bigplop', 137, 24, { weapon: 'saw' }); // a chainsaw, waiting at the bottom

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

  // ── BEACH VOLLEYBALL: two games, one after the other ────────
  L.ground(178, 193, 23);
  L.spawn('volley', 185, 23, { w: 13 });
  L.rootbeer(185, 28); // right over the net
  L.ground(194, 197, 24);
  L.spawn('tree', 195.5, 24, { h: 54 });
  L.auraArc(194, 3, 28, 1);
  L.ground(198, 213, 23);
  L.spawn('volley', 205, 23, { w: 13 });
  L.auraArc(203, 3, 27, 1);

  // ── A rise with a poo goat, GIANT PLOP #2 · checkpoint 2 ────
  L.ground(214, 220, 24);
  L.spawn('poogoat', 218, 24);
  L.ground(221, 234, 23);
  L.spawn('giantplop', 226, 23);
  L.spawn('tree', 223, 23, { h: 60 });
  L.aura(217, 27);
  L.aura(230, 26);
  L.spawn('checkpoint', 233, 23);

  // ── BOULDER RUN #2 (harder): faster rock, more in the way ───
  for (let i = 0; i < 13; i++) L.ground(235 + i * 3, 237 + i * 3, 23 - i);
  L.chase(238, 274, 1.76);
  L.spawn('bigplop', 245, 20);
  L.spawn('plop', 252, 18);
  L.spawn('para', 258, 16, { kind: 'plop' });
  L.spawn('para', 263, 14, { kind: 'plop' });
  L.spawn('plop', 269, 12);
  L.aura(242, 24);
  L.aura(249, 22);
  L.aura(266, 17);
  L.aura(260, 19);
  // at the bottom, a big poo puddle: jump it (or hop through it), and the rock sinks in it
  L.puddle(274, 281, 10);
  L.ground(282, 291, 10);
  L.auraArc(283, 3, 13, 1);

  // ── Poo puddle #3, checkpoint 3 ─────────────────────────────
  L.puddle(292, 298, 10);
  L.rootbeer(295, 14); // over the puddle: a jump from the edge
  L.auraArc(286, 3, 13, 1);
  L.ground(299, 304, 10);
  L.spawn('checkpoint', 301, 10);

  // ── THE PITS: pillars and an island over bottomless pits (difficult) ──
  // 4–5 tiles between them, some a step up: run, and keep your double jump for when you need it
  // (the camera pulls back here, so you can see the next pillar and where you'll land)
  L.wide(303, 331, 0.8);
  L.ground(309, 310, 12);
  L.ground(315, 316, 13);
  L.island(322, 324, 12, 1, false);
  L.ground(327, 329, 10);
  L.auraArc(307, 2, 15, 1);
  L.aura(315.5, 16);
  L.auraArc(319, 2, 17, 2);
  L.aura(328, 13);
  L.spawn('para', 318, 18, { kind: 'plop' });

  // ── GIANT PLOP #3 · checkpoint 4 ────────────────────────────
  L.ground(332, 345, 11);
  L.spawn('tree', 334, 11, { h: 58 });
  L.spawn('giantplop', 338, 11);
  L.aura(341, 14);
  L.spawn('checkpoint', 343, 11);

  // ── A last rise, the last Plops, a GIANT PLOP guarding the gate ──
  L.ground(346, 353, 9);
  L.spawn('bigplop', 349, 9, { weapon: 'saw' }); // another chainsaw
  L.ground(354, 359, 10);
  L.spawn('poogoat', 357, 10);
  L.ground(360, 377, 9);
  L.spawn('tree', 362, 9, { h: 58 });
  L.spawn('giantplop', 365, 9);
  L.auraArc(355, 2, 13, 1);
  L.auraArc(367, 3, 12, 1);
  L.spawn('plop', 369, 9);
  L.spawn('tree', 371, 9, { h: 64 });
  L.spawn('goal', 374, 9);
  return L.build();
}
