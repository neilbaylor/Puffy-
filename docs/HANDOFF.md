# Puffy: hand-off guide

Everything a new Claude Code session (or person) needs to pick this project up.

## What it is

A 2D side-scrolling platformer for the browser, made for phones in landscape (also tablets and desktop).
Pick one of three heroes (Puffy, Scruffy, Big Muscles), run right, jump, and blast bad guys with a
bazooka. There are two story levels and a basketball finale against King Puff Ball, plus an **online
Battle mode** for up to 4 players.

- **Engine:** Phaser 3.90 (WebGL, Canvas fallback), TypeScript, Vite.
- **All art is drawn in code** (canvas paths in a hand-drawn style) from the owner's sketches in `sketches/`.
  There are no sprite image files; textures are generated at boot.
- **Music:** five `.m4a` files in `src/assets/` (AAC: iPhones can't decode Opus through Web Audio), played through Web Audio.
- **Server:** `server.mjs` serves the built game and hosts the Battle WebSocket at `/battle?room=<code>`.

## Branches and deploying

| Branch | Use |
|---|---|
| `claude/game-base` | **Railway deploys this branch.** Everything shipped lands here. |
| `claude/battle`, `claude/next-round` | Kept equal to `game-base` (older working branches). |
| `claude/handoff` | This hand-off: docs + test scripts. |

**Shipping a change ("a round"):**

```bash
npx tsc --noEmit -p .                      # type check
git commit -am "<what a player would notice>"
# bump the version shown on the start screen (bottom-left)
sed -i "s/VERSION = '0.83'/VERSION = '0.84'/" src/version.ts
npm run build:single && cp dist-single/index.html sketches/puffy-game.html   # one-page copy of the game
npm run build                              # dist/ + dist-server/battle.mjs (also type-checks the server)
git add src/version.ts sketches/puffy-game.html && git commit -m "v0.84: <short summary>"
git push origin HEAD:claude/game-base
```

Railway redeploys a minute or two after the push. The owner checks the version number on the start
screen to know the new build is live. Every shipped round gets its own version (+0.01).

## Running it locally

```bash
npm install
npm run dev                         # Vite dev server (single player only)
npm run build && PORT=8091 node server.mjs   # the real thing: game + Battle server on :8091
```

`server.mjs` reads `dist/index.html` once at start, so **restart the server after every build**
(otherwise the page asks for old file names and nothing loads).

Battle test switches (environment variables for `server.mjs`):

- `BATTLE_DEMO=1`: puts some armed bad guys (and fire power) into each battle.
- `BATTLE_DEMO=prizes`: also lines up all 5 bonuses, two falling, a heart on the floor, a big boulder and anvil.
- `BATTLE_DEMO=buttons`: player 1 gets bombs and fire power (to look at the buttons).

## Project layout

```
src/
  main.ts                 Phaser game setup (canvas at device pixels, 60 fps pacing)
  version.ts              the version shown on the start screen
  config.ts               tile size (32), view height, depths
  data/characters.ts      the 3 heroes: speeds, jump, fire rate (Puffy 0.38 s, Big Muscles 0.51 s)
  level/                  builder.ts (the level DSL), level1.ts, level2.ts, levels.ts (the list), tiles.ts
  scenes/
    BootScene.ts          loading screen: draws all textures, warms the start screen, then fades in
    MenuScene.ts          the drone fly-over behind the start screen
    GameScene.ts          the platformer (spawns, players, enemies, checkpoints, camera)
    HoopsScene.ts         basketball finale vs King Puff Ball (jumbotron, free throws)
    BattleScene.ts        online battle client (prediction, interpolation, all battle visuals)
  entities/               Player, Rocket, Pickups, Soccer, Hockey, enemies/ (Puff Balls, Giants, goats, weapons)
  gfx/                    ALL the art, as canvas drawing code (see "Design assets" below)
  world/                  LevelView (terrain), Background (parallax), Ambience (birds etc.), Fx, theme.ts (looks)
  ui/                     DOM screens: ui.ts (start/pause/results/HUD), battleUi.ts (room code, lobby, battle HUD), style.css
  input/                  keyboard / gamepad / touch → one InputSource interface
  core/                   music.ts (Web Audio songs), sfx.ts (synth sound effects), lives, session
  net/battleNet.ts        Battle WebSocket client
  shared/battle/          sim.ts (THE battle rules, run on the server), arena.ts, protocol.ts (shared client/server)
  artpage/                the art review page (every asset + looks)
server/battle.ts          Battle rooms, lobby, countdown, snapshots (bundled to dist-server/battle.mjs)
server.mjs                static server + mounts the battle server
sketches/                 the owner's sketches (jpg), concept pages, puffy-game.html (one-page build)
scripts/build_pages.py    builds sketches/art.html (+ puffy-game.html fragment) for sharing
scripts/qa/               test scripts (see below)
```

## The main game in brief

- Phones: a left-thumb stick (drag far = run, stamina limited) and JUMP / FIRE buttons. Keyboard and gamepads work too.
- 4 lives per run; fainting returns you to the last checkpoint (with 1 nuggie). Nuggies (aura) absorb a hit.
- Each level cycles through "looks" (colour moods) every 30 s (`world/theme.ts`).
- Part 1 ends at the Puff Gate, then basketball vs the King; Part 2 is a mountain climb ending in a harder rematch.
- Beating a level unlocks picking Part 1 / Part 2 on the start screen (`localStorage puffy.beaten`).

## Battle mode in brief

- Start screen → **Battle** → room code window (default `birchcliff`, remembered in `localStorage puffy.room`,
  max 12 lowercase letters/digits) → lobby (4 squares in Orange / Purple / Red / Green; more people watch).
- The match starts 25 s after 2+ players are in; lasts 150 s (2½ min, its own song sped up a hair to end on 0).
- **The server is the referee:** `shared/battle/sim.ts` runs at 30 Hz on the server. The client predicts your own
  hero with the same `stepMove` and corrects to snapshots; everyone else is shown slightly in the past (interpolated).
- Rules: 3 hearts, stomping someone is a hit, being KO'd by a bad guy or the sky costs a point (never below 0).
- Bad guys: Puff Balls and Plops (poo throwers; 1 in 3 carry a blaster, chainsaw or ball-and-chain). They parachute
  or walk in and can jump (and hop in mid-air) to reach every upper cloud.
- Sky drops: rocks and anvils (1 in 3 big), falling slowly with a shadow showing where. When they land, the ground shakes.
- Bonuses (one every 7–12 s, at most 2, gone 7 s after landing): heart, bombs (3, on their own button / Enter / B),
  invincible (14 s), rapid fire, grow (1.8×, bigger rockets too).
- Camera: 20% closer than the whole arena, gently following you; pointers at the screen edge show off-screen players.

## Testing

There are no unit test frameworks; we check by building, by a rules simulation, and by driving a real browser.

1. **Type check + build:** `npx tsc --noEmit -p .` and `npm run build`.
2. **Battle rules:** `scripts/qa/simtest.ts` and `scripts/qa/climb.ts` run the battle sim with no browser:
   ```bash
   npx esbuild scripts/qa/simtest.ts --bundle --platform=node --outfile=/tmp/simtest.js && node /tmp/simtest.js
   npx esbuild scripts/qa/climb.ts --bundle --platform=node --outfile=/tmp/climb.js && node /tmp/climb.js
   ```
   simtest prints PASS/FAIL lines (stomps, KOs, bonus life, 2½-minute match limits); climb shows how long each
   bad-guy size takes to reach each high platform.
3. **In a browser:** Chromium + Playwright are installed in the cloud container (`require('playwright')`, launch
   with `args: ['--use-gl=swiftshader']`). See `scripts/qa/battle-shot.cjs` (a bot joins, you take screenshots
   of a battle) and `scripts/qa/slow-phone.cjs` (CPU slowed 4×: how long until the start screen, first-tap delay,
   freezes). The headless browser renders slowly (software graphics), so short effects are hard to catch on
   screenshots; log values per frame instead (see SESSION_NOTES for tricks).
4. Tests that join a battle use a bot over `ws://localhost:8091/battle?room=...` sending `{t:'hello',...}` and
   `{t:'in', s, b}` inputs every 33 ms.

## Design assets

- `sketches/*.jpg`: the owner's hand drawings: Puffy (2), Scruffy, Big Muscles (+ hurt), the bad guys (2),
  the Giant, King Puff Ball, the goat, the meters. **The in-game art is drawn to match these.**
- `sketches/world-sketches.html`, `look-development.html`: early concept pages for the world and styles.
- `sketches/art.html`: the art review page (every hero, bad guy, item and look). Rebuild with
  `npx esbuild src/artpage/main.ts --bundle --format=iife --outfile=dist-art/art.js && python3 scripts/build_pages.py`.
- The art code, by file:
  - `gfx/puffy.ts`, `scruffy.ts`, `muscles.ts`: the heroes (`draw.ts` builds their animation frames).
  - `gfx/baddies.ts`: Puff Balls, Big Puff Balls, Giants. `goat.ts`, `plops.ts`, `hoops.ts` (King + palace).
  - `gfx/world.ts`: terrain pieces + **world palettes** (looks); `mountain.ts`: Part 2 palettes, pines, zones.
  - `gfx/collectibles.ts` (nuggies, root beer), `weapons.ts`, `bazooka.ts`, `prizes.ts` (battle bonuses),
    `hazards.ts` (rocks, anvils), `parachute.ts`, `soccer.ts`/`pitch.ts`, `hockey.ts`/`rink.ts`, `flame.ts`, `boom.ts`.
  - `gfx/handdrawn.ts`: the hand-drawn line style everything uses (`STYLES.polished`).
  - `gfx/textures.ts`: turns the drawings into Phaser textures at boot (`textureSteps`).

To make a new level from these, read `docs/MAKING_A_LEVEL.md`.

## Gotchas (learned the hard way)

- **iPhone memory:** big canvases crash Safari. Backgrounds are rows of images (not huge TileSprites); textures
  that are only drawn once are released (`addCanvas(..., { release: true })`). Be careful adding big art.
- **iPhone audio:** Web Audio can't decode Opus-in-MP4 there: encode music as AAC `.m4a`. Music must start from a tap.
- Text in Phaser needs `.setResolution(2+)` to be sharp; the canvas runs at device pixels.
- Killing the local server from the same shell command as other work can kill the shell (exit 144): run
  `pkill -f "node server.mjs"` as its own command.
