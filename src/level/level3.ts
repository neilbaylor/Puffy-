import { LevelBuilder, type LevelData } from './builder';

/**
 * World 2 · "Plop Invasion" Part 1: Puff Ball Planet, taken over by the Plops
 * and covered in poo. It runs very slightly downhill (with the odd little rise),
 * except the two boulder runs, which are STEEP: a giant rock comes rolling down
 * after you, so keep running, dodge the Plops, and jump the chasm at the
 * bottom — the rock tumbles in. Puddles of poo are like quicksand: you sink
 * slowly, so keep hopping to get across. Mid-level the Plops are playing
 * beach volleyball, and they spike the ball at you.
 * Heights are tiles from the bottom (the level is 52 tall).
 *
 *   0-28    Poo-covered meadow (a little rise), first Plops
 *   29-37   Poo puddle #1 (small: learn to hop out)
 *   38-58   A poo goat, a Big Plop, a floating island with root beer
 *   59-80   GIANT PLOP #1 · checkpoint 1
 *   81-128  BOULDER RUN #1 (easier): a long steep slope, three Plops, a 6-wide chasm
 *   129-151 Poo puddle #2 (wide)
 *   152-169 BEACH VOLLEYBALL: they spike the ball at you
 *   170-190 A rise with a poo goat, GIANT PLOP #2 · checkpoint 2
 *   191-236 BOULDER RUN #2 (harder: faster rock, a Big Plop, a Plop parachuting in, a 7-wide chasm)
 *   237-258 Poo puddle #3, checkpoint 3
 *   259-289 A last rise with a poo goat, the last Plops, the gate
 */
export function buildLevel3(): LevelData {
  const L = new LevelBuilder('Plop Invasion · Part 1', 'World 2', 290, 52);
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
  L.spawn('plop', 38, 40);
  L.spawn('poogoat', 44, 40);

  // ── A Big Plop under a floating island ───────────────────────
  L.ground(47, 52, 41);
  L.spawn('bigplop', 50, 41);
  L.island(50, 55, 46);
  L.rootbeer(52.5, 49);
  L.aura(52, 48);
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
  L.chase(84, 123, 1.3);
  L.spawn('plop', 93, 34);
  L.spawn('plop', 104, 31);
  L.spawn('plop', 115, 27);
  L.aura(99, 36);
  L.aura(111, 32);
  // the chasm at the bottom (run and jump!)
  L.pit(123, 128);
  L.ground(129, 139, 24);
  L.auraArc(130, 3, 27, 1);

  // ── Poo puddle #2 (wide: hop, hop, hop) ─────────────────────
  L.puddle(140, 147, 24);
  L.aura(143.5, 27);
  L.ground(148, 151, 24);
  L.spawn('tree', 149.5, 24, { h: 52 });

  // ── BEACH VOLLEYBALL ─────────────────────────────────────────
  L.ground(152, 169, 23);
  L.spawn('volley', 161, 23, { w: 15 });
  L.rootbeer(161, 28); // right over the net

  // ── A rise with a poo goat, GIANT PLOP #2 · checkpoint 2 ────
  L.ground(170, 176, 24);
  L.spawn('poogoat', 174, 24);
  L.ground(177, 190, 23);
  L.spawn('giantplop', 182, 23);
  L.spawn('tree', 179, 23, { h: 60 });
  L.aura(186, 26);
  L.spawn('checkpoint', 189, 23);

  // ── BOULDER RUN #2 (harder): faster rock, more in the way, a wider chasm ──
  for (let i = 0; i < 13; i++) L.ground(191 + i * 3, 193 + i * 3, 23 - i);
  L.chase(194, 230, 1.55);
  L.spawn('bigplop', 201, 20);
  L.spawn('plop', 208, 18);
  L.spawn('para', 214, 16, { kind: 'plop' });
  L.spawn('plop', 219, 14);
  L.spawn('plop', 225, 12);
  L.aura(205, 22);
  L.aura(216, 19);
  L.pit(230, 236);
  L.ground(237, 247, 10);
  L.auraArc(238, 3, 13, 1);

  // ── Poo puddle #3, checkpoint 3 ─────────────────────────────
  L.puddle(248, 254, 10);
  L.rootbeer(251, 14); // over the puddle: a jump from the edge
  L.ground(255, 258, 10);
  L.spawn('checkpoint', 257, 10);

  // ── A last rise, the last Plops, the gate ──────────────────
  L.ground(259, 266, 9);
  L.spawn('plop', 262, 9);
  L.ground(267, 272, 10);
  L.spawn('poogoat', 270, 10);
  L.ground(273, 289, 9);
  L.spawn('bigplop', 277, 9);
  L.spawn('tree', 275, 9, { h: 58 });
  L.auraArc(279, 3, 12, 1);
  L.spawn('plop', 281, 9);
  L.spawn('tree', 283, 9, { h: 64 });
  L.spawn('goal', 286, 9);
  return L.build();
}
