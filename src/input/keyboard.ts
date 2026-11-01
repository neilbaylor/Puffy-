import type { InputSource, InputState } from './types';

/** Tracks physical key state globally (by KeyboardEvent.code), independent of Phaser scenes. */
const down = new Set<string>();
let installed = false;

const BLOCK_DEFAULT = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Slash', 'Period',
]);

export function installKeyboard(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    down.add(e.code);
    if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());
}

const any = (codes: string[]) => codes.some((c) => down.has(c));

interface Layout {
  left: string[];
  right: string[];
  jump: string[];
  fire: string[];
  run: string[];
}

class KeyboardSource implements InputSource {
  readonly kind = 'keyboard' as const;
  constructor(
    readonly id: string,
    readonly label: string,
    readonly hint: string,
    private layout: Layout,
  ) {}
  poll(): InputState {
    const l = this.layout;
    return {
      left: any(l.left),
      right: any(l.right),
      jump: any(l.jump),
      fire: any(l.fire),
      run: any(l.run),
    };
  }
  connected() {
    return true;
  }
}

export const keyboardSources: InputSource[] = [
  new KeyboardSource('kb1', 'Keyboard A', 'A/D move · W or Space jump · F fire · Shift run', {
    left: ['KeyA'],
    right: ['KeyD'],
    jump: ['KeyW', 'Space'],
    fire: ['KeyF'],
    run: ['ShiftLeft', 'ShiftRight'],
  }),
  new KeyboardSource('kb2', 'Keyboard B', '←/→ move · ↑ jump · / fire · . run', {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    jump: ['ArrowUp'],
    fire: ['Slash', 'Numpad0'],
    run: ['Period', 'NumpadDecimal'],
  }),
  new KeyboardSource('kb3', 'Keyboard C', 'J/L move · I jump · O fire · U run', {
    left: ['KeyJ'],
    right: ['KeyL'],
    jump: ['KeyI'],
    fire: ['KeyO'],
    run: ['KeyU'],
  }),
];

/** Pause / back keys for menus. */
export const isKeyDown = (code: string) => down.has(code);
