# Making a level from our design assets

Levels are written as code with a small builder (`src/level/builder.ts`). You describe the ground,
platforms and what stands where, in **tiles** (1 tile = 32 px), and the game draws all of it in the
hand-drawn style from `src/gfx/` (terrain, trees, clouds, bad guys, items). No image files needed.

Read `src/level/level1.ts` (flat-ish, 330 × 16) and `src/level/level2.ts` (an uphill climb, 330 × 62)
side by side with this guide: they use every piece.

## 1. Coordinates

- `x` = tile column from the left (0 … width-1). Fractions are fine for floating things and trees.
- Heights `h` are counted **from the bottom** of the level: `h = 3` means ground 3 tiles tall (the usual floor).
- A thing "standing on ground of height h" is placed with that same `h` (`spawn('puffball', 18, 3)`).
- Jump reach, for spacing: walk-jump ≈ 3.4 tiles across / 3.3 up; run-jump ≈ 7+ across / 3.8 up;
  the mid-air second jump adds about half a jump. Keep gaps you *mean* to be hard at 6–7 tiles (running).

## 2. The pieces

| Call | What you get (the art) |
|---|---|
| `L.ground(x0, x1, h)` | Grassy ground, columns x0..x1, h tiles tall. Steps up/down by changing h. |
| `L.pit(x0, x1)` | A bottomless gap (clears whole columns). Falling in costs a life. |
| `L.island(x0, x1, h, thick = 2)` | A floating grassy island with hanging roots, top at height h. |
| `L.cloud(x0, len, h)` | A fluffy jump-through cloud platform (you can jump up through it). |
| `L.rock(x0, x1, h0, h1)` | A rock ledge or pillar from height h0 to h1. |
| `L.boulders(x0, x1, h0, h1)` | A wall of puff boulders: blast through with the bazooka. |
| `L.brambles(x0, len, h)` | Thorny brambles (they hurt) sitting on ground of height h. |
| `L.aura(x, h)` / `L.auraArc(x0, n, h, rise)` | Nuggie spots (each play only some get a nuggie). |
| `L.rootbeer(x, h)` | A rare root beer bottle (banked for a future shop); put them in tricky spots. |
| `L.zone(x0, x1, pal)` | Use a different terrain palette for those columns (see 4). |
| `L.spawn(type, x, h, opts?)` | Everything else (table below). |

`spawn` types:

| type | Notes / options |
|---|---|
| `'player'` | Where the hero starts (one per level). |
| `'tree'` | A puff tree. `{ h: 52..70 }` = height in px. In snowy zones it's a pine. |
| `'puffball'` | Small Puff Ball (walks, some carry weapons). |
| `'bigpuff'` | Big Puff Ball (tougher, jumps). |
| `'giant'` | A Giant (slams down, fire shockwaves). We put one before each checkpoint. |
| `'goat'` | Mountain goat (spits). |
| `'checkpoint'` | The checkpoint flower. Fainting restarts at the last one reached. |
| `'goal'` | The Puff Gate at the end: reaching it starts the basketball finale. |
| `'para'` | A bad guy parachuting in when you get near. `{ kind: 'puffball' \| 'bigpuff' }` |
| `'soccer'` | A soccer ambush. `{ w: pitch width in tiles, team: 'pppp' (p = Puff Ball, b = Big), big: true for the big ball, goals: false to hide goals, wait: seconds before kicking }` |
| `'hockey'` | A hockey ambush on ice. `{ w: rink width, team: 'pppb' }` |

## 3. A worked example

