import { LevelBuilder, type LevelData } from './builder';

/**
 * World 1 · "Puff Ball Planet"
 * Sunny rolling hills + a cloud kingdom. Heights are tiles from the bottom
 * (ground is usually 3). Jump reach for reference:
 *   walk-jump ≈ 3.4 tiles across / 3.3 up,  run-jump ≈ 7+ tiles across / 3.8 up.
 *
 *   0-34    Meadow start: first Puffballs, a gentle hill, first aura
 *   35-37   First little gap
 *   38-62   Cloud step up to a floating island; Big Puff Ball; boulder wall to blast
 *   63-82   GIANT #1 guarding checkpoint 1
 *   83-101  Cloud crossing over a big drop (with a floating island)
 *   102-128 Bramble valley with a rock ledge and a risky high cloud
 *   129-150 GIANT #2 guarding checkpoint 2
 *   151-169 Floating isles
 *   170-200 Boulder wall, then GIANT #3 guarding checkpoint 3
 *   201-218 Final run: hills, a running-jump gap
 *   219-282 Puff Park: two soccer games. They spot you and kick the ball at you: jump it!
 *           Game 1: four Puffballs. Game 2 (longer pitch): three Puffballs with a ball,
 *           plus two Big Puff Balls who kick a BIG ball a moment later. 3 balls in all.
 *   283-303 Big Puff Ball hill, then a cloud hop over a pit
 *   304-329 Last stretch to the Puff Gate
 *
 * Nuggie spots (each one gives +1 aura): only some have a nuggie each play.
 * Root beer: 7 rare bottles, mostly in tricky spots. They're banked for a future shop.
 */
