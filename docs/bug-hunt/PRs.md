# Puffy: fix and perf PRs (stacked)

Base: `claude/game-base` at `ce8bcb2` (v0.351). There are 24 branches (one commit each; #23 has two). Each branch is stacked on the one before it.

**Open on GitHub as PRs #1–#24** (https://github.com/neilbaylor/Puffy-/pulls), each based on the branch before it (#1 on `claude/game-base`). Each PR has a fresh-eyes review comment: a verdict plus inline notes on specific lines.

The same branches are also delivered as:
- `puffy-fixes.bundle`: all 24 branches. It needs `ce8bcb2` to be present already.
- `prs/NN-*.patch`: one `git format-patch` file per branch.

Every patch also applies cleanly on its own to `claude/game-base` (checked with `git apply --check`). Any PR can therefore be retargeted to `claude/game-base` or dropped without affecting the others.

Checks: `tsc --noEmit` and `tsc --noEmit -p tsconfig.server.json` pass on every branch. `npm run build` passes on the top branch (#24).

Tests are in `tests/` (run with `bash tests/run.sh tests/t_x.ts`; it uses esbuild + node, a 60 s timeout, a Phaser stub and a small DOM shim). They import from `/workspace/Puffy-`, so they test whichever branch is checked out. `t_merge.ts` also needs the original code at `/tmp/hunt/orig` (a copy of `ce8bcb2`); point that import at any checkout of the base to re-run it. All of them were run against `claude/game-base` (before) and the top branch (after). Each one shows the bug on the base and the fixed behaviour on top.

## The stack

| # | Branch | Base | Severity | Evidence |
|---|---|---|---|---|
| 1 | `claude/perf-terrain-shapes` | `claude/game-base` | perf | measured, identical output |
| 2 | `claude/fix-static-path-traversal` | #1 | Medium | curl against server.mjs |
| 3 | `claude/fix-login-rate-limit` | #2 | Medium | `t_rate.ts` |
| 4 | `claude/fix-account-beaten-level` | #3 | Medium | `t_account.ts` |
| 5 | `claude/fix-battle-rock-damage` | #4 | Medium | `t_rock.ts`, `t_dead.ts` |
| 6 | `claude/fix-boss-rotate-resume` | #5 | Low | `t_rotate.ts` |
| 7 | `claude/fix-football-ball-leak` | #6 | Low | `t_football.ts` |
| 8 | `claude/fix-plop-king-early-return` | #7 | Low (rare) | `t_king.ts` |
| 9 | `claude/fix-fishing-init-reset` | #8 | Low | `t_fishing.ts` |
| 10 | `claude/fix-confetti-colors` | #9 | Low | `t_confetti.ts` |
| 11 | `claude/fix-hockey-stick-tween` | #10 | Low | `t_hockey.ts` |
| 12 | `claude/fix-projectile-shutdown-listeners` | #11 | Low | `t_listeners.ts` |
| 13 | `claude/fix-start-fullscreen-listener` | #12 | Low | `t_fslisten.ts` |
| 14 | `claude/fix-slow-device-threshold` | #13 | Low | read + git history |

---

### 1. Terrain shapes: number keys instead of strings in `levelPieces` (~5x faster, same outlines)
`claude/perf-terrain-shapes` → `claude/game-base` · `src/world/LevelView.ts`, `src/gfx/world.ts`

- **What:** `levelPieces` works out the ground and rock outlines behind the loading screen for each level. It keyed every cell by an `"x,y"` string. It now uses number keys and flat arrays, plus a numeric `traceCellList`. The string `traceCells` is kept for the art page.
- **Evidence:** `t_merge.ts` runs the original HEAD code and the new code on Parts 1–6 and the arena. The outputs are byte-identical. Total time on this machine went from 124.5 to 25.8 ms; a re-run today gave 97.5 to 17.5 ms. The biggest single gain is Part 5, about 58 to 8 ms. Expect several times longer on a phone.
- **Risk:** low. The output is compared exactly.

### 2. Server: only serve files inside `dist`; 400 for a malformed URL
`claude/fix-static-path-traversal` → #1 · `server.mjs`

- **Bug:** the check was `path.startsWith(ROOT)` with `ROOT = …/dist`. A request like `GET /..%2fdist-server/users.mjs` passed it, because `%2f` survives URL normalisation and `decodeURIComponent` turns it into `../`. The server returned 200 with the built accounts and battle server code. Any sibling folder whose name starts with `dist` (`dist-server`, `dist-single`, `dist-art`) was readable this way. Separately, `/%E0%A4%A` made `decodeURIComponent` throw, which gave a 500.
- **Fix:** `path !== ROOT && !path.startsWith(ROOT + sep)` → 403, and a try/catch around the decode → 400.
- **Evidence:** ran `server.mjs` on a throwaway tree. Before: `/..%2fdist-server/…` gave 200. After: 403. The page and assets still return 200, a missing file 404, and a bad escape 400.
- **Risk:** low.

### 3. Accounts: rate-limit logins by the proxy-added address; prune old entries
`claude/fix-login-rate-limit` → #2 · `server/users.ts`

- **Bug:** the limiter keyed on the **first** `X-Forwarded-For` entry, which is whatever the client sends. A different made-up value on each request skipped the 12-per-minute limit, allowing unlimited password guessing. The `attempts` map also gained one entry per made-up address and was never pruned.
- **Fix:** key on the **last** entry, which is the one the proxy appends. Drop entries older than a minute once the map passes 1000.
- **Evidence:** `t_rate.ts`. Before, spoofed requests got `404 ×15`, never limited. After, they get 429.
- **Risk / deployment assumption:** this assumes exactly one proxy in front that appends the client address, which matches the Railway setup (`railway.json`).
  - With **no** proxy, the whole header comes from the client, and `req.socket.remoteAddress` should be used instead.
  - With two proxies (for example a CDN in front of Railway), the last entry is the CDN's address, so users behind the same CDN edge would share one limit.

### 4. Account: save `beaten + 1` as the level
`claude/fix-account-beaten-level` → #3 · `src/core/account.ts`

- **Bug:** the account saved `level: latestLevel()`, which is the furthest **unlocked** level. `merge()` reads the value back as "beaten + 1". Once every built level is beaten (`beaten = 5`), the account stores 5, and a new device restores `beaten = 4`. King Bob then drops out of the Bosses menu (it needs `beaten >= 5`), and a future Part 6 would stay locked. No error is shown.
- **Evidence:** `t_account.ts`. Before: server 5, new device `beaten = 4`. After: server 6, new device `beaten = 5`.
- **Risk:** low.
  - The server accepts 1–99.
  - `merge` takes the larger value, so no one goes backwards.
  - Accounts saved before this fix keep the old value until their next save.

### 5. Battle: a falling rock hurts each bad guy once; dead bad guys leave the same tick
`claude/fix-battle-rock-damage` → #4 · `src/shared/battle/sim.ts`

- **Bug:** `stepHazards` called `hurtEnemy` on **every tick** of overlap. Heroes have `invuln`, but bad guys have nothing like it. A damage-1 rock gave `ehit ehit ehit ehit edie` on consecutive ticks, so any rock killed any bad guy and the 1/2/3 damage values did nothing. Also, `stepHazards` runs after the dead-enemy filter, so a bad guy killed by a rock stayed in `sim.enemies` (and in that tick's snapshot) for one tick. Rockets in that tick could also blow up on it.
- **Fix:** each hazard gets a `hit?: Set<number>` and hurts each bad guy at most once (`firstHit`). Bad guys with `hp > 0` are filtered again at the end of `stepHazards`. `hit` is not sent to clients, because snapshots pack hazards into tuples.
- **Evidence:** `t_rock.ts`. Before: `9:ehit 10:ehit 11:ehit 12:ehit 13:edie`. After: `9:ehit`, and the bad guy survives. `t_dead.ts`: before, `id50 hp0` was still listed on the `edie` tick; after, it isn't.
- **Gameplay note:** rocks now do the damage the code says, so bad guys survive rocks more often. That is a visible balance change. Snapshots are a little bigger because more bad guys are alive (about 1.5 to 1.7 kB). Tick time is unchanged at about 35 µs against a 33 ms budget (`t_tick.ts`).

### 6. Hoops/Fishing: turning the phone back no longer un-pauses the contest under the Paused menu
`claude/fix-boss-rotate-resume` → #5 · `src/ui/ui.ts`

- **Bug:** turning the phone upright during basketball or fishing opens the Paused menu and pauses the scene. Turning it back ran `sc.resume('Hoops'|'Fishing')` but left the menu up. The contest carried on behind "Paused": meters ran and King Bob took his turn.
- **Fix:** the Paused menu gets a `paused` class, and the auto-resume is skipped while it is showing. The freeze-only case still resumes when you turn back: no menu, or another card such as the results.
- **Evidence:** `t_rotate.ts` drives the real `UI` class with a stubbed DOM and game. Before: back on its side, Hoops was `running` under the menu. After: `paused` until Resume. The freeze under another card still resumes.
- **Risk:** low. Nothing in the CSS uses `.paused`.

### 7. Football: a snap whistled dead in the air falls loose
`claude/fix-football-ball-leak` → #6 · `src/entities/Football.ts`

- **Bug:** the snap's flight callback always put the ball in the QB's hand. If the centre (or QB) was knocked down during the 0.22–0.3 s snap, `whistle()` cleared `this.ball`, but the ball was mid-flight. It then landed in the QB's hand as a ball nobody tracked. These balls stay out of the pool until the QB himself is knocked down, because he then drops everything he holds. After four of them, `take()` returns null, and the snaps and throws at you stop.
- **Fix:** hand the ball over only if the play is still on, it is still the play's ball, and the QB is up. Otherwise drop it loose; it fades and goes back to the pool.
- **Evidence:** `t_football.ts`. Before: free balls 3/4, 2/4, 1/4, 0/4, then "no ball left to snap". After: 4/4 every play, and a clean snap still ends in the QB's hands.
- **Risk:** low.

### 8. Plop King: he waits until every Plop of the wave has dropped in
`claude/fix-plop-king-early-return` → #7 · `src/scenes/WrestleScene.ts`

- **Bug:** the minions spawn on staggered `delayedCall`s, 380 ms apart for the small wave and 500 ms for the others. If every Plop that has arrived so far is splatted before the next one drops in, `minions.length === 0` triggers `kingReturn()`. The rest of the wave then drops in with him already back.
- **Fix:** count the spawns still due (`minionsDue`) and return only when it reaches 0 too. The counter is reset in `init`.
- **Evidence:** `t_king.ts` runs `kingAway`/`updateMinions` on a stubbed scene. Before: "first Plop splatted, 4 still to come → King back already? true". After: false; he comes back once, after all 5.
- **How likely:** rare. A Plop is splatted that fast only by a chair swing (or rocket) at the top of a double jump, right as it appears at the top of the screen. For the small wave that probably also needs a corner post. I estimated this from the constants; I did not play it. The fix is small, so it's here, but it is the easiest PR to skip.

### 9. Fishing: a new contest starts with an empty BIGGEST footer and news ticker
`claude/fix-fishing-init-reset` → #8 · `src/scenes/FishingScene.ts`

- **Bug:** Phaser reuses the scene object, and `init()` reset everything except `best` and `news`. After a loss, or "Try again" from the Bosses menu, the scoreboard and ticker showed the last contest's fish.
- **Evidence:** `t_fishing.ts` uses a real `FishingScene`. After `logCatch` then `init`, `best` and `news` were still set before the fix; after it they are `null` and `[]`.
- **Risk:** none. These fields are display-only.

### 10. Confetti: a burst's `colors` are used
`claude/fix-confetti-colors` → #9 · `src/world/SimpleConfetti.ts`

- **Bug:** `particleTint = colors[0]` has no effect on a random-array tint op. Phaser's `onChange` only sets `current`, and `onEmit` still picks at random from all 7 colours. The King's crown confetti asks for gold and white (`HoopsScene.ts:767`).
- **Fix:** `ops.tint.loadConfig({ tint: o.colors })` before the burst and `loadConfig({ tint: COLORS })` after.
- **Evidence:** `t_confetti.ts` runs `SimpleConfetti.burst` with Phaser's own `EmitterOp`. Before: all 7 colours. After: only `#ffd23f #ffffff`, and the next plain burst gets all 7 again.
- **Risk:** low.

### 11. Hockey: a beaten player's stick fades out once
`claude/fix-hockey-stick-tween` → #10 · `src/entities/Hockey.ts`

- **Bug:** `if (s.visible)` stays true until the 400 ms fade ends, so a new tween was added every frame (24 for one stick). Each one also targeted `y + 20` from a lower start.
- **Fix:** `if (s.visible && !this.gs.tweens.isTweening(s))`.
- **Evidence:** `t_hockey.ts` uses a tiny tween manager. Before: 24 tweens. After: 1, and the stick still ends hidden.
- **Risk:** low. If a swing tween is running when the player is beaten, the fade starts once it ends, at most 180 ms later.

### 12. Projectiles remove their SHUTDOWN listener when they're gone
`claude/fix-projectile-shutdown-listeners` → #11 · `enemies/Enemy.ts` (Glob), `enemies/Weapons.ts` (PomPom, ThrownSaw), `enemies/Fish.ts` (FishBubble)

- **Bug:** each projectile registered `events.once(SHUTDOWN, () => this.gone())`, and `gone()` never removed it. One listener, plus the projectile it holds, was left per shot until the scene shut down.
- **Fix:** `once(SHUTDOWN, this.gone, this)` and `off(SHUTDOWN, this.gone, this)` in `gone()`. The context argument makes `off` remove only this projectile's listener, because all of them share the prototype method.
- **Evidence:** `t_listeners.ts` uses real `eventemitter3`. After 50 of each, the SHUTDOWN listener count was 50/100/150/200 before the fix and 0 after. Projectiles still in the air are still cleared when the scene shuts down.
- **Risk:** low.

### 13. Start screen: one `fullscreenchange` listener at a time
`claude/fix-start-fullscreen-listener` → #12 · `src/ui/ui.ts`

- **Bug:** every `showStart()` added a `document` `fullscreenchange` listener and never removed it. Each listener keeps an old start screen alive, including its DOM and three 320×320 hero canvases.
- **Fix:** keep the current handler on the `UI` instance and remove the previous one before adding the new one.
- **Evidence:** `t_fslisten.ts` runs the real `UI.showStart` against a stubbed DOM five times. Before: 5 listeners. After: 1.
- **Risk:** low.

### 14. Slow-device check: under 50 fps tries the lower resolution first
`claude/fix-slow-device-threshold` → #13 · `src/main.ts`

- **Bug:** in `watchSpeed`, lowering the resolution needs `median > 21`, but going light needs `median > 20`. With a median of 20–21 ms (about 47.6–50 fps), the device skipped the resolution step and went straight to light mode, which is saved for good. That contradicts the comment "as low as it goes and still slow". Git history shows the cause: v0.350 lowered the light threshold from 28 to 20 and left the resolution step at 21.
- **Fix:** `median > 20` in the resolution step too.
- **Evidence:** confirmed by reading and by the git history. The check is a closure inside `main.ts` and can't be tested without a browser.
- **Behaviour change:** devices in that 47.6–50 fps band now get a lower resolution first, and go light only if they are still slow.

---

## Round 2 (second pass), stacked on #14

| # | Branch | Base | Severity | Evidence |
|---|---|---|---|---|
| 15 | `claude/fix-battle-rejoin-inputs` | #14 | Medium | `t_rejoin.ts` |
| 16 | `claude/fix-account-progress-max` | #15 | Medium | `t_progress.ts` |
| 17 | `claude/fix-register-race` | #16 | Low | `t_register.ts` |
| 18 | `claude/fix-music-keep` | #17 | Low | `t_music.ts` |

### 15. Battle server: rejoining after a page reload takes your buttons again
`claude/fix-battle-rejoin-inputs` → #14 · `server/battle.ts`

- **Bug:** reloading the page mid-battle (same tab, so same token) gives you your place back. But the new `BattleScene` counts its inputs from 1 again (`this.seq = 0`), and the server still holds the old `lastSeq`. It drops every input with `s <= lastSeq`, so you stand frozen for as long as you had already played, up to the full 2:30.
- **Fix:** on a rejoin `hello`, reset `c.lastSeq = 0` and `c.queue = []`. A plain reconnect, where the scene keeps counting up, is unaffected.
- **Evidence:** `t_rejoin.ts` runs the real `attachBattle` over real WebSockets with `BATTLE_COUNTDOWN=1`. Before: after rejoining, holding left for 3 s left x at 213 → 213. After: 213 → 107.
- **Risk:** low.

### 16. Accounts: a progress save keeps the bigger of each counter
`claude/fix-account-progress-max` → #15 · `server/users.ts`

- **Bug:** `PUT /api/progress` overwrote the account with whatever the device sent. A device that synced earlier (it restored on start-up, then another device moved ahead) saves its lower numbers at the end of its next level, and the account goes back down. Root beer, nuggies, kills and level are lost for any new device, and `spent` drops while the items stay owned, so the Shop items effectively become free. The client merges with "the bigger of each" only on sign-in and start-up.
- **Fix:** `MAX(column, ?)` for rootbeer, nuggies, kills, level and spent in SQLite; `Math.max` in the JSON fallback. All five only ever go up, per the bank comments.
- **Evidence:** `t_progress.ts` uses the real API. The phone saves 100/50/80/level 4/spent 20, then the stale tablet saves 35/9/15/3/0. Before: the account keeps the tablet's values. After: 100/50/80/4/20.
- **Risk:** low. Nothing in the client lowers these on purpose. Note that any future "reset progress" feature would need its own route.

### 17. Accounts: the same name registered twice at once gets "That name is taken"
`claude/fix-register-race` → #16 · `server/users.ts`

- **Bug:** the name check runs before `await hashPassword`, and the insert after it. Two registrations at once (a double tap on "Create", or two kids picking the same name) both pass the check. In SQLite the second hits the UNIQUE constraint and gets a 500 "Server error." In the JSON fallback, with no constraint, it creates a second player with the same name.
- **Fix:** check `byName` again right after the hash and before `create`. There's no `await` in between, so the check is race-free in Node.
- **Evidence:** `t_register.ts`. Before: `201` + `500`. After: `409` + `201`.
- **Risk:** none.

### 18. Music: the song that was playing is freed once it's no longer among the last two
`claude/fix-music-keep` → #17 · `src/core/music.ts`

- **Bug:** `keep()` spares the playing song from eviction but then trims `recent` to 3 entries. A playing song pushed past that drops off the list while still decoded, and nothing frees it until it's played again. A decoded song is 13–21 MB (102–168 s, mono 32 kHz float32).
- **Fix:** trim `recent` to the songs still decoded (`recent.filter((x) => decoded.has(x))`) instead of slicing.
- **Evidence:** `t_music.ts` stubs Web Audio. Start screen song playing → Battle lobby → Bosses menu → Part 2. Before: `decoded: menu, hoops, mountain` for the whole level. After: `hoops, mountain`.
- **Risk:** low. The list never holds more than KEEP + 1.

---

## Round 3 (third pass), stacked on #18

### 19. Battle: a bad guy finished off this tick doesn't shoot or hurt anyone, and leaves the snapshot
`claude/fix-battle-dead-enemies` → #18 · `src/shared/battle/sim.ts`

- **Bug:** rockets explode at the very end of `step()`, after `stepEnemies` has filtered out the dead. A bad guy blown up by a rocket therefore stayed in `sim.enemies` at 0 hp, in the snapshot of the tick it died. The `stepEnemies` loop has no `hp <= 0` check, so on the next tick it moved, fired its blaster, threw poo, and hurt any hero touching it. Bad guys stomped or hit by a chair earlier in the same tick also went through that loop once. PR #5 only covered hazard kills.
- **Fix:** skip `hp <= 0` in the `stepEnemies` loop, and filter `hp > 0` once more at the end of `step()`. That also makes PR #5's extra filter in `stepHazards` redundant but harmless.
- **Evidence:** `t_rocketdead.ts`. A's rocket kills a 1-hp blaster bad guy that is touching B and about to shoot. Before: tick 0 `edie` with `id50 hp0` still listed; tick 1 `eshot, hit b by enemy`, and B goes 3 → 2 hearts from a dead bad guy. After: gone at tick 0, no shot, B keeps 3 hearts. `t_rock`, `t_dead` and `t_tick` are unchanged.
- **Risk:** low. The client draws deaths from the `edie` event, the same way it does for PR #5.

---

## Rounds 4 and 5 (fourth and fifth passes), stacked on #19

### 20. Battle lobby: one connection however many times "Let's go" is pressed
`claude/fix-battle-double-open` → #19 · `src/ui/battleUi.ts`

- **Bug:** `BattleUI.open()` made a new `BattleNet` without closing an existing one. The first time you open Battle, the battle art is drawn behind a loading card. That card blocks taps, but not the keyboard, so pressing Enter again (or holding it) in the room-code box queues a second `open()`. The two connections come from the same tab, so they share its rejoin token. Each `hello` takes the place from the other, and the kicked one reconnects after 0.4 s. They knock each other off forever, and the lobby keeps flipping to "Lost the connection — reconnecting…".
- **Fix:** close any existing connection (and the HUD listener) before making the new one.
- **Evidence:**
  - `t_twonets.ts`: two real `BattleNet`s with one token against the real server. 23 and 22 status changes in 6 s (`online offline connecting online …`), never settling.
  - `t_openTwice.ts`: the real `BattleUI.open()` called twice. Before: 2 live connections. After: 1.
- **Risk:** low. `retry()` and `changeRoom()` already close first; closing twice is a no-op.
- **Severity:** Low, because only a keyboard can trigger it.

### 21. Battle: Escape after a battle ended under its Paused menu no longer closes the results card
`claude/fix-battle-pause-key` → #20 · `src/ui/battleUi.ts`

- **Bug:** the in-battle Paused menu's Escape/P handler stays on `window` when the battle ends under it (the results card replaces the menu). Pressing Escape or P then runs `close()`, which calls `setScreen(null)` while `inBattle` is still true. The results card disappears for the rest of the results time.
- **Fix:** the handler removes itself once its menu is no longer on screen (`!el.isConnected`), as the other modals' key handlers do.
- **Evidence:** confirmed by reading. The DOM stub used in the tests can't model `isConnected`.
- **Risk:** none. Keyboard only, so Low.

### 22. Part 5: King Bob's contest song is decoded ahead like the other bosses'
`claude/fix-fishing-boss-song-preload` → #21 · `src/scenes/GameScene.ts`

- **Bug:** two-thirds of the way through a level, the boss song (`hoops`) is decoded ahead so the boss intro starts with music. The check covered `wrestle` and `hoops` levels, but Part 5 (`fishing`) also plays that song as King Bob's contest starts (`FishingScene.run()` → `playHoops()`). So in Part 5 the song was fetched and decoded only then, and the intro started silent for as long as that takes on the device. The Bosses menu path preloads it, so only the normal run through Part 5 was affected.
- **Fix:** add `|| levelInfo(this.levelId).fishing`.
- **Evidence:** confirmed by reading. Every other caller of `playHoops()` (Hoops, Wrestle) gets the preload.
- **Risk:** none. It's the same 13–17 MB decode the other boss levels already do.

---

## Rounds 6 and 7 (sixth and seventh passes), stacked on #22

### 23. Fishing and Hoops: taps while the contest is paused or frozen don't count
`claude/fix-fishing-bite-paused` → #22 · `src/scenes/FishingScene.ts`, `src/scenes/HoopsScene.ts` (two commits)

- **Bug (Fishing):** BITE! is judged by a window-level pointer listener from the button's position on screen. When the game is paused while BITE! is up (the Paused menu, the phone turned upright, the app put aside), the contest clock stops and the button stays live. A tap on the Paused menu over that spot, such as Resume, caught the fish.
- **Bug (Hoops):** the tap listener skipped `.hud`/`.screen` taps, but not the "turn your phone" prompt (`.rotate`) shown while the court is frozen. A tap on it was saved in `tapped` and locked the power/aim meter the moment the phone was turned back, wasting the shot.
- **Fix:** both listeners return early unless the scene is running (`this.sys.isActive()`).
- **Evidence:** `t_bitepause.ts` and `t_hoopspause.ts` use the real scene classes. Before: `caught? true` and `press saved? true` while paused. After: false. Taps while playing still count.
- **Risk:** low. The Hoops intro already ignored taps.

### 24. Parachute drops: a Plop let go off screen takes its blaster with it
`claude/fix-drop-plop-weapon` → #23 · `src/scenes/GameScene.ts`

- **Bug:** drop Plops that float well off screen are removed with `e.destroy()`, and 75% of them carry a blaster. Destroying the sprite doesn't remove the `Weapon`'s own images, and the dead Plop isn't updated any more, so its blaster stayed frozen in mid-air. Fast Plops are let go 700 px *below* the view, right where you're floating down to, so you could pass a blaster hanging in the drop shaft. It also leaked those images until the level ended.
- **Fix:** `e.kill('fall')`. Its weapon falls and fades (`Weapon.drop()`), the Plop is destroyed with no effects, and it doesn't count as a kill.
- **Evidence:** confirmed by reading. This is the only direct `destroy()` of a level bad guy; every other removal goes through `kill()`.
- **Risk:** low.

---

## Performance passes, stacked on #24

### 25. Music: stereo songs mixed down to mono in one pass
`claude/perf-music-mixdown` → #24 · `src/core/music.ts`

- **What:** each decoded song (all six are stereo) is mixed to mono to halve its memory. That was done one channel at a time (`o[i] += d[i] / n`), with two passes and a `setTimeout` yield every 262,144 samples per channel. Now, for two channels, both go in one pass: `o[i] = Math.fround(a[i] / 2) + b[i] / 2`. That is exactly the float32 value the two-step loop stored, because the first half is rounded to float32 just as the old loop did when it stored it. The loop for other channel counts is kept as it was.
- **Evidence:**
  - `tests/p_mix.ts` (node): 4.8 M random samples, including thousands of denormals, are identical, and the new version is about 3× faster.
  - `tests/browser/mix.mjs` (Chrome) decodes the game's six real songs exactly as `music.ts` does. **0 differing samples** on every song.
  - Timings at 4× CPU, old → new: battle 231 → 86 ms; start screen 120 → 64 ms; hoops 157 → 76 ms; level-clear 167 → 114 ms; mountain 308 → 179 ms; plop 316 → 171 ms.
- **Where it matters:** the start screen's song is decoded at every load. Level and boss songs are decoded ahead in slices during play, and those slices are now cheaper and half as many.
- **Risk:** none. The output is bit-identical, and the slicing and the all-at-once mode under the loading screen are unchanged.

---

## Memory pass, stacked on #25

### 27. Memory: pictures shown only as images let their canvas pixels go once uploaded
`claude/mem-release-static-canvases` → #25 · `src/gfx/textures.ts`

- **What:** 45 small static pictures kept a full copy of their pixels in the browser's memory after being uploaded to the graphics chip: props, particles, the weapons, the chase signs, the tennis net, the sea's bubble and dark, the baseballs. They now let it go with `addCanvas(..., { release: true })`, as the frame sheets and backgrounds (57 other places) already did. WebGL draws from the uploaded copy. Not changed:
  - tile sprites (`chase-col`, the fishing wave), which need their pixels;
  - live pictures that get redrawn (clouds, jumbotron, ribbon board);
  - the chair sheets that are read back;
  - the invisible collision `tiles`.
- **Evidence** (`tests/browser/memcensus.mjs`, pixel ratio 2): held canvas pixels go 4.3 → 2.7 MB at the start screen, 4.5 → 2.8 in Part 2, 4.5 → 2.8 in Part 5, 5.4 → 3.9 in basketball. Texture memory is unchanged.
- **Unchanged output:** `tests/browser/propshot.mjs` draws all 29 of these pictures that exist at the start screen through the game's WebGL renderer, and the screenshot hash is identical before and after. Sweeps of Parts 1–6 and four bosses show no errors.
- **Risk:** low. Releasing only happens with WebGL (the canvas renderer keeps its pixels). A lost graphics context reloads the page (`main.ts`), as for the 57 existing releases.