```ts
// src/level/level3.ts
import { LevelBuilder, type LevelData } from './builder';

/** World 1 · Part 3: "Candy Cloud Canyon" (example). */
export function buildLevel3(): LevelData {
  const L = new LevelBuilder('Puff Ball Planet · Part 3', 'World 1', 200, 20);

  // ── start meadow ──
  L.ground(0, 30, 3);
  L.spawn('player', 4, 3);
  L.spawn('tree', 2, 3, { h: 60 });
  L.auraArc(10, 3, 6, 1);
  L.spawn('puffball', 16, 3);
  L.ground(22, 30, 5);             // a step up
  L.spawn('bigpuff', 27, 5);

  // ── a canyon of clouds (running jumps) ──
  L.pit(31, 60);
  L.cloud(33, 3, 6);
  L.cloud(39, 3, 8);
  L.island(45, 50, 9);
  L.spawn('para', 47, 9, { kind: 'puffball' });
  L.rootbeer(47.5, 13);           // up high: needs the second jump
  L.cloud(54, 3, 7);

  // ── Giant + checkpoint ──
  L.ground(61, 90, 3);
  L.boulders(66, 67, 4, 7);
  L.spawn('giant', 76, 3);
  L.spawn('checkpoint', 86, 3);

  // ── soccer ambush, then the gate ──
  L.ground(91, 199, 3);
  L.spawn('soccer', 120, 3, { w: 16, team: 'ppp' });
  L.brambles(150, 3, 3);
  L.spawn('goal', 194, 3);
  return L.build();
}
```

## 4. Looks (colours) and zones

- **Terrain palettes** live in `src/gfx/world.ts` (`PALETTES`: `puff`, `meadow`, `candy`, `golden`) and
  `src/gfx/mountain.ts` (`z-snow`, `z-valley`, `z-ice`, plus the mountain looks). A palette sets sky, hills,
  soil, grass, rock, tree canopies, flowers. Add a new one by copying an entry and changing colours.
- `L.zone(x0, x1, 'z-snow')` paints those columns' ground with that palette (Part 2 uses this for
  green valleys → snowy rock → frozen pond).
- **Looks cycle over time** (30 s each, crossfading): `src/world/theme.ts`. `themesFor(level)` picks the list
  per level: Part 2 uses `MOUNTAIN_THEMES`, everything else the Part 1 list. A new level with its own mood
  needs its own list there (and a `TINT` entry per look). Background layers for a look are drawn by
  `ensureLook()` in `gfx/textures.ts` (boot draws the known ones; add new look ids to `textureSteps`).

## 5. Register the level

1. Add it to `LEVELS` in `src/level/levels.ts`:
   `{ id: 3, world: 'World 1', title: 'Puff Ball Planet', part: 'Part 3', build: buildLevel3 }`.
   The start screen's Part picker shows it once the previous level is beaten (`progress.beaten`).
2. Places that currently say "level 2 is special" and may want a case for the new level:
   - `src/core/music.ts` `levelTrack()`: which song plays (add a new `.m4a`, AAC, to `src/assets/`).
   - `src/world/theme.ts` `themesFor()`: which looks cycle.
   - `src/world/Ambience.ts` (`arctic`): birds/butterflies vs arctic birds.
   - `src/scenes/GameScene.ts` (`UPHILL_TILT`): the slight camera tilt for uphill levels.
   - `src/scenes/HoopsScene.ts` (`level === 2` → the Summit Dome): which basketball arena ends the level.
   - `src/scenes/MenuScene.ts` `startX()`: where the start-screen fly-over begins for that level.
3. Check it: `npx tsc --noEmit -p .`, then play it (`npm run build && PORT=8091 node server.mjs`, beat or
   set `localStorage.setItem('puffy.beaten', '2')` in the browser console to unlock the picker).
   Watch for: every jump possible for the slowest hero (Big Muscles), no spot where you get stuck,
   a checkpoint after each hard section, nuggies before the Giants.

## 6. New art for a level

- Everything is canvas drawing code in `src/gfx/` using the shared hand-drawn style
  (`STYLES.polished` from `gfx/handdrawn.ts`: wobbly ink outlines, soft shading, a highlight). Copy the
  pattern of an existing drawing (e.g. `drawPuffTree` in `gfx/world.ts`, the goat in `gfx/goat.ts`).
- Start from the owner's sketch (put it in `sketches/`), match its proportions and personality, and show
  it on the art page (`src/artpage/main.ts`) so the owner can review it next to the others.
- Turn it into a game texture in `gfx/textures.ts` (look at `makeItems` / `makeBaddies`), keeping canvases
  small (iPhone memory). New bad guys go in `src/entities/enemies/` + `createEnemy`.
