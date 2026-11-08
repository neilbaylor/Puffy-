#!/bin/bash
# Level 4 checks, run from the repo root: sketches/level4/l4tests.sh [--bot]
#   layout: no tight spots, sideways gaps, no ladders of turn clouds; jump reachability for every hero (simulated).
#   --bot: a bot plays every climb with every hero in the browser (needs `npm run build` and the server on :8091,
#          e.g. PORT=8091 node server.mjs — restart it after every build). Each line should end "fails":[] and "done".
set -e
cd "$(dirname "$0")/../.."
out=$(mktemp -d)
for t in l4check l4gaps l4turns l4reach; do
  npx esbuild sketches/level4/$t.ts --bundle --platform=node --outfile=$out/$t.cjs --log-level=error
  node $out/$t.cjs
done
if [ "$1" = "--bot" ]; then
  for h in puffy scruffy muscles; do for c in 0 1 2; do node sketches/level4/tl4bot.cjs $h $c | head -1; done; done
fi