export function buildLevel1(): LevelData {
  const L = new LevelBuilder('Puff Ball Planet · Part 1', 'World 1', 330, 16);

  // ── Meadow start ───────────────────────────────────────────
  L.ground(0, 34, 3);
  L.spawn('player', 4, 3);
  L.spawn('tree', 1.5, 3, { h: 64 });
  L.spawn('tree', 9, 3, { h: 52 });
  L.auraArc(12, 2, 6, 0);
  L.spawn('puffball', 18, 3);
  L.spawn('puffball', 21, 3);
  L.ground(24, 31, 4);
  L.ground(26, 29, 5);
  L.aura(27.5, 8);
  L.spawn('puffball', 30, 4);
  L.spawn('tree', 33, 3, { h: 58 });

  // ── Little gap, then up to a floating island ───────────────
  L.ground(38, 62, 3);
  L.cloud(38, 2, 6);
  L.island(41, 46, 8);
  L.auraArc(42.5, 2, 10, 0);
  L.spawn('puffball', 44, 8);
  L.spawn('tree', 49, 3, { h: 60 });
  L.spawn('bigpuff', 51, 3);
  L.boulders(55, 56, 4, 8); // 5 tall: blast through with the bazooka
  L.aura(58.5, 5);
  L.spawn('puffball', 60, 3);

  // ── GIANT #1 · checkpoint 1 ────────────────────────────────
  L.ground(63, 82, 3);
  L.spawn('tree', 64, 3, { h: 70 });
  L.spawn('puffball', 68, 3);
  L.spawn('giant', 73, 3);
  L.aura(77, 6);
  L.spawn('checkpoint', 80, 3);

  // ── Cloud crossing ─────────────────────────────────────────
  L.pit(83, 101);
  L.cloud(84, 3, 5);
  L.cloud(89, 3, 7);
  L.aura(89.7, 9.5);
  L.island(93, 96, 6);
  L.spawn('puffball', 95, 6);
  L.cloud(98, 3, 7);
  L.aura(99.5, 9);

  // ── Bramble valley ─────────────────────────────────────────
  L.ground(102, 150, 3);
  L.spawn('tree', 103, 3, { h: 56 });
  L.spawn('bigpuff', 106, 3);
  L.brambles(109, 3, 3);
  L.rock(113, 114, 4, 5);
  L.brambles(115, 4, 3);
  L.cloud(115, 3, 8);
  L.aura(116.3, 10);
  L.spawn('puffball', 122, 3);
  L.spawn('puffball', 125, 3);
  L.spawn('tree', 128, 3, { h: 66 });

  // ── GIANT #2 · checkpoint 2 ────────────────────────────────
  L.spawn('puffball', 134, 3);
  L.spawn('giant', 140, 3);
  L.spawn('puffball', 144, 3);
  L.aura(146, 6);
  L.spawn('checkpoint', 148, 3);

  // ── Floating isles ─────────────────────────────────────────
  L.pit(151, 169);
  L.island(152, 155, 5);
  L.aura(153.5, 7);
  L.island(158, 161, 7);
  L.spawn('puffball', 160, 7);
  L.aura(159.5, 9.5);
  L.island(164, 167, 6);
  L.spawn('puffball', 165, 6);
  L.cloud(161, 3, 10);
  L.aura(162, 12);

  // ── Boulder wall · GIANT #3 · checkpoint 3 ─────────────────
  L.ground(170, 200, 3);
  L.boulders(173, 174, 4, 7);
  L.spawn('tree', 177, 3, { h: 60 });
  L.spawn('puffball', 180, 3);
  L.spawn('puffball', 183, 3);
  L.spawn('giant', 189, 3);
  L.spawn('puffball', 193, 3);
  L.aura(195, 6);
  L.spawn('checkpoint', 198, 3);

  // ── Final run ──────────────────────────────────────────────
  L.ground(201, 214, 3);
  L.spawn('puffball', 204, 3);
  L.ground(206, 212, 4);
  L.ground(208, 210, 5);
  L.spawn('puffball', 211, 4);
  L.aura(209, 8);
  L.auraArc(215, 2, 7, 0); // over the gap: needs a running jump

  // ── Puff Park: two soccer games (they kick the balls at you) ──
  L.ground(219, 296, 3);
  L.spawn('tree', 221.5, 3, { h: 58 });
  // game 1: four Puffballs, one ball
  L.spawn('soccer', 236, 3, { w: 14, team: 'pppp' });
  L.aura(236, 8);
  L.spawn('tree', 247.5, 3, { h: 70 });
  // game 2: a longer pitch. Three Puffballs with a ball, and two Big Puff Balls
  // with a big ball, kicked a moment after the first one
  L.spawn('soccer', 266, 3, { w: 22, team: 'ppp' });
  L.spawn('soccer', 266, 3, { w: 22, team: 'bb', big: true, goals: false, wait: 1.3 });
  L.aura(262, 8);
  L.spawn('tree', 281, 3, { h: 62 });

  // ── Big Puff Ball hill, cloud hop ──────────────────────────
  L.spawn('bigpuff', 286, 3);
  L.ground(289, 294, 4);
  L.ground(291, 293, 5);
  L.aura(292, 8.5);
  L.pit(297, 303);
  L.cloud(299, 3, 5);
  L.aura(300.5, 7.5);

  // ── Last stretch to the Puff Gate ──────────────────────────
  L.ground(304, 329, 3);
  L.spawn('puffball', 307, 3);
  L.spawn('puffball', 310, 3);
  L.spawn('bigpuff', 315, 3);
  L.spawn('tree', 320, 3, { h: 62 });
  L.spawn('goal', 324, 3);
  L.spawn('tree', 327.5, 3, { h: 72 });

  // ── Root beer (rare, often tucked away) ───────────────────
  L.rootbeer(28, 9); // on top of the meadow hill, needs a jump
  L.rootbeer(44.5, 11.2); // floating island
  L.rootbeer(57.5, 4); // behind the boulder wall
  L.rootbeer(95, 9); // over the cloud crossing island
  L.rootbeer(116, 12.4); // the risky high cloud over the brambles
  L.rootbeer(162, 13.2); // top of the floating isles
  L.rootbeer(209, 9.6); // final hill
  L.rootbeer(300.5, 6); // high over the cloud hop (needs the second jump)

  return L.build();
}
