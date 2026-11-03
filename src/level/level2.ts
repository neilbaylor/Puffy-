import { LevelBuilder, type LevelData } from './builder';

/**
 * World 1 · "Puff Ball Planet" Part 2: up the mountain — and it really is UP
 * the whole way, from the green foothills to a summit 50 tiles higher, with
 * no going back down. Heights are tiles from the bottom (the level is 62
 * tall, so there's sky above the summit). Steep parts climb 2-3 tiles at a
 * time; a few HARD jumps: wide crevasses that need a running jump, narrow
 * rock pillars to hop across, and a ledge that needs a double jump.
 * Each zone is its own piece of ground (split by crevasses) so it can have
 * its own look: green valleys, snowy rock, a frozen pond.
 *
 *   0-34    Green foothills, gentle steps up, first Puffballs
 *   37-80   Steep snowy cliff face, a goat, GIANT #1 · checkpoint 1
 *   81-85   HARD: a wide crevasse (running jump)
 *   86-130  Snowy slopes: parachuters, goats, then pillar hops
 *   131-170 The frozen pond: Puffballs and Big Puff Balls play hockey
 *   171-190 GIANT #2 · checkpoint 2
 *   191-226 An alpine meadow climbing on up; HARD crevasse at the top
 *   227-246 GIANT #3 · checkpoint 3
 *   247-329 The last steep climb: double-jump ledge, pillar hops, the summit
 */
