/**
 * Tiny WebAudio synth for placeholder sound effects — no audio files needed.
 * Browsers only allow audio after a user gesture, so `unlockAudio()` is called
 * from the first tap/click/key.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Sound on/off, remembered between visits. */
let muted = (() => {
  try {
    return localStorage.getItem('puffy.muted') === '1';
  } catch {
    return false;
  }
})();

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

/** The shared audio context (made on the first tap), for the music too. */
export const audioContext = () => ctx;

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('puffy.muted', m ? '1' : '0');
  } catch {
    /* private mode */
  }
  if (master) master.gain.value = m ? 0 : 0.5;
}
export const isMuted = () => muted;

interface ToneOpts {
  type?: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  vol?: number;
  delay?: number;
}

function tone({ type = 'square', from, to = from, dur, vol = 0.2, delay = 0 }: ToneOpts) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(dur: number, vol: number, filterFrom: number, filterTo: number, delay = 0) {
  if (!ctx || !master || muted) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(filterFrom, t0);
  f.frequency.exponentialRampToValueAtTime(filterTo, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const sfx = {
  jump: () => tone({ type: 'square', from: 280, to: 620, dur: 0.14, vol: 0.09 }),
  /** A basketball bouncing on the hardwood (k = 0..1 loudness). */
  dribble: (k = 1) => {
    tone({ type: 'sine', from: 150, to: 70, dur: 0.09, vol: 0.32 * k });
    noise(0.05, 0.1 * k, 2200, 600);
  },
  /** A boot hitting the ball (k = 0..1 loudness). */
  kick: (k = 1) => {
    tone({ type: 'sine', from: 160, to: 60, dur: 0.1, vol: 0.25 * k });
    noise(0.06, 0.18 * k, 1800, 400);
  },
  /** A rising swoosh (the broadcast wipe). */
  whoosh: () => {
    noise(0.5, 0.28, 400, 4200);
    tone({ type: 'sine', from: 90, to: 260, dur: 0.45, vol: 0.12 });
  },
  /** Referee whistle: they've spotted you. */
  whistle: () => {
    tone({ type: 'square', from: 2300, to: 2500, dur: 0.12, vol: 0.05 });
    tone({ type: 'square', from: 2500, to: 2300, dur: 0.22, vol: 0.05, delay: 0.14 });
  },
  jump2: () => {
    tone({ type: 'square', from: 520, to: 980, dur: 0.12, vol: 0.07 });
    noise(0.12, 0.12, 3000, 900);
  },
  shoot: () => {
    noise(0.25, 0.35, 2400, 300);
    tone({ type: 'sawtooth', from: 180, to: 60, dur: 0.18, vol: 0.12 });
  },
  /** A little Plop shouting "POO-PA!" (two squeaky syllables). */
  poopa: (pitch = 1) => {
    tone({ type: 'square', from: 420 * pitch, to: 330 * pitch, dur: 0.12, vol: 0.06 });
    tone({ type: 'square', from: 520 * pitch, to: 640 * pitch, dur: 0.16, vol: 0.07, delay: 0.15 });
    noise(0.05, 0.08, 1800, 600, 0.14);
  },
  /** A fuzzy blaster shot: a soft "pfoomp". */
  pew: () => {
    tone({ type: 'square', from: 520, to: 180, dur: 0.12, vol: 0.06 });
    noise(0.1, 0.12, 1400, 400);
  },
  /** A chainsaw revving up. */
  saw: () => {
    tone({ type: 'sawtooth', from: 90, to: 160, dur: 0.35, vol: 0.06 });
    tone({ type: 'sawtooth', from: 160, to: 140, dur: 0.5, vol: 0.05, delay: 0.32 });
    noise(0.8, 0.06, 900, 300);
  },
  /** A confetti cannon going off. */
  pop: () => {
    noise(0.18, 0.35, 900, 200);
    tone({ type: 'sine', from: 180, to: 60, dur: 0.14, vol: 0.22 });
    noise(0.5, 0.06, 6000, 2500, 0.05);
  },
  explode: () => {
    noise(0.6, 0.6, 1800, 80);
    tone({ type: 'sine', from: 120, to: 35, dur: 0.45, vol: 0.4 });
  },
  aura: () => {
    tone({ type: 'sine', from: 880, to: 1320, dur: 0.12, vol: 0.12 });
    tone({ type: 'triangle', from: 1760, to: 2200, dur: 0.18, vol: 0.06, delay: 0.05 });
  },
  drum: () => {
    tone({ type: 'sine', from: 140, to: 50, dur: 0.35, vol: 0.5 });
    noise(0.2, 0.3, 900, 120);
    tone({ type: 'sine', from: 140, to: 50, dur: 0.35, vol: 0.45, delay: 0.18 });
  },
  swish: () => noise(0.35, 0.25, 6000, 2500),
  clank: () => {
    tone({ type: 'square', from: 660, to: 590, dur: 0.18, vol: 0.08 });
    tone({ type: 'triangle', from: 1320, to: 1250, dur: 0.25, vol: 0.06 });
  },
  cheer: () => {
    noise(1.2, 0.22, 2200, 900);
    [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.14, vol: 0.06, delay: i * 0.08 }));
  },
  groan: () => tone({ type: 'sawtooth', from: 220, to: 120, dur: 0.6, vol: 0.06 }),
  /** A silly "meh-eh-eh-eh!" as a goat keels over. */
  bleat: () =>
    [0, 1, 2, 3, 4].forEach((i) =>
      tone({ type: 'sawtooth', from: (i % 2 ? 520 : 600) - i * 30, to: (i % 2 ? 600 : 520) - i * 34, dur: 0.075, vol: 0.05, delay: 0.05 + i * 0.075 }),
    ),
  spit: () => {
    noise(0.12, 0.3, 1800, 500);
    tone({ type: 'sine', from: 400, to: 900, dur: 0.12, vol: 0.12 });
  },
  laugh: () => [0, 1, 2, 3].forEach((i) => tone({ type: 'square', from: 300 - i * 20, to: 200 - i * 20, dur: 0.12, vol: 0.08, delay: i * 0.17 })),
  /** A smaller crunchy bite (the 2nd and 3rd munch). */
  munch: () => {
    noise(0.06, 0.18, 1600, 500);
    tone({ type: 'triangle', from: 260, to: 170, dur: 0.05, vol: 0.08, delay: 0.03 });
  },
  chomp: () => {
    noise(0.07, 0.25, 1400, 400);
    noise(0.07, 0.22, 1200, 300, 0.12);
    tone({ type: 'triangle', from: 300, to: 180, dur: 0.06, vol: 0.12, delay: 0.24 });
  },
  rootbeer: () => {
    tone({ type: 'sine', from: 520, to: 880, dur: 0.1, vol: 0.12 });
    noise(0.18, 0.12, 4000, 1500, 0.08);
    tone({ type: 'triangle', from: 1320, dur: 0.16, vol: 0.08, delay: 0.12 });
  },
  stomp: () => {
    tone({ type: 'square', from: 420, to: 120, dur: 0.12, vol: 0.14 });
    noise(0.08, 0.15, 900, 200);
  },
  thud: () => {
    tone({ type: 'sine', from: 90, to: 30, dur: 0.5, vol: 0.5 });
    noise(0.35, 0.35, 600, 60);
  },
  roar: () => {
    tone({ type: 'sawtooth', from: 140, to: 70, dur: 0.6, vol: 0.12 });
    noise(0.5, 0.15, 900, 200);
  },
  bump: () => tone({ type: 'triangle', from: 160, to: 90, dur: 0.1, vol: 0.25 }),
  crumble: () => noise(0.3, 0.4, 3000, 200),
  hurt: () => {
    tone({ type: 'square', from: 520, to: 140, dur: 0.3, vol: 0.12 });
  },
  die: () => {
    tone({ type: 'square', from: 660, to: 330, dur: 0.15, vol: 0.1 });
    tone({ type: 'square', from: 330, to: 80, dur: 0.5, vol: 0.1, delay: 0.15 });
  },
  powerup: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', from: f, dur: 0.09, vol: 0.07, delay: i * 0.07 })),
  enemyShot: () => tone({ type: 'sawtooth', from: 300, to: 120, dur: 0.15, vol: 0.08 }),
  checkpoint: () => [659, 784, 988].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.14, vol: 0.18, delay: i * 0.09 })),
  goal: () =>
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
      tone({ type: 'square', from: f, dur: 0.16, vol: 0.08, delay: i * 0.12 }),
    ),
  select: () => tone({ type: 'square', from: 660, to: 880, dur: 0.08, vol: 0.08 }),
  back: () => tone({ type: 'square', from: 440, to: 300, dur: 0.08, vol: 0.08 }),
};
