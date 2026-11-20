// usage: node retainers.mjs <port> <needle>  -> 2 round trips (start screen -> Part 1 -> pause -> home), then a heap
// snapshot: for each detached node whose name contains <needle>, the chain of what keeps it alive
import { chromium } from 'playwright';
const [port, needle = 'screen start'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { localStorage.setItem('puffy.beaten', '6'); localStorage.setItem('puffy.light', '0'); localStorage.setItem('puffy.lightRetried', '1'); });
const p = await ctx.newPage();
await p.goto(`http://localhost:${port}/`);
await p.waitForFunction(() => window.game?.registry?.get('ready'), null, { timeout: 600000 });
for (let i = 0; i < 2; i++) {
  await p.evaluate(() => { const e = document.querySelector('.screen.start'); if (e) e.__tag = new (class StartScreenTag {})(); });
  await p.click('[data-act=play]');
  await p.waitForFunction(() => window.game.scene.isActive('Game') && window.game.scene.getScene('Game').players?.[0]?.body, null, { timeout: 300000 });
  await p.evaluate(() => window.game.events.emit('skip-intro'));
  await p.waitForFunction(() => !window.game.scene.getScene('Game').intro, null, { timeout: 120000 });
  await p.waitForTimeout(2000);
  await p.keyboard.press('Escape');
  await p.waitForSelector('[data-act=hero]');
  await p.evaluate(() => { const e = document.querySelector('.screen.modal.paused') || document.querySelector('.screen.modal'); if (e) e.__tag = new (class PauseTag {})(); });
  await p.click('[data-act=hero]');
  await p.waitForSelector('[data-act=play]');
  await p.waitForTimeout(1500);
}
const cdp = await ctx.newCDPSession(p);
await cdp.send('HeapProfiler.enable');
await cdp.send('HeapProfiler.collectGarbage');
let chunks = '';
cdp.on('HeapProfiler.addHeapSnapshotChunk', (e) => (chunks += e.chunk));
await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
const snap = JSON.parse(chunks);
const m = snap.snapshot.meta;
const NF = m.node_fields.length, EF = m.edge_fields.length;
const nName = m.node_fields.indexOf('name'), nEdges = m.node_fields.indexOf('edge_count'), nType = m.node_fields.indexOf('type');
const eType = m.edge_fields.indexOf('type'), eName = m.edge_fields.indexOf('name_or_index'), eTo = m.edge_fields.indexOf('to_node');
const edgeTypes = m.edge_types[eType];
const nodes = snap.nodes, edges = snap.edges, strings = snap.strings;
const count = nodes.length / NF;
const retainers = Array.from({ length: count }, () => []);
for (let i = 0, e = 0; i < count; i++) {
  const ec = nodes[i * NF + nEdges];
  for (let k = 0; k < ec; k++, e += EF) {
    const t = edgeTypes[edges[e + eType]];
    if (t === 'weak' || t === 'shortcut') continue;
    const to = edges[e + eTo] / NF;
    const name = t === 'element' || t === 'hidden' ? `[${edges[e + eName]}]` : strings[edges[e + eName]];
    retainers[to].push([i, name]);
  }
}
const label = (i) => strings[nodes[i * NF + nName]].slice(0, 70);
const hits = [];
for (let i = 0; i < count; i++) if (label(i) === needle) hits.push(i);
console.log(`detached "${needle}":`, hits.length);
const names = new Map(); for (let i = 0; i < count; i++) { const l = label(i); if (l.startsWith('Detached') && /div/i.test(l)) names.set(l, (names.get(l) || 0) + 1); } console.log([...names].sort((a, b) => b[1] - a[1]).slice(0, 12));
for (const h of hits.slice(0, 3)) {
  // breadth-first back to the nearest root, printing that one chain
  const prev = new Map([[h, null]]);
  const ename = new Map();
  const q = [h];
  let root = -1;
  while (q.length && root < 0) {
    const x = q.shift();
    for (const [r, en] of retainers[x]) {
      if (prev.has(r)) continue;
      prev.set(r, x);
      ename.set(r, en);
      if (/^\(GC roots\)|^Window \/|^\(Global handles\)|^\(Document DOM trees\)/.test(label(r))) { root = r; break; }
      q.push(r);
    }
  }
  const chain = [];
  for (let x = root; x !== null && x !== undefined; x = prev.get(x)) chain.push(label(x) + (ename.has(x) ? `  —[${ename.get(x)}]→` : ''));
  console.log(chain.slice(0, 18).join('\n  '));
  console.log('---');
}
await b.close();
