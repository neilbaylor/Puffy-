#!/bin/bash
# usage: bash run.sh file.ts  -> bundles with esbuild (Phaser stubbed, a few browser globals shimmed) and runs under node with a 60 s timeout
# REPO defaults to /workspace/Puffy- (the tests import from there); the stub and shim sit next to this script.
here=$(cd "$(dirname "$0")" && pwd)
REPO=${REPO:-/workspace/Puffy-}
f=$1; shift
mkdir -p /tmp/hunt/out
out=/tmp/hunt/out/$(basename "$f" .ts).mjs
"$REPO/node_modules/.bin/esbuild" "$f" --bundle --platform=node --format=esm --outfile="$out" --log-level=error \
  --alias:phaser="$here/phaser-stub.ts" --inject:"$here/dom-shim.js" --alias:ws="$REPO/node_modules/ws/index.js" \
  "--banner:js=import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" \
  --define:import.meta.env.DEV=false --loader:.m4a=text --loader:.mp3=text --loader:.png=text --loader:.ogg=text --loader:.wav=text --loader:.woff2=text \
  && timeout 60 node "$out" "$@"
