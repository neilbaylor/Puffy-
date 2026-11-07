# Plop Dome (Part 3 boss arena) — concept screens

Not shipped code. `concept.ts` draws the screens with the game's own art code (the basketball
arena's bowl, crowd, LED boards and jumbotron restyled in poo browns, the Plops, the heroes),
plus a side-on wrestling ring. To redraw them:

    npx esbuild sketches/wrestling/main.ts --bundle --format=iife --outfile=/tmp/ring/out.js
    # then open an index.html that loads out.js (with the Lilita One + Nunito Google fonts)

- wide.jpg — the fight camera ("hard cam"): the whole ring side-on, arena behind
- plan.jpg — the ring as a level (what each part does)
- entrance.jpg — King Plop's entrance on the top turnbuckle
- fight.jpg — mid-fight, with the health-bar HUD
- finish.jpg — the 1-2-3 with a Plop referee
