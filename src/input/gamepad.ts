import type { InputSource, InputState } from './types';

const DEAD = 0.3;
const RUN_TILT = 0.85;

/**
 * Asking the browser for its gamepads (navigator.getGamepads) isn't free — a fresh list each time —
 * and the game asked five times a frame, every frame, on every phone and tablet, for pads almost no
 * one has. A browser only ever shows a page a pad after it's been used (and says so with a
 * 'gamepadconnected' event), so until then it's only asked about once a second (in case that event
 * was somehow missed); once a pad has shown up, once a frame, shared by all four pad slots.
 */
let padSeen = false;
let nextLook = 0;
let pads: readonly (Gamepad | null)[] = [];
let padsAt = -1;
if (typeof window !== 'undefined') window.addEventListener('gamepadconnected', () => (padSeen = true));

function currentPads(): readonly (Gamepad | null)[] {
  const now = performance.now();
  if (!padSeen) {
    if (now < nextLook) return pads;
    nextLook = now + 1000;
  } else if (now - padsAt < 4) return pads; // (the same frame: the list just read)
  padsAt = now;
  pads = navigator.getGamepads?.() ?? [];
  if (!padSeen && pads.some((p) => p?.connected)) padSeen = true;
  return pads;
}

class GamepadSource implements InputSource {
  readonly kind = 'gamepad' as const;
  readonly id: string;
  readonly label: string;
  readonly hint = 'Stick/D-pad move · A jump · X fire · B/RT run';
  constructor(private index: number) {
    this.id = `pad${index}`;
    this.label = `Gamepad ${index + 1}`;
  }
  private pad(): Gamepad | null {
    return currentPads()[this.index] ?? null;
  }
  connected() {
    return !!this.pad()?.connected;
  }
  poll(): InputState {
    const p = this.pad();
    if (!p) return { left: false, right: false, run: false, jump: false, fire: false };
    const b = (i: number) => !!p.buttons[i]?.pressed;
    const ax = p.axes[0] ?? 0;
    return {
      left: ax < -DEAD || b(14),
      right: ax > DEAD || b(15),
      jump: b(0),
      fire: b(2) || b(3),
      run: b(1) || b(5) || b(7) || Math.abs(ax) > RUN_TILT,
      bomb: b(3),
    };
  }
}

export const gamepadSources: InputSource[] = [0, 1, 2, 3].map((i) => new GamepadSource(i));
