# Puffy — notes for Claude Code

Start here, then read:

- `docs/HANDOFF.md`: how the project works, how a change ships, how we test, where things live.
- `docs/SESSION_NOTES.md`: what has been built so far, the decisions behind it, the owner's preferences.
- `docs/MAKING_A_LEVEL.md`: how to build a new level from our art (the level DSL, every piece you can place, worked example).

## The short version

- Phaser 3.90 + TypeScript + Vite. A phone-first (landscape) platformer, plus an online Battle mode (Node `ws` server).
- **Shipping a change:** commit, bump `src/version.ts` by 0.01, `npm run build:single` then copy
  `dist-single/index.html` to `sketches/puffy-game.html`, `npm run build`, commit "vX.YZ: …", push to
  **`claude/game-base`** (Railway deploys that branch automatically). The start screen shows the version.
- **Checks before shipping:** `npx tsc --noEmit -p .` and `npm run build` must pass; for Battle rules changes run
  `scripts/qa/simtest.ts` (see HANDOFF). Take a Playwright screenshot when the change is visual.
- Commit messages describe what a player would notice, in plain words.
- The owner talks in short, casual requests and often sends several in a row; reply in plain language
  (what changed, what you checked), no code jargon.
