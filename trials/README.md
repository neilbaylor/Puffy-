# Trials

Builds of the game served beside the real one, for trying things on real devices.

- `p4/` — the game on Phaser 4, served at `/p4/`. Built from the `claude/phaser4-trial` branch with
  `npm run build:p4` (its `dist-p4/`: the page, `assets/*.js` and `assets/*.css`; its songs and fonts
  are the real game's very same files and come from `dist/assets`). It shares the real game's saves
  (same site) but not its offline helper.
