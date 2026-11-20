#!/bin/bash
# usage: bundle_art.sh <tree> -> /tmp/hunt/out/art-<tree>.js (an IIFE for the browser)
tree=$1
/workspace/Puffy-/node_modules/.bin/esbuild /tmp/hunt/bench_art_browser.ts --bundle --format=iife --outfile=/tmp/hunt/out/art-$(basename $tree).js --log-level=error \
  --alias:phaser=/tmp/hunt/phaser-stub.ts --alias:@src=$tree/src --define:import.meta.env.DEV=false --loader:.m4a=text --loader:.png=text
