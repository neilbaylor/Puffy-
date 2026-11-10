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

## Where things stand (v0.231)

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
- Level 4 decisions (user): climbing = jumping between ledges (no wall-jumps); drop 2 longer and harder than drop 1; poo goats on the climbs; Plops sometimes parachute in while you climb (not all the time); sideways shooting while falling; baseball at the bottom of the FIRST drop, a short walk right after landing: the batter hits line drives at you; the field like Part 1's soccer pitch. Baseball art: src/gfx/baseball.ts (PARK sizes, parkSpots, drawBallparkFront/Back, drawBaseball, drawLineDrive, drawBat, drawBaseballPlop(role)), sheets sketches/level4/bb-*.png.
- Level 4: Plops in varied colours everywhere (gfx/plops.ts PLOP_COLOURS: caramel, reddish, chocolate, olive, golden, plum; drawPlop/drawPlopChute/drawBaseballPlop take a body Fill). Baseball has two teams: TEAM.plops (blue caps, fielding) and TEAM.poos (red caps/helmets, batting: batter, on deck, runner); scoreboard PLOPS vs POOS; at least one medium Plop playing (the batter and a fielder are medium, the rest small).
- Level 4 (Plop Invasion · Part 2) planning: mostly climbing up (~60%), 2 parachute drops (~25 s each, Plops parachuting at different speeds: slow big patched dome / middling / fast streamer; shoot them: POP), a baseball game in the middle, boss later. Concept art in src/gfx/skydive.ts (drawCanopy, drawHeroChute(ch, pose, 'pack'|'burst'|'opening'|'open'|'steer'|'land', lean), drawPlopChute(kind, 'slow'|'mid'|'fast'|'popped')), sheets in sketches/level4/ (sheet.ts renders them via esbuild + ../l4art/shot.cjs). Engine work needed: vertical terrain chunking (4096 px), climbing camera, vertical background, parachute player state, vertical fly-over.
- v0.230: unaffordable item: the same btn-go "Buy · price" button, disabled (.shop-item .btn:disabled grayscale 0.7 + opacity 0.62 since v0.231; was 1 / 0.5, "too greyed out"); shop buttons nowrap. User: no wrapping text; same text/size as the Buy button.
- v0.229: .shop-x holds an SVG ✕ (stroke 3.6/24, round caps, sized clamp(24px, 4.6vmin, 30px): % sizes didn't resolve in the button). Badge font clamp(15px, 3.2vmin, 20px), count 1.4em.
- v0.228: owned item's Wear it button .shop-wear = --gold-btn. ringUp: dur min(2300, 900 + paid*27), ease 1-(1-u)^1.7, starts 160 ms after the tap (after renderShop's canvas redraws), number flick via element.animate (no reflow), tick ≥55 ms apart, .shop-paid 2 s.
- v0.227: .shop-page top padding clamp(12px, 3.6vh, 26px); .bl-sub.shop-rb margin-top clamp(10px, 2.6vh, 18px).
- v0.226: one gold for the gold buttons: --gold-btn (linear-gradient #ffe27a → --gold) on .battle-btn, .lvl.picked, .lvl.lvl-bosses (were three different yellows).
- v0.225: Shop tiles: no pink price line on unbought things (tag only Yours / Wearing it / Riding it; .shop-tag keeps min-height so buttons line up).
- v0.224: Shop badge just "N root beer".
- v0.223: Shop till (ui.ts ringUp): on buy the .shop-count clicks down (ease-out, sfx.tick), "−price" drops off the pill (.shop-paid), ends sfx.kaching + .paid bump; LIGHT: no animation (sfx.powerup). Bigger pill (.bl-sub.shop-rb). Test sketches/shop/ttill.cjs.
- v0.222: Shop is a full-screen overlay (ui.ts showShop/closeShop/renderShop; .shop-page z 40, slides up from translateY(100%), close × .shop-x; transitionend filtered to the page itself). Title reuses .bl-title (pink .shop-title). Prices 20/25/50. hop(box, cv, ch, wear): celebration in a picture (card-cheer / Scruffy flip keyframes). Start screen: gear only on the picked hero (others drawn with wear ''); cardPoses cached per hero by wear key; sparkle() stars on pick (not LIGHT); closing the Shop with new gear → picked hero cheers. Wow fires only when the whole Giant is on screen. Tests tslide/tpick/tgear.cjs.
- v0.221: Gear. wardrobe.ts: SHOP items with slots head/eyes/ride (party, frogskins, board), puffy.wear csv ('none' = all off; migrates puffy.hat), equipped / wearKey / isOn / wear(id, on). DB: user_items(user_id, item, equipped, bought_at) — v0.220 items/hat moved in once at start-up (SQLite + JSON fallback); API items + wear (old clients' hat still accepted). gfx/gear.ts drawFrogskins (Lens D shapes, orange iridium), drawSkateboard (BOARD_LIFT 5). draw.ts drawCharacter(ctx, ox, oy, ch, pose, f?, wear = wardrobe.wearKey, layer 'all'|'body'|'eyes'): ride → body lifted, walk → idle, board under feet (feetOf: both feet's bottoms; jump = ollie along them); glasses placed from each hero's markEyes (face.ts eyeMark, eyesOf cached) per pose; HAT_FIT retuned; gearUp(wear) headroom; bodyLift(wear) for chute rig / chair / Hoops crown; topOf() keeps hero cards inside. Battle: hello/RoomPlayer wear; other slots drawn body → recolor → eyes (textures.ts sheet post: swap + over; makeHeroSheet(..., recolor)); lobby slotCard/slotPortrait two-pass. Level 1 "Wow!" at the first Giant (GameScene wowAtGiant). Tests sketches/shop/tgear.cjs, tbgear.cjs, gear.ts.
- v0.220: The Shop (ui.ts showShop, button .shop-btn in .start-tr). core/wardrobe.ts SHOP (party hat, 10 root beer), owned/hat in localStorage puffy.items / puffy.hat ('none' = taken off), merge(items, hat). core/bank.ts spent + rootbeerLeft (found - spent; spend()). Account + server/users.ts: spent, items, hat columns (ALTER for old DBs; PUT keeps them when an old client omits them). gfx/hats.ts drawPartyHat/drawHat (STYLES read lazily: a load-order cycle). draw.ts drawCharacter(..., hat = wardrobe.hat): headTop() finds the head top per hero+pose by drawing it hatless and scanning (cached), HAT_FIT per hero; HAT_UP (16) headroom in hero sheets / portraits / pose sets only when a hat's worn; dropHeroSheets(textures) on change (not mid-game). Battle: hello.hat, RoomPlayer.hat, server hatOk; BattleScene heroSheet(hero, hat, face) per player (reuses char-* when it's your hat), views rebuild on hat change, tag raised; battleUi slotCard/slotPortrait take hat. Hoops uses CHAR_H*ART_RES*scale, not displayHeight. Tests in sketches/shop.
- v0.219: battle sim: sizeOf(p) = min(GROW, GROW_MAX_H / hitH) when grown (GROW_MAX_H 88: islands are 96 px over the floor; Muscles 58 px tall → ×1.52, others ×1.8); makeRoom(p) on picking up grow steps you aside (up to 6 tiles) if the grown box doesn't fit. Test: sketches/battle-tests/bgrowgap.ts.
- v0.218: Battle: CHAIRS_PER_BATTLE 0 (chair code kept, unused). arena.ts stretch 4 tall rock rock(o + 17, o + 18, 3, 5) (was 3..6: only Scruffy got over, with the air jump); ARENA_SPAWNS entry moved to h 5. Test: sketches/battle-tests/bjump.ts (hold jump like a player: a tap is a short hop).
- v0.217: level4.ts: drop 1 n 6 (was 11), w = parkWall - 42 with parkWall = 54 + D (rock 66-67 from h8 up to p1.h + 6: a 3-tile gap under it to walk into Plop Park); drop 2 n 7 (was 12); climb 1 nuggies 3, climb 2 3.2 (climb(): with nuggies >= 3 an ordinary ledge gets an auraArc of 2). Counts (l4nug.ts, ranges updated for D): climb 1 35, climb 2 65. tbbreal.cjs takes the hero as argv[2].
- v0.216: battle sim.swingChair: vertical band for bad guys is 34k + h/2 below and, for one with e.chute, 60k more above (feet up to ~90 px over yours are hit; ~30 before). Test: sketches/battle-tests/bchute.ts.
- v0.215: WrestleScene.minionsInChairReach includes Plops on parachutes (was m.dead || m.chute → skip), reaching len × 1.3 above your head for them (0.7 for the rest); hitMinion on a survivor still under its chute tears it off (popped frame, max fall 900). Test: sketches/level4/tchairchute.cjs.
- v0.214: level4.ts D = 12: open ground between the bottom checkpoint (53) and Plop Park (now 68-104); everything after shifted +D (W 192, drop 1 w 52 + D, wall 106-107, climb 2 at 109, drop 2 at 146, climb 3 at 164, flyPath too). Climb 3 plops [4, 9] (the one on its last wide ledge sat at the gate). Enemy.ts BigPuff.tick: in the air it faces you (parachute gunners aim both ways; was only on the ground); on vertical levels it only hunts when dy is -50..40 (same ledge), else patrols (unless its gun is aiming). Tests: tl4bot 29/29, 41/41, 19/19; tdrop OK; tparaface.cjs (right/left).
- v0.213: gfx/baseball.ts: drawBallparkFront adds seeded (rng 4242) poo blotches (w/34), skid marks, drawPooPile piles (w/85, not on home plate), big drawPooSwirl swirls in the outfield, one by the mound, a splat on second; drawBallparkBack (rng 909) drips along the wall top, splats + drips on the ads, piles at the wall's foot, drips under the scoreboard. Standalone render: sketches/level4/bb-park-sheet.ts.
- v0.212: Plop Park (level 4, L.spawn('baseball', 56, 4, { w: 36 }), field tiles 56-92, home plate ~88.6 by climb 2). entities/Baseball.ts BaseballGame: BB_ROSTER (gfx/baseball.ts) of 7 BallPlop/BigBallPlop (Plop/BigPlop subclasses with their own sheets bbp-*: 8 plain capped frames + their role poses, mirrored to face left, res 1.25 small / 1.6 medium, alias frames for idle1/blink/look/grin/run0/run1). Idle: pitch (windup → throw → plate), swing: 65% CRACK fly ball to a fielder (walks under it) → thrown back; else into the catcher's mitt (STRIKE!) → thrown back. Alert when a hero is down on the field (bottom > ground - 150, x in x0 - 90 .. home + 160) or a player is hurt: fielders/catcher/on-deck chase (normal Plop AI), pitcher + batter keep going; line drives (LineDrive: 470 px/s, g 200, hits → hitPlayer, rockets via GameScene.rocketAt → THWACK, ground → bounce) only while the batter is on screen and you're within 760 px in front; melee bat swing within 70 px; past the batter (or batter beaten) → all chase, over. Art drawn in the level loader (makeBallpark, makeBallPlayer in textures.ts; BADDIE_KEYS.baseball = BB_KEYS, freed on other levels). Level 4 bottom: checkpoint 53, puddles 74-77/87-90 and Plops 70/80/92 removed. sfx.crack. Tests: sketches/level4/tbaseball.cjs, tbbreal.cjs (bot gets past: 2 hits), tl4bot climb 2 still 41/41.
- v0.211: WrestleScene DEPTH_W.air = players + 4.1 (the jumbotron and ribbon are at dark + 0.05 = players + 3.05, above the old minion depth queen - 0.5): spawnMinion starts at air, back to queen - 0.5 when the chute comes off; the King goes to air + 0.1 when he jets off and when he comes back, DEPTH_W.queen on landing (jet flames follow his depth). tking4.cjs logs the depths while they fall (k4-chutes.png).
- v0.210: TUNNEL (gfx/wrestle.ts) now { x 470, top 202, bottom 297, half 40 } (was 48 wide, top 222): the King at k 0.42 covered the old doorway, so he looked to float over the crowd. drawTunnel adds a warm floor gradient and a concrete step at the mouth. introKing: shadowAt(x, y, k) keeps q.shadow under him (size 84k × 13k, depth just under his) from the tunnel through the walk and robe drop; hidden (and reset to 96 × 16) when he jets into the ring. Test: sketches/level4/ttunnel.cjs (king-tunnel.png).
- v0.209: introKing walk: this.ringside (the POOPA TV table image) goes to DEPTH_W.spot + 0.4 for the walk, tinted each frame to 1 - dark.fillAlpha (so it matches the dimmed arena), and back to DEPTH_W.ringside + clearTint when he stops; the King is DEPTH_W.spot + 0.3 once round the front (in front of ring and posts, behind the table). 'dome' speech 2400 ms (was 2300). king-walk.png updated.
- v0.208: introKing opens with cut(fx, fy - 34, 2.3) on the King at the tunnel (spot on him, 'grin' for 800 ms after the 300/450 ms start wait), then the spot fades and camTo the jumbotron (1400 ms). Before, the first jumbotron framing (jy + 70, zoom 1.75) caught him at its bottom edge for a moment. Test: sketches/level4/tkstart.cjs (camera log + frames; king-open.png).
- v0.207: Plop King kingAway wave 1 is 5 small Plops (stage x 340/520/700/880/1060, 380 ms apart; still nudged 90 away if right on the hero); waves 2 and 3 stay 3 medium / 3 large. tking4.cjs: 5 small land, he returns.
- v0.206: Level 4 nuggies: drops 1 and 2 each 4 auraArcs of 2 (8, were 21); climb() takes a `nuggies` multiplier on its ledge/turn aura chances (r() is still called either way, so the layout is identical: same cell hash), climb 2 uses 1.9 (32 nuggies, was 25). Climb 1 22, climb 3 8, total 85 (was 104). Test: sketches/level4/l4nug.ts; tdrop.cjs still lands both drops.
- v0.205: Plop King (WrestleScene): introKing path goes wide of the front-left post (x -95, between ring (depth 3) and announcers' table (ringside, depth 4) at DEPTH_W.ring + 0.5, in front of everything once x > -30) and along the front to ex = stage 520 (right of the hero at 330); segment times weighted by 0.35 + 0.65k (quick while far, slow close up), walk 5.8 s (was 4.2), intro to FIGHT about 1.6 s longer. KING_HITS 16, kingAway every 4 hits (after 4, 8, 12; last round 4). Waves 3 small / 3 medium / 3 large at stage 420/660/900, medium/large armed gun-saw-gun. MINION speeds 100/112/78 (were 82/92/62), first hop 0.6-1.2 s then every 0.9-2 s, gun cd 0.7-1.3 then 1.0-1.6 (was 1.5-2.3), warn 0.4, aim range 480 (was 380), shots 360 px/s, saw charge range 320. Tests: sketches/level4/tkwalk.cjs (burst of the walk; king-walk.png), tking4.cjs (4 hits a wave, 3 per wave, 16 total).
- v0.204: Battle lobby 'Start now' (.bl-startnow beside the clock face): sends the existing { t: 'start' } message; server/battle.ts now honours it in the countdown from any player in a square (slot >= 0), cutting the timer to START_NOW_SECS = 3.5 (protocol.ts) and broadcasting, so every client's clock jumps (runClock re-syncs on >600 ms drift) into the last-4-s rumble, warm-up and curtain. Button hidden for spectators and once left <= 4.1 s. Test: tstartnow.cjs (phone + tablet; 23 -> 3 on both, battle 4.7 s after the press).
- v0.203: Battle arena (arena.ts buildArena) is four hand-laid stretches, not one mirrored: 1 meadow (walls, island h8, clouds 6/10/12), 2 hill (ground h3/h4 mound + tall tree, islands h7 each side, clouds 10/13), 3 steps (walls, islands h7/h10/h7, clouds 11/13), 4 cliffs (rocks h4 and h6, island h8, clouds 6/9/11/12, end rise). Rule: every surface has another within 4 tiles up (Big Muscles' double jump ~5 tiles). ARENA_SPAWNS listed by hand (5 per stretch), starts [4,2], [W-5,2], hill top, steps floor. Tests: bspawns.ts (every spawn on something with headroom), bchair/bfuzz/bgrow, tarena5.cjs screenshots (sketches/battle-tests/arena5-*.png).
- v0.202: Battle grow (POWER_SECS[grow] 12, was 8): sim.hurt returns early for a grown hero unless `by` is a player id, so bad guys (touch, stomp thump, their shots: owner 'e<id>') and rocks ('sky') can't hurt you; another hero's rocket, bomb, stomp or chair still can. Bad guys: enemyBudget cap min(3, max(2, players)) (was min(4, 1 + players)), enemyIn 13-23 s (first at 12 s). Tests: sketches/battle-tests/bgrow.ts (normal vs grown: bad guy, rock, bad guy shot, hero rocket), bfuzz (300 games, 0 throws, ~20% fewer spawns), tbattle2 live (0-2 bad guys about).
- v0.201: Battle arena 112 tiles wide (ARENA_SECTION 28, was 32; arena.ts scales every x with P()), the camera still shows ARENA_VIEW = 32 tiles (BattleScene zoom). CHAIRS_PER_BATTLE 5, spread from MATCH_SECS-14 down to ~20 s left, each over a floor column (nothing solid above row h-2: not the posts, not the end rises). PRIZE_ODDS bomb 34 / rapid 18 / heart 18 / grow 16 / star 14 (ice and fire stay out), MAX_PRIZES 3, a new prize every 8-13 s. Tests: bchair (300 landings all at y 480), bfuzz (300 games, 0 throws, ~5 chairs each), tbattle2 live.
- v0.200: Battle chairs land only on solid ground (not one-way clouds) and never over a floating island (sim.stepChairs picks a column with nothing solid above the posts), CHAIR_LIFE 24; swingChair reaches bad guys reach*1.35 (+18 px behind). Before: a chair often landed on the top cloud (y 160) far off and vanished before anyone got there. Tests: sketches/battle-tests/bchair.ts (swings by size/race/distance, pick-ups along the arena, 300 landings), tchairlive.cjs (live: run to the real chair and grab it).
- v0.199: Battle: pause button (battleUi.pauseMenu: the battle plays on) instead of ✕; 'Lost the connection' card when no snapshot for 3 s (BattleNet.lastSnapAt, battleUi staleT); server: each room's tick in try/catch (Room.recover ends a broken battle → lobby), process uncaughtException/unhandledRejection logged. Freeze report: likely a server restart (each deploy restarts Railway, ending live battles); the sim fuzz (sketches/battle-tests/bfuzz.ts, 1400 random battles) found no throws; a live 2-player battle locally had bad guys from ~10 s and chairs at ~45 s / ~80 s.
- v0.198: Queen tough Q_TOUGH*0.95 (5% easier; the King stays 1.05). King's medium/large minions armed (spawnMinion weapon 'gun' | 'saw': placeMinionWeapon, minionFire → minionShots pom-poms that hurt; saws charge 1.55x close up); weapon art via textures.makeWeaponArt. Flood: light shafts, gold shimmer, spray while rising, rubber ducks ('wr-duck', plopking.drawDuck). Test: sketches/level4/tarmed.cjs.
- v0.197: Plop Dome flood without the waterfalls (they looked bad); MINION.large hp 5 (was 4).
- v0.196: start screen Parts row compact on narrow phones (style.css @media max-width 700 / 600: .lvl min-width 74 / 66, smaller gaps, Bosses divider closer); Bosses menu 2x2 under 500 px tall. Measured: Parts + Bosses fit 568, 667, 740, 844, 932 wide; menu fits 568x320 and 844x390. Tests: sketches/level4/tphone4.cjs, tbossmodal.cjs.
- v0.195: Part 4 open to everyone (in LEVELS; unlocked by beating Part 3; its boss in the Bosses menu once beaten). levels.ts keeps the tester machinery (TESTERS, WIP list now empty, setTester, isTester): testers see every boss in the Bosses menu. Test: sketches/level4/topen4.cjs.
- v0.194: Plop Dome: walk-in path round the ring (introKing path: aisle → behind the ring at depth DEPTH_W.ring-0.5 → down the left side → front; 4.2 s); winKing shows CHAMPION! on the jumbotron (+0.6 s hold, confetti) before FLOODING; startFlood/updateFlood: waterfalls from the aisles, two wave layers, foam crest, glints, bubbles, floaters (robe, poo, bent chair); King: Queen(..., KING_HITS 13, Q_TOUGH*1.05), flies off after 3/6/9 hits, last round 4.
- v0.193: Plop Dome chair swings hit the King's Plops (WrestleScene.minionsInChairReach: in front, head height to the floor; hitMinion 2 each; turns to one beside you; chair not used up). Test: sketches/level4/tchair4.cjs.
- v0.192: drop 2 n 12 (was 17); drop Plops 3 in 4 with a gun (the rest as usual); 7 little arcs of nuggies floating down each drop (level4 auraArc in the shafts).
- v0.191: hit under a parachute: scattered nuggies float (Aura(..., float = chute speed): thrown down below you, easing to 0.6x your speed, 6 s life) so you sink onto them; knockBack under a chute only -60 up. Test: sketches/level4/tnug.cjs (hit with 5, steer after them: all 5 back).
- v0.190: the King's opening (GameScene.kingBlastsOff) ~15% quicker: 4.0 s.
- v0.189: drops faster (drop 1 speed 135, drop 2 150; fast Plops 2x your speed), every drop Plop armed with a gun (createBadGuy(..., 'gun')), spawned 70-180 px either side of you; 11 / 17 of them.
- v0.188: the Plop King's robe has no collar (it sat across his face: Plops have no neck); no jetpack straps either.
- v0.187: level 4 round. Parachute drops: spawn 'drop' (level4: drop 1 x 42-93 from plateau 1, speed 105; drop 2 x 134-147, speed 118, hard) — GameScene.updateDrops starts Player.startChute(speed, x0, x1) when you fall past the plateau inside a drop (canopy on at once, gone on landing; kept between the drop's sides; only real ground ends it, not a stomp); chute-landed reaches the checkpoint at the drop's bottom. Drop Plops ('pchute' canopies over normal Plop enemies, slow/mid/fast speeds, despawn well off screen). Art: skydive.ts drawHeroChuteLayer / drawPlopCanopy; textures 'chute-<hero>' (CHUTE_FRAMES) and 'pchute' (level 4 only, freed elsewhere). The Plop King: gfx/plopking.ts (drawPlopKing robe/jet/sceptre on drawPlop 'king' with KING_LOOK off, jet flames/smoke, robe heap); level start: spawn 'king' → GameScene.kingBlastsOff (cutscene flag pauses the world) then the speech "I guess up we go!". LevelData.flyPath (a climb's fly-over through points, then the hero; 9 s). Walkers are careful on climbs (no walking/leaping/pouncing off ledges); enemies on a climb wake only near your height; no flail on climbs. Plop Dome: WrestleScene boss 'king' when level 4 (wd.level) — PLOP_DOME arena + PLOP_DOME_RING (setRingLook; ring textures keyed '-k', the other ring's freed), sheets wr-pking / wr-pking-robe, introKing, kingAway every 3 hits (Math.floor((12-hp)/3) > awayCount) with minions (MINION small/medium/large, parachute in, stomp/rockets), kingReturn, winKing (steps, burstKing, FLOODING jumbotron, flood rising, "Oh no, that must be King Bob!"). Bosses menu: 'Plop King Wrestling' (level 4; open to testers). Tests: sketches/level4/tdrop.cjs (drops), tking4.cjs (the whole King fight), l4tests.sh --bot.
- v0.186: level 4 for testers: levels.ts TESTERS = ['neil', 'founder'] (any case) and setTester(name) — the WIP levels (LevelInfo.wip) join LEVELS for a tester (read from the saved sign-in at start-up, and again on every account change in ui.ts) or a ?dev device, and leave on sign-out; wip levels are pickable straight away (pickableLevels / canPickLevel), not unlocked by beating the one before. Level 4 now has a floor under each climb (ground 0-41 and 42-133 at h4) and a 2-wide rock cliff from the floor to each plateau's end (x 40-41, 132-133) so the climbs can't be walked round. MenuScene.climbGlide: the Part 4 start screen rises slowly up climb 1 (to 2600 px), fades, starts again. Test kit: sketches/level4/l4tests.sh (layout + simulated reach for every hero; --bot also runs sketches/level4/tl4bot.cjs, a bot playing every climb with every hero in the browser against the server on :8091 — restart the server after every build). v0.186: all 9 hero x climb runs reach the top with no misses. (The bot counts landing on a ledge further up — Scruffy's high second jump skips one — as progress.)
- v0.185: tall levels. LevelView terrain tiles also cut by height (CHUNK_V 1024; tile 0 keeps its old key, so other levels are unchanged — L2/L3 have no split tiles). LevelData.vertical (builder L.vertical): GameScene.updateCamera holds the last ledge's height mid-jump (ledgeFeet), feet at 66% down, falling fast eases to 34% (fallK); fly-over from the gate down to the hero; Background(…, vertical) wraps cloud bands vertically, an extra near cloud band, sky tinted smoggier with height; parachuting bad guys wait till the screen reaches their height. Level 4 (level/level4.ts, World 2 · Plop Invasion · Part 2): dev only (levels.ts DEV: ?dev sets localStorage puffy.dev=1, ?nodev clears) — 172x140, 3 staircase climbs (3 up, 1-2 across, turns are jump-through clouds above you), plateaus with checkpoints, drops are plain falls for now, flat bottom where the ballpark goes. Plop world checks now level >= 3 (themes, music, stinky ambience, BADDIES_FOR 4). Checks: sketches/level4/l4check.ts (no spot under 2 tiles of headroom), l4gaps.ts, l4reach.ts (jump simulation: all heroes reach every ledge); tl4.cjs screenshots.
- v0.184: start screen, min-height 501px: .start padding-bottom 14px + safe-b (was 10px); tplay.cjs: gap under Play 14 on 1024/1180/1280/1340.
- v0.183: battleUi slotCard() draws lobby heroes with drawHeroCard (feet on the bottom, ch.scale: Big Muscles biggest) recoloured per slot; canvas 160x200; CSS --cw on .bl-slots (phone clamp(56px,14vh,100px), min-height 501px clamp(80px,19vh,160px)), canvas height 1.25x, .bl-wait keeps the squares level with margin. tlobby3.cjs: 3 players (puffy/scruffy/muscles) in phone/tablet/desktop; phone bottom 382/390.
- v0.182: Battle chair holders use the Poo Palace carry frames: BattleScene.carryTextureFor(hero, slot) (makeCarrySheet, recoloured per slot like textureFor; keepPixels now keeps char-<id>-carry), built on the 'chair' event; HeroView.chairA = arm angle (-1.75 overhead; swing: wind back to sw0 then down to sw3 over CHAIR_SWING) -> carryFrame; the chair sits at carryHand() like WrestleScene.heroHand. BATTLE_DEMO=chairs: 2nd chair on the floor 100 px ahead. ../simtest/t.ts runs the sim headless (esbuild).
- v0.181: Battle chairs. sim.ts: BChair, CHAIRS_PER_BATTLE 2 (chairAt: ~25-55 s in and ~45-70 s before the end), random x anywhere; fall, lie CHAIR_LIFE 16 s, grabbed by touch (hands free); holding: canFire false (no rockets) and a FIRE press swings (CHAIR_SWING 0.3 s, reach 64 px x size): hurt() 1 heart (now returns whether it landed) to heroes / hurtEnemy 1; a connecting swing uses 1 of CHAIR_USES 2, then it's gone; dropChairOf on KO / leave. Events chair/chairland/chairgrab/chairswing/chairhit. Snapshot field c: SnapChair[]. BattleScene.renderChairs (wr-chair art, held at shoulder height, wind-up + smash), FIRE button says CHAIR (wrestle-chair event). BATTLE_DEMO=chairs + tchairs.cjs (2 players): 3 -> 2 -> 1 heart, chair gone, no rockets.
- v0.180: WrestleScene intro: opens cut to (jumbo x, jumbo y + 70, z 1.75, rot 0) and pushes straight in (1.3 s, no rotation swing; was a sweep from the far-left crowd). New beat 6 after her 'Welcome' line: lights to 0.25, lowerThird(hero name, 'The challenger'), camTo(p.x - 12, MAT_Y - 50, 2.45), three hops (body velocity), then back to the turnbuckle (650 ms) for the leap. tqintro.cjs logs the camera path + hero shots (+~3.5 s to the intro).
- v0.179: level3.ts bigplop at tile 50 gets weapon 'flail' (level 3 now: 3 blasters, 2 chainsaws, 1 ball and chain; tflail.cjs). BG_RES and CLOUD_RES 1.5 -> 1.25 for normal devices (light stays 1). WrestleScene: HITS 13 -> 12, Q_TOUGH 1.05 -> 1 (5% easier), CHAIR_AT_HP [-1, 8, 4]; CHAIRS was already 3 (since v0.141).
- v0.178: BootScene drains MenuScene.nextAheadJob() (quiet jobs while `building` is set = the other Parts' prewarm) behind the loading bar, with the Menu paused (prewarm's gone() now accepts a paused scene; GPU warm-up happens in the 8 warm-up frames). LIGHT / nothing beaten: no jobs, no change. Load +~0.45s in swiftshader (3.4 -> 3.8s); tfirst2.cjs: taps right after load build nothing (createWorld 0); tboot2.cjs [light].
- v0.177: (1) pause during the fly-over: .screen.modal z-index 40 (lvl-intro is 30) and setScreen toggles .lvl-intro.held (title + Skip hidden); tpausefly.cjs. (2) MenuScene quiet jobs: run 1.5s after the last tap (was 2.5s); after a job, next at +0 if it took <12ms else +min(250, took*6) (was always 250) — both other Parts ready ~2.9s after load (was ~7.3s); tjobs.cjs. (3) LIGHT: themesFor() = first look only, themeMix(one look) = no fade, Battle default too; clouds never re-shaped (c.next Infinity). tlightplay.cjs: cloud repaints 44-80 -> 0, look jobs 7-12 -> 2 per 12s. (4) railway.json startCommand node server.mjs; server.mjs exits 0 on SIGTERM/SIGINT (npm 'command failed' lines on redeploy).
- v0.176: Volley.ts spike sooner: SPOT 330 (was 250); onScreen = middle 80% (was 60%); once hot, bump() sets straight to the plop nearest the hero on the far side of the net (0.85-0.95s flight), plops move 240 px/s (was 150), catch range 34 (26), a ball hitting sand stops dead, a far-side off-screen holder sets it over instead of waiting, hold 0.3s (0.55); sand friction in fetch for everyone (a rolling ball used to outpace its fetcher and roll into the poo -> charge, no spike); REACH 600 (460). tspike2.cjs: court visible -> spike 1.5-2s (was 2-5s, sometimes never).
- v0.175: start-screen level row back to the v0.140 layout: .levels relative, .lvl-side absolute left:100% (Part buttons centred alone, divider + Bosses hang right). trow.cjs: fits down to 568px wide with 3 Parts (6px spare).
- v0.174: main.ts: start screen always draws at HOME_RES 1.25 (dpr() caps while `home`); Menu scene START/SHUTDOWN events flip it (resize). watchSpeed now measures gameplay only (Game/Hoops/Wrestle/Battle active, not home, skipping the first 2s of each stretch) and caps gameplay. core/res.ts: savedResCap/saveResCap ("<cap>@<VERSION>"); ui lowRes() uses it (v0.173 label parse was broken). thome.cjs checks home/play/home canvas sizes.
- v0.173: watchSpeed (main.ts) skips frames while Menu.quiet has jobs or Menu.building is set (background prep made iPhones look slow -> "lower res"); puffy.res stored as "<cap>@<VERSION>" and ignored if the version differs, so each new version re-measures. tres.cjs/tres2.cjs check it.
- v0.172: battle lobby padding-top clamp(14px,3.5vh,34px) (phone 14px); min-height 501px: --lobw min(100%,1000px) for .bl-slots/.bl-me, bigger slot canvas (19vh, max 160) and text. tlobby.cjs screenshots all 3 sizes.
- v0.171: MenuScene.prewarmJobs(id) builds a hidden World in steps (levelPieces ×2, LevelView with nothing painted, LevelView.pendingJobs for the opening span unshifted into quiet, Background+Ambience → pendingWorld, finalize + warmOnGpu); `building` objs destroyed in stashWorld if unfinished. planQuiet no longer has the shown Part's ground paint jobs (Play loader draws missing ground). tquiet.cjs / tinterrupt.cjs.
- v0.170: Part buttons filtered to id <= progress.beaten + 1 (Menu neighbours too); bosses stay beaten >= level.
- v0.169: MenuScene.planQuiet no longer preloads the Part's song; ui.startGame calls preloadLevelMusic(level) as the loading card opens. tsw4.cjs profiles a switch (real pointerdown).
- v0.168: LIGHT adds html.light; CSS stops .start logo/subtitle/card-name animations; syncLevels skips the cross-fade in light mode.
- v0.167: webglcontextlost in light mode shows nothing (user: let it crash); not in light mode it still switches to light + reloads. bootTrouble kept for other loading errors.
- v0.166: slight stutter in the level's opening fly-over on a mid tablet = ground chunks painted mid-flight on a quick Play. ui.gameArt adds ground jobs to the loader: MenuScene.groundJobs(id) (its own LevelView's paintJobs + warmOnGpu, or groundPaintJobs() for another Part) or, from a results card over Hoops/Wrestle, frees old terrain/tree textures then groundPaintJobs(host). artLoader waits 2 frames at the end. tfly.cjs / tnext.cjs / tcard.cjs measure it.
- v0.165: subtitle cross-fade fix: the cloned old line drops .wn-new before getting .wn-old (wn-new's animation rule was overriding the fade-out); 0.35 s.
- v0.164: LIGHT: MenuScene ignores 'menu-level' (the fly-over stays on the Part it opened with).
- v0.163: subtitle cross-fade: syncLevels clones the old .world-name as .wn-old (fades out, removed on animationend / 600 ms), new gets .wn-new (fades in). Both absolute in the fixed slot. Medium tablet doesn't pick light mode (user prefers full mode there).
- v0.162: Menu switching on a mid Android tablet still slow. LevelView option ahead:false (menu: no chunk-per-frame painting ahead); prewarmed Worlds warmOnGpu their textures; Background(stillClouds) + refreshClouds() on switch; quiet jobs after 2.5 s idle. Old tablet now falls back to Canvas (user OK with that for now).
- v0.161: WrestleScene Q_TOUGH = 1.05 (rage × 1.05, cdCharge/cdHeave/cdBlock ÷ 1.05). Pending: user is testing the fixed-slot subtitle before deciding on an old/new crossfade.
- v0.160: user's old tablet hit 'graphics out of memory'. core/light.ts LIGHT (localStorage puffy.light, deviceMemory<=2, MAX_TEXTURE_SIZE<=4096); webglcontextlost sets puffy.light=1 and reloads (once). LIGHT: resCap 1, TERRAIN_RES 1.25, BG_RES 1, CLOUD_RES 1, Menu neighbours [] and no ground paint jobs. gameArtJobs({heroes, level}) with BADDIES_FOR per level/battle + dropBaddiesExcept in GameScene. Subtitle .world-name absolute in .start-head (padding-bottom var(--wn)*1.3), contain: layout.
- v0.159: loader crashed half way on the user's old Android laptop. Boot now draws only start-screen art (textureSteps.later = []); game art via gameArtJobs({heroes, baddies, plops}) + ui/artLoader.ts loadArt() card, called from ui.startGame/playBoss and battleUi.open. MenuScene keeps a World per Part (createWorld/stashWorld/keptWorld; prewarm builds hidden Worlds for all Parts with +400 px span); subtitle swap = .world-name.swap opacity fade. Boot: Menu hidden+paused under loader, 8 warm-up frames, song wait ≤0.8 s.
- v0.158: user's older Android laptop crashed while loading. MAX_TEX=4096 + frameGrid() for all frame sheets (sheet(), makePlops, Hoops king/plop-*, Battle bplop); sheets release their canvas unless keepPixels (char-<id>, char-<id>-face: battle recolours them). deviceMemory<=2 → resCap 1. main.ts bootTrouble() shows errors on the loader; webglcontextlost shows a .gl-lost note. Waiting on the user to report what the loader says if it still fails.
- v0.157: battle arena 4 sections wide (ARENA_SECTION=32, ARENA_W=128; ARENA_STARTS per slot; nearSomeone() for drops/rocks/chutes; enemy cap min(4,1+players); BattleScene.followCamera follows you / the leader at one-section zoom). Battle: enemy KO at 0 kos → everyone else +1 (ko event gift). Nuggie aura++ in collectAura. BOSSES names; 'Boss Battles'; .bl-title spans hop. Chases past start marked started on checkpoint restart. Menu: one still look per level (themeClock.t=0), takeQuietJobs only 'essential' (neighbours + song + plops for L3); Boot hides+pauses Menu while loading; itemParts + levelPieces steps. GameScene: only current look sync, rest via lookQueue (1 layer/0.35 s). plopJobs/dropPlops (L3 only). Ambience: no shafts/vignette. CLOUD_EVERY 0.45. LevelView deep window ±500/+240.
- v0.156: perf pass. Boot: hiresPadV (no padV copy), BUDGET=45ms batching of boot steps, song awaited at the end (≤1.5 s), 12 warm-up frames; loader letters static. Menu: quiet jobs start 1 s after input, looks split per layer (lookJobs), own looks before ground paint jobs. Game: clouds repaint only on screen + Float32 silhouettes; puddle surface via fillTriangle strip; drawPortrait cached (48 entries); rotate hint on setInterval. Server: brotli q11 precomputed at start-up. Queen: jumbo/ribbon depth DEPTH_W.dark+0.05. Volley: spike only when spiker within the middle 60% of the view (hold ≤2 s). Perf scripts in scratchpad: perf1 (boot+flyovers), perf3/perf4 (level start / per-frame inclusive), taps2 (tap profiles), overdraw.cjs.
- v0.155: Queen HITS 13 (CHAIR_AT_HP [-1, 9, 4]); tablet home Play 10px off the bottom (padding-bottom 10px + safe-b at min-height 501px).
- v0.154: tablet home screen: Play ~21px off the bottom (was 6px) via a min-height:501px padding rule; the cards shrink. NOTE: src/version.ts holds VERSION = '0.xxx' (no 'v'), bump that string — v0.151–0.153 shipped still labelled 0.150.
- v0.153: boss card always shows Result: Won / Lost (basketball adds Final score).
- v0.152: boss loss card: "Result: Lost" (was Pinned!); basketball losses also show the final score.
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
