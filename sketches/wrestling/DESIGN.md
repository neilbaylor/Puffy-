# The Poo Palace: Queen Plop boss fight (end of Part 3)

The concept screens are in this folder (`wide`, `plan`, `entrance`, `fight`, `finish`, `kingWide`, `king`).

## The arena
- The basketball arena (bowl, crowd, LED ribbon and boards, jumbotron, banners), restyled in
  poo browns as the **Poo Palace**. Poo drips off the rafters, the jumbotron and the decks, and
  there are splats on the boards. Fans hold signs (POOPA!, GO PUFFY, QUEEN ♛ PLOP, P.U.!).
- A wrestling ring in the middle, with **POO PALACE** on its skirt and QUEEN PLOP on the mat.
  The announce table (POOPA TV), steel steps and poo piles are on the floor around it.
- A **poo puddle** in one corner of the mat: quicksand, like the level's (sink slowly, hop out; go right under and it costs you).

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
- **6 hearts (the most you can have), shown over your head** (like Battle mode). No HUD and no nuggies in the ring (just
  the pause button). A hit costs a heart; **hearts turn up in the ring** often (every 2–4 s) whenever you're below 6. Out of
  hearts costs a life from the full game.
- **The folding chair** (folded flat, grey steel) drops into the ring **3 times a match** (about every 10–13 s, sooner as she weakens) ("CHAIR!" on
  the jumbotron). Walk over it to pick it up: the hero bends down and holds it up over their head in
  both hands (no bazooka). The FIRE button (still red) says CHAIR: press it to swing the chair down onto her (when she's in reach): **3 hits**, it bends
  and it's gone. Leave it and it fades away; get hit twice while holding it and you drop it.
- **The ropes:**
  - **Run into them and bounce off** fast, like a springboard.
  - **Climb them to the top turnbuckle.** Climbing has to look and feel good (hand over hand, a
    little sway). This is the part not to rush.
  - **Jump off the top and land on her: that hit counts triple** ("TOP ROPE! ×3").
  - **Rope physics:** each rope is a springy line. It stretches where you hit it, sags under you as you
    climb, and wobbles back when you let go. Launching off the top shakes all three ropes.
    Each rope is a damped spring that bends at the contact point, so this is not too complex.
- **No leaving the ring**: the ropes keep you in at any height (above the top rope, only as far as the corner posts).
- **The bazooka works**: every rocket knocks her back, but it takes **two rockets for one hit** (no halves shown anywhere).

## Queen Plop
- A Plop queen: a pink royal cape, a tiara, a bow on her swirl, short lashes, a touch of blush
  and a string of pearls (feminine, but not too much).
- **Aggressive, and she jumps a lot** (hops, charges, slams).
- **She backs off when she sees you on the ropes**, so you have to climb and jump off quickly.
- **Aggressive, jumping more and higher**: big hops and lunges (her landings rumble the camera
  and the ring, like the Giant Plops), charges, slams, and the Giant Plops' **big lump of poo**
  that lands short of you and rolls on at you.
- **15 hits to beat her.** **The jumbotron counts down** the hits
  left ("3 HITS TO GO") and flashes "FROM THE TOP ROPE!" for a dive.
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
