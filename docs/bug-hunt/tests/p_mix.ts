// Stereo → mono mixdown of a decoded song (music.ts decode): the current per-channel loop vs one pass for two
// channels. Same output, bit for bit? And how long, for a 150 s song at 32 kHz (4.8 M samples per channel)?
const N = 150 * 32000;
const L = new Float32Array(N);
const R = new Float32Array(N);
let s = 12345;
const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32) * 2 - 1;
for (let i = 0; i < N; i++) {
  L[i] = rnd() * 0.9;
  R[i] = rnd() * 0.9;
}
for (let i = 0; i < 2000; i++) { L[i] = (rnd() * 1e-38) / (1 + i); R[i + 2000] = (rnd() * 1e-39) / (1 + i); } // (denormals, and the extremes)
R[8] = -1;
const SLICE = 1 << 18;
function current(chs: Float32Array[]) {
  const o = new Float32Array(N);
  const n = chs.length;
  for (let c = 0; c < n; c++) {
    const d = chs[c];
    for (let s0 = 0, s1 = 0; s0 < d.length; s0 = s1) {
      s1 = Math.min(d.length, s0 + SLICE);
      for (let i = s0; i < s1; i++) o[i] += d[i] / n;
    }
  }
  return o;
}
function onePass(chs: Float32Array[]) {
  const o = new Float32Array(N);
  if (chs.length === 2) {
    const [a, b] = chs;
    for (let s0 = 0, s1 = 0; s0 < N; s0 = s1) {
      s1 = Math.min(N, s0 + SLICE);
      for (let i = s0; i < s1; i++) o[i] = Math.fround(a[i] / 2) + b[i] / 2;
    }
    return o;
  }
  return current(chs);
}
const time = (f: () => Float32Array) => {
  const t: number[] = [];
  let out!: Float32Array;
  for (let k = 0; k < 9; k++) {
    const t0 = performance.now();
    out = f();
    t.push(performance.now() - t0);
  }
  t.sort((x, y) => x - y);
  return { ms: t[4], out };
};
const a = time(() => current([L, R]));
const b = time(() => onePass([L, R]));
let same = true;
for (let i = 0; i < N; i++) if (Object.is(a.out[i], b.out[i]) === false) { same = false; console.log('differs at', i, a.out[i], b.out[i]); break; }
console.log(`current ${a.ms.toFixed(1)} ms · one pass ${b.ms.toFixed(1)} ms (${(a.ms / b.ms).toFixed(2)}x) · identical: ${same}`);
console.log(`per 262144-sample slice: current ${((a.ms / (N / SLICE)) / 2).toFixed(2)} ms per channel-slice (x2 channels) vs one pass ${(b.ms / (N / SLICE)).toFixed(2)} ms per slice`);
