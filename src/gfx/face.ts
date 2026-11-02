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
