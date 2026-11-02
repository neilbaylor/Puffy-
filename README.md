# Puffy (working title)

A 2D side-scrolling platformer for the browser, designed mainly for phones (landscape).
Pick one of 3 heroes, run right, jump, and blast enemies with a bazooka. 1 to 3 players.

Built with [Phaser 3](https://phaser.io) (WebGL with Canvas fallback) + TypeScript + Vite.
All art and sound are generated in code as placeholders until the real character sketches arrive.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm run build        # production build -> dist/
npm run build:single # one self-contained HTML file -> dist-single/index.html
```

## Play it on your phone or tablet (Railway)

The repo is ready for [Railway](https://railway.com): `railway.json` tells it to run
`npm run build` and then `npm start` (a tiny built-in web server, `server.mjs`).

1. In Railway, open the service that uses this repo.
2. **Settings → Source**: set the branch to `claude/game-base` (or whichever branch you merge into).
3. **Settings → Networking → Generate Domain** to get a public `https://….up.railway.app` link.
4. Open that link on the phone or tablet.

Railway redeploys automatically on every push to that branch, so each saved (pushed) change goes live
a minute or two later. The start screen shows the build number (bottom-left, e.g. `v0.01`); it goes up
by 0.01 with every deploy (`src/version.ts`), so you can tell at a glance whether the new build is live.

Full screen (no address bar): the game asks the browser for full screen on the first tap.
- **Android** (Chrome etc.) and **iPad** (Safari): works in the browser itself.
- **iPhone:** Apple doesn't let any iPhone browser make a web page full screen (only videos). The game
  still fills the screen edge to edge in landscape; the manifest is there if anyone wants to add it to
  their home screen, but the game doesn't ask.

## Controls

| | Phone (touch) | Keyboard A | Keyboard B | Keyboard C | Gamepad |
|---|---|---|---|---|---|
| Walk | Drag left thumb | A / D | ← / → | J / L | Stick / D-pad |
| Run | Drag left thumb far | Shift | . | U | B / RT / full tilt |
| Jump | JUMP button | W / Space | ↑ | I | A |
| Fire | FIRE button (hold for auto-fire) | F | / | O | X |

Pause: pause button, Esc or P.

## Project layout

```
src/
  config.ts              global tuning (tile size, view height, gravity)
  data/characters.ts     the 3 heroes and their stats
  level/builder.ts       tiny level-authoring DSL (ground, pits, blocks, enemies...)
  level/level1.ts        Level 1 "Sunny Hills"
  gfx/draw.ts            placeholder hero drawing (shared by game + menus)
  gfx/textures.ts        all placeholder textures + the world THEME colors
  entities/              Player, Rocket, enemies, pickups
  world/                 tilemap view, parallax background, particle FX
  scenes/                Boot -> Menu (title/lobby backdrop) -> Game
  input/                 keyboard / gamepad / touch sources (InputSource interface)
  ui/                    DOM menus, HUD, touch controls, styles
  sketches/              world concept sketches page
```

## Design notes

- **Co-op camera:** the camera frames the whole group; screen edges hold players together.
- **Lives:** 4 tries per run. The HUD heart counts the spare ones (3 → 0); fainting restarts at the last
  checkpoint, and fainting at 0 (or losing to King Puff Ball at 0) is game over: back to the start of the level.
- **Second jump:** press jump again in mid air for a smaller hop (about half a jump). Stomping gives it back.
- **Looks drift while you play:** Puff Ball Planet → Meadow morning → Candy clouds → Golden hour → back,
  each held 35 s then cross-faded over 17 s (`src/world/theme.ts`).
- **Aura:** eat floating nuggies for aura; a hit with aura costs your aura instead of a life.
- **Music:** `Level_Clear` loops during play (it keeps going through checkpoint restarts); `Hoops_Arcade` plays in the palace.
- **Online-ready input:** every player is driven by an `InputSource` returning 5 booleans
  (`packInput` squeezes that into one byte), so network players can plug in later.
