/**
 * The complete control set for one player. This is deliberately tiny and
 * "held-state only" (no edge events) so it can be packed into a few bits and
 * sent over the network later for online co-op.
 */
export interface InputState {
  left: boolean;
  right: boolean;
  run: boolean;
  jump: boolean;
  fire: boolean;
}

export const emptyInput = (): InputState => ({
  left: false,
  right: false,
  run: false,
  jump: false,
  fire: false,
});

export function packInput(s: InputState): number {
  return (+s.left) | (+s.right << 1) | (+s.run << 2) | (+s.jump << 3) | (+s.fire << 4);
}

export function unpackInput(n: number): InputState {
  return {
    left: !!(n & 1),
    right: !!(n & 2),
    run: !!(n & 4),
    jump: !!(n & 8),
    fire: !!(n & 16),
  };
}

export type DeviceKind = 'touch' | 'keyboard' | 'gamepad';

/** Anything that can drive a player: a keyboard layout, a gamepad, touch controls, (later) a network peer. */
export interface InputSource {
  readonly id: string;
  readonly kind: DeviceKind;
  readonly label: string;
  /** Short human readable control hint, shown in the lobby. */
  readonly hint: string;
  poll(): InputState;
  /** Whether the device is currently present (gamepads can disconnect). */
  connected(): boolean;
}
