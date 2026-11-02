/**
 * Small facial expressions for the heroes, independent of their body pose:
 * where the eyes look, blinking, and the mouth. The drawing functions read the
 * current face while they draw; callers set it for one drawing with withFace().
 */
export type Mouth = 'rest' | 'smile' | 'open' | 'o';

export interface Face {
  /** Pupils: -1 (looking back) … 1 (looking forward). */
  lookX: number;
  /** Pupils: -1 (up) … 1 (down). */
  lookY: number;
  /** Eyelids closed. */
  blink: boolean;
  mouth: Mouth;
}

export const NEUTRAL_FACE: Face = { lookX: 0, lookY: 0, blink: false, mouth: 'rest' };

let current: Face = NEUTRAL_FACE;

/** The face to draw right now. */
export const face = () => current;

/** Draw with this face (or the neutral one when none is given). */
export function withFace(f: Face | undefined, draw: () => void) {
  if (!f) return draw();
  const prev = current;
  current = f;
  try {
    draw();
  } finally {
    current = prev;
  }
}

// ─── faces in the game: pre-drawn frames + a little clock that picks them ───

export type Eyes = 'n' | 'blink' | 'back' | 'up';
const EYES: Eyes[] = ['n', 'blink', 'back', 'up'];
const MOUTHS: Mouth[] = ['rest', 'o', 'open'];

/** Frame names for every eyes × mouth combination (the plain face is the normal idle frame). */
export const FACE_FRAMES: string[] = EYES.flatMap((e) => MOUTHS.map((m) => `${e}-${m}`)).filter((k) => k !== 'n-rest');

export function faceFromKey(key: string): Face {
  const [e, m] = key.split('-') as [Eyes, Mouth];
  return {
    blink: e === 'blink',
    lookX: e === 'back' ? -1 : e === 'up' ? 0.4 : 0,
    lookY: e === 'up' ? -0.9 : 0,
    mouth: m,
  };
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Now and then the eyes blink or glance around, and (on their own clock) the
 * mouth smiles, goes "o" or chatters. Ticked with the game's frame time.
 * `key` is the face frame to show, or null for the plain face.
 */
export class FaceClock {
  private eyes: Eyes = 'n';
  private mouth: Mouth = 'rest';
  private eyeT = rnd(0.8, 3);
  private mouthT = rnd(2, 5);
  /** Queued steps: [seconds from now, what to set]. */
  private eyeQ: [number, Eyes][] = [];
  private mouthQ: [number, Mouth][] = [];

  tick(dt: number) {
    this.eyeT -= dt;
    this.mouthT -= dt;
    for (const q of this.eyeQ) q[0] -= dt;
    for (const q of this.mouthQ) q[0] -= dt;
    while (this.eyeQ.length && this.eyeQ[0][0] <= 0) this.eyes = this.eyeQ.shift()![1];
    while (this.mouthQ.length && this.mouthQ[0][0] <= 0) this.mouth = this.mouthQ.shift()![1];
    if (this.eyeT <= 0 && !this.eyeQ.length) {
      this.eyeT = rnd(1.6, 4.5);
      if (Math.random() < 0.5) {
        this.eyeQ.push([0, 'blink'], [0.12, 'n']);
        if (Math.random() < 0.25) this.eyeQ.push([0.26, 'blink'], [0.37, 'n']);
      } else {
        const hold = rnd(0.7, 1.6);
        this.eyeQ.push([0, Math.random() < 0.55 ? 'back' : 'up'], [hold, Math.random() < 0.3 ? 'blink' : 'n'], [hold + 0.12, 'n']);
      }
    }
    if (this.mouthT <= 0 && !this.mouthQ.length) {
      // mostly breathing: the mouth opens a little and closes again; now and
      // then a big open mouth, or a quick chatter
      const r = Math.random();
      let t = 0;
      if (r < 0.7) {
        t = rnd(0.55, 0.9);
        this.mouthQ.push([0, 'o'], [t, 'rest']);
      } else if (r < 0.9) {
        t = rnd(0.7, 1.1);
        this.mouthQ.push([0, 'o'], [0.12, 'open'], [t - 0.12, 'o'], [t, 'rest']);
      } else {
        const n = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          this.mouthQ.push([t, i % 2 === 0 ? 'open' : 'rest']);
          t += rnd(0.11, 0.18);
        }
        this.mouthQ.push([t, 'rest']);
      }
      this.mouthT = t + rnd(1.8, 3.6);
    }
  }

  get key(): string | null {
    const k = `${this.eyes}-${this.mouth}`;
    return k === 'n-rest' ? null : k;
  }
}
