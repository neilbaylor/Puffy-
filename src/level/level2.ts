import { LevelBuilder, type LevelData } from './builder';

/**
 * World 1 · "Puff Ball Planet" Part 2: up the mountain.
 * Heights are tiles from the bottom (the level is 38 tall, so the summit has sky above it). Steep parts climb
 * 3 tiles at a time (a jump, or a double jump); gentle parts step up 1 tile.
 * Each zone is its own piece of ground (split by crevasses) so it can have its
 * own look: green valleys, snowy rock, a frozen pond.
 *
 *   0-36    Green valley foothills: gentle steps up, first Puffballs
 *   40-80   Steep snowy cliff face (3-tile steps), a goat, GIANT #1 · checkpoint 1
 *   84-128  Snowy slopes, gentle: Puffballs drop in by parachute, goats on patrol
 *   132-165 The frozen pond: Puffballs playing hockey shoot pucks at you
 *   169-185 GIANT #2 · checkpoint 2
 *   186-212 Down into a green alpine valley, then a steep climb back out
 *   216-232 GIANT #3 · checkpoint 3
 *   233-299 The last steep snowy climb, parachuters, goats, the summit gate
 */
export function buildLevel2(): LevelData {
  const L = new LevelBuilder('Puff Ball Planet · Part 2', 'World 1', 300, 38);

  // ── Green valley foothills (gentle) ─────────────────────────
  L.zone(0, 38, 'z-valley');
  L.ground(0, 18, 3);
  L.spawn('player', 4, 3);
  L.spawn('tree', 1.5, 3, { h: 62 });
  L.spawn('tree', 11, 3, { h: 54 });
  L.auraArc(13, 3, 6, 1);
  L.spawn('puffball', 16, 3);
  L.ground(19, 24, 4);
  L.spawn('puffball', 22, 4);
  L.ground(25, 30, 5);
  L.spawn('tree', 27, 5, { h: 58 });
  L.spawn('para', 29, 5, { kind: 'puffball' });
  L.ground(31, 36, 6);
  L.aura(34, 9);
  L.rootbeer(27, 10.5); // over the puff tree

  // ── Steep snowy cliff face · GIANT #1 · checkpoint 1 ───────
  L.zone(39, 82, 'z-snow');
  L.ground(40, 46, 7);
  L.spawn('tree', 41.5, 7, { h: 50, pine: true });
  L.ground(47, 50, 10);
  L.cloud(45, 2, 9); // a hand up the first wall
  L.ground(51, 56, 13);
  L.spawn('goat', 54, 13);
  L.aura(49, 13);
  L.ground(57, 62, 15);
  L.spawn('para', 60, 15, { kind: 'bigpuff' });
  L.ground(63, 80, 16);
  L.spawn('tree', 64.5, 16, { h: 56, pine: true });
  L.spawn('puffball', 67, 16);
  L.spawn('giant', 72, 16);
  L.aura(76, 19);
  L.spawn('checkpoint', 78, 16);

  // ── Snowy slopes (gentle): parachuters and goats ────────────
  L.zone(83, 130, 'z-snow');
  L.ground(84, 92, 16);
  L.cloud(81, 2, 17); // over the crevasse
  L.spawn('para', 89, 16, { kind: 'puffball' });
  L.ground(93, 100, 17);
  L.spawn('goat', 97, 17);
  L.spawn('tree', 94, 17, { h: 52, pine: true });
  L.ground(101, 110, 18);
  L.spawn('para', 104, 18, { kind: 'puffball' });
  L.spawn('para', 108, 18, { kind: 'puffball' });
  L.auraArc(102, 3, 21, 1);
  L.ground(111, 128, 19);
  L.spawn('tree', 113, 19, { h: 60, pine: true });
  L.spawn('goat', 117, 19);
  L.spawn('para', 121, 19, { kind: 'bigpuff' });
  L.spawn('tree', 126.5, 19, { h: 48, pine: true });
  L.rootbeer(119, 24); // high over the slope: second jump

  // ── The frozen pond: hockey ─────────────────────────────────
  L.zone(131, 166, 'z-ice');
  L.cloud(129, 2, 20);
  L.ground(132, 165, 19);
  L.spawn('tree', 133, 19, { h: 50, pine: true });
  L.spawn('hockey', 149, 19, { w: 22, team: 'pppb' });
  L.aura(149, 23);
  L.spawn('tree', 164, 19, { h: 56, pine: true });

  // ── GIANT #2 · checkpoint 2 ─────────────────────────────────
  L.zone(167, 185, 'z-snow');
  L.cloud(166, 2, 20);
  L.ground(169, 185, 19);
  L.spawn('giant', 175, 19);
  L.aura(180, 22);
  L.spawn('checkpoint', 183, 19);

  // ── Down into a green alpine valley, then steeply back out ──
  L.zone(186, 213, 'z-valley');
  L.ground(188, 193, 16);
  L.ground(194, 204, 12);
  L.spawn('tree', 196, 12, { h: 62 });
  L.spawn('puffball', 199, 12);
  L.spawn('puffball', 202, 12);
  L.spawn('tree', 203.5, 12, { h: 54 });
  L.auraArc(197, 3, 15, 1);
  L.ground(205, 208, 15);
  L.ground(209, 212, 18);
  L.spawn('para', 210, 18, { kind: 'puffball' });
  L.rootbeer(200, 18.5); // floating above the valley

  // ── GIANT #3 · checkpoint 3 ─────────────────────────────────
  L.zone(214, 299, 'z-snow');
  L.cloud(213, 2, 19);
  L.ground(216, 232, 19);
  L.spawn('tree', 217.5, 19, { h: 54, pine: true });
  L.spawn('giant', 223, 19);
  L.aura(228, 22);
  L.spawn('checkpoint', 230, 19);

  // ── The last steep climb to the summit ──────────────────────
  L.ground(233, 236, 22);
  L.ground(237, 240, 25);
  L.cloud(235, 2, 24);
  L.ground(241, 250, 25);
  L.spawn('goat', 246, 25);
  L.spawn('tree', 249, 25, { h: 46, pine: true });
  L.cloud(252, 2, 25); // over the last crevasse
  L.ground(255, 262, 26);
  L.spawn('para', 257, 26, { kind: 'puffball' });
  L.spawn('para', 260, 26, { kind: 'puffball' });
  L.aura(258, 29);
  L.ground(263, 266, 29);
  L.ground(267, 299, 29);
  L.spawn('bigpuff', 272, 29);
  L.spawn('goat', 279, 29);
  L.spawn('para', 283, 29, { kind: 'bigpuff' });
  L.spawn('tree', 287, 29, { h: 58, pine: true });
  L.spawn('goal', 292, 29);
  L.spawn('tree', 297, 29, { h: 66, pine: true });
  L.rootbeer(265, 33); // the summit's secret: up high over the last wall

  return L.build();
}
