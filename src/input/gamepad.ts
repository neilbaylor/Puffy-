import type { InputSource, InputState } from './types';

const DEAD = 0.3;
const RUN_TILT = 0.85;

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
    const pads = navigator.getGamepads?.() ?? [];
    return pads[this.index] ?? null;
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
    };
  }
}

export const gamepadSources: InputSource[] = [0, 1, 2, 3].map((i) => new GamepadSource(i));
