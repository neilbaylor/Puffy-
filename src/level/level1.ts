import { LevelBuilder, type LevelData } from './builder';

/**
 * Level 1 — "Sunny Hills".
 * Heights are in tiles from the bottom of the level (ground is usually 3).
 * Rough tour (column numbers):
 * Enemies: Puffballs everywhere (1 hit), a few Big Puffs (2 hits), two giant
 * Mega Puffs (5 hits, or run under them when they jump). Turrets and
 * flying bugs are placeholders until more bad-guy sketches arrive.
 *
 *   0-44    Start meadow: first blocks, first enemies, little hill
 *   45-47   First pit
 *   48-72   Brick wall you have to blast through with the bazooka
 *   73-89   Long pit crossed on floating platforms (flyers!)
 *   90-118  Cannon turret + walkers, checkpoint at 114
 *   119-145 Spike field between stone pillars
 *   146-176 Rolling hills with hoppers
 *   177-209 The fort: two turrets, bricks, mixed enemies
 *   210-249 Big staircase, final run, goal
 */
export function buildLevel1(): LevelData {
  const L = new LevelBuilder('Sunny Hills', 250, 16);

  // ── Start meadow ────────────────────────────────────────────
  L.ground(0, 44, 3);
  L.spawn('player', 3, 3);
  L.coins(8, 3, 4);
  L.blocks(13, 7, '?', ['coin']);
  L.blocks(18, 7, 'B?B?B', ['coin', 'heart']);
  L.blocks(20, 11, '?', ['coins']);
  L.spawn('puffball', 23, 3);
  L.spawn('puffball', 26, 3);
  L.ground(30, 36, 5);
  L.ground(32, 34, 6);
  L.coinArc(30, 7, 8, 1);
  L.spawn('puffball', 35, 5);
  L.spawn('bigpuff', 41, 3);

  // ── First pit ───────────────────────────────────────────────
  L.coinArc(44, 5, 5, 2);

  // ── Brick wall ──────────────────────────────────────────────
  L.ground(48, 72, 3);
  L.spawn('puffball', 53, 3);
  L.rect(60, 61, 4, 8, 'brick'); // 5 tall: too high to jump, blast it!
  L.coins(63, 3, 4);
  L.spawn('puffball', 65, 3);
  L.spawn('puffball', 68, 3);
  L.blocks(67, 7, '???', ['coin', 'coin', 'coin']);

  // ── Platforms over the long pit ─────────────────────────────
  L.platform(74, 3, 5);
  L.platform(79, 3, 7);
  L.platform(84, 3, 5);
  L.coinArc(74, 3, 6, 0);
  L.coinArc(79, 3, 8, 0);
  L.coinArc(84, 3, 6, 0);
  L.spawn('flyer', 77, 7);
  L.spawn('flyer', 87, 8);

  // ── Turret yard ─────────────────────────────────────────────
  L.ground(90, 118, 3);
  L.blocks(95, 7, 'B?B', ['heart']);
  L.rect(101, 102, 4, 5, 'stone');
  // a giant with puffballs crowding round his feet (the stone block is a safe spot)
  L.spawn('megapuff', 110, 3);
  L.spawn('puffball', 105, 3);
  L.spawn('puffball', 107, 3);
  L.coins(104, 4, 4);
  L.spawn('checkpoint', 115, 3);

  // ── Spike field ─────────────────────────────────────────────
  L.ground(119, 145, 2);
  L.spikes(121, 3, 2);
  L.rect(124, 125, 3, 4, 'stone');
  L.spikes(126, 3, 2);
  L.rect(129, 130, 3, 5, 'stone');
  L.spikes(131, 3, 2);
  L.rect(134, 135, 3, 4, 'stone');
  L.spikes(136, 3, 2);
  L.platform(126, 3, 9);
  L.coins(126, 3, 10);
  L.spawn('flyer', 127, 6);
  L.spawn('flyer', 133, 8);
  L.spawn('puffball', 142, 2);

  // ── Rolling hills ───────────────────────────────────────────
  L.ground(146, 150, 3);
  L.ground(151, 154, 4);
  L.ground(155, 159, 5);
  L.ground(160, 163, 6);
  L.ground(164, 167, 4);
  L.ground(168, 172, 3);
  L.spawn('puffball', 157, 5);
  L.spawn('puffball', 162, 6);
  L.spawn('bigpuff', 170, 3);
  L.blocks(153, 8, '?B?', ['coin', 'coins']);
  L.coinArc(160, 4, 9, 1);
  L.coinArc(173, 4, 5, 2);

  // ── The fort ────────────────────────────────────────────────
  L.ground(177, 209, 3);
  L.blocks(181, 7, '?B?', ['coin', 'heart']);
  L.rect(186, 187, 4, 5, 'stone');
  L.spawn('turret', 186, 5);
  L.rect(191, 193, 4, 6, 'brick');
  L.spawn('puffball', 195, 3);
  L.rect(197, 197, 4, 4, 'stone');
  L.rect(198, 199, 4, 5, 'stone');
  L.spawn('turret', 198, 5);
  L.spawn('bigpuff', 202, 3);
  L.spawn('puffball', 206, 3);
  L.spawn('puffball', 208, 3);
  L.coins(194, 3, 4);

  // ── Staircase & finale ──────────────────────────────────────
  L.ground(210, 217, 3);
  L.stairs(210, 8, 3, 1);
  L.pit(218, 220);
  L.ground(221, 249, 3);
  L.stairs(221, 5, 3, -1);
  L.coinArc(217, 5, 12, 1);
  // final giant guarding the goal
  L.spawn('puffball', 228, 3);
  L.spawn('puffball', 231, 3);
  L.spawn('megapuff', 236, 3);
  L.coins(232, 5, 4);
  L.spawn('goal', 241, 3);

  return L.build();
}
