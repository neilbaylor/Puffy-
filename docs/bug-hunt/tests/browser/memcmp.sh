#!/bin/bash
cd /tmp/pw
for w in start part:2 part:5 boss:1; do for port in 18101 18103; do timeout 200 node memcensus.mjs $port $w 0 | python3 -c "
import json,sys; t=sys.stdin.read(); d=json.loads(t[t.index('{'):])
print('$w'.ljust(7), 'BEFORE' if '$port'=='18101' else 'AFTER ', 'kept canvas', str(d['keptCanvasMB']).rjust(4), 'MB | GPU', d['gpuMB'], 'MB | heap', d['heapMB'], '|', [k for k in d['keptCanvases'] if not k.startswith('bgcloud')][:6])"; done; done
echo DONE
