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

## Where things stand (v0.85)

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
  It draws the looks for both levels (so switching Part 1 / Part 2 on the start screen is instant).
- v0.85: the start screen opens on the furthest level you've unlocked (`latestLevel()` in `levels.ts`); no
  automatic full screen (the owner only wants the button, or installing the game); the start screen's song
  tries to start without a tap (works where the browser allows it, e.g. Chrome with the game installed;
  iPhones always need a first tap).

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
- Rocks and anvils fall slowly (max 340 px/s) and shake the ground a little when they land (as do big
  bad guys landing from jumps).
- Plops: a four-step walk per size (small hop, medium waddle, big stomp), weapons held at the grip.

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
