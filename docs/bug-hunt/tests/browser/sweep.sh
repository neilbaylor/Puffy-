#!/bin/bash
cd /tmp/pw
for part in 1 2 3 4 5 6; do CPU2D=1 TOP=0 timeout 120 node perf.mjs $1 $part 12 1 2>&1 | head -1 | cut -c1-170; done
BOSSES=1,3,4,5 timeout 200 node bosses.mjs $1 15 | cut -c1-160
echo DONE