export function buildLevel2(): LevelData {
  const L = new LevelBuilder('Puff Ball Planet · Part 2', 'World 1', 330, 62);

  // ── Green foothills (gentle steps up) ───────────────────────
  L.zone(0, 36, 'z-valley');
  L.ground(0, 16, 3);
  L.spawn('player', 4, 3);
  L.spawn('tree', 1.5, 3, { h: 62 });
  L.spawn('tree', 11, 3, { h: 54 });
  L.auraArc(12, 3, 6, 1);
  L.spawn('puffball', 15, 3);
  L.ground(17, 22, 4);
  L.spawn('bigpuff', 21, 4);
  L.ground(23, 28, 5);
  L.spawn('tree', 25, 5, { h: 58 });
  L.spawn('para', 27, 5, { kind: 'puffball' });
  L.ground(29, 34, 7);
  L.spawn('puffball', 32, 7);
  L.aura(33, 10);
  L.rootbeer(25, 10.5); // over the puff tree

  // ── Steep snowy cliff face · GIANT #1 · checkpoint 1 ───────
  L.zone(37, 80, 'z-snow');
  L.ground(37, 42, 8);
  L.spawn('tree', 38.5, 8, { h: 50, pine: true });
  L.cloud(41, 2, 10); // a hand up the first wall
  L.ground(43, 46, 11);
  L.ground(47, 51, 13);
  L.spawn('goat', 49, 13);
  L.aura(46, 14);
  L.ground(52, 56, 15);
  L.spawn('bigpuff', 55, 15);
  L.ground(57, 61, 16);
  L.spawn('para', 59, 16, { kind: 'bigpuff' });
  L.ground(62, 80, 17);
  L.spawn('tree', 63.5, 17, { h: 56, pine: true });
  L.spawn('puffball', 66, 17);
  L.spawn('giant', 71, 17);
  L.aura(75, 20);
  L.spawn('checkpoint', 78, 17);

  // ── HARD: a wide crevasse — take a run at it ─────────────────
  L.auraArc(81, 4, 21, 1.5);

  // ── Snowy slopes, climbing on: parachuters and goats ────────
  L.zone(86, 130, 'z-snow');
  L.ground(86, 92, 18);
  L.spawn('para', 89, 18, { kind: 'puffball' });
  L.ground(93, 98, 19);
  L.spawn('goat', 96, 19);
  L.spawn('tree', 94, 19, { h: 52, pine: true });
  L.ground(99, 104, 20);
  L.spawn('para', 100, 20, { kind: 'puffball' });
  L.spawn('para', 103, 20, { kind: 'bigpuff' });
  L.ground(105, 110, 22);
  L.spawn('goat', 108, 22);
  L.ground(111, 117, 23);
  L.spawn('tree', 112, 23, { h: 60, pine: true });
  L.spawn('bigpuff', 115, 23);
  L.rootbeer(113, 28); // high over the slope: second jump
  // pillar hops over a crevasse (two narrow rock columns)
  L.ground(119, 120, 25);
  L.ground(123, 124, 27);
  L.aura(123.5, 30);
  L.ground(127, 130, 28);

  // ── The frozen pond: hockey (with Big Puff Balls on the team) ─
  L.zone(131, 170, 'z-ice');
  L.ground(131, 170, 28);
  L.spawn('tree', 132, 28, { h: 50, pine: true });
  L.spawn('hockey', 150, 28, { w: 24, team: 'pbppb' });
  L.aura(150, 32);
  L.spawn('tree', 169, 28, { h: 56, pine: true });

  // ── GIANT #2 · checkpoint 2 ─────────────────────────────────
  L.zone(171, 190, 'z-snow');
  L.ground(172, 174, 29);
  L.ground(175, 190, 30);
  L.aura(176, 33);
  L.spawn('giant', 181, 30);
  L.aura(185, 33);
  L.spawn('checkpoint', 188, 30);

  // ── An alpine meadow, still climbing ────────────────────────
  L.zone(191, 226, 'z-valley');
  L.ground(192, 196, 31);
  L.spawn('tree', 192.5, 31, { h: 62 });
  L.spawn('puffball', 195, 31);
  L.ground(197, 201, 32);
  L.auraArc(197, 3, 35, 1);
  L.spawn('bigpuff', 200, 32);
  L.ground(202, 208, 34);
  L.spawn('tree', 205, 34, { h: 54 });
  L.spawn('puffball', 204, 34);
  L.spawn('para', 207, 34, { kind: 'bigpuff' });
  L.auraArc(202, 3, 37, 1);
  L.ground(209, 214, 35);
  L.aura(210, 38);
  L.spawn('puffball', 212, 35);
  L.rootbeer(206, 40); // floating above the meadow
  // HARD: another wide crevasse
  L.auraArc(215, 4, 39, 1.5);
  L.ground(220, 226, 36);
  L.aura(222, 39);
  L.spawn('tree', 224, 36, { h: 58 });

  // ── GIANT #3 · checkpoint 3 ─────────────────────────────────
  L.zone(227, 329, 'z-snow');
  L.ground(228, 230, 37);
  L.ground(231, 246, 38);
  L.auraArc(232, 3, 41, 1);
  L.spawn('tree', 232.5, 38, { h: 54, pine: true });
  L.spawn('giant', 238, 38);
  L.aura(242, 41);
  L.spawn('checkpoint', 244, 38);

  // ── The last steep climb to the summit ──────────────────────
  L.ground(247, 250, 41);
  L.spawn('para', 249, 41, { kind: 'puffball' });
  L.ground(251, 256, 44);
  L.auraArc(252, 3, 47, 1);
  L.cloud(249, 2, 43);
  L.spawn('goat', 254, 44);
  L.ground(257, 262, 45);
  L.aura(259, 48);
  L.spawn('para', 258, 45, { kind: 'puffball' });
  L.spawn('para', 261, 45, { kind: 'bigpuff' });
  // HARD: a tall ledge (double jump)
  L.ground(263, 266, 49);
  L.spawn('goat', 265, 49);
  L.aura(262, 49);
  // HARD: pillars over a crevasse (3 tiles wide each: room to land)
  L.ground(268, 270, 50);
  L.ground(273, 275, 51);
  L.ground(278, 280, 52);
  L.aura(274, 54);
  L.aura(279, 55);
  L.ground(283, 294, 52);
  L.spawn('bigpuff', 285, 52);
  L.auraArc(283, 3, 55, 1);
  L.spawn('goat', 290, 52);
  L.spawn('tree', 287, 52, { h: 50, pine: true });
  L.spawn('para', 292, 52, { kind: 'bigpuff' });
  L.ground(295, 329, 53);
  L.spawn('puffball', 299, 53);
  L.spawn('checkpoint', 298, 53); // one last checkpoint after the pillar hops
  L.auraArc(301, 3, 56, 1);
  L.spawn('bigpuff', 305, 53);
  L.spawn('tree', 308, 53, { h: 58, pine: true });
  L.auraArc(311, 4, 56, 1.5);
  L.spawn('goal', 322, 53);
  L.spawn('tree', 327, 53, { h: 66, pine: true });
  L.rootbeer(295, 57); // the summit's secret: up high over the last wall

  // a few more root beers along the way
  L.rootbeer(54, 19); // over the snowy steps
  L.rootbeer(158, 32); // above the hockey pond
  L.rootbeer(187, 34); // by checkpoint 2
  L.rootbeer(271.5, 55); // over the crevasse between the pillars

  return L.build();
}
