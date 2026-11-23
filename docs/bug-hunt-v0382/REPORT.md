# Puffy bug hunt on v0.382: what's new since v0.361, and one more round (bugs and performance)

**Code:** `claude/game-base` at `0bd098d` (v0.382), pulled fresh. That is 70 commits and about 11k lines since v0.361. `tsc --noEmit` and `tsc --noEmit -p tsconfig.server.json` pass, and so do `vite build` and `build:server`.

This is for reference, like the earlier reports. It's on its own branch so it isn't merged into the game.

## Result
| PR | Branch | Base | Severity | What |
|---|---|---|---|---|
| #32 | `claude/fix-boss6-replay` | `claude/game-base` (`0bd098d`) | Medium (testers only today) | After Boss 6's ending, the next fishing contest in the same session has no hero on the boat and no rods or lines |

### #32: after Boss 6's ending, the next contest has its hero and rods again
`src/scenes/FishingScene.ts` (+6 lines in `init()`)

- **Bug:** Boss 6's ending (rock, paper, scissors, then the spout that launches you into the sky) sets `heroFree`, `rodsDown` and `freeCam`, and nothing sets them back. "Play again" on the results card, or Boss 5 next from the Bosses menu, starts the same `FishingScene` object again; `init()` resets the contest but not these. So the whole next contest:
  - never puts the hero on the boat (`placeBoat` returns early, leaving the sprite at 0,0);
  - draws no rods and no lines (`drawRods` returns at once), so the bobber floats out on nothing;
  - lets the camera ignore the world's edges.

  It's the same class of bug as #29 and #30 (state a scene keeps when it's started again). It came in with the new Boss 6 fields.
- **Fix:** reset `heroFree`, `rodsDown`, `freeCam` (and `kingRps`) in `init()`, to their field defaults.
- **Evidence:**
  - `tests/t_boss6again.ts` (node, the real scene class and its real `drawRods()`). On v0.382, after the Boss 6 ending's state, the next contest (Boss 6 or Boss 5) still has `heroFree true`, `rodsDown true` and `freeCam true`, and `drawRods` draws **nothing**. Fixed: all false, and 204 drawing calls.
  - `tests/browser/boss6again.mjs` plays a real Boss 6 to the win (a perfect tap on every BITE!), sits through its ending, then presses Play again. On v0.382 the second contest's first cast shows hero `{x: 0, y: 0}`, no rod and no line (`shots/boss6-again.png`, left). Fixed: hero `{x: 1080, y: 356}` on the boat, and the line out to the bobber (right).
- **Severity:** Medium. A wrong result with no error that ruins a whole contest; only testers can reach Boss 6 today, but everyone will once Part 6 ships.
- **Risk:** none. These are the fields' own defaults, and the ending sets them again when it runs.

## Evaluated: the new code since v0.361
- **Earlier findings:**
  - #29 and #30 shipped in v0.364 and are in place.
  - The two suspicions from last round were fixed upstream: the failing art step (v0.365, `runSafely`) and the stinger race (a guard in `GameScene`).
  - Gamepad Y doing fire and bomb isn't a bug, as the review said.
- **Read:**
  - **Server:** the device-check API (`POST/GET /api/bench`). It has a separate rate limit (6 a minute), a 32 KB cap, the name and verdict checked, the newest 500 kept, and listing for testers only.
  - **Light-mode choice:** `lightPick`, the quick bench, and the order in `entry.ts` (measured before `main` and `light.ts` load, so `LIGHT` sees the result).
  - **Drawing fixes:** `screenClear`, `dynamicTextureFix`, `fadeFix`, `coverSkip` (the Shop stops drawing under it), the `artLoader` changes, and the stinger guard.
  - **Input:** gamepad polling once a second until a pad shows up.
  - **UI:** the Shop cover, the home-art loading card, and the Bosses menu with Boss 6.
  - **Battle:** the lobby pre-drawing the arena and the heroes (`warmLater`, `watchLater`), and `BattleScene`'s soft shapes and sheet jobs.
  - **Levels:** `GameScene`'s stills culling, field art and puddles; the Background's ground cover.
  - **Boss 6:** `Storm.ts`, and the Boss 6 flow in `FishingScene` (its fields checked against `init()` and `create()`: that's #32).
- **Browser sweeps on v0.382, all with no errors:**
  - Parts 1–6 with a bot, in full and light mode;
  - all six bosses from the Bosses menu in full mode (Boss 6 on a dev device), and three in light mode;
  - the Shop, Battle lobby, Bosses and Account screens;
  - a 3-player battle with a reload and rejoin.

  Frame medians are now 16.7 ms at 1× (the display's rate), against about 24 ms on v0.361 in the same setup.

## Performance (this round): measured, nothing to change
- **Boss 6 at 4× CPU** (`bossprof.mjs 6`): the main thread is 65% idle, with a median frame of 29.8 ms and p90 of 63.6 ms. No game function is over 0.8% (the top one is Phaser's `finalizeTextureCount`; the scene's own `clearOfBoard` and `drawRods` are 0.5% and 0.4%). The storm is already built as one tile per layer and small sprite pools, so frames are graphics work.
- **Parts 1–6:** frames at the display's rate at 1×. JavaScript isn't where the time goes. No change proposed.

## Noted, not fixed (low, or not shown)
- **Thunder:** `sfx.thunder` plays a 1.8 s rumble from the 1 s noise buffer without looping, so the last 0.8 s are silent. By then the gain is already about 40 dB down, so it can't be heard.
- **On the way home from a boss** (light mode, or when the start screen's look isn't drawn): during the new home-art loading card, Escape or P (or the app going to the background) can open the Paused menu over the card. The boss is still the game's scene, and no screen is up. Resume would run the boss behind the card until it's stopped. Read only, not reproduced.
- **`bench.ts` `makeRig`:** if the shaders fail to link, it returns without `loseContext()`, so one WebGL context is left until it's collected. That path is rare.
- **`/api/bench` listing** is by tester name (`neil`, `founder`). If one of those names isn't registered, anyone could register it and read the stored reports: names, scores and user agents. It's worth making sure both are taken.
