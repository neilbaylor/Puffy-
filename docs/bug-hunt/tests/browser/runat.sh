#!/bin/bash
# usage: runat.sh <tree> file.ts  -> like run.sh, with @src pointing at <tree>/src
here=/tmp/hunt; tree=$1; f=$2; shift 2
out=/tmp/hunt/out/$(basename "$f" .ts)-$(basename $tree).mjs
/workspace/Puffy-/node_modules/.bin/esbuild "$f" --bundle --platform=node --format=esm --outfile="$out" --log-level=error \
  --alias:phaser=$here/phaser-stub.ts --inject:$here/dom-shim.js --alias:@src=$tree/src \
  --define:import.meta.env.DEV=false --loader:.m4a=text --loader:.png=text && timeout 120 node "$out" "$@"
