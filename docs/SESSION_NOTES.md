# Session notes (a condensed history to continue from)

The project has been built over a long run of Claude Code sessions, in "rounds": the owner sends a batch
of requests (often several short messages in a row, sometimes changing their mind mid-round), Claude
makes them, checks them, and ships a new version (+0.01) to Railway. `docs/VERSIONS.md` lists every version.

## How the owner likes to work

- Requests are short and casual ("lets make X a bit bigger"). Several can arrive while you're working:
  fold them into the current round, and if one reverses another, the latest wins.
- **Ship every round:** they test on their phone from Railway right away. Bump the version every time.
- Replies in plain language: what changed, what you checked, anything you couldn't check. No code jargon.
  Short tables or lists are fine. Mention numbers when they asked for "a bit more / less" (e.g. "25% → 20%").
- Screenshots: send them when the change is visual and the owner can't easily see it themselves
  (or when they ask). They've also said "no need for screenshots" for small fixes.
- They play on iPhone (also as an "Add to Home Screen" app), iPad and Android tablets. iPhone memory and
  audio quirks have bitten before (see HANDOFF "Gotchas").
- Taste: cute, polished hand-drawn look; things should feel juicy but not overwhelming (they asked to tone
  down: halo glow, screen shakes, number of falling things). They like small celebrations and animation.

## Where things stand (v0.151)

### Main game
- Heroes: Puffy (fire every 0.38 s), Scruffy (light, knocked back further, 10% bigger, does a backflip when
  picked), Big Muscles (fire every 0.51 s, 2 rockets in the air, hits harder, hard to knock back).
- Part 1 (Puff Ball Planet: meadow, cloud crossings, 3 Giants + checkpoints, two soccer ambushes, Puff Gate)
  → basketball free-throw contest vs King Puff Ball (jumbotron shows all calls).
- Part 2 (mountain climb, 330 × 62 tiles: valley/snow/ice zones, goats, parachuters, hockey ambush, 3 Giants)
  → harder rematch in the Summit Dome; the King explodes.
- Start each level (and each checkpoint restart) with 1 nuggie. 4 lives. Pause menu: Resume (green),
  Home screen (yellow).
- Start screen: drone fly-over behind, logo hop, hero cards (pick = hop / backflip), Play, Part picker once a
  level is beaten, mute (top-left), full screen + **Battle** buttons (top-right, same height, side by side).
- v0.84: a loading screen with a progress bar; behind it everything the start screen needs is prepared, so it's
  smooth from the first moment (on a 4× slowed CPU the first hero tap went from 3.7 s to under 0.6 s).
  Since v0.86 it draws only the starting level's looks: one level at a time keeps its looks and scenery
  in memory (`ensureLevelLooks` / `freeLooksExcept` in `gfx/textures.ts`), so memory doesn't grow with more
  levels; picking another level draws its looks behind the fade. The start-screen fly-over loops over the first
  fifth of the level (`MenuScene.loopEnd`) instead of crossing and keeping the whole level. Measured: 86 MB
  with Part 2 / 62 MB with Part 1 at the start screen (was ~123 MB and growing).
