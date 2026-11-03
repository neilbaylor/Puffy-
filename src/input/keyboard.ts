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
  window.addEventListener('blur', () => {
    down.clear();
    mouseFire = false;
  });
  // on a computer, clicking the game (not the buttons) fires the bazooka
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const t = e.target as HTMLElement | null;
    if (t && t.closest('button, .screen, .panel, .hud, .hoops')) return;
    mouseFire = true;
  });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') mouseFire = false;
  });
}

/** Left mouse button held over the game. */
let mouseFire = false;

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
      fire: any(l.fire) || (this.id === 'kb' && mouseFire),
      run: any(l.run),
      bomb: this.id === 'kb' && any(['KeyB', 'KeyE', 'Enter', 'NumpadEnter']),
    };
  }
  connected() {
    return true;
  }
}

/** Single-player keyboard (+ mouse): arrows or WASD to move, ↑/W jump, Space (or F/J/X, or click) to fire, Shift run. */
export const soloKeyboard: InputSource = new KeyboardSource('kb', 'Keyboard', '←/→ or A/D move · ↑ jump · Space fire · Shift run', {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['ArrowUp', 'KeyW', 'KeyZ', 'KeyK'],
  fire: ['Space', 'KeyF', 'KeyJ', 'KeyX'],
  run: ['ShiftLeft', 'ShiftRight', 'KeyL'],
});

/** Separate layouts for local multiplayer later. */
export const keyboardSources: InputSource[] = [
  new KeyboardSource('kb1', 'Keyboard A', 'A/D move · W jump · Space or F fire · Shift run', {
    left: ['KeyA'],
    right: ['KeyD'],
    jump: ['KeyW'],
    fire: ['Space', 'KeyF'],
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
