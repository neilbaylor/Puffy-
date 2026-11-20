// The game's real songs, decoded by the browser as music.ts does (mono-target 32 kHz context): the old
// mixdown vs the new, on each — same Float32 output bit for bit? Time per song at 1x and 4x CPU.
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
const [port] = process.argv.slice(2);
const songs = readdirSync('/tmp/hunt/wtA/dist/assets').filter((f) => f.endsWith('.m4a'));
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(`http://localhost:${port}/`);
const cdp = await p.context().newCDPSession(p);
for (const thr of [1, 4]) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: thr });
  const r = await p.evaluate(async (songs) => {
    const out = [];
    for (const s of songs) {
      const data = await (await fetch('/assets/' + s)).arrayBuffer();
      const off = new OfflineAudioContext(1, 1, 32000);
      const buf = await off.decodeAudioData(data);
      const n = buf.numberOfChannels, len = buf.length, SLICE = 1 << 18;
      const time = (f) => { const ts = []; let o; for (let k = 0; k < 5; k++) { const t0 = performance.now(); o = f(); ts.push(performance.now() - t0); } ts.sort((a, b) => a - b); return [ts[2], o]; };
      const [tOld, oOld] = time(() => { const o = new Float32Array(len); for (let c = 0; c < n; c++) { const d = buf.getChannelData(c); for (let s0 = 0, s1 = 0; s0 < len; s0 = s1) { s1 = Math.min(len, s0 + SLICE); for (let i = s0; i < s1; i++) o[i] += d[i] / n; } } return o; });
      const [tNew, oNew] = time(() => { const o = new Float32Array(len); const a = buf.getChannelData(0), bb = buf.getChannelData(1); for (let s0 = 0, s1 = 0; s0 < len; s0 = s1) { s1 = Math.min(len, s0 + SLICE); for (let i = s0; i < s1; i++) o[i] = Math.fround(a[i] / 2) + bb[i] / 2; } return o; });
      const u1 = new Uint32Array(oOld.buffer), u2 = new Uint32Array(oNew.buffer);
      let diff = 0; for (let i = 0; i < u1.length; i++) if (u1[i] !== u2[i]) diff++;
      out.push(`${s.split('-')[0].padEnd(10)} ${n}ch ${(len / 32000).toFixed(0)}s  old ${tOld.toFixed(1)} ms  new ${tNew.toFixed(1)} ms  (${(tOld / tNew).toFixed(1)}x)  differing samples: ${diff}`);
    }
    return out;
  }, songs);
  console.log(`CPU ${thr}x:\n  ` + r.join('\n  '));
}
await b.close();
