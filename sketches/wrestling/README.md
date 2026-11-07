# Poo Palace (Part 3 boss arena) — concept screens

Not shipped code. `concept.ts` draws the screens with the game's own art code (the basketball
arena's bowl, crowd, LED boards and jumbotron restyled in poo browns, the Plops, the heroes),
plus a side-on wrestling ring. To redraw them:

    npx esbuild sketches/wrestling/main.ts --bundle --format=iife --outfile=/tmp/ring/out.js
    # then open an index.html that loads out.js (with the Lilita One + Nunito Google fonts)

- wide.jpg — the fight camera ("hard cam"): the whole ring side-on, arena behind
- plan.jpg — the ring as a level (what each part does)
- entrance.jpg — Queen Plop's entrance on the top turnbuckle
- fight.jpg — mid-fight: 3 hearts + nuggies vs. her health bar; a top-rope dive counts double
- finish.jpg — the end: Queen Plop dazed on the mat ("Nice work… but you'll never out-wrestle THE KING!")
- king.jpg — the camera pulls out: the King was watching from the stands, and runs out (end of the fight)