- v0.87: the loading screen draws only what the start screen shows (`textureSteps().now`); the rest
  (`later`: heroes' game frames, bad guys, other looks, other hero card poses) is drawn piece by piece
  afterwards, only when nobody has touched the screen for ~0.9 s (`BootScene.drawTheRest`); Play/Battle
  pressed early emit `need-assets` to finish it first. Timings per step: `window.__boot` in the console.
  Loading went 4.3 → 4.0 s (normal) and 9.5 → 6.4 s (CPU ×4); first hero tap on a slow CPU 3.7 s → 0.27 s.
- The version label shows the renderer (WebGL / Canvas). v0.87 tried an automatic resolution drop on slow
  devices; v0.89 removed it, then the owner asked for it back to try on the old iPad (v0.90). It watches the
  start screen ~4 s after loading: under ~47 fps (and not a steady 30 fps cap) → 1.25×, then 1×, remembered in
  `localStorage puffy.res`, 'lower res' on the label (`watchSpeed` in `main.ts`).
- v0.89: the start screen keeps the current level and its neighbours in the Part picker in memory; their
  looks and opening scenery are drawn in quiet moments (`MenuScene.quiet`), so switching Parts is instant.
- Open question: an old iPad plays slowly (not smooth in the levels). Not solved yet. Likely causes: the canvas
  is drawn at 1.75× on tablets (lots of pixels for an old GPU) and several full-screen layers (sky, 3 hill
  layers, light shafts, vignette). Next step: find out the iPad model / iOS version and what the label says,
  then measure frame rate on it (e.g. a small fps readout) before changing anything.
- The loading screen hides the start screen underneath (`body.booting`) until it fades: on iPhones parts of
  the page underneath showed through / overflowed on the left.
- v0.85: the start screen opens on the furthest level you've unlocked (`latestLevel()` in `levels.ts`); no
  automatic full screen (the owner only wants the button, or installing the game); the start screen's song
  tries to start without a tap (works where the browser allows it, e.g. Chrome with the game installed;
  iPhones always need a first tap).

### Plop Invasion · Part 1 (level 3, v0.91–v0.99)
- World 2. `src/level/level3.ts` (downhill, 378 × 52; two volleyball games in a row; 4 checkpoints, 5 Giant Plops; jump sections "Poo Pits"
  (3-wide pillars in poo, every puddle climbable) and "The Pits" (2-wide pillars over bottomless pits); tested
  per jump with each hero: a walking jump + double jump works everywhere), terrain palette `poo` and looks `p-muck` / `p-dusk` /
  `p-stink` (`gfx/plopLooks.ts`); poo touches in `gfx/world.ts` for palettes with `poo: true`
  (drips, poo caps on trees, swirls, soft-serve hills, sludge sea); the volleyball court is pro-tour style, helpers in `gfx/plopworld.ts`.
- Plops in `entities/enemies/Plops.ts`: `plop` / `bigplop` / `giantplop` reuse the Puffball / BigPuff / Giant
  behaviour with Plop frames (`plopFrame`); unarmed ones throw poo (`Glob`), Giant Plops send poo waves
  (`GameScene.spawnPooWave`) and lob poo lumps. Bad guys are created with `createBadGuy`.
- Builder: `L.puddle(x0, x1, h)` (quicksand: `Player.goo`, sink 22 px/s scaled by hero height so every hero
  goes under in ~1.75 s; hop `GOO_HOP` 440, weaker the deeper you are) and `L.chase(x0, x1, speed)` (boulder
  chase in `GameScene.updateChase`: rock radius 115, too tall to clear with a double jump; speed = that hero's
  walk × speed (1.53 / 1.76, ≤ run × 0.95); while more than 70 px behind it closes at up to run × 1.3; at the end it drops straight down the middle of the hole (`updateRockFall`) or, if a
  puddle fills it, sinks in the poo. The end holes must be ≥ 8 tiles wide. The camera eases out to 78% zoom
  (`chaseZoom`) and looks back up the hill a little during a run, so the rock and the end jump are both in view. `Player.freeRun` = no stamina drain). Tested: all 3 heroes escape both runs.
  Put the far side of a puddle at the poo's height.
- `L.spawn('volley', cx, h, { w })`: beach volleyball (`entities/Volley.ts`, `VolleyMatch` + `VolleyPlop`). 4 Plops
  rally; within 250 px of one (or one gets hurt) they whistle and spike the ball at you (fetch → hold → spike
  again); shooting the ball pops it, then they charge. Reach is checked across the frame (`prevY`) for slow devices.
- Volleyball court art, side on like the soccer pitch (the owner didn't like pseudo-3D): `drawVolleySand`,
  `drawVolleyNetSide` (net in front of the players), `drawCourtBoard` / `drawRefChair` behind (plopworld.ts), a referee Plop that
  hops on the whistle, a ball shadow. Terrain chunks are 800 px wide (`LevelView` CHUNK).
- `poogoat` (poo-covered goat, spits poo: `PooGoat` in Plops.ts, sheet `goat-poo`). Drips: `GameScene.updateDrips`.
- Music: `src/assets/plop-invasion.m4a` (`levelTrack(3) = 'plop'`). Sudden-death basketball plays at 1.3×.
- Giant Plops = Giant Puff behaviour plus an occasional poo lob (every 7–10 s). Giants stop at overhangs they
  can't fit under (`Giant.lowCeiling`); keep low islands ≥ 4 tiles away from a ledge a Giant can walk off.
  `L.spawn('bigplop', x, h, { weapon: 'saw' })` forces a weapon (`createBadGuy`).
- Plop frames (gfx/plops.ts): idle, idle1 (breathing), blink, look, grin, hurt, yell0/1, walk0–3, run0/1;
  `idleFace` in Plops.ts picks the idle moments, `hurtAt` shows "ow!" for 0.3 s, `loiter` makes patrollers pause.
- Version numbers stay v0.x (the owner's wish): after v0.99 came v0.100, v0.101 … (commits v1.00–v1.04 = v0.100–v0.104).
- Bad guys that fall into a puddle sink too (`Enemy.inPoo`, handled in `GameScene.updatePuddles`; caught at the
  surface by moving the physics body, then 14 + height × 0.08 px/s, killed with 'fall' when under).
- Enemies walk down 1–2 tile steps (`Enemy.pitAt`: only a real drop counts as a gap); Big Puffs / Big Plops
  rumble the ground on heavy landings. Waves stop at a step up and are lifted out of the ground at spawn.
- Loading: the start screen keeps every Part within two of the one shown (and the one you just left) ready —
  only the fly-over's first view of each (`MenuScene.firstSpan`, ~6 MB) plus its looks (~6 MB each) — drawn
  first in quiet moments (600 ms without a tap; not waiting for the boot's own art), then this Part's song.
  Switching Parts measured 8–52 ms. The fade-out (320 ms) lets the new title swap in before the scenery is drawn.
  Pre-drawn pictures are shown once invisibly (`MenuScene.warmOnGpu` / `warmLook`): phones only finish the GPU
  upload on first draw, which made the first click on a Part stall. The game's `LevelView` is lazy too (`lazyNear` = where the
  fly-over starts; `free: true` still frees other levels' terrain); lazily drawn chunks join the colour grade.
- Plop textures have `PLOP_TOP = 22` px headroom (Giant Plop's tip); `Enemy.handAt` / `weaponK` place weapons in
  Plop hands; portraits have an `EDGE` margin (Big Muscles' bazooka tip).
- `LevelInfo.speech` (the hero's line after the fly-over), `hoops` (basketball finale or not), `button`.
- No finale yet (ends at the gate). The owner wants a boss battle at the end later.

### Player accounts (v0.100–v0.103)
- Optional (playing never needs one). Start screen: account button by the sound toggle (signed in: name + root
  beer count) → one Sign in button; a name that doesn't exist yet (login 404 `unknown`) asks "Make a new player?",
  OK registers it. Signed in, straight back to the start screen (no message). Names ≤ 10 characters (front end
  only; the server takes 2–16). The modal has no explanatory text (the owner wants just title, boxes, buttons).
- Name + password are kept in localStorage `puffy.account`; `account.restore()` uses the token, else signs in
  with them, and re-registers if the player is gone (fresh database). Battle uses the player's name (read-only).
- Server: `server/users.ts` (bundled to `dist-server/users.mjs`, loaded by `server.mjs`). SQLite via Node's built-in
  `node:sqlite` (Node ≥ 22.13; `engines` says so), JSON-file fallback otherwise. The file and tables are created on
  start-up if missing; new columns are added with ALTER TABLE (see `kills`). File: `DB_PATH`, else
  `$RAILWAY_VOLUME_MOUNT_PATH/puffy.db`, else `./data/puffy.db`. **On Railway attach a volume**, or each deploy
  starts with an empty database.
- Table `users`: name (unique, case-insensitive), scrypt hash + salt, rootbeer, nuggies, kills, level, timestamps;
  `sessions`: sha256 of each sign-in token. API: POST /api/register, POST /api/login, GET /api/me,
  PUT /api/progress, POST /api/logout (Bearer token). ~12 sign-in tries a minute per address.
- Client: `src/core/account.ts` (token in localStorage `puffy.token`), `src/core/bank.ts` (root beer, nuggies eaten,
  kills; per browser). Signing in merges browser + account (the bigger of each; level = latestLevel, i.e. beaten+1).
  Saved to the account when a level's results modal comes up (`account.save()`: background, errors ignored).
- v0.107: the signed-in account modal is a results-style card (selected hero on the left, stat list on the
  right; "Current level" = the Part picked on the start screen, v0.108). The mute and account buttons sit in `.start-tl` (10px gap, the same as full screen/Battle).
  server.mjs hides Node's "SQLite is an experimental feature" warning. The Railway volume (/data) holds only
  puffy.db (+ its -wal/-shm files); the owner asked why not Railway Postgres: SQLite is free, needs no extra
  service, and is plenty for one small table. Move to Postgres if there are ever several app instances.

### The Part 3 boss fight (Queen Plop in the Poo Palace) — built in v0.116
- Read `sketches/wrestling/DESIGN.md` (agreed with the owner) and look at the concept screens beside
  it. `sketches/wrestling/concept.ts` draws them with the game's own art (the basketball arena restyled,
  the ring, Queen Plop as a `drawQueen` overlay on a medium Plop).
- Key rules: side-on 2D fight on the mat; 3 hearts + nuggies (hit costs a nuggie first); 8 hits to win,
  the jumbotron counts down; top-rope dive hit = 2; she jumps a lot, is aggressive, backs off when
  you're on the ropes; ropes: bounce off, climb, rope physics (spring + wobble) — the owner said
  "don't rush" the rope feel; no referee; ending: Queen dazed "Nice work… but you'll never
  out-wrestle THE KING!", camera pulls out and zooms in on the King in the front row, he runs out.

### Battle mode (v0.60 onwards)
- Room codes (default `birchcliff`), 4 players + watchers, 25 s countdown with 2+ players, 150 s battles,
  curtain reveal, shake in the last 10 s, results modal (ties explained), last battle's KOs shown in the lobby
  only for players who got some. The name card is in your square's colour. "Player N" if no name.
- Arena: floor, middle island, clouds (a top cloud and high clouds), no ramp (removed in v0.73).
- Bonuses: heart, bombs, invincible, rapid fire, grow (muscle-arm icon). Freeze/ice and fire drops were removed.
  They sway down under parachutes with a shadow, squash on landing, blink in their last 2 s, and fly into
  whoever grabs them; the grabber does a celebration hop (Scruffy backflips).
- Your hero has a soft halo; no "(you)" and no bomb count over your head. Hearts sit above names.
- Camera 20% closer than the whole arena, following you gently; off-screen players get edge pointers.
- Rocks fall slowly (max 340 px/s) and shake the ground a little when they land (as do big
  bad guys landing from jumps). Anvils were removed in v0.107 (rocks only).
- v0.112: Giant Plops sinking in poo are cropped at the surface (`setCrop`, weapon `hideBelow`);
  `L.wide(x0, x1, zoom)` camera pull-back zones (The Pits: 0.8); terrain chunks only draw their own
  details (`clip` in drawTerrainPiece, dice still rolled so chunks join); the start screen pre-draws the
  selected Part's whole ground in quiet time (`LevelView.paintJobs`, freed when you switch Part) so the
  level fly-over only puts pictures up; neighbours kept warm reduced to ±1 (memory). Account card:
  Sign out top-right, hero lined up with the table.
- v0.113: puddles' still part (bands + deep fill) drawn once (`puddleBody`), only the surface each
  frame; one Graphics for all deep-rock fills (`LevelView.deepG`) — Part 3 had ~39 Graphics on screen
  vs 6 in Part 1. King's explosion (HoopsScene `blastFx`, gfx/blast.ts): starburst frames b0–b4 only,
  then fireball sprites (ADD), smoke sprites, dust, ember particles, fluff chunks that bounce.
  King Plop's sceptre redrawn (held in his hand). Big Muscles stamina 2.9 s (bar 3). Sign-in
  messages are boxed (red error / amber question), 16–19px. (Owner said: leave Railway crashes for now.)
- v0.114: start-screen subtitle swap waits for MenuScene's 'menu-level-built' event (emitted the
  frame after the new scenery's first render; 1.5 s fallback) before popping the new letters in, and
  the words/separators that stay glide (FLIP with element.animate) when the line re-centres.
- v0.115: MenuScene.neighbours = Parts ±1 plus the furthest unlocked (latestLevel), so Part 1 → Part 3
  is warm again (cold it was ~770 ms vs ~410 ms; the fade alone is 320 ms).
- v0.116: **WrestleScene** (src/scenes/WrestleScene.ts, art in src/gfx/wrestle.ts, drawQueen in gfx/plops.ts).
  The world is the arena's stage units × K=0.62 (heroes keep their size/physics). Player and Rocket take a
  host interface (PlayerHost/RocketHost) so they run outside GameScene. Ropes: side ropes are springs
  (run in fast → `loading` → `rebound` fling back; leaning just stops you; over the top rope → outside);
  climb = toward a corner post + jump (3 rope steps, then the turnbuckle top; `perchLock` keeps you there
  while still pushing); jump off the top = `dive` (committed arc; landing on her = 2 hits, generous reach).
  Queen AI modes: walk (hops), windup→charge (bounces off ropes), slam (poo waves), retreat (you're on the
  ropes; lobs poo if you camp), taunt (you're outside), hurt, down. 8 hits, counted on the jumbotron (no
  bar). 3 hearts + nuggies via the normal HUD ('hud' event, lives = hearts). Ending: K.O., Queen flattened
  + dizzy, speech, camera pull-out, King in the front row (KING_SEAT, behind the boards: depth between
  crowd and front layers), zoom, he runs into the TUNNEL; then 'level-complete'. Losing: loseLife →
  restart the fight (or game over). Level 3's goal starts it (levels.ts `wrestle: true`); the start screen
  has a temporary "Wrestle (test)" button. Ring is red & white, POO PALACE in brown.
- v0.116: Background clouds are cached canvas pictures per cloud (repainted every 0.3 s, staggered) instead
  of Graphics redrawn every frame (~7.5k → <1k graphics commands per frame). BootScene now does the
  deferred art + MenuScene's quiet jobs (`takeQuietJobs`) + 24 warm-up frames under the loading bar
  (two-phase bar); the boot screen is the manifest blue with the rainbow PUFFY logo. Results after the last
  level: Play again + Home screen. Account card: Sign out bottom-left.
- v0.151: losing a boss fought from the Bosses menu shows a card ("Queen Plop wins!" / "The King wins!", Try again / Home screen) via the 'boss-lost' event → showBossResults(r, false), instead of restarting.
- v0.150: player card Done 2 px shorter (padding 9/8).
- v0.149: Sign out restored to the v0.146 size (the user liked that one; don't shrink it further).
- v0.148: player card is a grid (hero | stats, then `.acct-done-row` spanning both): Done centred, min-width
  clamp(150px, 26vmin, 210px); the card keeps its old width (a wrapping flex row stretched it).
- v0.147: ui.ts `bossIntro`: hoops-start / wrestle-start hide the HUD (pause) and block Esc/P; 'hoops-play'
  (end of the Hoops intro) and 'wrestle-fight' show the bare HUD; 'boss-cutscene' (Hoops youWin/kingWins,
  Wrestle win) hides it again. gameScene is still set from the start (auto-pause on hide/rotate works).
  Sign out smaller again. Test: t123.
- v0.146: boss fights show the HUD in `.bare` mode (pause button only, top right, z-index over the letterbox)
  from 'hoops-start' / 'wrestle-start'; Hoops is now `gameScene` (pausable; its window tap listener ignores
  taps on `.hud`/`.screen`). `.lvl-side` is a normal flex item again (row centred with it). Wrestle:
  'topchair' = chair shot while diving (3 hits; also a dive landing while holding the chair). Sign out
  smaller; greeting h2 smaller with a matching padding. Intro jumbotron holds 1.8 s / 1.9 s. Test: t122.
- v0.145: Hoops intro: King shot holds 1.3 s after his laugh, hero shot 1.4 s (name cards up). Player card: Sign out
  top right (`.acct-out` top/right); the greeting h2 has padding-right so a long name wraps before it. Test: t121.
- v0.144: Queen fight heart pick-ups drawn 10% bigger (scale 0.99/ART_RES) with a matching pick-up reach (22 × 28).
- v0.143: chair + dive = 2 hits (DOUBLE texts). Intro: TONIGHT! stays (1e9) through the sweep + a 1.9 s hold,
  then the jumbotron switches to her title for a 2 s hold before the crash zoom.
- v0.142: `chairHit` clears her invulnerability first, so a connecting chair always counts and is spent
  (before, a swing during her post-hit flash didn't count and you kept the chair). Test: t120.
- v0.141: Queen HITS 15, CHAIRS 3 (CHAIR_AT_HP [–,10,5]), a touch harder (speed 100, hurt 0.5 s, cd tweaks).
  WrestleScene no longer puts a title on the stinger bars (the level → Queen transition showed
  "Plop Invasion · Part 1"); Hoops' Part 2 ending jumbotron just says PLOP INVASION. Hoops hero shot:
  muzzle point rotated with the fire tilt (−0.42) so flash/smoke/ball leave the raised bazooka. Tests:
  t100c (visible UI text through the L3 → Queen transition), t117h <hero>.
- v0.140: `.lvl-side` holds the Bosses button absolutely to the right of `.levels` (so Part buttons stay
  centred) with a ::before divider; boss modal h2 "Boss battles", gap 16; boss card button "Play again".
  Hoops: result messages 2 s (wait 1.7 s), YOUR SHOT / KING'S SHOT 1.5 s. Wrestle: intro jumbotron hold
  1.3 s; the jumbotron falls back to the title (not the count) before the fight; count set at FIGHT!;
  King ending holds longer (1.7/0.95/1.7/1.2 s). drawQueenKO frames move more (legs, tongue, breath,
  swirl). Tests that used the old test button now go through the Bosses menu (t119: intro jumbotron).
- v0.139 basketball shots (HoopsScene playerShot/kingShot): hero = brace (tilt −0.36, crouch) → fire
  (squash/stretch, kick back + up, `puffs()` smoke at the muzzle and dust at the feet, camera kick) →
  Back.easeOut settle; uses 'idle1' as the held frame (the idle hops only fire on 'idle0'). King = new
  frames puff0/puff1/spit in gfx/hoops.ts (KING_LEAN puff1/spit; kingCrownAt lifts the crown when
  puffed) → shiver tween → PTOO! (`spray()` of spit, a burst, lurch back). Test: t117.
- v0.138 perf: LevelView.pieces() caches each level's terrain piece outlines (`PIECES`, by name|kind):
  the flood fill + trace was ~120 ms of a Part 3 switch. Profile tool: tprof.cjs (CDP sampling).
- v0.137 Bosses menu (ui.ts `BOSSES`, `showBosses`, `playBoss`, `showBossResults`): a `.lvl-bosses`
  button after the level buttons; lists the bosses of beaten levels; fights get `bossData()` with
  `result.practice = true` → Hoops kingWins / Wrestle faint restart the boss with no life lost;
  win → boss card (Fight again / Home screen). Wrestle test button removed. Test: t116.
- v0.136: battle star power 8 s (sim POWER_SECS); Plop browns per size (SMALL/MED/BIG_BODY; the
  royals keep BODY0 — drawPlop takes an optional body Fill).
- v0.135 Queen: HITS 12, CHAIRS 4 (CHAIR_AT_HP [–,9,6,3]), chair + dive = 3, start with 6 hearts,
  hearts every 2–4 s, ~15% calmer (speed 94 etc.), hurt 0.55 s, head reach +6 px / 0.5 h, chair cd 0.2 s
  with one queued press. New K.O. art `drawQueenKO` (4 frames, 'wr-queen-ko'; Queen.ko stops her own
  update). Ending ~1 s longer: jumbotron close-up then a crash zoom on the King (camManual/camTo).
  FIX: `skipping` stayed true after a skipped intro (ending camera moves were instant) — reset when
  the fight starts. King seat x 520 (a crowd sign covered him). Tests: t115 (ending), t113 KO modes.
- v0.134 UI: home cards + everything below 10 px lower (8 on phones; bottom padding gives the room);
  Sign out = Done size and level; user modal shows `latestLevel()`; battle room box left-aligned;
  signed-in battle name = account name by default, editable (`puffy.name.<user>`). Tests: home.cjs, t114.
- v0.133 fix: a chair-shot K.O. froze the game: `hitQueen` → `win()` runs synchronously and destroyed the
  held chair, then `chairHit` called setTexture on the destroyed image. `chairHit` now clears `this.chair`
  before `hitQueen` (restoring it if the hit didn't count). Test: t113 chair|rocket.
- v0.132: Level 3 (`level3.ts`): the Plops at tiles 56, 63, 104 and 263 now parachute in (`L.spawn('para', x, y, { kind: 'plop' })`),
  joining 169, 258 and 318: same number of Plops, 7 from the sky. (A para dropping in only triggers when
  the screen's right edge nears it, so none sit in the opening screen.) Test: t112.
- v0.131: `CHAIRS` 5, `CHAIR_AT_HP` [–, 12, 9, 6, 3], chair timer 10–13 s. Chair swing ~0.3 s with almost no
  cooldown (0.05 s); a press during a swing sets `again` and the next swing follows on. Test: t111.
- v0.130: hearts every 3–5 s (first at 3 s).
- v0.129: hearts every 2–4 s (first at 3 s); her heave (big poo throw) cd 5–7.5 s (first after 5 s); turnbuckle lobs every 1.6 s.
- v0.128: hearts every 3–6 s (first at 4 s) while below 6.
- v0.127: two rockets = one hit (`rocketHalf` in WrestleScene.hitQueen: the first calls q.hit(0),
  still knocking her back with the usual invulnerability; the second q.hit(1); the jumbotron only
  ever shows whole hits). The CHAIR button is the same red FIRE button relabelled (font a touch
  smaller). Test: t110.
- v0.126: hearts every 2.5–4 s (first at 4 s) below 6. Chairs: `CHAIRS` 4 a match (`chairsLeft`),
  first 8 s in, then every 11–15 s after the last one's gone, or at the latest when she's down to
  `CHAIR_AT_HP` [–, 11, 7, 4] hits, so all 4 come. `chairHurts`: you keep the chair through one hit,
  the second drops it (and fainting drops it). Test: t109.
- v0.125 music: the Queen fight plays the basketball song (`playHoops`) as a placeholder (to be
  replaced). `preloadHoopsMusic()` decodes it once the hero is two-thirds through a boss level
  (GameScene `bossSongReady`) and on the Wrestle test button, so it starts with her entrance instead
  of ~5 s in. `window.__music()` shows what's playing (tests: tmus.cjs, t100m.cjs).
- v0.124: HITS 15. Bazooka back in the ring (the input wrapper only blanks `fire` while the chair is
  held; rockets overlap her sprite → `explode()` → 1 hit + knock-back). Holding the chair: the scene
  reads the raw input (`rawInput`, `firePressed`) and FIRE swings it (no auto swing; hits only if
  she's in reach in front); `wrestle-chair` event → `touch.setChair(on)` relabels the button CHAIR
  (grey, `.tbtn-fire.chair`). Calmer: speed 108, hops 0.35–0.85 s, lunges 30%, charge cd 1.7–3 s,
  heave cd 3.8–5.8 s, slam 3.5%, block jump cd 1.9–2.9 s. Test: t108.
- v0.123 hearts: `HEARTS_START` 5, `HEARTS_MAX` 6 in WrestleScene; heart pick-ups every 4–7 s (first
  at 5 s) whenever you have fewer than 6; the over-the-head row shows 5 slots (+ a 6th when you have
  it). Test: t107.
- v0.122 chair + card: `drawFoldingChair` is now a folded chair stood on end (CHAIR_W 30 × CHAIR_H 74,
  grip = the feet at the bottom; `bent` folds it in a V). Heroes have a carry mode (`carry`,
  `carryArms`, `carryHand`, `CARRY_SWING` in gfx/draw.ts; used by puffy/scruffy/muscles.ts: no bazooka,
  both arms to the hands). `makeCarrySheet()` (gfx/textures.ts) builds `char-<id>-carry` = every POSE
  + sw0–sw3 + lift; built at fight start. Player has `sheet` (alternate sheet) and `frameOverride`.
  WrestleScene: pick up → lift tween → held overhead (chair sprite at `heroHand(a)`, rotated along the
  arms, depth just behind the hero); auto swing when she's within ~0.85 chair lengths and in front
  (wind-up then down; the hit at a > −0.75). Hit → `chairHit()` (2 hits, bent, flies off). Queen's
  name card = Hoops' lower third (`.hoops-l3.wr-l3`, pink) from the spotlight reveal to the
  turnbuckle. Speech bubble `width: max-content`, clamped by its real width. Test: t106 <hero>.
  (The start screen remembers the last hero played: `puffy.hero` in localStorage.)
- v0.121 Queen Plop round 2 (`WrestleScene.ts`): HITS 20 (rage = 1 + lost/HITS·0.8). Bigger,
  more frequent hops/lunges (−430…−760); `queenLanded()` rumbles camera + ropes on landings over
  300 px/s (like the Giant Plops). New 'heave' mode: `heaveAt()` throws a big lump of poo (`Lob.big`)
  that trails poo, lands ~75 px short of you and starts a rolling wave (`spawnWave`, which slams use
  too). No HUD in the ring (ui.ts adds `.hud.bare`: only the pause button) and no nuggies: 3 hearts
  drawn over the hero (`drawHeroHearts`, Battle's style), heart pickups (`prize-heart`, only while
  you're below 3) every 7–12 s. Folding chair (`drawFoldingChair` in gfx/wrestle.ts, + bent): drops
  ~12 s in, then every 18–26 s; lies 6.5 s (blinks, fades); touch to hold; touching her while
  holding = `chairHit()` (2 hits, it bends and flies off); hurt = you drop it. Jumbotron: "FROM THE
  TOP ROPE!" stays on a dive hit (plus the small pop text), "CHAIR SHOT!". Stomps also use last
  frame's hero bottom (`prevHeroBottom`) so low frame rates can't skip the head. Intro cut to ~9 s with
  the camera always moving (crowd → jumbotron sweep, crash zoom, strut, rising climb, speech framed
  with headroom). Speech bubble: lifted 20 px, rounded joined tail. Tests: t105 (chair/hearts/heave).
- v0.120 Queen Plop round (`src/scenes/WrestleScene.ts`): a long, skippable entrance in `intro()`
  (jumbotron push-in, crowd pan with flashbulbs and sweeping rafter beams, lights down, spotlight
  strut with "POOPA!", she climbs the right corner ropes with rope sag, "Welcome to MY Poo Palace!",
  leap in). Cutscene camera = `camManual` + `camTo()`/`cut()`/`glide()` (a newer `camTo` cancels an
  older one via `camTok`); `updateCamera` now always eases `camY`, so hand-offs don't jump. She is
  drawn above the dark/spot during the intro, back at `DEPTH_W.queen` after the leap. Tougher Queen:
  rage step 0.08, speed 118, hops every 0.35–0.85 s with lunges, jumps up to meet a falling hero
  (rising faster than −250 = a headbutt, not a stomp; top-rope dives still count), faster/more
  charges and slams, 1.1 s invulnerability, 60% counter-charge after a hit. `Q_RES` 4 (sharper
  close-ups). "FROM THE TOP ROPE!" is now an `fx.popText` (the jumbotron still flashes). Rockets:
  none in the ring since v0.119 (fire is always false). Test t93 now runs at the LEFT ropes (the
  quicksand puddle is on the right); t104 = intro frames.
- v0.107 pacing (`src/shared/battle/sim.ts`): bad guys every 9–18 s (first at 10 s), at most 2 at once;
  prizes every 11–18 s (first at 5 s). Measured over 10 sim-minutes: enemies 99 → 67, prizes 125 → 82.
- Plops: a four-step walk per size (small hop, medium waddle, big stomp), weapons held at the grip. Since
  v0.107 standing Plops breathe, blink, glance, grin and now and then yell (`plopStanding` in BattleScene),
  and flinch with the 'hurt' frame for 0.32 s when hit (flag 8) — the same frames as level 3.

## Things to know before changing the battle

- `src/shared/battle/sim.ts` is used by BOTH the server and the client (prediction). Rules changes need a
  server deploy (they go out with the normal Railway push) and should pass `scripts/qa/simtest.ts`.
- Snapshot formats (packed arrays) are in `protocol.ts`; prizes send age `-1` while falling.
- The server reads `BATTLE_DEMO` for test setups (see HANDOFF).

## Testing tricks

- Headless Chromium draws in software and is slow: a 0.5 s effect may never appear in a screenshot.
  Instead, patch a scene method from `page.evaluate` to log values each frame (e.g. the celebration hop's
  height), or force the camera with `scene.followCamera = function () { ... }` to frame what you need.
- To screenshot a canvas texture: `game.textures.get(key).getSourceImage().toDataURL()`.
- Icons can be previewed without the game: bundle the drawing module with esbuild into a tiny HTML page
  with a canvas (that's how the Grow icon was iterated).

## Ideas the owner has mentioned for later

- World 2: "Plop Invasion" (the Plops and their King are already drawn: `gfx/plops.ts`; the level list
  in `levels.ts` notes World 2 is coming). A shop for the root beer bottles players collect (they're banked already).
- More levels made from the existing art (see `docs/MAKING_A_LEVEL.md`).
