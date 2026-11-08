# Golf (working title)

A realistic 3D golf game for the browser, phones first. Separate from Puffy; it lives in `golf/` for now
and can move to its own repo once there is real code.

## Concepts

- `concepts/swing-hud.html`: playable swing pad on a 2D stand-in range, three HUD looks
  (A Broadcast, B Clubhouse, C Y2K Pro Tour), swing-mode rules and swing scoring. It is a page fragment
  for hosting as a claude.ai artifact, like the pages in `sketches/`.

## Tech plan

- **Rendering:** WebGL 2 through [Three.js](https://threejs.org), with its WebGPU renderer where the
  browser has it (it falls back to WebGL 2 on its own). Three.js gives us PBR materials, shadows, glTF
  characters and skinned animation without writing a renderer.
- **Language/build:** TypeScript + Vite, same as Puffy.
- **Ball flight:** our own small physics step (gravity, drag, Magnus lift from spin, bounce and roll on the
  terrain), not a general physics engine. It is a few dozen lines, deterministic, and easy to tune.
- **Terrain:** height-map course with splat textures (fairway, rough, sand, green). The lie card reads
  lie type and slope straight from the height map under the ball.
- **Characters:** glTF models with shared skeletons, so every golfer can use every swing animation.
  Each friend gets a body, a face texture and a swing style (tempo to the top, backswing length, finish).
- **HUD:** plain HTML/CSS over the canvas (sharp text at any size, cheap to restyle).
- **Performance targets:** 60 fps on a mid-range phone. Instanced trees and grass, baked lighting
  for the course, one shadow-casting light, dynamic resolution if a frame runs long.

## Swing rules (from the concept)

| Mode  | Clubs              | Max carry            |
|-------|--------------------|----------------------|
| Full  | All                | Club's full yardage  |
| Punch | All but driver     | About 78% of full    |
| Pitch | PW, 50°, 56°, 60°  | 65 yds (PW) to 47    |
| Flop  | 56° or 60°         | 30 yds (56°), 26     |

- Pull down = backswing; pull length is power.
- Push up when the golfer reaches the top. Window: 70 ms early to 160 ms late. Outside it the ball goes
  a bit left/right, high/low and short, at random, more the further out you are.
- Push angle: left = draw then hook (past 12°), right = fade then slice.
- Sideways drift on the pull-back adds a little random miss.
- In the air, swipe the spin ball: down = backspin, up = topspin, sideways bends the flight.
