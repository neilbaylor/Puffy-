# The Poo Palace: Queen Plop boss fight (end of Part 3)

The concept screens are in this folder (`wide`, `plan`, `entrance`, `fight`, `finish`, `kingWide`, `king`).

## The arena
- The basketball arena (bowl, crowd, LED ribbon and boards, jumbotron, banners), restyled in
  poo browns as the **Poo Palace**. Poo drips off the rafters, the jumbotron and the decks, and
  there are splats on the boards. Fans hold signs (POOPA!, GO PUFFY, QUEEN ♛ PLOP, P.U.!).
- A wrestling ring in the middle, with **POO PALACE** on its skirt and QUEEN PLOP on the mat.
  The announce table (POOPA TV), steel steps and poo piles are on the floor around it.
- A **poo puddle** in one corner of the mat. It sinks you like the puddles in the level.

## The camera
- The fight is filmed from the side, like a wrestling TV camera (`wide.jpg`). The crowd, boards
  and jumbotron are already flat walls facing the camera, so a side-on fight sits in front of them naturally.
- The fight is **normal 2D along one line across the mat**, with the same running, jumping,
  bazooka and stomping as the rest of the game.
- Layering: the back ropes and posts are behind the fighters, the **front ropes are see-through**
  (so they never hide the fight), and the front posts are in front.
- The camera sits a little closer and follows the action (`fight.jpg`). Cutscenes (her entrance and
  the ending) use close-ups and zooms, like the basketball intro.

## You
- **3 hearts** (like Battle mode) plus your **nuggies**. A hit costs a nuggie first. Only with no
  nuggies left does it cost a heart, and you're out when the hearts are gone. Nuggies turn up
  during the fight.
- **The ropes:**
  - **Run into them and bounce off** fast, like a springboard.
  - **Climb them to the top turnbuckle.** Climbing has to look and feel good (hand over hand, a
    little sway). This is the part not to rush.
  - **Jump off the top and land on her: that hit counts double** ("TOP ROPE! ×2").
  - **Rope physics:** each rope is a springy line. It stretches where you hit it, sags under you as you
    climb, and wobbles back when you let go. Launching off the top shakes all three ropes.
    Each rope is a damped spring that bends at the contact point, so this is not too complex.
- **Fall off the ring** to the floor beside it and climb the steel steps back in.

## Queen Plop
- A Plop queen: a pink royal cape, a tiara, a bow on her swirl, short lashes, a touch of blush
  and a string of pearls (feminine, but not too much).
- **Aggressive, and she jumps a lot** (hops, charges, slams).
- **She backs off when she sees you on the ropes**, so you have to climb and jump off quickly.
- **8 hits to beat her.** Her health bar is in 8 pieces, and **the jumbotron counts down** the hits
  left ("3 HITS TO GO").
- No referee: enough hits and she's done.

## The ending (cutscene)
1. The Queen is **on the mat, dazed** (stars circling): *"Nice work… but you'll never
   out-wrestle THE KING!"* (`finish.jpg`)
2. The camera **pulls right out** across the arena: someone's in the front row of the stands
   (`kingWide.jpg`)…
3. …and **zooms in: the King!** He was watching all along. The jumbotron flashes "THE KING?!" and
   he runs for the exit tunnel (`king.jpg`). **That's the end of the battle.**

## Building it (rough order)
1. The arena and ring drawn at game size (reusing the basketball arena drawing), plus the side-on camera.
2. The fight scene on the platformer's controls and physics, the mat as the floor, falling off to the floor beside the ring.
3. **The ropes: bouncing, climbing, the top turnbuckle and rope physics** (tuned until they feel right).
4. Queen Plop: her art and frames, her moves (jumps, charges, slams, backing off from the ropes), 8 hits.
5. The HUD (hearts, nuggies, her 8-piece bar), the jumbotron countdown, nuggies during the fight.
6. Her entrance, and the ending cutscene with the King.
