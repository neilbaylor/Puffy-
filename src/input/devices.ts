import { gamepadSources } from './gamepad';
import { installKeyboard, keyboardSources } from './keyboard';
import { touchSource } from './touch';
import type { InputSource } from './types';

export function installInput() {
  installKeyboard();
}

/** Every input device that could join a game right now. */
export function allSources(): InputSource[] {
  return [touchSource, ...keyboardSources, ...gamepadSources.filter((g) => g.connected())];
}

export function sourceById(id: string): InputSource | undefined {
  return [touchSource, ...keyboardSources, ...gamepadSources].find((s) => s.id === id);
}
