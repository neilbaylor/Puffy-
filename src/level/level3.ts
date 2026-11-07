import { LevelBuilder, type LevelData } from './builder';

/**
 * World 2 · "Plop Invasion" Part 1: Puff Ball Planet, taken over by the Plops
 * and covered in poo. It runs DOWNHILL the whole way (the opposite of Part 2's
 * climb), and two stretches are steep: a giant rock comes rolling down after
 * you, so keep running, dodge the Plops, and jump the chasm at the bottom —
 * the rock tumbles in. Puddles of poo are like quicksand: you sink slowly, so
 * keep hopping to get across.
 * Heights are tiles from the bottom (the level is 52 tall).
 *
 *   0-28    Poo-covered meadow, first Plops
 *   29-33   Poo puddle #1 (small: learn to hop out)
 *   34-58   Down the steps: a Big Plop, a floating island with root beer
 *   59-80   GIANT PLOP #1 · checkpoint 1
 *   81-129  BOULDER CHASE #1 (easier): a long steep slope, three Plops, a 6-wide chasm
 *   130-160 Poo puddle #2 (wide), more Plops (some armed, some throwing poo)
 *   161-188 GIANT PLOP #2 · checkpoint 2
 *   189-235 BOULDER CHASE #2 (harder: faster rock, a Big Plop and a Plop parachuting in, a 7-wide chasm)
 *   236-262 Poo puddle #3, checkpoint 3
 *   263-289 Last stretch to the gate
 */
export function buildLevel3(): LevelData {
  const L = new LevelBuilder('Plop Invasion · Part 1', 'World 2', 290, 52);
  L.pal = 'poo';

  // ── Poo-covered meadow ───────────────────────────────────────
  L.ground(0, 19, 44);
  L.spawn('player', 4, 44);
  L.spawn('tree', 1.5, 44, { h: 62 });
  L.spawn('tree', 10, 44, { h: 54 });
  L.auraArc(12, 2, 47, 0);
  L.spawn('plop', 17, 44);
  L.ground(20, 28, 43);
  L.spawn('plop', 25, 43);
  L.spawn('tree', 27, 43, { h: 58 });

  // ── Poo puddle #1: small (a run-jump clears it; walk in and you'll have to hop out) ──
  L.puddle(29, 33, 43);
  L.aura(31, 46);

  // ── Down the steps ───────────────────────────────────────────
  // (the far side as high as the poo, so you have to get out of it)
  L.ground(34, 37, 43);
  L.ground(38, 45, 42);
  L.spawn('plop', 40, 42);
  L.ground(46, 58, 40);
  L.spawn('bigplop', 50, 40);
  L.island(51, 56, 45);
  L.rootbeer(53.5, 48); // up on the island
  L.aura(53, 47);
  L.spawn('plop', 56, 40);
  L.spawn('tree', 47, 40, { h: 56 });

  // ── GIANT PLOP #1 · checkpoint 1 ────────────────────────────
  L.ground(59, 80, 39);
  L.spawn('tree', 60, 39, { h: 66 });
  L.spawn('plop', 63, 39);
  L.spawn('giantplop', 70, 39);
  L.aura(74, 42);
  L.spawn('checkpoint', 78, 39);

  // ── BOULDER CHASE #1 (easier): steep steps down, 1 tile every 3 ──
  for (let i = 0; i < 14; i++) L.ground(81 + i * 3, 83 + i * 3, 39 - i);
  L.chase(84, 124, 1.3);
  L.spawn('plop', 93, 35);
  L.spawn('plop', 104, 32);
  L.spawn('plop', 115, 28);
  L.aura(99, 37);
  L.aura(111, 33);
  // the chasm at the bottom (run and jump!)
  L.pit(123, 128);
  L.ground(129, 139, 25);
  L.auraArc(130, 3, 28, 1);

  // ── Poo puddle #2 (wide: hop, hop, hop) ─────────────────────
  L.puddle(140, 147, 25);
  L.aura(143.5, 28);
  L.ground(148, 151, 25);
  L.ground(152, 160, 24);
  L.spawn('plop', 153, 24);
  L.spawn('bigplop', 156, 24);
  L.spawn('tree', 149, 25, { h: 52 });
  L.rootbeer(158, 29);

  // ── GIANT PLOP #2 · checkpoint 2 ────────────────────────────
  L.ground(161, 188, 22);
  L.spawn('plop', 164, 22);
  L.spawn('giantplop', 173, 22);
  L.spawn('tree', 167, 22, { h: 60 });
  L.aura(178, 25);
  L.spawn('checkpoint', 185, 22);

  // ── BOULDER CHASE #2 (harder): faster rock, more in the way, a wider chasm ──
  for (let i = 0; i < 13; i++) L.ground(189 + i * 3, 191 + i * 3, 22 - i);
  L.chase(192, 228, 1.55);
  L.spawn('bigplop', 201, 18);
  L.spawn('plop', 208, 16);
  L.spawn('para', 214, 15, { kind: 'plop' });
  L.spawn('plop', 219, 12);
  L.spawn('plop', 225, 10);
  L.aura(205, 21);
  L.aura(216, 18);
  L.pit(228, 234);
  L.ground(235, 245, 9);
  L.auraArc(236, 3, 12, 1);

  // ── Poo puddle #3, checkpoint 3 ─────────────────────────────
  L.puddle(246, 252, 9);
  L.rootbeer(249, 13); // over the puddle: a jump from the edge
  L.ground(253, 256, 9);
  L.ground(257, 289, 8);
  L.spawn('checkpoint', 259, 8);
  L.spawn('plop', 262, 8);
  L.spawn('bigplop', 268, 8);
  L.spawn('tree', 265, 8, { h: 58 });
  L.auraArc(270, 3, 11, 1);
  L.spawn('plop', 276, 8);
  L.spawn('tree', 280, 8, { h: 64 });
  L.spawn('goal', 285, 8);
  return L.build();
}
