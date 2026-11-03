import { gamepadSources } from './gamepad';
import { installKeyboard, keyboardSources, soloKeyboard } from './keyboard';
import { touchSource } from './touch';
import { emptyInput, type InputSource } from './types';

export function installInput() {
  installKeyboard();
}

/**
 * Single player for now: one hero driven by touch, the keyboard, or any
 * gamepad — whichever you use. (Separate per-player sources stay available
 * for multiplayer later.)
 */
export const soloSource: InputSource = {
  id: 'solo',
  kind: 'touch',
  label: 'You',
  hint: '',
  connected: () => true,
  poll() {
    const s = emptyInput();
    for (const src of [touchSource, soloKeyboard, ...gamepadSources]) {
      if (!src.connected()) continue;
      const p = src.poll();
      s.left ||= p.left;
      s.right ||= p.right;
      s.jump ||= p.jump;
      s.fire ||= p.fire;
      s.run ||= p.run;
      s.bomb ||= !!p.bomb;
    }
    return s;
  },
};

export function sourceById(id: string): InputSource | undefined {
  return [soloSource, touchSource, soloKeyboard, ...keyboardSources, ...gamepadSources].find((s) => s.id === id);
}
