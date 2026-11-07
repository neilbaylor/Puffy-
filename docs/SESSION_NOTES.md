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

## Where things stand (v0.117)

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
