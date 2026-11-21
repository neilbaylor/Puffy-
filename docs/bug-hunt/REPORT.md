# Puffy: full bug, performance and memory report (7 bug passes, 2 performance passes, 3 combined passes, 1 memory pass, then 2 fresh-eyes rounds on v0.361)

## Status after the review (#26 closed on 21 Nov) and what's new
This file is the report's new home: branch `claude/bug-hunt-report-v0361`, on the latest `claude/game-base`. Its PR replaces #26 as the place to start. The original report, passes 1–7, is kept below unchanged.

- **Shipped in v0.353:** #1, #2, #3 (adjusted to use `X-Real-IP`), #4, #6, #7, #9, #13, #15, #16, #18, #19, #22, #23, #24, #25.
- **Declined:** #5, #8, #10, #11, #12, #14, #17, #20, #21, #27. #28 was withdrawn. None of them is proposed again.
- **Two corrections from the review:**
  - #27's risk note said a lost graphics context reloads the page. In light mode it didn't. Since v0.353 it does, at most once a minute.
  - A wrestling freeze (`collideSpriteVsGroup` walking a live list with `useTree: false`) was missed by these passes. It was fixed in v0.352.
- **New: two fresh-eyes rounds on `claude/game-base` at `06f2dc4` (v0.361, Phaser 4.2.1).** Details are in "Rounds 8 and 9" below. They found two Low bugs, both about what a scene keeps when it is started again. There are new PRs for them; their stack starts on the latest base:

  | PR | Branch | Base | Severity | What | Evidence |
  |---|---|---|---|---|---|
  | #29 | `fix-hoops-again-anim` | `claude/game-base` | Low | After "Play again" the King welcomes you in his running-off (or laughing) frames, mouth shut | `t_hoopsagain.ts`; browser: `hoopsagain.mjs`, `shots/hoops-again.png` |
  | #30 | `fix-fishing-quit-leftovers` | #29 | Low | Quit King Bob's contest mid-cast or with a fish on the line, start again: a ~970 px white streak, a stray fishing line | `t_fishquit.ts`; browser: `fishtrail.mjs`, `fishdangle.mjs`, `shots/fishing-*.png` |

  No performance change was worth making: what's left is graphics work (texture uploads and drawing), not the game's JavaScript. See the rounds' performance notes.

---

## Passes 1–7 on v0.351 (the original report)

**Code:** `neilbaylor/Puffy-`, base `claude/game-base` at `ce8bcb2` (v0.351). That is about 51k lines of TS/JS:
- the server and shared battle sim
- core, input, net and levels
- entities, world, all scenes, UI
- graphics (gfx) and the art page

**Result:** 26 fix PRs (#1–#25, #27), each on its own branch. #26 is this report. They are stacked: each PR's base is the one before it, and #1's base is `claude/game-base`. Every patch also applies **on its own** to `claude/game-base` (checked with `git apply --check`), so any subset can be merged in any order.
- **2 are performance changes (#1, #25), 1 is a memory change (#27), and the other 23 fix 24 bugs.** #23 fixes two related bugs in two commits.
- Each PR has a fresh-eyes review comment on GitHub (verdict plus inline notes) for whoever decides what to merge.
- **Checks:**
  - on every branch: `tsc --noEmit` and `tsc --noEmit -p tsconfig.server.json` pass;
  - on the top of the stack: `npm run build` passes.
- **Tests** are in `tests/`. Run one with `bash tests/run.sh tests/<file>.ts`, which uses esbuild + node, a 60 s timeout, a Phaser stub and a small DOM shim; set `REPO=` to point at a checkout. Each test was run against `claude/game-base` (shows the bug) and the top of the stack (shows the fix).

Severity:
- **High:** a wrong result with no error, data loss, or something that never finishes.
- **Medium:** a crash on ordinary input, or a wrong result on unusual input.
- **Low:** the rest.

Where I was unsure, I chose the lower one. No bug reached High: the account data loss (#16) heals itself the next time the ahead device syncs.

## All PRs at a glance
The status after the review (shipped in v0.353, or declined) is at the top. The two newer PRs, #29 and #30, are in the table there.

| PR | Branch | Kind | Severity | What | Evidence |
|---|---|---|---|---|---|
| #1 | `perf-terrain-shapes` | perf | — | Terrain outlines ~5× faster (124.5 → 25.8 ms over all levels), identical output | `t_merge.ts` |
| #2 | `fix-static-path-traversal` | security | Medium | `GET /..%2fdist-server/users.mjs` served server code; a malformed `%` escape gave 500 | curl on server.mjs |
| #3 | `fix-login-rate-limit` | security | Medium | A spoofed `X-Forwarded-For` bypassed the 12-logins-a-minute limit | `t_rate.ts` |
| #4 | `fix-account-beaten-level` | bug | Medium | A new device lost the last beaten level (King Bob gone from the Bosses menu) | `t_account.ts`; browser: `acct.mjs` (end to end) |
| #5 | `fix-battle-rock-damage` | bug | Medium | One falling rock hit a bad guy every tick (any rock killed anything); rock kills stayed one tick | `t_rock.ts`, `t_dead.ts` |
| #6 | `fix-boss-rotate-resume` | bug | Low | Turning the phone back un-paused Hoops/Fishing under the Paused menu | `t_rotate.ts` |
| #7 | `fix-football-ball-leak` | bug | Low | Underwater football's ball pool ran dry | `t_football.ts` |
| #8 | `fix-plop-king-early-return` | bug | Low (rare) | Plop King came back while his Plops were still arriving | `t_king.ts` |
| #9 | `fix-fishing-init-reset` | bug | Low | The last contest's BIGGEST fish and news carried over | `t_fishing.ts` |
| #10 | `fix-confetti-colors` | bug | Low | Confetti `colors` ignored (the crown asked for gold + white, got all 7) | `t_confetti.ts` |
| #11 | `fix-hockey-stick-tween` | bug | Low | A new fade tween every frame for a beaten player's stick | `t_hockey.ts` |
| #12 | `fix-projectile-shutdown-listeners` | bug (leak) | Low | Every projectile left a SHUTDOWN listener | `t_listeners.ts` |
| #13 | `fix-start-fullscreen-listener` | bug (leak) | Low | Each start screen visit kept the old screen (3 × 320² canvases) alive | `t_fslisten.ts` |
| #14 | `fix-slow-device-threshold` | bug | Low | 47.6–50 fps went straight to light mode, skipping the lower resolution | read + git history |
| #15 | `fix-battle-rejoin-inputs` | bug | Medium | After a page reload mid-battle your buttons were ignored (frozen) | `t_rejoin.ts`; browser: `battle2.mjs` |
| #16 | `fix-account-progress-max` | bug | Medium | A device that hadn't caught up lowered the account (rootbeer, level, spent) | `t_progress.ts` |
| #17 | `fix-register-race` | bug | Low | The same name registered twice at once → 500 (duplicate in the JSON store) | `t_register.ts` |
| #18 | `fix-music-keep` | bug (memory) | Low | A song stayed decoded (13–21 MB) after it stopped being needed | `t_music.ts` |
| #19 | `fix-battle-dead-enemies` | bug | Medium | A bad guy killed by a rocket shot and hurt for one more tick | `t_rocketdead.ts` |
| #20 | `fix-battle-double-open` | bug | Low | Two connections from one tab knocked each other off forever | `t_openTwice.ts`, `t_twonets.ts` |
| #21 | `fix-battle-pause-key` | bug | Low | Escape after a battle ended under Pause closed the results card | browser: `bpause.mjs` |
| #22 | `fix-fishing-boss-song-preload` | bug | Low | King Bob's contest song wasn't decoded ahead (silent intro) | browser: `preload5.mjs` |
| #23 | `fix-fishing-bite-paused` | bug ×2 | Low | Taps while paused/frozen counted: BITE! caught from the Paused menu; a Hoops shot wasted | `t_bitepause.ts`, `t_hoopspause.ts` |
| #24 | `fix-drop-plop-weapon` | bug | Low | A passed-by drop Plop's blaster was left hanging in mid-air | browser: `drop.mjs` |
| #25 | `perf-music-mixdown` | perf | — | Songs mixed to mono in one pass: 1.5–2.7× faster at 4× CPU, bit-identical | browser: `mix.mjs` (real songs) |
| #27 | `mem-release-static-canvases` | memory | — | 45 static pictures let their canvas pixels go once uploaded: −1.6 MB held everywhere, pixel-identical | browser: `memcensus.mjs`, `propshot.mjs` |

## For whoever merges: decisions and caveats (from the reviews)
- **#3** assumes **exactly one proxy that appends** to X-Forwarded-For (the Railway setup).
  - With no proxy, the header is entirely client-controlled; use `req.socket.remoteAddress`.
  - With a CDN in front, all users behind one edge would share a bucket.
- **#5 is a balance change:** rocks now do their stated 1/2/3 damage, so big bad guys survive most rocks. It needs a design OK. Its extra filter in `stepHazards` is made redundant by #19 (keep #19's).
- **#14 is a behaviour change:** devices at 47.6–50 fps get a lower resolution before light mode, which is saved for good. It needs a design OK.
- **#16** stops the progress endpoint from ever lowering values. Any future "reset progress" feature needs its own route.
- **#8 is the easiest to skip:** by my estimate it is only reachable with very precise play.
- **#20:** guarding `go()` in `askCode()` would also avoid the brief connect-leave-connect. It isn't needed for correctness.
- **#6:** the `paused` CSS class is used as state; a `pauseEl` reference would be more explicit. A neighbouring comment is stale.
- **#10:** consider `o.colors?.length`.
- **#1:** consider making `traceCells` a wrapper over `traceCellList`, so only one tracer exists.

## Details

### Security
**#2 Static server path traversal (Medium).**
- **Where:** `server.mjs` checked `path.startsWith(ROOT)` with `ROOT = …/dist`, so `..%2f` reached any `dist*` sibling (`dist-server/` = the built accounts and battle server). Separately, `decodeURIComponent('/%E0%A4%A')` threw, giving a 500.
- **Fix:** `path !== ROOT && !path.startsWith(ROOT + sep)` → 403, and a try/catch around the decode → 400.
- **Verified:** 200 → 403; page still 200; missing file 404; bad escape 400.

**#3 Login rate limit bypass (Medium).**
- **Where:** `server/users.ts` keyed the limiter on the *first* X-Forwarded-For entry, which the client controls. A different value per request meant unlimited password guessing, and the `attempts` map was never pruned.
- **Fix:** key on the last entry; prune entries older than a minute once over 1000.
- **Verified:** `t_rate.ts`, spoofed requests `404×15` → `429`.

### Accounts and progress
**#4 New device loses the last beaten level (Medium).**
- **Where:** `core/account.ts` saved `latestLevel()` (furthest unlocked); `merge()` reads it as beaten + 1. With all 5 Parts beaten, a new device restored `beaten = 4`, so King Bob dropped out of the Bosses menu.
- **Fix:** save `beaten + 1`.
- **Verified:** `t_account.ts`, server 5 → 6, device B 4 → 5.

**#16 Stale device lowers the account (Medium).**
- **Where:** `PUT /api/progress` overwrote the account; the client merges "the bigger of each" only on sign-in and start-up.
- **Example:** the phone saves 100 / 50 / 80 / level 4 / spent 20; the tablet (synced that morning) then saves 35 / 9 / 15 / 3 / 0, and the account keeps the tablet's numbers. Items stay owned with spent 0, so they are effectively free on a new device.
- **Fix:** `MAX(column, ?)` (SQLite) and `Math.max` (JSON fallback).
- **Verified:** `t_progress.ts`.

**#17 Register race (Low).**
- **Where:** the name check runs before `await hashPassword` and the insert after, so a second concurrent register hits the UNIQUE constraint → 500, or creates a duplicate in the JSON store.
- **Fix:** check again after the hash.
- **Verified:** `t_register.ts`, `201 + 500` → `409 + 201`.

### Online battle (server, sim, client)
**#5 Falling rock damage (Medium).**
- **Where:** `stepHazards` hurt a bad guy on every tick of overlap; a damage-1 rock went `ehit ehit ehit ehit edie` on a 5-hp bad guy. Also, rock kills stayed in `sim.enemies` (and the snapshot) for a tick.
- **Fix:** each hazard keeps a `hit` set; filter after `stepHazards`.
- **Verified:** `t_rock.ts`, `t_dead.ts`.

**#19 Rocket-killed bad guys get an extra tick (Medium).**
- **Where:** rockets explode at the end of `step()`, after the dead filter, and `stepEnemies` has no `hp <= 0` check. The dead bad guy then moves, shoots and hurts by touch on the next tick. Stomp and chair kills earlier in a tick also went through that loop once.
- **Fix:** skip dead in the loop and filter at the end of `step()`.
- **Verified:** `t_rocketdead.ts`. Before, B loses a heart to a dead bad guy, which also fires (`eshot`). After, neither happens.

**#15 Rejoin after reload ignores your buttons (Medium).**
- **Where:** a rejoin `hello` kept the old `lastSeq`, while the reloaded BattleScene counts from 1, so every input was dropped (`s <= lastSeq`) for as long as you'd already played.
- **Fix:** reset `lastSeq` and the queue on rejoin. A plain reconnect is unaffected (checked against `reconcile()`).
- **Verified:** `t_rejoin.ts` (real server, real WebSockets), 0 px → about 100 px of movement.

**#20 Double open (Low).**
- **Where:** `BattleUI.open()` made a new `BattleNet` without closing the old one. Enter twice (or held) in the room-code box while the battle art loads queues a second open; the loading card blocks taps, not keys. The two connections from one tab share the rejoin token and keep kicking each other off (23 status changes in 6 s, forever).
- **Fix:** close first.
- **Verified:** `t_openTwice.ts` (2 → 1 live) and `t_twonets.ts`.

**#21 Pause key after the battle ends (Low).**
- **Where:** the Paused menu's Escape/P handler outlived the menu; after the results card replaced it, Escape closed the card.
- **Fix:** the handler removes itself once its menu is gone. Confirmed by reading.

### Boss contests
**#6 Rotating back un-pauses (Low).**
- **Where:** `checkOrientation` resumed Hoops/Fishing under the Paused menu.
- **Fix:** skip the auto-resume while the Paused menu is up.
- **Verified:** `t_rotate.ts` (real UI class).

**#23 Taps while paused or frozen (Low ×2).**
- **Fishing:** BITE! is judged by position from a window listener, and a tap on the Paused menu over it caught the fish.
- **Hoops:** a tap on the "turn your phone" prompt was saved and locked the meter when turned back.
- **Fix:** ignore taps unless the scene is running.
- **Verified:** `t_bitepause.ts`, `t_hoopspause.ts`.

**#9 Fishing carry-over (Low).**
- **Where:** `init()` didn't reset `best`/`news`, so the last contest's fish showed on the next contest's footer and ticker.
- **Verified:** `t_fishing.ts`.

**#22 Part 5 boss song (Low).**
- **Where:** the 66% preload covered `hoops`/`wrestle` levels, not `fishing`, which plays the same song, so the intro started silent while it was fetched and decoded. Part 5's goal is at 98% of the width, so the trigger fires. Confirmed by reading.

**#8 Plop King early return (Low, rare).**
- **Where:** if every arrived Plop was splatted before the next dropped in, the King returned with Plops still coming.
- **Fix:** count pending spawns.
- **Verified:** `t_king.ts`.

### Levels and entities
**#7 Football ball leak (Low).**
- **Where:** a snap whistled dead in the air still landed in the downed QB's hand, untracked, so the 4-ball pool ran dry (it refills only when the QB himself is knocked down).
- **Verified:** `t_football.ts`, `3/4, 2/4, 1/4, 0/4, no ball` → `4/4`.

**#24 Drop Plop's blaster left hanging (Low).**
- **Where:** passed-by drop Plops were removed with `destroy()`, not `kill()`; the blaster stayed frozen, and for fast Plops that's 700 px below you, in your way down.
- **Fix:** `kill('fall')`. Confirmed by reading.

**#11 Hockey stick tween (Low).** A new fade tween started every frame for 400 ms. `t_hockey.ts`: 24 → 1.

**#10 Confetti colours (Low).** `particleTint = colors[0]` doesn't affect a random-array tint op. `t_confetti.ts` (Phaser's real `EmitterOp`).

### Leaks and memory
- **#12:** Glob, PomPom, ThrownSaw and FishBubble each left a SHUTDOWN listener per shot. `t_listeners.ts` (real eventemitter3): 50/100/150/200 left → 0.
- **#13:** each `showStart()` added a `fullscreenchange` listener holding the old start screen. `t_fslisten.ts`: 5 → 1.
- **#18:** `keep()` sliced a still-playing song off the list without freeing it, so it stayed decoded (13–21 MB) until played again. `t_music.ts`.

### Device check
**#14 Slow-device thresholds (Low).** The resolution step needed `median > 21`, but light mode fired at `> 20`. Git history: v0.350 lowered light mode from 28 to 20 and left the other step at 21.

## Browser checks (headless Chromium, after the bug passes)
- **How it was run:** a Playwright Chromium installed in the sandbox; WebGL through the software renderer; canvas drawing on the CPU (`--disable-accelerated-2d-canvas`), because GPU-emulated canvas made everything about 15× slower and unrepresentative; CPU slowed 4× to stand in for a phone. The scripts are in `tests/browser/` and expect the game built and served (`vite build`, `build:server`, `PORT=… node server.mjs`).
- **Fixes confirmed by reading, now demonstrated before vs after:**
  - **#21:** with the battle ended under Pause, Escape removed the results card on the base build; it stays on the fixed build.
  - **#22:** past two-thirds of Part 5 the base build never decoded the boss song; the fix has it ready.
  - **#24:** after Part 4's long drop the base build left 3–4 blasters frozen in the shaft; the fix leaves none.
- **Sweeps with no errors** (on v0.361, and again on the build of #30, the top of the new stack):
  - all six Parts with a bot, in full and light mode;
  - all five bosses from the Bosses menu, plus full basketball and fishing contests through to their results;
  - the Shop (buy, wear, take off: root beer 120 → 25 as expected), Battle lobby, Bosses and Account screens.
- **Memory:** five round trips start screen → Part 1 → home stay flat (about 820 DOM nodes, 109 listeners, steady heap and textures). An early reading of steady growth was the test tool's own element handles: the heap retainer chain led to "DevTools console" handles.

## Combined passes 2 and 3 (bugs and performance, with the browser)
- **No new bugs or performance wins.** Nothing turned up in these areas, read again:
  - the online battle client (prediction, shots, snapshots);
  - the bad-guy fish and Kai;
  - the per-frame world code (shadows, birds, sea);
  - every place a player name or room code goes into the page (all escaped).
- **More fixes shown in a real browser:**
  - **#4:** device A (all 5 Parts beaten) makes an account and fresh device B signs in. On the base build B gets `beaten 4` and no King Bob in Bosses; on the fixed build `beaten 5` with King Bob (`acct.mjs`).
  - **#15:** in a 3-player battle a player reloads mid-battle, rejoins and moves (102 px in 5 s) (`battle2.mjs`).
- **Clean runs:**
  - a whole 3-player battle with bots (correct draw card, no errors);
  - 8 battles back to back: DOM nodes, listeners, heap and textures stay flat (`battles.mjs`);
  - Part 6's chase for 60 s in full and light mode.
- **Two false alarms**, both Playwright handles keeping elements alive, not game leaks: an apparent +72 DOM nodes per battle and +410 per level round trip. Heap snapshot retainer chains ended at "DevTools console" handles. With the test fixed, everything is flat.

## Memory pass
- **Census** (`tests/browser/memcensus.mjs`, pixel ratio 2): textures on the graphics chip at the start screen 79 MB, in Parts 2 and 5 about 120 MB, in basketball 118 MB. Canvases still holding their pixels: 4.3–5.4 MB. JS heap: 14–32 MB.
- **#27 (clear win):** 45 static pictures kept their canvas pixels after upload for nothing. Released: −1.6 MB held in every state, and the screenshot of all of them drawn by the game is identical.
- **Looked at and left alone:**
  - **The start screen keeping every Part's fly-over:** deliberate ("light enough to keep", for instant switching).
  - **Ground resolution:** already lowered and shared between the start screen and levels.
  - **The live cloud canvases** (re-painted in levels) and the **jumbotron/ribbon** (redrawn): they need their pixels.
  - **The other Parts' ground and trees, and the sea art (about 3 MB), held through a level, and the terrain held during a boss:** kept deliberately so that going back is instant. Freeing them would trade that instant return for memory, so they're not changed.
  - **Decoded songs:** at most the last two plus the one playing (#18).
- **Functional checks on the new builds:** Parts 1–6 and four bosses ran with no errors.

## Rounds 8 and 9 (fresh eyes on v0.361, Phaser 4)
**Code:** `claude/game-base` at `06f2dc4` (v0.361, "perf round G1 (Phaser 4)"), fetched fresh before each round; Phaser 4.2.1. `tsc --noEmit` and `tsc --noEmit -p tsconfig.server.json` pass on it and on both new branches. The build was made with `vite build --minify false` and `build:server`, served by `server.mjs`. The browser setup is the same as above.

**Round 8 (bugs and performance, browser first): no new bugs.**
- **Sweeps with no errors:**
  - all six Parts with a bot, in full and light mode;
  - all five bosses from the Bosses menu, in full mode, and three in light mode;
  - the Shop, Battle lobby, Bosses and Account screens;
  - a 3-player battle with a mid-battle reload and rejoin.
- **New code read:** `shaderWarm.ts`, `uprightUploads.ts`, `texIdFix.ts`, `jumboScreen.ts`, `ledStrip.ts`, `liveCanvas.ts`, `renderTargets.ts`, the iOS view-size change in `main.ts`, and the Hoops and Wrestle changes.
  - A tile sprite with an upright-uploaded texture draws the right way up (checked in the browser).
  - The tint change (`setTintFill` → `setTint` + `TintModes.FILL`) is safe: `clearTint()` puts the mode back in Phaser 4.
  - The jumbotron and the LED ribbon draw correctly (screenshots).
- **The declined fixes' bugs still reproduce on v0.361.** `t_rock`, `t_king`, `t_confetti`, `t_hockey`, `t_listeners`, `t_register` and `t_openTwice` give the same results as on v0.351. This is recorded here only; they are not proposed again.

**Round 9 (a different angle: what a scene keeps when it's started again).** Phaser re-uses a scene's object. "Play again", "Try again", a restart at a checkpoint, and coming back to the start screen all run `init()` and `create()` on the same object, so any field those don't reset carries over. I checked every field of the seven scenes against their `init()` and `create()`. Then I played the paths that leave something set (a win, a loss, quitting mid-action), with before/after screenshots.
- **#29 Hoops (Low):** `kingAnim` and `heroAnim` carried over. After a win, "Play again" opens on the King in his running-off frames, mouth shut, while he says "Welcome to MY palace!". After a loss he laughs through it. `hoopsagain.mjs` plays a real game to a win with every shot dead centre of the green. Base: the second intro's first 7 s are `run0`/`run1` only. Fixed: `idle0`, `idle1`, `talk`, the same as a first intro (`shots/hoops-again.png`).
- **#30 Fishing (Low):** `init()` puts the contest clock back to 0 but kept `tipTrail`, `dangle`, `swing`, `lureTrail` and `heroLean`. Quit mid-cast and start again: the old rod-tip streak's times are now in the future, so it never ages and is drawn about 970 px wide. It shows as a see-through white band over the boat for about 24 s (`shots/fishing-streak-base.png`). Quit with a fish hanging on a line: a stray line hangs from that rod tip until the angler next lands a fish, 34 s and more (`shots/fishing-line-*.png`). Fixed: neither appears.
- **Carried over but harmless (checked):**
  - Wrestle: `excitedUntil`, `jumbo` and `ribbonMsg` are overwritten by the intro within 0.45 s, behind the TV bars; the ropes' wobble dies out at once.
  - Game: the camera's look-ahead and zoom snap on the first frame.
  - Battle: everything that matters is cleared in `create()`.
  - Start screen: `prevId` only decides what's kept drawn.
- **Also checked, nothing wrong:**
  - **Level data** (`lint_levels.ts`, every spawn in Parts 1–6): no nuggie or root beer inside rock; every bad guy, checkpoint, gate and tree stands on something. Two Part 6 nuggie spots overlap a rock corner by a few px, which is harmless.
  - **Phaser 4 drawing:** the Hoops darkness and the jumbotron rays call `render()` after drawing. A hit flash (`FILL`) meeting a star or ice tint is cleared within 90 ms.
  - **Input and network:** touch controls, keyboard and gamepad mapping, `battleNet` reconnects, the offline service worker, the art loader, wardrobe and bank.

**Performance (both rounds): measured; nothing worth changing.**
- **In play, the game's JavaScript is a small share.** The main thread is 90% idle at normal speed and 56% idle at 4× CPU in Part 3. No game function is over about 0.6%. Frames are bound by graphics work.
- **The texture uploads during play** are the clouds being repainted, which is by design (`playuploads.mjs`).
- **Loading at 4× CPU** is mostly texture uploads (37%): 210 uploads, 17.4 Mpx. No canvas is uploaded twice (`bootuploads.mjs`). The game's own art code is spread thinly (`grain`, `shape`, `boundsOf`, each 1–2%). That matches the earlier passes.

**Unchecked suspicions (rated 2: not shown, not fixed):**
- **`loadArt`:** a drawing step that throws would leave the loading card up, and `starting` stuck, so every later Play does nothing. Not reachable without a failing step.
- **End of a boss level:** `stingerCover().then(() => this.scene.start(boss))` isn't cancelled if the level is left in that 0.62 s. Pause, then Home screen, inside that window would start the boss over the start screen. That needs two taps in 0.62 s.
- **Gamepad:** Y (button 3) is both fire and bomb (the keyboard keeps them apart). In a battle, Y throws a bomb and then fires while held. This may be intended.

## If more turns up later (how to add to this)
- **This report stays the single place to start:** branch `claude/bug-hunt-report-v0361` and its PR. The earlier report PR, #26, was closed after the review. Add any new finding to this REPORT.md (the status table at the top, details, evidence) and its description to PRs.md, then push to `claude/bug-hunt-report-v0361`. Don't open another report PR.
- **New fixes go on new branches on the latest `claude/game-base`**, fetched fresh. Within a round, they are stacked on each other: currently `claude/fix-fishing-quit-leftovers` (#30) is the top. Use `claude/fix-<name>` based on the previous top, one PR per fix. Each patch should also apply on its own to `claude/game-base` (check with `git apply --check`). Don't re-propose a declined fix.
- **For each new fix PR:**
  - a test that shows the bug on `claude/game-base` and the fix on top (node tests in `tests/`, browser scripts in `tests/browser/`, served build as described above);
  - `tsc --noEmit` and `tsc --noEmit -p tsconfig.server.json` passing;
  - a fresh-eyes review comment with a verdict.
- **Performance changes** need measurements before and after, and identical output: pixels, samples, or a call log. No change without a measured win.

## Performance
- **#1 `levelPieces`** (terrain outlines, worked out behind the loading screen for each level) uses number keys and flat arrays instead of `"x,y"` strings, plus a numeric `traceCellList`. The output is byte-identical for Parts 1–6 and the arena.

  | | Before | After |
  |---|---|---|
  | Part 1 | 8.9 ms | 3.7 ms |
  | Part 2 | 24.9 ms | 4.4 ms |
  | Part 3 | 14.9 ms | 2.9 ms |
  | Part 4 | 6.9 ms | 4.0 ms |
  | Part 5 | 58.3 ms | 7.9 ms |
  | Part 6 | 8.9 ms | 2.3 ms |
  | Arena | 1.6 ms | 0.6 ms |
  | **Total** | **124.5 ms** | **25.8 ms** |

  A later re-run gave 97.5 → 17.5 ms. Expect several times longer on a phone.
- **#25 music mixdown:** decoded songs were mixed stereo → mono one channel at a time (`o[i] += d[i] / n`, two passes and twice the slices). Now both channels go in one pass (`fround(a/2) + b/2`, the very same float32 sums).
  - On the game's six real songs in Chrome: **0 differing samples**.
  - At 4× CPU: 1.5–2.7× faster (231 → 86 ms battle, 120 → 64 ms start-screen song, 157 → 76 ms boss song …).
  - This runs at every load (the start-screen song) and in slices during play (level and boss songs).
- **Loading, profiled in Chrome at 4× CPU** (about 9 s to the start screen): most of it is texture uploads (37%) and canvas drawing, native work not measurable fairly here. The art code's own JavaScript is spread thinly (`grain`, `shape`, `boundsOf`, `trace` 1–2.5% each).
- **Tried and rejected:** skipping repeated canvas state sets in the crayon-grain loops. The pixels stayed identical, but there was no measurable gain (run-to-run noise was larger), so it was dropped.
- **Checked, no change needed:**
  - **Cloud re-uploads during play** (about 7 a second): already throttled by design to one per cloud per 1.5 s, and small (about 36k px each).
  - **Level start** (about 4 s at 4×): native texture work. My first upload log showed one texture made 38 times; that was a grouping mistake in my script (they are 38 different textures, 10 Mpix in all).
  - **In play and in an online battle, frame JavaScript is small:** idle 50–64% at 4× CPU, no game function over about 1%. The frames are bound by GPU and raster work.
- **Measured, no change needed:** a 4-player battle tick plus snapshot is 30–53 µs against a 33 ms budget, with snapshots of about 1.4–1.8 kB (`t_tick.ts`).
- **Not measured:** per-frame rendering cost needs a browser and GPU, so I made no claims or changes there.

## What was read
- **Pass 1 (everything, line by line):**
  - `server.mjs`, `server/*`, `scripts/*`, `vite.config.ts`
  - `src/shared`, `src/net`, `src/core`, `src/input`, `src/data`, `src/level`, `main.ts`
  - `src/entities/**`, `src/world/*`
  - all scenes
  - `src/ui/*`
  - the logic parts of `src/gfx`
- **Pass 1, skimmed and grep-checked only:** the pure drawing code in `src/gfx/*` and `src/artpage`.
- **Pass 2:** a second look at the same files for wrong defaults, return values, dropped branches and constants.
- **Performance passes 1–2 and the combined pass:** browser profiling of loading, level start, play and battles, texture-upload logging, memory round trips, and the browser sweeps above.
- **Passes 3–7:** fresh, focused re-reads:
  - battle server lifecycle (rooms, watchers, heartbeat, countdown, results, ties) and the sim (movement, shots, prizes, stomps, chairs, enemies, hazards)
  - static server ranges and ETags; the accounts API; account restore/merge
  - `Player.ts`; the level's rockets, blasts and boulders; lives and checkpoints; root beer and nuggie counting; pickups
  - the basketball, fishing and wrestling contest logic; the Tennis, Volley, Soccer and Baseball state machines
  - battle lobby flows, touch controls, boot, the start screen fly-over, sfx and music, light mode, refresh and offline
  - pattern sweeps: sorting, `Math.min(...[])`, precedence, `??`/`||`, timers and listeners left behind, `destroy()` vs `kill()`

## Checked and rejected
- **Terrain outlines lose holes (only `loops[0]` used):** no level has a second loop.
- **Path traversal via `/../`:** normalised away by the URL parser (only `..%2f` works; that is #2).
- **Hoops, Fishing and Wrestle win/lose (`decided`):** correct for regulation and sudden death.
- **Server input-queue compaction and player pack/unpack fields:** correct.
- **Hoops meter judging; the King's fly-off thresholds with ×2/×3 hits:** correct.
- **`finish()` clearing invulnerability:** harmless, because `hitPlayer` ignores anyone who isn't alive.
- **"Not ready" path in `BattleUI.open()`:** unreachable, because boot sets ready as it reveals the start screen. (The keyboard path is real: #20.)
- **Light mode skipping the texture probe on ≤2 GB devices:** only `?diag` shows 0.

## Not fixed (low confidence, or design)
- **Battle:** a rocket from a player who has just left scores its knock-out as if a bad guy did it: the victim loses a point, or everyone else gains one.
- **Shop across two devices:** purchases made before either syncs merge as the larger `spent`, not the sum, so one item is effectively free.
- **Nuggies:** re-grabbing nuggies scattered by a hit counts them again in the lifetime total. This may be intended.
- **Server:** an orphan room appears if a socket waits more than 60 s before `hello`. The game sends `hello` on open, so this is unlikely.
- **Touch controls:** `reset()` doesn't re-centre the stick knob (cosmetic).
- **Dormant:** battle chair frames would draw other players in your Shop gear (`CHAIRS_PER_BATTLE = 0` today).
- **Stale comments:**
  - big red fish "three hits" (hp is 2)
  - Wrestle heart and hit counts
  - the battle HUD "2:00" placeholder for a 2:30 match
  - "basketball has no pause menu" (`ui.ts`)
